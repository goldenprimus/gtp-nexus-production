import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY;

export function json(status, payload) { return { statusCode: status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(payload) }; }
export function service() { if (!url || !serviceKey) throw new Error('Supabase server environment is not configured.'); return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } }); }
export async function requireUser(event) {
  const token = event.headers.authorization?.replace(/^Bearer\s+/i,'');
  if (!token || !anonKey) throw Object.assign(new Error('Authentication required.'),{status:401});
  const client = createClient(url, anonKey, { auth: { autoRefreshToken:false, persistSession:false }, global:{headers:{Authorization:`Bearer ${token}`}} });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) throw Object.assign(new Error('Session expired. Sign in again.'),{status:401});
  const { data: profile, error: profileError } = await service().from('profiles').select('*').eq('id',data.user.id).single();
  if (profileError || !profile || profile.status !== 'active') throw Object.assign(new Error('This account is not active.'),{status:403});
  return { user:data.user, profile };
}
export function onlyAdmin(profile) { if (profile.role !== 'admin') throw Object.assign(new Error('Administrator access required.'),{status:403}); }
export function readBody(event) { try { return JSON.parse(event.body || '{}'); } catch { throw Object.assign(new Error('Invalid request.'),{status:400}); } }
