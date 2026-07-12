'use strict';

/* ============================== storage & config ============================== */

const LS = {
  apiKey: 'sp_apiKey',
  workingSymbol: 'sp_workingSymbol',
  theme: 'sp_theme',
  savings: 'sp_savings',
  autoRefresh: 'sp_autoRefresh',
  refreshInterval: 'sp_refreshInterval',
  cachePrefix: 'sp_cache_',
  creditsPrefix: 'sp_credits_',
};

const DAILY_TTL = 6 * 3600 * 1000;
const HOURLY_TTL = 15 * 60 * 1000;
const FX_DAILY_TTL = 12 * 3600 * 1000;

const STATE = { mode: 'demo', equity: null, fx: null, lastUpdated: null, equityIsDemo: true, fxIsDemo: true };
const UI = { loading: false, activePeriod: 'month', activeHourlyLookback: 3, activeForecastHorizon: 'quarter', lastError: null };
let periodChartInstance = null;
let autoRefreshTimer = null;

function getApiKey() { return (localStorage.getItem(LS.apiKey) || '').trim(); }
function setApiKey(k) { localStorage.setItem(LS.apiKey, k); }
function clearApiKey() { localStorage.removeItem(LS.apiKey); }
function getWorkingSymbol() { return localStorage.getItem(LS.workingSymbol) || 'SPX'; }
function setWorkingSymbol(s) { localStorage.setItem(LS.workingSymbol, s); }

function cacheGet(key) {
  try { const raw = localStorage.getItem(LS.cachePrefix + key); return raw ? JSON.parse(raw) : null; }
  catch (e) { return null; }
}
function cacheSet(key, data) {
  try { localStorage.setItem(LS.cachePrefix + key, JSON.stringify({ t: Date.now(), d: data })); }
  catch (e) { /* storage full or unavailable — ignore, non-fatal */ }
}
function cacheFresh(entry, ttlMs) { return !!entry && (Date.now() - entry.t < ttlMs); }
function reviveDates(bars) { return (bars || []).map(b => ({ date: new Date(b.date), close: b.close })); }

function todayStr() { return new Date().toISOString().slice(0, 10); }
function bumpCredits() {
  const key = LS.creditsPrefix + todayStr();
  const n = (parseInt(localStorage.getItem(key) || '0', 10)) + 1;
  localStorage.setItem(key, String(n));
  return n;
}
function creditsToday() { return parseInt(localStorage.getItem(LS.creditsPrefix + todayStr()) || '0', 10); }

/* ============================== date & format utils ============================== */

function addDays(d, n) { return new Date(d.getTime() + n * 86400000); }
function addMonths(d, n) { return new Date(d.getFullYear(), d.getMonth() + n, d.getDate()); }
function addYears(d, n) { return addMonths(d, n * 12); }
function nextWeekday(d) { let x = new Date(d); while (x.getDay() === 0 || x.getDay() === 6) x = addDays(x, 1); return x; }
function fmtISODate(d) { return d.toISOString().slice(0, 10); }
function fmtHeDate(d) { return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
function fmtHeDateShort(d) { return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' }); }

function fmtNum(n, decimals) {
  if (n == null || isNaN(n)) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
function fmtUSD(n, decimals) { return n == null || isNaN(n) ? '—' : '$' + fmtNum(n, decimals == null ? 2 : decimals); }
function fmtILS(n, decimals) { return n == null || isNaN(n) ? '—' : '₪' + fmtNum(n, decimals == null ? 0 : decimals); }
function fmtPct(n, decimals) {
  if (n == null || isNaN(n)) return '—';
  const d = decimals == null ? 2 : decimals;
  return (n > 0 ? '+' : '') + fmtNum(n, d) + '%';
}
function ltr(html) { return `<span class="ltr-num">${html}</span>`; }
function deltaClass(n) { return n == null || isNaN(n) ? 'flat' : (n > 0.0001 ? 'up' : (n < -0.0001 ? 'down' : 'flat')); }
function deltaArrow(n) { return n == null || isNaN(n) ? '' : (n > 0.0001 ? '▲' : (n < -0.0001 ? '▼' : '•')); }
function getCssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

/* ============================== rate limiter (Twelve Data: 8 req/min) ============================== */

const tdCallTimes = [];
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function tdLimiterWait() {
  const now = Date.now();
  while (tdCallTimes.length && now - tdCallTimes[0] > 60000) tdCallTimes.shift();
  if (tdCallTimes.length >= 7) {
    const waitMs = 60000 - (now - tdCallTimes[0]) + 100;
    await sleep(waitMs);
    return tdLimiterWait();
  }
  tdCallTimes.push(Date.now());
}

async function fetchWithTimeout(url, timeoutMs) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs || 12000);
  try { return await fetch(url, { signal: ctrl.signal }); }
  finally { clearTimeout(id); }
}

/* ============================== Twelve Data (equity + optional FX quote) ============================== */

async function tdRequest(path, params) {
  await tdLimiterWait();
  const url = new URL('https://api.twelvedata.com/' + path);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  url.searchParams.set('apikey', getApiKey());
  const res = await fetchWithTimeout(url.toString(), 12000);
  bumpCredits();
  const json = await res.json();
  if (json.status === 'error' || json.code >= 400) {
    const err = new Error(json.message || ('Twelve Data error ' + json.code));
    err.code = json.code;
    throw err;
  }
  return json;
}

async function withSymbolFallback(fn) {
  const sym = getWorkingSymbol();
  try { return await fn(sym); }
  catch (e) {
    if (sym === 'SPX') { setWorkingSymbol('SPY'); return await fn('SPY'); }
    throw e;
  }
}

function parseTdSeries(json) {
  const vals = json.values || [];
  const bars = vals
    .map(v => ({ date: new Date(v.datetime), close: parseFloat(v.close) }))
    .filter(b => !isNaN(b.close) && !isNaN(b.date.getTime()));
  bars.sort((a, b) => a.date - b.date);
  return bars;
}

async function fetchEquityDailyRaw() {
  return withSymbolFallback(sym => tdRequest('time_series', { symbol: sym, interval: '1day', outputsize: 5000 }));
}
async function fetchEquityHourlyRaw() {
  return withSymbolFallback(sym => tdRequest('time_series', { symbol: sym, interval: '1h', outputsize: 400 }));
}
async function fetchEquityQuoteRaw() {
  return withSymbolFallback(sym => tdRequest('quote', { symbol: sym }));
}
async function fetchFxHourlyRaw() {
  return tdRequest('time_series', { symbol: 'USD/ILS', interval: '1h', outputsize: 400 });
}
async function fetchFxQuoteRaw() {
  return tdRequest('quote', { symbol: 'USD/ILS' });
}

/* ============================== Frankfurter (free, no key, USD/ILS daily) ============================== */

async function fetchFxDailyHistory(startDate) {
  const start = fmtISODate(startDate);
  const end = fmtISODate(new Date());
  const url = `https://api.frankfurter.app/${start}..${end}?from=USD&to=ILS`;
  const res = await fetchWithTimeout(url, 15000);
  const json = await res.json();
  const rates = json.rates || {};
  const bars = Object.entries(rates)
    .map(([date, obj]) => ({ date: new Date(date), close: obj.ILS }))
    .filter(b => typeof b.close === 'number');
  bars.sort((a, b) => a.date - b.date);
  return bars;
}
async function fetchFxLatestFrankfurter() {
  const res = await fetchWithTimeout('https://api.frankfurter.app/latest?from=USD&to=ILS', 10000);
  const json = await res.json();
  return { price: json.rates && json.rates.ILS, pct: null, ts: new Date(json.date) };
}

/* ============================== demo / synthetic data (used until an API key is set) ============================== */

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gaussian(rng) {
  const u = 1 - rng(), v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function genDemoDaily(desiredCurrent, years, annualDrift, annualVol, seed) {
  const rng = mulberry32(seed);
  const dailyMu = annualDrift / 252, dailyVol = annualVol / Math.sqrt(252);
  const startDate = nextWeekday(addDays(new Date(), -Math.round(years * 365.25)));
  const bars = [];
  let price = desiredCurrent / Math.exp(annualDrift * years);
  let d = startDate;
  const today = new Date();
  while (d <= today) {
    bars.push({ date: new Date(d), close: price });
    const z = gaussian(rng);
    price = price * Math.exp(dailyMu - 0.5 * dailyVol * dailyVol + dailyVol * z);
    d = nextWeekday(addDays(d, 1));
  }
  const scale = desiredCurrent / bars[bars.length - 1].close;
  bars.forEach(b => (b.close *= scale));
  return bars;
}

function genDemoHourly(desiredCurrent, tradingDaysBack, annualDrift, annualVol, seed) {
  const rng = mulberry32(seed);
  const barsPerDay = 7;
  const dailyMu = annualDrift / 252, dailyVol = annualVol / Math.sqrt(252);
  const hourlyMu = dailyMu / barsPerDay, hourlyVol = dailyVol / Math.sqrt(barsPerDay);
  const bars = [];
  let price = desiredCurrent / Math.exp(dailyMu * tradingDaysBack);
  let d = nextWeekday(addDays(new Date(), -tradingDaysBack));
  const today = new Date();
  while (d <= today) {
    for (let h = 0; h < barsPerDay; h++) {
      const ts = new Date(d); ts.setHours(10 + h, 0, 0, 0);
      if (ts > today) break;
      bars.push({ date: ts, close: price });
      const z = gaussian(rng);
      price = price * Math.exp(hourlyMu - 0.5 * hourlyVol * hourlyVol + hourlyVol * z);
    }
    d = nextWeekday(addDays(d, 1));
  }
  const scale = desiredCurrent / bars[bars.length - 1].close;
  bars.forEach(b => (b.close *= scale));
  return bars;
}

function getDemoEquityDaily() { return genDemoDaily(552, 20, 0.10, 0.16, 42); }
function getDemoEquityHourly() { return genDemoHourly(552, 20, 0.10, 0.16, 43); }
function getDemoFxDaily() { return genDemoDaily(3.65, 20, 0.005, 0.075, 44); }
function getDemoFxHourly() { return genDemoHourly(3.65, 20, 0.005, 0.075, 45); }

/* ============================== load orchestration ============================== */

async function safeFetch(fn) {
  try { return await fn(); }
  catch (e) { console.warn(e); UI.lastError = e.message; return null; }
}

async function cachedOrFetch(key, ttlMs, force, fn) {
  if (!force) {
    const c = cacheGet(key);
    if (cacheFresh(c, ttlMs)) return reviveDates(c.d);
  }
  try {
    const fresh = await fn();
    if (fresh && fresh.length) cacheSet(key, fresh);
    return fresh;
  } catch (e) {
    console.warn('fetch failed for ' + key, e);
    UI.lastError = e.message;
    const c = cacheGet(key);
    if (c) return reviveDates(c.d);
    return null;
  }
}

async function loadAll(force) {
  UI.loading = true; UI.lastError = null; renderConnectionStatus();
  const hasKey = !!getApiKey();

  let eqDaily = null, eqHourly = null, eqQuoteRaw = null, fxHourly = null, fxQuoteObj = null;

  if (hasKey) {
    eqDaily = await cachedOrFetch('eqDaily_' + getWorkingSymbol(), DAILY_TTL, force,
      async () => parseTdSeries(await fetchEquityDailyRaw()));
    eqQuoteRaw = await safeFetch(fetchEquityQuoteRaw);
    eqHourly = await cachedOrFetch('eqHourly_' + getWorkingSymbol(), HOURLY_TTL, force,
      async () => parseTdSeries(await fetchEquityHourlyRaw()));
    fxHourly = await cachedOrFetch('fxHourly', HOURLY_TTL, force,
      async () => parseTdSeries(await fetchFxHourlyRaw()));
    const fxQuoteRaw = await safeFetch(fetchFxQuoteRaw);
    if (fxQuoteRaw) fxQuoteObj = { price: parseFloat(fxQuoteRaw.close), pct: parseFloat(fxQuoteRaw.percent_change), ts: new Date() };
  }

  const fxDaily = await cachedOrFetch('fxDaily', FX_DAILY_TTL, force, () => fetchFxDailyHistory(addYears(new Date(), -20)));
  if (!fxQuoteObj) fxQuoteObj = await safeFetch(fetchFxLatestFrankfurter);

  STATE.equityIsDemo = !(eqDaily && eqDaily.length >= 2);
  STATE.fxIsDemo = !(fxDaily && fxDaily.length >= 2);

  STATE.equity = {
    symbol: getWorkingSymbol(),
    daily: STATE.equityIsDemo ? getDemoEquityDaily() : eqDaily,
    hourly: (eqHourly && eqHourly.length >= 2) ? eqHourly : getDemoEquityHourly(),
    quote: eqQuoteRaw ? { price: parseFloat(eqQuoteRaw.close), changePct: parseFloat(eqQuoteRaw.percent_change), isOpen: eqQuoteRaw.is_market_open, name: eqQuoteRaw.name } : null,
    hourlyIsDemo: !(eqHourly && eqHourly.length >= 2),
  };
  STATE.fx = {
    daily: STATE.fxIsDemo ? getDemoFxDaily() : fxDaily,
    hourly: (fxHourly && fxHourly.length >= 2) ? fxHourly : (STATE.fxIsDemo ? getDemoFxHourly() : null),
    quote: fxQuoteObj,
    hourlyIsDemo: !(fxHourly && fxHourly.length >= 2),
  };
  STATE.mode = (STATE.equityIsDemo) ? 'demo' : 'live';
  STATE.lastUpdated = new Date();
  UI.loading = false;
  renderAll();
}

async function refreshLiveOnly() {
  if (!getApiKey()) return;
  const eqQuoteRaw = await safeFetch(fetchEquityQuoteRaw);
  if (eqQuoteRaw) STATE.equity.quote = { price: parseFloat(eqQuoteRaw.close), changePct: parseFloat(eqQuoteRaw.percent_change), isOpen: eqQuoteRaw.is_market_open, name: eqQuoteRaw.name };
  const fxQuoteRaw = await safeFetch(fetchFxQuoteRaw);
  if (fxQuoteRaw) STATE.fx.quote = { price: parseFloat(fxQuoteRaw.close), pct: parseFloat(fxQuoteRaw.percent_change), ts: new Date() };
  STATE.lastUpdated = new Date();
  renderKPIs(true);
  renderReturnsTable();
}

/* ============================== calculations ============================== */

function findAtOrBefore(bars, target) {
  if (!bars || !bars.length) return null;
  if (bars[0].date > target) return { bar: bars[0], insufficient: true };
  let res = bars[0];
  for (const b of bars) { if (b.date <= target) res = b; else break; }
  return { bar: res, insufficient: false };
}

const PERIODS = [
  { key: 'day', label: 'יומי', target: d => addDays(d, -1) },
  { key: 'week', label: 'שבועי', target: d => addDays(d, -7) },
  { key: 'month', label: 'חודשי', target: d => addMonths(d, -1) },
  { key: 'quarter', label: 'רבעוני', target: d => addMonths(d, -3) },
  { key: 'ytd', label: 'מתחילת השנה (YTD)', target: d => new Date(d.getFullYear(), 0, 1) },
  { key: 'y1', label: 'שנה אחורה', target: d => addYears(d, -1) },
  { key: 'y3', label: '3 שנים אחורה', target: d => addYears(d, -3) },
  { key: 'y5', label: '5 שנים אחורה', target: d => addYears(d, -5) },
  { key: 'y10', label: '10 שנים אחורה', target: d => addYears(d, -10) },
];
const FORECAST_HORIZONS = [
  { key: 'month', label: 'חודש', days: 21 },
  { key: 'quarter', label: 'רבעון', days: 63 },
  { key: 'year', label: 'שנה', days: 252 },
];
const HOURLY_LOOKBACKS = [1, 3, 5, 10];

function lastClose(bars) { return bars && bars.length ? bars[bars.length - 1].close : null; }
function getCurrentEquityPrice() { return (STATE.equity.quote && STATE.equity.quote.price) || lastClose(STATE.equity.daily); }
function getCurrentFxPrice() { return (STATE.fx.quote && STATE.fx.quote.price) || lastClose(STATE.fx.daily); }

function computePeriodReturn(bars, currentPrice, targetDate) {
  const found = findAtOrBefore(bars, targetDate);
  if (!found || currentPrice == null) return null;
  const pct = (currentPrice / found.bar.close - 1) * 100;
  return { pct, startDate: found.bar.date, startClose: found.bar.close, insufficient: found.insufficient };
}
function combinedReturnPct(spPct, usdPct) { return ((1 + spPct / 100) * (1 + usdPct / 100) - 1) * 100; }

/** "Daily" change needs its own logic: calendar "-1 day" breaks over weekends/holidays
 *  (it would compare Friday's close against itself). If the current price is a live quote
 *  that has actually moved past the last completed bar, baseline = last bar (prev close).
 *  Otherwise (weekend/closed, current price IS the last bar) baseline = the bar before that. */
function computeDayReturn(bars, currentPrice) {
  if (!bars || bars.length < 2 || currentPrice == null) return null;
  const lastBar = bars[bars.length - 1];
  const prevBar = bars[bars.length - 2];
  const isLiveQuote = Math.abs(currentPrice - lastBar.close) > 1e-9;
  const baseline = isLiveQuote ? lastBar : prevBar;
  const pct = (currentPrice / baseline.close - 1) * 100;
  return { pct, startDate: baseline.date, startClose: baseline.close, insufficient: false };
}

function periodRow(periodDef) {
  const today = new Date();
  let sp, usd;
  if (periodDef.key === 'day') {
    sp = computeDayReturn(STATE.equity.daily, getCurrentEquityPrice());
    usd = computeDayReturn(STATE.fx.daily, getCurrentFxPrice());
  } else {
    const target = periodDef.target(today);
    sp = computePeriodReturn(STATE.equity.daily, getCurrentEquityPrice(), target);
    usd = computePeriodReturn(STATE.fx.daily, getCurrentFxPrice(), target);
  }
  if (!sp || !usd) return null;
  return { def: periodDef, sp, usd, combined: combinedReturnPct(sp.pct, usd.pct) };
}

function logReturns(bars) {
  const r = [];
  for (let i = 1; i < bars.length; i++) r.push(Math.log(bars[i].close / bars[i - 1].close));
  return r;
}
function meanStd(arr) {
  const n = arr.length;
  const mean = arr.reduce((a, b) => a + b, 0) / n;
  const variance = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  return { mean, std: Math.sqrt(variance) };
}
function forecastFor(bars, horizonDays) {
  const rets = logReturns(bars.slice(-756));
  if (rets.length < 20) return null;
  const { mean, std } = meanStd(rets);
  const base = Math.expm1(mean * horizonDays) * 100;
  const spread = std * Math.sqrt(horizonDays);
  return { base, opt: Math.expm1(mean * horizonDays + spread) * 100, pess: Math.expm1(mean * horizonDays - spread) * 100 };
}

/* ============================== render: shell / status ============================== */

function renderConnectionStatus() {
  const pill = document.getElementById('modePill');
  const refreshBtn = document.getElementById('refreshBtn');
  if (UI.loading) { refreshBtn.classList.add('spin'); }
  else { refreshBtn.classList.remove('spin'); }
  if (STATE.mode === 'live') { pill.textContent = 'נתונים חיים'; pill.className = 'mode-pill live'; }
  else { pill.textContent = 'מצב הדגמה'; pill.className = 'mode-pill demo'; }
}

function renderUpdatedTxt() {
  const el = document.getElementById('updatedTxt');
  if (!STATE.lastUpdated) { el.textContent = '—'; return; }
  const secs = Math.max(0, Math.round((Date.now() - STATE.lastUpdated.getTime()) / 1000));
  const txt = secs < 60 ? `עודכן לפני ${secs} שנ׳` : `עודכן לפני ${Math.round(secs / 60)} דק׳`;
  el.textContent = txt;
}
setInterval(renderUpdatedTxt, 5000);

function renderAll() {
  renderConnectionStatus();
  renderUpdatedTxt();
  renderKPIs(false);
  renderReturnsTable();
  renderPeriodsTab();
  renderForecast();
  simulate();
  renderSavingsTable();
  renderSettingsStatus();
}

/* ============================== render: overview ============================== */

function renderKPIs(flash) {
  const eqPrice = getCurrentEquityPrice();
  const fxPrice = getCurrentFxPrice();
  const dayRow = periodRow(PERIODS[0]);
  const ytdRow = periodRow(PERIODS[4]);
  const symbolNote = STATE.equity.symbol === 'SPY' ? 'עוקב אחרי SPY (ETF, פרוקסי למדד S&P 500)' : 'עוקב אחרי מדד S&P 500 (SPX)';

  const eqDelta = (STATE.equity.quote && !isNaN(STATE.equity.quote.changePct)) ? STATE.equity.quote.changePct : (dayRow ? dayRow.sp.pct : null);
  const fxDelta = (STATE.fx.quote && STATE.fx.quote.pct != null && !isNaN(STATE.fx.quote.pct)) ? STATE.fx.quote.pct : (dayRow ? dayRow.usd.pct : null);

  const cards = [
    { label: 'S&P 500 — מחיר', value: ltr(fmtUSD(eqPrice)), delta: eqDelta, sub: symbolNote },
    { label: 'USD / ILS — שער', value: ltr(fmtILS(fxPrice, 3)), delta: fxDelta, sub: STATE.fx.quote ? 'שער עדכני' : 'שער אחרון זמין' },
    { label: 'תשואה מתחילת השנה (מותאם ₪)', value: ltr(fmtPct(ytdRow ? ytdRow.combined : null)), delta: ytdRow ? ytdRow.combined : null, sub: ytdRow ? `S&P: ${ltr(fmtPct(ytdRow.sp.pct))} · דולר: ${ltr(fmtPct(ytdRow.usd.pct))}` : '' },
    { label: 'מצב', value: STATE.mode === 'live' ? 'נתונים חיים' : 'הדגמה', delta: null, sub: STATE.mode === 'live' ? 'Twelve Data + Frankfurter' : 'הזן מפתח API בהגדרות לנתונים אמיתיים' },
  ];

  document.getElementById('kpiGrid').innerHTML = cards.map(c => `
    <div class="kpi ${flash ? 'flash' : ''}">
      <div class="label">${c.label}</div>
      <div class="value">${c.value}</div>
      ${c.delta != null ? `<div class="delta ${deltaClass(c.delta)}">${deltaArrow(c.delta)} ${ltr(fmtPct(c.delta))}</div>` : ''}
      <div class="sub">${c.sub || ''}</div>
    </div>
  `).join('');
}

function renderReturnsTable() {
  const rows = PERIODS.map(periodRow).filter(Boolean);
  document.getElementById('returnsTableBody').innerHTML = rows.map(r => `
    <tr class="clickable" data-period="${r.def.key}">
      <td>${r.def.label}${(r.sp.insufficient || r.usd.insufficient) ? ' *' : ''}</td>
      <td class="num ${deltaClass(r.sp.pct)}">${ltr(fmtPct(r.sp.pct))}</td>
      <td class="num ${deltaClass(r.usd.pct)}">${ltr(fmtPct(r.usd.pct))}</td>
      <td class="num ${deltaClass(r.combined)}" style="font-weight:800;">${ltr(fmtPct(r.combined))}</td>
    </tr>
  `).join('');
  document.querySelectorAll('#returnsTableBody tr').forEach(tr => {
    tr.addEventListener('click', () => {
      switchView('periods');
      selectPeriod(tr.getAttribute('data-period'));
    });
  });
}

/* ============================== render: periods tab ============================== */

function buildPeriodPills() {
  const wrap = document.getElementById('periodPills');
  const items = PERIODS.map(p => `<button class="pill" data-key="${p.key}">${p.label}</button>`).join('')
    + `<button class="pill" data-key="hourly">שעתי (ימים אחרונים)</button>`;
  wrap.innerHTML = items;
  wrap.querySelectorAll('.pill').forEach(btn => btn.addEventListener('click', () => selectPeriod(btn.getAttribute('data-key'))));

  const hWrap = document.getElementById('hourlyLookbackPills');
  hWrap.innerHTML = HOURLY_LOOKBACKS.map(n => `<button class="pill" data-n="${n}">${n} ימים אחרונים</button>`).join('');
  hWrap.querySelectorAll('.pill').forEach(btn => btn.addEventListener('click', () => {
    UI.activeHourlyLookback = parseInt(btn.getAttribute('data-n'), 10);
    renderPeriodsTab();
  }));
}

function selectPeriod(key) {
  UI.activePeriod = key;
  renderPeriodsTab();
}

function renderPeriodsTab() {
  document.querySelectorAll('#periodPills .pill').forEach(b => b.classList.toggle('active', b.getAttribute('data-key') === UI.activePeriod));
  document.getElementById('hourlyLookbackPills').style.display = UI.activePeriod === 'hourly' ? 'flex' : 'none';
  document.querySelectorAll('#hourlyLookbackPills .pill').forEach(b => b.classList.toggle('active', parseInt(b.getAttribute('data-n'), 10) === UI.activeHourlyLookback));

  let eqBars, fxBars, fromDate, statLabel;
  const today = new Date();
  if (UI.activePeriod === 'hourly') {
    fromDate = addDays(today, -UI.activeHourlyLookback);
    eqBars = STATE.equity.hourly.filter(b => b.date >= fromDate);
    fxBars = (STATE.fx.hourly || []).filter(b => b.date >= fromDate);
    statLabel = `${UI.activeHourlyLookback} ימים אחרונים (נתון שעתי)`;
  } else {
    const def = PERIODS.find(p => p.key === UI.activePeriod) || PERIODS[2];
    fromDate = def.target(today);
    eqBars = STATE.equity.daily.filter(b => b.date >= fromDate);
    fxBars = STATE.fx.daily.filter(b => b.date >= fromDate);
    statLabel = def.label;
  }

  if (eqBars.length < 2) { eqBars = STATE.equity.daily.slice(-2); }
  const eqBase = eqBars[0].close;
  const spSeries = eqBars.map(b => ({ date: b.date, v: b.close / eqBase * 100 }));

  let fxSeries = [];
  if (fxBars.length >= 2) {
    const fxBase = fxBars[0].close;
    fxSeries = eqBars.map(b => {
      const found = findAtOrBefore(fxBars, b.date);
      return { date: b.date, v: found ? (found.bar.close / fxBase * 100) : null };
    });
  }

  drawPeriodChart(eqBars.map(b => b.date), spSeries, fxSeries);

  const currentEq = getCurrentEquityPrice(), currentFx = getCurrentFxPrice();
  const spPct = (currentEq / eqBars[0].close - 1) * 100;
  const usdPct = fxBars.length >= 2 ? (currentFx / fxBars[0].close - 1) * 100 : null;
  const combined = usdPct != null ? combinedReturnPct(spPct, usdPct) : null;

  document.getElementById('periodStats').innerHTML = `
    <div class="kpi"><div class="label">תשואת S&amp;P 500 — ${statLabel}</div><div class="value ${deltaClass(spPct)}">${ltr(fmtPct(spPct))}</div>
      <div class="sub">${ltr(fmtHeDate(eqBars[0].date))} ← היום</div></div>
    <div class="kpi"><div class="label">שינוי דולר/שקל</div><div class="value ${usdPct != null ? deltaClass(usdPct) : ''}">${ltr(fmtPct(usdPct))}</div>
      <div class="sub">${fxBars.length >= 2 ? '' : 'אין נתון תוך-יומי לדולר ללא מפתח API'}</div></div>
    <div class="kpi"><div class="label">תשואה מותאמת שקל</div><div class="value ${combined != null ? deltaClass(combined) : ''}" style="color:var(--blue)">${ltr(fmtPct(combined))}</div>
      <div class="sub">(1+תשואת מדד)×(1+שינוי דולר)−1</div></div>
  `;
}

function drawPeriodChart(dates, spSeries, fxSeries) {
  const ctx = document.getElementById('periodChart').getContext('2d');
  const labels = dates.map(d => dates.length > 40 ? fmtHeDateShort(d) : (d.getHours ? d.toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit' }) : fmtHeDateShort(d)));
  const blue = getCssVar('--blue'), aqua = getCssVar('--aqua'), grid = getCssVar('--grid'), muted = getCssVar('--muted'), surface = getCssVar('--surface'), ink = getCssVar('--ink');

  const datasets = [{
    label: 'S&P 500', data: spSeries.map(s => s.v), borderColor: blue, backgroundColor: blue,
    borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.15,
  }];
  if (fxSeries.length) {
    datasets.push({
      label: 'USD/ILS', data: fxSeries.map(s => s.v), borderColor: aqua, backgroundColor: aqua,
      borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.15,
    });
  }

  if (periodChartInstance) periodChartInstance.destroy();
  periodChartInstance = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: surface, titleColor: ink, bodyColor: ink, borderColor: grid, borderWidth: 1,
          callbacks: { label: c => `${c.dataset.label}: ${c.parsed.y.toFixed(2)}` },
        },
      },
      scales: {
        x: { grid: { color: grid, display: false }, ticks: { color: muted, maxTicksLimit: 8, autoSkip: true } },
        y: { grid: { color: grid }, ticks: { color: muted, callback: v => v.toFixed(0) } },
      },
    },
  });
}

/* ============================== render: forecast ============================== */

function buildForecastPills() {
  const wrap = document.getElementById('forecastHorizonPills');
  wrap.innerHTML = FORECAST_HORIZONS.map(h => `<button class="pill" data-key="${h.key}">${h.label}</button>`).join('');
  wrap.querySelectorAll('.pill').forEach(btn => btn.addEventListener('click', () => {
    UI.activeForecastHorizon = btn.getAttribute('data-key');
    renderForecast();
  }));
}

function currentForecast() {
  const h = FORECAST_HORIZONS.find(x => x.key === UI.activeForecastHorizon) || FORECAST_HORIZONS[1];
  const spF = forecastFor(STATE.equity.daily, h.days);
  const usdF = forecastFor(STATE.fx.daily, h.days);
  if (!spF || !usdF) return null;
  return {
    horizon: h,
    pess: { sp: spF.pess, usd: usdF.pess, combined: combinedReturnPct(spF.pess, usdF.pess) },
    base: { sp: spF.base, usd: usdF.base, combined: combinedReturnPct(spF.base, usdF.base) },
    opt: { sp: spF.opt, usd: usdF.opt, combined: combinedReturnPct(spF.opt, usdF.opt) },
  };
}

function renderForecast() {
  document.querySelectorAll('#forecastHorizonPills .pill').forEach(b => b.classList.toggle('active', b.getAttribute('data-key') === UI.activeForecastHorizon));
  const f = currentForecast();
  const box = document.getElementById('forecastCards');
  if (!f) { box.innerHTML = `<p class="note">אין מספיק נתונים היסטוריים לחישוב תחזית עדיין.</p>`; return; }

  const eqPrice = getCurrentEquityPrice();
  const scenarios = [
    { key: 'pess', label: 'תרחיש פסימי', data: f.pess },
    { key: 'base', label: 'תרחיש בסיס', data: f.base },
    { key: 'opt', label: 'תרחיש אופטימי', data: f.opt },
  ];
  box.innerHTML = scenarios.map(s => `
    <div class="kpi" style="${s.key === 'base' ? 'border-color:var(--blue)' : ''}">
      <div class="label">${s.label} — ${f.horizon.label} קדימה</div>
      <div class="value ${deltaClass(s.data.combined)}">${ltr(fmtPct(s.data.combined))}</div>
      <div class="sub">מותאם שקל</div>
      <div class="sub" style="margin-top:8px;">S&amp;P: ${ltr(fmtPct(s.data.sp))} · דולר/שקל: ${ltr(fmtPct(s.data.usd))}</div>
      <div class="sub">מדד משוער: ${ltr(fmtUSD(eqPrice * (1 + s.data.sp / 100)))}</div>
    </div>
  `).join('');
}

/* ============================== render: simulator ============================== */

function simulate() {
  const spPct = parseFloat(document.getElementById('simSp').value) || 0;
  const usdPct = parseFloat(document.getElementById('simUsd').value) || 0;
  const amount = parseFloat(document.getElementById('simAmount').value) || 0;
  const exposure = (parseFloat(document.getElementById('simExposure').value) || 0) / 100;

  const combined = combinedReturnPct(spPct, usdPct);
  const valueAdjusted = amount * (1 + exposure * combined / 100);
  const valueNominalOnly = amount * (1 + exposure * spPct / 100);
  const fxImpact = valueAdjusted - valueNominalOnly;

  document.getElementById('simResults').innerHTML = `
    <div class="kpi"><div class="label">תשואה מותאמת שקל</div><div class="value ${deltaClass(combined)}">${ltr(fmtPct(combined))}</div>
      <div class="sub">(1+שינוי S&amp;P)×(1+שינוי דולר)−1</div></div>
    <div class="kpi"><div class="label">ערך משוער בסוף התקופה</div><div class="value">${ltr(fmtILS(valueAdjusted))}</div>
      <div class="sub">מתוך ${ltr(fmtILS(amount))} התחלתי, ${ltr((exposure * 100) + '%')} חשופים למדד</div></div>
    <div class="kpi"><div class="label">השפעת שער החליפין</div><div class="value ${deltaClass(fxImpact)}">${ltr(fmtILS(fxImpact))}</div>
      <div class="sub">הפרש מול תשואה דולרית בלבד (${ltr(fmtILS(valueNominalOnly))})</div></div>
  `;
}

function wireSimulator() {
  ['simSp', 'simUsd', 'simAmount', 'simExposure'].forEach(id => document.getElementById(id).addEventListener('input', simulate));
  document.getElementById('fillFromForecastBtn').addEventListener('click', () => {
    const f = currentForecast();
    if (!f) return;
    document.getElementById('simSp').value = f.base.sp.toFixed(2);
    document.getElementById('simUsd').value = f.base.usd.toFixed(2);
    switchView('simulator');
    simulate();
  });
}

/* ============================== render: savings ============================== */

function loadSavings() {
  try { return JSON.parse(localStorage.getItem(LS.savings) || '[]'); }
  catch (e) { return []; }
}
function persistSavings(list) { localStorage.setItem(LS.savings, JSON.stringify(list)); }

function renderSavingsTable() {
  const list = loadSavings();
  const currentFx = getCurrentFxPrice();
  const currentEq = getCurrentEquityPrice();
  document.getElementById('savingsEmptyNote').style.display = list.length ? 'none' : 'block';

  let totalOriginalILS = 0, totalEstimateILS = 0;
  const rows = list.map(entry => {
    const entryDate = new Date(entry.date);
    const spReturn = computePeriodReturn(STATE.equity.daily, currentEq, entryDate);
    const usdReturn = computePeriodReturn(STATE.fx.daily, currentFx, entryDate);
    const combined = (spReturn && usdReturn) ? combinedReturnPct(spReturn.pct, usdReturn.pct) : 0;
    const amountILS = entry.currency === 'USD' ? entry.amount * currentFx : entry.amount;
    const estimateILS = amountILS * (1 + (entry.exposure / 100) * combined / 100);
    totalOriginalILS += amountILS; totalEstimateILS += estimateILS;
    return `
      <tr>
        <td>${escapeHtml(entry.name)}</td>
        <td class="num">${ltr(entry.currency === 'USD' ? fmtUSD(entry.amount) : fmtILS(entry.amount))}</td>
        <td class="num">${ltr(entry.exposure + '%')}</td>
        <td class="num">${ltr(fmtHeDate(entryDate))}</td>
        <td class="num ${deltaClass(estimateILS - amountILS)}" style="font-weight:700;">${ltr(fmtILS(estimateILS))}</td>
        <td><button class="btn small ghost" data-del="${entry.id}">מחק</button></td>
      </tr>`;
  }).join('');

  document.getElementById('savingsTableBody').innerHTML = rows;
  document.getElementById('savingsTotal').innerHTML = ltr(fmtILS(totalEstimateILS)) + (list.length ? ` <span class="note">(מתוך ${ltr(fmtILS(totalOriginalILS))} מקורי)</span>` : '');
  document.getElementById('simAmount').placeholder = totalEstimateILS ? String(Math.round(totalEstimateILS)) : '';

  document.querySelectorAll('[data-del]').forEach(btn => btn.addEventListener('click', () => {
    if (!confirm('למחוק את הרשומה הזו?')) return;
    const id = btn.getAttribute('data-del');
    persistSavings(loadSavings().filter(e => String(e.id) !== id));
    renderSavingsTable();
  }));
}
function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

function wireSavingsForm() {
  document.getElementById('svDate').value = fmtISODate(new Date());
  document.getElementById('savingsForm').addEventListener('submit', e => {
    e.preventDefault();
    const name = document.getElementById('svName').value.trim();
    const amount = parseFloat(document.getElementById('svAmount').value);
    if (!name || !amount) return;
    const entry = {
      id: Date.now(),
      name,
      amount,
      currency: document.getElementById('svCurrency').value,
      exposure: parseFloat(document.getElementById('svExposure').value) || 0,
      date: document.getElementById('svDate').value || fmtISODate(new Date()),
    };
    const list = loadSavings(); list.push(entry); persistSavings(list);
    e.target.reset();
    document.getElementById('svDate').value = fmtISODate(new Date());
    document.getElementById('svExposure').value = 100;
    renderSavingsTable();
  });
}

/* ============================== settings ============================== */

function renderSettingsStatus() {
  const status = document.getElementById('apiKeyStatus');
  if (getApiKey()) {
    status.textContent = STATE.equityIsDemo
      ? `מפתח שמור, אך הבקשה נכשלה (${UI.lastError || 'שגיאה לא ידועה'}) — מוצגים נתוני הדגמה עד לתיקון.`
      : `מחובר בהצלחה. עוקב אחרי סימול ${STATE.equity.symbol}.`;
    status.style.color = STATE.equityIsDemo ? 'var(--critical)' : 'var(--good)';
  } else {
    status.textContent = 'לא הוגדר מפתח — מוצגים נתוני הדגמה בלבד.';
    status.style.color = 'var(--muted)';
  }
  document.getElementById('creditsNote').textContent = `כ-${creditsToday()} קריאות API נוצלו היום מתוך 800 (מכסת התוכנית החינמית).`;
}

function wireSettings() {
  document.getElementById('apiKeyInput').value = getApiKey();
  document.getElementById('apiKeyForm').addEventListener('submit', async e => {
    e.preventDefault();
    const key = document.getElementById('apiKeyInput').value.trim();
    if (!key) return;
    setApiKey(key);
    document.getElementById('apiKeyStatus').textContent = 'מתחבר…';
    await loadAll(true);
  });
  document.getElementById('clearKeyBtn').addEventListener('click', async () => {
    clearApiKey();
    await loadAll(true);
  });
  document.getElementById('resetAllBtn').addEventListener('click', () => {
    if (!confirm('פעולה זו תמחק את מפתח ה-API, את נתוני החיסכון השמורים ואת כל המטמון המקומי בדפדפן זה. להמשיך?')) return;
    localStorage.clear();
    location.reload();
  });

  const autoToggle = document.getElementById('autoRefreshToggle');
  const intervalSelect = document.getElementById('refreshIntervalSelect');
  autoToggle.checked = localStorage.getItem(LS.autoRefresh) === '1';
  intervalSelect.value = localStorage.getItem(LS.refreshInterval) || '300';
  autoToggle.addEventListener('change', () => { localStorage.setItem(LS.autoRefresh, autoToggle.checked ? '1' : '0'); applyAutoRefresh(); });
  intervalSelect.addEventListener('change', () => { localStorage.setItem(LS.refreshInterval, intervalSelect.value); applyAutoRefresh(); });
}

function applyAutoRefresh() {
  if (autoRefreshTimer) { clearInterval(autoRefreshTimer); autoRefreshTimer = null; }
  const enabled = localStorage.getItem(LS.autoRefresh) === '1' && !!getApiKey();
  if (!enabled) return;
  const secs = parseInt(localStorage.getItem(LS.refreshInterval) || '300', 10);
  autoRefreshTimer = setInterval(refreshLiveOnly, secs * 1000);
}

/* ============================== theme & tabs ============================== */

function applyStoredTheme() {
  const t = localStorage.getItem(LS.theme);
  if (t) document.documentElement.setAttribute('data-theme', t);
}
function wireTheme() {
  document.getElementById('themeBtn').addEventListener('click', () => {
    const isDark = getComputedStyle(document.documentElement).getPropertyValue('--surface').trim() === '#1a1a19';
    const next = isDark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(LS.theme, next);
    renderPeriodsTab();
  });
}

function switchView(name) {
  document.querySelectorAll('nav.tabs button').forEach(b => b.classList.toggle('active', b.getAttribute('data-view') === name));
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + name));
  if (name === 'periods') renderPeriodsTab();
}
function wireTabs() {
  document.querySelectorAll('nav.tabs button').forEach(b => b.addEventListener('click', () => switchView(b.getAttribute('data-view'))));
}

function wireRefreshButton() {
  document.getElementById('refreshBtn').addEventListener('click', () => loadAll(true));
}

/* ============================== init ============================== */

async function init() {
  applyStoredTheme();
  wireTabs();
  wireTheme();
  wireRefreshButton();
  buildPeriodPills();
  buildForecastPills();
  wireSimulator();
  wireSavingsForm();
  wireSettings();
  await loadAll(false);
  applyAutoRefresh();
}

document.addEventListener('DOMContentLoaded', init);
