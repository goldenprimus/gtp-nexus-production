import { json, onlyAdmin, readBody, requireUser, service } from './_auth.mjs';

const roles = new Set(['staff','manager','attendance_kiosk','admin']);
export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405,{error:'Method not allowed.'});
  try {
    const { profile: caller } = await requireUser(event); onlyAdmin(caller);
    const body = readBody(event); const fullName = String(body.fullName || '').trim(); const email = String(body.email || '').trim().toLowerCase();
    const department = String(body.department || '').trim(); const jobTitle = String(body.jobTitle || '').trim(); const role = String(body.role || 'staff');
    if (!fullName || !email || !department || !jobTitle || !/^\S+@\S+\.\S+$/.test(email) || !roles.has(role)) return json(400,{error:'Provide a valid name, work email, department, job title and role.'});
    const client = service(); const { data: sequence, error: sequenceError } = await client.rpc('next_staff_sequence');
    if (sequenceError) throw sequenceError;
    const staffCode = `GTP-STF-${String(sequence).padStart(5,'0')}`;
    const { data: invite, error: inviteError } = await client.auth.admin.inviteUserByEmail(email,{data:{full_name:fullName,staff_code:staffCode},redirectTo:process.env.PUBLIC_SITE_URL || undefined});
    if (inviteError) return json(400,{error:inviteError.message});
    const { error: profileError } = await client.from('profiles').insert({id:invite.user.id,staff_code:staffCode,full_name:fullName,email,department,job_title:jobTitle,role,status:'active'});
    if (profileError) { await client.auth.admin.deleteUser(invite.user.id); throw profileError; }
    return json(201,{staffCode,message:'Invitation sent.'});
  } catch(error) { return json(error.status || 500,{error:error.message || 'Unable to create staff account.'}); }
};
