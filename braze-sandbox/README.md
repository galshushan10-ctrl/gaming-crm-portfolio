# Braze Sandbox

A working replica of the Braze dashboard, seeded with a hotel group's data, built for
practising marketing automation before starting the job.

Nothing sends anywhere. Everything runs in the browser with no backend and no network calls.

## Run it

Open `dist/braze-sandbox.html` in any browser — it is fully self-contained and works
offline, including from a `file://` URL.

To work on the sources instead, open `index.html` (it loads `css/` and `js/` separately),
then rebuild the single file:

```bash
python3 build.py          # -> dist/braze-sandbox.html
node smoke-test.js        # 62 assertions across both engines + every route
```

The smoke test needs `npm install playwright`; it points at the pre-installed Chromium
via `CHROMIUM_PATH` (defaults to `/opt/pw-browsers/chromium-1194/...`).

## What is actually implemented

This is not a set of screenshots. Two real engines drive the whole thing:

**Liquid** (`js/liquid.js`) — a hand-written tokenizer, parser and renderer covering
Braze's dialect: all four personalization namespaces (`{{${first_name}}}`,
`custom_attribute`, `event_properties`, `canvas_entry_properties`), ~50 filters,
`if`/`elsif`/`unless`/`case`/`for`/`assign`/`capture`, `{% catalog_items %}`,
`{% content_blocks %}`, `{% connected_content %}` and `{% abort_message() %}`.
It reproduces the behaviours that catch people out — integer division truncating,
empty string and `0` being truthy, missing attributes rendering silently — and a linter
flags the common production mistakes.

**Segmentation** (`js/segments.js`) — filter predicates evaluated over 240 seeded
profiles. Every audience count on screen is computed, not hard-coded, so changing a
filter moves the number for a real reason. Includes per-channel reachability, which is
the number you should actually report to a stakeholder.

## Screens

| Area | What you can do |
|---|---|
| Campaigns | Five-step wizard (Compose → Target → Delivery → Conversion → Review), all three delivery types, A/B results with a holdout and incremental lift |
| Canvases | Full Canvas Flow builder — add, configure, delete and branch. Message, Delay, Action Paths, Audience Paths, Experiment Paths, Webhook, Update User Profile, Exit. Entry settings with re-eligibility and conversion windows |
| Email Templates | HTML + Liquid editor with live preview against a real profile, personalization palette, snippet library, per-user "Send test", and an **Edge case** button that previews against a null-heavy profile |
| Segments | Filter builder with live counts, tier/country breakdowns, and a sample of matched users |
| Users | Profile explorer: standard and custom attributes, event timeline, subscription groups, message history |
| Catalogs, Content Blocks, Subscription Groups, Custom Data | The supporting objects, populated |
| Analytics | Campaign league table, funnels, channel mix |
| Case Studies | Eight courses with tasks and solution keys |

Anything you create or edit persists in `localStorage`. **Reset sandbox data** in the
bottom-left restores the seeds.

## The curriculum

Work through `#/learn` top to bottom alongside the sandbox — each course ends with tasks
you complete in the screens.

1. **Foundations** — the object model, attribute vs event, campaign vs Canvas
2. **Segmentation** — the AND-only trap, nested segments, reachability, lookback windows
3. **Personalization & Liquid** — namespaces, conditionals, filters, catalogs, Connected Content
4. **Campaigns** — delivery types, conversion windows, A/B tests and control groups
5. **Canvas Flow** — entry criteria, every step type, Action vs Audience Paths, quiet hours
6. **QA & pre-launch** — the checklist, adversarial test profiles, incident response
7. **Deliverability & consent** — subscription groups, bounces, frequency capping, sender reputation
8. **Analytics** — the metric hierarchy, incrementality, reporting upward
9. **On-the-job scenarios** — vague briefs, broken data, a live incident, the interview question

## Seeded workspace

Aurelia Hotels Group — a five-brand European/Israeli hotel group. 240 profiles, 12
properties in the `hotels` catalog, 11 custom events, 17 custom attributes, 4 subscription
groups, 10 segments, 7 campaigns, 3 Canvases.

Two profiles are pinned for the lessons:

- `AUR-100000` **Maya Levi** — Platinum, 21 stays, upcoming Jerusalem booking. Everything populated.
- `AUR-100001` **Jonas Weber** — Blue, zero stays, nulls across the board, one live abandoned booking. Deliberately hostile: if a template survives Jonas, it survives production.

## A note on fidelity

The visual design, terminology and information architecture follow the Braze dashboard,
but this is a teaching replica built from the public documentation — not Braze code, and
not affiliated with Braze. Menu positions and exact wording drift between releases. The
concepts, the Liquid dialect and the workflow are what transfer.

The seeded company, its brands and all profiles are fictional.
