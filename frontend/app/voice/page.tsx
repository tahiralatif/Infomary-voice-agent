"use client"

import { useRef, useState } from "react"
import { getJWT } from "../utils/auth.jsx"
import useAudioQueue from "../hooks/useAudioQueue.jsx"
import { speechmaticsTools } from '../../tools/speechmaticsTools'
import Link from "next/link"
import { AnimatePresence, motion } from "motion/react"
import {
  FiMic, FiMicOff, FiMessageSquare, FiHome,
  FiShield, FiHeart, FiUsers, FiMapPin, FiLock, FiPhone
} from "react-icons/fi"
import { RiNurseLine } from "react-icons/ri"
import { HiOutlineHome } from "react-icons/hi"
import { BiBrain } from "react-icons/bi"
import { TbNurse } from "react-icons/tb"

type PromptPair = { prompt: string; response: string; id: string }
type Status = 'idle' | 'listening' | 'speaking'

/* ── Visualizer Component ── */
function Visualizer({ status, isConnected }: { status: Status; isConnected: boolean }) {
  const statusLabel = { idle: 'Ready to start', listening: 'Listening...', speaking: 'Infomary is speaking' }
  const statusColor = { idle: 'text-gray-400', listening: 'text-green-600', speaking: 'text-blue-600' }
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative flex items-center justify-center w-28 h-28">
        <AnimatePresence>
          {isConnected && (
            <>
              <motion.div key="r1"
                className={`absolute inset-0 rounded-full border-2 ${status === 'speaking' ? 'border-blue-300' : 'border-green-300'}`}
                animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.div key="r2"
                className={`absolute inset-0 rounded-full border ${status === 'speaking' ? 'border-blue-200' : 'border-green-200'}`}
                animate={{ scale: [1, 1.55, 1], opacity: [0.3, 0, 0.3] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
              />
            </>
          )}
        </AnimatePresence>
        <motion.div
          className={`relative w-20 h-20 rounded-full flex items-center justify-center shadow-xl transition-all duration-500 ${
            isConnected
              ? status === 'speaking' ? 'bg-gradient-to-br from-blue-500 to-[#1e3a5f] shadow-blue-400/40'
              : 'bg-gradient-to-br from-green-400 to-emerald-600 shadow-green-400/40'
              : 'bg-gradient-to-br from-blue-500 to-[#1e3a5f] shadow-blue-300/30'
          }`}
          animate={isConnected ? { scale: [1, 1.05, 1] } : { scale: 1 }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        >
          <FiMic className="w-8 h-8 text-white" />
        </motion.div>
      </div>
      <div className="flex items-end justify-center gap-[3px] h-8">
        {Array.from({ length: 24 }).map((_, i) => {
          const h = [0.3,0.5,0.8,0.6,1,0.7,0.9,0.4,0.75,0.55,0.85,0.65,1,0.5,0.7,0.9,0.6,0.8,0.45,0.7,0.95,0.55,0.8,0.6][i] ?? 0.5
          return (
            <motion.div key={i}
              className={`rounded-full transition-colors duration-500 ${status === 'idle' ? 'bg-gray-200' : status === 'listening' ? 'bg-green-500' : 'bg-blue-500'}`}
              style={{ width: 3 }}
              animate={status !== 'idle'
                ? { height: [`${h*10}px`, `${h*32}px`, `${h*6}px`, `${h*26}px`, `${h*10}px`] }
                : { height: '3px' }}
              transition={status !== 'idle'
                ? { duration: 0.6 + i * 0.02, repeat: Infinity, delay: i * 0.04, ease: "easeInOut" }
                : { duration: 0.3 }}
            />
          )
        })}
      </div>
      <p className={`text-xs font-semibold tracking-wide ${statusColor[status]}`}>{statusLabel[status]}</p>
    </div>
  )
}

export default function VoiceAgent() {
  const webSocketRef = useRef<WebSocket | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const [promptResponse, setPromptResponse] = useState<PromptPair[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [status, setStatus] = useState<Status>('idle')
  const [sessionId] = useState(() => `voice_${Math.random().toString(36).substring(7)}`)
  const { playChunk } = useAudioQueue()

  const connectToSpeechmatics = async () => {
    try {
      const jwt = await getJWT()
      const ws = new WebSocket(`wss://flow.api.speechmatics.com/v1/flow?jwt=${jwt}`)
      webSocketRef.current = ws
      ws.binaryType = "arraybuffer"
      ws.onopen = () => {
        setIsConnected(true); setStatus('listening')
        navigator.mediaDevices.getUserMedia({ audio: { sampleRate: 16000 } }).then(async (stream) => {
          const ctx = new AudioContext({ sampleRate: 16000 })
          await ctx.audioWorklet.addModule("/pcm-processor.js")
          const src = ctx.createMediaStreamSource(stream)
          const proc = new AudioWorkletNode(ctx, "pcm-processor")
          proc.port.onmessage = (e) => {
            const f32 = new Float32Array(e.data.float32Data)
            if (webSocketRef.current?.readyState === WebSocket.OPEN) webSocketRef.current.send(f32.buffer)
          }
          src.connect(proc); proc.connect(ctx.destination)
        }).catch(console.error)
        ws.send(JSON.stringify({
          message: "StartConversation",
          audio_format: { type: "raw", encoding: "pcm_f32le" },
          conversation_config: {
            template_id: "0976156d-9e20-46b7-be7d-3371ff6ae24f:latest",
            template_variables: { SESSION_ID: sessionId }
          },
          tools: speechmaticsTools
        }))
      }
      ws.onmessage = async (event) => {
        if (event.data instanceof ArrayBuffer) { setStatus('speaking'); playChunk(event.data); return }
        const parsed = JSON.parse(event.data)
        switch (parsed.message) {
          case "AddTranscript": setStatus('listening'); break
          case "ResponseCompleted": setStatus('listening'); break
          case "prompt": {
            const p = parsed.prompt
            const plain = p.response.replace(/<[^>]*>/g, "").trim()
            const hasXML = /<(RESULT|APPLICATION_INPUT)(\s+[^>]*)?>.*?<\/\1>/is.test(p.prompt)
            const updated = { ...p, response: plain, ...(hasXML ? { prompt: "" } : {}) }
            setPromptResponse(prev => {
              const idx = prev.findIndex(o => o.id === p.id)
              if (idx === -1) return [...prev, updated]
              const next = [...prev]; next[idx] = updated; return next
            })
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50)
            break
          }
          case 'ToolInvoke': {
            const { id: toolId, function: fn } = parsed
            const args = typeof fn.arguments === 'string' ? JSON.parse(fn.arguments) : fn.arguments
            if (fn.name === 'save_lead' && !args.session_id) args.session_id = sessionId
            if (fn.name === 'end_conversation' || fn.name === 'EndConversation') {
              ws.close(); setPromptResponse([]); setIsConnected(false); setStatus('idle'); break
            }
            try {
              const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}/speechmatics-tools`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tool_name: fn.name, args })
              })
              if (!res.ok) {
              const errText = await res.text()
              throw new Error(`HTTP ${res.status}: ${errText.slice(0, 100)}`)
            }
              const json = await res.json()
              ws.send(JSON.stringify({ message: 'ToolResult', id: toolId, status: json.error ? 'error' : 'ok', content: json.result || json.error || 'Done' }))
            } catch { ws.send(JSON.stringify({ message: 'ToolResult', id: toolId, status: 'error', content: 'Tool failed' })) }
            break
          }
        }
      }
      ws.onerror = console.error
      ws.onclose = () => { setIsConnected(false); setStatus('idle') }
    } catch (e) { console.error("Connection failed:", e) }
  }

  const stopConversation = () => {
    webSocketRef.current?.close()
    setPromptResponse([])
    setIsConnected(false)
    setStatus('idle')
  }

  const hints = [
    { icon: <HiOutlineHome className="w-4 h-4" />, label: 'In-Home Care',    text: 'Help staying safely at home' },
    { icon: <BiBrain className="w-4 h-4" />,       label: 'Memory Care',     text: "Alzheimer's & dementia support" },
    { icon: <TbNurse className="w-4 h-4" />,       label: 'Skilled Nursing', text: 'Post-hospital rehabilitation' },
    { icon: <FiMapPin className="w-4 h-4" />,      label: 'Find Nearby',     text: 'Facilities near your location' },
  ]

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans">

      {/* ── NAVBAR ── */}
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-xs font-bold">IS</span>
            </div>
            <span className="text-sm font-bold text-[#1e3a5f]">InfoSenior<span className="text-blue-500">.care</span></span>
          </Link>
          <div className="flex items-center gap-1">
            <Link href="/chat" className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-blue-600 px-3 py-2 rounded-lg hover:bg-blue-50 transition-all">
              <FiMessageSquare className="w-3.5 h-3.5" /> Text Chat
            </Link>
            <Link href="/" className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-50 transition-all">
              <FiHome className="w-3.5 h-3.5" /> Home
            </Link>
          </div>
        </div>
      </nav>

      {/* ══════════════════════════════════════
          MOBILE LAYOUT
      ══════════════════════════════════════ */}
      <div className="lg:hidden flex flex-col flex-1">

        {/* IDLE — centered start screen */}
        {!isConnected && (
          <div className="flex flex-col items-center justify-center flex-1 px-5 py-10 gap-8">
            {/* Agent identity */}
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-[#1e3a5f] rounded-2xl flex items-center justify-center shadow-lg mb-1">
                <RiNurseLine className="w-7 h-7 text-white" />
              </div>
              <p className="text-lg font-bold text-[#1e3a5f]">Infomary</p>
              <p className="text-xs text-gray-400">AI Senior Care Navigator</p>
            </div>

            {/* Visualizer */}
            <Visualizer status={status} isConnected={isConnected} />

            {/* Start button */}
            <div className="w-full max-w-xs flex flex-col gap-3">
              <button
                onClick={connectToSpeechmatics}
                className="w-full flex items-center justify-center gap-2.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-semibold py-4 rounded-2xl transition-all shadow-lg shadow-blue-600/25 text-sm"
              >
                <FiMic className="w-4 h-4" /> Start Voice Conversation
              </button>
              <p className="flex items-center justify-center gap-1.5 text-xs text-gray-400">
                <FiLock className="w-3 h-3" /> Free · No sign-up · Mic required
              </p>
            </div>

            {/* Hint chips */}
            <div className="w-full max-w-xs">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 text-center">You can ask about</p>
              <div className="grid grid-cols-2 gap-2">
                {hints.map((h, i) => (
                  <div key={i} className="flex items-center gap-2 bg-[#f8faff] border border-gray-100 rounded-xl px-3 py-2.5">
                    <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 shrink-0">{h.icon}</div>
                    <p className="text-xs font-semibold text-[#1e3a5f] leading-tight">{h.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Trust badges */}
            <div className="grid grid-cols-3 gap-2 w-full max-w-xs">
              {[
                { icon: <FiShield className="w-3.5 h-3.5 text-blue-500" />,   label: 'HIPAA-Ready' },
                { icon: <FiHeart className="w-3.5 h-3.5 text-rose-500" />,    label: 'Free' },
                { icon: <FiUsers className="w-3.5 h-3.5 text-emerald-500" />, label: '500+ Helped' },
              ].map((b, i) => (
                <div key={i} className="bg-[#f8faff] border border-gray-100 rounded-xl p-2.5 flex flex-col items-center gap-1">
                  {b.icon}
                  <p className="text-[10px] font-semibold text-gray-600 text-center">{b.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ACTIVE — full screen transcript + floating bottom bar */}
        {isConnected && (
          <div className="flex flex-col flex-1 overflow-hidden">

            {/* Compact status bar */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-[#1e3a5f] rounded-lg flex items-center justify-center">
                  <RiNurseLine className="w-3.5 h-3.5 text-white" />
                </div>
                <div>
                  <p className="text-xs font-bold text-[#1e3a5f]">Infomary</p>
                  <p className={`text-[10px] font-semibold ${status === 'idle' ? 'text-gray-400' : status === 'listening' ? 'text-green-600' : 'text-blue-600'}`}>
                    {status === 'idle' ? 'Ready to start' : status === 'listening' ? 'Listening...' : 'Infomary is speaking'}
                  </p>
                </div>
              </div>
              {/* Mini waveform */}
              <div className="flex items-end gap-[2px] h-5">
                {Array.from({ length: 10 }).map((_, i) => {
                  const h = [0.4,0.7,1,0.6,0.9,0.5,0.8,0.4,0.7,1][i] ?? 0.5
                  return (
                    <motion.div key={i}
                      className={`rounded-full ${status === 'listening' ? 'bg-green-500' : 'bg-blue-500'}`}
                      style={{ width: 2 }}
                      animate={{ height: [`${h*6}px`, `${h*18}px`, `${h*4}px`, `${h*14}px`, `${h*6}px`] }}
                      transition={{ duration: 0.6 + i * 0.03, repeat: Infinity, delay: i * 0.06, ease: "easeInOut" }}
                    />
                  )
                })}
              </div>
            </div>

            {/* Transcript — scrollable */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 pb-24">
              {promptResponse.map((pair, i) => (
                <div key={i} className="flex flex-col gap-2">
                  {pair.prompt && (
                    <div className="flex justify-end">
                      <div className="max-w-[80%] bg-blue-600 text-white px-4 py-3 rounded-2xl rounded-tr-sm text-sm leading-relaxed shadow-sm">
                        {pair.prompt.slice(4, -5)}
                      </div>
                    </div>
                  )}
                  {pair.response && (
                    <div className="flex justify-start items-end gap-2">
                      <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-[#1e3a5f] rounded-xl flex items-center justify-center shrink-0 shadow-sm">
                        <RiNurseLine className="w-3.5 h-3.5 text-white" />
                      </div>
                      <div className="max-w-[80%] bg-[#f8faff] text-gray-800 px-4 py-3 rounded-2xl rounded-tl-sm border border-gray-100 text-sm leading-relaxed">
                        {pair.response}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Floating bottom bar — always visible */}
            <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-100 px-4 py-3 shadow-lg">
              <button
                onClick={stopConversation}
                className="w-full flex items-center justify-center gap-2.5 bg-white active:scale-[0.98] text-red-500 border border-red-200 font-semibold py-3.5 rounded-2xl transition-all text-sm"
              >
                <FiMicOff className="w-4 h-4" /> End Conversation
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════
          DESKTOP LAYOUT
      ══════════════════════════════════════ */}
      <div className="hidden lg:flex flex-1 flex-row max-w-6xl mx-auto w-full px-8 py-12 gap-12">

        {/* LEFT — sticky agent card */}
        <div className="flex flex-col w-[400px] shrink-0 gap-5 sticky top-20 self-start">

          <div className="w-full bg-[#f8faff] rounded-3xl border border-gray-100 overflow-hidden">
            {/* Header */}
            <div className="px-5 pt-5 pb-4 flex items-center gap-3 border-b border-gray-100">
              <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-[#1e3a5f] rounded-xl flex items-center justify-center shadow-sm shrink-0">
                <RiNurseLine className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-[#1e3a5f]">Infomary</p>
                <p className="text-xs text-gray-400">AI Senior Care Navigator</p>
              </div>
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${isConnected ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
                {isConnected ? 'Live' : 'Ready'}
              </div>
            </div>

            {/* Visualizer */}
            <div className="py-10 px-6 flex justify-center">
              <Visualizer status={status} isConnected={isConnected} />
            </div>

            {/* Button */}
            <div className="px-5 pb-5">
              {!isConnected ? (
                <button onClick={connectToSpeechmatics} className="w-full flex items-center justify-center gap-2.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-semibold py-3.5 rounded-2xl transition-all shadow-lg shadow-blue-600/20 text-sm">
                  <FiMic className="w-4 h-4" /> Start Voice Conversation
                </button>
              ) : (
                <button onClick={stopConversation} className="w-full flex items-center justify-center gap-2.5 bg-white hover:bg-red-50 active:scale-[0.98] text-red-500 border border-red-200 hover:border-red-300 font-semibold py-3.5 rounded-2xl transition-all text-sm">
                  <FiMicOff className="w-4 h-4" /> End Conversation
                </button>
              )}
              {!isConnected && (
                <p className="flex items-center justify-center gap-1.5 text-xs text-gray-400 mt-3">
                  <FiLock className="w-3 h-3" /> Microphone required · Free · No sign-up
                </p>
              )}
            </div>
          </div>

          {/* Trust badges */}
          <div className="grid grid-cols-3 gap-2.5">
            {[
              { icon: <FiShield className="w-4 h-4 text-blue-500" />,   label: 'HIPAA-Ready',     sub: 'Data protected' },
              { icon: <FiHeart className="w-4 h-4 text-rose-500" />,    label: 'Free for Families', sub: 'No hidden fees' },
              { icon: <FiUsers className="w-4 h-4 text-emerald-500" />, label: '500+ Families',   sub: 'Already helped' },
            ].map((b, i) => (
              <div key={i} className="bg-[#f8faff] border border-gray-100 rounded-2xl p-3 flex flex-col items-center gap-1 text-center">
                {b.icon}
                <p className="text-xs font-semibold text-gray-700 leading-tight">{b.label}</p>
                <p className="text-[10px] text-gray-400">{b.sub}</p>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT — content */}
        <div className="flex-1 flex flex-col gap-5 min-h-0">

          {/* Idle */}
          {!isConnected && promptResponse.length === 0 && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex flex-col gap-5">
              <div className="bg-[#f8faff] rounded-3xl border border-gray-100 p-6">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-[#1e3a5f] rounded-2xl flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                    <RiNurseLine className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#1e3a5f] mb-1">Infomary</p>
                    <p className="text-sm text-gray-600 leading-relaxed">{"Hello! I'm Infomary, your personal senior care navigator. I'm here to help your family find the right care — whether that's in-home support, memory care, assisted living, or something else entirely."}</p>
                    <p className="text-sm text-gray-600 leading-relaxed mt-2">{"Just press "}<span className="font-semibold text-blue-600">Start Voice Conversation</span>{" and speak naturally. I'll guide you from there."}</p>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">What you can ask</p>
                <div className="grid grid-cols-2 gap-3">
                  {hints.map((h, i) => (
                    <div key={i} className="group flex items-start gap-3 p-4 rounded-2xl border border-gray-100 bg-white hover:border-blue-200 hover:shadow-sm transition-all cursor-default">
                      <div className="w-8 h-8 bg-blue-50 group-hover:bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 shrink-0 transition-colors">{h.icon}</div>
                      <div>
                        <p className="text-sm font-semibold text-[#1e3a5f]">{h.label}</p>
                        <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{h.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-4 bg-[#1e3a5f] rounded-2xl px-5 py-4">
                <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
                  <FiPhone className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-blue-200 font-medium">Prefer to call?</p>
                  <p className="text-sm font-bold text-white">+1 (800) 555-0199</p>
                </div>
                <p className="text-xs text-blue-300 shrink-0">Mon–Fri 9am–6pm EST</p>
              </div>
            </motion.div>
          )}

          {/* Transcript */}
          {promptResponse.length > 0 && (
            <div className="flex flex-col bg-white rounded-3xl border border-gray-100 overflow-hidden" style={{ maxHeight: 'calc(100vh - 120px)' }}>
              <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between shrink-0">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Conversation</p>
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
                  <span className="text-xs text-gray-400 font-medium">{isConnected ? 'Live' : 'Ended'}</span>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
                {promptResponse.map((pair, i) => (
                  <div key={i} className="flex flex-col gap-2">
                    {pair.prompt && (
                      <div className="flex justify-end">
                        <div className="max-w-[78%] bg-blue-600 text-white px-4 py-3 rounded-2xl rounded-tr-sm text-sm leading-relaxed shadow-sm">{pair.prompt.slice(4, -5)}</div>
                      </div>
                    )}
                    {pair.response && (
                      <div className="flex justify-start items-end gap-2">
                        <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-[#1e3a5f] rounded-xl flex items-center justify-center shrink-0 shadow-sm">
                          <RiNurseLine className="w-3.5 h-3.5 text-white" />
                        </div>
                        <div className="max-w-[78%] bg-[#f8faff] text-gray-800 px-4 py-3 rounded-2xl rounded-tl-sm border border-gray-100 text-sm leading-relaxed">{pair.response}</div>
                      </div>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
