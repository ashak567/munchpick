import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { classifyOptions, generateReinforcement, type Category } from '@/utils/gemini'

// Type definition for preference scores from database
interface PreferenceRow {
  tag: string
  score: number
  category: string
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
        { error: 'Unauthorized. Please sign in to create decisions.' },
        { status: 401 }
      )
    }

    // 2. Parse and validate options list
    const body = await request.json()
    const { options } = body

    if (!options || !Array.isArray(options) || options.length < 2) {
      return NextResponse.json(
        { error: 'Please provide at least 2 options.' },
        { status: 400 }
      )
    }

    // Validate options lengths and formats
    for (const opt of options) {
      if (typeof opt !== 'string' || !opt.trim()) {
        return NextResponse.json(
          { error: 'All options must be non-empty strings.' },
          { status: 400 }
        )
      }
      if (opt.length > 200) {
        return NextResponse.json(
          { error: 'Each option must be under 200 characters.' },
          { status: 400 }
        )
      }
    }

    const trimmedOptions = options.map(o => o.trim())

    // 3. AI Category Detection & Tag Extraction (Task 3.2)
    const classification = await classifyOptions(trimmedOptions)
    const category = classification.category

    // 4. Retrieve User Preferences
    // Fetch preference scores matching this category for the authenticated user
    const { data: preferencesData, error: prefsError } = await supabase
      .from('preferences')
      .select('tag, score, category')
      .eq('user_id', user.id)
      .eq('category', category)

    const preferencesList: PreferenceRow[] = (preferencesData || []) as PreferenceRow[]

    // Map preferences into lookup dictionary
    const preferenceMap: Record<string, number> = {}
    preferencesList.forEach((pref) => {
      // Index by tag
      preferenceMap[pref.tag.toLowerCase()] = Number(pref.score)
    })

    // 5. Run Weighted Selection Algorithm (Task 3.4)
    // Compute weights for each option
    const optionsWithWeights = classification.options.map((opt) => {
      let weightBonus = 0
      
      // Look up preference score adjustments for each tag
      opt.tags.forEach((tag) => {
        const tagLower = tag.toLowerCase()
        if (preferenceMap[tagLower] !== undefined) {
          weightBonus += preferenceMap[tagLower]
        }
      })

      // Calculate final weight with a floor of 0.2 to ensure no option has zero probability
      const finalWeight = Math.max(0.2, 1.0 + weightBonus)

      return {
        ...opt,
        weight: finalWeight,
      }
    })

    // Weighted random sampling
    const sumOfWeights = optionsWithWeights.reduce((acc, opt) => acc + opt.weight, 0)
    let randomThreshold = Math.random() * sumOfWeights
    let selectedIdx = 0

    for (let i = 0; i < optionsWithWeights.length; i++) {
      randomThreshold -= optionsWithWeights[i].weight
      if (randomThreshold <= 0) {
        selectedIdx = i
        break
      }
    }

    const selectedOption = optionsWithWeights[selectedIdx]

    // Fetch user's recent decisions to provide context for the personality engine
    const { data: recentDecisions } = await supabase
      .from('decisions')
      .select('id, selected_option, category')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5)

    const pastDecisionsText = recentDecisions
      ?.map((d) => `Option "${d.selected_option}" in ${d.category}`)
      .join(', ') || ''

    // Fetch user feedback on recent decisions
    let feedbackHistoryText = ''
    if (recentDecisions && recentDecisions.length > 0) {
      const { data: recentFeedback } = await supabase
        .from('feedback')
        .select('decision_id, rating')
        .in('decision_id', recentDecisions.map((d) => d.id))

      if (recentFeedback && recentFeedback.length > 0) {
        feedbackHistoryText = recentFeedback
          .map((f) => {
            const dec = recentDecisions.find((d) => d.id === f.decision_id)
            return `User rated the pick "${dec?.selected_option}" as "${f.rating}"`
          })
          .join(', ')
      }
    }

    const userPreferencesText = preferencesList
      .map((p) => `tag: "${p.tag}" (score: ${p.score})`)
      .join(', ')

    // Parse optional context/mood from request body
    const emotionalState = body.emotionalState || ''
    const currentContext = body.currentContext || ''

    // 6. AI Positive Reinforcement Generation (Munch Personality Engine)
    const reinforcement = await generateReinforcement(selectedOption.text, category, {
      emotionalState,
      currentContext,
      userPreferences: userPreferencesText,
      pastDecisions: pastDecisionsText,
      feedbackHistory: feedbackHistoryText,
    })

    // 7. Save Decision to Database (Task 3.3)
    // Insert decision record
    const { data: decisionRecord, error: decisionError } = await supabase
      .from('decisions')
      .insert({
        user_id: user.id,
        category: category,
        selected_option: selectedOption.text,
        reinforcement_message: `${reinforcement.reasoning} ${reinforcement.encouragement}`,
        reasoning: reinforcement.reasoning,
        encouragement: reinforcement.encouragement,
        follow_up_question: reinforcement.follow_up_question,
        mascot: reinforcement.mascot || 'munch',
      })
      .select()
      .single()

    if (decisionError) {
      console.error('Failed to insert decision record:', decisionError)
      return NextResponse.json(
        { error: 'Failed to record decision.' },
        { status: 500 }
      )
    }

    // Insert options records
    const optionsPayload = optionsWithWeights.map((opt) => ({
      decision_id: decisionRecord.id,
      option_text: opt.text,
      is_selected: opt.text === selectedOption.text,
      weight: opt.weight,
      tags: opt.tags,
    }))

    const { error: optionsError } = await supabase
      .from('options')
      .insert(optionsPayload)

    if (optionsError) {
      console.error('Failed to insert options records:', optionsError)
      // Non-blocking but warn: we won't crash the response since the decision is saved
    }

    // 8. Return Response JSON
    return NextResponse.json({
      id: decisionRecord.id,
      category: category,
      selectedOption: {
        text: selectedOption.text,
        tags: selectedOption.tags,
      },
      mascot: decisionRecord.mascot || reinforcement.mascot || 'munch',
      reinforcement: {
        selected_option: reinforcement.selected_option,
        reasoning: reinforcement.reasoning,
        encouragement: reinforcement.encouragement,
        follow_up_question: reinforcement.follow_up_question,
        mascot: reinforcement.mascot || 'munch',
        // Compatibility fields for any legacy frontend code
        reasons: [reinforcement.reasoning],
        message: reinforcement.encouragement,
      },
    })
  } catch (error: any) {
    console.error('POST /api/decisions failed with error:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred.' },
      { status: 500 }
    )
  }
}

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

    // 2. Parse query parameters for pagination
    const searchParams = request.nextUrl.searchParams
    const limit = Math.max(1, Math.min(100, Number(searchParams.get('limit') || '10')))
    const offset = Math.max(0, Number(searchParams.get('offset') || '0'))

    // 3. Fetch decisions paginated
    const { data: decisions, error: decisionsError, count } = await supabase
      .from('decisions')
      .select('id, category, selected_option, reinforcement_message, reasoning, encouragement, follow_up_question, mascot, created_at', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (decisionsError) {
      console.error('Failed to fetch decisions:', decisionsError)
      return NextResponse.json(
        { error: 'Failed to fetch decisions.' },
        { status: 500 }
      )
    }

    if (!decisions || decisions.length === 0) {
      return NextResponse.json({
        decisions: [],
        total: count || 0,
      })
    }

    const decisionIds = decisions.map(d => d.id)

    // 4. Fetch options for these decisions
    const { data: optionsData, error: optionsError } = await supabase
      .from('options')
      .select('decision_id, option_text, is_selected, weight, tags')
      .in('decision_id', decisionIds)

    if (optionsError) {
      console.error('Failed to fetch options:', optionsError)
    }

    // 5. Fetch feedback for these decisions
    const { data: feedbackData, error: feedbackError } = await supabase
      .from('feedback')
      .select('decision_id, rating')
      .in('decision_id', decisionIds)

    if (feedbackError) {
      console.error('Failed to fetch feedback:', feedbackError)
    }

    // 6. Map options and feedback to decisions
    const optionsMap: Record<string, any[]> = {}
    const feedbackMap: Record<string, string> = {}

    optionsData?.forEach((opt) => {
      if (!optionsMap[opt.decision_id]) {
        optionsMap[opt.decision_id] = []
      }
      optionsMap[opt.decision_id].push({
        text: opt.option_text,
        isSelected: opt.is_selected,
        weight: opt.weight,
        tags: opt.tags,
      })
    })

    feedbackData?.forEach((feed) => {
      feedbackMap[feed.decision_id] = feed.rating
    })

    const mergedDecisions = decisions.map((d) => ({
      id: d.id,
      category: d.category,
      selectedOption: d.selected_option,
      reinforcementMessage: d.reinforcement_message,
      reasoning: d.reasoning,
      encouragement: d.encouragement,
      followUpQuestion: d.follow_up_question,
      mascot: d.mascot || 'munch',
      createdAt: d.created_at,
      options: optionsMap[d.id] || [],
      rating: feedbackMap[d.id] || null,
    }))

    return NextResponse.json({
      decisions: mergedDecisions,
      total: count || 0,
    })
  } catch (error: any) {
    console.error('GET /api/decisions failed:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred.' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
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

    // 2. Parse query parameter
    const searchParams = request.nextUrl.searchParams
    const decisionId = searchParams.get('id')

    if (!decisionId) {
      return NextResponse.json(
        { error: 'id parameter is required.' },
        { status: 400 }
      )
    }

    // 3. Delete decision (cascade will delete options and feedback)
    const { error: deleteError } = await supabase
      .from('decisions')
      .delete()
      .eq('id', decisionId)
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('Failed to delete decision:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete decision.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Decision deleted successfully.',
    })
  } catch (error: any) {
    console.error('DELETE /api/decisions failed:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred.' },
      { status: 500 }
    )
  }
}
