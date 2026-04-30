"use client"
import dynamic from "next/dynamic"

const VoiceAgentClient = dynamic(
  () => import("./VoiceAgentClient").then(mod => ({ default: mod.default })),
  { ssr: false, loading: () => null }
)

export default function VoicePage() {
  return <VoiceAgentClient />
}
