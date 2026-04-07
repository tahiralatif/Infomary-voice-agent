'use client'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [history, setHistory] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{
        role: 'assistant',
        content: "Hello! I'm Infomary from InfoSenior.care. I'm here to help you or your loved one find the right care. How can I help you today?"
      }])
    }
  }, [messages.length])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    if (!input.trim() || loading) return

    const userMessage: Message = { role: 'user', content: input }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_NEXT_BACKEND_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input,
          history: history
        })
      })

      const data = await res.json()
      
      const assistantMessage: Message = { role: 'assistant', content: data.response }
      setMessages(prev => [...prev, assistantMessage])
      setHistory(data.history)

    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "I'm sorry, something went wrong. Please try again."
      }])
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

  return (
    <div className="flex h-screen bg-gray-950 text-white">
      
      {/* Sidebar */}
      <div className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col p-4">
        <h2 className="text-base font-bold text-blue-400 mb-4">InfoMary</h2>
        <button
          onClick={() => { setMessages([]); setHistory([]) }}
          className="w-full bg-blue-600 text-white rounded-lg py-2 text-xs hover:bg-blue-700"
        >
          + New Chat
        </button>
        <div className="mt-4">
          <Link href="/" className="text-xs text-gray-500 hover:text-gray-300 block py-2">
            🎙️ Voice Agent
          </Link>
          <Link href="/chat" className="text-xs text-blue-400 font-semibold bloc
          k py-2">
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
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm mr-3 flex-shrink-0 mt-1">
                  🩺
                </div>
              )}

              <div className={`max-w-lg px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                msg.role === 'user'
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
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}} />
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}} />
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}} />
                </div>
              </div>
            </div>
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