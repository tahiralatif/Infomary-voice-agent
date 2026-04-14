'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { createSpeechmaticsJWT } from '@speechmatics/auth'
import { speechmaticsTools } from '../../tools/speechmaticsTools'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const TEMPLATE_ID = '0976156d-9e20-46b7-be7d-3371ff6ae24f:latest'

function stripToolXML(text: string): string {
  return text
    .replace(/<FUNCTION[\s\S]*?(?:<\/FUNCTION>|\/?>)/gi, '')
    .replace(/<FUNCTION\b[^]*$/gi, '')
    .replace(/<RESULT[\s\S]*?<\/RESULT>/gi, '')
    .replace(/<APPLICATION_INPUT[\s\S]*?<\/APPLICATION_INPUT>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export default function VoiceAgent() {
  const webSocketRef = useRef<WebSocket | null>(null)
  const [connected, setConnected] = useState(false)
  const [sessionId] = useState(() => `voice_${Math.random().toString(36).substring(7)}`)
  const [speaking, setSpeaking] = useState<'user' | 'agent' | null>(null)
  const [transcript, setTranscript] = useState<{ role: string; text: string; promptId?: string }[]>([])
  const [partial, setPartial] = useState<string | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const bufferRef = useRef<number[]>([])
  const startTimeRef = useRef(0)
  const isPlayingRef = useRef(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [transcript, partial])

  const playChunk = (arrayBuffer: ArrayBuffer) => {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext()
    const ctx = audioCtxRef.current
    const view = new DataView(arrayBuffer)
    const float32 = new Float32Array(arrayBuffer.byteLength / 2)
    for (let i = 0; i < float32.length; i++) float32[i] = view.getInt16(i * 2, true) / 0x8000
    bufferRef.current.push(...Array.from(float32))
    if (!isPlayingRef.current && bufferRef.current.length >= 8000) startPlayback(ctx)
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
      if (bufferRef.current.length >= 8000) startPlayback(ctx)
      else { isPlayingRef.current = false; startTimeRef.current = 0; setSpeaking(null) }
    }
  }

  const connectToSpeechmatics = async () => {
    try {
      const apiKey = process.env.NEXT_PUBLIC_SPEECHMATICS_API_KEY!
      const jwt = await createSpeechmaticsJWT({ type: 'flow', apiKey, ttl: 3600 })
      const ws = new WebSocket(`wss://flow.api.speechmatics.com/v1/flow?jwt=${jwt}`)
      webSocketRef.current = ws
      ws.binaryType = 'arraybuffer'

      ws.onopen = async () => {
        setConnected(true)
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { sampleRate: 16000 } })
        const audioContext = new AudioContext({ sampleRate: 16000 })
        await audioContext.audioWorklet.addModule('/pcm-processor.js')
        const source = audioContext.createMediaStreamSource(stream)
        const processor = new AudioWorkletNode(audioContext, 'pcm-processor')
        processor.port.onmessage = (event) => {
          if (ws.readyState === WebSocket.OPEN) ws.send(new Float32Array(event.data.float32Data).buffer)
        }
        source.connect(processor)
        processor.connect(audioContext.destination)
        ws.send(JSON.stringify({
          message: 'StartConversation',
          audio_format: { type: 'raw', encoding: 'pcm_f32le' },
          conversation_config: { template_id: TEMPLATE_ID, template_variables: { SESSION_ID: sessionId } },
          tools: speechmaticsTools
        }))
      }

      ws.onmessage = async (event) => {
        if (event.data instanceof ArrayBuffer) { setSpeaking('agent'); playChunk(event.data); return }
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
                if (last && last.role === 'user' && !last.promptId) return [...prev.slice(0, -1), { role: 'user', text: last.text + ' ' + finalText }]
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
              const idx = prev.findIndex(m => m.promptId === promptId)
              if (idx !== -1) { const u = [...prev]; u[idx] = { ...u[idx], text: agentText }; return u }
              return [...prev, { promptId, role: 'agent', text: agentText }]
            })
            break
          }
          case 'ToolInvoke': {
            const toolId = data.id
            const toolName = data.function.name
            const toolArgs = typeof data.function.arguments === 'string' ? JSON.parse(data.function.arguments) : data.function.arguments
            if (toolName === 'EndConversation') {
              ws.send(JSON.stringify({ message: 'ToolResult', id: toolId, status: 'ok', content: 'Goodbye!' }))
              setTimeout(() => { ws.close(); setConnected(false); setTranscript([]) }, 4000)
              break
            }
            try {
              const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/speechmatics-tools`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tool_name: toolName, args: toolArgs })
              })
              const json = await res.json()
              ws.send(JSON.stringify({ message: 'ToolResult', id: toolId, status: json.error ? 'error' : 'ok', content: json.result || json.error || 'Done' }))
            } catch (e) {
              ws.send(JSON.stringify({ message: 'ToolResult', id: toolId, status: 'error', content: 'Tool failed' }))
            }
            break
          }
          default: if (data.message) console.log('[SM]', data.message, data.reason || '')
        }
      }
      ws.onerror = (e) => console.error('WebSocket error:', e)
      ws.onclose = () => { setConnected(false); setSpeaking(null); setPartial(null) }
    } catch (e) { console.error('Connection failed:', e) }
  }

  const disconnect = () => {
    webSocketRef.current?.close()
    setConnected(false); setTranscript([]); setSpeaking(null); setPartial(null)
  }

  return (
    <div className="flex h-screen bg-[#0a0f1e] text-white overflow-hidden">

      {/* Sidebar */}
      <div className="w-60 bg-[#0d1526] border-r border-white/5 flex flex-col shrink-0">
        <div className="p-5 border-b border-white/5">
          <Link href="/" className="flex items-center gap-2 mb-5">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-xs font-bold">IS</span>
            </div>
            <span className="text-sm font-bold text-white">InfoSenior<span className="text-blue-400">.care</span></span>
          </Link>
          <div className="space-y-1">
            <Link href="/voice" className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-blue-600/15 border border-blue-500/20 text-blue-400 text-sm font-medium">
              <span className="text-base">🎙️</span> Voice Agent
            </Link>
            <Link href="/chat" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-400 hover:bg-white/5 text-sm transition-colors">
              <span className="text-base">💬</span> Text Agent
            </Link>
            <Link href="/" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-400 hover:bg-white/5 text-sm transition-colors">
              <span className="text-base">🏠</span> Home
            </Link>
          </div>
        </div>

        {/* Status card */}
        <div className="p-4 mt-auto">
          <div className={`rounded-xl p-4 border transition-all ${connected ? 'bg-green-500/5 border-green-500/20' : 'bg-white/3 border-white/5'}`}>
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-gray-600'}`} />
              <span className="text-xs font-semibold text-gray-300">{connected ? 'Connected' : 'Offline'}</span>
            </div>
            <p className="text-xs text-gray-500">
              {connected
                ? speaking === 'agent' ? 'Infomary is speaking...'
                  : speaking === 'user' ? 'Listening to you...'
                  : 'Ready — speak anytime'
                : 'Press Start to connect'}
            </p>
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between shrink-0 bg-[#0d1526]/50 backdrop-blur-sm">
          <div>
            <h1 className="text-base font-bold text-white">Voice Conversation</h1>
            <p className="text-xs text-gray-500 mt-0.5">Infomary — AI Senior Care Navigator</p>
          </div>
          <div className="flex items-center gap-3">
            {connected && (
              <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 px-3 py-1.5 rounded-full">
                <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                <span className="text-xs text-green-400 font-medium">Live</span>
              </div>
            )}
            {speaking === 'agent' && (
              <div className="flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/20 px-3 py-1.5 rounded-full">
                <div className="flex gap-0.5">
                  {[8, 14, 10, 16].map((h, i) => (
                    <div key={i} className="w-0.5 bg-blue-400 rounded-full animate-pulse"
                      style={{ height: `${h}px`, animationDelay: `${i * 100}ms` }} />
                  ))}
                </div>
                <span className="text-xs text-blue-400 font-medium">Speaking</span>
              </div>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="max-w-2xl mx-auto space-y-4">

            {transcript.length === 0 && !connected && (
              <div className="flex flex-col items-center justify-center h-72 text-center">
                <div className="w-20 h-20 rounded-full bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-4xl mb-5">🎙️</div>
                <h3 className="text-lg font-semibold text-white mb-2">Start a Voice Conversation</h3>
                <p className="text-gray-500 text-sm max-w-xs">Infomary will guide you through finding the right senior care — just speak naturally.</p>
              </div>
            )}

            {transcript.map((t, i) => (
              <div key={i} className={`flex items-end gap-3 ${t.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {t.role === 'agent' && (
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm shrink-0 shadow-lg shadow-blue-900/50">🩺</div>
                )}
                <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-lg ${
                  t.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-none shadow-blue-900/30'
                    : 'bg-[#1a2540] text-gray-100 rounded-bl-none border border-white/5'
                }`}>
                  {t.role === 'agent' ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                      p: ({ ...props }) => <p className="mb-1 last:mb-0" {...props} />,
                      strong: ({ ...props }) => <strong className="font-semibold text-blue-300" {...props} />,
                      ul: ({ ...props }) => <ul className="list-disc pl-4 mb-1" {...props} />,
                      li: ({ ...props }) => <li className="mb-0.5" {...props} />,
                    }}>{t.text}</ReactMarkdown>
                  ) : t.text}
                </div>
                {t.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-[#1a2540] border border-white/10 flex items-center justify-center text-sm shrink-0">👤</div>
                )}
              </div>
            ))}

            {partial && (
              <div className="flex items-end gap-3 justify-end">
                <div className="max-w-[75%] rounded-2xl rounded-br-none px-4 py-3 text-sm bg-blue-600/20 text-white/50 italic border border-blue-500/15">
                  {partial}
                </div>
                <div className="w-8 h-8 rounded-full bg-[#1a2540] border border-white/10 flex items-center justify-center text-sm shrink-0">👤</div>
              </div>
            )}

            {speaking === 'agent' && transcript[transcript.length - 1]?.role !== 'agent' && (
              <div className="flex items-end gap-3 justify-start">
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm shrink-0 animate-pulse">🩺</div>
                <div className="bg-[#1a2540] px-5 py-3.5 rounded-2xl rounded-bl-none border border-white/5">
                  <div className="flex gap-1.5 items-center">
                    {[0, 150, 300].map(d => (
                      <div key={d} className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-5 border-t border-white/5 bg-[#0d1526]/50 backdrop-blur-sm">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <div className="text-xs text-gray-500">
              {connected ? (
                <span className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                  Session active — speak naturally
                </span>
              ) : 'Your conversation is private and secure'}
            </div>
            {!connected ? (
              <button onClick={connectToSpeechmatics}
                className="flex items-center gap-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-7 py-3 rounded-xl transition-all shadow-lg shadow-blue-900/50 hover:-translate-y-0.5 active:scale-95 text-sm">
                <span className="text-base">🎙️</span> Start Conversation
              </button>
            ) : (
              <button onClick={disconnect}
                className="flex items-center gap-2.5 bg-red-600/80 hover:bg-red-600 text-white font-semibold px-7 py-3 rounded-xl transition-all text-sm active:scale-95">
                <span className="text-base">⏹</span> End Conversation
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
