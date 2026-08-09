/* ==========================================================================
   Braze Sandbox — case studies & drills
   Structured like Braze Learning: short concept, then a real brief you would
   actually get from a commercial team, then tasks with solution keys.
   Every task is doable inside this sandbox.
   ========================================================================== */

const BZCourses = [

/* ======================================================================== */
{
  id: 'c-foundations',
  icon: '🧱',
  title: 'Foundations — how Braze actually models your data',
  blurb: 'Users, attributes, events, the segment/campaign/Canvas triangle, and the vocabulary you will be expected to already know.',
  minutes: 25,
  body: `
<h2>The object model</h2>
<p>Nearly every mistake a new Braze user makes traces back to not knowing which of five objects they are touching. Learn these and most of the platform explains itself.</p>

<table>
  <tr><th>Object</th><th>What it is</th><th>Where it comes from</th></tr>
  <tr><td><strong>User profile</strong></td><td>One person. Keyed by <code>external_id</code> (your CRM/PMS id). Anonymous users get an alias until they identify.</td><td>SDK, REST <code>/users/track</code>, or a CDP</td></tr>
  <tr><td><strong>Standard attribute</strong></td><td>Fields Braze knows natively: <code>first_name</code>, <code>email</code>, <code>country</code>, <code>language</code>, <code>time_zone</code>, subscription state.</td><td>Reserved keys on <code>/users/track</code></td></tr>
  <tr><td><strong>Custom attribute</strong></td><td>Anything about the person that is <em>true right now</em>: <code>loyalty_tier</code>, <code>points_balance</code>, <code>next_stay_date</code>. Overwritten on each update.</td><td>Your integration</td></tr>
  <tr><td><strong>Custom event</strong></td><td>Something that <em>happened</em>, with a timestamp and properties: <code>booking_started</code>, <code>checked_out</code>. Append-only.</td><td>SDK or REST</td></tr>
  <tr><td><strong>Purchase</strong></td><td>A special event with product id, price and currency. Feeds revenue reporting automatically.</td><td>SDK or REST</td></tr>
</table>

<div class="bz-callout">
  <div class="bz-callout__t">The rule that decides attribute vs event</div>
  <p>If you would ever ask <em>"how many times?"</em> or <em>"when?"</em>, it is an <strong>event</strong>. If you only ever ask <em>"what is it now?"</em>, it is an <strong>attribute</strong>. <code>total_stays</code> is an attribute; <code>checked_out</code> is an event. Storing "last booking" only as an attribute throws away the history you will want six months later — and you cannot get it back retroactively.</p>
</div>

<h2>Custom event properties are not free</h2>
<p>You can segment on an event ("performed <code>booking_started</code> in the last 7 days") for the full retention window. But segmenting on an event <em>property</em> ("...where <code>city</code> = Eilat") is only available for a shorter window and is not available on every plan tier. Personalization inside the message body, however, can always read <code>{{event_properties.\${city}}}</code> for the event that triggered the send.</p>

<div class="bz-callout bz-callout--warn">
  <div class="bz-callout__t">This trips up every new hire</div>
  <p><code>{{event_properties.\${…}}}</code> only resolves for <strong>action-based</strong> campaigns and Canvas entry — the message has to have been triggered by the event you are reading. Put it in a scheduled campaign and it renders empty for everyone.</p>
</div>

<h2>Campaign vs Canvas</h2>
<table>
  <tr><th></th><th>Campaign</th><th>Canvas</th></tr>
  <tr><td>Shape</td><td>One message (or one multichannel burst)</td><td>A multi-step journey over time</td></tr>
  <tr><td>Use when</td><td>Single send: a newsletter, a flash sale, one triggered reminder</td><td>Sequence with waits, branching, or several messages</td></tr>
  <tr><td>Testing</td><td>A/B variants on one message</td><td>Experiment Paths across whole branches</td></tr>
  <tr><td>Reporting</td><td>Per-message</td><td>Per-step, plus whole-journey conversion</td></tr>
</table>
<p>Practical guidance you will hear from any Braze CSM: if it has a <em>wait</em> in it, build it as a Canvas. Re-building a campaign into a Canvas later loses the historical stats, so start in the right place.</p>

<h2>Workspaces and environments</h2>
<p>A <strong>workspace</strong> (formerly "app group") holds one user base, its API keys and its data. Most hotel groups run at least a production and a staging workspace. Users do <em>not</em> cross workspaces — a test user in staging is a different person from the same email in production, and you cannot copy a segment between them (you can copy campaigns and Canvases).</p>
`,
  tasks: [
    {
      q: 'The revenue team asks for "guests who booked a spa treatment". They want to target people who have <em>ever</em> booked one, and later they want to know how often. Attribute, event, or both?',
      a: `<p><strong>Both, and that is the correct answer, not a hedge.</strong></p>
<ul>
  <li>Fire a custom event <code>spa_booked</code> with properties <code>hotel_id</code>, <code>treatment</code>, <code>price</code> on every booking. This gives you frequency, recency and revenue forever.</li>
  <li>Also maintain a boolean custom attribute <code>spa_booker</code>. Why duplicate? Because attribute filters are cheap and instant, and "has ever done X" as an event filter over a long lookback is the slowest kind of segment. Your integration sets the flag once, on the first spa booking.</li>
</ul>
<p>This attribute-shadowing-an-event pattern is extremely common in production Braze setups. Open <strong>Audience → Segments</strong> in this sandbox and you will see <code>spa_booker</code> sitting alongside the <code>spa_booked</code> event.</p>`,
    },
    {
      q: 'A developer proposes sending <code>last_booking_hotel</code>, <code>second_last_booking_hotel</code> and <code>third_last_booking_hotel</code> as three custom attributes. What do you say?',
      a: `<p>Push back. That is an event history flattened into attributes, and it will rot: it needs shifting logic on every booking, it caps at three, and it cannot answer "which brand do they book most?"</p>
<p>Correct: send <code>booking_completed</code> as an event with a <code>hotel_id</code> property. If you need fast targeting on the derived answer, compute <code>preferred_brand</code> once in your warehouse and send <em>that</em> single attribute. One derived attribute, backed by full event history — not three positional ones.</p>`,
    },
    {
      q: 'You add <code>{{event_properties.\${hotel_name}}}</code> to the subject line of a scheduled Tuesday newsletter. What will recipients see?',
      a: `<p>An empty string — the subject line reads "Your stay at  is coming up". Scheduled campaigns have no triggering event, so there are no event properties to read.</p>
<p>For a scheduled send you must use a custom attribute instead: <code>{{custom_attribute.\${next_stay_hotel}}}</code>. And regardless of channel, always add a fallback: <code>{{custom_attribute.\${next_stay_hotel} | default: 'your next stay'}}</code>.</p>`,
    },
  ],
},

/* ======================================================================== */
{
  id: 'c-segmentation',
  icon: '🎯',
  title: 'Segmentation — building audiences that hold up',
  blurb: 'Filter logic, the AND-only trap, nested segments, reachability, and how to keep a segment from silently becoming zero.',
  minutes: 30,
  body: `
<h2>Filters are ANDed. All of them.</h2>
<p>The Braze segment builder joins every filter with <strong>AND</strong>. There is no OR between rows. This is the single most surprising thing about it for anyone coming from SQL or from Salesforce Marketing Cloud.</p>
<p>You get OR in exactly three ways:</p>
<ol>
  <li><strong>Multi-value operators</strong> — "is any of" on one filter is an OR across those values. <code>loyalty_tier is any of [Gold, Platinum]</code> is one row.</li>
  <li><strong>Audience Paths in a Canvas</strong> — each path is its own filter set, evaluated top-down, first match wins. This is the usual production answer.</li>
  <li><strong>Separate segments</strong>, targeted by separate campaigns.</li>
</ol>

<div class="bz-callout bz-callout--warn">
  <div class="bz-callout__t">Real incident</div>
  <p>A marketer wanted "Gold members OR guests with a stay in the next 7 days". They built both filters in one segment, saw the count drop to 34, assumed the data was broken, and escalated to the data team. Nothing was broken: the segment was Gold members <em>who also</em> have a stay in 7 days. Always read your filter list out loud with "and" between each line.</p>
</div>

<h2>Segment vs filter-at-send-time</h2>
<p>You can target a saved segment, and then <em>add more filters</em> on the campaign itself. Use saved segments for audiences reused across many campaigns; use campaign-level filters for one-off narrowing. If you save a segment for every campaign you will have 300 segments in a year and no one will know which are live.</p>

<h2>Nested segments</h2>
<p>A filter can be "is in segment X" / "is not in segment Y". This is how you build exclusions cleanly — one <code>Suppression — complaints & bounces</code> segment referenced everywhere, rather than the same four filters copy-pasted into thirty campaigns. When the suppression rule changes you edit it once.</p>

<h2>Reachability is not audience size</h2>
<p>A segment of 40,000 does not mean 40,000 emails. Subtract: unsubscribed, hard-bounced, no email on file, and — critically — anyone unsubscribed from the relevant <strong>subscription group</strong>. Braze shows reachable counts per channel; check them before you promise a number to a stakeholder.</p>

<div class="bz-callout bz-callout--tip">
  <div class="bz-callout__t">Do this in the sandbox</div>
  <p>Open <strong>Audience → Segments → Booking abandoners — last 7 days</strong>. Remove the <code>Promotions &amp; Offers is subscribed</code> row and watch both the total and the email-reachable number move. The gap between them is your real send volume.</p>
</div>

<h2>Recency, frequency and the "did NOT do" filter</h2>
<p>The abandonment pattern is always the same shape and it is worth memorising:</p>
<pre><code>performed  booking_started        in the last 7 days   AND
did NOT perform booking_completed in the last 7 days   AND
Promotions &amp; Offers is subscribed</code></pre>
<p>The second row is what makes it correct. Without it you email people who already booked — the fastest way to lose the trust of the commercial team.</p>

<div class="bz-callout bz-callout--warn">
  <div class="bz-callout__t">The lookback windows must match</div>
  <p>If you write "started in last 7 days" AND "did not complete in last <strong>1</strong> day", someone who started on day 6 and completed on day 6 still qualifies — they did not complete <em>in the last day</em>. The exclusion window must be at least as long as the inclusion window. In a Canvas, an Action Path with an exception event is safer than a segment filter for exactly this reason.</p>
</div>
`,
  tasks: [
    {
      q: 'Build in the sandbox: <em>Israeli Gold or Platinum members with a confirmed stay in the next 21 days who have the app.</em> Which filters, and what count do you get?',
      a: `<p>Go to <strong>Audience → Segments → Create Segment</strong> and add four rows:</p>
<pre><code>Country                    is           IL
loyalty_tier               is any of     Gold, Platinum
next_stay_date             is in the next X days   21
has_app                    is true</code></pre>
<p>Note row 2: one filter with "is any of", <em>not</em> two rows — two rows would demand the user be Gold AND Platinum simultaneously, giving you zero.</p>
<p>The live count appears in the purple bar as you build. Then check the reachability strip underneath: push-reachable will be lower than the total, because <code>has_app is true</code> does not imply <code>push_subscribe is opted_in</code>. That distinction is the whole point of this exercise.</p>`,
    },
    {
      q: 'Marketing wants a weekly "points expiring" email. Points expire 24 months after the last qualifying stay. What is wrong with segmenting on <code>points_balance &gt; 0</code> AND <code>last_stay_date more than 700 days ago</code>?',
      a: `<p>Three problems:</p>
<ol>
  <li><strong>It re-sends every week.</strong> Once someone crosses 700 days they stay past 700 days forever, so they receive the email every single week until they book. Either add a suppression attribute the send writes back (<code>points_expiry_notified_at</code>) and exclude on it, or build it as a Canvas with re-eligibility off.</li>
  <li><strong>The threshold is a moving target.</strong> Expiry depends on the <em>last qualifying stay</em>, and the window is 730 days, not 700. Hard-coding a day count in the segment means the offer date and the segment logic can drift apart. Better: your backend computes <code>points_expiry_date</code> as an attribute, and you segment on "is in the next 30 days".</li>
  <li><strong>No floor on the balance.</strong> <code>&gt; 0</code> includes people with 40 points, for whom the email is noise. Set a meaningful floor.</li>
</ol>
<p>The sandbox segment <strong>Points at risk — 5,000+ and dormant</strong> shows the corrected shape.</p>`,
    },
    {
      q: 'Your "Lapsed guests — 180+ days" segment showed 14,000 last month and shows 400 today. The data team swears nothing changed. What do you check first?',
      a: `<p>Check whether another campaign moved people out of the segment — that is usually the boring truth. In order:</p>
<ol>
  <li><strong>Did a win-back campaign run?</strong> If it drove bookings, those users now have a recent <code>last_stay_date</code> and correctly left the segment. Your segment worked.</li>
  <li><strong>Did an attribute stop arriving?</strong> Check a handful of profiles in <strong>Audience → Search Users</strong>. If <code>last_stay_date</code> is null on people who definitely stayed, the integration broke — a null date fails the "more than 180 days ago" filter, so they silently drop out. Nulls do not match date comparisons.</li>
  <li><strong>Did someone edit the segment?</strong> Segments are shared objects and any seat can edit them. Check the edit history.</li>
</ol>
<div class="bz-callout bz-callout--tip"><div class="bz-callout__t">Habit worth building</div><p>Screenshot or log your key segment sizes weekly. A segment that quietly halves is invisible until a campaign underperforms, and by then you are debugging under pressure.</p></div>`,
    },
  ],
},

/* ======================================================================== */
{
  id: 'c-liquid',
  icon: '💧',
  title: 'Personalization & Liquid — the language of the job',
  blurb: 'Braze personalization syntax, conditional logic, filters, catalogs, Content Blocks, Connected Content, and the fallbacks that stop embarrassing sends.',
  minutes: 45,
  body: `
<h2>Four namespaces, one syntax</h2>
<pre><code>{{\${first_name}}}                        standard attribute
{{custom_attribute.\${loyalty_tier}}}     custom attribute
{{event_properties.\${hotel_name}}}       property of the triggering event
{{canvas_entry_properties.\${promo}}}     property passed into Canvas entry
{{api_trigger_properties.\${offer_id}}}   property sent with an API-triggered campaign</code></pre>
<p>The <code>\${…}</code> wrapper is Braze's, not standard Liquid. Everything <em>outside</em> the wrapper is ordinary Liquid: filters, <code>if</code>, <code>for</code>, <code>assign</code>.</p>

<div class="bz-callout bz-callout--warn">
  <div class="bz-callout__t">Always set a fallback</div>
  <p><code>{{\${first_name}}}</code> on a profile with no first name renders nothing, and your greeting becomes "Hi ,". Write <code>{{\${first_name} | default: 'there'}}</code>. In a hotel group with partner-channel bookings, 20–40% of profiles routinely have no first name — this is not an edge case.</p>
</div>

<h2>Conditional logic</h2>
<pre><code>{% if custom_attribute.\${loyalty_tier} == 'Platinum' %}
  Late checkout until 16:00 is already on your reservation.
{% elsif custom_attribute.\${loyalty_tier} == 'Gold' %}
  Ask at the desk about 14:00 checkout.
{% else %}
  Upgrade to Gold with two more stays this year.
{% endif %}</code></pre>
<p>Operators: <code>==</code> <code>!=</code> <code>&gt;</code> <code>&lt;</code> <code>&gt;=</code> <code>&lt;=</code> <code>contains</code>, combined with <code>and</code> / <code>or</code>. There are no parentheses in Liquid — if you need grouping, nest the <code>if</code> blocks or pre-compute with <code>{% assign %}</code>.</p>

<div class="bz-callout">
  <div class="bz-callout__t">Liquid truthiness will catch you out</div>
  <p>Only <code>nil</code> and <code>false</code> are falsy. An <strong>empty string is true</strong>, and <strong>0 is true</strong>. So <code>{% if custom_attribute.\${points_balance} %}</code> fires for someone with zero points. Test the value explicitly: <code>{% if custom_attribute.\${points_balance} &gt; 0 %}</code>.</p>
</div>

<h2>Filters worth knowing by heart</h2>
<table>
  <tr><th>Filter</th><th>Example</th><th>Result</th></tr>
  <tr><td><code>default</code></td><td><code>{{\${first_name} | default: 'there'}}</code></td><td>there</td></tr>
  <tr><td><code>date</code></td><td><code>{{custom_attribute.\${next_stay_date} | date: '%A, %B %e'}}</code></td><td>Monday, August 18</td></tr>
  <tr><td><code>number_with_delimiter</code></td><td><code>{{custom_attribute.\${points_balance} | number_with_delimiter}}</code></td><td>18,400</td></tr>
  <tr><td><code>divided_by</code> / <code>round</code></td><td><code>{{custom_attribute.\${points_balance} | divided_by: 100 | round}}</code></td><td>184</td></tr>
  <tr><td><code>upcase</code> / <code>capitalize</code></td><td><code>{{\${city} | capitalize}}</code></td><td>Tel aviv</td></tr>
  <tr><td><code>truncate</code></td><td><code>{{\${last_name} | truncate: 8}}</code></td><td>Papadop…</td></tr>
</table>
<p>Note <code>capitalize</code> lowercases the rest of the string — it will turn "Tel Aviv" into "Tel aviv". For names and cities, trust your data instead of forcing case.</p>

<h2>Computing with <code>assign</code></h2>
<pre><code>{% assign nights = custom_attribute.\${nights_booked} %}
{% assign to_gold = 5 | minus: custom_attribute.\${total_stays} %}
You are {{to_gold}} stay{% if to_gold > 1 %}s{% endif %} from Gold.</code></pre>
<p>That pluralisation pattern is worth stealing. Nothing looks more automated than "1 stays".</p>

<h2>Catalogs</h2>
<p>A catalog is a table you upload (or sync via API) that Liquid can join against — properties, rewards, room types. It keeps prices and images out of the template.</p>
<pre><code>{% catalog_items hotels {{custom_attribute.\${abandoned_hotel_id}}} %}
{% if items.size == 0 %}
  {% abort_message('No catalog row — skip this user') %}
{% endif %}
&lt;h1&gt;Still thinking about {{items[0].city}}?&lt;/h1&gt;
&lt;img src="{{items[0].image_url}}"&gt;
&lt;p&gt;From €{{items[0].price_from}} per night&lt;/p&gt;</code></pre>
<div class="bz-callout bz-callout--warn">
  <div class="bz-callout__t">Guard every catalog lookup</div>
  <p>If the id is null or the row was deleted, <code>items</code> is empty and <code>items[0].name</code> renders as nothing — you send an email with a blank hero and a broken image. <code>{% abort_message() %}</code> cancels the send <em>for that user only</em>, which is almost always what you want. The aborted count shows up in campaign analytics, so you can see it happening.</p>
</div>

<h2>Content Blocks</h2>
<p>Reusable HTML fragments: <code>{{content_blocks.\${aurelia_footer}}}</code>. Header, footer, legal, tier badge. Edit once, every template updates. If your footer address is hard-coded into forty templates, changing offices becomes a two-day job.</p>

<h2>Connected Content</h2>
<p>Fetches a URL at send time and makes the response available to Liquid — live prices, weather, inventory.</p>
<pre><code>{% connected_content https://api.aureliahotels.com/rates?hotel={{custom_attribute.\${next_stay_hotel_id}}}
   :basic_auth rates_key
   :cache 300
   :save rates %}
Rooms from €{{rates.lowest}} tonight.</code></pre>
<ul>
  <li><strong>Always <code>:cache</code></strong> on a large send — without it your endpoint takes one request per recipient, and a 200k send will take your API down.</li>
  <li><strong>Always handle failure.</strong> If the endpoint is slow or errors, Braze proceeds with the value unset. Wrap in <code>{% if rates.lowest %}</code> or abort.</li>
  <li>Never put a secret in the URL — use <code>:basic_auth</code> with a stored credential.</li>
</ul>

<div class="bz-callout bz-callout--tip">
  <div class="bz-callout__t">Do this in the sandbox</div>
  <p>Open <strong>Messaging → Templates → Abandoned booking — catalog</strong>. Switch the preview user between <em>Maya Levi</em> (Platinum) and <em>Jonas Weber</em> (Blue, mid-abandonment) and watch the member-discount block appear and disappear. Then delete the <code>| default:</code> from the headline and see what Jonas gets.</p>
</div>
`,
  tasks: [
    {
      q: 'Write the greeting line for a pre-arrival email that says <em>"Maya, your 3 nights at Herodion Jerusalem start on Monday, August 18"</em> — correct for 1 night too, and safe when the first name is missing.',
      a: `<pre><code>{% assign nights = custom_attribute.\${nights_booked} %}
{{\${first_name} | default: 'Hello'}}, your {{nights}} night{% if nights != 1 %}s{% endif %}
at {{custom_attribute.\${next_stay_hotel} | default: 'your hotel'}}
start{% if nights == 1 %}s{% endif %} on
{{custom_attribute.\${next_stay_date} | date: '%A, %B %e'}}.</code></pre>
<p>Three things being handled: name fallback, plural on the noun, and plural on the verb (which flips the other way — "1 night starts", "3 nights start"). Paste it into the sandbox editor and switch preview users to confirm.</p>
<p>One caveat worth knowing: <code>| default:</code> only fires on nil or empty. A profile with <code>first_name = " "</code> (a space) passes through. If your source data is dirty, chain <code>| strip | default: 'Hello'</code>.</p>`,
    },
    {
      q: 'A win-back email should offer 20% off to Blue/Silver, but only a points bonus to Gold/Platinum (never discount a high-value guest). Write it.',
      a: `<pre><code>{% assign tier = custom_attribute.\${loyalty_tier} | default: 'Blue' %}
{% if tier == 'Gold' or tier == 'Platinum' %}
  &lt;p&gt;Double points on your next stay — you already have
     {{custom_attribute.\${points_balance} | number_with_delimiter}}.&lt;/p&gt;
  &lt;a href="https://aureliahotels.com/offers?promo=DOUBLE"&gt;Book with double points&lt;/a&gt;
{% else %}
  &lt;p&gt;Here is 20% off your next stay.&lt;/p&gt;
  &lt;div&gt;WELCOMEBACK20&lt;/div&gt;
{% endif %}</code></pre>
<p>The <code>| default: 'Blue'</code> on line 1 matters: a profile with no tier set would otherwise fall to the <code>else</code> branch anyway, but being explicit means the logic still reads correctly when someone adds a third branch later.</p>
<div class="bz-callout"><div class="bz-callout__t">Better still</div><p>Do not hard-code the promo code. Put it in a catalog or pass it as <code>canvas_entry_properties</code>, so finance can change the offer without a marketer editing HTML.</p></div>`,
    },
    {
      q: 'Your abandoned-booking email uses a catalog lookup on <code>abandoned_hotel_id</code>. QA reports some recipients got an email with a blank hotel name and a broken image. Diagnose and fix.',
      a: `<p>The catalog row did not resolve — either <code>abandoned_hotel_id</code> was null on those profiles, or it pointed at a property that has since been removed from the catalog (a hotel left the group, the nightly sync deleted the row). <code>items</code> came back empty, and <code>{{items[0].name}}</code> rendered as an empty string rather than erroring.</p>
<p><strong>Fix — guard immediately after the lookup:</strong></p>
<pre><code>{% catalog_items hotels {{custom_attribute.\${abandoned_hotel_id}}} %}
{% if items.size == 0 %}
  {% abort_message('No catalog row for abandoned_hotel_id') %}
{% endif %}</code></pre>
<p><strong>Fix the audience too</strong>, so you are not relying on the abort: add <code>abandoned_hotel_id has a value</code> to the segment. Belt and braces — the segment stops most of them, the abort catches the race condition where the row is deleted between segmentation and send.</p>
<p><strong>And monitor it:</strong> aborted sends are reported in campaign analytics. If aborts climb above a percent or two, your catalog sync is broken and you want to know before the commercial team asks why sends dropped.</p>`,
    },
    {
      q: 'What does <code>{{custom_attribute.\${points_balance} | divided_by: 100}}</code> return for a balance of 18,400? And for 18,450?',
      a: `<p>184 in both cases. Liquid's <code>divided_by</code> does <strong>integer division when both operands are integers</strong> — it truncates, it does not round. 18450 / 100 = 184, not 184.5 and not 185.</p>
<p>If you want a decimal, make one side a float: <code>| divided_by: 100.0</code> gives 184.5. If you want rounding, <code>| divided_by: 100.0 | round</code> gives 185.</p>
<p>This bites hardest in currency conversion ("points to euros") where quietly losing the remainder understates the value you are advertising. Try all three in the sandbox editor.</p>`,
    },
  ],
},

/* ======================================================================== */
{
  id: 'c-campaigns',
  icon: '📣',
  title: 'Campaigns — build, target, schedule, convert',
  blurb: 'The five-step wizard, the three delivery types, conversion event windows, A/B testing and control groups.',
  minutes: 35,
  body: `
<h2>The wizard, step by step</h2>
<ol>
  <li><strong>Compose</strong> — channel and creative. Multichannel campaigns send the same "message" across several channels at once (not a fallback chain — for fallback logic you need a Canvas).</li>
  <li><strong>Target Audience</strong> — a saved segment, optionally narrowed with extra filters.</li>
  <li><strong>Delivery</strong> — scheduled, action-based, or API-triggered.</li>
  <li><strong>Conversion Events</strong> — what counts as success, and within how long.</li>
  <li><strong>Review &amp; Deploy</strong> — the last chance to catch a mistake that goes to 200,000 people.</li>
</ol>

<h2>The three delivery types</h2>
<table>
  <tr><th>Type</th><th>Entry</th><th>Use for</th></tr>
  <tr><td><strong>Scheduled</strong></td><td>At a time you pick; one-off or recurring</td><td>Newsletters, flash sales, monthly loyalty statements</td></tr>
  <tr><td><strong>Action-based</strong></td><td>When the user performs an event / has an attribute change / enters a segment</td><td>Abandonment, welcome, post-stay review</td></tr>
  <tr><td><strong>API-triggered</strong></td><td>Your backend calls <code>/campaigns/trigger/send</code></td><td>Transactional-adjacent sends where your system owns the timing and the payload</td></tr>
</table>

<div class="bz-callout">
  <div class="bz-callout__t">Action-based delivery has an exception window</div>
  <p>On an action-based campaign you can set a delay and an <strong>exception event</strong>: "send 4 hours after <code>booking_started</code>, unless <code>booking_completed</code> happens first." This is a far better abandonment mechanism than a segment with a "did not perform" filter, because it is evaluated per user against their own clock rather than a fixed lookback window.</p>
</div>

<h2>Conversion events and the attribution window</h2>
<p>A conversion event is your success metric: the user did the thing within N hours/days of <em>receiving</em> the message. You can set up to four; the first is primary and is what the optimisation features use.</p>
<div class="bz-callout bz-callout--warn">
  <div class="bz-callout__t">Choosing the window is a judgement call, and it is yours to defend</div>
  <p>Too short and you under-credit: a 24-hour window on a hotel booking misses the couple who discuss it over the weekend. Too long and you over-credit: a 30-day window on an abandonment email claims every booking the person would have made anyway.</p>
  <p>Sensible starting points for hospitality: abandonment <strong>72 hours</strong>, win-back <strong>14 days</strong>, pre-arrival check-in <strong>7 days</strong>, review request <strong>5 days</strong>. Then look at your own lag-to-conversion distribution and adjust. Whatever you pick, keep it stable — changing the window mid-flight makes every before/after comparison meaningless.</p>
</div>

<h2>A/B testing</h2>
<p>Split traffic across variants and, optionally, hold out a <strong>control group</strong> that receives nothing. The control is what turns "this campaign converted at 3%" into "this campaign <em>caused</em> 1.2% more conversion than doing nothing" — which is the only number a CFO cares about.</p>
<ul>
  <li>Test <strong>one variable at a time</strong>. Different subject <em>and</em> different hero image tells you nothing about either.</li>
  <li>Braze reports statistical significance. Do not call a winner before it does, and do not call one on opens when your conversion metric is bookings.</li>
  <li>Subject-line tests need far less volume than conversion tests. If you have 12,000 recipients you can resolve an open-rate difference; you probably cannot resolve a 0.3pp booking-rate difference.</li>
</ul>

<div class="bz-callout bz-callout--tip">
  <div class="bz-callout__t">Do this in the sandbox</div>
  <p>Open <strong>Messaging → Campaigns → Summer Escapes</strong> and go to the Analytics tab. Variant B wins on opens and clicks. Look at conversions against the holdout before you declare it a success, then read the task below.</p>
</div>

<h2>Global control group</h2>
<p>Separate from per-campaign A/B holdouts, Braze can reserve a fixed percentage of your whole user base that receives no marketing at all. It is the cleanest read on total programme incrementality. Set it once, at a small percentage (2–5%), and leave it alone — and make sure everyone knows it exists before someone asks why 3% of guests never get emails.</p>
`,
  tasks: [
    {
      q: 'Summer Escapes: Variant A converted 119/5,400 (2.20%), Variant B 168/5,400 (3.11%), holdout 14/1,200 (1.17%). What do you report?',
      a: `<p><strong>Report incremental conversions, not the raw rate.</strong></p>
<ul>
  <li>Baseline (people would have booked anyway): <strong>1.17%</strong>.</li>
  <li>Variant A incremental lift: 2.20 − 1.17 = <strong>+1.03pp</strong> → about 56 incremental bookings.</li>
  <li>Variant B incremental lift: 3.11 − 1.17 = <strong>+1.94pp</strong> → about 105 incremental bookings.</li>
  <li>B is roughly <strong>1.9× as effective</strong> as A — a much more honest claim than "B converted 41% better".</li>
</ul>
<p>Caveats to state alongside the number, because someone will ask:</p>
<ol>
  <li>The holdout is only 1,200 people and 14 conversions. That is a wide confidence interval on the baseline; treat the lift as directional, not precise.</li>
  <li>A discount-led variant can pull forward bookings that would have happened next month. Check whether B's cohort books less in the following 30 days before rolling it out permanently.</li>
  <li>B also drove more unsubscribes in this data. Look at the full picture, not just conversions.</li>
</ol>`,
    },
    {
      q: 'You are asked to send a "your room is ready" message. Campaign or Canvas? Which delivery type? Which subscription group?',
      a: `<p><strong>Campaign, API-triggered, Trip Information group.</strong></p>
<ul>
  <li><strong>Campaign</strong>, not a Canvas: it is a single message with no waits or branching.</li>
  <li><strong>API-triggered</strong>: the PMS knows the exact moment housekeeping releases the room. Braze cannot infer that from an attribute, and polling for an attribute change would add minutes of latency to a message whose whole value is immediacy. Your backend calls <code>/campaigns/trigger/send</code> with <code>trigger_properties</code> carrying the room number.</li>
  <li><strong>Trip Information</strong> — this is service messaging tied to a stay the guest has paid for, not marketing. Putting it in Promotions means guests who opted out of offers miss their room notification.</li>
</ul>
<div class="bz-callout bz-callout--warn"><div class="bz-callout__t">Get the legal line right</div><p>"Your room is ready" is transactional. "Your room is ready — and the spa has 6pm free" is marketing, and now needs marketing consent. The moment you bolt an offer onto a service message you change its legal character. Flag this rather than deciding alone.</p></div>`,
    },
    {
      q: 'Your abandonment campaign is action-based on <code>booking_started</code> with a 4-hour delay. Bookings on the site take about 6 minutes. A guest starts three separate searches in one evening. What happens, and what do you do about it?',
      a: `<p>They enter three times and, unless you stop it, receive three emails four hours apart. This is the single most common cause of "why did I get spammed" complaints from a Braze abandonment setup.</p>
<p><strong>Fixes, in order of preference:</strong></p>
<ol>
  <li><strong>Re-eligibility / frequency settings on the campaign</strong> — set a minimum re-entry gap (say, 7 days). One email per abandonment episode, not per event.</li>
  <li><strong>Global frequency capping</strong> — "no more than 2 promotional emails per user per week" applied workspace-wide. Set this up once and it protects you from every campaign, including ones built by colleagues.</li>
  <li><strong>Exception event</strong> — <code>booking_completed</code> cancels the pending send, so a guest who finishes on the third try never gets any of the three.</li>
</ol>
<p>Mark service messages as exempt from frequency capping, or a busy promotional week will suppress someone's check-in instructions.</p>`,
    },
  ],
},

/* ======================================================================== */
{
  id: 'c-canvas',
  icon: '🗺️',
  title: 'Canvas Flow — designing customer journeys',
  blurb: 'Entry criteria, every step type, re-eligibility, quiet hours, and how to reason about users flowing through branches.',
  minutes: 45,
  body: `
<h2>Entry: the decision that shapes everything downstream</h2>
<ul>
  <li><strong>Action-based entry</strong> — a custom event, a purchase, an attribute change, or entering a segment. Users trickle in continuously.</li>
  <li><strong>Scheduled entry</strong> — everyone in the target segment enters at once, one-off or recurring.</li>
  <li><strong>API-triggered entry</strong> — your backend calls <code>/canvas/trigger/send</code>, optionally with <code>canvas_entry_properties</code> readable throughout the whole journey.</li>
</ul>

<div class="bz-callout">
  <div class="bz-callout__t">Entry audience vs entry trigger</div>
  <p>These are two separate gates and both must pass. The <em>trigger</em> is what happens; the <em>entry audience</em> is a segment filter applied at that moment. "Performs <code>booking_completed</code>" AND "is in segment: has marketing consent". A user who triggers but fails the audience filter simply does not enter — and they do not get another chance until they trigger again.</p>
</div>

<h2>Re-eligibility</h2>
<p>Can a user go through this journey more than once? Defaults matter here:</p>
<ul>
  <li><strong>Onboarding</strong> — re-eligibility <em>off</em>. You are welcomed once.</li>
  <li><strong>Pre-arrival</strong> — re-eligibility <em>on</em>, with a short cooldown (1 day). Every booking should get its own pre-arrival sequence, and a frequent business traveller might book twice in a week.</li>
  <li><strong>Win-back</strong> — re-eligibility <em>on</em>, long cooldown (90 days). Otherwise a lapsed guest who ignores you gets a win-back offer every Tuesday forever.</li>
</ul>
<p>Getting this wrong is one of the few Braze mistakes that is genuinely hard to unwind, because the sends have already gone.</p>

<h2>The step types</h2>
<table>
  <tr><th>Step</th><th>What it does</th><th>Watch out for</th></tr>
  <tr><td><strong>Message</strong></td><td>Sends on one or more channels. Can carry its own delay and its own audience filter.</td><td>A step-level audience filter that nobody passes silently drops users out of the journey.</td></tr>
  <tr><td><strong>Delay</strong></td><td>Wait a duration, until a specific date/attribute, or until a time of day.</td><td>"Until 7 days before <code>next_stay_date</code>" does nothing for a user whose stay is in 3 days — they are past the gate and exit. Handle short-lead bookings on a separate path.</td></tr>
  <tr><td><strong>Action Paths</strong></td><td>Branch on what the user <em>does</em> within an evaluation window (default 1 day, max 31). Users are held at the step until they act or the window closes.</td><td>The window is a real wait. A 7-day Action Path means nobody moves for up to 7 days.</td></tr>
  <tr><td><strong>Audience Paths</strong></td><td>Branch on who the user <em>is</em>, evaluated the instant they arrive. No waiting.</td><td>Evaluated top-down, first match wins. Order your paths from most specific to least, and always include a catch-all.</td></tr>
  <tr><td><strong>Experiment Paths</strong></td><td>Randomly assign users to variant paths by percentage, with an optional control.</td><td>Assignment is sticky per user per Canvas. Changing the percentages mid-flight does not re-randomise existing users.</td></tr>
  <tr><td><strong>Webhook</strong></td><td>POSTs to any endpoint. Notify a CRM, add to a list, trigger a voucher.</td><td>Failures are mostly silent. Log on the receiving end; do not assume it fired.</td></tr>
  <tr><td><strong>Update User Profile</strong></td><td>Writes a custom attribute from inside the journey.</td><td>Extremely useful for state (<code>winback_stage = exhausted</code>) — and for creating loops if the attribute is also an entry trigger. Be careful.</td></tr>
</table>

<div class="bz-callout bz-callout--warn">
  <div class="bz-callout__t">Action Paths vs Audience Paths — the distinction interviewers ask about</div>
  <p><strong>Action Paths wait. Audience Paths do not.</strong> "Did they open the last email?" is an Action Path with a window. "Are they a Gold member?" is an Audience Path, answered instantly. Using an Action Path where an Audience Path belongs inserts an invisible multi-day delay into your journey and people cannot work out why the next message is late.</p>
</div>

<h2>Quiet hours and local time</h2>
<p>Send in the user's local time zone, and set quiet hours (e.g. 21:00–08:00). A message that lands at 03:00 gets deleted and reported as spam. Decide what happens to messages that fall into quiet hours: hold until the window opens, or skip. For a "your room is ready" alert you skip; for a promotion you hold.</p>

<h2>Reading the numbers on a Canvas</h2>
<p>Each step shows entered / sent / opened / clicked / converted. The number to watch is the <strong>drop between steps</strong>. If 42,000 enter and 14,000 reach step 3, either an Action Path window is expiring or a step-level audience filter is excluding people. Both are invisible unless you look.</p>

<div class="bz-callout bz-callout--tip">
  <div class="bz-callout__t">Do this in the sandbox</div>
  <p>Open <strong>Messaging → Canvases → Pre-arrival &amp; on-property journey</strong>. Click each step and read the config panel. Then build your own from scratch with the <strong>+</strong> buttons — add an Audience Path splitting Gold/Platinum from everyone else, and put a different message on each branch.</p>
</div>
`,
  tasks: [
    {
      q: 'Design the entry for a pre-arrival Canvas. Trigger, audience, re-eligibility, conversion event. Justify each.',
      a: `<table>
<tr><th>Setting</th><th>Choice</th><th>Why</th></tr>
<tr><td>Trigger</td><td>Custom event <code>booking_completed</code></td><td>The moment a stay exists. Do not trigger on <code>next_stay_date</code> being set — attribute-change triggers fire on every backend correction to the field.</td></tr>
<tr><td>Entry audience</td><td>Subscribed to Trip Information</td><td>Pre-arrival is service messaging, but consent still has to be checked. No promotional-consent filter here, or guests who opted out of offers lose their check-in instructions.</td></tr>
<tr><td>Re-eligibility</td><td>On, 1-day cooldown</td><td>Each booking needs its own sequence. The 1-day floor stops a double-submitted booking from producing two journeys.</td></tr>
<tr><td>Conversion</td><td>Primary <code>checked_in</code>, 30-day window; secondary <code>spa_booked</code></td><td>Online check-in is the behaviour the journey exists to drive. The window must cover the full booking lead time — a 7-day window would miss anyone booking further out than a week.</td></tr>
<tr><td>Send in local time</td><td>Yes, quiet hours 21:00–08:00</td><td>Guests are cross-timezone by definition; that is what makes them guests.</td></tr>
</table>
<p>One more, easy to forget: the first Delay must be <em>"until 7 days before <code>next_stay_date</code>"</em>, not "wait 7 days". A booking made three months out and one made tomorrow have to converge on the same pre-arrival moment.</p>`,
    },
    {
      q: 'Same Canvas: a guest books at 22:00 for a stay starting <em>tomorrow</em>. Walk through what happens and fix any breakage.',
      a: `<p><strong>What happens as designed:</strong></p>
<ol>
  <li>Enters on <code>booking_completed</code>. The confirmation email is transactional — it should be exempt from quiet hours and send immediately. If you left quiet hours on for this step, the guest gets no confirmation until 08:00, which will generate a support call.</li>
  <li>Hits "wait until 7 days before arrival". That moment is six days in the <em>past</em>. The delay gate cannot be satisfied.</li>
  <li>Depending on configuration the user either exits the Canvas or falls straight through to the next step — and in the worst case receives the 7-day-out and 1-day-out messages back to back at 22:05.</li>
</ol>
<p><strong>Fix: branch on lead time at the top of the journey.</strong> An Audience Path immediately after the confirmation message:</p>
<ul>
  <li><em>Arriving in 2 days or fewer</em> → skip straight to the check-in reminder, send at 09:00 local next morning.</li>
  <li><em>Everybody else</em> → the normal 7-day / 1-day sequence.</li>
</ul>
<p>Then set the confirmation step to ignore quiet hours, and leave quiet hours on for every promotional step. Short-lead bookings are 15–25% of hotel volume, so this is not an edge case — it is a quarter of your audience.</p>`,
    },
    {
      q: 'A colleague built a Canvas where step 4 is an Action Path "opened the previous email?" with a 7-day window, followed by the main offer message. Conversions are poor and the commercial team says the offer arrives too late. What is wrong?',
      a: `<p>The Action Path is holding every non-opener for the full 7 days before they move. Openers branch immediately; everyone else waits a week to receive the offer — by which time the promotion may have expired.</p>
<p><strong>Options, in order:</strong></p>
<ol>
  <li><strong>Shorten the window</strong> to 24–48 hours. Most email opens happen within 24 hours; a 7-day window buys almost no extra signal for a large delay cost.</li>
  <li><strong>Question the branch.</strong> "Opened" is a weak and increasingly unreliable signal — Apple Mail Privacy Protection inflates opens massively. Branching on <em>clicked</em> is more honest, and branching on nothing at all is often better than both.</li>
  <li><strong>Restructure:</strong> send the offer to everyone immediately, then use an Action Path <em>after</em> it to decide who gets a follow-up nudge. The wait is spent on the optional message, not the important one.</li>
</ol>
<div class="bz-callout"><div class="bz-callout__t">Rule of thumb</div><p>Never put a long Action Path window <em>before</em> your primary message. Branch after the value has been delivered, not before.</p></div>`,
    },
  ],
},

/* ======================================================================== */
{
  id: 'c-qa',
  icon: '🧪',
  title: 'QA, testing and the pre-launch checklist',
  blurb: 'Preview & Test, test users, seed lists, rendering, and the checklist that keeps you out of the incident review.',
  minutes: 25,
  body: `
<h2>Preview &amp; Test</h2>
<p>Every message composer has it. Three modes worth using in sequence:</p>
<ol>
  <li><strong>Preview as a random user</strong> — catches broken Liquid fast.</li>
  <li><strong>Preview as a specific user</strong> — search by <code>external_id</code> or email. This is how you check edge profiles: no first name, null tier, missing catalog id.</li>
  <li><strong>Send a test</strong> to yourself or a test group — the only way to see real rendering in real clients.</li>
</ol>

<div class="bz-callout bz-callout--warn">
  <div class="bz-callout__t">Preview is not proof</div>
  <p>Preview renders Liquid against one profile. It does not test your <em>audience</em>, your delivery timing, your frequency caps or your conversion tracking. Plenty of campaigns preview perfectly and then send to the wrong 200,000 people.</p>
</div>

<h2>Test the profiles that break things, not the happy path</h2>
<p>Keep a standing list of adversarial test users and run every template against all of them:</p>
<ul>
  <li>No first name, no last name</li>
  <li>Null on every custom attribute the template reads</li>
  <li>An apostrophe in the name (O'Brien) and a non-Latin name — check both rendering and any URL you build from it</li>
  <li>A catalog id that no longer exists</li>
  <li>Unsubscribed from one subscription group but not another</li>
  <li>A user in a different time zone from you</li>
</ul>
<p>In this sandbox, <strong>Jonas Weber (AUR-100001)</strong> is deliberately hostile: Blue tier, zero stays, null <code>preferred_city</code>, null <code>points_balance</code> logic paths, and a live abandoned booking. If your template survives Jonas, it will survive production.</p>

<h2>The pre-launch checklist</h2>
<p>Run this every time. Out loud, if it is a big send.</p>
<ol>
  <li><strong>Audience</strong> — right segment? Read the filters aloud with "and" between them. Does the count match what you expected within ~10%?</li>
  <li><strong>Exclusions</strong> — suppression segment applied? Recent-recipients excluded? Global control group respected?</li>
  <li><strong>Reachability</strong> — how many are actually reachable on this channel? That is the number you report, not the segment size.</li>
  <li><strong>Liquid</strong> — every personalization tag has a fallback. Preview as at least three edge-case users.</li>
  <li><strong>Links</strong> — click every link in the test send. Check UTM parameters. Check the link works on mobile.</li>
  <li><strong>Unsubscribe</strong> — present, and pointing at the right preference centre.</li>
  <li><strong>Subject and preheader</strong> — no unresolved <code>{{</code>, no "Hi ," , preheader not duplicating the subject.</li>
  <li><strong>Timing</strong> — correct time zone? Local-time send? Quiet hours? Not a public holiday in your biggest market?</li>
  <li><strong>Conversion event</strong> — set, with a defensible window.</li>
  <li><strong>Frequency caps</strong> — will this collide with another campaign going out the same day? Check the calendar.</li>
  <li><strong>Seed list</strong> — internal addresses included so the team sees exactly what guests see.</li>
</ol>

<div class="bz-callout bz-callout--tip">
  <div class="bz-callout__t">Cheap habit, high value</div>
  <p>Before any send above ~50k, export a 20-row sample of the target audience and eyeball it. Five minutes. It catches the "this segment is somehow all German business travellers" class of error that no amount of Liquid preview will.</p>
</div>

<h2>When it goes wrong</h2>
<p>You will send something wrong eventually — everyone does. What matters is the next twenty minutes:</p>
<ol>
  <li><strong>Stop the campaign</strong> first. Stopping halts further sends immediately; it does not recall what has gone.</li>
  <li><strong>Establish the blast radius</strong> — how many actually received it, on which channel.</li>
  <li><strong>Tell your manager before they find out elsewhere.</strong> Non-negotiable.</li>
  <li><strong>Decide on an apology send</strong> deliberately. A correction email doubles the volume and often makes it worse. A wrong first name usually needs no follow-up; a wrong price does.</li>
  <li><strong>Write down the cause and the guardrail</strong> that would have caught it. Add the guardrail to the checklist.</li>
</ol>
`,
  tasks: [
    {
      q: 'You are about to send a 180,000-recipient summer promotion. Walk your manager through your pre-send checks in under a minute.',
      a: `<p>Something close to this, in this order:</p>
<blockquote style="border-left:3px solid #E3E3EB;padding-left:14px;color:#43434E;">
"Audience is <em>Israeli families — spa &amp; resort</em>, 180,412 profiles, 171,006 email-reachable after unsubscribes and bounces — that is the number in the forecast. Suppression segment is applied and anyone who got the Eilat push on Tuesday is excluded, so no one gets two in three days.
Liquid is previewed against four profiles including one with no first name and one with a null tier; all fallbacks render. Test send checked on iOS Mail, Gmail web and Gmail Android.
Links are UTM-tagged <code>utm_campaign=summer_escapes_2026</code> and all four resolve. Unsubscribe points at the new preference centre.
Sending 09:00 local time, quiet hours on. Conversion event is <code>booking_completed</code> with a 5-day window, matching what we used in Q1 so the comparison holds.
Holdout is 10%. Seed list includes the commercial team."
</blockquote>
<p>The structure that makes this land: <strong>audience → reachable number → creative QA → links → timing → measurement → holdout</strong>. Leading with reachable-not-segment size signals you know the difference.</p>`,
    },
    {
      q: 'A test send renders "Dear ," for about a third of your test profiles, but the same template previewed fine yesterday. What changed?',
      a: `<p>The template did not change — the <em>profiles</em> did. Most likely one of:</p>
<ul>
  <li>A new import landed without <code>first_name</code> (OTA and partner-channel bookings frequently arrive with no first name, or with the full name in one field).</li>
  <li>An integration started sending <code>first_name: ""</code> instead of omitting the key. Empty string is not nil, so a bare <code>| default:</code> still fires — but if the field is <code>" "</code> it does not.</li>
</ul>
<p><strong>Immediate fix:</strong> <code>{{\${first_name} | strip | default: 'there'}}</code>, and drop "Dear" for a construction that reads fine without a name at all.</p>
<p><strong>Real fix:</strong> tell the data team, because a third of profiles with no first name affects every template you own, not just this one. Then add "preview as a no-name profile" to your standing checklist so this is caught before a test send next time.</p>`,
    },
  ],
},

/* ======================================================================== */
{
  id: 'c-deliverability',
  icon: '📬',
  title: 'Deliverability, consent and subscription management',
  blurb: 'Subscription groups vs global state, opt-in models, bounces, frequency capping and sender reputation.',
  minutes: 30,
  body: `
<h2>Three layers of "can I email this person?"</h2>
<ol>
  <li><strong>Global email subscription state</strong> — <code>opted_in</code>, <code>subscribed</code>, or <code>unsubscribed</code>. <code>unsubscribed</code> blocks everything, always.</li>
  <li><strong>Subscription groups</strong> — per-topic consent: Promotions, Loyalty News, Trip Information, SMS Stay Updates. A guest can leave Promotions and still get pre-arrival instructions.</li>
  <li><strong>Campaign targeting</strong> — you still have to filter on the right group. Braze will not stop you sending a promotion to someone who left the Promotions group unless you build that filter or attach the campaign to that group.</li>
</ol>

<div class="bz-callout bz-callout--warn">
  <div class="bz-callout__t">The distinction that matters legally</div>
  <p><code>subscribed</code> means "has not opted out". <code>opted_in</code> means "actively said yes". Under GDPR — and Israeli spam law, which is stricter than most people assume — marketing to EU residents generally requires <code>opted_in</code>. Targeting "is not unsubscribed" is fine for service messaging and is a compliance problem for promotions in some markets. Know which of your markets require which, and if you are unsure, ask legal rather than guessing.</p>
</div>

<h2>Subscription groups in practice</h2>
<p>Structure them by what the guest cares about, not by your org chart:</p>
<ul>
  <li><strong>Promotions &amp; Offers</strong> — rate drops, flash sales. Highest churn; expect the most unsubscribes here, and that is healthy.</li>
  <li><strong>Loyalty News</strong> — tier changes, points expiry. Much lower churn; people want this.</li>
  <li><strong>Trip Information</strong> — pre-arrival, on-property, checkout. Nearly nobody opts out.</li>
</ul>
<p>The reason to separate them: a guest annoyed by weekly offers can leave <em>that</em> group instead of hitting the global unsubscribe. A single all-or-nothing list converts irritation into permanent loss. Give people the smaller exit.</p>

<h2>Bounces and list hygiene</h2>
<ul>
  <li><strong>Hard bounce</strong> — address does not exist. Braze suppresses automatically. Never re-add these.</li>
  <li><strong>Soft bounce</strong> — mailbox full, server down. Retried, then suppressed after repeated failure.</li>
  <li><strong>Spam complaint</strong> — treat as an unsubscribe, immediately and permanently. Complaint rate above 0.1% will get you throttled by mailbox providers; above 0.3% and you have a real problem.</li>
</ul>
<p>Suppress people who have not opened anything in 12 months. It feels like giving up on revenue; it is the single most effective thing you can do for inbox placement, because engagement is what Gmail and Outlook actually rank on. A smaller list that lands in the inbox beats a big one that lands in spam.</p>

<h2>Frequency capping</h2>
<p>Workspace-level rules: "no more than 2 promotional emails per user per 7 days", "no more than 1 push per day". Set them once and every campaign inherits them.</p>
<ul>
  <li>Mark transactional and service campaigns as <strong>exempt</strong>, or a busy promo week will suppress check-in instructions.</li>
  <li>Capping silently drops recipients. If a send goes out much smaller than expected, capping is the first thing to check.</li>
</ul>

<h2>Sender reputation basics you are expected to know</h2>
<ul>
  <li><strong>SPF, DKIM, DMARC</strong> must be configured on your sending domain. If you cannot say whether DMARC is at <code>p=none</code> or <code>p=reject</code>, find out.</li>
  <li>Use a <strong>subdomain</strong> for marketing (<code>offers.aureliahotels.com</code>) separate from transactional (<code>stay.aureliahotels.com</code>). A bad promotional week then cannot take down booking confirmations.</li>
  <li><strong>Warm up</strong> new sending domains gradually — a few thousand of your most-engaged users, growing over 2–4 weeks. Blasting 200k from a cold domain lands the lot in spam.</li>
</ul>
`,
  tasks: [
    {
      q: 'A guest emails: "I keep getting your offers, I unsubscribed months ago." How do you investigate?',
      a: `<p>Open <strong>Audience → Search Users</strong>, find them by email, and check in this order:</p>
<ol>
  <li><strong>Global email subscription state.</strong> If it is <code>unsubscribed</code> and they still received a promotion, that is a serious bug — escalate immediately.</li>
  <li><strong>Subscription group membership.</strong> Far more likely: they left <em>Promotions</em> but the campaign targeted "is not globally unsubscribed" and never checked the group. That is a targeting error on your side, not the guest's.</li>
  <li><strong>Duplicate profile.</strong> Do they exist twice under different <code>external_id</code>s — one from web signup, one from the PMS? They unsubscribed on one and you are emailing the other. Very common in hotel groups where booking and loyalty systems are separate.</li>
  <li><strong>Message history</strong> on the profile — what actually reached them, from which campaign. That tells you which of the above it is.</li>
</ol>
<p><strong>Then:</strong> honour the request globally right away, and fix the class of problem — audit every promotional campaign for the subscription-group filter. If it was a duplicate profile, that is an identity-resolution issue for the data team, and it is affecting more people than this one complainant.</p>`,
    },
    {
      q: 'Open rates dropped from 44% to 26% over three weeks. Nothing about your templates changed. Where do you look?',
      a: `<p>Work outward from the cheapest checks:</p>
<ol>
  <li><strong>Delivery rate first.</strong> If <em>delivered</em> also fell, this is a deliverability problem, not a creative one. Rising soft bounces mean you are being throttled or filtered.</li>
  <li><strong>Audience composition.</strong> Did you start mailing a colder segment? A win-back to 180-day lapsed guests will drag the blended average down without anything being wrong. Compare like-for-like campaigns, not the aggregate.</li>
  <li><strong>Volume change.</strong> A sudden jump from 40k to 200k a week looks like a spam pattern to mailbox providers, especially from a young domain.</li>
  <li><strong>Complaint rate.</strong> If it crossed 0.1%, providers are already routing you to spam. Check which campaign caused it.</li>
  <li><strong>Authentication.</strong> Did DNS change? Did DKIM break during a domain migration? A silent DKIM failure looks exactly like this.</li>
  <li><strong>Apple MPP.</strong> Open rates have been unreliable since 2021 — a shift in device mix moves the number with no real change in behaviour. Confirm against clicks and conversions before you conclude anything.</li>
</ol>
<p>If clicks and conversions held steady while opens fell, suspect measurement, not performance. If all three fell together, it is deliverability.</p>`,
    },
  ],
},

/* ======================================================================== */
{
  id: 'c-analytics',
  icon: '📊',
  title: 'Analytics — proving the programme works',
  blurb: 'Which metrics mean anything, incrementality, funnel and retention reporting, and reporting to people who do not care about open rates.',
  minutes: 30,
  body: `
<h2>The metric hierarchy</h2>
<table>
  <tr><th>Level</th><th>Metric</th><th>Who cares</th></tr>
  <tr><td>Delivery</td><td>Sent, delivered, bounce rate</td><td>You. It is a health check, not a result.</td></tr>
  <tr><td>Engagement</td><td>Open, click, CTOR, unsubscribe</td><td>You, for optimisation. Do not report opens upward.</td></tr>
  <tr><td>Conversion</td><td>Conversion rate on your defined event</td><td>Your manager.</td></tr>
  <tr><td>Business</td><td><strong>Incremental</strong> bookings and revenue vs holdout</td><td>Everyone above your manager. This is the only number that survives a budget review.</td></tr>
</table>

<div class="bz-callout bz-callout--warn">
  <div class="bz-callout__t">Click-to-open, not click rate</div>
  <p>Click rate mixes two effects: how many opened and how many of those acted. CTOR (clicks ÷ opens) isolates whether the <em>content</em> worked once someone was looking. When you change a subject line, watch opens. When you change the body or the CTA, watch CTOR. Reporting only the blended click rate hides which half moved.</p>
</div>

<h2>Incrementality is the whole job</h2>
<p>"The abandonment campaign drove €168,400" is almost certainly false. Some of those people would have completed the booking regardless — they were already mid-purchase. Without a holdout you cannot tell the difference between a campaign that works and a campaign that takes credit.</p>
<p>Keep a holdout on your highest-volume always-on journeys. Yes, it costs a little revenue. It buys you the ability to say "this programme generated €X we would not otherwise have had", which is what protects your budget and your headcount.</p>

<h2>Reports you will actually use</h2>
<ul>
  <li><strong>Campaign / Canvas analytics</strong> — per-step performance. Read the drop-off between steps, not just the totals.</li>
  <li><strong>Funnel reports</strong> — sequences of events. <code>search_performed → booking_started → booking_completed</code> tells you where guests fall out.</li>
  <li><strong>Retention reports</strong> — cohorts returning over time. The real measure of a loyalty programme.</li>
  <li><strong>Report Builder</strong> — comparisons across campaigns with your own metric set. Where your weekly reporting should live.</li>
  <li><strong>Currents</strong> — a raw event stream out to S3/Snowflake/BigQuery. When someone asks a question Braze's UI cannot answer, this is the answer. Know it exists.</li>
</ul>

<h2>Reporting upward</h2>
<p>Nobody outside CRM cares about open rate. Structure it as:</p>
<ol>
  <li><strong>The business number</strong> — incremental revenue and bookings this period, vs target.</li>
  <li><strong>What drove it</strong> — one or two sentences on the biggest mover.</li>
  <li><strong>What you learned</strong> — one test result, win or loss. Reporting a loss builds more credibility than reporting only wins.</li>
  <li><strong>What is next</strong> — the next test and what it would be worth.</li>
</ol>
<p>Four bullets. Engagement metrics go in an appendix for anyone who wants them.</p>
`,
  tasks: [
    {
      q: 'Your abandonment campaign reports 421 conversions and €168,400 revenue over 30 days. The Commercial Director asks whether it is worth keeping. What do you say?',
      a: `<p>Be honest that the headline number overstates it, then propose the measurement rather than guessing.</p>
<blockquote style="border-left:3px solid #E3E3EB;padding-left:14px;color:#43434E;">
"The campaign is credited with 421 bookings and €168k in the 72-hour attribution window. That is <em>attributed</em>, not incremental — a good share of those guests were mid-booking and would have finished anyway. Published benchmarks for abandonment flows put genuine incrementality somewhere between 20% and 50% of attributed, so the honest range today is roughly €35k–€85k.
I want to stop guessing: I will put a 10% holdout on it for six weeks. That costs us about €17k of attributed revenue and gives us a real number we can plan against. My expectation is it clears its cost several times over — abandonment is usually the highest-ROI journey in the stack — but I would rather show you the measurement than the assumption."
</blockquote>
<p>What this demonstrates: you understand attribution vs incrementality, you can size the cost of finding out, you commit to a timeline, and you state your prior without pretending it is evidence.</p>`,
    },
    {
      q: 'Pre-arrival email: 63% open, 25% click, 19.6% conversion on <code>checked_in</code>. Post-stay review: 46% open, 17% click, 12.2% conversion. Which is performing better?',
      a: `<p>The comparison is not meaningful as posed, and saying so is the right answer.</p>
<ul>
  <li><strong>Different audiences.</strong> Pre-arrival goes to people with a paid, imminent booking — the most engaged state a guest is ever in. Post-stay goes to everyone who checked out, including one-off OTA guests with no relationship.</li>
  <li><strong>Different asks.</strong> "Check in online and skip the queue" is self-interested for the guest. "Rate your stay" is a favour. Expect a large gap on effort alone.</li>
  <li><strong>Different value.</strong> Online check-in reduces front-desk load and lifts ancillary attach. A review lifts your OTA ranking, which affects future acquisition cost. These are not commensurable in a single ratio.</li>
</ul>
<p><strong>What to do instead:</strong> compare each against its own history and its own benchmark. Pre-arrival at 19.6% — is that up or down on last quarter? Review at 12.2% — what does the industry see, and what does each incremental review buy in OTA visibility? Trend and benchmark, never cross-journey rate comparison.</p>
<p>If forced to pick one to improve: the review request, because it is further from its ceiling. Pre-arrival at 63% open has little headroom.</p>`,
    },
  ],
},

/* ======================================================================== */
{
  id: 'c-scenarios',
  icon: '🚨',
  title: 'On-the-job scenarios — the messy real thing',
  blurb: 'Eight situations taken from how the work actually arrives: vague briefs, broken data, angry stakeholders, and a live incident.',
  minutes: 40,
  body: `
<p>These are the shape of your actual week. There is rarely one right answer — what is being assessed is whether you ask the right question before building.</p>

<h2>1. The Monday-morning brief</h2>
<div class="bz-callout">
<p><em>Commercial Director, Slack, 08:40:</em> "Occupancy in Eilat is soft for the last week of August. Can you send something out?"</p>
</div>
<p><strong>Do not start building.</strong> Ask four questions, and ask them in one message so it does not become a five-hour thread:</p>
<ol>
  <li><strong>How many rooms, which dates exactly?</strong> Determines whether this is a 5k targeted send or a 150k blast.</li>
  <li><strong>What can I offer?</strong> Rate discount, free night, points bonus, F&amp;B credit? Do I have approval, or am I asking for it?</li>
  <li><strong>What is the constraint?</strong> Filling rooms at any price, or protecting ADR? Completely different creative.</li>
  <li><strong>Who is off-limits?</strong> Guests who already booked those dates at full rate must be excluded, or you will be refunding the difference all week.</li>
</ol>
<p>Then propose, rather than asking what they want: <em>"Israeli families who have stayed at a resort property before and have promotional consent — about 12k reachable. Two-night minimum, 20% off, expires Sunday. Live tomorrow 10:00 with a 10% holdout so we know what it actually moved."</em></p>

<h2>2. The attribute that stopped arriving</h2>
<div class="bz-callout">
<p>Pre-arrival sends dropped 60% overnight. Nothing was deployed on your side.</p>
</div>
<p>Check a few profiles for people you know have upcoming stays. If <code>next_stay_date</code> is null, the integration broke. Nulls silently fail date filters — the segment does not error, it just shrinks. This is why segment-size monitoring matters more than it sounds.</p>
<p>Immediate mitigation: switch the Canvas entry from an attribute-based filter to the <code>booking_completed</code> <em>event</em>, which is a separate data path and is probably still flowing. Then chase the fix.</p>

<h2>3. The duplicate profile problem</h2>
<div class="bz-callout">
<p>A Platinum guest complains she got a "become a member" email.</p>
</div>
<p>She exists twice: once from the PMS keyed on the loyalty number, once from a web signup keyed on email. The web profile has zero stays and looks like a prospect. Identity resolution is a data-team problem, but you are the one who sees the symptom — so document it with examples and estimate the size (how many profiles share an email address?). "This affects roughly 8% of profiles" gets prioritised; "some guests are duplicated" does not.</p>
<p>Short-term guard: exclude anyone whose email matches a known member from prospect campaigns.</p>

<h2>4. The stakeholder who wants to send more</h2>
<div class="bz-callout">
<p>"Can we email the full base every week instead of every two weeks? We'd double the revenue."</p>
</div>
<p>You will not double revenue; you will roughly double unsubscribes and damage deliverability for the sends that do work. But "no" alone loses the argument. Propose the test: split the base, send weekly to half and fortnightly to half for six weeks, and compare revenue <em>per user</em> plus unsubscribe rate and deliverability. Commit to following the data either way. You usually win, and when you do it is settled permanently rather than re-argued every quarter.</p>

<h2>5. The live incident</h2>
<div class="bz-callout">
<p>A campaign went out to 40,000 people with <code>{{custom_attribute.\${first_name}}}</code> — the wrong namespace — so every email reads "Dear ,".</p>
</div>
<ol>
  <li><strong>Stop the campaign.</strong> If it is still sending, this saves the remainder.</li>
  <li><strong>Establish exactly how many received it.</strong></li>
  <li><strong>Tell your manager.</strong> Within minutes, before anyone else does.</li>
  <li><strong>Do not send a correction email.</strong> A missing first name is a minor cosmetic error; a follow-up doubles the volume and draws attention to it. If it had been a wrong <em>price</em>, that answer flips.</li>
  <li><strong>Fix the root cause.</strong> <code>first_name</code> is a standard attribute — <code>{{\${first_name}}}</code>, not <code>custom_attribute</code>. Then ask why preview did not catch it: probably because the preview user had no first name either, so the output looked plausible.</li>
  <li><strong>Add the guardrail:</strong> "preview as a user who has every field populated" alongside "preview as a user with nothing populated". You need both.</li>
</ol>

<h2>6. The GDPR request</h2>
<div class="bz-callout">
<p>A German guest requests deletion of all their data.</p>
</div>
<p>This is a legal obligation with a deadline, not a marketing task. Route it through whoever owns DSARs. On the Braze side deletion is via <code>/users/delete</code> — but Braze is one of several systems holding this person, and deleting there while leaving them in the PMS and the CDP is both non-compliant and likely to re-create the profile on the next sync. Confirm the order of operations with the data team, and make sure the source is deleted before Braze.</p>

<h2>7. The "just add one more filter" request</h2>
<div class="bz-callout">
<p>"Can you also exclude anyone who's stayed at a competitor?"</p>
</div>
<p>You cannot, and it is worth explaining why in a way that keeps the door open: Braze only knows what your systems tell it. If you have that data somewhere — a survey, a partner feed, a modelled propensity score — it can become a custom attribute and then it is targetable. If you do not have it, no amount of Braze configuration invents it. Offer the closest available proxy: guests whose booking frequency dropped, or who browse but do not book.</p>

<h2>8. The interview question you will get</h2>
<div class="bz-callout">
<p>"Walk me through how you would set up a win-back programme from scratch."</p>
</div>
<p>Structure the answer as: <strong>define → segment → design → personalise → test → measure → iterate.</strong></p>
<ol>
  <li><strong>Define lapsed</strong> using the data, not a guess: look at the repeat-booking interval distribution and pick the point where return probability drops off. For a city-break brand that might be 9 months; for a resort, 18.</li>
  <li><strong>Segment</strong> with tiers, because a lapsed Platinum guest deserves a different budget than a lapsed one-time OTA booker.</li>
  <li><strong>Design a Canvas</strong>, not a campaign — win-back is a sequence: reminder of value, then offer, then last chance, then stop.</li>
  <li><strong>Personalise</strong> on their history — the city they actually stayed in, their points balance, their preferred brand.</li>
  <li><strong>Test discount depth</strong> with Experiment Paths, including a points-only arm, because discounting is not always the answer and you want evidence before you train guests to wait for offers.</li>
  <li><strong>Measure incrementally</strong> with a holdout. Win-back without a holdout is indistinguishable from natural return.</li>
  <li><strong>Iterate</strong> on the lapse definition once you have data on who came back.</li>
</ol>
<p>The <em>Lapsed guest win-back (experiment)</em> Canvas in this sandbox is built exactly this way — open it and walk the steps.</p>
`,
  tasks: [
    {
      q: 'Scenario 1 again. The Commercial Director replies: "40 rooms, Aug 24–31, you can do 20% off, don\'t care about ADR, just fill them." Build the plan.',
      a: `<p><strong>Sizing first.</strong> 40 rooms × 7 nights is at most 280 room-nights, realistically ~50–80 bookings. You do <em>not</em> need 150k emails — that is a deliverability cost with no upside. Target tightly.</p>
<p><strong>Audience</strong> — sandbox segment <em>Israeli families — spa &amp; resort</em>, narrowed further:</p>
<pre><code>Country                     is        IL
travels_with_kids           is true
total_stays                 is at least 1
preferred_city              is any of  Eilat, Dead Sea
Promotions &amp; Offers         is        subscribed
next_stay_date              has no value      ← critical exclusion</code></pre>
<p>That last row keeps you from discounting to guests who already booked those dates at rack rate.</p>
<p><strong>Build:</strong> single campaign, not a Canvas — one message, hard deadline, no sequence. Scheduled 10:00 local tomorrow.</p>
<p><strong>Creative:</strong> lead with the deadline ("book by Sunday"), catalog-driven hero for the specific property, <code>{{\${first_name} | default: 'there'}}</code>, and the two-night minimum stated in the body rather than buried in terms.</p>
<p><strong>Measurement:</strong> conversion on <code>booking_completed</code>, 5-day window. Hold out 10% — even on a small send, because you will be asked to do this again and you want a baseline.</p>
<p><strong>Escalate one thing:</strong> if it does not fill by Thursday, ask whether you can go to 25% or open it to the wider Israeli base rather than silently missing the target. Say this in advance, not on Friday.</p>`,
    },
    {
      q: 'You have three weeks before you start. What do you actually do with them?',
      a: `<p><strong>Week 1 — mechanics.</strong> Work through this sandbox end to end: build three segments, two campaigns and one Canvas from scratch. Write ten Liquid snippets from memory, without copying. If you can build a branching Canvas and explain every setting on the entry step, you are ahead of most new hires.</p>
<p><strong>Week 2 — the domain.</strong> Braze is a tool; hospitality CRM is the job. Learn the vocabulary: ADR, RevPAR, OTA vs direct, rate parity, room-nights, length of stay, lead time, ancillary spend. Understand why direct bookings matter so much (OTA commission runs 15–25%) — nearly every CRM programme in a hotel group exists to shift share from OTA to direct, and that framing will make your proposals land.</p>
<p><strong>Week 3 — the specific company.</strong> Sign up for their emails from a fresh address. Start a booking and abandon it. Book something cheap and cancellable if you can, and watch the whole lifecycle arrive. Note what they send, when, what is personalised and what obviously is not. Walking in with "I signed up and here is the journey you currently run, and here are two gaps I noticed" is an unusually strong first week.</p>
<div class="bz-callout bz-callout--tip"><div class="bz-callout__t">Also worth doing</div><p>Braze Learning has free official courses and a Braze Certified Marketer credential. This sandbox teaches the same ground and lets you practise, but the certificate is a line on a CV and the vendor's own phrasing is what your colleagues will use day to day.</p></div>`,
    },
  ],
},
];

window.BZCourses = BZCourses;
