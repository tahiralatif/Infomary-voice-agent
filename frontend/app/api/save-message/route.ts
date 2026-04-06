import { supabase } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { session_id, role, content } = await req.json()

  // Pehle session create karo agar exist nahi karta
  await supabase
    .from('sessions')
    .upsert({ session_id }, { onConflict: 'session_id' })

  // Phir message save karo
  const { error } = await supabase
    .from('messages')
    .insert({ session_id, role, content })

  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json({ success: true })
}