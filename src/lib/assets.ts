'use server'
 
import { createClient } from '@/utils/supabase/server'
 
/**
 * Resolves the signed URL for the hero mobile video.
 */
export async function getHeroMobileUrl(): Promise<string | null> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
 
    const { data: assets } = await supabase
      .from('user_assets')
      .select('hero_mobile_path')
      .eq('user_id', user.id)
      .maybeSingle()
 
    const path = assets?.hero_mobile_path || `${user.id}/hero-mobile.mp4`
 
    const { data, error } = await supabase.storage
      .from('user-videos')
      .createSignedUrl(path, 3600)
 
    if (error || !data) {
      console.warn(`[Assets Server] Failed to sign hero-mobile url for path ${path}:`, error?.message)
      return null
    }
 
    return data.signedUrl
  } catch (error) {
    console.error('[Assets Server] Error in getHeroMobileUrl:', error)
    return null
  }
}
 
/**
 * Resolves the signed URL for the hero desktop video.
 */
export async function getHeroDesktopUrl(): Promise<string | null> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
 
    const { data: assets } = await supabase
      .from('user_assets')
      .select('hero_desktop_path')
      .eq('user_id', user.id)
      .maybeSingle()
 
    const path = assets?.hero_desktop_path || `${user.id}/hero-desktop.mp4`
 
    const { data, error } = await supabase.storage
      .from('user-videos')
      .createSignedUrl(path, 3600)
 
    if (error || !data) {
      console.warn(`[Assets Server] Failed to sign hero-desktop url for path ${path}:`, error?.message)
      return null
    }
 
    return data.signedUrl
  } catch (error) {
    console.error('[Assets Server] Error in getHeroDesktopUrl:', error)
    return null
  }
}
 
/**
 * Resolves the signed URL for a specific mascot image.
 */
export async function getMascotUrl(mascotName: string): Promise<string | null> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
 
    const { data: assets } = await supabase
      .from('user_assets')
      .select('mascot_base_path')
      .eq('user_id', user.id)
      .maybeSingle()
 
    // Clean mascot name format
    const mascotFile = mascotName.endsWith('.png') ? mascotName : `${mascotName}.png`
    const path = assets?.mascot_base_path 
      ? `${assets.mascot_base_path}/${mascotFile}` 
      : `${user.id}/${mascotFile}`
 
    const { data, error } = await supabase.storage
      .from('user-mascots')
      .createSignedUrl(path, 3600)
 
    if (error || !data) {
      console.warn(`[Assets Server] Failed to sign mascot url for character ${mascotName}:`, error?.message)
      return null
    }
 
    return data.signedUrl
  } catch (error) {
    console.error('[Assets Server] Error in getMascotUrl:', error)
    return null
  }
}
