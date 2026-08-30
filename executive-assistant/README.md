# Executive assistant

An agent for Indranil Dutta (CEO, Datre Corporation) that triages the
inbox, preps meetings, tracks open commitments, and drafts (never sends)
routine replies — on demand and on a scheduled weekday-morning Routine.

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

## The scheduled Routine — not yet live

I tried to set this up via Claude's Routines (`create_trigger`), cron
`45 1 * * 1-5` UTC = **7:15 AM IST, Monday–Friday** (Datre's plant
timezone, Asia/Kolkata). It was rejected: this organization's Routines
can't be granted MCP connector access (Gmail/Calendar/Drive) through
that API path — a session it spawns would wake up with no way to read
your inbox or calendar, which defeats the point. I deleted the trigger
rather than leave a silently-broken automation running.

**To get the automatic morning run working**, create the Routine from
the **claude.ai Routines UI** instead (Settings → Routines, or wherever
your client surfaces them) — that surface can attach connectors that
this API call couldn't. Point it at this session or a new one, prompt:
*"Follow `.claude/skills/executive-assistant/SKILL.md` in
indutta/google-drive and post the briefing,"* schedule `45 1 * * 1-5`
(UTC) or your client's local-time equivalent of 7:15 AM IST weekdays,
and grant it Gmail + Google Calendar + Google Drive.

**Until then, run it on demand** — ask in any session on this repo
("run my morning briefing", "what's in my inbox") or invoke
`/executive-assistant`. That path already works end-to-end: it's how
`executive-assistant/tasks.md` got seeded below.

## First run

Built and seeded 2026-08-30 from a live (read-only) scan of the inbox
and calendar — see `executive-assistant/tasks.md` for what it found.
One write action (a holding-reply draft to LCB on the stale "Mining
prospects Canada" follow-up) hit a Gmail re-authorization error mid-build;
retry it on the next run once Gmail is reconnected in your claude.ai
connector settings.
