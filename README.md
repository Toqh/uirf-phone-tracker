# Survey Phone Tracker

A production-oriented PWA for recording survey phone readiness, issue, return, faults, and custody history. It uses Next.js 16.4, TypeScript, Supabase Auth/Postgres, database-enforced Row Level Security, and Vercel-compatible server rendering.

## What is included

- Immediate signup access: Enumerators see only their assigned phones, Supervisors have register/report viewing access, and **Admin promotion** is separate.
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

1. Sign up normally in the app with the intended administrator's full name, email, role, and confirmed password. This creates an enabled profile for the selected viewing role. Confirm the email if required by Supabase.
2. Open the Supabase SQL editor as the project owner and run the following once, replacing the email:

   ```sql
   update public.profiles
   set role = 'admin',
       status = 'approved',
       approved_at = now(),
       approved_by = id,
       updated_at = now()
   where lower(email) = lower('first.admin@example.org')
     and status in ('pending', 'approved')
     and role in ('enumerator', 'supervisor');
   ```

3. Confirm that exactly one row changed. Sign out and back in. That Admin can manage accounts and separately promote another enabled account. Signup grants viewing access as Enumerator or Supervisor; it cannot grant Admin access.

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

The migrations enable RLS on every application table and revoke general write privileges from `anon` and `authenticated`. Approved Admins and Supervisors can read operational records. Enumerators can read only their own profile, linked directory entry, currently assigned phones and active checkouts. They cannot read other people's records, returned checkouts, reports, configuration history, faults, corrections or audit history. Only an approved Admin can execute write functions. Those functions obtain the actor from `auth.uid()` and timestamps from PostgreSQL `now()`.

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

Admins can use **Bulk return phones** on Overview to select current checkouts by serial, holder or project, paste serial numbers, or select all matching issued phones. Review the phones and confirm they were received in good condition before saving. Each return uses the existing `return_phone` operation, closes the active checkout, retains history and makes the phone available again. Successes and failures are shown separately without automatic retries. Return faulty phones individually in Phone management so their fault details are recorded. No new database migration is needed for this action.

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

If the privacy migration reports `column c.project does not exist`, apply the full [`202610150002_checkout_projects.sql`](supabase/migrations/202610150002_checkout_projects.sql) migration first, then rerun the privacy migration. The project migration adds the column and updates both views and the issuing function; adding only the column leaves the app schema incomplete. Apply any other missing earlier migrations in filename order. The privacy migration now checks for this prerequisite before changing permissions.

Enumerator privacy: apply all pending migrations in filename order, ending with [`202610160003_enumerator_private_access.sql`](supabase/migrations/202610160003_enumerator_private_access.sql). The account-link migration `202610150005_enumerator_account_links.sql` must already be applied. Enumerators have only **My phones** navigation; direct requests for `/phones`, `/phones/[id]` and `/reports` redirect to their dashboard. Database restrictions also limit direct API queries to their current assignments and prevent access to other holders and historical records. Returning a phone, assigning it to someone else, disabling the account or removing its directory link revokes visibility. An unlinked enumerator sees no phones. Admin and Supervisor access is retained. Run `supabase test db` to check these rules, including `supabase/tests/004_enumerator_private_access.sql`.

If SQL Editor reports `invalid input value for enum account_role: "enumerator"`, the Enumerator role prerequisite is missing. Apply [`202610150004_account_roles.sql`](supabase/migrations/202610150004_account_roles.sql) in its own run before later migrations. For the immediate enum repair, run `alter type public.account_role add value if not exists 'enumerator';` by itself, wait for success, then rerun the entire automatic-viewing-access migration. Do not combine the enum addition and its first use in one transaction; PostgreSQL requires the addition to commit first. Apply any other missing migrations in filename order as well.

Signup role selection: apply all migrations in filename order, including [`202610160001_signup_roles.sql`](supabase/migrations/202610160001_signup_roles.sql) and [`202610160002_automatic_viewing_access.sql`](supabase/migrations/202610160002_automatic_viewing_access.sql), before releasing the updated signup form. New users select Enumerator or Supervisor and confirm their password; both password fields have visibility controls. Both roles receive viewing access automatically, with no administrator approval. Existing pending Enumerator and Supervisor profiles are also enabled by the migration; disabled accounts remain disabled. Email confirmation still follows Supabase Auth settings. Missing or unsupported role metadata defaults to Supervisor for compatibility; signup cannot grant Admin access. Automatic access sets `approved_at` and leaves `approved_by` empty. Run `supabase test db` locally to verify the signup permission tests.

Overview now links each Admin scorecard to the matching status in Phone management. Enumerator views display saved current checkouts and the pending-return count. Supervisors also see an enumerator roster with outstanding serials or “No phones pending”, including members with no current checkouts. Link approved accounts to the correct Directory entries and assign each enumerator's Usual supervisor to populate these personal views; checkout supervisor assignments also appear while outstanding. Returned phones drop out of pending lists.

Password recovery: Sign in → Forgot password sends a Supabase reset email. In Supabase Authentication → URL Configuration, allow `https://YOUR-VERCEL-DOMAIN/auth/recovery` (and `http://localhost:3000/auth/recovery` for local testing). The default Reset Password email using `{{ .ConfirmationURL }}` supports the code-exchange flow; open it in the browser that requested it. For cross-browser token-hash links, set the Reset Password email link to `{{ .SiteURL }}/auth/recovery?token_hash={{ .TokenHash }}&type=recovery` and ensure Site URL is your production URL. Do not point recovery emails at the signup confirmation route. Invalid/expired links return to the request form. Email delivery and rate limits depend on your Supabase SMTP configuration. No database migration is required for password recovery.

Personalised Overview: Admins see global counters and Register a phone / Bulk-issue phones / Issue phones below them, without the full register. Enumerators see only their current checkouts, without phone-history links; Supervisors see direct checkouts, checkouts naming them as supervisor, and current checkouts held by enumerators whose Usual supervisor is their directory entry. Apply the account-link and enumerator-privacy migrations, then use Directory → Edit → Linked login account for each Enumerator/Supervisor. No automatic name matching is performed. Phones and Reports pages are limited to Admins and Supervisors.

Role assignment is available in Accounts only, not on Overview. Apply `supabase/migrations/202610150004_account_roles.sql` after earlier migrations before using it. Approved, enabled accounts can be assigned Supervisor, Enumerator, or Admin; Admin has management access, Supervisor has register/report viewing access, and Enumerator can view only their assigned phones. Changes are audited, cannot target your own account, and do not automatically create phone-holder directory records. The migration must commit before assigning the new Enumerator role.

Dashboard issuing: Admins can use **Issue phones** for one phone or **Bulk-issue phones** for multiple phones. Select available serials or paste a comma/space/newline-separated list, choose one enumerator or supervisor as the recipient, and choose DASH or NUTRINT. Review the batch before confirming. Each phone is saved independently; the result lists successes and failures, without automatic retries. Supervisor-only checkouts require `supabase/migrations/202610150003_supervisor_issuing.sql` after all earlier migrations. This migration permits a supervisor as the direct holder and retains existing checkout/audit history.

For project-aware issuing, apply pending migrations in filename order, including `supabase/migrations/202610150002_checkout_projects.sql`, in the Supabase SQL editor before using the updated issue form. New checkouts require DASH or NUTRINT; supervisor is optional. Earlier checkouts retain a blank project because it was not recorded. Enumerator selection supports a dropdown and name/code search of active entries. The project is included in the register, movement history, CSV and PDF exports. Run `supabase/tests/001_security_and_workflows.sql` against a test database with pgTAP after applying all migrations.

No Supabase or Vercel credentials are stored in this repository. The application and policies can be compiled and tested locally without committing credentials, but authentication, shared-data behavior, migrations, email delivery, and the final deployment must be verified against the Supabase/Vercel projects you configure.
