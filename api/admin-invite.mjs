import { handler } from '../netlify/functions/admin-invite.mjs';
import { run } from '../lib/vercel-bridge.mjs';

export default async function adminInvite(request, response) {
  return run(response, handler, request);
}
