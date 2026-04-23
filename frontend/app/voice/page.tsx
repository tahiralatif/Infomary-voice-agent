"use client"

import { useCallback, useRef, useState } from "react"
import { Conversation } from "@elevenlabs/client"
import { motion } from "motion/react"
import {
  FiMic, FiMicOff, FiMessageSquare, FiHome,
  FiShield, FiHeart, FiUsers, FiMapPin, FiLock, FiPhone
} from "react-icons/fi"
import { RiNurseLine } from "react-icons/ri"
import { HiOutlineHome } from "react-icons/hi"
import { BiBrain } from "react-icons/bi"
import { TbNurse } from "react-icons/tb"
import Link from "next/link"

type ConnectionStatus = "disconnected" | "connecting" | "connected"
type AgentMode = "listening" | "speaking"

export default function VoiceAgent() {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected")
  const [mode, setMode] = useState<AgentMode>("listening")
  const [sessionId] = useState(() => `voice_${Math.random().toString(36).substring(7)}`)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conversationRef = useRef<any>(null)

  const callTool = useCallback(async (toolName: string, args: unknown) => {
    const res = await fetch("/api/tools", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool_name: toolName, args }),
    })
    const data = await res.json()
    return String(data.result ?? data.error ?? "done")
  }, [])

  const handleConnect = useCallback(async () => {
    setStatus("connecting")
    try {
      const conversation = await Conversation.startSession({
        agentId: process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID!,
        connectionType: "websocket",
        onConnect: () => setStatus("connected"),
        onDisconnect: () => {
          setStatus("disconnected")
          setMode("listening")
          conversationRef.current = null
        },
        onModeChange: ({ mode: m }) => setMode(m as AgentMode),
        onError: (err) => console.error("ElevenLabs error:", err),
        clientTools: {
          end_call: async () => {
            conversationRef.current?.endSession()
            return "Call ended"
          },
          save_lead: (params: unknown) => callTool("save_lead", params),
          google_search: (params: unknown) => callTool("google_search", params),
        },
      })

      conversationRef.current = conversation
    } catch (err) {
      console.error("Connection failed:", err)
      setStatus("disconnected")
    }
  }, [sessionId, callTool])

  const handleDisconnect = useCallback(async () => {
    await conversationRef.current?.endSession()
  }, [])

  const isConnected = status === "connected"
  const isConnecting = status === "connecting"

  const hints = [
    { icon: <HiOutlineHome className="w-4 h-4" />, label: "In-Home Care",    text: "Help staying safely at home" },
    { icon: <BiBrain className="w-4 h-4" />,       label: "Memory Care",     text: "Alzheimer's & dementia support" },
    { icon: <TbNurse className="w-4 h-4" />,       label: "Skilled Nursing", text: "Post-hospital rehabilitation" },
    { icon: <FiMapPin className="w-4 h-4" />,      label: "Find Nearby",     text: "Facilities near your location" },
  ]

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans">

      <nav className="bg-white border-b border-gray-100 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-xs font-bold">IS</span>
            </div>
            <span className="text-sm font-bold text-[#1e3a5f]">
              InfoSenior<span className="text-blue-500">.care</span>
            </span>
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

      {/* DESKTOP LAYOUT */}
      <div className="hidden lg:flex flex-1 flex-row max-w-6xl mx-auto w-full px-8 py-12 gap-12">

        {/* LEFT — agent card */}
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
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                isConnected
                  ? "bg-green-50 border-green-200 text-green-700"
                  : "bg-gray-50 border-gray-200 text-gray-400"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-green-500 animate-pulse" : "bg-gray-300"}`} />
                {isConnected ? "Live" : "Ready"}
              </div>
            </div>

            <div className="py-10 px-6 flex justify-center">
              <div className="flex flex-col items-center gap-4">
                <div className="relative flex items-center justify-center w-28 h-28">
                  <motion.div
                    className={`relative w-20 h-20 rounded-full flex items-center justify-center shadow-xl transition-all duration-500 ${
                      isConnected && mode === "speaking"
                        ? "bg-gradient-to-br from-blue-500 to-[#1e3a5f] shadow-blue-400/40"
                        : isConnected
                        ? "bg-gradient-to-br from-green-400 to-emerald-600 shadow-green-400/40"
                        : "bg-gradient-to-br from-blue-500 to-[#1e3a5f] shadow-blue-400/20"
                    }`}
                    animate={isConnected ? { scale: [1, 1.05, 1] } : { scale: 1 }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <FiMic className="w-8 h-8 text-white" />
                  </motion.div>
                </div>

                {/* Animated bars */}
                <div className="flex items-end gap-[3px] h-8">
                  {Array.from({ length: 24 }).map((_, i) => (
                    <motion.div
                      key={i}
                      className={`rounded-full ${
                        isConnected && mode === "speaking" ? "bg-blue-500" :
                        isConnected ? "bg-emerald-500" : "bg-gray-200"
                      }`}
                      style={{ width: 3 }}
                      animate={isConnected ? {
                        height: [3, Math.random() * 24 + 4, 3],
                      } : { height: 3 }}
                      transition={{
                        duration: 0.6 + Math.random() * 0.4,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: i * 0.05,
                      }}
                    />
                  ))}
                </div>

                <p className={`text-xs font-semibold tracking-wide ${
                  !isConnected ? "text-gray-400"
                  : mode === "listening" ? "text-green-600"
                  : "text-blue-600"
                }`}>
                  {isConnecting ? "Connecting..."
                   : !isConnected ? "Ready to start"
                   : mode === "listening" ? "Listening..."
                   : "Infomary is speaking"}
                </p>
              </div>
            </div>

            <div className="px-5 pb-5">
              {!isConnected ? (
                <button
                  onClick={handleConnect}
                  disabled={isConnecting}
                  className="w-full flex items-center justify-center gap-2.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-2xl transition-all shadow-lg shadow-blue-600/20 text-sm"
                >
                  <FiMic className="w-4 h-4" />
                  {isConnecting ? "Connecting..." : "Start Voice Conversation"}
                </button>
              ) : (
                <button
                  onClick={handleDisconnect}
                  className="w-full flex items-center justify-center gap-2.5 bg-white hover:bg-red-50 active:scale-[0.98] text-red-500 border border-red-200 hover:border-red-300 font-semibold py-3.5 rounded-2xl transition-all text-sm"
                >
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
              { icon: <FiShield className="w-4 h-4 text-blue-500" />,   label: "HIPAA-Ready",       sub: "Data protected" },
              { icon: <FiHeart className="w-4 h-4 text-rose-500" />,    label: "Free for Families", sub: "No hidden fees" },
              { icon: <FiUsers className="w-4 h-4 text-emerald-500" />, label: "500+ Families",     sub: "Already helped" },
            ].map((b, i) => (
              <div key={i} className="bg-[#f8faff] border border-gray-100 rounded-2xl p-3 flex flex-col items-center gap-1 text-center">
                {b.icon}
                <p className="text-xs font-semibold text-gray-700 leading-tight">{b.label}</p>
                <p className="text-[10px] text-gray-400">{b.sub}</p>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT — hints / content */}
        <div className="flex-1 flex flex-col gap-5">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <div className="bg-[#f8faff] rounded-3xl border border-gray-100 p-6 mb-5">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-[#1e3a5f] rounded-2xl flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                  <RiNurseLine className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#1e3a5f] mb-1">Infomary</p>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {"Hello! I'm Infomary, your personal senior care navigator. Press "}
                    <span className="font-semibold text-blue-600">Start Voice Conversation</span>
                    {" and speak naturally. I'll guide you from there."}
                  </p>
                </div>
              </div>
            </div>

            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">What you can ask</p>
            <div className="grid grid-cols-2 gap-3 mb-5">
              {hints.map((h, i) => (
                <div key={i} className="flex items-start gap-3 p-4 rounded-2xl border border-gray-100 bg-white hover:border-blue-200 hover:shadow-sm transition-all">
                  <div className="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 shrink-0">{h.icon}</div>
                  <div>
                    <p className="text-sm font-semibold text-[#1e3a5f]">{h.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{h.text}</p>
                  </div>
                </div>
              ))}
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
        </div>
      </div>

      {/* MOBILE LAYOUT */}
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
            <button
              onClick={handleConnect}
              disabled={isConnecting}
              className="w-full max-w-xs flex items-center justify-center gap-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-4 rounded-2xl transition-all shadow-lg shadow-blue-600/25 text-sm"
            >
              <FiMic className="w-4 h-4" />
              {isConnecting ? "Connecting..." : "Start Voice Conversation"}
            </button>
          </div>
        ) : (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="flex items-center justify-center flex-1 py-8">
              <div className="flex flex-col items-center gap-4">
                <motion.div
                  className={`w-20 h-20 rounded-full flex items-center justify-center shadow-xl ${
                    mode === "speaking"
                      ? "bg-gradient-to-br from-blue-500 to-[#1e3a5f]"
                      : "bg-gradient-to-br from-green-400 to-emerald-600"
                  }`}
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                >
                  <FiMic className="w-8 h-8 text-white" />
                </motion.div>
                <p className={`text-xs font-semibold ${mode === "listening" ? "text-green-600" : "text-blue-600"}`}>
                  {mode === "listening" ? "Listening..." : "Infomary is speaking"}
                </p>
              </div>
            </div>
            <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-100 px-4 py-3 shadow-lg">
              <button
                onClick={handleDisconnect}
                className="w-full flex items-center justify-center gap-2.5 bg-white text-red-500 border border-red-200 font-semibold py-3.5 rounded-2xl transition-all text-sm"
              >
                <FiMicOff className="w-4 h-4" /> End Conversation
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
