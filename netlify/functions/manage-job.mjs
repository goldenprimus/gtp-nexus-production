import { json, readBody, requireUser, service } from './_auth.mjs';

const statuses = new Set(['planned','production','quality_review','ready_for_dispatch','completed','delayed']);
const clean = (value, max = 1000) => String(value || '').trim().slice(0,max);

function managerRequired(profile) {
  if (!['admin','manager'].includes(profile.role)) throw Object.assign(new Error('Project Manager or Administrator access required.'),{status:403});
}

export const handler = async (event) => {
  if(event.httpMethod !== 'POST') return json(405,{error:'Method not allowed.'});
  try {
    const { profile } = await requireUser(event); managerRequired(profile); const body=readBody(event); const client=service();
    if(body.action === 'create') {
      const title=clean(body.title,180), clientName=clean(body.clientName,180), note=clean(body.note,4000); const serviceLineId=Number(body.serviceLineId); const dueDate=body.dueDate || null; const startDate=body.startDate || null; const value=Number(body.contractValue || 0);
      if(!title || !clientName || !Number.isInteger(serviceLineId) || serviceLineId<1 || serviceLineId>10 || value<0) return json(400,{error:'Provide a title, client, service line and valid contract value.'});
      const {data:seq,error:seqError}=await client.rpc('next_job_sequence'); if(seqError) throw seqError;
      const code=`GTP-${new Date().getUTCFullYear().toString().slice(-2)}-${String(seq).padStart(5,'0')}`;
      const {data:job,error:jobError}=await client.from('jobs').insert({job_code:code,title,client_name:clientName,service_line_id:serviceLineId,start_date:startDate,due_date:dueDate,contract_value:value,project_note:note,manager_id:profile.id,created_by:profile.id}).select('id,job_code').single(); if(jobError) throw jobError;
      const {error:updateError}=await client.from('job_updates').insert({job_id:job.id,message:'Job created and placed in Planned.',progress:0,status:'planned',created_by:profile.id}); if(updateError) throw updateError;
      return json(201,{job});
    }
    if(body.action === 'update') {
      const jobId=clean(body.jobId,80), status=clean(body.status,40), progress=Number(body.progress), message=clean(body.message,2000); if(!jobId || !statuses.has(status) || !Number.isInteger(progress) || progress<0 || progress>100 || !message) return json(400,{error:'Provide a valid status, completion percentage and activity note.'});
      const {data:job,error:findError}=await client.from('jobs').select('id').eq('id',jobId).single(); if(findError || !job) return json(404,{error:'Job not found.'});
      const {error:jobError}=await client.from('jobs').update({status,progress,project_note:clean(body.note,4000) || null}).eq('id',jobId); if(jobError) throw jobError;
      const {error:updateError}=await client.from('job_updates').insert({job_id:jobId,message,progress,status,created_by:profile.id}); if(updateError) throw updateError;
      return json(200,{message:'Job updated.'});
    }
    if(body.action === 'addProcurement') {
      const jobId=clean(body.jobId,80), itemName=clean(body.itemName,180), quantity=clean(body.quantity,120), supplier=clean(body.supplier,180), status=clean(body.status,40)||'requested';
      if(!jobId||!itemName||!['requested','sourcing','ordered','received','delayed'].includes(status)) return json(400,{error:'Provide a job, material name and valid procurement status.'});
      const {error}=await client.from('procurement_items').insert({job_id:jobId,item_name:itemName,quantity,supplier,status,created_by:profile.id}); if(error) throw error;
      return json(201,{message:'Procurement item added.'});
    }
    if(body.action === 'addQuality') {
      const jobId=clean(body.jobId,80), recordName=clean(body.recordName,180), status=clean(body.status,40)||'open', inspectionDate=body.inspectionDate||null;
      if(!jobId||!recordName||!['open','accepted','rejected','on_hold'].includes(status)) return json(400,{error:'Provide a job, record name and valid QA/QC status.'});
      const {error}=await client.from('quality_records').insert({job_id:jobId,record_name:recordName,status,inspection_date:inspectionDate,created_by:profile.id}); if(error) throw error;
      return json(201,{message:'QA/QC record added.'});
    }
    return json(400,{error:'Unsupported job action.'});
  } catch(error) { return json(error.status || 500,{error:error.message || 'Unable to manage job.'}); }
};
