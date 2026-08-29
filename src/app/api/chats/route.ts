import { NextRequest } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { jsonNoStore } from '@/lib/api-headers';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return jsonNoStore({ error: 'Unauthorized.' }, { status: 401 });
    }

    // Fetch all chats strictly owned by the authenticated user
    const { data: chats, error } = await supabase
      .from('chats')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Fetch latest message for each chat to show as a preview
    const chatsWithPreviews = await Promise.all(
      (chats || []).map(async (chat) => {
        const { data: messages } = await supabase
          .from('chat_messages')
          .select('content, created_at')
          .eq('chat_id', chat.id)
          .order('created_at', { ascending: false })
          .limit(1);

        const latestMsg = messages && messages.length > 0 ? messages[0] : null;

        return {
          id: chat.id,
          status: chat.status,
          state: chat.state,
          created_at: chat.created_at,
          updated_at: chat.updated_at,
          primaryMascot: chat.metadata?.primaryMascot || chat.metadata?.lastMascot || 'munch',
          activeTopicKey: chat.metadata?.activeTopicKey || 'general',
          preview: latestMsg ? latestMsg.content : 'No messages yet.',
          last_activity: latestMsg ? latestMsg.created_at : chat.updated_at
        };
      })
    );

    return jsonNoStore({ chats: chatsWithPreviews });
  } catch (error: any) {
    console.error('GET /api/chats failed:', error);
    return jsonNoStore({ error: error.message || 'Server error.' }, { status: 500 });
  }
}

/**
 * POST /api/chats
 * Dedicated endpoint to start a brand-new conversation session.
 * Archives any existing active chats for the authenticated user and initializes
 * a fresh conversation with a zero-turn history and welcome message.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return jsonNoStore({ error: 'Unauthorized.' }, { status: 401 });
    }

    // 1. Archive any currently active chats for this user
    await supabase
      .from('chats')
      .update({
        status: 'archived',
        state: 'Archived'
      })
      .eq('user_id', user.id)
      .eq('status', 'active');

    // 2. Fetch preferred mascot for user
    const { data: profile } = await supabase
      .from('users')
      .select('preferred_mascot')
      .eq('id', user.id)
      .maybeSingle();

    const prefMascot = profile?.preferred_mascot || 'munch';

    // 3. Create a clean active chat
    const { data: newChat, error: chatError } = await supabase
      .from('chats')
      .insert({
        user_id: user.id,
        status: 'active',
        state: 'Listening',
        metadata: {
          primaryMascot: prefMascot,
          lastMascot: prefMascot,
          activeTopicKey: 'general',
          branches: {
            general: { state: 'Listening', paths: [], mascot: prefMascot }
          }
        }
      })
      .select()
      .single();

    if (chatError) throw chatError;

    // 4. Insert default welcome message for the new chat
    const { data: welcomeMsg, error: msgError } = await supabase
      .from('chat_messages')
      .insert({
        chat_id: newChat.id,
        sender: 'mascot',
        content: "What's on your mind today? I'm here to listen.",
        mascot_character: prefMascot,
        mascot_expression: 'idle'
      })
      .select()
      .single();

    if (msgError) throw msgError;

    return jsonNoStore({
      chat: newChat,
      messages: [welcomeMsg]
    }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/chats failed:', error);
    return jsonNoStore({ error: error.message || 'Server error.' }, { status: 500 });
  }
}
