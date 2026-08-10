/* ==========================================================================
   Braze Sandbox — graded case-study simulator
   A brief arrives the way one really does. You work it end to end, making the
   same decisions you would make on the job, and every decision is scored.
   At the end you get a grade, a per-competency breakdown, and — the part that
   matters — what you got wrong and what to do differently next time.

   Step kinds:
     choice  one right answer (others carry partial or negative credit)
     multi   select-all-that-apply; wrong picks cost you
     text    free text, scored against a keyword rubric + a model answer
     build   go and actually build it in the sandbox; verified against state
   ========================================================================== */

const BZCaseSim = (function () {
  'use strict';
  const U = window.BZUI;

  /* ---------- competencies ------------------------------------------------- */

  const DIMS = {
    audience:   'Audience & targeting',
    personal:   'Personalization & QA',
    timing:     'Timing & delivery',
    measure:    'Measurement & incrementality',
    commercial: 'Commercial judgement',
    compliance: 'Consent & compliance',
  };

  /* ---------- helpers for authoring --------------------------------------- */

  const opt = (id, label, pts, feedback) => ({ id, label, pts, feedback });

  /* ---------- state -------------------------------------------------------- */

  let S = {
    caseId: null,
    idx: 0,          // -1 = brief screen, 0..n-1 = steps, n = report
    answers: {},     // stepId -> { value, score, max, verdict }
    started: null,
    revealed: {},    // stepId -> true once graded
  };

  const KEY = 'braze-sandbox-cases-v1';

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {}
  }
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) S = Object.assign(S, JSON.parse(raw));
    } catch (e) {}
  }

  function reset(caseId) {
    S = { caseId, idx: -1, answers: {}, started: new Date().toISOString(), revealed: {} };
    save();
  }

  const currentCase = () => (window.BZCases || []).find((c) => c.id === S.caseId);

  /* ---------- grading ------------------------------------------------------ */

  function gradeChoice(step, value) {
    const o = step.options.find((x) => x.id === value);
    if (!o) return { score: 0, max: step.weight, verdict: 'skipped', feedback: 'No answer given.' };
    const max = Math.max.apply(null, step.options.map((x) => x.pts));
    const score = (o.pts / max) * step.weight;
    return {
      score: Math.max(0, score),
      max: step.weight,
      verdict: o.pts === max ? 'correct' : o.pts > 0 ? 'partial' : 'wrong',
      feedback: o.feedback,
      chosen: o.label,
    };
  }

  function gradeMulti(step, values) {
    values = values || [];
    const maxPts = step.options.filter((o) => o.pts > 0).reduce((a, o) => a + o.pts, 0);
    let got = 0;
    const notes = [];
    step.options.forEach((o) => {
      const picked = values.includes(o.id);
      if (picked) { got += o.pts; notes.push({ ok: o.pts > 0, label: o.label, feedback: o.feedback }); }
      else if (o.pts > 0) notes.push({ ok: false, missed: true, label: o.label, feedback: o.feedback });
    });
    const score = Math.max(0, (got / maxPts) * step.weight);
    return {
      score, max: step.weight,
      verdict: got >= maxPts ? 'correct' : got > 0 ? 'partial' : 'wrong',
      notes,
    };
  }

  function gradeText(step, value) {
    const text = String(value || '').toLowerCase();
    if (text.trim().length < 15) {
      return { score: 0, max: step.weight, verdict: 'skipped',
        feedback: 'Too short to assess. A one-word answer is not an answer a stakeholder can act on.' };
    }
    let got = 0;
    const hits = [], misses = [];
    step.rubric.forEach((r) => {
      const found = r.keywords.some((k) => text.includes(k.toLowerCase()));
      if (found) { got += r.pts; hits.push(r.note); } else misses.push(r.note);
    });
    const maxPts = step.rubric.reduce((a, r) => a + r.pts, 0);
    return {
      score: (got / maxPts) * step.weight, max: step.weight,
      verdict: got >= maxPts * 0.8 ? 'correct' : got > 0 ? 'partial' : 'wrong',
      hits, misses,
    };
  }

  function gradeBuild(step) {
    let r;
    try { r = step.check(); } catch (e) { r = { ok: false, detail: 'Could not read the sandbox state: ' + e.message }; }
    const ratio = r.partial != null ? r.partial : (r.ok ? 1 : 0);
    return {
      score: ratio * step.weight, max: step.weight,
      verdict: ratio >= 1 ? 'correct' : ratio > 0 ? 'partial' : 'wrong',
      feedback: r.detail,
    };
  }

  function grade(step, value) {
    switch (step.type) {
      case 'choice': return gradeChoice(step, value);
      case 'multi':  return gradeMulti(step, value);
      case 'text':   return gradeText(step, value);
      case 'build':  return gradeBuild(step);
      default: return { score: 0, max: step.weight, verdict: 'skipped' };
    }
  }

  /* ---------- report ------------------------------------------------------- */

  function totals() {
    const c = currentCase();
    let earned = 0, max = 0;
    const byDim = {};
    c.steps.forEach((st) => {
      const a = S.answers[st.id];
      max += st.weight;
      byDim[st.dim] = byDim[st.dim] || { earned: 0, max: 0 };
      byDim[st.dim].max += st.weight;
      if (a) { earned += a.score; byDim[st.dim].earned += a.score; }
    });
    return { earned, max, pct: max ? (earned / max) * 100 : 0, byDim };
  }

  function gradeLetter(pct) {
    if (pct >= 90) return { letter: 'A', label: 'Ready for the job', tone: 'active' };
    if (pct >= 78) return { letter: 'B', label: 'Solid, with gaps to close', tone: 'active' };
    if (pct >= 64) return { letter: 'C', label: 'Workable, but you would need review', tone: 'paused' };
    if (pct >= 50) return { letter: 'D', label: 'Shaky — rework the fundamentals', tone: 'paused' };
    return { letter: 'E', label: 'Start again with the courses', tone: 'stopped' };
  }

  /* ---------- views -------------------------------------------------------- */

  function listView() {
    const cases = window.BZCases || [];
    return `
      <div class="bz-callout bz-mb24">
        <div class="bz-callout__t">How this works</div>
        <p>A brief arrives the way one really does — short, ambiguous, and from someone who does not use Braze.
        You work it end to end. Every decision is scored, and some of the tempting answers are deliberately wrong.</p>
        <p>Some steps send you into the sandbox to actually build the thing; those are checked against what you built,
        not against what you say you would build. At the end you get a grade, a per-competency breakdown, and a list of
        what to do differently.</p>
      </div>
      <div class="bz-courselist">
        ${cases.map((c) => {
          const done = S.caseId === c.id && S.idx >= c.steps.length;
          return `<div class="bz-coursecard" data-case="${c.id}">
            <div class="bz-coursecard__ico">${c.icon}</div>
            <div style="flex:1;min-width:0">
              <div class="bz-coursecard__t">${U.esc(c.title)}</div>
              <div class="bz-coursecard__d">${U.esc(c.summary)}</div>
              <div class="bz-mt8">
                <span class="bz-tag">${c.steps.length} graded decisions</span>
                <span class="bz-tag">${c.minutes} min</span>
                <span class="bz-tag">${U.esc(c.difficulty)}</span>
                ${done ? `<span class="bz-chip bz-chip--active">completed · ${Math.round(totals().pct)}%</span>` : ''}
              </div>
            </div>
            <div class="bz-muted">→</div>
          </div>`;
        }).join('')}
      </div>`;
  }

  function briefView(c) {
    return `
      <div class="bz-lesson" style="max-width:820px">
        <div class="bz-brief">
          <div class="bz-brief__head">
            <div class="bz-avatar" style="width:38px;height:38px;flex:0 0 38px;font-size:14px">${U.esc(c.from.initials)}</div>
            <div>
              <div style="font-weight:700">${U.esc(c.from.name)}</div>
              <div class="bz-small bz-muted">${U.esc(c.from.role)} · ${U.esc(c.from.channel)}</div>
            </div>
            <div class="bz-spacer"></div>
            <div class="bz-small bz-muted">${U.esc(c.from.time)}</div>
          </div>
          <div class="bz-brief__body">${c.brief}</div>
        </div>

        <h2>What you know already</h2>
        ${c.context}

        <div class="bz-callout bz-callout--warn">
          <div class="bz-callout__t">Before you start</div>
          <p>${c.warning}</p>
        </div>

        <div class="bz-row bz-mt24">
          <button class="bz-btn bz-btn--primary bz-btn--lg" data-cs="start">Start the case study</button>
          <a class="bz-btn" href="#/cases">Back</a>
        </div>
      </div>`;
  }

  function stepView(c, step) {
    const a = S.answers[step.id];
    const revealed = !!S.revealed[step.id];
    const n = S.idx + 1, total = c.steps.length;

    let input = '';
    if (step.type === 'choice') {
      input = `<div class="bz-radiocards">
        ${step.options.map((o) => `<label class="bz-radiocard ${a && a.value === o.id ? 'is-selected' : ''} ${revealed ? 'is-locked' : ''}">
          <input type="radio" name="cs-${step.id}" value="${o.id}" data-cs-choice="${step.id}" ${a && a.value === o.id ? 'checked' : ''} ${revealed ? 'disabled' : ''}>
          <div><div class="bz-radiocard__title">${U.esc(o.label)}</div>
          ${revealed ? `<div class="bz-radiocard__desc ${o.pts > 0 ? 'bz-fb-good' : 'bz-fb-bad'}">${o.feedback}</div>` : ''}</div>
        </label>`).join('')}
      </div>`;
    } else if (step.type === 'multi') {
      const vals = (a && a.value) || [];
      input = `<div class="bz-radiocards">
        ${step.options.map((o) => `<label class="bz-radiocard ${vals.includes(o.id) ? 'is-selected' : ''}">
          <input type="checkbox" value="${o.id}" data-cs-multi="${step.id}" ${vals.includes(o.id) ? 'checked' : ''} ${revealed ? 'disabled' : ''}>
          <div><div class="bz-radiocard__title">${U.esc(o.label)}</div>
          ${revealed ? `<div class="bz-radiocard__desc ${o.pts > 0 ? 'bz-fb-good' : 'bz-fb-bad'}">${o.feedback}</div>` : ''}</div>
        </label>`).join('')}
      </div>`;
    } else if (step.type === 'text') {
      input = `<textarea class="bz-textarea" data-cs-text="${step.id}" style="min-height:150px;font-family:var(--bz-font);font-size:14px"
        placeholder="${U.esc(step.placeholder || 'Write your answer as you would send it to the stakeholder…')}" ${revealed ? 'readonly' : ''}>${U.esc((a && a.value) || '')}</textarea>`;
    } else if (step.type === 'build') {
      input = `<div class="bz-buildbox">
        <div class="bz-buildbox__task">${step.task}</div>
        <div class="bz-row bz-mt16">
          <a class="bz-btn bz-btn--primary" href="${step.goto}" data-cs-goto="1">Open the builder →</a>
          <span class="bz-small bz-muted">Build it, then come back to this tab and check your work.</span>
        </div>
      </div>`;
    }

    const fb = revealed ? feedbackBlock(step, a) : '';

    return `
      <div class="bz-lesson" style="max-width:860px">
        <div class="bz-csprog">
          <div class="bz-csprog__bar"><div class="bz-csprog__fill" style="width:${(n / total) * 100}%"></div></div>
          <div class="bz-small bz-muted bz-nowrap">Decision ${n} of ${total} · ${U.esc(DIMS[step.dim])} · ${step.weight} pts</div>
        </div>

        ${step.scene ? `<div class="bz-scene">${step.scene}</div>` : ''}

        <h2 style="margin-top:14px">${step.prompt}</h2>
        ${step.note ? `<p class="bz-muted">${step.note}</p>` : ''}

        ${input}
        ${fb}

        <div class="bz-row bz-mt24">
          <button class="bz-btn" data-cs="prev" ${S.idx === 0 ? 'disabled' : ''}>← Back</button>
          <div class="bz-spacer"></div>
          ${revealed
            ? `<button class="bz-btn bz-btn--primary" data-cs="next">${S.idx === total - 1 ? 'See my results →' : 'Next decision →'}</button>`
            : step.type === 'build'
              ? `<button class="bz-btn bz-btn--primary" data-cs="check">Check my work</button>`
              : `<button class="bz-btn bz-btn--primary" data-cs="submit">Submit answer</button>`}
        </div>
      </div>`;
  }

  function feedbackBlock(step, a) {
    if (!a) return '';
    const tone = a.verdict === 'correct' ? 'good' : a.verdict === 'partial' ? 'part' : 'bad';
    const label = a.verdict === 'correct' ? 'Correct'
      : a.verdict === 'partial' ? 'Partly right'
      : a.verdict === 'skipped' ? 'No answer' : 'Not right';

    let detail = '';
    if (step.type === 'multi' && a.notes) {
      detail = `<ul>${a.notes.map((nn) => `<li>${nn.missed ? '⬜ <em>You missed this:</em> ' : nn.ok ? '✅ ' : '❌ '}<strong>${U.esc(nn.label)}</strong> — ${nn.feedback}</li>`).join('')}</ul>`;
    } else if (step.type === 'text') {
      detail = `${a.hits && a.hits.length ? `<p><strong>You covered:</strong></p><ul>${a.hits.map((h) => `<li>✅ ${h}</li>`).join('')}</ul>` : ''}
        ${a.misses && a.misses.length ? `<p><strong>You missed:</strong></p><ul>${a.misses.map((m) => `<li>⬜ ${m}</li>`).join('')}</ul>` : ''}`;
    } else if (a.feedback) {
      detail = `<p>${a.feedback}</p>`;
    }

    return `<div class="bz-fb bz-fb--${tone}">
      <div class="bz-fb__head">${label} — ${a.score.toFixed(1)} / ${a.max} pts</div>
      ${detail}
      ${step.model ? `<div class="bz-fb__model"><strong>What a strong answer looks like</strong>${step.model}</div>` : ''}
      ${step.nextTime ? `<div class="bz-fb__next"><strong>Next time</strong><p>${step.nextTime}</p></div>` : ''}
    </div>`;
  }

  function reportView(c) {
    const t = totals();
    const g = gradeLetter(t.pct);
    const wrong = c.steps.filter((st) => S.answers[st.id] && S.answers[st.id].verdict !== 'correct');
    const right = c.steps.filter((st) => S.answers[st.id] && S.answers[st.id].verdict === 'correct');

    const dims = Object.keys(DIMS).filter((d) => t.byDim[d] && t.byDim[d].max > 0);

    return `
      <div class="bz-lesson" style="max-width:900px">
        <div class="bz-scorecard">
          <div class="bz-scorecard__grade bz-scorecard__grade--${g.tone}">${g.letter}</div>
          <div>
            <div style="font-size:30px;font-weight:800;letter-spacing:-.8px">${t.pct.toFixed(0)}%</div>
            <div class="bz-muted">${t.earned.toFixed(1)} of ${t.max} points · ${U.esc(g.label)}</div>
          </div>
          <div class="bz-spacer"></div>
          <div>
            <button class="bz-btn" data-cs="restart">Retake</button>
            <a class="bz-btn" href="#/cases">All case studies</a>
          </div>
        </div>

        <h2>By competency</h2>
        <p class="bz-muted">This is the useful part. An overall score hides which half of the job you are weak at.</p>
        ${U.funnel(dims.map((d) => ({
          label: DIMS[d],
          value: Math.round((t.byDim[d].earned / t.byDim[d].max) * 100),
          pct: `${t.byDim[d].earned.toFixed(1)}/${t.byDim[d].max}`,
        })))}

        ${(() => {
          const weakest = dims.slice().sort((a, b) =>
            (t.byDim[a].earned / t.byDim[a].max) - (t.byDim[b].earned / t.byDim[b].max))[0];
          const strongest = dims.slice().sort((a, b) =>
            (t.byDim[b].earned / t.byDim[b].max) - (t.byDim[a].earned / t.byDim[a].max))[0];
          if (!weakest) return '';
          const wPct = (t.byDim[weakest].earned / t.byDim[weakest].max) * 100;
          return `<div class="bz-callout bz-mt16">
            <div class="bz-callout__t">Read of your performance</div>
            <p>Strongest: <strong>${DIMS[strongest]}</strong>. Weakest: <strong>${DIMS[weakest]}</strong> at ${wPct.toFixed(0)}%.</p>
            <p>${wPct < 60
              ? `That gap is the one to close first — it is also the one an interviewer will find, because it is where the follow-up questions go. ${c.remedial[weakest] || ''}`
              : 'No dimension is badly exposed. Push on depth rather than breadth from here.'}</p>
          </div>`;
        })()}

        <h2>What you got wrong</h2>
        ${wrong.length ? wrong.map((st) => {
          const a = S.answers[st.id];
          return `<div class="bz-task">
            <div class="bz-task__h">
              <div class="bz-task__n" style="background:${a.verdict === 'partial' ? 'var(--bz-amber)' : 'var(--bz-red)'}">${a.verdict === 'partial' ? '~' : '✕'}</div>
              <div class="bz-task__body">
                <div style="font-weight:700">${st.prompt}</div>
                <div class="bz-small bz-muted bz-mt8">${U.esc(DIMS[st.dim])} · scored ${a.score.toFixed(1)} of ${a.max}</div>
                ${a.chosen ? `<div class="bz-small bz-mt8">You chose: <em>${U.esc(a.chosen)}</em></div>` : ''}
                ${st.nextTime ? `<div class="bz-fb__next bz-mt8"><strong>Next time</strong><p>${st.nextTime}</p></div>` : ''}
              </div>
            </div>
          </div>`;
        }).join('') : '<p class="bz-muted">Nothing. Genuinely well done — that is rare on a first run.</p>'}

        <h2>What you got right</h2>
        <ul>${right.map((st) => `<li><strong>${st.shortTitle || st.prompt}</strong> — ${U.esc(DIMS[st.dim])}</li>`).join('') || '<li class="bz-muted">Nothing scored full marks this time.</li>'}</ul>

        <h2>How to do this better next time</h2>
        ${c.debrief}

        <div class="bz-callout bz-callout--tip bz-mt24">
          <div class="bz-callout__t">Do this now</div>
          <p>Retake it in two days without re-reading the feedback. The score you get cold is the one that reflects what you actually know.</p>
        </div>
      </div>`;
  }

  /* ---------- public view -------------------------------------------------- */

  function view(caseId) {
    if (!caseId) return listView();
    const c = (window.BZCases || []).find((x) => x.id === caseId);
    if (!c) return '<div class="bz-muted">No such case study.</div>';
    if (S.caseId !== caseId) reset(caseId);
    if (S.idx < 0) return briefView(c);
    if (S.idx >= c.steps.length) return reportView(c);
    return stepView(c, c.steps[S.idx]);
  }

  /* ---------- events ------------------------------------------------------- */

  function bind(root, caseId, rerender) {
    root.addEventListener('change', (e) => {
      const ch = e.target.closest('[data-cs-choice]');
      if (ch) {
        const id = ch.dataset.csChoice;
        S.answers[id] = Object.assign(S.answers[id] || {}, { value: ch.value });
        save(); return;
      }
      const mu = e.target.closest('[data-cs-multi]');
      if (mu) {
        const id = mu.dataset.csMulti;
        const vals = Array.from(root.querySelectorAll(`[data-cs-multi="${id}"]:checked`)).map((x) => x.value);
        S.answers[id] = Object.assign(S.answers[id] || {}, { value: vals });
        save(); return;
      }
    });

    root.addEventListener('input', (e) => {
      const tx = e.target.closest('[data-cs-text]');
      if (tx) {
        const id = tx.dataset.csText;
        S.answers[id] = Object.assign(S.answers[id] || {}, { value: tx.value });
        save();
      }
    });

    root.addEventListener('click', (e) => {
      const card = e.target.closest('[data-case]');
      if (card) { location.hash = '#/cases/' + card.dataset.case; return; }

      const btn = e.target.closest('[data-cs]');
      if (!btn) return;
      const c = currentCase();
      const step = c && S.idx >= 0 && S.idx < c.steps.length ? c.steps[S.idx] : null;

      switch (btn.dataset.cs) {
        case 'start':   S.idx = 0; save(); rerender(); break;
        case 'prev':    S.idx = Math.max(0, S.idx - 1); save(); rerender(); break;
        case 'next':    S.idx += 1; save(); rerender(); window.scrollTo(0, 0); break;
        case 'restart': reset(c.id); rerender(); break;
        case 'submit':
        case 'check': {
          if (!step) break;
          const a = S.answers[step.id] || {};
          if (step.type !== 'build' && (a.value === undefined || a.value === null ||
              (Array.isArray(a.value) && !a.value.length) || a.value === '')) {
            U.toast('Answer it first — guessing is part of the exercise.');
            break;
          }
          const g = grade(step, a.value);
          S.answers[step.id] = Object.assign(a, g);
          S.revealed[step.id] = true;
          save(); rerender();
          break;
        }
      }
    });
  }

  load();

  return { view, bind, DIMS, totals, reset, get state() { return S; } };
})();

window.BZCaseSim = BZCaseSim;
