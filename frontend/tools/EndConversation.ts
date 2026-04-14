import { MutableRefObject, Dispatch, SetStateAction } from 'react'

const EndConversation = (
  webSocketRef: MutableRefObject<WebSocket | null>,
  setMessages: Dispatch<SetStateAction<any[]>>
) => {
  setTimeout(() => {
    webSocketRef?.current?.close()
    setMessages([])
  }, 4000)
}

export default EndConversation
