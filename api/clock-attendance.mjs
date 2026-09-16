import { handler } from '../netlify/functions/clock-attendance.mjs';
import { run } from '../lib/vercel-bridge.mjs';

export default async function clockAttendance(request, response) {
  return run(response, handler, request);
}
