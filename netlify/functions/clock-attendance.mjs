import crypto from 'node:crypto';
import { json, readBody, requireUser, service } from './_auth.mjs';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405,{error:'Method not allowed.'});
  try {
    const { profile: scannerProfile } = await requireUser(event); const { qrValue } = readBody(event); const parts=String(qrValue || '').split('|');
    if (parts.length !== 3 || parts[0] !== 'GTPA') return json(400,{error:'This is not a valid GTP attendance badge.'});
    const [ , badgeId, secret ]=parts; const hash=crypto.createHash('sha256').update(secret).digest('hex'); const client=service();
    const { data: badge, error: badgeError }=await client.from('staff_badges').select('id,staff_id,token_hash,active,profiles!inner(full_name,status)').eq('id',badgeId).eq('active',true).single();
    if (badgeError || !badge || !crypto.timingSafeEqual(Buffer.from(hash),Buffer.from(badge?.token_hash || '', 'utf8'))) return json(400,{error:'Badge is invalid or has been replaced.'});
    if (badge.profiles.status !== 'active') return json(403,{error:'The linked staff account is not active.'});
    if (!['admin','attendance_kiosk'].includes(scannerProfile.role) && scannerProfile.id !== badge.staff_id) return json(403,{error:'You can scan only your own attendance badge.'});
    const { data: openRecord, error: openError }=await client.from('attendance').select('id').eq('staff_id',badge.staff_id).is('clock_out',null).order('clock_in',{ascending:false}).limit(1).maybeSingle(); if(openError) throw openError;
    const now=new Date().toISOString(); let action;
    if(openRecord) { const {error}=await client.from('attendance').update({clock_out:now,clock_out_by:scannerProfile.id}).eq('id',openRecord.id); if(error)throw error; action='Clock-out'; }
    else { const {error}=await client.from('attendance').insert({staff_id:badge.staff_id,clock_in:now,clock_in_by:scannerProfile.id}); if(error)throw error; action='Clock-in'; }
    return json(200,{action,fullName:badge.profiles.full_name,at:now});
  } catch(error) { return json(error.status || 500,{error:error.message || 'Unable to record attendance.'}); }
};
