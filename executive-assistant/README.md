# Executive assistant

An agent for Indranil Dutta (CEO, Datre Corporation) that triages the
inbox, preps meetings, tracks open commitments, and drafts (never sends)
routine replies — on demand, and fed continuously by two scheduled
Routines (see below) that reconcile `executive-assistant/tasks.md`
straight from Gmail on their own schedule.

## Pieces

| File | What it is |
|---|---|
| `.claude/agents/executive-assistant.md` | The on-demand subagent persona — invoked automatically by Claude Code when a request is about email/calendar/follow-ups, or explicitly via the Agent tool. |
| `.claude/skills/executive-assistant/SKILL.md` | The actual daily-briefing procedure (calendar → meeting prep → inbox triage → follow-up reconciliation → holding drafts → write-up → persist). Both the on-demand agent and the scheduled Routine follow this. |
| `executive-assistant/tasks.md` | The durable memory: open commitments, who owes whom, what's stale. Git-tracked so it survives across sessions — the assistant reads and updates it every run. |

## How to use it

- **On demand**, in any Claude Code session on this repo: ask things like
  "what's in my inbox", "prep me for my 3pm", "draft a reply to LCB",
  "what am I on the hook for" — or invoke `/executive-assistant` directly
  for the full routine.
- **Automatically**, weekday mornings: a Routine wakes a session and runs
  the same procedure, then pushes/emails you a completion notification
  with the briefing.

## Guardrails (non-negotiable, enforced in both the agent and the skill)

- **Never sends email.** Every outbound reply is a Gmail *draft*, left
  for you to review and send yourself.
- **Never touches your calendar** (no create/edit/delete/respond) without
  your explicit go-ahead in that turn.
- **Never invents your business judgment** — a stale item that needs an
  actual decision from you (which vendor, which price, which prospects
  to drop) gets flagged or gets a bare holding reply ("apologies for the
  delay, will send X by Friday"), not a fabricated answer.
- Reads your inbox/calendar/Drive as confidential data; the only place
  any of it gets written back to is `executive-assistant/tasks.md` in
  this private repo.

## The scheduled Routines — live, via the claude.ai Routines UI

`create_trigger`'s API path can't grant a spawned session Gmail/Calendar/
Drive access on this org (see git history on this file if curious), so
these were set up directly in the **claude.ai Routines UI** instead,
which can attach connectors the API path couldn't. Two of them now feed
`executive-assistant/tasks.md` directly:

| Routine | Schedule (IST) | What it does |
|---|---|---|
| **Weekly open-items tracker** | Fri 4:00 PM | Scans Gmail for threads 5+ working days without a reply from Indranil, logs/updates them under `tasks.md`'s `## Open`, moves resolved ones to `## Recently resolved`, commits straight to this branch, then sends a short chat digest pointing at the tracker. |
| **Daily approvals digest** | Mon–Sat 8:00 AM (currently **disabled**) | Same consolidation, scoped to internal approval/sign-off requests (purchase orders, reimbursements, drawing approvals) — tagged `(internal approval)` in the tracker to stay distinguishable from vendor-correspondence follow-ups. |

Both commit directly to the repo's default branch (no PR) — this file
and `tasks.md` can change between your sessions without you doing
anything. Two other routines exist alongside these but don't touch this
repo: a **Weekly newsletter sweep** (labels marketing mail) and a
**Daily Morning Briefing** (calendar + inbox + industry news via the
built-in `/morning` skill, currently disabled) — ask Claude to run
`list_triggers` for current schedules/status on all four.

**On demand**, the on-demand agent/skill in this repo (see above) also
reads and reconciles `tasks.md` the same way — ask things like "what's
in my inbox" or invoke `/executive-assistant` any time; it doesn't wait
for the next scheduled fire.

## First run

Built and seeded 2026-08-30 from a live (read-only) scan of the inbox
and calendar — see `executive-assistant/tasks.md`'s history for what
that first pass found. One write action that run (a holding-reply draft
to LCB) hit a Gmail re-authorization error mid-build; check whether it
went through on a later pass before assuming it's still pending.
