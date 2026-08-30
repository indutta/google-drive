# Datre OS — Daily Business Dashboard

A single-file, OS-desktop-styled dashboard for daily business updates on
Datre Corporation Limited. Windows, a taskbar, and desktop icons stand in
for "apps": Daily Briefing, Production Monitor, Sales & Financials,
Customer Portfolio, Quality Control, Alerts, and Calendar & Tasks.

## Run it

No build step. Open `index.html` directly in a browser, or serve the
folder statically:

```
python3 -m http.server 8000 --directory dashboard
```

Then visit `http://localhost:8000`.

## What's in it

- Draggable, closable, focusable windows with a taskbar and desktop icons
  (click either to open/restore an app).
- A light/dark theme toggle (top-right), persisted in `localStorage`.
- Charts (bar, line, meter, stepper) drawn as inline SVG with hover
  tooltips — no chart library or external dependency.
- All styling uses only vetted hex values from the internal data-viz
  palette (categorical, sequential, and status color roles), so it stays
  colorblind-safe and consistent across light/dark.

## The data

`DATA` at the top of the `<script>` in `index.html` is a **static
snapshot** compiled from Datre Corporation's FY25-26 investor pitch deck
and CEO article (`../investor-pitch/`). It is illustrative, not a live
feed — every number traces back to a stated figure in those source
documents (no interpolated or invented data points).

To make the dashboard live, replace the `DATA` object with a fetch from
a real source (accounting export, ERP/MIS system, CRM) on page load, and
keep the same shape (`kpis`, `revenueCompare`, `netProfitTrend`, `alerts`,
`tasks`, etc.) so the render functions need no changes.

## Extending it

- **New app/window**: add an entry to the `APPS` array (id, title, color,
  a `build(bodyEl)` function, default position) — the window shell,
  desktop icon, and taskbar entry are generated from that one entry.
- **New chart**: reuse `barChart()`, `lineChart()`, `meter()`, or
  `stepper()` — each takes a container element and a small data array.
