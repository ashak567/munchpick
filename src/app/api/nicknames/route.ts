import { NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { updateNicknameAffinity, getRelationshipState } from '@/lib/nickname/service'
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

    // 2. Fetch nickname affinities strictly for authenticated user.id
    const { data: affinities, error: fetchError } = await supabase
      .from('nickname_affinity')
      .select('id, nickname, times_used, comfort_score, user_reaction, is_active, last_used_at')
      .eq('user_id', user.id)
      .order('comfort_score', { ascending: false });

    if (fetchError) {
      console.error('Failed to fetch nickname affinities:', fetchError);
      return jsonNoStore(
        { error: 'Failed to fetch nickname affinities.' },
        { status: 500 }
      )
    }

    // 3. Fetch current relationship state
    const relationship = await getRelationshipState(user.id);

    return jsonNoStore({
      affinities: affinities || [],
      relationship
    })
  } catch (error: unknown) {
    console.error('GET /api/nicknames failed:', error)
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
    const { nickname, reaction } = body

    if (!nickname || !reaction) {
      return jsonNoStore(
        { error: 'Nickname and reaction are required.' },
        { status: 400 }
      )
    }

    const validReactions = ['love', 'okay', 'dislike']
    if (!validReactions.includes(reaction)) {
      return jsonNoStore(
        { error: 'Invalid reaction. Supported reactions: love, okay, dislike.' },
        { status: 400 }
      )
    }

    // 3. Update affinity in database for user.id
    await updateNicknameAffinity(user.id, nickname, reaction)

    return jsonNoStore({
      success: true
    })
  } catch (error: unknown) {
    console.error('POST /api/nicknames/react failed:', error)
    return jsonNoStore(
      { error: error instanceof Error ? error.message : 'An unexpected error occurred.' },
      { status: 500 }
    )
  }
}
