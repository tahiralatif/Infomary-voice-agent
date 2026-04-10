'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { createSpeechmaticsJWT } from '@speechmatics/auth'

const TEMPLATE_ID = '0976156d-9e20-46b7-be7d-3371ff6ae24f:latest'

export default function VoiceAgent() {
  const webSocketRef = useRef<WebSocket | null>(null)
  const [connected, setConnected] = useState(false)
  const [speaking, setSpeaking] = useState<'user' | 'agent' | null>(null)
  const [transcript, setTranscript] = useState<{role: string, text: string}[]>([])
  const audioCtxRef = useRef<AudioContext | null>(null)
  const bufferRef = useRef<number[]>([])
  const startTimeRef = useRef(0)
  const isPlayingRef = useRef(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [transcript])

  // ─── Audio Playback ───
  const playChunk = (arrayBuffer: ArrayBuffer) => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext()
    }
    const ctx = audioCtxRef.current
    const view = new DataView(arrayBuffer)
    const float32 = new Float32Array(arrayBuffer.byteLength / 2)
    for (let i = 0; i < float32.length; i++) {
      float32[i] = view.getInt16(i * 2, true) / 0x8000
    }
    bufferRef.current.push(...Array.from(float32))
    if (!isPlayingRef.current && bufferRef.current.length >= 8000) {
      startPlayback(ctx)
    }
  }

  const startPlayback = (ctx: AudioContext) => {
    if (bufferRef.current.length === 0) return
    isPlayingRef.current = true
    const samples = Math.min(bufferRef.current.length, 32000)
    const audioBuffer = ctx.createBuffer(1, samples, 16000)
    audioBuffer.copyToChannel(new Float32Array(bufferRef.current.slice(0, samples)), 0)
    bufferRef.current = bufferRef.current.slice(samples)
    const source = ctx.createBufferSource()
    source.buffer = audioBuffer
    source.connect(ctx.destination)
    if (startTimeRef.current === 0) startTimeRef.current = ctx.currentTime
    source.start(startTimeRef.current)
    startTimeRef.current += audioBuffer.duration
    source.onended = () => {
      if (bufferRef.current.length >= 8000) {
        startPlayback(ctx)
      } else {
        isPlayingRef.current = false
        startTimeRef.current = 0
        setSpeaking(null)
      }
    }
  }

  // ─── Connect to Speechmatics ───
  const connectToSpeechmatics = async () => {
    try {
      const apiKey = process.env.NEXT_PUBLIC_SPEECHMATICS_API_KEY!
      const jwt = await createSpeechmaticsJWT({ type: 'flow', apiKey, ttl: 60 })
      
      const ws = new WebSocket(`wss://flow.api.speechmatics.com/v1/flow?jwt=${jwt}`)
      webSocketRef.current = ws
      ws.binaryType = 'arraybuffer'

      ws.onopen = async () => {
        console.log('✅ Connected to Speechmatics!')
        setConnected(true)

        // Start mic
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { sampleRate: 16000 } })
        const audioContext = new AudioContext({ sampleRate: 16000 })
        await audioContext.audioWorklet.addModule('/pcm-processor.js')
        const source = audioContext.createMediaStreamSource(stream)
        const processor = new AudioWorkletNode(audioContext, 'pcm-processor')

        processor.port.onmessage = (event) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(new Float32Array(event.data.float32Data).buffer)
          }
        }

        source.connect(processor)
        processor.connect(audioContext.destination)

        // Start conversation
        ws.send(JSON.stringify({
          message: 'StartConversation',
          audio_format: { type: 'raw', encoding: 'pcm_f32le' },
          conversation_config: {
            template_id: TEMPLATE_ID,
            template_variables: {}
          },
          tools: [
            {
              type: 'function',
              function: {
                name: 'save_lead',
                description: 'Save senior care lead information after collecting all details.',
                parameters: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', description: 'Full name of the senior' },
                    age: { type: 'string', description: 'Age of the senior' },
                    gender: { type: 'string', description: 'Gender' },
                    location: { type: 'string', description: 'City or ZIP code' },
                    email: { type: 'string', description: 'Contact email' },
                    phone: { type: 'string', description: 'Contact phone' },
                    care_need: { type: 'string', description: 'Type of care needed' },
                    conditions: { type: 'string', description: 'Medical conditions' },
                    budget: { type: 'string', description: 'Monthly budget' },
                    notes: { type: 'string', description: 'Additional notes' },
                  },
                  required: ['name', 'location', 'care_need']
                }
              }
            },
            {
              type: 'function',
              function: {
                name: 'end_conversation',
                description: 'End the conversation when user says goodbye or is done.'
              }
            }
          ]
        }))
      }

      ws.onmessage = async (event) => {
        if (event.data instanceof ArrayBuffer) {
          setSpeaking('agent')
          playChunk(event.data)
          return
        }

        const data = JSON.parse(event.data)

        switch (data.message) {
          case 'AddTranscript':
            setSpeaking('user')
            break

          case 'prompt':
            const prompt = data.prompt
            const text = prompt.response?.replace(/<[^>]*>/g, '').trim()
            if (text) {
              setTranscript(prev => {
                const idx = prev.findIndex(p => p.role === 'agent' && p.text === '')
                if (idx !== -1) {
                  const updated = [...prev]
                  updated[idx].text = text
                  return updated
                }
                return [...prev, { role: 'agent', text }]
              })
            }
            if (prompt.prompt && !prompt.prompt.includes('<RESULT>')) {
              const userText = prompt.prompt.replace(/<[^>]*>/g, '').trim()
              if (userText) {
                setTranscript(prev => [...prev, { role: 'user', text: userText }])
              }
            }
            break

          case 'ToolInvoke':
            const toolName = data.function.name
            const toolArgs = data.function.arguments
            const toolId = data.id

            if (toolName === 'save_lead') {
              try {
                const res = await fetch('https://web-production-1ecf1.up.railway.app/save-lead', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    message: { toolCallList: [{ id: toolId, function: { arguments: toolArgs } }] }
                  })
                })
                ws.send(JSON.stringify({
                  message: 'ToolResult',
                  id: toolId,
                  status: 'ok',
                  content: 'Lead saved successfully!'
                }))
              } catch (e) {
                ws.send(JSON.stringify({
                  message: 'ToolResult',
                  id: toolId,
                  status: 'error',
                  content: 'Failed to save lead.'
                }))
              }
            } else if (toolName === 'end_conversation') {
              ws.close()
              setConnected(false)
              setTranscript([])
            }
            break
        }
      }

      ws.onerror = (e) => console.error('WebSocket error:', e)
      ws.onclose = () => { setConnected(false); setSpeaking(null) }

    } catch (e) {
      console.error('Connection failed:', e)
    }
  }

  const disconnect = () => {
    webSocketRef.current?.close()
    setConnected(false)
    setTranscript([])
    setSpeaking(null)
  }

  return (
    <div className="flex h-screen bg-gray-950 text-white">
      
      {/* Sidebar */}
      <div className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col p-4">
        <h2 className="text-base font-bold text-blue-400 mb-4">InfoMary</h2>
        <div className="mt-4">
          <Link href="/" className="text-xs text-blue-400 font-semibold block py-2">
            🎙️ Voice Agent
          </Link>
          <Link href="/chat" className="text-xs text-gray-500 hover:text-gray-300 block py-2">
            💬 Text Agent
          </Link>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col items-center justify-center relative">

        {/* Header */}
        <div className="absolute top-0 left-0 right-0 p-4 border-b border-gray-800 bg-gray-950">
          <h1 className="text-lg font-bold text-blue-400">InfoSenior.care</h1>
          <p className="text-xs text-gray-500">AI-Powered Senior Care Voice Assistant</p>
        </div>

        {/* Central UI */}
        <div className="flex flex-col items-center gap-8 mt-16">

          {/* Avatar */}
          <div className="relative flex items-center justify-center">
            {connected && (
              <div className={`absolute w-48 h-48 rounded-full border-2 animate-ping ${
                speaking === 'agent' ? 'border-blue-400' : 'border-gray-700'
              }`} />
            )}
            {connected && (
              <div className={`absolute w-36 h-36 rounded-full border ${
                speaking === 'agent' ? 'border-blue-500 animate-pulse' : 'border-gray-700'
              }`} />
            )}
            <div className={`w-28 h-28 rounded-full flex items-center justify-center text-5xl transition-all duration-300 ${
              connected
                ? speaking === 'agent' ? 'bg-blue-600 shadow-lg shadow-blue-500/50 scale-110'
                : speaking === 'user' ? 'bg-purple-700 shadow-lg shadow-purple-500/50'
                : 'bg-gray-700' : 'bg-gray-800'
            }`}>
              🩺
            </div>
          </div>

          {/* Status */}
          <div className="text-center h-6">
            {speaking === 'agent' && <p className="text-blue-400 text-sm animate-pulse">Infomary is speaking...</p>}
            {speaking === 'user' && <p className="text-purple-400 text-sm animate-pulse">You are speaking...</p>}
            {!speaking && connected && <p className="text-gray-500 text-sm">Listening...</p>}
            {!connected && <p className="text-gray-600 text-sm">Press the button to start</p>}
          </div>

          {/* Button */}
          {!connected ? (
            <button onClick={connectToSpeechmatics}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-10 py-4 rounded-full text-base shadow-lg">
              🎙️ Start Conversation
            </button>
          ) : (
            <button onClick={disconnect}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold px-10 py-4 rounded-full text-base shadow-lg animate-pulse">
              ⏹ End Conversation
            </button>
          )}
        </div>

        {/* Transcript */}
        {transcript.length > 0 && (
          <div className="absolute bottom-0 left-56 right-0 max-h-48 overflow-y-auto p-4 border-t border-gray-800 bg-gray-950 space-y-2">
            {transcript.map((t, i) => (
              <div key={i} className={`flex ${t.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-md px-3 py-2 rounded-xl text-xs ${
                  t.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-200'
                }`}>
                  {t.text}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
    </div>
  )
}