import { NextRequest, NextResponse, after } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { classifyOptions, generateReinforcement, generateReinforcementWithReasoning } from '@/utils/gemini'
import { analyzeAndLogObservations } from '@/lib/hup/analyzer'
import { analyzeAndDistillMemories } from '@/lib/memory/distiller'
import { MunchContextBuilder } from '@/lib/context/builder'
import { selectNickname } from '@/lib/nickname/service'

// Type definition for preference scores from database
interface PreferenceRow {
  tag: string
  score: number
  category: string
}

// Diagnostic logger helper
function logStage(stage: string, status: 'STARTED' | 'SUCCESS' | 'FAILED', details?: any) {
  const timestamp = new Date().toISOString()
  const prefix = status === 'STARTED' ? '🔵' : status === 'SUCCESS' ? '✅' : '❌'
  console.log(`${prefix} [DECISION-API] [${timestamp}] ${stage}: ${status}`, details ? JSON.stringify(details, null, 2) : '')
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  let currentStage = 'INIT'

  try {
    // ── STAGE 1: Authentication ──
    currentStage = '1-AUTH'
    logStage(currentStage, 'STARTED')
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      logStage(currentStage, 'FAILED', { reason: 'No authenticated user' })
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in to create decisions.' },
        { status: 401 }
      )
    }
    logStage(currentStage, 'SUCCESS', { user_id: user.id })

    // ── STAGE 2: Parse & Validate Payload ──
    currentStage = '2-PARSE-PAYLOAD'
    logStage(currentStage, 'STARTED')
    const body = await request.json()
    const { options, importance } = body

    if (!options || !Array.isArray(options) || options.length < 2) {
      logStage(currentStage, 'FAILED', { reason: 'Less than 2 options', options })
      return NextResponse.json(
        { error: 'Please provide at least 2 options.' },
        { status: 400 }
      )
    }

    // Validate options lengths and formats
    for (const opt of options) {
      if (typeof opt !== 'string' || !opt.trim()) {
        logStage(currentStage, 'FAILED', { reason: 'Non-string or empty option', opt })
        return NextResponse.json(
          { error: 'All options must be non-empty strings.' },
          { status: 400 }
        )
      }
      if (opt.length > 200) {
        logStage(currentStage, 'FAILED', { reason: 'Option over 200 chars', length: opt.length })
        return NextResponse.json(
          { error: 'Each option must be under 200 characters.' },
          { status: 400 }
        )
      }
    }

    const trimmedOptions = options.map((o: string) => o.trim())
    logStage(currentStage, 'SUCCESS', { option_count: trimmedOptions.length, importance })

    // ── STAGE 3: AI Classification ──
    currentStage = '3-AI-CLASSIFY'
    logStage(currentStage, 'STARTED')
    const classification = await classifyOptions(trimmedOptions)
    const category = classification.category
    logStage(currentStage, 'SUCCESS', { category, options_classified: classification.options.length })

    // ── STAGE 4: Fetch User Preferences ──
    currentStage = '4-FETCH-PREFERENCES'
    logStage(currentStage, 'STARTED')
    const { data: preferencesData, error: prefsError } = await supabase
      .from('preferences')
      .select('tag, score, category')
      .eq('user_id', user.id)
      .eq('category', category)

    if (prefsError) {
      logStage(currentStage, 'FAILED', { error: prefsError.message, code: prefsError.code })
      console.error('Failed to fetch preferences:', prefsError)
    } else {
      logStage(currentStage, 'SUCCESS', { preferences_count: preferencesData?.length || 0 })
    }

    const preferencesList: PreferenceRow[] = (preferencesData || []) as PreferenceRow[]

    // Map preferences into lookup dictionary
    const preferenceMap: Record<string, number> = {}
    preferencesList.forEach((pref) => {
      preferenceMap[pref.tag.toLowerCase()] = Number(pref.score)
    })

    // ── STAGE 5: Weighted Selection ──
    currentStage = '5-WEIGHTED-SELECTION'
    logStage(currentStage, 'STARTED')
    const optionsWithWeights = classification.options.map((opt) => {
      let weightBonus = 0
      
      opt.tags.forEach((tag) => {
        const tagLower = tag.toLowerCase()
        if (preferenceMap[tagLower] !== undefined) {
          weightBonus += preferenceMap[tagLower]
        }
      })

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
    logStage(currentStage, 'SUCCESS', { selected: selectedOption.text, weight: selectedOption.weight })

    // ── STAGE 6: Fetch Recent Decisions (non-blocking on error) ──
    currentStage = '6-FETCH-RECENT-DECISIONS'
    logStage(currentStage, 'STARTED')
    let recentDecisions: any[] = []
    try {
      const { data } = await supabase
        .from('decisions')
        .select('id, selected_option, category')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5)
      recentDecisions = data || []
      logStage(currentStage, 'SUCCESS', { recent_count: recentDecisions.length })
    } catch (err) {
      logStage(currentStage, 'FAILED', { error: err instanceof Error ? err.message : String(err) })
    }

    const pastDecisionsText = recentDecisions
      ?.map((d: any) => `Option "${d.selected_option}" in ${d.category}`)
      .join(', ') || ''

    // Fetch user feedback on recent decisions
    let feedbackHistoryText = ''
    if (recentDecisions && recentDecisions.length > 0) {
      try {
        const { data: recentFeedback } = await supabase
          .from('feedback')
          .select('decision_id, rating')
          .in('decision_id', recentDecisions.map((d: any) => d.id))

        if (recentFeedback && recentFeedback.length > 0) {
          feedbackHistoryText = recentFeedback
            .map((f: any) => {
              const dec = recentDecisions.find((d: any) => d.id === f.decision_id)
              return `User rated the pick "${dec?.selected_option}" as "${f.rating}"`
            })
            .join(', ')
        }
      } catch (err) {
        console.warn('Feedback fetch warning (non-blocking):', err)
      }
    }

    const userPreferencesText = preferencesList
      .map((p) => `tag: "${p.tag}" (score: ${p.score})`)
      .join(', ')

    // Parse optional context/mood from request body
    const emotionalState = body.emotionalState || ''
    const currentContext = body.currentContext || ''

    // ── STAGE 6b: Resolve Nickname ──
    currentStage = '6b-SELECT-NICKNAME'
    logStage(currentStage, 'STARTED')
    let activeNickname = 'friend'
    try {
      activeNickname = await selectNickname(user.id)
      logStage(currentStage, 'SUCCESS', { activeNickname })
    } catch (nickErr) {
      logStage(currentStage, 'FAILED', { error: nickErr instanceof Error ? nickErr.message : String(nickErr) })
    }

    const userName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'friend'

    // ── STAGE 7: Context Builder + Orchestration ──
    // CRITICAL: This is wrapped in try-catch so cognitive layer failures
    // don't block the core decision flow.
    currentStage = '7-CONTEXT-BUILDER'
    logStage(currentStage, 'STARTED')
    let reasoningPackage: any = null
    try {
      const contextBuilder = new MunchContextBuilder()
      reasoningPackage = await contextBuilder.buildContextAndOrchestrate({
        user_id: user.id,
        user_input: selectedOption.text,
        options: trimmedOptions,
        importance,
        emotional_state: emotionalState,
        current_context: currentContext
      })
      logStage(currentStage, 'SUCCESS', {
        observations_count: reasoningPackage?.observations?.length || 0,
        conflicts_count: reasoningPackage?.conflicts?.length || 0
      })
    } catch (contextErr) {
      logStage(currentStage, 'FAILED', {
        error: contextErr instanceof Error ? contextErr.message : String(contextErr),
        stack: contextErr instanceof Error ? contextErr.stack?.split('\n').slice(0, 5) : undefined
      })
      // Context builder failure is non-blocking — we proceed with fallback reinforcement
    }

    // ── STAGE 8: Generate Reinforcement ──
    currentStage = '8-GENERATE-REINFORCEMENT'
    logStage(currentStage, 'STARTED')
    let reinforcement: any
    if (reasoningPackage) {
      reinforcement = await generateReinforcementWithReasoning(
        reasoningPackage,
        selectedOption.text,
        category,
        activeNickname,
        userName
      )
    } else {
      // Fallback: use basic reinforcement without reasoning package
      reinforcement = await generateReinforcement(
        selectedOption.text,
        category,
        {
          importance,
          emotionalState,
          currentContext,
          userPreferences: userPreferencesText,
          pastDecisions: pastDecisionsText,
          feedbackHistory: feedbackHistoryText,
          userNickname: activeNickname,
          userName
        }
      )
    }
    logStage(currentStage, 'SUCCESS', {
      mascot: reinforcement.mascot,
      has_reasoning: !!reinforcement.reasoning,
      has_encouragement: !!reinforcement.encouragement
    })

    // ── STAGE 9: Insert Decision Record ──
    currentStage = '9-INSERT-DECISION'
    logStage(currentStage, 'STARTED')

    const insertPayload = {
      user_id: user.id,
      category: category,
      selected_option: selectedOption.text,
      reinforcement_message: `${reinforcement.reasoning || ''} ${reinforcement.encouragement || ''}`.trim(),
      reasoning: reinforcement.reasoning || null,
      encouragement: reinforcement.encouragement || null,
      follow_up_question: reinforcement.follow_up_question || null,
      mascot: reinforcement.mascot || 'munch',
      importance: importance || null,
      nickname_snapshot: activeNickname
    }

    logStage(currentStage, 'STARTED', {
      insert_columns: Object.keys(insertPayload),
      user_id: insertPayload.user_id,
      category: insertPayload.category,
      selected_option_length: insertPayload.selected_option?.length,
      reinforcement_message_length: insertPayload.reinforcement_message?.length,
      has_reasoning: !!insertPayload.reasoning,
      has_encouragement: !!insertPayload.encouragement,
      has_follow_up: !!insertPayload.follow_up_question,
      mascot: insertPayload.mascot,
      importance: insertPayload.importance
    })

    const { data: decisionRecord, error: decisionError } = await supabase
      .from('decisions')
      .insert(insertPayload)
      .select()
      .single()

    if (decisionError) {
      logStage(currentStage, 'FAILED', {
        error_message: decisionError.message,
        error_code: decisionError.code,
        error_details: decisionError.details,
        error_hint: decisionError.hint,
        error_full: JSON.stringify(decisionError)
      })
      return NextResponse.json(
        { error: 'Failed to record decision.', debug_stage: currentStage, debug_error: decisionError.message, debug_code: decisionError.code },
        { status: 500 }
      )
    }
    logStage(currentStage, 'SUCCESS', { decision_id: decisionRecord.id })

    // ── STAGE 10: Insert Options Records ──
    currentStage = '10-INSERT-OPTIONS'
    logStage(currentStage, 'STARTED')
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
      logStage(currentStage, 'FAILED', {
        error_message: optionsError.message,
        error_code: optionsError.code
      })
      console.error('Failed to insert options records:', optionsError)
    } else {
      logStage(currentStage, 'SUCCESS', { options_inserted: optionsPayload.length })
    }

    // ── STAGE 11: HUPS + Memory Async (non-blocking via after()) ──
    currentStage = '11-ASYNC-ANALYSIS'
    logStage(currentStage, 'STARTED')
    const decisionPayload = {
      selected_option: selectedOption.text,
      category,
      options: trimmedOptions,
      importance,
      currentContext,
      emotionalState
    };
    after(async () => {
      await Promise.allSettled([
        analyzeAndLogObservations(user.id, 'decision', decisionRecord.id, decisionPayload)
          .then(() => logStage('11a-HUPS-ANALYSIS', 'SUCCESS'))
          .catch((err) => {
            logStage('11a-HUPS-ANALYSIS', 'FAILED', { error: err instanceof Error ? err.message : String(err) })
            console.error('HUPS Decision Analysis error:', err)
          }),
        analyzeAndDistillMemories(user.id, 'decision', decisionRecord.id, decisionPayload)
          .then(() => logStage('11b-MEMORY-DISTILL', 'SUCCESS'))
          .catch((err) => {
            logStage('11b-MEMORY-DISTILL', 'FAILED', { error: err instanceof Error ? err.message : String(err) })
            console.error('Memory Distillation error:', err)
          })
      ]);
    });
    logStage(currentStage, 'SUCCESS', { note: 'Dispatched async tasks with after()' })

    // ── STAGE 12: Return Response ──
    currentStage = '12-RESPONSE'
    const elapsed = Date.now() - startTime
    logStage(currentStage, 'SUCCESS', { elapsed_ms: elapsed, decision_id: decisionRecord.id })

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
  } catch (error: unknown) {
    const elapsed = Date.now() - startTime
    logStage(`OUTER-CATCH (last_stage: ${currentStage})`, 'FAILED', {
      error_message: error instanceof Error ? error.message : String(error),
      error_stack: error instanceof Error ? error.stack?.split('\n').slice(0, 8) : undefined,
      elapsed_ms: elapsed
    })
    console.error('POST /api/decisions failed with error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'An unexpected error occurred.',
        debug_stage: currentStage,
        debug_elapsed_ms: elapsed
      },
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
      .select('id, category, selected_option, reinforcement_message, reasoning, encouragement, follow_up_question, mascot, importance, created_at', { count: 'exact' })
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

    interface MergedOption {
      text: string
      isSelected: boolean
      weight: number
      tags: string[]
    }

    // 6. Map options and feedback to decisions
    const optionsMap: Record<string, MergedOption[]> = {}
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
      importance: d.importance || null,
      createdAt: d.created_at,
      options: optionsMap[d.id] || [],
      rating: feedbackMap[d.id] || null,
    }))

    return NextResponse.json({
      decisions: mergedDecisions,
      total: count || 0,
    })
  } catch (error: unknown) {
    console.error('GET /api/decisions failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An unexpected error occurred.' },
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
  } catch (error: unknown) {
    console.error('DELETE /api/decisions failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An unexpected error occurred.' },
      { status: 500 }
    )
  }
}
