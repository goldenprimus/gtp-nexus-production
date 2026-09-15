import crypto from 'node:crypto';
import { json, onlyAdmin, readBody, requireUser, service } from './_auth.mjs';

export default async (event) => {
  if (event.httpMethod !== 'POST') return json(405,{error:'Method not allowed.'});
  try {
    const { profile } = await requireUser(event); onlyAdmin(profile); const { staffId } = readBody(event);
    if (!staffId) return json(400,{error:'Staff account is required.'});
    const client = service(); const { data: staff, error: staffError } = await client.from('profiles').select('id,full_name,status').eq('id',staffId).single();
    if (staffError || staff.status !== 'active') return json(404,{error:'Active staff account not found.'});
    const badgeId=crypto.randomUUID(); const secret=crypto.randomBytes(32).toString('base64url'); const hash=crypto.createHash('sha256').update(secret).digest('hex');
    const { error: disableError } = await client.from('staff_badges').update({active:false}).eq('staff_id',staff.id).eq('active',true); if(disableError) throw disableError;
    const { error: badgeError } = await client.from('staff_badges').insert({id:badgeId,staff_id:staff.id,token_hash:hash,active:true,issued_by:profile.id}); if(badgeError) throw badgeError;
    return json(201,{qrValue:`GTPA|${badgeId}|${secret}`});
  } catch(error) { return json(error.status || 500,{error:error.message || 'Unable to issue QR badge.'}); }
};
