import React from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { ArrowRight, ChevronRight, CheckCircle2, Star, Sparkles } from 'lucide-react'
import Mascot from '@/components/Mascot'

export default async function LandingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isLoggedIn = !!user

  const mascotTeam = [
    { name: 'Munch 🍀', role: 'General Advisor', character: 'general' as const, bg: 'bg-white/60', description: 'Curbs general overthinking' },
    { name: 'Chef Munch 🍕', role: 'Food Expert', character: 'chef' as const, bg: 'bg-primary/10', description: 'Decides meals & dinners' },
    { name: 'Showtime Munch 🍿', role: 'Entertainment', character: 'showtime' as const, bg: 'bg-secondary/10', description: 'Picks movies & games' },
    { name: 'Coach Munch 🏃‍♂️', role: 'Activities', character: 'coach' as const, bg: 'bg-yellow/10', description: 'Guides tasks & workouts' },
    { name: 'Shopper Munch 🛍️', role: 'Shopping', character: 'shopper' as const, bg: 'bg-coral/10', description: 'Selects items & purchases' }
  ]

  const testimonials = [
    {
      quote: "My partner and I haven't argued about dinner once since using MunchPick! The positive reasons make us look forward to the choice.",
      author: "Chloe & David",
      role: "Meal-fatigued Couple",
      stars: 5
    },
    {
      quote: "I used to spend 45 minutes scrolling Netflix. Now Showtime Munch chooses in 3 seconds, and I feel completely satisfied with the pick.",
      author: "Marcus K.",
      role: "Indecisive Cinephile",
      stars: 5
    },
    {
      quote: "Deciding on study topics gave me major anxiety. letting Coach Munch pick my next task builds instant learning momentum.",
      author: "Linnea S.",
      role: "University Student",
      stars: 5
    }
  ]

  return (
    <div className="flex-grow flex flex-col bg-cream relative overflow-hidden">
      {/* Background Clover Particle System */}
      <div className="absolute top-10 left-5 text-4xl opacity-20 select-none animate-float">🍀</div>
      <div className="absolute top-1/4 right-8 text-3xl opacity-20 select-none animate-float-delayed">✨</div>
      <div className="absolute bottom-32 left-10 text-3xl opacity-20 select-none animate-float">🍀</div>
      <div className="absolute top-3/4 left-1/3 text-4xl opacity-10 select-none animate-float-delayed">🌟</div>
      <div className="absolute bottom-12 right-12 text-5xl opacity-15 select-none animate-float">🍀</div>

      {/* Main Container */}
      <div className="flex-1 flex flex-col justify-start items-center px-4 py-12 sm:px-6 lg:px-8 max-w-lg mx-auto w-full z-10 space-y-12">
        
        {/* Header Logo */}
        <div className="inline-flex items-center gap-2 animate-float text-center">
          <span className="text-5xl">🍀</span>
          <span className="font-display text-4xl font-extrabold tracking-tight text-primary-dark">
            MunchPick
          </span>
        </div>

        {/* Hero Section */}
        <div className="text-center space-y-4">
          <h1 className="font-display text-4xl sm:text-5xl font-black text-charcoal leading-tight">
            Stop Overthinking.<br />
            <span className="text-primary-dark">Start Choosing.</span>
          </h1>
          <p className="text-sm sm:text-base text-charcoal/70 leading-relaxed max-w-sm mx-auto">
            The AI-powered decision companion that picks for you, remembers your preferences, and reinforces confidence in your choices.
          </p>

          <div className="pt-4 max-w-xs mx-auto">
            {isLoggedIn ? (
              <Link
                href="/dashboard"
                className="w-full py-3.5 px-6 btn-clay-primary text-sm flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                Go to Dashboard
                <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <div className="space-y-3">
                <Link
                  href="/register"
                  className="w-full py-3.5 px-6 btn-clay-primary text-sm flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  Start Choosing — It's Free
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/login"
                  className="w-full py-3.5 px-6 border-2 border-charcoal/10 rounded-2xl bg-white hover:bg-charcoal/5 text-charcoal font-semibold text-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  Log In to Your Account
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Mascot Showcase Section */}
        <div className="w-full space-y-4 text-center">
          <div className="space-y-1">
            <h3 className="font-display font-black text-xl text-charcoal">
              Meet the Munch Team
            </h3>
            <p className="text-3xs text-charcoal/50 uppercase tracking-widest font-bold">
              Tailored guides for every dilemma
            </p>
          </div>

          <div className="flex gap-4 overflow-x-auto pb-4 pt-1 px-1 scrollbar-none snap-x snap-mandatory">
            {mascotTeam.map((m) => (
              <div
                key={m.name}
                className={`snap-center flex-shrink-0 w-36 glass-panel rounded-3xl p-4 border text-center flex flex-col items-center justify-between space-y-3 shadow-sm hover:scale-102 hover:shadow-md transition-all ${m.bg}`}
              >
                <Mascot character={m.character} expression="idle" size="sm" />
                <div>
                  <h4 className="font-display font-extrabold text-xs text-charcoal truncate w-full">
                    {m.name}
                  </h4>
                  <p className="text-[9px] text-charcoal/60 leading-snug mt-1 max-w-[110px] mx-auto">
                    {m.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* How It Works Steps */}
        <div className="w-full space-y-5">
          <h3 className="font-display font-black text-xl text-charcoal text-center">
            How MunchPick Works
          </h3>

          <div className="space-y-4">
            <div className="glass-card rounded-2xl p-4 border border-white/60 flex gap-3.5 items-start">
              <span className="w-6 h-6 rounded-full bg-primary/20 text-primary-dark flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5 shadow-inner">
                1
              </span>
              <div>
                <h4 className="text-xs font-bold text-charcoal">Enter your choices</h4>
                <p className="text-2xs text-charcoal/60 leading-relaxed mt-0.5">
                  Input options you're stuck between. Presets available to load quick food items instantly.
                </p>
              </div>
            </div>

            <div className="glass-card rounded-2xl p-4 border border-white/60 flex gap-3.5 items-start">
              <span className="w-6 h-6 rounded-full bg-secondary/20 text-secondary-dark flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5 shadow-inner">
                2
              </span>
              <div>
                <h4 className="text-xs font-bold text-charcoal">Smart weighted selection</h4>
                <p className="text-2xs text-charcoal/60 leading-relaxed mt-0.5">
                  Munch extracts tags and applies your learned preferences, adjusting probabilities dynamically.
                </p>
              </div>
            </div>

            <div className="glass-card rounded-2xl p-4 border border-white/60 flex gap-3.5 items-start">
              <span className="w-6 h-6 rounded-full bg-yellow/20 text-yellow-700 flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5 shadow-inner">
                3
              </span>
              <div>
                <h4 className="text-xs font-bold text-charcoal">Positive Reinforcement</h4>
                <p className="text-2xs text-charcoal/60 leading-relaxed mt-0.5">
                  Receive 3-5 positive, custom bullet points explaining why the chosen pick is awesome. Zero regret!
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Testimonials */}
        <div className="w-full space-y-4">
          <h3 className="font-display font-black text-xl text-charcoal text-center">
            Loved by Overthinkers
          </h3>
          
          <div className="space-y-4">
            {testimonials.map((t, idx) => (
              <div 
                key={idx}
                className="glass-card rounded-2xl p-4 border border-white/50 space-y-2.5 shadow-sm text-left"
              >
                <div className="flex gap-1">
                  {[...Array(t.stars)].map((_, i) => (
                    <Star key={i} className="w-3.5 h-3.5 fill-yellow text-yellow-700" />
                  ))}
                </div>
                <p className="text-xs text-charcoal/80 leading-relaxed italic">
                  "{t.quote}"
                </p>
                <div className="flex justify-between items-center text-3xs font-bold text-charcoal/50">
                  <span>{t.author}</span>
                  <span>{t.role}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Final CTA glass panel */}
        <div className="w-full glass-panel border-2 border-primary/20 rounded-3xl p-6 text-center space-y-4 shadow-md relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-primary/10 rounded-bl-full flex items-center justify-center pr-2 pb-2">
            <Sparkles className="w-5 h-5 text-primary-dark" />
          </div>
          
          <h3 className="font-display text-lg font-black text-charcoal leading-tight">
            Stop overanalyzing. Let Munch Pick.
          </h3>
          <p className="text-2xs text-charcoal/60 leading-normal max-w-xs mx-auto">
            Create an account in 30 seconds and let our lucky clovers take the mental weight off your shoulders.
          </p>
          <div className="pt-2">
            <Link
              href={isLoggedIn ? "/dashboard" : "/register"}
              className="py-3 px-6 btn-clay-primary text-xs inline-flex items-center gap-2 cursor-pointer transition-all shadow-sm"
            >
              Get Started for Free
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Footer */}
        <footer className="w-full text-center text-3xs text-charcoal/40 pt-6 border-t border-charcoal/5">
          MunchPick © {new Date().getFullYear()}. Built with love, clovers, and positive reinforcement.
        </footer>
      </div>
    </div>
  )
}
