/* Mountain Trails Wellness Studio — Apothecary tracker
   Data is kept on the device (localStorage) and synced to her private Supabase account,
   so it still works offline and catches up when the phone is back online. */
'use strict';

/* ================= Storage ================= */

const STORE_KEY = 'mtws-apothecary-v1';

function defaultState() {
  return {
    tinctures: [],
    salves: [],
    inventory: [],
    recipes: [],
    settings: { notifications: false, shakeReminders: false },
    shaken: {},            // batch id -> date last shaken
    lastShakeNotice: null,
  };
}

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY));
    if (saved) {
      const base = defaultState();
      return { ...base, ...saved, settings: { ...base.settings, ...saved.settings } };
    }
  } catch (e) { /* fall through to a fresh state */ }
  return defaultState();
}

let state = load();

function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
  catch (e) { toast('Could not save on this device. Check that storage is not blocked.'); }
  scheduleSync();
}

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* ================= Dates ================= */

const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => iso(new Date());
function parseDate(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function addDays(s, n) { const d = parseDate(s); d.setDate(d.getDate() + n); return iso(d); }
const daysBetween = (a, b) => Math.round((parseDate(b) - parseDate(a)) / 86400000);
const fmtDate = s => s ? parseDate(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

function fmtDuration(days) {
  if (!days) return '—';
  if (days % 7 === 0) return plural(days / 7, 'week');
  return plural(days, 'day');
}

function batchInfo(b) {
  const total = Math.max(1, daysBetween(b.start, b.ready));
  const left = daysBetween(today(), b.ready);
  const pct = Math.min(100, Math.max(0, Math.round((total - left) / total * 100)));
  const ready = left <= 0;
  return { total, left, pct, ready };
}

function leftText(info) {
  if (info.left < 0) return `Ready ${plural(-info.left, 'day')} ago`;
  if (info.left === 0) return 'Ready today';
  return `${plural(info.left, 'day')} left`;
}

/* ================= Helpers ================= */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function toast(msg, ms = 3800) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), ms);
}

/* ================= Icons & art ================= */

const ICONS = {
  leaf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 20c0-9 6-15 15-15 0 9-6 15-15 15z"/><path d="M5 20 14 11"/><path d="M9 16h4M11 13v3"/></svg>',
  tag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>',
  tea: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10h13v4a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6z"/><path d="M17 11h1.5a2.5 2.5 0 0 1 0 5H16"/><path d="M8 7c0-1.5 1.5-2 1.5-3.5M12 7c0-1.5 1.5-2 1.5-3.5"/><path d="M3 21h16"/></svg>',
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20 9 9l3.5 5L16 8l6 12z"/><circle cx="6.5" cy="6" r="2"/></svg>',
  bottle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2h4v3h-4z"/><path d="M9 5h6v2.5c2 .8 3 2.3 3 4.2V20a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-8.3c0-1.9 1-3.4 3-4.2z"/><path d="M8.5 13h7v5h-7z"/></svg>',
  tin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="9" rx="9" ry="3.2"/><path d="M3 9v6c0 1.8 4 3.2 9 3.2s9-1.4 9-3.2V9"/><path d="M3 12c0 1.8 4 3.2 9 3.2s9-1.4 9-3.2"/></svg>',
  shelf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2 21h20M3 21v-2h18v2"/><path d="M5 19v-7h4v7M10 19v-9h4v9M15 19v-7h4v7"/><path d="M6 12V10.5h2V12M11 10V8.5h2V10M16 12v-1.5h2V12"/></svg>',
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6c-2-1.5-5-2-9-2v14c4 0 7 .5 9 2 2-1.5 5-2 9-2V4c-4 0-7 .5-9 2z"/><path d="M12 6v14"/><path d="M5.5 8.5c1.5 0 3 .3 4 .8M5.5 11.5c1.5 0 3 .3 4 .8M14.5 9.3c1-.5 2.5-.8 4-.8"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 6-6 6 6 6"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>',
  jar: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 2h10v3H7zM6 6h12l1 3v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V9z"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
};

function hashHue(s) { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }
const FLOWER_TINTS = ['#D4A258', '#8B3A3A', '#9A7BB5', '#E0B84A', '#C77B5A', '#7C8FB5'];

// Engraved-style botanical sprig used for headers, recipes and empty states.
function sprigArt(seed = '', w = 64, h = 72) {
  const tint = FLOWER_TINTS[hashHue(seed) % FLOWER_TINTS.length];
  return `<svg viewBox="0 0 64 72" width="${w}" height="${h}" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="M32 70C31 52 30 36 33 14" stroke="#2E4B32" stroke-width="1.6"/>
    <path d="M32 54c-8-2-14-8-16-15 8 1 14 6 16 15z" fill="#9BAE82" stroke="#2E4B32" stroke-width="1.1"/>
    <path d="M31.5 42c8-2 13-8 15-14-8 1-13 6-15 14z" fill="#9BAE82" stroke="#2E4B32" stroke-width="1.1"/>
    <path d="M31 30c-6-2-10-6-11-12 6 1 10 5 11 12z" fill="#b6c49f" stroke="#2E4B32" stroke-width="1.1"/>
    <path d="M27 49l-6-6M37 37l5-5M28 25l-4-4" stroke="#2E4B32" stroke-width=".7"/>
    <g transform="translate(33 12)">
      ${[0, 60, 120, 180, 240, 300].map(a => `<ellipse rx="3.2" ry="6.5" cy="-6" transform="rotate(${a})" fill="${tint}" stroke="#3E2F1F" stroke-width=".7"/>`).join('')}
      <circle r="3.2" fill="#E0B84A" stroke="#3E2F1F" stroke-width=".7"/>
    </g>
  </svg>`;
}

function mountainArt() {
  return `<svg viewBox="0 0 150 90" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
    <path d="M10 78 48 30l14 16 20-30 30 40 8-8 20 30" stroke-width="1.6"/>
    <path d="M74 28l8-12 9 12-5-2-4 4-4-4z" fill="#F7EBD6" stroke-width="1.2"/>
    <path d="M42 38l6-8 6 7" stroke-width="1"/>
    <path d="M30 78c3-8 3-14 0-20M30 64c-5-1-8-4-9-8 5 0 8 3 9 8zM30 68c5-1 8-4 9-8-5 0-8 3-9 8z" stroke="#2E4B32" stroke-width="1.2" fill="#9BAE82"/>
    <path d="M120 78c-3-8-3-14 0-20M120 64c5-1 8-4 9-8-5 0-8 3-9 8zM120 68c-5-1-8-4-9-8 5 0 8 3 9 8z" stroke="#2E4B32" stroke-width="1.2" fill="#9BAE82"/>
    <path d="M4 82h142" stroke-width="1"/>
  </svg>`;
}

// Amber dropper bottle with a parchment label; liquid level follows progress.
function bottleArt(pct = 100, label = '') {
  const top = 30 + (1 - pct / 100) * 28;
  const id = 'b' + Math.random().toString(36).slice(2, 7);
  return `<svg viewBox="0 0 48 80">
    <defs><clipPath id="${id}"><path d="M14 22h20v4c5 2 8 6 8 11v34a5 5 0 0 1-5 5H11a5 5 0 0 1-5-5V37c0-5 3-9 8-11z"/></clipPath></defs>
    <rect x="18" y="2" width="12" height="13" rx="5" fill="#2a2018"/>
    <rect x="16" y="14" width="16" height="8" rx="1" fill="#3E2F1F"/>
    <path d="M14 22h20v4c5 2 8 6 8 11v34a5 5 0 0 1-5 5H11a5 5 0 0 1-5-5V37c0-5 3-9 8-11z" fill="#c98f4a" opacity=".45"/>
    <rect x="0" y="${top}" width="48" height="80" fill="#7a3f12" clip-path="url(#${id})"/>
    <path d="M14 22h20v4c5 2 8 6 8 11v34a5 5 0 0 1-5 5H11a5 5 0 0 1-5-5V37c0-5 3-9 8-11z" fill="none" stroke="#3E2F1F" stroke-width="1.2"/>
    <rect x="10" y="44" width="28" height="18" rx="1.5" fill="#F7EBD6" stroke="#3E2F1F" stroke-width=".8"/>
    <path d="M13 50h22M13 55h16" stroke="#6B5844" stroke-width=".9"/>
    <path d="M10 34c1-3 2-5 4-6" stroke="#fff" stroke-opacity=".45" stroke-width="2" fill="none"/>
    ${label ? `<title>${esc(label)}</title>` : ''}
  </svg>`;
}

function tinArt() {
  return `<svg viewBox="0 0 64 56">
    <ellipse cx="32" cy="40" rx="26" ry="9" fill="#8e8a82" stroke="#3E2F1F" stroke-width="1"/>
    <rect x="6" y="28" width="52" height="12" fill="#b9b4a9"/>
    <path d="M6 28v12M58 28v12" stroke="#3E2F1F" stroke-width="1"/>
    <ellipse cx="32" cy="28" rx="26" ry="9" fill="#d8d3c8" stroke="#3E2F1F" stroke-width="1"/>
    <ellipse cx="32" cy="28" rx="21" ry="6.5" fill="#E2B85E" stroke="#a37a2c" stroke-width=".8"/>
    <path d="M20 26c5-2 12-2 18 0" stroke="#f6dc9a" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    <path d="M14 10c3 6 5 10 10 13M18 6c2 5 2 9 1 13" stroke="#2E4B32" stroke-width="1.2" fill="none" stroke-linecap="round"/>
    <path d="M14 10c-4 0-6 3-6 5 3 0 6-1 6-5zM18 6c3-2 6-1 7 1-3 1-5 1-7-1z" fill="#9BAE82" stroke="#2E4B32" stroke-width=".8"/>
    <circle cx="44" cy="12" r="4" fill="#E0B84A" stroke="#3E2F1F" stroke-width=".7"/>
    <path d="M44 16c0 4-2 7-6 10" stroke="#2E4B32" stroke-width="1" fill="none"/>
  </svg>`;
}

// Teacup with a sprig, for tea blends and tea batches.
function teaArt() {
  return `<svg viewBox="0 0 64 60">
    <path d="M10 26h36v8a16 16 0 0 1-16 16h-4a16 16 0 0 1-16-16z" fill="#F7EBD6" stroke="#3E2F1F" stroke-width="1.2"/>
    <path d="M12 30h32" stroke="#C98F4A" stroke-width="5" opacity=".55"/>
    <path d="M46 29h3.5a5.5 5.5 0 0 1 0 11H44" fill="none" stroke="#3E2F1F" stroke-width="1.2"/>
    <ellipse cx="28" cy="54" rx="22" ry="3.5" fill="#E6D3AF" stroke="#3E2F1F" stroke-width="1"/>
    <path d="M20 20c0-4 4-5 4-9M28 20c0-4 4-5 4-9" fill="none" stroke="#6B5844" stroke-width="1.1" stroke-linecap="round"/>
    <path d="M44 22c3-6 8-9 14-9-1 6-6 10-14 9z" fill="#9BAE82" stroke="#2E4B32" stroke-width=".9"/>
    <path d="M44 22c4-3 7-5 10-7" fill="none" stroke="#2E4B32" stroke-width=".7"/>
  </svg>`;
}

function inventoryArt(type) {
  return type === 'salve' ? tinArt() : type === 'tincture' ? bottleArt(70) : type === 'tea' ? teaArt() : sprigArt('other');
}

/* ================= Navigation ================= */

const ui = {
  tab: 'home',
  filters: { infusing: 'all', salves: 'all', inventory: 'all', recipes: 'all', todo: 'all' },
  search: { inventory: '', recipes: '' },
  recipeId: null,
  recipeTab: 'details',
};

function go(tab) {
  ui.tab = tab;
  ui.recipeId = null;
  render();
  window.scrollTo(0, 0);
}

function render() {
  $$('.tabbar button, .sidebar [data-tab]').forEach(b => b.setAttribute('aria-current', b.dataset.tab === ui.tab ? 'page' : 'false'));
  const who = $('#side-user');
  if (who) who.innerHTML = session ? `<b>${esc(session.user.user_metadata?.name || session.user.email)}</b><small>${member ? ROLE_LABEL[member.role] : ''}</small>` : '';
  const v = $('#view');
  if (ui.tab === 'home') v.innerHTML = state.settings.homeStyle === 'classic' ? viewHome() : viewHomeCal();
  else if (ui.tab === 'infusing') v.innerHTML = viewBatches('tincture');
  else if (ui.tab === 'salves') v.innerHTML = viewBatches('salve');
  else if (ui.tab === 'inventory') v.innerHTML = viewInventory();
  else if (ui.tab === 'recipes') v.innerHTML = ui.recipeId ? viewRecipe() : viewRecipes();
  else if (ui.tab === 'teas') v.innerHTML = ui.recipeId ? viewRecipe() : viewTeas();
  else v.innerHTML = viewSettings();
  bindView();
}

// Which collection an "add" button writes to, so it can be hidden for people who can't.
function actAllowed(act) {
  const coll = { 'add-item': 'inventory', 'add-recipe': 'recipes', 'add-tea': 'recipes', 'add-batch': ui.tab === 'salves' ? 'salves' : 'tinctures' }[act];
  return !coll || canEdit(coll);
}

function pageHead(art, title, sub, addAction) {
  if (addAction && !actAllowed(addAction)) addAction = null;
  return `<header class="page-head">
    <div class="art">${art}</div>
    <div><h1>${title}</h1><p>${sub}</p></div>
    ${addAction ? `<button class="fab" data-act="${addAction}" aria-label="Add">${ICONS.plus}</button>` : '<span></span>'}
  </header><div class="rule"></div>`;
}

function chips(group, options) {
  return `<div class="chips" role="group">${options.map(([val, label]) =>
    `<button class="chip" data-filter="${group}" data-val="${val}" aria-pressed="${ui.filters[group] === val}">${label}</button>`).join('')}</div>`;
}

function emptyState(title, text, act, btn) {
  if (act && !actAllowed(act)) act = null;
  return `<div class="empty">${sprigArt(title, 70, 70)}<h3>${title}</h3><p>${text}</p>
    ${act ? `<button class="btn" data-act="${act}">${ICONS.plus}${btn}</button>` : ''}</div>`;
}

/* ================= Home ================= */

function allBatches() {
  return [
    ...state.tinctures.map(b => ({ b, kind: 'tincture' })),
    ...state.salves.map(b => ({ b, kind: 'salve' })),
  ].map(x => ({ ...x, info: batchInfo(x.b) })).sort((a, z) => a.b.ready.localeCompare(z.b.ready));
}

function whenText(left) {
  if (left === 1) return 'Tomorrow';
  if (left < 7) return `In ${left} days`;
  if (left % 7 === 0) return `In ${plural(left / 7, 'week')}`;
  return `In ${left} days`;
}

/* ---------- Calendar Home: this week at a glance, today's to-dos, what's coming ---------- */

// Short sayings for the desktop quote card; one per day.
const HOME_SAYINGS = [
  'Good things take time to steep.',
  'Every herb has its season.',
  'Slow and steady fills the jar.',
  'Patience is the best preservative.',
  'Tend the small things, and the shelf fills itself.',
  'Gathered by hand, made with care.',
  'Let it rest. The best work happens quietly.',
];

function viewHomeCal() {
  const now = new Date();
  const h = now.getHours();
  const part = h >= 5 && h < 12 ? 'morning' : h >= 12 && h < 17 ? 'afternoon' : 'evening';
  const name = session?.user?.user_metadata?.name;
  const greeting = `Good ${part}${name ? `, ${esc(name)}` : ''}`;
  const dateText = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  const batches = allBatches();
  const ready = batches.filter(x => x.info.ready);
  const upcoming = batches.filter(x => !x.info.ready);
  const toBottle = state.inventory.filter(needsBottling);
  const toLabel = state.inventory.filter(needsLabel);
  const month = today().slice(0, 7);
  const madeMonth = state.inventory.filter(i => isComplete(i) && (i.date || '').startsWith(month)).length;
  const shakeNeed = state.settings.shakeReminders
    ? state.tinctures.filter(b => !batchInfo(b).ready && state.shaken[b.id] !== today()).length : 0;
  const tabFor = list => TAB_FOR_TYPE[list[0]?.type] || 'inventory';
  const goAttrs = (tab, filter) => `data-go="${tab}" ${filter && (tab === 'infusing' || tab === 'salves') ? `data-go-filter="${filter}"` : ''}`;
  const batchWord = n => n === 1 ? 'batch' : 'batches';

  // This week (Sunday to Saturday), moved with the arrows.
  const t = parseDate(today());
  const weekStart = addDays(today(), -t.getDay() + (ui.calWeek || 0) * 7);
  const week = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const monthLabel = parseDate(week[3]).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const days = week.map(d => {
    const dt = parseDate(d);
    const due = batches.filter(x => x.b.ready === d);
    return `<button class="wk-day ${d === today() ? 'today' : ''} ${due.length ? 'has' : ''}" ${due.length ? `data-day="${d}"` : 'tabindex="-1"'}
        aria-label="${dt.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}${due.length ? `: ${due.map(x => esc(x.b.name)).join(', ')}` : ''}">
      <span>${dt.toLocaleDateString(undefined, { weekday: 'short' })}</span><b>${dt.getDate()}</b><i></i></button>`;
  }).join('');

  const stat = (icon, n, label, attrs, hot) =>
    `<button class="hc-stat ${hot ? 'hot' : ''}" ${attrs}><span class="hc-stat-ico">${icon}</span><b>${n}</b><small>${label}</small></button>`;

  // Today: only what actually needs doing.
  const todo = [
    ...ready.map(x => [ICONS.jar, x.kind === 'tincture' ? `${x.b.name} is ready to strain` : `${x.b.name} oil is ready to make`, `data-open-batch="${x.b.id}" data-kind="${x.kind}"`]),
    toBottle.length ? [ICONS.bottle, `Bottle ${toBottle.length} ${batchWord(toBottle.length)}`, goAttrs(tabFor(toBottle), 'finish')] : null,
    toLabel.length ? [ICONS.tag, `Label ${toLabel.length} ${batchWord(toLabel.length)}`, goAttrs(tabFor(toLabel), 'finish')] : null,
    shakeNeed ? [ICONS.bottle, `Shake ${plural(shakeNeed, 'jar')}`, 'data-go="infusing"'] : null,
  ].filter(Boolean);

  // Coming up: grouped by ready date.
  const groups = [];
  for (const x of upcoming) {
    const g = groups[groups.length - 1];
    if (g && g.date === x.b.ready) g.items.push(x); else groups.push({ date: x.b.ready, left: x.info.left, items: [x] });
  }
  const coming = groups.slice(0, 5).map(g => {
    const d = parseDate(g.date);
    return `<li><button class="tl2" ${g.items.length === 1 ? `data-open-batch="${g.items[0].b.id}" data-kind="${g.items[0].kind}"` : `data-day="${g.date}"`}>
      <span class="tl2-date"><b>${d.toLocaleDateString(undefined, { weekday: 'short' })}</b><small>${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</small></span>
      <span class="tl2-dot" aria-hidden="true"></span>
      <span class="tl2-names">${g.items.map(x => esc(x.b.name)).join(', ')}</span>
      <span class="tl2-when">${whenText(g.left).replace(/^In /, 'in ')}</span></button></li>`;
  }).join('');

  const recent = state.inventory.filter(isComplete).sort((a, z) => (z.date || '').localeCompare(a.date || '')).slice(0, 3);
  const saying = HOME_SAYINGS[Math.floor(Date.now() / 864e5) % HOME_SAYINGS.length];

  return `<div class="hc ${todo.length ? '' : 'no-today'}">
    <header class="hc-head">
      <span class="hc-sprig left" aria-hidden="true">${sprigArt('lavender', 70, 90)}</span>
      <span class="hc-sprig right" aria-hidden="true">${sprigArt('chamomile', 70, 90)}</span>
      <button class="iconbtn gear phone-only" data-go="settings" aria-label="Settings">${ICONS.gear}</button>
      <img class="hc-logo phone-only" src="icons/logo.png" alt="Mountain Trails Wellness Studio">
      <h1 class="hc-greet">${greeting}<span class="hc-date-inline"> · ${dateText}</span></h1>
      <p class="hc-date">${dateText}</p>
    </header>

    <section class="panel hc-cal">
      <div class="wk-top">
        <h2>${monthLabel}</h2>
        <div class="wk-nav">
          <button class="iconbtn" data-week="-1" aria-label="Previous week">${ICONS.back}</button>
          <button class="chip" data-week="0" aria-pressed="${!(ui.calWeek || 0)}">Today</button>
          <button class="iconbtn" data-week="1" aria-label="Next week">${ICONS.chev}</button>
        </div>
      </div>
      <div class="wk">${days}</div>
    </section>

    <aside class="panel hc-quote" aria-label="Saying of the day">
      <p>${saying}</p>
      <span aria-hidden="true">${sprigArt('quote', 60, 70)}</span>
    </aside>

    <div class="hc-stats">
      ${stat(ICONS.leaf, upcoming.filter(x => x.kind === 'tincture').length, 'Infusing', goAttrs('infusing', 'infusing'))}
      ${stat(ICONS.jar, ready.length, 'Ready', goAttrs(ready.length && ready.every(x => x.kind === 'salve') ? 'salves' : 'infusing', 'ready'), ready.length > 0)}
      ${stat(ICONS.tin, state.salves.length, 'Salves', 'data-go="salves"')}
      ${stat(ICONS.leaf, madeMonth, 'Made this month', 'data-go="inventory"')}
    </div>

    ${canEdit('tinctures') ? `<div class="hc-actions">
      <button class="btn" data-act="home-add-tincture">${ICONS.bottle}New tincture</button>
      <button class="btn ghost" data-act="home-add-salve">${ICONS.tin}New salve</button>
    </div>` : ''}

    ${todo.length ? `<section class="panel hc-today">
      <div class="hc-sec"><h2>Today</h2><span class="hc-count">${todo.length} ${todo.length === 1 ? 'item' : 'items'}</span></div>
      ${todo.map(([icon, text, attrs]) => `<button class="td-row" ${attrs}>
        <span class="td-box" aria-hidden="true"></span><span class="td-ico">${icon}</span><span class="td-text">${esc(text)}</span><span class="chev">${ICONS.chev}</span></button>`).join('')}
    </section>` : ''}

    <section class="panel hc-coming">
      <div class="hc-sec"><h2>Coming up</h2><button class="linkbtn" data-go="infusing">View all</button></div>
      ${coming ? `<ol class="tl2-list">${coming}</ol>` : '<p class="caught"><span>Nothing infusing right now.</span></p>'}
    </section>

    ${recent.length ? `<section class="panel hc-recent">
      <div class="hc-sec"><h2>Recently finished</h2><button class="linkbtn" data-go="inventory">See all</button></div>
      ${recent.map(i => `<button class="rf-row" data-open-item="${i.id}">
        <span class="rf-thumb">${inventoryArt(i.type)}</span>
        <span class="rf-text"><b>${esc(i.name)}</b><small>${i.qty != null ? `${i.qty} made` : TYPE_LABEL[i.type]}</small></span>
        <span class="rf-date">${shortDate(i.date)}</span></button>`).join('')}
    </section>` : ''}
  </div>`;
}

// Tapping a calendar day with more than one batch: list them.
function dayList(date) {
  const due = allBatches().filter(x => x.b.ready === date);
  openSheet(`
    <div class="sheet-head"><h2>${parseDate(date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</h2>
      <button class="iconbtn" data-close aria-label="Close">${ICONS.close}</button></div>
    <div class="list">${due.map(x => batchCard(x.kind, x.b)).join('')}</div>`, sheet => {
    sheet.addEventListener('click', e => {
      const c = e.target.closest('[data-open-batch]');
      if (c) batchDetail(c.dataset.kind, c.dataset.openBatch);
    });
  });
}

function viewHome() {
  const now = new Date();
  const h = now.getHours();
  const greet = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const dateText = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  const batches = allBatches();
  const ready = batches.filter(x => x.info.ready);
  const upcoming = batches.filter(x => !x.info.ready);
  const infusingCount = state.tinctures.filter(b => !batchInfo(b).ready).length;
  const month = today().slice(0, 7);
  const finishedMonth = state.inventory.filter(i => isComplete(i) && (i.date || '').startsWith(month)).length;
  const shakeNeed = state.settings.shakeReminders
    ? state.tinctures.filter(b => !batchInfo(b).ready && state.shaken[b.id] !== today()).length : 0;

  const tile = (n, label, tab, filter) =>
    `<button class="tile" data-go="${tab}" ${filter ? `data-go-filter="${filter}"` : ''}><b>${n}</b><span>${label}</span></button>`;

  // Finished batches still waiting to be bottled or labeled.
  const todoRow = (list, what, todo, icon) => {
    if (!list.length) return '';
    const names = list.map(i => i.name);
    const preview = names.slice(0, 3).join(', ') + (names.length > 3 ? ` +${names.length - 3} more` : '');
    const tab = TAB_FOR_TYPE[list[0].type] || 'inventory';
    return `<button class="hrow" data-go="${tab}" ${tab === 'infusing' || tab === 'salves' ? 'data-go-filter="finish"' : ''}>
        <span class="hico todo">${icon}</span>
        <span><b>${list.length} ${list.length === 1 ? 'batch' : 'batches'} ${what}</b><small>${esc(preview)}</small></span>
        <span class="chev">${ICONS.chev}</span></button>`;
  };
  const todos = todoRow(state.inventory.filter(needsBottling), 'to bottle', 'bottle', ICONS.bottle)
    + todoRow(state.inventory.filter(needsLabel), 'to label', 'label', ICONS.tag);

  // Needs attention: things she can act on today.
  const attention = [
    ...ready.map(x => `<button class="hrow" data-open-batch="${x.b.id}" data-kind="${x.kind}">
        <span class="hico ready">${ICONS.jar}</span>
        <span><b>${esc(x.b.name)}</b><small>${x.kind === 'tincture' ? 'Ready to strain' : 'Oil ready, time to make'} · ${leftText(x.info)}</small></span>
        <span class="chev">${ICONS.chev}</span></button>`),
    shakeNeed ? `<button class="hrow" data-go="infusing">
        <span class="hico">${ICONS.bottle}</span>
        <span><b>Shake ${plural(shakeNeed, 'jar')}</b><small>Daily shake</small></span>
        <span class="chev">${ICONS.chev}</span></button>` : '',
    todos,
  ].join('');

  // Coming up: upcoming batches grouped by ready date.
  const groups = [];
  for (const x of upcoming) {
    const g = groups[groups.length - 1];
    if (g && g.date === x.b.ready) g.items.push(x); else groups.push({ date: x.b.ready, left: x.info.left, items: [x] });
  }
  const timeline = groups.slice(0, 8).map(g => {
    const d = parseDate(g.date);
    return `<li class="tl">
      <div class="tl-date"><b>${d.getDate()}</b><span>${d.toLocaleDateString(undefined, { month: 'short' })}</span></div>
      <div class="tl-body">
        <div class="tl-when">${whenText(g.left)} · ${d.toLocaleDateString(undefined, { weekday: 'long' })}</div>
        <div class="tl-items">${g.items.map(x => `<button class="pill" data-open-batch="${x.b.id}" data-kind="${x.kind}">
          ${x.kind === 'salve' ? ICONS.tin : ICONS.bottle}${esc(x.b.name)}</button>`).join('')}</div>
      </div></li>`;
  }).join('');

  const recent = state.inventory.filter(isComplete).sort((a, z) => (z.date || '').localeCompare(a.date || '')).slice(0, 3);

  return `
    <header class="home-head">
      <button class="iconbtn gear" data-go="settings" aria-label="Settings">${ICONS.gear}</button>
      <img class="home-logo" src="icons/logo.png" alt="Mountain Trails Wellness Studio">
      <p class="greet">${greet} · ${dateText}</p>
    </header>
    <div class="rule"></div>

    <div class="tiles">
      ${tile(infusingCount, 'Infusing', 'infusing', 'infusing')}
      ${tile(ready.length, 'Ready', ready.length && !ready.some(x => x.kind === 'tincture') ? 'salves' : 'infusing', 'ready')}
      ${tile(state.salves.length, 'Salves', 'salves')}
      ${tile(finishedMonth, 'Made this month', 'inventory')}
    </div>

    <div class="home-grid">
    ${attention ? `<section class="panel att">
      <h2>Needs attention</h2>
      ${attention}
    </section>` : ''}

    <section class="panel com">
      <h2>Coming up</h2>
      ${timeline ? `<ol class="timeline">${timeline}</ol>` : '<p class="caught"><span>Nothing infusing right now.</span></p>'}
      ${groups.length > 8 ? `<button class="linkbtn" data-go="infusing">See all ${upcoming.length} batches</button>` : ''}
    </section>

    ${recent.length ? `<section class="panel rec">
      <h2>Recently finished</h2>
      ${recent.map(i => `<button class="hrow" data-open-item="${i.id}">
        <span class="hico">${i.type === 'salve' ? ICONS.tin : ICONS.bottle}</span>
        <span><b>${esc(i.name)}</b><small>${fmtDate(i.date)}${i.qty != null ? ` · ${i.qty} made` : ''}</small></span>
        <span class="chev">${ICONS.chev}</span></button>`).join('')}
      <button class="linkbtn" data-go="inventory">See everything finished</button>
    </section>` : ''}

    ${canEdit('tinctures') ? `<div class="btnrow act">
      <button class="btn" data-act="home-add-tincture">${ICONS.plus}New tincture</button>
      <button class="btn ghost" data-act="home-add-salve">${ICONS.plus}New salve</button>
    </div>` : ''}
    </div>`;
}

/* ================= Infusing & Salves ================= */

const KIND = {
  tincture: { list: 'tinctures', filterKey: 'infusing', liquid: 'Menstruum', liquidHint: 'e.g. 80 proof vodka', infusingLabel: 'Infusing', readyLabel: 'Ready to strain', finishBtn: 'Strain & bottle', started: 'Started' },
  salve: { list: 'salves', filterKey: 'salves', liquid: 'Carrier oil', liquidHint: 'e.g. olive oil', infusingLabel: 'Infusing Oil', readyLabel: 'Ready to make', finishBtn: 'Make salve', started: 'Oil started' },
};

function sortedBatches(kind) {
  return [...state[KIND[kind].list]].sort((a, b) => a.ready.localeCompare(b.ready));
}

function viewBatches(kind) {
  const k = KIND[kind];
  const all = sortedBatches(kind);
  const readyCount = all.filter(b => batchInfo(b).ready).length;
  const pending = stillToFinish(kind);
  if (ui.filters[k.filterKey] === 'finish' && !pending.length) ui.filters[k.filterKey] = 'all'; // all done
  const f = ui.filters[k.filterKey];
  const shown = f === 'finish' ? [] : all.filter(b => f === 'all' || (f === 'ready') === batchInfo(b).ready);

  const head = kind === 'tincture'
    ? pageHead(sprigArt('lavender', 56, 56), 'Tinctures', 'Track your tinctures and never miss a harvest.', 'add-batch')
    : pageHead(sprigArt('calendula', 56, 56), 'Salves', 'Track your salve batches from start to finish.', 'add-batch');

  if (!all.length && !pending.length) {
    return head + (kind === 'tincture'
      ? emptyState('No jars infusing yet', 'Add a tincture when you set a jar on the shelf. You\'ll see a countdown, and a reminder a week before it\'s ready.', 'add-batch', 'Start a tincture')
      : emptyState('No salves in progress', 'Start a batch when you set your herbs infusing in oil. When the oil is ready, make the salve and it moves to Finished.', 'add-batch', 'Start a salve'));
  }

  let shakeNote = '';
  if (kind === 'tincture' && state.settings.shakeReminders) {
    const need = all.filter(b => !batchInfo(b).ready && state.shaken[b.id] !== today()).length;
    if (need) shakeNote = `<div class="notice">${ICONS.jar}<span>${plural(need, 'jar')} still need a shake today.</span></div>`;
  }

  const cards = shown.map(b => batchCard(kind, b)).join('') ||
    (f === 'finish' ? '' : `<p class="fineprint">Nothing ${f === 'all' ? 'infusing' : 'here'} right now.</p>`);

  return head +
    chips(k.filterKey, [['all', `All (${all.length + pending.length})`], ['infusing', `${k.infusingLabel} (${all.length - readyCount})`], ['ready', `Ready (${readyCount})`],
      ...(pending.length ? [['finish', `To bottle &amp; label (${pending.length})`]] : [])]) +
    shakeNote + (cards ? `<div class="list">${cards}</div>` : '') +
    (f === 'all' || f === 'finish' ? toFinishSection(kind) : '');
}

function batchCard(kind, b) {
  const k = KIND[kind];
  const info = batchInfo(b);
  const barCls = info.ready ? 'ready' : '';
  let badge = '';
  if (info.ready) badge = `<span class="badge ready">${ICONS.jar}${k.readyLabel}</span>`;

  let shake = '';
  if (kind === 'tincture' && state.settings.shakeReminders && !info.ready) {
    const done = state.shaken[b.id] === today();
    shake = `<span class="badge shake ${done ? 'done' : ''}" role="button" tabindex="0" data-shake="${b.id}">${done ? '✓ Shaken today' : 'Tap when shaken'}</span>`;
  }

  return `<button class="card" data-open-batch="${b.id}" data-kind="${kind}">
    <div class="thumb">${kind === 'tincture' ? bottleArt(info.pct) : tinArt()}</div>
    <div>
      <h3>${esc(b.name)}</h3>
      <p class="meta">${k.started} ${fmtDate(b.start)}<br>Ready ${fmtDate(b.ready)}</p>
      <div class="progress"><div class="bar ${barCls}"><i style="width:${info.pct}%"></i></div><span class="pct">${info.pct}%</span></div>
      <div class="left">${leftText(info)}</div>
    </div>
    <span class="chev">${ICONS.chev}</span>
    ${badge || shake ? `<div class="wide">${badge} ${shake}</div>` : ''}
  </button>`;
}

function findBatch(kind, id) { return state[KIND[kind].list].find(b => b.id === id); }

function batchForm(kind, existing, presetRecipeId) {
  const k = KIND[kind];
  const recipes = state.recipes.filter(r => r.type === kind);
  const b = existing || { name: '', liquid: '', start: today(), notes: '', recipeId: presetRecipeId || '' };
  let days = existing ? daysBetween(existing.start, existing.ready) : 42;
  if (!existing && presetRecipeId) {
    const r = state.recipes.find(x => x.id === presetRecipeId);
    if (r) { b.name = r.name; if (r.infuseDays) days = r.infuseDays; }
  }
  const useWeeks = days % 7 === 0;

  openSheet(`
    <div class="sheet-head"><h2>${existing ? 'Edit' : 'New'} ${kind === 'tincture' ? 'tincture' : 'salve batch'}</h2>
      <button class="iconbtn" data-close aria-label="Close">${ICONS.close}</button></div>
    <form id="bf">
      ${recipes.length ? `<label class="field"><span>From recipe (optional)</span>
        <select name="recipeId"><option value="">— None —</option>
        ${recipes.map(r => `<option value="${r.id}" ${r.id === b.recipeId ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select></label>` : ''}
      <label class="field"><span>Name</span><input name="name" required value="${esc(b.name)}" placeholder="${kind === 'tincture' ? 'e.g. Elderberry' : 'e.g. Calendula Salve'}"></label>
      <label class="field"><span>${k.liquid}</span><input name="liquid" value="${esc(b.liquid)}" placeholder="${k.liquidHint}"></label>
      <label class="field"><span>${kind === 'tincture' ? 'Start date' : 'Oil start date'}</span><input type="date" name="start" required value="${b.start}"></label>
      <div class="field"><span>${kind === 'tincture' ? 'Infuse for' : 'Oil infuses for'}</span>
        <div class="two"><input type="number" name="amount" min="1" max="730" required value="${useWeeks ? days / 7 : days}" inputmode="numeric">
          <select name="unit"><option value="7" ${useWeeks ? 'selected' : ''}>weeks</option><option value="1" ${useWeeks ? '' : 'selected'}>days</option></select></div></div>
      <div class="calc" id="calc"></div>
      <label class="field"><span>Notes</span><textarea name="notes" placeholder="Herb weight, ratio, where the jar is…">${esc(b.notes)}</textarea></label>
      <button class="btn block" type="submit">${existing ? 'Save changes' : (kind === 'tincture' ? 'Start infusing' : 'Start batch')}</button>
    </form>`, sheet => {
    const form = $('#bf', sheet);
    const calc = () => {
      const n = Number(form.amount.value) * Number(form.unit.value);
      $('#calc', sheet).textContent = form.start.value && n > 0 ? `Ready on ${fmtDate(addDays(form.start.value, n))}` : '';
    };
    form.addEventListener('input', calc);
    form.recipeId?.addEventListener('change', () => {
      const r = state.recipes.find(x => x.id === form.recipeId.value);
      if (!r) return;
      form.name.value = r.name;
      if (r.infuseDays) {
        const w = r.infuseDays % 7 === 0;
        form.amount.value = w ? r.infuseDays / 7 : r.infuseDays;
        form.unit.value = w ? '7' : '1';
      }
      calc();
    });
    calc();
    form.addEventListener('submit', e => {
      e.preventDefault();
      const n = Number(form.amount.value) * Number(form.unit.value);
      const data = {
        name: form.name.value.trim(),
        liquid: form.liquid.value.trim(),
        start: form.start.value,
        ready: addDays(form.start.value, n),
        notes: form.notes.value.trim(),
        recipeId: form.recipeId ? form.recipeId.value : '',
      };
      if (existing) {
        if (existing.ready !== data.ready) existing.notifiedReady = false;
        Object.assign(existing, data);
      } else {
        state[k.list].push({ id: uid(), ...data, notifiedReady: false });
      }
      save(); closeSheet(); render(); checkReminders();
      toast(existing ? 'Saved' : `${data.name} is ${kind === 'tincture' ? 'infusing' : 'started'} — ready ${fmtDate(data.ready)}`);
    });
  });
}

function batchDetail(kind, id) {
  const k = KIND[kind];
  const b = findBatch(kind, id);
  if (!b) return;
  const info = batchInfo(b);
  const recipe = state.recipes.find(r => r.id === b.recipeId);
  openSheet(`
    <div class="sheet-head"><h2>${esc(b.name)}</h2><button class="iconbtn" data-close aria-label="Close">${ICONS.close}</button></div>
    <div class="detail-bottle">
      ${kind === 'tincture' ? bottleArt(info.pct) : tinArt()}
      <div>
        <div class="big-left">${leftText(info)}</div>
        <div class="progress"><div class="bar ${info.ready ? 'ready' : ''}"><i style="width:${info.pct}%"></i></div><span class="pct">${info.pct}%</span></div>
        ${info.ready ? `<span class="badge ready">${ICONS.jar}${k.readyLabel}</span>` : ''}
      </div>
    </div>
    <dl class="kv">
      <dt>${k.started}</dt><dd>${fmtDate(b.start)}</dd>
      <dt>Ready</dt><dd>${fmtDate(b.ready)}</dd>
      <dt>Steep time</dt><dd>${fmtDuration(info.total)}</dd>
      ${b.liquid ? `<dt>${k.liquid}</dt><dd>${esc(b.liquid)}</dd>` : ''}
      ${recipe ? `<dt>Recipe</dt><dd>${esc(recipe.name)}</dd>` : ''}
    </dl>
    ${b.notes ? `<div class="note-box">${esc(b.notes)}</div>` : ''}
    ${canEdit(k.list) ? `<button class="btn block ${info.ready ? '' : 'ghost'}" data-finish style="margin-top:14px">${ICONS.jar}${k.finishBtn}</button>
    <div class="btnrow">
      <button class="btn ghost" data-edit>Edit</button>
      <button class="btn danger" data-delete>Delete</button>
    </div>` : ''}`, sheet => {
    if (!canEdit(k.list)) return;
    $('[data-edit]', sheet).onclick = () => batchForm(kind, b);
    $('[data-finish]', sheet).onclick = () => finishForm(kind, b);
    $('[data-delete]', sheet).onclick = () => {
      if (!confirm(`Delete "${b.name}"? This can't be undone.`)) return;
      state[k.list] = state[k.list].filter(x => x.id !== b.id);
      delete state.shaken[b.id];
      save(); closeSheet(); render();
    };
  });
}

// Strain a tincture / pour a salve: the batch leaves the tracker and is logged as finished.
/* ---------- Bottled / Labeled checks on finished batches ---------- */

const shortDate = d => parseDate(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const needsBottling = i => !i.bottled;
const needsLabel = i => !!i.bottled && !i.labeled; // labels go on once it's bottled
const isComplete = i => !!i.bottled && !!i.labeled;
// Tinctures, salves and teas wait in their own tab until bottled and labeled; then they're Finished.
const TAB_FOR_TYPE = { tincture: 'infusing', salve: 'salves', tea: 'teas' };
const stillToFinish = type => state.inventory.filter(i => i.type === type && !isComplete(i))
  .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
const inFinished = i => isComplete(i) || !TAB_FOR_TYPE[i.type];

// A strained/poured/blended batch card, with its Bottled and Labeled buttons.
function finishedCard(i) {
  return `<div class="card" data-open-item="${i.id}" role="button" tabindex="0">
    <div class="thumb">${inventoryArt(i.type)}</div>
    <div><h3>${esc(i.name)}</h3>
      <p class="meta">${i.type === 'salve' ? 'Poured' : i.type === 'tea' ? 'Blended' : i.type === 'tincture' ? 'Strained' : 'Made'} ${fmtDate(i.date)}${i.started ? `<br>Started ${fmtDate(i.started)}` : ''}</p>
      ${i.size ? `<span class="tag">${esc(i.size)}</span>` : ''}</div>
    ${i.qty != null ? `<div class="made"><b>${i.qty}</b><small>made</small></div>` : `<span class="chev">${ICONS.chev}</span>`}
    ${checkChips(i)}
  </div>`;
}

// The "Bottling & labeling" section shown in the Tinctures, Salves and Teas tabs.
function toFinishSection(type) {
  const list = stillToFinish(type);
  if (!list.length) return '';
  return `<h2 class="section-h to-finish-h">Bottling &amp; labeling <span class="count">${list.length}</span></h2>
    <p class="fineprint to-finish-note">Check off <b>Bottled</b> and <b>Labeled</b>. Once both are done, it moves to Finished.</p>
    <div class="list">${list.map(finishedCard).join('')}</div>`;
}

// The two checkboxes used in the finish/add/edit forms.
function checkFields(i = {}) {
  return `<div class="field"><span>Progress</span><div class="checkrow">
    <label class="check"><input type="checkbox" name="bottled" ${i.bottled ? 'checked' : ''}> Bottled</label>
    <label class="check"><input type="checkbox" name="labeled" ${i.labeled ? 'checked' : ''}> Labeled</label>
  </div></div>`;
}
// Keeps the original date when a box stays checked; today's date when newly checked.
const checkValue = (checked, prev) => checked ? (prev || today()) : null;

// The two tap-to-check buttons on a finished card.
function checkChips(i) {
  const chip = (field, label) => {
    const d = i[field];
    return `<button class="check-chip ${d ? 'done' : ''}" data-check="${field}" data-id="${i.id}" aria-pressed="${!!d}" ${canEdit('inventory') ? '' : 'disabled'}>
      ${d ? `✓ ${label} <small>${shortDate(d)}</small>` : `○ ${label}`}</button>`;
  };
  return `<div class="wide checks">${chip('bottled', 'Bottled')}${chip('labeled', 'Labeled')}</div>`;
}

function finishForm(kind, b) {
  const isT = kind === 'tincture';
  openSheet(`
    <div class="sheet-head"><h2>${isT ? 'Strain & bottle' : 'Make salve'}</h2><button class="iconbtn" data-close aria-label="Close">${ICONS.close}</button></div>
    <p class="fineprint" style="text-align:left;margin:0 0 12px"><b>${esc(b.name)}</b> stays in this tab until it's bottled and labeled, then moves to Finished.</p>
    <form id="ff">
      <label class="field"><span>Name</span><input name="name" required value="${esc(b.name)}"></label>
      <div class="two">
        <label class="field"><span>How many made</span><input type="number" name="qty" min="0" inputmode="numeric" placeholder="e.g. 32"></label>
        <label class="field"><span>Size</span><input name="size" placeholder="${isT ? 'e.g. 2 oz bottles' : 'e.g. 2 oz tins'}"></label>
      </div>
      <label class="field"><span>${isT ? 'Strained on' : 'Poured on'}</span><input type="date" name="date" required value="${today()}"></label>
      ${checkFields()}
      <button class="btn block" type="submit">Mark as finished</button>
    </form>`, sheet => {
    $('#ff', sheet).addEventListener('submit', e => {
      e.preventDefault();
      const f = e.target;
      state.inventory.push({
        id: uid(), type: kind, name: f.name.value.trim(), size: f.size.value.trim(),
        qty: f.qty.value === '' ? null : Math.max(0, Number(f.qty.value)), date: f.date.value,
        started: b.start, notes: b.notes || '',
        bottled: checkValue(f.bottled.checked), labeled: checkValue(f.labeled.checked),
      });
      const list = KIND[kind].list;
      state[list] = state[list].filter(x => x.id !== b.id);
      delete state.shaken[b.id];
      save(); closeSheet(); render();
      const done = f.bottled.checked && f.labeled.checked;
      toast(done ? `${f.name.value.trim()} moved to Finished` : `${f.name.value.trim()} strained. Bottle and label it below to finish.`);
    });
  });
}

/* ================= Finished ================= */

const TYPE_LABEL = { tincture: 'Tincture', salve: 'Salve', tea: 'Tea', other: 'Other' };

function viewInventory() {
  const q = ui.search.inventory.toLowerCase();
  const f = ui.filters.inventory;
  const items = state.inventory
    .filter(inFinished)
    .filter(i => (f === 'all' || i.type === f) && (!q || i.name.toLowerCase().includes(q)))
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || a.name.localeCompare(b.name));
  const head = `<div class="backbar phone-only"><button class="iconbtn" data-go="home" aria-label="Back to home">${ICONS.back}</button></div>` + pageHead(`<span style="color:var(--forest)">${ICONS.shelf}</span>`, 'Finished', 'A record of every batch you\'ve made.', 'add-item');

  if (!state.inventory.some(inFinished)) {
    return head + emptyState('Nothing finished yet', 'Batches land here once they\'re bottled and labeled: what you made, how many, and when. Until then they wait in their own tab.', 'add-item', 'Add a finished batch');
  }
  return head + `
    <div class="searchrow">
      <label class="search">${ICONS.search}<input type="search" id="inv-q" placeholder="Search finished…" value="${esc(ui.search.inventory)}" aria-label="Search finished batches"></label>
      <select id="inv-type" aria-label="Type">
        ${[['all', 'All Types'], ['tincture', 'Tinctures'], ['salve', 'Salves'], ['tea', 'Teas'], ['other', 'Other']].map(([v, l]) => `<option value="${v}" ${f === v ? 'selected' : ''}>${l}</option>`).join('')}
      </select>
    </div>
    <div class="list">${items.map(finishedCard).join('') || '<p class="fineprint">No matches.</p>'}</div>`;
}

function itemForm(existing, preset = {}) {
  const i = existing || { name: '', type: 'tincture', size: '', qty: null, date: today(), started: '', notes: '', ...preset };
  openSheet(`
    <div class="sheet-head"><h2>${!canEdit('inventory') ? 'Finished batch' : existing ? 'Edit finished batch' : 'Add finished batch'}</h2><button class="iconbtn" data-close aria-label="Close">${ICONS.close}</button></div>
    <form id="if">
      <label class="field"><span>Name</span><input name="name" required value="${esc(i.name)}"></label>
      <div class="two">
        <label class="field"><span>Type</span><select name="type">${Object.entries(TYPE_LABEL).map(([v, l]) => `<option value="${v}" ${i.type === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="field"><span>How many made</span><input type="number" name="qty" min="0" value="${i.qty ?? ''}" inputmode="numeric" placeholder="Optional"></label>
      </div>
      <label class="field"><span>Size</span><input name="size" value="${esc(i.size)}" placeholder="e.g. 2 oz bottles"></label>
      <div class="two">
        <label class="field"><span>Started</span><input type="date" name="started" value="${i.started || ''}"></label>
        <label class="field"><span>Finished</span><input type="date" name="date" required value="${i.date}"></label>
      </div>
      ${checkFields(i)}
      <label class="field"><span>Notes</span><textarea name="notes">${esc(i.notes)}</textarea></label>
      <button class="btn block" type="submit">${existing ? 'Save changes' : 'Add to Finished'}</button>
      ${existing ? '<button class="btn danger block" type="button" data-delete style="margin-top:10px">Delete</button>' : ''}
    </form>`, sheet => {
    const form = $('#if', sheet);
    if (!canEdit('inventory')) { // viewers can look but not change
      $$('input, select, textarea', form).forEach(el => { el.disabled = true; });
      $$('button', form).forEach(el => el.remove());
      return;
    }
    form.addEventListener('submit', e => {
      e.preventDefault();
      const data = {
        name: form.name.value.trim(), type: form.type.value,
        qty: form.qty.value === '' ? null : Math.max(0, Number(form.qty.value)),
        size: form.size.value.trim(), started: form.started.value, date: form.date.value, notes: form.notes.value.trim(),
        bottled: checkValue(form.bottled.checked, i.bottled), labeled: checkValue(form.labeled.checked, i.labeled),
      };
      if (existing) Object.assign(existing, data); else state.inventory.push({ id: uid(), ...data });
      save(); closeSheet(); render();
    });
    const del = $('[data-delete]', sheet);
    if (del) del.onclick = () => {
      if (!confirm(`Delete "${i.name}" from Finished?`)) return;
      state.inventory = state.inventory.filter(x => x.id !== i.id);
      save(); closeSheet(); render();
    };
  });
}

/* ================= Recipes ================= */

function viewRecipes() {
  const q = ui.search.recipes.toLowerCase();
  const f = ui.filters.recipes;
  const head = pageHead(`<span style="color:var(--forest)">${ICONS.book}</span>`, 'Recipes', 'Your collection of herbal recipes.', 'add-recipe');
  if (!state.recipes.length) {
    return head + emptyState('Your recipe book is blank', 'Write down your formulas: ingredients, ratios, steps and steep times. Then start a batch straight from a recipe.', 'add-recipe', 'Add a recipe');
  }
  const items = state.recipes
    .filter(r => (f === 'all' || r.type === f) && (!q || [r.name, r.description, ...r.ingredients.map(i => i.name)].join(' ').toLowerCase().includes(q)))
    .sort((a, b) => a.name.localeCompare(b.name));
  return head + `
    <div class="searchrow"><label class="search">${ICONS.search}<input type="search" id="rec-q" placeholder="Search recipes or herbs…" value="${esc(ui.search.recipes)}" aria-label="Search recipes"></label></div>
    ${chips('recipes', [['all', 'All'], ['tincture', 'Tinctures'], ['salve', 'Salves'], ['tea', 'Teas'], ['other', 'Other']])}
    <div class="list">${items.map(recipeCard).join('') || '<p class="fineprint">No matches.</p>'}</div>`;
}

function recipeCard(r) {
  return `<button class="card" data-open-recipe="${r.id}">
    <div class="thumb">${r.photo ? `<img class="photo" src="${r.photo}" alt="">` : r.type === 'tea' ? teaArt() : sprigArt(r.name)}</div>
    <div><h3>${esc(r.name)}</h3><span class="tag">${TYPE_LABEL[r.type]}</span>
      <p class="meta">${esc(r.description || r.ingredients.map(i => i.name).filter(Boolean).join(', '))}</p></div>
    <span class="chev">${ICONS.chev}</span>
  </button>`;
}

function viewTeas() {
  const head = pageHead(`<span style="color:var(--forest)">${ICONS.tea}</span>`, 'Teas', 'Your tea blends and how to brew them.', 'add-tea');
  const teas = state.recipes.filter(r => r.type === 'tea').sort((a, b) => a.name.localeCompare(b.name));
  const pending = toFinishSection('tea');
  if (!teas.length && !pending) {
    return head + emptyState('No tea blends yet', 'Add a blend with its herbs, ratios and brewing steps. When you mix a batch, log it, then bottle and label it.', 'add-tea', 'Add a tea blend');
  }
  return head + (teas.length ? `<div class="list">${teas.map(recipeCard).join('')}</div>` : '') + pending;
}

function viewRecipe() {
  const r = state.recipes.find(x => x.id === ui.recipeId);
  if (!r) { ui.recipeId = null; return viewRecipes(); }
  const t = ui.recipeTab;
  const canBatch = r.type === 'tincture' || r.type === 'salve';
  const isTea = r.type === 'tea';
  let body = '';
  if (t === 'details') {
    body = `<div class="facts">
        <div class="fact">${ICONS.clock}<div><small>${isTea ? 'Brew time' : r.type === 'salve' ? 'Oil infuse time' : 'Infuse time'}</small><b>${esc(r.infuseText || fmtDuration(r.infuseDays))}</b></div></div>
        <div class="fact">${isTea ? ICONS.tea : ICONS.bottle}<div><small>${isTea ? 'Makes' : 'Yield'}</small><b>${esc(r.yield || '—')}</b></div></div>
      </div>
      ${r.steps.length ? `<h2 class="section-h">Steps</h2><ol class="steps">${r.steps.map(s => `<li><span>${esc(s)}</span></li>`).join('')}</ol>` : ''}`;
  } else if (t === 'ingredients') {
    body = r.ingredients.length
      ? `<h2 class="section-h">Ingredients &amp; Ratios</h2><ul class="ing">${r.ingredients.map(i => `<li><span>${esc(i.name)}</span><span>${esc(i.amount)}</span></li>`).join('')}</ul>`
      : '<p class="fineprint">No ingredients listed yet.</p>';
  } else {
    body = r.notes ? `<div class="note-box">${esc(r.notes)}</div>` : '<p class="fineprint">No notes yet.</p>';
  }
  return `
    <div class="backbar"><button class="iconbtn" data-act="recipe-back" aria-label="Back">${ICONS.back}</button>
      ${canEdit('recipes') ? '<button class="btn ghost" data-act="edit-recipe" style="min-height:40px">Edit</button>' : ''}</div>
    <div class="recipe-hero">${r.photo ? `<img class="hero-photo" src="${r.photo}" alt="">` : mountainArt()}
      <h1>${esc(r.name)}</h1><div class="kind">${TYPE_LABEL[r.type]}</div>
      ${r.description ? `<p class="desc">${esc(r.description)}</p>` : ''}</div>
    <div class="seg">${[['details', 'Details'], ['ingredients', 'Ingredients'], ['notes', 'Notes']].map(([v, l]) =>
      `<button data-rtab="${v}" aria-pressed="${t === v}">${l}</button>`).join('')}</div>
    ${body}
    ${isTea && canEdit('inventory') ? `<button class="btn block" data-act="log-tea">${ICONS.plus}Log a batch of this tea</button>` : ''}
    ${canBatch && canEdit(r.type === 'salve' ? 'salves' : 'tinctures') ? `<button class="btn block" data-act="batch-from-recipe">${ICONS.plus}Start a ${r.type === 'salve' ? 'salve batch' : 'tincture'} from this recipe</button>` : ''}`;
}

// Center-crops a picture to a small square JPEG so many recipes fit in phone storage.
function squarePhoto(file, size = 360) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const s = Math.min(img.naturalWidth, img.naturalHeight);
      const c = document.createElement('canvas');
      c.width = c.height = size;
      c.getContext('2d').drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad image')); };
    img.src = url;
  });
}

function recipeForm(existing, presetType = 'tincture') {
  const r = existing || { name: '', type: presetType, description: '', infuseDays: presetType === 'tea' ? 0 : 42, infuseText: '', yield: '', ingredients: [{ name: '', amount: '' }], steps: [], notes: '' };
  const days = r.infuseDays || 0;
  const useWeeks = days % 7 === 0;
  const ingRow = (i = { name: '', amount: '' }) => `<div class="ingrow"><input placeholder="Herb or ingredient" value="${esc(i.name)}" data-ing="name"><input placeholder="1 part" value="${esc(i.amount)}" data-ing="amount"><button type="button" class="iconbtn" data-rm aria-label="Remove">${ICONS.close}</button></div>`;
  openSheet(`
    <div class="sheet-head"><h2>${existing ? 'Edit recipe' : 'New recipe'}</h2><button class="iconbtn" data-close aria-label="Close">${ICONS.close}</button></div>
    <form id="rf">
      <label class="field"><span>Name</span><input name="name" required value="${esc(r.name)}" placeholder="e.g. Immune Support Tincture"></label>
      <div class="field"><span>Photo (optional)</span>
        <div class="photo-pick">
          <div class="photo-prev" id="photo-prev">${r.photo ? `<img src="${r.photo}" alt="">` : sprigArt(r.name || 'new', 48, 54)}</div>
          <div class="photo-btns">
            <label class="btn ghost">${r.photo ? 'Change photo' : 'Add photo'}<input type="file" accept="image/*" id="photo-in" hidden></label>
            <button type="button" class="btn danger" id="photo-rm" ${r.photo ? '' : 'hidden'}>Remove</button>
          </div>
        </div></div>
      <label class="field"><span>Type</span><select name="type">${Object.entries(TYPE_LABEL).map(([v, l]) => `<option value="${v}" ${r.type === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="field"><span>Short description</span><input name="description" value="${esc(r.description)}" placeholder="What it's for"></label>
      <div class="field" id="infuse-days" ${r.type === 'tea' ? 'hidden' : ''}><span>Infuse time</span>
        <div class="two"><input type="number" name="amount" min="0" value="${days ? (useWeeks ? days / 7 : days) : ''}" inputmode="numeric">
        <select name="unit"><option value="7" ${useWeeks ? 'selected' : ''}>weeks</option><option value="1" ${useWeeks ? '' : 'selected'}>days</option></select></div>
        <small>Used as the default countdown when you start a batch.</small></div>
      <label class="field"><span id="time-label">${r.type === 'tea' ? 'Brew time' : 'Infuse time as written (optional)'}</span><input name="infuseText" value="${esc(r.infuseText)}" placeholder="${r.type === 'tea' ? 'e.g. 5 min at 200°F' : 'e.g. 4–6 weeks'}"></label>
      <label class="field"><span>Yield</span><input name="yield" value="${esc(r.yield)}" placeholder="e.g. ~2 (60 ml) bottles"></label>
      <div class="field"><span>Ingredients &amp; ratios</span><div id="ings">${(r.ingredients.length ? r.ingredients : [{ name: '', amount: '' }]).map(ingRow).join('')}</div>
        <button type="button" class="btn ghost" data-add-ing>${ICONS.plus}Add ingredient</button></div>
      <label class="field"><span>Steps</span><textarea name="steps" rows="5" placeholder="One step per line">${esc(r.steps.join('\n'))}</textarea></label>
      <label class="field"><span>Notes</span><textarea name="notes" placeholder="Dosage, cautions, sourcing, label text…">${esc(r.notes)}</textarea></label>
      <button class="btn block" type="submit">${existing ? 'Save recipe' : 'Add recipe'}</button>
      ${existing ? '<button class="btn danger block" type="button" data-delete style="margin-top:10px">Delete recipe</button>' : ''}
    </form>`, sheet => {
    const form = $('#rf', sheet);
    const ings = $('#ings', sheet);
    // Teas are brewed, not infused: no countdown, and "Brew time" wording.
    form.type.addEventListener('change', () => {
      const tea = form.type.value === 'tea';
      $('#infuse-days', sheet).hidden = tea;
      $('#time-label', sheet).textContent = tea ? 'Brew time' : 'Infuse time as written (optional)';
      form.infuseText.placeholder = tea ? 'e.g. 5 min at 200°F' : 'e.g. 4–6 weeks';
    });
    $('[data-add-ing]', sheet).onclick = () => { ings.insertAdjacentHTML('beforeend', ingRow()); ings.lastElementChild.querySelector('input').focus(); };
    ings.addEventListener('click', e => { const rm = e.target.closest('[data-rm]'); if (rm) rm.parentElement.remove(); });
    let photo = r.photo || '';
    const showPhoto = () => {
      $('#photo-prev', sheet).innerHTML = photo ? `<img src="${photo}" alt="">` : sprigArt(form.name.value || 'new', 48, 54);
      $('#photo-rm', sheet).hidden = !photo;
      $('#photo-in', sheet).parentElement.firstChild.textContent = photo ? 'Change photo' : 'Add photo';
    };
    $('#photo-in', sheet).onchange = async e => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      try { photo = await squarePhoto(file); showPhoto(); }
      catch (err) { toast('Couldn\'t open that picture. Try a different one.'); }
    };
    $('#photo-rm', sheet).onclick = () => { photo = ''; showPhoto(); };
    form.addEventListener('submit', e => {
      e.preventDefault();
      const data = {
        name: form.name.value.trim(),
        type: form.type.value,
        description: form.description.value.trim(),
        infuseDays: form.type.value === 'tea' ? 0 : (Number(form.amount.value) || 0) * Number(form.unit.value),
        infuseText: form.infuseText.value.trim(),
        yield: form.yield.value.trim(),
        ingredients: $$('.ingrow', ings).map(row => ({ name: $('[data-ing=name]', row).value.trim(), amount: $('[data-ing=amount]', row).value.trim() })).filter(i => i.name),
        steps: form.steps.value.split('\n').map(s => s.trim()).filter(Boolean),
        notes: form.notes.value.trim(),
        photo,
      };
      if (existing) Object.assign(existing, data);
      else { const id = uid(); state.recipes.push({ id, ...data }); ui.recipeId = id; ui.recipeTab = 'details'; }
      save(); closeSheet(); render();
    });
    const del = $('[data-delete]', sheet);
    if (del) del.onclick = () => {
      if (!confirm(`Delete the recipe "${r.name}"?`)) return;
      state.recipes = state.recipes.filter(x => x.id !== r.id);
      ui.recipeId = null;
      save(); closeSheet(); render();
    };
  });
}

/* ================= Settings ================= */

function viewSettings() {
  const s = state.settings;
  const perm = 'Notification' in window ? Notification.permission : 'unsupported';
  const permNote = perm === 'unsupported'
    ? 'This browser can\'t show notifications. On iPhone, add the app to your Home Screen first (Share → Add to Home Screen).'
    : perm === 'denied' ? 'Notifications are blocked for this app in your phone\'s settings.'
    : pushSupported() ? 'A notification at 9 AM the day a batch is ready, even with the app closed.'
    : 'Alerts pop up when you open the app and a batch is ready.';
  const toggle = (key, label, sub) => `<div class="row"><div class="label">${label}<small>${sub}</small></div>
    <label class="switch"><input type="checkbox" data-setting="${key}" ${s[key] ? 'checked' : ''} aria-label="${label}"><span></span></label></div>`;
  return `
    <div class="backbar phone-only"><button class="iconbtn" data-go="home" aria-label="Back to home">${ICONS.back}</button></div>
    <header class="page-head"><div class="art" style="color:var(--forest)">${ICONS.gear}</div><div><h1>Settings</h1><p>Reminders and backups.</p></div><span></span></header>
    <div class="rule"></div>
    <section class="group"><h2>Account</h2>
      <div class="row"><div class="label">Signed in${member ? ` · ${ROLE_LABEL[member.role]}` : ''}<small>${esc(session?.user?.email || 'Not signed in')}</small></div>
        <button class="btn ghost" data-act="sign-out" style="min-height:40px">Sign out</button></div>
      <div class="row"><div class="label">Your name<small>Used to greet you when the app opens.</small></div>
        <input class="name-input" id="my-name" value="${esc(session?.user?.user_metadata?.name || '')}" placeholder="First name" autocomplete="given-name" aria-label="Your name"></div>
      <div class="row"><div class="label">Cloud backup<small id="sync-status">${esc(syncText())}</small></div>
        <button class="btn ghost" data-act="sync-now" style="min-height:40px">Sync now</button></div>
    </section>
    ${member?.role === 'owner' ? `<section class="group"><h2>People</h2>
      <div id="people-list"><p class="fineprint" style="padding:8px 14px">Loading…</p></div>
      <form id="add-person" class="add-person">
        <div class="label">Add someone<small>Create their login in Supabase first (Authentication → Users → Add user), then add their email here.</small></div>
        <input type="email" name="email" placeholder="their@email.com" required aria-label="Their email">
        <div class="two">
          <select name="role" aria-label="Role"><option value="editor">Editor</option><option value="viewer">Viewer</option><option value="owner">Owner</option></select>
          <button class="btn" type="submit">Add</button>
        </div>
        <p class="role-help"><b>Owner:</b> everything, plus managing people. <b>Editor:</b> everything except changing recipes. <b>Viewer:</b> can look, can't change.</p>
      </form>
    </section>` : ''}
    <section class="group"><h2>Reminders</h2>
      ${toggle('notifications', 'Phone notifications', permNote)}
      ${toggle('shakeReminders', 'Daily shake reminders', 'Show a "shaken today" check on each infusing jar.')}
    </section>
    <section class="group"><h2>App</h2>
      <div class="row"><div class="label">Home style<small>Calendar (this week at a glance) or the classic Home. Just changes this device.</small></div>
        <select id="home-style" class="name-input" aria-label="Home style">
          <option value="calendar" ${s.homeStyle !== 'classic' ? 'selected' : ''}>Calendar</option>
          <option value="classic" ${s.homeStyle === 'classic' ? 'selected' : ''}>Classic</option>
        </select></div>
      <div class="row"><div class="label">Get the latest version<small>Reloads the app with any new updates. Your data and sign-in stay as they are.</small></div>
        <button class="btn ghost" data-act="refresh-app" style="min-height:40px">Update</button></div>
    </section>
    <section class="group"><h2>Backup file</h2>
      <div class="row"><div class="label">Save a backup<small>Everything is already saved to your account. This makes an extra copy as a file.</small></div>
        <button class="btn ghost" data-act="export" style="min-height:40px">Save</button></div>
      ${canEdit('tinctures') ? `<div class="row"><div class="label">Load a file<small>Restore a backup, or add items from a file someone sends you.</small></div>
        <label class="btn ghost" style="min-height:40px">Load<input type="file" accept="application/json,.json" id="import" hidden></label></div>` : ''}
    </section>
    <p class="fineprint">${state.tinctures.length} tinctures · ${state.salves.length} salves · ${state.inventory.length} finished · ${state.recipes.length} recipes</p>`;
}

/* ================= Cloud sync (Supabase) ================= */

const COLLECTIONS = ['tinctures', 'salves', 'inventory', 'recipes'];
const SYNCED_KEY = 'mtws-synced-v1';
const TABLE = 'apothecary_items';
const cfg = window.MTWS_CONFIG || {};
const sb = cfg.supabaseUrl && cfg.supabaseKey && window.supabase
  ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey)
  : null;
let session = null;
let syncTimer = null;
let syncing = false;
let syncState = 'idle'; // idle | saving | offline | error
const MEMBER_KEY = 'mtws-member-v1';
let member = (() => { try { return JSON.parse(localStorage.getItem(MEMBER_KEY)); } catch (e) { return null; } })(); // { studioId, role }

const ROLE_LABEL = { owner: 'Owner', editor: 'Editor', viewer: 'Viewer' };

// Mirrors the database rules: owners change anything, editors everything but recipes, viewers nothing.
function canEdit(collection) {
  if (!member) return !sb; // no account set up (offline fallback): allow local edits
  return member.role === 'owner' || (member.role === 'editor' && collection !== 'recipes');
}

function syncText() {
  if (!sb) return 'Offline. Changes are saved on this phone and will upload later.';
  if (syncState === 'saving') return 'Saving…';
  if (syncState === 'offline') return 'Offline. Changes will upload when you\'re back online.';
  if (syncState === 'error') return 'Couldn\'t reach your account. Will try again.';
  return pendingChanges().count ? 'Waiting to upload changes…' : 'All changes saved to the studio.';
}

function setSyncState(s) {
  syncState = s;
  const el = $('#sync-status');
  if (el) el.textContent = syncText();
}

// Small string hash, so we can tell which items changed since the last upload.
function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36);
}

function loadSynced() { try { return JSON.parse(localStorage.getItem(SYNCED_KEY)) || {}; } catch (e) { return {}; } }
function storeSynced(map) { try { localStorage.setItem(SYNCED_KEY, JSON.stringify(map)); } catch (e) { /* retried next sync */ } }

function currentMap() {
  const map = {};
  for (const c of COLLECTIONS) for (const item of state[c]) map[`${c}/${item.id}`] = hash(JSON.stringify(item));
  return map;
}

function pendingChanges() {
  const synced = loadSynced(), now = currentMap();
  const allowed = k => canEdit(k.slice(0, k.indexOf('/')));
  const changed = Object.keys(now).filter(k => synced[k] !== now[k] && allowed(k));
  const removed = Object.keys(synced).filter(k => !(k in now) && allowed(k));
  return { changed, removed, now, count: changed.length + removed.length };
}

function scheduleSync() {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => pushChanges(), 800);
}

// Uploads anything added or changed since the last sync, and removes deleted items.
async function pushChanges() {
  if (!sb || !session || !member || syncing) return false;
  const { changed, removed, now } = pendingChanges();
  if (!changed.length && !removed.length) { setSyncState('idle'); return true; }
  if (!navigator.onLine) { setSyncState('offline'); return false; }
  syncing = true;
  setSyncState('saving');
  try {
    const stamp = new Date().toISOString();
    const rows = changed.map(k => {
      const [collection, id] = [k.slice(0, k.indexOf('/')), k.slice(k.indexOf('/') + 1)];
      return { studio_id: member.studioId, collection, id, data: state[collection].find(x => x.id === id), updated_at: stamp };
    });
    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await sb.from(TABLE).upsert(rows.slice(i, i + 200), { onConflict: 'studio_id,collection,id' });
      if (error) throw error;
    }
    for (const c of COLLECTIONS) {
      const ids = removed.filter(k => k.startsWith(c + '/')).map(k => k.slice(c.length + 1));
      if (!ids.length) continue;
      const { error } = await sb.from(TABLE).delete().eq('studio_id', member.studioId).eq('collection', c).in('id', ids);
      if (error) throw error;
    }
    const synced = loadSynced();
    for (const k of changed) synced[k] = now[k];
    for (const k of removed) delete synced[k];
    storeSynced(synced);
    syncing = false;
    setSyncState('idle');
    if (pendingChanges().count) scheduleSync(); // edits made while uploading
    return true;
  } catch (e) {
    syncing = false;
    setSyncState(navigator.onLine ? 'error' : 'offline');
    return false;
  }
}

// Uploads local changes first, then replaces local data with what's in her account
// (so edits made on another device show up here).
async function pullChanges() {
  if (!sb || !session || !member) return;
  if (!(await pushChanges())) return;
  try {
    const { data, error } = await sb.from(TABLE).select('collection,id,data').eq('studio_id', member.studioId).limit(5000);
    if (error) throw error;
    if (pendingChanges().count) return; // she edited something mid-download; next sync catches up
    const fresh = Object.fromEntries(COLLECTIONS.map(c => [c, []]));
    for (const row of data) if (fresh[row.collection]) fresh[row.collection].push(row.data);
    Object.assign(state, fresh);
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* cache only */ }
    // Anything this person can't change is now exactly what's in the studio.
    storeSynced(currentMap());
    setSyncState('idle');
    if (!$('#sheet-root').firstChild && !document.activeElement?.matches('input, textarea, select')) render();
  } catch (e) {
    setSyncState(navigator.onLine ? 'error' : 'offline');
  }
}

/* ---------- Sign in ---------- */

function showSignIn(message = '') {
  document.body.classList.add('signed-out');
  closeSheet();
  $('#view').innerHTML = `
    <div class="signin">
      <img class="home-logo" src="icons/logo.png" alt="Mountain Trails Wellness Studio">
      <div class="rule"></div>
      <h1>Welcome back</h1>
      <p class="fineprint">Sign in to see your tinctures, salves and recipes.</p>
      ${sb ? `<form id="signin-form">
        <label class="field"><span>Email</span><input type="email" name="email" autocomplete="username" required></label>
        <label class="field"><span>Password</span><input type="password" name="password" autocomplete="current-password" required></label>
        <p class="form-error" id="signin-error" role="alert">${esc(message)}</p>
        <button class="btn block" type="submit">Sign in</button>
        <button class="linkbtn" type="button" id="forgot">Forgot password?</button>
      </form>` : `<p class="form-error">Can't reach the sign-in service right now. Check the internet connection and reopen the app.</p>`}
    </div>`;
  const form = $('#signin-form');
  if (!form) return;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = 'Signing in…';
    const { error } = await sb.auth.signInWithPassword({ email: form.email.value.trim(), password: form.password.value });
    if (error) {
      btn.disabled = false; btn.textContent = 'Sign in';
      $('#signin-error').textContent = /invalid/i.test(error.message) ? 'That email or password isn\'t right.' : navigator.onLine ? error.message : 'You\'re offline. Connect to the internet to sign in.';
    }
  });
  $('#forgot').onclick = async () => {
    const email = form.email.value.trim();
    if (!email) { $('#signin-error').textContent = 'Type your email above first, then tap "Forgot password?"'; return; }
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    $('#signin-error').textContent = error ? 'Couldn\'t send the email. Try again in a minute.' : 'Check your email for a link to set a new password.';
  };
}

// Opened from the "reset password" email link.
function showNewPassword() {
  openSheet(`
    <div class="sheet-head"><h2>Set a new password</h2></div>
    <form id="np">
      <label class="field"><span>New password</span><input type="password" name="pw" minlength="8" autocomplete="new-password" required></label>
      <p class="form-error" id="np-error" role="alert"></p>
      <button class="btn block" type="submit">Save password</button>
    </form>`, sheet => {
    $('#np', sheet).addEventListener('submit', async e => {
      e.preventDefault();
      const { error } = await sb.auth.updateUser({ password: e.target.pw.value });
      if (error) { $('#np-error', sheet).textContent = error.message; return; }
      closeSheet();
      toast('Password saved. Use it next time you sign in.');
    });
  });
}

async function signOut() {
  if (pendingChanges().count && !confirm('Some changes haven\'t uploaded yet and will be lost if you sign out. Sign out anyway?')) return;
  if (!confirm('Sign out of the app on this phone?')) return;
  await unsubscribePush(); // stop this phone getting the studio's reminders
  await sb?.auth.signOut();
  localStorage.removeItem(STORE_KEY);
  localStorage.removeItem(SYNCED_KEY);
  localStorage.removeItem(MEMBER_KEY);
  state = defaultState();
  session = null;
  member = null;
  showSignIn();
}

// Finds which studio this login belongs to and with what role. Uses the last known
// answer when offline.
async function loadMembership() {
  if (!sb || !session) return member;
  try {
    const { data, error } = await sb.from('studio_members').select('studio_id, role').eq('user_id', session.user.id).limit(1);
    if (error) throw error;
    const m = data[0];
    if (member && (!m || m.studio_id !== member.studioId)) {
      // Removed from the studio, or moved: drop what's cached on this phone.
      localStorage.removeItem(STORE_KEY); localStorage.removeItem(SYNCED_KEY);
      state = { ...defaultState(), settings: state.settings };
    }
    member = m ? { studioId: m.studio_id, role: m.role } : null;
    if (member) localStorage.setItem(MEMBER_KEY, JSON.stringify(member)); else localStorage.removeItem(MEMBER_KEY);
  } catch (e) { /* offline: keep the cached membership */ }
  return member;
}

function showNotMember() {
  document.body.classList.add('signed-out');
  $('#view').innerHTML = `
    <div class="signin">
      <img class="home-logo" src="icons/logo.png" alt="Mountain Trails Wellness Studio">
      <div class="rule"></div>
      <h1>Almost there</h1>
      <p class="fineprint">You're signed in as <b>${esc(session?.user?.email || '')}</b>, but you haven't been added to the studio yet. Ask an owner to add you in Settings → People.</p>
      <button class="btn block" id="retry-member" style="margin-top:16px">Check again</button>
      <button class="linkbtn" id="nm-signout">Sign out</button>
    </div>`;
  $('#retry-member').onclick = () => enterApp();
  $('#nm-signout').onclick = async () => { await sb?.auth.signOut(); session = null; showSignIn(); };
}

async function enterApp() {
  if (sb && session && !(await loadMembership())) return showNotMember();
  document.body.classList.remove('signed-out');
  ui.tab = 'home';
  render();
  setTimeout(checkReminders, 600);
  pullChanges();
  // Phones can get a new push address after updates; re-register quietly.
  if (state.settings.notifications && 'Notification' in window && Notification.permission === 'granted') subscribePush();
}

/* ---------- Push notifications (reminders with the app closed) ---------- */

const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && !!cfg.vapidPublicKey;

function keyBytes(b64url) {
  const s = atob(b64url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - b64url.length % 4) % 4));
  return Uint8Array.from(s, c => c.charCodeAt(0));
}

// Registers this phone with the studio so the daily job can reach it.
async function subscribePush() {
  if (!pushSupported() || !sb || !session || !member) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription()
      || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(cfg.vapidPublicKey) });
    const { error } = await sb.from('push_subscriptions').upsert(
      { endpoint: sub.endpoint, subscription: sub.toJSON(), user_id: session.user.id, studio_id: member.studioId },
      { onConflict: 'endpoint' });
    if (error) throw error;
    if (!state.settings.push) { state.settings.push = true; save(); }
    return true;
  } catch (e) {
    return false;
  }
}

async function unsubscribePush() {
  state.settings.push = false;
  save();
  if (!pushSupported()) return;
  try {
    const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
    if (!sub) return;
    if (sb && session) await sb.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
    await sub.unsubscribe();
  } catch (e) { /* nothing left to clean up */ }
}

async function setNotifications(on, input) {
  if (!on) { state.settings.notifications = false; save(); unsubscribePush(); return; }
  if (!('Notification' in window)) { input.checked = false; toast('Add the app to your Home Screen to turn on notifications.'); return; }
  let perm = Notification.permission;
  if (perm === 'default') perm = await Notification.requestPermission();
  if (perm !== 'granted') { input.checked = false; state.settings.notifications = false; save(); render(); toast('Notifications were not allowed.'); return; }
  state.settings.notifications = true;
  save();
  const pushed = await subscribePush();
  notify('Reminders are on', pushed
    ? 'You\'ll get a notification the morning a batch is ready, even with the app closed.'
    : 'You\'ll get a heads-up when you open the app and a batch is ready.');
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `apothecary-backup-${today()}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      const lists = ['tinctures', 'salves', 'inventory', 'recipes'];
      if (!lists.some(k => Array.isArray(data[k]))) throw new Error('bad file');
      const count = lists.reduce((n, k) => n + (data[k]?.length || 0), 0);
      const hasData = lists.some(k => state[k].length);
      let mode = 'replace';
      if (hasData) {
        if (confirm(`This file has ${plural(count, 'item')}. Add them to what's already in the app?\n\nOK = add (keeps everything you have)\nCancel = more options`)) mode = 'add';
        else if (!confirm('Replace EVERYTHING in the app with this file instead? This can\'t be undone.')) return;
      }
      if (mode === 'add') {
        let added = 0;
        for (const k of lists) {
          const have = new Set(state[k].map(x => x.id));
          for (const item of data[k] || []) if (!have.has(item.id)) { state[k].push(item); added++; }
        }
        save(); render(); checkReminders(); toast(`Added ${plural(added, 'item')}`);
      } else {
        const base = defaultState();
        state = { ...base, ...data, settings: { ...base.settings, ...state.settings, ...data.settings } };
        save(); render(); checkReminders(); toast(`Loaded ${plural(count, 'item')}`);
      }
    } catch (e) { toast('That file isn\'t an apothecary backup.'); }
  };
  reader.readAsText(file);
}

/* ================= Reminders ================= */

async function notify(title, body) {
  if (!state.settings.notifications || !('Notification' in window) || Notification.permission !== 'granted') return false;
  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
    if (reg) await reg.showNotification(title, { body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: title });
    else new Notification(title, { body, icon: 'icons/icon-192.png' });
    return true;
  } catch (e) { return false; }
}

// Runs on open, when the app comes back to the foreground, and hourly while open.
// Each batch alerts once, when it's ready.
function checkReminders() {
  const alerts = [];
  for (const kind of ['tincture', 'salve']) {
    for (const b of state[KIND[kind].list]) {
      const info = batchInfo(b);
      if (info.ready && !b.notifiedReady) {
        alerts.push([`${b.name} is ready`, kind === 'tincture' ? 'Time to strain and bottle it.' : 'The oil is ready. Time to make the salve.', 'ready']);
        b.notifiedReady = true;
      }
    }
  }
  if (state.settings.shakeReminders && state.lastShakeNotice !== today()) {
    const need = state.tinctures.filter(b => !batchInfo(b).ready && state.shaken[b.id] !== today()).length;
    if (need) alerts.push(['Shake day', `${plural(need, 'jar')} could use a shake today.`]);
    state.lastShakeNotice = today();
  }
  if (!alerts.length) return;
  save();
  // With push on, the morning notification already covered "ready"; just show the in-app banner.
  alerts.forEach(([t, body, kind]) => { if (!(kind === 'ready' && state.settings.push)) notify(t, body); });
  toast(alerts.length === 1 ? `${alerts[0][0]}. ${alerts[0][1]}` : `Reminders: ${alerts.map(a => a[0]).join(' · ')}`, 6000);
}

/* ================= Sheet ================= */

function openSheet(html, mount) {
  const root = $('#sheet-root');
  root.innerHTML = `<div class="scrim"><div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div></div>`;
  const scrim = $('.scrim', root);
  const sheet = $('.sheet', root);
  scrim.addEventListener('click', e => { if (e.target === scrim || e.target.closest('[data-close]')) closeSheet(); });
  document.body.style.overflow = 'hidden';
  mount?.(sheet);
  const first = sheet.querySelector('input:not([type=hidden]), select, textarea, button');
  if (first && first.matches('input, select, textarea') && !matchMedia('(pointer: coarse)').matches) first.focus();
}

function closeSheet() {
  $('#sheet-root').innerHTML = '';
  document.body.style.overflow = '';
}

document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#sheet-root').firstChild) closeSheet(); });

/* ================= View bindings ================= */

function kindForTab() { return ui.tab === 'salves' ? 'salve' : 'tincture'; }

function bindView() {
  const v = $('#view');

  v.onclick = e => {
    const t = e.target;
    const shake = t.closest('[data-shake]');
    if (shake) {
      e.stopPropagation();
      const id = shake.dataset.shake;
      if (state.shaken[id] === today()) delete state.shaken[id]; else state.shaken[id] = today();
      save(); render(); return;
    }
    const filter = t.closest('[data-filter]');
    if (filter) { ui.filters[filter.dataset.filter] = filter.dataset.val; render(); return; }
    const wk = t.closest('[data-week]');
    if (wk) { ui.calWeek = wk.dataset.week === '0' ? 0 : (ui.calWeek || 0) + Number(wk.dataset.week); render(); return; }
    const day = t.closest('[data-day]');
    if (day) {
      const due = allBatches().filter(x => x.b.ready === day.dataset.day);
      if (due.length === 1) batchDetail(due[0].kind, due[0].b.id); else if (due.length) dayList(day.dataset.day);
      return;
    }
    const check = t.closest('[data-check]');
    if (check) {
      const item = state.inventory.find(x => x.id === check.dataset.id);
      if (item && canEdit('inventory')) {
        const f = check.dataset.check;
        item[f] = item[f] ? null : today();
        save(); render();
        toast(isComplete(item) && TAB_FOR_TYPE[item.type] ? `${item.name} is bottled and labeled. Moved to Finished ✓`
          : item[f] ? `${item.name}: ${f === 'bottled' ? 'bottled' : 'labeled'} ✓` : `${item.name}: unchecked ${f}`);
      }
      return;
    }
    const goBtn = t.closest('[data-go]');
    if (goBtn) {
      const tab = goBtn.dataset.go;
      if (tab === 'inventory') ui.filters.todo = goBtn.dataset.goTodo || 'all';
      if (goBtn.dataset.goFilter && ui.filters[tab] !== undefined) ui.filters[tab] = goBtn.dataset.goFilter;
      else if (ui.filters[tab] !== undefined && tab !== 'recipes') ui.filters[tab] = 'all';
      return go(tab);
    }
    const rtab = t.closest('[data-rtab]');
    if (rtab) { ui.recipeTab = rtab.dataset.rtab; render(); return; }

    const ob = t.closest('[data-open-batch]');
    if (ob) return batchDetail(ob.dataset.kind, ob.dataset.openBatch);
    const oi = t.closest('[data-open-item]');
    if (oi) return itemForm(state.inventory.find(i => i.id === oi.dataset.openItem));
    const orc = t.closest('[data-open-recipe]');
    if (orc) { ui.recipeId = orc.dataset.openRecipe; ui.recipeTab = 'details'; render(); window.scrollTo(0, 0); return; }

    const act = t.closest('[data-act]')?.dataset.act;
    if (act === 'add-batch') batchForm(kindForTab());
    else if (act === 'home-add-tincture') batchForm('tincture');
    else if (act === 'home-add-salve') batchForm('salve');
    else if (act === 'add-item') itemForm();
    else if (act === 'add-recipe') recipeForm();
    else if (act === 'add-tea') recipeForm(null, 'tea');
    else if (act === 'log-tea') {
      const r = state.recipes.find(x => x.id === ui.recipeId);
      itemForm(null, { name: r.name, type: 'tea', date: today() });
    }
    else if (act === 'recipe-back') { ui.recipeId = null; render(); }
    else if (act === 'edit-recipe') recipeForm(state.recipes.find(r => r.id === ui.recipeId));
    else if (act === 'batch-from-recipe') {
      const r = state.recipes.find(x => x.id === ui.recipeId);
      ui.tab = r.type === 'salve' ? 'salves' : 'infusing';
      ui.recipeId = null;
      render();
      batchForm(r.type, null, r.id);
    }
    else if (act === 'export') exportData();
    else if (act === 'sign-out') signOut();
    else if (act === 'sync-now') pullChanges().then(() => toast(syncText()));
    else if (act === 'refresh-app') refreshApp();
  };

  v.onkeydown = e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role=button]')) { e.preventDefault(); e.target.click(); }
  };

  const invQ = $('#inv-q', v);
  if (invQ) invQ.oninput = () => { ui.search.inventory = invQ.value; rerenderKeepingFocus('#inv-q'); };
  const invT = $('#inv-type', v);
  if (invT) invT.onchange = () => { ui.filters.inventory = invT.value; render(); };
  const recQ = $('#rec-q', v);
  if (recQ) recQ.oninput = () => { ui.search.recipes = recQ.value; rerenderKeepingFocus('#rec-q'); };

  $$('[data-setting]', v).forEach(inp => inp.onchange = () => {
    const key = inp.dataset.setting;
    if (key === 'notifications') return setNotifications(inp.checked, inp);
    state.settings[key] = inp.checked;
    save();
  });
  const imp = $('#import', v);
  if (imp) imp.onchange = () => { if (imp.files[0]) importData(imp.files[0]); imp.value = ''; };
  if ($('#people-list', v)) bindPeople(v);
  const homeStyle = $('#home-style', v);
  if (homeStyle) homeStyle.onchange = () => {
    state.settings.homeStyle = homeStyle.value;
    save();
    toast(homeStyle.value === 'classic' ? 'Classic Home is on.' : 'Calendar Home is on.');
  };
  const myName = $('#my-name', v);
  if (myName) myName.onchange = async () => {
    const name = myName.value.trim();
    const { error } = sb && session ? await sb.auth.updateUser({ data: { name } }) : { error: true };
    toast(error ? 'Connect to the internet to save your name.' : name ? `Nice to meet you, ${name}.` : 'Name removed.');
  };
}

/* ---------- People (owners only) ---------- */

async function loadPeople() {
  const box = $('#people-list');
  if (!box) return;
  const { data, error } = await sb.from('studio_members').select('*').eq('studio_id', member.studioId).order('email');
  if (error) { box.innerHTML = `<p class="form-error" style="padding:8px 14px">${navigator.onLine ? 'Couldn\'t load people.' : 'Connect to the internet to manage people.'}</p>`; return; }
  box.innerHTML = data.map(p => {
    const me = p.user_id === session.user.id;
    return `<div class="row person">
      <div class="label">${esc(p.email)}${me ? ' <small style="display:inline">(you)</small>' : ''}</div>
      ${p.locked ? `<span class="locked-role">${ROLE_LABEL[p.role]} · Protected</span>` : `<select data-role-for="${p.user_id}" aria-label="Role for ${esc(p.email)}">
        ${['owner', 'editor', 'viewer'].map(r => `<option value="${r}" ${p.role === r ? 'selected' : ''}>${ROLE_LABEL[r]}</option>`).join('')}
      </select>`}
      ${me || p.locked ? '<span class="iconbtn-spacer"></span>' : `<button class="iconbtn" data-remove="${p.user_id}" data-email="${esc(p.email)}" aria-label="Remove ${esc(p.email)}">${ICONS.close}</button>`}
    </div>`;
  }).join('');
}

function bindPeople(v) {
  loadPeople();
  const rpc = async (fn, args, ok) => {
    const { error } = await sb.rpc(fn, args);
    if (error) toast(navigator.onLine ? error.message || 'That didn\'t work. Try again.' : 'Connect to the internet to manage people.');
    else if (ok) toast(ok);
    if (fn === 'set_member_role' && args.p_user === session.user.id) { await loadMembership(); render(); return !error; }
    loadPeople();
    return !error;
  };
  $('#people-list', v).addEventListener('change', e => {
    const sel = e.target.closest('[data-role-for]');
    if (sel) rpc('set_member_role', { p_user: sel.dataset.roleFor, p_role: sel.value }, 'Role updated');
  });
  $('#people-list', v).addEventListener('click', e => {
    const btn = e.target.closest('[data-remove]');
    if (btn && confirm(`Remove ${btn.dataset.email} from the studio? They'll lose access right away.`)) rpc('remove_member', { p_user: btn.dataset.remove }, 'Removed');
  });
  $('#add-person', v).addEventListener('submit', e => {
    e.preventDefault();
    const f = e.target;
    rpc('add_member', { p_email: f.email.value.trim(), p_role: f.role.value }, `Added ${f.email.value.trim()}`).then(ok => { if (ok) f.reset(); });
  });
}

function rerenderKeepingFocus(sel) {
  const pos = $(sel).selectionStart;
  render();
  const el = $(sel);
  el.focus();
  el.setSelectionRange(pos, pos);
}

// Settings → App → Update: saves anything pending, drops the phone's saved copy of the app
// files, and reloads so the newest version from GitHub is used. Data and sign-in are kept.
async function refreshApp() {
  if (!navigator.onLine) { toast('Connect to the internet to get updates.'); return; }
  toast('Getting the latest version…');
  await pushChanges();
  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
    if (reg) await reg.update();
    if ('caches' in window) for (const key of await caches.keys()) await caches.delete(key);
  } catch (e) { /* reload anyway */ }
  location.reload();
}

/* ================= Welcome ================= */

// One helpful line for the welcome screen: what's ready, what needs doing, or what's next.
function welcomeLine() {
  const batches = allBatches();
  const ready = batches.filter(x => x.info.ready);
  if (ready.length === 1) return `${ready[0].b.name} is ready`;
  if (ready.length > 1) return `${ready.length} batches are ready`;
  const toBottle = state.inventory.filter(needsBottling).length;
  if (toBottle) return `${toBottle} ${toBottle === 1 ? 'batch' : 'batches'} to bottle`;
  const toLabel = state.inventory.filter(needsLabel).length;
  if (toLabel) return `${toLabel} ${toLabel === 1 ? 'batch' : 'batches'} to label`;
  const next = batches.find(x => !x.info.ready);
  if (next) return `Next up: ${next.b.name}, ${whenText(next.info.left).toLowerCase()}`;
  return '';
}

// Her logo, sketched in ink stroke by stroke (left to right, top to bottom), then filled in
// while the sun (or moon) rises into place. Art comes from logo-art.js (traced from her logo).
function welcomeArt(part) {
  const L = window.LOGO_ART;
  if (!L) return '<img class="w-logo" src="icons/logo.png" alt="">';
  const night = part === 'evening';
  const { cx, cy, r } = L.sun;
  const strokes = L.d.split(/(?=M)/).filter(Boolean).map(p => {
    const [x, y] = p.match(/-?[\d.]+/g).map(Number);
    const delay = (x / L.w) * 0.38 + (y / L.h) * 0.22;
    return `<path class="w-draw" pathLength="1" style="animation-delay:${delay.toFixed(2)}s" d="${p}"/>`;
  }).join('');
  const stars = night ? [[60, 70], [130, 30], [40, 170], [820, 60], [760, 110], [870, 150], [700, 30]].map(([x, y], i) =>
    `<circle class="w-star" style="animation-delay:${0.4 + i * 0.08}s" cx="${x}" cy="${y}" r="4"/>`).join('') : '';
  return `<svg viewBox="0 0 ${L.w} ${L.h}" aria-hidden="true">
    <defs><clipPath id="w-horizon"><rect x="0" y="0" width="${L.w}" height="${cy + r + 2}"/></clipPath></defs>
    ${stars}
    <g clip-path="url(#w-horizon)"><circle class="w-sun ${night ? 'w-moon' : 'w-sunball'}" cx="${cx}" cy="${cy}" r="${r}"/></g>
    <path class="w-ink" fill-rule="evenodd" d="${L.d}"/>
    <g class="w-strokes">${strokes}</g>
  </svg>`;
}

function showWelcome() {
  if ($('#welcome')) return;
  const h = new Date().getHours();
  const part = h >= 5 && h < 12 ? 'morning' : h >= 12 && h < 17 ? 'afternoon' : 'evening';
  const name = session?.user?.user_metadata?.name;
  const line = session && member ? welcomeLine() : '';
  const el = document.createElement('div');
  el.id = 'welcome';
  el.className = `welcome ${part}`;
  el.setAttribute('role', 'status');
  el.innerHTML = `
    <div class="w-scene">${welcomeArt(part)}</div>
    <div class="w-greet">Good ${part}${name ? `, ${esc(name)}` : ''}</div>
    ${line ? `<div class="w-line">${esc(line)}</div>` : ''}
    <div class="w-skip">Tap to skip</div>`;
  document.body.appendChild(el);
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    el.classList.add('out');
    setTimeout(() => el.remove(), 250);
  };
  el.addEventListener('click', close);
  setTimeout(close, line ? 1800 : 1600);
}

/* ================= Boot ================= */

$$('.ti').forEach(el => { el.innerHTML = ICONS[el.dataset.icon]; });
$$('.tabbar button, .sidebar [data-tab]').forEach(b => b.addEventListener('click', () => { closeSheet(); go(b.dataset.tab); }));

async function boot() {
  if (sb) {
    const { data } = await sb.auth.getSession();
    session = data.session;
    sb.auth.onAuthStateChange((event, s) => {
      const wasSignedIn = !!session;
      session = s;
      // Supabase calls made directly inside this callback can stall, so defer them.
      if (event === 'PASSWORD_RECOVERY') setTimeout(() => { enterApp(); showNewPassword(); });
      else if (event === 'SIGNED_IN' && !wasSignedIn) setTimeout(enterApp);
      else if (event === 'SIGNED_OUT' && wasSignedIn) setTimeout(() => showSignIn('You\'ve been signed out. Please sign in again.'));
    });
    showWelcome();
    if (session) enterApp(); else showSignIn();
  } else if (cfg.supabaseUrl && state.tinctures.concat(state.salves, state.inventory, state.recipes).length) {
    // The sign-in library couldn't load (offline, first open of the day): use what's on the phone.
    showWelcome();
    enterApp();
  } else {
    showWelcome();
    showSignIn();
  }
}

boot();
setInterval(() => { if (document.body.classList.contains('signed-out')) return; render(); checkReminders(); }, 60 * 60 * 1000);
// Coming back to the app after a minute or more counts as opening it again.
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); return; }
  if (hiddenAt && Date.now() - hiddenAt > 60 * 1000 && !$('#sheet-root').firstChild) showWelcome();
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || document.body.classList.contains('signed-out')) return;
  if (!$('#sheet-root').firstChild) { render(); checkReminders(); }
  pullChanges();
});
window.addEventListener('online', () => pullChanges());
// Others in the studio may be making changes too; check every minute while the app is open.
setInterval(() => {
  if (document.visibilityState === 'visible' && !document.body.classList.contains('signed-out')) loadMembership().then(m => m ? pullChanges() : showNotMember());
}, 60 * 1000);

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
