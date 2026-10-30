import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { AppShell } from '@/components/layout/AppShell';

export const dynamic = 'force-dynamic';

/** Server-side gate: must be signed in AND have a shop profile. (Middleware also blocks anonymous visitors.) */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const store = await cookies();
  const sb = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: { getAll: () => store.getAll(), setAll: () => { /* middleware refreshes cookies */ } },
  });
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await sb.from('profiles').select('shop_id').eq('id', user.id).maybeSingle();
  if (!profile) redirect('/setup');
  return <AppShell>{children}</AppShell>;
}
