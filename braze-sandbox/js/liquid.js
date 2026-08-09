/* ==========================================================================
   Braze Sandbox — Liquid engine
   A working subset of Shopify Liquid plus Braze's personalization dialect:
     {{${first_name}}}                      standard attribute
     {{custom_attribute.${loyalty_tier}}}   custom attribute
     {{event_properties.${hotel_name}}}     triggering-event property
     {{canvas_entry_properties.${x}}}       Canvas entry property
     {{api_trigger_properties.${x}}}        API-triggered campaign property
     {{content_blocks.${name}}}             Content Block inclusion
     {% catalog_items hotels <id> %}        catalog lookup -> `items`
     {% connected_content <url> :save x %}  external fetch (stubbed here)
     {% abort_message('...') %}             cancel the send
   Deliberately strict about the mistakes that actually bite in production:
   a missing attribute renders empty, and the linter tells you where.
   ========================================================================== */

const BZLiquid = (function () {
  'use strict';

  /* ---------- helpers --------------------------------------------------- */

  const isBlank = (v) => v === null || v === undefined || v === '' ||
    (Array.isArray(v) && v.length === 0);

  function toStr(v) {
    if (v === null || v === undefined) return '';
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    if (Array.isArray(v)) return v.join('');
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  }

  function toNum(v) {
    if (typeof v === 'number') return v;
    if (typeof v === 'string') { const n = parseFloat(v); return isNaN(n) ? 0 : n; }
    if (typeof v === 'boolean') return v ? 1 : 0;
    return 0;
  }

  /* Liquid truthiness: only nil and false are falsy. Empty string is TRUE. */
  const truthy = (v) => v !== null && v !== undefined && v !== false;

  function escapeHtml(s) {
    return toStr(s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /* ---------- date formatting (strftime subset) ------------------------- */

  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const pad = (n, w) => String(n).padStart(w || 2, '0');

  function parseDate(v) {
    if (v instanceof Date) return v;
    if (typeof v === 'number') return new Date(v * (v < 1e11 ? 1000 : 1));
    if (typeof v === 'string') {
      if (v === 'now' || v === 'today') return new Date();
      const d = new Date(v);
      if (!isNaN(d)) return d;
      const n = parseFloat(v);
      if (!isNaN(n)) return new Date(n * (n < 1e11 ? 1000 : 1));
    }
    return null;
  }

  function strftime(date, fmt) {
    const d = parseDate(date);
    if (!d) return '';
    const map = {
      '%A': DAYS[d.getDay()],
      '%a': DAYS[d.getDay()].slice(0, 3),
      '%B': MONTHS[d.getMonth()],
      '%b': MONTHS[d.getMonth()].slice(0, 3),
      '%d': pad(d.getDate()),
      '%-d': String(d.getDate()),
      '%e': String(d.getDate()).padStart(2, ' '),
      '%m': pad(d.getMonth() + 1),
      '%-m': String(d.getMonth() + 1),
      '%Y': String(d.getFullYear()),
      '%y': pad(d.getFullYear() % 100),
      '%H': pad(d.getHours()),
      '%-H': String(d.getHours()),
      '%I': pad(((d.getHours() + 11) % 12) + 1),
      '%M': pad(d.getMinutes()),
      '%S': pad(d.getSeconds()),
      '%p': d.getHours() < 12 ? 'AM' : 'PM',
      '%j': pad(Math.ceil((d - new Date(d.getFullYear(), 0, 0)) / 86400000), 3),
      '%s': String(Math.floor(d.getTime() / 1000)),
      '%%': '%',
    };
    return String(fmt).replace(/%-?[A-Za-z%]/g, (m) => (m in map ? map[m] : m));
  }

  /* ---------- filters ---------------------------------------------------- */

  const FILTERS = {
    default:  (v, d) => (isBlank(v) || v === false ? d : v),
    upcase:   (v) => toStr(v).toUpperCase(),
    downcase: (v) => toStr(v).toLowerCase(),
    capitalize: (v) => { const s = toStr(v); return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(); },
    strip:    (v) => toStr(v).trim(),
    lstrip:   (v) => toStr(v).replace(/^\s+/, ''),
    rstrip:   (v) => toStr(v).replace(/\s+$/, ''),
    strip_html: (v) => toStr(v).replace(/<[^>]*>/g, ''),
    strip_newlines: (v) => toStr(v).replace(/\r?\n/g, ''),
    newline_to_br: (v) => toStr(v).replace(/\r?\n/g, '<br>'),
    escape:   (v) => escapeHtml(v),
    url_encode: (v) => encodeURIComponent(toStr(v)),
    url_decode: (v) => { try { return decodeURIComponent(toStr(v)); } catch (e) { return toStr(v); } },
    size:     (v) => (Array.isArray(v) || typeof v === 'string' ? v.length : (v && typeof v === 'object' ? Object.keys(v).length : 0)),
    truncate: (v, n, ell) => { const s = toStr(v); n = toNum(n) || 50; ell = ell === undefined ? '...' : toStr(ell); return s.length <= n ? s : s.slice(0, Math.max(0, n - ell.length)) + ell; },
    truncatewords: (v, n, ell) => { const w = toStr(v).split(/\s+/); n = toNum(n) || 15; ell = ell === undefined ? '...' : toStr(ell); return w.length <= n ? toStr(v) : w.slice(0, n).join(' ') + ell; },
    replace:  (v, a, b) => toStr(v).split(toStr(a)).join(toStr(b === undefined ? '' : b)),
    replace_first: (v, a, b) => toStr(v).replace(toStr(a), toStr(b === undefined ? '' : b)),
    remove:   (v, a) => toStr(v).split(toStr(a)).join(''),
    remove_first: (v, a) => toStr(v).replace(toStr(a), ''),
    append:   (v, a) => toStr(v) + toStr(a),
    prepend:  (v, a) => toStr(a) + toStr(v),
    split:    (v, a) => toStr(v).split(toStr(a)),
    join:     (v, a) => (Array.isArray(v) ? v : [v]).map(toStr).join(a === undefined ? ' ' : toStr(a)),
    first:    (v) => (Array.isArray(v) ? v[0] : toStr(v).charAt(0)),
    last:     (v) => (Array.isArray(v) ? v[v.length - 1] : toStr(v).slice(-1)),
    reverse:  (v) => (Array.isArray(v) ? v.slice().reverse() : toStr(v).split('').reverse().join('')),
    sort:     (v, k) => (Array.isArray(v) ? v.slice().sort((a, b) => { const x = k ? a[k] : a, y = k ? b[k] : b; return x > y ? 1 : x < y ? -1 : 0; }) : v),
    uniq:     (v) => (Array.isArray(v) ? Array.from(new Set(v)) : v),
    map:      (v, k) => (Array.isArray(v) ? v.map((o) => (o == null ? null : o[k])) : v),
    where:    (v, k, val) => (Array.isArray(v) ? v.filter((o) => (val === undefined ? truthy(o && o[k]) : o && o[k] === val)) : v),
    slice:    (v, a, b) => { const s = Array.isArray(v) ? v : toStr(v); const st = toNum(a); return b === undefined ? s.slice(st, st + 1) : s.slice(st, st + toNum(b)); },
    plus:     (v, a) => toNum(v) + toNum(a),
    minus:    (v, a) => toNum(v) - toNum(a),
    times:    (v, a) => toNum(v) * toNum(a),
    /* floatHint is supplied by the evaluator when the divisor literal was
       written with a decimal point. Liquid truncates only for integer ÷ integer. */
    divided_by: (v, a, floatHint) => {
      const d = toNum(a); if (d === 0) return 0;
      const r = toNum(v) / d;
      return (!floatHint && Number.isInteger(toNum(v)) && Number.isInteger(d)) ? Math.floor(r) : r;
    },
    modulo:   (v, a) => { const d = toNum(a); return d === 0 ? 0 : toNum(v) % d; },
    round:    (v, n) => { const p = Math.pow(10, toNum(n) || 0); return Math.round(toNum(v) * p) / p; },
    ceil:     (v) => Math.ceil(toNum(v)),
    floor:    (v) => Math.floor(toNum(v)),
    abs:      (v) => Math.abs(toNum(v)),
    at_least: (v, a) => Math.max(toNum(v), toNum(a)),
    at_most:  (v, a) => Math.min(toNum(v), toNum(a)),
    number_with_delimiter: (v, d) => toNum(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, d === undefined ? ',' : toStr(d)),
    date:     (v, f) => strftime(v, f === undefined ? '%Y-%m-%d' : f),
    json:     (v) => JSON.stringify(v),
    md5:      (v) => 'md5(' + toStr(v) + ')',        // stubbed — shape only
    sha1:     (v) => 'sha1(' + toStr(v) + ')',
    /* Braze-specific */
    time_zone: (v, tz, f) => strftime(v, f || '%Y-%m-%d %H:%M'),
    property_accessor: (v, k) => (v && typeof v === 'object' ? v[k] : null),
  };

  /* ---------- lexer ------------------------------------------------------ */

  /* A regex cannot do this correctly. Braze tags nest `${...}` inside `{{...}}`,
     so `{{${first_name}}}` ends with three closing braces — a lazy /\}\}/ stops
     at the first pair and silently truncates the path, and a greedy one
     swallows the rest of the document. Scan instead, tracking `${` depth.     */
  function tokenize(src) {
    src = String(src || '');
    const out = [];
    let i = 0, textStart = 0;

    const pushText = (end) => { if (end > textStart) out.push({ type: 'text', value: src.slice(textStart, end) }); };

    while (i < src.length) {
      const isOutput = src[i] === '{' && src[i + 1] === '{';
      const isTag    = src[i] === '{' && src[i + 1] === '%';
      if (!isOutput && !isTag) { i++; continue; }

      const close = isOutput ? '}}' : '%}';
      let j = i + 2, depth = 0, found = false;
      while (j < src.length) {
        if (src[j] === '$' && src[j + 1] === '{') { depth++; j += 2; continue; }
        if (depth > 0 && src[j] === '}') { depth--; j++; continue; }
        if (depth === 0 && src.startsWith(close, j)) { found = true; break; }
        j++;
      }
      if (!found) { i++; continue; }              // unterminated — leave as text

      pushText(i);
      const raw = src.slice(i, j + 2);
      const body = raw.slice(2, -2).replace(/^-/, '').replace(/-$/, '').trim();
      if (isOutput) {
        out.push({ type: 'output', body, raw });
      } else {
        const m = body.match(/^(\w+)\s*([\s\S]*)$/);
        out.push({ type: 'tag', name: m ? m[1] : body, args: m ? m[2].trim() : '', body, raw });
      }
      i = textStart = j + 2;
    }
    pushText(src.length);
    return out;
  }

  /* ---------- expression parsing ----------------------------------------- */

  /* `${foo}` is Braze sugar; unwrap it so `custom_attribute.${x}` -> `custom_attribute.x` */
  const unwrapDollar = (s) => s.replace(/\$\{\s*([^}]+?)\s*\}/g, '$1');

  function splitTopLevel(str, sep) {
    /* split on `sep` (a bare word like "|" or ",") outside quotes/brackets */
    const parts = [];
    let cur = '', q = null, depth = 0;
    for (let i = 0; i < str.length; i++) {
      const c = str[i];
      if (q) { cur += c; if (c === q && str[i - 1] !== '\\') q = null; continue; }
      if (c === '"' || c === "'") { q = c; cur += c; continue; }
      if (c === '(' || c === '[') depth++;
      if (c === ')' || c === ']') depth--;
      if (depth === 0 && c === sep) { parts.push(cur); cur = ''; continue; }
      cur += c;
    }
    parts.push(cur);
    return parts;
  }

  function parseLiteral(tok) {
    tok = tok.trim();
    if (tok === '') return { kind: 'lit', value: null };
    if (/^'([\s\S]*)'$/.test(tok)) return { kind: 'lit', value: tok.slice(1, -1) };
    if (/^"([\s\S]*)"$/.test(tok)) return { kind: 'lit', value: tok.slice(1, -1) };
    /* isFloat is carried separately: JS cannot tell 100.0 from 100, but Liquid
       must — `| divided_by: 100` truncates, `| divided_by: 100.0` does not.   */
    if (/^-?\d+\.\d+$/.test(tok)) return { kind: 'lit', value: parseFloat(tok), isFloat: true };
    if (/^-?\d+$/.test(tok))      return { kind: 'lit', value: parseInt(tok, 10) };
    if (tok === 'true')  return { kind: 'lit', value: true };
    if (tok === 'false') return { kind: 'lit', value: false };
    if (tok === 'nil' || tok === 'null') return { kind: 'lit', value: null };
    if (tok === 'blank' || tok === 'empty') return { kind: 'lit', value: '' };
    return { kind: 'var', path: tok };
  }

  /* value + filter chain, e.g. `custom_attribute.points | number_with_delimiter` */
  function parseValue(src) {
    const segs = splitTopLevel(unwrapDollar(src), '|');
    const head = parseLiteral(segs[0]);
    const filters = segs.slice(1).map((f) => {
      const t = f.trim();
      const ci = t.indexOf(':');
      if (ci === -1) return { name: t, args: [] };
      return {
        name: t.slice(0, ci).trim(),
        args: splitTopLevel(t.slice(ci + 1), ',').map((a) => parseLiteral(a)),
      };
    });
    return { head, filters };
  }

  const CMP = ['==', '!=', '>=', '<=', '>', '<', 'contains', 'starts_with', 'ends_with'];

  function parseCondition(src) {
    src = unwrapDollar(src).trim();
    const ors = splitLogical(src, 'or');
    if (ors.length > 1) return { kind: 'or', parts: ors.map(parseCondition) };
    const ands = splitLogical(src, 'and');
    if (ands.length > 1) return { kind: 'and', parts: ands.map(parseCondition) };
    for (const op of CMP) {
      const idx = findOp(src, op);
      if (idx > -1) {
        return { kind: 'cmp', op, left: parseValue(src.slice(0, idx)), right: parseValue(src.slice(idx + op.length)) };
      }
    }
    return { kind: 'truthy', value: parseValue(src) };
  }

  function splitLogical(str, word) {
    const parts = []; let cur = '', q = null;
    const w = ' ' + word + ' ';
    for (let i = 0; i < str.length; i++) {
      const c = str[i];
      if (q) { cur += c; if (c === q) q = null; continue; }
      if (c === '"' || c === "'") { q = c; cur += c; continue; }
      if (str.substr(i, w.length) === w) { parts.push(cur); cur = ''; i += w.length - 1; continue; }
      cur += c;
    }
    parts.push(cur);
    return parts;
  }

  function findOp(str, op) {
    let q = null;
    for (let i = 0; i < str.length; i++) {
      const c = str[i];
      if (q) { if (c === q) q = null; continue; }
      if (c === '"' || c === "'") { q = c; continue; }
      if (str.substr(i, op.length) === op) {
        /* word operators need whitespace boundaries */
        if (/^[a-z_]+$/.test(op)) {
          const before = str[i - 1], after = str[i + op.length];
          if (before !== ' ' || (after !== ' ' && after !== undefined)) continue;
        } else if (op === '>' || op === '<') {
          if (str[i + 1] === '=') continue;
        }
        return i;
      }
    }
    return -1;
  }

  /* ---------- parser (token stream -> AST) -------------------------------- */

  const BLOCK_END = { if: 'endif', unless: 'endunless', for: 'endfor', capture: 'endcapture', case: 'endcase', tablerow: 'endtablerow', raw: 'endraw', comment: 'endcomment' };

  function parse(tokens) {
    let pos = 0;
    function parseUntil(stopNames) {
      const nodes = [];
      while (pos < tokens.length) {
        const t = tokens[pos];
        if (t.type === 'tag' && stopNames.includes(t.name)) return nodes;
        pos++;
        if (t.type === 'text')   { nodes.push({ type: 'text', value: t.value }); continue; }
        if (t.type === 'output') { nodes.push({ type: 'output', expr: parseValue(t.body), raw: t.raw }); continue; }
        nodes.push(parseTag(t, parseUntil));
      }
      return nodes;
    }

    function parseTag(t, until) {
      switch (t.name) {
        case 'if': case 'unless': {
          const branches = [{ cond: parseCondition(t.args), body: until(['elsif', 'else', BLOCK_END[t.name]]) }];
          while (pos < tokens.length && tokens[pos].name === 'elsif') {
            const e = tokens[pos++];
            branches.push({ cond: parseCondition(e.args), body: until(['elsif', 'else', BLOCK_END[t.name]]) });
          }
          let elseBody = null;
          if (pos < tokens.length && tokens[pos].name === 'else') {
            pos++; elseBody = until([BLOCK_END[t.name]]);
          }
          pos++; /* consume endif/endunless */
          return { type: t.name === 'if' ? 'if' : 'unless', branches, elseBody, raw: t.raw };
        }
        case 'case': {
          const subject = parseValue(t.args);
          until(['when', 'else', 'endcase']);           // discard whitespace before first when
          const whens = [];
          while (pos < tokens.length && tokens[pos].name === 'when') {
            const w = tokens[pos++];
            whens.push({ match: splitTopLevel(unwrapDollar(w.args), ',').map(parseLiteral), body: until(['when', 'else', 'endcase']) });
          }
          let elseBody = null;
          if (pos < tokens.length && tokens[pos].name === 'else') { pos++; elseBody = until(['endcase']); }
          pos++;
          return { type: 'case', subject, whens, elseBody, raw: t.raw };
        }
        case 'for': {
          const m = unwrapDollar(t.args).match(/^(\w+)\s+in\s+([\s\S]+)$/);
          const body = until(['else', 'endfor']);
          let elseBody = null;
          if (pos < tokens.length && tokens[pos].name === 'else') { pos++; elseBody = until(['endfor']); }
          pos++;
          if (!m) return { type: 'error', message: '{% for %} needs the form `for item in collection`' };
          const rest = m[2].trim();
          const range = rest.match(/^\(\s*([\s\S]+?)\s*\.\.\s*([\s\S]+?)\s*\)/);
          const opts = {};
          rest.replace(/\blimit\s*:\s*(\d+)/, (_, n) => (opts.limit = +n));
          rest.replace(/\boffset\s*:\s*(\d+)/, (_, n) => (opts.offset = +n));
          if (/\breversed\b/.test(rest)) opts.reversed = true;
          return {
            type: 'for', varName: m[1], body, elseBody, opts,
            range: range ? { from: parseLiteral(range[1]), to: parseLiteral(range[2]) } : null,
            collection: range ? null : parseValue(rest.replace(/\b(limit|offset)\s*:\s*\d+/g, '').replace(/\breversed\b/g, '').trim()),
            raw: t.raw,
          };
        }
        case 'capture': {
          const body = until(['endcapture']); pos++;
          return { type: 'capture', name: unwrapDollar(t.args).trim(), body, raw: t.raw };
        }
        case 'raw': {
          const body = until(['endraw']); pos++;
          return { type: 'text', value: body.map((n) => (n.type === 'text' ? n.value : n.raw || '')).join('') };
        }
        case 'comment': { until(['endcomment']); pos++; return { type: 'text', value: '' }; }
        case 'assign': {
          const m = unwrapDollar(t.args).match(/^(\w+)\s*=\s*([\s\S]+)$/);
          return m ? { type: 'assign', name: m[1], expr: parseValue(m[2]), raw: t.raw }
                   : { type: 'error', message: '{% assign %} needs the form `assign name = value`' };
        }
        case 'increment': return { type: 'increment', name: t.args.trim(), by: 1, raw: t.raw };
        case 'decrement': return { type: 'increment', name: t.args.trim(), by: -1, raw: t.raw };
        case 'break':    return { type: 'break' };
        case 'continue': return { type: 'continue' };
        case 'abort_message': {
          const m = t.body.match(/abort_message\s*\(\s*(['"])([\s\S]*?)\1\s*\)/);
          return { type: 'abort', message: m ? m[2] : 'Message aborted', raw: t.raw };
        }
        case 'catalog_items': {
          /* Braze writes the id as a full output tag: {% catalog_items hotels {{…}} %} */
          const parts = unwrapDollar(t.args).trim().split(/\s+/)
            .map((p) => p.replace(/^\{\{\s*/, '').replace(/\s*\}\}$/, ''))
            .filter(Boolean);
          return { type: 'catalog_items', catalog: parts[0], ids: parts.slice(1).map((p) => parseValue(p)), raw: t.raw };
        }
        case 'connected_content': return { type: 'connected_content', args: t.args, raw: t.raw };
        case 'content_blocks':    return { type: 'content_block', name: unwrapDollar(t.args).trim(), raw: t.raw };
        default:
          return { type: 'unknown', name: t.name, raw: t.raw };
      }
    }

    return parseUntil([]);
  }

  /* ---------- scope ------------------------------------------------------- */

  function lookup(scope, path) {
    if (!path) return null;
    /* `content_blocks.aurelia_header` is resolved by the renderer, not here */
    const parts = String(path).trim().split(/\.|\[(.*?)\]/).filter((p) => p !== undefined && p !== '');
    let cur = scope;
    for (let raw of parts) {
      if (cur === null || cur === undefined) return null;
      let key = raw.replace(/^['"]|['"]$/g, '');
      if (Array.isArray(cur) && /^\d+$/.test(key)) { cur = cur[+key]; continue; }
      if (Array.isArray(cur) && key === 'size')    { cur = cur.length; continue; }
      if (typeof cur === 'string' && key === 'size') { cur = cur.length; continue; }
      if (typeof cur !== 'object') return null;
      cur = cur[key];
    }
    return cur === undefined ? null : cur;
  }

  /* ---------- renderer ---------------------------------------------------- */

  function render(template, context, opts) {
    opts = opts || {};
    const contentBlocks = opts.contentBlocks || {};
    const catalogs = opts.catalogs || {};
    const warnings = [];
    const errors = [];
    let aborted = null;
    let depth = 0;

    function evalValue(v, scope) {
      let out;
      if (v.head.kind === 'lit') out = v.head.value;
      else {
        out = lookup(scope, v.head.path);
        if (out === null && !/^(items|forloop)\b/.test(v.head.path)) {
          const hasDefault = v.filters.some((f) => f.name === 'default');
          if (!hasDefault) warnings.push(v.head.path);
        }
      }
      for (const f of v.filters) {
        const fn = FILTERS[f.name];
        if (!fn) { errors.push('Unknown filter: `' + f.name + '`'); continue; }
        try {
          const args = f.args.map((a) => (a.kind === 'lit' ? a.value : lookup(scope, a.path)));
          if (f.name === 'divided_by' && f.args[0] && f.args[0].isFloat) args.push(true);
          out = fn.apply(null, [out].concat(args));
        } catch (e) {
          errors.push('Filter `' + f.name + '` failed: ' + e.message);
        }
      }
      return out;
    }

    function evalCond(c, scope) {
      switch (c.kind) {
        case 'or':  return c.parts.some((p) => evalCond(p, scope));
        case 'and': return c.parts.every((p) => evalCond(p, scope));
        case 'truthy': return truthy(evalValue(c.value, scope));
        case 'cmp': {
          const l = evalValue(c.left, scope), r = evalValue(c.right, scope);
          switch (c.op) {
            case '==': return looseEq(l, r);
            case '!=': return !looseEq(l, r);
            case '>':  return toNum(l) >  toNum(r);
            case '<':  return toNum(l) <  toNum(r);
            case '>=': return toNum(l) >= toNum(r);
            case '<=': return toNum(l) <= toNum(r);
            case 'contains': return Array.isArray(l) ? l.some((x) => looseEq(x, r)) : toStr(l).includes(toStr(r));
            case 'starts_with': return toStr(l).startsWith(toStr(r));
            case 'ends_with':   return toStr(l).endsWith(toStr(r));
          }
          return false;
        }
      }
      return false;
    }

    function looseEq(a, b) {
      if (a === null || a === undefined) return b === null || b === undefined || b === '';
      if (b === null || b === undefined) return a === '' ;
      if (typeof a === 'boolean' || typeof b === 'boolean') {
        const bv = (x) => (typeof x === 'boolean' ? x : x === 'true' ? true : x === 'false' ? false : x);
        return bv(a) === bv(b);
      }
      if (typeof a === 'number' || typeof b === 'number') return toNum(a) === toNum(b);
      return toStr(a) === toStr(b);
    }

    function walk(nodes, scope) {
      let out = '';
      for (const n of nodes) {
        if (aborted) return out;
        switch (n.type) {
          case 'text': out += n.value; break;

          case 'output': {
            /* content_blocks.${name} is an output-position include in Braze */
            if (n.expr.head.kind === 'var' && n.expr.head.path.startsWith('content_blocks.')) {
              out += includeBlock(n.expr.head.path.slice('content_blocks.'.length), scope);
              break;
            }
            out += toStr(evalValue(n.expr, scope));
            break;
          }

          case 'if': {
            let done = false;
            for (const br of n.branches) {
              if (evalCond(br.cond, scope)) { out += walk(br.body, scope); done = true; break; }
            }
            if (!done && n.elseBody) out += walk(n.elseBody, scope);
            break;
          }

          case 'unless': {
            const first = n.branches[0];
            if (!evalCond(first.cond, scope)) out += walk(first.body, scope);
            else if (n.elseBody) out += walk(n.elseBody, scope);
            break;
          }

          case 'case': {
            const subject = evalValue(n.subject, scope);
            let hit = false;
            for (const w of n.whens) {
              if (w.match.some((m) => looseEq(subject, m.kind === 'lit' ? m.value : lookup(scope, m.path)))) {
                out += walk(w.body, scope); hit = true; break;
              }
            }
            if (!hit && n.elseBody) out += walk(n.elseBody, scope);
            break;
          }

          case 'for': {
            let list;
            if (n.range) {
              const from = Math.round(toNum(n.range.from.kind === 'lit' ? n.range.from.value : lookup(scope, n.range.from.path)));
              const to   = Math.round(toNum(n.range.to.kind   === 'lit' ? n.range.to.value   : lookup(scope, n.range.to.path)));
              list = [];
              for (let i = from; i <= to && list.length < 1000; i++) list.push(i);
            } else {
              const v = evalValue(n.collection, scope);
              list = Array.isArray(v) ? v.slice() : (v && typeof v === 'object' ? Object.entries(v).map(([k, val]) => ({ first: k, last: val })) : []);
            }
            if (n.opts.reversed) list.reverse();
            if (n.opts.offset) list = list.slice(n.opts.offset);
            if (n.opts.limit != null) list = list.slice(0, n.opts.limit);
            if (!list.length) { if (n.elseBody) out += walk(n.elseBody, scope); break; }
            for (let i = 0; i < list.length; i++) {
              const inner = Object.create(scope);
              inner[n.varName] = list[i];
              inner.forloop = { index: i + 1, index0: i, first: i === 0, last: i === list.length - 1, length: list.length, rindex: list.length - i };
              out += walk(n.body, inner);
              if (aborted) break;
            }
            break;
          }

          case 'assign':  scope[n.name] = evalValue(n.expr, scope); break;
          case 'increment': scope[n.name] = toNum(scope[n.name]) + n.by; out += toStr(scope[n.name]); break;

          case 'capture': scope[n.name] = walk(n.body, scope); break;

          case 'abort': aborted = n.message; break;

          case 'catalog_items': {
            const cat = catalogs[n.catalog];
            if (!cat) { errors.push('Unknown catalog: `' + n.catalog + '`'); scope.items = []; break; }
            const ids = n.ids.map((v) => toStr(evalValue(v, scope))).filter(Boolean);
            scope.items = ids.map((id) => cat.items.find((it) => String(it.id) === id) || null).filter(Boolean);
            if (scope.items.length < ids.length) {
              warnings.push('catalog `' + n.catalog + '` had no row for: ' + ids.filter((id) => !cat.items.some((it) => String(it.id) === id)).join(', '));
            }
            if (!ids.length) errors.push('{% catalog_items %} resolved to an empty item id — the send would fail for this user.');
            break;
          }

          case 'connected_content': {
            const save = (n.args.match(/:save\s+(\w+)/) || [])[1];
            const url  = (n.args.match(/^(\S+)/) || [])[1] || '';
            /* No network in the sandbox: return a shaped stub so downstream Liquid still runs. */
            const stub = { status: 200, url, sandbox: true, rate: 189, currency: 'EUR', available: true, name: 'Sandbox response' };
            if (save) scope[save] = stub;
            else out += JSON.stringify(stub);
            warnings.push('Connected Content to ' + url + ' returned a sandbox stub (no live network).');
            break;
          }

          case 'content_block': out += includeBlock(n.name, scope); break;

          case 'unknown': errors.push('Unsupported tag: {% ' + n.name + ' %}'); break;
          case 'error':   errors.push(n.message); break;
        }
      }
      return out;
    }

    function includeBlock(name, scope) {
      if (depth > 6) { errors.push('Content Block nesting is too deep (possible loop): ' + name); return ''; }
      const block = contentBlocks[name];
      if (!block) { errors.push('Unknown Content Block: `' + name + '`'); return ''; }
      depth++;
      const inner = walk(parse(tokenize(block)), scope);
      depth--;
      return inner;
    }

    let html = '';
    try {
      html = walk(parse(tokenize(String(template || ''))), Object.assign({}, context));
    } catch (e) {
      errors.push('Render failed: ' + e.message);
    }

    return {
      html: aborted ? '' : html,
      aborted,
      errors,
      warnings: Array.from(new Set(warnings)),
    };
  }

  /* ---------- Braze user profile -> Liquid context ------------------------ */

  function contextForUser(user, extra) {
    extra = extra || {};
    const c = {
      /* standard personalization tags */
      first_name: user.first_name,
      last_name: user.last_name,
      email_address: user.email,
      user_id: user.external_id,
      braze_id: user.braze_id,
      phone_number: user.phone,
      country: user.country,
      city: user.city,
      language: user.language,
      time_zone: user.time_zone,
      gender: user.gender,
      age: user.age,
      most_recent_app_version: user.custom.has_app ? '7.4.1' : null,
      set_user_to_unsubscribed_url: 'https://aureliahotels.com/u/' + user.braze_id,
      /* namespaced tags */
      custom_attribute: Object.assign({}, user.custom),
      event_properties: extra.event_properties || {},
      canvas_entry_properties: extra.canvas_entry_properties || {},
      api_trigger_properties: extra.api_trigger_properties || {},
      /* handy for lessons */
      targeting_attributes: Object.assign({}, user.custom),
    };
    /* Dates arrive as ISO strings; the `date` filter handles them. */
    return Object.assign(c, extra.extra || {});
  }

  /* ---------- linter ------------------------------------------------------ */

  function lint(template) {
    const issues = [];
    const src = String(template || '');

    /* unbalanced blocks */
    const opens = { if: 0, unless: 0, for: 0, capture: 0, case: 0 };
    tokenize(src).forEach((t) => {
      if (t.type !== 'tag') return;
      if (t.name in opens) opens[t.name]++;
      const closeOf = Object.keys(BLOCK_END).find((k) => BLOCK_END[k] === t.name);
      if (closeOf && closeOf in opens) opens[closeOf]--;
    });
    Object.entries(opens).forEach(([k, v]) => {
      if (v > 0) issues.push({ level: 'error', text: `${v} unclosed {% ${k} %} block${v > 1 ? 's' : ''} — add {% ${BLOCK_END[k]} %}.` });
      if (v < 0) issues.push({ level: 'error', text: `${-v} extra {% ${BLOCK_END[k]} %} with no matching {% ${k} %}.` });
    });

    /* Braze personalization written as plain Liquid */
    if (/\{\{\s*first_name\s*(\||\}\})/.test(src)) {
      issues.push({ level: 'warn', text: 'Use `{{${first_name}}}`, not `{{first_name}}` — Braze standard attributes need the ${…} wrapper.' });
    }
    if (/custom_attribute\.[a-z_]+[\s|}]/.test(src) && !/custom_attribute\.\$\{/.test(src)) {
      issues.push({ level: 'warn', text: 'Custom attributes are addressed as `{{custom_attribute.${name}}}` — the ${…} wrapper is required.' });
    }

    /* missing fallbacks on personalization in a subject line or greeting */
    const outputs = tokenize(src).filter((t) => t.type === 'output');
    const noDefault = outputs.filter((t) => /\$\{(first_name|last_name)\}/.test(t.body) && !/\|\s*default\s*:/.test(t.body));
    if (noDefault.length) {
      issues.push({ level: 'warn', text: `${noDefault.length} name tag(s) have no \`| default:\` fallback. Users with a blank profile field will see "Hi ," — always add one.` });
    }

    /* unsubscribe link on a promotional body */
    if (src.length > 400 && !/set_user_to_unsubscribed_url|aurelia_footer|unsubscribe/i.test(src)) {
      issues.push({ level: 'warn', text: 'No unsubscribe link found. Promotional email needs one — include the `aurelia_footer` Content Block.' });
    }

    /* catalog usage without an abort guard */
    if (/\{%\s*catalog_items/.test(src) && !/abort_message/.test(src)) {
      issues.push({ level: 'info', text: 'Catalog lookups can return nothing. Guard with `{% if items.size == 0 %}{% abort_message(\'no catalog row\') %}{% endif %}` so you never send an empty template.' });
    }

    /* Connected Content without a timeout/fallback */
    if (/connected_content/.test(src) && !/:rerender|:cache|:method/.test(src)) {
      issues.push({ level: 'info', text: 'Connected Content without `:cache` will call your endpoint once per recipient. Add `:cache 300` on high-volume sends.' });
    }
    return issues;
  }

  return { render, lint, contextForUser, tokenize, parse, FILTERS, strftime };
})();

window.BZLiquid = BZLiquid;
