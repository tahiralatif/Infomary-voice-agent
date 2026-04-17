'use client'
import { useState, useRef, useEffect, useCallback, Suspense, ReactNode, HTMLAttributes } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { dracula } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { FiMenu, FiX, FiMic, FiMessageSquare, FiHome, FiTrash2 } from 'react-icons/fi'
import { RiNurseLine } from 'react-icons/ri'

interface Message { role: 'user' | 'assistant'; content: string }
interface Session { session_id: string; title: string; description: string; created_at: string }
interface Toast { id: string; message: string; type: 'success' | 'error' | 'info' }

function generateSessionId(): string { return crypto.randomUUID() }

function ChatPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [sessionId, setSessionId] = useState<string>('')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [sessions, setSessions] = useState<Session[]>([])
  const [titleGenerated, setTitleGenerated] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [wsConnected, setWsConnected] = useState(false)
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'reconnecting'>('connecting')
  const [pendingMessage, setPendingMessage] = useState<string | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const titleGeneratedRef = useRef(false)

  const addToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = crypto.randomUUID()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000)
  }, [])

  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}/sessions`)
      const data = await res.json()
      setSessions(data.sessions || [])
    } catch { addToast('Failed to load chat history', 'error') }
  }, [addToast])

  const generateTitle = useCallback(async (sid: string, userMsg: string, aiMsg: string) => {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}/generate-title`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sid, user_message: userMsg, ai_response: aiMsg }),
      })
      loadSessions()
    } catch { console.error('Failed to generate title') }
  }, [loadSessions])

  const loadHistory = useCallback(async (sid: string) => {
    setLoadingHistory(true)
    const defaultMsg: Message = { role: 'assistant', content: "Hello! I'm Infomary from InfoSenior.care. I'm here to help you or your loved one find the right care. How can I help you today?" }
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}/history/${sid}`)
      const data = await res.json()
      if (data.messages?.length > 0) {
        setMessages(data.messages)
        if (data.messages.length >= 2) {
          const u = data.messages.find((m: Message) => m.role === 'user')
          const a = data.messages.find((m: Message) => m.role === 'assistant' && m.content !== defaultMsg.content)
          if (u && a) { generateTitle(sid, u.content, a.content); setTitleGenerated(true) }
        }
      } else { setMessages([defaultMsg]) }
    } catch { addToast('Failed to load chat history', 'error'); setMessages([defaultMsg]) }
    finally { setLoadingHistory(false) }
  }, [addToast, generateTitle])

  const connectWebSocket = useCallback((sid: string) => {
    if (wsRef.current) wsRef.current.close()
    setWsStatus('connecting')
    const wsUrl = (process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000').replace('https://', 'wss://').replace('http://', 'ws://')
    const ws = new WebSocket(`${wsUrl}/ws/${sid}`)

    ws.onopen = () => {
      setWsConnected(true)
      setWsStatus('connected')
      reconnectAttemptsRef.current = 0
      // If there was a pending message, resend it
      const pending = localStorage.getItem(`pending_${sid}`)
      if (pending) {
        setPendingMessage(pending)
      }
    }

    ws.onmessage = (e) => {
      const d = JSON.parse(e.data)
      setMessages(p => [...p, { role: 'assistant', content: d.response }])
      setLoading(false)
      // Clear pending message on successful response
      localStorage.removeItem(`pending_${sid}`)
      setPendingMessage(null)
    }

    ws.onerror = () => {
      setWsConnected(false)
      setWsStatus('disconnected')
    }

    ws.onclose = () => {
      setWsConnected(false)
      setWsStatus('reconnecting')
      // Auto-reconnect with backoff: 2s, 4s, 8s, max 10s
      const attempts = reconnectAttemptsRef.current
      if (attempts < 5) {
        const delay = Math.min(2000 * Math.pow(1.5, attempts), 10000)
        reconnectAttemptsRef.current += 1
        reconnectTimerRef.current = setTimeout(() => connectWebSocket(sid), delay)
      } else {
        setWsStatus('disconnected')
      }
    }

    wsRef.current = ws
  }, [])

  useEffect(() => { loadSessions() }, [loadSessions])

  useEffect(() => {
    const urlSid = searchParams.get('session')
    const defaultMsg: Message = { role: 'assistant', content: "Hello! I'm Infomary from InfoSenior.care. I'm here to help you or your loved one find the right care. How can I help you today?" }
    if (urlSid) { setSessionId(urlSid); setTitleGenerated(false); loadHistory(urlSid) }
    else {
      const newId = generateSessionId()
      setSessionId(newId); router.replace(`/chat?session=${newId}`)
      setLoadingHistory(false); setMessages([defaultMsg])
    }
  }, [searchParams, router, loadHistory])

  const startNewChat = useCallback(() => {
    const newId = generateSessionId()
    const defaultMsg: Message = { role: 'assistant', content: "Hello! I'm Infomary from InfoSenior.care. I'm here to help you or your loved one find the right care. How can I help you today?" }
    setSessionId(newId); titleGeneratedRef.current = false; setTitleGenerated(false); setMessages([defaultMsg])
    router.push(`/chat?session=${newId}`); loadSessions(); setIsSidebarOpen(false); addToast('New chat started', 'info')
  }, [router, loadSessions, addToast])

  const loadSession = useCallback((sid: string) => {
    setSessionId(sid); titleGeneratedRef.current = false; setTitleGenerated(false)
    loadHistory(sid); router.push(`/chat?session=${sid}`); setIsSidebarOpen(false)
  }, [router, loadHistory])

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return
    try {
      await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}/delete-session`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: deleteConfirm }),
      })
      addToast('Chat deleted', 'success')
      if (deleteConfirm === sessionId) startNewChat(); else loadSessions()
    } catch { addToast('Failed to delete chat', 'error') }
    finally { setDeleteConfirm(null) }
  }

  useEffect(() => {
    if (sessionId) connectWebSocket(sessionId)
    return () => {
      wsRef.current?.close()
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
    }
  }, [sessionId, connectWebSocket])

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const sendMessage = async () => {
    if (!input.trim() || loading || !sessionId) return
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      // Save to localStorage so it survives disconnect
      localStorage.setItem(`pending_${sessionId}`, input)
      setPendingMessage(input)
      connectWebSocket(sessionId)
      return
    }
    const cur = input
    // Save pending before sending — cleared on response
    localStorage.setItem(`pending_${sessionId}`, cur)
    const userMsg: Message = { role: 'user', content: cur }
    setMessages(p => [...p, userMsg]); setInput(''); setLoading(true)
    const shouldTitle = !titleGeneratedRef.current
    wsRef.current.onmessage = (e) => {
      const d = JSON.parse(e.data)
      setMessages(p => [...p, { role: 'assistant', content: d.response }]); setLoading(false)
      localStorage.removeItem(`pending_${sessionId}`)
      setPendingMessage(null)
      if (shouldTitle) { titleGeneratedRef.current = true; setTitleGenerated(true); generateTitle(sessionId, cur, d.response); loadSessions() }
    }
    wsRef.current.send(JSON.stringify({ message: cur, history: messages }))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }

  const formatDate = (d: string) => {
    const diff = Math.floor((Date.now() - new Date(d).getTime()) / 86400000)
    if (diff === 0) return 'Today'; if (diff === 1) return 'Yesterday'
    if (diff < 7) return `${diff} days ago`; return new Date(d).toLocaleDateString()
  }

  return (
    <div className="flex h-screen bg-[#f8faff] text-gray-900 overflow-hidden">

      {/* Toasts */}
      <div className="fixed top-4 right-4 z-[100] space-y-2">
        {toasts.map(t => (
          <div key={t.id} className={`px-4 py-3 rounded-lg shadow-lg text-sm font-medium animate-slide-in text-white ${t.type === 'success' ? 'bg-green-600' : t.type === 'error' ? 'bg-red-500' : 'bg-blue-600'}`}>
            {t.message}
          </div>
        ))}
      </div>

      {/* Delete Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <FiTrash2 className="h-5 w-5 text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-[#1e3a5f]">Delete Chat</h3>
            </div>
            <p className="text-gray-500 text-sm mb-6">Are you sure? This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 px-4 py-2.5 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 text-sm font-medium transition-colors">Cancel</button>
              <button onClick={handleDeleteConfirm} className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white hover:bg-red-600 text-sm font-medium transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar overlay */}
      {isSidebarOpen && <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)} />}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-gray-200 flex flex-col transition-transform duration-300 shadow-xl ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:translate-x-0 lg:shadow-none`}>
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
                <span className="text-white text-xs font-bold">IS</span>
              </div>
              <span className="text-sm font-bold text-[#1e3a5f]">InfoSenior<span className="text-blue-500">.care</span></span>
            </Link>
            <button onClick={() => setIsSidebarOpen(false)} className="p-1.5 text-gray-400 hover:text-gray-600 lg:hidden rounded-lg hover:bg-gray-100 transition-colors">
              <FiX className="h-5 w-5" />
            </button>
          </div>
          <button onClick={startNewChat} className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2.5 text-sm font-semibold transition-colors shadow-sm shadow-blue-600/20">
            + New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2 px-1">Recent Chats</p>
          <div className="space-y-1">
            {sessions.map(s => (
              <div key={s.session_id} className={`group relative rounded-xl transition-colors ${sessionId === s.session_id ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50 border border-transparent'}`}>
                <button onClick={() => loadSession(s.session_id)} className="w-full text-left p-3 pr-8">
                  <div className={`text-sm font-medium truncate ${sessionId === s.session_id ? 'text-blue-700' : 'text-gray-700'}`}>{s.title}</div>
                  {s.description && <div className="text-xs text-gray-400 truncate mt-0.5">{s.description}</div>}
                  <div className="text-xs text-gray-400 mt-1">{formatDate(s.created_at)}</div>
                </button>
                <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm(s.session_id) }} className="absolute top-2.5 right-2 p-1 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-100 text-gray-400 hover:text-red-500 transition-all">
                  <FiTrash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {sessions.length === 0 && <div className="text-xs text-gray-400 text-center py-6">No previous chats</div>}
          </div>
        </div>

        <div className="p-3 border-t border-gray-100 space-y-1">
          <Link href="/voice" className="flex items-center gap-2 text-sm text-gray-500 hover:text-blue-600 py-2 px-3 rounded-xl hover:bg-blue-50 transition-colors">
            <FiMic className="w-4 h-4" /> Voice Agent
          </Link>
          
          
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 shadow-sm">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-gray-500 hover:text-[#1e3a5f] lg:hidden shrink-0 rounded-lg hover:bg-gray-100 transition-colors">
            <FiMenu className="h-5 w-5" />
          </button>
          <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center shrink-0 shadow-sm">
            <RiNurseLine className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0 ">
            <h1 className="text-sm font-bold text-[#1e3a5f] truncate">Infomary</h1>
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${
                wsStatus === 'connected' ? 'bg-green-500' :
                wsStatus === 'reconnecting' ? 'bg-yellow-500 animate-pulse' :
                wsStatus === 'connecting' ? 'bg-blue-400 animate-pulse' :
                'bg-red-400'
              }`} />
              <p className="text-xs text-gray-400">
                {wsStatus === 'connected' ? 'Online' :
                 wsStatus === 'reconnecting' ? 'Reconnecting...' :
                 wsStatus === 'connecting' ? 'Connecting...' :
                 'Disconnected'}
              </p>
            </div>
          </div>
          <Link href="/" className="ml-auto flex items-center gap-1.5 text-xs text-gray-400 hover:text-blue-600 transition-colors  sm:flex shrink-0">
            <FiHome className="w-3.5 h-3.5" /> Home
          </Link>
          <Link href="/voice" className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-blue-600 transition-colors hidden sm:flex shrink-0 pr-6">
            <FiMic className="w-3.5 h-3.5" /> Voice Agent
          </Link>
        </div>

        {/* Connection status banner */}
        {wsStatus === 'disconnected' && (
          <div className="bg-red-50 border-b border-red-100 px-4 py-2.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-400 rounded-full shrink-0" />
              <p className="text-xs font-medium text-red-600">Connection lost — messages won&apos;t send until reconnected</p>
            </div>
            <button
              onClick={() => { reconnectAttemptsRef.current = 0; connectWebSocket(sessionId) }}
              className="text-xs font-semibold text-red-600 hover:text-red-700 bg-red-100 hover:bg-red-200 px-3 py-1.5 rounded-lg transition-colors shrink-0"
            >
              Retry
            </button>
          </div>
        )}
        {wsStatus === 'reconnecting' && (
          <div className="bg-yellow-50 border-b border-yellow-100 px-4 py-2.5 flex items-center gap-2">
            <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse shrink-0" />
            <p className="text-xs font-medium text-yellow-700">Reconnecting automatically...</p>
          </div>
        )}

        {/* Pending message recovery */}
        {pendingMessage && wsStatus === 'connected' && (
          <div className="bg-blue-50 border-b border-blue-100 px-4 py-2.5 flex items-center justify-between gap-3">
            <p className="text-xs text-blue-600 truncate">
              Unsent message recovered: <span className="font-medium">&ldquo;{pendingMessage.slice(0, 60)}{pendingMessage.length > 60 ? '...' : ''}&rdquo;</span>
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => { setInput(pendingMessage); setPendingMessage(null); localStorage.removeItem(`pending_${sessionId}`) }}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-100 hover:bg-blue-200 px-3 py-1.5 rounded-lg transition-colors"
              >
                Restore
              </button>
              <button
                onClick={() => { setPendingMessage(null); localStorage.removeItem(`pending_${sessionId}`) }}
                className="text-xs text-blue-400 hover:text-blue-600 px-2 py-1.5 rounded-lg transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4">
          {loadingHistory ? (
            <div className="flex justify-center items-center h-full">
              <div className="flex gap-2">{[0,150,300].map(d => <div key={d} className="w-3 h-3 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />)}</div>
            </div>
          ) : (
            <>
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center mr-2 shrink-0 mt-1 shadow-sm">
                      <RiNurseLine className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <div className={`max-w-[85%] lg:max-w-2xl px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-white text-gray-800 rounded-tl-sm border border-gray-200'}`}>
                    {msg.role === 'assistant' ? (
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeRaw]}
                        components={{
                          h1: ({ ...p }) => <h1 className="text-lg font-bold my-2 text-[#1e3a5f]" {...p} />,
                          h2: ({ ...p }) => <h2 className="text-base font-bold my-2 text-[#1e3a5f]" {...p} />,
                          h3: ({ ...p }) => <h3 className="text-sm font-bold my-2 text-[#1e3a5f]" {...p} />,
                          p: ({ ...p }) => <p className="mb-2 last:mb-0" {...p} />,
                          strong: ({ ...p }) => <strong className="font-bold text-blue-700" {...p} />,
                          em: ({ ...p }) => <em className="italic text-gray-500" {...p} />,
                          ul: ({ ...p }) => <ul className="list-disc pl-4 mb-2" {...p} />,
                          ol: ({ ...p }) => <ol className="list-decimal pl-4 mb-2" {...p} />,
                          li: ({ ...p }) => <li className="mb-1" {...p} />,
                          a: ({ ...p }) => <a className="text-blue-600 underline hover:text-blue-700" target="_blank" rel="noreferrer" {...p} />,
                          blockquote: ({ ...p }) => <blockquote className="border-l-4 border-blue-200 pl-4 italic my-2 text-gray-500" {...p} />,
                          hr: () => <hr className="my-4 border-gray-200" />,
                          table: ({ ...p }) => <div className="overflow-x-auto my-4 border border-gray-200 rounded-xl"><table className="min-w-full divide-y divide-gray-200" {...p} /></div>,
                          thead: ({ ...p }) => <thead className="bg-gray-50" {...p} />,
                          tbody: ({ ...p }) => <tbody className="divide-y divide-gray-100" {...p} />,
                          tr: ({ ...p }) => <tr className="hover:bg-gray-50" {...p} />,
                          th: ({ ...p }) => <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider" {...p} />,
                          td: ({ ...p }) => <td className="px-4 py-2 text-xs text-gray-600 whitespace-pre-wrap" {...p} />,
                          code({ className, children, ...props }: { className?: string; children?: ReactNode } & HTMLAttributes<HTMLElement>) {
                            const match = /language-(\w+)/.exec(className || '')
                            if (match) return <SyntaxHighlighter language={match[1]} style={dracula} PreTag="div" className="rounded-xl my-3 text-xs">{String(children).replace(/\n$/, '')}</SyntaxHighlighter>
                            return <code className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-xs font-mono" {...props}>{children}</code>
                          },
                        }}
                      >{msg.content}</ReactMarkdown>
                    ) : msg.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center mr-2 shrink-0 shadow-sm"><RiNurseLine className="w-4 h-4 text-white" /></div>
                  <div className="bg-white px-4 py-3 rounded-2xl rounded-tl-sm border border-gray-200 shadow-sm">
                    <div className="flex gap-1 items-center h-4">{[0,150,300].map(d => <div key={d} className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />)}</div>
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="bg-white border-t border-gray-200 p-3 lg:p-4 shadow-sm">
          <div className="flex gap-2 lg:gap-3 items-end max-w-4xl mx-auto">
            <textarea
              value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
              placeholder="Ask Infomary about senior care options..."
              rows={1}
              className="flex-1 bg-gray-50 text-gray-800 placeholder-gray-400 rounded-xl px-4 py-3 text-sm resize-none outline-none border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all"
            />
            <button onClick={sendMessage} disabled={loading || !input.trim()} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-5 py-3 rounded-xl text-sm font-semibold transition-colors shrink-0 shadow-sm shadow-blue-600/20">
              Send
            </button>
          </div>
          <p className="text-xs text-gray-400 text-center mt-2">Enter to send · Shift+Enter for new line</p>
        </div>
      </div>
    </div>
  )
}

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen bg-[#f8faff] items-center justify-center">
        <div className="flex gap-2">{[0,150,300].map(d => <div key={d} className="w-3 h-3 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />)}</div>
      </div>
    }>
      <ChatPageInner />
    </Suspense>
  )
}
