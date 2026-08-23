import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { serverEnv } from '@/lib/env'

export async function createClient() {
  const cookieStore = await cookies()

  const client = createServerClient(
    serverEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method can be called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )

  // Dev-mode QA bypass
  if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_USE_MOCK_AUTH === 'true') {
    const originalGetUser = client.auth.getUser.bind(client.auth)
    client.auth.getUser = async (jwt?: string) => {
      const res = await originalGetUser(jwt)
      if (!res.data.user) {
        return {
          data: {
            user: {
              id: '00000000-0000-0000-0000-000000000000',
              email: 'qa-user@munchpick.com',
              user_metadata: { full_name: 'QA Preview User' },
              created_at: new Date().toISOString(),
              app_metadata: {},
              aud: 'authenticated',
              role: 'authenticated',
            } as any,
          },
          error: null,
        }
      }
      return res
    }

  }

  return client
}
