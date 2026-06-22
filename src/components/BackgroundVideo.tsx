'use client'
 
import React, { useState, useEffect, useRef } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { getHeroMobileCached, getHeroDesktopCached } from '@/lib/assets-client'
 
export default function BackgroundVideo() {
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [showWarning, setShowWarning] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
 
  // Determine viewport size
  useEffect(() => {
    if (typeof window === 'undefined') return
 
    const checkViewport = () => {
      setIsMobile(window.innerWidth < 768)
    }
 
    checkViewport()
    window.addEventListener('resize', checkViewport)
    return () => window.removeEventListener('resize', checkViewport)
  }, [])
 
  // Load signed URLs based on viewport
  useEffect(() => {
    let active = true
 
    async function fetchVideo() {
      try {
        setLoading(true)
        const url = isMobile 
          ? await getHeroMobileCached() 
          : await getHeroDesktopCached()
 
        if (active) {
          if (url) {
            setVideoUrl(url)
            setHasError(false)
            setShowWarning(false)
          } else {
            setVideoUrl(null)
            setHasError(true)
            // Show warning if custom assets are missing
            const dismissed = sessionStorage.getItem('dismissed-asset-warning')
            if (!dismissed) {
              setShowWarning(true)
            }
          }
        }
      } catch (err) {
        console.warn('[BackgroundVideo] Error retrieving signed video URL:', err)
        if (active) {
          setVideoUrl(null)
          setHasError(true)
          const dismissed = sessionStorage.getItem('dismissed-asset-warning')
          if (!dismissed) {
            setShowWarning(true)
          }
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }
 
    fetchVideo()
 
    return () => {
      active = false
    }
  }, [isMobile])
 
  // Handle video element load errors
  const handleVideoError = () => {
    console.warn('[BackgroundVideo] Error loading video stream from signed URL')
    setHasError(true)
    const dismissed = sessionStorage.getItem('dismissed-asset-warning')
    if (!dismissed) {
      setShowWarning(true)
    }
  }
 
  // Dismiss warning
  const dismissWarning = () => {
    setShowWarning(false)
    sessionStorage.setItem('dismissed-asset-warning', 'true')
  }
 
  return (
    <>
      {/* Video Background */}
      {videoUrl && !hasError && (
        <video
          ref={videoRef}
          key={videoUrl}
          src={videoUrl}
          autoPlay
          loop
          muted
          playsInline
          onError={handleVideoError}
          className="fixed inset-0 w-full h-full object-cover -z-20 opacity-20 pointer-events-none select-none transition-opacity duration-1000 animate-fadeIn"
        />
      )}
 
      {/* Warning Notice Banner */}
      {showWarning && (
        <div className="fixed bottom-24 right-4 left-4 sm:left-auto sm:w-80 z-50 animate-bounce-short">
          <div className="glass-panel border-2 border-yellow/40 rounded-2xl p-4 shadow-xl flex gap-3 items-start relative bg-white/90 backdrop-blur-md">
            <div className="p-1.5 rounded-lg bg-yellow/20 text-yellow-700 mt-0.5">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div className="flex-1 space-y-0.5">
              <h4 className="text-2xs font-black text-charcoal uppercase tracking-wider">Default Mode Active</h4>
              <p className="text-[10px] text-charcoal/70 leading-relaxed font-semibold">
                Personalized assets not found. Showing default experience.
              </p>
            </div>
            <button
              onClick={dismissWarning}
              className="text-charcoal/40 hover:text-charcoal/80 p-1 rounded-lg hover:bg-charcoal/5 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
