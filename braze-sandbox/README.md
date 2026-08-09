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
node smoke-test.js        # 95 assertions: both engines, every route, operator actions
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

## BrazeAI Operator

The assistant panel (bottom-right, **Ask BrazeAI**) is context-aware — it knows which
screen you are on, so "explain this" and "check this" work without naming the object.

It **acts**, not just answers:

| Say | It does |
|---|---|
| "build a segment of lapsed Gold members in Israel with the app" | parses the description into real filters, creates the segment, opens it, and explains each row |
| "how many users are Gold or Platinum in Germany?" | computes it live against the seeded base, with per-channel reachability |
| "why is this segment empty?" | leave-one-out analysis showing which single filter is costing the audience |
| "add an Audience Paths step" | inserts and selects it in the open Canvas, with the relevant caveat |
| "create an abandonment campaign" | opens the wizard pre-filled, exception event and all |
| "write Liquid for a tier-based offer" | pastes a working snippet into the open template |
| "check this template" | renders it against three adversarial profiles and reports what came back empty |
| "review this Canvas for problems" | walks the flow for missing catch-alls, long waits before the first message, lead-time gaps, re-eligibility mistakes |
| "run a pre-launch check" | the machine-checkable half of the launch checklist |

It also answers ~35 knowledge topics drawn from the same material as the courses.

**It is not a language model.** A published artifact page has no model access — the only
runtime capabilities available are `downloads` and `mcp`. So this is intent matching over
a curated corpus plus a real action layer. It says so when asked, and it says "I don't
know" rather than inventing an answer. What it *does* — the counts, the filters, the
lint results — is computed, not scripted.

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
| Case Studies | Nine courses with tasks and solution keys |
| BrazeAI Operator | Context-aware assistant that answers *and* builds — see above |

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
