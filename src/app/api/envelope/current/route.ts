import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getWelcomeState, markEnvelopeAsRead } from '@/lib/envelope/service'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 1. Authenticate user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in.' },
        { status: 401 }
      )
    }

    // 2. Fetch current welcome state
    const state = await getWelcomeState(user.id)

    return NextResponse.json(state)
  } catch (error: unknown) {
    console.error('GET /api/envelope/current failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An unexpected error occurred.' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 1. Authenticate user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in.' },
        { status: 401 }
      )
    }

    // 2. Parse payload
    const body = await request.json()
    const { letterId } = body

    if (!letterId) {
      return NextResponse.json(
        { error: 'letterId is required.' },
        { status: 400 }
      )
    }

    // 3. Mark letter as read
    await markEnvelopeAsRead(user.id, letterId)

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('POST /api/envelope/current failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An unexpected error occurred.' },
      { status: 500 }
    )
  }
}
