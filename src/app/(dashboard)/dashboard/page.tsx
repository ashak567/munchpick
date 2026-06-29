'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Send, 
  Sparkles, 
  RotateCcw,
  ArrowRight,
  Lightbulb
} from 'lucide-react'
import Mascot, { MascotCharacter, MascotExpression } from '@/components/Mascot'
import { MotionTap, MotionCard } from '@/components/motion/MotionWrapper'
import { createClient } from '@/utils/supabase/client'
import { useConversationPresence } from '@/hooks/useConversationPresence'
import { useResponsiveLayout } from '@/components/companion/LayoutManager'
import CompanionStage from '@/components/companion/CompanionStage'
import EnvironmentRenderer, { EnvironmentTheme, EnvironmentTime } from '@/components/companion/EnvironmentRenderer'
import { CompanionPresenceBuilder } from '@/components/companion/CompanionPresenceBuilder'
import { PresenceExperienceManager } from '@/components/companion/PresenceExperienceManager'
import { InteractionCoordinator } from '@/components/companion/InteractionCoordinator'
import { MOTION_SYSTEM_VARIANTS } from '@/components/workspace/motion-system'
import { SURFACE_SYSTEM } from '@/components/workspace/surface-system'

interface ChatMessage {
  id: string
  chat_id: string
  sender: 'user' | 'mascot'
  content: string
  mascot_character: MascotCharacter | null
  mascot_expression: MascotExpression | null
  created_at: string
}

interface PathCandidate {
  text: string
  tags: string[]
}

const TYPING_MESSAGES: Record<string, string> = {
  pandy: 'Pandy is sitting with your energy...',
  ollie: 'Ollie is putting the pieces together...',
  munch: 'Munch is finding gentle paths...',
  ellie: 'Ellie is holding safe space for you...',
  dobby: 'Dobby is cheering you on...',
  froggy: 'Froggy is breathing in calm...',
  bubbles: 'Bubbles is flowing with your thoughts...',
  chicky: 'Chicky is chirping with joy...',
  coco: 'Coco is exploring possibilities...'
}

const MASCOT_NAMES: Record<string, string> = {
  munch: 'Munch',
  ollie: 'Ollie',
  ellie: 'Ellie',
  pandy: 'Pandy',
  dobby: 'Dobby',
  coco: 'Coco',
  froggy: 'Froggy',
  bubbles: 'Bubbles',
  chicky: 'Chicky',
}

const MAX_TEXTAREA_HEIGHT = 240

function generateDynamicGreeting(
  mascot: MascotCharacter,
  userName?: string,
  activeTopicKey?: string,
  totalDecisions?: number
): string {
  const hour = new Date().getHours()
  let timeGreeting = 'Hello'
  if (hour < 12) timeGreeting = 'Good morning'
  else if (hour < 18) timeGreeting = 'Good afternoon'
  else timeGreeting = 'Good evening'

  const resolvedName = userName && userName !== 'friend' ? userName : ''

  const welcomeOpeners: string[] = []
  const contextualReflections: string[] = []
  const companionClosers: string[] = []

  // 1. Configure welcome openers based on mascot tone
  if (mascot === 'munch') {
    welcomeOpeners.push(`It's so good to sit down with you${resolvedName ? `, ${resolvedName}` : ''}.`)
    welcomeOpeners.push(`${timeGreeting}${resolvedName ? `, ${resolvedName}` : ''}. I'm really glad we're connecting today.`)
    welcomeOpeners.push(`Welcome back${resolvedName ? `, ${resolvedName}` : ''}. I've been looking forward to this.`)
  } else if (mascot === 'ollie') {
    welcomeOpeners.push(`Hello${resolvedName ? `, ${resolvedName}` : ''}. I'm glad to share this quiet, reflective space with you.`)
    welcomeOpeners.push(`${timeGreeting}. Let's take a pause together${resolvedName ? `, ${resolvedName}` : ''}.`)
    welcomeOpeners.push(`It's nice to sit down together${resolvedName ? `, ${resolvedName}` : ''}. Let's look within.`)
  } else if (mascot === 'dobby') {
    welcomeOpeners.push(`Hey${resolvedName ? `, ${resolvedName}` : ''}! I am super excited to see you!`)
    welcomeOpeners.push(`Hi there! We've got this today, let's go!`)
    welcomeOpeners.push(`Oh, hello${resolvedName ? `, ${resolvedName}` : ''}! It's great to see you again!`)
  } else if (mascot === 'pandy') {
    welcomeOpeners.push(`Hey${resolvedName ? `, ${resolvedName}` : ''}. Take a deep breath. No pressure at all.`)
    welcomeOpeners.push(`Hi friend. I'm just happy to be here sitting with you.`)
    welcomeOpeners.push(`Hello. Let's just unwind and chat at your own pace.`)
  } else if (mascot === 'ellie') {
    welcomeOpeners.push(`Hello${resolvedName ? `, ${resolvedName}` : ''}. I'm holding a quiet, safe space for you today.`)
    welcomeOpeners.push(`${timeGreeting}. I'm right here with you.`)
  } else if (mascot === 'froggy') {
    welcomeOpeners.push(`Hi${resolvedName ? `, ${resolvedName}` : ''}. Let's take a slow, gentle breath.`)
    welcomeOpeners.push(`Hello. Let's slow things down and bring some calm into this moment.`)
  } else if (mascot === 'bubbles') {
    welcomeOpeners.push(`Hi${resolvedName ? `, ${resolvedName}` : ''}! I'm ready to flow with whatever you'd like to share.`)
    welcomeOpeners.push(`Hello. Let's let our thoughts drift and flow naturally today.`)
  } else if (mascot === 'chicky') {
    welcomeOpeners.push(`Chirp! Hello${resolvedName ? `, ${resolvedName}` : ''}! So happy to see you today!`)
    welcomeOpeners.push(`Hi there! Bringing a little chirp of warmth to your day.`)
  } else if (mascot === 'coco') {
    welcomeOpeners.push(`Hello${resolvedName ? `, ${resolvedName}` : ''}. Let's explore some cozy possibilities together.`)
    welcomeOpeners.push(`Hey! Let's brainstorm and find some quiet steps ahead.`)
  } else {
    welcomeOpeners.push(`${timeGreeting}${resolvedName ? `, ${resolvedName}` : ''}. I'm glad you're here.`)
    welcomeOpeners.push(`Hello. Let's take a peaceful moment together.`)
  }

  // 2. Configure contextual reflections based on familiarity and last topic key (optional)
  if (totalDecisions && totalDecisions > 50) {
    contextualReflections.push(`We've shared so many thoughts over time, and it always feels nice to catch up.`)
    contextualReflections.push(`It feels like we're building a really nice rhythm together.`)
  } else if (totalDecisions && totalDecisions > 10) {
    contextualReflections.push(`It's nice to continue getting to know you.`)
    contextualReflections.push(`It feels comfortable sitting here with you again.`)
  }

  if (activeTopicKey && activeTopicKey !== 'general' && activeTopicKey !== 'listening') {
    contextualReflections.push(`I was thinking about our last talk regarding ${activeTopicKey}.`)
    contextualReflections.push(`I hope things have been gentle since we talked about ${activeTopicKey}.`)
  }

  // 3. Configure companion closers based on mascot personality
  if (mascot === 'munch') {
    companionClosers.push(`How is your heart feeling today?`)
    companionClosers.push(`I'm listening whenever you're ready.`)
    companionClosers.push(`Tell me whatever is on your mind.`)
  } else if (mascot === 'ollie') {
    companionClosers.push(`What thoughts are flowing through your mind right now?`)
    companionClosers.push(`Let's sit with whatever is here.`)
  } else if (mascot === 'dobby') {
    companionClosers.push(`Ready to share what's on your mind?`)
    companionClosers.push(`Tell me everything!`)
  } else if (mascot === 'pandy') {
    companionClosers.push(`Whenever you're comfortable, I'm here.`)
    companionClosers.push(`What's making you feel heavy today?`)
  } else {
    companionClosers.push(`Whenever you're ready, tell me what's on your mind.`)
    companionClosers.push(`I'm right here.`)
  }

  // Deterministic seed based on name length and minute
  const seed = (resolvedName ? resolvedName.length : 3) + new Date().getMinutes()
  
  const opener = welcomeOpeners[seed % welcomeOpeners.length]
  const closer = companionClosers[(seed + 3) % companionClosers.length]
  const context = contextualReflections.length > 0 ? contextualReflections[seed % contextualReflections.length] : ''

  // Shuffle order of fragments randomly based on seed to avoid templates
  const orderType = seed % 3

  if (orderType === 0 && context) {
    return `${opener} ${context} ${closer}`
  } else if (orderType === 1 && context) {
    return `${context} ${opener} ${closer}`
  } else {
    return `${opener} ${closer}`
  }
}

export default function DashboardPage() {
  const router = useRouter()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Chat states
  const [chatId, setChatId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [isFocused, setIsFocused] = useState(false)
  const [userName, setUserName] = useState('friend')
  const [totalDecisions, setTotalDecisions] = useState<number>(0)

  // Centralized conversation presentation hook
  // This is the single source of truth for mascot expression, attention,
  // typing indicators, animations, and reading state.
  const { output: convOutput, dispatch: dispatchConv } = useConversationPresence()

  const layout = useResponsiveLayout()
  const experienceManagerRef = useRef<PresenceExperienceManager | null>(null)
  if (experienceManagerRef.current == null) {
    experienceManagerRef.current = new PresenceExperienceManager()
  }

  const getThemePalette = (mascot: MascotCharacter): string => {
    switch (mascot) {
      case 'ollie': return 'violet';
      case 'ellie': return 'blue';
      case 'pandy': return 'monochrome';
      case 'dobby': return 'brown';
      case 'coco': return 'orange';
      case 'froggy': return 'green';
      case 'bubbles': return 'cyan';
      case 'chicky': return 'yellow';
      case 'munch':
      default:
        return 'green';
    }
  }

  const getThemeTime = (): EnvironmentTime => {
    const hours = new Date().getHours();
    if (hours >= 5 && hours < 12) return 'morning';
    if (hours >= 12 && hours < 17) return 'afternoon';
    if (hours >= 17 && hours < 21) return 'evening';
    return 'night';
  }

  // Cognitive Trace states
  const [activeMascot, setActiveMascot] = useState<MascotCharacter>('munch')
  const [activeExpression, setActiveExpression] = useState<MascotExpression>('idle')
  const [activeTopicKey, setActiveTopicKey] = useState<string>('general')
  const [currentState, setCurrentState] = useState<string>('Listening')
  const [possiblePaths, setPossiblePaths] = useState<PathCandidate[]>([])
  const [visiblePaths, setVisiblePaths] = useState<PathCandidate[]>([])

  // UI / Interactive Selection states
  const [shuffling, setShuffling] = useState(false)
  const [shuffledIndex, setShuffledIndex] = useState(-1)
  const [selectedPathText, setSelectedPathText] = useState<string | null>(null)
  
  // "Today I Learned" (TIL) state
  const [tilMessage, setTilMessage] = useState<string | null>(null)

  const activeTheme: EnvironmentTheme = {
    time: getThemeTime(),
    userPreference: typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
    accessibility: convOutput.profile === 'reduced-motion' ? 'reduced-motion' : 'standard',
    mascotPalette: getThemePalette(activeMascot)
  }

  // Load chat and messages on mount
  const fetchChat = async () => {
    try {
      setInitializing(true)
      
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'friend'
        setUserName(name)
      }

      const res = await fetch('/api/chat')
      const prefRes = await fetch('/api/preferences')
      
      if (res.ok) {
        const data = await res.json()
        setChatId(data.chat.id)
        setCurrentState(data.chat.state || 'Listening')
        setMessages(data.messages || [])
        
        const metadata = data.chat.metadata || {}
        setActiveMascot(metadata.lastMascot || 'munch')
        setActiveExpression(metadata.lastExpression || 'idle')
        setActiveTopicKey(metadata.activeTopicKey || 'general')
        setPossiblePaths(metadata.possiblePaths || [])
      }

      if (prefRes.ok) {
        const prefData = await prefRes.json()
        setTotalDecisions(prefData.totalDecisions || 0)
      }
    } catch (err) {
      console.error('[DashboardChat] Failed to load chat:', err)
    } finally {
      setInitializing(false)
    }
  }

  const [activeMicroReaction, setActiveMicroReaction] = useState<import('@/components/Mascot').MicroReaction>('none')

  useEffect(() => {
    fetchChat()
    dispatchConv({ type: 'session_resumed' })
  }, [])

  // Ambient Sequence Scheduler tick
  useEffect(() => {
    const manager = experienceManagerRef.current
    if (!manager) return

    const interval = setInterval(() => {
      // Pause sequence if conversation is not idle or busy
      const isMascotBusy = convOutput.state === 'thinking' || convOutput.state === 'responding';
      if (!isMascotBusy) {
        const nextReaction = manager.tickAmbientSequence(activeMascot)
        if (nextReaction !== 'none') {
          setActiveMicroReaction(nextReaction)
          // Automatically clear the one-shot reaction after 1.2s
          setTimeout(() => {
            setActiveMicroReaction('none')
          }, 1200)
        }
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [activeMascot, convOutput.state])

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading, visiblePaths, shuffling])

  // Auto-expand textarea (configurable height)
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`
    }
  }, [inputValue])

  // Staggered paths reveal animation
  useEffect(() => {
    if (possiblePaths.length > 0 && currentState === 'Emerging Paths') {
      setVisiblePaths([])
      let idx = 0
      const timer = setInterval(() => {
        if (idx < possiblePaths.length) {
          setVisiblePaths(prev => [...prev, possiblePaths[idx]])
          idx++
        } else {
          clearInterval(timer)
        }
      }, 600)

      return () => clearInterval(timer)
    } else {
      setVisiblePaths([])
    }
  }, [possiblePaths, currentState])

  // Submit Message handler
  const handleSendMessage = async () => {
    const trimmed = inputValue.trim()
    if (!trimmed || loading) return

    // Optimistically insert user message locally
    const tempUserMsg: ChatMessage = {
      id: Math.random().toString(),
      chat_id: chatId || '',
      sender: 'user',
      content: trimmed,
      mascot_character: null,
      mascot_expression: null,
      created_at: new Date().toISOString()
    }

    setMessages(prev => [...prev, tempUserMsg])
    setInputValue('')
    setLoading(true)
    dispatchConv({ type: 'message_submitted' })

    try {
      dispatchConv({ type: 'response_started' })
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: trimmed })
      })

      if (res.ok) {
        const data = await res.json()
        setMessages(prev => [...prev, data.message])
        setCurrentState(data.state)
        setActiveMascot(data.mascotCharacter)
        setActiveExpression(data.mascotExpression || 'idle')
        setActiveTopicKey(data.activeTopicKey || 'general')
        setPossiblePaths(data.possiblePaths || [])
        dispatchConv({
          type: 'response_completed',
          backendExpression: data.mascotExpression || 'idle'
        })
      }
    } catch (err) {
      console.error('[DashboardChat] Send failed:', err)
      dispatchConv({ type: 'idle_requested' })
    } finally {
      setLoading(false)
    }
  }

  // Handle path selection (decide)
  const handleSelectPath = async (pathText: string) => {
    if (shuffling) return
    setSelectedPathText(pathText)
    setShuffling(true)

    // Trigger local slot-machine visual shuffle
    let shuffleCount = 0
    const interval = setInterval(() => {
      setShuffledIndex(prev => {
        let next = Math.floor(Math.random() * possiblePaths.length)
        if (next === prev && possiblePaths.length > 1) {
          next = (next + 1) % possiblePaths.length
        }
        return next
      })
      shuffleCount++
      if (shuffleCount > 15) {
        clearInterval(interval)
      }
    }, 120)

    const delay = new Promise(resolve => setTimeout(resolve, 2200))

    try {
      const decidePromise = fetch('/api/chat/decide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedPathText: pathText })
      }).then(res => res.json())

      const [decideResult] = await Promise.all([decidePromise, delay])
      
      clearInterval(interval)
      setShuffling(false)
      setSelectedPathText(null)
      setCurrentState('Archived')

      // Reload chat
      await fetchChat()

      // Occasionally show TIL
      const checkTIL = async () => {
        try {
          const prefRes = await fetch('/api/preferences')
          if (prefRes.ok) {
            const data = await prefRes.json()
            const total = data.totalDecisions || 0
            if (total > 0 && total % 8 === 0) {
              setTilMessage(`You seem to become kinder to yourself after taking a short break. I'll remember that.`)
            }
          }
        } catch (e) {
          console.warn('Preferences fetch failed in checkTIL:', e)
        }
      }
      checkTIL()

    } catch (err) {
      console.error('[DashboardChat] Deciding failed:', err)
      setShuffling(false)
      setSelectedPathText(null)
    }
  }

  // Restart / Reset active chat thread
  const handleStartFresh = async () => {
    try {
      setInitializing(true)
      setTilMessage(null)
      if (chatId) {
        await fetch('/api/chat/decide', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ selectedPathText: 'Start Fresh' })
        })
      }
      await fetchChat()
    } catch (err) {
      console.error('[DashboardChat] Reset failed:', err)
      setInitializing(false)
    }
  }

  if (initializing) {
    return (
      <div className="flex-grow flex flex-col items-center justify-center py-16 space-y-3">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
          className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full"
        />
        <span className="text-xs text-charcoal/50 font-medium">Listening to the quiet...</span>
      </div>
    )
  }

  const isChatEmpty = messages.length === 0
  const activeMascotName = MASCOT_NAMES[activeMascot] || 'Munch'


  return (
    <EnvironmentRenderer theme={activeTheme}>
      <div 
        className="flex flex-col justify-between w-full h-[100dvh] relative px-4 mx-auto overflow-hidden transition-all duration-300"
        style={{ 
          maxWidth: `${layout.chatWidth}px`, 
          paddingBottom: `${layout.keyboardHeight || layout.safeAreaInsets.bottom}px`,
          paddingTop: `${layout.safeAreaInsets.top}px`
        }}
      >
        {/* Companion Header Profile */}
        <div className="flex items-center justify-between border-b border-white/50 pb-4 pt-4 mb-2 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative">
              <CompanionStage 
                character={activeMascot}
                expression={convOutput.expression}
                attentionTarget={convOutput.attentionTarget}
                microReaction={activeMicroReaction}
                animationBudget={activeTheme.accessibility === 'reduced-motion' ? 'reduced-motion' : 'low'}
                layoutMode="compact"
                mascotScale={0.8}
              />
              {loading && (
                <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-dark opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                </span>
              )}
            </div>
            <div>
              <h3 className="font-display font-black text-base text-charcoal leading-tight">
                {activeMascotName}
              </h3>
              <span className="text-[10px] text-charcoal/40 font-bold tracking-wider uppercase block mt-0.5">
                {currentState === 'Listening' && 'listening...'}
                {currentState === 'Exploring' && 'exploring possibilities...'}
                {currentState === 'Clarifying' && 'clarifying details...'}
                {currentState === 'Understanding' && 'sitting with you...'}
                {currentState === 'Emerging Paths' && 'paths discovered'}
                {currentState === 'Archived' && 'session complete'}
              </span>
            </div>
          </div>

          <button
            onClick={handleStartFresh}
            className="px-3 py-1.5 text-charcoal/50 hover:text-charcoal/80 bg-white/50 border border-white/70 hover:bg-white/80 rounded-xl cursor-pointer transition-all flex items-center gap-1 text-[11px] font-bold shadow-2xs hover:shadow-xs active:scale-95"
            title="Start fresh conversation"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        </div>

        {/* Main Viewport Container */}
        <div className="flex-1 overflow-y-auto px-1 space-y-6 pr-2 mb-4 scrollbar-thin">
          <AnimatePresence initial={false}>
            {isChatEmpty ? (
              /* Welcome / Elegant Empty State Card */
              <motion.div
                variants={MOTION_SYSTEM_VARIANTS.cardReveal}
                initial="initial"
                animate="animate"
                exit="exit"
                className="py-8 flex flex-col items-center text-center space-y-6 max-w-sm mx-auto"
              >
                <CompanionStage
                  character={activeMascot}
                  expression={convOutput.expression}
                  attentionTarget={convOutput.attentionTarget}
                  microReaction={activeMicroReaction}
                  animationBudget={activeTheme.accessibility === 'reduced-motion' ? 'reduced-motion' : 'high'}
                  layoutMode={layout.mode}
                  mascotScale={layout.mascotScale}
                  className="mb-2"
                />
                <div className="space-y-2">
                  <h2 className="font-display font-black text-xl text-charcoal">
                    Hi, I&apos;m {activeMascotName}
                  </h2>
                  <p className="text-sm text-charcoal/70 leading-relaxed px-4">
                    {generateDynamicGreeting(activeMascot, userName, activeTopicKey, totalDecisions)}
                  </p>
                </div>
                <div className="w-full pt-4">
                  <div className="p-4 bg-white/70 border border-white/95 rounded-2xl shadow-3xs text-left">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary-dark block mb-2">
                      Start a conversation
                    </span>
                    <p className="text-xs text-charcoal/60 leading-normal">
                      Type whatever is on your mind. You can share how your day went, something that is worrying you, or just say hello.
                    </p>
                  </div>
                </div>
              </motion.div>
            ) : (
              /* Dialogue Messages Thread with Spring-based transitions */
              messages.map((msg, index) => {
                const isMascot = msg.sender === 'mascot'
                const name = isMascot ? (MASCOT_NAMES[msg.mascot_character || ''] || 'Munch') : 'You'

                return (
                  <motion.div
                    key={msg.id}
                    variants={MOTION_SYSTEM_VARIANTS.messageEntrance}
                    initial="initial"
                    animate="animate"
                    className={`flex gap-3 items-end ${
                      isMascot ? 'justify-start' : 'justify-end'
                    }`}
                  >
                    {isMascot && (
                      <div className="flex-shrink-0 mb-1">
                        <Mascot character={msg.mascot_character || 'munch'} expression={msg.mascot_expression || 'idle'} size="xs" />
                      </div>
                    )}

                    <div
                      className={`max-w-[82%] rounded-2xl px-4 py-3.5 text-sm leading-relaxed border shadow-3xs relative ${
                        isMascot
                          ? 'bg-white border-white/90 text-charcoal rounded-tl-none'
                          : 'bg-[#E3F4EA] border-[#C9EDD6] text-charcoal-dark rounded-br-none'
                      }`}
                    >
                      <span className={`text-[9px] font-black uppercase tracking-widest block mb-1.5 select-none ${
                        isMascot ? 'text-secondary-dark' : 'text-primary-dark'
                      }`}>
                        {name}
                      </span>
                      <p className="whitespace-pre-line font-medium leading-relaxed text-charcoal">
                        {msg.content}
                      </p>
                    </div>
                  </motion.div>
                )
              })
            )}
          </AnimatePresence>

          {/* Shuffling Board Slot-machine selection view */}
          {shuffling && (
            <div className="w-full flex justify-center py-4 animate-fade-in">
              <div className="glass-card border-2 border-primary rounded-3xl p-5 shadow-lg w-full max-w-sm flex flex-col items-center justify-center">
                <span className="text-3xs font-black tracking-widest text-primary-dark uppercase block mb-2">
                  Reflecting on Path
                </span>
                <CompanionStage
                  character={activeMascot}
                  expression={convOutput.expression}
                  attentionTarget={convOutput.attentionTarget}
                  microReaction={activeMicroReaction}
                  animationBudget={activeTheme.accessibility === 'reduced-motion' ? 'reduced-motion' : 'high'}
                  layoutMode={layout.mode}
                  mascotScale={layout.mascotScale}
                  className="mb-3"
                />
                <div className="w-full py-3 bg-white/70 border border-primary/20 rounded-2xl flex items-center justify-center min-h-[50px]">
                  <span className="text-xs font-bold text-primary-dark animate-pulse text-center px-4 break-words">
                    {possiblePaths[shuffledIndex]?.text || selectedPathText || 'reflecting...'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Emerging Paths Chips */}
          {!shuffling && currentState === 'Emerging Paths' && possiblePaths.length > 0 && (
            <div className="glass-panel bg-white/40 border border-white/60 rounded-3xl p-5 shadow-xs space-y-4 animate-fade-in w-full max-w-md mx-auto">
              <div className="flex items-center gap-2 text-primary-dark justify-center">
                <Sparkles className="w-4 h-4 animate-float" />
                <span className="text-3xs font-black uppercase tracking-widest text-primary-dark">
                  Paths to Explore
                </span>
              </div>

              <div className="flex flex-col gap-2">
                {visiblePaths.map((path, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelectPath(path.text)}
                    className="w-full text-left p-3.5 rounded-xl border border-charcoal/5 bg-white hover:bg-cream/55 active:bg-cream text-charcoal transition-all hover:translate-y-[-1px] cursor-pointer shadow-3xs flex items-center gap-3 group"
                    style={{ minHeight: '44px' }}
                  >
                    <span className="w-4 h-4 rounded-full bg-primary/20 text-primary-dark font-black text-[9px] flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-bold block truncate text-charcoal group-hover:text-primary-dark transition-colors leading-snug">
                        {path.text}
                      </span>
                      {path.tags && path.tags.length > 0 && (
                        <span className="text-[8px] text-charcoal/40 font-semibold block capitalize mt-0.5">
                          {path.tags.slice(0, 2).join(' • ')}
                        </span>
                      )}
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-charcoal/30 group-hover:text-primary-dark group-hover:translate-x-0.5 transition-all" />
                  </button>
                ))}
                
                {visiblePaths.length < possiblePaths.length && (
                  <div className="flex items-center gap-2 text-[10px] text-charcoal/40 pl-2">
                    <span className="animate-bounce">🍃</span>
                    <span>revealing another path...</span>
                  </div>
                )}
              </div>

              {visiblePaths.length === possiblePaths.length && (
                <div className="flex gap-2 pt-2 border-t border-charcoal/5">
                  <button
                    onClick={() => {
                      setInputValue("Let's explore more paths")
                      setCurrentState('Exploring')
                    }}
                    className="flex-1 py-2.5 border border-charcoal/10 rounded-xl bg-white hover:bg-cream text-charcoal font-bold text-[10px] flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-3xs"
                    style={{ minHeight: '44px' }}
                  >
                    Let&apos;s Explore More
                  </button>
                  <button
                    onClick={() => {
                      setInputValue("I'm still thinking")
                      setCurrentState('Clarifying')
                    }}
                    className="flex-1 py-2.5 border border-charcoal/10 rounded-xl bg-white hover:bg-cream text-charcoal font-bold text-[10px] flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-3xs"
                    style={{ minHeight: '44px' }}
                  >
                    I&apos;m Still Thinking
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Today I Learned (TIL) Bubble */}
          {tilMessage && (
            <div className="glass-panel bg-primary/10 border border-primary/20 rounded-2xl p-4 shadow-sm flex items-start gap-3 animate-fade-in w-full max-w-sm mx-auto">
              <Lightbulb className="w-5 h-5 text-primary-dark flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-[10px] font-black tracking-widest text-primary-dark uppercase mb-1">
                  🍀 Today I Learned...
                </h4>
                <p className="text-2xs text-charcoal/80 leading-relaxed font-semibold">
                  {tilMessage}
                </p>
                <span className="text-[9px] text-charcoal/40 italic block mt-1.5">
                  I will remember that.
                </span>
              </div>
            </div>
          )}

          {/* Companion Presence Breathing & Glowing Typing/Thinking Animation */}
          {convOutput.showTypingIndicator && (
            <motion.div
              variants={MOTION_SYSTEM_VARIANTS.composerTransition}
              initial="initial"
              animate="animate"
              className="flex gap-3 items-center text-xs text-charcoal/50 pl-1"
            >
              <motion.div
                variants={MOTION_SYSTEM_VARIANTS.bubbleTyping}
                animate="animate"
                className="relative flex-shrink-0"
              >
                <div className="absolute inset-0 bg-primary/25 rounded-full blur-md" />
                <Mascot 
                  character={activeMascot} 
                  expression={convOutput.expression} 
                  attentionTarget={convOutput.attentionTarget}
                  animationBudget={convOutput.profile === 'reduced-motion' ? 'reduced-motion' : 'medium'}
                  size="xs" 
                />
              </motion.div>
              <span className="font-semibold italic text-charcoal/60">
                {TYPING_MESSAGES[activeMascot] || 'Munch is listening...'}
              </span>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Composer Panel */}
        <div className="w-full pb-4 z-30 flex-shrink-0">
          <div className="bg-white/80 border border-white/95 rounded-2xl p-2.5 flex items-end gap-2.5 shadow-md backdrop-blur-md focus-within:shadow-lg focus-within:border-primary/50 transition-all">
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value.slice(0, 200))}
              onKeyDown={(e) => InteractionCoordinator.handleComposerKeyDown(e, handleSendMessage, loading || currentState === 'Archived')}
              onFocus={() => { setIsFocused(true); dispatchConv({ type: 'user_typing_started' }) }}
              onBlur={() => { setIsFocused(false); dispatchConv({ type: 'user_typing_stopped' }) }}
              placeholder={currentState === 'Archived' ? "Session completed. Click Reset to start fresh." : "Type what's on your mind..."}
              disabled={loading || currentState === 'Archived'}
              className="flex-1 text-xs bg-transparent border-none outline-none text-charcoal placeholder-charcoal/30 font-medium py-1.5 px-2 disabled:cursor-not-allowed resize-none max-h-[240px] scrollbar-none"
            />

            <div className="flex flex-col items-center gap-1 flex-shrink-0 mb-0.5">
              <span className="text-[8px] text-charcoal/30 font-bold select-none">
                {inputValue.length}/200
              </span>
              <MotionTap>
                <button
                  onClick={handleSendMessage}
                  disabled={!inputValue.trim() || loading || currentState === 'Archived'}
                  className="p-2 bg-primary hover:bg-primary-dark text-primary-dark font-bold rounded-xl border border-primary-dark cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-3xs"
                  style={{ minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </MotionTap>
            </div>
          </div>
        </div>

      </div>
    </EnvironmentRenderer>
  )
}