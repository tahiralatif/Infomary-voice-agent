import { supabase } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const session_id = searchParams.get('session_id')

  if (!session_id) {
    return NextResponse.json({ error: 'session_id is required' }, { status: 400 })
  }

  try {
    // Fetch session info
    const { data: sessionData } = await supabase
      .from('infomary_sessions')
      .select('title, description')
      .eq('session_id', session_id)
      .single()

    // Fetch last 10 messages for context
    const { data: messages, error } = await supabase
      .from('infomary_messages')
      .select('role, content')
      .eq('session_id', session_id)
      .order('created_at', { ascending: true })
      .limit(10)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!messages || messages.length === 0) {
      return NextResponse.json({ context: '' })
    }

    // Build context string for Vapi
    let context = 'PREVIOUS CONVERSATION CONTEXT:\n'
    messages.forEach(msg => {
      const speaker = msg.role === 'user' ? 'User' : 'Assistant'
      context += `${speaker}: ${msg.content}\n`
    })

    context += '\nIMPORTANT: This is a continuation of a previous conversation. Please maintain context and continue naturally from where you left off.'

    return NextResponse.json({ 
      context,
      title: sessionData?.title || 'New Conversation',
      description: sessionData?.description || '',
      messageCount: messages.length
    })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
