import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { serverEnv } from '@/lib/env'

const getGeminiModel = () => {
  const apiKey = serverEnv.GEMINI_API_KEY || ''
  if (!apiKey || apiKey === 'MOCK_KEY') return null
  const genAI = new GoogleGenerativeAI(apiKey)
  return genAI.getGenerativeModel({
    model: 'gemini-3.1-flash',
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 250
    }
  })
}

// GET all journal entries
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    const { data: entries, error } = await supabase
      .from('journal_entries')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ entries: entries || [] })
  } catch (error: any) {
    console.error('GET /api/journal failed:', error)
    return NextResponse.json({ error: error.message || 'Server error.' }, { status: 500 })
  }
}

// POST create a journal entry + generate AI reflection
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    const { title, content } = await request.json()
    if (!title?.trim() || !content?.trim()) {
      return NextResponse.json({ error: 'Title and content are required.' }, { status: 400 })
    }

    // 1. Get preferred mascot from user profile
    const { data: profile } = await supabase
      .from('users')
      .select('preferred_mascot')
      .eq('id', user.id)
      .maybeSingle()

    const preferredMascot = profile?.preferred_mascot || 'munch'
    const mascotName = preferredMascot.charAt(0).toUpperCase() + preferredMascot.slice(1)

    // 2. Call Gemini for a warm companion reflection
    let reflection = `I'm sitting here with your thoughts. Thank you for sharing them with me.`
    const model = getGeminiModel()
    
    if (model) {
      const prompt = `
You are ${mascotName}, a gentle, empathetic, and supportive companion.
The user has just written a private journal entry to express their thoughts:

Title: "${title.trim()}"
Content:
"${content.trim()}"

Write a short, warm, and highly validating reflection (1-3 sentences) on what they wrote.
- Address them directly and kindly.
- Focus on emotional validation, warmth, and keeping space for them.
- Do not offer advice or try to solve their problems.
- Keep the tone soft, companion-first, and reflective.
`
      try {
        const response = await model.generateContent(prompt)
        const text = response.response.text().trim()
        if (text) reflection = text
      } catch (err) {
        console.warn('[Journal AI Reflection] Gemini call failed:', err)
      }
    }

    // 3. Save entry to DB
    const { data: entry, error } = await supabase
      .from('journal_entries')
      .insert({
        user_id: user.id,
        title: title.trim(),
        content: content.trim(),
        reflection
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ entry })
  } catch (error: any) {
    console.error('POST /api/journal failed:', error)
    return NextResponse.json({ error: error.message || 'Server error.' }, { status: 500 })
  }
}
