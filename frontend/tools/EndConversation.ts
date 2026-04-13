const EndConversation = (
  webSocketRef: React.MutableRefObject<WebSocket | null>,
  setMessages: React.Dispatch<React.SetStateAction<any[]>>
) => {
  // Wait for agent to finish farewell message before closing
  setTimeout(() => {
    webSocketRef?.current?.close()
    setMessages([])
  }, 4000)
}

export default EndConversation
