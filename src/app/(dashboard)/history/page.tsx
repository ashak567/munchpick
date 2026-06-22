'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { 
  History, 
  Trash2, 
  ChevronDown, 
  ChevronUp, 
  Check, 
  Calendar,
  Sparkles,
  AlertTriangle,
  ArrowRight,
  Smile,
  Heart,
  Meh
} from 'lucide-react'
import Mascot, { type MascotCharacter } from '@/components/Mascot'

interface OptionDetail {
  text: string
  isSelected: boolean
  weight: number
  tags: string[]
}

interface DecisionHistoryItem {
  id: string
  category: string
  selectedOption: string
  reinforcementMessage: string
  createdAt: string
  options: OptionDetail[]
  rating: 'love' | 'okay' | 'meh' | null
  mascot: string
}

const CATEGORY_META: Record<string, { emoji: string; bg: string; text: string }> = {
  Food: { emoji: '🍕', bg: 'bg-primary/20', text: 'text-primary-dark' },
  Entertainment: { emoji: '🍿', bg: 'bg-secondary/20', text: 'text-secondary-dark' },
  Activities: { emoji: '🏃‍♂️', bg: 'bg-yellow/20', text: 'text-yellow-700' },
  Shopping: { emoji: '🛍️', bg: 'bg-coral/20', text: 'text-coral-dark' },
  Other: { emoji: '🍀', bg: 'bg-white/60', text: 'text-charcoal/80' }
}

const RATING_META: Record<string, { emoji: string; label: string; color: string }> = {
  love: { emoji: '❤️', label: 'Loved it', color: 'text-red-500 bg-red-50' },
  okay: { emoji: '😊', label: "It's okay", color: 'text-yellow-700 bg-yellow-50' },
  meh: { emoji: '😕', label: 'Not for me', color: 'text-coral-dark bg-coral/10' }
}

export default function HistoryPage() {
  const router = useRouter()
  
  // State
  const [decisions, setDecisions] = useState<DecisionHistoryItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)

  const limit = 10
  const observerTarget = useRef<HTMLDivElement>(null)

  // Fetch Page
  const fetchPage = useCallback(async (currentOffset: number, append = false) => {
    try {
      if (currentOffset === 0) setLoading(true)
      else setLoadingMore(true)

      const res = await fetch(`/api/decisions?limit=${limit}&offset=${currentOffset}`)
      if (!res.ok) {
        throw new Error('Failed to fetch decisions history')
      }
      const data = await res.json()
      
      if (append) {
        setDecisions(prev => [...prev, ...data.decisions])
      } else {
        setDecisions(data.decisions)
      }
      
      setTotal(data.total)
      setHasMore(currentOffset + limit < data.total)
    } catch (err: any) {
      console.error(err)
      setErrorMsg(err.message || 'Unable to load your history.')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  // Initial load
  useEffect(() => {
    fetchPage(0, false)
  }, [fetchPage])

  // Infinite scroll observer setup
  useEffect(() => {
    if (!hasMore || loading || loadingMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          const nextOffset = offset + limit
          setOffset(nextOffset)
          fetchPage(nextOffset, true)
        }
      },
      { threshold: 1.0 }
    )

    const target = observerTarget.current
    if (target) observer.observe(target)

    return () => {
      if (target) observer.unobserve(target)
    }
  }, [hasMore, loading, loadingMore, offset, fetchPage])

  // Deletion logic
  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation() // Don't trigger expand card
    if (deletingId) return

    const confirmDelete = window.confirm("Are you sure you want to delete this reflection from your history?")
    if (!confirmDelete) return

    setDeletingId(id)
    try {
      const res = await fetch(`/api/decisions?id=${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        throw new Error('Failed to delete decision')
      }
      
      // Update local list
      setDecisions(prev => prev.filter(item => item.id !== id))
      setTotal(prev => Math.max(0, prev - 1))
      if (expandedId === id) setExpandedId(null)
    } catch (err: any) {
      alert(err.message || 'Could not delete decision. Please try again.')
    } finally {
      setDeletingId(null)
    }
  }

  const toggleExpand = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id))
  }

  // Format date grouping helper
  const formatDateGroup = (dateString: string) => {
    const d = new Date(dateString)
    const today = new Date()
    const yesterday = new Date()
    yesterday.setDate(today.getDate() - 1)

    if (d.toDateString() === today.toDateString()) {
      return 'Today'
    }
    if (d.toDateString() === yesterday.toDateString()) {
      return 'Yesterday'
    }
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  }

  // Group decisions by date
  const groupDecisions = () => {
    const groups: Record<string, DecisionHistoryItem[]> = {}
    decisions.forEach((item) => {
      const groupKey = formatDateGroup(item.createdAt)
      if (!groups[groupKey]) groups[groupKey] = []
      groups[groupKey].push(item)
    })
    return groups
  }

  const grouped = groupDecisions()

  return (
    <div className="flex-grow flex flex-col justify-between h-full space-y-6">
      {/* Header */}
      <div>
        <h2 className="font-display font-extrabold text-2xl text-charcoal">
          Past Reflections
        </h2>
        <p className="text-2xs text-charcoal/60">
          A gentle history of your choices and how they felt ({total} total)
        </p>
      </div>

      {errorMsg && (
        <div className="flex items-start gap-2 bg-red-500/15 border border-red-500/30 text-red-700 rounded-xl p-3 text-2xs">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main List Area */}
      <div className="flex-1 flex flex-col justify-start">
        {loading && decisions.length === 0 ? (
          <div className="flex-grow flex flex-col items-center justify-center py-16 space-y-3">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-2xs text-charcoal/50">Retrieving past reflections...</span>
          </div>
        ) : decisions.length === 0 ? (
          /* Empty State */
          <div className="flex-grow flex flex-col items-center justify-center text-center py-16 px-4">
            <div className="w-24 h-24 mb-6">
              <svg viewBox="0 0 100 100" className="w-full h-full animate-float">
                <path d="M 50 50 Q 30 30 50 10 Q 70 30 50 50 Z" fill="#8FD9A8" stroke="#6BBF8A" strokeWidth="2" />
                <path d="M 50 50 Q 70 30 90 50 Q 70 70 50 50 Z" fill="#CDB4FF" stroke="#A98EE6" strokeWidth="2" />
                <path d="M 50 50 Q 70 70 50 90 Q 30 70 50 50 Z" fill="#FFE08A" stroke="#E6C46B" strokeWidth="2" />
                <path d="M 50 50 Q 30 70 10 50 Q 30 30 50 50 Z" fill="#FFCFB3" stroke="#E6AC8E" strokeWidth="2" />
                <circle cx="50" cy="50" r="10" fill="#FFF9F5" stroke="#4A4A4A" strokeWidth="2" />
                <circle cx="47" cy="48" r="1.5" fill="#4A4A4A" />
                <circle cx="53" cy="48" r="1.5" fill="#4A4A4A" />
                <path d="M 48 53 Q 50 55 52 53" fill="none" stroke="#4A4A4A" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <h3 className="font-display text-lg font-bold text-charcoal mb-2">No reflections yet</h3>
            <p className="text-xs text-charcoal/50 max-w-xs leading-relaxed mb-6">
              Munch is here to listen and help quiet the chatter. Let's share our first thought together.
            </p>
            <button
              onClick={() => router.push('/dashboard/new')}
              className="px-6 py-3 btn-clay-primary text-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              Share My Thoughts
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          /* List Grouped by Date */
          <div className="space-y-6 max-h-[460px] overflow-y-auto pr-1">
            {Object.keys(grouped).map((dateGroup) => (
              <div key={dateGroup} className="space-y-2.5">
                <div className="flex items-center gap-2 px-1 text-3xs font-black tracking-widest text-charcoal/40 uppercase">
                  <Calendar className="w-3 h-3" />
                  {dateGroup}
                </div>

                <div className="space-y-3">
                  {grouped[dateGroup].map((item) => {
                    const isExpanded = expandedId === item.id
                    const meta = CATEGORY_META[item.category] || CATEGORY_META.Other
                    const ratingMeta = item.rating ? RATING_META[item.rating] : null

                    return (
                      <div
                        key={item.id}
                        onClick={() => toggleExpand(item.id)}
                        className={`glass-card rounded-2xl border transition-all cursor-pointer select-none overflow-hidden ${
                          isExpanded 
                            ? 'border-primary ring-2 ring-primary/20 shadow-md' 
                            : 'border-white/50 hover:border-white shadow-sm'
                        }`}
                      >
                        {/* Summary Row */}
                        <div className="p-4 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            {/* Dynamic Feeling Mascot Icon */}
                            <Mascot 
                              character={item.mascot as MascotCharacter || 'munch'} 
                              expression="idle" 
                              size="sm" 
                              className="flex-shrink-0" 
                            />
                            <div className="min-w-0">
                              <h4 className="font-display font-extrabold text-sm text-charcoal leading-tight truncate max-w-[160px] sm:max-w-[200px]">
                                {item.selectedOption}
                              </h4>
                              <div className="flex items-center gap-2 mt-1 text-[10px] text-charcoal/50 font-medium">
                                <span>{item.category}</span>
                                <span>•</span>
                                <span>{item.options.length} options</span>
                              </div>
                            </div>
                          </div>

                          {/* Right Side Controls */}
                          <div className="flex items-center gap-2">
                            {/* Rating badge if any */}
                            {ratingMeta && (
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${ratingMeta.color}`}>
                                <span>{ratingMeta.emoji}</span>
                                <span className="hidden sm:inline">{ratingMeta.label}</span>
                              </span>
                            )}
                            
                            {/* Delete Trigger */}
                            <button
                              onClick={(e) => handleDelete(item.id, e)}
                              disabled={deletingId === item.id}
                              className="p-1.5 rounded-lg text-charcoal/40 hover:text-red-500 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Chevron Expand */}
                            <span className="text-charcoal/40 p-1">
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </span>
                          </div>
                        </div>

                        {/* Expandable Detail Panel */}
                        {isExpanded && (
                          <div className="px-4 pb-4 pt-1 border-t border-charcoal/5 bg-cream/40 space-y-4 animate-fade-in">
                            {/* Reinforcement */}
                            <div className="bg-white/80 border border-white rounded-xl p-3 flex gap-2.5 items-start">
                              <Mascot 
                                character={item.mascot as MascotCharacter || 'munch'} 
                                expression="idle" 
                                size="sm" 
                                className="flex-shrink-0 mt-0.5" 
                              />
                              <div>
                                <h5 className="text-[10px] font-bold uppercase tracking-wider text-charcoal/50">Munch's Reflections</h5>
                                <p className="text-xs text-charcoal/80 italic mt-0.5">
                                  "{item.reinforcementMessage}"
                                </p>
                              </div>
                            </div>

                            {/* Option list and weights */}
                            <div className="space-y-1.5">
                              <h5 className="text-[10px] font-bold uppercase tracking-wider text-charcoal/50 px-1">
                                Options breakdown
                              </h5>
                              <div className="space-y-1 max-h-[160px] overflow-y-auto pr-1">
                                {item.options.map((opt, oIdx) => (
                                  <div
                                    key={oIdx}
                                    className={`flex items-center justify-between text-xs px-3 py-2 rounded-xl border ${
                                      opt.isSelected 
                                        ? 'bg-primary/10 border-primary-dark/30 text-primary-dark font-semibold' 
                                        : 'bg-white/40 border-white/60 text-charcoal/70'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      {opt.isSelected ? (
                                        <Check className="w-3.5 h-3.5 text-primary-dark flex-shrink-0" />
                                      ) : (
                                        <span className="w-3.5 h-3.5 flex items-center justify-center rounded-full bg-charcoal/10 text-[8px] font-bold text-charcoal/50">
                                          {oIdx + 1}
                                        </span>
                                      )}
                                      <span className="truncate max-w-[180px] sm:max-w-[240px]">
                                        {opt.text}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-charcoal/40">
                                      {opt.isSelected && (
                                        <span className="bg-primary/20 text-primary-dark px-1.5 py-0.5 rounded text-[9px]">
                                          Chosen path
                                        </span>
                                      )}
                                      {opt.tags && opt.tags.length > 0 && (
                                        <span className="hidden sm:inline bg-charcoal/5 px-1.5 py-0.5 rounded text-[9px]">
                                          {opt.tags.join(', ')}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}

            {/* Scroll Sentinel for Infinite Loading */}
            <div ref={observerTarget} className="h-6 flex items-center justify-center">
              {loadingMore && (
                <div className="flex items-center gap-2 text-3xs text-charcoal/40">
                  <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <span>Loading older reflections...</span>
                </div>
              )}
              {!hasMore && decisions.length > 0 && (
                <span className="text-3xs text-charcoal/30 font-semibold tracking-wider uppercase">
                  All reflections loaded 🍀
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer Navigation Back to Dashboard */}
      <div>
        <button
          onClick={() => router.push('/dashboard')}
          className="w-full py-3.5 border-2 border-charcoal/10 rounded-2xl bg-white hover:bg-charcoal/5 text-charcoal font-semibold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
        >
          Back to my space
        </button>
      </div>
    </div>
  )
}
