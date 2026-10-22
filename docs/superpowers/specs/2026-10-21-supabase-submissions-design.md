# Move puzzle submissions from braingridgame (Heroku) to Supabase

Date: 2026-10-21

## Why

ARC-Interactive (static site, https://neoneye.github.io/arc/) sends every submitted
puzzle history to https://braingridgame.com/api/history_guest, a Django app on Heroku.
Heroku costs money, and braingridgame is being shut down. Its only remaining jobs are
collecting submissions and hosting the review page that Simon uses to curate them
before they're imported into the
[ARC-Interactive-History-Dataset](https://github.com/neoneye/ARC-Interactive-History-Dataset)
repo (100k+ solved puzzles so far).

The goal is to keep the same workflow, with Supabase in place of Heroku and the review
page in this repo.

Supabase project: "ARCInteractive", https://supabase.com/dashboard/project/nimirzkqrnhkuiewjmxz
(project ref `nimirzkqrnhkuiewjmxz`, URL `https://nimirzkqrnhkuiewjmxz.supabase.co`).

## Current state (for reference)

- `webroot/edit.js` `submitDrawing()` → `postHistoryFile()` POSTs
  `{filename, jsonString, updateUuid}` on **every** submit (correct or not). The request is
  fire-and-forget and only writes to the console.
- braingridgame upserts one row per `updateUuid` (one per page load): it overwrites the
  `json`, sets `fully_solved = summary["test unsolved count"] == 0`, and stores `json_size`.
  The row also has `review_status` (pending / approved / rejected) and a timestamp.
- The braingridgame review page, staff-only, has two parts:
  - `/review/`: a table of all rows (id, timestamp, size, fully_solved, status, "History"
    link). Checkboxes, plus **Download** (→ `review-<utc>.json`, an array of objects whose
    `json` field is the history string) and **Delete** (hard delete).
  - `/history/?id=N`: the same replay player as `webroot/history.html`, fed one history,
    with **Approve** / **Reject** buttons that set `review_status`.
- Downstream (unchanged by this work): Simon downloads approved rows into
  `ARC-Interactive-History-Dataset/history_files/import_json/` and runs `full_sync.py`.
  It runs `import_json_job.py`, which needs "review" in the filename and reads each
  item's `json` field, then commits and pushes. Only after the push does Simon delete
  those rows on the site, so a batch is never lost.
- All historical approved data has already been migrated into the dataset repo
  (commit c3abdce). Supabase starts empty, and no data needs to move from Heroku.

## Goals

1. Players' submissions are stored in Supabase instead of braingridgame.
2. A review page in this repo, published on the public site, that works like the
   braingridgame one:
   - the list table with checkboxes, Download and Delete
   - the per-submission replay with Approve / Reject
3. Only Simon can read, approve, reject, download or delete submissions. Everyone else
   can only submit.
4. Download produces a file that the existing `import_json_job.py` imports unchanged.
5. No remaining runtime dependency on braingridgame.com.

## Non-goals

- A smarter or faster review UI. Simon watches every replay because the mistakes and
  recoveries are the interesting part. Keep the same UI; a smarter one may come later.
- Logged-in players, player progress, or the braingridgame.com game site itself.
- Changes to the History-Dataset scripts.
- Deploying. Simon deploys by copying `webroot/` into the neoneye.github.io repo manually.

## Anti-goals (failure even if it "works")

- Anyone other than Simon can read submissions or change their status. The anon key is
  public, so this must be enforced by row-level security, not by hiding the page.
- A batch can be lost: for example, Download deleting rows, or Delete removing rows that
  weren't downloaded. Delete stays a separate, explicit, confirmed action.
- The export format drifts so that `import_json_job.py` needs changes.
- Gameplay breaks or slows when Supabase is unreachable. Submitting must stay
  fire-and-forget, as it is today.

## Decisions

### Supabase schema (decided by me, Claude; not by Simon)

Ship as a SQL file in the repo (e.g. `supabase/schema.sql`) for Simon to paste into the
Supabase SQL editor. There is no Supabase CLI, build tool or package.json in this repo,
so keep it that way.

Table `submissions`:

| column | notes |
|---|---|
| `id` | bigint identity, primary key, used for `?id=N` in the review URL |
| `created_at` / `updated_at` | timestamptz |
| `update_uuid` | uuid, unique; one row per page load, as today |
| `dataset_id`, `task_id` | text, copied from the history JSON so the list can show them |
| `json` | text: the exact history string the client produced (store it verbatim) |
| `json_size` | int |
| `fully_solved` | bool |
| `review_status` | text, `pending` / `approved` / `rejected`, default `pending` |
| `downloaded_at` | timestamptz, null until the row is included in a Download (see Delete below) |

Row-level security is on:

- **anon**: no direct table access. Submissions go through a `SECURITY DEFINER`
  function `submit_history(p_update_uuid uuid, p_json text)` that:
  - parses and validates the JSON (it must parse and must contain dataset/task)
  - rejects histories that aren't fully solved (`summary."test unsolved count"` must be 0),
    mirroring the client rule below, so junk can't fill the table through the public key
  - rejects payloads over 5 MB. Real histories reach about 2.1 MB, and there are 26 over
    1 MB in the dataset, so the limit must not be lower than that
  - upserts by `update_uuid`, but only while that row is still `pending`
  - no rate limiting or row caps (my call). Braingridgame had none and abuse never
    happened. If it does later, add it then
- **Simon** (authenticated, `auth.jwt()->>'email' = 'neoneye+arcinteractive@gmail.com'`): select, update
  `review_status`, delete. The email check lives in one place, either a small helper SQL
  function or an `admins` table; the builder chooses.

### Client: what gets sent (my call)

- Send to Supabase **only when the task is fully solved** (`test unsolved count == 0`
  after this submit). Today every submit is stored, but `purge_unsolved.py` discards the
  unsolved rows anyway. The fully-solved upload still contains the whole history,
  wrong attempts included. This keeps the 500 MB free tier usable: about 22 KB per
  history, so roughly 20k rows.
- Later submits in the same page load (e.g. the next test of a multi-test task once all
  are solved) upsert the same row, as braingridgame did.
- Fix the `'no-crypto-random-uuid'` fallback. braingridgame rejected it, so those
  submissions were lost. Generate a valid v4 UUID from `crypto.getRandomValues` (or
  `Math.random` as a last resort).
- Call the RPC with plain `fetch` to
  `https://nimirzkqrnhkuiewjmxz.supabase.co/rest/v1/rpc/submit_history`, with the anon
  key headers. No supabase-js is needed on the game page.
- Put the Supabase URL and anon key in one small shared file (e.g.
  `webroot/supabase-config.js`) so they aren't hardcoded in several places.

### Review page

- Lives in `webroot/` and is published on the public site (Simon: fine to be public, as
  long as only Simon can curate). Not linked from the main navigation.
- Sign-in: Supabase email magic link (my default; Simon was told and didn't object).
  Use `signInWithOtp` with `shouldCreateUser: false`. Simon's user is created once in the
  dashboard, and RLS still checks the email. Simon must add the review page URLs
  (production and local dev) to Supabase Auth's redirect allow-list. Document this in the
  setup notes.
- supabase-js may be used on the review pages, loaded from a CDN with a pinned exact
  version, because there's no build step.
- **List page** (e.g. `review.html`), same as braingridgame `/review/`:
  - Columns: id, timestamp, dataset/task, size, fully_solved, status, and a link to the
    replay. Newest first.
  - Checkboxes, with **Download** and **Delete**.
  - Download writes `review-<UTC timestamp>.json`: an array of objects with the same keys
    as braingridgame's export (`timestamp`, `review_status`, `fully_solved`,
    `update_uuid`, `json`, `json_size`). The "review" in the name is required by
    `import_json_job.py`.
  - Download sets `downloaded_at` on the rows it exported.
  - Delete asks for confirmation and then hard-deletes the selected rows. If any
    selected row is non-rejected and has no `downloaded_at` (for example, new pending rows
    that arrived after the download and got caught by select-all), the confirmation says
    so with a count and offers to delete only the safe rows (downloaded or rejected).
    This protects the download → `full_sync.py` → delete order Simon relies on (my call).
  - Known gap, accepted (my call, same as braingridgame): if a player's tab is still
    open after their row was imported and deleted, a later submit from that tab creates a
    new near-duplicate pending row. It's rare, because uploads only happen once the task
    is fully solved, and Simon can reject it during review.
  - Must handle thousands of rows. Braingridgame had no pagination; the builder may add
    paging or a status filter if needed.
- **Replay page**: reuse the existing `webroot/history.html` / `history.js` replay. Add a
  mode, e.g. `history.html?submissionId=N`, that loads one submission from Supabase
  instead of from GitHub. Pass the JSON as data; don't inline it into HTML, which was
  braingridgame's quote/XSS bug. Show **Approve** / **Reject** buttons only in this
  mode. They update `review_status`, then return to the list or move to the next pending
  submission. The normal GitHub-backed history viewer must keep working unchanged.

### Other braingridgame references

- `webroot/about.html` and `README.md`: replace `https://braingridgame.com/discord` with
  the direct invite `https://discord.gg/YDd2HAwZDN`. Update the README wording that says
  submissions go to BrainGridGame.
- The History-Dataset README also mentions BrainGridGame. That's a separate repo and
  out of scope; flag it to Simon.

## Left to the builder

- File names and code layout within `webroot/`, following the existing style (plain JS
  classes, no framework).
- Exact SQL, indexes, the size limit, and the admin-check mechanism.
- Whether the list needs paging or filtering, and the next-pending navigation details.
- Setup notes: running the SQL, creating Simon's auth user, redirect URLs, and where the
  anon key goes.
- How to test locally. The site is served statically, e.g. on port 5500 as before.
