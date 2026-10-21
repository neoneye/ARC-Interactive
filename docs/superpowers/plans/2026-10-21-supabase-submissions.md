# Supabase Submissions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the braingridgame (Heroku) submission endpoint and review UI with Supabase plus static pages in `webroot/`.

**Architecture:**
- **Database.** One Supabase table, `submissions`, with row-level security.
  - Anonymous players write only through a `SECURITY DEFINER` RPC, `submit_history`.
  - Only the signed-in admin (neoneye@gmail.com) can select rows, update their status, or delete them.
- **Shared helpers.** Pure logic (UUID, fully-solved check, export format, delete partition, paging, chunking) lives in `webroot/submission.js`. It is a classic browser script that also exports itself to Node, so `node --test` covers it.
- **Pages.**
  - The game posts with plain `fetch`.
  - The review list (`review.html`) and the replay review mode (`history.html?submissionId=N`) use supabase-js from a pinned CDN URL, loaded on demand.

**Tech Stack:** Plain HTML/CSS/JS (no build, no package.json), Supabase (Postgres 15+, PostgREST, Auth magic link), `@supabase/supabase-js@2.45.4` UMD from jsdelivr, Node 22 `node --test`, local Postgres 16 (`/opt/homebrew/opt/postgresql@16/bin`) for SQL tests.

**Spec:** `docs/superpowers/specs/2026-10-21-supabase-submissions-design.md`

## Global Constraints

- **Supabase project:**
  - URL: `https://nimirzkqrnhkuiewjmxz.supabase.co`
  - Ref: `nimirzkqrnhkuiewjmxz`
  - Admin email: `neoneye@gmail.com`
- **Build tooling:** no package.json, bundler or Supabase CLI. Tests run with `node --test tests/` and `supabase/test/run-tests.sh`.
- **Defining the URL and anon key:** both are defined exactly once, in `webroot/supabase-config.js`.
- **Status values:** `pending`, `approved`, `rejected` (default `pending`).
- **Payload limit:** reject payloads over 5 MB (`5 * 1024 * 1024` bytes, measured with `octet_length`).
- **What the game submits:** only fully-solved histories, meaning `summary["test unsolved count"] == 0`. The server enforces the same rule.
- **Storing the history:** the `json` column stores the client's history string verbatim (`text`, not `jsonb`). Never inline it into HTML.
- **Export file:**
  - Filename: `review-YYYY-MM-DDTHH-MM-SS.json` (UTC; braingridgame's `'%Y-%m-%dT%H-%M-%S'`).
  - Content: an array of `{user_id: null, timestamp, review_status, fully_solved, update_uuid, json, json_size}`, ordered by id ascending.
- **Delete:** never automatic. It is only an explicit, confirmed click.
- **Game page:** submitting is fire-and-forget. It never throws into, or blocks, gameplay.
- **Code style:** follow the existing style (classes such as `PageController`, `gPageController`, `body_onload()`, 4-space indent, `console.log` breadcrumbs).

## Review Focus

1. **Supabase is down or slow while a player submits.** The game behaves exactly as today, and no exception escapes. Pinned by `submitHistoryToSupabase resolves false when fetch rejects` (Task 2).
2. **History strings with quotes, backslashes, unicode or `</script>`.** These are stored and exported byte-identical. Pinned by the SQL test `verbatim round-trip` (Task 1) and `buildReviewExport keeps json string identical` (Task 2).
3. **More than 1000 rows.** PostgREST caps responses at 1000 rows by default, so the list must page until it has every row. Pinned by `fetchAllPages concatenates until short page` (Task 2).
4. **A signed-in user who isn't the admin.** They see zero rows and can't update or delete anything. Pinned by the SQL test `non-admin authenticated sees and changes nothing` (Task 1).
5. **A re-submit from the same page load after the row was approved or rejected.** It's ignored and must not reset the status to pending. Pinned by the SQL test `upsert ignores reviewed row` (Task 1).

---

### Task 1: Supabase schema, RLS, RPC, SQL tests, setup notes

**Files:**
- Create: `supabase/schema.sql`
- Create: `supabase/test/supabase-stub.sql`: stands in for Supabase's environment on plain Postgres:
  - roles `anon` and `authenticated`, both `NOLOGIN`
  - schema `auth` with `auth.jwt()`, which returns `coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb`
  - Supabase's default privileges: `grant usage on schema public to anon, authenticated` plus `alter default privileges in schema public grant all on tables to anon, authenticated`. These make RLS, not missing grants, the thing under test.
- Create: `supabase/test/schema-tests.sql`
- Create: `supabase/test/run-tests.sh`:
  - `initdb` a temp cluster in `mktemp -d` and start it with `pg_ctl` on port 54329, socket in the temp dir
  - run stub → schema → tests with `psql -v ON_ERROR_STOP=1`
  - stop and remove the cluster on exit (`trap`)
  - print `ALL SQL TESTS PASSED`
- Create: `supabase/README.md`, with setup notes:
  1. Paste `schema.sql` into the SQL editor and run it.
  2. Create the user `neoneye@gmail.com` under Auth → Users ("Add user", "Send magic link" not needed).
  3. Auth → URL Configuration:
     - Site URL: `https://neoneye.github.io/arc/`
     - Redirect URLs: `https://neoneye.github.io/arc/review.html`, `https://neoneye.github.io/arc-staging/review.html`, `http://127.0.0.1:5500/**`, `http://localhost:5500/**`
  4. Copy the anon/publishable key from Project Settings → API into `webroot/supabase-config.js`.
  5. Workflow: Download → `full_sync.py` → Delete.

**Interfaces:**
- Produces, used by Tasks 2–5:
  - table `public.submissions(id bigint identity pk, created_at timestamptz default now(), updated_at timestamptz default now(), update_uuid uuid unique not null, dataset_id text not null, task_id text not null, json text not null, json_size int not null, fully_solved bool not null, review_status text not null default 'pending' check in (pending, approved, rejected), downloaded_at timestamptz null)`
  - `public.submit_history(p_update_uuid uuid, p_json text) returns text`: returns `'stored'` or `'ignored'`, and raises on invalid input
  - `public.is_admin() returns boolean`, which checks `auth.jwt()->>'email' = 'neoneye@gmail.com'`
  - RPC endpoint: `POST /rest/v1/rpc/submit_history` with body `{"p_update_uuid": "...", "p_json": "..."}`

- [ ] **Step 1: Write the stub and the failing tests.** In `schema-tests.sql`, each test is a `DO $$ ... $$` block that `RAISE EXCEPTION`s on failure. Switch role with `set role anon` / `set role authenticated`, set the claims with `select set_config('request.jwt.claims', '{"email":"..."}', false)`, and `reset role` between tests. Tests:
  - **`anon submit stores row`.** As anon, call `submit_history(gen_random_uuid(), <fully solved json>)`, which returns `'stored'`. Then, as postgres, check:
    - one row exists
    - `dataset_id`/`task_id` were copied from `dataset`/`task`
    - `json_size = octet_length(json)`
    - `fully_solved = true` and `review_status = 'pending'`
  - **`same uuid upserts`.** A second call with the same uuid and different json returns `'stored'`. There is still one row, `json` is the new string and `updated_at >= created_at`.
  - **`upsert ignores reviewed row`.** Set `review_status='approved'` as postgres. Another submit with that uuid returns `'ignored'`, and the status and json are unchanged.
  - **`rejects unsolved`.** `"test unsolved count": 1` raises.
  - **`rejects bad input`.** Each of these raises:
    - JSON that doesn't parse
    - missing `dataset`, or an empty `task`
    - missing `summary`
    - a payload of `5*1024*1024 + 1` bytes (build it with `repeat`)
  - **`accepts large`.** A valid payload of about 2.5 MB is stored.
  - **`verbatim round-trip`.** The json contains `"msg":"it's \"quoted\" \\ </script> ü 🧩"`, and the stored `json` equals the input exactly.
  - **`anon cannot touch table`.** As anon, `select count(*)` returns 0 rows or raises, and `update`/`delete`/`insert` raise or affect 0 rows.
  - **`non-admin authenticated sees and changes nothing`.** With claims email `someone@example.com`: select returns 0, and `update ... set review_status='approved'` and `delete` affect 0 rows (check with `GET DIAGNOSTICS`).
  - **`admin can review`.** With claims email `neoneye@gmail.com`:
    - select sees every row
    - updating `review_status` and `downloaded_at` works
    - updating `json` raises, because column-level grants restrict updates to `review_status` and `downloaded_at`
    - delete works
  - **`status check`.** As admin, `review_status='bogus'` raises.

- [ ] **Step 2: Run them and confirm they fail.** Run: `supabase/test/run-tests.sh` (schema.sql is empty). Expected: it fails on the first test because `submit_history` doesn't exist.

- [ ] **Step 3: Write `supabase/schema.sql`.** It must be idempotent (`create table if not exists`, `create or replace function`, drop and recreate policies).
  - `alter table submissions enable row level security`.
  - Policies for `authenticated`: select, update and delete, each `using (public.is_admin())`.
  - Column grants: `revoke update on submissions from anon, authenticated`, then `grant update (review_status, downloaded_at) on submissions to authenticated`.
  - `submit_history` is `security definer set search_path = public, pg_temp`:
    - validate the size first, then `p_json::jsonb`
    - `insert ... on conflict (update_uuid) do update set ... where submissions.review_status = 'pending'`
    - use `FOUND` to return `'stored'` or `'ignored'`
  - `revoke execute on function submit_history from public`, then `grant execute ... to anon, authenticated`.
  - `is_admin()` is `stable`; grant execute to `authenticated`.
  - Add a `before update` trigger that sets `updated_at = now()`.

- [ ] **Step 4: Run the tests and confirm they pass.** Run: `supabase/test/run-tests.sh`. Expected: `ALL SQL TESTS PASSED`.

- [ ] **Step 5: Commit.**
```bash
git add supabase/
git commit -m "Supabase schema for puzzle submissions, with RLS and SQL tests"
```

---

### Task 2: Shared helpers and config

**Files:**
- Create: `webroot/submission.js`: a classic script that defines global functions and ends with `if (typeof module !== 'undefined') { module.exports = { ... }; }`
- Create: `webroot/supabase-config.js`
- Create: `tests/submission.test.js`, which uses `node:test` and `node:assert/strict` and `require('../webroot/submission.js')`

**Interfaces:**
- Consumes: the RPC contract from Task 1.
- Produces, in `submission.js`:
  - `generateUuidV4(getRandomValues = globalThis.crypto?.getRandomValues?.bind(globalThis.crypto)) -> string`:
    - prefers `crypto.randomUUID` when it exists and `getRandomValues` wasn't passed explicitly
    - otherwise builds a v4 UUID from 16 random bytes
    - falls back to `Math.random` bytes when there's no `getRandomValues`
  - `isFullySolvedHistoryJson(jsonString) -> boolean`: true iff the string parses and `summary["test unsolved count"] === 0`. It never throws.
  - `async submitHistoryToSupabase(updateUuid, jsonString, { url = SUPABASE_URL, key = SUPABASE_ANON_KEY, fetchFn = fetch } = {}) -> Promise<boolean>`:
    - sends `POST ${url}/rest/v1/rpc/submit_history`
    - headers: `apikey: key`, `Content-Type: application/json`, plus `Authorization: Bearer ${key}` only when `key` starts with `eyJ` (legacy JWT anon key)
    - body: `{p_update_uuid, p_json}`
    - resolves true on `response.ok`, otherwise false. It catches everything and only uses `console.log`/`console.error`.
  - `reviewExportFilename(date) -> 'review-YYYY-MM-DDTHH-MM-SS.json'` (UTC).
  - `buildReviewExport(rows) -> array`:
    - input rows are `{id, created_at, review_status, fully_solved, update_uuid, json, json_size}`
    - output is sorted by id ascending, and each item is `{user_id: null, timestamp: created_at, review_status, fully_solved, update_uuid, json, json_size}`
  - `partitionRowsForDelete(rows) -> {safeIds, unsafeIds}`: a row is safe when it's `review_status === 'rejected'` or has `downloaded_at != null`. Both id lists keep the input order.
  - `async fetchAllPages(fetchPage, pageSize = 1000) -> array`:
    - calls `fetchPage(from, to)` with an inclusive range: (0, 999), (1000, 1999) and so on
    - concatenates results until a page is shorter than `pageSize`
    - if `fetchPage` throws, the error propagates
  - `chunk(array, size) -> array[]`.
- Produces, in `supabase-config.js`:
  - `const SUPABASE_URL = 'https://nimirzkqrnhkuiewjmxz.supabase.co'`
  - `const SUPABASE_ANON_KEY = '<paste from Project Settings → API>'`. Simon supplies the value. Until then, keep the placeholder; `submitHistoryToSupabase` then gets a 401 and resolves false.
  - `const SUPABASE_JS_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js'`
  - `async function loadSupabaseClient() -> SupabaseClient`:
    - injects the script tag once and memoizes the promise
    - returns `supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)`
    - not unit-tested; it's browser-only

- [ ] **Step 1: Write the failing tests** in `tests/submission.test.js`:
  - **`generateUuidV4 with getRandomValues`.** Pass a fake `getRandomValues` that fills zeros. The result matches `/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/` and equals `'00000000-0000-4000-8000-000000000000'`.
  - **`generateUuidV4 without crypto`.** Pass `null`. The result matches the same regex.
  - **`isFullySolvedHistoryJson`.**
    - `{"summary":{"test unsolved count":0}}` → true
    - `{"summary":{"test unsolved count":1}}` → false
    - `'not json'`, `'{}'` and `'null'` → false
  - **`submitHistoryToSupabase posts rpc`.** A fake `fetchFn` records its args and returns `{ok: true}`.
    - The URL is `'https://x.supabase.co/rest/v1/rpc/submit_history'`.
    - The body parses to `{p_update_uuid: 'u', p_json: '{"a":1}'}`.
    - `headers.apikey === 'k'`, and there's no `Authorization` header because `'k'` isn't a JWT.
    - It resolves true.
  - **`submitHistoryToSupabase adds bearer for jwt key`.** With `key: 'eyJabc'`, `Authorization === 'Bearer eyJabc'`.
  - **`submitHistoryToSupabase resolves false when fetch rejects`.** It resolves false, and so does `{ok: false, status: 400, text: async () => 'bad'}`.
  - **`reviewExportFilename`.** `new Date(Date.UTC(2026, 9, 21, 19, 40, 2, 345))` → `'review-2026-10-21T19-40-02.json'`.
  - **`buildReviewExport keeps json string identical`.**
    - Input: two rows with ids 7 and 3, one of which has a json containing `"it's \"q\" </script> ü"`.
    - The output is ordered [3, 7] and has the exact keys `['user_id','timestamp','review_status','fully_solved','update_uuid','json','json_size']`.
    - The json is `===` the input, and `user_id === null`.
  - **`partitionRowsForDelete`.** Input rows:
    - `{id:1, review_status:'rejected', downloaded_at:null}`
    - `{id:2, review_status:'approved', downloaded_at:'2026-…'}`
    - `{id:3, review_status:'pending', downloaded_at:null}`
    - `{id:4, review_status:'approved', downloaded_at:null}`

    The result is `{safeIds:[1,2], unsafeIds:[3,4]}`.
  - **`fetchAllPages concatenates until short page`.** A fake returns 1000, 1000 and then 5 items. The total is 2005, and the calls were `[[0,999],[1000,1999],[2000,2999]]`.
  - **`fetchAllPages exact multiple`.** A fake returns 1000 and then 0 items. The total is 1000.
  - **`chunk`.** `chunk([1,2,3,4,5], 2)` deep-equals `[[1,2],[3,4],[5]]`.

- [ ] **Step 2: Run them and confirm they fail.** Run: `node --test tests/`. Expected: FAIL with "Cannot find module '../webroot/submission.js'".

- [ ] **Step 3: Implement `webroot/submission.js` and `webroot/supabase-config.js`** as specified in Interfaces. `submission.js` reads `SUPABASE_URL`/`SUPABASE_ANON_KEY` via `typeof` guards, so Node can load it without the config.

- [ ] **Step 4: Run the tests and confirm they pass.** Run: `node --test tests/`. Expected: all pass.

- [ ] **Step 5: Commit.**
```bash
git add webroot/submission.js webroot/supabase-config.js tests/
git commit -m "Submission helpers and Supabase config, with node tests"
```

---

### Task 3: The game submits to Supabase

**Files:**
- Modify: `webroot/edit.html`: add `<script src="supabase-config.js"></script>` and `<script src="submission.js"></script>` before `edit.js`.
- Modify: `webroot/edit.js`:
  - In `PageController` constructor (lines ~257-266), replace the `crypto.randomUUID` / `'no-crypto-random-uuid'` block with `this.updateUuid = generateUuidV4();`.
  - In `submitDrawing()` (~1781-1783), call `postHistoryFile` only when `isFullySolvedHistoryJson(jsonString)`; otherwise log `'Not fully solved, not posting history file.'`.
  - Replace the `postHistoryFile(filename, jsonString)` body (~1799-1829) so it calls `submitHistoryToSupabase(this.updateUuid, jsonString)` without awaiting it in `submitDrawing`. Delete the braingridgame URLs.

**Interfaces:**
- Consumes: `generateUuidV4`, `isFullySolvedHistoryJson`, `submitHistoryToSupabase` (Task 2).

- [ ] **Step 1: Make the edits above.** `grep -n braingridgame webroot/edit.js` must return nothing.
- [ ] **Step 2: Verify in the browser.**
  - Serve `webroot/` locally (e.g. `python3 -m http.server 5500 -d webroot`), open a single-test ARC task in `edit.html`, and submit a wrong answer. Expected: no network request to `supabase.co`.
  - Submit the correct answer. Expected: one POST to `/rest/v1/rpc/submit_history`, and the "correct" status shows as before.
  - With the placeholder key, the POST returns 401, the console shows the error, and gameplay is unaffected.
  - With the real key (Task 6), the response is `"stored"`.
- [ ] **Step 3: Run the regression tests.** Run: `node --test tests/`. Expected: all pass.
- [ ] **Step 4: Commit.**
```bash
git add webroot/edit.html webroot/edit.js
git commit -m "Submit fully solved histories to Supabase instead of braingridgame"
```

---

### Task 4: Review list page

**Files:**
- Create: `webroot/review.html`, modelled on braingridgame's `myapp/templates/review.html`:
  - titlebar: a left link to `.` ("Tasks"), "Review" in the center, and on the right the **Download** and **Delete** buttons plus a **Sign out** button
  - a sign-in panel with an email input and a "Send magic link" button
  - a status line
  - `#review-table` with columns: checkbox (`#select-all`), ID, Timestamp, Dataset, Task, Size, Fully solved, Status, Downloaded, Link
  - scripts: `common.js`, `supabase-config.js`, `submission.js`, `review.js`
- Create: `webroot/review.css`: table styling; reuse `common.css` classes such as `secondary-button` and `titlebar-container`.
- Create: `webroot/review.js`: a `PageController` with the methods below, plus `body_onload()`.

**Interfaces:**
- Consumes: `loadSupabaseClient`, `fetchAllPages`, `chunk`, `buildReviewExport`, `reviewExportFilename`, `partitionRowsForDelete` (Task 2), and the table from Task 1.
- Produces: links of the form `history.html?submissionId=<id>`, which Task 5 consumes.
- Methods:
  - `async onload()`: `Theme.assignBodyClassName()`, then `this.sb = await loadSupabaseClient()`, then `getSession()`. With no session, show the sign-in panel. With a session, call `loadRows()`.
  - `async sendMagicLink()`: calls `signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: window.location.origin + window.location.pathname } })`, then shows "Check your email".
  - `async signOut()`.
  - `async loadRows()`:
    - fetches through `fetchAllPages((from, to) => sb.from('submissions').select('id,created_at,dataset_id,task_id,json_size,fully_solved,review_status,downloaded_at').order('id', {ascending: false}).range(from, to))`, throwing on `error`; it never selects `json`
    - renders with DOM APIs (`textContent`), not string HTML
    - if the result is empty and the user is signed in, shows "No submissions (or this account is not the admin)"
  - `selectedRows()`: the row objects whose checkbox is checked.
  - `async reviewDownloadSelected()`:
    - if nothing is selected, `alert('No rows selected!')`
    - fetches `id,created_at,review_status,fully_solved,update_uuid,json,json_size` for the selected ids in `chunk(ids, 100)` batches with `.in('id', batch)`
    - writes `buildReviewExport(rows)` to a Blob and downloads it as `reviewExportFilename(new Date())`
    - then sets `downloaded_at = new Date().toISOString()` on those ids (in chunks) and calls `loadRows()`
    - if the download or the update fails, `alert` with the error
  - `async reviewDeleteSelected()`:
    - if nothing is selected, alert
    - computes `{safeIds, unsafeIds} = partitionRowsForDelete(selected)`
    - if `unsafeIds.length > 0`, confirms with: `${unsafeIds.length} selected row(s) are not downloaded and not rejected. OK = delete only the ${safeIds.length} downloaded/rejected row(s). Cancel = abort.` If OK is clicked and `safeIds` is empty, the result is just an alert.
    - if `unsafeIds.length == 0`, confirms with: `Are you sure you want to delete ${n} selected row(s)?`
    - deletes in chunks with `.delete().in('id', batch)`, then calls `loadRows()`

- [ ] **Step 1: Create the three files** per the Interfaces above.
- [ ] **Step 2: Verify in the browser** (needs Task 6's key and SQL).
  - Signed out, the sign-in panel shows and the table is hidden.
  - After the magic link, the rows show, newest first.
  - Select-all and Download: a `review-….json` file downloads, and the Downloaded column fills in.
  - Submit a new solved puzzle from another tab, reload, select-all and Delete: the warning names exactly 1 unsafe row, OK deletes only the others, and the new row remains.
  - `node --test tests/` still passes.
- [ ] **Step 3: Check the import.** Copy the downloaded file into `ARC-Interactive-History-Dataset/history_files/import_json/` in a **scratch copy** of that repo (never the real one), then run `python3 import_json_job.py`. Expected: one new `NN/MM.json` per row, with contents byte-identical to the submitted history string.
- [ ] **Step 4: Commit.**
```bash
git add webroot/review.html webroot/review.css webroot/review.js
git commit -m "Review list page backed by Supabase"
```

---

### Task 5: Replay review mode in history.html

**Files:**
- Modify: `webroot/history.html`:
  - In the titlebar right section (line ~172), add hidden `#review-approve` and `#review-reject` buttons and a hidden `#review-status` span, calling `gPageController.reviewApprove()` / `reviewReject()`.
  - Add `<script src="supabase-config.js"></script>` and `<script src="submission.js"></script>` before `history.js`.
- Modify: `webroot/history.js`:
  - **Constructor (~228-330).** When `urlParams.get('submissionId')` parses to a positive int:
    - set `this.submissionId` and skip the `historyJson` / `historyDirectoryContent` / GitHub URL logic entirely
    - hide `#goto-prev-file`, `#goto-next-file` and `#task-number`
    - point `#link-to-tasks-page` at `review.html` with the text "Review"
    - without `submissionId`, behaviour is unchanged
  - **Loading (~404-411).** Extract `async fetchHistoryJsonString() -> string` out of `replayExampleHistoryFile2()`:
    - in submission mode, call `loadSupabaseClient()`, then `from('submissions').select('id,json,review_status').eq('id', this.submissionId).single()`
    - throw on error or a missing row; the caller shows the message in `#review-status`, e.g. "Not found or not signed in, sign in on review.html"
    - otherwise, run the existing `fetch(this.historyUrl)` path
    - then show the approve/reject buttons and the current status
  - **New methods.**
    - `async reviewApprove()` and `async reviewReject()` both call `async setReviewStatus(status)`. That runs `update({review_status: status}).eq('id', this.submissionId)`, then navigates with `gotoNextPending()`; on error it alerts.
    - `async gotoNextPending()`: selects `id` where `review_status = 'pending'` and `id > this.submissionId`, ordered ascending with limit 1, and navigates to `history.html?submissionId=<id>`. If there's none, it goes to `review.html`.

**Interfaces:**
- Consumes: `loadSupabaseClient` (Task 2), `history.html?submissionId=N` links (Task 4).

- [ ] **Step 1: Make the edits above.**
- [ ] **Step 2: Verify in the browser.**
  - The regular viewer: `history.html?dataset=ARC&task=05a7bcf2&historyIndex=0&historyJson=%5B%2225%2F50%22%5D` replays as before, with Prev/Next working and no Approve/Reject buttons.
  - Open a submission from the review list: it replays, shows Approve/Reject and its status, and the Back link goes to `review.html`.
  - Approve: the row becomes `approved` in the list, and the page moves on to the next pending submission or back to `review.html`.
  - In a private window, signed out, `?submissionId=1` shows the sign-in hint and no replay.
- [ ] **Step 3: Commit.**
```bash
git add webroot/history.html webroot/history.js
git commit -m "Approve/reject review mode in history page"
```

---

### Task 6: Remove the braingridgame references, then run the end-to-end check

**Files:**
- Modify: `webroot/about.html:33` and `README.md:2,27`: change `https://braingridgame.com/discord` to `https://discord.gg/YDd2HAwZDN`.
- Modify: `README.md:11`: reword so submissions are collected via Supabase and reviewed on `review.html`, linking `supabase/README.md`.

- [ ] **Step 1: Edit the files.** Expected: `grep -rn braingridgame webroot README.md` returns nothing.
- [ ] **Step 2: Simon does the one-time setup from `supabase/README.md`.** This is a human step:
  - run `schema.sql`
  - create the auth user
  - set the redirect URLs
  - supply the anon key, which goes into `webroot/supabase-config.js`
- [ ] **Step 3: Run the end-to-end check against the real project.** This repeats Task 3 Step 2 (expect `"stored"`), Task 4 Step 2 and Task 5 Step 2. Then run `supabase/test/run-tests.sh` and `node --test tests/`, and both must pass.
- [ ] **Step 4: Commit.**
```bash
git add webroot/about.html README.md webroot/supabase-config.js
git commit -m "Point Discord link directly at discord.gg; drop braingridgame references"
```
