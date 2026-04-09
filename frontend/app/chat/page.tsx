'use client'
import { useState, useRef, useEffect, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

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

function ChatContent() {
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

  // Load sessions on mount
  useEffect(() => {
    loadSessions()
  }, [])

  // Load or create session on URL change
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
  }, [])

  const addToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = crypto.randomUUID()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3000)
  }

  const loadSessions = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/sessions`)
      const data = await res.json()
      setSessions(data.sessions || [])
    } catch (error) {
      console.error('Failed to load sessions:', error)
      addToast('Failed to load chat history', 'error')
    }
  }

  const loadHistory = async (sid: string) => {
    setLoadingHistory(true)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/history/${sid}`)
      const data = await res.json()

      if (data.messages && data.messages.length > 0) {
        setMessages(data.messages)
        // Check if title should be generated (after first exchange)
        if (data.messages.length >= 2 && !titleGenerated) {
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
  }

  const generateTitle = async (sid: string, userMsg: string, aiMsg: string) => {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/generate-title`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sid,
          user_message: userMsg,
          ai_response: aiMsg
        })
      })
      // Reload sessions to get updated title
      loadSessions()
    } catch (error) {
      console.error('Failed to generate title:', error)
    }
  }

  const startNewChat = useCallback(() => {
    const newSessionId = generateSessionId()
    setSessionId(newSessionId)
    setMessages([{
      role: 'assistant',
      content: "Hello! I'm Infomary from InfoSenior.care. I'm here to help you or your loved one find the right care. How can I help you today?"
    }])
    setTitleGenerated(false)
    router.push(`/chat?session=${newSessionId}`)
    // Refresh sessions list
    loadSessions()
    addToast('New chat started', 'info')
  }, [router])

  const loadSession = (sid: string) => {
    setSessionId(sid)
    setTitleGenerated(false)
    loadHistory(sid)
    router.push(`/chat?session=${sid}`)
  }

  const handleDeleteClick = (e: React.MouseEvent, sid: string) => {
    e.stopPropagation()
    setDeleteConfirm(sid)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return

    try {
      await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/delete-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: deleteConfirm })
      })

      addToast('Chat deleted successfully', 'success')

      // If deleting current session, start new chat
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

  const handleDeleteCancel = () => {
    setDeleteConfirm(null)
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    if (!input.trim() || loading || !sessionId) return

    const userMessage: Message = { role: 'user', content: input }
    const currentMessages = [...messages, userMessage]
    setMessages(currentMessages)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input,
          history: messages,
          session_id: sessionId
        })
      })

      const data = await res.json()

      const assistantMessage: Message = { role: 'assistant', content: data.response }
      setMessages(prev => [...prev, assistantMessage])

      // Generate title after first exchange if not already done
      if (!titleGenerated && currentMessages.length >= 2) {
        generateTitle(sessionId, input, data.response)
        setTitleGenerated(true)
      }

    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "I'm sorry, something went wrong. Please try again."
      }])
      addToast('Failed to send message', 'error')
    } finally {
      setLoading(false)
    }
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
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    return date.toLocaleDateString()
  }

  return (
    <div className="flex h-screen bg-gray-950 text-white">

      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-sm mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
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
              <button
                onClick={handleDeleteCancel}
                className="px-4 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 text-sm font-medium transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <div className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-800">
          <h2 className="text-base font-bold text-blue-400 mb-3">InfoMary</h2>
          <button
            onClick={startNewChat}
            className="w-full bg-blue-600 text-white rounded-lg py-2 text-xs hover:bg-blue-700"
          >
            + New Chat
          </button>
        </div>

        {/* Session History */}
        <div className="flex-1 overflow-y-auto p-3">
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Recent Chats</h3>
          <div className="space-y-1">
            {sessions.map((session) => (
              <div
                key={session.session_id}
                className={`group relative rounded-lg transition-colors ${sessionId === session.session_id ? 'bg-gray-800 border-l-2 border-blue-500' : 'hover:bg-gray-800'
                  }`}
              >
                <button
                  onClick={() => loadSession(session.session_id)}
                  className="w-full text-left p-3 pr-8"
                >
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

        {/* Footer Links */}
        <div className="p-3 border-t border-gray-800">
          <Link href="/" className="text-xs text-gray-500 hover:text-gray-300 block py-2">
            🎙️ Voice Agent
          </Link>
          <Link href="/chat" className="text-xs text-blue-400 font-semibold block py-2">
            Text Agent
          </Link>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col">

        {/* Header */}
        <div className="bg-gray-900 border-b border-gray-800 p-4">
          <h1 className="text-lg font-bold text-blue-400">InfoSenior.care</h1>
          <p className="text-xs text-gray-500">AI-Powered Senior Care Assistant</p>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
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
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm mr-3 flex-shrink-0 mt-1">
                      🩺
                    </div>
                  )}

                  <div className={`max-w-lg px-4 py-3 rounded-2xl text-sm leading-relaxed ${msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-tr-sm'
                    : 'bg-gray-800 text-gray-100 rounded-tl-sm'
                    }`}>
                    {msg.content}
                  </div>

                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm mr-3 flex-shrink-0">
                    🩺
                  </div>
                  <div className="bg-gray-800 px-4 py-3 rounded-2xl rounded-tl-sm">
                    <div className="flex gap-1 items-center h-4">
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="bg-gray-900 border-t border-gray-800 p-4">
          <div className="flex gap-3 items-end max-w-4xl mx-auto">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              rows={1}
              className="flex-1 bg-gray-800 text-white placeholder-gray-500 rounded-xl px-4 py-3 text-sm resize-none outline-none border border-gray-700 focus:border-blue-500 transition-colors"
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-5 py-3 rounded-xl text-sm font-semibold transition-colors"
            >
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
    <Suspense>
      <ChatContent />
    </Suspense>
  )
} 