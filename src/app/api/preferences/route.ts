import { createClient } from '@/utils/supabase/server'
import { jsonNoStore } from '@/lib/api-headers'

export async function GET() {
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

    // 2. Fetch category and importance distribution
    // Fetch user's decisions category and importance stats
    const { data: categoryStats, error: catError } = await supabase
      .from('decisions')
      .select('category, importance')
      .eq('user_id', user.id)

    if (catError) {
      console.error('Failed to fetch category stats:', catError)
    }

    const categoryDistribution: Record<string, number> = {
      Food: 0,
      Entertainment: 0,
      Activities: 0,
      Shopping: 0,
      Other: 0,
    }
    const importanceDistribution: Record<string, number> = {}

    categoryStats?.forEach((d) => {
      if (d.category in categoryDistribution) {
        categoryDistribution[d.category]++
      } else {
        categoryDistribution[d.category] = (categoryDistribution[d.category] || 0) + 1
      }

      if (d.importance) {
        importanceDistribution[d.importance] = (importanceDistribution[d.importance] || 0) + 1
      }
    })

    const totalDecisions = categoryStats?.length || 0

    // 3. Fetch satisfaction breakdown (feedback ratings)
    // We join decisions and feedback, filtering by user_id
    const { data: feedbackStats, error: feedError } = await supabase
      .from('feedback')
      .select('rating, decisions!inner(user_id)')
      .eq('decisions.user_id', user.id)

    if (feedError) {
      console.error('Failed to fetch feedback stats:', feedError)
    }

    const satisfactionBreakdown = {
      love: 0,
      okay: 0,
      meh: 0,
    }

    interface FeedbackStatRow {
      rating: string
      decisions: {
        user_id: string
      }
    }

    const typedFeedbackStats = (feedbackStats || []) as unknown as FeedbackStatRow[]
    typedFeedbackStats.forEach((f) => {
      const rating = f.rating as 'love' | 'okay' | 'meh'
      if (rating in satisfactionBreakdown) {
        satisfactionBreakdown[rating]++
      }
    })

    const totalFeedback = feedbackStats?.length || 0

    // 4. Fetch top tag preference scores
    const { data: preferences, error: prefError } = await supabase
      .from('preferences')
      .select('category, tag, score')
      .eq('user_id', user.id)
      .order('score', { ascending: false })
      .limit(15)

    if (prefError) {
      console.error('Failed to fetch preferences:', prefError)
    }

    return jsonNoStore({
      totalDecisions,
      categoryDistribution,
      satisfactionBreakdown,
      totalFeedback,
      preferences: preferences || [],
      importanceDistribution,
    })
  } catch (error: unknown) {
    console.error('GET /api/preferences failed:', error)
    return jsonNoStore(
      { error: error instanceof Error ? error.message : 'An unexpected error occurred.' },
      { status: 500 }
    )
  }
}
