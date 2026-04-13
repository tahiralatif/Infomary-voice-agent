'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { createSpeechmaticsJWT } from '@speechmatics/auth'
import { speechmaticsTools } from '../tools/speechmaticsTools'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const TEMPLATE_ID = '0976156d-9e20-46b7-be7d-3371ff6ae24f:latest'


function stripToolXML(text: string): string {
  let result = text

  
  result = result.replace(/<FUNCTION[\s\S]*?(?:<\/FUNCTION>|(?<=\S)\s*\/>|\/>)/gi, '')

  
  result = result.replace(/<FUNCTION\b[^]*$/gi, '')
  result = result.replace(/<RESULT[\s\S]*?<\/RESULT>/gi, '')
  result = result.replace(/<APPLICATION_INPUT[\s\S]*?<\/APPLICATION_INPUT>/gi, '')
  result = result.replace(/<tool_call[\s\S]*?<\/tool_call>/gi, '')
  result = result.replace(/<tool_result[\s\S]*?<\/tool_result>/gi, '')

  
  result = result.replace(/\b\w+="[^"]*"/g, '')

  
  result = result.replace(/\s+/g, ' ').trim()

  return result
}

export default function VoiceAgent() {
  const webSocketRef = useRef<WebSocket | null>(null)
  const [connected, setConnected] = useState(false)
  const [sessionId] = useState(() => `voice_${Math.random().toString(36).substring(7)}`)
  const [speaking, setSpeaking] = useState<'user' | 'agent' | null>(null)
  const [transcript, setTranscript] = useState<{role: string, text: string, promptId?: string}[]>([])
  const [partial, setPartial] = useState<string | null>(null)
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
      const jwt = await createSpeechmaticsJWT({ type: 'flow', apiKey, ttl: 3600 })
      
      const ws = new WebSocket(`wss://flow.api.speechmatics.com/v1/flow?jwt=${jwt}`)
      webSocketRef.current = ws
      ws.binaryType = 'arraybuffer'

      ws.onopen = async () => {
        console.log('✅ Connected to Speechmatics!')
        setConnected(true)

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

        ws.send(JSON.stringify({
          message: 'StartConversation',
          audio_format: { type: 'raw', encoding: 'pcm_f32le' },
          conversation_config: {
            template_id: TEMPLATE_ID,
            template_variables: {
              SESSION_ID: sessionId
            }
          },
          tools: speechmaticsTools
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
          case 'AddPartialTranscript': {
            const text = data.metadata?.transcript?.replace(/<\/?S\d+>/gi, '').trim()
            if (text) setPartial(text)
            break
          }

          case 'AddTranscript': {
            setPartial(null)
            const finalText = data.metadata?.transcript?.replace(/<\/?S\d+>/gi, '').trim()
            if (finalText) {
              setSpeaking('user')
              setTranscript(prev => {
                const last = prev[prev.length - 1]
                if (last && last.role === 'user' && !last.promptId) {
                  return [...prev.slice(0, -1), { role: 'user', text: last.text + ' ' + finalText }]
                }
                return [...prev, { role: 'user', text: finalText }]
              })
            }
            break
          }

          case 'prompt': {
            const { id: promptId, response: rawResponse = '', prompt: rawPrompt = '' } = data.prompt

            const agentText = stripToolXML(rawResponse)

            
            const hasResultXML = /<(RESULT|APPLICATION_INPUT)[\s\S]*?<\/\1>/i.test(rawPrompt)
            if (!agentText || hasResultXML) break

            setTranscript(prev => {
              const existingIdx = prev.findIndex(m => m.promptId === promptId)
              if (existingIdx !== -1) {
                const updated = [...prev]
                updated[existingIdx] = { ...updated[existingIdx], text: agentText }
                return updated
              }
              return [...prev, { promptId, role: 'agent', text: agentText }]
            })
            break
          }

          case 'ToolInvoke': {
            const toolId = data.id
            const toolName = data.function.name
            
            const toolArgs = typeof data.function.arguments === 'string' 
              ? JSON.parse(data.function.arguments) 
              : data.function.arguments

            console.log(`🔧 Tool call: ${toolName}`, toolArgs)

            // Inject session_id if missing
            if (toolName === 'save_lead' && !toolArgs.session_id) {
              toolArgs.session_id = sessionId
            }

            if (toolName === 'end_conversation' || toolName === 'EndConversation') {
              ws.send(JSON.stringify({ message: 'ToolResult', id: toolId, status: 'ok', content: 'Goodbye!' }))
              setTimeout(() => { ws.close(); setConnected(false); setTranscript([]) }, 1000)
              break
            }

            try {
              const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
              const res = await fetch(`${backendUrl}/speechmatics-tools`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  tool_name: toolName,
                  args: toolArgs
                })
              })

              if (!res.ok) {
                const errText = await res.text()
                throw new Error(`HTTP ${res.status}: ${errText.slice(0, 100)}`)
              }

              const json = await res.json()
              console.log('✅ Tool Result:', json)
              ws.send(JSON.stringify({
                message: 'ToolResult',
                id: toolId,
                status: json.error ? 'error' : 'ok',
                content: json.result || json.error || 'Done'
              }))
            } catch (e) {
              console.error('Tool call failed:', e)
              ws.send(JSON.stringify({ message: 'ToolResult', id: toolId, status: 'error', content: 'Tool failed' }))
            }
            break
          }

          default:
            if (data.message) console.log('[SM]', data.message, data.reason || '')
            break
        }
      }

      ws.onerror = (e) => console.error('WebSocket error:', e)
      ws.onclose = () => { 
        setConnected(false)
        setSpeaking(null)
        setPartial(null)
      }

    } catch (e) {
      console.error('Connection failed:', e)
    }
  }

  const disconnect = () => {
    webSocketRef.current?.close()
    setConnected(false)
    setTranscript([])
    setSpeaking(null)
    setPartial(null)
  }

  return (
    <div className="flex h-screen bg-gray-950 text-white overflow-hidden">

      {/* Sidebar */}
      <div className="w-52 bg-gray-900 border-r border-gray-800 flex flex-col shrink-0">
        <div className="p-4 border-b border-gray-800">
          <h2 className="text-base font-bold text-blue-400">InfoMary</h2>
          <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-0.5">Senior Care</p>
        </div>
        <div className="flex-1 p-3 space-y-1">
          <Link href="/" className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-blue-600/10 text-blue-400 text-sm font-medium">
            🎙️ Voice Agent
          </Link>
          <Link href="/chat" className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-gray-400 hover:bg-gray-800 text-sm transition-colors">
            💬 Text Agent
          </Link>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Header */}
        <div className="px-5 py-3.5 border-b border-gray-800 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-base font-bold text-blue-400">InfoSenior.care</h1>
            <p className="text-[11px] text-gray-500">AI-Powered Senior Care Voice Assistant</p>
          </div>
          {connected && (
            <div className="flex items-center gap-1.5 bg-green-900/20 px-2.5 py-1 rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] text-green-400 font-semibold uppercase tracking-wide">Live</span>
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="max-w-2xl mx-auto space-y-3">

            {transcript.length === 0 && !connected && (
              <div className="flex flex-col items-center justify-center h-64 text-center opacity-40">
                <div className="text-4xl mb-3">🎙️</div>
                <p className="text-gray-400 text-sm">Press Start to begin</p>
              </div>
            )}

            {transcript.map((t, i) => (
              <div key={i} className={`flex items-end gap-2 ${t.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {t.role === 'agent' && (
                  <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs shrink-0">🩺</div>
                )}
                <div className={`max-w-[72%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  t.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-none'
                    : 'bg-gray-800 text-gray-100 rounded-bl-none border border-gray-700'
                }`}>
                  {t.role === 'agent' ? (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({ ...props }) => <p className="mb-1 last:mb-0" {...props} />,
                        strong: ({ ...props }) => <strong className="font-semibold text-blue-300" {...props} />,
                        ul: ({ ...props }) => <ul className="list-disc pl-4 mb-1" {...props} />,
                        ol: ({ ...props }) => <ol className="list-decimal pl-4 mb-1" {...props} />,
                        li: ({ ...props }) => <li className="mb-0.5" {...props} />,
                        a: ({ ...props }) => <a className="text-blue-400 underline" target="_blank" rel="noreferrer" {...props} />,
                      }}
                    >
                      {t.text}
                    </ReactMarkdown>
                  ) : t.text}
                </div>
                {t.role === 'user' && (
                  <div className="w-7 h-7 rounded-full bg-blue-800 border border-blue-600 flex items-center justify-center text-xs shrink-0">👤</div>
                )}
              </div>
            ))}

            {/* Partial — user speaking */}
            {partial && (
              <div className="flex items-end gap-2 justify-end">
                <div className="max-w-[72%] rounded-2xl rounded-br-none px-4 py-2.5 text-sm bg-blue-600/30 text-white/50 italic border border-blue-500/20">
                  {partial}
                </div>
                <div className="w-7 h-7 rounded-full bg-blue-800 border border-blue-600 flex items-center justify-center text-xs shrink-0">👤</div>
              </div>
            )}

            {/* Agent typing */}
            {speaking === 'agent' && transcript[transcript.length - 1]?.role !== 'agent' && (
              <div className="flex items-end gap-2 justify-start">
                <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs shrink-0 animate-pulse">🩺</div>
                <div className="bg-gray-800 px-4 py-2.5 rounded-2xl rounded-bl-none border border-gray-700">
                  <div className="flex gap-1 items-center h-4">
                    <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-800 flex items-center justify-center gap-4 shrink-0">
          <span className="text-[10px] font-semibold uppercase tracking-widest min-w-[100px] text-center">
            {speaking === 'agent' && <span className="text-blue-400 animate-pulse">Agent Speaking</span>}
            {speaking === 'user' && <span className="text-purple-400 animate-pulse">You Speaking</span>}
            {!speaking && connected && <span className="text-gray-500">Listening...</span>}
            {!connected && <span className="text-gray-600">Ready</span>}
          </span>
          <div className="h-5 w-px bg-gray-700" />
          {!connected ? (
            <button onClick={connectToSpeechmatics} className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-semibold px-6 py-2 rounded-xl text-sm transition-all">
              🎙️ Start
            </button>
          ) : (
            <button onClick={disconnect} className="bg-red-600 hover:bg-red-700 active:scale-95 text-white font-semibold px-6 py-2 rounded-xl text-sm transition-all">
              ⏹ Stop
            </button>
          )}
        </div>
      </div>
    </div>
  )
}