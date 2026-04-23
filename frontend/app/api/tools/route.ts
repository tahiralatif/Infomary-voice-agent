import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  const body = await req.json()
  const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8000"

  try {
    const res = await fetch(`${backendUrl}/voice-tools`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool_name: body.tool_name, args: body.args }),
    })
    const data = await res.json()
    return NextResponse.json(data)
  } catch (err) {
    console.error("Tool proxy error:", err)
    return NextResponse.json({ error: "Tool call failed" }, { status: 500 })
  }
}
