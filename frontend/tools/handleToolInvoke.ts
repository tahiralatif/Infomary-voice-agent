import EndConversation from './EndConversation'

export async function handleToolInvoke(
  msg: any,
  webSocketRef: React.MutableRefObject<WebSocket | null>,
  setMessages: React.Dispatch<React.SetStateAction<any[]>>
) {
  const toolName = msg.function?.name
  const toolArgs = msg.function?.arguments

  console.log(`%c[ToolInvoke] 🔧 Tool called: ${toolName}`, 'color: orange; font-weight: bold')
  console.log(`%c[ToolInvoke] Args:`, 'color: orange', toolArgs)

  if (toolName === 'EndConversation') {
    console.log('%c[ToolInvoke] 👋 EndConversation triggered', 'color: orange; font-weight: bold')
    EndConversation(webSocketRef, setMessages)
    return
  }

  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/speechmatics-tools`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool_name: toolName, args: toolArgs })
    })
    const data = await res.json()
    console.log(`%c[ToolInvoke] ✅ Result:`, 'color: green', data)

    webSocketRef.current?.send(JSON.stringify({
      message: 'ToolResult',
      id: msg.id,
      status: data.error ? 'failed' : 'ok',
      content: data.result || data.error || 'Done'
    }))
    console.log(`%c[ToolInvoke] ✅ ToolResult sent`, 'color: green')
  } catch (e) {
    console.error(`[ToolInvoke] ❌ Error:`, e)
    webSocketRef.current?.send(JSON.stringify({
      message: 'ToolResult', id: msg.id, status: 'failed', content: 'Error'
    }))
  }
}
