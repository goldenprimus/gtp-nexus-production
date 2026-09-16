-- Run once in Supabase SQL Editor after the original schema and operations migration.
alter table public.staff_documents add column if not exists file_name text;
alter table public.staff_documents add column if not exists file_size bigint;
insert into storage.buckets (id,name,public) values ('staff-documents','staff-documents',false) on conflict (id) do nothing;
create policy "admins upload staff documents" on storage.objects for insert to authenticated with check (bucket_id='staff-documents' and public.is_gtp_admin());
create policy "admins view staff documents" on storage.objects for select to authenticated using (bucket_id='staff-documents' and public.is_gtp_admin());
create policy "admins delete staff documents" on storage.objects for delete to authenticated using (bucket_id='staff-documents' and public.is_gtp_admin());
