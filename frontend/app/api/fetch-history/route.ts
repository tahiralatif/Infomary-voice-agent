import { supabase } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const session_id = req.nextUrl.searchParams.get('session_id')

  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('session_id', session_id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json({ messages: data })
}