import { createClient } from '@/utils/supabase/server';
import { jsonNoStore } from '@/lib/api-headers';

export async function GET() {
  try {
    const supabase = await createClient();
    
    // Authenticate user
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return jsonNoStore(
        { error: 'Unauthorized. Please sign in.' },
        { status: 401 }
      );
    }

    // Retrieve memories strictly owned by user.id
    const { data: memories, error } = await supabase
      .from('user_memories')
      .select('*')
      .eq('user_id', user.id)
      .order('relevance_score', { ascending: false })
      .order('last_referenced_at', { ascending: false });

    if (error) {
      console.error('Error fetching memories:', error);
      throw error;
    }

    return jsonNoStore({ memories: memories || [] });
  } catch (error: any) {
    console.error('GET /api/memories failed:', error);
    return jsonNoStore(
      { error: error instanceof Error ? error.message : 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}
