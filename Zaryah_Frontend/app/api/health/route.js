import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    console.log('=== HEALTH CHECK START ===')
    
    // Check if Supabase is initialized
    if (!supabase) {
      return NextResponse.json({
        status: 'error',
        message: 'Supabase client not initialized',
        env: {
          hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
          hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
        }
      }, { status: 500 })
    }

    // Try a simple query
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1)

    if (error) {
      console.error('Supabase query error:', error)
      return NextResponse.json({
        status: 'error',
        message: 'Database connection failed',
        error: error.message,
        env: {
          hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
          hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
        }
      }, { status: 500 })
    }

    console.log('=== HEALTH CHECK SUCCESS ===')
    return NextResponse.json({
      status: 'ok',
      message: 'All systems operational',
      database: 'connected',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('=== HEALTH CHECK ERROR ===', error)
    return NextResponse.json({
      status: 'error',
      message: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}
