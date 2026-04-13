'use client'
import { useState, useRef, useEffect, useCallback, Suspense, ReactNode, HTMLAttributes, CSSProperties } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const [wsConnected, setWsConnected] = useState(false)

  const addToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = crypto.randomUUID()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3000)
  }, [])

  const loadSessions = useCallback(async () => {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
      const res = await fetch(`${backendUrl}/sessions`)
      const data = await res.json()
      setSessions(data.sessions || [])
    } catch (error) {
      console.error('Failed to load sessions:', error)
      addToast('Failed to load chat history', 'error')
    }
  }, [addToast])

  const generateTitle = useCallback(async (sid: string, userMsg: string, aiMsg: string) => {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
      await fetch(`${backendUrl}/generate-title`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sid, user_message: userMsg, ai_response: aiMsg })
      })
      loadSessions()
    } catch (error) {
      console.error('Failed to generate title:', error)
    }
  }, [loadSessions])

  const loadHistory = useCallback(async (sid: string) => {
    setLoadingHistory(true)
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
      const res = await fetch(`${backendUrl}/history/${sid}`)
      const data = await res.json()

      if (data.messages && data.messages.length > 0) {
        setMessages(data.messages)
        if (data.messages.length >= 2) {
          const firstUserMsg = data.messages.find((m: Message) => m.role === 'user')
          const firstAiMsg = data.messages.find((m: Message) => m.role === 'assistant' && m.content !== "Hello! I'm Infomary from InfoSenior.care. I'm here to help you or your loved one find the right care. How can I help you today?")
          if (firstUserMsg && firstAiMsg) {
            generateTitle(sid, firstUserMsg.content, firstAiMsg.content)
            setTitleGenerated(true)
          }
        }
      } else {
        setMessages([{
          role: 'assistant',
          content: "Hello! I'm Infomary from InfoSenior.care. I'm here to help you or your loved one find the right care. How can I help you today?"
        }])
      }
    } catch (error) {
      console.error('Failed to load history:', error)
      addToast('Failed to load chat history', 'error')
      setMessages([{
        role: 'assistant',
        content: "Hello! I'm Infomary from InfoSenior.care. I'm here to help you or your loved one find the right care. How can I help you today?"
      }])
    } finally {
      setLoadingHistory(false)
    }
  }, [addToast, generateTitle])

  const connectWebSocket = useCallback((sid: string) => {

    if (wsRef.current) {
      wsRef.current.close()
    }

    const wsUrl = (process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000')
      .replace('https://', 'wss://')
      .replace('http://', 'ws://')

    const ws = new WebSocket(`${wsUrl}/ws/${sid}`)

    ws.onopen = () => {
      setWsConnected(true)
      console.log('[WS] Connected')
    }

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.response
      }])
      setLoading(false)
    }

    ws.onerror = () => {
      addToast('Connection error — retrying...', 'error')
      setWsConnected(false)
    }

    ws.onclose = () => {
      setWsConnected(false)
    }

    wsRef.current = ws
  }, [addToast])

  // Load sessions on mount
  useEffect(() => {
    loadSessions()
  }, [loadSessions])

  // React to URL session param changes
  useEffect(() => {
    const urlSessionId = searchParams.get('session')
    if (urlSessionId) {
      setSessionId(urlSessionId)
      setTitleGenerated(false)
      loadHistory(urlSessionId)
    } else {
      const newSessionId = generateSessionId()
      setSessionId(newSessionId)
      router.replace(`/chat?session=${newSessionId}`)
      setLoadingHistory(false)
      setMessages([{
        role: 'assistant',
        content: "Hello! I'm Infomary from InfoSenior.care. I'm here to help you or your loved one find the right care. How can I help you today?"
      }])
    }
  }, [searchParams, router, loadHistory])

  const startNewChat = useCallback(() => {
    const newSessionId = generateSessionId()
    setSessionId(newSessionId)
    titleGeneratedRef.current = false
    setTitleGenerated(false)
    setMessages([{
      role: 'assistant',
      content: "Hello! I'm Infomary from InfoSenior.care. I'm here to help you or your loved one find the right care. How can I help you today?"
    }])
    router.push(`/chat?session=${newSessionId}`)
    loadSessions()
    setIsSidebarOpen(false)
    addToast('New chat started', 'info')
  }, [router, loadSessions, addToast])

  const loadSession = useCallback((sid: string) => {
    setSessionId(sid)
    titleGeneratedRef.current = false
    setTitleGenerated(false)
    loadHistory(sid)
    router.push(`/chat?session=${sid}`)
    setIsSidebarOpen(false)
  }, [router, loadHistory])

  const handleDeleteClick = (e: React.MouseEvent, sid: string) => {
    e.stopPropagation()
    setDeleteConfirm(sid)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
      await fetch(`${backendUrl}/delete-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: deleteConfirm })
      })
      addToast('Chat deleted successfully', 'success')
      if (deleteConfirm === sessionId) {
        startNewChat()
      } else {
        loadSessions()
      }
    } catch (error) {
      console.error('Failed to delete session:', error)
      addToast('Failed to delete chat', 'error')
    } finally {
      setDeleteConfirm(null)
    }
  }

  const handleDeleteCancel = () => setDeleteConfirm(null)

  useEffect(() => {
    if (sessionId) connectWebSocket(sessionId)
    return () => { wsRef.current?.close() }
  }, [sessionId, connectWebSocket])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const titleGeneratedRef = useRef(false)

  const sendMessage = async () => {
    if (!input.trim() || loading || !sessionId) return

    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      addToast('Connecting...', 'info')
      connectWebSocket(sessionId)
      setTimeout(() => sendMessage(), 800)
      return
    }

    const userMessage: Message = { role: 'user', content: input }
    setMessages(prev => [...prev, userMessage])
    const currentInput = input
    setInput('')
    setLoading(true)


    const shouldGenerateTitle = !titleGeneratedRef.current

    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data)
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }])
      setLoading(false)

      if (shouldGenerateTitle) {
        titleGeneratedRef.current = true
        setTitleGenerated(true)
        generateTitle(sessionId, currentInput, data.response)
        loadSessions()
      }
    }

    wsRef.current.send(JSON.stringify({
      message: currentInput,
      history: messages,
    }))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    return date.toLocaleDateString()
  }

  return (
    <div className="flex h-screen bg-gray-950 text-white overflow-hidden relative">

      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-[100] space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`px-4 py-3 rounded-lg shadow-lg text-sm font-medium animate-slide-in ${toast.type === 'success' ? 'bg-green-600 text-white' :
                toast.type === 'error' ? 'bg-red-600 text-white' :
                  'bg-blue-600 text-white'
              }`}
          >
            {toast.message}
          </div>
        ))}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white">Delete Chat</h3>
            </div>
            <p className="text-gray-400 text-sm mb-6">
              Are you sure you want to delete this chat? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={handleDeleteCancel} className="flex-1 px-4 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 text-sm font-medium transition-colors">
                Cancel
              </button>
              <button onClick={handleDeleteConfirm} className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 text-sm font-medium transition-colors">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar Overlay (Mobile) */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 border-r border-gray-800 flex flex-col transition-transform duration-300 transform
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:relative lg:translate-x-0
      `}>
        <div className="p-4 border-b border-gray-800 flex items-center justify-between lg:block">
          <div>
            <h2 className="text-base font-bold text-blue-400">InfoMary</h2>
            <p className="text-[10px] text-gray-500 lg:mb-3">Senior Care Navigation</p>
          </div>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="p-2 text-gray-400 hover:text-white lg:hidden"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <button onClick={startNewChat} className="w-full bg-blue-600 text-white rounded-lg py-2 text-xs hover:bg-blue-700 mt-2 lg:mt-0">
            + New Chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Recent Chats</h3>
          <div className="space-y-1">
            {sessions.map((session) => (
              <div
                key={session.session_id}
                className={`group relative rounded-lg transition-colors ${sessionId === session.session_id ? 'bg-gray-800 border-l-2 border-blue-500' : 'hover:bg-gray-800'
                  }`}
              >
                <button onClick={() => loadSession(session.session_id)} className="w-full text-left p-3 pr-8">
                  <div className="text-sm font-medium text-gray-200 truncate">{session.title}</div>
                  {session.description && (
                    <div className="text-xs text-gray-500 truncate mt-1">{session.description}</div>
                  )}
                  <div className="text-xs text-gray-600 mt-1">{formatDate(session.created_at)}</div>
                </button>
                <button
                  onClick={(e) => handleDeleteClick(e, session.session_id)}
                  className="absolute top-2 right-2 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-900/50 text-gray-500 hover:text-red-400 transition-all"
                  title="Delete chat"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            ))}
            {sessions.length === 0 && (
              <div className="text-xs text-gray-600 text-center py-4">No previous chats</div>
            )}
          </div>
        </div>
        <div className="p-3 border-t border-gray-800">
          <Link href="/" className="text-xs text-gray-500 hover:text-gray-300 block py-2">
            🎙️ Voice Agent
          </Link>
          <Link href="/chat" className="text-xs text-blue-400 font-semibold block py-2">
            Text Agent
          </Link>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        {/* Header */}
        <div className="bg-gray-900 border-b border-gray-800 p-3 lg:p-4 flex items-center gap-3">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 text-gray-400 hover:text-white lg:hidden flex-shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="min-w-0">
            <h1 className="text-base lg:text-lg font-bold text-blue-400 truncate">InfoSenior.care</h1>
            <p className="text-[10px] lg:text-xs text-gray-500 truncate">AI-Powered Senior Care Assistant</p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4">
          {loadingHistory ? (
            <div className="flex justify-center items-center h-full">
              <div className="flex gap-2 items-center">
                <div className="w-3 h-3 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-3 h-3 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-3 h-3 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-7 h-7 lg:w-8 lg:h-8 rounded-full bg-blue-600 flex items-center justify-center text-[10px] lg:text-sm mr-2 lg:mr-3 flex-shrink-0 mt-1">
                      🩺
                    </div>
                  )}
                  <div className={`max-w-[85%] lg:max-w-2xl px-3 py-2 lg:px-4 lg:py-3 rounded-2xl text-xs lg:text-sm leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-gray-800 text-gray-100 rounded-tl-sm border border-gray-700/50'
                    }`}>
                    {msg.role === 'assistant' ? (
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeRaw]}
                        components={{
                          h1: ({ ...props }) => <h1 className="text-lg lg:text-xl font-bold my-2 text-blue-400" {...props} />,
                          h2: ({ ...props }) => <h2 className="text-md lg:text-lg font-bold my-2 text-blue-400" {...props} />,
                          h3: ({ ...props }) => <h3 className="text-sm lg:text-md font-bold my-2 text-blue-400" {...props} />,
                          p: ({ ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                          strong: ({ ...props }) => <strong className="font-bold text-blue-300" {...props} />,
                          em: ({ ...props }) => <em className="italic text-gray-300" {...props} />,
                          ul: ({ ...props }) => <ul className="list-disc pl-4 mb-2" {...props} />,
                          ol: ({ ...props }) => <ol className="list-decimal pl-4 mb-2" {...props} />,
                          li: ({ ...props }) => <li className="mb-1" {...props} />,
                          a: ({ ...props }) => <a className="text-blue-400 underline hover:text-blue-300 transition-colors" target="_blank" rel="noreferrer" {...props} />,
                          blockquote: ({ ...props }) => <blockquote className="border-l-4 border-gray-600 pl-4 italic my-2 text-gray-400" {...props} />,
                          hr: () => <hr className="my-4 border-gray-700" />,
                          table: ({ ...props }) => (
                            <div className="overflow-x-auto my-4 border border-gray-700 rounded-lg shadow-sm">
                              <table className="min-w-full divide-y divide-gray-700" {...props} />
                            </div>
                          ),
                          thead: ({ ...props }) => <thead className="bg-gray-900" {...props} />,
                          tbody: ({ ...props }) => <tbody className="divide-y divide-gray-700" {...props} />,
                          tr: ({ ...props }) => <tr className="hover:bg-gray-700/50 transition-colors" {...props} />,
                          th: ({ ...props }) => <th className="px-3 lg:px-4 py-2 text-left text-[10px] lg:text-xs font-semibold text-gray-300 uppercase tracking-wider" {...props} />,
                          td: ({ ...props }) => <td className="px-3 lg:px-4 py-2 text-[10px] lg:text-xs text-gray-300 whitespace-pre-wrap" {...props} />,
                          code({
                            className,
                            children,
                            ...props
                          }: {
                            className?: string;
                            children?: ReactNode;
                          } & HTMLAttributes<HTMLElement>) {
                            const match = /language-(\w+)/.exec(className || '');
                            const isInline = !match;
                            if (!isInline && match) {
                              return (
                                <SyntaxHighlighter
                                  language={match[1]}
                                  style={dracula}
                                  PreTag="div"
                                  className="rounded-md my-2 lg:my-4 text-[10px] lg:text-xs"
                                >
                                  {String(children).replace(/\n$/, "")}
                                </SyntaxHighlighter>
                              );
                            } else {
                              return (
                                <code
                                  className="bg-gray-900 px-1.5 py-0.5 rounded text-[10px] lg:text-xs font-mono text-blue-300"
                                  {...props}
                                >
                                  {children}
                                </code>
                              );
                            }
                          },
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="w-7 h-7 lg:w-8 lg:h-8 rounded-full bg-blue-600 flex items-center justify-center text-[10px] lg:text-sm mr-2 lg:mr-3 flex-shrink-0">
                    🩺
                  </div>
                  <div className="bg-gray-800 px-4 py-2 lg:py-3 rounded-2xl rounded-tl-sm border border-gray-700/50">
                    <div className="flex gap-1 items-center h-4">
                      <div className="w-1.5 h-1.5 lg:w-2 lg:h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-1.5 h-1.5 lg:w-2 lg:h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-1.5 h-1.5 lg:w-2 lg:h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="bg-gray-900 border-t border-gray-800 p-3 lg:p-4">
          <div className="flex gap-2 lg:gap-3 items-end max-w-4xl mx-auto">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              rows={1}
              className="flex-1 bg-gray-800 text-white placeholder-gray-500 rounded-xl px-4 py-2.5 lg:py-3 text-xs lg:text-sm resize-none outline-none border border-gray-700 focus:border-blue-500 transition-colors"
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 lg:px-6 py-2.5 lg:py-3 rounded-xl text-xs lg:text-sm font-semibold transition-colors flex-shrink-0"
            >
              Send
            </button>
          </div>
          <p className="text-[10px] text-gray-600 text-center mt-2 lg:hidden">Enter to send</p>
          <p className="hidden lg:block text-[10px] text-gray-600 text-center mt-2">Press Enter to send, Shift+Enter for new line</p>
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
          <div className="w-3 h-3 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-3 h-3 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-3 h-3 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    }>
      <ChatPageInner />
    </Suspense>
  )
}
