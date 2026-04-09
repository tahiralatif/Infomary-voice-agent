import { supabase } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { session_id, role, content } = await req.json()

  if (!session_id || !role || !content) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  try {
    // Create session if it doesn't exist
    const { error: sessionError } = await supabase
      .from('infomary_sessions')
      .upsert(
        { 
          session_id, 
          title: 'New Conversation',
          description: ''
        }, 
        { onConflict: 'session_id' }
      )

    if (sessionError) {
      console.error('Session creation error:', sessionError)
    }

    // Save message
    const { error: messageError } = await supabase
      .from('infomary_messages')
      .insert({ 
        session_id, 
        role, 
        content,
        message_id: crypto.randomUUID()
      })

    if (messageError) {
      console.error('Message save error:', messageError)
      return NextResponse.json({ error: messageError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
