"use client"

import { useRef, useState, useCallback } from "react"
import { PipecatClient, RTVIEvent } from "@pipecat-ai/client-js"
import { PipecatClientAudio, PipecatClientProvider, useRTVIClientEvent } from "@pipecat-ai/client-react"
import { SmallWebRTCTransport } from "@pipecat-ai/small-webrtc-transport"
import { AnimatePresence, motion } from "motion/react"
import Link from "next/link"
import {
  FiMic, FiMicOff, FiMessageSquare, FiHome,
  FiShield, FiHeart, FiUsers, FiMapPin, FiLock, FiPhone
} from "react-icons/fi"
import { RiNurseLine } from "react-icons/ri"
import { HiOutlineHome } from "react-icons/hi"
import { BiBrain } from "react-icons/bi"
import { TbNurse } from "react-icons/tb"

const BACKEND = process.env.NEXT_PUBLIC_VOICE_URL || "http://localhost:7860"

type Status = "idle" | "listening" | "speaking"

function Visualizer({ status, isConnected }: { status: Status; isConnected: boolean }) {
  const label = { idle: "Ready to start", listening: "Listening...", speaking: "Infomary is speaking" }
  const color = { idle: "text-gray-400", listening: "text-green-600", speaking: "text-blue-600" }
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative flex items-center justify-center w-28 h-28">
        <AnimatePresence>
          {isConnected && (
            <>
              <motion.div key="r1"
                className={`absolute inset-0 rounded-full border-2 ${status === "speaking" ? "border-blue-300" : "border-green-300"}`}
                animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.div key="r2"
                className={`absolute inset-0 rounded-full border ${status === "speaking" ? "border-blue-200" : "border-green-200"}`}
                animate={{ scale: [1, 1.55, 1], opacity: [0.3, 0, 0.3] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
              />
            </>
          )}
        </AnimatePresence>
        <motion.div
          className={`relative w-20 h-20 rounded-full flex items-center justify-center shadow-xl transition-all duration-500 ${
            isConnected
              ? status === "speaking" ? "bg-gradient-to-br from-blue-500 to-[#1e3a5f] shadow-blue-400/40"
              : "bg-gradient-to-br from-green-400 to-emerald-600 shadow-green-400/40"
              : "bg-gradient-to-br from-blue-500 to-[#1e3a5f] shadow-blue-300/30"
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
              className={`rounded-full transition-colors duration-500 ${status === "idle" ? "bg-gray-200" : status === "listening" ? "bg-green-500" : "bg-blue-500"}`}
              style={{ width: 3 }}
              animate={status !== "idle"
                ? { height: [`${h*10}px`, `${h*32}px`, `${h*6}px`, `${h*26}px`, `${h*10}px`] }
                : { height: "3px" }}
              transition={status !== "idle"
                ? { duration: 0.6 + i * 0.02, repeat: Infinity, delay: i * 0.04, ease: "easeInOut" }
                : { duration: 0.3 }}
            />
          )
        })}
      </div>
      <p className={`text-xs font-semibold tracking-wide ${color[status]}`}>{label[status]}</p>
    </div>
  )
}

function VoiceAgentInner({ clientRef }: { clientRef: React.RefObject<PipecatClient | null> }) {
  const [isConnected, setIsConnected] = useState(false)
  const [status, setStatus] = useState<Status>("idle")

  useRTVIClientEvent(RTVIEvent.Connected, useCallback(() => { setIsConnected(true); setStatus("listening") }, []))
  useRTVIClientEvent(RTVIEvent.Disconnected, useCallback(() => { setIsConnected(false); setStatus("idle") }, []))
  useRTVIClientEvent(RTVIEvent.BotStartedSpeaking, useCallback(() => setStatus("speaking"), []))
  useRTVIClientEvent(RTVIEvent.BotStoppedSpeaking, useCallback(() => setStatus("listening"), []))

  const connect = async () => {
    try {
      if (!clientRef.current) return
      await clientRef.current.connect()
    } catch (e) { console.error("Connection failed:", e) }
  }

  const disconnect = async () => {
    try {
      if (!clientRef.current) return
      await clientRef.current.disconnect()
    } catch (e) { console.error("Disconnect error:", e) }
    setIsConnected(false)
    setStatus("idle")
  }

  const hints = [
    { icon: <HiOutlineHome className="w-4 h-4" />, label: "In-Home Care", text: "Help staying safely at home" },
    { icon: <BiBrain className="w-4 h-4" />, label: "Memory Care", text: "Alzheimer's & dementia support" },
    { icon: <TbNurse className="w-4 h-4" />, label: "Skilled Nursing", text: "Post-hospital rehabilitation" },
    { icon: <FiMapPin className="w-4 h-4" />, label: "Find Nearby", text: "Facilities near your location" },
  ]

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans">
      {/* PipecatClientAudio handles bot audio output automatically */}
      <PipecatClientAudio />

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

      {/* MOBILE */}
      <div className="lg:hidden flex flex-col flex-1">
        {!isConnected ? (
          <div className="flex flex-col items-center justify-center flex-1 px-5 py-10 gap-8">
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-[#1e3a5f] rounded-2xl flex items-center justify-center shadow-lg mb-1">
                <RiNurseLine className="w-7 h-7 text-white" />
              </div>
              <p className="text-lg font-bold text-[#1e3a5f]">Infomary</p>
              <p className="text-xs text-gray-400">AI Senior Care Navigator</p>
            </div>
            <Visualizer status={status} isConnected={isConnected} />
            <div className="w-full max-w-xs flex flex-col gap-3">
              <button onClick={connect} className="w-full flex items-center justify-center gap-2.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-semibold py-4 rounded-2xl transition-all shadow-lg shadow-blue-600/25 text-sm">
                <FiMic className="w-4 h-4" /> Start Voice Conversation
              </button>
              <p className="flex items-center justify-center gap-1.5 text-xs text-gray-400">
                <FiLock className="w-3 h-3" /> Free · No sign-up · Mic required
              </p>
            </div>
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
          </div>
        ) : (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-[#1e3a5f] rounded-lg flex items-center justify-center">
                  <RiNurseLine className="w-3.5 h-3.5 text-white" />
                </div>
                <div>
                  <p className="text-xs font-bold text-[#1e3a5f]">Infomary</p>
                  <p className={`text-[10px] font-semibold ${status === "listening" ? "text-green-600" : status === "speaking" ? "text-blue-600" : "text-gray-400"}`}>
                    {status === "listening" ? "Listening..." : status === "speaking" ? "Speaking..." : "Ready"}
                  </p>
                </div>
              </div>
              <Visualizer status={status} isConnected={isConnected} />
            </div>
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm px-6 text-center">
              Speak naturally — Infomary is listening and will respond with voice.
            </div>
            <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-100 px-4 py-3 shadow-lg">
              <button onClick={disconnect} className="w-full flex items-center justify-center gap-2.5 bg-white active:scale-[0.98] text-red-500 border border-red-200 font-semibold py-3.5 rounded-2xl transition-all text-sm">
                <FiMicOff className="w-4 h-4" /> End Conversation
              </button>
            </div>
          </div>
        )}
      </div>

      {/* DESKTOP */}
      <div className="hidden lg:flex flex-1 flex-row max-w-6xl mx-auto w-full px-8 py-12 gap-12">
        <div className="flex flex-col w-[400px] shrink-0 gap-5 sticky top-20 self-start">
          <div className="w-full bg-[#f8faff] rounded-3xl border border-gray-100 overflow-hidden">
            <div className="px-5 pt-5 pb-4 flex items-center gap-3 border-b border-gray-100">
              <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-[#1e3a5f] rounded-xl flex items-center justify-center shadow-sm shrink-0">
                <RiNurseLine className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-[#1e3a5f]">Infomary</p>
                <p className="text-xs text-gray-400">AI Senior Care Navigator</p>
              </div>
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${isConnected ? "bg-green-50 border-green-200 text-green-700" : "bg-gray-50 border-gray-200 text-gray-400"}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-green-500 animate-pulse" : "bg-gray-300"}`} />
                {isConnected ? "Live" : "Ready"}
              </div>
            </div>
            <div className="py-10 px-6 flex justify-center">
              <Visualizer status={status} isConnected={isConnected} />
            </div>
            <div className="px-5 pb-5">
              {!isConnected ? (
                <button onClick={connect} className="w-full flex items-center justify-center gap-2.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-semibold py-3.5 rounded-2xl transition-all shadow-lg shadow-blue-600/20 text-sm">
                  <FiMic className="w-4 h-4" /> Start Voice Conversation
                </button>
              ) : (
                <button onClick={disconnect} className="w-full flex items-center justify-center gap-2.5 bg-white hover:bg-red-50 active:scale-[0.98] text-red-500 border border-red-200 hover:border-red-300 font-semibold py-3.5 rounded-2xl transition-all text-sm">
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
          <div className="grid grid-cols-3 gap-2.5">
            {[
              { icon: <FiShield className="w-4 h-4 text-blue-500" />, label: "HIPAA-Ready", sub: "Data protected" },
              { icon: <FiHeart className="w-4 h-4 text-rose-500" />, label: "Free for Families", sub: "No hidden fees" },
              { icon: <FiUsers className="w-4 h-4 text-emerald-500" />, label: "500+ Families", sub: "Already helped" },
            ].map((b, i) => (
              <div key={i} className="bg-[#f8faff] border border-gray-100 rounded-2xl p-3 flex flex-col items-center gap-1 text-center">
                {b.icon}
                <p className="text-xs font-semibold text-gray-700 leading-tight">{b.label}</p>
                <p className="text-[10px] text-gray-400">{b.sub}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 flex flex-col gap-5">
          {!isConnected && (
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
          {isConnected && (
            <div className="flex flex-col bg-white rounded-3xl border border-gray-100 overflow-hidden" style={{ maxHeight: "calc(100vh - 120px)" }}>
              <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between shrink-0">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Live Conversation</p>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-xs text-gray-400 font-medium">
                    {status === "speaking" ? "Infomary is speaking..." : "Listening..."}
                  </span>
                </div>
              </div>
              <div className="flex-1 flex items-center justify-center text-gray-400 text-sm px-8 text-center leading-relaxed">
                Speak naturally — Infomary is listening and will respond with voice.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function VoiceAgentClient() {
  const clientRef = useRef<PipecatClient | null>(null)

  if (!clientRef.current) {
    clientRef.current = new PipecatClient({
      transport: new SmallWebRTCTransport({
        webrtcRequestParams: { endpoint: `${BACKEND}/api/offer` },
      }),
      enableMic: true,
      enableCam: false,
    })
  }

  return (
    <PipecatClientProvider client={clientRef.current}>
      <VoiceAgentInner clientRef={clientRef} />
    </PipecatClientProvider>
  )
}
