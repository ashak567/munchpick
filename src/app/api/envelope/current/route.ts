import { NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getWelcomeState, markEnvelopeAsRead } from '@/lib/envelope/service'
import { jsonNoStore } from '@/lib/api-headers'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 1. Authenticate user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return jsonNoStore(
        { error: 'Unauthorized. Please sign in.' },
        { status: 401 }
      )
    }

    // 2. Fetch current welcome state strictly for authenticated user.id
    const state = await getWelcomeState(user.id)

    return jsonNoStore(state)
  } catch (error: unknown) {
    console.error('GET /api/envelope/current failed:', error)
    return jsonNoStore(
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
      return jsonNoStore(
        { error: 'Unauthorized. Please sign in.' },
        { status: 401 }
      )
    }

    // 2. Parse payload
    const body = await request.json()
    const { letterId } = body

    if (!letterId) {
      return jsonNoStore(
        { error: 'letterId is required.' },
        { status: 400 }
      )
    }

    // 3. Mark letter as read for authenticated user.id
    await markEnvelopeAsRead(user.id, letterId)

    return jsonNoStore({ success: true })
  } catch (error: unknown) {
    console.error('POST /api/envelope/current failed:', error)
    return jsonNoStore(
      { error: error instanceof Error ? error.message : 'An unexpected error occurred.' },
      { status: 500 }
    )
  }
}
