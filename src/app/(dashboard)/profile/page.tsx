'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { logout } from '@/app/auth/actions'
import { clearAssetCache } from '@/lib/assets-client'
import { 
  LogOut, 
  Mail, 
  ShieldAlert, 
  Award, 
  Edit3, 
  Save, 
  X, 
  Camera, 
  Trash2,
  Check,
  Sun,
  Moon,
  Clock
} from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import Mascot from '@/components/Mascot'
import { MASCOT_REGISTRY, MascotCharacter } from '@/lib/mascots/registry'
import { useConversationPresence } from '@/hooks/useConversationPresence'
import { useTheme } from '@/lib/theme/ThemeContext'

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  // Profile fields
  const [isEditingName, setIsEditingName] = useState(false)
  const [editName, setEditName] = useState('')
  const [updatingName, setUpdatingName] = useState(false)
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [selectedMascot, setSelectedMascot] = useState<MascotCharacter>('munch')

  // Stats
  const [stats, setStats] = useState({ totalDecisions: 0, favoriteCategory: 'None yet' })

  // Pacing/accessibility preferences from hook
  const { preferences, setPreferences } = useConversationPresence()
  const { themeMode, resolvedTheme, setThemeMode } = useTheme()

  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      
      if (user) {
        setEditName(user.user_metadata?.full_name || user.email?.split('@')[0] || '')
        
        // Fetch preferred mascot from profile
        const { data: profile } = await supabase
          .from('users')
          .select('preferred_mascot, avatar_url')
          .eq('id', user.id)
          .maybeSingle()
        
        if (profile?.preferred_mascot) {
          setSelectedMascot(profile.preferred_mascot as MascotCharacter)
        }
        if (profile?.avatar_url) {
          setAvatarUrl(profile.avatar_url)
        }
      }

      try {
        const res = await fetch('/api/preferences')
        if (res.ok) {
          const statsData = await res.json()
          let favorite = 'None yet'
          let maxCount = 0
          if (statsData.categoryDistribution) {
            Object.entries(statsData.categoryDistribution).forEach(([cat, count]) => {
              if ((count as number) > maxCount) {
                maxCount = count as number
                favorite = cat
              }
            })
          }
          setStats({
            totalDecisions: statsData.totalDecisions || 0,
            favoriteCategory: favorite,
          })
        }
      } catch (err) {
        console.error('Failed to load stats', err)
      }

      setLoading(false)
    }
    loadProfile()
  }, [])

  const handleSaveName = async () => {
    if (!editName.trim() || !user) return
    setUpdatingName(true)
    setFeedbackMsg(null)
    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.updateUser({
        data: { full_name: editName.trim() },
      })
      if (error) throw error
      
      // Update users table
      await supabase
        .from('users')
        .update({ name: editName.trim() })
        .eq('id', user.id)

      setUser(data.user)
      setIsEditingName(false)
      showFeedback('Display name updated successfully!')
    } catch (err: any) {
      console.error(err)
      showFeedback(err.message || 'Failed to update name')
    } finally {
      setUpdatingName(false)
    }
  }

  const handleMascotSelect = async (mascot: MascotCharacter) => {
    if (!user) return
    setSelectedMascot(mascot)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('users')
        .update({ preferred_mascot: mascot })
        .eq('id', user.id)

      if (error) throw error
      showFeedback(`Preferred companion changed to ${MASCOT_REGISTRY[mascot].name}!`)
    } catch (err: any) {
      console.error(err)
      showFeedback('Failed to update preferred companion.')
    }
  }

  // Persistent Base64 Avatar Upload/Replace/Remove
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && user) {
      const reader = new FileReader()
      reader.onloadend = async () => {
        const base64String = reader.result as string
        setAvatarUrl(base64String)
        try {
          const supabase = createClient()
          const { error } = await supabase
            .from('users')
            .update({ avatar_url: base64String })
            .eq('id', user.id)
          if (error) throw error
          showFeedback('Avatar uploaded and saved successfully!')
        } catch (err) {
          console.error(err)
          showFeedback('Failed to save avatar image.')
        }
      }
      reader.readAsDataURL(file)
    }
  }

  const handleAvatarRemove = async () => {
    if (!user) return
    setAvatarUrl(null)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('users')
        .update({ avatar_url: null })
        .eq('id', user.id)
      if (error) throw error
      showFeedback('Avatar removed successfully!')
    } catch (err) {
      console.error(err)
      showFeedback('Failed to remove avatar.')
    }
  }

  const showFeedback = (msg: string) => {
    setFeedbackMsg(msg)
    setTimeout(() => setFeedbackMsg(null), 3000)
  }

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      clearAssetCache()
      const supabase = createClient()
      await supabase.auth.signOut()
      try {
        await logout()
      } catch {
        // NEXT_REDIRECT handled by window.location
      }
    } catch (err) {
      console.error('Failed to log out', err)
    } finally {
      window.location.href = '/'
    }
  }

  if (loading) {
    return (
      <div className="flex-grow flex flex-col items-center justify-center py-16 space-y-3">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-2xs text-charcoal/40 font-bold uppercase">Loading profile...</span>
      </div>
    )
  }

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'
  const userInitial = userName.charAt(0).toUpperCase()
  const userEmail = user?.email || ''

  return (
    <div className="flex-grow flex flex-col h-[100dvh] relative overflow-hidden px-4 md:px-6 py-6 select-none max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between border-b border-white/40 pb-4 mb-6">
        <div>
          <h2 className="font-display font-black text-2xl text-charcoal">
            Companion Profile Settings
          </h2>
          <p className="text-2xs text-charcoal/50 font-bold uppercase tracking-wider block mt-1">
            Personalize your identity, companion preferences, and workspace experience.
          </p>
        </div>
      </div>

      {feedbackMsg && (
        <div className="flex items-start gap-2 bg-primary/20 border border-primary-dark/20 text-primary-dark rounded-xl p-3 text-2xs mb-4 flex-shrink-0">
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* Main Settings Grid */}
      <div className="flex-1 overflow-y-auto space-y-6 pr-1 scrollbar-thin pb-6">
        
        {/* Profile Card & Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 glass-card bg-white/80 border border-white/95 rounded-3xl p-6 shadow-md flex flex-col items-center text-center">
            {/* Avatar Upload Container */}
            <div className="relative group w-24 h-24 mb-4">
              {avatarUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img 
                  src={avatarUrl} 
                  alt={userName} 
                  className="w-full h-full rounded-full object-cover border-4 border-white shadow-md"
                />
              ) : (
                <div className="w-full h-full rounded-full bg-secondary text-secondary-dark flex items-center justify-center font-bold text-3xl border-4 border-white shadow-md">
                  {userInitial}
                </div>
              )}

              {/* Upload Overlay Controls */}
              <label className="absolute inset-0 rounded-full bg-charcoal/40 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-all duration-200">
                <Camera className="w-6 h-6 text-white" />
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleAvatarUpload}
                  className="hidden" 
                />
              </label>
            </div>

            {/* Remove Avatar Button */}
            {avatarUrl && (
              <button
                onClick={handleAvatarRemove}
                className="text-[10px] text-red-500 font-bold hover:underline mb-4 flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                <span>Remove Photo</span>
              </button>
            )}

            {/* Editable Name */}
            <div className="w-full max-w-xs mb-1">
              {isEditingName ? (
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value.slice(0, 50))}
                    placeholder="Your name"
                    disabled={updatingName}
                    className="flex-grow px-3 py-1.5 border border-charcoal/20 rounded-xl bg-white/80 focus:outline-none focus:ring-2 focus:ring-primary/40 text-center text-xs font-bold text-charcoal"
                  />
                  <button
                    onClick={handleSaveName}
                    disabled={updatingName || !editName.trim()}
                    className="p-2 bg-primary hover:bg-primary-dark text-primary-dark border border-primary-dark/30 rounded-xl cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      setEditName(userName)
                      setIsEditingName(false)
                    }}
                    disabled={updatingName}
                    className="p-2 bg-white/80 hover:bg-charcoal/5 border border-charcoal/10 text-charcoal/70 rounded-xl cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 mb-2">
                  <h2 className="font-display text-lg font-black text-charcoal leading-tight">
                    {userName}
                  </h2>
                  <button
                    onClick={() => setIsEditingName(true)}
                    className="p-1 rounded-lg text-charcoal/40 hover:text-charcoal hover:bg-charcoal/5 transition-colors cursor-pointer"
                  >
                    <Edit3 className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-xs text-charcoal/60 mb-6 justify-center">
              <Mail className="w-3.5 h-3.5 text-charcoal/40" />
              <span>{userEmail}</span>
            </div>

            <button
              onClick={() => setShowConfirm(true)}
              className="w-full py-3 px-4 bg-white hover:bg-red-50 border border-charcoal/10 rounded-2xl text-xs font-bold text-charcoal/60 hover:text-red-500 shadow-2xs hover:shadow-xs active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log Out Account</span>
            </button>
          </div>

          {/* Stats Card */}
          <div className="md:col-span-2 glass-card bg-white/80 border border-white/95 rounded-3xl p-6 shadow-md flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-charcoal/40 block mb-4">
                Companion Journey Stats
              </span>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-cream/45 border border-charcoal/5 rounded-2xl">
                  <span className="text-2xs font-bold text-charcoal/40 block">Decisions Settled</span>
                  <span className="text-xl font-display font-black text-charcoal mt-1 block">
                    {stats.totalDecisions}
                  </span>
                </div>
                <div className="p-4 bg-cream/45 border border-charcoal/5 rounded-2xl">
                  <span className="text-2xs font-bold text-charcoal/40 block">Focus Category</span>
                  <span className="text-base font-display font-black text-charcoal mt-1 block capitalize truncate">
                    {stats.favoriteCategory}
                  </span>
                </div>
              </div>
            </div>

            <div className="border-t border-charcoal/10 pt-4 mt-6 text-2xs text-charcoal/50 leading-relaxed font-medium">
              You joined Munch on <strong className="text-charcoal">{user?.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Today'}</strong>. Every conversation and journal page helps quiet your mind.
            </div>
          </div>
        </div>

        {/* Mascot Select preferences */}
        <div className="glass-card bg-white/80 border border-white/95 rounded-3xl p-6 shadow-md">
          <span className="text-[10px] font-black uppercase tracking-wider text-charcoal/40 block mb-4">
            Select Your Primary Companion
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Object.values(MASCOT_REGISTRY).map(mascot => {
              const isSelected = selectedMascot === mascot.id
              return (
                <div
                  key={mascot.id}
                  onClick={() => handleMascotSelect(mascot.id)}
                  className={`p-3.5 rounded-2xl border text-left cursor-pointer transition-all flex items-center gap-3 relative overflow-hidden group ${
                    isSelected
                      ? 'bg-[#E3F4EA] border-[#C9EDD6] shadow-3xs'
                      : 'bg-white border-transparent hover:bg-cream/40 shadow-2xs'
                  }`}
                >
                  <Mascot character={mascot.id} expression="idle" size={44} className="drop-shadow-2xs" />
                  <div className="min-w-0">
                    <span className="text-xs font-bold block text-charcoal leading-tight">
                      {mascot.name}
                    </span>
                    <span className="text-[9px] text-charcoal/40 block mt-0.5 capitalize truncate">
                      {mascot.species}
                    </span>
                  </div>
                  {isSelected && (
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 bg-primary-dark text-white rounded-full flex items-center justify-center">
                      <Check className="w-2.5 h-2.5" strokeWidth={3} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Workspace Display Preferences */}
        <div className="glass-card bg-white/80 border border-white/95 rounded-3xl p-6 shadow-md">
          <span className="text-[10px] font-black uppercase tracking-wider text-charcoal/40 block mb-4">
            Workspace Preferences
          </span>
          <div className="space-y-6">
            {/* Theme Mode Selector */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="text-xs font-bold text-charcoal block">Day / Night Theme</span>
                  <span className="text-2xs text-charcoal/40 font-medium block mt-0.5">
                    Auto switches at 6:00 AM (Light) and 6:00 PM (Dark) local time.
                  </span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-charcoal/5 text-charcoal/60 capitalize">
                  Currently {resolvedTheme}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => setThemeMode('auto')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    themeMode === 'auto'
                      ? 'bg-primary-dark text-white border-primary-dark shadow-2xs'
                      : 'bg-white/80 hover:bg-cream/40 text-charcoal/70 border-charcoal/10'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Auto</span>
                </button>
                <button
                  type="button"
                  onClick={() => setThemeMode('light')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    themeMode === 'light'
                      ? 'bg-primary-dark text-white border-primary-dark shadow-2xs'
                      : 'bg-white/80 hover:bg-cream/40 text-charcoal/70 border-charcoal/10'
                  }`}
                >
                  <Sun className="w-3.5 h-3.5" />
                  <span>Light</span>
                </button>
                <button
                  type="button"
                  onClick={() => setThemeMode('dark')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    themeMode === 'dark'
                      ? 'bg-primary-dark text-white border-primary-dark shadow-2xs'
                      : 'bg-white/80 hover:bg-cream/40 text-charcoal/70 border-charcoal/10'
                  }`}
                >
                  <Moon className="w-3.5 h-3.5" />
                  <span>Dark</span>
                </button>
              </div>
            </div>

            <div className="border-t border-charcoal/5 pt-4">
              {/* Animation motion pacing */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-charcoal block">Reduced Motion</span>
                  <span className="text-2xs text-charcoal/40 font-medium block mt-0.5">
                    Saves battery and simplifies breathing loops for companions.
                  </span>
                </div>
                <button
                  onClick={() => setPreferences({ profile: preferences.profile === 'reduced-motion' ? 'standard' : 'reduced-motion' })}
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                    preferences.profile === 'reduced-motion' ? 'bg-primary-dark' : 'bg-charcoal/20'
                  }`}
                >
                  <div 
                    className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${
                      preferences.profile === 'reduced-motion' ? 'left-6' : 'left-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-charcoal/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-cream border-2 border-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-float">
            <div className="flex items-center gap-3 mb-4 text-secondary-dark">
              <div className="p-2 bg-secondary/30 rounded-xl">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h3 className="font-display font-extrabold text-lg text-charcoal">
                Confirm Log Out
              </h3>
            </div>
            <p className="text-xs text-charcoal/70 leading-relaxed mb-6">
              Are you sure you want to log out? Your decisions are safe, and Munch will be waiting here for your next choice!
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={loggingOut}
                className="flex-1 py-2.5 border-2 border-charcoal/10 rounded-2xl bg-white hover:bg-charcoal/5 font-semibold text-xs text-charcoal cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex-1 py-2.5 btn-clay-secondary text-xs flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
              >
                {loggingOut ? 'Logging Out...' : 'Log Out'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
