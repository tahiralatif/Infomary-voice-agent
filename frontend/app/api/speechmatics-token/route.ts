import { NextResponse } from 'next/server'

export async function GET() {
  const apiKey = process.env.NEXT_PUBLIC_SPEECHMATICS_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'No API key configured' }, { status: 500 })
  }

  // Try 'flow' type first, fall back to 'rt' if not supported
  for (const type of ['flow', 'rt']) {
    try {
      const res = await fetch(`https://mp.speechmatics.com/v1/api_keys?type=${type}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ ttl: 3600 }),
      })

      if (res.ok) {
        const data = await res.json()
        console.log(`[speechmatics-token] Got JWT via type=${type}`)
        return NextResponse.json({ jwt: data.key_value })
      }

      const err = await res.text()
      console.warn(`[speechmatics-token] type=${type} failed: ${err}`)
    } catch (e) {
      console.error(`[speechmatics-token] type=${type} exception:`, e)
    }
  }

  return NextResponse.json({ error: 'Failed to get JWT from Speechmatics' }, { status: 500 })
}
