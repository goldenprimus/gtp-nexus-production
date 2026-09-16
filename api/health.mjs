import { handler } from '../netlify/functions/health.mjs';
import { run } from '../lib/vercel-bridge.mjs';

export default async function health(request, response) {
  return run(response, handler, request);
}
