import { NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getWelcomeState, markEnvelopeAsRead, generateLetterContent } from '@/lib/envelope/service'
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

    // 2. Extract query params
    const chatId = request.nextUrl.searchParams.get('chatId') || undefined
    const message = request.nextUrl.searchParams.get('message') || undefined

    // 3. Fetch current welcome state strictly for authenticated user.id
    const state = await getWelcomeState(user.id, {
      chatId,
      currentUserMessage: message
    })

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
    const { letterId, action, chatId, message, cognitiveState, currentTopic } = body

    // If generating on-demand envelope
    if (action === 'generate') {
      const content = await generateLetterContent({
        userId: user.id,
        chatId: chatId || null,
        currentUserMessage: message,
        cognitiveState,
        currentTopic,
        triggerType: 'conversational'
      })

      // Insert into envelope_letters as unread letter
      const { data: newLetter, error: insertErr } = await supabase
        .from('envelope_letters')
        .insert({
          user_id: user.id,
          chat_id: chatId || null,
          letter_type: 'conversational',
          content,
          mascot_character_used: 'munch',
          mascot_expression: 'happy',
          scene_used: 'default',
          presentation_type: 'envelope',
          is_read: false
        })
        .select()
        .single()

      if (insertErr) {
        console.warn('[EnvelopeRoute] Insert envelope letter fallback:', insertErr)
      }

      return jsonNoStore({ 
        content, 
        letter: newLetter || {
          id: 'temp-' + Date.now(),
          user_id: user.id,
          chat_id: chatId || null,
          letter_type: 'conversational',
          content,
          mascot_character_used: 'munch',
          mascot_expression: 'happy',
          scene_used: 'default',
          presentation_type: 'envelope',
          is_read: false,
          created_at: new Date().toISOString()
        }
      })
    }

    if (!letterId) {
      return jsonNoStore(
        { error: 'letterId is required.' },
        { status: 400 }
      )
    }

    // 3. Mark letter as read for authenticated user.id
    if (!letterId.startsWith('temp-')) {
      await markEnvelopeAsRead(user.id, letterId)
    }

    return jsonNoStore({ success: true })
  } catch (error: unknown) {
    console.error('POST /api/envelope/current failed:', error)
    return jsonNoStore(
      { error: error instanceof Error ? error.message : 'An unexpected error occurred.' },
      { status: 500 }
    )
  }
}
