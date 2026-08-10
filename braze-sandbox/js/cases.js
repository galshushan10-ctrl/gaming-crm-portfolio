/* ==========================================================================
   Braze Sandbox — graded case studies
   Real briefs, shaped like the ones that will actually land on you at Fattal.

   A note on names. The briefs use Fattal's real commercial furniture: the
   brands (Herods, Leonardo Club, Leonardo Privilege, U Splash, NYX, FATTAL
   COLORS), the destinations, the Israeli holiday calendar, and the loyalty
   club as it really works — Fattal & Friends, a PAID club, ~₪250 for two
   years, 10% off, 11th night free, and no published tier ladder. The sandbox
   itself is seeded as "Aurelia Hotels Group" because it is a teaching
   environment and inventing guest records under a real employer's name would
   be a bad habit to start. The attribute names map one to one; where a case
   asks you to build something, build it against the Aurelia data.

   Fattal facts here were researched, and the uncertain ones are flagged in
   the cases themselves rather than smoothed over.
   ========================================================================== */

(function () {
  'use strict';

  /* ---------- helpers for build-step verification -------------------------- */

  const S = () => window.BZSeg;
  const mine = (coll) => (window.BZ[coll] || []).filter((x) => x._userCreated);

  /** every filter across every group of a segment, flattened */
  const filtersOf = (seg) => S().flat(seg.groups ? seg : seg.filters);

  const hasFilter = (seg, test) => filtersOf(seg).some(test);

  const byField = (f) => (x) => x.field === f;
  const fieldOp = (f, op) => (x) => x.field === f && x.op === op;

  /** score a set of named requirements; returns {partial, detail} for gradeBuild */
  function requirements(list) {
    const met = list.filter((r) => r.ok);
    const missed = list.filter((r) => !r.ok);
    const partial = list.length ? met.length / list.length : 0;
    const detail =
      (met.length ? '<p><strong>Found in what you built:</strong></p><ul>' +
        met.map((r) => '<li>✅ ' + r.label + '</li>').join('') + '</ul>' : '') +
      (missed.length ? '<p><strong>Missing:</strong></p><ul>' +
        missed.map((r) => '<li>⬜ ' + r.label + (r.why ? ' — <em>' + r.why + '</em>' : '') + '</li>').join('') + '</ul>' : '');
    return { partial, ok: partial >= 1, detail: detail || 'Nothing to check yet — build it first.' };
  }

  /** pick the user-created segment that best satisfies a requirement builder */
  function bestSegment(reqFn) {
    const segs = mine('segments');
    if (!segs.length) {
      return { partial: 0, ok: false,
        detail: 'No segment of your own found. Go to <a href="#/segments">Segments</a> → <strong>Create segment</strong> and build it, then come back.' };
    }
    let best = null;
    segs.forEach((seg) => {
      const r = requirements(reqFn(seg));
      if (!best || r.partial > best.partial) best = r;
    });
    return best;
  }

  /* ==========================================================================
     CASE 1 — November in Eilat
     The commonest brief in Israeli hospitality: a soft month in the one
     destination that is ~90% domestic, and a stakeholder who has already
     decided the answer is "send an email".
     ========================================================================== */

  const caseEilat = {
    id: 'eilat-november',
    icon: '🏨',
    title: 'November in Eilat',
    summary: 'Revenue wants midweek heads in the all-inclusives without touching the weekend rate. The obvious campaign is the wrong one.',
    difficulty: 'Core',
    minutes: 35,

    from: { name: 'Ronen Adler', initials: 'RA', role: 'VP Revenue, Israel', channel: 'Slack DM', time: 'Sun 08:41' },

    brief: `
      <p>morning 🙂</p>
      <p>Eilat is soft in November. Leonardo Club and Privilege are pacing about 15 points behind
      last year on Sun–Wed. Weekends are fine, don't touch them.</p>
      <p>Can you blast something to the database this week? Maybe 20% off. We need heads in beds.</p>
      <blockquote>Also finance are watching the discount line so don't go mad. Thanks!</blockquote>`,

    context: `
      <p>What you already know walking into this, before you open Braze:</p>
      <ul>
        <li><strong>Eilat is roughly 90% domestic.</strong> There is no inbound demand to lean on.
        Whoever fills those rooms is an Israeli who could also just not go.</li>
        <li><strong>Leonardo Club and Leonardo Privilege are the all-inclusive family products</strong>
        — waterparks, kids' clubs, entertainment. The people who love them are families.</li>
        <li><strong>November is term time.</strong> Families cannot travel Sunday to Wednesday.
        The audience that most wants this product is structurally unable to buy it.</li>
        <li><strong>The Israeli weekend is Thursday night to Saturday.</strong> Friday–Saturday is the
        pressure period, and Ronen has explicitly fenced it off.</li>
        <li><strong>Fattal & Friends is a paid club</strong> — around ₪250 for two years, 10% off,
        11th night free. Everyone in it has already made a purchase decision. There is
        <em>no published tier ladder</em>, so you cannot lean on "Gold members first".</li>
        <li>OTAs carry rate parity clauses. A public 20% off in email that undercuts Booking.com is a
        commercial problem, not just a marketing one.</li>
      </ul>
      <p class="bz-muted">In the sandbox the equivalent attributes are
      <code>custom.preferred_city</code>, <code>custom.travels_with_kids</code>,
      <code>custom.loyalty_tier</code>, <code>custom.next_stay_date</code> and the
      <code>Promotions &amp; Offers</code> subscription group.</p>`,

    warning: `Some of the tempting answers here are the ones a competent-sounding person gives in an
      interview and then regrets in production. Answer as you would actually act, not as you think
      the exercise wants.`,

    remedial: {
      audience: 'Redo the Segmentation course, then rebuild three of the seeded segments from scratch without looking.',
      personal: 'Redo Personalization &amp; Liquid, and specifically preview every template against Jonas Weber before you call it done.',
      timing: 'Reread the Campaigns course on delivery types, local time zone sending and quiet hours.',
      measure: 'Reread the Analytics course. The section on control groups is the one that pays.',
      commercial: 'This is the one no course teaches. Practise by writing the "what I would need to know" reply to every brief you get.',
      compliance: 'Reread Deliverability &amp; consent, especially subscription groups versus global unsubscribe.',
    },

    steps: [

      /* ---- 1 ---- */
      {
        id: 'e1', type: 'choice', dim: 'commercial', weight: 8,
        shortTitle: 'Reading the brief',
        prompt: 'It is 08:41 on Sunday. What do you actually do first?',
        note: 'There is a right answer, and three answers that each get someone into trouble in a different way.',
        options: [
          { id: 'a', label: 'Start building the segment and the email — the ask is clear enough and speed matters.', pts: 1,
            feedback: 'Speed is a real virtue and this is not the worst answer. But "blast the database, 20% off" contains at least four unstated decisions — which nights, which hotels, what the discount is fenced against, and what counts as success. If you build first you will build the wrong thing quickly.' },
          { id: 'b', label: 'Reply with a short list of the things you need before you can build: which arrival nights, which properties, how the offer is fenced, and what number would count as fixed.', pts: 3,
            feedback: 'Yes. Four questions, one message, no lecture. Every one of them changes what you build, and none of them can be guessed. Note that you are not refusing the work — you are scoping it in the same breath.' },
          { id: 'c', label: 'Push back that email cannot fix an occupancy gap and that this is a rate and distribution problem.', pts: 0,
            feedback: 'Even where this is partly true, it is the wrong move on a Sunday morning from someone three weeks into the job. It reads as refusal, it is unfalsifiable, and it ends the conversation instead of shaping the brief. Earn the right to say this by first showing you can deliver the thing.' },
          { id: 'd', label: 'Duplicate last November\'s Eilat campaign, swap the dates and send it.', pts: 0,
            feedback: 'The single most common real-world failure. You inherit last year\'s audience definition, last year\'s exclusions and last year\'s bugs, and you will not find out which until the numbers come in wrong. Reusing a campaign is fine; reusing it without auditing the target and the Liquid is not.' },
        ],
        model: `<p>"Before I build — which arrival nights are we protecting (Sun–Wed only, or Sun–Thu)? Which properties, Club and Privilege only? Is the 20% fenced to those dates at the booking engine, or is it a code anyone can use on any night? And what does fixed look like — X room nights, or a pacing number I can report against?"</p>`,
        nextTime: 'Make the four-question reply a habit. Dates, inventory, fencing, success metric. You will be right more often than the people who start building immediately, and it costs one message.',
      },

      /* ---- 2 ---- */
      {
        id: 'e2', type: 'multi', dim: 'commercial', weight: 10,
        shortTitle: 'Spotting the trap in the brief',
        prompt: 'Which of these are genuine problems with the brief as written? Select all that apply.',
        note: 'Wrong picks cost you. Do not select something just because it sounds sophisticated.',
        options: [
          { id: 'a', label: 'The product most likely to convert (all-inclusive family resorts) is bought by families, who cannot travel midweek in term time.', pts: 3,
            feedback: 'This is the heart of the case. The addressable midweek audience in November is retirees, childless couples and remote workers — people who want quiet and spa, not a waterpark. Product and audience are pulling in opposite directions.' },
          { id: 'b', label: 'A 20% discount sent by email will be redeemed against weekend nights unless it is date-fenced at the booking engine.', pts: 3,
            feedback: 'Correct, and this is the one that costs real money. Fencing in the creative ("valid Sun–Wed") is not fencing. If the code works on a Friday, people will use it on a Friday, and you will have discounted the nights Ronen told you not to touch.' },
          { id: 'c', label: 'A public 20% off can breach rate parity with the OTAs unless it sits behind a member login.', pts: 2,
            feedback: 'Right. Fencing the offer behind Fattal & Friends sign-in makes it a closed-user-group rate, which is the standard way out of the parity problem — and it has the happy side effect of driving club value.' },
          { id: 'd', label: 'No success metric is defined, so the campaign cannot be judged afterwards.', pts: 2,
            feedback: 'Yes, and this is how CRM teams end up unable to defend their budget. "Heads in beds" is not a number. Agree it before you send, not after.' },
          { id: 'e', label: 'Email is the wrong channel for this and it should be push only.', pts: -2,
            feedback: 'No. Push reaches only app installers, which is a fraction of the base and skews to your most engaged guests — the ones most likely to book anyway. This is a confident-sounding answer with nothing behind it.' },
          { id: 'f', label: 'The database is too small for a campaign like this to matter.', pts: -2,
            feedback: 'Invented. Nothing in the brief says that, and you have not looked. Do not manufacture objections.' },
        ],
        model: `<p>The three that matter commercially: the family-versus-midweek contradiction, the unfenced discount leaking onto weekends, and parity exposure. The missing success metric is the one that will hurt you personally, in six weeks, when someone asks whether it worked.</p>`,
        nextTime: 'Read every brief twice — once for what it asks, once for what it assumes. The assumptions are where the money is.',
      },

      /* ---- 3 ---- */
      {
        id: 'e3', type: 'choice', dim: 'audience', weight: 10,
        shortTitle: 'Audience definition',
        prompt: 'Ronen confirms: Sun–Wed arrivals, Leonardo Club and Privilege Eilat, offer fenced to those dates behind club login. Who do you target?',
        options: [
          { id: 'a', label: 'The whole marketable database. Reach is the point of a fill campaign.', pts: 0,
            feedback: 'This is the answer that feels safe and is not. You will mail tens of thousands of people an offer they cannot use, depress your engagement rates, raise unsubscribes on a list you need in April for Passover, and hand the algorithm a reason to start filtering you. Reach is not free.' },
          { id: 'b', label: 'Everyone whose preferred destination is Eilat.', pts: 1,
            feedback: 'Better, and defensible. But it still includes the weekend-only families who cannot travel midweek in November, and it excludes the Dead Sea and Tiberias regulars who are exactly the domestic short-break audience you could pull across.' },
          { id: 'c', label: 'Domestic guests who can plausibly travel midweek — no children, or business travellers — with Eilat or Dead Sea affinity, opted in to Promotions, and no booking already on the books.', pts: 3,
            feedback: 'Right on all four counts. Midweek-capable, destination-relevant, consented, and — the one people forget — excluding anyone with a future booking, because you do not pay a discount to someone who has already bought.' },
          { id: 'd', label: 'Fattal & Friends members only, since the offer is behind club login anyway.', pts: 2,
            feedback: 'A strong, disciplined answer and the easiest to defend to finance — every recipient can actually redeem. It costs you the non-member audience you could have converted into paid members with this offer, which is worth more than the room night. Half a mark short, not wrong.' },
        ],
        model: `<p>Midweek-capable (no kids, or a business-travel pattern) <strong>AND</strong> destination-relevant (Eilat or Dead Sea affinity) <strong>AND</strong> subscribed to Promotions <strong>AND NOT</strong> already holding a future booking. Then look at the count before you fall in love with it.</p>`,
        nextTime: 'Suppressing people who already bought is the highest-return filter in retail marketing and the one most often missing. Add it by reflex.',
      },

      /* ---- 4 ---- */
      {
        id: 'e4', type: 'build', dim: 'audience', weight: 12,
        shortTitle: 'Building the segment',
        prompt: 'Build it.',
        goto: '#/segments/new',
        task: `
          <p>Create a segment in the sandbox that expresses the audience you just chose. Using the
          Aurelia attribute names, it needs to:</p>
          <ol>
            <li>restrict to guests who can travel midweek — <code>travels_with_kids</code> is false,
            <em>or</em> <code>business_traveller</code> is true (that "or" is a hint: put them in one
            filter group joined with OR);</li>
            <li>restrict to destination relevance — <code>preferred_city</code> is Eilat
            (a second group, joined with AND);</li>
            <li>require the <strong>Promotions &amp; Offers</strong> subscription group;</li>
            <li>exclude anyone who already has a booking — <code>next_stay_date</code> has no value.</li>
          </ol>
          <p>Watch the live count as you add each row. If it collapses to nothing, that is
          information, not a mistake.</p>`,
        check: () => bestSegment((seg) => [
          { ok: hasFilter(seg, byField('custom.travels_with_kids')) || hasFilter(seg, byField('custom.business_traveller')),
            label: 'A midweek-capability filter (travels_with_kids / business_traveller)',
            why: 'without it you are mailing families an offer they cannot use in term time' },
          { ok: S().norm(seg.groups ? seg : seg.filters).groups.some((g) => (g.join === 'OR') && (g.filters || []).length > 1)
              || S().norm(seg.groups ? seg : seg.filters).groupJoin === 'OR',
            label: 'An OR join used somewhere',
            why: 'Segment Builder 2.0 supports OR inside and between groups — "no kids OR business traveller" is one group, not two segments' },
          { ok: hasFilter(seg, byField('custom.preferred_city')) || hasFilter(seg, byField('city')),
            label: 'A destination filter',
            why: 'an Eilat midweek offer sent to a Jerusalem city-break guest is noise' },
          { ok: hasFilter(seg, byField('subscription.sg-promos')),
            label: 'The Promotions & Offers subscription group',
            why: 'this is a promotional send; Trip Information consent does not cover it' },
          { ok: hasFilter(seg, fieldOp('custom.next_stay_date', 'not_exists')),
            label: 'Exclusion of guests who already have a booking (next_stay_date has no value)',
            why: 'discounting someone who has already booked is pure margin given away' },
        ]),
        model: `<p>Group 1 (join OR): <code>travels_with_kids is false</code> / <code>business_traveller is true</code>.
          Group 2 (join AND): <code>preferred_city is Eilat</code>, <code>Promotions &amp; Offers is subscribed</code>,
          <code>next_stay_date has no value</code>. Groups joined with AND.</p>`,
        nextTime: 'Build the exclusions at the same time as the inclusions, in the same sitting. Exclusions added later are exclusions forgotten.',
      },

      /* ---- 5 ---- */
      {
        id: 'e5', type: 'choice', dim: 'compliance', weight: 8,
        shortTitle: 'Consent basis',
        prompt: 'The segment is smaller than Ronen hoped. He asks you to "just include the pre-arrival list too, they get emails from us anyway."',
        scene: `<p>The pre-arrival list is the audience for transactional trip information — check-in
          details, directions, your room is ready. It is a <strong>Trip Information</strong>
          subscription group. It is much larger and much more engaged than the promotional list.</p>`,
        options: [
          { id: 'a', label: 'Include them. They are opted in to email and the message is from the same brand.', pts: 0,
            feedback: 'No. Subscription groups exist precisely so that consent to "tell me about my stay" is not treated as consent to "sell me a holiday". Under Israel\'s Spam Law (Amendment 40) and under GDPR for the European base, this is the difference between a compliant send and an unlawful one — and operationally it is how you destroy the only list that still has good engagement.' },
          { id: 'b', label: 'Decline, and explain that Trip Information is transactional consent — then offer what you can actually do to grow the promotional audience.', pts: 3,
            feedback: 'Correct, and the second half is what makes it a good answer rather than a blocking one. "I cannot use that list, but I can add the Dead Sea and Tiberias affinity guests, and I can run a club-join offer that grows the promotional list for next time."' },
          { id: 'c', label: 'Include them but add a prominent unsubscribe link so they can opt out.', pts: 0,
            feedback: 'An unsubscribe link does not retrospectively create consent. This is the compliance equivalent of taking the money and leaving a note.' },
          { id: 'd', label: 'Include only the pre-arrival guests who are also in the promotional group.', pts: 2,
            feedback: 'Harmless — but that is an empty gesture, because those people are already in your segment by virtue of the promotional filter. It shows the right instinct and no effect.' },
        ],
        model: `<p>"Trip Information is transactional consent — I can't send a rate offer to it without putting the whole programme at risk. What I can do instead: widen to Dead Sea and Tiberias affinity, and run a club-join creative so we grow the promotional list off the back of this."</p>`,
        nextTime: 'Never say only "no" to a stakeholder on a consent question. Say "no, because — and here is what I can do instead." The second clause is what keeps you in the room.',
      },

      /* ---- 6 ---- */
      {
        id: 'e6', type: 'choice', dim: 'personal', weight: 10,
        shortTitle: 'Liquid that survives production',
        prompt: 'You are writing the opening line. Which version ships?',
        scene: `<p>Roughly a fifth of the base has no first name on file — imported from OTA bookings,
          where the name field is often a booking reference or is missing entirely.</p>`,
        options: [
          { id: 'a', label: '<code>Hi {{custom_attribute.\${first_name}}}, November in Eilat is calling.</code>', pts: 0,
            feedback: 'Wrong namespace. <code>first_name</code> is a standard Braze attribute, so it is <code>{{\${first_name}}}</code>. Written this way it resolves to nothing for <em>everyone</em>, and because Liquid fails silently you will not see an error — you will just ship "Hi , November in Eilat is calling."' },
          { id: 'b', label: '<code>Hi {{\${first_name}}}, November in Eilat is calling.</code>', pts: 1,
            feedback: 'Right namespace, no safety net. For the fifth of your base with no name this renders "Hi , November…" — with the orphaned comma, which is the tell that no-one QA\'d it. Always the correct namespace <em>and</em> a fallback.' },
          { id: 'c', label: '<code>Hi {{\${first_name} | default: \'there\'}}, November in Eilat is calling.</code>', pts: 3,
            feedback: 'This is the one. Correct namespace, and <code>default</code> catches nil and empty string so the OTA-imported records read "Hi there". Cheap, invisible when it works, and it works.' },
          { id: 'd', label: '<code>{% if \${first_name} %}Hi {{\${first_name}}}{% else %}Hi there{% endif %}, November in Eilat is calling.</code>', pts: 2,
            feedback: 'Functionally fine and more verbose than it needs to be — and it carries a trap worth knowing: in Liquid an <strong>empty string is truthy</strong>. A profile whose first_name is "" takes the <em>if</em> branch and you are back to "Hi ,". <code>default</code> handles both nil and empty; the conditional does not.' },
        ],
        model: `<p><code>Hi {{\${first_name} | default: 'there'}},</code> — and then preview it against a profile with no name before you believe it.</p>`,
        nextTime: 'Two rules that prevent most personalization incidents: standard attributes take <code>{{\${...}}}</code>, custom attributes take <code>{{custom_attribute.\${...}}}</code>; and every single personalization token gets a <code>default</code>.',
      },

      /* ---- 7 ---- */
      {
        id: 'e7', type: 'build', dim: 'personal', weight: 10,
        shortTitle: 'Writing and previewing it',
        prompt: 'Write the message, then prove it survives a hostile profile.',
        goto: '#/templates',
        task: `
          <p>Open a template (or create one) and write an opening block that uses at least:</p>
          <ol>
            <li><code>{{\${first_name} | default: 'there'}}</code>,</li>
            <li>one custom attribute with a fallback — <code>{{custom_attribute.\${preferred_city} | default: 'Eilat'}}</code> is fine,</li>
            <li>and a conditional that says something different to club members
            (<code>{% if {{custom_attribute.\${loyalty_tier}}} != 'Blue' %}…{% endif %}</code>).</li>
          </ol>
          <p>Then hit <strong>Edge case</strong> and read the result. That button previews against
          <strong>Jonas Weber</strong> — no name, no stays, nulls everywhere. If the message reads
          properly for Jonas, it reads properly for everyone.</p>
          <p class="bz-small bz-muted">This step is marked complete once a template of yours contains
          personalization with fallbacks. The real check is the one you do with your eyes.</p>`,
        check: () => {
          const t = mine('templates');
          if (!t.length) return { partial: 0, ok: false,
            detail: 'No template of your own found. Open <a href="#/templates">Email Templates</a> and create one.' };
          const bodies = t.map((x) => x.body || x.html || '').join('\n');
          return requirements([
            { ok: /\$\{first_name\}/.test(bodies), label: 'Uses the standard-attribute namespace <code>\${first_name}</code>',
              why: 'custom_attribute.\${first_name} is the single most common personalization bug' },
            { ok: /\|\s*default\s*:/.test(bodies), label: 'At least one <code>default</code> filter',
              why: 'a fifth of the base has no first name' },
            { ok: /custom_attribute\.\$\{/.test(bodies), label: 'At least one custom attribute',
              why: 'the offer has to reference something the guest actually cares about' },
            { ok: /\{%\s*(if|unless|case)/.test(bodies), label: 'A conditional block',
              why: 'members and non-members should not get identical copy when the offer is club-fenced' },
          ]);
        },
        nextTime: 'Preview against your worst profile before your best one. Everyone\'s template works for Maya Levi; production is full of Jonas Weber.',
      },

      /* ---- 8 ---- */
      {
        id: 'e8', type: 'choice', dim: 'timing', weight: 8,
        shortTitle: 'Send time',
        prompt: 'When does it go?',
        scene: `<p>Your base is majority Israeli, with a European tail. Part of the Israeli audience is
          Shabbat-observant. The offer runs for ten days.</p>`,
        options: [
          { id: 'a', label: 'Right now — it is Sunday morning, which is the start of the Israeli working week.', pts: 2,
            feedback: 'Reasonable commercially: Sunday morning is Monday morning in Israel, and the offer window is short. What it ignores is the European tail, for whom Sunday morning is the weekend, and it forgoes any send-time discipline. Half marks for knowing the Israeli week.' },
          { id: 'b', label: 'Scheduled for 09:00 in each recipient\'s local time zone, with quiet hours set, and not landing Friday afternoon or Saturday.', pts: 3,
            feedback: 'Right. Local-time sending fixes the European tail for free, quiet hours stop the 03:00 accidents, and avoiding Friday afternoon through Saturday respects both Shabbat observance and the plain fact that Israeli Friday is a half day nobody is reading marketing email in.' },
          { id: 'c', label: 'Thursday evening, to catch people planning their weekend.', pts: 0,
            feedback: 'Thursday evening is the start of the Israeli weekend — and you are selling <em>midweek</em> nights. You would be interrupting the weekend to sell the opposite of a weekend, at the moment your audience is least receptive to admin.' },
          { id: 'd', label: 'Immediately, and again on Wednesday, and again on Sunday — three sends to maximise reach.', pts: 0,
            feedback: 'Three sends in ten days to a promotional list, with no engagement-based suppression between them, is how unsubscribe rates double. If you want a second touch, send it only to non-openers and only once, and check it against your frequency capping rules first.' },
        ],
        model: `<p>Local time zone, 09:00, quiet hours on, avoiding Friday afternoon and Saturday. One send, with a non-opener follow-up on day four at most.</p>`,
        nextTime: 'In Israel the calendar is a targeting variable, not a detail. Shabbat, the Sunday–Thursday week and the festival calendar should be in your head before you open the scheduler.',
      },

      /* ---- 9 ---- */
      {
        id: 'e9', type: 'choice', dim: 'timing', weight: 6,
        shortTitle: 'Rate limiting',
        prompt: 'The offer routes people to a call centre for the flight-plus-hotel package. The call centre has eleven agents.',
        options: [
          { id: 'a', label: 'Send it all at once. The call centre can deal with the queue.', pts: 0,
            feedback: 'You will generate the whole day\'s demand in twenty minutes, the queue will blow out, and a proportion of people who wanted to book will hang up and not come back. You converted intent into abandonment.' },
          { id: 'b', label: 'Apply a send rate limit so delivery spreads across the day, matched to what the call centre can absorb.', pts: 3,
            feedback: 'Correct, and it is the setting nobody remembers exists until the first time they melt a call centre. Rate limiting is not throttling for its own sake — it is matching demand generation to fulfilment capacity.' },
          { id: 'c', label: 'Cut the audience by two thirds so the volume is manageable.', pts: 1,
            feedback: 'It solves the operational problem by throwing away the commercial one. If capacity is the constraint, spread the same audience over time — do not delete two thirds of your opportunity.' },
          { id: 'd', label: 'Add a note in the email asking people to call outside peak hours.', pts: 0,
            feedback: 'Asking customers to manage your capacity problem. They will not.' },
        ],
        nextTime: 'Ask "what happens downstream if this works?" before every send. Call centres, booking engines and fulfilment all have a ceiling, and the campaign that hits it looks like a failure in the reporting.',
      },

      /* ---- 10 ---- */
      {
        id: 'e10', type: 'choice', dim: 'measure', weight: 10,
        shortTitle: 'Conversion event',
        prompt: 'What do you set as the primary conversion event, and over what window?',
        options: [
          { id: 'a', label: 'Email opens. It is the cleanest signal of interest.', pts: 0,
            feedback: 'Opens are not a conversion, and since Apple Mail Privacy Protection they are barely a metric. Machine-opened mail inflates the number by a large and unknowable amount. Never let an open be the primary conversion on a revenue campaign.' },
          { id: 'b', label: '<code>booking_completed</code>, 7 days.', pts: 2,
            feedback: 'Right event. The window is arguably tight for a leisure booking that involves a spouse, a calendar and a flight — you will under-count conversions that happen the following weekend. Defensible if you say why.' },
          { id: 'c', label: '<code>booking_completed</code>, 14 days, with <code>booking_started</code> as a secondary.', pts: 3,
            feedback: 'The strongest answer. Fourteen days covers the household decision cycle for a domestic short break, and the secondary event tells you whether a weak result is a targeting failure (nobody started) or a booking-funnel failure (lots started, few finished) — two problems with completely different owners.' },
          { id: 'd', label: '<code>booking_completed</code>, 90 days, to be sure of catching everything.', pts: 0,
            feedback: 'A 90-day window on a ten-day offer attributes to this campaign every booking that would have happened anyway. You will report a spectacular number, and it will be wrong in the direction that gets found out later.' },
        ],
        model: `<p>Primary <code>booking_completed</code>, 14 days. Secondary <code>booking_started</code>. Braze allows up to four conversion events — use the second one to make failures diagnosable.</p>`,
        nextTime: 'Choose the window from the customer\'s decision cycle, not from what makes the number look good. Then never change it mid-flight.',
      },

      /* ---- 11 ---- */
      {
        id: 'e11', type: 'choice', dim: 'measure', weight: 12,
        shortTitle: 'Proving it worked',
        prompt: 'Ronen will ask in three weeks whether it worked. What do you set up now so you can answer honestly?',
        options: [
          { id: 'a', label: 'Nothing extra. Report bookings attributed to the campaign in the conversion window.', pts: 0,
            feedback: 'This measures how many people who were already going to book to Eilat happened to open an email first. In a soft month with a discount, that number will look fine and will tell you nothing about whether the campaign caused anything.' },
          { id: 'b', label: 'An A/B test on the subject line, and report the winning variant.', pts: 1,
            feedback: 'Useful for learning about subject lines. It answers "which email was better", not "was the campaign worth the discount" — and the discount is the thing finance is watching.' },
          { id: 'c', label: 'A randomised control group held out of the send, and report the difference in booking rate between exposed and held-out.', pts: 3,
            feedback: 'The only answer that measures the campaign rather than the audience. Whatever the holdout books is what you would have got for free; everything above it is yours. It is also the single most career-useful habit in CRM, because it is the number that survives scrutiny.' },
          { id: 'd', label: 'Compare November this year to November last year.', pts: 0,
            feedback: 'Year-on-year comparison across a period when occupancy, rate, inventory, competitor pricing and the wider market all moved. It is not a measurement, it is a coincidence with a percentage sign.' },
        ],
        model: `<p>Hold out 10% at random. Report: booking rate exposed vs held out, incremental room nights, and the discount cost against the incremental revenue — not the total revenue.</p>`,
        nextTime: 'Set the holdout up before launch. You cannot retrofit a control group, and "we didn\'t hold one out" is the sentence that ends the conversation about your budget.',
      },

      /* ---- 12 ---- */
      {
        id: 'e12', type: 'multi', dim: 'compliance', weight: 8,
        shortTitle: 'Pre-launch check',
        prompt: 'Ten minutes before launch. Which of these do you actually check?',
        options: [
          { id: 'a', label: 'Preview against a profile with nulls everywhere, not just a complete one.', pts: 2,
            feedback: 'Yes. The complete profile always works. The empty one is where the broken Liquid, the orphaned commas and the "Dear valued " openings live.' },
          { id: 'b', label: 'Every link, clicked, including the tracked versions.', pts: 2,
            feedback: 'Yes — and specifically the tracked versions, because link wrapping is where a correct-looking URL turns into a 404 in production.' },
          { id: 'c', label: 'That the segment is the one you think it is, and re-read its filters rather than its name.', pts: 2,
            feedback: 'Yes. Segment names lie, because they were written for a previous purpose and edited since. Read the rows.' },
          { id: 'd', label: 'That frequency capping will not silently suppress a chunk of the audience.', pts: 2,
            feedback: 'Yes, and this catches people out constantly: the send goes out, the numbers are lower than the segment count, and the cause is a global cap set by someone else six months ago.' },
          { id: 'e', label: 'That the holdout group is configured and is actually excluded.', pts: 2,
            feedback: 'Yes. A holdout that was configured but not applied is worse than no holdout, because you will report against it in good faith.' },
          { id: 'f', label: 'That the send will not land during quiet hours or on Shabbat.', pts: 2,
            feedback: 'Yes — the check that is specific to this market and that a template checklist imported from elsewhere will not contain.' },
          { id: 'g', label: 'That the unsubscribe link is present and points at the right subscription group.', pts: 2,
            feedback: 'Yes. Present is not enough; it has to unsubscribe them from Promotions, not globally, or you lose their transactional messaging too.' },
        ],
        model: `<p>All seven. This is one of the few places in the job where the checklist genuinely is the skill — the failures it catches are cheap to prevent and expensive to explain.</p>`,
        nextTime: 'Write your own pre-launch checklist and run it every time, including the times you are sure you do not need to. The one you skip is the one that fails.',
      },

      /* ---- 13 ---- */
      {
        id: 'e13', type: 'build', dim: 'timing', weight: 8,
        shortTitle: 'Assembling the campaign',
        prompt: 'Put the campaign together in the sandbox.',
        goto: '#/campaigns/new',
        task: `
          <p>Create an <strong>Email</strong> campaign that targets the segment you built, with
          <code>booking_completed</code> as the conversion event. Walk all five steps —
          <em>Compose, Schedule, Target, Assign, Review</em> — and save it as a draft rather than
          launching, which is what you would do in real life while waiting for creative sign-off.</p>`,
        check: () => {
          const c = mine('campaigns');
          if (!c.length) return { partial: 0, ok: false,
            detail: 'No campaign of your own found. Go to <a href="#/campaigns">Campaigns</a> → <strong>Create Campaign</strong>.' };
          const any = (fn) => c.some(fn);
          return requirements([
            { ok: any((x) => (x.channels || []).some((ch) => /email/i.test(ch))), label: 'An email campaign' },
            { ok: any((x) => x.segmentId && !/^seg-(all)$/.test(x.segmentId)), label: 'Targeted at a specific segment rather than All Users',
              why: 'the default target is everyone, and it stays that way unless you change it' },
            { ok: any((x) => (x.conversionEvents || []).some((e) => e.event === 'booking_completed')),
              label: '<code>booking_completed</code> set as a conversion event',
              why: 'without it the campaign reports opens and clicks and no revenue' },
            { ok: any((x) => x.status === 'draft'), label: 'Saved as a draft',
              why: 'nothing launches before creative sign-off' },
          ]);
        },
        nextTime: 'Get into the habit of saving as draft and re-opening it cold the next morning. You will find something.',
      },

      /* ---- 14 ---- */
      {
        id: 'e14', type: 'text', dim: 'measure', weight: 12,
        shortTitle: 'Reporting the result',
        prompt: 'Three weeks later. The campaign drove 340 bookings; the 10% holdout suggests 95 of them would have happened anyway. The discount cost ₪118,000. Write the Slack message to Ronen.',
        note: 'Write it as you would actually send it. Three or four sentences. He has thirty seconds and he is not a Braze user.',
        placeholder: 'Ronen — November Eilat midweek results…',
        rubric: [
          { keywords: ['incremental', 'holdout', 'hold-out', 'control', 'would have', 'anyway'], pts: 3,
            note: 'Reported the incremental number, not the headline number — you led with 245, not 340' },
          { keywords: ['245', '340', 'booking'], pts: 2, note: 'Gave the actual figures rather than adjectives' },
          { keywords: ['₪', 'nis', 'cost', '118', 'margin', 'discount', 'revenue', 'profit'], pts: 2,
            note: 'Set the result against what it cost — the discount line is what finance is watching' },
          { keywords: ['midweek', 'sun', 'weekend', 'night'], pts: 1, note: 'Answered the question actually asked: midweek nights, not general bookings' },
          { keywords: ['next', 'recommend', 'again', 'suggest', 'learn', 'would'], pts: 2,
            note: 'Ended with a recommendation, so the message creates a decision rather than a filing' },
        ],
        model: `<p>"Ronen — November Eilat midweek: 340 bookings attributed, but the holdout says 95 of those
          would have come anyway, so <strong>245 incremental</strong>. Discount cost ₪118k against those
          245, which is about ₪480 a booking — worth it against an empty midweek room, not worth it on a
          weekend. Recommendation: run it again in the January trough, same fencing, but push it two
          weeks earlier so the long-lead planners catch it."</p>
          <p>Note what that does: it leads with the honest number, gives the cost per incremental booking
          rather than a percentage, answers the actual question, and ends with a decision to make.</p>`,
        nextTime: 'Always report the incremental figure first and the attributed figure second. The person who volunteers the smaller, truer number is the person who gets believed the next time.',
      },

      /* ---- 15 ---- */
      {
        id: 'e15', type: 'choice', dim: 'commercial', weight: 8,
        shortTitle: 'The follow-up ask',
        prompt: 'Ronen replies: "Great — let\'s do the same for Passover, it\'s only 20 weeks out."',
        scene: `<p>Passover 2026 falls 21–29 April. Israeli families start planning Passover around Sukkot,
          six months ahead; enquiring in February is generally too late for first-choice hotels. Peak
          holiday inventory at the Eilat resorts sells out in days.</p>`,
        options: [
          { id: 'a', label: 'Run the same campaign with Passover dates and a 20% discount.', pts: 0,
            feedback: 'You would be discounting the single highest-demand week of the Israeli year, on inventory that sells out anyway. This is the most expensive mistake in the case — it is a large amount of margin given away for room nights you already had.' },
          { id: 'b', label: 'Explain that Passover is a different problem — inventory is scarce, so the campaign is about allocation and lead time, not discounting.', pts: 3,
            feedback: 'Right. When demand exceeds supply, the marketing job flips: you are not creating demand, you are ordering it, protecting rate, and steering people towards the properties that still have space. The creative, the timing and the success metric are all different.' },
          { id: 'c', label: 'Agree, but with a smaller discount of 10%.', pts: 0,
            feedback: 'Same error, smaller. The problem is not the size of the discount; it is discounting at all into a sold-out period.' },
          { id: 'd', label: 'Say Passover is too far out to plan and revisit in February.', pts: 0,
            feedback: 'Backwards. February is <em>too late</em> — the long-lead planners have committed by then. If anything you are already behind.' },
        ],
        model: `<p>"Passover's the opposite problem — that inventory sells out, so discounting it just gives away
          margin on rooms we'd fill anyway. What I'd do instead: an early-access window for Fattal & Friends
          members, no discount, and start it now rather than in February, because the planners commit around
          Sukkot. Want me to scope that?"</p>`,
        nextTime: 'Before you accept "do the same thing again", ask whether the underlying supply-and-demand situation is the same. Fill campaigns and allocation campaigns look identical in Braze and are opposite in intent.',
      },

      /* ---- 16 ---- */
      {
        id: 'e16', type: 'text', dim: 'commercial', weight: 10,
        shortTitle: 'The retrospective',
        prompt: 'Last thing. What would you change if you ran this again?',
        note: 'This is the question you will be asked in your first review, and in most interviews. Be specific — name the decision, not the feeling.',
        placeholder: 'If I ran November Eilat again…',
        rubric: [
          { keywords: ['fence', 'fenced', 'booking engine', 'code', 'parity', 'login', 'member'], pts: 2,
            note: 'Named the offer fencing — the mechanism that stops midweek discounts leaking onto weekends' },
          { keywords: ['holdout', 'control', 'incremental', 'measure', 'test'], pts: 2,
            note: 'Kept measurement in the retrospective rather than treating it as a one-off' },
          { keywords: ['segment', 'audience', 'exclude', 'suppress', 'future booking', 'kids', 'family'], pts: 2,
            note: 'Reflected on targeting, including the family-versus-midweek contradiction' },
          { keywords: ['earlier', 'lead time', 'sooner', 'timing', 'plan'], pts: 2,
            note: 'Addressed lead time — domestic leisure books earlier than the campaign calendar assumes' },
          { keywords: ['club', 'friends', 'member', 'join', 'list', 'grow'], pts: 1,
            note: 'Thought about the asset, not just the campaign — growing the consented list is the compounding win' },
        ],
        model: `<p>"Three things. One: fence the offer at the booking engine from the start rather than in
          the copy, because we had leakage onto Thursday arrivals. Two: I would run the second touch to
          non-openers only, at day four — we did not, and the follow-up cost us unsubscribes we did not
          need to pay. Three: I would push the whole thing two weeks earlier; a chunk of the midweek
          audience had already committed to something else by the time we landed. And I would use the
          creative to sell Fattal & Friends membership harder, because the club list is the asset that
          makes next November easier."</p>`,
        nextTime: 'Keep a running note of these as they occur to you during a campaign, not after. The honest retrospective is the one written while it still stings.',
      },
    ],

    debrief: `
      <p>The through-line of this case is that the brief you receive is never the brief you should
      execute. "Blast the database, 20% off" contains a targeting contradiction (families cannot
      travel midweek in term time), a leakage risk (an unfenced discount lands on the weekend nights
      you were told to protect), a consent trap (the tempting large list is transactional), and no
      way to tell afterwards whether any of it worked.</p>

      <p>None of those are Braze problems. Braze is the easy part. What makes someone good at this
      job is the fifteen minutes before they open Braze.</p>

      <p><strong>The three habits worth taking from this:</strong></p>
      <ol>
        <li><strong>Four questions before you build:</strong> which dates, which inventory, how is
        the offer fenced, what number counts as success.</li>
        <li><strong>Suppress people who already bought.</strong> It is the highest-return filter in
        the builder and the one most often missing.</li>
        <li><strong>Hold out 10%.</strong> Every time, on every revenue campaign. It is the only
        number that survives a hostile question, and it takes thirty seconds to configure.</li>
      </ol>

      <p>If you want to push further: rerun this case assuming the offer <em>cannot</em> be fenced at
      the booking engine because the engine team has no capacity for three weeks. Almost every answer
      changes, and that constraint is more realistic than the version you just played.</p>`,
  };

  /* ==========================================================================
     CASE 2 — Ten nights and a paid club
     A Canvas case. The brief looks like a nudge campaign and is really a
     per-member, expiry-anchored journey with an arbitrage problem inside it.
     ========================================================================== */

  const caseClub = {
    id: 'club-eleventh-night',
    icon: '🎟',
    title: 'Ten nights and a paid club',
    summary: 'Eight thousand members are close to the free night. The brief says convert them before year end. The brief is the wrong campaign.',
    difficulty: 'Advanced',
    minutes: 40,

    from: { name: 'Maya Ashkenazi', initials: 'MA', role: 'Head of Loyalty', channel: 'Email', time: 'Tue 16:20' },

    brief: `
      <p>Hi — picking up on what we discussed.</p>
      <p>We have about 8,000 Fattal &amp; Friends members sitting on 8, 9 or 10 nights toward the
      free eleventh night. That is a lot of nearly-there.</p>
      <p>Can you build something to push them over the line before year end? Ideally automated so it
      keeps running. Whatever creative you think.</p>`,

    context: `
      <p>How the club actually works, because the mechanics decide the campaign:</p>
      <ul>
        <li><strong>It is a paid club</strong> — around ₪250 for a two-year term. Every member has
        already bought something. They are not prospects.</li>
        <li><strong>Accumulate ten nights and the eleventh is free</strong>, valued at the
        <em>average</em> of the ten accumulated nights, calculated <em>after</em> the 10% club
        discount is deducted.</li>
        <li><strong>Membership expires</strong> on a rolling per-member date, two years after they
        joined or last renewed. Expiry is a real event with a real revenue consequence.</li>
        <li><strong>Birthday, anniversary and "chosen month" benefits unlock from the second stay
        onwards</strong> — deliberately gated against join-and-burn.</li>
        <li><strong>There is no published tier ladder.</strong> No Gold, no Platinum. You cannot
        segment on tier because tier does not exist. <span class="bz-muted">(In the sandbox the
        Aurelia data does have a <code>loyalty_tier</code>; treat that as the Europe-side
        AdvantageCLUB analogue and ignore it for this case.)</span></li>
      </ul>
      <p>Sandbox equivalents: <code>custom.total_stays</code> stands in for accumulated nights,
      <code>custom.next_stay_date</code> for a future booking, <code>event.checked_out</code> for
      a completed stay, <code>event.points_redeemed</code> for a reward redemption.</p>`,

    warning: `There is a commercial trap in this brief that most people walk straight into, and it
      costs money on every single send. Read the mechanics above twice before you start.`,

    remedial: {
      audience: 'Rebuild this case\'s entry audience three times: as a segment, as an action trigger, and as a segment-based Canvas. The differences will stick.',
      personal: 'Practise Liquid that does arithmetic — nights remaining, value of the earned night — and check what happens when the attribute is missing.',
      timing: 'Reread the Canvas Flow course on delays, re-eligibility and lead time.',
      measure: 'Reread the Analytics course section on incrementality, then read it again thinking about people who would have bought anyway.',
      commercial: 'Ask, of every loyalty campaign: who was going to do this anyway, and what am I paying them for?',
      compliance: 'Reread Deliverability &amp; consent on subscription groups and on messaging people mid-stay.',
    },

    steps: [

      /* ---- 1 ---- */
      {
        id: 'c1', type: 'choice', dim: 'commercial', weight: 12,
        shortTitle: 'The trap in the brief',
        prompt: 'Before anything else: what is wrong with "push the 8,000 over the line before year end"?',
        options: [
          { id: 'a', label: 'Nothing much — it is a clear nudge brief with a clear audience.', pts: 0,
            feedback: 'It is not. There are at least three problems, and the expensive one is that a large share of those 8,000 already have a booking and will cross ten nights without any help from you. Nudging them is margin given away to people who had already decided.' },
          { id: 'b', label: 'A large share of the 8,000 already have a future booking and will reach ten nights anyway — messaging them is pure cost.', pts: 3,
            feedback: 'This is the one. <code>has_future_booking</code> — <code>next_stay_date</code> in the sandbox — has to be a hard exclusion, not a nice-to-have. It is also invisible in the reporting afterwards: those bookings will attribute to your campaign and make it look like a triumph.' },
          { id: 'c', label: 'Eight thousand is too small an audience to be worth automating.', pts: 0,
            feedback: 'Eight thousand paying club members at Israeli resort rates is a large amount of revenue, and the brief explicitly asks for something that keeps running. Size is not the issue.' },
          { id: 'd', label: 'Free-night rewards are bad for the business and the programme should be redesigned.', pts: 0,
            feedback: 'Not your call, not this week, and not what was asked. There is a genuine arbitrage issue in the reward mechanics, which is worth raising separately — but "redesign the programme" is not a response to "build me a journey".' },
        ],
        model: `<p>Exclude anyone with a future booking. Then note the second problem — "before year end"
          is <em>your</em> deadline, not the member's; their deadline is their own membership expiry
          date, which is different for all 8,000 of them.</p>`,
        nextTime: 'On any loyalty or retention brief, the first question is always: who in this audience was going to do it anyway? That group is where the money leaks.',
      },

      /* ---- 2 ---- */
      {
        id: 'c2', type: 'choice', dim: 'commercial', weight: 10,
        shortTitle: 'Campaign or Canvas',
        prompt: 'Campaign or Canvas?',
        options: [
          { id: 'a', label: 'A recurring campaign to the segment, weekly.', pts: 1,
            feedback: 'It would work and it is the fastest thing to ship. What it cannot do is respond to the member — everyone gets the same message on the same weekly cadence regardless of whether they just booked, just stayed, or are about to expire. You will end up bolting exclusions on until it becomes a bad Canvas.' },
          { id: 'b', label: 'A Canvas, entered when a member crosses into the 8–10 night band, branching on what they do next.', pts: 3,
            feedback: 'Right. The behaviour you care about — booking, staying, doing nothing, approaching expiry — happens on each member\'s own clock, and that is exactly what a Canvas is for. It also gives you an exit the moment they book, which a recurring campaign cannot do cleanly.' },
          { id: 'c', label: 'A one-off campaign now, and revisit in January.', pts: 0,
            feedback: 'The brief explicitly asks for something that keeps running, and a one-off ignores the fact that members enter the 8–10 band continuously.' },
          { id: 'd', label: 'A Canvas with a segment-based entry that re-evaluates daily.', pts: 2,
            feedback: 'Close, and a legitimate pattern. It is slightly blunter than an action-based entry: you will pick people up on the daily re-evaluation rather than at the moment they qualify, which costs you the immediacy of "you are one night away" landing the evening they check out.' },
        ],
        nextTime: 'Campaign for "everyone in this list, now". Canvas for "each person, on their own timeline". If the brief contains the words "keeps running", it is almost always a Canvas.',
      },

      /* ---- 3 ---- */
      {
        id: 'c3', type: 'choice', dim: 'audience', weight: 10,
        shortTitle: 'Entry criteria',
        prompt: 'How do people enter the Canvas?',
        options: [
          { id: 'a', label: 'Action-based: on <code>checked_out</code>, filtered to members now on 8–10 nights with no future booking.', pts: 3,
            feedback: 'The best answer. It fires at the natural moment — they have just finished a stay, the night has just been credited, and "you are two nights from a free one" is genuinely relevant rather than a nag. The filter does the rest.' },
          { id: 'b', label: 'Segment-based: everyone currently on 8–10 nights, re-evaluated daily.', pts: 2,
            feedback: 'Works, and easier to reason about. You lose the moment — the message arrives on an arbitrary Tuesday rather than the day after they checked out — and moments are most of what makes lifecycle messaging work.' },
          { id: 'c', label: 'Scheduled: everyone on 8–10 nights, entered on the first of each month.', pts: 0,
            feedback: 'A batch campaign wearing a Canvas costume. You have taken a per-member journey and forced it onto a calendar that has nothing to do with the member.' },
          { id: 'd', label: 'API-triggered from the loyalty platform when the tenth night is credited.', pts: 1,
            feedback: 'Technically clean and it makes you dependent on another team\'s release cycle for a campaign you could ship this week. Worth proposing as the eventual state; wrong as the thing you build first.' },
        ],
        nextTime: 'Prefer the entry that coincides with something real in the guest\'s life. "The day after you checked out" beats "the first of the month" every time.',
      },

      /* ---- 4 ---- */
      {
        id: 'c4', type: 'choice', dim: 'timing', weight: 10,
        shortTitle: 'Re-eligibility is not re-entry',
        prompt: 'Braze asks you to configure re-eligibility. What do you set, and why does it matter here?',
        scene: `<p>These are two different settings and people conflate them constantly.
          <strong>Re-eligibility</strong> governs whether someone who has already been through can
          come back in at all. <strong>Re-entry</strong> (and the cool-down attached to it) governs
          how soon.</p>`,
        options: [
          { id: 'a', label: 'Re-eligibility off. One pass per member is enough.', pts: 1,
            feedback: 'Safe, and it quietly breaks the journey. A member enters on 8 nights, does nothing, stays somewhere else, comes back on 10 nights — and cannot re-enter at the exact moment they are most likely to convert. You have optimised for not annoying people at the cost of the entire point.' },
          { id: 'b', label: 'Re-eligibility on, with a cool-down of around 30 days.', pts: 3,
            feedback: 'Right. They can come back when their situation changes — which it does, every time they stay — but not twice in a fortnight. The cool-down is what separates a responsive journey from a pestering one.' },
          { id: 'c', label: 'Re-eligibility on, no cool-down.', pts: 0,
            feedback: 'Every qualifying <code>checked_out</code> re-enters them immediately. A member on a three-night stay across three properties could receive the sequence three times in a week. This is the setting that generates complaints.' },
          { id: 'd', label: 'It does not matter much, since most members will only qualify once.', pts: 0,
            feedback: 'Untrue in a hotel group — this audience stays repeatedly by definition, that is why they are near ten nights — and "it does not matter" is not a configuration decision.' },
        ],
        model: `<p>Re-eligibility on, 30-day cool-down, plus an exit on <code>booking_completed</code>
          so the journey stops the moment it has succeeded.</p>`,
        nextTime: 'Read the two settings out loud before you set them: "can they come back" and "how soon". Getting them the wrong way round is one of the most common Canvas misconfigurations.',
      },

      /* ---- 5 ---- */
      {
        id: 'c5', type: 'build', dim: 'audience', weight: 12,
        shortTitle: 'Building the Canvas',
        prompt: 'Build the shell.',
        goto: '#/canvases',
        task: `
          <p>Create a Canvas and configure the entry:</p>
          <ol>
            <li><strong>Action-based</strong> entry;</li>
            <li>re-eligibility <strong>on</strong>, with a cool-down;</li>
            <li>a conversion event of <code>booking_completed</code>;</li>
            <li>at least four steps, including a <strong>Delay</strong> and an
            <strong>Action Paths</strong> split — because you need to branch on whether they
            booked after the first message.</li>
          </ol>`,
        check: () => {
          const cv = mine('canvases');
          if (!cv.length) return { partial: 0, ok: false,
            detail: 'No Canvas of your own found. Go to <a href="#/canvases">Canvases</a> → <strong>Create Canvas</strong>.' };
          const kinds = (c) => {
            const out = [];
            const walk = (steps) => (steps || []).forEach((s) => {
              out.push(s.kind);
              (s.paths || []).forEach((p) => walk(p.steps));
            });
            walk(c.steps); return out;
          };
          const any = (fn) => cv.some(fn);
          return requirements([
            { ok: any((c) => c.entry && c.entry.type === 'action_based'), label: 'Action-based entry',
              why: 'the moment that matters is the checkout, not the calendar' },
            { ok: any((c) => c.entry && c.entry.reeligibility && c.entry.reeligibility.allow),
              label: 'Re-eligibility enabled', why: 'members qualify again every time they stay' },
            { ok: any((c) => (c.entry && c.entry.conversionEvents || []).some((e) => /booking_completed/.test(e.event))),
              label: '<code>booking_completed</code> as a conversion event' },
            { ok: any((c) => kinds(c).includes('delay')), label: 'A Delay step',
              why: 'without one, every branch fires at once' },
            { ok: any((c) => kinds(c).includes('action_paths')), label: 'An Action Paths split',
              why: 'you have to branch on whether the first message worked' },
          ]);
        },
        nextTime: 'Sketch the flow on paper before you drag a single step. Canvases built by dragging tend to grow a shape nobody can explain later.',
      },

      /* ---- 6 ---- */
        {
        id: 'c6', type: 'choice', dim: 'audience', weight: 8,
        shortTitle: 'Action Paths vs Audience Paths',
        prompt: 'After the first message you want to treat bookers differently from non-bookers. Which split?',
        options: [
          { id: 'a', label: 'Action Paths, waiting on <code>booking_completed</code> for 7 days.', pts: 3,
            feedback: 'Correct. Action Paths waits for a behaviour to happen inside a window — which is exactly the question "did they book after we messaged them?" The window is the part people forget to set thoughtfully.' },
          { id: 'b', label: 'Audience Paths on whether <code>next_stay_date</code> exists.', pts: 1,
            feedback: 'It evaluates profile state at the moment they arrive at the step, so it will catch a booking made <em>before</em> the message as well as after — which is precisely the population you were trying to exclude at entry. It answers a subtly different question and flatters your results.' },
          { id: 'c', label: 'A Decision Split on club membership.', pts: 0,
            feedback: 'Everybody in this Canvas is a club member. The split would send 100% down one branch.' },
          { id: 'd', label: 'Experiment Paths, so you can compare.', pts: 0,
            feedback: 'Experiment Paths splits randomly for testing. It is the right tool later in this case, for measurement — it is not a way to branch on behaviour.' },
        ],
        model: `<p>Action Paths on <code>booking_completed</code>, 7-day window. Bookers exit or move to a
          pre-arrival branch; non-bookers get one more touch and then leave the journey.</p>`,
        nextTime: 'Action Paths asks "did they do X?". Audience Paths asks "are they X?". Behaviour versus state — say which one you mean before you pick the step.',
      },

      /* ---- 7 ---- */
      {
        id: 'c7', type: 'choice', dim: 'personal', weight: 10,
        shortTitle: 'The number in the message',
        prompt: 'The message says how many nights they have left. Which Liquid do you trust?',
        scene: `<p>The reward triggers at ten accumulated nights. The attribute holding the running
          total is <code>total_stays</code>, and it is not populated on every profile — a small
          number of records imported from the old club system have it missing entirely.</p>`,
        options: [
          { id: 'a', label: '<code>You are {{10 | minus: custom_attribute.\${total_stays}}} nights away!</code>', pts: 0,
            feedback: 'Two faults. The attribute is not wrapped, and on a profile where <code>total_stays</code> is missing this renders "You are 10 nights away!" to someone who might be on nine — the single worst possible error in a loyalty message, because it tells your best members the programme has lost their history.' },
          { id: 'b', label: '<code>{% assign left = 10 | minus: {{custom_attribute.\${total_stays}}} %}You are {{left}} nights away!</code>', pts: 1,
            feedback: 'The arithmetic is right and the failure mode is not handled. Missing attribute still yields 10. You need to decide what happens when you do not know, and you have not.' },
          { id: 'c', label: '<code>{% if {{custom_attribute.\${total_stays}}} %}{% assign left = 10 | minus: {{custom_attribute.\${total_stays}}} %}You are {{left}} {% if left == 1 %}night{% else %}nights{% endif %} away!{% else %}{% abort_message(\'no night count\') %}{% endif %}</code>', pts: 3,
            feedback: 'This is the production answer. It computes the number, gets the singular right — "1 nights away" is the detail that makes a brand look automated — and where the data is missing it <strong>aborts the message entirely</strong> rather than sending something wrong. Not sending is a valid and often correct outcome.' },
          { id: 'd', label: 'Do not show a number. Say "you are close to your free night."', pts: 2,
            feedback: 'Genuinely defensible, and safe. The specific number is what makes this campaign work — "you are one night away" converts materially better than "you are close" — so you are trading performance for safety you could have had anyway with <code>abort_message</code>.' },
        ],
        model: `<p>Compute it, pluralise it, and abort where the data is missing. <code>{% abort_message() %}</code>
          exists exactly for this: a message that would be wrong should not be sent.</p>`,
        nextTime: 'Whenever Liquid does arithmetic on an attribute, ask what the sum produces when the attribute is absent. It will not error — it will quietly produce a plausible wrong number.',
      },

      /* ---- 8 ---- */
      {
        id: 'c8', type: 'multi', dim: 'compliance', weight: 10,
        shortTitle: 'Who must never receive this',
        prompt: 'Which of these must be hard-excluded from the journey? Select all that apply.',
        options: [
          { id: 'a', label: 'Members who already have a future booking.', pts: 3,
            feedback: 'Yes — the central commercial exclusion. They will reach ten nights without your help and without your discount.' },
          { id: 'b', label: 'Members who are currently in-house, mid-stay.', pts: 2,
            feedback: 'Yes. Sending "book another stay" to someone eating your breakfast is jarring, and it competes with the on-property upsell messaging that is worth more per head.' },
          { id: 'c', label: 'Members whose club membership expires within days.', pts: 2,
            feedback: 'Yes — but exclude them <em>from this journey</em> and route them into the renewal journey instead. A free night they cannot claim before expiry is a complaint, not an offer.' },
          { id: 'd', label: 'Members who have unsubscribed from the loyalty subscription group.', pts: 3,
            feedback: 'Yes, and this one is not optional. Subscription-group status is checked at send, but building it into the audience keeps your reporting honest and stops you counting people you were never going to reach.' },
          { id: 'e', label: 'Members who have never opened an email.', pts: 0,
            feedback: 'No. This is a high-value, high-relevance message to paying members — it is exactly the sort of message that reactivates a dormant subscriber. Sunsetting is for broadcast promotional mail, not for a personal reward notification.' },
          { id: 'f', label: 'Members outside Israel.', pts: -2,
            feedback: 'No, and it would be a real error: the eleventh night is redeemable in Israel <em>and</em> at selected Fattal hotels abroad. You would be excluding valid members from a benefit they hold.' },
        ],
        model: `<p>Future booking, in-house right now, expiring imminently (route them elsewhere), and
          unsubscribed from the loyalty group. Not the non-openers, and definitely not the non-Israelis.</p>`,
        nextTime: 'Write the exclusion list before the inclusion list. It is shorter, it is more consequential, and doing it first stops you rationalising your way out of it later.',
      },

      /* ---- 9 ---- */
      {
        id: 'c9', type: 'choice', dim: 'timing', weight: 8,
        shortTitle: 'Lead time',
        prompt: 'The non-booker branch gets a second message. When?',
        scene: `<p>Domestic Israeli leisure booking is bimodal: a long-lead holiday-peak book of three
          to six months, and a very short-lead midweek or soft-season book measured in days.</p>`,
        options: [
          { id: 'a', label: 'Next day, while it is fresh.', pts: 0,
            feedback: 'They have just checked out of a hotel. Nobody books their next holiday the day after they got home, and you have spent your second touch on the least receptive day in the cycle.' },
          { id: 'b', label: 'After a delay of around 10–14 days, framed around a specific soft-season window they could actually use.', pts: 3,
            feedback: 'Right on both counts. Long enough that the last trip is a memory rather than laundry, short enough to stay attached to it — and the second message earns its place by being about a bookable window, not by repeating the first.' },
          { id: 'c', label: 'After 90 days, so it does not feel pushy.', pts: 1,
            feedback: 'Safe to the point of pointlessness. Ninety days after checkout the connection to the stay is gone and the message reads as a cold nudge from a database.' },
          { id: 'd', label: 'Six weeks before Passover, so it lands in the peak booking window.', pts: 0,
            feedback: 'Two errors. Six weeks before Passover is already late for that market — planning starts around Sukkot, roughly six months out. And you would be steering a free-night redemption into the highest-rate week of the year, which is the arbitrage you should be designing <em>against</em>.' },
        ],
        model: `<p>10–14 days, tied to a named soft-season window — a November midweek, a January break —
          which is where you want the free night redeemed anyway.</p>`,
        nextTime: 'Match every delay to a real-world decision cycle. A delay chosen because it "feels about right" is the most common reason a Canvas underperforms with no visible fault.',
      },

      /* ---- 10 ---- */
      {
        id: 'c10', type: 'choice', dim: 'commercial', weight: 10,
        shortTitle: 'The arbitrage',
        prompt: 'Someone points out that the free night is valued at the average of the ten accumulated nights, after the club discount. What follows from that?',
        options: [
          { id: 'a', label: 'Nothing actionable — it is a programme rule, not a campaign decision.', pts: 0,
            feedback: 'It is very much a campaign decision. The rule means a member can accumulate ten cheap midweek November nights and redeem the eleventh at Passover in Eilat, where the real rate is several times the credited value. Your campaign either encourages that or steers away from it.' },
          { id: 'b', label: 'Pushing members to accumulate cheap nights faster makes the redemption cost worse for the business.', pts: 3,
            feedback: 'Exactly. The nudge campaign, done naively, actively subsidises the arbitrage: cheap nights in, expensive night out. The fix is in the creative and the steering — point the offer at soft-season stays, and point the <em>redemption</em> there too.' },
          { id: 'c', label: 'The free night should be removed from the programme.', pts: 0,
            feedback: 'Not your decision and not the question. The eleventh night is the reason people pay ₪250.' },
          { id: 'd', label: 'You should target only high-rate guests so the average is higher.', pts: 1,
            feedback: 'It engages with the economics, which puts it ahead of the do-nothing answer, and it inverts the campaign: you would be excluding the value-seeking majority who are most responsive, to protect a margin on the minority who are least. It also does nothing about when the night is redeemed, which is where the exposure actually sits.' },
        ],
        model: `<p>Raise it, in one sentence, with a proposal: "the mechanic means we're paying the peak
          rate for nights earned at trough rates — worth capping redemption to non-peak dates, or at
          minimum let me steer the creative at soft-season stays so we're not funding the spread."</p>`,
        nextTime: 'Learn the commercial mechanics of anything you are asked to promote. The person who spots that a campaign subsidises an arbitrage is the person who gets asked their opinion next time.',
      },

      /* ---- 11 ---- */
      {
        id: 'c11', type: 'choice', dim: 'measure', weight: 12,
        shortTitle: 'Measuring an always-on journey',
        prompt: 'How do you prove this Canvas is worth keeping?',
        options: [
          { id: 'a', label: 'Report bookings from members who entered the Canvas.', pts: 0,
            feedback: 'This audience is defined by being frequent stayers who are near a reward. They are the most likely people in the entire database to book regardless. Their booking rate will look magnificent and mean nothing.' },
          { id: 'b', label: 'Compare the 8–10 night band to the 5–7 night band.', pts: 0,
            feedback: 'Two different populations with different propensities. The difference you measure is the difference between the groups, not the effect of the journey.' },
          { id: 'c', label: 'An Experiment Path holding back a random slice from the messages, running continuously.', pts: 3,
            feedback: 'The right answer, and the continuous part is what makes it right. A one-off test tells you about one month; a permanently held-back slice tells you whether the journey still earns its keep a year from now, when the market has moved and nobody remembers why it was built.' },
          { id: 'd', label: 'Switch the Canvas off for a month and compare.', pts: 1,
            feedback: 'A genuine measurement approach — an on/off test is a real technique — and here it is contaminated by seasonality that dwarfs the effect you are measuring. A month of an Israeli hotel calendar is not comparable to the month before it.' },
        ],
        model: `<p>Experiment Path: 90% receive, 10% held back permanently. Report incremental bookings
          and incremental nights from the held-back comparison, and re-read it quarterly.</p>`,
        nextTime: 'Always-on journeys need always-on holdouts. The ones nobody has measured in two years are where the wasted budget accumulates.',
      },

      /* ---- 12 ---- */
      {
        id: 'c12', type: 'choice', dim: 'compliance', weight: 8,
        shortTitle: 'Channel',
        prompt: 'Maya asks whether this should be SMS or WhatsApp instead of email, "because open rates are so much better".',
        options: [
          { id: 'a', label: 'Switch to WhatsApp — open rates are much higher and it is the dominant channel in Israel.', pts: 0,
            feedback: 'WhatsApp is genuinely dominant in the Israeli market, and that is not sufficient reason. It requires its own opt-in, template pre-approval, and it costs per message — and comparing WhatsApp open rates to email open rates is comparing two different definitions of "open".' },
          { id: 'b', label: 'Keep email as the primary, and add push for app users as a same-day reinforcement.', pts: 3,
            feedback: 'Right. Email carries the detail — nights remaining, how redemption works, the terms — and push is free, already consented for app users, and good at prompting the return visit. You get the reach and the immediacy without a new consent problem.' },
          { id: 'c', label: 'Switch to SMS, which has near-universal reach.', pts: 1,
            feedback: 'Reach is real; cost, character limits and separate consent are also real. And SMS in Israel carries the same Spam Law constraints as email — the reach does not come free of the consent that governs it.' },
          { id: 'd', label: 'Send all four channels so nobody is missed.', pts: 0,
            feedback: 'Four messages saying the same thing is not coverage, it is harassment, and it is exactly what frequency capping exists to stop you doing.' },
        ],
        model: `<p>"Email primary — it carries the redemption detail. Push same-day for app users, free and
          already consented. WhatsApp is worth testing, but it needs its own opt-in and template approval,
          so let's not gate this journey on it."</p>`,
        nextTime: 'When someone compares open rates across channels, the useful reply is about consent, cost and what the message needs to carry. Open rate is the least informative number in that comparison.',
      },

      /* ---- 13 ---- */
      {
        id: 'c13', type: 'text', dim: 'commercial', weight: 12,
        shortTitle: 'Reframing the brief',
        prompt: 'You now think the brief is the wrong campaign. Write the reply to Maya.',
        note: 'She asked for a nudge to 8,000 people before year end. You think the real journey is anchored on each member\'s own expiry date. Say so — without sounding like you are refusing the work.',
        placeholder: 'Maya — happy to build this. One thing I want to flag first…',
        rubric: [
          { keywords: ['expiry', 'expire', 'renewal', 'renew', 'two year', '24 month', 'their own', 'per member', 'per-member'], pts: 3,
            note: 'Made the central point: the deadline is the member\'s expiry date, not the calendar year' },
          { keywords: ['future booking', 'already booked', 'anyway', 'exclude', 'suppress', 'has_future', 'next_stay'], pts: 3,
            note: 'Flagged the exclusion that stops you paying people who had already decided' },
          { keywords: ['build', 'ship', 'this week', 'both', 'start', 'happy to', 'can do'], pts: 2,
            note: 'Committed to delivering rather than only objecting — you kept the work moving' },
          { keywords: ['soft', 'midweek', 'november', 'january', 'trough', 'peak', 'passover', 'redeem'], pts: 2,
            note: 'Brought in where the night should be redeemed, not just whether it is earned' },
        ],
        model: `<p>"Maya — happy to build this, and one thing worth changing before I do. About a third of
          the 8,000 already have a booking on the system, so they'll hit ten nights without us; I'd exclude
          them or we're paying for bookings we already have. And 'before year end' is our deadline rather
          than theirs — each member's real clock is their own two-year expiry, so I'd anchor the journey on
          that date instead. Same build, better trigger. I'll steer the creative at midweek and soft-season
          stays so the free night lands where it costs us least. Can have a draft with you Thursday."</p>
          <p>Note the structure: agree, flag, propose, commit to a date. Four sentences, no lecture,
          and the work still ships this week.</p>`,
        nextTime: 'The reframe lands when it arrives with a delivery date attached. "You are wrong" is an argument; "here is the better version, Thursday" is a contribution.',
      },

      /* ---- 14 ---- */
      {
        id: 'c14', type: 'multi', dim: 'personal', weight: 8,
        shortTitle: 'QA on a Canvas',
        prompt: 'Before you turn it on. What do you check that you would not check on a single campaign?',
        options: [
          { id: 'a', label: 'That every path has a terminal step and nobody gets stuck mid-journey.', pts: 2,
            feedback: 'Yes. Orphaned branches are the classic Canvas defect — a path with no exit quietly accumulates people who never hear from you again and never leave.' },
          { id: 'b', label: 'That the "everybody else" catch-all branch exists on every split.', pts: 2,
            feedback: 'Yes. A split without a catch-all silently drops everyone who matches nothing, and the reporting shows it as low volume rather than as a fault.' },
          { id: 'c', label: 'That the total elapsed time through the longest path is what you intended.', pts: 2,
            feedback: 'Yes. Delays compound. Three innocent-looking waits become eleven weeks, and the last message arrives referencing a stay nobody remembers.' },
          { id: 'd', label: 'That the exit criteria actually fire — someone who books really does leave.', pts: 2,
            feedback: 'Yes, and test it with a real profile rather than trusting the configuration. An exit that does not fire means you send "you are two nights away" to someone who booked yesterday.' },
          { id: 'e', label: 'That each message individually previews correctly against a null-heavy profile.', pts: 2,
            feedback: 'Yes — this one you would also do on a campaign, but on a Canvas you have to do it for every message in every branch, which is where people run out of patience and stop checking.' },
          { id: 'f', label: 'That the Canvas has fewer than ten steps, since long Canvases perform worse.', pts: -2,
            feedback: 'Invented rule. Length is not the problem; unexamined length is. A twenty-step Canvas that someone can explain is fine.' },
        ],
        nextTime: 'QA a Canvas by walking one imaginary person down every branch out loud. You will find the orphan path in about ninety seconds.',
      },

      /* ---- 15 ---- */
      {
        id: 'c15', type: 'text', dim: 'measure', weight: 10,
        shortTitle: 'The result nobody wanted',
        prompt: 'Two months in: the journey drove 610 bookings, and the 10% holdout implies only 40 were incremental. What do you do?',
        note: 'This is the uncomfortable one. The campaign looks like a success in the dashboard and the holdout says it is almost entirely cannibalisation.',
        placeholder: 'What I would do, and what I would tell Maya…',
        rubric: [
          { keywords: ['report', 'tell', 'maya', 'honest', 'flag', 'share', 'transparent'], pts: 3,
            note: 'Reported it rather than quietly leaving the Canvas running' },
          { keywords: ['would have', 'anyway', 'cannibal', 'incremental', 'not causing', 'already'], pts: 2,
            note: 'Named what the number means: this audience was going to book regardless' },
          { keywords: ['keep', 'turn off', 'switch off', 'pause', 'stop', 'change', 'test', 'rework', 'narrow'], pts: 3,
            note: 'Reached an actual decision rather than only describing the finding' },
          { keywords: ['cost', 'cheap', 'margin', 'discount', 'free night', 'worth'], pts: 2,
            note: 'Weighed it against what the journey costs — an email costs almost nothing, a free night does not' },
        ],
        model: `<p>"Two months in: 610 bookings attributed, but the holdout says about 40 are incremental.
          The rest were coming anyway — which is not surprising for an audience defined as our most
          frequent stayers. The journey is nearly free to run, so I'd keep it, but I'd stop counting it as
          610 in the loyalty numbers. What I want to test next: does it work better on the 5–7 night band,
          where there is a real behaviour change to cause, rather than on people already at the finish line?"</p>
          <p>That answer does three things at once — it tells the truth, it makes a proportionate decision
          (cheap to run, so keep it), and it turns a disappointing result into the next test.</p>`,
        nextTime: 'A near-zero incremental result is information, not failure. The failure is finding it and saying nothing, because someone else will find it later and ask why you did not.',
      },
    ],

    debrief: `
      <p>Two ideas run through this case, and both of them outlive Braze.</p>

      <p><strong>First: who was going to do this anyway?</strong> The audience nearest a reward is by
      definition your most engaged, most frequent, most likely-to-buy population. Any campaign aimed at
      them will report beautifully and cause very little. The exclusion of members with a future booking,
      the permanent holdout, and the willingness to report 40 instead of 610 are all the same discipline
      wearing different clothes.</p>

      <p><strong>Second: the mechanics are the campaign.</strong> You could not have designed this well
      without knowing that the club is paid, that the term is two years, that the reward is valued after
      the discount, and that redemption is unrestricted by season. Every one of those facts changed a
      decision. Learn the commercial mechanics of whatever you are asked to promote before you learn the
      tool that promotes it.</p>

      <p><strong>What to take into Monday morning:</strong></p>
      <ol>
        <li>Exclusion list before inclusion list.</li>
        <li>Re-eligibility and re-entry are two settings — say what each one does out loud before setting it.</li>
        <li>Anchor journeys on the customer's date, not the company's quarter.</li>
        <li>Permanent holdout on anything always-on.</li>
      </ol>

      <p>Worth doing next: rebuild the whole thing anchored on membership expiry instead of night count,
      and see how much of your design survives. That is the campaign you argued for in step 13 — you may
      as well find out whether you were right.</p>`,
  };

  /* ==========================================================================
     CASE 3 — 11:40 on a Thursday
     Short, sharp, and the one most likely to actually happen in your first
     month. Incident response is a competency and nobody teaches it.
     ========================================================================== */

  const caseIncident = {
    id: 'incident-thursday',
    icon: '🚨',
    title: '11:40 on a Thursday',
    summary: 'The send went out twenty minutes ago and something is wrong. Nine decisions, under time pressure, in the order you actually have to make them.',
    difficulty: 'Under pressure',
    minutes: 15,

    from: { name: 'Dana Peretz', initials: 'DP', role: 'Guest Relations Manager', channel: 'Slack — #crm-urgent', time: 'Thu 11:40' },

    brief: `
      <p>@here we're getting calls. Guests saying they got an email with someone else's name in it?
      One says it called her "Dear Yotam".</p>
      <p>Front desk in Eilat has had four so far. What's going on 🙏</p>`,

    context: `
      <p>What you know at 11:40, and nothing more:</p>
      <ul>
        <li>The Fattal &amp; Friends soft-season email went out at 11:20. Around 40,000 recipients.</li>
        <li>You built it. It previewed correctly yesterday against two profiles.</li>
        <li>Four complaints in twenty minutes, all from Eilat guests.</li>
        <li>Nobody has asked you to do anything yet. They have asked what is going on.</li>
      </ul>`,

    warning: `Incident response is scored on order of operations, not on cleverness. The right actions
      taken in the wrong sequence still cost you.`,

    remedial: {
      audience: 'Practise reading a segment definition cold and describing who is in it in one sentence.',
      personal: 'Preview against three adversarial profiles as a matter of routine, not as a final check.',
      timing: 'Know where the stop control is before you need it. Find it now.',
      measure: 'After any incident, write down the number affected before you write anything else.',
      commercial: 'Practise the two-sentence status update: what is happening, and when the next update comes.',
      compliance: 'Know your escalation path for anything that might be a data issue, before it is 11:40.',
    },

    steps: [
      {
        id: 'i1', type: 'choice', dim: 'timing', weight: 12,
        shortTitle: 'First action',
        prompt: 'It is 11:41. What is your first action?',
        options: [
          { id: 'a', label: 'Reply in the channel explaining what you think happened.', pts: 0,
            feedback: 'You do not know what happened yet, and while you type a theory the send continues. Explaining precedes stopping only when the send has already finished.' },
          { id: 'b', label: 'Stop the send.', pts: 3,
            feedback: 'Correct. With a 40,000-recipient send twenty minutes in, delivery is very likely still in progress. Stopping is reversible; the emails already delivered are not. You can always resume, and you will never regret the ninety seconds.' },
          { id: 'c', label: 'Open the template and start debugging the Liquid.', pts: 1,
            feedback: 'You will find the bug — in ten minutes, during which several thousand more people receive it. Diagnosis after containment.' },
          { id: 'd', label: 'Ask Dana to forward one of the affected emails so you can see it.', pts: 1,
            feedback: 'You do need this, and it is step two, not step one. It also depends on Dana, who is fielding calls.' },
        ],
        nextTime: 'Containment, diagnosis, communication, remediation — in that order, every time. The instinct to explain first is strong and it is wrong.',
      },
      {
        id: 'i2', type: 'choice', dim: 'commercial', weight: 8,
        shortTitle: 'The holding message',
        prompt: '11:43. The send is stopped. What goes in the channel?',
        options: [
          { id: 'a', label: 'Nothing yet — wait until you know the cause so you can give a complete answer.', pts: 0,
            feedback: 'Silence in an incident channel is read as absence. People will escalate over your head within ten minutes, and then you are managing an audience as well as an incident.' },
          { id: 'b', label: '"Send stopped, investigating, update in 15 minutes."', pts: 3,
            feedback: 'Exactly right and exactly long enough. It says you have control, it says what you have done, and it sets the next checkpoint so nobody has to chase you. Then honour the fifteen minutes even if you have not solved it.' },
          { id: 'c', label: 'A full apology accepting responsibility and explaining the likely cause.', pts: 1,
            feedback: 'Too much, too early. You do not know the cause, and speculating about it in writing during an incident creates a record of a theory that may turn out to be wrong.' },
          { id: 'd', label: 'Ask how many complaints there are so far.', pts: 1,
            feedback: 'Worth knowing, and it is not a status update — it puts the work back on the person who raised it while they are still fielding calls.' },
        ],
        model: `<p>"Stopped the send at 11:42, investigating now, will update by 12:00." Twelve words and a
          commitment.</p>`,
        nextTime: 'The holding message has three parts: what you did, what you are doing, when you will next speak. It never needs a cause.',
      },
      {
        id: 'i3', type: 'choice', dim: 'personal', weight: 10,
        shortTitle: 'Diagnosis',
        prompt: 'The forwarded email opens "Dear Yotam" and the recipient is Rachel. What is the most likely cause?',
        scene: `<p>You look at the template. The greeting is:</p>
          <p><code>{% assign name = {{custom_attribute.\${first_name}}} %}Dear {{name | default: 'Yotam'}},</code></p>`,
        options: [
          { id: 'a', label: 'A Braze bug — personalization crossed between profiles.', pts: 0,
            feedback: 'Cross-profile leakage is vanishingly rare and should be your last hypothesis, not your first. Look at your own code before you accuse the platform.' },
          { id: 'b', label: 'Wrong namespace, and a test value left in the <code>default</code> filter.', pts: 3,
            feedback: 'That is it, and it is two mistakes compounding. <code>first_name</code> is a standard attribute, so <code>custom_attribute.\${first_name}</code> resolves to nothing for everybody — and the fallback, which someone set to "Yotam" while testing and never changed, then fires for every single recipient. Everyone got "Dear Yotam". The four Eilat calls are just the fastest complainers.' },
          { id: 'c', label: 'The segment was built on the wrong attribute.', pts: 0,
            feedback: 'A targeting error sends the right message to the wrong people. This is the right people receiving a wrong message — a content fault, not an audience one.' },
          { id: 'd', label: 'A data import overwrote first names.', pts: 1,
            feedback: 'Worth ruling out and testable in thirty seconds by opening any profile. It is not the cause here, because the template contains a visible fault that explains the symptom completely.' },
        ],
        model: `<p>Two faults: <code>custom_attribute.\${first_name}</code> should be <code>\${first_name}</code>,
          and the default should be a neutral word, never a person's name. A placeholder that reads like real
          data is how test values escape into production.</p>`,
        nextTime: 'Never put realistic-looking test data in a <code>default</code>. Use "there", or "Guest" — something that could never be mistaken for a real value.',
      },
      {
        id: 'i4', type: 'choice', dim: 'measure', weight: 10,
        shortTitle: 'Scope',
        prompt: '11:52. Before you tell anyone anything, what do you need?',
        options: [
          { id: 'a', label: 'How many were delivered before the stop, and whether the fault affected all of them or a subset.', pts: 3,
            feedback: 'Right. Every question you are about to be asked — do we apologise, who to, does the CEO need to know — depends on that number. Get it before you speak, not during.' },
          { id: 'b', label: 'Confirmation from Braze support that the send stopped.', pts: 1,
            feedback: 'The dashboard tells you this immediately. Waiting on support in the first fifteen minutes of an incident is time you do not have.' },
          { id: 'c', label: 'A list of who complained.', pts: 1,
            feedback: 'That tells you who was fastest to phone, not who was affected. Complaint volume systematically understates scope, usually by a factor of dozens.' },
          { id: 'd', label: 'Approval from your manager for the next step.', pts: 0,
            feedback: 'You have already taken the only irreversible-if-delayed step. Approval belongs to the apology decision, and you cannot ask for it usefully without the number.' },
        ],
        nextTime: 'Get the number before the meeting. An incident update without a scope figure generates four follow-up questions and one lost hour.',
      },
      {
        id: 'i5', type: 'choice', dim: 'commercial', weight: 10,
        shortTitle: 'The apology decision',
        prompt: '12:00. About 23,000 were delivered, all with "Dear Yotam". Do you send an apology email?',
        options: [
          { id: 'a', label: 'Yes, immediately, to all 23,000.', pts: 1,
            feedback: 'Defensible, and it is a decision above your pay grade on day one, and it doubles the volume of mail to people you just annoyed. A wrong greeting is embarrassing; it is not a data breach or a false offer. Recommend, do not unilaterally send.' },
          { id: 'b', label: 'Recommend one, with a draft attached, and let the brand and guest-relations owners decide.', pts: 3,
            feedback: 'The right shape. You bring the scope, the cause, a recommendation and a draft — so the decision takes two minutes rather than a meeting — and the people who own the customer relationship make the call. That is not passing the buck; it is routing the decision to its owner.' },
          { id: 'c', label: 'No. It was a greeting, not a data issue. Say nothing and fix it quietly.', pts: 0,
            feedback: 'Twenty-three thousand people received a visibly broken email and four have already phoned a hotel. This will surface. Deciding unilaterally to conceal it is the part that would damage you, far more than the bug.' },
          { id: 'd', label: 'Only to the four who complained.', pts: 1,
            feedback: 'Understandable instinct and it treats complaint volume as scope. It also creates a strange asymmetry where the people who phoned get an apology and the rest get nothing, which is worse if anyone compares notes.' },
        ],
        model: `<p>"23,400 delivered with a broken greeting. Cause was a fallback value left over from testing —
          fixed, and I've added a pre-send check so a personalization default can't ship untouched. I'd
          suggest a short apology from Guest Relations rather than from the campaign — draft attached.
          Happy either way, it's your call."</p>`,
        nextTime: 'Bring the decision to its owner pre-chewed: scope, cause, fix, recommendation, draft. You will get a yes in ninety seconds and a reputation for handling things.',
      },
      {
        id: 'i6', type: 'multi', dim: 'personal', weight: 12,
        shortTitle: 'Preventing the recurrence',
        prompt: 'What changes so this cannot happen again? Select all that genuinely help.',
        options: [
          { id: 'a', label: 'Never use a realistic name as a <code>default</code> value — use "there" or "Guest".', pts: 3,
            feedback: 'The direct fix, and it costs nothing. A placeholder that cannot be mistaken for real data cannot escape unnoticed.' },
          { id: 'b', label: 'Preview every send against a profile with nulls everywhere before launch.', pts: 3,
            feedback: 'Yes. This exact bug is visible instantly against a null-heavy profile — the fallback fires and you see "Dear Yotam" in your own preview. The seeded Jonas Weber profile exists for this.' },
          { id: 'c', label: 'Have a second person check personalization before any send over 10,000.', pts: 2,
            feedback: 'Proportionate and effective. Big sends get a second pair of eyes; small ones do not need the ceremony.' },
          { id: 'd', label: 'Send a seed test to yourself and colleagues before every launch.', pts: 2,
            feedback: 'Useful, with a caveat worth knowing: seed lists are usually full profiles, so they would <em>not</em> have caught this. Worth doing, not sufficient on its own.' },
          { id: 'e', label: 'Stop using Liquid personalization in large sends.', pts: -3,
            feedback: 'Removing the capability rather than the defect. Personalization is most of the value of the platform; the answer to a bad fallback is a good fallback.' },
          { id: 'f', label: 'Move greetings into a shared Content Block so there is one place to get it right.', pts: 2,
            feedback: 'A good structural answer. One reviewed block used everywhere beats forty templates each with their own greeting — and when it is wrong, it is wrong in one fixable place.' },
        ],
        nextTime: 'The best post-incident change is the one that makes the mistake impossible rather than the one that asks people to be careful. "Never use a real name as a default" is a rule; "be more careful" is not.',
      },
      {
        id: 'i7', type: 'choice', dim: 'compliance', weight: 8,
        shortTitle: 'Resuming',
        prompt: '12:30. Template fixed. Do you resume the send to the remaining 17,000?',
        options: [
          { id: 'a', label: 'Yes, resume now — they have not received anything yet.', pts: 2,
            feedback: 'Commercially sound, and slightly hasty. Resume after you have previewed the fix against a null profile and had someone else look, which costs ten minutes. The offer window is not so tight that ten minutes matters.' },
          { id: 'b', label: 'Yes, after previewing the fix against a null-heavy profile and a second person confirming.', pts: 3,
            feedback: 'Right. The one thing worse than an incident is the same incident twice in one morning, and the second one is the one people remember. Ten minutes of verification is cheap.' },
          { id: 'c', label: 'No. Cancel it entirely and reschedule for next week.', pts: 1,
            feedback: 'Over-correction. Seventeen thousand people have received nothing and the offer is still valid. Throwing the campaign away is not caution, it is flinching.' },
          { id: 'd', label: 'Resume, but only to the guests who complained, to test.', pts: 0,
            feedback: 'Testing your fix on the people already annoyed by the fault.' },
        ],
        nextTime: 'After any fix under pressure, verify before you resume. The pressure is exactly why you will skip it, which is exactly why you should not.',
      },
      {
        id: 'i8', type: 'text', dim: 'measure', weight: 12,
        shortTitle: 'The write-up',
        prompt: 'End of day. Write the incident note.',
        note: 'Five or six sentences, for people who were not involved. This document is how you are judged — far more than by the bug itself.',
        placeholder: 'Incident: Fattal & Friends soft-season email, Thursday…',
        rubric: [
          { keywords: ['23', '17', '40,000', '40000', 'delivered', 'recipients'], pts: 2,
            note: 'Stated the scope in numbers' },
          { keywords: ['default', 'fallback', 'namespace', 'custom_attribute', 'liquid', 'test value'], pts: 3,
            note: 'Named the technical cause precisely rather than vaguely' },
          { keywords: ['stopped', '11:4', 'contained', 'paused'], pts: 2,
            note: 'Recorded the timeline, including when it was contained' },
          { keywords: ['prevent', 'change', 'check', 'never use', 'preview', 'null', 'second', 'block', 'going forward'], pts: 3,
            note: 'Ended with concrete prevention rather than "we will be more careful"' },
        ],
        model: `<p>"<strong>Incident — soft-season email, Thursday.</strong> Sent 11:20 to a 40,000 audience;
          stopped 11:42 after 23,400 had been delivered. All delivered copies opened 'Dear Yotam' — the
          greeting used the custom-attribute namespace for a standard attribute, so it resolved empty for
          everyone, and the <code>default</code> value was a test name left in from build. Guest Relations
          sent a short apology at 14:00; four inbound calls, no escalations. Fixed and remaining 17,000 sent
          at 12:45 after a null-profile preview and a second check. <strong>Changes:</strong> defaults must be
          non-name placeholders, every send previews against the null-heavy test profile, and greetings move
          into one shared Content Block so there is a single place to get this right."</p>`,
        nextTime: 'Write the incident note the same day, plainly, without defending yourself. The people who read it are judging whether you can be trusted with the next thing, and a clear-eyed note is far more reassuring than a spotless record.',
      },
      {
        id: 'i9', type: 'choice', dim: 'commercial', weight: 8,
        shortTitle: 'The aftermath',
        prompt: 'Friday morning. Your manager asks, in passing, "so what happened yesterday?"',
        options: [
          { id: 'a', label: 'Explain that Liquid fails silently and this is a known trap that catches everyone.', pts: 0,
            feedback: 'All true, and it is an explanation that shifts the weight onto the tool. It is the answer that sounds fine and lands badly.' },
          { id: 'b', label: '"My mistake — a test value in a fallback. 23,000 got a wrong greeting. Fixed, apology went out, and I have changed how we do defaults so it cannot recur."', pts: 3,
            feedback: 'Own it, scope it, close it. Four clauses. Managers are not evaluating whether you make mistakes — you will — they are evaluating whether they will hear about them from you or from someone else.' },
          { id: 'c', label: 'Point out that nobody reviewed the template and the process is the real problem.', pts: 0,
            feedback: 'Process was a contributing factor and you were the author. Leading with the process reads as deflection, even when the process genuinely is inadequate. Fix the process in the same breath as owning the error and you get credit for both.' },
          { id: 'd', label: 'Play it down — a greeting is a small thing and it is handled.', pts: 1,
            feedback: 'Minimising a thing that generated customer calls invites them to form their own view of your judgement. It was handled well; say so accurately rather than smally.' },
        ],
        nextTime: 'Own it in the first sentence. Everything you say afterwards is heard more generously.',
      },
    ],

    debrief: `
      <p>Nothing in this case is about Braze. The bug was trivial and you will make an equivalent one at
      some point — everybody does. What is being assessed is the order you do things in when something has
      gone wrong and people are watching.</p>

      <p><strong>Containment, diagnosis, communication, remediation.</strong> Stop the send before you
      understand it. Say "stopped, investigating, update at 12:00" before you have a cause. Get the scope
      number before the conversation. Route the apology decision to the person who owns the customer
      relationship, pre-chewed. Verify the fix before resuming. Write it up the same day, plainly, and own
      it in the first sentence.</p>

      <p>Two specifics from this bug worth carrying permanently:</p>
      <ul>
        <li><strong>Never put a realistic name in a <code>default</code>.</strong> "there" or "Guest".
        A placeholder that looks like data will eventually be mistaken for data.</li>
        <li><strong>Preview against the empty profile, not the full one.</strong> This bug is invisible
        against a complete record and glaring against Jonas Weber. Two minutes.</li>
      </ul>

      <p>The uncomfortable truth about incidents: handled well, they build more trust than a clean run
      ever does. Nobody notices the campaigns that worked.</p>`,
  };

  /* ==========================================================================
     CASE 4 — 72 hours to Passover
     The allocation problem, and a deliberate collection of the traps that are
     one click away in the real product: the pre-built segment nobody inspects,
     the transactional reclassification, the frequency-cap exemption, and
     local-time delivery on a hard deadline — which is the exact opposite of
     the right answer in the November case.
     ========================================================================== */

  const casePassover = {
    id: 'passover-allocation',
    icon: '🕯',
    title: '72 hours to Passover',
    summary: 'Scarce inventory, a hard deadline, a CMO leaning on you, and four settings that are one click away and wrong.',
    difficulty: 'Hard',
    minutes: 40,

    from: { name: 'Ronen Adler', initials: 'RA', role: 'VP Revenue, Israel', channel: 'Slack DM', time: 'Wed 17:55' },

    brief: `
      <p>Passover inventory opens Sunday 09:00. Members get 72 hours of early access before it goes
      public — window closes Wednesday 09:00 sharp, that's when the OTAs get it.</p>
      <p>The CMO wants maximum reach on this one. Ignore the frequency caps if you need to, it's the
      biggest revenue week of the year.</p>
      <p>Marketing already built the audience, it's the segment called <em>"Passover Early Access
      2026"</em>. Just point the campaign at it. Go go go 🙏</p>`,

    context: `
      <p>The facts that decide this campaign:</p>
      <ul>
        <li><strong>Passover 2026 is 21–29 April.</strong> Seder night carries the national premium.
        Israeli families begin planning around Sukkot, roughly six months out.</li>
        <li><strong>The inventory is scarce and it sells out.</strong> Peak holiday rooms at the Eilat
        and Dead Sea resorts go in days, sometimes within 48 hours of opening.</li>
        <li><strong>The window is absolute.</strong> Wednesday 09:00 Israel time, for everyone, because
        that is when distribution opens to the OTAs.</li>
        <li><strong>Part of the audience is Shabbat-observant.</strong> A 72-hour clock starting Sunday
        morning contains a Friday evening and a Saturday.</li>
        <li>The base includes a large European tail from the Leonardo side — different time zones,
        GDPR rather than Israel's Spam Law, and a free loyalty scheme rather than the paid one.</li>
      </ul>
      <p class="bz-muted">Two things in this brief are instructions you should not follow. Find them
      before you build.</p>`,

    warning: `This case is deliberately loaded. Several wrong answers are a single click away in the real
      product, look efficient, and are exactly what a stakeholder under pressure is asking for. One of
      them is a compliance incident rather than a mistake.`,

    remedial: {
      audience: 'Practise inspecting a segment you did not build before you use it. Read the rows, never the name.',
      personal: 'Work through Connected Content and catalog failure handling — what the message does when the data is not there.',
      timing: 'Reread quiet hours, frequency capping and local-time delivery together. The interactions are where the errors live.',
      measure: 'Reread the section on declaring a winner, and on why open rate should never decide one.',
      commercial: 'Practise saying no to a senior stakeholder in a way that keeps the work moving. Write the sentence out.',
      compliance: 'This is the dimension to fix first. Subscription-group state, transactional classification and cap exemptions are the things that end careers rather than campaigns.',
    },

    steps: [

      /* ---- 1 ---- */
      {
        id: 'p1', type: 'choice', dim: 'commercial', weight: 8,
        shortTitle: 'What kind of campaign is this',
        prompt: 'First, get the shape right. What kind of campaign is this?',
        options: [
          { id: 'a', label: 'A demand-generation campaign — drive as many bookings as possible.', pts: 0,
            feedback: 'It is not. The inventory sells out without you. Framing it as demand generation leads to maximum reach, maximum discounting and a support queue of members who received an offer for rooms that were gone by the time they clicked.' },
          { id: 'b', label: 'An allocation campaign — the demand exists, so the job is ordering it fairly, protecting rate and steering people to properties that still have space.', pts: 3,
            feedback: 'Right, and every subsequent decision follows from it. When demand exceeds supply the marketing job inverts: you are not persuading, you are sequencing. That changes the audience, the send pattern, the creative and the definition of success.' },
          { id: 'c', label: 'A retention campaign — reward members for their loyalty.', pts: 1,
            feedback: 'The early-access window is a genuine membership benefit and that is a real secondary effect worth writing into the creative. It is not the primary job this week, and treating it as one would have you optimising for sentiment while the rooms sell.' },
          { id: 'd', label: 'A transactional campaign — members are entitled to the window, so it is a notification.', pts: 0,
            feedback: 'This is the beginning of the most serious error available in this case, and step 4 is where it becomes explicit. An offer to buy something is a marketing message, whatever entitlement sits behind it.' },
        ],
        nextTime: 'Ask whether demand exceeds supply before you design anything. Fill campaigns and allocation campaigns use identical tooling and have opposite objectives.',
      },

      /* ---- 2 ---- */
      {
        id: 'p2', type: 'choice', dim: 'audience', weight: 12,
        shortTitle: 'The pre-built segment',
        prompt: 'You open "Passover Early Access 2026". This is what it contains.',
        scene: `<p><strong>Passover Early Access 2026</strong> — created by Marketing, 3 weeks ago</p>
          <table>
            <tr><th>#</th><th>Filter</th></tr>
            <tr><td>1</td><td>Email Subscription Status <strong>is not</strong> <code>unsubscribed</code></td></tr>
            <tr><td>2</td><td><code>loyalty_tier</code> is any of Blue, Silver, Gold, Platinum</td></tr>
            <tr><td>3</td><td><code>country</code> is any of IL, DE, GB, ES, IT, FR, AT, GR, NL</td></tr>
          </table>
          <p class="bz-small">It is used by four other live campaigns.</p>`,
        options: [
          { id: 'a', label: 'Use it. It is the audience marketing intended and it has been reviewed.', pts: 0,
            feedback: 'Filter 1 is the trap and it is the most common one in the product. <em>"Is not unsubscribed"</em> includes everyone whose status is <strong>unknown</strong> — imported records, OTA-sourced addresses, people who never opted in to anything. In Israel that is a Spam Law problem and for the European tail it is a GDPR problem. The segment has been reviewed by someone who did not know this.' },
          { id: 'b', label: 'Use it, but add a campaign-level filter requiring the promotional subscription group, and flag the "is not unsubscribed" problem to marketing separately.', pts: 3,
            feedback: 'Exactly right, and the two halves matter equally. The campaign-level filter fixes <em>your</em> send without touching a segment four other campaigns depend on, and the flag fixes the underlying fault through the people who own it. Narrow at the campaign, not in the shared object.' },
          { id: 'c', label: 'Edit the segment to require the promotional subscription group, fixing it for everyone.', pts: 1,
            feedback: 'Your diagnosis is right and your method will hurt you. Four live campaigns depend on this segment; silently changing what it means will move their numbers overnight and nobody will connect the two. Correct instinct, wrong blast radius — raise it, do not unilaterally rewrite shared objects.' },
          { id: 'd', label: 'Build a fresh segment of your own from scratch.', pts: 2,
            feedback: 'Safe, correct in outcome, and it leaves the faulty segment in place for the next four campaigns. You have solved your problem and not the problem.' },
        ],
        model: `<p>Campaign-level filter for the Promotions subscription group; leave the shared segment alone;
          message marketing: "heads up — 'is not unsubscribed' also matches unknown status, so that segment is
          wider than it looks. Worth adding a subscription-group filter. I've filtered at campaign level for
          Passover so I'm not changing it under your live campaigns."</p>`,
        nextTime: 'Read the rows of any segment you did not build. And remember the three states: subscribed, unsubscribed, and unknown — "not unsubscribed" quietly includes the third.',
      },

      /* ---- 3 ---- */
      {
        id: 'p3', type: 'choice', dim: 'compliance', weight: 14,
        shortTitle: 'The transactional reclassification',
        prompt: 'To bypass the frequency caps, a colleague suggests marking the campaign as transactional. "It is an entitlement, members paid for early access."',
        options: [
          { id: 'a', label: 'Do it. Members paid for the club, so the early-access window genuinely is an entitlement.', pts: 0,
            feedback: 'This is the single most serious error available in this case. Transactional classification exists for messages a customer needs regardless of marketing consent — a booking confirmation, a receipt, a check-in detail. An offer to buy a room is a marketing message no matter what entitlement sits behind it. Reclassifying it to bypass caps and consent is a deliberate circumvention, and it is the kind of thing that gets found in an audit and is very hard to explain.' },
          { id: 'b', label: 'Refuse. It is a promotional message, and the classification is not a routing convenience.', pts: 3,
            feedback: 'Correct, and worth being unambiguous about internally. The distinction is not a Braze setting with two equally valid values — it is a legal characterisation of the message. Getting it wrong deliberately is materially worse than getting a campaign wrong.' },
          { id: 'c', label: 'Ask legal and proceed if they approve.', pts: 1,
            feedback: 'Escalating is not wrong, and you already know the answer — the message sells something. Sending this to legal on a Wednesday evening before a Sunday launch also burns two days you do not have on a question you can resolve yourself.' },
          { id: 'd', label: 'Mark it transactional only for club members, who have a contractual relationship.', pts: 0,
            feedback: 'Paying for a club is not consent to marketing, and a promotional message does not change category based on the recipient. This is the same error with extra steps.' },
        ],
        model: `<p>"It's promotional — it's asking people to buy something. Transactional is for confirmations and
          service messages, and misclassifying to get round caps is a compliance problem rather than a shortcut.
          I can get us the reach a different way." Then do that.</p>`,
        nextTime: 'The test is simple: would this message still need to be sent if the customer had opted out of all marketing? If no, it is not transactional. There is no grey area worth exploring here.',
      },

      /* ---- 4 ---- */
      {
        id: 'p4', type: 'choice', dim: 'compliance', weight: 10,
        shortTitle: 'The cap exemption',
        prompt: 'The CMO\'s instruction stands: ignore frequency capping, this is the biggest week of the year.',
        options: [
          { id: 'a', label: 'Ignore the caps. It is an explicit instruction from the CMO and it is the right commercial call for the biggest week.', pts: 0,
            feedback: 'Every marketer believes their campaign is the exception, which is precisely how a capping regime dies — not in one decision but in eleven of them. And the members most likely to be capped are your most-messaged, which is to say your most engaged and most valuable.' },
          { id: 'b', label: 'Check first how many people the caps would actually suppress, then decide with a number in hand.', pts: 3,
            feedback: 'The right move, and almost nobody makes it. The exemption argument is being had in the abstract. If the caps would suppress 400 people, there is no argument to have; if they would suppress 40,000, that is a real decision that deserves the CMO\'s attention with evidence attached.' },
          { id: 'c', label: 'Refuse outright — caps exist for a reason.', pts: 1,
            feedback: 'Right principle, and you are refusing a senior stakeholder without knowing whether the thing you are refusing matters. Get the number, then hold the line if it is warranted.' },
          { id: 'd', label: 'Exempt this campaign but reduce the audience to compensate.', pts: 0,
            feedback: 'Two changes that do not offset each other. You would over-message the people you keep, while cutting people you could have reached compliantly.' },
        ],
        model: `<p>"Let me check what the caps would actually suppress before we exempt — if it's small, this is
          moot; if it's big, you should see the number before we decide." Nine times in ten the number ends
          the discussion, and the tenth time it is a real decision made on evidence.</p>`,
        nextTime: 'Turn abstract pressure into a number. "How many people does this actually affect?" defuses more bad instructions than any argument about principle.',
      },

      /* ---- 5 ---- */
      {
        id: 'p5', type: 'choice', dim: 'timing', weight: 14,
        shortTitle: 'Local time versus a hard deadline',
        prompt: 'How do you schedule the send? The window closes Wednesday 09:00 Israel time for everyone.',
        scene: `<p>Note that this is a different situation from a ten-day soft-season offer, where sending
          at 09:00 in each recipient's own time zone is the right answer. Something here has changed.</p>`,
        options: [
          { id: 'a', label: 'Send in each recipient\'s local time zone at 09:00, so everyone gets it at a sensible hour.', pts: 0,
            feedback: 'This is the trap, and it is seductive because local-time delivery is normally best practice — it is the right answer in the November Eilat case. Here the <em>deadline is absolute</em>. Sending in local time means the European tail receives the window later in real terms and gets fewer usable hours of a 72-hour offer, on scarce inventory that is being consumed the whole time. Local-time delivery is right for evergreen offers and wrong for hard deadlines.' },
          { id: 'b', label: 'One absolute send time — Sunday 09:00 Israel time — for the entire audience regardless of where they are.', pts: 3,
            feedback: 'Correct. When the deadline is a single moment for everybody, the start must be too, or you have handed some members a shorter window than others on inventory that is finite. Everyone gets the same 72 hours. For the European tail 09:00 Israel is early morning — perfectly reasonable — and fairness beats convenience here.' },
          { id: 'c', label: 'Absolute send, but delayed for Europe to a more comfortable local hour.', pts: 1,
            feedback: 'Kind, and it gives the European audience a shorter shot at the same scarce rooms. On sold-out inventory an hour of delay is a real disadvantage, not a courtesy.' },
          { id: 'd', label: 'Use Intelligent Timing so each member gets it when they are most likely to engage.', pts: 0,
            feedback: 'Per-user optimised timing is a good tool for evergreen content and precisely wrong for a deadline: it spreads the send across a window, so some members enter a 72-hour race hours after others. It also falls back to a default for anyone without enough engagement history.' },
        ],
        model: `<p>One absolute send, Sunday 09:00 Israel time, for everyone. Put the deadline in the copy in
          local terms — "closes Wednesday 09:00 Israel time" — so nobody has to work it out.</p>`,
        nextTime: 'Ask one question: is the deadline the same moment for everyone? If yes, send absolute. If no, send local. This single question resolves most scheduling arguments.',
      },

      /* ---- 6 ---- */
      {
        id: 'p6', type: 'choice', dim: 'timing', weight: 10,
        shortTitle: 'The Shabbat conflict',
        prompt: 'The 72-hour window runs Sunday 09:00 to Wednesday 09:00. You planned a reminder on day two and a last-chance on day three. Where is the problem?',
        scene: `<p>Sunday 09:00 → Wednesday 09:00 is Sunday, Monday, Tuesday. In Israel that is Monday,
          Tuesday, Wednesday of the working week — no Friday, no Saturday.</p>`,
        options: [
          { id: 'a', label: 'There is no Shabbat conflict in this particular window, and the reminders are fine as planned.', pts: 3,
            feedback: 'Correct, and noticing that is the point. Sunday to Wednesday sits inside the Israeli working week — the conflict people assume is there is not, this time. The discipline is to check the calendar rather than apply a rule reflexively; a window starting Thursday would have been a genuine problem.' },
          { id: 'b', label: 'The last-chance message lands on Shabbat and must be moved.', pts: 0,
            feedback: 'Count the days. Sunday plus two is Tuesday. Nothing here lands on Friday evening or Saturday. Applying the rule without checking the dates is the same category of error as ignoring it.' },
          { id: 'c', label: 'The whole window should be moved to avoid the weekend.', pts: 0,
            feedback: 'It already avoids the weekend entirely. You would be moving a correctly scheduled campaign for a problem it does not have — and Sunday is the start of the Israeli working week, which is the best possible launch day.' },
          { id: 'd', label: 'Shabbat is irrelevant to email since people read it whenever they read it.', pts: 0,
            feedback: 'Wrong for a different reason. It matters — an observant member who cannot act for 25 hours of a 72-hour scarce-inventory window is genuinely disadvantaged. It just happens not to bite in this window.' },
        ],
        model: `<p>No conflict this time — count the days before applying the rule. Worth saying out loud to
          Ronen, because it is the thing that would have needed solving if the window had started Thursday,
          and next time it might.</p>`,
        nextTime: 'Check the calendar rather than reciting the rule. Reflexive constraints are as much a failure of attention as forgotten ones.',
      },

      /* ---- 7 ---- */
      {
        id: 'p7', type: 'choice', dim: 'personal', weight: 12,
        shortTitle: 'Live inventory in the message',
        prompt: 'You want the email to show which properties still have Seder-night availability. It is pulled live from the booking API with Connected Content.',
        options: [
          { id: 'a', label: '<code>{% connected_content https://api.example.com/availability %}</code> and render the results.', pts: 0,
            feedback: 'No caching, no timeout, no error path. At 40,000 sends you will hit that endpoint 40,000 times in a few minutes — you may take down your own booking API on the morning of the biggest launch of the year — and when it returns a 500 the section renders blank or broken with no fallback.' },
          { id: 'b', label: 'Connected Content with a cache, a timeout, and a static fallback block if the call fails or returns nothing.', pts: 3,
            feedback: 'Right on all three. The cache stops you attacking your own infrastructure with your own campaign, the timeout stops one slow response holding up the send, and the fallback means a failed call produces a sensible generic message rather than an empty box. Availability that is a few minutes stale is fine; a blank email is not.' },
          { id: 'c', label: 'Do not use live data — put availability in a catalog updated the night before.', pts: 2,
            feedback: 'Genuinely defensible and much safer, and on this inventory a night-old snapshot may show rooms that sold at 09:05. Reasonable trade-off, slightly wrong for scarcity this acute — but far better than the unprotected live call.' },
          { id: 'd', label: 'Link out to the live availability page instead of showing anything in the email.', pts: 2,
            feedback: 'Safe and it works, at the cost of the thing that makes this email convert — seeing that your preferred hotel still has Seder night is what drives the click. Acceptable fallback position, not the first choice.' },
        ],
        model: `<p>Connected Content with <code>:cache</code>, a timeout, and <code>{% if %}</code> handling around
          the response so a failure renders a static "browse availability" block instead of nothing.</p>`,
        nextTime: 'Every external call in a message needs three things: a cache, a timeout, and a defined behaviour on failure. Previews always succeed, which is exactly why this gets missed.',
      },

      /* ---- 8 ---- */
      {
        id: 'p8', type: 'choice', dim: 'personal', weight: 8,
        shortTitle: 'When the data is gone',
        prompt: 'The email is personalised to each member\'s preferred property. Some of those properties will be sold out for Seder night before the send completes.',
        options: [
          { id: 'a', label: 'Send it anyway — they can pick something else when they land on the site.', pts: 0,
            feedback: 'You have sent a member an email about a room that does not exist, during a 72-hour scarcity window, on the biggest week of the year. That is the complaint that reaches the hotel GM.' },
          { id: 'b', label: 'Fall back to the next-best available property in the same destination when the preferred one is gone.', pts: 3,
            feedback: 'The best answer. The member still gets a relevant, actionable message, and you have converted a dead end into an alternative — which is exactly what an allocation campaign should be doing, steering demand to where the space is.' },
          { id: 'c', label: 'Use <code>abort_message</code> to suppress the send when the preferred property is unavailable.', pts: 2,
            feedback: 'Right instinct and too blunt here. Aborting is correct when the message would be <em>wrong</em>; here the message can be made <em>right</em> by substitution. Save the abort for cases with no sensible alternative — and note it would silently cut members out of the early-access window they paid for.' },
          { id: 'd', label: 'Remove the personalization and send a generic email to everyone.', pts: 1,
            feedback: 'It removes the failure mode by removing the value. Personalised availability is the reason this email works.' },
        ],
        nextTime: 'When personalization data goes stale, prefer substitution to suppression, and suppression to sending something wrong. In that order.',
      },

      /* ---- 9 ---- */
      {
        id: 'p9', type: 'choice', dim: 'measure', weight: 10,
        shortTitle: 'The test design',
        prompt: 'There is time to test the subject line. The addressable audience is about 9,000. Marketing has drafted five variants.',
        options: [
          { id: 'a', label: 'Run all five. More variants means more learning.', pts: 0,
            feedback: 'Nine thousand split five ways is 1,800 per cell, against a booking rate of a few percent — perhaps 40 conversions per cell. You cannot distinguish a real 15% effect from noise at that size. It feels rigorous and produces a random winner you will then believe.' },
          { id: 'b', label: 'Two variants, one clear hypothesis — scarcity framing versus benefit framing.', pts: 3,
            feedback: 'Correct. Two cells of 4,500 gives you a chance of reading a meaningful difference, and a single hypothesis means the result tells you something you can reuse. Fewer, bigger, better-motivated cells beats a spread of guesses every time.' },
          { id: 'c', label: 'Do not test — the window is too short and the audience too small.', pts: 2,
            feedback: 'A defensible call, and better than a five-way split. But a two-cell test costs nothing here and the learning carries into Sukkot, so you are leaving something free on the table.' },
          { id: 'd', label: 'Run all five and let the platform auto-select the winner and send it to the rest.', pts: 0,
            feedback: 'Automated selection does not create statistical power — it just picks noise faster and with more confidence. And on a 72-hour window there is no meaningful "rest" to send the winner to.' },
        ],
        model: `<p>Two cells, one hypothesis, pre-declared metric. Scarcity ("Seder night, 40 rooms left")
          versus benefit ("your 72 hours start now"). Read it on bookings, not opens.</p>`,
        nextTime: 'Before designing a test, divide the audience by the number of cells and multiply by the expected conversion rate. If the answer per cell is under a few hundred conversions, reduce the cells.',
      },

      /* ---- 10 ---- */
      {
        id: 'p10', type: 'choice', dim: 'measure', weight: 10,
        shortTitle: 'Declaring a winner',
        prompt: 'Monday morning. Variant A has a 41% open rate and 180 bookings. Variant B has a 28% open rate and 260 bookings. The platform is set to auto-declare the winner on open rate.',
        options: [
          { id: 'a', label: 'A wins on opens — let it run.', pts: 0,
            feedback: 'You would roll out the variant that sells 30% less because more people looked at it. This is the vanity-metric trap in its purest form, and the setting that causes it was configured before you looked.' },
          { id: 'b', label: 'B is the winner on bookings. Change the winner criterion to the conversion event and stop the auto-selection from acting on opens.', pts: 3,
            feedback: 'Right, and act fast — the auto-declare is a live setting that will make the decision for you if you leave it. B sells more; A has the better subject line for getting attention and the worse one for setting expectations, which is the classic signature of a slightly clickbaity line.' },
          { id: 'c', label: 'Neither — the difference is not significant on this sample.', pts: 1,
            feedback: 'Statistically cautious and 180 versus 260 bookings is a large gap in the direction opposite to the open rate. More importantly, whatever you conclude, the auto-declare-on-opens setting is wrong and needs changing regardless.' },
          { id: 'd', label: 'A wins — higher opens mean better deliverability signals long term.', pts: 0,
            feedback: 'Inventing a mechanism to justify a metric. Open rate has been substantially corrupted by machine-opening since Apple Mail Privacy Protection, and it is not a proxy for revenue.' },
        ],
        model: `<p>B wins. Change the criterion to <code>booking_completed</code> and re-check every other live
          campaign for the same setting, because this one was not configured by accident — it is a default
          somebody accepted.</p>`,
        nextTime: 'Check what the winner criterion is set to before launch, not after. An auto-declare on opens will confidently ship the wrong variant while you are asleep.',
      },

      /* ---- 11 ---- */
      {
        id: 'p11', type: 'choice', dim: 'audience', weight: 10,
        shortTitle: 'The dormant list',
        prompt: 'Ronen finds another 180,000 addresses — people who have not opened anything in 18 months. "It is free to email them. Even 1% would be huge."',
        options: [
          { id: 'a', label: 'Include them. The marginal cost is near zero and the upside on a peak week is real.', pts: 0,
            feedback: 'The cost is not the send, it is the reputation. A large dormant cohort produces bounce and complaint rates that damage the sending domain — and that damage lands on <em>every</em> future email including pre-arrival and booking confirmations. You would be spending a shared asset that other people depend on.' },
          { id: 'b', label: 'Decline for this send, and propose a separate staged re-engagement programme, most-recent first, with bounce and complaint monitoring.', pts: 3,
            feedback: 'Correct on both halves. Not on the biggest revenue week, when a deliverability incident would be maximally expensive — and yes as a proper project, ramped by recency, watched at each stage, with a sunset rule for what does not respond.' },
          { id: 'c', label: 'Include the most recent 20,000 of them as a compromise.', pts: 1,
            feedback: 'The recency instinct is right and it is the correct shape for a warming programme. Doing it improvised, on the highest-stakes send of the year, with no monitoring plan, is the wrong week to start.' },
          { id: 'd', label: 'Decline permanently — an 18-month dormant list has no value.', pts: 1,
            feedback: 'Too absolute. Dormant lists do reactivate, carefully and slowly. You are throwing away a real if modest asset to avoid a risk that is manageable with a proper programme.' },
        ],
        model: `<p>"Not on this one — a dormant cohort that size risks the sending domain, and that hits our
          confirmations too. Let me run it properly in May: staged by recency, watching bounces and
          complaints at each step, sunset whatever does not respond."</p>`,
        nextTime: 'Deliverability is a shared asset with a long memory. The campaign that damages it is rarely the campaign that pays the price.',
      },

      /* ---- 12 ---- */
      {
        id: 'p12', type: 'multi', dim: 'timing', weight: 8,
        shortTitle: 'The morning of',
        prompt: 'Sunday 08:30, half an hour out. What is on your list?',
        options: [
          { id: 'a', label: 'Rate limit set so the booking engine is not hit by 40,000 people in four minutes.', pts: 3,
            feedback: 'Yes, and it is the operational risk that actually materialises on launches like this. Your own landing page failing under the traffic you paid to generate is the worst possible outcome, and it looks like a campaign failure in the reporting.' },
          { id: 'b', label: 'Confirm the campaign-level subscription-group filter is applied and the count matches expectation.', pts: 3,
            feedback: 'Yes. Verify the fix you made in step 2 is actually live — a filter configured in a draft and lost in a duplicate is a real and common failure.' },
          { id: 'c', label: 'Confirm the winner criterion is the conversion event and not opens.', pts: 2,
            feedback: 'Yes, before the send rather than after. Once auto-selection acts you are undoing a decision instead of preventing one.' },
          { id: 'd', label: 'Preview against a member with no preferred property and no name.', pts: 2,
            feedback: 'Yes — the substitution logic from step 8 and the greeting both need to survive a sparse profile.' },
          { id: 'e', label: 'Check the Connected Content endpoint responds, and that the fallback renders when it does not.', pts: 2,
            feedback: 'Yes. Test the failure path deliberately, because it is the one that has never run.' },
          { id: 'f', label: 'Confirm the deadline in the copy states the time zone explicitly.', pts: 2,
            feedback: 'Yes. "Closes Wednesday 09:00" means three different moments to a European audience. Say Israel time.' },
          { id: 'g', label: 'Increase the send volume by removing the frequency cap, to maximise reach at the last minute.', pts: -3,
            feedback: 'No. That decision was made properly in step 4 with a number attached; reversing it under launch-morning adrenaline is exactly how the wrong thing ships.' },
        ],
        nextTime: 'Build the launch-morning checklist the day before, when you are calm. Thirty minutes out is not when to be deciding what matters.',
      },

      /* ---- 13 ---- */
      {
        id: 'p13', type: 'text', dim: 'measure', weight: 12,
        shortTitle: 'Reporting a sold-out week',
        prompt: 'Wednesday. The window closed, Seder night is sold out across Eilat and the Dead Sea, and the campaign shows 1,940 bookings. How do you report it?',
        note: 'Careful. This is the report where it is easiest to claim credit you did not earn — and where doing so sets you up to be caught later.',
        placeholder: 'Passover early-access window — results…',
        rubric: [
          { keywords: ['sold out', 'would have', 'anyway', 'incremental', 'demand', 'scarce', 'scarcity', 'not caused', 'regardless'], pts: 3,
            note: 'Was honest that sold-out inventory would largely have sold without the campaign' },
          { keywords: ['direct', 'ota', 'commission', 'margin', 'channel', 'parity'], pts: 3,
            note: 'Identified where the campaign actually created value — shifting bookings to the direct channel ahead of the OTAs' },
          { keywords: ['member', 'club', 'friends', 'join', 'renew', 'loyalty'], pts: 2,
            note: 'Counted the membership effect — early access is a reason to hold and renew a paid club' },
          { keywords: ['pace', 'speed', 'faster', 'hours', 'days', 'window', 'lead'], pts: 2,
            note: 'Reported pace rather than only volume, which is the meaningful metric on finite inventory' },
        ],
        model: `<p>"Passover early access: 1,940 bookings inside the 72 hours, Seder night now sold out at Eilat and
          the Dead Sea. Honest read — most of that inventory would have sold anyway, so I would not claim the
          bookings as incremental revenue. Where this actually paid: 1,940 came through direct rather than the
          OTAs, which is the commission saved, and the window sold out roughly a day faster than last year, so
          we were holding rate for less time. Plus 310 club joins in three days, which is the benefit doing its
          job. For Sukkot I'd run the same shape and add a waitlist capture for the sold-out properties, because
          we turned away demand we did not measure."</p>
          <p>That report is more impressive than "we drove 1,940 bookings", precisely because it declines to
          claim the easy number.</p>`,
        nextTime: 'On sold-out inventory, the honest metrics are channel mix, pace and rate held — not volume. Anyone senior already knows the rooms would have sold; claiming them costs you credibility you will want later.',
      },

      /* ---- 14 ---- */
      {
        id: 'p14', type: 'text', dim: 'commercial', weight: 10,
        shortTitle: 'The two instructions you did not follow',
        prompt: 'Ronen asks why you did not do what he asked. Write the reply.',
        note: 'You declined the transactional reclassification and you did not blanket-exempt the frequency caps. He is not angry; he wants to understand.',
        placeholder: 'Two things I did differently, and why…',
        rubric: [
          { keywords: ['transactional', 'promotional', 'classif', 'consent', 'legal', 'compliance', 'audit'], pts: 3,
            note: 'Explained the transactional classification as a legal characterisation, not a setting' },
          { keywords: ['cap', 'number', 'checked', 'suppress', 'how many', 'small', 'few'], pts: 3,
            note: 'Showed you resolved the cap question with evidence rather than by refusing' },
          { keywords: ['result', 'sold out', 'worked', 'reach', 'delivered', 'did not cost', 'no cost'], pts: 2,
            note: 'Pointed out the outcome did not suffer — which is what makes the argument land' },
          { keywords: ['next', 'ask', 'flag', 'earlier', 'tell me', 'raise'], pts: 2,
            note: 'Kept the relationship forward-looking rather than defensive' },
        ],
        model: `<p>"Two things. The transactional flag — that's a legal classification rather than a delivery
          setting, and this message sells something, so marking it transactional would have been circumventing
          consent rather than routing around a cap. Not a risk worth taking on a message this visible. And the
          caps: I checked before deciding, and they'd only have suppressed about 600 people, so exempting
          everything would have bought us almost nothing. We sold Seder night out a day faster than last year,
          so I don't think the reach was the constraint. If you ever think caps are genuinely costing us, tell
          me and I'll pull the number — it's a two-minute check and then we're arguing about something real."</p>`,
        nextTime: 'When you decline an instruction, come back with the reason, the evidence and the outcome. Do it once and you will be trusted to make the call unprompted next time.',
      },
    ],

    debrief: `
      <p>This case was loaded on purpose. Four of the wrong answers are one click away in the real product,
      look efficient, and are what a stakeholder under pressure is actively asking for:</p>
      <ul>
        <li><strong>The pre-built segment</strong> whose "is not unsubscribed" filter silently includes
        everyone with unknown status;</li>
        <li><strong>The transactional reclassification</strong>, which is a compliance incident rather than
        a shortcut;</li>
        <li><strong>The blanket cap exemption</strong>, which is almost always argued in the abstract and
        almost always evaporates against a number;</li>
        <li><strong>Local-time delivery</strong>, which is best practice for an evergreen offer and exactly
        wrong for a hard deadline — the same setting, opposite answers, one case apart.</li>
      </ul>

      <p>That last one is the most useful thing here. There is no rule that says "always send in local
      time"; there is a question — <em>is the deadline the same moment for everyone?</em> — and the answer
      changes the setting. Most best practice in this job is like that. The people who apply rules get it
      right most of the time; the people who hold the underlying question get it right when it matters.</p>

      <p><strong>Carry these:</strong></p>
      <ol>
        <li>Read the rows of any segment you did not build. Subscribed, unsubscribed, <em>unknown</em>.</li>
        <li>Transactional is a legal characterisation, not a routing option.</li>
        <li>Turn stakeholder pressure into a number before you argue about it.</li>
        <li>Absolute send for absolute deadlines, local send for evergreen.</li>
        <li>On sold-out inventory, report channel mix and pace — never volume.</li>
      </ol>`,
  };

  window.BZCases = [caseEilat, caseClub, casePassover, caseIncident];
})();
