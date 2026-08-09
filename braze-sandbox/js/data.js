/* ==========================================================================
   Braze Sandbox — seeded workspace data
   Vertical: hospitality (multi-brand hotel group, Fattal/Leonardo-style).
   Everything is generated from a fixed seed so audience counts are real and
   reproducible: change a filter, the number moves for a genuine reason.
   ========================================================================== */

const BZ = (window.BZ = window.BZ || {});

/* ---------- deterministic RNG (mulberry32) ------------------------------ */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20260809);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const pickw = (pairs) => {           // [[value, weight], ...]
  const total = pairs.reduce((s, p) => s + p[1], 0);
  let r = rnd() * total;
  for (const [v, w] of pairs) { if ((r -= w) <= 0) return v; }
  return pairs[pairs.length - 1][0];
};
const int = (min, max) => Math.floor(rnd() * (max - min + 1)) + min;
const chance = (p) => rnd() < p;

/* "today" for the whole sandbox — keeps relative dates stable */
BZ.NOW = new Date('2026-08-09T09:00:00Z');
const DAY = 86400000;
const daysFromNow = (d) => new Date(BZ.NOW.getTime() + d * DAY).toISOString();

/* ---------- workspace ---------------------------------------------------- */

BZ.workspace = {
  company: 'Aurelia Hotels Group',
  name: 'Aurelia Hotels — Production',
  appGroup: 'Aurelia Global',
  brands: ['Aurelia Royal', 'Aurelia Club', 'Aurelia Express', 'Herodion Collection', 'NYX Urban'],
  timezone: 'Asia/Jerusalem',
  currency: 'EUR',
  restApiKey: 'a1b2c3d4-5e6f-7890-abcd-ef1234567890',
  endpoint: 'https://rest.fra-02.braze.eu',
};

/* ---------- catalogs ----------------------------------------------------- */

BZ.catalogs = {
  hotels: {
    name: 'hotels',
    description: 'Property catalog synced nightly from the PMS.',
    fields: ['id', 'name', 'city', 'country', 'brand', 'rating', 'price_from', 'image_url', 'url', 'has_spa', 'family_friendly'],
    items: [
      { id: 'tlv-royal',   name: 'Aurelia Royal Tel Aviv',      city: 'Tel Aviv',  country: 'IL', brand: 'Aurelia Royal',      rating: 4.7, price_from: 289, has_spa: true,  family_friendly: false, image_url: 'https://cdn.aureliahotels.com/img/tlv-royal.jpg',   url: 'https://aureliahotels.com/tlv-royal' },
      { id: 'jer-herod',   name: 'Herodion Jerusalem',          city: 'Jerusalem', country: 'IL', brand: 'Herodion Collection',rating: 4.8, price_from: 340, has_spa: true,  family_friendly: true,  image_url: 'https://cdn.aureliahotels.com/img/jer-herod.jpg',   url: 'https://aureliahotels.com/jer-herod' },
      { id: 'eil-club',    name: 'Aurelia Club Eilat',          city: 'Eilat',     country: 'IL', brand: 'Aurelia Club',       rating: 4.4, price_from: 210, has_spa: true,  family_friendly: true,  image_url: 'https://cdn.aureliahotels.com/img/eil-club.jpg',    url: 'https://aureliahotels.com/eil-club' },
      { id: 'ded-spa',     name: 'Aurelia Dead Sea Spa',        city: 'Dead Sea',  country: 'IL', brand: 'Aurelia Royal',      rating: 4.6, price_from: 265, has_spa: true,  family_friendly: true,  image_url: 'https://cdn.aureliahotels.com/img/ded-spa.jpg',     url: 'https://aureliahotels.com/ded-spa' },
      { id: 'ber-nyx',     name: 'NYX Berlin Mitte',            city: 'Berlin',    country: 'DE', brand: 'NYX Urban',          rating: 4.3, price_from: 145, has_spa: false, family_friendly: false, image_url: 'https://cdn.aureliahotels.com/img/ber-nyx.jpg',     url: 'https://aureliahotels.com/ber-nyx' },
      { id: 'mun-royal',   name: 'Aurelia Royal Munich',        city: 'Munich',    country: 'DE', brand: 'Aurelia Royal',      rating: 4.5, price_from: 175, has_spa: true,  family_friendly: false, image_url: 'https://cdn.aureliahotels.com/img/mun-royal.jpg',   url: 'https://aureliahotels.com/mun-royal' },
      { id: 'lon-express', name: 'Aurelia Express London City', city: 'London',    country: 'GB', brand: 'Aurelia Express',    rating: 4.1, price_from: 132, has_spa: false, family_friendly: false, image_url: 'https://cdn.aureliahotels.com/img/lon-express.jpg', url: 'https://aureliahotels.com/lon-express' },
      { id: 'mad-nyx',     name: 'NYX Madrid Gran Via',         city: 'Madrid',    country: 'ES', brand: 'NYX Urban',          rating: 4.4, price_from: 155, has_spa: false, family_friendly: false, image_url: 'https://cdn.aureliahotels.com/img/mad-nyx.jpg',     url: 'https://aureliahotels.com/mad-nyx' },
      { id: 'bcn-club',    name: 'Aurelia Club Barcelona',      city: 'Barcelona', country: 'ES', brand: 'Aurelia Club',       rating: 4.5, price_from: 168, has_spa: true,  family_friendly: true,  image_url: 'https://cdn.aureliahotels.com/img/bcn-club.jpg',    url: 'https://aureliahotels.com/bcn-club' },
      { id: 'rom-herod',   name: 'Herodion Roma',               city: 'Rome',      country: 'IT', brand: 'Herodion Collection',rating: 4.7, price_from: 295, has_spa: true,  family_friendly: false, image_url: 'https://cdn.aureliahotels.com/img/rom-herod.jpg',   url: 'https://aureliahotels.com/rom-herod' },
      { id: 'ath-express', name: 'Aurelia Express Athens',      city: 'Athens',    country: 'GR', brand: 'Aurelia Express',    rating: 4.0, price_from: 118, has_spa: false, family_friendly: true,  image_url: 'https://cdn.aureliahotels.com/img/ath-express.jpg', url: 'https://aureliahotels.com/ath-express' },
      { id: 'vie-royal',   name: 'Aurelia Royal Vienna',        city: 'Vienna',    country: 'AT', brand: 'Aurelia Royal',      rating: 4.6, price_from: 198, has_spa: true,  family_friendly: false, image_url: 'https://cdn.aureliahotels.com/img/vie-royal.jpg',   url: 'https://aureliahotels.com/vie-royal' },
    ],
  },
  loyalty_rewards: {
    name: 'loyalty_rewards',
    description: 'Redeemable Aurelia Club rewards.',
    fields: ['id', 'name', 'points_cost', 'category'],
    items: [
      { id: 'rw-spa60',    name: '60-minute spa treatment', points_cost: 4500,  category: 'Wellness' },
      { id: 'rw-upgrade',  name: 'Room upgrade',            points_cost: 2500,  category: 'Stay' },
      { id: 'rw-dinner',   name: 'Dinner for two',          points_cost: 3200,  category: 'Dining' },
      { id: 'rw-latecheck',name: 'Late checkout 16:00',     points_cost: 800,   category: 'Stay' },
      { id: 'rw-night',    name: 'Free award night',        points_cost: 12000, category: 'Stay' },
    ],
  },
};

/* ---------- data schema (Data Settings screens) -------------------------- */

BZ.customAttributes = [
  { name: 'loyalty_tier',        type: 'String',   desc: 'Aurelia Club tier: Blue / Silver / Gold / Platinum' },
  { name: 'points_balance',      type: 'Number',   desc: 'Current redeemable loyalty points' },
  { name: 'lifetime_value',      type: 'Number',   desc: 'Gross booking revenue to date, EUR' },
  { name: 'total_stays',         type: 'Number',   desc: 'Completed stays to date' },
  { name: 'last_stay_date',      type: 'Date',     desc: 'Checkout date of the most recent stay' },
  { name: 'next_stay_date',      type: 'Date',     desc: 'Arrival date of the next confirmed booking' },
  { name: 'next_stay_hotel',     type: 'String',   desc: 'Property name for the next confirmed booking' },
  { name: 'next_stay_hotel_id',  type: 'String',   desc: 'Catalog key for the next confirmed booking' },
  { name: 'nights_booked',       type: 'Number',   desc: 'Nights on the next confirmed booking' },
  { name: 'preferred_brand',     type: 'String',   desc: 'Most-booked brand in the group' },
  { name: 'preferred_city',      type: 'String',   desc: 'Most-booked destination' },
  { name: 'travels_with_kids',   type: 'Boolean',  desc: 'Any booking with a child occupant' },
  { name: 'business_traveller',  type: 'Boolean',  desc: 'Majority of stays are midweek, 1–2 nights' },
  { name: 'has_app',             type: 'Boolean',  desc: 'Installed the Aurelia mobile app' },
  { name: 'spa_booker',          type: 'Boolean',  desc: 'Booked a spa treatment at least once' },
  { name: 'abandoned_hotel_id',  type: 'String',   desc: 'Catalog key of the last abandoned search/booking' },
  { name: 'review_score_given',  type: 'Number',   desc: 'Most recent post-stay review score, 1–10' },
];

BZ.customEvents = [
  { name: 'booking_started',        props: ['hotel_id', 'hotel_name', 'city', 'check_in', 'nights', 'adults', 'children', 'rate_plan', 'total_price'] },
  { name: 'booking_completed',      props: ['hotel_id', 'hotel_name', 'city', 'check_in', 'nights', 'total_price', 'rate_plan', 'confirmation_code'] },
  { name: 'booking_cancelled',      props: ['hotel_id', 'reason', 'refund_amount'] },
  { name: 'search_performed',       props: ['city', 'check_in', 'nights', 'guests'] },
  { name: 'checked_in',             props: ['hotel_id', 'hotel_name', 'room_type'] },
  { name: 'checked_out',            props: ['hotel_id', 'hotel_name', 'nights', 'folio_total'] },
  { name: 'review_submitted',       props: ['hotel_id', 'score', 'has_comment'] },
  { name: 'spa_booked',             props: ['hotel_id', 'treatment', 'price'] },
  { name: 'points_redeemed',        props: ['reward_id', 'reward_name', 'points_cost'] },
  { name: 'app_opened',             props: [] },
  { name: 'newsletter_signup',      props: ['source'] },
];

BZ.subscriptionGroups = [
  { id: 'sg-promos',   name: 'Promotions & Offers',      channel: 'Email', desc: 'Rate drops, seasonal campaigns, flash sales.' },
  { id: 'sg-loyalty',  name: 'Aurelia Club News',        channel: 'Email', desc: 'Tier changes, points expiry, member-only rates.' },
  { id: 'sg-tripinfo', name: 'Trip Information',         channel: 'Email', desc: 'Transactional pre-arrival and on-property messaging.' },
  { id: 'sg-sms',      name: 'SMS — Stay Updates',       channel: 'SMS',   desc: 'Check-in ready, room ready, checkout reminders.' },
];

/* ---------- user generation --------------------------------------------- */

const FIRST = ['Noa','Yotam','Maya','Daniel','Shira','Omer','Tamar','Eitan','Lior','Adi','Yael','Nadav','Roni','Amit','Talia','Guy',
  'Sofia','Lukas','Emma','Jonas','Marta','Andreas','Elena','Pieter','Chiara','Matteo','Ana','Diego','Clara','Felix','Hannah','Nikos',
  'Isabelle','Thomas','Julia','Oliver','Charlotte','Henry','Amelia','Jack'];
const LAST = ['Levi','Katz','Mizrahi','Golan','Peretz','Ben-Ami','Shapiro','Avraham','Barak','Regev',
  'Müller','Schmidt','Weber','Fischer','Rossi','Ferrari','Garcia','Lopez','Martin','Dubois',
  'Novak','Kowalski','Andersen','Nilsson','Papadopoulos','Smith','Jones','Taylor','Brown','Wilson'];
const CITIES = [['Tel Aviv','IL','he'],['Jerusalem','IL','he'],['Haifa','IL','he'],['Berlin','DE','de'],['Munich','DE','de'],
  ['London','GB','en'],['Manchester','GB','en'],['Madrid','ES','es'],['Barcelona','ES','es'],['Rome','IT','it'],
  ['Milan','IT','it'],['Paris','FR','fr'],['Vienna','AT','de'],['Athens','GR','en'],['Amsterdam','NL','en']];
const RATE_PLANS = ['Flexible','Non-refundable','Member Rate','Bed & Breakfast','Half Board','Corporate'];
const ROOM_TYPES = ['Standard King','Deluxe Twin','Executive Suite','Family Room','Sea View Deluxe'];

function tierFor(ltv, stays) {
  if (ltv >= 12000 || stays >= 14) return 'Platinum';
  if (ltv >= 5000  || stays >= 7)  return 'Gold';
  if (ltv >= 1500  || stays >= 3)  return 'Silver';
  return 'Blue';
}

function makeUser(i) {
  const first = pick(FIRST), last = pick(LAST);
  const [city, country, lang] = pick(CITIES);
  const hotels = BZ.catalogs.hotels.items;

  const stays = pickw([[0, 14], [1, 20], [2, 16], [3, 12], [5, 12], [8, 10], [12, 8], [18, 5], [26, 3]]);
  const avgNight = int(110, 340);
  const ltv = Math.round(stays * avgNight * int(1, 4) / 10) * 10;

  const prefHotel = pick(hotels);
  const hasFuture = stays > 0 ? chance(0.34) : chance(0.12);
  const futureHotel = pick(hotels);
  const nextIn = hasFuture ? int(1, 95) : null;

  const lastStayDaysAgo = stays > 0 ? pickw([[3, 10], [12, 14], [31, 18], [70, 18], [140, 16], [260, 14], [420, 10]]) + int(0, 9) : null;
  const lastEngagedDaysAgo = pickw([[1, 16], [5, 18], [14, 18], [35, 16], [80, 14], [180, 10], [400, 8]]) + int(0, 6);

  const tier = tierFor(ltv, stays);
  const abandoned = chance(0.22);
  const abandonedHotel = pick(hotels);

  const emailSub = pickw([['subscribed', 62], ['opted_in', 24], ['unsubscribed', 14]]);
  const hasApp = chance(0.41);

  const u = {
    external_id: 'AUR-' + String(100000 + i),
    braze_id: '65f' + (i * 7919).toString(16).padStart(9, '0'),
    first_name: first,
    last_name: last,
    email: `${first}.${last}`.toLowerCase().replace(/[^a-z.]/g, '') + i + '@example.com',
    phone: '+972-5' + int(0, 8) + '-' + int(1000000, 9999999),
    country, city, language: lang,
    time_zone: country === 'IL' ? 'Asia/Jerusalem' : country === 'GB' ? 'Europe/London' : 'Europe/Berlin',
    gender: pickw([['F', 48], ['M', 48], ['O', 4]]),
    age: int(23, 68),
    email_subscribe: emailSub,
    push_subscribe: hasApp ? pickw([['opted_in', 70], ['subscribed', 20], ['unsubscribed', 10]]) : 'unsubscribed',
    subscription_groups: {
      'sg-promos':   emailSub === 'unsubscribed' ? 'unsubscribed' : pickw([['subscribed', 74], ['unsubscribed', 26]]),
      'sg-loyalty':  emailSub === 'unsubscribed' ? 'unsubscribed' : pickw([['subscribed', 86], ['unsubscribed', 14]]),
      'sg-tripinfo': 'subscribed',
      'sg-sms':      hasApp ? pickw([['subscribed', 55], ['unsubscribed', 45]]) : 'unsubscribed',
    },
    last_engaged_days_ago: lastEngagedDaysAgo,
    sessions_last_30d: hasApp ? int(0, 22) : int(0, 4),
    custom: {
      loyalty_tier: tier,
      points_balance: tier === 'Blue' ? int(0, 900) : tier === 'Silver' ? int(600, 4200) : tier === 'Gold' ? int(2500, 11000) : int(8000, 42000),
      lifetime_value: ltv,
      total_stays: stays,
      last_stay_date: lastStayDaysAgo == null ? null : daysFromNow(-lastStayDaysAgo),
      next_stay_date: hasFuture ? daysFromNow(nextIn) : null,
      next_stay_hotel: hasFuture ? futureHotel.name : null,
      next_stay_hotel_id: hasFuture ? futureHotel.id : null,
      nights_booked: hasFuture ? int(1, 7) : null,
      preferred_brand: stays > 0 ? prefHotel.brand : null,
      preferred_city: stays > 0 ? prefHotel.city : null,
      travels_with_kids: chance(0.33),
      business_traveller: chance(0.29),
      has_app: hasApp,
      spa_booker: chance(0.26),
      abandoned_hotel_id: abandoned ? abandonedHotel.id : null,
      review_score_given: stays > 0 && chance(0.55) ? int(5, 10) : null,
    },
    events: [],
    messages: [],
  };

  /* event history — drives "performed event X times in last Y days" filters */
  const push = (name, daysAgo, props) => u.events.push({ name, time: daysFromNow(-daysAgo), properties: props || {} });

  for (let s = 0; s < Math.min(stays, 6); s++) {
    const h = chance(0.6) ? prefHotel : pick(hotels);
    const ago = (lastStayDaysAgo || 200) + s * int(30, 160);
    const nights = int(1, 6);
    push('booking_completed', ago + 20, { hotel_id: h.id, hotel_name: h.name, city: h.city, nights, total_price: nights * int(120, 380), rate_plan: pick(RATE_PLANS), confirmation_code: 'AUR' + int(100000, 999999) });
    push('checked_in',  ago,     { hotel_id: h.id, hotel_name: h.name, room_type: pick(ROOM_TYPES) });
    push('checked_out', ago - nights, { hotel_id: h.id, hotel_name: h.name, nights, folio_total: nights * int(130, 420) });
    if (chance(0.45)) push('review_submitted', ago - nights - int(1, 6), { hotel_id: h.id, score: int(6, 10), has_comment: chance(0.5) });
    if (u.custom.spa_booker && chance(0.5)) push('spa_booked', ago - 1, { hotel_id: h.id, treatment: pick(['Deep tissue', 'Hot stone', 'Aromatherapy']), price: int(70, 180) });
  }
  if (abandoned) {
    const h = abandonedHotel, nights = int(1, 5);
    push('search_performed', int(1, 9), { city: h.city, check_in: daysFromNow(int(10, 70)).slice(0, 10), nights, guests: int(1, 4) });
    push('booking_started', int(0, 6), { hotel_id: h.id, hotel_name: h.name, city: h.city, check_in: daysFromNow(int(10, 70)).slice(0, 10), nights, adults: int(1, 3), children: chance(0.3) ? int(1, 2) : 0, rate_plan: pick(RATE_PLANS), total_price: nights * int(130, 340) });
  }
  if (hasFuture) {
    const h = futureHotel;
    push('booking_completed', int(1, 40), { hotel_id: h.id, hotel_name: h.name, city: h.city, check_in: daysFromNow(nextIn).slice(0, 10), nights: u.custom.nights_booked, total_price: u.custom.nights_booked * int(140, 360), rate_plan: pick(RATE_PLANS), confirmation_code: 'AUR' + int(100000, 999999) });
  }
  if (hasApp) for (let k = 0; k < int(0, 12); k++) push('app_opened', int(0, 30));
  if (u.custom.points_balance > 2000 && chance(0.3)) {
    const rw = pick(BZ.catalogs.loyalty_rewards.items);
    push('points_redeemed', int(5, 120), { reward_id: rw.id, reward_name: rw.name, points_cost: rw.points_cost });
  }

  /* message history shown on the profile Engagement tab */
  const msgNames = ['Welcome to Aurelia Club', 'Summer Escapes — up to 25% off', 'Your stay at %h is coming up', 'How was your stay?', 'Your points expire soon'];
  for (let m = 0; m < int(0, 5); m++) {
    const opened = chance(0.42);
    u.messages.push({
      name: pick(msgNames).replace('%h', prefHotel.name),
      channel: pickw([['Email', 70], ['Push', 20], ['SMS', 10]]),
      sent: daysFromNow(-int(1, 120)),
      opened, clicked: opened && chance(0.3),
    });
  }
  u.events.sort((a, b) => new Date(b.time) - new Date(a.time));
  u.messages.sort((a, b) => new Date(b.sent) - new Date(a.sent));
  return u;
}

BZ.users = Array.from({ length: 240 }, (_, i) => makeUser(i));

/* A few hand-pinned profiles so lessons can reference stable, illustrative users. */
(function pinShowcaseUsers() {
  const hotels = BZ.catalogs.hotels.items;
  const jer = hotels.find(h => h.id === 'jer-herod');
  const eil = hotels.find(h => h.id === 'eil-club');

  Object.assign(BZ.users[0], {
    external_id: 'AUR-100000', first_name: 'Maya', last_name: 'Levi',
    email: 'maya.levi@example.com', country: 'IL', city: 'Tel Aviv', language: 'he',
    email_subscribe: 'opted_in', push_subscribe: 'opted_in', last_engaged_days_ago: 2,
  });
  Object.assign(BZ.users[0].custom, {
    loyalty_tier: 'Platinum', points_balance: 18400, lifetime_value: 24600, total_stays: 21,
    last_stay_date: daysFromNow(-26), next_stay_date: daysFromNow(9), next_stay_hotel: jer.name,
    next_stay_hotel_id: jer.id, nights_booked: 3, preferred_brand: 'Herodion Collection',
    preferred_city: 'Jerusalem', travels_with_kids: false, business_traveller: true,
    has_app: true, spa_booker: true, abandoned_hotel_id: null, review_score_given: 9,
  });
  BZ.users[0].subscription_groups = { 'sg-promos': 'subscribed', 'sg-loyalty': 'subscribed', 'sg-tripinfo': 'subscribed', 'sg-sms': 'subscribed' };
  /* Maya has no abandoned booking, so she must not carry a dangling
     booking_started — otherwise she shows up in the abandoners segment while
     her abandoned_hotel_id is null, and the sandbox teaches a false lesson. */
  BZ.users[0].events = BZ.users[0].events.filter((e) => e.name !== 'booking_started' && e.name !== 'search_performed');

  Object.assign(BZ.users[1], {
    external_id: 'AUR-100001', first_name: 'Jonas', last_name: 'Weber',
    email: 'jonas.weber@example.com', country: 'DE', city: 'Berlin', language: 'de',
    email_subscribe: 'subscribed', push_subscribe: 'unsubscribed', last_engaged_days_ago: 1,
  });
  Object.assign(BZ.users[1].custom, {
    loyalty_tier: 'Blue', points_balance: 320, lifetime_value: 0, total_stays: 0,
    last_stay_date: null, next_stay_date: null, next_stay_hotel: null, next_stay_hotel_id: null,
    nights_booked: null, preferred_brand: null, preferred_city: null, travels_with_kids: true,
    business_traveller: false, has_app: false, spa_booker: false,
    abandoned_hotel_id: eil.id, review_score_given: null,
  });
  BZ.users[1].events.unshift({
    name: 'booking_started', time: daysFromNow(-0.2),
    properties: { hotel_id: eil.id, hotel_name: eil.name, city: 'Eilat', check_in: daysFromNow(34).slice(0, 10), nights: 4, adults: 2, children: 2, rate_plan: 'Half Board', total_price: 1180 },
  });
})();

BZ.userById = (id) => BZ.users.find(u => u.external_id === id);

/* ---------- content blocks ---------------------------------------------- */

BZ.contentBlocks = [
  {
    id: 'cb-header',
    name: 'aurelia_header',
    description: 'Brand bar used at the top of every marketing email.',
    content:
`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0F1B2D;">
  <tr><td align="center" style="padding:18px 0;">
    <span style="font:700 20px/1 Helvetica,Arial,sans-serif;color:#ffffff;letter-spacing:2px;">AURELIA HOTELS</span>
  </td></tr>
</table>`,
  },
  {
    id: 'cb-footer',
    name: 'aurelia_footer',
    description: 'Legal footer with the unsubscribe link. Required on all promotional sends.',
    content:
`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F7;">
  <tr><td align="center" style="padding:22px 24px;font:400 12px/1.6 Helvetica,Arial,sans-serif;color:#6E6E7C;">
    Aurelia Hotels Group · 14 Rothschild Blvd, Tel Aviv<br>
    You are receiving this because you are an Aurelia Club member.<br>
    <a href="{{\${set_user_to_unsubscribed_url}}}" style="color:#6E6E7C;">Unsubscribe</a> ·
    <a href="https://aureliahotels.com/preferences" style="color:#6E6E7C;">Manage preferences</a>
  </td></tr>
</table>`,
  },
  {
    id: 'cb-tierbadge',
    name: 'tier_badge',
    description: 'Loyalty tier pill. Reads custom_attribute.${loyalty_tier} directly.',
    content:
`<span style="display:inline-block;padding:4px 12px;border-radius:999px;background:#F3E8FD;color:#5B10A0;font:700 12px Helvetica,Arial,sans-serif;">
  {{custom_attribute.\${loyalty_tier}}} MEMBER
</span>`,
  },
];

/* ---------- segments ----------------------------------------------------- */
/* filters use the engine in segments.js: {field, op, value, value2} */

BZ.segments = [
  {
    id: 'seg-all', name: 'All Users', description: 'Everyone in the workspace.',
    filters: [], createdBy: 'System', tags: [],
  },
  {
    id: 'seg-club-gold', name: 'Aurelia Club — Gold & Platinum',
    description: 'High-value members eligible for member-only rates and upgrades.',
    filters: [{ field: 'custom.loyalty_tier', op: 'is_one_of', value: ['Gold', 'Platinum'] }],
    createdBy: 'Maya (CRM)', tags: ['loyalty'],
  },
  {
    id: 'seg-upcoming-stay', name: 'Arriving in the next 14 days',
    description: 'Pre-arrival window. Trip Information subscribers only.',
    filters: [
      { field: 'custom.next_stay_date', op: 'date_in_next_days', value: 14 },
      { field: 'subscription.sg-tripinfo', op: 'equals', value: 'subscribed' },
    ],
    createdBy: 'Maya (CRM)', tags: ['lifecycle'],
  },
  {
    id: 'seg-abandoners', name: 'Booking abandoners — last 7 days',
    description: 'Started a booking but no booking_completed since. Promotions opt-in required.',
    filters: [
      { field: 'event.booking_started', op: 'performed_in_last_days', value: 7 },
      { field: 'event.booking_completed', op: 'not_performed_in_last_days', value: 7 },
      { field: 'subscription.sg-promos', op: 'equals', value: 'subscribed' },
    ],
    createdBy: 'Maya (CRM)', tags: ['acquisition', 'always-on'],
  },
  {
    id: 'seg-lapsed', name: 'Lapsed guests — 180+ days',
    description: 'Stayed before, nothing since. Win-back audience.',
    filters: [
      { field: 'custom.total_stays', op: 'gte', value: 1 },
      { field: 'custom.last_stay_date', op: 'date_before_days_ago', value: 180 },
      { field: 'email_subscribe', op: 'is_not', value: 'unsubscribed' },
    ],
    createdBy: 'Maya (CRM)', tags: ['winback'],
  },
  {
    id: 'seg-family-il', name: 'Israeli families — spa & resort',
    description: 'Local families who travel with children. Eilat / Dead Sea targeting.',
    filters: [
      { field: 'country', op: 'equals', value: 'IL' },
      { field: 'custom.travels_with_kids', op: 'is_true' },
      { field: 'custom.total_stays', op: 'gte', value: 1 },
    ],
    createdBy: 'Omer (Growth)', tags: ['segmented-offer'],
  },
  {
    id: 'seg-points-expiry', name: 'Points at risk — 5,000+ and dormant',
    description: 'Large balance, no engagement for 90 days. Points-expiry nudge.',
    filters: [
      { field: 'custom.points_balance', op: 'gte', value: 5000 },
      { field: 'last_engaged_days_ago', op: 'gte', value: 90 },
      { field: 'subscription.sg-loyalty', op: 'equals', value: 'subscribed' },
    ],
    createdBy: 'Maya (CRM)', tags: ['loyalty', 'retention'],
  },
  {
    id: 'seg-app-users', name: 'App users — push reachable',
    description: 'Has the app and is opted in to push.',
    filters: [
      { field: 'custom.has_app', op: 'is_true' },
      { field: 'push_subscribe', op: 'equals', value: 'opted_in' },
    ],
    createdBy: 'System', tags: ['channel'],
  },
  {
    id: 'seg-never-booked', name: 'Registered, never booked',
    description: 'Signed up but zero completed stays. Onboarding / first-booking push.',
    filters: [
      { field: 'custom.total_stays', op: 'equals', value: 0 },
      { field: 'email_subscribe', op: 'is_not', value: 'unsubscribed' },
    ],
    createdBy: 'Omer (Growth)', tags: ['onboarding'],
  },
  {
    id: 'seg-business', name: 'Business travellers — DACH & UK',
    description: 'Midweek short stays out of Germany, Austria and the UK.',
    filters: [
      { field: 'custom.business_traveller', op: 'is_true' },
      { field: 'country', op: 'is_one_of', value: ['DE', 'AT', 'GB'] },
    ],
    createdBy: 'Omer (Growth)', tags: ['corporate'],
  },
];

/* ---------- email templates --------------------------------------------- */

const TPL_ABANDON =
`{{content_blocks.\${aurelia_header}}}
{% catalog_items hotels {{custom_attribute.\${abandoned_hotel_id}}} %}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;">
  <tr><td align="center" style="padding:34px 24px 8px;">
    <h1 style="margin:0;font:700 26px/1.3 Helvetica,Arial,sans-serif;color:#0F1B2D;">
      Still thinking about {{items[0].city}}, {{\${first_name} | default: 'there'}}?
    </h1>
    <p style="margin:12px 0 0;font:400 15px/1.6 Helvetica,Arial,sans-serif;color:#43434E;">
      Your dates at <strong>{{items[0].name}}</strong> are still available — from
      €{{items[0].price_from}} per night.
    </p>
  </td></tr>
  <tr><td align="center" style="padding:20px 24px;">
    <img src="{{items[0].image_url}}" width="520" alt="{{items[0].name}}" style="max-width:100%;border-radius:8px;">
  </td></tr>
  {% if custom_attribute.\${loyalty_tier} != 'Blue' %}
  <tr><td align="center" style="padding:0 24px 14px;">
    {{content_blocks.\${tier_badge}}}
    <p style="margin:10px 0 0;font:400 14px/1.6 Helvetica,Arial,sans-serif;color:#5B10A0;">
      Members save an extra 10% — the discount is applied at checkout.
    </p>
  </td></tr>
  {% endif %}
  <tr><td align="center" style="padding:6px 24px 34px;">
    <a href="{{items[0].url}}?utm_source=braze&utm_campaign=abandoned_booking"
       style="display:inline-block;padding:14px 30px;border-radius:6px;background:#801ED7;color:#ffffff;font:700 15px Helvetica,Arial,sans-serif;text-decoration:none;">
      Complete my booking
    </a>
  </td></tr>
</table>
{{content_blocks.\${aurelia_footer}}}`;

const TPL_PREARRIVAL =
`{{content_blocks.\${aurelia_header}}}
{% assign nights = custom_attribute.\${nights_booked} %}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;">
  <tr><td style="padding:34px 30px 10px;">
    <h1 style="margin:0;font:700 25px/1.3 Helvetica,Arial,sans-serif;color:#0F1B2D;">
      {{\${first_name}}}, we're getting your room ready
    </h1>
    <p style="margin:14px 0 0;font:400 15px/1.7 Helvetica,Arial,sans-serif;color:#43434E;">
      You arrive at <strong>{{custom_attribute.\${next_stay_hotel}}}</strong> on
      {{custom_attribute.\${next_stay_date} | date: '%A, %B %e'}} for
      {{nights}} night{% if nights > 1 %}s{% endif %}.
    </p>
  </td></tr>
  <tr><td style="padding:14px 30px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E3E3EB;border-radius:8px;">
      <tr><td style="padding:16px 18px;font:400 14px/1.8 Helvetica,Arial,sans-serif;color:#43434E;">
        <strong style="color:#0F1B2D;">Check-in</strong> from 15:00<br>
        <strong style="color:#0F1B2D;">Check-out</strong> until 11:00
        {% if custom_attribute.\${loyalty_tier} == 'Platinum' %}
          — as a Platinum member, late checkout until 16:00 is already on your reservation.
        {% elsif custom_attribute.\${loyalty_tier} == 'Gold' %}
          — Gold members can request 14:00 checkout at the desk.
        {% endif %}
      </td></tr>
    </table>
  </td></tr>
  {% if custom_attribute.\${travels_with_kids} == true %}
  <tr><td style="padding:6px 30px 0;">
    <p style="margin:0;font:400 14px/1.7 Helvetica,Arial,sans-serif;color:#43434E;">
      Travelling with children? Kids' club runs 09:00–17:00 and cots are free of charge — just reply to reserve one.
    </p>
  </td></tr>
  {% endif %}
  <tr><td style="padding:22px 30px 34px;">
    <a href="https://aureliahotels.com/checkin?conf={{\${user_id}}}"
       style="display:inline-block;padding:14px 30px;border-radius:6px;background:#801ED7;color:#ffffff;font:700 15px Helvetica,Arial,sans-serif;text-decoration:none;">
      Check in online
    </a>
  </td></tr>
</table>
{{content_blocks.\${aurelia_footer}}}`;

const TPL_WINBACK =
`{{content_blocks.\${aurelia_header}}}
{% assign months_away = 6 %}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;">
  <tr><td align="center" style="padding:36px 28px 6px;">
    <h1 style="margin:0;font:700 27px/1.3 Helvetica,Arial,sans-serif;color:#0F1B2D;">
      It's been a while, {{\${first_name} | default: 'traveller'}}
    </h1>
    <p style="margin:14px 0 0;font:400 15px/1.7 Helvetica,Arial,sans-serif;color:#43434E;">
      Your last stay with us was at
      <strong>{{custom_attribute.\${preferred_city} | default: 'one of our hotels'}}</strong>.
      Here's 20% off your next one — and
      {{custom_attribute.\${points_balance} | number_with_delimiter}} points still waiting in your account.
    </p>
  </td></tr>
  <tr><td align="center" style="padding:24px 28px;">
    <div style="display:inline-block;border:2px dashed #801ED7;border-radius:8px;padding:16px 34px;">
      <span style="font:700 22px Helvetica,Arial,sans-serif;color:#801ED7;letter-spacing:3px;">WELCOMEBACK20</span>
    </div>
  </td></tr>
  <tr><td align="center" style="padding:4px 28px 36px;">
    <a href="https://aureliahotels.com/offers?code=WELCOMEBACK20"
       style="display:inline-block;padding:14px 30px;border-radius:6px;background:#801ED7;color:#ffffff;font:700 15px Helvetica,Arial,sans-serif;text-decoration:none;">
      Browse destinations
    </a>
  </td></tr>
</table>
{{content_blocks.\${aurelia_footer}}}`;

const TPL_POSTSTAY =
`{{content_blocks.\${aurelia_header}}}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;">
  <tr><td align="center" style="padding:36px 28px 8px;">
    <h1 style="margin:0;font:700 25px/1.3 Helvetica,Arial,sans-serif;color:#0F1B2D;">
      How was your stay, {{\${first_name}}}?
    </h1>
    <p style="margin:12px 0 0;font:400 15px/1.7 Helvetica,Arial,sans-serif;color:#43434E;">
      Two minutes of your time helps the team at
      {{event_properties.\${hotel_name} | default: 'your hotel'}} get better.
    </p>
  </td></tr>
  <tr><td align="center" style="padding:20px 28px 34px;">
    {% for score in (1..5) %}
      <a href="https://aureliahotels.com/review?score={{score}}&u={{\${user_id}}}"
         style="display:inline-block;width:44px;height:44px;line-height:44px;margin:0 4px;border-radius:50%;background:#F3E8FD;color:#5B10A0;font:700 16px Helvetica,Arial,sans-serif;text-decoration:none;">{{score}}</a>
    {% endfor %}
  </td></tr>
</table>
{{content_blocks.\${aurelia_footer}}}`;

/* previewUser: filters (same shape as segments) picking a profile for whom this
   template is meaningful — Braze previews against a user from the target
   audience, and a template previewed against someone who does not qualify
   looks broken for the wrong reason. The "Edge case" button in the composer
   deliberately overrides this to show what a null-heavy profile receives.     */
BZ.templates = [
  { id: 'tpl-abandon',    name: 'Abandoned booking — catalog',    channel: 'Email',
    subject: '{% catalog_items hotels {{custom_attribute.${abandoned_hotel_id}}} %}Your room in {{items[0].city}} is still available',
    preheader: 'Pick up where you left off', fromName: 'Aurelia Hotels', fromEmail: 'stay@aureliahotels.com', replyTo: 'hello@aureliahotels.com', body: TPL_ABANDON, tags: ['always-on'],
    previewUser: [{ field: 'custom.abandoned_hotel_id', op: 'exists' }] },
  { id: 'tpl-prearrival', name: 'Pre-arrival — 3 days out',        channel: 'Email', subject: '{{${first_name}}}, your stay at {{custom_attribute.${next_stay_hotel}}} starts soon', preheader: 'Check in online and skip the front desk queue', fromName: 'Aurelia Hotels', fromEmail: 'stay@aureliahotels.com', replyTo: 'hello@aureliahotels.com', body: TPL_PREARRIVAL, tags: ['lifecycle'],
    previewUser: [{ field: 'custom.next_stay_date', op: 'exists' }] },
  { id: 'tpl-winback',    name: 'Win-back — 20% off',              channel: 'Email', subject: 'We saved you 20%, {{${first_name} | default: \'traveller\'}}', preheader: 'Your points are still here too', fromName: 'Aurelia Hotels', fromEmail: 'offers@aureliahotels.com', replyTo: 'hello@aureliahotels.com', body: TPL_WINBACK, tags: ['winback'],
    previewUser: [{ field: 'custom.total_stays', op: 'gte', value: 1 }, { field: 'custom.points_balance', op: 'gte', value: 1000 }] },
  { id: 'tpl-poststay',   name: 'Post-stay review request',        channel: 'Email', subject: 'How was {{event_properties.${hotel_name} | default: \'your stay\'}}?', preheader: 'Rate your stay in two minutes', fromName: 'Aurelia Hotels', fromEmail: 'stay@aureliahotels.com', replyTo: 'hello@aureliahotels.com', body: TPL_POSTSTAY, tags: ['lifecycle'],
    previewUser: [{ field: 'event.checked_out', op: 'performed_ever' }] },
];

/* ---------- campaigns ---------------------------------------------------- */

function series(n, base, drift) {
  return Array.from({ length: n }, (_, i) => Math.max(0, Math.round(base * (1 + drift * Math.sin(i / 2.1)) * (0.85 + rnd() * 0.3))));
}

BZ.campaigns = [
  {
    id: 'cmp-abandon', name: 'Abandoned booking — 4h reminder', status: 'active',
    channels: ['Email'], deliveryType: 'action_based',
    trigger: { event: 'booking_started', delay: '4 hours', exception: 'booking_completed' },
    segmentId: 'seg-abandoners', templateId: 'tpl-abandon',
    conversionEvents: [{ event: 'booking_completed', window: '72 hours', primary: true }],
    stats: { sent: 18420, delivered: 18093, opens: 7961, clicks: 1683, conversions: 421, revenue: 168400, unsubscribes: 62, bounces: 327 },
    createdBy: 'Maya (CRM)', updated: daysFromNow(-3), tags: ['always-on', 'revenue'],
  },
  {
    id: 'cmp-prearrival', name: 'Pre-arrival — check-in online', status: 'active',
    channels: ['Email', 'Push'], deliveryType: 'action_based',
    trigger: { event: 'next_stay_date is in 3 days', delay: 'send at 10:00 local time' },
    segmentId: 'seg-upcoming-stay', templateId: 'tpl-prearrival',
    conversionEvents: [{ event: 'checked_in', window: '7 days', primary: true }],
    stats: { sent: 9640, delivered: 9578, opens: 6033, clicks: 2411, conversions: 1889, revenue: 0, unsubscribes: 9, bounces: 62 },
    createdBy: 'Maya (CRM)', updated: daysFromNow(-11), tags: ['lifecycle'],
  },
  {
    id: 'cmp-summer', name: 'Summer Escapes — Eilat & Dead Sea', status: 'active',
    channels: ['Email'], deliveryType: 'scheduled',
    trigger: { schedule: 'One-time · 2026-07-14 09:00 local' },
    segmentId: 'seg-family-il', templateId: 'tpl-winback',
    conversionEvents: [{ event: 'booking_completed', window: '5 days', primary: true }],
    abTest: {
      metric: 'Conversion rate',
      variants: [
        { name: 'Variant A — "Summer Escapes"',     pct: 45, sent: 5400, opens: 2214, clicks: 486, conversions: 119 },
        { name: 'Variant B — "Up to 25% off"',      pct: 45, sent: 5400, opens: 2538, clicks: 621, conversions: 168 },
        { name: 'Control — holdout',                pct: 10, sent: 1200, opens: 0,    clicks: 0,   conversions: 14 },
      ],
    },
    stats: { sent: 12000, delivered: 11764, opens: 4752, clicks: 1107, conversions: 301, revenue: 219700, unsubscribes: 148, bounces: 236 },
    createdBy: 'Omer (Growth)', updated: daysFromNow(-26), tags: ['seasonal'],
  },
  {
    id: 'cmp-points', name: 'Points expiring in 30 days', status: 'scheduled',
    channels: ['Email'], deliveryType: 'scheduled',
    trigger: { schedule: 'Recurring · monthly on the 1st, 08:00 local' },
    segmentId: 'seg-points-expiry', templateId: 'tpl-winback',
    conversionEvents: [{ event: 'points_redeemed', window: '30 days', primary: true }, { event: 'booking_completed', window: '30 days', primary: false }],
    stats: { sent: 0, delivered: 0, opens: 0, clicks: 0, conversions: 0, revenue: 0, unsubscribes: 0, bounces: 0 },
    createdBy: 'Maya (CRM)', updated: daysFromNow(-2), tags: ['loyalty'],
  },
  {
    id: 'cmp-poststay', name: 'Post-stay review request', status: 'active',
    channels: ['Email'], deliveryType: 'action_based',
    trigger: { event: 'checked_out', delay: '18 hours' },
    segmentId: 'seg-all', templateId: 'tpl-poststay',
    conversionEvents: [{ event: 'review_submitted', window: '5 days', primary: true }],
    stats: { sent: 24310, delivered: 24019, opens: 11048, clicks: 4083, conversions: 2941, revenue: 0, unsubscribes: 41, bounces: 291 },
    createdBy: 'Maya (CRM)', updated: daysFromNow(-40), tags: ['lifecycle'],
  },
  {
    id: 'cmp-nyx', name: 'NYX Urban — city break flash sale', status: 'draft',
    channels: ['Email', 'SMS'], deliveryType: 'scheduled',
    trigger: { schedule: 'Not scheduled' },
    segmentId: 'seg-business', templateId: 'tpl-winback',
    conversionEvents: [{ event: 'booking_completed', window: '48 hours', primary: true }],
    stats: { sent: 0, delivered: 0, opens: 0, clicks: 0, conversions: 0, revenue: 0, unsubscribes: 0, bounces: 0 },
    createdBy: 'Omer (Growth)', updated: daysFromNow(-1), tags: ['flash'],
  },
  {
    id: 'cmp-winback-old', name: 'Win-back Q1 — 20% off', status: 'stopped',
    channels: ['Email'], deliveryType: 'scheduled',
    trigger: { schedule: 'One-time · 2026-02-18 09:00 local' },
    segmentId: 'seg-lapsed', templateId: 'tpl-winback',
    conversionEvents: [{ event: 'booking_completed', window: '14 days', primary: true }],
    stats: { sent: 31200, delivered: 29844, opens: 8654, clicks: 1441, conversions: 288, revenue: 141600, unsubscribes: 604, bounces: 1356 },
    createdBy: 'Maya (CRM)', updated: daysFromNow(-172), tags: ['winback'],
  },
];

BZ.campaigns.forEach(c => { c.trend = series(14, c.stats.sent / 14 || 0, 0.35); });

/* ---------- canvases ----------------------------------------------------- */
/* step shapes:
   entry | message | delay | action_paths | audience_paths | experiment_paths |
   webhook | update_user | exit
   children live on step.paths = [{label, steps:[...]}, ...] for path steps    */

BZ.canvases = [
  {
    id: 'cv-onboard',
    name: 'New member onboarding',
    status: 'active',
    description: 'First 21 days after signup. Goal: first completed booking.',
    entry: {
      type: 'action_based',
      trigger: 'Performs custom event `newsletter_signup`',
      segmentId: 'seg-never-booked',
      reeligibility: { allow: false, cooldown: null },
      entryWindow: 'Anytime',
      conversionEvents: [{ event: 'booking_completed', window: '21 days', primary: true }],
      sendInUserTz: true,
      quietHours: '21:00 – 08:00',
    },
    stats: { entered: 42180, converted: 3811, revenue: 1524400 },
    steps: [
      { id: 's1', kind: 'message', name: 'Welcome + brand story', channel: 'Email', templateId: 'tpl-winback', delay: 'Immediately', stats: { sent: 42180, opens: 21935, clicks: 5062, conv: 612 } },
      { id: 's2', kind: 'delay', name: 'Wait 2 days', config: { duration: '2 days' } },
      { id: 's3', kind: 'action_paths', name: 'Did they search?', config: { window: '3 days' }, paths: [
        { label: 'Performed `search_performed`', steps: [
          { id: 's3a', kind: 'message', name: 'Destination shortlist (catalog)', channel: 'Email', templateId: 'tpl-abandon', delay: 'Immediately', stats: { sent: 14620, opens: 8041, clicks: 2632, conv: 941 } },
        ]},
        { label: 'Everybody else', steps: [
          { id: 's3b', kind: 'message', name: 'Top 5 destinations this month', channel: 'Email', templateId: 'tpl-winback', delay: 'Immediately', stats: { sent: 27560, opens: 9645, clicks: 1653, conv: 388 } },
        ]},
      ]},
      { id: 's4', kind: 'delay', name: 'Wait 5 days', config: { duration: '5 days' } },
      { id: 's5', kind: 'audience_paths', name: 'Split by app install', config: { evaluate: 'On entry to step' }, paths: [
        { label: 'Has the app', steps: [
          { id: 's5a', kind: 'message', name: 'Push — member rates in-app', channel: 'Push', delay: 'Immediately', stats: { sent: 11208, opens: 3810, clicks: 1104, conv: 297 } },
        ]},
        { label: 'No app', steps: [
          { id: 's5b', kind: 'message', name: 'Email — download the app, save 10%', channel: 'Email', templateId: 'tpl-winback', delay: 'Immediately', stats: { sent: 30972, opens: 10531, clicks: 2168, conv: 402 } },
        ]},
      ]},
      { id: 's6', kind: 'delay', name: 'Wait 7 days', config: { duration: '7 days' } },
      { id: 's7', kind: 'message', name: 'First-booking incentive — €25 off', channel: 'Email', templateId: 'tpl-winback', delay: 'Immediately', stats: { sent: 38104, opens: 12193, clicks: 3048, conv: 1171 } },
      { id: 's8', kind: 'exit', name: 'Exit — booked or 21 days elapsed' },
    ],
  },
  {
    id: 'cv-prearrival',
    name: 'Pre-arrival & on-property journey',
    status: 'active',
    description: 'From booking confirmation to checkout. Drives online check-in, ancillary spend and reviews.',
    entry: {
      type: 'action_based',
      trigger: 'Performs custom event `booking_completed`',
      segmentId: 'seg-all',
      reeligibility: { allow: true, cooldown: '1 day' },
      entryWindow: 'Anytime',
      conversionEvents: [{ event: 'checked_in', window: '30 days', primary: true }, { event: 'spa_booked', window: '30 days', primary: false }],
      sendInUserTz: true,
      quietHours: '21:00 – 08:00',
    },
    stats: { entered: 61340, converted: 52119, revenue: 402800 },
    steps: [
      { id: 'p1', kind: 'message', name: 'Booking confirmation', channel: 'Email', templateId: 'tpl-prearrival', delay: 'Immediately', stats: { sent: 61340, opens: 51525, clicks: 12268, conv: 0 } },
      { id: 'p2', kind: 'delay', name: 'Wait until 7 days before arrival', config: { duration: 'Until 7 days before `next_stay_date`' } },
      { id: 'p3', kind: 'audience_paths', name: 'Split by tier', config: { evaluate: 'On entry to step' }, paths: [
        { label: 'Gold / Platinum', steps: [
          { id: 'p3a', kind: 'message', name: 'Upgrade offer + late checkout', channel: 'Email', templateId: 'tpl-prearrival', delay: 'Immediately', stats: { sent: 14721, opens: 10598, clicks: 3679, conv: 1104 } },
          { id: 'p3b', kind: 'update_user', name: 'Set upgrade_offered = true', config: { attribute: 'upgrade_offered', value: 'true' } },
        ]},
        { label: 'Blue / Silver', steps: [
          { id: 'p3c', kind: 'message', name: 'Paid upgrade + spa cross-sell', channel: 'Email', templateId: 'tpl-prearrival', delay: 'Immediately', stats: { sent: 46619, opens: 25640, clicks: 6526, conv: 1861 } },
        ]},
      ]},
      { id: 'p4', kind: 'delay', name: 'Wait until 1 day before arrival', config: { duration: 'Until 1 day before `next_stay_date`' } },
      { id: 'p5', kind: 'message', name: 'Online check-in reminder', channel: 'Push', delay: 'Send at 10:00 local', stats: { sent: 24193, opens: 9677, clicks: 5322, conv: 4108 } },
      { id: 'p6', kind: 'action_paths', name: 'Checked in?', config: { window: '2 days' }, paths: [
        { label: 'Performed `checked_in`', steps: [
          { id: 'p6a', kind: 'delay', name: 'Wait 1 day', config: { duration: '1 day' } },
          { id: 'p6b', kind: 'message', name: 'In-stay: spa & dining', channel: 'Push', delay: 'Send at 16:00 local', stats: { sent: 20411, opens: 8164, clicks: 2449, conv: 833 } },
        ]},
        { label: 'Everybody else', steps: [
          { id: 'p6c', kind: 'message', name: 'SMS — arrival instructions', channel: 'SMS', delay: 'Immediately', stats: { sent: 3782, opens: 0, clicks: 719, conv: 402 } },
        ]},
      ]},
      { id: 'p7', kind: 'delay', name: 'Wait until 18h after checkout', config: { duration: '18 hours after `checked_out`' } },
      { id: 'p8', kind: 'message', name: 'Review request', channel: 'Email', templateId: 'tpl-poststay', delay: 'Immediately', stats: { sent: 55201, opens: 25392, clicks: 9384, conv: 6761 } },
      { id: 'p9', kind: 'exit', name: 'Exit' },
    ],
  },
  {
    id: 'cv-winback',
    name: 'Lapsed guest win-back (experiment)',
    status: 'draft',
    description: 'Three-arm test on discount depth for guests 180+ days out.',
    entry: {
      type: 'scheduled',
      trigger: 'Recurring · every Tuesday 09:00 local',
      segmentId: 'seg-lapsed',
      reeligibility: { allow: true, cooldown: '90 days' },
      entryWindow: 'Recurring weekly',
      conversionEvents: [{ event: 'booking_completed', window: '14 days', primary: true }],
      sendInUserTz: true,
      quietHours: '21:00 – 08:00',
    },
    stats: { entered: 0, converted: 0, revenue: 0 },
    steps: [
      { id: 'w1', kind: 'experiment_paths', name: 'Discount depth test', config: { control: 10 }, paths: [
        { label: 'Path 1 — 10% off (30%)', steps: [
          { id: 'w1a', kind: 'message', name: 'Win-back 10%', channel: 'Email', templateId: 'tpl-winback', delay: 'Immediately', stats: { sent: 0, opens: 0, clicks: 0, conv: 0 } },
        ]},
        { label: 'Path 2 — 20% off (30%)', steps: [
          { id: 'w1b', kind: 'message', name: 'Win-back 20%', channel: 'Email', templateId: 'tpl-winback', delay: 'Immediately', stats: { sent: 0, opens: 0, clicks: 0, conv: 0 } },
        ]},
        { label: 'Path 3 — points bonus (30%)', steps: [
          { id: 'w1c', kind: 'message', name: 'Double points, no discount', channel: 'Email', templateId: 'tpl-winback', delay: 'Immediately', stats: { sent: 0, opens: 0, clicks: 0, conv: 0 } },
        ]},
        { label: 'Control — holdout (10%)', steps: [] },
      ]},
      { id: 'w2', kind: 'delay', name: 'Wait 4 days', config: { duration: '4 days' } },
      { id: 'w3', kind: 'action_paths', name: 'Booked?', config: { window: '10 days' }, paths: [
        { label: 'Performed `booking_completed`', steps: [
          { id: 'w3a', kind: 'webhook', name: 'Notify CRM — win-back recovered', config: { url: 'https://hooks.aureliahotels.com/braze/winback', method: 'POST' } },
        ]},
        { label: 'Everybody else', steps: [
          { id: 'w3b', kind: 'update_user', name: 'Set winback_stage = exhausted', config: { attribute: 'winback_stage', value: 'exhausted' } },
        ]},
      ]},
      { id: 'w4', kind: 'exit', name: 'Exit' },
    ],
  },
];

/* ---------- analytics overview ------------------------------------------ */

BZ.overview = {
  kpis: [
    { label: 'Messages sent (30d)', value: '412,880', delta: '+8.4% vs prior 30d', dir: 'up' },
    { label: 'Email open rate',     value: '44.1%',   delta: '+1.9 pts',           dir: 'up' },
    { label: 'Click-to-open',       value: '21.6%',   delta: '−0.4 pts',           dir: 'down' },
    { label: 'Attributed revenue',  value: '€1.94M',  delta: '+12.1%',             dir: 'up' },
  ],
  sendsByDay: series(14, 29000, 0.22),
  channelMix: [
    { channel: 'Email', pct: 71, sends: 293148 },
    { channel: 'Push',  pct: 19, sends: 78447 },
    { channel: 'SMS',   pct: 7,  sends: 28901 },
    { channel: 'In-App',pct: 3,  sends: 12384 },
  ],
};
