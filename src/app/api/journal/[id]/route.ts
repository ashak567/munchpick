import { NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { jsonNoStore } from '@/lib/api-headers'

// PUT update a journal entry
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return jsonNoStore({ error: 'Unauthorized.' }, { status: 401 })
    }

    const { id } = await params
    const { title, content } = await request.json()

    if (!title?.trim() || !content?.trim()) {
      return jsonNoStore({ error: 'Title and content are required.' }, { status: 400 })
    }

    const { data: entry, error } = await supabase
      .from('journal_entries')
      .update({
        title: title.trim(),
        content: content.trim(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) throw error

    return jsonNoStore({ entry })
  } catch (error: any) {
    console.error('PUT /api/journal/[id] failed:', error)
    return jsonNoStore({ error: error.message || 'Server error.' }, { status: 500 })
  }
}

// DELETE a journal entry
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return jsonNoStore({ error: 'Unauthorized.' }, { status: 401 })
    }

    const { id } = await params

    const { error } = await supabase
      .from('journal_entries')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw error

    return jsonNoStore({ success: true })
  } catch (error: any) {
    console.error('DELETE /api/journal/[id] failed:', error)
    return jsonNoStore({ error: error.message || 'Server error.' }, { status: 500 })
  }
}
