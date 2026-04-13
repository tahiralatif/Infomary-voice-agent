import EndConversation from './EndConversation'

export async function handleToolInvoke(
  msg: any,
  webSocketRef: React.MutableRefObject<WebSocket | null>,
  setMessages: React.Dispatch<React.SetStateAction<any[]>>
) {
  const toolName = msg.function?.name
  const toolArgs = msg.function?.arguments
  const toolId = msg.id

  console.log(`%c[ToolInvoke] 🔧 Tool called: ${toolName}`, 'color: orange; font-weight: bold')
  console.log(`%c[ToolInvoke] Args:`, 'color: orange', toolArgs)

  // 1. Handle EndConversation locally
  if (toolName === 'EndConversation') {
    console.log('%c[ToolInvoke] 👋 EndConversation triggered', 'color: orange; font-weight: bold')
    EndConversation(webSocketRef, setMessages)
    return
  }

  // 2. Route all other tools (google_search, save_lead) to your LOCAL backend
  try {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
    const res = await fetch(`${backendUrl}/speechmatics-tools`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        tool_name: toolName, 
        args: toolArgs 
      })
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 100)}`)
    }

    const data = await res.json()
    console.log(`%c[ToolInvoke] ✅ Local Result:`, 'color: green', data)

    // Speechmatics expects a response back via WebSocket
    webSocketRef.current?.send(JSON.stringify({
      message: 'ToolResult',
      id: toolId,
      status: data.error ? 'failed' : 'ok',
      content: data.result || data.error || 'Done'
    }))

  } catch (e) {
    console.error(`[ToolInvoke] ❌ Local Backend Error:`, e)
    webSocketRef.current?.send(JSON.stringify({
      message: 'ToolResult', 
      id: toolId, 
      status: 'failed', 
      content: 'Error connecting to local tool backend.'
    }))
  }
}
