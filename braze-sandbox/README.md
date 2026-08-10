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
node smoke-test.js        # 233 assertions: engines, routes, composers, editors, settings, graded cases
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

**Segmentation** (`js/segments.js`) — Segment Builder 2.0 semantics: filters join with
AND *or* OR inside a filter group, and groups join with AND *or* OR between them, giving
real nested boolean logic. Predicates run over 240 seeded profiles, so every audience
count is computed rather than hard-coded — including per-group counts and per-channel
reachability, which is the number you should actually report to a stakeholder.

**Email building** (`js/emailbuilder.js`, `js/compose.js`) — a working drag-and-drop
editor whose blocks compile to real table-based email HTML, which then runs through the
Liquid engine. Plus composers and device previews for Push, SMS/MMS/RCS, WhatsApp,
In-App, Content Card, Banner, LINE and Webhook.

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
| Campaigns | List with Status/Tag/Filters/Columns, idle banner and campaign-type pills. Creation starts at the **message-type picker** (Multichannel, Email, Push, In-App, Content Card, Banner, SMS/MMS/RCS, WhatsApp, LINE, Webhook), then the five-step composer |
| Email building | The three tiles Braze shows on the Message content step — **Drag-and-drop editor**, **HTML code editor**, **Templates** — plus the **Upload file** link. The visual builder has Content / Rows / Settings tabs and Basic / Media / Advanced blocks |
| HTML code editor | The real Braze layout: CONTENT rail (Design and Build / Link Management / Gmail Promotion, then Personalization, Multi-language, Create with AI), HTML / Classic / More tabs, line-numbered code pane, live Preview with **Expand Content Blocks**, and the Add Personalization modal |
| Preview & Test | The eye icon in the rail opens Braze's real panel: **Preview as a User** / **Test Send** tabs, a user selector with **Get Random User**, the previewed profile's data shown beside the render, **Desktop / Mobile / Plaintext** switches, and the From / Reply-To / Subject header |
| Liquid reference | 11 categories, 90+ runnable snippets — every personalization namespace, ~40 filters, all control flow, and the Braze-only tags (`abort_message`, `catalog_items`, `catalog_selection_items`, `connected_content`, `promotion`, `message_extras_capture`). Click to insert at the cursor. Every snippet is asserted to parse |
| Other channels | Push, SMS (with GSM-7 vs Unicode segment counting), WhatsApp (positional template variables), In-App, Content Card, Banner, LINE, Webhook — each with a device preview |
| Canvases | Four-step builder — **Canvas Details / Entry Schedule / Target Audience / Canvas Flow** in a bottom bar with Save as Draft and Launch Canvas. **A new Canvas starts empty**: an Entry node and one `+`, nothing else. The flow board has zoom controls, inserters on every connector, branch labels marked *catch-all* and *control*, and a right-hand **configuration drawer** with inline step renaming. Steps that are not finished are flagged on the card, and **Launch is blocked** with a list of what is wrong — separated into blocking errors and things that will silently cost you users |
| Email Templates | HTML + Liquid editor with live preview against a real profile, personalization palette, snippet library, per-user "Send test", and an **Edge case** button that previews against a null-heavy profile |
| Segments | Filter-group builder with AND/OR join badges, per-group counts, live totals, breakdowns and a sample of matched users |
| Users | Profile explorer: standard and custom attributes, event timeline, subscription groups, message history |
| Content Blocks | Full CRUD. List with live thumbnails, Status/Tags filters and list/grid toggle; detail screen with the generated **Liquid tag**, **API identifier**, inclusion count and an HTML editor with live preview. Name validation, duplicate detection, and an archive guard when the block is in use |
| Settings | **Connected Content credentials** (add, copy the `:basic_auth` snippet, delete), **Frequency Capping rules**, API Keys and sending-domain/DNS status |
| Catalogs, Subscription Groups, Custom Data | The supporting objects, populated |
| Analytics | Campaign league table, funnels, channel mix |
| Case Studies | Nine courses with tasks and solution keys |
| Graded Simulations | Four end-to-end case studies that score you — see below |
| BrazeAI Operator | Context-aware assistant that answers *and* builds — see above |

Anything you create or edit persists in `localStorage`. **Reset sandbox data** in the
bottom-left restores the seeds.

## Graded simulations

`#/cases`. A brief arrives the way one really does — short, ambiguous, and from someone who
does not use Braze. You work it end to end and **every decision is scored**, against six
competencies: audience and targeting, personalization and QA, timing and delivery,
measurement and incrementality, commercial judgement, and consent and compliance.

Four cases, 54 graded decisions:

| Case | What it is | What it tests |
|---|---|---|
| **November in Eilat** | Revenue wants midweek heads in the all-inclusives without touching the weekend rate | The brief contains a targeting contradiction, a discount-leakage risk and a consent trap, and defines no success metric |
| **Ten nights and a paid club** | 8,000 members are near the free eleventh night; build a Canvas | Who was going to buy anyway; re-eligibility vs re-entry; Action vs Audience Paths; an arbitrage hidden in the reward mechanics |
| **72 hours to Passover** | Scarce inventory, a hard deadline, a CMO leaning on you | Four wrong answers that are one click away: the unread shared segment, the transactional reclassification, the cap exemption, and local-time delivery on an absolute deadline |
| **11:40 on a Thursday** | The send went out twenty minutes ago and something is wrong | Order of operations under pressure — containment, diagnosis, communication, remediation |

Four kinds of step. `choice` and `multi` carry partial and negative credit, so a
confident-sounding wrong answer costs you. `text` answers are scored against a keyword
rubric and shown a model answer. **`build` steps send you into the sandbox and are verified
against what you actually built** — the segment's filters, the campaign's conversion event,
the Canvas's entry configuration — not against what you say you would build.

You get a letter grade, a per-competency breakdown, an explicit list of what you got wrong
with what to do differently, and a debrief. The scoring weights blast radius rather than
difficulty: a wrong subscription group costs more than a wrong send hour.

**The one to notice:** local-time-zone delivery is the correct answer in *November in Eilat*
and the wrong answer in *72 hours to Passover*. Same setting, opposite answers, because one
offer runs for ten days and the other has a deadline that is the same moment for everybody.
Most best practice in this job is like that.

## The curriculum

Work through `#/learn` top to bottom alongside the sandbox — each course ends with tasks
you complete in the screens.

1. **Foundations** — the object model, attribute vs event, campaign vs Canvas
2. **Segmentation** — AND/OR filter groups, nested logic, reachability, lookback windows
3. **Personalization & Liquid** — namespaces, conditionals, filters, catalogs, Connected Content
4. **Campaigns** — delivery types, conversion windows, A/B tests and control groups
5. **Canvas Flow** — entry criteria, every step type, Action vs Audience Paths, quiet hours
6. **QA & pre-launch** — the checklist, adversarial test profiles, incident response
7. **Deliverability & consent** — subscription groups, bounces, frequency capping, sender reputation
8. **Analytics** — the metric hierarchy, incrementality, reporting upward
9. **On-the-job scenarios** — vague briefs, broken data, a live incident, the interview question

## The Fattal grounding

The briefs use Fattal's real commercial furniture, researched rather than invented: the
brands (Herods, Leonardo Plaza, Leonardo Club, Leonardo Privilege, U Hotels, NYX, FATTAL
COLORS, The Jaffa), the Israeli destinations and their seasonality, the Sunday-to-Thursday
working week, and the loyalty club as it actually works — **Fattal & Friends**, a *paid*
club at roughly ₪250 for two years, 10% off, eleventh night free valued at the average of
the ten accumulated nights after the discount, and **no published tier ladder**. Where the
research could not confirm something it is left out rather than smoothed over.

The sandbox itself is seeded as the fictional Aurelia Hotels Group, because inventing guest
records under a real employer's name is a bad habit to start. The attribute names map one
to one; the cases say so where it matters.

## Seeded workspace

Aurelia Hotels Group — a five-brand European/Israeli hotel group. 240 profiles, 12
properties in the `hotels` catalog, 11 custom events, 17 custom attributes, 4 subscription
groups, 10 segments, 7 campaigns, 3 Canvases.

Two profiles are pinned for the lessons:

- `AUR-100000` **Maya Levi** — Platinum, 21 stays, upcoming Jerusalem booking. Everything populated.
- `AUR-100001` **Jonas Weber** — Blue, zero stays, nulls across the board, one live abandoned booking. Deliberately hostile: if a template survives Jonas, it survives production.

## Fidelity notes

Built against a screenshot of a live production Braze dashboard plus current
documentation. Corrections made in the latest pass, each of which a naive replica gets
wrong:

- **Segmentation is no longer AND-only.** Segment Builder 2.0 supports OR within a filter
  group and between groups. Older training (and an earlier version of this sandbox) taught
  the AND-only workaround — that described the legacy builder.
- **The Message content step shows three tiles plus an Upload file link** —
  Drag-and-drop editor, HTML code editor, Templates. (An earlier pass had this as two
  tiles on the strength of a documentation reading; a screenshot of the live product
  settled it.)
- **The campaign wizard steps are Compose / Schedule / Target / Assign / Review**, in a
  bar along the *bottom* with Save as Draft and Launch Campaign on the right — not a
  top-of-page wizard.
- **Feature Flags are not in the campaign channel picker** — they are created from
  Messaging → Feature Flags.
- **SMS / MMS / RCS is one channel family**, chosen inside the composer.
- **In-App Message cannot be part of a Multichannel campaign.**
- **Blocks are Title and Paragraph**, not "Heading" and "Text", grouped Basic / Media /
  Advanced. Braze recommends Liquid control flow lives in an HTML block.
- **Re-eligibility ≠ re-entry** in Canvas — two distinct settings.
- **Catalogs, Templates, Content Blocks and Media Library live under Content**
  (Creative Studio); Custom Attributes and Custom Events live under Data Settings.
- **Campaign statuses** are Active / Idle / Draft / Stopped / Archived. "Scheduled" is not
  a status — scheduling shows in the Entry schedule column.

Corrections from the latest research pass, each of which the earlier version of this
sandbox had wrong or had guessed:

- **The loyalty club is Fattal & Friends and it is paid** — roughly ₪250 for two years.
  Not a free frequent-guest scheme, which changes the entire lifecycle: every member has
  already made a purchase decision, and there is a renewal event every 24 months.
- **There is no published tier ladder** in either Fattal & Friends or Leonardo
  AdvantageCLUB. The Gold/Platinum segmentation that feels natural for a hotel group does
  not exist there, so the *Ten nights* case deliberately refuses to lean on it.
- **Europe is a separate programme** — Leonardo AdvantageCLUB, free, 1 point per €1.
  Two clubs, two sites, two consent regimes (Israel's Spam Law Amendment 40 vs GDPR).
- **Eilat is roughly 90% domestic**, so its demand follows the Israeli school and festival
  calendar rather than international arrivals. This is the fact the November case turns on.
- **Jurys Inn no longer exists as a brand** — the 35 UK/Ireland hotels were rebranded to
  Leonardo, substantially complete in 2023.

Still uncertain, and deliberately not invented: exact ordering and wording of the channel
tiles, the numeric threshold at which a campaign becomes Idle, and the exact field labels
on the drag-and-drop Settings tab.

## A note on fidelity

The visual design, terminology and information architecture follow the Braze dashboard,
but this is a teaching replica built from the public documentation — not Braze code, and
not affiliated with Braze. Menu positions and exact wording drift between releases. The
concepts, the Liquid dialect and the workflow are what transfer.

The seeded company, its brands and all profiles are fictional.
