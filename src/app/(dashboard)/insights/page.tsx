'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  BarChart3, 
  Sparkles, 
  ArrowRight,
  TrendingUp,
  Heart,
  Smile,
  Meh,
  Unlock,
  AlertTriangle
} from 'lucide-react'

interface PreferenceItem {
  category: string
  tag: string
  score: number
}

interface InsightsData {
  totalDecisions: number
  categoryDistribution: Record<string, number>
  satisfactionBreakdown: {
    love: number
    okay: number
    meh: number
  }
  totalFeedback: number
  preferences: PreferenceItem[]
}

const CATEGORY_STYLE: Record<string, { emoji: string; bg: string; fill: string; border: string }> = {
  Food: { emoji: '🍕', bg: 'bg-primary/20', fill: 'bg-primary', border: 'border-primary-dark/20' },
  Entertainment: { emoji: '🍿', bg: 'bg-secondary/20', fill: 'bg-secondary', border: 'border-secondary-dark/20' },
  Activities: { emoji: '🏃‍♂️', bg: 'bg-yellow/20', fill: 'bg-yellow', border: 'border-yellow-700/20' },
  Shopping: { emoji: '🛍️', bg: 'bg-coral/20', fill: 'bg-coral', border: 'border-coral-dark/20' },
  Other: { emoji: '🍀', bg: 'bg-white/60', fill: 'bg-charcoal/30', border: 'border-charcoal/10' }
}

export default function InsightsPage() {
  const router = useRouter()
  
  // State
  const [data, setData] = useState<InsightsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    const fetchInsights = async () => {
      try {
        setLoading(true)
        const res = await fetch('/api/preferences')
        if (!res.ok) {
          throw new Error('Failed to load preferences statistics')
        }
        const parsed = await res.json()
        setData(parsed)
      } catch (err: any) {
        console.error(err)
        setErrorMsg(err.message || 'Unable to retrieve insights.')
      } finally {
        setLoading(false)
      }
    }

    fetchInsights()
  }, [])

  if (loading) {
    return (
      <div className="flex-grow flex flex-col items-center justify-center py-16 space-y-3">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-2xs text-charcoal/50">Analyzing decision patterns...</span>
      </div>
    )
  }

  if (errorMsg || !data) {
    return (
      <div className="flex-grow flex flex-col items-center justify-center text-center p-4">
        <AlertTriangle className="w-10 h-10 text-red-500 mb-2" />
        <p className="text-xs text-charcoal/60">
          {errorMsg || 'Failed to load insights. Please try again.'}
        </p>
      </div>
    )
  }

  const { totalDecisions, categoryDistribution, satisfactionBreakdown, totalFeedback, preferences } = data

  // 1. GATE CHECK: Minimum 5 decisions required
  if (totalDecisions < 5) {
    const progressPercent = Math.min(100, (totalDecisions / 5) * 100)
    return (
      <div className="flex-grow flex flex-col justify-between h-full space-y-6">
        <div>
          <h2 className="font-display font-extrabold text-2xl text-charcoal">
            Personal Insights
          </h2>
          <p className="text-2xs text-charcoal/60">
            Locked — Munch is still studying your preferences
          </p>
        </div>

        {/* Mascot Gate Block */}
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4 py-8">
          {/* Locked Mascot SVG */}
          <div className="w-24 h-24 mb-6 relative">
            <svg viewBox="0 0 100 100" className="w-full h-full animate-float">
              <path d="M 50 50 Q 30 30 50 10 Q 70 30 50 50 Z" fill="#D8D8D8" stroke="#B0B0B0" strokeWidth="2" />
              <path d="M 50 50 Q 70 30 90 50 Q 70 70 50 50 Z" fill="#D8D8D8" stroke="#B0B0B0" strokeWidth="2" />
              <path d="M 50 50 Q 70 70 50 90 Q 30 70 50 50 Z" fill="#D8D8D8" stroke="#B0B0B0" strokeWidth="2" />
              <path d="M 50 50 Q 30 70 10 50 Q 30 30 50 50 Z" fill="#D8D8D8" stroke="#B0B0B0" strokeWidth="2" />
              <circle cx="50" cy="50" r="8" fill="#FFF9F5" stroke="#4A4A4A" strokeWidth="2" />
              {/* Tilted eyes */}
              <path d="M 46 48 L 48 50 M 48 48 L 46 50" stroke="#4A4A4A" strokeWidth="2" strokeLinecap="round" />
              <path d="M 52 48 L 54 50 M 54 48 L 52 50" stroke="#4A4A4A" strokeWidth="2" strokeLinecap="round" />
              <path d="M 48 54 Q 50 52 52 54" fill="none" stroke="#4A4A4A" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <div className="absolute -bottom-1 -right-1 bg-secondary border border-secondary-dark rounded-full p-1.5 shadow-md">
              <Unlock className="w-4 h-4 text-secondary-dark" />
            </div>
          </div>

          <h3 className="font-display text-lg font-bold text-charcoal mb-2">
            Munch needs more choices!
          </h3>
          <p className="text-xs text-charcoal/50 max-w-xs leading-relaxed mb-6">
            Munch requires at least <strong>5 decisions</strong> to analyze tag preferences and map your categories. Make a few more decisions to unlock!
          </p>

          {/* Progress bar */}
          <div className="w-full max-w-xs space-y-1.5 mb-8">
            <div className="flex justify-between text-3xs font-black tracking-wider text-charcoal/40 uppercase">
              <span>UNLOCKED PROGRESS</span>
              <span>{totalDecisions} / 5 DECISIONS</span>
            </div>
            <div className="h-3 w-full bg-charcoal/5 border border-charcoal/10 rounded-full overflow-hidden p-0.5">
              <div 
                className="h-full bg-primary rounded-full transition-all duration-500 shadow-sm"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          <button
            onClick={() => router.push('/dashboard/new')}
            className="px-6 py-3.5 btn-clay-primary text-xs flex items-center justify-center gap-2 cursor-pointer transition-all shadow-sm"
          >
            Create a Decision
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div>
          <button
            onClick={() => router.push('/dashboard')}
            className="w-full py-3.5 border-2 border-charcoal/10 rounded-2xl bg-white hover:bg-charcoal/5 text-charcoal font-semibold text-sm transition-all cursor-pointer"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  // 2. RENDERING INSIGHTS SCREEN
  const maxCategoryCount = Math.max(...Object.values(categoryDistribution), 1)
  const totalRatings = satisfactionBreakdown.love + satisfactionBreakdown.okay + satisfactionBreakdown.meh
  const lovePct = totalRatings > 0 ? (satisfactionBreakdown.love / totalRatings) * 100 : 0
  const okayPct = totalRatings > 0 ? (satisfactionBreakdown.okay / totalRatings) * 100 : 0
  const mehPct = totalRatings > 0 ? (satisfactionBreakdown.meh / totalRatings) * 100 : 0

  return (
    <div className="flex-grow flex flex-col justify-between h-full space-y-6">
      {/* Header */}
      <div>
        <h2 className="font-display font-extrabold text-2xl text-charcoal">
          Personal Insights
        </h2>
        <p className="text-2xs text-charcoal/60 font-semibold uppercase tracking-wider text-primary-dark">
          Analyzing {totalDecisions} decisions 🍀
        </p>
      </div>

      {/* Main Stats Scrollable Container */}
      <div className="flex-1 space-y-6 max-h-[460px] overflow-y-auto pr-1">
        
        {/* Category Distribution Section */}
        <div className="glass-card rounded-2xl p-4 border border-white/50 space-y-3">
          <div className="flex items-center gap-2 text-3xs font-black tracking-widest text-charcoal/40 uppercase">
            <BarChart3 className="w-3.5 h-3.5" />
            Category Distribution
          </div>
          
          <div className="space-y-2.5">
            {Object.keys(categoryDistribution).map((category) => {
              const count = categoryDistribution[category]
              const style = CATEGORY_STYLE[category] || CATEGORY_STYLE.Other
              const pct = (count / maxCategoryCount) * 100

              return (
                <div key={category} className="space-y-1">
                  <div className="flex justify-between items-center text-xs font-semibold text-charcoal">
                    <span className="flex items-center gap-1.5">
                      <span>{style.emoji}</span>
                      <span>{category}</span>
                    </span>
                    <span className="text-charcoal/50 text-[10px]">{count} picks</span>
                  </div>
                  <div className="h-4 w-full bg-charcoal/5 border border-charcoal/5 rounded-full overflow-hidden p-0.5 relative">
                    <div 
                      className={`h-full ${style.fill} rounded-full transition-all duration-500 shadow-sm`}
                      style={{ width: count > 0 ? `${Math.max(8, pct)}%` : '0%' }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Satisfaction Level Section */}
        <div className="glass-card rounded-2xl p-4 border border-white/50 space-y-3">
          <div className="flex items-center gap-2 text-3xs font-black tracking-widest text-charcoal/40 uppercase">
            <TrendingUp className="w-3.5 h-3.5" />
            Decision Satisfaction
          </div>

          {totalRatings === 0 ? (
            <p className="text-3xs text-charcoal/40 text-center italic py-2">
              Leave feedback on your decisions to see satisfaction insights!
            </p>
          ) : (
            <div className="space-y-3">
              {/* Stacked Percentage Bar */}
              <div className="h-6 w-full bg-charcoal/5 border border-charcoal/5 rounded-full overflow-hidden flex p-0.5">
                {lovePct > 0 && (
                  <div \n                    className="h-full bg-primary first:rounded-l-full last:rounded-r-full shadow-inner flex items-center justify-center text-[10px] font-black text-primary-dark"
                    style={{ width: `${lovePct}%` }}
                    title={`Loved: ${satisfactionBreakdown.love}`}
                  >
                    ❤️
                  </div>
                )}
                {okayPct > 0 && (
                  <div 
                    className="h-full bg-yellow first:rounded-l-full last:rounded-r-full shadow-inner flex items-center justify-center text-[10px] font-black text-yellow-700"
                    style={{ width: `${okayPct}%` }}
                    title={`Okay: ${satisfactionBreakdown.okay}`}
                  >
                    😊
                  </div>
                )}
                {mehPct > 0 && (
                  <div 
                    className="h-full bg-coral first:rounded-l-full last:rounded-r-full shadow-inner flex items-center justify-center text-[10px] font-black text-coral-dark"
                    style={{ width: `${mehPct}%` }}
                    title={`Meh: ${satisfactionBreakdown.meh}`}
                  >
                    😕
                  </div>
                )}
              </div>

              {/* Legend with percentages */}
              <div className="flex justify-around items-center pt-1 text-2xs font-semibold text-charcoal">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] p-0.5 rounded-full bg-primary/20">❤️</span>
                  <span>Loved: {lovePct.toFixed(0)}%</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] p-0.5 rounded-full bg-yellow/20">😊</span>
                  <span>Okay: {okayPct.toFixed(0)}%</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] p-0.5 rounded-full bg-coral/20">😕</span>
                  <span>Meh: {mehPct.toFixed(0)}%</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tag Preferences Scoreboard */}
        <div className="glass-card rounded-2xl p-4 border border-white/50 space-y-3">
          <div className="flex items-center gap-2 text-3xs font-black tracking-widest text-charcoal/40 uppercase">
            <Sparkles className="w-3.5 h-3.5" />
            AI Preference Learned Tags
          </div>

          {preferences.length === 0 ? (
            <p className="text-3xs text-charcoal/40 text-center italic py-4">
              Munch hasn't registered preference tags yet. Leave ratings on decisions to build tag scores!
            </p>
          ) : (
            <div className="flex flex-wrap gap-2 pt-1">
              {preferences.map((pref, index) => {
                const style = CATEGORY_STYLE[pref.category] || CATEGORY_STYLE.Other
                const isPositive = pref.score > 0
                const formattedScore = `${isPositive ? '+' : ''}${Number(pref.score).toFixed(1)}`

                return (
                  <div
                    key={index}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-transform hover:scale-105 select-none ${style.bg} ${style.border}`}
                  >\n                    <span>{style.emoji}</span>
                    <span className="text-charcoal">{pref.tag}</span>
                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                      pref.score > 0 
                        ? 'bg-primary-dark/20 text-primary-dark' 
                        : pref.score < 0 
                          ? 'bg-red-500/20 text-red-500' 
                          : 'bg-charcoal/10 text-charcoal/50'
                    }`}>
                      {formattedScore}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>

      {/* Action Footer */}
      <div>
        <button
          onClick={() => router.push('/dashboard')}
          className="w-full py-3.5 border-2 border-charcoal/10 rounded-2xl bg-white hover:bg-charcoal/5 text-charcoal font-semibold text-sm transition-all cursor-pointer shadow-sm"
        >
          Back to Dashboard
        </button>
      </div>
    </div>
  )
}
