import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  void req

  const res = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${process.env.ELEVENLABS_AGENT_ID}`,
    {
      method: "GET",
      headers: {
        "xi-api-key": process.env.ELEVENLABS_API_KEY!,
      },
    }
  )

  if (!res.ok) {
    const err = await res.text()
    console.error("ElevenLabs token error:", err)
    return NextResponse.json({ error: "Failed to get ElevenLabs token", details: err }, { status: 500 })
  }

  const data = await res.json()
  return NextResponse.json({ signedUrl: data.signed_url })
}
