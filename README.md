# GTP Nexus — production staff accounts

This is the production-ready replacement for the demo. It uses:

- **Supabase Authentication** for individual staff passwords, email invitations and password reset.
- **PostgreSQL Row Level Security** so ordinary staff can view only their own profile, attendance and documents.
- **Netlify Functions** for privileged actions. The Supabase service-role key never reaches the browser.
- **Server-validated QR attendance**. QR badge secrets are random and the database stores only a SHA-256 hash.

## One-time setup

### 1. Create the company Supabase project

Create a new project at [Supabase](https://supabase.com/dashboard). Under **Authentication > URL Configuration**, set:

- Site URL: your final `https://...netlify.app` address
- Additional Redirect URLs: the same Netlify address, plus any custom company domain

Under **Authentication > Providers > Email**, keep email enabled. For production delivery, configure a company SMTP provider in Supabase so invitations come from your company address.

Run the entire [`supabase-schema.sql`](supabase-schema.sql) file in **SQL Editor**.

### 2. Create the first administrator

In **Authentication > Users**, choose **Add user > Create new user**. Use a company-controlled email and choose a strong temporary password (or send an invite). Copy the User UID.

At the bottom of `supabase-schema.sql`, replace the sample values in the documented `insert into public.profiles...` statement. Run that single statement with the UID, name and email of the first administrator.

### 3. Configure the browser client

Copy `site/config.example.js` to `site/config.js`. In **Supabase > Project Settings > API**, copy:

- Project URL → `supabaseUrl`
- Publishable/anon key → `supabaseAnonKey`

The anon key is intentionally public; database RLS is what protects data. Never place the **service role key** in `config.js`.

### 4. Deploy to Netlify

Deploy the complete `gtp-nexus-production` folder—not a single HTML file. Because this system contains protected Netlify Functions, do **not** use Netlify’s simple drag-and-drop HTML deploy. Use either a Git-connected Netlify site or the Netlify CLI from this folder:

```powershell
npm install
npx netlify deploy --prod --dir site --functions netlify/functions
```

In Netlify **Site configuration > Environment variables**, add:

| Variable | Value |
| --- | --- |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Your Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service-role key — server only |
| `PUBLIC_SITE_URL` | Your final Netlify HTTPS URL |

Then redeploy. Do not commit, email or paste `SUPABASE_SERVICE_ROLE_KEY` into source files or chat.

## Using real staff accounts

1. Sign in as the first administrator.
2. Open **Staff accounts** → **Create staff account**.
3. Enter the staff member’s business email and role, then send the secure invitation.
4. The staff member sets their own password from the invitation email and signs in.
5. As Admin, click **Issue QR** for that staff member and print or deliver the generated badge securely.
6. Staff scan their own badge while signed in. An `attendance_kiosk` account can be used on a dedicated reception/workshop tablet to process every badge.

To prevent a lost badge from being reused, issue a replacement QR. The previous badge is immediately invalidated.

## Enable the company management system

The staff-account foundation is now extended with a secure operations module: Command Centre, Job Register, Production Board, Procurement, and QA/QC.

1. In Supabase **SQL Editor**, run the complete [`supabase-operations-migration.sql`](supabase-operations-migration.sql) file.
2. Redeploy this same `gtp-nexus-production` folder to Netlify:

   ```powershell
   npx netlify deploy --prod --dir site --functions netlify/functions
   ```

   After deploying, open `https://YOUR-NETLIFY-SITE/.netlify/functions/health`. It must show `status: "ok"` and `supabaseServerConfigured: true`. If it does not, server-only functionality such as invitations and job creation cannot work yet.

3. Sign in as an `admin` or `manager`. You will see the new management navigation items.
4. Open **Command centre** → **Create job**. The first job created will be stored in the protected database—not only in the browser.
5. Update a job from the register to record progress, workflow stage, and an activity note. The Production Board updates automatically.

Staff with the `staff` role do not see the company-wide job register unless they are assigned to a project in a future assignment release. This is intentional access control.

## Important scope

This build implements real staff identity, roles, QR attendance, profile/document access and admin invitations. Job/project tables from the earlier prototype should be migrated next into Supabase and protected with the same role policy. File uploads should use a private Supabase Storage bucket and store only the resulting path in `staff_documents`.
