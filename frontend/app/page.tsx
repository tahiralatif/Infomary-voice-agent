'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Vapi from '@vapi-ai/web'

const vapi = new Vapi(process.env.NEXT_PUBLIC_VAPI_KEY!)

interface Session {
  id: string
  date: string
}

interface VapiMessage {
  type: string
  transcript?: string
  transcriptType?: string
  role?: string
  status?: string
}

export default function Home() {
  const [calling, setCalling] = useState(false)
  const [speaking, setSpeaking] = useState<'user' | 'assistant' | null>(null)
  const [sessionId, setSessionId] = useState<string>('')
  const [sessions, setSessions] = useState<Session[]>([])
  const [isHydrated, setIsHydrated] = useState(false)
  const [status, setStatus] = useState('Press the button to start')
  const handlerRef = useRef<((msg: VapiMessage) => void) | null>(null)

  const presetHeights = [22, 34, 15, 41, 28, 12, 39, 21, 45, 18, 25, 32, 11, 40, 19, 36, 14, 29, 43, 20]

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setIsHydrated(true)
    const stored = localStorage.getItem('voice_session_id') || crypto.randomUUID()
    localStorage.setItem('voice_session_id', stored)
    setSessionId(stored)
    const storedSessions = JSON.parse(localStorage.getItem('sessions') || '[]')
    setSessions(storedSessions)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])

  const saveMessage = async (role: string, content: string, sid: string) => {
    if (!sid) return
    await fetch('/api/save-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sid, role, content })
    })
  }

  useEffect(() => {
    if (!sessionId || !isHydrated) return
    if (handlerRef.current) vapi.off('message', handlerRef.current)

    const handleMessage = (msg: VapiMessage) => {
      if (msg.type === 'transcript' && msg.transcriptType === 'final' && msg.transcript) {
        saveMessage(msg.role || 'user', msg.transcript, sessionId)
        setSpeaking(msg.role === 'user' ? 'user' : 'assistant')
        setTimeout(() => setSpeaking(null), 1500)
      }
      if (msg.type === 'speech-update') {
        if (msg.status === 'started') setSpeaking(msg.role === 'user' ? 'user' : 'assistant')
        if (msg.status === 'stopped') setSpeaking(null)
      }
    }

    handlerRef.current = handleMessage
    vapi.on('message', handleMessage)
    vapi.on('call-start', () => { setCalling(true); setStatus('Connected — speak now') })
    vapi.on('call-end', () => { setCalling(false); setSpeaking(null); setStatus('Call ended') })

    return () => { if (handlerRef.current) vapi.off('message', handlerRef.current) }
  }, [sessionId, isHydrated])

  const startCall = () => {
    if (!sessionId || !isHydrated) return
    setStatus('Connecting...')
    vapi.start('d8c9d013-9205-4c60-aa27-491c77725691')
  }
  const stopCall = () => { vapi.stop(); setStatus('Press the button to start') }

  const createNewSession = () => {
    const newId = crypto.randomUUID()
    const newSession = { id: newId, date: new Date().toLocaleDateString() }
    const updatedSessions = [newSession, ...sessions]
    setSessions(updatedSessions)
    localStorage.setItem('sessions', JSON.stringify(updatedSessions))
    localStorage.setItem('voice_session_id', newId)
    setSessionId(newId)
  }

  const switchSession = (sid: string) => {
    setSessionId(sid)
    localStorage.setItem('voice_session_id', sid)
  }

  return (
    <div className="flex h-screen bg-gray-950 text-white">
      
      {/* Sidebar */}
      <div className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-800">
          <h2 className="text-base font-bold text-blue-400 mb-3">InfoMary</h2>
          <button
            onClick={createNewSession}
            className="w-full bg-blue-600 text-white rounded-lg py-2 text-xs hover:bg-blue-700"
          >
            + New Session
          </button>
          <div className="p-4 border-t border-gray-800">
          <p className="text-xs text-gray-600 mb-2">Switch Mode</p>
          <Link href="/" className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-900 text-blue-300 text-xs font-semibold mb-1">
            🎙️ Voice Agent
          </Link>
          <Link href="/chat" className="flex items-center gap-2 px-3 py-2 rounded-lg text-gray-500 hover:bg-gray-800 text-xs mb-1">
            💬 Text Agent
          </Link>
        </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {sessions.length === 0 ? (
            <p className="text-xs text-gray-600 text-center mt-4">No sessions yet</p>
          ) : (
            sessions.map((s, i) => (
              <button
                key={s.id}
                onClick={() => switchSession(s.id)}
                className={`w-full text-left px-3 py-2 rounded-lg mb-1 text-xs ${
                  s.id === sessionId ? 'bg-blue-900 text-blue-300' : 'text-gray-500 hover:bg-gray-800'
                }`}
              >
                <p className="font-medium">Session {sessions.length - i}</p>
                <p className="text-gray-600">{s.date}</p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col items-center justify-center relative">

        {/* Header */}
        <div className="absolute top-0 left-0 right-0 p-5 border-b border-gray-800 bg-gray-950">
          <h1 className="text-lg font-bold text-blue-400">InfoSenior.care</h1>
          <p className="text-xs text-gray-500">AI-Powered Senior Care Assistant</p>
        </div>

        {/* Central Voice UI */}
        <div className="flex flex-col items-center gap-10">

          {/* Avatar + Waveform */}
          <div className="relative flex items-center justify-center">

            {/* Outer pulse ring */}
            {calling && (
              <div className={`absolute w-48 h-48 rounded-full border-2 animate-ping ${
                speaking === 'assistant' ? 'border-blue-400' : 'border-gray-700'
              }`} />
            )}

            {/* Middle ring */}
            {calling && (
              <div className={`absolute w-36 h-36 rounded-full border ${
                speaking === 'assistant' ? 'border-blue-500 animate-pulse' : 'border-gray-700'
              }`} />
            )}

            {/* Avatar Circle */}
            <div className={`w-28 h-28 rounded-full flex items-center justify-center text-5xl transition-all duration-300 ${
              calling
                ? speaking === 'assistant'
                  ? 'bg-blue-600 shadow-lg shadow-blue-500/50 scale-110'
                  : speaking === 'user'
                  ? 'bg-purple-700 shadow-lg shadow-purple-500/50'
                  : 'bg-gray-700'
                : 'bg-gray-800'
            }`}>
              🩺
            </div>
          </div>

          {/* Waveform bars — only when speaking */}
          <div className="flex items-end gap-1 h-12">
            {Array.from({ length: 20 }).map((_, i) => (
              <div
                key={i}
                className={`w-1.5 rounded-full transition-all duration-150 ${
                  speaking === 'assistant' ? 'bg-blue-400' :
                  speaking === 'user' ? 'bg-purple-400' : 'bg-gray-700'
                }`}
                style={{
                  height: calling && speaking
                    ? `${presetHeights[i]}px`
                    : '4px',
                  animationDelay: `${i * 50}ms`
                }}
              />
            ))}
          </div>

          {/* Who is speaking */}
          <div className="text-center">
            {speaking === 'assistant' && (
              <p className="text-blue-400 text-sm font-medium animate-pulse">Infomary is speaking...</p>
            )}
            {speaking === 'user' && (
              <p className="text-purple-400 text-sm font-medium animate-pulse">You are speaking...</p>
            )}
            {!speaking && calling && (
              <p className="text-gray-500 text-sm">Listening...</p>
            )}
          </div>

          {/* Status */}
          <p className="text-xs text-gray-600">{status}</p>

          {/* Call Button */}
          {!calling ? (
            <button
              onClick={startCall}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-10 py-4 rounded-full text-base shadow-lg shadow-blue-500/30 transition-all"
            >
              🎙️ Start Conversation
            </button>
          ) : (
            <button
              onClick={stopCall}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold px-10 py-4 rounded-full text-base shadow-lg shadow-red-500/30 animate-pulse"
            >
              ⏹ End Conversation
            </button>
          )}
        </div>
      </div>
    </div>
  )
}