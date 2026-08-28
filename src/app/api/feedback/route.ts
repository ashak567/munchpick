import { NextRequest, NextResponse, after } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { calculateNewScore, type FeedbackRating } from '@/utils/preferences'
import { analyzeAndLogObservations } from '@/lib/hup/analyzer'
import { analyzeAndDistillMemories } from '@/lib/memory/distiller'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 1. Authenticate user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in to submit feedback.' },
        { status: 401 }
      )
    }

    // 2. Parse and validate body parameters
    const body = await request.json()
    const { decisionId, rating } = body

    if (!decisionId || !rating) {
      return NextResponse.json(
        { error: 'decisionId and rating are required.' },
        { status: 400 }
      )
    }

    const validRatings: FeedbackRating[] = ['love', 'okay', 'meh']
    if (!validRatings.includes(rating as FeedbackRating)) {
      return NextResponse.json(
        { error: 'Invalid rating. Supported ratings: love, okay, meh.' },
        { status: 400 }
      )
    }

    // 3. Fetch decision record and check ownership
    const { data: decision, error: decisionError } = await supabase
      .from('decisions')
      .select('id, user_id, category, selected_option, importance, nickname_snapshot')
      .eq('id', decisionId)
      .single()

    if (decisionError || !decision) {
      return NextResponse.json(
        { error: 'Decision not found.' },
        { status: 404 }
      )
    }

    if (decision.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Access denied. You do not own this decision.' },
        { status: 403 }
      )
    }

    // 4. Save feedback (upsert or insert)
    // Check if feedback already exists for this decision
    const { data: existingFeedback } = await supabase
      .from('feedback')
      .select('id')
      .eq('decision_id', decisionId)
      .single()

    if (existingFeedback) {
      return NextResponse.json(
        { error: 'Feedback already submitted for this decision.' },
        { status: 409 }
      )
    }

    const { data: feedbackRecord, error: feedbackError } = await supabase
      .from('feedback')
      .insert({
        decision_id: decisionId,
        rating,
      })
      .select()
      .single()

    if (feedbackError) {
      console.error('Failed to save feedback:', feedbackError)
      return NextResponse.json(
        { error: 'Failed to record feedback.' },
        { status: 500 }
      )
    }

    // Update nickname affinity if a nickname snapshot was used
    if (decision.nickname_snapshot) {
      try {
        const { updateNicknameAffinity } = await import('@/lib/nickname/service')
        let reaction: 'love' | 'okay' | 'dislike' = 'okay'
        if (rating === 'love') reaction = 'love'
        else if (rating === 'meh') reaction = 'dislike'
        
        await updateNicknameAffinity(user.id, decision.nickname_snapshot, reaction)
      } catch (nickErr) {
        console.error('Failed to update nickname affinity from feedback:', nickErr)
      }
    }

    // 5. Query the selected option to fetch its tags
    const { data: optionsData, error: optionsError } = await supabase
      .from('options')
      .select('tags')
      .eq('decision_id', decisionId)
      .eq('option_text', decision.selected_option)
      .single()

    if (optionsError) {
      console.error('Failed to fetch option tags:', optionsError)
    }

    const selectedOptionTags: string[] = optionsData?.tags || []

    if (selectedOptionTags.length > 0) {
      // Normalize tags upfront
      const normalizedTags = selectedOptionTags
        .map((t) => t.trim().toLowerCase())
        .filter((t) => t.length > 0)

      if (normalizedTags.length > 0) {
        // Batch SELECT: fetch all existing preference scores in one query
        const { data: existingPrefs } = await supabase
          .from('preferences')
          .select('tag, score')
          .eq('user_id', user.id)
          .eq('category', decision.category)
          .in('tag', normalizedTags)

        // Build a lookup map from existing scores
        const scoreMap: Record<string, number> = {}
        existingPrefs?.forEach((pref) => {
          scoreMap[pref.tag] = Number(pref.score)
        })

        // Compute new scores and build bulk upsert payload
        const now = new Date().toISOString()
        const upsertPayload = normalizedTags.map((tag) => {
          const currentScore = scoreMap[tag] ?? 0.0
          const newScore = calculateNewScore(currentScore, rating as FeedbackRating)
          return {
            user_id: user.id,
            category: decision.category,
            tag,
            score: newScore,
            updated_at: now,
          }
        })

        // Batch UPSERT: write all preference updates in one query
        const { error: upsertError } = await supabase
          .from('preferences')
          .upsert(upsertPayload, {
            onConflict: 'user_id,category,tag',
          })

        if (upsertError) {
          console.error('Failed to bulk upsert preferences:', upsertError)
        }
      }
    }

    // Trigger HUPS Analysis asynchronously via after() (non-blocking)
    const feedbackPayload = {
      decision: {
        selected_option: decision.selected_option,
        category: decision.category,
        importance: decision.importance
      },
      rating: rating,
      tags: selectedOptionTags
    };
    after(async () => {
      await Promise.allSettled([
        analyzeAndLogObservations(user.id, 'feedback', feedbackRecord.id, feedbackPayload)
          .catch((err) => console.error('HUPS Feedback Analysis error:', err)),
        analyzeAndDistillMemories(user.id, 'feedback', feedbackRecord.id, feedbackPayload)
          .catch((err) => console.error('Memory Distillation error:', err))
      ]);
    });

    return NextResponse.json({
      success: true,
      feedback: feedbackRecord,
    })
  } catch (error: unknown) {
    console.error('POST /api/feedback failed with error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An unexpected error occurred.' },
      { status: 500 }
    )
  }
}
