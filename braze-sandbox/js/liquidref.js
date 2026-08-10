/* ==========================================================================
   Braze Sandbox — Liquid reference & inserter
   Every personalization tag, filter, control-flow tag and Braze-specific tag,
   with a runnable snippet for each. This is the practice surface: click any
   entry to insert it at the cursor, then watch it render against a profile.
   ========================================================================== */

const BZLiquidRef = (function () {
  'use strict';

  /* Snippets are written with \${…} escaped so the source stays readable. */
  const G = (id, label, hint, items) => ({ id, label, hint, items });
  const I = (name, snippet, desc) => ({ name, snippet, desc });

  const GROUPS = [

    G('standard', 'Standard attributes',
      'Braze knows these natively. Always wrapped in ${…}.', [
      I('First name', "{{\${first_name}}}", 'Reserved profile field. Add a fallback — a large share of profiles have no first name.'),
      I('Last name', "{{\${last_name}}}", ''),
      I('Email address', "{{\${email_address}}}", ''),
      I('Phone number', "{{\${phone_number}}}", ''),
      I('External user ID', "{{\${user_id}}}", 'Your own CRM/PMS identifier.'),
      I('Braze ID', "{{\${braze_id}}}", "Braze's internal id. Use external_id for anything you join on."),
      I('Country', "{{\${country}}}", ''),
      I('City', "{{\${city}}}", ''),
      I('Language', "{{\${language}}}", 'Two-letter code. Drives multi-language blocks.'),
      I('Time zone', "{{\${time_zone}}}", ''),
      I('Gender', "{{\${gender}}}", ''),
      I('Age', "{{\${age}}}", ''),
      I('Most recent app version', "{{\${most_recent_app_version}}}", 'Null for users who never installed the app.'),
      I('Unsubscribe URL', "{{\${set_user_to_unsubscribed_url}}}", 'Required in promotional email. Usually already inside your footer Content Block.'),
    ]),

    G('custom', 'Custom attributes',
      'Anything your integration writes. Note the namespace before the ${…}.', [
      I('Loyalty tier', "{{custom_attribute.\${loyalty_tier}}}", ''),
      I('Points balance', "{{custom_attribute.\${points_balance}}}", ''),
      I('Next stay hotel', "{{custom_attribute.\${next_stay_hotel}}}", ''),
      I('Next stay date', "{{custom_attribute.\${next_stay_date}}}", 'A date — pipe through the `date` filter before showing it.'),
      I('Nights booked', "{{custom_attribute.\${nights_booked}}}", ''),
      I('Total stays', "{{custom_attribute.\${total_stays}}}", ''),
      I('Lifetime value', "{{custom_attribute.\${lifetime_value}}}", ''),
      I('Travels with kids', "{{custom_attribute.\${travels_with_kids}}}", 'Boolean. Compare with `== true`, never rely on truthiness.'),
      I('Any custom attribute', "{{custom_attribute.\${ATTRIBUTE_NAME}}}", 'Replace ATTRIBUTE_NAME with the exact key, case-sensitive.'),
      I('Array element', "{{custom_attribute.\${favourite_cities}[0]}}", 'Array-typed custom attributes are indexable.'),
    ]),

    G('event', 'Event & trigger properties',
      'Only resolve for action-based or API-triggered sends. Empty in a scheduled campaign.', [
      I('Event property', "{{event_properties.\${hotel_name}}}", 'A property of the event that triggered this message.'),
      I('Event property (nights)', "{{event_properties.\${nights}}}", ''),
      I('Canvas entry property', "{{canvas_entry_properties.\${promo_code}}}", 'Passed in when the Canvas was triggered; readable in every step.'),
      I('API trigger property', "{{api_trigger_properties.\${offer_id}}}", 'Sent with /campaigns/trigger/send.'),
      I('Purchase property', "{{event_properties.\${product_id}}}", ''),
    ]),

    G('content', 'Content Blocks & catalogs', 'Reusable content and joined data.', [
      I('Content Block', "{{content_blocks.\${aurelia_footer}}}", 'Include a reusable fragment. Edit once, every message updates.'),
      I('Catalog lookup', "{% catalog_items hotels {{custom_attribute.\${abandoned_hotel_id}}} %}", 'Joins a catalog row into `items`.'),
      I('Catalog lookup + guard', "{% catalog_items hotels {{custom_attribute.\${abandoned_hotel_id}}} %}\n{% if items.size == 0 %}\n  {% abort_message('No catalog row for this user') %}\n{% endif %}\n{{items[0].name}} — from €{{items[0].price_from}}",
        'The guard is not optional: a dead id renders an empty hero and a broken image rather than an error.'),
      I('Catalog field', "{{items[0].name}}", ''),
      I('Loop catalog items', "{% for item in items %}\n  {{item.name}} — €{{item.price_from}}\n{% endfor %}", ''),
      I('Catalog selection', "{% catalog_selection_items hotels my_selection %}", 'Returns rows matching a saved selection rather than an explicit id.'),
    ]),

    G('flow', 'Control flow', 'Standard Liquid tags. Note: no parentheses in Liquid.', [
      I('if / endif', "{% if custom_attribute.\${loyalty_tier} == 'Platinum' %}\n  …\n{% endif %}", ''),
      I('if / elsif / else', "{% if custom_attribute.\${loyalty_tier} == 'Platinum' %}\n  Late checkout until 16:00 is already on your reservation.\n{% elsif custom_attribute.\${loyalty_tier} == 'Gold' %}\n  Ask at the desk about 14:00 checkout.\n{% else %}\n  Two more stays and you reach Gold.\n{% endif %}", ''),
      I('unless', "{% unless custom_attribute.\${has_app} == true %}\n  Download the app and save 10%.\n{% endunless %}", 'The inverse of if. Has no elsif.'),
      I('case / when', "{% case custom_attribute.\${loyalty_tier} %}\n  {% when 'Platinum' %}…\n  {% when 'Gold' %}…\n  {% else %}…\n{% endcase %}", 'Cleaner than a long elsif chain when testing one value.'),
      I('for loop', "{% for item in items %}\n  {{item.name}}\n{% endfor %}", ''),
      I('for over a range', "{% for i in (1..5) %}\n  {{i}}\n{% endfor %}", ''),
      I('for with limit / offset', "{% for item in items limit:3 offset:1 %}\n  {{item.name}}\n{% endfor %}", ''),
      I('forloop helpers', "{% for item in items %}\n  {{item.name}}{% unless forloop.last %}, {% endunless %}\n{% endfor %}", 'forloop.index, .index0, .first, .last, .length, .rindex'),
      I('break / continue', "{% for item in items %}\n  {% if item.sold_out %}{% continue %}{% endif %}\n  {{item.name}}\n{% endfor %}", ''),
      I('assign', "{% assign nights = custom_attribute.\${nights_booked} %}\n{{nights}} night{% if nights != 1 %}s{% endif %}", 'Compute once, reuse. Essential for readable conditionals.'),
      I('capture', "{% capture greeting %}Hello {{\${first_name} | default: 'there'}}{% endcapture %}\n{{greeting}}", 'Builds a string from markup and stores it.'),
      I('increment / decrement', "{% increment counter %}", 'Independent of assign; persists across the template render.'),
      I('comment', "{% comment %}Not rendered, and not sent.{% endcomment %}", ''),
      I('raw', "{% raw %}{{ this is not parsed }}{% endraw %}", 'Escape hatch when you need literal braces in the output.'),
    ]),

    G('ops', 'Operators', 'Usable inside if / unless / case.', [
      I('equals', "{% if custom_attribute.\${loyalty_tier} == 'Gold' %}…{% endif %}", ''),
      I('not equals', "{% if custom_attribute.\${loyalty_tier} != 'Blue' %}…{% endif %}", ''),
      I('greater / less than', "{% if custom_attribute.\${points_balance} > 5000 %}…{% endif %}", ''),
      I('and', "{% if custom_attribute.\${total_stays} > 3 and \${country} == 'IL' %}…{% endif %}", ''),
      I('or', "{% if custom_attribute.\${loyalty_tier} == 'Gold' or custom_attribute.\${loyalty_tier} == 'Platinum' %}…{% endif %}", 'Liquid has no parentheses — nest the ifs or pre-compute with assign.'),
      I('contains', "{% if \${email_address} contains '@example.com' %}…{% endif %}", 'Works on strings and arrays.'),
      I('blank / nil check', "{% if custom_attribute.\${next_stay_hotel} != blank %}…{% endif %}",
        'Remember: an empty string and 0 are both TRUTHY in Liquid. Test explicitly.'),
    ]),

    G('string', 'String filters', '', [
      I('default', "{{\${first_name} | default: 'there'}}", 'Fires on nil and empty string — but not on a single space.'),
      I('strip + default', "{{\${first_name} | strip | default: 'there'}}", 'The safe version when your source data is dirty.'),
      I('upcase / downcase', "{{\${city} | upcase}}", ''),
      I('capitalize', "{{\${city} | capitalize}}", 'Lowercases the rest — turns "Tel Aviv" into "Tel aviv". Careful with names.'),
      I('truncate', "{{custom_attribute.\${next_stay_hotel} | truncate: 24}}", ''),
      I('truncatewords', "{{custom_attribute.\${review_text} | truncatewords: 12}}", ''),
      I('replace', "{{\${city} | replace: 'Tel Aviv', 'TLV'}}", ''),
      I('remove', "{{\${last_name} | remove: '-'}}", ''),
      I('append / prepend', "{{\${first_name} | append: ', welcome back'}}", ''),
      I('split + join', "{{custom_attribute.\${tags} | split: ',' | join: ' · '}}", ''),
      I('size', "{{\${first_name} | size}}", 'Length of a string, or count of an array.'),
      I('url_encode', "{{\${email_address} | url_encode}}", 'Always encode anything you put in a query string.'),
      I('strip_html', "{{custom_attribute.\${bio} | strip_html}}", ''),
      I('newline_to_br', "{{custom_attribute.\${notes} | newline_to_br}}", ''),
    ]),

    G('math', 'Number & math filters', '', [
      I('number_with_delimiter', "{{custom_attribute.\${points_balance} | number_with_delimiter}}", '18400 → 18,400'),
      I('plus / minus', "{% assign to_gold = 7 | minus: custom_attribute.\${total_stays} %}{{to_gold}}", ''),
      I('times', "{{custom_attribute.\${nights_booked} | times: 120}}", ''),
      I('divided_by (integer)', "{{custom_attribute.\${points_balance} | divided_by: 100}}", 'Truncates when both sides are integers. 18450 → 184, not 185.'),
      I('divided_by (float)', "{{custom_attribute.\${points_balance} | divided_by: 100.0 | round}}", 'Use 100.0 to keep the remainder, then round.'),
      I('round / ceil / floor', "{{custom_attribute.\${lifetime_value} | divided_by: 1000.0 | round: 1}}", ''),
      I('modulo', "{{custom_attribute.\${total_stays} | modulo: 2}}", 'Handy for alternating row colours in a loop.'),
      I('abs', "{{custom_attribute.\${balance} | abs}}", ''),
      I('at_least / at_most', "{{custom_attribute.\${points_balance} | at_most: 50000}}", 'Clamps a value.'),
    ]),

    G('date', 'Date filters', 'strftime formatting. The attribute must be a real date.', [
      I('Full date', "{{custom_attribute.\${next_stay_date} | date: '%A, %B %e'}}", 'Monday, August 18'),
      I('Numeric date', "{{custom_attribute.\${next_stay_date} | date: '%d/%m/%Y'}}", '18/08/2026'),
      I('Short date', "{{custom_attribute.\${next_stay_date} | date: '%b %e, %Y'}}", 'Aug 18, 2026'),
      I('Time', "{{custom_attribute.\${next_stay_date} | date: '%H:%M'}}", ''),
      I('Now', "{{'now' | date: '%Y-%m-%d'}}", "Send-time date. Useful for 'valid until' copy."),
      I('Day name only', "{{custom_attribute.\${next_stay_date} | date: '%A'}}", ''),
      I('Format reference', "%A full weekday · %a short weekday · %B full month · %b short month\n%d zero-padded day · %-d day · %e space-padded day\n%m month · %Y year · %y 2-digit year · %H hour · %M minute · %p AM/PM",
        'Reference only — not a snippet to insert.'),
    ]),

    G('array', 'Array filters', 'Mostly used with catalog items.', [
      I('first / last', "{{items | first}}", ''),
      I('map', "{{items | map: 'name' | join: ', '}}", 'Pull one field out of every row.'),
      I('where', "{{items | where: 'has_spa', true | map: 'name' | join: ', '}}", ''),
      I('sort', "{% assign cheapest = items | sort: 'price_from' %}{{cheapest[0].name}}", ''),
      I('uniq', "{{items | map: 'city' | uniq | join: ', '}}", ''),
      I('reverse', "{{items | reverse | first}}", ''),
      I('slice', "{{items | slice: 0, 3}}", ''),
    ]),

    G('braze', 'Braze-specific tags', 'These do not exist in standard Liquid.', [
      I('abort_message', "{% abort_message('Reason logged in analytics') %}",
        'Cancels the send for this user only, and is counted as an abort in campaign analytics. The correct way to skip a bad render.'),
      I('abort with a guard', "{% if custom_attribute.\${next_stay_hotel} == blank %}\n  {% abort_message('No upcoming stay') %}\n{% endif %}", ''),
      I('connected_content', "{% connected_content https://api.example.com/rates?hotel={{custom_attribute.\${next_stay_hotel_id}}}\n   :basic_auth rates_key\n   :cache 300\n   :save rates %}\n{% if rates.lowest %}From €{{rates.lowest}} tonight.{% endif %}",
        'Always :cache on a large send — without it your endpoint takes one request per recipient.'),
      I('connected_content POST', "{% connected_content https://api.example.com/quote\n   :method post\n   :body hotel={{custom_attribute.\${next_stay_hotel_id}}}\n   :headers {\"Accept\": \"application/json\"}\n   :save quote %}", ''),
      I('promotion code', "{% promotion 'summer_codes' %}\n{{promotion.code}}", 'Draws a unique code from an uploaded pool. Never hard-code a shared code.'),
      I('message_extras', "{% message_extras_capture key='campaign_theme' value='summer' %}", 'Attaches metadata that flows into Currents.'),
      I('Multi-language', "{% case \${language} %}\n  {% when 'he' %}שלום {{\${first_name}}}\n  {% when 'de' %}Hallo {{\${first_name}}}\n  {% else %}Hello {{\${first_name}}}\n{% endcase %}",
        'One message, several languages. Braze also has a dedicated Multi-language feature for this.'),
    ]),

    G('recipes', 'Recipes you will use weekly', 'Complete, working patterns — paste and adapt.', [
      I('Safe greeting', "Hello {{\${first_name} | strip | default: 'there'}},", ''),
      I('Plural-safe nights', "{% assign n = custom_attribute.\${nights_booked} %}\nYour {{n}} night{% if n != 1 %}s{% endif %} at {{custom_attribute.\${next_stay_hotel} | default: 'your hotel'}}\nstart{% if n == 1 %}s{% endif %} on {{custom_attribute.\${next_stay_date} | date: '%A, %B %e'}}.",
        'Note the verb pluralises the opposite way to the noun.'),
      I('Tier-based offer', "{% assign tier = custom_attribute.\${loyalty_tier} | default: 'Blue' %}\n{% if tier == 'Gold' or tier == 'Platinum' %}\n  Double points on your next stay — you already have {{custom_attribute.\${points_balance} | number_with_delimiter}}.\n{% else %}\n  Here is 20% off your next stay: WELCOMEBACK20\n{% endif %}",
        'Never discount a high-value guest when a points bonus will do.'),
      I('Progress to next tier', "{% assign to_gold = 7 | minus: custom_attribute.\${total_stays} %}\n{% if to_gold > 0 %}\n  You are {{to_gold}} stay{% if to_gold != 1 %}s{% endif %} from Gold.\n{% endif %}",
        'The if-wrapper stops existing Gold members seeing "-3 stays from Gold".'),
      I('Abandoned booking hero', "{% catalog_items hotels {{custom_attribute.\${abandoned_hotel_id}}} %}\n{% if items.size == 0 %}{% abort_message('no catalog row') %}{% endif %}\n<h1>Still thinking about {{items[0].city}}?</h1>\n<img src=\"{{items[0].image_url}}\" alt=\"{{items[0].name}}\" width=\"600\">\n<p>From €{{items[0].price_from}} per night</p>", ''),
      I('Points-to-euros', "Your {{custom_attribute.\${points_balance} | number_with_delimiter}} points are worth about €{{custom_attribute.\${points_balance} | divided_by: 100.0 | round}}.",
        'The 100.0 matters — integer division would understate the value.'),
      I('Countdown to arrival', "{% assign days = custom_attribute.\${next_stay_date} | date: '%s' | minus: 'now' | date: '%s' | divided_by: 86400 %}\n{% if days > 0 %}{{days}} days to go{% endif %}",
        'Date arithmetic via epoch seconds. Fiddly, but it is the standard trick.'),
      I('Alternating rows', "{% for item in items %}\n  <tr style=\"background:{% if forloop.index0 | modulo: 2 == 0 %}#FFFFFF{% else %}#F7F7FA{% endif %}\">\n    <td>{{item.name}}</td>\n  </tr>\n{% endfor %}", ''),
      I('Fallback chain', "{{custom_attribute.\${preferred_city} | default: custom_attribute.\${city} | default: 'your next destination'}}",
        'default can be chained — first non-empty wins.'),
    ]),
  ];

  /* Flat searchable index */
  function search(q) {
    q = String(q || '').toLowerCase().trim();
    if (!q) return null;
    const hits = [];
    GROUPS.forEach((g) => g.items.forEach((it) => {
      const hay = (it.name + ' ' + it.snippet + ' ' + it.desc + ' ' + g.label).toLowerCase();
      if (hay.includes(q)) hits.push({ group: g.label, item: it });
    }));
    return hits;
  }

  const allItems = () => GROUPS.reduce((a, g) => a.concat(g.items), []);

  return { GROUPS, search, allItems };
})();

window.BZLiquidRef = BZLiquidRef;
