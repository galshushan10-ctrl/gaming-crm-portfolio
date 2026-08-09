/* ==========================================================================
   BrazeAI Operator — the in-product assistant
   Modelled on Braze's AI assistant surface. It does three things:
     1. ANSWERS  — a knowledge base drawn from the same material as the courses
     2. ACTS     — builds segments, campaigns, Canvas steps and Liquid for real
     3. WATCHES  — knows which screen you are on and offers the next useful move

   It is deterministic, not a language model: a published page has no model
   access, so this is intent matching over a curated corpus. It will not
   free-associate, and it says so when it does not know something.
   ========================================================================== */

const BZOperator = (function () {
  'use strict';
  const U = window.BZUI, S = window.BZSeg;

  let isOpen = false, mounted = false, log = [];

  /* ---------- context ----------------------------------------------------- */

  function ctx() {
    const p = window.BZApp.parseHash();
    const c = { route: p[0] || 'home', id: p[1] || null, sub: p[2] || null };
    if (c.route === 'segments' && c.id) c.segment = window.BZ.segments.find((s) => s.id === c.id);
    if (c.route === 'campaigns' && c.id) c.campaign = window.BZ.campaigns.find((s) => s.id === c.id);
    if (c.route === 'canvases' && c.id) c.canvas = window.BZ.canvases.find((s) => s.id === c.id);
    if (c.route === 'templates' && c.id) c.template = window.BZ.templates.find((s) => s.id === c.id);
    if (c.route === 'users' && c.id) c.user = window.BZ.userById(c.id);
    return c;
  }

  const SCREEN_NAME = {
    home: 'Home', campaigns: 'Campaigns', canvases: 'Canvases', templates: 'Email Templates',
    blocks: 'Content Blocks', segments: 'Segments', users: 'Users', catalogs: 'Catalogs',
    subscriptions: 'Subscription Groups', data: 'Custom Data', analytics: 'Analytics', learn: 'Case Studies',
  };

  function ctxLabel() {
    const c = ctx();
    const obj = c.segment || c.campaign || c.canvas || c.template;
    if (obj) return SCREEN_NAME[c.route] + ' · ' + obj.name;
    if (c.user) return 'User · ' + c.user.first_name + ' ' + c.user.last_name;
    return SCREEN_NAME[c.route] || 'Braze Sandbox';
  }

  /* ---------- suggested prompts per screen -------------------------------- */

  const CHIPS = {
    home:      ['What should I practise first?', 'Explain the Braze object model', 'Build me a segment of lapsed Gold members'],
    segments:  ['Why are my filters ANDed?', 'How many users are Gold or Platinum?', 'Add a filter for app users', 'Is this segment safe to send to?'],
    campaigns: ['Campaign or Canvas?', 'What conversion window should I use?', 'Create an abandonment campaign', 'Run a pre-launch check'],
    canvases:  ['Action Paths vs Audience Paths?', 'Add an Audience Paths step', 'Explain re-eligibility', 'Review this Canvas for problems'],
    templates: ['Write Liquid for a tier-based offer', 'Check this template for problems', 'Why is my personalization empty?', 'Add a plural-safe nights line'],
    users:     ['Why did this guest get that email?', 'What makes a good test profile?'],
    analytics: ['What is incrementality?', 'Should I report open rate?', 'Which campaign is actually working?'],
    data:      ['Attribute or custom event?', 'What breaks when an attribute stops arriving?'],
    learn:     ['Where should I start?', 'What will I be asked in the interview?'],
    catalogs:  ['How do catalogs work in Liquid?', 'Guard a catalog lookup'],
    subscriptions: ['Subscription group vs global unsubscribe?'],
    blocks:    ['When should I use a Content Block?'],
  };

  /* ---------- knowledge base ---------------------------------------------- */
  /* keys are scored against the question; the best match answers.            */

  const KB = [
    { keys: ['attribute', 'event', 'custom attribute', 'difference', 'store'], t: 'Attribute or custom event?', a: `
      <p>The deciding question: <strong>would you ever ask "how many times?" or "when?"</strong></p>
      <ul><li>Yes → <strong>custom event</strong>. Timestamped, append-only, keeps full history. <code>booking_completed</code>, <code>checked_out</code>.</li>
      <li>No, you only need the current value → <strong>custom attribute</strong>. Overwritten on each update. <code>loyalty_tier</code>, <code>points_balance</code>.</li></ul>
      <p>In production you often want both: the event for history, plus a derived attribute for fast targeting. <code>spa_booker</code> shadows the <code>spa_booked</code> event in this workspace for exactly that reason.</p>
      <p class="bz-small">Storing history as attributes (<code>last_hotel</code>, <code>second_last_hotel</code>…) is the classic mistake — it caps out and you can never get the lost history back.</p>` },

    { keys: ['campaign', 'canvas', 'which should i use', 'vs'], t: 'Campaign or Canvas?', a: `
      <p><strong>If it has a wait in it, build a Canvas.</strong> That single rule gets it right most of the time.</p>
      <ul><li><strong>Campaign</strong> — one message, possibly across several channels at once. Newsletter, flash sale, a single triggered reminder.</li>
      <li><strong>Canvas</strong> — a sequence over time with delays and branching, per-step reporting, and Experiment Paths.</li></ul>
      <p>Rebuilding a campaign as a Canvas later loses the historical stats, so start in the right place.</p>` },

    { keys: ['action path', 'audience path', 'branch', 'split', 'paths'], t: 'Action Paths vs Audience Paths', a: `
      <p><strong>Action Paths wait. Audience Paths do not.</strong> This is the distinction interviewers ask about.</p>
      <table><tr><th></th><th>Action Paths</th><th>Audience Paths</th></tr>
      <tr><td>Branches on</td><td>what the user <em>does</em></td><td>who the user <em>is</em></td></tr>
      <tr><td>Timing</td><td>holds users for an evaluation window (default 1 day, max 31)</td><td>evaluated instantly on arrival</td></tr>
      <tr><td>Example</td><td>"did they book in the next 3 days?"</td><td>"are they Gold or Platinum?"</td></tr></table>
      <p>Using an Action Path where an Audience Path belongs inserts an invisible multi-day delay and nobody can work out why the next message is late.</p>
      <p><strong>Rule:</strong> never put a long Action Path window <em>before</em> your primary message. Branch after the value is delivered.</p>` },

    { keys: ['and', 'or', 'filter', 'anded', 'combine', 'both'], t: 'Why filters are ANDed', a: `
      <p>The segment builder joins every filter with <strong>AND</strong>. There is no OR between rows — this surprises everyone coming from SQL.</p>
      <p>You get OR three ways:</p>
      <ol><li><strong>"is any of"</strong> on a single filter — an OR across values. <code>tier is any of [Gold, Platinum]</code> is <em>one</em> row.</li>
      <li><strong>Audience Paths</strong> in a Canvas — each path its own filter set, first match wins.</li>
      <li><strong>Separate segments</strong> and separate campaigns.</li></ol>
      <p class="bz-small">Two rows saying <code>tier = Gold</code> and <code>tier = Platinum</code> gives you <strong>zero</strong> — nobody is both. Read your filters aloud with "and" between each line.</p>` },

    { keys: ['conversion', 'window', 'attribution', 'how long'], t: 'Conversion events and windows', a: `
      <p>A conversion event is your success metric: did the recipient do the thing within N of <em>receiving</em> the message. Up to four; the first is primary.</p>
      <p><strong>Starting points for hospitality:</strong></p>
      <table><tr><th>Journey</th><th>Window</th></tr>
      <tr><td>Abandonment</td><td>72 hours</td></tr><tr><td>Win-back</td><td>14 days</td></tr>
      <tr><td>Pre-arrival check-in</td><td>7 days</td></tr><tr><td>Review request</td><td>5 days</td></tr></table>
      <p>Too short under-credits; too long claims bookings you did not cause. Whatever you pick, <strong>keep it stable</strong> — changing it mid-flight makes every before/after comparison meaningless.</p>` },

    { keys: ['re-eligibility', 'reeligibility', 're enter', 'reenter', 'again', 'twice'], t: 'Re-eligibility', a: `
      <p>Can a user go through the journey more than once? Defaults that are almost always right:</p>
      <ul><li><strong>Onboarding</strong> — off. You are welcomed once.</li>
      <li><strong>Pre-arrival</strong> — on, 1-day cooldown. Every booking deserves its own sequence, and a business traveller might book twice in a week.</li>
      <li><strong>Win-back</strong> — on, 90-day cooldown. Otherwise a lapsed guest gets a win-back every Tuesday forever.</li></ul>
      <p>This is one of the few Braze mistakes that is genuinely hard to unwind, because the sends have already gone.</p>` },

    { keys: ['subscription group', 'unsubscribe', 'consent', 'opt in', 'opted', 'gdpr consent'], t: 'Subscription groups vs global state', a: `
      <p>Three layers, and you must satisfy all three:</p>
      <ol><li><strong>Global email state</strong> — <code>opted_in</code> / <code>subscribed</code> / <code>unsubscribed</code>. Unsubscribed blocks everything.</li>
      <li><strong>Subscription group</strong> — per-topic consent (Promotions, Loyalty, Trip Info).</li>
      <li><strong>Your targeting</strong> — Braze will <em>not</em> stop you emailing a promotion to someone who left the Promotions group unless you attach the campaign to that group or filter on it yourself.</li></ol>
      <p><code>subscribed</code> means "has not opted out". <code>opted_in</code> means "actively said yes". GDPR marketing generally needs <code>opted_in</code>; "is not unsubscribed" is fine for service messaging and a compliance problem for promotions in some markets.</p>
      <p class="bz-small">Separate groups give an annoyed guest a small exit instead of the global one.</p>` },

    { keys: ['liquid', 'personalization', 'namespace', 'syntax', 'tag'], t: 'Braze Liquid namespaces', a: `
      <pre><code>{{\${first_name}}}                      standard attribute
{{custom_attribute.\${loyalty_tier}}}   custom attribute
{{event_properties.\${hotel_name}}}     triggering event property
{{canvas_entry_properties.\${promo}}}   Canvas entry property
{{api_trigger_properties.\${offer}}}    API-triggered property</code></pre>
      <p>The <code>\${…}</code> wrapper is Braze's. Everything outside it is ordinary Liquid.</p>
      <p><strong>Critical:</strong> <code>event_properties</code> only resolves for <strong>action-based</strong> sends triggered by that event. In a scheduled campaign it renders empty for everyone — use a custom attribute instead.</p>` },

    { keys: ['default', 'fallback', 'empty', 'blank', 'hi ,', 'missing name'], t: 'Fallbacks', a: `
      <p>Always: <code>{{\${first_name} | default: 'there'}}</code></p>
      <p>Without it, a profile with no first name renders "Hi ,". In a hotel group with OTA and partner bookings, 20–40% of profiles routinely have no first name — not an edge case.</p>
      <p><code>| default:</code> fires on nil and empty string, but <strong>not</strong> on a single space. If your source data is dirty, chain it: <code>| strip | default: 'there'</code>.</p>` },

    { keys: ['catalog', 'items', 'abort', 'broken image', 'blank hotel'], t: 'Catalogs and the guard you must add', a: `
      <pre><code>{% catalog_items hotels {{custom_attribute.\${abandoned_hotel_id}}} %}
{% if items.size == 0 %}
  {% abort_message('No catalog row') %}
{% endif %}
&lt;h1&gt;Still thinking about {{items[0].city}}?&lt;/h1&gt;</code></pre>
      <p>If the id is null or the row was deleted, <code>items</code> is empty and <code>{{items[0].name}}</code> renders as <em>nothing</em> — you send a blank hero and a broken image rather than an error.</p>
      <p><code>abort_message</code> cancels the send <strong>for that user only</strong> and shows up as an abort in campaign analytics. Belt and braces: also add <code>abandoned_hotel_id has a value</code> to the segment.</p>` },

    { keys: ['connected content', 'api call', 'live price', 'external'], t: 'Connected Content', a: `
      <pre><code>{% connected_content https://api.example.com/rates?h={{custom_attribute.\${next_stay_hotel_id}}}
   :basic_auth rates_key
   :cache 300
   :save rates %}
{% if rates.lowest %}From €{{rates.lowest}}{% endif %}</code></pre>
      <ul><li><strong>Always <code>:cache</code></strong> on a large send — without it your endpoint takes one request <em>per recipient</em>, and a 200k send takes your API down.</li>
      <li><strong>Always handle failure</strong> — if the endpoint errors, Braze proceeds with the value unset.</li>
      <li>Never put a secret in the URL; use <code>:basic_auth</code> with a stored credential.</li></ul>` },

    { keys: ['content block', 'reusable', 'footer', 'header'], t: 'Content Blocks', a: `
      <p>Reusable HTML fragments: <code>{{content_blocks.\${aurelia_footer}}}</code>. Header, footer, legal, tier badge.</p>
      <p>Edit once, every template updates. If your footer address is hard-coded into forty templates, changing offices becomes a two-day job.</p>` },

    { keys: ['divided_by', 'division', 'decimal', 'round', 'math'], t: 'Integer division truncates', a: `
      <p><code>{{18450 | divided_by: 100}}</code> → <strong>184</strong>, not 184.5 and not 185. Liquid does integer division when both operands are integers, and it <em>truncates</em>.</p>
      <ul><li><code>| divided_by: 100.0</code> → 184.5</li><li><code>| divided_by: 100.0 | round</code> → 185</li></ul>
      <p>This bites hardest converting points to currency, where quietly losing the remainder understates the value you are advertising.</p>` },

    { keys: ['truthy', 'falsy', 'is 0', '0 truthy', 'zero is', 'empty string'], t: 'Liquid truthiness', a: `
      <p>Only <code>nil</code> and <code>false</code> are falsy. <strong>An empty string is true. Zero is true.</strong></p>
      <p>So <code>{% if custom_attribute.\${points_balance} %}</code> fires for someone with zero points. Test explicitly: <code>{% if custom_attribute.\${points_balance} &gt; 0 %}</code>.</p>` },

    { keys: ['frequency', 'capping', 'too many', 'spam', 'how often'], t: 'Frequency capping', a: `
      <p>Workspace-level rules: "no more than 2 promotional emails per user per 7 days". Set once, every campaign inherits it.</p>
      <ul><li>Mark transactional and service campaigns <strong>exempt</strong>, or a busy promo week suppresses someone's check-in instructions.</li>
      <li>Capping <strong>silently drops</strong> recipients. If a send goes out much smaller than expected, check capping first.</li></ul>` },

    { keys: ['quiet hours', 'local time', 'timezone', 'time zone', 'when to send'], t: 'Local time and quiet hours', a: `
      <p>Send in the user's local time zone and set quiet hours (e.g. 21:00–08:00). A message landing at 03:00 gets deleted and reported as spam.</p>
      <p>Decide what happens to messages falling inside quiet hours: <strong>hold</strong> until the window opens (promotions) or <strong>skip</strong> (a "your room is ready" alert is worthless four hours late).</p>
      <p class="bz-small">Transactional confirmations should be exempt entirely — a guest booking at 22:00 needs the confirmation at 22:00.</p>` },

    { keys: ['incremental', 'holdout', 'control', 'attribution', 'really work', 'roi'], t: 'Incrementality', a: `
      <p><strong>Attributed revenue is an upper bound, not a result.</strong> "The abandonment campaign drove €168,400" is almost certainly false — some of those people were mid-purchase and would have completed anyway.</p>
      <p>A <strong>control group</strong> receives nothing. The gap between treated and control is the only number that survives a budget review:</p>
      <pre><code>lift = conversion(treated) − conversion(control)</code></pre>
      <p>Published benchmarks put genuine incrementality on abandonment flows somewhere between 20% and 50% of attributed. Keep a holdout on your highest-volume always-on journeys — it costs a little revenue and buys the ability to prove the programme works.</p>` },

    { keys: ['open rate', 'mpp', 'apple', 'opens dropped', 'unreliable'], t: 'Open rate is unreliable', a: `
      <p>Apple Mail Privacy Protection pre-fetches images, inflating opens since 2021. A shift in device mix moves your open rate with no change in behaviour.</p>
      <p><strong>Never report opens upward.</strong> Use them for subject-line tests only, and confirm any conclusion against clicks and conversions.</p>
      <p>If opens fell but clicks and conversions held → suspect measurement. If all three fell together → suspect deliverability.</p>` },

    { keys: ['ctor', 'click to open', 'click rate'], t: 'Click-to-open, not click rate', a: `
      <p>Click rate mixes two effects. <strong>CTOR = clicks ÷ opens</strong> isolates whether the content worked once someone was looking.</p>
      <ul><li>Changed the subject line → watch <strong>opens</strong>.</li><li>Changed the body or CTA → watch <strong>CTOR</strong>.</li></ul>` },

    { keys: ['deliverability', 'spam folder', 'inbox', 'spf', 'dkim', 'dmarc', 'reputation', 'warm'], t: 'Deliverability basics', a: `
      <ul><li><strong>SPF, DKIM, DMARC</strong> on your sending domain. If you cannot say whether DMARC is at <code>p=none</code> or <code>p=reject</code>, find out.</li>
      <li><strong>Separate subdomains</strong>: <code>offers.</code> for marketing, <code>stay.</code> for transactional. A bad promotional week then cannot take down booking confirmations.</li>
      <li><strong>Warm up</strong> new domains over 2–4 weeks starting with your most-engaged users.</li>
      <li><strong>Complaint rate</strong> above 0.1% gets you throttled; above 0.3% is a real problem.</li>
      <li><strong>Suppress 12-month non-openers.</strong> Feels like giving up revenue; it is the single most effective thing you can do for inbox placement.</li></ul>` },

    { keys: ['api triggered', 'api-triggered', 'trigger send', 'backend', 'transactional'], t: 'API-triggered delivery', a: `
      <p>Your backend calls <code>/campaigns/trigger/send</code> with <code>trigger_properties</code>, readable as <code>{{api_trigger_properties.\${…}}}</code>.</p>
      <p>Use it when <strong>your system owns the timing and the payload</strong> — "your room is ready" fires the moment housekeeping releases the room, which Braze cannot infer from an attribute.</p>
      <p class="bz-small">Watch the legal line: "your room is ready" is transactional. "Your room is ready — and the spa has 6pm free" is marketing, and now needs marketing consent.</p>` },

    { keys: ['reachable', 'reachability', 'how many will get'], t: 'Reachability vs segment size', a: `
      <p>A segment of 40,000 is not 40,000 emails. Subtract unsubscribed, hard-bounced, no address on file, and anyone who left the relevant subscription group.</p>
      <p><strong>Reachable is the number you report to a stakeholder.</strong> Quoting segment size and delivering 30% fewer is how you lose credibility in week one.</p>
      <p class="bz-small">Ask me "is this segment safe to send to?" on any segment screen and I will run the numbers.</p>` },

    { keys: ['currents', 'warehouse', 'snowflake', 'export', 'raw data'], t: 'Currents', a: `
      <p>Currents streams raw engagement events out to S3 / Snowflake / BigQuery. When someone asks a question the Braze UI cannot answer, Currents is the answer.</p>
      <p>You will not set it up in your first month, but knowing it exists — and that "we can get that from Currents" is a valid response — is expected.</p>` },

    { keys: ['experiment path', 'test paths', 'multivariate'], t: 'Experiment Paths', a: `
      <p>Randomly assigns users to variant paths by percentage, with an optional control. Best for testing <strong>whole branches</strong> — cadence, channel mix, discount depth — not just copy.</p>
      <p>Assignment is <strong>sticky</strong> per user per Canvas. Changing the percentages mid-flight does not re-randomise anyone already in.</p>
      <p>The <em>Lapsed guest win-back</em> Canvas here has a three-arm discount test with a 10% holdout — open it.</p>` },

    { keys: ['webhook step', 'webhook'], t: 'Webhook step', a: `
      <p>POSTs to any endpoint from inside a journey — notify a CRM, add to a list, mint a voucher code.</p>
      <p><strong>Failures are largely silent.</strong> Log on the receiving end; never assume it fired.</p>` },

    { keys: ['update user', 'write attribute', 'journey state'], t: 'Update User Profile step', a: `
      <p>Writes a custom attribute mid-journey — <code>winback_stage = exhausted</code>, <code>upgrade_offered = true</code>.</p>
      <p>Excellent for journey state and suppression. <strong>Careful:</strong> if that attribute is also an entry trigger somewhere, you have built a loop.</p>` },

    { keys: ['abandon', 'abandonment', 'cart', 'incomplete booking'], t: 'The abandonment pattern', a: `
      <p>Always the same shape:</p>
      <pre><code>performed  booking_started        in last 7 days   AND
did NOT perform booking_completed in last 7 days   AND
Promotions &amp; Offers is subscribed</code></pre>
      <p>The second row is what makes it correct — without it you email people who already booked.</p>
      <p><strong>Better still:</strong> an action-based campaign with a delay and an <strong>exception event</strong>. "Send 4h after <code>booking_started</code> unless <code>booking_completed</code> happens first" is evaluated against each user's own clock rather than a fixed window.</p>
      <p class="bz-small">Watch out: the exclusion window must be at least as long as the inclusion window, or someone who started and completed on day 6 still qualifies.</p>` },

    { keys: ['gdpr', 'delete', 'right to be forgotten', 'dsar', 'privacy'], t: 'Deletion requests', a: `
      <p>A legal obligation with a deadline, not a marketing task — route it through whoever owns DSARs.</p>
      <p>On the Braze side it is <code>/users/delete</code>, but Braze is one of several systems holding this person. Deleting there while leaving them in the PMS and CDP is both non-compliant and likely to re-create the profile on the next sync. <strong>Delete at source first.</strong></p>` },

    { keys: ['workspace', 'app group', 'staging', 'environment'], t: 'Workspaces', a: `
      <p>A workspace holds one user base, its API keys and its data. Most hotel groups run production and staging.</p>
      <p>Users do <strong>not</strong> cross workspaces — a test user in staging is a different person from the same email in production. You can copy campaigns and Canvases between them; you cannot copy segments.</p>` },

    { keys: ['preview', 'test send', 'seed', 'qa', 'testing'], t: 'Preview & Test', a: `
      <p>Three modes, in order: preview as a random user → preview as a <em>specific</em> user → send a real test.</p>
      <p><strong>Preview is not proof.</strong> It renders Liquid against one profile. It does not test your audience, timing, frequency caps or conversion tracking. Plenty of campaigns preview perfectly then send to the wrong 200,000 people.</p>
      <p>Test against adversarial profiles, not the happy path: no first name, all-null attributes, an apostrophe in the name, a dead catalog id, a different time zone. <code>AUR-100001</code> here is built to be hostile.</p>` },

    { keys: ['checklist', 'before launch', 'pre-launch', 'prelaunch', 'ready to send'], t: 'Pre-launch checklist', a: `
      <ol><li><strong>Audience</strong> — read the filters aloud with "and". Count within ~10% of expectation?</li>
      <li><strong>Exclusions</strong> — suppression segment, recent recipients, global control group.</li>
      <li><strong>Reachability</strong> — that is the number you report.</li>
      <li><strong>Liquid</strong> — every tag has a fallback; preview 3+ edge profiles.</li>
      <li><strong>Links</strong> — click every one. Check UTMs. Check mobile.</li>
      <li><strong>Unsubscribe</strong> — present, correct destination.</li>
      <li><strong>Subject/preheader</strong> — no stray <code>{{</code>, no "Hi ,".</li>
      <li><strong>Timing</strong> — time zone, quiet hours, not a public holiday in your biggest market.</li>
      <li><strong>Conversion event</strong> — set, defensible window.</li>
      <li><strong>Collisions</strong> — what else goes out today?</li>
      <li><strong>Seed list</strong> — internal addresses included.</li></ol>
      <p class="bz-small">On a campaign screen, ask me to "run a pre-launch check" and I will do the machine-checkable half.</p>` },

    { keys: ['first 90', 'prepare', 'new job', 'start', 'three weeks', 'ready for the job'], t: 'Preparing for the role', a: `
      <p><strong>Week 1 — mechanics.</strong> Build three segments, two campaigns and one branching Canvas here from scratch. Write ten Liquid snippets from memory.</p>
      <p><strong>Week 2 — the domain.</strong> Braze is the tool; hospitality CRM is the job. Learn ADR, RevPAR, OTA vs direct, rate parity, length of stay, lead time, ancillary spend. Understand that OTA commission runs 15–25% — nearly every hotel CRM programme exists to shift share from OTA to direct.</p>
      <p><strong>Week 3 — the company.</strong> Sign up for their emails from a fresh address. Start a booking and abandon it. Watch what arrives and when. Walking in with "here is the journey you currently run and two gaps I noticed" is an unusually strong first week.</p>` },

    { keys: ['interview', 'asked', 'question'], t: 'The interview question', a: `
      <p>"Walk me through setting up a win-back programme from scratch." Structure the answer:</p>
      <p><strong>define → segment → design → personalise → test → measure → iterate</strong></p>
      <ol><li>Define "lapsed" from the repeat-booking interval distribution, not a guess.</li>
      <li>Tier the segment — a lapsed Platinum deserves a different budget than a one-time OTA booker.</li>
      <li>Canvas, not campaign: reminder → offer → last chance → stop.</li>
      <li>Personalise on their actual history: city stayed, points balance, preferred brand.</li>
      <li>Experiment Paths on discount depth, including a points-only arm.</li>
      <li>Holdout — win-back without one is indistinguishable from natural return.</li>
      <li>Revisit the lapse definition once you see who came back.</li></ol>` },
  ];

  /* ---------- natural-language → segment filters --------------------------- */

  const COUNTRY = { israel: 'IL', israeli: 'IL', il: 'IL', germany: 'DE', german: 'DE', de: 'DE',
    uk: 'GB', britain: 'GB', british: 'GB', england: 'GB', gb: 'GB', spain: 'ES', spanish: 'ES', es: 'ES',
    italy: 'IT', italian: 'IT', it: 'IT', austria: 'AT', at: 'AT', greece: 'GR', gr: 'GR', netherlands: 'NL', nl: 'NL', france: 'FR', french: 'FR', fr: 'FR' };

  function extractFilters(q) {
    const f = [], why = [];
    const has = (re) => re.test(q);
    const numAfter = (re, dflt) => { const m = q.match(re); return m ? Number(m[1]) : dflt; };

    /* tiers */
    const tiers = ['Blue', 'Silver', 'Gold', 'Platinum'].filter((t) => q.includes(t.toLowerCase()));
    if (tiers.length) { f.push({ field: 'custom.loyalty_tier', op: 'is_one_of', value: tiers }); why.push(`tier is any of ${tiers.join(' / ')} — one filter with "is any of", not one row per tier`); }
    else if (has(/\b(vip|high value|top tier|best guests)\b/)) { f.push({ field: 'custom.loyalty_tier', op: 'is_one_of', value: ['Gold', 'Platinum'] }); why.push('read "VIP" as Gold + Platinum'); }

    /* country */
    for (const [word, code] of Object.entries(COUNTRY)) {
      if (new RegExp('\\b' + word + '\\b').test(q)) { f.push({ field: 'country', op: 'equals', value: code }); why.push(`country = ${code}`); break; }
    }

    /* lifecycle */
    if (has(/\blapsed|win.?back|haven'?t (stayed|been)|dormant|inactive\b/)) {
      const d = numAfter(/(\d+)\s*(?:\+\s*)?days?/, 180);
      f.push({ field: 'custom.total_stays', op: 'gte', value: 1 });
      f.push({ field: 'custom.last_stay_date', op: 'date_before_days_ago', value: d });
      why.push(`lapsed = has stayed before AND last stay more than ${d} days ago (the "has stayed before" row matters — without it you sweep in people who never booked)`);
    }
    if (has(/\bnever booked|no stays|prospect|registered but\b/)) {
      f.push({ field: 'custom.total_stays', op: 'equals', value: 0 }); why.push('total_stays = 0');
    }
    if (has(/\bupcoming|arriving|pre.?arrival|next stay|checking in\b/)) {
      const d = numAfter(/(?:next|within)\s*(\d+)\s*days?/, 14);
      f.push({ field: 'custom.next_stay_date', op: 'date_in_next_days', value: d }); why.push(`next_stay_date within ${d} days`);
    }
    if (has(/\babandon/)) {
      const d = numAfter(/(\d+)\s*days?/, 7);
      f.push({ field: 'event.booking_started', op: 'performed_in_last_days', value: d });
      f.push({ field: 'event.booking_completed', op: 'not_performed_in_last_days', value: d });
      why.push(`abandonment = started but did NOT complete, both over the same ${d}-day window (mismatched windows are the classic bug)`);
    }

    /* traits */
    if (has(/\b(famil|kids|children)\b/)) { f.push({ field: 'custom.travels_with_kids', op: 'is_true' }); why.push('travels_with_kids = true'); }
    if (has(/\bbusiness|corporate|midweek\b/)) { f.push({ field: 'custom.business_traveller', op: 'is_true' }); why.push('business_traveller = true'); }
    if (has(/\bspa\b/)) { f.push({ field: 'custom.spa_booker', op: 'is_true' }); why.push('spa_booker = true'); }
    if (has(/\bapp\b/)) { f.push({ field: 'custom.has_app', op: 'is_true' }); why.push('has_app = true'); }
    if (has(/\bpush\b/)) { f.push({ field: 'push_subscribe', op: 'equals', value: 'opted_in' }); why.push('push_subscribe = opted_in — note this is a *different* check from has_app'); }

    /* numeric thresholds */
    let m = q.match(/points?\s*(?:balance\s*)?(?:over|above|more than|>|at least|of)\s*([\d,]+)/);
    if (m) { const v = Number(m[1].replace(/,/g, '')); f.push({ field: 'custom.points_balance', op: 'gte', value: v }); why.push(`points_balance ≥ ${v}`); }
    m = q.match(/(?:ltv|lifetime value|spent)\s*(?:over|above|more than|>|at least|of)?\s*€?\s*([\d,]+)/);
    if (m) { const v = Number(m[1].replace(/,/g, '')); f.push({ field: 'custom.lifetime_value', op: 'gte', value: v }); why.push(`lifetime_value ≥ €${v}`); }
    m = q.match(/(?:at least|more than|over)\s*(\d+)\s*stays?/);
    if (m) { f.push({ field: 'custom.total_stays', op: 'gte', value: Number(m[1]) }); why.push(`total_stays ≥ ${m[1]}`); }

    /* consent — added automatically for anything promotional */
    if (has(/\boffer|promo|discount|sale|campaign|marketing|win.?back|abandon\b/)) {
      f.push({ field: 'subscription.sg-promos', op: 'equals', value: 'subscribed' });
      why.push('Promotions & Offers is subscribed — I add this to anything promotional; Braze will not enforce it for you');
    }
    return { filters: f, why };
  }

  /* ---------- Liquid snippet library --------------------------------------- */

  const SNIPPETS = [
    { keys: ['greet', 'hello', 'name', 'fallback', 'dear'], label: 'Safe greeting',
      code: "{{${first_name} | strip | default: 'there'}}",
      note: 'Chained <code>strip</code> so a profile holding a single space also falls back.' },
    { keys: ['tier', 'loyalty', 'gold', 'platinum', 'conditional', 'if'], label: 'Tier-based offer',
      code: "{% assign tier = custom_attribute.${loyalty_tier} | default: 'Blue' %}\n{% if tier == 'Gold' or tier == 'Platinum' %}\n  Double points on your next stay — you already have {{custom_attribute.${points_balance} | number_with_delimiter}}.\n{% else %}\n  Here is 20% off your next stay: WELCOMEBACK20\n{% endif %}",
      note: 'Never discount a high-value guest when a points bonus will do. The <code>default</code> keeps the logic readable when someone adds a third branch later.' },
    { keys: ['night', 'plural', 'stay length', 'nights'], label: 'Plural-safe nights line',
      code: "{% assign n = custom_attribute.${nights_booked} %}\nYour {{n}} night{% if n != 1 %}s{% endif %} at {{custom_attribute.${next_stay_hotel} | default: 'your hotel'}}\nstart{% if n == 1 %}s{% endif %} on {{custom_attribute.${next_stay_date} | date: '%A, %B %e'}}.",
      note: 'Note the verb pluralises the opposite way to the noun — "1 night starts", "3 nights start". Nothing looks more automated than "1 stays".' },
    { keys: ['date', 'format', 'when'], label: 'Date formatting',
      code: "{{custom_attribute.${next_stay_date} | date: '%A, %B %e'}}   → Monday, August 18\n{{custom_attribute.${next_stay_date} | date: '%d/%m/%Y'}}    → 18/08/2026",
      note: 'strftime tokens. <code>%e</code> is space-padded day, <code>%-d</code> is unpadded.' },
    { keys: ['points', 'number', 'delimiter', 'currency'], label: 'Points and currency',
      code: "{{custom_attribute.${points_balance} | number_with_delimiter}}        → 18,400\n{{custom_attribute.${points_balance} | divided_by: 100.0 | round}}   → 184 (euros)",
      note: 'Use <code>100.0</code>, not <code>100</code> — integer division truncates and understates the value.' },
    { keys: ['catalog', 'hotel', 'image', 'product'], label: 'Catalog lookup with a guard',
      code: "{% catalog_items hotels {{custom_attribute.${abandoned_hotel_id}}} %}\n{% if items.size == 0 %}{% abort_message('No catalog row') %}{% endif %}\n<h1>Still thinking about {{items[0].city}}?</h1>\n<img src=\"{{items[0].image_url}}\" alt=\"{{items[0].name}}\">\n<p>From €{{items[0].price_from}} per night</p>",
      note: 'The guard is not optional. Without it a dead id sends a blank hero and a broken image.' },
    { keys: ['countdown', 'expire', 'urgency', 'deadline'], label: 'Points-to-Gold nudge',
      code: "{% assign to_gold = 7 | minus: custom_attribute.${total_stays} %}\n{% if to_gold > 0 %}\n  You are {{to_gold}} stay{% if to_gold != 1 %}s{% endif %} from Gold.\n{% endif %}",
      note: 'Wrapped in an <code>if</code> so existing Gold members never see "you are -3 stays from Gold".' },
    { keys: ['loop', 'for', 'list', 'multiple'], label: 'Loop over catalog items',
      code: "{% for item in items %}\n  <a href=\"{{item.url}}\">{{item.name}}</a>{% unless forloop.last %}, {% endunless %}\n{% endfor %}",
      note: '<code>forloop.last</code> keeps you from a trailing comma.' },
    { keys: ['unsubscribe', 'footer', 'legal'], label: 'Unsubscribe link',
      code: "<a href=\"{{${set_user_to_unsubscribed_url}}}\">Unsubscribe</a>",
      note: 'Already inside the <code>aurelia_footer</code> Content Block — include that instead of hand-rolling it.' },
  ];

  /* ---------- helpers ------------------------------------------------------ */

  /* Leave-one-out: which single filter is costing the most audience? This is
     the answer to "my segment went to zero and I do not know why", which is
     otherwise a genuinely tedious thing to debug by hand.                    */
  function constraintReport(filters) {
    if (filters.length < 2) return '';
    const full = S.count(filters);
    const drops = filters.map((f, i) => ({
      f, n: S.count(filters.filter((_, j) => j !== i)),
    })).sort((a, b) => b.n - a.n);
    const worst = drops[0];
    if (worst.n <= full) return '';
    return `<p><strong>Which filter is the constraint?</strong> Dropping
      <code>${U.esc(S.describe(worst.f))}</code> takes it from ${U.num(full)} to <strong>${U.num(worst.n)}</strong>.</p>
      <table><tr><th>Remove this row</th><th>Count becomes</th></tr>
      ${drops.slice(0, 4).map((d) => `<tr><td><code>${U.esc(S.describe(d.f))}</code></td><td>${U.num(d.n)}</td></tr>`).join('')}</table>
      ${full === 0 ? '<p class="bz-small">Every row is ANDed, so a single over-tight condition zeroes the whole segment. Loosen the one at the top of that table first.</p>' : ''}`;
  }

  function say(html, did) {
    log.push({ role: 'op', html: html + (did ? `<div class="bz-op__did"><b>Done</b>${did}</div>` : '') });
  }
  const youSaid = (t) => log.push({ role: 'you', html: U.esc(t) });

  function score(q, keys) {
    let s = 0;
    keys.forEach((k) => { if (q.includes(k)) s += k.length > 6 ? 3 : 2; });
    return s;
  }

  /* ---------- the brain ----------------------------------------------------- */

  function respond(raw) {
    const q = raw.toLowerCase().trim();
    const c = ctx();
    if (!q) return;

    /* ===== ACTIONS (checked before knowledge, so "create X" never just explains X) */

    /* -- count / how many ------------------------------------------------- */
    if (/^(how many|count|what'?s the size|how big)/.test(q)) {
      const { filters, why } = extractFilters(q);
      if (!filters.length) {
        return say(`<p>I need something to count. Try <em>"how many Gold and Platinum members in Israel"</em> or <em>"how many users have the app"</em>.</p>`);
      }
      const r = S.reach(filters), rr = S.reachability(filters);
      return say(`<p><strong>${U.num(r.count)} users</strong> — ${r.pct.toFixed(1)}% of the ${U.num(r.total)} profiles in this workspace.</p>
        <table><tr><th>Channel</th><th>Reachable</th></tr>
        <tr><td>Email</td><td>${U.num(rr.email)}</td></tr>
        <tr><td>Push</td><td>${U.num(rr.push)}</td></tr>
        <tr><td>SMS</td><td>${U.num(rr.sms)}</td></tr></table>
        <p class="bz-small">Filters I used: ${filters.map((f) => `<code>${U.esc(S.describe(f))}</code>`).join(' AND ')}</p>
        <p class="bz-small">Report the <em>reachable</em> number, never the segment size.</p>`);
    }

    /* -- build a segment --------------------------------------------------- */
    if (/(build|create|make|set up|give me).{0,20}(segment|audience)|^segment (of|for)/.test(q)) {
      const { filters, why } = extractFilters(q);
      if (!filters.length) {
        return say(`<p>Tell me who should be in it and I will build it. I understand things like:</p>
          <ul><li>tiers — <em>Gold, Platinum, VIP</em></li><li>countries — <em>Israel, Germany, UK…</em></li>
          <li>lifecycle — <em>lapsed 180 days, never booked, arriving in 21 days, abandoners</em></li>
          <li>traits — <em>families, business travellers, app users, spa bookers</em></li>
          <li>thresholds — <em>points over 5000, LTV over 10000, at least 3 stays</em></li></ul>
          <p>e.g. <em>"build a segment of lapsed Gold members in Israel with the app"</em>.</p>`);
      }
      const seg = {
        id: U.uid('seg'), _userCreated: true, createdBy: 'BrazeAI Operator', tags: ['operator'],
        name: raw.replace(/^(build|create|make|set up|give me)\s+(me\s+)?(a\s+)?(segment|audience)\s*(of|for|with)?\s*/i, '').trim().slice(0, 60) || 'Operator segment',
        description: 'Built by the Operator from: "' + raw.trim() + '"',
        filters,
      };
      window.BZ.segments.push(seg); U.Store.save();
      const r = S.reach(filters), rr = S.reachability(filters);
      location.hash = '#/segments/' + seg.id;
      return say(`<p>Built it — <strong>${U.num(r.count)} users</strong> match${r.count ? `, ${U.num(rr.email)} email-reachable` : ''}.</p>
        ${r.count === 0 ? '<p>That is an empty audience, which is worth understanding rather than just loosening at random.</p>' : ''}
        <p><strong>Why these filters:</strong></p><ul>${why.map((w) => `<li>${w}</li>`).join('')}</ul>
        ${r.count < 15 ? constraintReport(filters) : ''}
        <p class="bz-small">Every row is ANDed. Adjust or delete rows on the screen and the count updates live.</p>`,
        `Created segment <strong>${U.esc(seg.name)}</strong> with ${filters.length} filter${filters.length > 1 ? 's' : ''} and opened it.`);
    }

    /* -- add a filter to the open segment ---------------------------------- */
    if (/^(add|include|also)\b.*(filter|row)|^(add|also) (a )?(filter )?(for|on)\b/.test(q)) {
      if (!c.segment) return say(`<p>Open a segment first — I add filters to whatever is on screen. <a href="#/segments">Segments →</a></p>`);
      const { filters, why } = extractFilters(q);
      if (!filters.length) return say(`<p>I could not tell what to filter on. Try <em>"add a filter for app users"</em> or <em>"add a filter for points over 5000"</em>.</p>`);
      c.segment.filters.push.apply(c.segment.filters, filters);
      c.segment._edited = true; U.Store.save(); window.BZApp.render();
      const r = S.reach(c.segment.filters);
      return say(`<p>Added. The segment is now <strong>${U.num(r.count)} users</strong>.</p><ul>${why.map((w) => `<li>${w}</li>`).join('')}</ul>`,
        `Added ${filters.length} filter${filters.length > 1 ? 's' : ''} to <strong>${U.esc(c.segment.name)}</strong>.`);
    }

    /* -- is this segment safe to send to ----------------------------------- */
    if (/(safe|ok|sanity|review|check).{0,24}(segment|audience|send)|audit (this )?segment/.test(q) && c.segment) {
      const f = c.segment.filters, rr = S.reachability(f), r = S.reach(f);
      const issues = [];
      if (!f.length) issues.push('No filters at all — this targets <strong>everyone</strong>. Almost never what you want.');
      if (!f.some((x) => x.field.startsWith('subscription.') || x.field === 'email_subscribe')) issues.push('No consent filter. Add a subscription-group row if this is promotional — Braze will not enforce it for you.');
      const started = f.find((x) => x.field === 'event.booking_started');
      const completed = f.find((x) => x.field === 'event.booking_completed' && x.op === 'not_performed_in_last_days');
      if (started && completed && Number(completed.value) < Number(started.value)) issues.push(`Window mismatch: you include ${started.value} days of starts but only exclude ${completed.value} days of completions. Someone who started <em>and</em> completed on day ${completed.value + 1} still qualifies. Make the exclusion window ≥ the inclusion window.`);
      if (r.pct > 60) issues.push(`This is ${r.pct.toFixed(0)}% of the entire base. Check that is deliberate.`);
      if (r.count === 0) issues.push('Zero users match. Usually two rows that cannot both be true — read them aloud with "and" between each.');
      if (rr.push < rr.total * 0.4) issues.push(`Only ${U.num(rr.push)} of ${U.num(rr.total)} are push-reachable, so do not promise the segment size for a push send.`);
      return say(`<p><strong>${U.esc(c.segment.name)}</strong> — ${U.num(r.count)} users, ${U.num(rr.email)} email-reachable.</p>
        ${issues.length ? `<p><strong>${issues.length} thing${issues.length > 1 ? 's' : ''} to look at:</strong></p><ol>${issues.map((i) => `<li>${i}</li>`).join('')}</ol>`
          : '<p>Nothing structural jumps out. Consent filter present, windows consistent, size plausible.</p>'}
        <p class="bz-small">I can only check the machine-checkable half. Links, timing and collisions with other sends are still on you — ask me for the full checklist.</p>`);
    }

    /* -- why is my segment empty / too small -------------------------------- */
    if (/(why|which).{0,30}(empty|zero|no users|nobody|too small|so small|dropped|shrunk|killing|constraint)/.test(q) ||
        /which filter/.test(q)) {
      if (!c.segment) return say('<p>Open the segment and ask again — I diagnose whatever is on screen. <a href="#/segments">Segments →</a></p>');
      const r = S.reach(c.segment.filters);
      const rep = constraintReport(c.segment.filters);
      return say(`<p><strong>${U.esc(c.segment.name)}</strong> currently matches <strong>${U.num(r.count)}</strong> of ${U.num(r.total)} profiles.</p>
        ${rep || '<p>No single filter is the culprit — the rows are each doing modest work and the combination is simply narrow.</p>'}
        <p class="bz-small">In production the other two causes are worth checking before you touch the filters: a campaign moved people out legitimately (they booked, so their <code>last_stay_date</code> is recent now), or an attribute stopped arriving — nulls fail date comparisons silently, so profiles drop out without any error.</p>`);
    }

    /* -- pre-launch check on a campaign ------------------------------------ */
    if (/(pre.?launch|launch check|ready to (send|launch)|audit|review).{0,20}(campaign)?/.test(q) && c.campaign) {
      const cp = c.campaign;
      const seg = window.BZ.segments.find((s) => s.id === cp.segmentId);
      const tpl = window.BZ.templates.find((t) => t.id === cp.templateId);
      const rr = seg ? S.reachability(seg.filters) : { total: 0, email: 0, push: 0, sms: 0 };
      const lint = tpl ? window.BZLiquid.lint(tpl.body + '\n' + tpl.subject) : [];
      const rows = [
        [!!cp.conversionEvents.length, 'Conversion event set'],
        [rr.total > 0, 'Audience resolves to at least one user'],
        [cp.deliveryType !== 'action_based' || !!cp.trigger.exception, 'Action-based send has an exception event'],
        [!!tpl && /set_user_to_unsubscribed_url|aurelia_footer|unsubscribe/i.test(tpl.body), 'Unsubscribe link present'],
        [!!tpl && /\|\s*default\s*:/.test(tpl.body + tpl.subject), 'Personalization has a fallback'],
        [!!seg && seg.filters.some((x) => x.field.startsWith('subscription.')), 'Audience filters on a subscription group'],
      ];
      return say(`<p><strong>${U.esc(cp.name)}</strong> — ${U.num(rr.total)} in audience, ${U.num(cp.channels[0] === 'Push' ? rr.push : rr.email)} reachable on ${U.esc(cp.channels[0])}.</p>
        <ul>${rows.map(([ok, t]) => `<li>${ok ? '✅' : '❌'} ${t}</li>`).join('')}</ul>
        ${lint.length ? `<p><strong>Template linter:</strong></p><ul>${lint.map((i) => `<li>${U.esc(i.text)}</li>`).join('')}</ul>` : ''}
        <p class="bz-small">Still yours to do by hand: click every link, check UTMs, confirm nothing else big goes out the same day, and make sure the seed list is on.</p>`);
    }

    /* -- review a canvas ---------------------------------------------------- */
    if (/(review|check|audit|problem|wrong).{0,20}(canvas|journey|flow)/.test(q) || (/(review|check|audit)/.test(q) && c.canvas)) {
      if (!c.canvas) return say('<p>Open a Canvas and I will walk it. <a href="#/canvases">Canvases →</a></p>');
      const cv = c.canvas, issues = [];
      const flat = [];
      (function walk(list) { list.forEach((s) => { flat.push(s); (s.paths || []).forEach((p) => walk(p.steps)); }); })(cv.steps);

      const firstMsgIdx = flat.findIndex((s) => s.kind === 'message');
      const longAction = flat.find((s, i) => s.kind === 'action_paths' && i < firstMsgIdx);
      if (longAction) issues.push('An Action Paths step sits before your first message — every non-matching user waits out the whole evaluation window before receiving anything. Branch <em>after</em> the value is delivered.');
      flat.filter((s) => s.kind === 'action_paths').forEach((s) => {
        const d = parseInt(s.config.window, 10);
        if (d >= 5) issues.push(`"${U.esc(s.name)}" holds users for ${U.esc(s.config.window)}. Most email opens happen within 24h — a long window buys little signal for a large delay cost.`);
      });
      flat.filter((s) => s.kind === 'audience_paths').forEach((s) => {
        const last = (s.paths || [])[s.paths.length - 1];
        if (last && !/every|else|other|all/i.test(last.label)) issues.push(`"${U.esc(s.name)}" has no catch-all path. Audience Paths are first-match-wins, so anyone matching nothing drops out of the journey silently.`);
      });
      if (/before|until/.test(JSON.stringify(cv.steps)) && !flat.some((s) => /lead|short|soon/i.test(s.name)))
        issues.push('There is a delay relative to an attribute date ("until N days before arrival"). A booking made <em>inside</em> that window is already past the gate — add a lead-time branch near the top or those guests fall out.');
      if (!cv.entry.reeligibility.allow && /pre.?arrival|booking|stay/i.test(cv.name))
        issues.push('Re-eligibility is off on a booking-driven journey. A guest who books twice only ever gets one pre-arrival sequence.');
      if (!cv.entry.conversionEvents.length) issues.push('No conversion event — this journey can only be judged on opens and clicks, which is to say it cannot be judged.');

      return say(`<p><strong>${U.esc(cv.name)}</strong> — ${flat.length} steps, entry: ${U.esc(cv.entry.type.replace('_', '-'))}.</p>
        ${issues.length ? `<p><strong>${issues.length} thing${issues.length > 1 ? 's' : ''} worth fixing:</strong></p><ol>${issues.map((i) => `<li>${i}</li>`).join('')}</ol>`
          : '<p>Structurally sound — branches have catch-alls, no long waits before the first message, conversion event set.</p>'}`);
    }

    /* -- create a canvas / campaign ---------------------------------------- */
    if (/(create|build|make|new|start).{0,16}canvas|new journey/.test(q)) {
      const cv = {
        id: U.uid('cv'), name: 'Operator Canvas', status: 'draft', _userCreated: true,
        description: 'Started by the Operator. Configure entry, then build the flow.',
        entry: { type: 'action_based', trigger: 'Performs custom event `booking_completed`', segmentId: 'seg-all',
          reeligibility: { allow: true, cooldown: '1 day' }, entryWindow: 'Anytime',
          conversionEvents: [{ event: 'checked_in', window: '30 days', primary: true }],
          sendInUserTz: true, quietHours: '21:00 – 08:00' },
        stats: { entered: 0, converted: 0, revenue: 0 },
        steps: [window.BZCanvas.newStep('message'), window.BZCanvas.newStep('delay'),
                window.BZCanvas.newStep('audience_paths'), window.BZCanvas.newStep('exit')],
      };
      window.BZ.canvases.push(cv); U.Store.save(); location.hash = '#/canvases/' + cv.id;
      return say(`<p>Started you a Canvas with a sensible skeleton: message → delay → audience split → exit.</p>
        <p>Click the entry card first — trigger, entry audience, re-eligibility and conversion event are the settings that shape everything downstream. Then click <strong>+</strong> between steps to build the flow.</p>`,
        'Created a draft Canvas and opened it.');
    }
    if (/(create|build|make|new|start).{0,16}campaign/.test(q)) {
      window.BZApp.openWizard();
      const kind = /abandon/.test(q) ? 'abandonment' : /win.?back/.test(q) ? 'win-back' : /pre.?arrival/.test(q) ? 'pre-arrival' : null;
      if (kind === 'abandonment') {
        setTimeout(() => {
          Object.assign(window.BZApp.wizard, { name: 'Abandoned booking — 4h reminder', channel: 'Email',
            templateId: 'tpl-abandon', segmentId: 'seg-abandoners', deliveryType: 'action_based',
            trigger: 'booking_started', delay: '4 hours', exception: 'booking_completed',
            conv: 'booking_completed', convWindow: '72 hours' });
          window.BZApp.render();
        }, 0);
        return say(`<p>Opened the wizard pre-filled as an abandonment campaign — action-based on <code>booking_started</code>, 4-hour delay, <code>booking_completed</code> as the exception event.</p>
          <p>The exception is the part that makes it correct: a guest who finishes inside the delay never receives the reminder.</p>`,
          'Opened Create Campaign with abandonment defaults.');
      }
      return say('<p>Opened the campaign wizard. Work left to right: Compose → Target Audience → Delivery → Conversion Events → Review.</p><p>Ask me at any step if you are unsure which option to pick.</p>', 'Opened Create Campaign.');
    }

    /* -- add a canvas step -------------------------------------------------- */
    if (/(add|insert).{0,24}(step|delay|message|path|webhook)/.test(q)) {
      if (!c.canvas) return say('<p>Open a Canvas first and I will add the step there. <a href="#/canvases">Canvases →</a></p>');
      const kind = /audience/.test(q) ? 'audience_paths' : /action/.test(q) ? 'action_paths'
        : /experiment|test/.test(q) ? 'experiment_paths' : /webhook/.test(q) ? 'webhook'
        : /update|attribute/.test(q) ? 'update_user' : /delay|wait/.test(q) ? 'delay'
        : /exit/.test(q) ? 'exit' : 'message';
      const step = window.BZCanvas.newStep(kind);
      const exitIdx = c.canvas.steps.findIndex((s) => s.kind === 'exit');
      c.canvas.steps.splice(exitIdx > -1 ? exitIdx : c.canvas.steps.length, 0, step);
      c.canvas._edited = true; U.Store.save();
      window.BZCanvas.select(step.id); window.BZApp.render();
      const tips = {
        audience_paths: 'Evaluated instantly on arrival, first match wins. Order most-specific first and keep a catch-all last.',
        action_paths: 'This one <em>waits</em>. Keep the window short (24–48h) and never put it before your primary message.',
        experiment_paths: 'Assignment is sticky per user. Include a control path if you want to measure incrementality.',
        webhook: 'Failures are silent — log on the receiving end.',
        update_user: 'Great for journey state. Careful if that attribute is also an entry trigger somewhere.',
        delay: 'Relative-to-attribute delays ("until 7 days before arrival") drop users whose date has already passed.',
        message: 'Set the channel and template on the right, and remember a step-level audience filter can silently drop users.',
      };
      return say(`<p>Added and selected it — configure it in the panel on the right.</p><p>${tips[kind] || ''}</p>`,
        `Inserted a <strong>${U.esc(step.name)}</strong> step before Exit.`);
    }

    /* -- write / insert Liquid --------------------------------------------- */
    if (/(write|give|show|generate|make|insert|need).{0,26}(liquid|snippet|code|personalis|personaliz)|^liquid for/.test(q)) {
      let best = null, bs = 0;
      SNIPPETS.forEach((s) => { const v = score(q, s.keys); if (v > bs) { bs = v; best = s; } });
      if (!best) best = SNIPPETS[0];
      let did = null;
      if (c.template) {
        const ta = document.getElementById('bz-body');
        c.template.body += '\n' + best.code + '\n';
        c.template._edited = true; U.Store.save(); window.BZApp.render();
        did = `Appended it to <strong>${U.esc(c.template.name)}</strong> — check the live preview.`;
      }
      return say(`<p><strong>${best.label}</strong></p><pre><code>${U.esc(best.code)}</code></pre><p>${best.note}</p>
        ${c.template ? '' : '<p class="bz-small">Open a template and ask again and I will paste it straight in.</p>'}`, did);
    }

    /* -- check a template --------------------------------------------------- */
    if (/(check|lint|review|audit|test|problem|wrong|debug).{0,24}(template|email|liquid|this)/.test(q) || (/^(check|lint) it/.test(q) && c.template)) {
      if (!c.template) return say('<p>Open a template and I will run it against the awkward profiles. <a href="#/templates">Email Templates →</a></p>');
      const tpl = c.template;
      const lint = window.BZLiquid.lint(tpl.body + '\n' + tpl.subject);
      /* render against deliberately awkward profiles */
      const probes = [
        { label: 'no first name', u: Object.assign({}, window.BZ.users[5], { first_name: '' }) },
        { label: 'all-null attributes', u: window.BZ.userById('AUR-100001') },
        { label: 'fully populated', u: window.BZ.userById('AUR-100000') },
      ];
      const results = probes.map((p) => {
        const r = U.renderLiquid(tpl.body + '\n' + tpl.subject, p.u, { event_properties: U.triggerEventFor(p.u, 'booking_started') });
        return { label: p.label, warns: r.warnings, errs: r.errors, aborted: r.aborted };
      });
      const anyBad = results.some((r) => r.warns.length || r.errs.length || r.aborted);
      return say(`<p><strong>${U.esc(tpl.name)}</strong> — rendered against three profiles.</p>
        <table><tr><th>Profile</th><th>Result</th></tr>
        ${results.map((r) => `<tr><td>${U.esc(r.label)}</td><td>${
          r.aborted ? '⛔ aborted: ' + U.esc(r.aborted)
          : r.errs.length ? '❌ ' + U.esc(r.errs[0])
          : r.warns.length ? '⚠️ empty: <code>' + U.esc(r.warns.slice(0, 2).join(', ')) + '</code>'
          : '✅ clean'}</td></tr>`).join('')}</table>
        ${lint.length ? `<p><strong>Linter:</strong></p><ul>${lint.map((i) => `<li>${U.esc(i.text)}</li>`).join('')}</ul>` : ''}
        <p class="bz-small">${anyBad ? 'Anything showing empty needs a <code>| default:</code> or an <code>{% if %}</code> guard — that is what a real recipient would see.'
          : 'Clean across all three. Still send yourself a real test before launch: preview does not catch client rendering.'}</p>`);
    }

    /* -- find a user --------------------------------------------------------- */
    if (/(find|show|get) (me )?(a )?(user|guest|profile|someone)/.test(q)) {
      const { filters } = extractFilters(q);
      const list = filters.length ? S.evaluate(filters) : window.BZ.users;
      if (!list.length) return say('<p>Nobody in this workspace matches that. Loosen a condition.</p>');
      const u = list[0];
      location.hash = '#/users/' + u.external_id;
      return say(`<p><strong>${U.esc(u.first_name + ' ' + u.last_name)}</strong> · ${U.esc(u.external_id)} — ${U.esc(u.custom.loyalty_tier)}, ${u.custom.total_stays} stays, ${U.money(u.custom.lifetime_value)} LTV.</p>
        <p class="bz-small">${U.num(list.length)} profile${list.length > 1 ? 's' : ''} matched; opened the first.</p>`, 'Opened the profile.');
    }

    /* -- explain this screen -------------------------------------------------- */
    if (/(explain|what is|what am i|where am i|what does).{0,22}(this|screen|page|here)|^help$|^what now/.test(q)) {
      const E = {
        segments: 'The segment builder. Every filter row is <strong>ANDed</strong> — there is no OR between rows. The purple bar is the live count over the 240 seeded profiles, and the strip underneath is per-channel reachability, which is the number you actually report. The sample table at the bottom is there to be eyeballed before any large send.',
        canvases: 'Canvas Flow. The entry card at the top holds the settings that shape everything: trigger, entry audience, re-eligibility, conversion event. Click any step to configure it, <strong>+</strong> to insert one. The number to watch in production is the <em>drop between steps</em> — that is where an Action Path window or a step-level filter is quietly removing people.',
        campaigns: 'Campaigns — one message each. The wizard walks Compose → Target Audience → Delivery → Conversion Events → Review. If what you are building has a wait in it, stop and build a Canvas instead.',
        templates: 'The composer. HTML and Liquid on the left, live render against a real profile on the right. The profile selector matters more than it looks: switch to <strong>Edge case</strong> to preview against a null-heavy guest, which is where templates actually break.',
        users: 'A user profile. Custom attributes are state, custom events are history. The message history tab answers "why did this guest get that email" — the most common question you will be asked.',
        analytics: 'Campaign performance. Read the league table with care: pre-arrival converts high because it goes to people with a paid booking, win-back converts low because it goes to people who left. Compare each against its own history, never against each other.',
        data: 'Your schema. Watch the "set on" column — an attribute that silently stops arriving takes your segments down with it, because nulls fail date filters without erroring.',
        catalogs: 'Catalogs are tables Liquid joins against at send time, keeping prices and images out of templates. Always guard the lookup with <code>{% abort_message %}</code>.',
        subscriptions: 'Per-topic consent. The trap: Braze will not stop you emailing a promotion to someone who left the Promotions group unless you filter on it.',
        blocks: 'Reusable HTML fragments. Edit once, every template updates.',
        learn: 'Nine courses. Read the concept, then do the tasks in the sandbox <em>before</em> opening the solution.',
        home: 'The dashboard. Start with Case Studies on the left, and keep me open — I can build things for you as you go.',
      };
      return say(`<p>${E[c.route] || 'Not much to say about this screen.'}</p>`);
    }

    /* -- navigation ------------------------------------------------------------ */
    const navMatch = q.match(/^(go to|open|take me to|show me the)\s+(.+)$/);
    if (navMatch) {
      const target = navMatch[2].replace(/\bpage|screen|section\b/g, '').trim();
      const routes = { campaign: 'campaigns', canvas: 'canvases', template: 'templates', email: 'templates',
        segment: 'segments', user: 'users', catalog: 'catalogs', analytic: 'analytics', report: 'analytics',
        data: 'data', subscription: 'subscriptions', block: 'blocks', learn: 'learn', course: 'learn',
        'case stud': 'learn', home: 'home', dashboard: 'home' };
      for (const [k, r] of Object.entries(routes)) {
        if (target.includes(k)) { location.hash = '#/' + r; return say(`<p>Opened <strong>${SCREEN_NAME[r]}</strong>.</p>`); }
      }
    }

    /* -- what should I do next ------------------------------------------------- */
    /* Anchored deliberately: a loose "what … should i" also swallows
       "what conversion window should i use", which is a knowledge question. */
    if (/^(what|where)\s+(should i|do i)\s+(start|begin|do|practise|practice|focus|learn)/.test(q) ||
        /^(guide me|what now|what next|where do i start|help me get started)/.test(q)) {
      return say(`<p>If you are starting cold, do it in this order — it mirrors how the work actually arrives:</p>
        <ol><li><strong>Read Foundations</strong> (<a href="#/learn/c-foundations">course 1</a>) so the object model is solid. Everything else depends on it.</li>
        <li><strong>Build a segment by hand</strong> — try "Israeli families with an upcoming stay". Watch the count move as you add rows.</li>
        <li><strong>Open a template</strong> and hit <strong>Edge case</strong>. Understand why it breaks and fix it.</li>
        <li><strong>Walk the pre-arrival Canvas</strong> step by step and read every entry setting.</li>
        <li><strong>Build a Canvas from scratch</strong> with an Audience Paths split. This is the exercise that proves you have it.</li></ol>
        <p>Then work the case studies in order. Do the tasks before reading the solutions — reading a solution you have not attempted feels productive and teaches almost nothing.</p>`);
    }

    /* -- who are you ------------------------------------------------------------ */
    if (/(who are you|what are you|are you (an? )?(ai|llm|gpt|claude|real))/.test(q)) {
      return say(`<p>I am the sandbox's built-in operator, modelled on Braze's in-product AI assistant.</p>
        <p><strong>Being straight with you:</strong> I am not a live language model. This page runs entirely in your browser with no model behind it, so I work by matching what you type against a curated set of topics and actions. I will not free-associate, and if I do not recognise something I will say so rather than invent an answer.</p>
        <p>What I <em>can</em> do is real: build segments from a description and compute the actual counts, create campaigns and Canvas steps, write and insert Liquid, and lint your templates against awkward profiles.</p>`);
    }

    /* ===== KNOWLEDGE ======================================================== */
    let best = null, bestScore = 0;
    KB.forEach((k) => { const v = score(q, k.keys); if (v > bestScore) { bestScore = v; best = k; } });
    if (best && bestScore >= 3) return say(`<p><strong>${best.t}</strong></p>${best.a}`);

    /* ===== FALLBACK ========================================================= */
    return say(`<p>I do not have a confident answer for that one — and I would rather say so than make something up.</p>
      <p><strong>Things I can do right now:</strong></p>
      <ul>
        <li><em>"Build a segment of lapsed Gold members in Israel"</em> — and I compute the real count</li>
        <li><em>"How many users have the app?"</em></li>
        <li><em>"Write Liquid for a tier-based offer"</em> — pasted into the open template</li>
        <li><em>"Check this template"</em> — rendered against three awkward profiles</li>
        <li><em>"Add an Audience Paths step"</em> · <em>"Create an abandonment campaign"</em></li>
        <li><em>"Run a pre-launch check"</em> · <em>"Explain this screen"</em></li>
      </ul>
      <p><strong>Topics I know well:</strong> attributes vs events, campaign vs Canvas, Action vs Audience Paths, why filters are ANDed, conversion windows, re-eligibility, subscription groups, Liquid namespaces and fallbacks, catalogs, Connected Content, frequency capping, quiet hours, incrementality and holdouts, deliverability, and what to expect in the interview.</p>
      <p class="bz-small">The <a href="#/learn">case studies</a> go deeper than I do.</p>`);
  }

  /* ---------- UI ------------------------------------------------------------- */

  function mount() {
    if (mounted) return;
    mounted = true;

    const fab = document.createElement('button');
    fab.className = 'bz-op__fab';
    fab.innerHTML = '<span>✦</span> Ask BrazeAI';
    fab.addEventListener('click', () => toggle(true));
    document.body.appendChild(fab);

    const panel = document.createElement('aside');
    panel.className = 'bz-op';
    panel.id = 'bz-op';
    panel.setAttribute('aria-label', 'BrazeAI Operator');
    panel.innerHTML = `
      <div class="bz-op__head">
        <span class="bz-op__spark">✦</span>
        <div><div class="bz-op__title">BrazeAI Operator</div>
        <div class="bz-op__sub">Answers questions · builds things for you</div></div>
        <button class="bz-op__x" id="bz-op-close" aria-label="Close">✕</button>
      </div>
      <div class="bz-op__ctx" id="bz-op-ctx"></div>
      <div class="bz-op__log" id="bz-op-log"></div>
      <div class="bz-op__chips" id="bz-op-chips"></div>
      <form class="bz-op__form" id="bz-op-form">
        <input class="bz-op__in" id="bz-op-in" placeholder="Ask, or tell me to build something…" autocomplete="off">
        <button class="bz-op__send" type="submit" aria-label="Send">↑</button>
      </form>`;
    document.body.appendChild(panel);

    panel.querySelector('#bz-op-close').addEventListener('click', () => toggle(false));
    panel.querySelector('#bz-op-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const inp = document.getElementById('bz-op-in');
      const v = inp.value.trim();
      if (!v) return;
      inp.value = '';
      ask(v);
    });
    panel.querySelector('#bz-op-chips').addEventListener('click', (e) => {
      const chip = e.target.closest('.bz-op__chip');
      if (chip) ask(chip.textContent);
    });

    say(`<p>I am the sandbox operator. I answer questions about Braze <em>and</em> I build things — segments, campaigns, Canvas steps, Liquid — in the screens next to me.</p>
      <p>I know which screen you are on, so "explain this" and "check this" both work without you telling me what "this" is.</p>
      <p class="bz-small">Not a live language model — this page has no model behind it. I match what you type against a curated set of topics and actions, and I tell you when I do not know.</p>`);
    paint();
  }

  function toggle(open) {
    isOpen = open === undefined ? !isOpen : open;
    document.getElementById('bz-op').classList.toggle('is-open', isOpen);
    document.body.classList.toggle('bz-op-open', isOpen);
    if (isOpen) { paint(); setTimeout(() => { const i = document.getElementById('bz-op-in'); if (i) i.focus(); }, 220); }
  }

  function ask(text) {
    youSaid(text);
    respond(text);
    paint();
  }

  function paint() {
    const logEl = document.getElementById('bz-op-log');
    if (!logEl) return;
    logEl.innerHTML = log.map((m) => `<div class="bz-op__msg bz-op__msg--${m.role}">${m.html}</div>`).join('');
    logEl.scrollTop = logEl.scrollHeight;

    document.getElementById('bz-op-ctx').innerHTML = '◉ ' + U.esc(ctxLabel());

    const c = ctx();
    const chips = CHIPS[c.route] || CHIPS.home;
    document.getElementById('bz-op-chips').innerHTML =
      chips.map((t) => `<button class="bz-op__chip">${U.esc(t)}</button>`).join('');
  }

  function onNavigate() { if (mounted) paint(); }

  return { mount, toggle, ask, onNavigate, respond };
})();

window.BZOperator = BZOperator;
