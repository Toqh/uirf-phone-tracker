# Survey Phone Tracker

A production-oriented PWA for recording survey phone readiness, issue, return, faults, and custody history. It uses Next.js 16.4, TypeScript, Supabase Auth/Postgres, database-enforced Row Level Security, and Vercel-compatible server rendering.

## What is included

- Pending signup flow with separate **view approval** and **Admin promotion** actions.
- Admin-only phone, team directory, import, checkout, return, fault, correction, and account operations.
- Read-only Supervisor access enforced by grants, RLS, and checked database functions.
- Three-digit text serials, readiness records, one active checkout per phone, row locks for concurrent handovers, server timestamps, and immutable audit/history records.
- Mapped UTF-8 CSV imports with previews, duplicate/invalid row reporting, stable generated codes, and downloadable templates.
- Filtered A4 reports, browser printing, paginated PDF download, and formula-safe CSV exports.
- Installable manifest and service worker that caches only public icons. Protected data and pages are never service-worker cached.
- Responsive, keyboard-friendly interface using Africa/Lagos for display while PostgreSQL stores `timestamptz` values in UTC.

The readiness checklist records that setup was completed. It cannot remotely install or configure survey software on a phone.

## Requirements

- Node.js 22 or newer
- pnpm 10
- A Supabase project
- Optional for local database tests: Docker and the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started)

## Local setup

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Create a Supabase project. In **Project Settings → API**, copy the project URL and publishable key.

3. Copy `.env.example` to `.env.local` and replace both placeholders:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
   ```

   The publishable key is expected in browser code and is safe to expose with the included RLS policies. Do not add a service-role key to this app.

4. Apply the database migration:

   ```bash
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   supabase db push
   ```

   Alternatively, run [the migration](supabase/migrations/202610140001_initial_schema.sql) once in the Supabase SQL editor.

5. In **Authentication → URL Configuration**, set the site URL to `http://localhost:3000` for local work and add `http://localhost:3000/auth/confirm` as a redirect URL. Add the equivalent final Vercel URLs after deployment.

   When email confirmation is enabled, open **Authentication → Email Templates → Confirm signup** and use this URL for the confirmation link:

   ```text
   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
   ```

   The app also accepts Supabase's PKCE `code` callback, but the token-hash template works when a user opens the email on a different browser or device.

6. Start the app:

   ```bash
   pnpm dev
   ```

## Establish the first Admin

There is deliberately no browser or public API route that can create the first Admin.

1. Sign up normally in the app with the intended administrator's full name, email, and password. This creates a pending Supervisor profile.
2. Open the Supabase SQL editor as the project owner and run the following once, replacing the email:

   ```sql
   update public.profiles
   set role = 'admin',
       status = 'approved',
       approved_at = now(),
       approved_by = id,
       updated_at = now()
   where lower(email) = lower('first.admin@example.org')
     and status = 'pending';
   ```

3. Confirm that exactly one row changed. Sign out and back in. That Admin can approve other accounts and may separately promote an already-approved Supervisor. Neither signup metadata nor authenticated Data API calls have permission to change roles.

Keep at least two active Admins after initial setup to avoid lockout. Supabase project owners can recover access with the same SQL editor process if all Admin accounts are unavailable.

## CSV imports

Templates are available in the app and under [`public/templates`](public/templates):

| Import | Columns |
| --- | --- |
| Phones | `phone_serial` |
| Supervisors | `supervisor_code,full_name,email` |
| Enumerators | `enumerator_code,full_name,supervisor_code` |

Only `phone_serial` is required for phones; only `full_name` is required for people. Blank codes receive stable generated identifiers. Enumerator supervisor links use exact supervisor codes. A missing code fails that row; the importer never guesses from an ambiguous name. Existing codes and serials are skipped rather than overwritten.

Spreadsheet software may coerce `007` to `7` before upload. Format the source column as text when authoring a CSV. The importer itself reads raw CSV text and preserves `007`; exported values are quoted and cells beginning with formula characters are prefixed safely.

## Database security model

The migration enables RLS on every application table and revokes general write privileges from `anon` and `authenticated`. Approved users can read operational records. Only an approved Admin can execute write functions. Those functions obtain the actor from `auth.uid()` and timestamps from PostgreSQL `now()`.

`issue_phone` and `return_phone` lock the phone/checkout rows in the transaction. A partial unique index also guarantees at most one checkout with no return timestamp per phone. Configuration state is retained separately from current availability. Checkout records hold enumerator and supervisor snapshots so later renames or deactivation do not alter custody history. Corrections keep previous and corrected JSON values, a reason, actor, and timestamp.

History tables have delete-prevention triggers. Administrative database owners can still change the schema, so restrict Supabase dashboard/SQL-editor access to trusted project operators and keep platform backups enabled.

## Verification

Run the local checks:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

The unit tests cover leading-zero round trips, invalid/duplicate CSV rows, and export formula protection. The database test covers pending-account isolation, Supervisor read-only enforcement, self-promotion rejection, readiness checks, duplicate issue prevention, return actor capture, and `007` storage:

```bash
supabase start
supabase db reset
supabase test db
```

The partial unique index and `FOR UPDATE` lock are the database guarantees for concurrent checkout attempts. For release acceptance, also open two Admin sessions against the staging project, attempt to issue the same available phone at once, and confirm one succeeds and one receives “Phone is not available” or “Phone is already issued.”

## Vercel deployment

1. Push this folder to the GitHub repository.
2. In Vercel, choose **Add New → Project**, import the repository, and keep the detected Next.js settings.
3. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in **Project Settings → Environment Variables** for Production and Preview. Never configure a service-role key.
4. Deploy. Vercel supplies HTTPS, which is required for PWA installation and service workers.
5. Add `https://YOUR_VERCEL_DOMAIN` and `https://YOUR_VERCEL_DOMAIN/**` to Supabase **Authentication → URL Configuration**. Set the site URL to the production domain.
6. Apply migrations to the production Supabase project, establish the first Admin, and run the acceptance scenarios above with non-production test records before operational use.

## Register controls and CSV imports

Phone, directory, and account registers support sorting, filtering, row selection, and Admin-only bulk actions. Select-all targets the currently visible filtered rows. Bulk writes are saved per record, with separate success/failure results; failed writes are never automatically retried. Reports and recent import history also support sorting and filters.

Checklist reset is enabled **only for Available phones with completed checklists**, never for Issued phones. Reset requires a reason, returns the phone to Awaiting configuration, clears current readiness, and retains the original checklist and audit history. Completing it again creates a new history entry.

Existing Supabase projects must apply [the register-actions migration](supabase/migrations/202610150001_register_actions.sql) before using checklist reset or directory bulk activation. Run `supabase db push`, or execute that migration in the project's SQL editor. The migration does not delete records. Run `supabase test db` against a local test database after applying all migrations to verify the reset and permission rules.

The import screen offers a blank CSV template, a separate sample CSV, and a downloadable instructions file for each import type. Instructions are also displayed in the app. Keep serial/code columns as Text in spreadsheets, preserve leading zeros, and save CSV UTF-8. Import supervisors first when enumerators reference their codes. Do not upload instruction rows or unedited sample records.

## Install the PWA

- **Chrome or Edge on desktop/Android:** open the HTTPS deployment, use the install icon in the address bar or **Menu → Install Survey Phone Tracker**.
- **Safari on iPhone/iPad:** open the site, tap **Share → Add to Home Screen**.
- **Safari on macOS:** use **File → Add to Dock** on supported versions.

The first version requires a live connection for every record-changing action. Offline pages are not promised, and protected records are not cached. A failed or interrupted request remains visibly unsaved until Supabase confirms it.

## Repository connection

If this local folder has not yet been initialized after creating the GitHub repository:

```bash
git init
git branch -M main
git remote add origin https://github.com/YOUR_ORG/YOUR_REPOSITORY.git
git add .
git commit -m "Build Survey Phone Tracker"
git push -u origin main
```

Replace the remote URL with the repository URL you created. Review `.env.local` remains ignored before committing.

## Live-service setup still required

Dashboard issuing: Admins can use **Issue phones** for one phone or **Bulk-issue phones** for multiple phones. Select available serials or paste a comma/space/newline-separated list, choose one enumerator or supervisor as the recipient, and choose DASH or NUTRINT. Review the batch before confirming. Each phone is saved independently; the result lists successes and failures, without automatic retries. Supervisor-only checkouts require `supabase/migrations/202610150003_supervisor_issuing.sql` after all earlier migrations. This migration permits a supervisor as the direct holder and retains existing checkout/audit history.

For project-aware issuing, apply pending migrations in filename order, including `supabase/migrations/202610150002_checkout_projects.sql`, in the Supabase SQL editor before using the updated issue form. New checkouts require DASH or NUTRINT; supervisor is optional. Earlier checkouts retain a blank project because it was not recorded. Enumerator selection supports a dropdown and name/code search of active entries. The project is included in the register, movement history, CSV and PDF exports. Run `supabase/tests/001_security_and_workflows.sql` against a test database with pgTAP after applying all migrations.

No Supabase or Vercel credentials are stored in this repository. The application and policies can be compiled and tested locally without committing credentials, but authentication, shared-data behavior, migrations, email delivery, and the final deployment must be verified against the Supabase/Vercel projects you configure.
