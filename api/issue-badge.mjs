import { handler } from '../netlify/functions/issue-badge.mjs';
import { run } from '../lib/vercel-bridge.mjs';

export default async function issueBadge(request, response) {
  return run(response, handler, request);
}
