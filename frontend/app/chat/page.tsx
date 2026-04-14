'use client'
import { useState, useRef, useEffect, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { dracula } from 'react-syntax-highlighter/dist/esm/styles/prism'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Session {
  session_id: string
  title: string
  description: string
  created_at: string
}

interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
}

function generateSessionId(): string {
  return crypto.randomUUID()
}

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
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const addToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = crypto.randomUUID()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000)
  }, [])

  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/sessions`)
      const data = await res.json()
      setSessions(data.sessions || [])
    } catch {
      addToast('Failed to load chat history', 'error')
    }
  }, [addToast])

  const generateTitle = useCallback(async (sid: string, userMsg: string, aiMsg: string) => {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/generate-title`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sid, user_message: userMsg, ai_response: aiMsg })
      })
      loadSessions()
    } catch { /* silent */ }
  }, [loadSessions])

  const loadHistory = useCallback(async (sid: string) => {
    setLoadingHistory(true)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/history/${sid}`)
      const data = await res.json()
      if (data.messages && data.messages.length > 0) {
        setMessages(data.messages)
        if (data.messages.length >= 2) {
          const firstUser = data.messages.find((m: Message) => m.role === 'user')
          const firstAi = data.messages.find((m: Message) => m.role === 'assistant' && !m.content.includes("Hello! I'm Infomary"))
          if (firstUser && firstAi) { generateTitle(sid, firstUser.content, firstAi.content); setTitleGenerated(true) }
        }
      } else {
        setMessages([{ role: 'assistant', content: "Hello! I'm Infomary from InfoSenior.care. I'm here to help you or your loved one find the right care. How can I help you today?" }])
      }
    } catch {
      addToast('Failed to load chat history', 'error')
      setMessages([{ role: 'assistant', content: "Hello! I'm Infomary from InfoSenior.care. I'm here to help you or your loved one find the right care. How can I help you today?" }])
    } finally {
      setLoadingHistory(false)
    }
  }, [addToast, generateTitle])

  useEffect(() => { loadSessions() }, [loadSessions])

  useEffect(() => {
    const urlSessionId = searchParams.get('session')
    if (urlSessionId) {
      setSessionId(urlSessionId); setTitleGenerated(false); loadHistory(urlSessionId)
    } else {
      const newId = generateSessionId()
      setSessionId(newId)
      router.replace(`/chat?session=${newId}`)
      setLoadingHistory(false)
      setMessages([{ role: 'assistant', content: "Hello! I'm Infomary from InfoSenior.care. I'm here to help you or your loved one find the right care. How can I help you today?" }])
    }
  }, [searchParams, router, loadHistory])

  const startNewChat = useCallback(() => {
    wsRef.current?.close()
    wsRef.current = null
    const newId = generateSessionId()
    setSessionId(newId)
    setMessages([{ role: 'assistant', content: "Hello! I'm Infomary from InfoSenior.care. I'm here to help you or your loved one find the right care. How can I help you today?" }])
    setTitleGenerated(false)
    router.push(`/chat?session=${newId}`)
    loadSessions()
    addToast('New chat started', 'info')
  }, [router, loadSessions, addToast])

  const loadSession = useCallback((sid: string) => {
    wsRef.current?.close()
    wsRef.current = null
    setSessionId(sid); setTitleGenerated(false); loadHistory(sid); router.push(`/chat?session=${sid}`)
  }, [router, loadHistory])

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return
    try {
      await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/delete-session`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: deleteConfirm })
      })
      addToast('Chat deleted', 'success')
      if (deleteConfirm === sessionId) startNewChat()
      else loadSessions()
    } catch { addToast('Failed to delete', 'error') }
    finally { setDeleteConfirm(null) }
  }

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const wsRef = useRef<WebSocket | null>(null)

  const sendMessage = async () => {
    if (!input.trim() || loading || !sessionId) return
    const userMessage: Message = { role: 'user', content: input }
    const currentMessages = [...messages, userMessage]
    setMessages(currentMessages); setInput(''); setLoading(true)

    try {
      // Connect WebSocket if not already connected
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        const wsUrl = (process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000')
          .replace('http://', 'ws://')
          .replace('https://', 'wss://')
        wsRef.current = new WebSocket(`${wsUrl}/ws/${sessionId}`)
      }

      const ws = wsRef.current

      const send = () => {
        ws.send(JSON.stringify({ message: input, history: messages }))
      }

      if (ws.readyState === WebSocket.OPEN) {
        send()
      } else {
        ws.onopen = () => send()
      }

      ws.onmessage = async (event) => {
        const data = JSON.parse(event.data)
        setMessages(prev => [...prev, { role: 'assistant', content: data.response }])
        setLoading(false)

        if (!titleGenerated && currentMessages.length >= 2) {
          try {
            await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/generate-title`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ session_id: sessionId, user_message: input, ai_response: data.response })
            })
            loadSessions()
            setTitleGenerated(true)
          } catch { /* silent */ }
        }
      }

      ws.onerror = () => {
        setMessages(prev => [...prev, { role: 'assistant', content: "Connection error. Please try again." }])
        setLoading(false)
        addToast('Connection error', 'error')
      }

    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: "Something went wrong. Please try again." }])
      addToast('Failed to send message', 'error')
      setLoading(false)
    }
  }

  const formatDate = (dateStr: string) => {
    const diffDays = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays}d ago`
    return new Date(dateStr).toLocaleDateString()
  }

  return (
    <div className="flex h-screen bg-gray-950 text-white">
      {/* Toasts */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map(t => (
          <div key={t.id} className={`px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${t.type === 'success' ? 'bg-green-600' : t.type === 'error' ? 'bg-red-600' : 'bg-blue-600'} text-white`}>
            {t.message}
          </div>
        ))}
      </div>

      {/* Delete Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-sm mx-4 shadow-2xl">
            <h3 className="text-lg font-semibold text-white mb-2">Delete Chat</h3>
            <p className="text-gray-400 text-sm mb-6">Are you sure? This cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 text-sm transition-colors">Cancel</button>
              <button onClick={handleDeleteConfirm} className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 text-sm transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <div className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col shrink-0">
        <div className="p-4 border-b border-gray-800">
          <Link href="/" className="text-base font-bold text-blue-400 block mb-3">InfoMary</Link>
          <button onClick={startNewChat} className="w-full bg-blue-600 text-white rounded-lg py-2 text-xs hover:bg-blue-700 font-semibold transition-colors">
            + New Chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Recent Chats</p>
          <div className="space-y-1">
            {sessions.map(s => (
              <div key={s.session_id} className={`group relative rounded-lg transition-colors ${sessionId === s.session_id ? 'bg-gray-800 border-l-2 border-blue-500' : 'hover:bg-gray-800'}`}>
                <button onClick={() => loadSession(s.session_id)} className="w-full text-left p-3 pr-8">
                  <div className="text-sm font-medium text-gray-200 truncate">{s.title}</div>
                  {s.description && <div className="text-xs text-gray-500 truncate mt-0.5">{s.description}</div>}
                  <div className="text-xs text-gray-600 mt-0.5">{formatDate(s.created_at)}</div>
                </button>
                <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm(s.session_id) }}
                  className="absolute top-2 right-2 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-900/50 text-gray-500 hover:text-red-400 transition-all">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            ))}
            {sessions.length === 0 && <p className="text-xs text-gray-600 text-center py-4">No previous chats</p>}
          </div>
        </div>
        <div className="p-3 border-t border-gray-800 space-y-1">
          <Link href="/" className="text-xs text-gray-500 hover:text-gray-300 block py-1.5 transition-colors">🏠 Home</Link>
          <Link href="/voice" className="text-xs text-gray-500 hover:text-gray-300 block py-1.5 transition-colors">🎙️ Voice Agent</Link>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="bg-gray-900 border-b border-gray-800 px-5 py-4 shrink-0">
          <h1 className="text-base font-bold text-blue-400">InfoSenior.care</h1>
          <p className="text-xs text-gray-500">AI-Powered Senior Care Assistant</p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          {loadingHistory ? (
            <div className="flex justify-center items-center h-full">
              <div className="flex gap-2">
                {[0, 150, 300].map(d => <div key={d} className="w-3 h-3 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg, i) => (
                <div key={i} className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm shrink-0">🩺</div>
                  )}
                  <div className={`max-w-lg px-4 py-3 rounded-2xl text-sm leading-relaxed ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-gray-800 text-gray-100 rounded-bl-none'}`}>
                    {msg.role === 'assistant' ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                        p: ({ ...props }) => <p className="mb-1 last:mb-0" {...props} />,
                        strong: ({ ...props }) => <strong className="font-semibold text-blue-300" {...props} />,
                        ul: ({ ...props }) => <ul className="list-disc pl-4 mb-1" {...props} />,
                        ol: ({ ...props }) => <ol className="list-decimal pl-4 mb-1" {...props} />,
                        code({ inline, className, children, ...props }: any) {
                          const match = /language-(\w+)/.exec(className || '')
                          return !inline && match ? (
                            <SyntaxHighlighter style={dracula as any} language={match[1]} PreTag="div" className="rounded text-xs mt-1" {...props}>
                              {String(children).replace(/\n$/, '')}
                            </SyntaxHighlighter>
                          ) : <code className="bg-black/30 px-1 py-0.5 rounded text-xs" {...props}>{children}</code>
                        }
                      }}>{msg.content}</ReactMarkdown>
                    ) : msg.content}
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-sm shrink-0">👤</div>
                  )}
                </div>
              ))}
              {loading && (
                <div className="flex items-end gap-2 justify-start">
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm shrink-0">🩺</div>
                  <div className="bg-gray-800 px-4 py-3 rounded-2xl rounded-bl-none">
                    <div className="flex gap-1 items-center h-4">
                      {[0, 150, 300].map(d => <div key={d} className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="bg-gray-900 border-t border-gray-800 p-4 shrink-0">
          <div className="flex gap-3 items-end max-w-4xl mx-auto">
            <textarea
              value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
              placeholder="Type your message..." rows={1}
              className="flex-1 bg-gray-800 text-white placeholder-gray-500 rounded-xl px-4 py-3 text-sm resize-none outline-none border border-gray-700 focus:border-blue-500 transition-colors"
            />
            <button onClick={sendMessage} disabled={loading || !input.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-5 py-3 rounded-xl text-sm font-semibold transition-colors">
              Send
            </button>
          </div>
          <p className="text-xs text-gray-600 text-center mt-2">Press Enter to send</p>
        </div>
      </div>
    </div>
  )
}

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen bg-gray-950 text-white items-center justify-center">
        <div className="flex gap-2">
          {[0, 150, 300].map(d => <div key={d} className="w-3 h-3 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
        </div>
      </div>
    }>
      <ChatPageInner />
    </Suspense>
  )
}
