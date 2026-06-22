'use client'

import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Sparkles, 
  RefreshCw, 
  Check, 
  Heart, 
  Smile, 
  Meh,
  AlertTriangle,
  HelpCircle
} from 'lucide-react'

import Mascot, { type MascotCharacter, type MascotExpression } from '@/components/Mascot'

// Option type definition
interface Option {
  id: string
  text: string
}

// Step types
type FlowStep = 'INPUT' | 'SELECTING' | 'RESULT'

// Mock reinforcement databases based on detected category
const MOCK_REINFORCEMENTS: Record<string, { reasons: string[]; message: string }> = {
  Food: {
    reasons: [
      "It is incredibly satisfying and exactly what your body is craving right now.",
      "It will give you a great energy boost for the rest of your day.",
      "It's a perfect treat to reward yourself for all your hard work."
    ],
    message: "Treat yourself — you deserve a delicious choice! 🍕"
  },
  Entertainment: {
    reasons: [
      "It's highly entertaining and a fantastic way to unwind.",
      "It offers an engaging escape and great storytelling.",
      "It's the perfect length to fit into your schedule right now."
    ],
    message: "Sit back, relax, and enjoy the show! 🍿"
  },
  Activities: {
    reasons: [
      "It's highly rewarding and will make you feel productive.",
      "It helps clear your mind and boosts your physical/mental well-being.",
      "It's a great habit that builds positive momentum for your goals."
    ],
    message: "Action cures overthinking. Let's make it happen! 🏃‍♂️"
  },
  Shopping: {
    reasons: [
      "It's a high-quality item that offers great value for its cost.",
      "It solves a specific need you've been thinking about recently.",
      "It's a durable purchase that you'll enjoy using for a long time."
    ],
    message: "A smart addition to your day. Enjoy your new find! 🛍️"
  },
  Other: {
    reasons: [
      "It's the most practical path forward to clear your schedule.",
      "It lets you cross off a major item and reduces cognitive load.",
      "It aligns perfectly with your overall goals and daily rhythm."
    ],
    message: "Trust your gut — this is the right move! 🍀"
  }
}

export default function NewDecisionPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // States
  const [step, setStep] = useState<FlowStep>('INPUT')
  const [options, setOptions] = useState<Option[]>([])
  const [inputValue, setInputValue] = useState('')
  const [inputError, setInputError] = useState<string | null>(null)
  
  // Custom Mood / Context States (Task 4)
  const [emotionalState, setEmotionalState] = useState('')
  const [currentContext, setCurrentContext] = useState('')
  
  // Selection/Animation States
  const [selectedIndex, setSelectedIndex] = useState<number>(-1)
  const [animationIndex, setAnimationIndex] = useState<number>(-1)
  const [detectedCategory, setDetectedCategory] = useState<string>('Other')
  const [reinforcement, setReinforcement] = useState<{ reasoning: string; encouragement: string; follow_up_question: string } | null>(null)
  const [decisionId, setDecisionId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  
  // Active mascot state based on emotion/context
  const [activeMascot, setActiveMascot] = useState<MascotCharacter>('munch')
  
  // Feedback State
  const [feedbackRating, setFeedbackRating] = useState<string | null>(null)
  const [feedbackSubmitted, setFeedbackSubmitted] = useState<boolean>(false)
  const [submittingFeedback, setSubmittingFeedback] = useState<boolean>(false)
  const [savingState, setSavingState] = useState<boolean>(false)

  const handleFeedback = async (rating: 'love' | 'okay' | 'meh') => {
    if (!decisionId || feedbackSubmitted || submittingFeedback) return

    setFeedbackRating(rating)
    setSubmittingFeedback(true)

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          decisionId,
          rating,
        }),
      })

      if (!res.ok) {
        throw new Error('Failed to submit feedback')
      }

      setFeedbackSubmitted(true)
      setActiveMascot('chicky') // Set mascot to Chicky (Joy) when decision is completed!
    } catch (err) {
      console.error('Feedback submit failed:', err)
      setFeedbackSubmitted(true)
      setActiveMascot('chicky')
    } finally {
      setSubmittingFeedback(false)
    }
  }

  // Map feedback rating to mascot expression
  const getMascotExpression = (): MascotExpression => {
    if (feedbackRating === 'love') return 'happy'
    if (feedbackRating === 'okay') return 'happy'
    if (feedbackRating === 'meh') return 'wry'
    return 'idle'
  }

  // Quick preset initialization from query parameters (e.g. ?quick=food)
  useEffect(() => {
    const quickParam = searchParams.get('quick')
    if (quickParam === 'food') {
      setOptions([
        { id: '1', text: 'Cheesy Neapolitan Pizza' },
        { id: '2', text: 'Fresh Spicy Tuna Sushi' },
        { id: '3', text: 'Creamy Garlic Pasta' },
        { id: '4', text: 'Crispy Falafel Wrap' }
      ])
    }
  }, [searchParams])

  // Detect category mock logic based on option texts
  const detectCategory = (opts: Option[]): string => {
    const textStr = opts.map(o => o.text.toLowerCase()).join(' ')
    if (/pizza|sushi|pasta|burger|food|eat|dinner|lunch|breakfast|restaurant|cafe|falafel/i.test(textStr)) {
      return 'Food'
    }
    if (/movie|film|netflix|show|watch|game|youtube|music|book|podcast|concert/i.test(textStr)) {
      return 'Entertainment'
    }
    if (/run|gym|work|study|code|read|sleep|clean|meditate|exercise|walk|activity/i.test(textStr)) {
      return 'Activities'
    }
    if (/buy|shop|clothes|shoes|amazon|gadget|item|purchase|price/i.test(textStr)) {
      return 'Shopping'
    }
    return 'Other'
  }

  // Option Adding
  const handleAddOption = () => {
    const trimmed = inputValue.trim()
    setInputError(null)
    setErrorMsg(null)

    if (!trimmed) {
      setInputError('Option text cannot be empty')
      return
    }

    if (trimmed.length > 200) {
      setInputError('Option must be under 200 characters')
      return
    }

    // Check for duplicates
    if (options.some(o => o.text.toLowerCase() === trimmed.toLowerCase())) {
      setInputError('This option already exists')
      return
    }

    const newOpt: Option = {
      id: Math.random().toString(36).substring(2, 9),
      text: trimmed
    }

    setOptions([...options, newOpt])
    setInputValue('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddOption()
    }
  }

  // Option Removal
  const handleRemoveOption = (id: string) => {
    setOptions(options.filter(o => o.id !== id))
    setErrorMsg(null)
  }

  // Core Pick Selection Flow (Task 3.7)
  const handlePickForMe = async () => {
    if (options.length < 2) return

    setStep('SELECTING')
    setActiveMascot('munch') // reset to munch during selecting animation
    setFeedbackRating(null)
    setFeedbackSubmitted(false)
    setSubmittingFeedback(false)
    setErrorMsg(null)
    setSelectedIndex(-1)
    setAnimationIndex(-1)

    // Start a visual rapid-shuffling animation loop
    let currentShuffleIdx = 0
    const shuffleInterval = setInterval(() => {
      setAnimationIndex((prev) => {
        // Shuffle randomly
        let nextIdx = Math.floor(Math.random() * options.length)
        // Try to avoid showing same index twice in a row if possible
        if (nextIdx === prev && options.length > 1) {
          nextIdx = (nextIdx + 1) % options.length
        }
        return nextIdx
      })
      currentShuffleIdx++
    }, 100)

    // Fire API request
    let apiResponse: any = null
    let apiError: string | null = null

    const apiPromise = fetch('/api/decisions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        options: options.map(o => o.text),
        emotionalState,
        currentContext,
      }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Failed to generate decision')
        }
        return res.json()
      })
      .then((data) => {
        apiResponse = data
      })
      .catch((err) => {
        apiError = err.message || 'An error occurred while connecting to the decision server.'
      })

    // Enforce a minimum 2.5-second animation delay for a slot-machine delight feel
    const delayPromise = new Promise((resolve) => setTimeout(resolve, 2500))

    try {
      await Promise.all([apiPromise, delayPromise])
      clearInterval(shuffleInterval)

      if (apiError) {
        setErrorMsg(apiError)
        setStep('INPUT')
        return
      }

      // Land on the actual selected option returned by the server
      const selectedOptionText = apiResponse.selectedOption.text
      const matchedIndex = options.findIndex(o => o.text === selectedOptionText)
      const finalIndex = matchedIndex !== -1 ? matchedIndex : 0

      setSelectedIndex(finalIndex)
      setAnimationIndex(finalIndex)
      setDetectedCategory(apiResponse.category)
      setReinforcement(apiResponse.reinforcement)
      setDecisionId(apiResponse.id)
      setActiveMascot((apiResponse.mascot || apiResponse.reinforcement?.mascot || 'munch') as MascotCharacter)
      setStep('RESULT')
    } catch (err: any) {
      clearInterval(shuffleInterval)
      setErrorMsg(err.message || 'An unexpected error occurred during selection.')
      setStep('INPUT')
    }
  }

  // Try Again flow (reshuffles same options)
  const handleTryAgain = () => {
    handlePickForMe()
  }

  // Save and finish flow (redirects back to dashboard)
  const handleFinish = async () => {
    setSavingState(true)
    // Small delay for smooth feel
    setTimeout(() => {
      setSavingState(false)
      router.push('/dashboard')
    }, 400)
  }

  return (
    <div className="flex-grow flex flex-col justify-between h-full">
      {/* 2.7 Navigation Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => {
            if (step === 'RESULT') {
              setStep('INPUT')
            } else {
              router.push('/dashboard')
            }
          }}
          className="p-2 bg-white/60 hover:bg-white border border-white/80 rounded-xl cursor-pointer text-charcoal/80 transition-colors shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="font-display font-extrabold text-2xl text-charcoal">
            {step === 'INPUT' && "What's on your mind today?"}
            {step === 'SELECTING' && 'Munch is reflecting...'}
            {step === 'RESULT' && "This feels like a lovely path!"}
          </h2>
          <p className="text-2xs text-charcoal/60">
            {step === 'INPUT' && 'Share the options you are weighing'}
            {step === 'SELECTING' && 'Finding a gentle way forward'}
            {step === 'RESULT' && `Reflection: ${detectedCategory}`}
          </p>
        </div>
      </div>

      {/* Main Panel Content */}
      <div className="flex-1 flex flex-col justify-start">
        
        {/* STEP 1: INPUT OPTIONS */}
        {step === 'INPUT' && (
          <div className="space-y-6">
            {errorMsg && (
              <div className="flex items-start gap-2 bg-coral/15 border border-coral/30 text-coral-dark rounded-xl p-3 text-2xs relative">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span className="flex-1 pr-6 leading-snug">
                  <strong>Oops! Decision engine issue:</strong> {errorMsg}
                </span>
                <button
                  onClick={() => setErrorMsg(null)}
                  className="absolute top-2 right-2 text-coral-dark/60 hover:text-coral-dark text-xs font-bold px-1 hover:bg-coral/10 rounded cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}
            
            {/* Input Field with Add Button */}
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => {
                    setInputValue(e.target.value)
                    if (inputError) setInputError(null)
                    if (errorMsg) setErrorMsg(null)
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="e.g. Order sushi from Haru"
                  className={`flex-1 px-4 py-2.5 border rounded-xl bg-white/80 backdrop-blur-sm text-sm placeholder-charcoal/30 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary-dark border-white/80 shadow-sm`}
                />
                <button
                  onClick={handleAddOption}
                  className="px-4 bg-primary hover:bg-primary-dark text-primary-dark font-bold rounded-xl border border-primary-dark flex items-center justify-center cursor-pointer transition-colors shadow-sm"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
              
              {inputError && (
                <span className="block text-2xs text-red-500 pl-1">
                  {inputError}
                </span>
              )}
            </div>

            {/* Optional Mood & Context Panel */}
            <div className="bg-white/45 backdrop-blur-sm border border-white/60 rounded-2xl p-4 shadow-sm space-y-3">
              <span className="text-[10px] font-bold text-charcoal/50 uppercase tracking-wider block">
                How are you feeling in this moment? (Optional) 🍀
              </span>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-charcoal/50 uppercase tracking-wider block">Your Mood</label>
                  <input
                    type="text"
                    value={emotionalState}
                    onChange={(e) => setEmotionalState(e.target.value)}
                    placeholder="e.g. tired, overwhelmed"
                    className="w-full px-3 py-2 text-xs border border-white/80 rounded-xl bg-white/80 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary-dark shadow-sm text-charcoal"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-charcoal/50 uppercase tracking-wider block">Your Context</label>
                  <input
                    type="text"
                    value={currentContext}
                    onChange={(e) => setCurrentContext(e.target.value)}
                    placeholder="e.g. studying, busy day"
                    className="w-full px-3 py-2 text-xs border border-white/80 rounded-xl bg-white/80 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary-dark shadow-sm text-charcoal"
                  />
                </div>
              </div>
            </div>

            {/* Fatigue Warning (20+ options) */}
            {options.length >= 20 && (
              <div className="flex items-start gap-2 bg-yellow/15 border border-yellow/30 text-yellow-800 rounded-xl p-3 text-2xs">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>That is a lot of thoughts!</strong> Weighing too many options can feel a bit overwhelming. Feel free to continue, or maybe take a breath and see if you can simplify them.
                </span>
              </div>
            )}

            {/* 2.2 & 2.3 Option Chip List */}
            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <span className="text-2xs font-semibold text-charcoal/50">
                  YOUR THOUGHTS ({options.length})
                </span>
                {options.length > 0 && (
                  <button
                    onClick={() => setOptions([])}
                    className="text-2xs text-red-500 font-bold hover:underline cursor-pointer"
                  >
                    Clear All
                  </button>
                )}
              </div>

              {options.length === 0 ? (
                /* Empty state */
                <div className="glass-card rounded-2xl p-8 border border-white/50 text-center flex flex-col items-center justify-center gap-2">
                  <span className="text-3xl animate-float">🌱</span>
                  <p className="text-xs text-charcoal/50 leading-relaxed max-w-xs">
                    Write down at least two paths you're stuck between, and we'll find a gentle way forward together.
                  </p>
                </div>
              ) : (
                /* Chip list */
                <div className="flex flex-col gap-2 max-h-[320px] overflow-y-auto pr-1">
                  {options.map((opt, index) => (
                    <div
                      key={opt.id}
                      className="chip-clay flex items-center justify-between rounded-2xl px-4 py-3 bg-white border border-white/80"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-5 h-5 flex items-center justify-center rounded-full bg-secondary/35 text-secondary-dark text-3xs font-black">
                          {index + 1}
                        </span>
                        <span className="text-sm font-medium text-charcoal leading-snug break-words max-w-[200px] sm:max-w-[260px]">
                          {opt.text}
                        </span>
                      </div>
                      <button
                        onClick={() => handleRemoveOption(opt.id)}
                        className="text-charcoal/40 hover:text-red-500 p-1 cursor-pointer transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 2: SHUFFLING ANIMATION */}
        {step === 'SELECTING' && (
          <div className="flex-grow flex flex-col items-center justify-center py-12 text-center">
            
            {/* Mascot Shuffling Eyes */}
            <Mascot character="munch" expression="think" size="xl" className="mb-8" />

            {/* Shuffling Options Board */}
            <div className="w-full max-w-sm px-4">
              <div className="glass-panel border-2 border-primary rounded-3xl p-6 shadow-lg min-h-[96px] flex items-center justify-center transition-all duration-100">
                <span className="text-lg font-bold text-primary-dark animate-pulse break-all text-center">
                  {options[animationIndex]?.text || 'Reflecting...'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: RESULT DISPLAY */}
        {step === 'RESULT' && selectedIndex !== -1 && (
          <div className="space-y-6">
            
            {/* Highlighted Pick Card */}
            <div className="glass-panel border-2 border-primary rounded-3xl p-6 shadow-xl text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 w-20 h-20 bg-primary/20 rounded-bl-full flex items-center justify-center pr-3 pb-3">
                <Sparkles className="w-6 h-6 text-primary-dark" />
              </div>
              
              <span className="text-3xs font-black tracking-widest text-primary-dark uppercase bg-primary/20 border border-primary-dark/30 rounded-full px-3 py-1 inline-block mb-3">
                A GENTLE START
              </span>
              
              <h2 className="font-display text-2xl font-black text-charcoal break-all max-w-[280px] mx-auto leading-tight">
                {options[selectedIndex]?.text}
              </h2>
            </div>

            {/* Mascot reinforcement block */}
            <div className="glass-card rounded-3xl p-5 border border-white/50 space-y-4">
              <div className="flex gap-4 items-start">
                <div className="flex-shrink-0 mt-1">
                  <Mascot 
                    character={activeMascot} 
                    expression={getMascotExpression()} 
                    size="md" 
                  />
                </div>
                {/* Speech Bubble */}
                <div className="flex-1 relative bg-white border border-white/85 rounded-2xl rounded-tl-none p-4 shadow-sm text-charcoal text-xs leading-relaxed">
                  <p className="font-semibold text-charcoal mb-2 leading-relaxed">
                    {reinforcement?.reasoning}
                  </p>
                  <p className="font-bold text-primary-dark italic">
                    {reinforcement?.encouragement}
                  </p>
                </div>
              </div>
            </div>

            {/* M4 Feedback Interface (interactive preview) */}
            <div className="text-center space-y-2.5">
              <span className="text-[10px] font-semibold text-charcoal/40 uppercase tracking-wider block">
                {feedbackSubmitted 
                  ? "Thanks! Munch is learning your tastes 🍀" 
                  : (reinforcement?.follow_up_question || "How do you feel about this pick?")}
              </span>
              <div className="flex justify-center gap-4">
                <button
                  onClick={() => handleFeedback('love')}
                  disabled={feedbackSubmitted || submittingFeedback}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 transition-all cursor-pointer disabled:cursor-not-allowed ${
                    feedbackRating === 'love'
                      ? 'border-primary bg-primary/20 scale-105 shadow-sm'
                      : 'border-charcoal/5 bg-white/40 hover:bg-white/80 text-charcoal/60'
                  } ${feedbackRating !== null && feedbackRating !== 'love' ? 'opacity-40 scale-95' : ''}`}
                >
                  <Heart className={`w-5 h-5 ${feedbackRating === 'love' ? 'fill-red-500 text-red-500' : ''}`} />
                  <span className="text-[10px] font-bold">Loved it</span>
                </button>

                <button
                  onClick={() => handleFeedback('okay')}
                  disabled={feedbackSubmitted || submittingFeedback}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 transition-all cursor-pointer disabled:cursor-not-allowed ${
                    feedbackRating === 'okay'
                      ? 'border-primary bg-primary/20 scale-105 shadow-sm'
                      : 'border-charcoal/5 bg-white/40 hover:bg-white/80 text-charcoal/60'
                  } ${feedbackRating !== null && feedbackRating !== 'okay' ? 'opacity-40 scale-95' : ''}`}
                >
                  <Smile className={`w-5 h-5 ${feedbackRating === 'okay' ? 'fill-yellow text-yellow-700' : ''}`} />
                  <span className="text-[10px] font-bold">It's okay</span>
                </button>

                <button
                  onClick={() => handleFeedback('meh')}
                  disabled={feedbackSubmitted || submittingFeedback}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 transition-all cursor-pointer disabled:cursor-not-allowed ${
                    feedbackRating === 'meh'
                      ? 'border-primary bg-primary/20 scale-105 shadow-sm'
                      : 'border-charcoal/5 bg-white/40 hover:bg-white/80 text-charcoal/60'
                  } ${feedbackRating !== null && feedbackRating !== 'meh' ? 'opacity-40 scale-95' : ''}`}
                >
                  <Meh className={`w-5 h-5 ${feedbackRating === 'meh' ? 'fill-coral text-coral-dark' : ''}`} />
                  <span className="text-[10px] font-bold">Not for me</span>
                </button>
              </div>
            </div>

          </div>
        )}

      </div>

      {/* Lower Actions Section */}
      <div className="pt-6">
        {step === 'INPUT' && (
          <button
            onClick={handlePickForMe}
            disabled={options.length < 2}
            className="w-full py-3.5 btn-clay-primary text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <Sparkles className="w-5 h-5" />
            Let's find what feels right
          </button>
        )}

        {step === 'RESULT' && (
          <div className="flex gap-3">
            <button
              onClick={handleTryAgain}
              className="flex-1 py-3 border-2 border-charcoal/10 rounded-2xl bg-white hover:bg-charcoal/5 active:bg-charcoal/10 text-charcoal font-semibold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <RefreshCw className="w-4 h-4 animate-float-delayed" />
              Reflect again
            </button>
            <button
              onClick={handleFinish}
              disabled={savingState}
              className="flex-1 py-3 btn-clay-primary text-sm flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
            >
              {savingState ? 'Saving...' : 'Carry this forward'}
              <Check className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

    </div>
  )
}
