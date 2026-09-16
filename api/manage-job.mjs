import { handler } from '../netlify/functions/manage-job.mjs';
import { run } from '../lib/vercel-bridge.mjs';

export default async function manageJob(request, response) {
  return run(response, handler, request);
}
