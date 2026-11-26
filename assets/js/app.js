/* app.js — Money Diary. Tanpa backend, tanpa build; data di localStorage. */
(() => {
'use strict';
const $ = s => document.querySelector(s);
/* ---- anti-salin: tahan lama / seleksi teks / menu salin dimatikan, kecuali di kolom input ---- */
(() => {
  const ok = t => t && t.closest && t.closest('input,textarea,[contenteditable="true"]');
  const stop = e => { if (!ok(e.target)) e.preventDefault(); };
  document.addEventListener('selectstart', stop);
  document.addEventListener('dragstart', stop);
  document.addEventListener('copy', stop);
  document.addEventListener('cut', e => { if (!ok(e.target)) e.preventDefault(); });
  document.addEventListener('contextmenu', e => {   // di layar sentuh: blokir menu tahan-lama; di desktop biarkan handler menu baris (klik kanan)
    if (ok(e.target)) return;
    if (matchMedia('(hover:none) and (pointer:coarse)').matches) e.preventDefault();
  }, true);
  document.addEventListener('selectionchange', () => { const a = document.activeElement; if (a && /^(INPUT|TEXTAREA)$/.test(a.tagName)) return; const sel = getSelection(); if (sel && !sel.isCollapsed) sel.removeAllRanges(); });
})();

/* ---- judul besar -> judul kecil di bar atas (ala iOS): muncul saat judul besar tergulir lewat ---- */
(() => {
  const t = document.getElementById('ptitle'); if (!t || !('IntersectionObserver' in window)) return;
  const pr = document.createElement('div'); pr.style.cssText = 'position:fixed;top:0;height:env(safe-area-inset-top,0px);visibility:hidden;pointer-events:none';
  document.body.appendChild(pr); const inset = pr.offsetHeight; pr.remove();
  new IntersectionObserver(([e]) => document.documentElement.classList.toggle('nb-on', !e.isIntersecting && e.boundingClientRect.bottom < inset + 44), { rootMargin: '-' + (inset + 44) + 'px 0px 0px 0px' }).observe(t);
})();

const LS = 'money_diary_v1';
const LS_OLD = 'agaxx_money_diary_v1'; // migrasi sekali dari kunci lama
try { if (!localStorage.getItem(LS) && localStorage.getItem(LS_OLD)) localStorage.setItem(LS, localStorage.getItem(LS_OLD)); } catch (e) {}
const DATA_URL = './data.json';
const XLSX_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
// SRI: isi dengan hash sha384 dari file di atas (lihat tools/sri_xlsx.py dan README "Keamanan"). Kosong = belum dikunci.
const XLSX_SRI = '';
const { MONTHS, MS, DOW, DOWL, NF, EMO, cn, rp, rpS, jt, esc, p2, mLabel, mShort, dateOf, dkey, nowLocal, thisMonth, addM, fmtAmt, parseAmt, AMT_SUF, AMT_MAX, AMT_ABBR } = MDUtil;   // fungsi murni: assets/js/util.js
const { goalClean, goalSaved, PL_CUT, PL_DAY, PL_MAX_SRC, plPaySrc, plClean, plDue, plPrincipal, plFeeHint, plRowsOf, plMonthDueOf, plMonths, plAllocate, plPrunable, plDataReport, plReconcile, plPeriodStats, plReconPeriods, plReconRows, plReconStatus, plReconChanged, isHist, plHistId, dashAmounts } = MDPlan;   // target tabungan & Paylater murni: assets/js/plan.js
const PL = MDPayLater, { balances: walBalances, linkEffect } = MDWallet;   // tautan PayLater (paylater.js) dan saldo dompet (wallet.js), keduanya murni
const ACCENTS = [['biru', 'Biru', '#0a84ff'], ['ungu', 'Ungu', '#a94ee0'], ['oranye', 'Oranye', '#d96f00'], ['abu', 'Abu-abu', '#738096'], ['merah', 'Merah', '#ef3b31'], ['hijau', 'Hijau', '#1b9a42']];   // warna aksen, tersimpan di perangkat ini
const accentGet = () => { try { return localStorage.getItem('md_accent') || 'biru'; } catch (e) { return 'biru'; } };
function applyAccent(k) {
  if (!ACCENTS.some(a => a[0] === k)) k = 'biru';
  try { localStorage.setItem('md_accent', k); } catch (e) {}
  if (k === 'biru') delete document.documentElement.dataset.accent; else document.documentElement.dataset.accent = k;
}
const SKINS = [['std', 'Standar', ['#0a84ff', '#5e5ce6', '#bf5af2']], ['galaksi', 'Galaksi', ['#a97500', '#5a3d00', '#3b3bff']], ['monster', 'Monster Saku', ['#e8352b', '#9a5600', '#ffcc00']], ['balap', 'Balap Jalanan', ['#d4520a', '#9a2a0d', '#00d4ff']], ['laut', 'Laut Dalam', ['#06b6d4', '#0e7490', '#2dd4bf']], ['senja', 'Senja', ['#f97316', '#9333ea', '#fb7185']]];   // tema palet: hanya warna, tanpa gambar
const skinGet = () => { try { return localStorage.getItem('md_skin') || 'std'; } catch (e) { return 'std'; } };
function applySkin(k) {
  if (!SKINS.some(a => a[0] === k)) k = 'std';
  try { localStorage.setItem('md_skin', k); } catch (e) {}
  if (k === 'std') delete document.documentElement.dataset.skin; else document.documentElement.dataset.skin = k;
}
const AVK = 'md_avatar';   // foto profil: data URL kecil di localStorage, tidak ikut backup
const avatarGet = () => { try { return localStorage.getItem(AVK) || ''; } catch (e) { return ''; } };
const AV_OK = /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+\/=]+$/;   // hanya data URL gambar; selain itu diabaikan
const avatarHTML = () => { const u = avatarGet(); return AV_OK.test(u) ? '<img src="' + esc(u) + '" alt="">' : esc(Array.from(userName())[0].toUpperCase()); };
const userName = () => ((typeof meta === 'object' && meta.name) || 'Kamu').trim() || 'Kamu';   // diatur di Pengaturan > Profil, ikut tersimpan di backup
const MOTION = (() => { try { if (!localStorage.getItem('md_motion_v2')) { localStorage.setItem('md_motion_v2', '1'); localStorage.removeItem('md_motion'); }   // sekali: kembalikan ke Penuh (sudah dibuat ringan)
    return localStorage.getItem('md_motion') === 'lite' ? 'lite' : 'full'; } catch (e) { return 'full'; } })();   // Pengaturan > Tampilan > Animasi
const reduce = matchMedia('(prefers-reduced-motion:reduce)').matches || MOTION === 'lite';
document.documentElement.dataset.motion = MOTION;
/* tier performa + gerak */
const root = document.documentElement, conn = navigator.connection || {};
const weak = !!conn.saveData || navigator.deviceMemory <= 2 || navigator.hardwareConcurrency <= 2;
const QP = new URLSearchParams(location.search);
const lite = QP.get('perf') ? QP.get('perf') === 'lite' : weak || matchMedia('(max-width:768px)').matches || matchMedia('(hover:none) and (pointer:coarse)').matches;
const blurOK = window.CSS && (CSS.supports('backdrop-filter', 'blur(1px)') || CSS.supports('-webkit-backdrop-filter', 'blur(1px)'));
root.dataset.perf = lite ? 'lite' : 'full';
root.dataset.glass = (weak || !blurOK || matchMedia('(prefers-reduced-transparency: reduce)').matches) ? 'off' : 'on';
if (QP.get('glass')) root.dataset.glass = QP.get('glass') === 'on' ? 'on' : 'off';
try { if (!QP.get('glass') && localStorage.getItem('md_glass') === 'off') root.dataset.glass = 'off'; } catch (e) {}
const SPD = reduce ? 1 : (QP.has('speed') ? Math.min(4, Math.max(0, +QP.get('speed') || 0)) : (lite ? 0.7 : 1)); root.style.setProperty('--spd', SPD);   // ?speed=0..4
/* animasi latar hanya jalan saat layar diam: berhenti selama disentuh/digulir/pindah tab (dan 1,2 dtk sesudahnya), serta kalau tidak ada interaksi >90 dtk.
   Ini menjaga transisi tetap lancar dan HP tidak panas. data-au = 'run' | 'pause' (dibaca CSS lewat animation-play-state). */
(() => {
  let last = performance.now(), tm = 0;
  const tick = () => { tm = 0; const idle = performance.now() - last;
    if (idle < 1200) { tm = setTimeout(tick, 1200 - idle); return; }
    if (idle < 90000) { root.dataset.au = 'run'; tm = setTimeout(tick, 90000 - idle); return; }
    root.dataset.au = 'pause'; };
  const wake = () => { last = performance.now(); if (root.dataset.au === 'pause' && tm) return;   // sudah berhenti dan menunggu: cukup perbarui waktu
    root.dataset.au = 'pause'; clearTimeout(tm); tm = setTimeout(tick, 1200); };
  ['pointerdown', 'touchstart', 'keydown', 'wheel'].forEach(e => addEventListener(e, wake, { passive: true, capture: true }));
  addEventListener('scroll', wake, { passive: true, capture: true });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });
  root.dataset.au = 'run'; tm = setTimeout(tick, 90000);
})();
const IOS = 'cubic-bezier(.32,.72,0,1)', OUT = 'cubic-bezier(.4,0,.2,1)';
function applyTheme(pref) {   // pref: auto | light | dark
  try { localStorage.setItem('md_theme', pref); } catch (e) {}
  const light = pref === 'auto' ? matchMedia('(prefers-color-scheme: light)').matches : pref === 'light';
  root.dataset.theme = light ? 'light' : 'dark'; root.dataset.themePref = pref;
  const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = light ? '#f2f2f7' : '#000000';
}
try { matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => { if ((root.dataset.themePref || 'auto') === 'auto') applyTheme('auto'); }); } catch (e) {}
const TABS = ['home', 'wal', 'tl', 'cal', 'st', 'sum', 'plan', 'data'], NOFLT = ['home', 'wal', 'cal', 'plan', 'data'];
const PAL = ['#38bdf8', '#fbbf24', '#f472b6', '#34d399', '#a78bfa', '#fb923c', '#2dd4bf', '#f87171', '#a3e635', '#818cf8'];   // selang-seling hangat/dingin supaya irisan bersebelahan selalu kontras
const TR = { 'penghasilan lain': 'Penghasilan sampingan', food: 'Makan & Minum', transport: 'Transportasi', household: 'Rumah tangga', health: 'Kesehatan', education: 'Pendidikan', other: 'Lain-lain', 'social life': 'Sosial', entertainment: 'Hiburan', shopping: 'Belanja', apparel: 'Pakaian', beauty: 'Kecantikan', culture: 'Budaya', gift: 'Hadiah', salary: 'Gaji', allowance: 'Uang saku', bonus: 'Bonus', 'petty cash': 'Kas kecil', handphone: 'Pulsa & HP', darurat: 'Darurat', away: 'Away', guitar: 'Gitar', joki: 'Joki', subsidi: 'Subsidi', stock: 'Saham', 'oleh-oleh': 'Oleh-oleh', thr: 'THR' };
const cat = c => { const t = cn(c); return TR[t.toLowerCase()] || (t.charAt(0).toUpperCase() + t.slice(1)); };   // terjemahan hanya di tampilan
const ICONS = {
  food: '<path d="M6 3v6a2 2 0 0 0 4 0V3M8 3v18"/><path d="M17 21V3c-2 1-3.5 3.5-3.5 7 0 1.7 1 2.5 3.5 2.5"/>',
  transport: '<path d="M5 16l1.5-5a2 2 0 0 1 1.9-1.4h7.2a2 2 0 0 1 1.9 1.4L19 16"/><rect x="3" y="16" width="18" height="4" rx="1.5"/><path d="M7 20v1.5M17 20v1.5"/>',
  household: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10M10 20v-6h4v6"/>',
  health: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/><path d="M8.5 11.5h2l1.3-2 1.8 4 1.2-2h1"/>',
  education: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/>',
  other: '<circle cx="6" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18" cy="12" r="1.4"/>',
  lainnya: '<circle cx="6" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18" cy="12" r="1.4"/>',
  allowance: '<path d="M4 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M4 7l11-3v3M16 14h2"/>',
  'social life': '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 5.5a3 3 0 0 1 0 5.5M18 14.3c1.8.7 3 2.4 3 4.7"/>',
  apparel: '<path d="M8 4L3 7l2.5 4L8 10v10h8V10l2.5 1L21 7l-5-3c-.5 1.5-2 2.5-4 2.5S8.5 5.5 8 4z"/>',
  beauty: '<path d="M11 3l1.8 5.2L18 10l-5.2 1.8L11 17l-1.8-5.2L4 10l5.2-1.8z"/><path d="M19 15l.7 1.8 1.8.7-1.8.7L19 20l-.7-1.8-1.8-.7 1.8-.7z"/>',
  salary: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6.5 9.5v5M17.5 9.5v5"/>',
  culture: '<rect x="4" y="4" width="16" height="16" rx="2"/><circle cx="9" cy="9" r="1.5"/><path d="M20 16l-5-5-8 8"/>',
  stock: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  thr: '<rect x="3" y="8" width="18" height="5" rx="1"/><path d="M5 13v7h14v-7M12 8v12"/><path d="M12 8c-2.5 0-4-1-4-2.5S9.500 3 11 4.500 12 8 12 8zM12 8c2.500 0 4-1 4-2.500S14.500 3 13 4.500 12 8 12 8z"/>',
  joki: '<rect x="5" y="5" width="14" height="10" rx="1.5"/><path d="M3 19h18"/>',
  handphone: '<rect x="7" y="3" width="10" height="18" rx="2.5"/><path d="M11 18h2"/>',
  darurat: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17.2v.1"/>',
  away: '<path d="M21 4L10 14M21 4l-6.500 16-4.500-6-6-4.500z"/>',
  subsidi: '<path d="M19 5L5 19"/><circle cx="7" cy="7" r="2.300"/><circle cx="17" cy="17" r="2.300"/>',
  'oleh-oleh': '<path d="M5 8h14l-1 12H6z"/><path d="M9 8a3 3 0 0 1 6 0"/>',
  guitar: '<path d="M9 18V6l11-2v12"/><circle cx="6.500" cy="18" r="2.500"/><circle cx="17.500" cy="16" r="2.500"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.500" cy="8.500" r="1.200"/>',
  'ui-cal': '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  'ui-sun': '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.400 1.400M17.600 17.600L19 19M5 19l1.400-1.400M17.600 6.400L19 5"/>',
  'ui-leaf': '<path d="M5 19c0-9 5-14 15-14 0 10-5 15-14 15"/><path d="M5 19c3-5 6-7 10-9"/>',
  'ui-flame': '<path d="M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3 0-6 1-9z"/>'
};
const SEM = { food: '#fb923c', transport: '#38bdf8', household: '#a78bfa', health: '#34d399', education: '#fbbf24', other: '#8b9cff', lainnya: '#64748b', allowance: '#4ade80', 'social life': '#f472b6', apparel: '#6366f1', beauty: '#fb7185', salary: '#a3e635', culture: '#2dd4bf', stock: '#22d3ee', thr: '#f87171', joki: '#60a5fa', handphone: '#c084fc', darurat: '#ef4444', away: '#14b8a6', subsidi: '#facc15', 'oleh-oleh': '#fdba74', guitar: '#e879f9', 'ui-cal': '#38bdf8', 'ui-sun': '#fbbf24', 'ui-leaf': '#34d399', 'ui-flame': '#fb7185' };
Object.assign(ICONS, {
  motor: '<circle cx="6" cy="17" r="3"/><circle cx="18" cy="17" r="3"/><path d="M9 17h5l-3-7H8M14 10h3l1 7M11 10L9.500 7H7"/>',
  coffee: '<path d="M5 8h11v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z"/><path d="M16 9h2a2 2 0 0 1 0 4h-2M8 3v2M12 3v2"/>',
  play: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10 9.500v5l4.500-2.500z"/>',
  bolt: '<path d="M13 3L5 13h6l-1 8 8-10h-6z"/>',
  wifi: '<path d="M3 9a14 14 0 0 1 18 0M6 12.500a10 10 0 0 1 12 0M9 16a5.500 5.500 0 0 1 6 0"/><circle cx="12" cy="19" r="1"/>',
  fuel: '<path d="M5 20V5a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v15M4 20h11M7 8h5"/><path d="M14 9h2a2 2 0 0 1 2 2v5a1.500 1.500 0 0 0 3 0V8l-3-3"/>',
  train: '<rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 11h14M9 21l2-4M15 21l-2-4"/>',
  cart: '<path d="M3 4h2l2.500 11h10l2-8H7"/><circle cx="9" cy="19" r="1.400"/><circle cx="17" cy="19" r="1.400"/>',
  game: '<rect x="3" y="8" width="18" height="10" rx="5"/><path d="M8 11v4M6 13h4M16 12h.01M18 14h.01"/>'
});
/* kategori hasil pemecahan (lihat CAT_RULES di import.js) */
Object.assign(ICONS, {
  'belanja online': ICONS.cart, 'belanja harian': ICONS.cart, langganan: ICONS.play, tagihan: ICONS.bolt,
  'tagihan & langganan': ICONS.bolt, 'sosial & hiburan': ICONS.culture, 'kesehatan & perawatan': ICONS.health,
  kendaraan: ICONS.fuel, 'hobi & game': ICONS.game, hiburan: ICONS.culture
});
Object.assign(SEM, { 'tagihan & langganan': '#f43f5e', 'sosial & hiburan': '#f472b6', 'kesehatan & perawatan': '#34d399', 'belanja online': '#f97316', 'belanja harian': '#f472b6', langganan: '#f43f5e', tagihan: '#fbbf24', kendaraan: '#fb923c', 'hobi & game': '#a78bfa', hiburan: '#2dd4bf' });
/* grup kategori versi 2 (lihat SUBS di import.js) */
Object.assign(ICONS, { 'hiburan & game': ICONS.game, 'sosial & hadiah': ICONS['social life'], belanja: ICONS.cart, 'kesehatan & pendidikan': ICONS.health, 'penghasilan lain': ICONS.salary });
Object.assign(SEM, { food: '#fb923c', transport: '#38bdf8', 'hiburan & game': '#7c6cf5', 'tagihan & langganan': '#facc15', belanja: '#2dd4bf', 'sosial & hadiah': '#e879f9', 'kesehatan & pendidikan': '#4ade80', 'penghasilan lain': '#a3e635' });
/* nama kategori bawaan Money Manager (Inggris) yang belum punya ikon: pakai ikon/warna yang sama dengan padanannya, supaya tidak jatuh ke ikon label generik */
Object.assign(ICONS, { shopping: ICONS.cart, bills: ICONS.bolt, utilities: ICONS.bolt, subscription: ICONS.play, subscriptions: ICONS.play, entertainment: ICONS.culture, gift: ICONS.thr, gifts: ICONS.thr, investment: ICONS.stock, investments: ICONS.stock, income: ICONS.salary, bonus: ICONS.thr });
Object.assign(SEM, { shopping: SEM.belanja || '#2dd4bf', bills: '#facc15', utilities: '#facc15', subscription: '#f43f5e', subscriptions: '#f43f5e', entertainment: '#f472b6', gift: '#e879f9', gifts: '#e879f9', investment: '#4ade80', investments: '#4ade80', income: '#4ade80', bonus: '#fbbf24' });
/* ikon dari isi catatan (menimpa ikon kategori): [pola, ikon, warna] */
const NOTE_RULES = [
  [/\b(gojek|gocar|grab|ojol|ojek|maxim|indrive)\b/, 'motor', '#22c55e'],
  [/\b(kopi|coffee|starbucks|janji jiwa|kenangan|latte)\b/, 'coffee', '#c08457'],
  [/\b(spotify|netflix|youtube|disney|vidio|prime|langganan)\b/, 'play', '#f43f5e'],
  [/\b(pulsa|kuota|paket data|telkomsel|indosat|axis|by\.?u|smartfren)\b/, 'handphone', '#38bdf8'],
  [/\b(listrik|token|pln)\b/, 'bolt', '#fbbf24'],
  [/\b(wifi|indihome|internet)\b/, 'wifi', '#60a5fa'],
  [/\b(bensin|pertamax|pertalite|bbm|shell)\b/, 'fuel', '#fb923c'],
  [/\b(krl|mrt|lrt|kereta|bus|transjakarta|tj|travel)\b/, 'train', '#2dd4bf'],
  [/\b(indomaret|alfamart|alfa|supermarket|minimarket|belanja)\b/, 'cart', '#f472b6'],
  [/\b(game|steam|topup|top up|mobile legends|ml|valorant)\b/, 'game', '#a78bfa'],
  [/\b(kos|kost|sewa|kontrakan)\b/, 'household', '#a78bfa'],
  [/\b(laundry|cuci)\b/, 'apparel', '#6366f1']
];
const noteMatch = n => { const t = cn(n || '').toLowerCase(); return t ? NOTE_RULES.find(r => r[0].test(t)) : null; };
const hexA = (h, a) => { const n = parseInt(h.slice(1), 16); return `rgba(${n >> 16},${n >> 8 & 255},${n & 255},${a})`; };
const ico = (c, sz, note) => { const k = cn(c).toLowerCase(), nm = noteMatch(note), col = nm ? nm[2] : catColor(c);
  return `<span class="ci${sz ? ' ' + sz : ''}" style="--c:${col};--cb:${hexA(col, .16)};--cl:${hexA(col, .32)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${nm ? ICONS[nm[1]] : ICONS[k] || ICONS.tag}</svg></span>`; };
let CC = null, WB = null, PLR = null;
const catColor = c => { const k = cn(c).toLowerCase(); if (SEM[k]) return SEM[k]; if (!CC) { CC = {}; catList().forEach((k, i) => { CC[k] = PAL[i % PAL.length]; }); } return CC[c] || '#64748b'; };
const rph = n => '<span class="cur">Rp</span>' + NF.format(Math.round(n));


/* ---------- state ---------- */
let recs = [];                                   // {id,t,k:'E'|'I',c,n,a,ac}, urut terbaru dulu
let PLLOADREP = null;   // laporan integritas PayLater dari load() (dipakai sekali saat start)
let meta = { start: nowLocal().slice(0, 7), budget: 0, cats: {}, goals: [], rules: [], changes: 0, lastBackup: 0, wallets: [], xfers: [], plPays: [] };
let F = { from: '', to: '', cat: '', sub: '', q: '', k: '', w: '', tg: '' };
let tab = 'home', tlMonths = 3;
const dirty = { home: 1, wal: 1, sum: 1, tl: 1, cal: 1, st: 1, plan: 1, data: 1 };
const dirtyAll = () => { for (const k in dirty) dirty[k] = 1; CC = null; WB = null; PLR = null; };
let stAll = false, stTab = 'cat', stK = 'E', calM = '', calD = '', stOpen = new Set();

/* pemasukan 3 kelompok: THR / Gaji / Subsidi / Lainnya pindah dari 'Penghasilan Lain' ke 'Other' (tampil: Lain-lain), sekali jalan */
function migrateInc() {
  if (meta.incV === 1) return; let n = 0;
  recs.forEach(r => { if (r.k === 'I' && r.c === 'Penghasilan Lain' && ['THR', 'Gaji', 'Subsidi', 'Lainnya', ''].includes(r.s || '')) { r.c = 'Other'; if (!r.s) r.s = 'Lainnya'; n++; } });
  meta.incV = 1; if (n) save();
}
// Transaksi dari localStorage tidak dipercaya begitu saja: baris rusak dibuang supaya tidak menjatuhkan halaman.
// Kalau ada yang dibuang, data mentah disalin dulu ke md_dropped (sekali) agar tidak hilang diam-diam.
function cleanRecs(list, raw) {
  const ids = new Set(), ok = [];
  list.forEach(r => {
    if (!r || typeof r !== 'object' || typeof r.t !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(r.t) || (r.k !== 'E' && r.k !== 'I') || !(Number(r.a) > 0)) return;
    const x = { ...r, a: Number(r.a), c: cn(r.c), n: String(r.n == null ? '' : r.n), ac: String(r.ac == null ? '' : r.ac), s: String(r.s == null ? '' : r.s), tg: Array.isArray(r.tg) ? r.tg : [] };
    let id = typeof x.id === 'string' && x.id ? x.id : baseKey(x);
    for (let i = 2; ids.has(id); i++) id = baseKey(x) + '#' + i;
    ids.add(id); x.id = id; ok.push(x);
  });
  if (ok.length < list.length) { try { if (!localStorage.getItem('md_dropped')) localStorage.setItem('md_dropped', raw || ''); } catch (e) {} }
  return ok;
}
/* Cadangan otomatis di perangkat (3 terakhir) sebelum perubahan data PayLater yang besar: tautan massal, lepas tautan, restore, migrasi.
   Isinya salinan persis penyimpanan (transaksi + semua pengaturan). Gagal (penyimpanan penuh) -> false, dan pemanggil membatalkan operasinya. */
const ABK = 'md_autobak';
const abkRaw = () => { try { const a = JSON.parse(localStorage.getItem(ABK) || '[]'); return Array.isArray(a) ? a.filter(x => x && typeof x.raw === 'string') : []; } catch (e) { return []; } };
function autoBackup(why, { keep = false, kind = '', throttle = 0 } = {}) {
  try {
    const raw = localStorage.getItem(LS); if (!raw) return true;
    const a = abkRaw(), now = Date.now();
    if (throttle && a[0] && a[0].kind === kind && now - (a[0].ts || 0) < throttle) return true;   // pembayaran beruntun: satu cadangan cukup
    a.unshift({ t: nowLocal(), ts: now, why, kind, keep, n: recs.length, raw });
    const oldest = () => a.map((x, j) => j > 0 && !x.keep).lastIndexOf(true);   // yang dibuang: paling lama dan tidak dikunci (cadangan migrasi dikunci)
    while (a.length > 3 && oldest() > 0) a.splice(oldest(), 1);
    for (;;) {
      try { localStorage.setItem(ABK, JSON.stringify(a)); return true; }
      catch (e) { const k = oldest(); if (k < 0) return false; a.splice(k, 1); }   // penyimpanan penuh
    }
  } catch (e) { return false; }
}
const abkList = abkRaw;
/* Salinan data mentah temuan PayLater (md_dropped). Tidak pernah menimpa temuan lama:
   - belum ada            -> disimpan apa adanya (format lama: string JSON data aplikasi);
   - sudah ada, sama persis -> tidak ada perubahan (dedup);
   - sudah ada, beda       -> menjadi amplop {md_dropped:2, entries:[{at, raw}, ...]}; salinan lama dibawa utuh sebagai entri pertama, yang baru ditambahkan di belakang.
   Gagal menulis (kuota penuh) tidak menghapus apa pun dan tidak melempar galat. Penulis lain (jalur transaksi di cleanRecs) tidak diubah. */
function stashDropped(raw) {
  if (typeof raw !== 'string' || !raw) return;
  try {
    const cur = localStorage.getItem('md_dropped');
    if (!cur) { localStorage.setItem('md_dropped', raw); return; }
    if (cur === raw) return;
    let env = null; try { const j = JSON.parse(cur); if (j && j.md_dropped === 2 && Array.isArray(j.entries)) env = j; } catch (e) {}
    if (!env) env = { md_dropped: 2, entries: [{ at: '', raw: cur }] };
    if (env.entries.some(e => e && e.raw === raw)) return;
    env.entries.push({ at: nowLocal(), raw });
    localStorage.setItem('md_dropped', JSON.stringify(env));
  } catch (e) {}
}
/* ===== Laporan integritas data PayLater (Tahap 2). Hanya menjelaskan; tidak mengubah data. ===== */
const PL_WHY = { bukan_objek: 'bukan data pembayaran', melebihi_batas: 'melebihi batas 5000 pembayaran', id_kosong: 'tanpa id', timestamp_pola: 'tanggal/waktu tidak terbaca', dompet_kosong: 'tanpa dompet', nominal: 'nominal pokok tidak valid', id_ganda: 'id ganda' };
function plReportHtml(d, restore) {
  const L = [], cnt = (arr, f) => arr.reduce((m, x) => { const k = f(x); m[k] = (m[k] || 0) + 1; return m; }, {});
  if (d.dropped.length) {
    const why = Object.entries(cnt(d.dropped, x => x.why)).map(([k, n]) => n + '× ' + (PL_WHY[k] || k)).join(', '), sum = d.dropped.reduce((a, x) => a + (x.a || 0), 0);
    L.push(`<b>${d.dropped.length} pembayaran PayLater tidak ${restore ? 'akan ' : ''}dimuat</b> (${esc(why)}${sum ? '; total pokok ' + rp(sum) : ''}).`);
  }
  if (d.srcBad.length) L.push(`<b>${d.srcBad.length} pembayaran multi-dompet tidak ${restore ? 'akan ' : ''}dimuat</b> karena sumber dananya tidak sah.`);
  if (d.allocDropped.length) L.push(`${d.allocDropped.length} pembayaran kehilangan ${d.allocDropped.reduce((a, x) => a + x.n, 0)} entri alokasi yang tidak terbaca.`);
  if (d.feeDropped.length) L.push(`${d.feeDropped.length} pembayaran punya catatan biaya yang tidak terbaca.`);
  if (d.orphans.length) L.push(`<b>${d.orphans.length} catatan "Biaya PayLater" ${d.orphans.every(o => o.certain) ? 'masih ada' : 'kemungkinan masih ada'}</b> padahal pembayarannya tidak dimuat. Catatan biaya <b>tidak dihapus atau diubah</b> otomatis; tinjau di Transaksi (tag biaya-paylater).`);
  if (d.block.length) L.push(`<b>${d.block.length} pembayaran punya alokasi lebih besar dari pokoknya.</b>`);
  const w = cnt(d.warn, x => x.code);
  if (w.alloc_kurang) L.push(`${w.alloc_kurang} pembayaran: jumlah alokasi lebih kecil dari pokok (saldo berkurang penuh, tagihan berkurang lebih sedikit).`);
  if (w.key_hilang) L.push(`${w.key_hilang} alokasi menunjuk tagihan yang tidak ada atau bukan tagihan tertaut (diabaikan saat menghitung sisa tagihan).`);
  if (w.alloc_lebih_D) L.push(`${w.alloc_lebih_D} cicilan menerima alokasi lebih besar dari nilainya (sisa dibatasi 0).`);
  if (w.timestamp_kalender) L.push(`${w.timestamp_kalender} pembayaran bertanggal tidak nyata menurut kalender (mis. bulan 99). Tidak dibuang, tetapi berpotensi memengaruhi perbandingan tanggal dan perhitungan saldo dompet.`);
  const a = cnt(d.anomalies, x => x.code);
  if (a.hist_hilang) L.push(`<b>${a.hist_hilang} tagihan historis hilang</b> karena datanya tidak sah (salinan mentah disimpan).`);
  if (a.hist_tidak_sah) L.push(`${a.hist_tidak_sah} tagihan historis tidak sah (mis. cicilan bukan 1×): penandanya terlepas dan diperlakukan sebagai tagihan biasa, tidak dibuang.`);
  if (a.rc_tanpa_penanda) L.push(`${a.rc_tanpa_penanda} tagihan berid rekonsiliasi kehilangan penanda historis (mungkin lewat aplikasi lama).`);
  return L.join('<br>') + (restore ? '<br>Dengan menekan Gabungkan kamu menyetujui pemulihan seperti di atas. Cadangan otomatis dibuat dulu dan pemulihan bisa dibatalkan.' : '<br>Data kamu <b>tidak diubah otomatis</b>. Bila ada yang tidak dimuat, salinan data mentah disimpan di perangkat ini.');
}
/* Pemberitahuan saat load. MODAL hanya untuk temuan yang berpotensi mengubah/menghilangkan data (BLOK, pembayaran tidak dimuat, alokasi terbuang, anomali hist);
   peringatan lunak (alloc_kurang, key_hilang, alloc_lebih_D, timestamp_kalender) cukup TOAST non-modal. Keduanya hanya sekali per isi laporan yang sama
   (tanda disimpan di md_plnote / md_plsoft) dan hanya dipanggil sekali saat start, jadi tidak berulang saat render atau pindah tab. */
function plSoftText(d) {
  const w = d.warn.reduce((m, x) => { m[x.code] = (m[x.code] || 0) + 1; return m; }, {}), P = [];
  if (w.alloc_kurang) P.push(w.alloc_kurang + ' pembayaran beralokasi lebih kecil dari pokok');
  if (w.key_hilang) P.push(w.key_hilang + ' alokasi menunjuk tagihan yang tidak ada');
  if (w.alloc_lebih_D) P.push(w.alloc_lebih_D + ' cicilan menerima alokasi melebihi nilainya');
  if (w.timestamp_kalender) P.push(w.timestamp_kalender + ' pembayaran bertanggal tidak nyata (bisa memengaruhi perbandingan tanggal dan saldo dompet)');
  return 'Catatan data PayLater: ' + P.join('; ') + '. Data tidak diubah.';
}
function plLoadNotice(d) {
  if (!d || !d.hasAny) return;
  const hard = d.srcBad.length || d.dropped.length || d.allocDropped.length || d.feeDropped.length || d.block.length || d.anomalies.length || d.orphans.length;
  const sig = JSON.stringify([d.srcBad.length, d.dropped.length, d.allocDropped.length, d.feeDropped.length, d.block.length, d.warn.length, d.anomalies.length, d.orphans.length, d.dropped.map(x => x.id).join(',')]), key = hard ? 'md_plnote' : 'md_plsoft';
  try { if (localStorage.getItem(key) === sig) return; } catch (e) {}
  if (hard) setTimeout(() => ask('Catatan data PayLater', plReportHtml(d, false), 'Mengerti', () => { try { localStorage.setItem(key, sig); } catch (e) {} }), 800);
  else { toast(plSoftText(d)); try { localStorage.setItem(key, sig); } catch (e) {} }
}
const plHasRecon = x => !!x && typeof x === 'object' && !Array.isArray(x) && Object.keys(x).length > 0;
function load() {
  try {
    const j = JSON.parse(localStorage.getItem(LS) || 'null');
    if (j && Array.isArray(j.recs)) { recs = cleanRecs(j.recs, localStorage.getItem(LS)); Object.assign(meta, j.meta || {}); meta.cats = MDSanitize.cleanCats(meta.cats, cn); meta.budget = MDSanitize.cleanBudget(meta.budget); meta.rules = MDSanitize.cleanRules(meta.rules); meta.goals = (Array.isArray(meta.goals) ? meta.goals : []).map(goalClean).filter(Boolean); if (!Array.isArray(meta.rules)) meta.rules = []; if (!Array.isArray(meta.wallets)) meta.wallets = []; if (!Array.isArray(meta.xfers)) meta.xfers = []; if (!Array.isArray(meta.recur)) meta.recur = []; const rawPl = Array.isArray(meta.pl) ? meta.pl : []; meta.pl = rawPl.map(plClean).filter(Boolean); const prp = MDSanitize.cleanPaysReport(meta.plPays); meta.plPays = prp.pays;
      { const rc = MDSanitize.cleanPlRecon(meta.plRecon); if (Object.keys(rc).length) meta.plRecon = rc; else delete meta.plRecon; }   // rekonsiliasi SPayLater: dibersihkan; kosong = tidak ada kuncinya (data lama identik)
      const plrep = plDataReport(prp, meta.pl, rawPl, recs);   // hanya MELAPORKAN: tidak ada alokasi/nominal/pembayaran/catatan biaya yang diubah
      if (prp.bad.length || plrep.dropped.length || plrep.allocDropped.length || plrep.feeDropped.length || plrep.anomalies.some(a => a.code !== 'rc_tanpa_penanda')) stashDropped(localStorage.getItem(LS) || '');
      PLLOADREP = plrep.hasAny ? plrep : null; if (localStorage.getItem('md_plv') !== '1') { if (recs.length || meta.wallets.length) autoBackup('Sebelum migrasi PayLater v2 (polish6)', { keep: true, kind: 'migrasi' }); try { localStorage.setItem('md_plv', '1'); } catch (e) {} } migrateInc(); migrateWal(); MMImport.setRules(meta.rules); return true; }
  } catch (e) {}
  return false;
}
function save(quiet) {   // true = tersimpan. quiet: pemanggil menampilkan pesan sendiri (commit)
  try { localStorage.setItem(LS, JSON.stringify({ recs, meta })); return true; }
  catch (e) { if (!quiet) toast('Gagal nyimpen, penyimpanan penuh atau diblokir. Unduh backup sekarang.'); return false; }
}
/* Operasi keuangan atomik: mutate() mengubah data di memori, lalu disimpan. Kalau mutate() atau penyimpanan gagal, SEMUA perubahan
   (transaksi, tagihan, pembayaran, alokasi, dompet, pengaturan) dikembalikan persis seperti sebelumnya dan false dikembalikan.
   Pemanggil hanya boleh menampilkan pesan sukses / menutup lembar bila hasilnya true. */
const SAVE_FAIL_MSG = 'Gagal menyimpan (penyimpanan penuh atau diblokir). Perubahan dibatalkan, data tetap seperti semula. Unduh backup dulu.';
const ABK_FAIL = 'Cadangan otomatis gagal (penyimpanan penuh). Unduh backup dulu, lalu coba lagi.';
function snapState() { return { r: recs.map(r => ({ ...r })), m: JSON.stringify(meta) }; }
function restoreState(z) { recs = z.r; Object.keys(meta).forEach(k => delete meta[k]); Object.assign(meta, JSON.parse(z.m)); if (typeof MMImport !== 'undefined' && MMImport.setRules) MMImport.setRules(meta.rules || []); PLR = null; }
function commit(mutate) {
  const z = snapState();
  try { mutate(); meta.changes++; PLR = null; if (!save(true)) throw new Error('simpan gagal'); }
  catch (e) { restoreState(z); dirtyAll(); try { fillFilters(); } catch (x) {} refresh(); toast(SAVE_FAIL_MSG); return false; }
  dirtyAll(); fillFilters(); refresh(); return true;
}
const sortRecs = () => recs.sort((a, b) => a.t < b.t ? 1 : a.t > b.t ? -1 : 0);

/* id deterministik: dipakai untuk mengenali duplikat saat impor ulang */
const baseKey = r => r.t + '|' + r.k + '|' + r.a + '|' + r.n;
function addBatch(list, { skipDup = true } = {}) {
  const have = new Set(recs.map(r => r.id)), seen = {};
  let added = 0, dup = 0; const ids = [];
  for (const r of list) {
    const b = baseKey(r); seen[b] = (seen[b] || 0) + 1;
    const id = seen[b] > 1 ? b + '#' + seen[b] : b;
    let uid = id;
    if (have.has(uid)) { if (skipDup) { dup++; continue; } let i = 2; while (have.has(uid = id + '~' + i)) i++; }
    recs.push({ id: uid, t: r.t, k: r.k, c: cn(r.c), s: r.s || '', tg: r.tg || [], n: r.n, a: r.a, ac: r.ac }); have.add(uid); added++; ids.push(uid);
  }
  sortRecs();
  return { added, dup, ids };
}
function dryRun(list) {
  const have = new Set(recs.map(r => r.id)), seen = {};
  const fresh = [];
  let dup = 0;
  for (const r of list) {
    const b = baseKey(r); seen[b] = (seen[b] || 0) + 1;
    const id = seen[b] > 1 ? b + '#' + seen[b] : b;
    if (have.has(id)) dup++; else fresh.push(r);
  }
  return { fresh, dup };
}
function changed() { meta.changes++; save(); dirtyAll(); refresh(); }
/* ===== PayLater v2: pembantu tautan, snapshot undo, dan konfirmasi ===== */
const plSnap = () => ({ pl: JSON.stringify(meta.pl || []), pp: JSON.stringify(meta.plPays || []), rc: JSON.stringify(meta.plRecon || {}) });
const plUnsnap = z => { meta.pl = JSON.parse(z.pl); meta.plPays = JSON.parse(z.pp); if (z.rc !== undefined) { const rc = JSON.parse(z.rc); if (Object.keys(rc).length) meta.plRecon = rc; else delete meta.plRecon; } PLR = null; };
const plItemPaid = it => (meta.plPays || []).some(y => (y.alloc || []).some(a => a.k.startsWith(it.id + ':')));   // sudah ada pembayaran untuk tagihan ini
const plPrune = () => { meta.pl = plGet().filter(it => !plPrunable(it)); };   // item hist / ber-id rc... tidak dipangkas
const plItemTitle = it => it.stmt ? 'Tagihan ' + plMY(plDue(it, 0)) : it.n;
const PL_BLOCK = 'Transaksi ini sudah dibayar lewat PayLater. Batalkan pembayarannya dulu.';
function ask(title, html, okLabel, onOk) {
  const n = el(`<div class="form"><div class="hint">${html}</div><div class="acts"><button type="button" class="btn-s" id="ask-no">Batal</button><button type="button" class="btn-p" id="ask-ok">${esc(okLabel)}</button></div></div>`);
  n.querySelector('#ask-no').onclick = () => closeSheet(); n.querySelector('#ask-ok').onclick = () => { closeSheet(); onOk(); };
  openSheet(title, n);
}
/* item hasil belanja tunggal ikut data transaksinya (nama, tanggal, nominal, akun); tagihan hasil tautan massal = jumlah tautan */
function plSyncItem(it, r) {
  if (it.stmt) { it.a = it.src.reduce((x, s) => x + s.a, 0); return; }
  it.n = (cn(r.n) || 'PayLater').slice(0, 40); it.o = r.t.slice(0, 10); it.c = r.c; it.w = r.ac || it.w || '';
  if (it.pr) it.pr = r.a; else if (it.k === 1) it.a = r.a;
}
/* dipanggil SEBELUM transaksi dihapus: lepas tautan dan geser urutan. false = diblokir (sudah dibayar). */
function plDropCheck(list) {   // false = ada transaksi tertaut ke tagihan yang sudah dibayar
  const res = plRes();
  if (list.some(r => res.by.has(r.id) && plItemPaid(res.by.get(r.id).item))) { toast(PL_BLOCK); return false; }
  return true;
}
function plDropApply(list) {   // lepas tautan dan geser urutan; dicocokkan lewat id (aman setelah rollback yang mengganti objek)
  let cur = recs.slice(); list.forEach(r => { PL.dropRecord(plGet(), cur, r); cur = cur.filter(x => x.id !== r.id); });
  plPrune(); PLR = null;
}
const plDropRecords = list => plDropCheck(list) && (plDropApply(list), true);   // pemanggil yang belum transaksional
function deleteRec(id, after) {
  const r = recs.find(x => x.id === id); if (!r) return;
  const lk = plRes().by.get(id);
  const go = () => {
    const snap = recs.slice(), ps = plSnap(); if (!plDropCheck([r])) return;
    if (lk && !autoBackup('Sebelum menghapus transaksi tertaut PayLater', { kind: 'ubah' })) { toast(ABK_FAIL); return; }
    if (!commit(() => { plDropApply([r]); recs = recs.filter(x => x.id !== id); })) return;
    if (after) after();
    toast('Transaksi dihapus', () => { if (commit(() => { recs = snap; plUnsnap(ps); })) toast('Dibatalkan'); });
  };
  if (!lk) return go();
  if (plItemPaid(lk.item)) { toast(PL_BLOCK); return; }
  ask('Transaksi tertaut ke PayLater', `Transaksi ini bagian dari <b>${esc(plItemTitle(lk.item))}</b>. Menghapusnya juga melepas tautan dan menurunkan tagihan sebesar <b>${rp(r.a)}</b>. Saldo dompet tidak berubah.`, 'Hapus & lepas tautan', go);
}

/* ---------- util UI ---------- */
let toastT;
function toast(msg, undo) {
  const t = $('#toast'); t.textContent = msg;
  if (undo) { const b = document.createElement('button'); b.type = 'button'; b.className = 'tundo'; b.textContent = 'Batalkan'; b.onclick = () => { clearTimeout(toastT); t.classList.remove('on'); undo(); }; t.appendChild(b); }
  t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), undo ? 5000 : 2800);
}
let NV = {};
function setNum(el, val, fmt, dur) {
  if (!el) return;
  el.style.setProperty('--n', Math.max(6, fmt(val).length));   // panjang teks akhir: CSS mengecilkan font agar muat kolom
  const key = el.dataset.k || el.id, from = key in NV ? NV[key] : 0, tk = el._tk = (el._tk || 0) + 1; NV[key] = val;
  if (reduce || from === val) { el.textContent = fmt(val); return; }
  const t0 = performance.now(), D = dur || (Math.abs(val) > 99999 ? 550 : 450);
  const step = now => { if (el._tk !== tk) return; const k = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(from + (val - from) * e); if (k < 1) requestAnimationFrame(step); else el.textContent = fmt(val); };
  requestAnimationFrame(step);
}

/* ---------- filter ---------- */
const cat0 = () => recs.filter(r => (!F.from || r.t.slice(0, 7) >= F.from) && (!F.to || r.t.slice(0, 7) <= F.to));
const list = () => cat0().filter(r => (!F.cat || r.c === F.cat) && (!F.sub || r.s === F.sub));
function rangeOf(l) {
  const first = l.length ? l[l.length - 1].t.slice(0, 10) : dkey(new Date());
  let s = F.from ? new Date(+F.from.slice(0, 4), +F.from.slice(5, 7) - 1, 1) : dateOf(first);
  let e = new Date();
  if (F.to) { const ee = new Date(+F.to.slice(0, 4), +F.to.slice(5, 7), 0); if (ee < e) e = ee; }
  if (e < s) e = s;
  return [s, e];
}
function syncURL() {
  const q = new URLSearchParams();
  if (F.from) q.set('from', F.from); if (F.to) q.set('to', F.to); if (F.cat) q.set('cat', F.cat); if (F.sub) q.set('sub', F.sub);
  if (tab !== 'tl') q.set('tab', tab);
  try { history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '')); } catch (e) {}
}
function readURL() {
  const q = new URLSearchParams(location.search);
  F.from = /^\d{4}-\d{2}$/.test(q.get('from') || '') ? q.get('from') : '';
  F.to = /^\d{4}-\d{2}$/.test(q.get('to') || '') ? q.get('to') : '';
  F.cat = q.get('cat') || ''; F.sub = F.cat ? (q.get('sub') || '') : '';
  if (TABS.includes(q.get('tab'))) tab = q.get('tab');
}
function catList() {
  const m = {}; recs.forEach(r => { m[r.c] = (m[r.c] || 0) + 1; });
  return Object.keys(m).sort((a, b) => m[b] - m[a]);
}
function fillFilters() {
  const cs = catList();
  if (F.cat && !cs.includes(F.cat)) F.cat = '';
  if (F.sub && !recs.some(r => r.c === F.cat && r.s === F.sub)) F.sub = '';
}

/* ---------- render: ringkasan ---------- */
function renderSum() {
  const l = list(), ex = l.filter(r => r.k === 'E');
  const sumE = ex.reduce((s, r) => s + r.a, 0);
  const [s0, e0] = rangeOf(l);
  const days = Math.max(1, Math.round((e0 - s0) / 864e5) + 1);
  const months = Math.max(1, (e0.getFullYear() - s0.getFullYear()) * 12 + e0.getMonth() - s0.getMonth() + 1);
  const dayMap = {}; ex.forEach(r => { const k = r.t.slice(0, 10); dayMap[k] = (dayMap[k] || 0) + r.a; });
  const activeDays = Object.keys(dayMap).length;
  const big = ex.reduce((m, r) => !m || r.a > m.a ? r : m, null);


  const st = (v, lab, sub, cls = '', plain = false, ic = '') => `<div class="stat">${ic ? ico(ic) : ''}<div class="sv ${cls}" ${plain ? 'data-p="1"' : ''} data-v="${typeof v === 'number' ? v : ''}">${typeof v === 'number' ? '' : esc(v)}</div><div class="sl">${lab}</div>${sub ? `<div class="ss">${esc(sub)}</div>` : ''}</div>`;
  $('#stats').innerHTML =
    st(sumE / months, 'Rata-rata / bulan', months + ' bulan', '', false, 'ui-cal') + st(sumE / days, 'Rata-rata / hari', activeDays + ' hari ada jajan', '', false, 'ui-sun') +
    st(Math.max(0, days - activeDays), 'Hari tanpa pengeluaran', 'dari ' + days + ' hari', '', true, 'ui-leaf') +
    st(big ? rp(big.a) : '—', 'Pengeluaran terbesar', big ? cn(big.n || big.c) + ' · ' + big.t.slice(8, 10) + ' ' + MS[+big.t.slice(5, 7) - 1] + ' ' + big.t.slice(2, 4) : '', 'sm', false, 'ui-flame');
  document.querySelectorAll('#stats .sv[data-v]').forEach((el, i) => { el.dataset.k = 's' + i; if (el.dataset.v !== '') setNum(el, +el.dataset.v, el.dataset.p ? v => NF.format(Math.round(v)) : rpS); });

  /* grafik bulanan: abaikan filter bulan, ikut filter kategori */
  const base = recs.filter(r => !F.cat || r.c === F.cat);
  const mm = {}; base.forEach(r => { const m = r.t.slice(0, 7); (mm[m] = mm[m] || { e: 0, i: 0 })[r.k === 'E' ? 'e' : 'i'] += r.a; });
  const keys = Object.keys(mm).sort(); const all = [];
  if (keys.length) { let [y, m] = keys[0].split('-').map(Number); const last = thisMonth() > keys[keys.length - 1] ? thisMonth() : keys[keys.length - 1];
    for (;;) { const k = y + '-' + p2(m); all.push(k); if (k >= last) break; if (++m > 12) { m = 1; y++; } } }
  const mx = Math.max(1, ...all.map(k => Math.max((mm[k] || {}).e || 0, (mm[k] || {}).i || 0)));
  const single = F.from && F.from === F.to;
  $('#mchart').innerHTML = all.map(k => {
    const v = mm[k] || { e: 0, i: 0 }, inR = (!F.from || k >= F.from) && (!F.to || k <= F.to), sel = single && k === F.from;
    return `<button type="button" class="mc ${inR ? '' : 'out'} ${sel ? 'sel' : ''}" data-m="${k}" title="${mLabel(k)}: keluar ${rp(v.e)} · masuk ${rp(v.i)}"><div class="mc-b"><i class="e" style="height:${v.e / mx * 100}%"></i><i class="i" style="height:${v.i / mx * 100}%"></i></div><span class="mc-m">${mShort(k)}</span><span class="mc-v">${jt(v.e)}</span></button>`;
  }).join('') || '<div class="empty">Belum ada data.</div>';
  $('#mchart').onclick = e => {
    const b = e.target.closest('.mc'); if (!b) return; const m = b.dataset.m;
    if (F.from === m && F.to === m) { F.from = F.to = ''; } else { F.from = F.to = m; }
    applyFilter();
  };
  const mcSel = $('#mchart .sel'); if (mcSel && mcSel.scrollIntoView) { const c = $('#mchart'); c.scrollLeft = mcSel.offsetLeft - c.clientWidth / 2 + 26; }
  else { const c = $('#mchart'); c.scrollLeft = c.scrollWidth; }

  /* kalender harian */
  renderCal(dayMap, s0, e0);

  /* catatan paling sering */
  const nm = {}; ex.forEach(r => { const k = r.n.trim().toLowerCase(); if (!k) return; const o = nm[k] = nm[k] || { s: 0, n: 0, l: r.n }; o.s += r.a; o.n++; });
  const ne = Object.values(nm).sort((a, b) => b.s - a.s).slice(0, 10);
  $('#notes').innerHTML = ne.map(o => `<button type="button" class="row-b" data-q="${esc(o.l)}"><span class="rn">${esc(cn(o.l))}</span><span class="rb"><i style="width:${o.s / ne[0].s * 100}%"></i></span><span class="rc">${rp(o.s)}<small>${o.n}×</small></span></button>`).join('') || '<div class="empty">Belum ada catatan bernama.</div>';
  $('#notes').onclick = e => { const b = e.target.closest('.row-b'); if (!b) return; $('#tl-q').value = F.q = b.dataset.q; dirty.tl = 1; go('tl'); };

  const shown = l.length;
}
function renderCal(dayMap, s0, e0) {
  const start = new Date(s0); start.setDate(start.getDate() - start.getDay());
  const weeks = Math.ceil(((e0 - start) / 864e5 + 1) / 7);
  const vals = Object.values(dayMap).sort((a, b) => a - b), q = p => vals[Math.min(vals.length - 1, Math.floor(vals.length * p))] || 0;
  const t1 = q(.33), t2 = q(.66);
  if (weeks <= 10) {   // rentang pendek: kalender 7 kolom dengan sel berukuran wajar (bukan kotak raksasa)
    let h = DOW.map(d => `<div class="hw">${d}</div>`).join('');
    for (let w = 0; w < weeks; w++) for (let d = 0; d < 7; d++) {
      const day = new Date(start); day.setDate(start.getDate() + w * 7 + d);
      if (day < s0 || day > e0) { h += '<div class="hc e"></div>'; continue; }
      const v = dayMap[dkey(day)] || 0, lv = !v ? '' : v <= t1 ? 'on1' : v <= t2 ? 'on2' : 'on3';
      h += `<div class="hc ${lv}" title="${day.getDate()} ${MS[day.getMonth()]} ${day.getFullYear()}: ${v ? rp(v) : 'tidak ada pengeluaran'}">${day.getDate()}${day.getDate() === 1 ? `<small>${MS[day.getMonth()]}</small>` : ''}</div>`;
    }
    $('#cal').innerHTML = `<div class="hgrid">${h}</div>`; $('#cal').style.minWidth = '0'; return;
  }
  let cells = '', lab = '', lastM = -1;
  for (let w = 0; w < weeks; w++) {
    for (let d = 0; d < 7; d++) {
      const day = new Date(start); day.setDate(start.getDate() + w * 7 + d);
      if (day < s0 || day > e0) { cells += '<div class="cd e"></div>'; continue; }
      const v = dayMap[dkey(day)] || 0, lv = !v ? '' : v <= t1 ? 'on1' : v <= t2 ? 'on2' : 'on3';
      cells += `<div class="cd ${lv}" title="${day.getDate()} ${MS[day.getMonth()]} ${day.getFullYear()}: ${v ? rp(v) : 'tidak ada pengeluaran'}"></div>`;
      if (d === 0 && day.getMonth() !== lastM && day >= s0) { lastM = day.getMonth(); lab += `<span style="left:${w / weeks * 100}%">${MS[day.getMonth()]}${day.getMonth() === 0 || !lab ? ' ' + String(day.getFullYear()).slice(2) : ''}</span>`; }
    }
  }
  $('#cal').innerHTML = `<div class="cal-m">${lab}</div><div class="cal-g" style="--w:${weeks}">${cells}</div>`;
  $('#cal').style.minWidth = Math.max(560, weeks * 14) + 'px';
  const w = $('#cal-wrap'); w.scrollLeft = w.scrollWidth;
}

/* ---------- render: riwayat ---------- */
function filteredTl() {
  const q = F.q.trim().toLowerCase(), wk = F.w ? wkey(F.w) : '';
  return list().filter(r =>
    (!F.k || r.k === F.k) &&
    (!wk || wkey(r.ac) === wk) &&
    (!F.tg || (r.tg || []).includes(F.tg)) &&
    (!q || r.n.toLowerCase().includes(q) || (r.c.toLowerCase().includes(q) || cat(r.c).toLowerCase().includes(q)) || String(r.a).includes(q.replace(/[.\s]/g, '')) || (r.s || '').toLowerCase().includes(q) || (r.tg || []).some(t => t.includes(q.replace(/^#/, ''))))
  );
}
const rowHTML = r => { const c = cat(r.c), n = r.n ? cn(r.n) : '';
  return `<button type="button" class="tl-i" data-id="${esc(r.id)}">${ico(r.c, '', r.n)}<div><div class="tl-n ${n ? '' : 'none'}">${n ? esc(n) : 'tanpa catatan'}</div><div class="tl-m"><span>${esc(c)}${r.s ? ' · ' + esc(r.s) : ''}</span>${(r.tg || []).map(t => `<span class="tg">#${esc(t)}</span>`).join('')}${r.ac && r.ac !== 'Accounts' ? `<span class="tl-w">${esc(r.ac)}</span>` : ''}</div></div><div class="tl-a ${r.k === 'I' ? 'in' : 'ex'}">${rph(r.a)}</div></button>`; };
function renderChips() {
  const c = [];
  if (F.cat) c.push(['cat', 'Kategori: ' + cat(F.cat) + (F.sub ? ' › ' + F.sub : '')]);
  if (F.k) c.push(['k', F.k === 'I' ? 'Pemasukan' : 'Pengeluaran']);
  if (F.w) c.push(['w', 'Dompet: ' + F.w]);
  if (F.tg) c.push(['tg', '#' + F.tg]);
  if (F.q.trim()) c.push(['q', 'Cari: “' + F.q.trim() + '”']);
  $('#flt-info').innerHTML = c.map(x => `<button type="button" class="fchip" data-x="${x[0]}" aria-label="Hapus filter">${esc(x[1])}<b aria-hidden="true">✕</b></button>`).join('');
}
function renderTlChips() {
  const bar = $('#tl-bar'); if (!bar) return;
  let box = $('#tl-chips');
  if (!box) {
    box = document.createElement('div'); box.id = 'tl-chips'; box.className = 'tl-chips'; box.setAttribute('aria-label', 'Filter cepat');
    box.onclick = e => {
      const b = e.target.closest('.tchip'); if (!b) return;
      if ('k' in b.dataset) F.k = b.dataset.k;
      else if ('w' in b.dataset) F.w = wkey(F.w) === wkey(b.dataset.w) ? '' : b.dataset.w;
      else if ('tg' in b.dataset) F.tg = F.tg === b.dataset.tg ? '' : b.dataset.tg;
      tlMonths = 3; dirty.tl = 1; refresh();
    };
    bar.appendChild(box);
  }
  const base = list();
  if (!base.length && !F.k && !F.w && !F.tg) { box.hidden = true; box.innerHTML = ''; return; }
  box.hidden = false;
  const wCnt = {}, tgCnt = {};
  base.forEach(r => {
    if (r.ac && r.ac !== 'Accounts') { const k = wkey(r.ac); wCnt[k] = wCnt[k] || { n: r.ac, c: 0 }; wCnt[k].c++; }
    (r.tg || []).forEach(t => { if (t) tgCnt[t] = (tgCnt[t] || 0) + 1; });
  });
  const wals = Object.values(wCnt).sort((a, b) => b.c - a.c).slice(0, 6).map(x => x.n);
  if (F.w && !wals.some(n => wkey(n) === wkey(F.w))) wals.unshift(F.w);
  const tags = Object.keys(tgCnt).sort((a, b) => (a === 'biaya-paylater' ? -1 : b === 'biaya-paylater' ? 1 : tgCnt[b] - tgCnt[a])).slice(0, 5);
  if (F.tg && !tags.includes(F.tg)) tags.unshift(F.tg);
  let h = [['', 'Semua'], ['E', 'Pengeluaran'], ['I', 'Pemasukan']].map(([v, l]) =>
    `<button type="button" class="tchip${F.k === v ? ' on' : ''}" data-k="${v}">${l}</button>`
  ).join('');
  if (wals.length) h += wals.map(w => `<button type="button" class="tchip${wkey(F.w) === wkey(w) ? ' on' : ''}" data-w="${esc(w)}">${esc(w)}</button>`).join('');
  if (tags.length) h += tags.map(t => `<button type="button" class="tchip tchip-tg${F.tg === t ? ' on' : ''}" data-tg="${esc(t)}">#${esc(t)}</button>`).join('');
  box.innerHTML = h;
}
function renderTl() {
  renderTlChips();
  const l = filteredTl(), box = $('#timeline');
  if (!l.length) { box.innerHTML = `<div class="empty">${recs.length ? 'Tidak ada transaksi yang cocok.' : 'Belum ada data. Impor dari Money Manager lewat ⚙ di pojok atas, atau ketuk tombol +.'}</div>`; $('#tl-more').hidden = true; return; }
  const mt = {}, days = []; let cur;
  for (const r of l) { const m = r.t.slice(0, 7), d = r.t.slice(0, 10), o = mt[m] = mt[m] || { e: 0, i: 0 }; o[r.k === 'E' ? 'e' : 'i'] += r.a;
    if (!cur || cur.d !== d) days.push(cur = { d, items: [] }); cur.items.push(r); }
  const lim = tlMonths * 7; let html = '', pm = '';
  for (const g of days.slice(0, lim)) {
    const m = g.d.slice(0, 7), dd = dateOf(g.d), e = g.items.filter(r => r.k === 'E').reduce((s, r) => s + r.a, 0), i = g.items.filter(r => r.k === 'I').reduce((s, r) => s + r.a, 0);
    if (m !== pm) { pm = m; const o = mt[m]; html += `<div class="tl-mh"><b>${mLabel(m)}</b><span>${o.i ? '+' + rp(o.i) + ' · ' : ''}−${rp(o.e)}</span></div>`; }
    html += `<div class="dgrp"><div class="dh"><span class="dd"><b>${dd.getDate()}</b><em>${DOW[dd.getDay()]}</em><small>${p2(dd.getMonth() + 1)}.${dd.getFullYear()}</small></span><span class="t">${i ? `<i class="i">${rph(i)}</i>` : ''}${e ? `<i class="e">${rph(e)}</i>` : ''}</span></div>${g.items.map(rowHTML).join('')}</div>`;
  }
  box.innerHTML = html; $('#tl-more').hidden = days.length <= lim;
}


/* ---------- bar bulan + ringkasan ---------- */
function renderStrip() {
  const cal = tab === 'cal', m0 = cal ? (calM || thisMonth()) : (F.from && F.from === F.to ? F.from : '');
  const bare = tab === 'data' || tab === 'plan' || tab === 'home' || tab === 'wal'; $('#appmon').hidden = bare; $('#strip').hidden = bare || tab === 'st';
  const l = cal ? recs.filter(r => r.t.slice(0, 7) === m0) : list(); let e = 0, i = 0;
  l.forEach(r => { if (r.k === 'E') e += r.a; else i += r.a; });
  setNum($('#s-in'), i, rp); setNum($('#s-ex'), e, rp); setNum($('#s-net'), i - e, rpS);
  $('#s-net').className = i - e < 0 ? 'r' : 'g';
  const md = mode(); $('#m-lab .lt').textContent = cal ? mLabel(m0) : md === 'month' ? mLabel(F.from) : md === 'year' ? F.from.slice(0, 4) : md === 'range' ? (F.from ? mShort(F.from) : 'Awal') + ' – ' + (F.to ? mShort(F.to) : 'Kini') : 'Semua waktu';
}
function mode() {
  if (!F.from && !F.to) return 'all';
  if (F.from && F.from === F.to) return 'month';
  if (F.from && F.to && F.from.slice(0, 4) === F.to.slice(0, 4) && F.from.slice(5) === '01' && F.to.slice(5) === '12') return 'year';
  return 'range';
}
function setRange(a, b, dir) { F.from = a; F.to = b; applyFilter(dir); }
function chooseMonth(k, dir) {
  if (tab === 'cal') { calM = k; calD = ''; dirty.cal = 1; transit(() => { renderMonth(); renderStrip(); dirty.cal = 0; }, dir); }
  else setRange(k, k, dir);
}
function shiftMonth(d) {
  if (tab === 'cal') { chooseMonth(addM(calM || thisMonth(), d), d); return; }
  const md = mode();
  if (md === 'month') setRange(addM(F.from, d), addM(F.from, d), d);
  else if (md === 'year') { const y = +F.from.slice(0, 4) + d; setRange(y + '-01', y + '-12', d); }
  else setRange(thisMonth(), thisMonth(), d);
}
function pickerSheet() {
  const cal = tab === 'cal', tm = thisMonth(), ty = +tm.slice(0, 4);
  const y0 = Math.min(ty, ...recs.map(r => +r.t.slice(0, 4)));
  const md = cal ? 'month' : mode(), cur = cal ? (calM || tm) : (F.from || tm);
  let y = Math.min(ty, Math.max(y0, +cur.slice(0, 4)));
  const ex = {}; recs.forEach(r => { if (r.k === 'E') { const m = r.t.slice(0, 7); ex[m] = (ex[m] || 0) + r.a; } });
  const n = document.createElement('div'); n.className = 'pick';
  const draw = () => {
    const chips = cal ? [['now', 'Bulan ini']] : [['now', 'Bulan ini'], ['3m', '3 bln terakhir'], ['year', 'Tahun ' + y], ['all', 'Semua waktu']];
    const on = q => !cal && (q === 'all' ? md === 'all' : q === 'now' ? md === 'month' && F.from === tm : q === '3m' ? md === 'range' && F.to === tm && F.from === addM(tm, -2) : md === 'year' && F.from.slice(0, 4) === String(y));
    n.innerHTML = `<div class="pk-q">${chips.map(c => `<button type="button" data-q="${c[0]}" class="${on(c[0]) ? 'on' : ''}">${c[1]}</button>`).join('')}</div>` +
      `<div class="pk-y"><button type="button" data-y="-1" aria-label="Tahun sebelumnya" ${y <= y0 ? 'disabled' : ''}>&lsaquo;</button><b>${y}</b><button type="button" data-y="1" aria-label="Tahun berikutnya" ${y >= ty ? 'disabled' : ''}>&rsaquo;</button></div>` +
      `<div class="pk-m">${MS.map((m, i) => { const k = y + '-' + p2(i + 1), fut = k > tm, sel = md === 'month' && cur === k;
        return `<button type="button" data-m="${k}" class="${sel ? 'on' : ''}" ${fut ? 'disabled' : ''}><span>${m}</span><small>${ex[k] ? jt(ex[k]) : '·'}</small></button>`; }).join('')}</div>`;
  };
  draw();
  n.onclick = e => {
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    if (b.dataset.y) { const d = +b.dataset.y; y += d; draw(); slide(n.querySelector('.pk-m'), d); return; }
    if (b.dataset.m) { closeSheet(); chooseMonth(b.dataset.m, b.dataset.m > cur ? 1 : -1); return; }
    const q = b.dataset.q; closeSheet();
    if (q === 'now') chooseMonth(tm, tm > cur ? 1 : -1);
    else if (q === '3m') setRange(addM(tm, -2), tm, 1);
    else if (q === 'year') setRange(y + '-01', y + '-12', 1);
    else setRange('', '', 1);
  };
  openSheet('Pilih periode', n);
}
$('#m-prev').onclick = () => shiftMonth(-1); $('#m-next').onclick = () => shiftMonth(1);
$('#m-lab').onclick = pickerSheet;

/* ---------- render: kalender bulanan ---------- */
function renderMonth() {
  if (!calM) calM = thisMonth();
  const [y, m] = calM.split('-').map(Number), dim = new Date(y, m, 0).getDate(), lead = new Date(y, m - 1, 1).getDay();
  const mr = recs.filter(r => r.t.slice(0, 7) === calM), dm = {};
  mr.forEach(r => { const o = dm[+r.t.slice(8, 10)] = dm[+r.t.slice(8, 10)] || { e: 0, i: 0 }; o[r.k === 'E' ? 'e' : 'i'] += r.a; });
  let cells = DOW.map(d => `<div class="dw">${d}</div>`).join('') + '<div class="dc e0"></div>'.repeat(lead);
  const today = dkey(new Date());
  for (let d = 1; d <= dim; d++) { const o = dm[d], k = calM + '-' + p2(d);
    cells += `<button type="button" class="dc ${k === calD ? 'sel' : ''} ${k === today ? 'today' : ''}" data-d="${k}"><span>${d}</span>${o && o.e ? `<small>${jt(o.e)}</small>` : ''}${o && o.i ? `<small class="in">+${jt(o.i)}</small>` : ''}</button>`; }
  let day = '';
  if (calD && calD.slice(0, 7) === calM) {
    const dl = mr.filter(r => r.t.slice(0, 10) === calD), dd = dateOf(calD + 'T00:00:00');
    day = `<h2 class="sec">${DOWL[dd.getDay()]}, ${dd.getDate()} ${MONTHS[dd.getMonth()]}</h2>` + (dl.length ? '<div class="dgrp">' + dl.map(rowHTML).join('') + '</div>' : '<div class="empty">Tidak ada transaksi di hari ini.</div>');
  }
  $('#calv').innerHTML = `<div class="mgrid">${cells}</div>${day}`;
}
$('#calv').onclick = e => {
  const dc = e.target.closest('.dc[data-d]'), tl = e.target.closest('.tl-i');
  if (dc) { calD = calD === dc.dataset.d ? '' : dc.dataset.d; renderMonth(); }
  else if (tl) detailSheet(tl.dataset.id);
};

/* ---------- render: statistik (donat, bulanan, tahunan) ---------- */
function renderSt() {
  const box = $('#st-body');
  const l = cat0();
  if (stTab === 'cat') {
    const mm = {}; l.filter(r => r.k === stK).forEach(r => { const o = mm[r.c] = mm[r.c] || { s: 0, n: 0 }; o.s += r.a; o.n++; });
    const e = Object.entries(mm).sort((a, b) => b[1].s - a[1].s), tot = e.reduce((s, x) => s + x[1].s, 0);
    const sk = k => rp(l.filter(r => r.k === k).reduce((s, r) => s + r.a, 0));
    if (box.dataset.mode !== 'cat' || !$('#pie')) {   // kerangka dibuat sekali; selanjutnya hanya data yang berubah (garis bawah & donat bergerak halus)
      box.dataset.mode = 'cat';
      box.innerHTML = '<div class="ktabs" id="kt"><button type="button" data-k="I"><small>Pemasukan</small><b id="kt-i"></b></button><button type="button" data-k="E"><small>Pengeluaran</small><b id="kt-e"></b></button></div>' + pieShell() + '<div id="st-rows"></div>';
      box.getBoundingClientRect();
    }
    const kt = $('#kt'); kt.style.setProperty('--i', stK === 'I' ? 0 : 1); kt.dataset.k = stK;
    kt.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.k === stK));
    $('#kt-i').textContent = sk('I'); $('#kt-e').textContent = sk('E');
    $('#pie-wrap').hidden = !tot;
    if (!tot) { $('#st-rows').innerHTML = '<div class="empty">Tidak ada data pada rentang ini.</div>'; return; }
    const LIM = 10, more = e.length > LIM + 1, mk = ([c, o]) => [c, o.s, o.n, catColor(c)];
    const head = (more ? e.slice(0, LIM) : e).map(mk), tail = more ? e.slice(LIM).reduce((a, x) => a + x[1].s, 0) : 0;
    const pieRows = tail ? head.concat([['Lainnya', tail, 0, '#64748b']]) : head;
    const rows = more && stAll ? e.map(mk) : pieRows, mx = Math.max(1, ...rows.map(r => r[1]));   // batang dibandingkan dengan kategori terbesar
    fillPie(pieRows, tot);
    const sm = {}; l.forEach(r => { if (r.k !== stK || !r.s) return; const g = sm[r.c] || (sm[r.c] = {}), o = g[r.s] || (g[r.s] = { s: 0, n: 0 }); o.s += r.a; o.n++; });
    const subHTML = c => { const g = sm[c]; if (!g || !stOpen.has(c)) return ''; const es = Object.entries(g).sort((a, b) => b[1].s - a[1].s), gt = es.reduce((x, y) => x + y[1].s, 0);
      return `<div class="subs">${es.map(([sn, o]) => `<button type="button" class="row-b sub" data-c="${esc(c)}" data-s="${esc(sn)}"><span class="rn">${esc(sn)}</span><span class="rb"><i style="width:${o.s / es[0][1].s * 100}%;background:${catColor(c)}"></i></span><span class="rc">${rp(o.s)}<small>${Math.round(o.s / gt * 100)}% · ${o.n}×</small></span></button>`).join('')}<button type="button" class="row-b sub all" data-c="${esc(c)}"><span class="rn">Lihat semua transaksi ›</span><span></span><span></span></button></div>`; };
    $('#st-rows').innerHTML = rows.map(r => `<button type="button" class="row-b${sm[r[0]] ? ' has-sub' : ''}${stOpen.has(r[0]) ? ' open' : ''}" ${r[0] === 'Lainnya' ? 'data-more="1"' : `data-c="${esc(r[0])}"`}>${ico(r[0])}<span class="rn cat"><span class="rnn">${r[0] === 'Lainnya' ? 'Lainnya (' + (e.length - LIM) + ' kategori)' : esc(cat(r[0]))}</span><span class="mb"><i style="width:${r[1] / mx * 100}%;background:${r[3]}"></i></span></span><span class="rc">${rp(r[1])}<small><b style="color:${r[3]}">${Math.round(r[1] / tot * 100)}%</b>${r[2] ? ' · ' + r[2] + '×' : ''}</small></span></button>` + subHTML(r[0])).join('') + (more && stAll ? '<button type="button" class="row-b" data-more="1"><span></span><span class="rnn">Tampilkan lebih sedikit</span><span></span></button>' : '');
    return;
  }
  const kl = stTab === 'm' ? 7 : 4, g = {};
  l.forEach(r => { const k = r.t.slice(0, kl), o = g[k] = g[k] || { e: 0, i: 0, ms: new Set() }; o[r.k === 'E' ? 'e' : 'i'] += r.a; o.ms.add(r.t.slice(0, 7)); });
  const ks = Object.keys(g).sort().reverse(), mx = Math.max(1, ...ks.map(k => g[k].e));
  box.dataset.mode = stTab;
  box.innerHTML = ks.length ? '<div id="st-rows">' + ks.map(k => { const o = g[k]; return `<div class="row-b static"><span class="rn">${kl === 7 ? mLabel(k) : k}</span><span class="rb"><i style="width:${o.e / mx * 100}%"></i></span><span class="rc">${rp(o.e)}<small>masuk ${jt(o.i)} · ${kl === 4 ? 'rata-rata ' + jt(o.e / o.ms.size) + '/bln' : 'selisih ' + rpS(o.i - o.e)}</small></span></div>`; }).join('') + '</div>' : '<div class="empty">Belum ada data.</div>';
}
const SEGS = 8, CX = 180, CY = 135, RR = 60, SW = 34, RO = RR + SW / 2;
let pieSel = -1, pieData = [];
function pieShell() {
  let c = ''; for (let i = 0; i < SEGS; i++) c += `<circle class="ps" data-i="${i}" cx="${CX}" cy="${CY}" r="${RR}" stroke-width="${SW}" pathLength="100" style="stroke-dasharray:0 100;stroke-dashoffset:0;opacity:0"></circle>`;
  return `<div id="pie-wrap"><svg id="pie" viewBox="0 0 360 270" role="img" aria-label="Diagram kategori"><g transform="rotate(-90 ${CX} ${CY})">${c}</g><g id="pie-lbl"></g><text id="pie-t1" x="${CX}" y="${CY - 3}" text-anchor="middle"></text><text id="pie-t2" x="${CX}" y="${CY + 17}" text-anchor="middle"></text></svg></div>`;
}
const trunc = (t, n) => t.length > n ? t.slice(0, n - 1) + '…' : t;
function pieCenter() {
  const d = pieSel >= 0 && pieData[pieSel], t1 = $('#pie-t1'), t2 = $('#pie-t2');
  t1.textContent = d ? trunc(d.c === 'Lainnya' ? d.c : cat(d.c), 13) : (stK === 'I' ? 'Pemasukan' : 'Pengeluaran');
  t2.textContent = 'Rp' + jt(d ? d.s : pieData.reduce((s, x) => s + x.s, 0));
  $('#pie').classList.toggle('sel', pieSel >= 0);
  document.querySelectorAll('#pie .ps').forEach((el, i) => el.classList.toggle('on', i === pieSel));
}
/* nama kategori di luar donat: muat penuh -> ukuran 12; hampir muat -> ukuran 11; masih panjang -> dua baris; sisanya dipotong. Ruang dihitung dari posisi label sampai tepi gambar. */
function pieLines(d, cs) {
  const sg = cs >= 0 ? 1 : -1, tx = CX + (RO + 14) * cs + sg * 12, room = (sg > 0 ? 360 - tx : tx) - 4, n12 = Math.max(6, Math.floor(room / 6.9)), n11 = Math.max(6, Math.floor(room / 6.3));
  const full = d.c === 'Lainnya' ? d.c : cat(d.c);
  if (full.length <= n12) return { lines: [full], sm: false };
  if (full.length <= n11) return { lines: [full], sm: true };
  const w = full.split(' '); let l1 = '', i = 0; while (i < w.length && (l1 ? l1 + ' ' + w[i] : w[i]).length <= n12) l1 = l1 ? l1 + ' ' + w[i++] : w[i++];
  if (!l1 || i >= w.length) return { lines: [trunc(full, n12)], sm: false };
  return { lines: [l1, trunc(w.slice(i).join(' '), n12)], sm: false };
}
function fillPie(rows, tot) {
  pieSel = -1; pieData = rows.map(r => ({ c: r[0], s: r[1], col: r[3], p: r[1] / tot * 100 }));
  let acc = 0;
  document.querySelectorAll('#pie .ps').forEach((el, i) => {
    const d = pieData[i];
    if (!d) { el.style.opacity = 0; el.style.strokeDasharray = '0 100'; return; }
    const len = Math.max(0, d.p - (pieData.length > 1 ? .8 : 0));
    el.style.strokeDasharray = len + ' ' + (100 - len); el.style.strokeDashoffset = -(acc + (d.p - len) / 2);
    el.style.stroke = d.col; el.style.opacity = 1; acc += d.p;
  });
  /* label di luar donat: nama + persen, saling menghindar secara vertikal */
  let a = 0; const L = [];
  pieData.forEach((d, i) => { const mid = (a + d.p / 2) / 100 * 2 * Math.PI - Math.PI / 2; a += d.p; if (d.p >= 4) L.push(Object.assign({ d, cs: Math.cos(mid), sn: Math.sin(mid) }, pieLines(d, Math.cos(mid)))); });
  const side = right => {
    const arr = L.filter(l => (l.cs >= 0) === right).map(l => Object.assign({ y: CY + (RO + 14) * l.sn }, l)).sort((x, y) => x.y - y.y);
    for (let k = 1; k < arr.length; k++) { const gap = 32 + 13 * (arr[k - 1].lines.length - 1); if (arr[k].y - arr[k - 1].y < gap) arr[k].y = arr[k - 1].y + gap; }
    if (arr.length) { const last = arr[arr.length - 1], over = last.y + 13 * (last.lines.length - 1) - 252; if (over > 0) arr.forEach(l => { l.y -= over; }); if (arr[0].y < 14) { const up = 14 - arr[0].y; arr.forEach(l => { l.y += up; }); } }
    return arr;
  };
  const g = $('#pie-lbl');
  g.innerHTML = side(true).concat(side(false)).map(l => {
    const sg = l.cs >= 0 ? 1 : -1, x1 = CX + (RO + 2) * l.cs, y1 = CY + (RO + 2) * l.sn, x2 = CX + (RO + 14) * l.cs, tx = x2 + sg * 12, ty = l.y;
    const an = sg > 0 ? 'start' : 'end', nl = l.lines.length;
    return `<polyline points="${x1},${y1} ${x2},${ty - 4} ${x2 + sg * 8},${ty - 4}" fill="none" stroke="${l.d.col}" stroke-width="1.3" stroke-linecap="round"/>` + l.lines.map((t, i) => `<text class="pl-n${l.sm ? ' sm' : ''}" x="${tx}" y="${ty + 13 * i}" text-anchor="${an}">${esc(t)}</text>`).join('') + `<text class="pl-p" x="${tx}" y="${ty + 14 + 13 * (nl - 1)}" text-anchor="${an}">${l.d.p < 10 ? l.d.p.toFixed(1).replace('.', ',') : Math.round(l.d.p)}%</text>`;
  }).join('');
  g.getAnimations().forEach(x => x.cancel());
  if (!reduce) g.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 420 * SPD, delay: 260 * SPD, easing: OUT, fill: 'backwards' });
  pieCenter();
}
$('#st-body').onclick = e => {
  const sb = e.target.closest('.row-b.sub');
  if (sb) { F.cat = sb.dataset.c; F.sub = sb.dataset.s || ''; dirty.sum = dirty.tl = dirty.st = 1; fillFilters(); syncURL(); go('tl'); return; }
  const k = e.target.closest('[data-k]'), r = e.target.closest('.row-b[data-c]'), ps = e.target.closest('.ps'), mr = e.target.closest('.row-b[data-more]');
  if (mr) { stAll = !stAll; renderSt(); }
  else if (ps) { const i = +ps.dataset.i; pieSel = pieSel === i ? -1 : i; pieCenter(); }
  else if (k) { if (k.dataset.k === stK) return; stK = k.dataset.k; renderSt(); slide($('#st-rows'), k.dataset.k === 'I' ? -1 : 1); }
  else if (r && r.classList.contains('has-sub')) { const c = r.dataset.c; stOpen.has(c) ? stOpen.delete(c) : stOpen.add(c); renderSt(); }
  else if (r) { F.cat = r.dataset.c; F.sub = ''; dirty.sum = dirty.tl = dirty.st = 1; fillFilters(); syncURL(); go('tl'); }
};

/* ---------- render: data ---------- */
function renderData() {
  const first = recs.length ? recs[recs.length - 1].t.slice(0, 10) : '—', last = recs.length ? recs[0].t.slice(0, 10) : '—';
  const bk = meta.lastBackup ? new Date(meta.lastBackup).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : 'belum pernah';
  $('#data').innerHTML = `
  <div class="dcard"><h3>Cara pakai</h3>
    <p>Bingung mulai dari mana? Tutorial singkat, 7 langkah, bisa maju mundur sesuka kamu.</p>
    <div class="acts"><button type="button" class="btn-p" id="d-tut">Buka tutorial</button></div></div>
  <div class="dcard"><h3>Impor dari Money Manager</h3>
    <p>Pilih file ekspor <b>.xlsx</b> (atau .csv) dari aplikasi Money Manager. Hanya transaksi sejak <b>${mLabel(meta.start)}</b> yang diambil, duplikat dilewati otomatis, jadi aman mengimpor ulang file yang lebih baru. Ada ringkasan dan konfirmasi sebelum apa pun digabungkan.</p>
    <div class="acts"><button type="button" class="btn-p" id="d-imp">Pilih file…</button></div>
    <p style="margin-top:14px">Mulai dari bulan <small>(batas bawah saat impor)</small></p>
    <input type="month" id="d-start" value="${meta.start}"></div>
  <div class="dcard"><h3>Profil</h3>
    <p>Nama dipakai untuk sapaan di Beranda dan nama pemegang di kartu dompet.</p>
    <input id="d-name" maxlength="20" autocomplete="off" autocapitalize="words" placeholder="Namamu" value="${esc(meta.name || '')}">
    <p style="margin-top:14px">Foto profil <small>(tersimpan di perangkat ini saja, tidak ikut backup)</small></p>
    <div style="display:flex;align-items:center;gap:14px"><span class="gr-av" id="d-av" aria-hidden="true">${avatarHTML()}</span>
      <div class="acts" style="margin:0"><button type="button" class="btn-s" id="d-avp">Pilih foto</button><button type="button" class="btn-s" id="d-avx"${avatarGet() ? '' : ' hidden'}>Hapus</button></div></div></div>
  <div class="dcard"><h3>Tampilan</h3>
    <div class="seg3" id="d-theme">${[['auto', 'Otomatis'], ['light', 'Terang'], ['dark', 'Gelap']].map(([k, l]) => `<button type="button" data-t="${k}" class="${(root.dataset.themePref || 'auto') === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <p style="margin:14px 0 8px">Tema <small>(palet warna saja, paling terasa di mode Gelap)</small></p>
    <div class="skins" id="d-skin">${SKINS.map(([k, l, c]) => `<button type="button" data-s="${k}" class="${skinGet() === k ? 'on' : ''}"><span>${c.map(x => `<i style="background:${x}"></i>`).join('')}</span>${l}</button>`).join('')}</div>
    <p style="margin:14px 0 8px" id="d-acc-note">Warna aksen${skinGet() !== 'std' ? ' <small>(mengikuti tema; pilih Standar untuk mengganti)</small>' : ''}</p>
    <div class="swatches${skinGet() !== 'std' ? ' dim' : ''}" id="d-accent">${ACCENTS.map(([k, l, c]) => `<button type="button" class="sw${accentGet() === k ? ' on' : ''}" data-a="${k}" style="background:${c}" aria-label="${l}" aria-pressed="${accentGet() === k}"></button>`).join('')}</div>
    <p style="margin:14px 0 8px">Animasi <small>(Tanpa animasi hanya untuk perangkat yang sangat lemah)</small></p>
    <div class="seg3" id="d-motion">${[['full', 'Penuh'], ['lite', 'Tanpa animasi']].map(([k, l]) => `<button type="button" data-m="${k}" class="${MOTION === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <p style="margin:14px 0 8px">Efek kaca (blur) <small>(matikan kalau animasi terasa berat)</small></p>
    <div class="seg3" id="d-glass">${[['auto', 'Otomatis'], ['off', 'Mati']].map(([k, l]) => `<button type="button" data-g="${k}" class="${(k === 'off') === glassOff() ? 'on' : ''}">${l}</button>`).join('')}</div>
    <p style="margin:14px 0 8px">Nominal saat app dibuka <small>(ikon mata di header untuk buka/tutup kapan saja)</small></p>
    <div class="seg3" id="d-hide">${[['1', 'Disembunyikan'], ['0', 'Terlihat']].map(([k, l]) => `<button type="button" data-h="${k}" class="${((k === '0') === (localStorage.getItem('md_hide_boot') === '0')) ? 'on' : ''}">${l}</button>`).join('')}</div></div>
  <div class="dcard"><h3>Biaya admin bank otomatis</h3>
    <p>Catat otomatis biaya admin rekening &amp; kartu debit di akhir setiap bulan (2 baris terpisah). Matikan kalau tidak dipakai.</p>
    <div class="seg3" id="d-ba-on">${[['0', 'Nonaktif'], ['1', 'Aktif']].map(([k, l]) => `<button type="button" data-v="${k}" class="${(k === '1') === bankAdminGet().on ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div id="d-ba-box" class="form" style="margin-top:12px"${bankAdminGet().on ? '' : ' hidden'}>
      <label>Dompet yang dipotong<select id="d-ba-w">${(meta.wallets.length ? meta.wallets.map(w => w.name) : ['Accounts']).map(n => `<option value="${esc(n)}"${wkey(n) === wkey(bankAdminGet().wal || (meta.wallets[0] ? meta.wallets[0].name : 'Accounts')) ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
      <label>Biaya admin rekening (Rp)<input id="d-ba-a" inputmode="numeric" placeholder="mis. 12.500" value="${bankAdminGet().acct ? NF.format(bankAdminGet().acct) : ''}"></label>
      <label>Biaya admin kartu debit (Rp)<input id="d-ba-d" inputmode="numeric" placeholder="mis. 5.000" value="${bankAdminGet().debit ? NF.format(bankAdminGet().debit) : ''}"></label>
      <div class="acts"><button type="button" class="btn-p" id="d-ba-sv">Simpan</button><button type="button" class="btn-s" id="d-ba-bf">Isi bulan sebelumnya</button></div>
      <div class="hint" id="d-ba-st">${bankAdminHint()}</div>
    </div></div>
  <div class="dcard"><h3>Rapikan kategori</h3>
    <p>Mengelompokkan transaksi ke <b>grup › sub-kategori</b> + tag (mis. Makan &amp; Minum › Kopi &amp; Jajan, Transport › Ojol) berdasarkan isi catatan. Ada pratinjau dan tombol Batalkan.</p>
    <div class="acts"><button type="button" class="btn-s" id="d-tidy">Cek &amp; rapikan…</button></div></div>
  <div class="dcard"><h3>Aturan catatan</h3>
    <p>Kalau catatan ada kata tertentu, kategorinya keisi sendiri. Aturanmu lebih utama dari aturan bawaan, dan berlaku di form maupun saat impor.</p>
    <div class="sum-list" id="d-rules">${meta.rules.length ? meta.rules.map((u, i) => `<button type="button" class="kv rl" data-i="${i}"><span>“${esc(u.k)}”<small> → ${esc(cat(u.g))}${u.s ? ' › ' + esc(u.s) : ''}${(u.tg || []).length ? ' #' + esc(u.tg.join(' #')) : ''}</small></span><b>${u.kind === 'I' ? 'Masuk' : 'Keluar'}</b></button>`).join('') : '<div class="empty">Belum ada aturan sendiri.</div>'}</div>
    <div class="acts"><button type="button" class="btn-s" id="d-rule-add">Tambah aturan</button></div></div>
  <div class="dcard"><h3>Ringkasan data</h3>
    <div class="kv"><span>Jumlah transaksi</span><b>${NF.format(recs.length)}</b></div>
    <div class="kv"><span>Transaksi pertama</span><b>${first}</b></div>
    <div class="kv"><span>Transaksi terakhir</span><b>${last}</b></div>
    <div class="kv"><span>Perubahan belum dibackup</span><b class="${meta.changes > 20 ? 'warn' : ''}">${meta.changes}</b></div>
    <div class="kv"><span>Backup terakhir</span><b>${bk}</b></div></div>
  <div class="dcard"><h3>Backup &amp; ekspor</h3>
    <p>Datamu cuma ada di browser di perangkat ini. HP, tablet, dan laptop tidak saling sinkron. Di HP, <b>Cadangkan</b> membuka menu Bagikan: pilih Simpan ke Berkas (iCloud) atau Drive. Buat pindah ke perangkat lain, cadangkan lalu <b>Pulihkan</b> di sana: transaksi digabung tanpa duplikat, tapi dompet dan budget di sana ikut tertimpa.</p>
    <div class="acts"><button type="button" class="btn-s" id="d-bk">Cadangkan</button><button type="button" class="btn-s" id="d-rs">Pulihkan backup…</button><button type="button" class="btn-s" id="d-csv">Ekspor CSV</button><button type="button" class="btn-s" id="d-abk">Cadangan otomatis</button></div></div>
  <div class="dcard"><h3>Reset</h3>
    <p>Hapus semua data di perangkat ini. Backup dulu kalau masih butuh.</p>
    <div class="acts"><button type="button" class="btn-s btn-d" id="d-clr">Hapus semua</button></div></div>`;
  const avSet = u => { try { if (u) localStorage.setItem(AVK, u); else localStorage.removeItem(AVK); } catch (x) { toast('Foto tidak bisa disimpan (penyimpanan penuh)'); return false; } $('#d-av').innerHTML = avatarHTML(); $('#d-avx').hidden = !u; dirty.home = 1; return true; };
  $('#d-avp').onclick = () => pickFile('image/*', async f => {   // dipotong persegi di tengah, 192px, supaya hanya belasan KB
    try {
      const url = URL.createObjectURL(f), im = new Image(); im.src = url; await im.decode(); URL.revokeObjectURL(url);
      const c = document.createElement('canvas'); c.width = c.height = 192; const m = Math.min(im.naturalWidth, im.naturalHeight);
      c.getContext('2d').drawImage(im, (im.naturalWidth - m) / 2, (im.naturalHeight - m) / 2, m, m, 0, 0, 192, 192);
      if (avSet(c.toDataURL('image/jpeg', .85))) toast('Foto profil disimpan');
    } catch (x) { toast('Foto ini tidak bisa dibaca, coba foto lain'); }
  });
  $('#d-avx').onclick = () => { if (avSet('')) toast('Foto profil dihapus'); };
  $('#d-name').onchange = e => { meta.name = e.target.value.trim().slice(0, 20); e.target.value = meta.name; save(); dirty.home = dirty.wal = 1; toast('Nama disimpan: ' + userName()); };
  $('#d-skin').onclick = e => { const b = e.target.closest('button'); if (!b) return; const R = document.documentElement; R.classList.remove('skin-sw'); void R.offsetWidth; R.classList.add('skin-sw'); setTimeout(() => R.classList.remove('skin-sw'), 500); applySkin(b.dataset.s); const std = b.dataset.s === 'std';
    $('#d-skin').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); $('#d-accent').classList.toggle('dim', !std);
    $('#d-acc-note').innerHTML = 'Warna aksen' + (std ? '' : ' <small>(mengikuti tema; pilih Standar untuk mengganti)</small>'); };
  $('#d-accent').onclick = e => { const b = e.target.closest('button'); if (!b) return; applyAccent(b.dataset.a); $('#d-accent').querySelectorAll('button').forEach(x => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on); }); };
  $('#d-theme').onclick = e => { const b = e.target.closest('button'); if (!b) return; applyTheme(b.dataset.t); $('#d-theme').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); };
  $('#d-motion').onclick = e => { const b = e.target.closest('button'); if (!b || b.dataset.m === MOTION) return; try { localStorage.setItem('md_motion', b.dataset.m); } catch (x) {} toast('Animasi: ' + (b.dataset.m === 'lite' ? 'Tanpa animasi' : 'Penuh') + ', memuat ulang…'); setTimeout(() => location.reload(), 350); };
  $('#d-glass').onclick = e => { const b = e.target.closest('button'); if (!b) return; try { b.dataset.g === 'off' ? localStorage.setItem('md_glass', 'off') : localStorage.removeItem('md_glass'); } catch (x) {} if (b.dataset.g === 'off') { root.dataset.glass = 'off'; $('#d-glass').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); toast('Efek kaca dimatikan'); } else { toast('Memuat ulang…'); setTimeout(() => location.reload(), 300); } };
  $('#d-hide').onclick = e => { const b = e.target.closest('button'); if (!b) return; try { localStorage.setItem('md_hide_boot', b.dataset.h); } catch (x) {} $('#d-hide').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); toast(b.dataset.h === '1' ? 'Nominal disembunyikan saat app dibuka' : 'Nominal terlihat saat app dibuka'); };
  $('#d-tut').onclick = () => tutSheet();
  $('#d-imp').onclick = () => pickFile('.xlsx,.xls,.csv', importMM);
  $('#d-rs').onclick = () => pickFile('.json', restoreBackup);
  $('#d-tidy').onclick = tidySheet;
  document.querySelectorAll('#d-rules .rl').forEach(b => b.onclick = () => ruleSheet(+b.dataset.i)); $('#d-rule-add').onclick = () => ruleSheet();
  $('#d-bk').onclick = downloadBackup; $('#d-csv').onclick = exportCSV; $('#d-abk').onclick = abkSheet;
  $('#d-start').onchange = e => { if (/^\d{4}-\d{2}$/.test(e.target.value)) { meta.start = e.target.value; save(); toast('Batas impor: ' + mLabel(meta.start)); renderData(); } };
  $('#d-ba-on').onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    const on = b.dataset.v === '1', cur = bankAdminGet();
    cur.on = on; if (on && !cur.since) cur.since = thisMonth();
    meta.bankAdmin = cur; save();
    $('#d-ba-on').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    $('#d-ba-box').hidden = !on;
    toast(on ? 'Biaya admin otomatis aktif — isi nominal lalu tekan Simpan' : 'Biaya admin otomatis dimatikan');
  };
  const baSaveInputs = () => {
    const cur = bankAdminGet();
    cur.on = true;
    cur.wal = ($('#d-ba-w') && $('#d-ba-w').value) || 'Accounts';
    cur.acct = parseAmt($('#d-ba-a').value);
    cur.debit = parseAmt($('#d-ba-d').value);
    if (!cur.since) cur.since = thisMonth();
    meta.bankAdmin = cur;
    return cur;
  };
  ['#d-ba-a', '#d-ba-d'].forEach(sel => { const inp = $(sel); if (inp) inp.oninput = e => { e.target.value = fmtAmt(e.target.value); }; });
  $('#d-ba-sv').onclick = () => {
    const cur = baSaveInputs();
    if (!cur.acct && !cur.debit) { toast('Isi minimal salah satu nominal biaya admin'); return; }
    save();
    const added = runBankAdmin(true);
    $('#d-ba-st').textContent = bankAdminHint();
    toast(added ? 'Disimpan · ' + added + ' baris biaya admin dicatat' : 'Pengaturan biaya admin disimpan');
  };
  $('#d-ba-bf').onclick = () => {
    const cur = baSaveInputs();
    if (!cur.acct && !cur.debit) { toast('Isi minimal salah satu nominal biaya admin dulu'); return; }
    const ms = bankAdminMonths(true);
    if (!ms.length) { save(); toast('Semua bulan sebelumnya sudah tercatat'); return; }
    const rs = recs.slice(), ms0 = JSON.stringify(meta);
    let added = 0;
    if (!commit(() => { added = applyBankAdminMonths(ms, cur); })) return;
    $('#d-ba-st').textContent = bankAdminHint();
    toast(added + ' baris biaya admin (' + ms.length + ' bulan) dicatat', () => {
      if (commit(() => { recs = rs; Object.keys(meta).forEach(k => delete meta[k]); Object.assign(meta, JSON.parse(ms0)); })) { renderData(); toast('Pencatatan biaya admin dibatalkan'); }
    });
  };
  $('#d-clr').onclick = e => confirmBtn(e.target, 'Yakin? Ketuk lagi', () => { recs = []; meta.wallets = []; meta.xfers = []; meta.pl = []; meta.plPays = []; delete meta.plRecon; delete meta.bankAdmin; meta.changes = 0; save(); dirtyAll(); fillFilters(); refresh(); toast('Semua data dihapus'); });
}

/* ---- biaya admin bank otomatis (akhir bulan, 2 baris terpisah) ---- */
function bankAdminGet() {
  const b = meta.bankAdmin && typeof meta.bankAdmin === 'object' ? meta.bankAdmin : {};
  return {
    on: !!b.on,
    acct: Math.max(0, Math.round(+b.acct || 0)),
    debit: Math.max(0, Math.round(+b.debit || 0)),
    wal: String(b.wal || ''),
    since: /^\d{4}-\d{2}$/.test(b.since || '') ? b.since : '',
    done: Array.isArray(b.done) ? b.done.filter(m => /^\d{4}-\d{2}$/.test(m)) : []
  };
}
function bankAdminLastDay(ym) {
  const [y, m] = ym.split('-').map(Number);
  return ym + '-' + p2(new Date(y, m, 0).getDate());
}
function bankAdminMonths(includePast) {
  const b = bankAdminGet(), td = nowLocal().slice(0, 10), tm = td.slice(0, 7);
  const endYM = td >= bankAdminLastDay(tm) ? tm : addM(tm, -1);
  let startYM = includePast ? (recs.length ? recs[recs.length - 1].t.slice(0, 7) : meta.start) : (b.since || tm);
  if (!/^\d{4}-\d{2}$/.test(startYM) || startYM > endYM) return [];
  const done = new Set(b.done), out = [];
  for (let m = startYM; m <= endYM; m = addM(m, 1)) {
    if (!done.has(m)) out.push(m);
    if (out.length >= 120) break;
  }
  return out;
}
function applyBankAdminMonths(ms, b) {
  const rows = [], wal = b.wal || (meta.wallets[0] ? meta.wallets[0].name : 'Accounts');
  ms.forEach(ym => {
    const dt = bankAdminLastDay(ym);
    if (b.acct > 0) rows.push({ t: dt + 'T23:55:00', k: 'E', c: 'Other', s: 'Admin Bank', tg: ['admin-bank'], n: 'Biaya admin rekening', a: b.acct, ac: wal });
    if (b.debit > 0) rows.push({ t: dt + 'T23:55:01', k: 'E', c: 'Other', s: 'Admin Bank', tg: ['admin-bank'], n: 'Biaya admin debit', a: b.debit, ac: wal });
  });
  const r = addBatch(rows, { skipDup: true });
  b.done = Array.from(new Set(b.done.concat(ms))).sort();
  meta.bankAdmin = b;
  return r.added;
}
function runBankAdmin(quiet) {
  const b = bankAdminGet();
  if (!b.on || (!b.acct && !b.debit)) return 0;
  const ms = bankAdminMonths(false);
  if (!ms.length) return 0;
  let added = 0;
  if (!commit(() => { added = applyBankAdminMonths(ms, b); })) return 0;
  if (!quiet && added) toast('Biaya admin bank (' + ms.map(mShort).join(', ') + ') dicatat otomatis');
  return added;
}
function bankAdminHint() {
  const b = bankAdminGet(), past = bankAdminMonths(true);
  const info = b.done.length ? 'Sudah tercatat: ' + b.done.length + ' bulan (terakhir ' + mLabel(b.done[b.done.length - 1]) + '). ' : '';
  return info + (past.length ? 'Ada ' + past.length + ' bulan sebelumnya yang bisa diisi otomatis.' : 'Otomatis tercatat setiap tanggal terakhir bulan.');
}
/* ---- tutorial: dibuka dari Pengaturan, bisa maju/mundur ---- */
const TUT = [
  ['Mulai dari dompet', ['Buka tab <b>Dompet</b>, lalu bikin dompet buat tiap akun yang kamu pakai (Livin Mandiri, GoPay, dll).', 'Isi saldonya sesuai angka di aplikasi bank atau e-wallet-nya.', 'Mulai dari situ, saldo ikut jalan sama transaksi yang kamu catat <b>sesudahnya</b>. Riwayat lama, termasuk hasil impor, nggak ikut dihitung.']],
  ['Catat transaksi', ['Ketuk tombol <b>+</b>, isi nominal, catatan, dan kategori.', 'Di bagian <b>Dibayar dari</b>, pilih dompetnya. Saldo dompet itu langsung ikut berkurang.', 'Chip di paling atas form itu catatan yang sering kamu pakai. Tinggal ketuk, langsung keisi.', '<b>Simpan &amp; tambah lagi</b> buat nyatet beberapa transaksi berturut-turut.']],
  ['Isi saldo dan transfer', ['<b>Isi saldo</b> dipakai kalau ada uang masuk ke sebuah dompet.', '<b>Transfer</b> buat mindahin uang antar dompet. Biaya admin boleh diisi, nanti dicatat sebagai pengeluaran.', 'Transfer nggak dihitung sebagai pemasukan atau pengeluaran. Cuma biaya adminnya yang masuk statistik.']],
  ['Samain sama aplikasi bank', ['Buka sebuah dompet, ketuk <b>Cocokkan</b>, lalu ketik saldo yang tampil di aplikasi banknya.', 'Kalau ada selisih, kelihatan langsung. Biasanya ada transaksi yang kelewat dicatat.']],
  ['Lihat hasilnya', ['<b>Beranda</b>: ringkasan bulan ini dan total saldo.', '<b>Transaksi</b>: riwayat harian dan kalender.', '<b>Statistik</b>: pengeluaran per kategori, bulan, dan tahun.', '<b>Rencana</b>: budget bulanan dan target tabungan.']],
  ['Jangan lupa backup', ['Datamu cuma ada di browser ini. Unduh backup lewat ⚙ di pojok atas.', 'Dompet, transfer, dan catatan pemakaian point ikut tersimpan di backup.', 'Impor dari Money Manager aman diulang, transaksi yang sama otomatis dilewati.']]
];
function tutSheet(start) {
  let i = start || 0;
  const n = el(`<div class="form tut"><div class="tut-h"><span class="tut-n" id="tt-n"></span><b id="tt-t"></b></div><ul id="tt-l"></ul><div class="tut-d" id="tt-d"></div>
    <div class="acts"><button type="button" class="btn-s" id="tt-p">Sebelumnya</button><button type="button" class="btn-p" id="tt-x">Lanjut</button></div></div>`);
  const q = x => n.querySelector(x);
  const draw = () => {
    q('#tt-n').textContent = i + 1; q('#tt-t').textContent = TUT[i][0];
    q('#tt-l').innerHTML = TUT[i][1].map(t => '<li>' + t + '</li>').join('');
    q('#tt-d').innerHTML = TUT.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('');
    q('#tt-p').style.visibility = i ? 'visible' : 'hidden'; q('#tt-x').textContent = i === TUT.length - 1 ? 'Selesai' : 'Lanjut';
  };
  q('#tt-p').onclick = () => { if (i) { i--; draw(); } };
  q('#tt-x').onclick = () => { if (i < TUT.length - 1) { i++; draw(); } else closeSheet(); };
  draw(); openSheet('Cara pakai', n);
}
function tidySheet() {
  const sameTg = (a, b) => (a || []).join('|') === (b || []).join('|');
  const ch = recs.map(r => { const cl = MMImport.classify(r.k, r.n, r.c), tg = [...new Set((r.tg || []).concat(cl.tg))];
    return [r, cl, tg]; }).filter(([r, cl, tg]) => cl.c !== r.c || cl.s !== (r.s || '') || !sameTg(tg, r.tg));
  const by = {}; ch.forEach(([r, cl]) => { const key = cat(cl.c) + (cl.s ? ' › ' + cl.s : ''), o = by[key] || (by[key] = { n: 0, s: 0, from: {} });
    o.n++; o.s += r.a; o.from[cat(r.c)] = (o.from[cat(r.c)] || 0) + 1; });
  const rows = Object.entries(by).sort((a, b) => b[1].s - a[1].s);
  const n = el(`<div><p class="hint">Setiap transaksi dikelompokkan ke <b>grup › sub-kategori</b> (dan diberi tag bila perlu) berdasarkan isi catatan. Tidak ada nominal yang berubah.</p><div class="sum-list">${rows.length ? rows.map(([c, o]) => `<div class="kv"><span>${esc(c)}<small> ← ${esc(Object.entries(o.from).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([f, k]) => f + ' ' + k).join(', '))}</small></span><b>${NF.format(o.n)} · ${rp(o.s)}</b></div>`).join('') : '<div class="empty">Semua kategori sudah rapi.</div>'}</div>
    <div class="form"><div class="acts"><button type="button" class="btn-s" id="td-no">Batal</button><button type="button" class="btn-p" id="td-ok" ${ch.length ? '' : 'disabled'}>Terapkan ${ch.length} perubahan</button></div></div></div>`);
  openSheet('Rapikan kategori', n);
  n.querySelector('#td-no').onclick = closeSheet;
  n.querySelector('#td-ok').onclick = () => { const snap = JSON.stringify({ recs, cats: meta.cats });
    ch.forEach(([r, cl, tg]) => { r.c = cl.c; r.s = cl.s; r.tg = tg; }); recs.forEach(r => { if (r.s == null) { r.s = ''; r.tg = r.tg || []; } });
    const bm = {}; Object.entries(meta.cats).forEach(([k, v]) => { const nk = MMImport.classify('E', '', k).c; bm[nk] = (bm[nk] || 0) + v; }); meta.cats = bm;   // anggaran kategori yang digabung ikut dijumlahkan
    meta.catV = 2; closeSheet(); fillFilters(); changed();
    toast(ch.length + ' transaksi dirapikan', () => { const o = JSON.parse(snap); recs = o.recs; meta.cats = o.cats; meta.catV = 0; fillFilters(); changed(); toast('Dibatalkan'); }); };
}
function ruleSheet(i) {   // tambah / ubah aturan catatan
  const ex = i == null ? null : meta.rules[i], GE = ['Food', 'Transport', 'Hiburan & Game', 'Tagihan & Langganan', 'Belanja', 'Sosial & Hadiah', 'Kesehatan & Pendidikan', 'Other'], GI = ['Allowance', 'Penghasilan Lain', 'Other'];
  let kind = ex ? ex.kind : 'E';
  const n = el(`<form class="form" autocomplete="off"><div class="seg"><button type="button" data-k="E" class="exp">Pengeluaran</button><button type="button" data-k="I" class="inc">Pemasukan</button></div>
    <label>Kata di catatan<input id="rl-k" placeholder="mis. wingstop" value="${esc(ex ? ex.k : '')}" required></label>
    <label>Grup<select id="rl-g"></select></label><label>Sub-kategori<select id="rl-s"></select></label>
    <label>Tag <small>(opsional, pisahkan dengan koma)</small><input id="rl-t" placeholder="mis. trip" value="${esc(ex ? (ex.tg || []).join(', ') : '')}"></label>
    ${ex ? '' : '<label class="chk"><input type="checkbox" id="rl-ap"> Terapkan juga ke transaksi lama yang cocok</label>'}
    <div class="acts">${ex ? '<button type="button" class="btn-s btn-d" id="rl-del">Hapus</button>' : ''}<button type="submit" class="btn-p">Simpan</button></div></form>`);
  const q = s => n.querySelector(s);
  const fillS = () => { const g = q('#rl-g').value, ss = kind === 'I' ? ((MMImport.SUBS_I || {})[g] || []) : ((MMImport.SUBS || {})[g] || []);
    q('#rl-s').innerHTML = '<option value="">—</option>' + ss.map(x => `<option>${esc(x)}</option>`).join(''); if (ex && ex.kind === kind && ex.g === g) q('#rl-s').value = ex.s || ''; };
  const fillG = () => { n.querySelectorAll('.seg button').forEach(b => b.classList.toggle('on', b.dataset.k === kind));
    q('#rl-g').innerHTML = (kind === 'I' ? GI : GE).map(g => `<option value="${esc(g)}">${esc(cat(g))}</option>`).join(''); if (ex && ex.kind === kind) q('#rl-g').value = ex.g; fillS(); };
  n.querySelectorAll('.seg button').forEach(b => b.onclick = () => { kind = b.dataset.k; fillG(); });
  q('#rl-g').onchange = fillS; fillG();
  n.onsubmit = e => { e.preventDefault();
    const k = q('#rl-k').value.trim().toLowerCase(); if (!k) return;
    const o = { k, kind, g: q('#rl-g').value, s: q('#rl-s').value, tg: [...new Set(q('#rl-t').value.split(',').map(x => x.replace(/^\s*#/, '').trim().replace(/\s+/g, '-').toLowerCase()).filter(Boolean))] };
    const dup = meta.rules.findIndex((u, j) => j !== i && u.k === k && u.kind === kind); if (dup >= 0) { meta.rules.splice(dup, 1); if (ex && dup < i) i--; }
    if (ex) meta.rules[i] = o; else meta.rules.unshift(o);
    MMImport.setRules(meta.rules);
    const ap = q('#rl-ap'); let cnt = 0, snap = null;
    if (ap && ap.checked) { snap = JSON.stringify(recs); recs.forEach(r => { if (r.k === kind && r.n && r.n.toLowerCase().includes(k)) { r.c = o.g; r.s = o.s; r.tg = [...new Set((r.tg || []).concat(o.tg))]; cnt++; } }); }
    closeSheet(); fillFilters(); changed();
    toast(cnt ? 'Aturan disimpan, ' + cnt + ' transaksi diubah' : 'Aturan disimpan', snap ? () => { recs = JSON.parse(snap); fillFilters(); changed(); toast('Dibatalkan'); } : null); };
  const dl = q('#rl-del'); if (dl) dl.onclick = () => { meta.rules.splice(i, 1); MMImport.setRules(meta.rules); closeSheet(); changed(); toast('Aturan dihapus'); };
  openSheet(ex ? 'Ubah aturan' : 'Aturan baru', n);
}
function confirmBtn(b, label, fn) {
  if (b.dataset.armed) { fn(); return; }
  const old = b.textContent; b.dataset.armed = 1; b.textContent = label;
  setTimeout(() => { delete b.dataset.armed; b.textContent = old; }, 3000);
}

/* ---------- sheet / modal ---------- */
let sheetTk = 0;
function openSheet(title, node, detent) {   // detent: di HP buka setengah layar, tarik ke atas untuk penuh
  const ov = $('#sheet-ov'); sheetTk++;
  ov.firstElementChild.classList.remove('dt', 'dt-half'); if (detent && innerWidth <= 768) ov.firstElementChild.classList.add('dt', 'dt-half');
  ov.getAnimations().concat(ov.firstElementChild.getAnimations()).forEach(a => a.cancel());
  ov.firstElementChild.style.transform = '';
  $('#sheet-title').textContent = title; const b = $('#sheet-body'); b.innerHTML = ''; b.appendChild(node);
  ov.classList.add('open'); document.body.style.overflow = 'hidden';
}
function closeSheet(from) {
  from = typeof from === 'number' ? from : 0;
  const ov = $('#sheet-ov'); if (!ov.classList.contains('open')) return;
  const m = ov.firstElementChild, tk = ++sheetTk, mob = innerWidth <= 768;
  const done = () => { if (tk !== sheetTk) return; ov.classList.remove('open'); document.body.style.overflow = ''; m.style.transform = ''; };
  if (reduce) return done();
  const D = 420 * SPD; m.style.transform = '';
  m.animate(mob ? [{ transform: `translate3d(0,${from}px,0)` }, { transform: 'translate3d(0,100%,0)' }] : [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translate3d(0,10px,0) scale(.96)' }], { duration: D, easing: OUT, fill: 'forwards' });
  ov.animate([{ opacity: 1 }, { opacity: 0 }], { duration: D, easing: OUT, fill: 'forwards' }).finished.then(done, done);
}
$('#sheet-x').onclick = () => closeSheet();
function expandSheet(m) {   // setengah -> penuh: tinggi berubah langsung, geraknya lewat transform
  const t0 = m.getBoundingClientRect().top; m.classList.remove('dt-half'); const d = t0 - m.getBoundingClientRect().top;
  if (d > 0 && !reduce) m.animate([{ transform: `translate3d(0,${d}px,0)` }, { transform: 'none' }], { duration: 420 * SPD, easing: IOS });
}
(() => { /* tarik grip/judul atau area atas isi sheet ke bawah untuk menutup (HP) */
  const m = $('#sheet-ov').firstElementChild; let y0 = null, dy = 0, t0 = 0, armed = false, pid = null;
  m.addEventListener('pointerdown', e => {
    if (innerWidth > 768) return;
    const onHead = !!e.target.closest('.grab,h3');
    if (!onHead) {
      if (m.scrollTop > 0 || e.target.closest('input,textarea,select,button,a,label')) return;
    }
    y0 = e.clientY; dy = 0; t0 = performance.now(); armed = onHead; pid = e.pointerId;
    if (onHead) { try { m.setPointerCapture(pid); } catch (x) {} }
  });
  m.addEventListener('focusin', e => { if (m.classList.contains('dt-half') && e.target.closest('input,select,textarea') && e.target.id !== 'fm-a') expandSheet(m); });   // mengetik -> sheet penuh
  m.addEventListener('pointermove', e => {
    if (y0 == null) return;
    dy = e.clientY - y0;
    if (!armed) {
      if (dy < -6) { y0 = null; return; }   // geser ke atas: biarkan scroll isi modal berjalan normal
      if (dy > 10 && m.scrollTop <= 0) { armed = true; try { m.setPointerCapture(pid); } catch (x) {} }
      else return;
    }
    m.style.transform = `translate3d(0,${Math.max(0, dy)}px,0)`;
  });
  const end = () => { if (y0 == null) return; const wasArmed = armed; const v = dy / Math.max(1, performance.now() - t0); y0 = null; armed = false; pid = null;
    if (!wasArmed) return;
    const half = m.classList.contains('dt-half'), full = m.classList.contains('dt') && !half;
    if (half && dy < -50) { m.style.transform = ''; expandSheet(m); }   // tarik ke atas: penuh
    else if (full && dy > 90 && v < 1.2) { m.classList.add('dt-half'); m.animate([{ transform: `translate3d(0,${dy}px,0)` }, { transform: 'none' }], { duration: 420 * SPD, easing: IOS }); m.style.transform = ''; }   // dari penuh: turun dulu ke setengah
    else if (dy > 110 || v > .6) closeSheet(dy); else { m.animate([{ transform: `translate3d(0,${dy}px,0)` }, { transform: 'none' }], { duration: 420 * SPD, easing: IOS }); m.style.transform = ''; } };
  m.addEventListener('pointerup', end); m.addEventListener('pointercancel', end);
})();
$('#sheet-ov').addEventListener('click', e => { if (e.target.id === 'sheet-ov') closeSheet(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });
document.addEventListener('keydown', e => { /* pintasan laptop */
  if (e.metaKey || e.ctrlKey || e.altKey || e.target.closest('input,textarea,select') || $('#sheet-ov').classList.contains('open')) return;
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { const t = TABS[TABS.indexOf(tab) + (e.key === 'ArrowRight' ? 1 : -1)]; if (t) go(t); }
  else if (e.key === '/') { e.preventDefault(); go('tl'); setTimeout(() => $('#tl-q').focus(), 60); }
  else if (e.key === 'n') { e.preventDefault(); formSheet(); }
});
const el = (html) => { const d = document.createElement('div'); d.innerHTML = html; return d; };

function detailSheet(id) {
  const r = recs.find(x => x.id === id); if (!r) return;
  const d = dateOf(r.t), n = el(`<div class="det">${ico(r.c, "lg", r.n)}<div class="big ${r.k === 'I' ? 'in' : ''}">${r.k === 'I' ? '+' : '−'}${rp(r.a)}</div>
    <div class="kv"><span>Catatan</span><b>${esc(r.n ? cn(r.n) : '—')}</b></div><div class="kv"><span>Kategori</span><b>${esc(cat(r.c))}${r.s ? ' › ' + esc(r.s) : ''}</b></div>${(r.tg || []).length ? `<div class="kv"><span>Tag</span><b>${r.tg.map(t => '#' + esc(t)).join(' ')}</b></div>` : ''}
    <div class="kv"><span>Akun</span><b>${esc(r.ac)}</b></div><div class="kv"><span>Jenis</span><b>${r.k === 'I' ? 'Pemasukan' : 'Pengeluaran'}</b></div>
    <div class="kv"><span>Waktu</span><b>${DOWL[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()} · ${r.t.slice(11, 16)}</b></div>
    <div class="acts"><button type="button" class="btn-s btn-d" id="dt-del">Hapus</button><button type="button" class="btn-p" id="dt-edit">Edit</button></div></div>`);
  openSheet('Detail transaksi', n);
  n.querySelector('#dt-edit').onclick = () => formSheet(r);
  n.querySelector('#dt-del').onclick = () => deleteRec(id, closeSheet);
}
function bindAmtInput(inp) {   // ketik di desktop: singkatan lengkap langsung jadi angka; "1,5" ditahan mentah sampai rb/jt diketik
  let rawDec = false;
  inp.oninput = e => {
    const v = inp.value.toLowerCase().replace(/\s/g, '');
    if (/^\d+[.,]\d{0,2}$/.test(v) && (rawDec || e.data === ',' || e.data === '.')) { rawDec = true; return; }
    rawDec = false;
    if (AMT_ABBR.test(v)) { inp.value = fmtAmt(parseAmt(v)); return; }
    if (/[a-z]/.test(v)) return;   // singkatan belum lengkap (mis. "25r"), biarkan sampai selesai diketik
    inp.value = fmtAmt(v);
  };
  inp.addEventListener('change', () => { inp.value = fmtAmt(parseAmt(inp.value)); });   // sisa ketikan mentah -> angka biasa
}
/* ---------- Ketik satu baris: "ayam soendari 25k gopay kemarin" -> catatan, nominal, dompet, tanggal ----------
   Yang dikenali hanya dari ujung kalimat (nominal, nama dompet, kalimat tanggal; urutannya bebas); sisanya jadi catatan.
   Awali dengan + untuk pemasukan. Nominal wajib ada; kalau tidak, hasilnya null. */
const DAYN = { minggu: 0, ahad: 0, senin: 1, selasa: 2, rabu: 3, kamis: 4, jumat: 5, "jum'at": 5, sabtu: 6 };
const LN_AMT = /^(rp\.?)?(\d+(?:[.,]\d{1,2})?(?:k|rb|ribu|jt|juta)|\d{1,3}(?:\.\d{3})+|\d{4,})$/;
function parseLine(text, names) {
  const toks = String(text || '').trim().replace(/\s+/g, ' ').split(' ').filter(Boolean);
  if (toks.length < 2) return null;
  let kind = 'E'; if (toks[0][0] === '+') { kind = 'I'; toks[0] = toks[0].slice(1); if (!toks[0]) toks.shift(); }
  const nm = (names || []).map(x => ({ x, k: String(x).trim().toLowerCase() }));
  const alias = w => { const f = nm.filter(o => o.k.split(' ').includes(w)); return w.length >= 3 && f.length === 1 ? f[0].x : (w === 'tunai' ? (nm.find(o => o.k === 'cash') || {}).x : '') || ''; };
  let amt = 0, wal = '', off = null, dom = null, hm = null, step = true;
  while (step && toks.length > 1) {
    step = false;
    const L = toks.map(t => t.toLowerCase()), n = L.length, at = i => L[n - i];
    const take = k => { toks.length -= k; step = true; };
    if (hm === null) {   // jam: "jam 8", "jam 14.30", "jam 8 malam", "tadi pagi", "kemarin malam", "semalam"
      const isP = w => /^(pagi|siang|sore|malam)$/.test(w), PH = { pagi: 8, siang: 12, sore: 16, malam: 20 };
      const hmOf = (hs, per) => { const m = hs.match(/^(\d{1,2})(?:[.:](\d{2}))?$/); if (!m) return null; let h = +m[1]; const mi = +(m[2] || 0); if (per === 'sore' || per === 'malam') { if (h < 12) h += 12; } else if (per === 'siang' && h >= 1 && h <= 6) h += 12; return h > 23 || mi > 59 ? null : [h, mi]; };
      let x;
      if (n >= 4 && at(3) === 'jam' && isP(at(1)) && (x = hmOf(at(2), at(1)))) { hm = x; take(3); continue; }
      if (n >= 3 && at(2) === 'jam' && (x = hmOf(at(1), ''))) { hm = x; take(2); continue; }
      if (n >= 3 && at(1) === 'malam' && at(2) === 'tadi' && off === null && dom === null && new Date().getHours() < 20) { hm = [20, 0]; off = 1; take(2); continue; }
      if (n >= 3 && isP(at(1)) && (at(2) === 'tadi' || at(2) === 'kemarin')) { hm = [PH[at(1)], 0]; take(1); continue; }
      if (at(1) === 'semalam' && off === null && dom === null) { hm = [20, 0]; off = 1; take(1); continue; }
    }
    if (off === null && dom === null) {   // kalimat tanggal
      const two = n >= 2 ? at(2) + ' ' + at(1) : '';
      if (n >= 4 && at(1) === 'lalu' && /^\d{1,3}$/.test(at(3)) && /^(hari|hr)$/.test(at(2))) { off = +at(3); take(3); continue; }
      if (n >= 3 && two === 'hari ini') { off = 0; take(2); continue; }
      if (n >= 3 && (two === 'kemarin lusa' || two === 'kemarin dulu')) { off = 2; take(2); continue; }
      if (n >= 3 && two === 'seminggu lalu') { off = 7; take(2); continue; }
      if (n >= 3 && /^(tgl|tanggal)$/.test(at(2)) && /^\d{1,2}$/.test(at(1)) && +at(1) >= 1 && +at(1) <= 31) { dom = +at(1); take(2); continue; }
      if (at(1) === 'kemarin') { off = 1; take(1); continue; }
      if (at(1) === 'tadi' || at(1) === 'barusan') { off = 0; take(1); continue; }
      if (at(1) in DAYN) { off = (new Date().getDay() - DAYN[at(1)] + 7) % 7; take(n >= 3 && at(2) === 'hari' ? 2 : 1); continue; }
    }
    if (!wal) {   // nama dompet (persis, atau kata pertamanya kalau unik)
      let hit = '';
      for (let k = Math.min(3, n - 1); k >= 1 && !hit; k--) { const ph = L.slice(n - k).join(' '), o = nm.find(o => o.k === ph); if (o) { hit = o.x; wal = hit; take(k); } }
      if (hit) continue;
      const a = alias(at(1)); if (a) { wal = a; take(1); continue; }
    }
    if (!amt) {   // nominal: 25k, 1,5jt, Rp25.000, 25000, atau terpisah "25 rb"
      if (LN_AMT.test(at(1))) { amt = parseAmt(at(1)); take(1); continue; }
      if (n >= 3 && AMT_SUF[at(1)] && /^\d+(?:[.,]\d{1,2})?$/.test(at(2))) { amt = parseAmt(at(2) + at(1)); take(2); continue; }
    }
  }
  if (!amt || !toks.length) return null;
  let date = null, dlabel = '';
  if (off !== null || dom !== null) {
    date = new Date();
    if (dom !== null) { date.setDate(dom); if (date > new Date()) date.setMonth(date.getMonth() - 1); if (date.getDate() !== dom) return null; }
    else date.setDate(date.getDate() - off);
    const t0 = dkey(new Date());
    dlabel = dkey(date) === t0 ? 'hari ini' : off === 1 ? 'kemarin' : DOW[date.getDay()] + ' ' + date.getDate() + '/' + (date.getMonth() + 1);
  }
  return { kind, note: toks.join(' '), a: amt, wal, date, dlabel, hm };
}
const lineWhen = p => { const d = p.date || new Date(), now = new Date(); return dkey(d) + 'T' + p2(p.hm ? p.hm[0] : now.getHours()) + ':' + p2(p.hm ? p.hm[1] : now.getMinutes()); };
const lineSummary = p => (p.kind === 'I' ? '+ ' : '') + p.note + ' · ' + rp(p.a) + (p.wal ? ' · ' + p.wal : '') + (p.dlabel ? ' · ' + p.dlabel : '') + (p.hm ? ' · ' + p2(p.hm[0]) + '.' + p2(p.hm[1]) : '');
const walNames = () => meta.wallets.length ? meta.wallets.map(w => w.name) : [...new Set(recs.map(r => r.ac).filter(Boolean))].slice(0, 12);

/* keypad HP: digit, 000, rb, jt, dan koma untuk desimal (1 , 5 jt = 1.500.000) */
const KP_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', '⌫', 'rb', 'jt', ','], KP_LBL = { '⌫': 'Hapus satu digit', rb: 'Ribu', jt: 'Juta', ',': 'Koma' };
const kpHTML = () => KP_KEYS.map(k => `<button type="button" data-k="${k}"${KP_LBL[k] ? ` aria-label="${KP_LBL[k]}"` : ''}${/^[a-z,]/.test(k) ? ' class="kx"' : ''}>${k}</button>`).join('');
function kpPress(inp, k) {
  const v = inp.value;
  if (/^\d+,\d{0,2}$/.test(v)) {   // sedang menulis desimal, mis. "1,5"
    if (k === '⌫') inp.value = v.slice(0, -1);
    else if (k === 'rb' || k === 'jt') inp.value = fmtAmt(parseAmt(v.replace(/,$/, '') + k));
    else if (/^\d$/.test(k) && /^\d+,\d?$/.test(v)) inp.value = v + k;
    return;
  }
  let d = String(parseAmt(v) || '');
  if (k === ',') { if (d && d.length <= 3) inp.value = d + ','; return; }
  if (k === 'rb' || k === 'jt') { if (d) inp.value = fmtAmt(parseAmt(d + k)); return; }
  d = k === '⌫' ? d.slice(0, -1) : (d + k).replace(/^0+/, '').slice(0, 11);
  inp.value = fmtAmt(d);
}

function formSheet(edit, pre) {
  const useW = meta.wallets.length > 0, hasW = a => meta.wallets.some(w => wkey(w.name) === wkey(a));
  const accs = useW ? meta.wallets.map(w => w.name).concat(edit && edit.ac && !hasW(edit.ac) ? [edit.ac] : []) : [...new Set(recs.map(r => r.ac).concat(['Accounts', 'Cash']))];
  const accOpts = accs.map(a => `<option>${esc(a)}</option>`).join('');
  let nIdx = [];   // indeks catatan pengeluaran: skor = seberapa sering + seberapa baru (setengah nilai tiap 45 hari)
  const buildIdx = () => {
    const now = Date.now(), m = {};
    recs.forEach(r => {
      if (r.k !== 'E' || !r.n) return; const key = cn(r.n).toLowerCase(); if (!key) return;
      const o = m[key] || (m[key] = { key, r, n: 0, s: 0, am: {}, list: [] });   // r = transaksi terbaru untuk catatan ini (recs urut terbaru dulu)
      const w = Math.pow(.5, Math.max(0, now - new Date(r.t)) / 864e5 / 45);
      o.n++; o.s += w; o.am[r.a] = (o.am[r.a] || 0) + w; o.list.push(r.a);
    });
    nIdx = Object.values(m).sort((a, b) => b.s - a.s);
    nIdx.forEach(o => { o.amts = Object.entries(o.am).sort((a, b) => b[1] - a[1]).slice(0, 3).map(x => +x[0]); });   // 3 nominal paling biasa, harga baru lebih berat
  };
  buildIdx();
  const noteHit = v => {   // v huruf kecil. t: 0 = persis, 1 = tiap kata diawali kata di catatan, 2 = cocok di tengah kata
    const toks = v.split(/\s+/).filter(Boolean), out = []; if (!toks.length) return out;
    for (const o of nIdx) {
      if (o.key === v) { out.push({ o, t: 0 }); continue; }
      if (!toks.every(t => o.key.includes(t))) continue;
      const ws = o.key.split(/\s+/);
      out.push({ o, t: toks.every(t => ws.some(w => w.startsWith(t))) ? 1 : 2 });
    }
    return out.sort((a, b) => a.t - b.t || b.o.s - a.o.s);
  };
  let kind = edit ? edit.k : 'E';
  const touch = matchMedia('(hover:none) and (pointer:coarse)').matches;   // HP/tablet: pakai keypad sendiri, bukan keyboard sistem
  const fq = {}; recs.forEach(r => { if (r.k !== 'E' || !r.n) return; const k = cn(r.n).toLowerCase(); if (!k) return; const o = fq[k] || (fq[k] = { n: 0, r }); o.n++; });   // r = catatan terbaru (recs urut terbaru dulu)
  const quick = edit ? [] : Object.values(fq).filter(o => o.n >= 2).sort((a, b) => b.n - a.n).slice(0, 6);
  const n = el(`<form class="form" autocomplete="off">
    ${quick.length ? `<div class="qk" aria-label="Catatan yang sering dipakai">${quick.map((o, i) => `<button type="button" class="qchip" data-i="${i}">${ico(o.r.c, '', o.r.n)}<span>${esc(cn(o.r.n))}</span></button>`).join('')}</div>` : ''}
    <div class="seg"><button type="button" data-k="E" class="exp">Pengeluaran</button><button type="button" data-k="I" class="inc">Pemasukan</button></div>
    <div class="amtbox"><span class="rpx">Rp</span><input class="amt" id="fm-a" inputmode="${touch ? 'none' : 'numeric'}" placeholder="0" aria-label="Nominal (Rp)" value="${edit ? NF.format(edit.a) : ''}" required></div>
    <div class="amwn" id="fm-wn" role="alert" hidden></div>
    <div class="amtq" id="fm-aq" aria-label="Tambah nominal cepat">${[5000, 10000, 20000, 50000].map(v => `<button type="button" data-v="${v}">+${jt(v)}</button>`).join('')}<button type="button" data-v="0" class="clr">Hapus</button></div>
    <div class="kp" id="fm-kp" aria-label="Keypad nominal">${kpHTML()}</div>
    <label>Catatan<input id="fm-n" placeholder="mis. ayam soendari 25k gopay kemarin" value="${esc(edit ? edit.n : '')}" role="combobox" aria-expanded="false" aria-controls="fm-nsl" aria-autocomplete="list" autocapitalize="none"></label>
    <button type="button" class="lnp" id="fm-ln" hidden></button>
    <div class="nsl" id="fm-nsl" role="listbox" aria-label="Saran catatan" hidden></div>
    <div class="nqs" id="fm-nq" aria-label="Nominal yang biasa dipakai" hidden></div>
    <div class="sug" id="fm-sug" hidden></div>
    <div class="cf"><span>Kategori</span><div class="ccs" id="fm-cc"></div><select id="fm-c" hidden></select></div>
    <div class="cf" id="fm-sw" hidden><span>Sub-kategori <em>(opsional)</em></span><div class="ccs" id="fm-sc"></div></div>
    <label id="fm-cn-w" hidden>Nama kategori baru<input id="fm-cn" placeholder="mis. Buku kuliah"></label>
    ${useW ? `<div class="cf"><span id="fm-wl">Dibayar dari</span><div class="ccs" id="fm-wc"></div><small class="hint" id="fm-wh"></small></div><select id="fm-ac" hidden>${accOpts}</select>` : ''}
    ${edit ? '' : `<div class="cf" id="fm-plw" hidden><label class="chk"><input type="checkbox" id="fm-pl"> Bayar pakai ShopeePayLater <small>Dicatat sebagai pengeluaran sekarang. Saldo dompet baru berkurang saat tagihan dibayar.</small></label>
      <div id="fm-plx" hidden><div class="hint plx-h">Nominal di atas = <b>harga belanja</b> (dicatat sebagai pengeluaran).</div>
        <label>Jumlah cicilan <small>(1 = bayar sekali)</small><input id="fm-plk" type="number" inputmode="numeric" min="1" max="60" value="1"></label>
        <div class="ccs plx-q" id="fm-plq">${[1, 3, 6, 12].map(x => `<button type="button" class="cc" data-k="${x}">${x}x</button>`).join('')}</div><label id="fm-plcw" hidden>Cicilan per bulan dari Shopee <small>opsional, untuk memisahkan bunga/admin</small><input class="amt" id="fm-plc" inputmode="numeric" placeholder="mis. 340.000"></label><div class="hint plx-h" id="fm-plp"></div></div></div>`}
    <details class="mored"${edit ? ' open' : ''}><summary>${useW ? 'Waktu &amp; tag' : 'Waktu, akun &amp; tag'}</summary>
    <label>Tag <small>(pisahkan dengan koma)</small><input id="fm-tg" placeholder="mis. darurat, trip" value="${esc(edit ? (edit.tg || []).join(', ') : '')}"></label>
    <label>Waktu<input type="datetime-local" id="fm-t" value="${edit ? edit.t.slice(0, 16) : nowLocal()}" required></label>
    ${useW ? '' : `<label>Akun<select id="fm-ac">${accOpts}</select></label>`}</details>
    <div class="acts">${edit ? '' : '<button type="button" class="btn-s" id="fm-more">Simpan &amp; tambah lagi</button>'}<button type="submit" class="btn-p">${edit ? 'Simpan perubahan' : 'Simpan'}</button></div></form>`);
  const $$ = s => n.querySelector(s);
  if (useW) {   // dompet: chip berwarna, tersinkron dengan <select> tersembunyi
    const acSel = $$('#fm-ac'), vd2 = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
    const wHint = () => {   // jelaskan apakah transaksi ini mengubah saldo dompet
      const h = $$('#fm-wh'), tv = $$('#fm-t'); if (!h) return;
      const w = meta.wallets.find(x => wkey(x.name) === wkey(vd2.get.call(acSel))), t = ((tv && tv.value) || nowLocal()).slice(0, 16) + ':59';
      h.textContent = !w ? '' : kind === 'E' && $$('#fm-pl') && $$('#fm-pl').checked ? 'PayLater: saldo ' + w.name + ' tidak berkurang sampai tagihan dibayar.' : w.auto === false ? 'Dompet manual, saldonya nggak berubah.' : t <= (w.since || '') ? 'Tanggalnya sebelum saldo ' + w.name + ' diisi, jadi nggak ngubah saldo.' : 'Saldo ' + w.name + (kind === 'I' ? ' bertambah.' : ' berkurang.');
    };
    n.addEventListener('input', e => { if (e.target.id === 'fm-t') wHint(); }); n.addEventListener('change', e => { if (e.target.id === 'fm-t') wHint(); });
    const drawAc = () => { wHint(); const cur = vd2.get.call(acSel); $$('#fm-wc').innerHTML = accs.map(a => { const w = meta.wallets.find(x => wkey(x.name) === wkey(a)); return `<button type="button" class="cc wch${a === cur ? ' on' : ''}" data-a="${esc(a)}" style="--c:${w ? w.color : '#8e8e93'}"><i></i>${esc(a)}</button>`; }).join(''); };
    Object.defineProperty(acSel, 'value', { get() { return vd2.get.call(this); }, set(v) { vd2.set.call(this, v); drawAc(); }, configurable: true });
    $$('#fm-wc').onclick = e => { const b = e.target.closest('button'); if (b) acSel.value = b.dataset.a; };
    acSel.value = !edit && meta.lastWal && accs.includes(meta.lastWal) ? meta.lastWal : accs[0];
  }
  /* kategori: hanya yang sesuai jenis (keluar/masuk), 8 teratas (dipakai 4 bulan terakhir) di grup "Sering dipakai", sisanya di "Lainnya" */
  const catsFor = k => {
    const now = Date.now(), all = {}, rec = {};
    recs.forEach(r => { if (r.k !== k) return; all[r.c] = (all[r.c] || 0) + 1; if (now - new Date(r.t) < 120 * 864e5) rec[r.c] = (rec[r.c] || 0) + 1; });
    const ks = Object.keys(all).sort((a, b) => (rec[b] || 0) - (rec[a] || 0) || all[b] - all[a]);
    const base = k === 'E' ? ['Food', 'Transport', 'Hiburan & Game', 'Tagihan & Langganan', 'Belanja', 'Sosial & Hadiah', 'Kesehatan & Pendidikan', 'Other'] : ['Allowance', 'Penghasilan Lain', 'Other'];
    base.forEach(b => { if (!ks.some(x => x.toLowerCase() === b.toLowerCase())) ks.push(b); });
    return ks;
  };
  let allCats = [], showAll = false;
  const sel = $$('#fm-c');
  let subSel = edit ? (edit.s || '') : '', subG = null;
  const subsOf = g => (MMImport.SUBS && MMImport.SUBS[g]) || [];
  const drawSubs = () => {
    const g = sel.value, ss = kind === 'I' ? ((MMImport.SUBS_I || {})[g] || []) : subsOf(g); $$('#fm-sw').hidden = !ss.length;
    $$('#fm-sc').innerHTML = ss.map(x => `<button type="button" class="cc${x === subSel ? ' on' : ''}" data-s="${esc(x)}">${esc(x)}</button>`).join('');
  };
  const setSub = x => { subSel = x || ''; drawSubs(); };
  const drawCats = () => {   // 8 chip teratas + "Lainnya" untuk membuka sisanya, tanpa dropdown layar penuh
    const cur = sel.value, top = allCats.slice(0, 8), rest = allCats.slice(8);
    const vis = showAll ? allCats : top.concat(rest.includes(cur) ? [cur] : []);
    const chip = c => `<button type="button" class="cc${c === cur ? ' on' : ''}" data-c="${esc(c)}">${esc(cat(c))}</button>`;
    $$('#fm-cc').innerHTML = vis.map(chip).join('') + (rest.length ? `<button type="button" class="cc mini" data-more="1">${showAll ? 'Ringkas' : 'Lainnya (' + rest.length + ')'}</button>` : '') + `<button type="button" class="cc mini${cur === '__new' ? ' on' : ''}" data-c="__new">+ Baru</button>`;
    if (cur !== subG) { subG = cur; if (!subsOf(cur).includes(subSel)) subSel = ''; }
    drawSubs();
  };
  const vd = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');   // chip ikut berubah setiap kategori diisi lewat kode
  Object.defineProperty(sel, 'value', { get() { return vd.get.call(this); }, set(v) { vd.set.call(this, v); drawCats(); }, configurable: true });
  const fillCats = keep => {
    const ks = catsFor(kind); if (keep && !ks.includes(keep)) ks.push(keep);
    allCats = ks; showAll = false;
    sel.innerHTML = ks.map(c => `<option value="${esc(c)}">${esc(cat(c))}</option>`).join('') + '<option value="__new">Kategori baru…</option>';
    sel.value = keep || ks[0]; $$('#fm-cn-w').hidden = true;
  };
  const plPrev = () => { const pv = $$('#fm-plp'); if (!pv) return; const o = ($$('#fm-t').value || '').slice(0, 10), k = Math.min(60, Math.max(1, Math.round(+$$('#fm-plk').value) || 1)); const cw = $$('#fm-plcw'); if (cw) cw.hidden = k < 2; if (!/^\d{4}-\d{2}-\d{2}$/.test(o)) { pv.textContent = ''; return; }
    const d0 = plDue({ o, k }, 0), d1 = plDue({ o, k }, k - 1), pr = parseAmt(($$('#fm-a') || {}).value); pv.textContent = 'Tenggat pertama ' + plDM(d0) + ' ' + d0.slice(0, 4) + (k > 1 ? ', terakhir ' + plDM(d1) + ' ' + d1.slice(0, 4) + (pr ? ' · pokok per cicilan ' + rp(Math.floor(pr / k)) : '') : ''); };
  const plSync = () => { const w = $$('#fm-plw'); if (!w) return; w.hidden = kind !== 'E'; if (w.hidden) $$('#fm-pl').checked = false; const on = $$('#fm-pl').checked; $$('#fm-plx').hidden = !on; const ok = n.querySelector('.btn-p'); if (ok) ok.textContent = on ? 'Simpan paylater' : 'Simpan'; plPrev(); const th = $$('#fm-t'); if (th) th.dispatchEvent(new Event('input', { bubbles: true })); };
  const setKind = k => { kind = k; plSync(); if (useW) { const sv = $$('#fm-ac'); sv.value = sv.value; } const wl = $$('#fm-wl'); if (wl) wl.textContent = k === 'I' ? 'Masuk ke' : 'Dibayar dari'; n.querySelectorAll('.seg button').forEach(b => b.classList.toggle('on', b.dataset.k === k)); fillCats(edit && edit.k === k ? edit.c : null); };
  setKind(kind);
  n.querySelectorAll('.seg button').forEach(b => b.onclick = () => setKind(b.dataset.k));
  if ($$('#fm-pl')) {
    $$('#fm-pl').onchange = () => { if ($$('#fm-pl').checked) { const sp = [...$$('#fm-ac').options].find(o => /shopee/i.test(o.value)); if (sp) $$('#fm-ac').value = sp.value; } plSync(); if ($$('#fm-pl').checked) requestAnimationFrame(() => $$('#fm-plx').scrollIntoView({ block: 'nearest', behavior: 'smooth' })); };   // bagian cicilan jangan tertutup bar Simpan
    $$('#fm-plq').onclick = e => { const b = e.target.closest('button'); if (!b) return; $$('#fm-plk').value = b.dataset.k; plPrev(); };
    $$('#fm-plk').addEventListener('input', plPrev); $$('#fm-t').addEventListener('input', plPrev); $$('#fm-a').addEventListener('input', plPrev); bindAmtInput($$('#fm-plc'));
  }
  if (edit) { $$('#fm-c').value = edit.c; if ($$('#fm-c').value !== edit.c) { $$('#fm-c').value = '__new'; $$('#fm-cn-w').hidden = false; $$('#fm-cn').value = edit.c; } $$('#fm-ac').value = edit.ac; }
  const applyNote = (m, force) => {   // isi kategori, sub, tag, dompet, dan nominal terakhir dari catatan lama
    if (kind !== 'E' || force) setKind('E');
    $$('#fm-n').value = cn(m.n); if (force || !$$('#fm-a').value) $$('#fm-a').value = NF.format(m.a);
    if ([...$$('#fm-c').options].some(o => o.value === m.c)) { $$('#fm-c').value = m.c; $$('#fm-cn-w').hidden = true; setSub(m.s); }
    if (force || !$$('#fm-tg').value) $$('#fm-tg').value = (m.tg || []).join(', ');
    if ([...$$('#fm-ac').options].some(o => o.value === m.ac)) $$('#fm-ac').value = m.ac;
    drawNq();
  };
  n.querySelectorAll('.qchip').forEach(b => b.onclick = () => {   // isi semua dari catatan terbaru, tinggal cek lalu Simpan
    applyNote(quick[+b.dataset.i].r, true);
    n.querySelectorAll('.qchip').forEach(x => x.classList.toggle('on', x === b)); n.querySelector('.btn-p').focus();
  });
  bindAmtInput($$('#fm-a'));
  $$('#fm-kp').onclick = e => { const b = e.target.closest('button'); if (b) kpPress($$('#fm-a'), b.dataset.k); };
  $$('#fm-aq').onclick = e => { const b = e.target.closest('button'); if (!b) return; const v = +b.dataset.v, a = parseAmt($$('#fm-a').value); $$('#fm-a').value = v ? NF.format(a + v) : ''; $$('#fm-a').focus(); };
  const showSug = (c, sb, why) => { const x = $$('#fm-sug'); if (!c) { x.hidden = true; return; } x.hidden = false; x.innerHTML = `<b>✦</b> <span>${esc(cat(c))}${sb ? ' › ' + esc(sb) : ''}</span><small>dari ${why}</small>`; };
  let touched = false;   // sudah dipilih manual -> jangan ditimpa saran
  $$('#fm-cc').onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.more) { showAll = !showAll; drawCats(); return; }
    touched = true; showSug(''); sel.value = b.dataset.c; $$('#fm-cn-w').hidden = b.dataset.c !== '__new'; if (b.dataset.c === '__new') $$('#fm-cn').focus();
  };
  $$('#fm-sc').onclick = e => { const b = e.target.closest('button'); if (b) { touched = true; setSub(subSel === b.dataset.s ? '' : b.dataset.s); } };
  $$('#fm-c').addEventListener('change', () => { touched = true; });
  $$('#fm-c').onchange = e => { $$('#fm-cn-w').hidden = e.target.value !== '__new'; };
  const ni = $$('#fm-n'), nsl = $$('#fm-nsl'); let hits = [], hi = -1;
  const amtLbl = v => ((v < 1e6 ? v % 1e3 === 0 : v % 1e5 === 0) ? jt(v) : NF.format(v));   // 18rb / 1,5jt, tapi 18.500 tetap utuh
  const nq = $$('#fm-nq');
  const drawNq = () => {   // chip nominal: 2-3 harga yang biasa dipakai untuk catatan ini (mis. Kopi: 18rb, 22rb)
    const x = (!edit && kind === 'E') ? nIdx.find(o => o.key === cn(ni.value).trim().toLowerCase()) : null;
    if (!x || x.amts.length < 2) { nq.hidden = true; nq.innerHTML = ''; return; }
    const cur = parseAmt($$('#fm-a').value);
    nq.innerHTML = '<span>Biasanya</span>' + x.amts.map(v => `<button type="button" data-v="${v}"${v === cur ? ' class="on"' : ''}>${amtLbl(v)}</button>`).join('');
    nq.hidden = false;
  };
  nq.onclick = e => { const b = e.target.closest('button'); if (!b) return; $$('#fm-a').value = NF.format(+b.dataset.v); drawNq(); n.querySelector('.btn-p').focus(); };
  const hideNsl = () => { nsl.hidden = true; ni.setAttribute('aria-expanded', 'false'); hi = -1; };
  const drawNsl = () => {   // daftar saran: cocok sampai ke tengah kata, urut sering + baru, tiap baris ada ikon & nominal terakhir
    const v = ni.value.trim().toLowerCase();
    hits = (edit || kind !== 'E' || !v) ? [] : noteHit(v).slice(0, 5);
    if (!hits.length) { hideNsl(); return; }
    nsl.innerHTML = hits.map((x, i) => `<button type="button" role="option" class="nrow${i === hi ? ' on' : ''}" data-i="${i}">${ico(x.o.r.c, '', x.o.r.n)}<span class="nn">${esc(cn(x.o.r.n))}</span><small>${rp(x.o.r.a)}</small></button>`).join('');
    nsl.hidden = false; ni.setAttribute('aria-expanded', 'true');
  };
  const pickNote = i => {
    const x = hits[i]; if (!x) return;
    applyNote(x.o.r, false); hideNsl(); showSug('');
    (parseAmt($$('#fm-a').value) ? n.querySelector('.btn-p') : $$('#fm-a')).focus();
  };
  nsl.addEventListener('mousedown', e => e.preventDefault());   // jangan lepas fokus dari kolom Catatan sebelum ketukan terbaca
  nsl.onclick = e => { const b = e.target.closest('.nrow'); if (b) pickNote(+b.dataset.i); };
  ni.onblur = () => setTimeout(hideNsl, 200);
  const lnp = $$('#fm-ln');
  const curLine = () => edit ? null : parseLine(ni.value, accs);
  const drawLn = () => { const p = curLine(); if (!p) { lnp.hidden = true; return; } lnp.hidden = false; lnp.innerHTML = `<b>✦</b><span>${esc(lineSummary(p))}</span><em>Terapkan ↵</em>`; };
  const applyLine = () => {   // pecah satu baris ke catatan, nominal, dompet, dan tanggal
    const p = curLine(); if (!p) return false;
    if (p.kind === 'I' && kind !== 'I') setKind('I');
    ni.value = p.note; ni.dispatchEvent(new Event('input', { bubbles: true }));
    if (kind === 'E') ni.onchange({ target: ni });   // catatan lama persis -> isi kategori; nominal & dompet ditimpa di bawah
    $$('#fm-a').value = NF.format(p.a);
    if (p.wal && [...$$('#fm-ac').options].some(o => o.value === p.wal)) $$('#fm-ac').value = p.wal;
    if (p.date || p.hm) { const t = $$('#fm-t'); t.value = lineWhen(p); t.dispatchEvent(new Event('input', { bubbles: true })); }
    hideNsl(); hideWn(); drawNq(); lnp.hidden = true; n.querySelector('.btn-p').focus();
    return true;
  };
  lnp.onclick = applyLine; ni.addEventListener('input', drawLn);
  ni.onkeydown = e => {
    if (e.key === 'Enter' && hi < 0 && curLine()) { e.preventDefault(); applyLine(); return; }
    if (nsl.hidden) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); hi = (hi + (e.key === 'ArrowDown' ? 1 : -1) + hits.length) % hits.length; drawNsl(); }
    else if (e.key === 'Enter' && hi >= 0) { e.preventDefault(); pickNote(hi); }
    else if (e.key === 'Escape') { e.stopPropagation(); hideNsl(); }
  };
  ni.oninput = e => {   /* saran kategori saat mengetik: catatan lama (awal kata) -> aturan kategori */
    hi = -1; drawNsl(); drawNq();
    if (edit || touched || kind !== 'E') return;
    const v = e.target.value.trim().toLowerCase(); if (v.length < 2) return;
    const top = noteHit(v).find(x => x.t <= 1), m = top ? top.o.r : null;
    let c = m ? m.c : '', sb = m ? m.s : '', why = 'catatan serupa';
    if (!c) { const cl = MMImport.classify('E', v, ''); c = cl.c === 'Other' ? '' : cl.c; sb = cl.s; why = 'aturan otomatis'; }
    if (c && [...$$('#fm-c').options].some(o => o.value === c)) { $$('#fm-c').value = c; setSub(sb); showSug(c, sb, why); } else showSug('');
  };
  ni.onchange = e => {   /* catatan persis seperti yang pernah dipakai -> isi kategori & nominal terakhir */
    const x = nIdx.find(o => o.key === cn(e.target.value).trim().toLowerCase());
    if (x && !edit) applyNote(x.r, false);
  };
  /* peringatan nominal janggal: >= 8x median nominal lama untuk catatan yang sama (minimal 3 riwayat), mis. salah tambah nol */
  const wn = $$('#fm-wn'); let okAmt = 0;
  const hideWn = () => { wn.hidden = true; wn.innerHTML = ''; };
  const oddMedian = (note, a) => {
    const x = nIdx.find(o => o.key === cn(note).trim().toLowerCase());
    if (!x || x.n < 3 || x.list.includes(a)) return 0;
    const l = x.list.slice().sort((p, q) => p - q), h = l.length >> 1, med = Math.round(l.length % 2 ? l[h] : (l[h - 1] + l[h]) / 2);
    return med > 0 && a >= med * 8 ? med : 0;
  };
  const showWn = (a, med, more) => {
    wn.innerHTML = `<span>Nominal ${esc(amtLbl(a))} sekitar ${Math.round(a / med)}× biasanya untuk ${esc(cn(ni.value))} (±${esc(amtLbl(med))}). Salah nol?</span><div><button type="button" data-w="fix">Jadi ${esc(amtLbl(med))}</button><button type="button" data-w="ok">Memang benar</button></div>`;
    wn.hidden = false; wn.onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.w === 'fix') { $$('#fm-a').value = NF.format(med); hideWn(); drawNq(); n.querySelector('.btn-p').focus(); }
      else { okAmt = a; hideWn(); submit(more); }
    };
    wn.scrollIntoView({ block: 'nearest' });
  };
  ['#fm-kp', '#fm-aq', '#fm-nq'].forEach(q => $$(q).addEventListener('click', hideWn)); $$('#fm-a').addEventListener('input', hideWn); ni.addEventListener('input', hideWn);
  let dupOK = false, tEdited = false;
  $$('#fm-t').addEventListener('input', () => { tEdited = true; });   // waktu diubah manual -> dibawa ke catatan berikutnya
  const resetForNext = () => {   // "Simpan & tambah lagi": form tetap terbuka; hanya catatan, nominal, dan tag yang dikosongkan
    buildIdx(); hideNsl(); showSug(''); lnp.hidden = true; touched = false; dupOK = false; nq.hidden = true; hideWn(); okAmt = 0;
    ni.value = ''; $$('#fm-a').value = ''; $$('#fm-tg').value = '';
    if (!tEdited) { const t = $$('#fm-t'); t.value = nowLocal(); t.dispatchEvent(new Event('input', { bubbles: true })); tEdited = false; }
    n.querySelectorAll('.qchip').forEach(x => x.classList.remove('on'));
    ni.focus();
  };
  const submit = more => {
    const a = parseAmt($$('#fm-a').value); if (!a) { $$('#fm-a').focus(); toast('Isi nominalnya dulu'); return; }
    const plOn = !edit && kind === 'E' && !!$$('#fm-pl') && $$('#fm-pl').checked;   // ShopeePayLater: pengeluaran dicatat sekarang + tagihan tertaut (saldo belum berkurang)
    if (!edit && kind === 'E' && a !== okAmt) { const med = oddMedian($$('#fm-n').value, a); if (med) { showWn(a, med, more); return; } }
    let c = $$('#fm-c').value; if (c === '__new') c = $$('#fm-cn').value.trim() || 'Other';
    const t = ($$('#fm-t').value || nowLocal()).slice(0, 16) + ':' + (edit ? edit.t.slice(17, 19) || '00' : p2(new Date().getSeconds()));
    const tg = [...new Set($$('#fm-tg').value.split(',').map(x => x.replace(/^\s*#/, '').trim().replace(/\s+/g, '-').toLowerCase()).filter(Boolean))];
    const r = { t, k: kind, c, s: c === '__new' ? '' : subSel, tg, n: $$('#fm-n').value.trim(), a, ac: $$('#fm-ac').value };
    if (!edit && kind === 'E' && !dupOK && /top\s?-?up|isi saldo/i.test(r.n)) {   // peringatan: top-up yang sudah tercatat sebagai Transfer
      const day = t.slice(0, 10), dup = meta.xfers.find(x => x.t.slice(0, 10) === day && x.a === a && (meta.wallets.find(w => w.id === x.f) || {}).name === r.ac);
      if (dup) { dupOK = true; toast('Transfer yang sama udah ada hari ini. Ketuk Simpan lagi kalau memang beda.'); return; }
    }
    const snap = recs.slice(), ps = plSnap(), plk = n.querySelector('form').dataset.pl;
    const lk = edit ? plRes().by.get(edit.id) : null;
    if (lk && plItemPaid(lk.item)) { toast(PL_BLOCK); return; }
    const why = plOn ? 'Sebelum belanja PayLater baru' : lk ? 'Sebelum mengubah transaksi tertaut PayLater' : plk ? 'Sebelum pembayaran cicilan PayLater lama' : '';
    if (why && !autoBackup(why, { kind: plOn ? 'beli' : plk ? 'bayar' : 'ubah' })) { toast(ABK_FAIL); return; }
    let plItem = null;
    const done = commit(() => {   // atomik: gagal simpan = tidak ada yang berubah
      meta.lastWal = r.ac; plItem = null;
      if (lk) PL.dropRecord(plGet(), recs, edit);   // transaksi tertaut ikut diedit: tautannya dipindah ke versi baru (sebelum yang lama dibuang)
      if (edit) recs = recs.filter(x => x.id !== edit.id);
      const ab = addBatch([r], { skipDup: false }); // catatan manual tidak dianggap duplikat
      if (lk) { const nr = recs.find(x => x.id === ab.ids[0]); lk.item.src.push(PL.srcOf(recs, nr)); plSyncItem(lk.item, nr); }
      if (plOn) {
        const nr = recs.find(x => x.id === ab.ids[0]), k = Math.min(60, Math.max(1, Math.round(+$$('#fm-plk').value) || 1)), ci = parseAmt(($$('#fm-plc') || {}).value);
        plItem = { id: 'pl' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), n: (cn(nr.n) || 'Belanja paylater').slice(0, 40), a: k > 1 ? (ci || Math.round(a / k)) : a, k, o: nr.t.slice(0, 10), c: nr.c, w: nr.ac, d: {}, ex: true, src: [PL.srcOf(recs, nr)] };
        if (k > 1) plItem.pr = a; plGet().push(plItem);
      }
      if (plk) plMark(plk, r.t.slice(0, 10));
    });
    if (!done) return;
    if (plk) delete n.querySelector('form').dataset.pl;   // kunci dibersihkan: catatan berikutnya (Simpan & tambah lagi) tidak ikut menandai cicilan ini
    toast((edit ? 'Perubahan disimpan' : (kind === 'I' ? 'Pemasukan dicatat ' : 'Pengeluaran dicatat ') + rp(a) + (plItem ? ' · masuk tagihan PayLater, tenggat ' + plDM(plDue(plItem, 0)) : '') + budgetWarn(r)), () => { if (commit(() => { recs = snap; plUnsnap(ps); if (plk) plUnmark(plk); })) toast('Dibatalkan'); });
    if (more) resetForNext(); else closeSheet();
  };
  n.querySelector('form').onsubmit = e => { e.preventDefault(); submit(false); };
  const mo = $$('#fm-more'); if (mo) mo.onclick = () => submit(true);
  if (pre && !edit) { ni.value = pre; if (!applyLine()) ni.dispatchEvent(new Event('input', { bubbles: true })); }
  openSheet(edit ? 'Edit transaksi' : 'Catat transaksi', n, !edit);
  if (!edit && !touch) setTimeout(() => $$('#fm-a').focus(), 60);
}

function budgetSheet() {
  const n = el(`<form class="form"><label>Budget pengeluaran per bulan (Rp)<input class="amt" id="bg" inputmode="numeric" value="${meta.budget ? NF.format(meta.budget) : ''}" placeholder="mis. 5.000.000"></label>
    <div class="acts"><button type="button" class="btn-s" id="bg-off">Matikan</button><button type="submit" class="btn-p">Simpan</button></div></form>`);
  n.querySelector('#bg').oninput = e => { e.target.value = fmtAmt(e.target.value); };
  n.querySelector('form').onsubmit = e => { e.preventDefault(); meta.budget = +(n.querySelector('#bg').value.replace(/\D/g, '')) || 0; save(); closeSheet(); dirtyAll(); refresh(); toast('Budget disimpan'); };
  n.querySelector('#bg-off').onclick = () => { meta.budget = 0; save(); closeSheet(); dirtyAll(); refresh(); };
  openSheet('Budget bulanan', n); setTimeout(() => n.querySelector('#bg').focus(), 60);
}

/* ---------- impor / backup ---------- */
function pickFile(accept, handler) {
  const i = document.createElement('input'); i.type = 'file'; i.accept = accept; i.style.display = 'none';
  i.onchange = () => { if (i.files[0]) handler(i.files[0]); i.remove(); };
  document.body.appendChild(i); i.click();
}
const loadXLSX = () => window.XLSX ? Promise.resolve() : new Promise((ok, no) => {
  const s = document.createElement('script'); s.src = XLSX_URL; if (XLSX_SRI) { s.integrity = XLSX_SRI; s.crossOrigin = 'anonymous'; s.referrerPolicy = 'no-referrer'; } s.onload = ok; s.onerror = () => no(new Error('Pustaka xlsx gagal dimuat (butuh internet). Simpan file sebagai .csv lalu impor lagi.')); document.head.appendChild(s);
});
async function importMM(file) {
  try {
    toast('Membaca ' + file.name + '…');
    let rows;
    if (/\.csv$/i.test(file.name)) rows = MMImport.parseCSV(await file.text());
    else { await loadXLSX(); const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' }); rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { raw: true, defval: '' }); }
    const res = MMImport.rowsToRecords(rows);
    if (!res.ok) throw new Error('Kolom Date, Income/Expense, dan IDR/Amount tidak ditemukan. Pastikan ini file ekspor Money Manager.');
    previewMerge(res.recs, 'Impor Money Manager', res.skipped);
  } catch (e) { toast(e.message || 'Gagal membaca file'); }
}
function previewMerge(all, title, skipped, startYM = meta.start, onApply = null, restore = false, extra = '') {
  const cutoff = startYM + '-01';
  const kept = all.filter(r => r.t.slice(0, 10) >= cutoff), before = all.length - kept.length;
  const { fresh, dup } = dryRun(kept);
  const sum = k => fresh.filter(r => r.k === k).reduce((s, r) => s + r.a, 0);
  const ds = fresh.map(r => r.t).sort();
  const sk = skipped ? skipped.transfer + skipped.invalid + skipped.currency : 0;
  const n = el(`<div><div class="sum-list">
    <div class="kv"><span>Baris terbaca</span><b>${NF.format(all.length)}</b></div>
    <div class="kv"><span>${startYM === '2000-01' ? 'Sebelum 2000' : 'Sebelum ' + mLabel(startYM)} (dilewati)</span><b>${NF.format(before)}</b></div>
    <div class="kv"><span>Sudah ada (duplikat)</span><b>${NF.format(dup)}</b></div>
    ${sk ? `<div class="kv"><span>Bukan pemasukan/pengeluaran atau tidak valid</span><b>${NF.format(sk)}</b></div>` : ''}
    <div class="kv"><span>Akan ditambahkan</span><b>${NF.format(fresh.length)}</b></div>
    ${onApply ? '<div class="kv"><span>Budget, dompet, target &amp; rencana</span><b>Ikut dipulihkan</b></div>' : ''}${extra}
    ${fresh.length ? `<div class="kv"><span>Rentang</span><b>${ds[0].slice(0, 10)} → ${ds[ds.length - 1].slice(0, 10)}</b></div><div class="kv"><span>Pengeluaran baru</span><b>${rp(sum('E'))}</b></div><div class="kv"><span>Pemasukan baru</span><b>${rp(sum('I'))}</b></div>` : ''}
    </div>${restore ? '<div class="hint"><b>Gabungkan</b> hanya menambah transaksi baru. <b>Ganti semua</b> menghapus transaksi sekarang dan menggantinya persis dengan isi backup.</div>' : ''}<div class="form"><div class="acts pv-acts"><button type="button" class="btn-s" id="pv-no">Batal</button>${restore ? '<button type="button" class="btn-s btn-d" id="pv-rep">Ganti semua</button>' : ''}<button type="button" class="btn-p" id="pv-ok" ${fresh.length || onApply ? '' : 'disabled'}>Gabungkan</button></div></div></div>`);
  openSheet(title, n);
  n.querySelector('#pv-no').onclick = closeSheet;
  const doUndo = (rs, ms) => () => {
    if (commit(() => { recs = rs; Object.keys(meta).forEach(k => delete meta[k]); Object.assign(meta, JSON.parse(ms)); if (typeof MMImport !== 'undefined' && MMImport.setRules) MMImport.setRules(meta.rules || []); })) toast('Restore dibatalkan: semua kembali seperti sebelumnya');
  };
  const repBtn = n.querySelector('#pv-rep');
  if (repBtn) repBtn.onclick = () => confirmBtn(repBtn, 'Yakin ganti semua?', () => {
    if (!autoBackup('Sebelum restore backup (ganti semua)', { kind: 'restore' })) { toast(ABK_FAIL); return; }
    const rs = recs.slice(), ms = JSON.stringify(meta);
    let r = null;
    if (!commit(() => { recs = []; if (onApply) onApply(); r = addBatch(kept, { skipDup: false }); })) return;
    closeSheet();
    toast('Data diganti: ' + r.added + ' transaksi dipulihkan' + (onApply ? ' · rencana dipulihkan' : ''), doUndo(rs, ms));
  });
  n.querySelector('#pv-ok').onclick = () => {
    if (!restore) { let r = null; if (!commit(() => { if (onApply) onApply(); r = addBatch(fresh); })) return; closeSheet(); toast(r.added + ' transaksi ditambahkan'); return; }
    if (!autoBackup('Sebelum restore backup', { kind: 'restore' })) { toast(ABK_FAIL); return; }
    const rs = recs.slice(), ms = JSON.stringify(meta);   // snapshot untuk Batalkan: seluruh data yang bisa terdampak restore
    let r = null;
    if (!commit(() => { if (onApply) onApply(); r = addBatch(fresh); })) return;   // gagal simpan: tidak ada yang berubah, tidak ada toast sukses
    closeSheet();
    toast(r.added + ' transaksi ditambahkan' + (onApply ? ' · rencana dipulihkan' : ''), doUndo(rs, ms));
  };
}
function restoreBackup(file) {
  file.text().then(t => {
    const j = JSON.parse(t), v = j && !Array.isArray(j) && typeof j.v === 'number' ? j.v : 0;   // array / tanpa v = format lama
    if (v > BACKUP_V) { toast('Backup ini dibuat aplikasi yang lebih baru (versi ' + v + '). Perbarui aplikasi dulu. Tidak ada data yang diubah.'); return; }
    const arr = Array.isArray(j) ? j : (v >= 4 ? (j.data && j.data.records) : j.records);
    if (!Array.isArray(arr)) throw 0;
    if (v < 5 && j.plan && plHasRecon(j.plan.plRecon)) { toast('Backup ditolak: file versi ' + (v || 'lama') + ' memuat data rekonsiliasi SPayLater (file diubah atau rusak). Tidak ada data yang diubah.'); return; }
    if (j.plan && Array.isArray(j.plan.plPays)) {   // pembayaran multi-dompet: hanya sah di v4 dan harus konsisten; tidak ada perbaikan diam-diam
      const rep = MDSanitize.cleanPaysReport(j.plan.plPays);
      if (v < 4 && j.plan.plPays.some(y => y && y.src !== undefined)) { toast('Backup ditolak: file versi ' + (v || 'lama') + ' memuat sumber dana pembayaran ganda (file diubah atau rusak). Tidak ada data yang diubah.'); return; }
      if (rep.bad.length) { toast('Backup ditolak: ' + rep.bad.length + ' pembayaran PayLater punya sumber dana tidak valid (' + rep.bad[0].why + '). Tidak ada data yang diubah.'); return; }
    }
    let plrest = null;   // laporan integritas PayLater isi backup: hanya BLOK yang menolak; sisanya dijelaskan di pratinjau dan butuh konfirmasi
    if (j.plan && !Array.isArray(j) && Array.isArray(j.plan.pl)) {
      const rawL = j.plan.pl, lst = rawL.map(plClean).filter(Boolean), rp0 = MDSanitize.cleanPaysReport(Array.isArray(j.plan.plPays) ? j.plan.plPays : []);
      plrest = plDataReport(rp0, lst, rawL, arr.filter(r => r && typeof r === 'object'));
      if (plrest.hasBlock) { toast('Backup ditolak: ' + plrest.block.length + ' pembayaran PayLater punya alokasi lebih besar dari pokoknya (' + esc(String(plrest.block[0].id)) + '). Tidak ada data yang diubah.'); return; }
    }
    const applyPlan = (j.plan && !Array.isArray(j)) ? () => { meta.budget = MDSanitize.cleanBudget(j.plan.budget); meta.cats = MDSanitize.cleanCats(j.plan.cats, cn); meta.goals = Array.isArray(j.plan.goals) ? j.plan.goals.map(goalClean).filter(Boolean) : []; if (typeof j.plan.name === 'string' && j.plan.name.trim()) meta.name = j.plan.name.trim().slice(0, 20); if (Array.isArray(j.plan.wallets)) { meta.wallets = j.plan.wallets.filter(w => w && w.id && w.name); meta.xfers = Array.isArray(j.plan.xfers) ? j.plan.xfers.filter(x => x && x.id && x.a > 0) : []; migrateWal(); } if (Array.isArray(j.plan.pl)) { meta.pl = j.plan.pl.map(plClean).filter(Boolean); meta.plPays = MDSanitize.cleanPays(j.plan.plPays); { const rc = MDSanitize.cleanPlRecon(j.plan.plRecon); if (Object.keys(rc).length) meta.plRecon = rc; else delete meta.plRecon; } } /* tagihan dan pembayaran diganti sebagai satu kesatuan */ if (Array.isArray(j.plan.recur)) meta.recur = j.plan.recur.filter(x => x && x.id && x.n && x.a > 0).map(x => ({ id: String(x.id), n: String(x.n).slice(0, 40), a: +x.a, c: String(x.c || '') })); if (j.plan.sim && Array.isArray(j.plan.sim.items)) meta.sim = { items: j.plan.sim.items.filter(x => x && x.id && x.a > 0).map(x => ({ id: String(x.id), n: String(x.n || 'Rencana').slice(0, 40), a: +x.a, c: String(x.c || ''), w: String(x.w || ''), k: x.k === 'I' ? 'I' : 'E' })), sub: j.plan.sim.sub === 0 ? 0 : 1, base: +j.plan.sim.base || 0, ahead: j.plan.sim.ahead ? 1 : 0 };
    if (Array.isArray(j.plan.rules)) { meta.rules = MDSanitize.cleanRules(j.plan.rules); MMImport.setRules(meta.rules); }
    if (j.plan.bankAdmin && typeof j.plan.bankAdmin === 'object') meta.bankAdmin = j.plan.bankAdmin; else delete meta.bankAdmin; } : null;   // baru dijalankan saat Gabungkan ditekan, bukan saat file dibuka
    const ok = arr.filter(r => r && /^\d{4}-\d{2}-\d{2}T/.test(r.t) && (r.k === 'E' || r.k === 'I') && r.a > 0).map(r => ({ t: r.t.slice(0, 19), k: r.k, a: Math.round(r.a), c: r.c || 'Other', s: r.s || '', tg: Array.isArray(r.tg) ? r.tg : [], n: r.n || '', ac: r.ac || 'Accounts' }));
    const hasPl = j.plan && Array.isArray(j.plan.pl), bp = hasPl ? j.plan.pl.length : 0, bq = hasPl && Array.isArray(j.plan.plPays) ? j.plan.plPays.length : 0, np = plGet().length, nq = (meta.plPays || []).length;
    let extra = hasPl && (np || nq || bp || bq) ? `<div class="hint hot">Tagihan dan pembayaran PayLater di aplikasi ini akan <b>diganti</b> oleh isi backup (sekarang ${np} tagihan, ${nq} pembayaran → backup ${bp} tagihan, ${bq} pembayaran). Cadangan otomatis dibuat dulu, dan restore ini bisa dibatalkan.</div>` : '';
    if (plrest && plrest.hasAny) extra += `<div class="hint hot">${plReportHtml(plrest, true)}</div>`;
    previewMerge(ok, 'Pulihkan backup', null, '2000-01', applyPlan, true, extra); // backup tidak dipotong batas impor
  }).catch(() => toast('File backup nggak kebaca'));
}

/* ===== Cadangan otomatis (md_autobak): lihat, unduh sebagai backup biasa, atau pulihkan ===== */
function backupFromRaw(raw) {
  const j = JSON.parse(raw), m = j.meta || {}, rr = Array.isArray(j.recs) ? j.recs : [];
  return JSON.stringify(backupDoc({ name: m.name || '', budget: m.budget, cats: m.cats, goals: m.goals, rules: m.rules, wallets: m.wallets, xfers: m.xfers, sim: m.sim, recur: m.recur, pl: m.pl, plPays: m.plPays, plRecon: m.plRecon, bankAdmin: m.bankAdmin }, rr.map(({ id, ...r }) => r)));
}
function abkSheet() {
  const L = abkList(), n = el(`<div class="form"><div class="hint">Salinan otomatis di perangkat ini, dibuat sebelum migrasi, tautan massal, pembayaran, dan restore. Maksimal 3; cadangan migrasi dikunci. Ini bukan pengganti backup ke berkas: kalau data situs dihapus, cadangan ini ikut hilang.</div>
    ${L.map((x, i) => `<div class="kv"><span>${esc(x.t.replace('T', ' '))} · ${NF.format(x.n)} transaksi<small>${esc(x.why)}</small></span><b><button type="button" class="btn-s abk-dl" data-i="${i}">Unduh</button> <button type="button" class="btn-s btn-d abk-rs" data-i="${i}">Pulihkan</button></b></div>`).join('') || '<div class="empty">Belum ada cadangan otomatis.</div>'}</div>`);
  n.onclick = e => {
    const d = e.target.closest('.abk-dl'), r = e.target.closest('.abk-rs'); if (!d && !r) return;
    const x = L[+(d || r).dataset.i]; if (!x) return;
    if (d) { download('money-diary-cadangan-otomatis-' + x.t.replace('T', '-').replace(':', '') + '.json', backupFromRaw(x.raw), 'application/json'); toast('Cadangan diunduh'); return; }
    confirmBtn(r, 'Yakin? Ketuk lagi', () => { const raw = x.raw; autoBackup('Sebelum memulihkan cadangan otomatis', { kind: 'abk' }); try { localStorage.setItem(LS, raw); } catch (er) { toast('Gagal memulihkan (penyimpanan penuh)'); return; } location.reload(); });
  };
  openSheet('Cadangan otomatis', n);
}
function download(name, text, type) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const BACKUP_V = 5;   // versi tertinggi yang dipahami aplikasi ini
/* v3: format yang masih terbaca versi lama. v4: hanya bila ada pembayaran PayLater dari beberapa dompet.
   v4 SENGAJA tidak punya array records di tingkat atas (transaksi ada di data.records): importer versi lama hanya menerima file berupa array atau yang punya
   records berupa array, dan tidak memeriksa v. File v4 ditolak mereka ("File backup nggak kebaca") dan tidak pernah diimpor tanpa sumber dana pembayaran. */
function backupDoc(plan, rr) {
  const rc = plHasRecon(plan.plRecon); if (!rc && 'plRecon' in plan) { plan = { ...plan }; delete plan.plRecon; }   // plRecon kosong: tidak ikut (backup tanpa rekonsiliasi tetap v3/v4 persis seperti dulu)
  const multi = (plan.plPays || []).some(y => y && Array.isArray(y.src) && y.src.length > 1), exported = new Date().toISOString();
  /* v5: hanya bila ada data rekonsiliasi (plRecon). Bentuk seperti v4 (tanpa records di tingkat atas) sehingga importer lama menolaknya; polish6-rev2 menolaknya lewat nomor versi. */
  if (rc) return { app: 'money-diary', v: 5, needs: (multi ? ['plPays.src'] : []).concat(['plRecon']), catatan: 'Backup versi 5: berisi data rekonsiliasi SPayLater (plRecon)' + (multi ? ' dan pembayaran PayLater dari beberapa dompet' : '') + '. Hanya bisa dipulihkan oleh Money Diary Priv yang mendukung rekonsiliasi; versi lama sengaja menolak file ini.', plan, exported, data: { records: rr } };
  if (!multi) return { app: 'money-diary', v: 3, plan, exported, records: rr };
  return { app: 'money-diary', v: 4, needs: ['plPays.src'], catatan: 'Backup versi 4: berisi pembayaran PayLater dari beberapa dompet. Hanya bisa dipulihkan oleh Money Diary Priv polish6-rev2 atau lebih baru; versi lama sengaja menolak file ini.', plan, exported, data: { records: rr } };
}
function downloadBackup() {
  const name = 'money-diary-backup-' + nowLocal().replace('T', '-').replace(':', '') + '.json';
  if (MDSanitize.cleanPaysReport(meta.plPays).bad.length) { toast('Backup dibatalkan: data pembayaran PayLater tidak konsisten. Tidak ada yang diubah.'); return; }
  const body = JSON.stringify(backupDoc({ name: meta.name || '', budget: meta.budget, cats: meta.cats, goals: meta.goals, rules: meta.rules, wallets: meta.wallets, xfers: meta.xfers, sim: simGet(), recur: recurGet(), pl: plGet(), plPays: meta.plPays, plRecon: meta.plRecon, bankAdmin: meta.bankAdmin }, recs.map(({ id, ...r }) => r)));
  const done = msg => {   // berkas sudah keluar; penanda backup disimpan atomik: bila gagal, penanda dikembalikan dan pesan jujur
    const c0 = meta.changes, l0 = meta.lastBackup; meta.changes = 0; meta.lastBackup = Date.now();
    const saved = save(true); if (!saved) { meta.changes = c0; meta.lastBackup = l0; }
    dirty.home = dirty.data = 1; refresh(); toast(saved ? msg : msg + ', tetapi penanda backup gagal disimpan (penyimpanan penuh)');
  };
  const file = typeof File === 'function' ? new File([body], name, { type: 'application/json' }) : null;
  if (file && TOUCH() && navigator.canShare && navigator.canShare({ files: [file] })) {   // HP: menu Bagikan (Simpan ke Berkas/iCloud, Drive, dll)
    navigator.share({ files: [file], title: 'Backup Money Diary' }).then(() => done('Backup tersimpan'), err => { if (err && err.name === 'AbortError') return; download(name, body, 'application/json'); done('Backup diunduh'); });
    return;
  }
  download(name, body, 'application/json'); done('Backup diunduh');   // laptop / browser tanpa menu Bagikan
}
function exportCSV() {
  const q = v => '"' + String(v).replace(/"/g, '""') + '"';
  const rows = [['Date', 'Account', 'Category', 'Subcategory', 'Note', 'IDR', 'Income/Expense', 'Tag'].join(',')].concat(recs.slice().reverse().map(r => [r.t.replace('T', ' '), r.ac, r.c, r.s || '', r.n, r.a, r.k === 'I' ? 'Income' : 'Expense', (r.tg || []).join(' ')].map(q).join(',')));
  download('money-diary-' + nowLocal().slice(0, 10) + '.csv', '﻿' + rows.join('\n'), 'text/csv;charset=utf-8'); toast('CSV diekspor');
}
async function seed(force) {
  const res = await fetch(DATA_URL, { cache: 'no-cache' }); if (!res.ok) throw new Error('tidak ada data.json');
  if (!/json/.test(res.headers.get('content-type') || '')) throw new Error('bukan json'); // hosting SPA bisa membalas HTML
  const j = await res.json(); recs = []; if (force) meta.changes = 0; meta.start = j.start || meta.start;
  addBatch(j.rows.map(([t, k, c, n, a, ac]) => ({ t, k, c, n, a, ac })));
  save(); dirtyAll(); fillFilters(); refresh();
}

/* ---------- efek masuk (hanya transform & opacity) ---------- */
let fx = 1;   // 1 = jalankan efek pada render berikutnya (pindah tab, ganti filter, buka app)
const FX_ITEMS = '.dgrp,.stat,.dcard,.bud,.row-b,.mc,.empty,.ktabs,.donut,.tile,.wl-hero,.wcard,.wl-home';
function celebrate() {   // selebrasi partikel ringan (~1,2 dtk), otomatis mati di mode Tanpa animasi
  if (reduce) return;
  const cols = ['#38bdf8', '#34d399', '#fbbf24', '#f472b6', '#a78bfa', '#fb923c'];
  const box = document.createElement('div'); box.className = 'cel-box'; box.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 18; i++) {
    const p = document.createElement('i'), ang = (Math.PI * 2 * i / 18) + (Math.random() - .5) * .35, dist = 60 + Math.random() * 95;
    p.style.cssText = `--x:${Math.round(Math.cos(ang) * dist)}px;--y:${Math.round(Math.sin(ang) * dist - 40)}px;--c:${cols[i % cols.length]};--d:${(i % 5) * 35}ms`;
    box.appendChild(p);
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 1350);
}
function rise(nodes) {   // item yang terlihat naik bergantian
  if (reduce) return;
  const max = lite ? 6 : 8, step = lite ? 18 : 30, dist = lite ? 8 : 12; let n = 0;
  for (const el of nodes) {
    if (n >= max) break;
    const r = el.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight || !r.height) continue;
    el.animate([{ opacity: 0, transform: 'translate3d(0,' + dist + 'px,0)' }, { opacity: 1, transform: 'none' }],
      { duration: (lite ? 340 : 420) * SPD, delay: n * step * SPD, easing: IOS, fill: 'backwards' });
    n++;
  }
}
const growIO = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { growIO.unobserve(en.target); growBar(en.target); } }), { threshold: .1 }) : null;
function growBar(el) {
  if (reduce) return;
  const v = el.parentElement.classList.contains('mc-b'), row = el.closest('.row-b,.mc'), idx = row && row.parentElement ? [...row.parentElement.children].indexOf(row) : 0;
  el.animate([{ transform: v ? 'scaleY(0)' : 'scaleX(0)' }, { transform: 'none' }], { duration: (lite ? 420 : 560) * SPD, delay: Math.min(8, Math.max(0, idx)) * 22 * SPD, easing: IOS, fill: 'backwards' });
}
function playFx(mode) {
  const v = $('#view-' + tab); if (!v || v.hidden) return;
  if (mode !== 2) rise(v.querySelectorAll(FX_ITEMS));   // 2 = hanya bar tumbuh (ganti filter), tanpa naik bergantian
  v.querySelectorAll('.rb i,.bar i,.mc-b i,.mb i').forEach(el => growIO ? growIO.observe(el) : growBar(el));
  if (!reduce) v.querySelectorAll('.ring .rg-fg').forEach(c => {
    const len = +(c.dataset.l || 0); if (!len) return;
    c.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: (lite ? 460 : 620) * SPD, easing: IOS });
  });
}
if (matchMedia('(hover:hover) and (pointer:fine)').matches) document.addEventListener('pointermove', e => {   // kilau mengikuti kursor (mouse saja)
  if (e.pointerType !== 'mouse') return; const c = e.target.closest && e.target.closest('.stat,.dgrp,.dcard'); if (!c) return;
  const r = c.getBoundingClientRect(); c.style.setProperty('--mx', (e.clientX - r.left) + 'px'); c.style.setProperty('--my', (e.clientY - r.top) + 'px');
}, { passive: true });

/* ---------- Rencana (budget + tabungan) & Beranda ---------- */
const monthSpend = tm => { const o = { t: 0, c: {} }; recs.forEach(r => { if (r.k === 'E' && r.t.slice(0, 7) === tm) { o.t += r.a; o.c[r.c] = (o.c[r.c] || 0) + r.a; } }); return o; };
const budCls = p => p >= 100 ? 'hot' : p >= 80 ? 'warn' : '';
function goalEst(g) {
  const sv = goalSaved(g); if (sv >= g.target) return 'Target tercapai';
  const ds = g.dep.filter(d => d.a > 0).map(d => d.t).sort(); if (!ds.length || sv <= 0) return 'Belum ada setoran';
  const a = new Date(ds[0]), b = new Date(), mo = Math.max(1, (b - a) / 2629800000), rate = sv / mo;
  const left = Math.ceil((g.target - sv) / rate), d = new Date(); d.setMonth(d.getMonth() + left);
  return 'Perkiraan tercapai ' + mLabel(d.getFullYear() + '-' + p2(d.getMonth() + 1)) + ' (±' + rp(rate) + '/bln)';
}
const ring = (p, sz = 76, col = 'var(--accent)') => { const dl = Math.min(100, p) * 2.1363; return `<svg class="ring" width="${sz}" height="${sz}" viewBox="0 0 80 80"><circle class="rg-bg" cx="40" cy="40" r="34" fill="none" stroke-width="9"/><circle class="rg-fg" data-l="${dl.toFixed(1)}" cx="40" cy="40" r="34" fill="none" stroke="${col}" stroke-width="9" stroke-linecap="round" stroke-dasharray="${dl} 213.63" transform="rotate(-90 40 40)"/><text x="40" y="45" text-anchor="middle" class="rg-t" font-size="${sz < 60 ? 19 : 16}" font-weight="700">${Math.round(p)}%</text></svg>`; };
function budgetWarn(r) {
  if (r.k !== 'E' || !meta.cats[r.c]) return '';
  const p = monthSpend(r.t.slice(0, 7)).c[r.c] / meta.cats[r.c] * 100;
  return p >= 100 ? ` · Budget ${cat(r.c)} terlewat` : p >= 80 ? ` · ${cat(r.c)} sudah ${Math.round(p)}% dari budget` : '';
}
let planDir = 0;   // arah animasi saat pindah sub-tab Rencana: 1 = ke kanan, -1 = ke kiri
let planSub = 'bud';   // sub-tab Rencana: bud | sim | tab
function renderPlan() {
  const tm = thisMonth(), ms = monthSpend(tm), dom = new Date().getDate(), dim = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const pct = meta.budget ? ms.t / meta.budget * 100 : 0;
  let h = `<h2 class="sec">Budget bulan ini</h2><div class="bud"><div class="bud-t"><span>${mLabel(tm)}</span><span><b>${rp(ms.t)}</b>${meta.budget ? ' dari ' + rp(meta.budget) : ''}</span></div>` +
    (meta.budget ? `<div class="ring-row"><div class="ring-main"><div class="bud-s"><span>${ms.t > meta.budget ? 'Lewat ' + rp(ms.t - meta.budget) : 'Sisa ' + rp(meta.budget - ms.t) + ' · ±' + rp((meta.budget - ms.t) / Math.max(1, dim - dom + 1)) + '/hari'}</span></div><div class="bud-s"><button type="button" class="btn-s" id="bud-set">Ubah total</button></div></div>${ring(pct, 76, pct >= 100 ? '#fb7185' : pct >= 80 ? '#fbbf24' : 'var(--accent)')}</div>`
      : `<div class="bud-s" style="margin-top:8px"><span>Belum ada budget bulanan.</span><button type="button" class="btn-s" id="bud-set">Atur budget</button></div>`) + '</div>';
  const cs = Object.keys(meta.cats).filter(c => meta.cats[c] > 0);
  h += `<h2 class="sec">Per kategori</h2>` + (cs.length ? cs.sort((a, b) => (ms.c[b] || 0) / meta.cats[b] - (ms.c[a] || 0) / meta.cats[a]).map(c => { const s = ms.c[c] || 0, p = s / meta.cats[c] * 100;
    return `<div class="bud cb">${ico(c)}<div class="cbm"><div class="bud-t"><span>${esc(cat(c))}</span><span><b class="${budCls(p)}">${Math.round(p)}%</b></span></div><div class="bar"><i class="${budCls(p)}" style="width:${Math.min(100, p)}%"></i></div><div class="bud-s"><span>${rp(s)} / ${rp(meta.cats[c])}</span><span>${p >= 100 ? 'Terlewat ' + rp(s - meta.cats[c]) : p >= 80 ? 'Hampir habis' : 'Sisa ' + rp(meta.cats[c] - s)}</span></div></div>${ring(Math.min(p, 999), 52, p >= 100 ? '#fb7185' : p >= 80 ? '#fbbf24' : catColor(c))}</div>`; }).join('') : '<div class="empty">Belum ada budget per kategori.</div>') +
    '<div class="acts"><button type="button" class="btn-s" id="cb-set">Atur budget kategori</button></div>';
  let hg = `<h2 class="sec">Tabungan</h2>` + (meta.goals.length ? meta.goals.map(g => { const sv = goalSaved(g), p = sv / g.target * 100;
    return `<div class="bud goal" data-g="${esc(g.id)}">${ring(p)}<div class="gm"><b>${esc(g.name)}</b><span>${rp(sv)} / ${rp(g.target)}</span><small>${esc(goalEst(g))}</small><div class="acts"><button type="button" class="btn-p g-dep">Setor</button><button type="button" class="btn-s g-edit">Ubah</button></div></div></div>`; }).join('') : '<div class="empty">Belum ada target tabungan.</div>') +
    '<div class="acts"><button type="button" class="btn-s" id="g-new">+ Target baru</button></div>';
  const ord = ['bud', 'sim', 'tab'], box = $('#budget'), body = planSub === 'sim' ? simHTML(ms) : planSub === 'tab' ? hg : h;
  let seg = $('#plan-seg');
  if (seg && seg.parentElement === box) {   // kontrol segmen dipertahankan supaya pilnya bisa meluncur
    [...box.children].forEach(c => { if (c !== seg) c.remove(); }); seg.insertAdjacentHTML('afterend', body);
    seg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.p === planSub));
  } else {
    box.innerHTML = `<div class="seg3 plan-seg" id="plan-seg" style="--i:${ord.indexOf(planSub)}">${[['bud', 'Budget'], ['sim', 'Simulasi'], ['tab', 'Tabungan']].map(([k, l]) => `<button type="button" data-p="${k}" class="${planSub === k ? 'on' : ''}">${l}</button>`).join('')}</div>` + body; seg = $('#plan-seg');
  }
  seg.style.setProperty('--i', ord.indexOf(planSub));
  seg.onclick = e => { const b = e.target.closest('button'); if (!b || b.dataset.p === planSub) return; planDir = ord.indexOf(b.dataset.p) > ord.indexOf(planSub) ? 1 : -1; planSub = b.dataset.p; renderPlan(); };
  const bs = $('#bud-set'); if (bs) { bs.onclick = budgetSheet; $('#cb-set').onclick = catBudgetSheet; }
  const gn = $('#g-new'); if (gn) gn.onclick = () => goalSheet();
  if (planSub === 'sim') simBind(box);
  if (planDir) { const d = planDir; planDir = 0; [...box.children].forEach(c => { if (c !== seg) slide(c, d); }); }
  box.querySelectorAll('.goal').forEach(n => { const g = meta.goals.find(x => x.id === n.dataset.g); n.querySelector('.g-dep').onclick = () => depositSheet(g); n.querySelector('.g-edit').onclick = () => goalSheet(g); });
}
/* ---------- Simulasi: kalkulator rencana bulan ini (tersimpan di meta.sim, ikut backup) ---------- */
function simGet() { const o = meta.sim && typeof meta.sim === 'object' ? meta.sim : (meta.sim = {}); if (!Array.isArray(o.items)) o.items = []; if (o.sub === undefined) o.sub = 1; o.base = +o.base || 0; o.ahead = o.ahead ? 1 : 0; return o; }
function simCalc() {
  const s = simGet(), hasW = meta.wallets.length > 0, base = hasW ? walBal().total : s.base;
  const saved = meta.goals.reduce((a, g) => a + goalSaved(g), 0), cut = s.sub && saved > 0 ? saved : 0;
  const avail = base - cut, plm = s.ahead ? plMonthDueOf(plGet(), addM(thisMonth(), 1), meta.plPays) : plMonthDue(), tot = plm + s.items.reduce((a, x) => a + (x.k === 'I' ? 0 : x.a), 0), inc = s.items.reduce((a, x) => a + (x.k === 'I' ? x.a : 0), 0), over = tot > avail;
  return { s, hasW, base, saved, cut, avail, tot, plm, inc, left: avail - tot, left2: avail + inc - tot, over, pct: avail > 0 ? tot / avail * 100 : (tot > 0 ? 100 : 0) };
}
function simHTML(ms) {
  const c = simCalc(), s = c.s, cls = c.over ? 'hot' : budCls(c.pct), col = c.over ? '#fb7185' : c.pct >= 80 ? '#fbbf24' : 'var(--accent)';
  let h = `<div class="bud sim-card"><div class="bud-t"><span>Saldo awal</span><b>${rpS(c.base)}</b></div>` +
    (c.hasW ? '<div class="bud-s"><span>Total saldo Dompet (yang di luar total tidak ikut)</span></div>'
      : `<label class="sim-base">Saldo manual (belum ada Dompet)<input class="amt" id="sim-base" inputmode="numeric" placeholder="mis. 2.000.000" value="${s.base ? NF.format(s.base) : ''}"></label>`) +
    (c.saved > 0 ? `<label class="chk sim-sub"><input type="checkbox" id="sim-sub"${s.sub ? ' checked' : ''}> Kurangi tabungan terkumpul <small>−${rp(c.saved)}. Setoran tabungan tidak mengurangi saldo Dompet.</small></label>` : '') +
    (plGet().length ? `<label class="chk sim-sub"><input type="checkbox" id="sim-ahead"${s.ahead ? ' checked' : ''}> Hitung juga tagihan PayLater bulan depan <small>Sampai ${esc(plMY(addM(thisMonth(), 1) + '-01'))}. Default mati.</small></label>` : '') +
    (c.cut ? `<div class="bud-s"><span>Bisa dipakai</span><b>${rpS(c.avail)}</b></div>` : '') + '</div>';
  h += `<div class="bud sim-card"><div class="ring-row"><div class="ring-main"><div class="hint" style="margin:0">Sisa setelah semua rencana</div><div class="sim-left ${c.over ? 'r' : ''}">${rpS(c.left)}</div><div class="bud-s"><span>Total rencana ${rp(c.tot)}</span></div><div class="bud-s"><span>${c.over ? 'Melebihi saldo ' + rp(-c.left) : Math.round(c.pct) + '% saldo terpakai'}</span></div></div>${ring(c.pct, 76, col)}</div></div>`;
  if (c.inc > 0) h += `<div class="bud sim-card"><div class="bud-t"><span>Skenario pemasukan</span><b class="${c.left2 < 0 ? 'hot' : ''}">+${rp(c.inc)}</b></div><div class="sim-sc"><div><small>Tanpa pemasukan</small><b class="${c.left < 0 ? 'hot' : ''}">${rpS(c.left)}</b></div><div><small>Dengan pemasukan</small><b class="${c.left2 < 0 ? 'hot' : ''}">${rpS(c.left2)}</b></div></div></div>`;
  h += runwayHTML(c.tot);
  if (meta.budget) {
    const rem = meta.budget - ms.t, d = rem - c.tot, p = rem > 0 ? c.tot / rem * 100 : (c.tot > 0 ? 100 : 0), bc = d < 0 ? 'hot' : budCls(p);
    h += `<div class="bud sim-card"><div class="bud-t"><span>Vs sisa budget bulan ini</span><b class="${bc}">${d < 0 ? 'Lewat ' + rp(-d) : 'Muat ±' + rp(d)}</b></div><div class="bar"><i class="${bc}" style="width:${Math.min(100, p)}%"></i></div><div class="bud-s"><span>Rencana ${rp(c.tot)}</span><span>Sisa budget ${rpS(rem)}</span></div></div>`;
  }
  const items = s.items.slice().sort((x, y) => (x.k === 'I') - (y.k === 'I') || y.a - x.a), den = Math.max(c.avail, 1);
  if (items.length) h += `<div class="sim-stick ${cls}"><span>Sisa setelah rencana</span><b>${rpS(c.left)}</b><small>${c.over ? 'Melebihi saldo' : Math.round(c.pct) + '% terpakai'}</small></div>`;
  h += recurHTML() + plHTML();
  h += `<h2 class="sec">Daftar rencana</h2><div class="bud sim-card"><form id="sim-q" class="sim-q" autocomplete="off"><input id="sim-qi" placeholder="Kos 1,2jt  atau  +gaji 2jt" aria-label="Nama dan nominal rencana" autocapitalize="sentences"><button type="submit" class="btn-p">Tambah</button></form>` +
    (items.length ? items.map(x => { const inc = x.k === 'I'; return `<div class="sim-r${inc ? ' inc' : ''}" data-id="${esc(x.id)}"><label class="sim-ck"><input type="checkbox" class="sim-pd" aria-label="${inc ? 'Sudah diterima' : 'Sudah dibayar'}: ${esc(x.n)}"></label><button type="button" class="sim-m"><b>${esc(x.n)}</b>${x.c || x.w ? `<small>${esc([x.c ? cat(x.c) : '', x.w].filter(Boolean).join(' · '))}</small>` : ''}${inc ? '' : `<span class="sim-bar"><i style="width:${Math.min(100, x.a / den * 100)}%"></i></span>`}</button><span class="sim-a">${inc ? '+' : ''}${rp(x.a)}</span></div>`; }).join('') +
      '<div class="hint">Centang kalau sudah dibayar atau diterima: baris dihapus dan form Catat terbuka dengan isian terisi. Bar = porsi terhadap saldo.</div><div class="acts"><button type="button" class="btn-s btn-d" id="sim-clr">Kosongkan rencana</button></div>'
      : '<div class="empty" style="margin-top:10px">Belum ada rencana. Ketik di atas, nominal bisa 25k atau 1,5jt. Awali + untuk pemasukan yang belum pasti.</div>') + '</div>';
  return h;
}
function simBind(box) {
  const s = simGet(), again = () => { meta.changes++; save(); dirty.home = 1; renderPlan(); };
  const sb = $('#sim-sub'); if (sb) sb.onchange = () => { s.sub = sb.checked ? 1 : 0; save(); dirty.home = 1; renderPlan(); };
  const sa = $('#sim-ahead'); if (sa) sa.onchange = () => { s.ahead = sa.checked ? 1 : 0; save(); dirty.home = 1; renderPlan(); };
  const bi = $('#sim-base'); if (bi) { bindAmtInput(bi); bi.addEventListener('change', () => { s.base = parseAmt(bi.value); save(); dirty.home = 1; renderPlan(); }); }
  $('#sim-q').onsubmit = e => {
    e.preventDefault(); const toks = $('#sim-qi').value.trim().split(/\s+/).filter(Boolean); let a = 0, k = 'E'; if (toks.length && toks[0][0] === '+') { k = 'I'; toks[0] = toks[0].slice(1); if (!toks[0]) toks.shift(); }
    if (toks.length >= 2 && /^(k|rb|ribu|jt|juta)$/i.test(toks[toks.length - 1]) && parseAmt(toks[toks.length - 2] + toks[toks.length - 1])) { a = parseAmt(toks[toks.length - 2] + toks[toks.length - 1]); toks.length -= 2; }
    else if (toks.length) { a = parseAmt(toks[toks.length - 1]); if (a) toks.pop(); }
    if (!a) { toast('Tulis nama dan nominal, mis. Kos 1,2jt'); return; }
    s.items.push({ id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), n: (toks.join(' ') || (k === 'I' ? 'Pemasukan' : 'Rencana')).slice(0, 40), a, c: '', w: '', k }); again();
    const qi = $('#sim-qi'); if (qi) qi.focus();
  };
  recurBind(box, again); plBind(box);
  const cl = $('#sim-clr'); if (cl) cl.onclick = e => confirmBtn(e.target, 'Yakin? Ketuk lagi', () => { const snap = s.items.slice(); s.items = []; meta.changes++; save(); dirty.home = 1; renderPlan(); toast('Rencana dikosongkan', () => { simGet().items = snap; meta.changes++; save(); dirty.home = 1; renderPlan(); }); });
  box.querySelectorAll('.sim-r').forEach(r => {
    const it = s.items.find(x => x.id === r.dataset.id); if (!it) return;
    r.querySelector('.sim-pd').onchange = () => simPay(it);
    r.querySelector('.sim-m').onclick = () => simSheet(it);
  });
}
function simPay(it) {   // sudah dibayar: keluar dari rencana (saldo nyata yang turun menggantikannya), form Catat terbuka dengan isian terisi
  const s = simGet(), snap = s.items.slice();
  s.items = s.items.filter(x => x !== it); meta.changes++; save(); dirty.home = 1; renderPlan();
  formSheet();
  const q = x => document.querySelector('#sheet-body ' + x); if (it.k === 'I') { const kb = q('.seg button[data-k="I"]'); if (kb) kb.click(); }
  const fa = q('#fm-a'), fn = q('#fm-n'), fc = q('#fm-c'), fw = q('#fm-ac');
  if (fa) fa.value = fmtAmt(it.a); if (fn) fn.value = it.n;
  if (fc && it.c && [...fc.options].some(o => o.value === it.c)) fc.value = it.c;
  if (fw && it.w && [...fw.options].some(o => o.value === it.w)) fw.value = it.w;
  toast(it.k === 'I' ? 'Pemasukan dihapus dari rencana' : 'Dihapus dari rencana', () => { simGet().items = snap; meta.changes++; save(); dirty.home = 1; renderPlan(); });
}
function simSheet(it) {
  const cs = [...new Set(recs.filter(r => r.k === 'E').map(r => r.c).concat(Object.keys(meta.cats)))].sort((a, b) => cat(a).localeCompare(cat(b)));
  const n = el(`<form class="form" autocomplete="off"><label>Nama<input id="sm-n" maxlength="40" value="${esc(it.n)}"></label><label>Nominal (Rp)<input class="amt" id="sm-a" inputmode="numeric" value="${NF.format(it.a)}"></label>
    ${it.k === 'I' ? '' : `<label>Kategori <small>(opsional)</small><select id="sm-c"><option value="">Tanpa kategori</option>${cs.map(c => `<option value="${esc(c)}"${c === it.c ? ' selected' : ''}>${esc(cat(c))}</option>`).join('')}</select></label>`}
    ${meta.wallets.length ? `<label>Dompet <small>(opsional)</small><select id="sm-w"><option value="">Tanpa dompet</option>${meta.wallets.map(w => `<option value="${esc(w.name)}"${w.name === it.w ? ' selected' : ''}>${esc(w.name)}</option>`).join('')}</select></label>` : ''}
    <div class="acts"><button type="button" class="btn-s btn-d" id="sm-del">Hapus</button><button type="submit" class="btn-p">Simpan</button></div></form>`);
  bindAmtInput(n.querySelector('#sm-a'));
  n.querySelector('form').onsubmit = e => { e.preventDefault(); const a = parseAmt(n.querySelector('#sm-a').value); if (!a) { toast('Isi nominalnya dulu'); return; }
    it.n = n.querySelector('#sm-n').value.trim() || (it.k === 'I' ? 'Pemasukan' : 'Rencana'); it.a = a; const sc = n.querySelector('#sm-c'); it.c = sc ? sc.value : ''; const w = n.querySelector('#sm-w'); it.w = w ? w.value : '';
    meta.changes++; save(); closeSheet(); dirty.home = 1; renderPlan(); };
  n.querySelector('#sm-del').onclick = e => confirmBtn(e.target, 'Yakin? Ketuk lagi', () => { simGet().items = simGet().items.filter(x => x !== it); meta.changes++; save(); closeSheet(); dirty.home = 1; renderPlan(); });
  openSheet(it.k === 'I' ? 'Ubah pemasukan' : 'Ubah rencana', n);
}
/* ---------- Tagihan rutin: template (nama, nominal, kategori) yang ikut backup. Yang sudah tercatat bulan ini dilewati ---------- */
function recurGet() { if (!Array.isArray(meta.recur)) meta.recur = []; return meta.recur; }
const recurKey = x => String(x || '').trim().toLowerCase();
function recurMonth() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
function recurPaid(t) { const m = recurMonth(), k = recurKey(t.n); return !!k && recs.some(r => r.k === 'E' && r.t.slice(0, 7) === m && recurKey(r.n).includes(k)); }
function recurInPlan(t) { const k = recurKey(t.n); return simGet().items.some(x => x.k === 'E' && recurKey(x.n) === k); }
function recurPending() { return recurGet().filter(t => !recurPaid(t) && !recurInPlan(t)); }
function recurHTML() {
  const rs = recurGet(), pend = recurPending();
  const rows = rs.map(t => { const st = recurPaid(t) ? '✓ Lunas' : recurInPlan(t) ? 'Di rencana' : 'Belum dibayar'; const sub = st;
    return `<div class="rc-r sim-r"><button type="button" class="sim-m rc-m" data-id="${esc(t.id)}"><b>${esc(t.n)}</b><small>${esc(sub)}</small></button><span class="sim-a">${rp(t.a)}</span></div>`; }).join('');
  return `<h2 class="sec">Tagihan rutin</h2><div class="bud sim-card">` +
    (rs.length ? rows + `<div class="acts"><button type="button" class="btn-p" id="rc-add-all"${pend.length ? '' : ' disabled'}>Masukkan yang belum dibayar${pend.length ? ' (' + pend.length + ')' : ''}</button></div>`
      : '<div class="empty">Belum ada template. Tambah tagihan yang nominalnya tetap, mis. Google atau Spotify.</div>') +
    `<div class="acts"><button type="button" class="btn-s" id="rc-new">+ Tambah tagihan rutin</button></div>` +
    (rs.length ? '<div class="hint">Yang namanya sudah ada di transaksi bulan ini dianggap lunas dan dilewati. Ketuk nama untuk mengubah.</div>' : '') + '</div>';
}
function recurBind(box, again) {
  const nw = box.querySelector('#rc-new'); if (nw) nw.onclick = () => recurSheet(null);
  const all = box.querySelector('#rc-add-all'); if (all) all.onclick = () => { const p = recurPending(), s = simGet(); if (!p.length) return;
    const snap = s.items.slice(); p.forEach(t => s.items.push({ id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), n: t.n, a: t.a, c: t.c || '', w: '', k: 'E' }));
    meta.changes++; save(); dirty.home = 1; renderPlan(); toast(p.length + ' tagihan masuk rencana', () => { simGet().items = snap; meta.changes++; save(); dirty.home = 1; renderPlan(); }); };
  box.querySelectorAll('.rc-m').forEach(b => { b.onclick = () => { const t = recurGet().find(x => x.id === b.dataset.id); if (t) recurSheet(t); }; });
}
function recurSheet(t) {
  const def = 'Tagihan & Langganan', cs = [...new Set([def].concat(recs.filter(r => r.k === 'E').map(r => r.c), Object.keys(meta.cats)))].filter(Boolean).sort((a, b) => cat(a).localeCompare(cat(b)));
  const cur = t ? t.c : def;
  const n = el(`<form class="form" autocomplete="off"><label>Nama<input id="rc-n" maxlength="40" value="${t ? esc(t.n) : ''}" placeholder="mis. Spotify"></label><label>Nominal (Rp)<input class="amt" id="rc-a" inputmode="numeric" value="${t ? NF.format(t.a) : ''}"></label>
    <label>Kategori<select id="rc-c">${cs.map(c => `<option value="${esc(c)}"${c === cur ? ' selected' : ''}>${esc(cat(c))}</option>`).join('')}</select></label>
    <div class="acts">${t ? '<button type="button" class="btn-s btn-d" id="rc-del">Hapus</button>' : ''}<button type="submit" class="btn-p">Simpan</button></div></form>`);
  bindAmtInput(n.querySelector('#rc-a'));
  n.querySelector('form').onsubmit = e => { e.preventDefault(); const a = parseAmt(n.querySelector('#rc-a').value), nm = n.querySelector('#rc-n').value.trim().slice(0, 40);
    if (!nm) { toast('Isi namanya dulu'); return; } if (!a) { toast('Isi nominalnya dulu'); return; }
    const c = n.querySelector('#rc-c').value;
    if (t) { t.n = nm; t.a = a; t.c = c; } else recurGet().push({ id: 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), n: nm, a, c });
    meta.changes++; save(); closeSheet(); dirty.home = 1; renderPlan(); };
  const d = n.querySelector('#rc-del'); if (d) d.onclick = e => confirmBtn(e.target, 'Yakin? Ketuk lagi', () => { meta.recur = recurGet().filter(x => x !== t); meta.changes++; save(); closeSheet(); dirty.home = 1; renderPlan(); });
  openSheet(t ? 'Ubah tagihan rutin' : 'Tagihan rutin baru', n);
}
/* ---------- Tagihan paylater (ShopeePayLater): order tgl 1-15 jatuh tempo tgl 25 bulan itu, tgl 16-akhir bulan tgl 25 bulan berikutnya, lalu tiap tgl 25 sampai lunas.
   Pengeluaran dicatat SAAT DIBAYAR (tombol Bayar) tapi bertanggal TANGGAL ORDER, supaya masuk ke bulan belanjanya. Yang dicatat: cicilan per bulan + jumlah cicilan dari aplikasi Shopee. ---------- */
function plGet() { if (!Array.isArray(meta.pl)) meta.pl = []; return meta.pl; }
function plRows() { return plRowsOf(plGet(), meta.plPays); }   // semua cicilan, urut tanggal tenggat
let plShowPaid = false;
const plToday = () => nowLocal().slice(0, 10);
function plMonthDue() { return plMonthDueOf(plGet(), thisMonth(), meta.plPays); }   // yang telat juga ikut
function plMark(key, date) { const [id, i] = key.split(':'), p = plGet().find(x => x.id === id); if (!p) return; (p.d = p.d || {})[i] = date; }
function plUnmark(key) { const [id, i] = key.split(':'), p = plGet().find(x => x.id === id); if (!p || !p.d) return; delete p.d[i]; }
const plDM = d => new Date(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
const plMY = d => new Date(+d.slice(0, 4), +d.slice(5, 7) - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });


/* ===== PayLater v2: pembayaran tagihan (buku pembayaran, tidak pernah menjadi pengeluaran pembelian) ===== */
/* Catatan biaya milik sebuah pembayaran. Utama: id yang disimpan. Cadangan (id berubah, mis. transaksi kembar setelah restore):
   HANYA catatan yang persis sama dengan yang dibuat pembayaran ini (waktu sampai detik, akun, nominal, nama, kategori, tag) dan belum
   dimiliki pembayaran lain. Pencocokan longgar (nominal + tanggal) sengaja tidak dipakai: bisa mengambil biaya pembayaran lain. */
const plFeeRec = y => {
  if (!y.fee) return null;
  const isFee = r => (r.tg || []).includes('biaya-paylater'), claimed = new Set((meta.plPays || []).filter(z => z !== y && z.id !== y.id && z.fee).map(z => z.fee.rid));
  const byId = recs.find(r => r.id === y.fee.rid && isFee(r) && r.a === y.fee.a); if (byId) return byId;
  const ac = y.fee.ac || plWalName(y.w);
  return recs.find(r => isFee(r) && r.k === 'E' && r.t === y.t && r.a === y.fee.a && r.ac === ac && r.n === 'Biaya PayLater' && r.c === 'Tagihan & Langganan' && !claimed.has(r.id)) || null;
};
const plWalName = id => ((meta.wallets.find(w => w.id === id) || {}).name || 'dompet dihapus');
const plPayWals = y => plPaySrc(y).map(x => plWalName(x.w)).join(' + ');
function plPaySheet({ ym, item } = {}) {
  const all = plRows(), rows = all.filter(r => r.ex && r.rem > 0 && (item ? r.p.id === item : r.due.slice(0, 7) === ym));
  if (!rows.length) { toast('Tidak ada tagihan tercatat yang perlu dibayar.'); return; }
  if (!meta.wallets.length) { toast('Buat dompet dulu di tab Dompet, lalu bayar dari sana.'); return; }
  const total = rows.reduce((a, r) => a + r.rem, 0), old = ym ? all.filter(r => !r.ex && !r.paid && r.due.slice(0, 7) === ym).length : 0, ws = meta.wallets;
  const w0 = ws.find(w => w.name === rows[0].p.w) || ws.find(w => /shopee/i.test(w.name)) || ws.find(w => w.name === meta.lastWal) || ws[0];
  const hintAt = amt => Math.round(rows.reduce((a, r) => a + plFeeHint(r.p, r.i), 0) * Math.min(1, amt / total));
  const title = item ? plItemTitle(rows[0].p) : 'Tagihan ' + plDM(ym + '-25') + ' ' + ym.slice(0, 4);
  const wOpts = sel => ws.map(w => `<option value="${esc(w.id)}"${w.id === sel ? ' selected' : ''}>${esc(w.name)}</option>`).join('');
  const n = el(`<form class="form" autocomplete="off"><div class="kv"><span>${esc(title)} · sisa</span><b>${rp(total)}</b></div>
    ${old ? `<div class="hint">Ada ${old} cicilan lama (belum tercatat) di bulan ini. Bayar lewat tombol Bayar masing-masing, karena itu membuat pengeluaran.</div>` : ''}
    <label>Pokok dibayar (Rp) <small>bisa sebagian</small><input class="amt" id="pp-a" inputmode="numeric" value="${NF.format(total)}"></label>
    <label>Bunga / biaya admin (Rp) <small>opsional, dicatat terpisah sebagai pengeluaran, bukan bagian pokok</small><input class="amt" id="pp-f" inputmode="numeric" value="${hintAt(total) ? NF.format(hintAt(total)) : ''}" placeholder="0"></label>
    <label id="pp-w1">Dibayar dari dompet<select id="pp-w">${wOpts(w0.id)}</select></label>
    <div id="pp-sp" hidden><div class="hint">Bagi pokok ke beberapa dompet (maksimal ${PL_MAX_SRC}). Jumlah semua sumber harus <b>sama persis</b> dengan pokok.</div><div id="pp-rows"></div>
      <div class="acts"><button type="button" class="btn-s" id="pp-add">+ Tambah sumber dana</button><button type="button" class="btn-s" id="pp-one">Satu dompet saja</button></div></div>
    ${ws.length > 1 ? '<div class="acts" id="pp-splitw"><button type="button" class="btn-s" id="pp-split">Bagi dari beberapa dompet</button></div>' : ''}
    <label id="pp-fwl" hidden>Biaya admin dibayar dari dompet <small>default: kontribusi terbesar</small><select id="pp-fw">${wOpts(w0.id)}</select></label>
    <label>Tanggal bayar<input type="date" id="pp-t" value="${plToday()}"></label>
    <div class="hint" id="pp-pv" aria-live="polite"></div>
    <div class="acts"><button type="button" class="btn-s" id="pp-no">Batal</button><button type="submit" class="btn-p" id="pp-ok">Bayar</button></div></form>`);
  const q = x => n.querySelector(x); bindAmtInput(q('#pp-a')); bindAmtInput(q('#pp-f'));
  let split = false, feeTouched = false, feeWTouched = false, srcRows = [];
  q('#pp-f').addEventListener('input', () => { feeTouched = true; });
  const stamp = d => d + 'T' + nowLocal().slice(11, 16) + ':' + p2(new Date().getSeconds());
  const drawRows = () => {
    q('#pp-rows').innerHTML = srcRows.map((r, i) => `<div style="display:flex;gap:8px;align-items:center;margin:6px 0"><select class="pp-sw" data-i="${i}" style="flex:1">${wOpts(r.w)}</select><input class="amt pp-sa" data-i="${i}" inputmode="numeric" value="${esc(r.a)}" placeholder="Rp" style="flex:1">${srcRows.length > 2 ? `<button type="button" class="btn-s pp-rm" data-i="${i}" aria-label="Hapus sumber dana">✕</button>` : ''}</div>`).join('');
    q('#pp-rows').querySelectorAll('.pp-sa').forEach(bindAmtInput);
    q('#pp-add').hidden = srcRows.length >= PL_MAX_SRC;
  };
  const syncRows = () => { q('#pp-rows').querySelectorAll('.pp-sw').forEach(sel => { srcRows[+sel.dataset.i].w = sel.value; }); q('#pp-rows').querySelectorAll('.pp-sa').forEach(inp => { srcRows[+inp.dataset.i].a = inp.value; }); };
  const read = () => {
    const amt = parseAmt(q('#pp-a').value), fee = parseAmt(q('#pp-f').value), d = q('#pp-t').value;
    const srcs = split ? srcRows.map(r => ({ w: ws.find(x => x.id === r.w), a: parseAmt(r.a) })) : [{ w: ws.find(x => x.id === q('#pp-w').value), a: amt }];
    const big = srcs.reduce((b, x) => (!b || x.a > b.a) ? x : b, null);   // kontribusi terbesar (seri: yang pertama)
    if (split && !feeWTouched && big && big.w) q('#pp-fw').value = big.w.id;
    const feeW = split ? ws.find(x => x.id === q('#pp-fw').value) : srcs[0].w;
    return { amt, fee, d, srcs, feeW, big };
  };
  const overMsg = (amt, mx) => `Melebihi sisa tagihan. Maksimum yang bisa dibayar ${rp(mx)}; kelebihan ${rp(amt - mx)}. Pembayaran ditolak.`;
  const check = R => {
    const e = [], { amt, d, srcs } = R;
    if (!amt) e.push('Isi nominal pokok yang dibayar.'); else if (amt > total) e.push(overMsg(amt, total));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) e.push('Tanggal bayar tidak valid.');
    if (!split) { if (!srcs[0].w) e.push('Pilih dompet.'); return e; }
    if (srcs.length < 2) e.push('Tambah minimal satu sumber lagi, atau pilih "Satu dompet saja".');
    if (srcs.some(x => !x.w)) e.push('Pilih dompet untuk setiap sumber.');
    if (srcs.some(x => !(x.a > 0))) e.push('Nominal setiap sumber harus lebih dari 0.');
    const ids = srcs.filter(x => x.w).map(x => x.w.id); if (new Set(ids).size !== ids.length) e.push('Dompet yang sama dipakai dua kali dalam satu pembayaran.');
    const sum = srcs.reduce((a, x) => a + x.a, 0); if (amt && sum !== amt) e.push(sum < amt ? `Belum dialokasikan ${rp(amt - sum)}: jumlah sumber harus sama persis dengan pokok.` : `Kelebihan ${rp(sum - amt)}: jumlah sumber harus sama persis dengan pokok.`);
    return e;
  };
  const pv = () => {
    const R = read(), { amt, fee, d, srcs, feeW } = R, errs = check(R), ok = q('#pp-ok');
    ok.disabled = errs.length > 0;
    if (errs.length) { q('#pp-pv').innerHTML = errs.map(m => `<span class="hot">${esc(m)}</span>`).join('<br>'); return; }
    const out = {}; srcs.forEach(x => { out[x.w.id] = (out[x.w.id] || 0) + x.a; }); if (fee && feeW) out[feeW.id] = (out[feeW.id] || 0) + fee;
    const lines = Object.keys(out).map(k => { const o = walBal().byId[k], w = ws.find(x => x.id === k), cnt = o && o.auto && stamp(d) > o.since; return cnt ? `Saldo ${esc(w.name)}: ${rp(o.bal)} → <b>${rp(o.bal - out[k])}</b> (−${rp(out[k])})<br>` : `<span class="hot">Tanggal ini sebelum saldo ${esc(w.name)} diisi, atau dompetnya manual: saldo tidak berubah.</span><br>`; });
    q('#pp-pv').innerHTML = `Pokok ${rp(amt)} → sisa tagihan ${rp(total - amt)}${amt === total ? ' <b>(lunas)</b>' : ' <b>(sebagian)</b>'}<br>` + (split ? `Sumber dana: ${srcs.map(x => esc(x.w.name) + ' ' + rp(x.a)).join(' + ')} = ${rp(amt)}<br>` : '') +
      (fee ? `Biaya ${rp(fee)} dicatat sebagai pengeluaran terpisah${split ? ' dari ' + esc(feeW.name) : ''} (Tagihan &amp; Langganan, tag biaya-paylater; bukan pokok)<br>` : '') + lines.join('') +
      (fee ? `Laporan pengeluaran bulan ${esc(d.slice(0, 7))}: +${rp(fee)} (biaya saja)` : 'Laporan pengeluaran tidak berubah.');
  };
  q('#pp-a').addEventListener('input', () => { if (!feeTouched) { const h = hintAt(Math.min(parseAmt(q('#pp-a').value), total)); q('#pp-f').value = h ? NF.format(h) : ''; } pv(); });
  ['#pp-f', '#pp-w', '#pp-t'].forEach(x => q(x).addEventListener('input', pv)); q('#pp-w').addEventListener('change', pv); q('#pp-no').onclick = () => closeSheet();
  q('#pp-fw').addEventListener('change', () => { feeWTouched = true; pv(); });
  q('#pp-rows').addEventListener('input', () => { syncRows(); pv(); }); q('#pp-rows').addEventListener('change', () => { syncRows(); pv(); });
  q('#pp-rows').addEventListener('click', e => { const b = e.target.closest('.pp-rm'); if (!b) return; syncRows(); srcRows.splice(+b.dataset.i, 1); drawRows(); pv(); });
  const setMode = on => { split = on; q('#pp-sp').hidden = !on; q('#pp-w1').hidden = on; q('#pp-fwl').hidden = !on; const sw = q('#pp-splitw'); if (sw) sw.hidden = on; };
  const sp = q('#pp-split'); if (sp) sp.onclick = () => {
    const cur = q('#pp-w').value, other = ws.find(x => x.id !== cur);
    srcRows = [{ w: cur, a: NF.format(parseAmt(q('#pp-a').value) || total) }, { w: other.id, a: '' }]; setMode(true); drawRows(); pv();
  };
  q('#pp-one').onclick = () => { syncRows(); if (srcRows[0]) q('#pp-w').value = srcRows[0].w; feeWTouched = false; setMode(false); pv(); };
  q('#pp-add').onclick = () => {
    syncRows(); if (srcRows.length >= PL_MAX_SRC) return;
    const used = new Set(srcRows.map(r => r.w)), nx = ws.find(x => !used.has(x.id)) || ws[0], left = parseAmt(q('#pp-a').value) - srcRows.reduce((a, r) => a + parseAmt(r.a), 0);
    srcRows.push({ w: nx.id, a: left > 0 ? NF.format(left) : '' }); drawRows(); pv();
  };
  n.onsubmit = e => {
    e.preventDefault(); const R = read(), { amt, fee, srcs, feeW, big } = R, errs = check(R);
    if (errs.length) { toast(errs[0]); return; }
    const A = plAllocate(rows, amt); if (A.error === 'lebih') { toast(overMsg(amt, A.total)); return; } if (A.error) { toast('Isi nominal dan dompetnya dulu'); return; }
    const multi = srcs.length > 1;
    if (multi) { const c = MDSanitize.checkSrc(srcs.map(x => ({ w: x.w.id, a: x.a })), amt); if (c.why) { toast('Sumber dana tidak valid: ' + c.why); return; } }
    if (!autoBackup('Sebelum pembayaran PayLater', { kind: 'bayar' })) { toast(ABK_FAIL); return; }
    const ps = plSnap(), rs = recs.slice(), t = stamp(R.d), pay = { id: 'py' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), t, w: big.w.id, a: amt, alloc: A.alloc, fee: null, n: '' };
    if (multi) pay.src = srcs.map(x => ({ w: x.w.id, a: x.a }));   // pembayaran satu dompet tetap persis seperti dulu (tanpa src)
    if (!commit(() => {   // pokok, semua sumber, alokasi, catatan biaya, dan dompet terakhir: semuanya atau tidak sama sekali
      pay.fee = null;
      if (fee > 0) { const ab = addBatch([{ t, k: 'E', c: 'Tagihan & Langganan', s: '', tg: ['biaya-paylater'], n: 'Biaya PayLater', a: fee, ac: feeW.name }], { skipDup: false }); pay.fee = { rid: ab.ids[0], a: fee, ac: feeW.name }; }
      meta.plPays = [pay].concat(meta.plPays || []); meta.lastWal = big.w.name;
    })) return;
    closeSheet();
    if (plRows().every(r => !r.ex || r.rem <= 0)) celebrate();
    toast('Pembayaran ' + rp(amt + fee) + ' dicatat dari ' + srcs.map(x => x.w.name).join(' + '), () => { if (commit(() => { recs = rs; plUnsnap(ps); })) toast('Dibatalkan'); });
  };
  openSheet('Bayar tagihan PayLater', n); pv();
}
function plPayInfo(id) {
  const y = (meta.plPays || []).find(x => x.id === id); if (!y) return;
  const by = walBal().byId, srcs = plPaySrc(y), multi = srcs.length > 1, fr = plFeeRec(y);
  const ef = srcs.map(x => { const o = by[x.w]; return { x, o, cnt: !!(o && o.auto && y.t > o.since) }; }), e1 = ef[0];
  const items = [...new Set(y.alloc.map(a => a.k.split(':')[0]))].map(k => plGet().find(x => x.id === k)).filter(Boolean);
  const back = multi ? 'Membatalkan <b>seluruh</b> pembayaran (tidak bisa per sumber dana): ' + ef.map(e => e.cnt ? `${esc(e.o.w.name)} ${rp(e.o.bal)} → <b>${rp(e.o.bal + e.x.a)}</b>` : `${esc(plWalName(e.x.w))}: saldo tidak berubah`).join('; ') + '; tagihan kembali belum lunas.'
    : e1.cnt ? `Membatalkan: saldo ${esc(e1.o.w.name)} naik ${rp(y.a)} (${rp(e1.o.bal)} → <b>${rp(e1.o.bal + y.a)}</b>) dan tagihan kembali belum lunas.` : 'Membatalkan: status tagihan kembali; saldo tidak berubah (tanggal sebelum saldo diisi, atau dompet manual/dihapus).';
  const n = el(`<div class="form"><div class="kv"><span>Tanggal</span><b>${esc(y.t.slice(0, 10))}</b></div>
    ${multi ? ef.map(e => `<div class="kv"><span>Dari ${esc(plWalName(e.x.w))}</span><b>${rp(e.x.a)}</b></div>`).join('') : `<div class="kv"><span>Dari dompet</span><b>${esc(plWalName(y.w))}</b></div>`}
    <div class="kv"><span>Pokok dibayar</span><b>${rp(y.a)}</b></div>${y.fee ? `<div class="kv"><span>Bunga / biaya admin${multi && y.fee.ac ? ' (dari ' + esc(y.fee.ac) + ')' : ''}</span><b>${rp(y.fee.a)}</b></div>` : ''}
    ${items.map(it => `<div class="kv"><span>Untuk ${esc(plItemTitle(it))}</span><b>${rp(y.alloc.filter(a => a.k.startsWith(it.id + ':')).reduce((x, a) => x + a.a, 0))}</b></div>`).join('')}
    <div class="hint">${back}${y.fee ? (fr ? ` Catatan biaya ${rp(fr.a)} ikut dihapus.` : ' <span class="hot">Catatan biayanya sudah berubah atau dihapus: tidak ikut dihapus otomatis.</span>') : ''}</div>
    <div class="acts"><button type="button" class="btn-s btn-d" id="py-undo">Batalkan pembayaran</button></div></div>`);
  n.querySelector('#py-undo').onclick = e => confirmBtn(e.target, 'Yakin? Ketuk lagi', () => {
    const f0 = plFeeRec(y); if (f0 && !plDropCheck([f0])) return;   // catatan biaya yang tertaut ke tagihan yang sudah dibayar: pembatalan dihentikan
    if (!autoBackup('Sebelum membatalkan pembayaran PayLater', { kind: 'bayar' })) { toast(ABK_FAIL); return; }
    const ps = plSnap(), rs = recs.slice();
    if (!commit(() => {
      const cur = (meta.plPays || []).find(x => x.id === y.id); if (!cur) return;
      const f = plFeeRec(cur); if (f) { plDropApply([f]); recs = recs.filter(r => r.id !== f.id); }   // hanya catatan biaya milik pembayaran ini
      meta.plPays = meta.plPays.filter(x => x.id !== y.id);   // seluruh event: semua sumber dana kembali sekaligus
    })) return;
    closeSheet(); toast('Pembayaran dibatalkan', () => { if (commit(() => { recs = rs; plUnsnap(ps); })) toast('Dibatalkan'); });
  });
  openSheet('Pembayaran PayLater', n);
}

/* ===== PayLater v2: tautkan transaksi lama ke tagihan (massal) ===== */
function plLinkSheet() {
  const exp = recs.filter(r => r.k === 'E'), accs = [...new Set(exp.map(r => r.ac).filter(Boolean))].sort(), sel = new Set();
  const months = Array.from({ length: 8 }, (_, i) => addM(thisMonth(), i));
  const n = el(`<div class="form" id="lk"><div class="hint">Pilih belanja PayLater yang sudah kamu catat. Transaksinya <b>tidak diubah, dihapus, atau dicatat ulang</b>: hanya ditautkan ke tagihan. Transaksi tertaut tidak lagi memotong saldo dompet; saldo baru berkurang saat tagihan dibayar.</div>
    <label>Akun<select id="lk-ac"><option value="">Semua akun</option>${accs.map(a => `<option>${esc(a)}</option>`).join('')}</select></label>
    <label>Kata kunci <small>(pisahkan koma)</small><input id="lk-q" placeholder="mis. shopee, kipas" autocomplete="off"></label>
    <label>Dari tanggal<input type="date" id="lk-f"></label><label>Sampai tanggal<input type="date" id="lk-t"></label>
    <div class="acts"><button type="button" class="btn-s" id="lk-all">Pilih semua yang tampil</button><button type="button" class="btn-s" id="lk-none">Kosongkan</button></div>
    <div id="lk-list" style="max-height:34vh;overflow:auto"></div>
    <label>Masuk ke tagihan<select id="lk-due"><option value="">Otomatis (tenggat tgl 25 menurut tanggal belanja)</option>${months.map(m => `<option value="${m}">Semua ke tagihan 25 ${esc(plMY(m + '-01'))}</option>`).join('')}</select></label>
    <div class="hint" id="lk-pv" aria-live="polite"></div>
    <div class="acts"><button type="button" class="btn-s" id="lk-no">Batal</button><button type="button" class="btn-p" id="lk-ok" disabled>Tautkan</button></div></div>`);
  const q = x => n.querySelector(x);
  const shown = () => {
    const ac = q('#lk-ac').value, kw = q('#lk-q').value.toLowerCase().split(',').map(x => x.trim()).filter(Boolean), f = q('#lk-f').value, t = q('#lk-t').value, lkd = plRes().linked;
    return exp.filter(r => !lkd.has(r.id) && (!ac || r.ac === ac) && (!f || r.t.slice(0, 10) >= f) && (!t || r.t.slice(0, 10) <= t) && (!kw.length || kw.some(w => (cn(r.n) + ' ' + cn(r.c) + ' ' + (r.s || '')).toLowerCase().includes(w))));
  };
  const picked = () => recs.filter(r => sel.has(r.id));
  const draw = () => {
    const list = shown(), top = list.slice(0, 150);
    q('#lk-list').innerHTML = (top.length ? top.map(r => `<label class="chk"><input type="checkbox" data-id="${esc(r.id)}"${sel.has(r.id) ? ' checked' : ''}> <span>${esc(r.t.slice(0, 10))} · ${esc(cn(r.n) || '-')} · ${esc(r.ac)} · <b>${rp(r.a)}</b></span></label>`).join('') : '<div class="empty">Tidak ada transaksi yang cocok.</div>') + (list.length > top.length ? `<div class="hint">Menampilkan ${top.length} dari ${list.length}. Persempit filter untuk melihat sisanya.</div>` : '');
    q('#lk-list').dataset.n = list.length; pv();
  };
  const plan = () => {
    const ch = picked(), due = q('#lk-due').value, items = PL.buildItems(ch, recs, { forceYm: due || undefined }), eff = linkEffect({ wallets: meta.wallets, selected: ch, wkey }), bal = {}; walBal().list.forEach(o => { bal[o.w.name] = o.bal; });
    return { ch, items, eff, bal, total: ch.reduce((a, r) => a + r.a, 0) };
  };
  const pv = () => {
    const P = plan(), ok = q('#lk-ok'); ok.disabled = !P.ch.length;
    if (!P.ch.length) { q('#lk-pv').textContent = 'Belum ada transaksi yang dipilih.'; return; }
    const effs = Object.keys(P.eff);
    q('#lk-pv').innerHTML = `<b>${NF.format(P.ch.length)} transaksi · ${rp(P.total)}</b><br>` + P.items.map(it => `Tagihan ${esc(plDM(plDue(it, 0)))} ${esc(plDue(it, 0).slice(0, 4))}: ${rp(it.a)} (${it.src.length} transaksi)`).join('<br>') + '<br>' +
      (effs.length ? '<b>Koreksi saldo</b> (belanja ini sebelumnya sudah memotong saldo padahal uangnya belum keluar):<br>' + effs.map(w => `${esc(w)}: ${rp(P.bal[w])} → <b>${rp(P.bal[w] + P.eff[w])}</b> (+${rp(P.eff[w])})`).join('<br>') : 'Saldo dompet tidak berubah.');
  };
  const doLink = () => {
    const P = plan(); if (!P.ch.length) return;
    if (!autoBackup('Sebelum tautan massal PayLater (' + P.ch.length + ' transaksi)', { kind: 'tautan' })) { toast(ABK_FAIL); return; }
    const ps = plSnap(), ids = new Set(plGet().map(x => x.id)); P.items.forEach(it => { while (ids.has(it.id)) it.id += 'x'; ids.add(it.id); });
    if (!commit(() => { meta.pl = plGet().concat(P.items); })) return;
    closeSheet();
    toast(NF.format(P.ch.length) + ' transaksi ditautkan · ' + rp(P.total), () => { if (commit(() => { plUnsnap(ps); })) toast('Dibatalkan'); });
  };
  q('#lk-list').onchange = e => { const c = e.target.closest('input[data-id]'); if (!c) return; if (c.checked) sel.add(c.dataset.id); else sel.delete(c.dataset.id); pv(); };
  ['#lk-ac', '#lk-f', '#lk-t'].forEach(x => q(x).addEventListener('change', draw)); q('#lk-q').addEventListener('input', draw); q('#lk-due').addEventListener('change', pv);
  q('#lk-all').onclick = () => { shown().forEach(r => sel.add(r.id)); draw(); }; q('#lk-none').onclick = () => { sel.clear(); draw(); };
  q('#lk-no').onclick = () => closeSheet();
  q('#lk-ok').onclick = () => { const P = plan(); if (Object.keys(P.eff).length) confirmBtn(q('#lk-ok'), 'Ketuk lagi: naikkan saldo & tautkan', doLink); else doLink(); };
  openSheet('Tautkan transaksi lama', n); draw();
}
/* lepas semua tautan sebuah tagihan: transaksi kembali memotong saldo seperti biasa. Diblokir bila sudah ada pembayaran. */
function plUnlinkItem(it) {
  if (isHist(it)) { toast('Tagihan historis tidak bisa dilepas atau dihapus dari sini. Pakai Cocokkan ulang.'); return; }   // jalur lain tidak boleh menghapus/mengubah klasifikasi item hist
  if (isRcId(it.id)) { toast('Tagihan ber-id rekonsiliasi tidak bisa dilepas atau dihapus dari sini.'); return; }   // termasuk item rc... anomali yang penanda hist-nya terlepas
  if (plItemPaid(it)) { toast('Tagihan ini sudah ada pembayarannya. Batalkan pembayaran dulu.'); return; }
  const res = plRes(), sel = []; res.by.forEach((v, id) => { if (v.item === it) { const r = recs.find(x => x.id === id); if (r) sel.push(r); } });
  const eff = linkEffect({ wallets: meta.wallets, selected: sel, wkey }), bal = {}; walBal().list.forEach(o => { bal[o.w.name] = o.bal; });
  const ln = Object.keys(eff).map(w => `${esc(w)}: ${rp(bal[w])} → <b>${rp(bal[w] - eff[w])}</b> (−${rp(eff[w])})`).join('<br>');
  ask('Lepas tautan?', `<b>${esc(plItemTitle(it))}</b> dilepas. ${it.stmt ? 'Transaksinya tidak dihapus.' : 'Catatan transaksinya tetap ada.'} Transaksi kembali memotong saldo dompet seperti biasa.` + (ln ? '<br><br><b>Saldo setelah dilepas:</b><br>' + ln : '<br>Saldo dompet tidak berubah.'), 'Lepas tautan', () => {
    if (!autoBackup('Sebelum lepas tautan PayLater', { kind: 'lepas' })) { toast(ABK_FAIL); return; }
    const ps = plSnap(); if (!commit(() => { meta.pl = plGet().filter(x => x.id !== it.id); })) return;
    toast('Tautan dilepas', () => { if (commit(() => { plUnsnap(ps); })) toast('Dibatalkan'); });
  });
}
/* lembar tagihan tertaut: ringkasan, transaksi yang ditautkan, tautan yang perlu ditinjau */
function plExSheet(it) {
  if (isHist(it)) return plHistSheet(it);   // item hist: hanya info + Cocokkan ulang
  const res = plRes(), rows = plRows().filter(r => r.p === it), D = rows.reduce((a, r) => a + r.D, 0), got = rows.reduce((a, r) => a + r.got, 0);
  const mine = []; res.by.forEach((v, id) => { if (v.item === it) { const r = recs.find(x => x.id === id); if (r) mine.push(r); } });
  const bad = res.bad.filter(b => b.item === it), pays = (meta.plPays || []).filter(y => y.alloc.some(a => a.k.startsWith(it.id + ':')));
  const n = el(`<div class="form"><div class="kv"><span>Tenggat</span><b>${esc(plDM(plDue(it, 0)))} ${esc(plDue(it, 0).slice(0, 4))}${it.k > 1 ? ' · ' + it.k + ' cicilan' : ''}</b></div>
    <div class="kv"><span>Pokok tagihan</span><b>${rp(D)}</b></div><div class="kv"><span>Sudah dibayar</span><b>${rp(got)}</b></div><div class="kv"><span>Sisa</span><b>${rp(D - got)}</b></div>
    <h3 class="sec">Transaksi tertaut (${mine.length})</h3><div style="max-height:30vh;overflow:auto">${mine.map(r => `<div class="kv"><span>${esc(r.t.slice(0, 10))} · ${esc(cn(r.n) || '-')} · ${esc(r.ac)}</span><b>${rp(r.a)}</b></div>`).join('') || '<div class="empty">Tidak ada.</div>'}</div>
    ${bad.length ? `<div class="hint hot"><b>Perlu ditinjau:</b> ${bad.length} tautan tidak ketemu transaksinya (nominal, tanggal, nama, atau akunnya berubah, atau sudah dihapus). Nilainya tetap dihitung di tagihan sampai kamu melepasnya.</div>${bad.map(b => `<div class="kv"><span>${esc(b.src.t.slice(0, 10))} · ${esc(b.src.n || '-')}</span><b>${rp(b.src.a)}</b></div>`).join('')}<div class="acts"><button type="button" class="btn-s" id="ex-fix">Lepas tautan yang hilang</button></div>` : ''}
    ${pays.length ? `<h3 class="sec">Pembayaran</h3>${pays.map(y => `<button type="button" class="sim-r ex-pay" data-id="${esc(y.id)}" style="width:100%;text-align:left"><span class="sim-m"><b>${esc(y.t.slice(0, 10))} · ${esc(plPayWals(y))}</b><small>${y.fee ? 'biaya ' + rp(y.fee.a) : 'pokok'}</small></span><span class="sim-a">${rp(y.alloc.filter(a => a.k.startsWith(it.id + ':')).reduce((x, a) => x + a.a, 0))}</span></button>`).join('')}` : ''}
    <div class="acts">${isRcId(it.id) ? '<div class="hint" style="margin:0">Tagihan ber-id rekonsiliasi (rc…) tidak bisa dilepas atau dihapus dari sini.</div>' : '<button type="button" class="btn-s btn-d" id="ex-unl">Lepas tautan</button>'}${D - got > 0 ? '<button type="button" class="btn-p" id="ex-pay">Bayar</button>' : ''}</div></div>`);
  const fx = n.querySelector('#ex-fix'); if (fx) fx.onclick = () => {
    if (plItemPaid(it)) { toast('Tagihan ini sudah ada pembayarannya.'); return; }
    if (!autoBackup('Sebelum melepas tautan PayLater yang hilang', { kind: 'ubah' })) { toast(ABK_FAIL); return; }
    const ps = plSnap();
    if (!commit(() => {   // dicari ulang lewat id: aman bila ada rollback sebelumnya
      const cur = plGet().find(x => x.id === it.id); if (!cur) return;
      const lost = PL.resolve(recs, plGet()).bad.filter(b => b.item === cur).map(b => b.src); cur.src = cur.src.filter(s => !lost.includes(s));
      plSyncItem(cur, mine[0] || { n: cur.n, t: cur.o, a: cur.a, c: cur.c, ac: cur.w }); plPrune();
    })) return;
    closeSheet(); toast('Tautan yang hilang dilepas', () => { if (commit(() => { plUnsnap(ps); })) toast('Dibatalkan'); });
  };
  const unl = n.querySelector('#ex-unl'); if (unl) unl.onclick = () => { closeSheet(); plUnlinkItem(it); };
  const bp = n.querySelector('#ex-pay'); if (bp) bp.onclick = () => { closeSheet(); plPaySheet({ item: it.id }); };
  n.querySelectorAll('.ex-pay').forEach(b => { b.onclick = () => { closeSheet(); plPayInfo(b.dataset.id); }; });
  openSheet(plItemTitle(it), n);
}

function plRowHTML(r, td) {
  const late = r.due < td && r.rem > 0, amt = r.ex ? (r.rem > 0 ? r.rem : r.D) : r.p.a;
  const st = (late ? 'Lewat tenggat · ' : '') + 'tenggat ' + plDM(r.due) + (r.p.k > 1 ? ' · cicilan ' + (r.i + 1) + '/' + r.p.k : '') + (r.ex ? (r.got > 0 && r.rem > 0 ? ' · terbayar ' + rp(r.got) : '') + (isHist(r.p) ? ' · historis' : ' · tertaut') : '');
  return `<div class="sim-r"><button type="button" class="sim-m pl-m" data-id="${esc(r.p.id)}"><b>${esc(r.p.n)}</b><small${late ? ' class="hot"' : ''}>${esc(st)}</small></button><span class="sim-a">${rp(amt)}</span>${r.ex ? '' : `<button type="button" class="btn-s pl-pay" data-k="${esc(r.p.id)}:${r.i}">Bayar</button>`}</div>`;
}
/* Rekap PayLater: per bulan jatuh tempo (tagihan lama + baru digabung), status belum / sebagian / telat / lunas */
function plHTML() {
  const rows = plRows(), td = plToday(), tm = thisMonth(), ps = plGet(), ms = plMonths(rows, tm), open = ms.filter(m => m.rem > 0), hz = addM(tm, 3);
  const shown = open.filter(m => m.ym <= hz), rest = open.filter(m => m.ym > hz), tot = open.reduce((a, m) => a + m.rem, 0), bad = plRes().bad;
  let h = '<h2 class="sec">Tagihan paylater</h2><div class="bud sim-card">';
  if (!ps.length) h += '<div class="empty">Belum ada. Tautkan belanja PayLater yang sudah kamu catat, atau tambah belanja baru (dicatat sebagai pengeluaran saat beli).</div>';
  else if (!open.length) h += '<div class="empty">Semua tagihan sudah lunas.</div>';
  else h += `<div class="hint" style="margin-top:0">Belum dibayar <b>${rp(tot)}</b> · sampai bulan ini ${rp(open.filter(m => m.ym <= tm).reduce((a, m) => a + m.rem, 0))} · bulan depan ${rp((open.find(m => m.ym === addM(tm, 1)) || { rem: 0 }).rem)}</div>`;
  const rcs = meta.plRecon || {};   // ringkasan rekonsiliasi: periode yang masih terbuka atau yang simulasinya berubah sejak dicocokkan
  Object.keys(rcs).sort().forEach(k => {
    const q = plReconStatus(rcs, k, ps, meta.plPays); if (!(q.rem > 0 || q.stale)) return;
    h += `<div class="hint" style="margin-top:0">Cocok dengan Shopee · tagihan 25 ${esc(plMY(k + '-01'))}: <b>${rp(q.x)}</b>${q.t ? ' · dicek ' + esc(plDM(q.t.slice(0, 10))) : ''}${q.stale ? ` · <b class="hot">simulasi berubah (dulu ${rp(q.sim)}, sekarang ${rp(q.terwakili)})</b> <button type="button" class="btn-s pl-rcb" data-ym="${k}">Cocokkan ulang</button>` : ''}</div>`;
  });
  if (bad.length) h += `<div class="hint hot"><b>Perlu ditinjau:</b> ${bad.length} tautan transaksi tidak ketemu pasangannya (transaksi diedit atau dihapus). Ketuk tagihan yang bertanda untuk merapikannya.</div>`;
  shown.forEach(m => {
    const lbl = plMY(m.ym + '-01'), chip = m.late ? '<span class="hot">Telat</span>' : m.st === 'sebagian' ? 'Sebagian' : 'Belum dibayar';
    h += `<div class="bud-t pl-mo"><span>${esc(lbl)}</span><b>${rp(m.rem)}</b></div><div class="hint" style="margin-top:0">${chip} · total ${rp(m.D)} · terbayar ${rp(m.got)}</div>`;
    if (m.rows.some(r => r.ex && r.rem > 0)) h += `<div class="acts"><button type="button" class="btn-s pl-paym" data-ym="${m.ym}">Bayar tagihan 25 ${esc(lbl)}</button></div>`;
    h += m.rows.filter(r => r.rem > 0).map(r => plRowHTML(r, td)).join('');
  });
  if (rest.length) h += `<div class="hint">Dan ${rest.reduce((a, m) => a + m.rows.filter(r => r.rem > 0).length, 0)} cicilan lagi sampai ${esc(plMY(rest[rest.length - 1].ym + '-01'))} (${rp(rest.reduce((a, m) => a + m.rem, 0))}).</div>`;
  const done = rows.filter(r => r.rem <= 0);
  if (done.length) {
    h += `<div class="acts"><button type="button" class="btn-s" id="pl-hist">${plShowPaid ? 'Sembunyikan yang lunas' : 'Lihat yang sudah lunas (' + done.length + ')'}</button></div>`;
    if (plShowPaid) h += done.map(r => `<div class="sim-r"><button type="button" class="sim-m pl-m" data-id="${esc(r.p.id)}"><b>${esc(r.p.n)}</b><small>Lunas${r.p.k > 1 ? ' · cicilan ' + (r.i + 1) + '/' + r.p.k : ''} · tenggat ${esc(plDM(r.due))}</small></button><span class="sim-a">${rp(r.ex ? r.D : r.p.a)}</span>${r.ex ? '' : `<button type="button" class="btn-s pl-undo" data-k="${esc(r.p.id)}:${r.i}">Batalkan lunas</button>`}</div>`).join('') + '<div class="hint">Batalkan lunas pada cicilan lama hanya mengembalikan status; catatan pengeluarannya tidak dihapus. Pembayaran tagihan tertaut dibatalkan dari rinciannya (ketuk barisnya).</div>';
  }
  const pm = plMonthDue(); if (pm) h += `<div class="hint">Tagihan sampai bulan ini (${rp(pm)}) sudah termasuk di Total rencana. Belanja yang bertanda “tertaut” sudah tercatat sebagai pengeluaran saat dibeli: Bayar hanya mengurangi saldo. Cicilan lama tanpa tanda itu dicatat sebagai pengeluaran saat kamu menekan Bayar.</div>`;
  return h + '<div class="acts"><button type="button" class="btn-s" id="pl-link">Tautkan transaksi lama</button><button type="button" class="btn-s" id="pl-rc">Cocokkan dengan Shopee</button><button type="button" class="btn-s" id="pl-new">+ Tambah paylater</button></div></div>';
}
/* ===== Cocokkan dengan Shopee (Tahap 3). Menulis HANYA item hist di meta.pl dan meta.plRecon; tidak menyentuh transaksi, pembayaran, fee, alokasi, atau saldo. ===== */
/* id berawalan 'rc' hanya dibuat oleh rekonsiliasi (rcYYYY-MM); aplikasi tidak pernah membuat id PayLater lain berawalan itu (pl..., st...) */
function isRcId(id) { return /^rc/.test(String(id)); }
function plHistSheet(it) {   // item hist: hanya informasi + Cocokkan ulang (tidak bisa diedit, dihapus, atau dilepas)
  const ym = it.id.slice(2), rows = plRows().filter(r => r.p === it), D = rows.reduce((a, r) => a + r.D, 0), got = rows.reduce((a, r) => a + r.got, 0), due = plDue(it, 0);
  const n = el(`<div class="form"><div class="hint">Ini <b>tagihan historis</b>: selisih antara tagihan di Shopee dan simulasi. Tidak dicatat sebagai pengeluaran. Tidak bisa diedit, dihapus, atau dilepas dari sini; ubah lewat <b>Cocokkan ulang</b>.</div>
    <div class="kv"><span>Tenggat</span><b>${esc(plDM(due))} ${esc(due.slice(0, 4))}</b></div><div class="kv"><span>Tagihan historis</span><b>${rp(D)}</b></div><div class="kv"><span>Sudah dibayar</span><b>${rp(got)}</b></div><div class="kv"><span>Sisa</span><b>${rp(D - got)}</b></div>
    <div class="acts"><button type="button" class="btn-p" id="hs-rc">Cocokkan ulang</button></div></div>`);
  n.querySelector('#hs-rc').onclick = () => { closeSheet(); plReconSheet(ym); };
  openSheet('Tagihan historis', n);
}
function plReconSheet(ym0) {
  const tm = thisMonth(), yms = plReconPeriods(plGet(), meta.plPays, meta.plRecon, tm), open = plRows().filter(r => r.rem > 0).map(r => r.due.slice(0, 7));
  const first = yms.includes(ym0) ? ym0 : (yms.find(m => open.includes(m)) || tm);
  const n = el(`<div class="form" id="rc"><div class="hint">Samakan dengan tagihan yang tampil di aplikasi Shopee. Selisih antara tagihan Shopee dan simulasi jadi <b>tagihan historis</b>: dihitung sebagai kewajiban, <b>tidak</b> dicatat sebagai pengeluaran dan tidak mengubah saldo dompet. Pembayaran tagihan historis dianggap tanpa biaya tambahan; biaya yang baru muncul saat Bayar tidak masuk kewajiban. Kalau rencana pengeluaranmu sudah memuat cicilan PayLater yang sama, angkanya bisa tercatat dobel di dua tempat.</div>
    <label>Periode<select id="rc-ym">${yms.map(m => `<option value="${m}"${m === first ? ' selected' : ''}>Tagihan 25 ${esc(plMY(m + '-01'))}</option>`).join('')}</select></label>
    <div class="ccs" id="rc-mode"><button type="button" class="cc on" data-m="total">Total tagihan</button><button type="button" class="cc" data-m="sisa">Sisa tagihan</button></div>
    <label>Nominal (Rp)<div class="amtbox"><span class="rpx">Rp</span><input class="amt" id="rc-a" inputmode="numeric" placeholder="0" aria-label="Nominal (Rp)"></div></label>
    <div class="hint" id="rc-pv" aria-live="polite"></div>
    <div class="acts"><button type="button" class="btn-s" id="rc-no">Batal</button><button type="button" class="btn-p" id="rc-ok" disabled>Simpan</button></div></div>`);
  const inp = n.querySelector('#rc-a'), sel = n.querySelector('#rc-ym'), pv = n.querySelector('#rc-pv'), okb = n.querySelector('#rc-ok');
  bindAmtInput(inp);
  let mode = 'total', shown = null;
  const calc = () => {   // selalu dari keadaan data TERKINI
    const ym = sel.value, st = plPeriodStats(plGet(), meta.plPays, ym), prev = (meta.plRecon || {})[ym] || null;
    const conflict = plGet().some(x => x.id === plHistId(ym) && !isHist(x));   // id rc... milik item bukan-hist (anomali): jangan membuat id ganda
    if (!inp.value.trim()) return { ym, mode, empty: true, st, prev, conflict };
    return { ym, mode, empty: false, st, prev, conflict, r: plReconcile(plGet(), meta.plPays, ym, { mode, value: parseAmt(inp.value) }, prev, { t: nowLocal() }) };
  };
  const ERR = { nominal: () => 'Isi nominal bulat yang valid (untuk Total tagihan harus lebih dari 0).', periode: () => 'Periode tidak valid.', mode: () => 'Pilih Total atau Sisa tagihan.',
    kurang: r => `Tagihan Shopee lebih kecil dari yang sudah kamu bayar (${rp(r.paid)}). Periksa angkanya, atau batalkan pembayarannya dulu.`,
    kurang_hist: r => `Bagian historis (${rp(r.hist)}) lebih kecil dari yang sudah dibayar ke tagihan historis (${rp(r.histGot)}). Periksa angkanya.` };
  const render = () => {
    const c = calc(); shown = c; const st = c.st, ri = plReconRows(plGet(), meta.plPays, c.ym, 5);
    let h = `<div>Simulasi periode ini mencakup <b>${rp(st.terwakili)}</b>${ri.total ? ': ' + ri.rows.map(x => esc(x.n) + ' ' + rp(x.a)).join(', ') + (ri.more ? ` dan ${ri.more} baris lainnya` : '') : ' (belum ada cicilan di periode ini)'}. Sudah dibayar <b>${rp(st.paid)}</b>.</div>`;
    if (c.prev) h += `<div>Terakhir dicocokkan${c.prev.t ? ' ' + esc(plDM(c.prev.t.slice(0, 10))) : ''}: tagihan Shopee ${rp(c.prev.x)}${c.prev.sim !== st.terwakili ? ` · <b class="hot">simulasi berubah sejak itu (dulu ${rp(c.prev.sim)})</b>` : ''}.</div>`;
    let can = false;
    if (c.conflict) h += `<div class="hot"><b>Ada tagihan lain ber-id sama dengan tagihan historis periode ini (data tidak sah).</b> Cocokkan dinonaktifkan untuk periode ini supaya tidak ada yang tertimpa. Lihat catatan data PayLater.</div>`;
    else if (!c.empty && !c.r.ok) h += `<div class="hot"><b>${esc((ERR[c.r.error] || (() => 'Tidak bisa disimpan.'))(c.r))}</b></div>`;
    else if (!c.empty) {
      const r = c.r; can = true;
      h += `<div class="kv"><span>Tagihan Shopee</span><b>${rp(r.x)}</b></div><div class="kv"><span>Sudah dicakup simulasi</span><b>${rp(r.terwakili)}</b></div><div class="kv"><span>Selisih jadi tagihan historis</span><b>${rp(r.hist)}</b></div>`;
      h += '<div>' + (!r.changed ? '<b>Sudah cocok</b>: tidak ada yang berubah.' : r.action === 'add' ? 'Dibuat tagihan historis baru.' : r.action === 'update' ? `Tagihan historis diperbarui dari ${rp(st.histA)}.` : r.action === 'remove' ? `Tagihan historis ${rp(st.histA)} dihapus karena tidak ada selisih lagi.` : 'Tagihan historis tidak berubah; hanya catatan pencocokan yang disimpan.') + '</div>';
      if (r.warn === 'sim_lebih') h += `<div class="hot">Simulasi (${rp(r.terwakili)}) lebih besar dari tagihan Shopee. Tidak ada yang dikurangi atau dihapus; periksa apakah ada cicilan di simulasi yang tidak muncul di Shopee.</div>`;
    }
    pv.innerHTML = h; okb.disabled = !can;
  };
  n.querySelector('#rc-mode').onclick = e => { const b = e.target.closest('button'); if (!b) return; mode = b.dataset.m; n.querySelectorAll('#rc-mode .cc').forEach(x => x.classList.toggle('on', x === b)); render(); };
  sel.addEventListener('change', render); inp.addEventListener('input', render);
  n.querySelector('#rc-no').onclick = () => closeSheet();
  okb.onclick = () => {
    const was = shown, now = calc();
    if (now.conflict || now.empty || !now.r.ok) { render(); return; }
    const seen = was && !was.empty && was.r && was.r.ok ? was.r : null, diff = plReconChanged(seen, now.r);
    if (!seen || diff.length) {   // hasil berbeda dari pratinjau yang tampil: jangan simpan, minta ditinjau ulang
      render(); const NM = { x: 'tagihan Shopee', terwakili: 'dicakup simulasi', hist: 'tagihan historis', paid: 'terbayar', action: 'tindakan', warn: 'peringatan', ok: 'status', error: 'galat' };
      pv.insertAdjacentHTML('afterbegin', `<div class="hint hot"><b>Hasilnya berubah sejak pratinjau.</b> ${diff.filter(d => !['action', 'warn', 'ok', 'error'].includes(d.k)).map(d => `${NM[d.k]}: ${d.from == null ? '-' : rp(d.from)} → ${d.to == null ? '-' : rp(d.to)}`).join('; ') || 'Tinjau angkanya lagi'}. Tinjau lagi, lalu tekan Simpan.</div>`);
      return;
    }
    const r = now.r, ym = now.ym;
    if (!r.changed) { closeSheet(); toast('Sudah cocok, tidak ada yang berubah'); return; }   // nominal sama: tanpa item, log, cadangan, atau penyimpanan baru
    if (!autoBackup('Sebelum cocokkan tagihan SPayLater', { kind: 'cocokkan' })) { toast(ABK_FAIL); return; }
    const ps = plSnap(), id = plHistId(ym);
    if (!commit(() => {
      const cur = plGet();
      if (r.action === 'add') meta.pl = cur.concat([r.item]);
      else if (r.action === 'update') meta.pl = cur.map(it => (it.id === id && isHist(it)) ? { ...it, a: r.item.a } : it);
      else if (r.action === 'remove') meta.pl = cur.filter(it => !(it.id === id && isHist(it)));
      meta.plRecon = { ...(meta.plRecon || {}), [ym]: r.recon };
    })) return;
    closeSheet();
    toast(r.action === 'add' ? `Dicocokkan. Tagihan historis ${rp(r.hist)} dibuat` : r.action === 'update' ? `Dicocokkan. Tagihan historis jadi ${rp(r.hist)}` : r.action === 'remove' ? 'Dicocokkan. Tagihan historis dihapus' : 'Dicocokkan', () => { if (commit(() => { plUnsnap(ps); })) toast('Dibatalkan'); });
  };
  render(); openSheet('Cocokkan dengan Shopee', n);
}
function plBind(box) {
  const nw = box.querySelector('#pl-new'); if (nw) nw.onclick = () => plSheet(null);
  box.querySelectorAll('.pl-paym').forEach(b => { b.onclick = () => plPaySheet({ ym: b.dataset.ym }); });
  const lkb = box.querySelector('#pl-link'); if (lkb) lkb.onclick = () => plLinkSheet();
  const rcb = box.querySelector('#pl-rc'); if (rcb) rcb.onclick = () => plReconSheet();
  box.querySelectorAll('.pl-rcb').forEach(b => { b.onclick = () => plReconSheet(b.dataset.ym); });
  box.querySelectorAll('.pl-m').forEach(b => { b.onclick = () => { const p = plGet().find(x => x.id === b.dataset.id); if (p) (p.ex ? plExSheet(p) : plSheet(p)); }; });
  box.querySelectorAll('.pl-pay').forEach(b => { b.onclick = () => plPay(b.dataset.k); });
  const hb = box.querySelector('#pl-hist'); if (hb) hb.onclick = () => { plShowPaid = !plShowPaid; renderPlan(); };
  box.querySelectorAll('.pl-undo').forEach(b => { b.onclick = () => {
    if (!autoBackup('Sebelum membatalkan lunas cicilan PayLater lama', { kind: 'ubah' })) { toast(ABK_FAIL); return; }
    if (commit(() => plUnmark(b.dataset.k))) toast('Kembali jadi belum lunas');
  }; });
}
function plPay(key) {   // buka form Catat dengan isian terisi; cicilan baru ditandai lunas setelah catatan benar-benar disimpan
  const [id, i] = key.split(':'), p = plGet().find(x => x.id === id); if (!p) return;
  formSheet();
  const q = x => document.querySelector('#sheet-body ' + x), fa = q('#fm-a'), fn = q('#fm-n'), fc = q('#fm-c'), fw = q('#fm-ac'), fm = q('form');
  if (fa) fa.value = fmtAmt(p.a); if (fn) fn.value = p.n + (p.k > 1 ? ' (paylater ' + (+i + 1) + '/' + p.k + ')' : ' (paylater)');
  if (fc && p.c && [...fc.options].some(o => o.value === p.c)) fc.value = p.c;
  if (fw && p.w && [...fw.options].some(o => o.value === p.w)) fw.value = p.w;
  const ft = q('#fm-t'), wl = meta.wallets.find(w => wkey(w.name) === wkey(p.w)), tt = p.o + 'T' + nowLocal().slice(11, 16);   // tanggal catatan = tanggal order (belanja dihitung di bulan belinya)
  const sinceOk = !wl || !wl.since || tt.slice(0, 16) > String(wl.since).slice(0, 16);   // transaksi sebelum patokan saldo dompet tidak mengurangi saldo, jadi pakai hari ini saja
  if (ft && tt <= nowLocal() && !sinceOk) toast('Tanggal order sebelum saldo ' + wl.name + ' diisi, jadi catatan memakai hari ini');
  if (ft && tt <= nowLocal() && sinceOk) { ft.value = tt; ft.dispatchEvent(new Event('input', { bubbles: true })); toast('Tanggal catatan = tanggal order (' + plDM(p.o) + '). Ubah di Waktu & tag kalau perlu'); }
  if (fm) fm.dataset.pl = key;
}
function plSheet(p) {
  const cs = [...new Set(recs.filter(r => r.k === 'E').map(r => r.c).concat(Object.keys(meta.cats)))].filter(Boolean).sort((a, b) => cat(a).localeCompare(cat(b))), defC = p ? p.c : (cs.find(c => /belanja|shop/i.test(c)) || cs[0] || '');
  const ws = meta.wallets.map(w => w.name), defW = p ? p.w : (ws.find(x => /shopee/i.test(x)) || ws[0] || '');
  const sched = p ? `<div class="hint plx-h">${Array.from({ length: p.k }, (_, i) => { const d = plDue(p, i); return (i + 1) + '/' + p.k + ' · ' + plDM(d) + ' ' + d.slice(0, 4) + ' · ' + ((p.d || {})[i] ? '✓ lunas' : 'belum'); }).join('<br>')}</div>` : '';
  const v2 = !p;   // item baru: dicatat sebagai pengeluaran sekarang dan tertaut ke tagihan; item lama (tanpa ex) tetap memakai form lama
  const n = el(`<form class="form" autocomplete="off"><label>Nama belanjaan<input id="pl-n" maxlength="40" value="${p ? esc(p.n) : ''}" placeholder="mis. Sepatu"></label>
    ${v2 ? `<label>Harga barang (Rp)<input class="amt" id="pl-p" inputmode="numeric" placeholder="dicatat sebagai pengeluaran"></label>` : ''}
    <label>${v2 ? 'Cicilan per bulan dari Shopee (Rp) <small>opsional; kosong = harga dibagi jumlah cicilan. Selisih dengan pokok = bunga/admin, dicatat terpisah saat membayar.</small>' : 'Cicilan per bulan (Rp)'}<input class="amt" id="pl-a" inputmode="numeric" value="${p ? NF.format(p.a) : ''}" placeholder="angka dari aplikasi Shopee"></label>
    <label>Jumlah cicilan <small>(1 = bayar sekali)</small><input id="pl-k" type="number" inputmode="numeric" min="1" max="60" value="${p ? p.k : 1}"></label>
    <div class="ccs plx-q" id="pl-kq">${[1, 3, 6, 12].map(x => `<button type="button" class="cc" data-k="${x}">${x}x</button>`).join('')}</div>
    <label>Tanggal order<input id="pl-o" type="date" value="${p ? p.o : plToday()}"></label>
    <label>Kategori<select id="pl-c">${cs.map(c => `<option value="${esc(c)}"${defC === c ? ' selected' : ''}>${esc(cat(c))}</option>`).join('')}</select></label>
    <label>Dibayar dari dompet<select id="pl-w">${ws.map(w => `<option${w === defW ? ' selected' : ''}>${esc(w)}</option>`).join('')}</select></label>
    <div class="hint plx-h" id="pl-pv"></div>${sched}
    <div class="acts">${p ? '<button type="button" class="btn-s btn-d" id="pl-del">Hapus</button>' : ''}<button type="submit" class="btn-p">Simpan</button></div></form>`);
  bindAmtInput(n.querySelector('#pl-a')); if (v2) bindAmtInput(n.querySelector('#pl-p'));
  const pv = () => { const o = n.querySelector('#pl-o').value, k = Math.min(60, Math.max(1, +n.querySelector('#pl-k').value || 1)); if (!/^\d{4}-\d{2}-\d{2}$/.test(o)) { n.querySelector('#pl-pv').textContent = ''; return; }
    const t = { o, k }, d0 = plDue(t, 0), d1 = plDue(t, k - 1); n.querySelector('#pl-pv').textContent = 'Tenggat pertama ' + plDM(d0) + ' ' + d0.slice(0, 4) + (k > 1 ? ', terakhir ' + plDM(d1) + ' ' + d1.slice(0, 4) : ''); };
  n.querySelector('#pl-kq').onclick = e => { const b = e.target.closest('button'); if (!b) return; n.querySelector('#pl-k').value = b.dataset.k; pv(); };
  ['#pl-o', '#pl-k'].forEach(x => n.querySelector(x).addEventListener('input', pv)); pv();
  n.querySelector('form').onsubmit = e => { e.preventDefault();
    const pr = v2 ? parseAmt(n.querySelector('#pl-p').value) : 0, nm = n.querySelector('#pl-n').value.trim().slice(0, 40), o = n.querySelector('#pl-o').value, k = Math.min(60, Math.max(1, Math.round(+n.querySelector('#pl-k').value) || 1));
    const a = v2 ? (parseAmt(n.querySelector('#pl-a').value) || (k > 1 ? Math.round(pr / k) : pr)) : parseAmt(n.querySelector('#pl-a').value);
    if (!nm) { toast('Isi nama belanjaannya dulu'); return; } if (v2 ? !pr : !a) { toast(v2 ? 'Isi harga barangnya dulu' : 'Isi cicilan per bulannya dulu'); return; } if (!/^\d{4}-\d{2}-\d{2}$/.test(o)) { toast('Isi tanggal order dulu'); return; }
    const v = { n: nm, a, k, o, c: n.querySelector('#pl-c').value, w: (n.querySelector('#pl-w') || {}).value || '' };
    if (v2) {   // pengeluaran sebesar harga pada tanggal order + tagihan tertaut
      const ps = plSnap(), rs = recs.slice(), t = o + 'T' + (o === plToday() ? nowLocal().slice(11, 16) + ':' + p2(new Date().getSeconds()) : '12:00:00');
      if (!autoBackup('Sebelum belanja PayLater baru', { kind: 'beli' })) { toast(ABK_FAIL); return; }
      let it = null;
      if (!commit(() => {
        const ab = addBatch([{ t, k: 'E', c: v.c, s: '', tg: [], n: nm, a: pr, ac: v.w }], { skipDup: false }), nr = recs.find(x => x.id === ab.ids[0]);
        it = { id: 'pl' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), n: nm, a, k, o, c: v.c, w: v.w, d: {}, ex: true, src: [PL.srcOf(recs, nr)] }; if (k > 1) it.pr = pr; plGet().push(it);
      })) return;
      closeSheet(); toast('Dicatat ' + rp(pr) + ' · tagihan PayLater tenggat ' + plDM(plDue(it, 0)), () => { if (commit(() => { recs = rs; plUnsnap(ps); })) toast('Dibatalkan'); }); return;
    }
    if (!autoBackup('Sebelum mengubah tagihan PayLater lama', { kind: 'ubah' })) { toast(ABK_FAIL); return; }
    if (!commit(() => { const cur = plGet().find(x => x.id === p.id); if (!cur) return; Object.assign(cur, v); Object.keys(cur.d || {}).forEach(i => { if (+i >= k) delete cur.d[i]; }); })) return;
    closeSheet(); renderPlan(); };
  const d = n.querySelector('#pl-del'); if (d) d.onclick = e => confirmBtn(e.target, 'Yakin? Ketuk lagi', () => {
    if (!autoBackup('Sebelum menghapus tagihan PayLater lama', { kind: 'ubah' })) { toast(ABK_FAIL); return; }
    if (commit(() => { meta.pl = plGet().filter(x => x.id !== p.id); })) { closeSheet(); renderPlan(); }
  });
  openSheet(p ? 'Ubah paylater' : 'Paylater baru', n);
}
/* ---------- Saldo bertahan berapa hari (tanpa tanggal gajian): saldo bisa dipakai ÷ rata-rata pengeluaran harian ---------- */
function runway(extra) {   // extra = total rencana yang mau dikurangkan dari saldo
  const c = simCalc(); if (!c.hasW && !c.base) return null;
  const now = Date.now(), from = now - 30 * 864e5; let sum = 0, first = now;
  recs.forEach(r => { if (r.k !== 'E') return; const t = new Date(r.t).getTime(); if (t < first) first = t; if (t >= from) sum += r.a; });
  const span = Math.min(30, Math.max(1, Math.ceil((now - first) / 864e5)));
  if (span < 3 || sum <= 0) return null;
  const daily = sum / span, bal = c.avail - (extra || 0);
  if (bal <= 0) return { daily, days: 0, bal, date: '' };
  const days = Math.floor(bal / daily), d = new Date(now + days * 864e5);
  return { daily, days, bal, date: d.getDate() + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'][d.getMonth()] };
}
function runwayHTML(extra) {
  const r = runway(extra); if (!r) return '';
  const cls = r.days < 7 ? 'hot' : r.days < 14 ? 'warn' : '';
  return `<div class="bud runway"><div class="bud-t"><span>Saldo bertahan</span><b class="${cls}">${r.days > 365 ? '> 1 tahun' : r.bal <= 0 ? 'Habis' : '±' + r.days + ' hari'}</b></div><div class="bud-s"><span>${r.bal <= 0 ? 'Saldo tidak cukup' : r.days > 365 ? 'Pengeluaranmu kecil dibanding saldo' : 'Sampai ±' + r.date}</span><span>rata-rata ${rp(r.daily)}/hari</span></div></div>`;
}
function catBudgetSheet() {
  const cs = [...new Set(recs.filter(r => r.k === 'E').map(r => r.c).concat(Object.keys(meta.cats)))].sort((a, b) => (meta.cats[b] ? 1 : 0) - (meta.cats[a] ? 1 : 0));
  const n = el(`<form class="form"><p style="margin:0;color:var(--mute);font-size:13px">Kosongin kalau nggak mau pakai budget. Bar jadi kuning di 80% dan merah di 100%.</p>${cs.map(c => `<label>${esc(cat(c))}<input class="amt" inputmode="numeric" data-c="${esc(c)}" value="${meta.cats[c] ? NF.format(meta.cats[c]) : ''}" placeholder="Rp / bulan"></label>`).join('')}<div class="acts"><button type="submit" class="btn-p">Simpan</button></div></form>`);
  n.querySelectorAll('.amt').forEach(i => i.oninput = e => { e.target.value = fmtAmt(e.target.value); });
  n.querySelector('form').onsubmit = e => { e.preventDefault(); meta.cats = {}; n.querySelectorAll('.amt').forEach(i => { const v = +i.value.replace(/\D/g, ''); if (v) meta.cats[i.dataset.c] = v; }); save(); closeSheet(); dirtyAll(); refresh(); toast('Budget kategori disimpan'); };
  openSheet('Budget per kategori', n);
}
function goalSheet(g) {
  const n = el(`<form class="form"><label>Nama target<input id="g-n" value="${g ? esc(g.name) : ''}" placeholder="mis. Laptop" maxlength="40"></label><label>Jumlah target (Rp)<input class="amt" id="g-t" inputmode="numeric" value="${g ? NF.format(g.target) : ''}" placeholder="mis. 10.000.000"></label><div class="acts">${g ? '<button type="button" class="btn-s btn-d" id="g-del">Hapus</button>' : ''}<button type="submit" class="btn-p">Simpan</button></div></form>`);
  n.querySelector('#g-t').oninput = e => { e.target.value = fmtAmt(e.target.value); };
  n.querySelector('form').onsubmit = e => { e.preventDefault(); const nm = n.querySelector('#g-n').value.trim(), t = +n.querySelector('#g-t').value.replace(/\D/g, '');
    if (!nm || !t) { toast('Isi nama dan jumlah target'); return; }
    if (g) { g.name = nm; g.target = t; } else meta.goals.push({ id: 'g' + Date.now(), name: nm, target: t, dep: [] });
    meta.changes++; save(); closeSheet(); dirtyAll(); refresh(); toast('Target disimpan'); };
  if (g) n.querySelector('#g-del').onclick = e => confirmBtn(e.target, 'Yakin? Ketuk lagi', () => { meta.goals = meta.goals.filter(x => x !== g); meta.changes++; save(); closeSheet(); dirtyAll(); refresh(); });
  openSheet(g ? 'Ubah target' : 'Target tabungan', n);
}
function depositSheet(g) {
  const n = el(`<form class="form"><p style="margin:0">${esc(g.name)} · terkumpul ${rp(goalSaved(g))} dari ${rp(g.target)}</p><label>Jumlah (Rp)<input class="amt" id="d-a" inputmode="numeric" placeholder="mis. 500.000"></label><div class="acts"><button type="button" class="btn-s" id="d-out">Tarik</button><button type="submit" class="btn-p">Setor</button></div></form>`);
  n.querySelector('#d-a').oninput = e => { e.target.value = fmtAmt(e.target.value); };
  const put = sign => { const a = +n.querySelector('#d-a').value.replace(/\D/g, ''); if (!a) { toast('Isi nominalnya dulu'); return; }
    if (sign < 0 && a > goalSaved(g)) { toast('Saldo tabungan tidak cukup'); return; }
    const wasDone = goalSaved(g) >= g.target;
    g.dep.push({ t: nowLocal().slice(0, 10), a: sign * a }); meta.changes++; save(); closeSheet(); dirtyAll(); refresh();
    if (sign > 0 && !wasDone && goalSaved(g) >= g.target) celebrate();
    toast((sign > 0 ? 'Disetor ' : 'Ditarik ') + rp(a)); };
  n.querySelector('form').onsubmit = e => { e.preventDefault(); put(1); }; n.querySelector('#d-out').onclick = () => put(-1);
  openSheet('Setor tabungan', n); setTimeout(() => n.querySelector('#d-a').focus(), 60);
}
function paceCard(tm, ms, dom, dim) {   // vs bulan lalu (periode tanggal yang sama) + perkiraan akhir bulan dari laju harian
  if (ms.t <= 0) return '';
  const pm = addM(tm, -1), pms = monthSpend(pm), pdim = new Date(+pm.slice(0, 4), +pm.slice(5, 7), 0).getDate(), cut = Math.min(dom, pdim);
  const same = recs.reduce((s, r) => s + (r.k === 'E' && r.t.slice(0, 7) === pm && +r.t.slice(8, 10) <= cut ? r.a : 0), 0);
  let h = '<div class="bud cmp">';
  if (pms.t > 0) {
    const diff = ms.t - same, pct = same > 0 ? Math.round(Math.abs(diff) / same * 100) : 0;
    h += `<div class="bud-t"><span>Dibanding bulan lalu</span>${same > 0 ? `<b class="cmp-d ${diff > 0 ? 'up' : 'dn'}">${diff > 0 ? '+' : '−'}${pct}%</b>` : ''}</div>` +
      `<div class="bud-s"><span>Tgl 1–${cut} bulan ini</span><span>${rp(ms.t)}</span></div><div class="bud-s"><span>Tgl 1–${cut} bulan lalu</span><span>${rp(same)}</span></div>`;
  }
  if (dom >= 3) {
    const est = dom >= dim ? ms.t : ms.t / dom * dim;
    const sub = meta.budget ? (est > meta.budget ? 'Bisa lewat budget ±' + rp(est - meta.budget) : 'Masih di bawah budget ±' + rp(meta.budget - est)) : (pms.t > 0 ? 'Bulan lalu total ' + rp(pms.t) : '');
    h += `<div class="bud-t${pms.t > 0 ? ' cmp-2' : ''}"><span>Perkiraan akhir bulan</span><b>${rp(est)}</b></div><div class="bud-s"><span>${sub}</span><span>${dom < 7 ? 'masih kasar' : 'dari laju harian'}</span></div>`;
  }
  return h.length > 22 ? h + '</div>' : '';
}
function sparkHTML(tm, ms, dom, dim) {   // grafik area kumulatif bulan ini + garis laju budget
  if (ms.t <= 0) return '';
  const day = new Array(dim).fill(0); recs.forEach(r => { if (r.k === 'E' && r.t.slice(0, 7) === tm) day[+r.t.slice(8, 10) - 1] += r.a; });
  const cum = []; let acc = 0; for (let i = 0; i < Math.min(dom, dim); i++) { acc += day[i]; cum.push(acc); }
  const W = 300, H = 64, mx = Math.max(ms.t, meta.budget || 0, 1), X = i => dim > 1 ? i / (dim - 1) * W : 0, Y = v => H - 4 - v / mx * (H - 10);
  const pts = cum.map((v, i) => [X(i), Y(v)]), line = pts.map((q, i) => (i ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join(' ');
  const last = pts[pts.length - 1], area = line + ` L${last[0].toFixed(1)} ${H} L0 ${H} Z`;
  const pace = meta.budget ? `<path d="M0 ${Y(0)} L${W} ${Y(meta.budget)}" class="sp-pace"/>` : '';
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="spg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".45"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>${pace}<path d="${area}" fill="url(#spg)"/><path d="${line}" class="sp-line"/></svg><div class="sp-x"><span>1</span><span>${dim}</span></div>`;
}
function topCats(tm, ms) {
  const es = Object.entries(ms.c).sort((a, b) => b[1] - a[1]).slice(0, 6); if (!es.length) return '';
  return `<h2 class="sec">Bulan ini per kategori</h2><div class="tiles">${es.map(([c, v]) => `<button type="button" class="tile" data-c="${esc(c)}" style="--c:${catColor(c)}">${ico(c, 'lg')}<b>${esc(cat(c))}</b><span>${rp(v)}</span><small>${Math.round(v / ms.t * 100)}% dari bulan ini</small></button>`).join('')}</div>`;
}
function momPill(tm, ms, dom) {   // label kecil di hero: pengeluaran vs bulan lalu (tanggal yang sama)
  if (ms.t <= 0) return '';
  const pm = addM(tm, -1), pdim = new Date(+pm.slice(0, 4), +pm.slice(5, 7), 0).getDate(), cut = Math.min(dom, pdim);
  const same = recs.reduce((s, r) => s + (r.k === 'E' && r.t.slice(0, 7) === pm && +r.t.slice(8, 10) <= cut ? r.a : 0), 0);
  if (same <= 0) return '';
  const d = ms.t - same, pct = Math.round(Math.abs(d) / same * 100);
  return `<span class="hm-pill ${d > 0 ? 'up' : 'dn'}">${d > 0 ? '▲' : '▼'} ${pct}% vs bln lalu</span>`;
}
/* ---------- Ringkasan mingguan: minggu ini (Senin sampai hari ini) vs minggu lalu di rentang hari yang sama ---------- */
function weekCard() {
  const dk = d => d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
  const now = new Date(), n = (now.getDay() + 6) % 7 + 1;   // n = hari ke-berapa dalam minggu (Senin = 1)
  const s0 = new Date(now.getFullYear(), now.getMonth(), now.getDate() - n + 1), s1 = new Date(s0.getFullYear(), s0.getMonth(), s0.getDate() - 7);
  const a0 = dk(s0), b0 = dk(s1), b1 = dk(new Date(s1.getFullYear(), s1.getMonth(), s1.getDate() + n));
  let cur = 0, prev = 0; const cc = {}, pc = {};
  recs.forEach(r => { if (r.k !== 'E') return; const d = r.t.slice(0, 10);
    if (d >= a0) { cur += r.a; cc[r.c] = (cc[r.c] || 0) + r.a; }
    else if (d >= b0 && d < b1) { prev += r.a; pc[r.c] = (pc[r.c] || 0) + r.a; } });
  if (!cur && !prev) return '';
  const span = n === 1 ? 'Senin' : 'Senin–' + DOWL[now.getDay()];
  let head, col = '';
  if (!prev) head = 'Belum ada pembanding dari minggu lalu';
  else { const pct = Math.round(Math.abs(cur - prev) / prev * 100);
    if (!pct) head = 'Sama seperti minggu lalu';
    else { head = pct + '% ' + (cur < prev ? 'lebih hemat' : 'lebih boros') + ' dari minggu lalu'; col = cur < prev ? 'var(--green,#30d158)' : 'var(--red,#ff453a)'; } }
  const dl = Object.keys(Object.assign({}, cc, pc)).map(c => [c, (cc[c] || 0) - (pc[c] || 0)]).filter(x => x[1]);
  dl.sort((x, y) => y[1] - x[1]);
  const up = dl[0] && dl[0][1] > 0 ? dl[0] : null, dn = dl.length && dl[dl.length - 1][1] < 0 ? dl[dl.length - 1] : null;
  const topC = Object.entries(cc).sort((a, b) => b[1] - a[1])[0];
  const line = up ? 'Paling naik: ' + esc(cat(up[0])) + ' +' + jt(up[1]) : dn ? 'Paling turun: ' + esc(cat(dn[0])) + ' −' + jt(-dn[1]) : (topC ? 'Terbesar: ' + esc(cat(topC[0])) + ' ' + jt(topC[1]) : '');
  const sub2 = topC && (up || dn) ? `<div class="bud-s"><span>Terbesar minggu ini: <b>${esc(cat(topC[0]))}</b> (${rp(topC[1])})</span></div>` : '';
  return `<div class="bud wk"><small>Minggu ini · ${span}</small><div class="hm-n" style="font-size:22px${col ? ';color:' + col : ''}">${head}</div><div class="bud-s"><span>${rp(cur)} vs ${rp(prev)}</span>${line ? '<span>' + line + '</span>' : ''}</div>${sub2}</div>`;
}

/* ---------- Catat cepat: transaksi yang sering diulang, satu ketukan dari Beranda (ada Batalkan) ---------- */
let qlBusy = 0;
const dayPart = h => h < 11 ? 'pagi' : h < 15 ? 'siang' : h < 18 ? 'sore' : 'malam';
function quickList(limit = 5) {   // urut: seberapa sering dicatat di jam & hari yang mirip sekarang (kebaruan ikut menghitung)
  const now = new Date(), nh = now.getHours() + now.getMinutes() / 60, nd = now.getDay(), nw = nd === 0 || nd === 6, T = now.getTime(), fq = {};
  recs.forEach(r => {
    if (r.k !== 'E' || !r.n) return; const k = cn(r.n).toLowerCase(); if (!k) return;
    const o = fq[k] || (fq[k] = { n: 0, r, sc: 0 }); o.n++;   // r = catatan terbaru
    const d = new Date(r.t), h = d.getHours() + d.getMinutes() / 60, dh = Math.min(Math.abs(h - nh), 24 - Math.abs(h - nh)), dd = d.getDay();
    o.sc += (.15 + Math.exp(-(dh / 2.5) * (dh / 2.5))) * (dd === nd ? 1 : (dd === 0 || dd === 6) === nw ? .7 : .45) * Math.pow(.5, Math.max(0, T - d) / 864e5 / 90);
  });
  return Object.values(fq).filter(o => o.n >= 3).sort((a, b) => b.sc - a.sc).slice(0, limit);
}
function guessCat(note, kind) {
  const v = cn(note).toLowerCase(), toks = v.split(' ');
  let m = recs.find(r => r.k === kind && r.n && cn(r.n).toLowerCase() === v);
  if (!m) m = recs.find(r => { if (r.k !== kind || !r.n) return false; const ws = cn(r.n).toLowerCase().split(' '); return toks.every(t => ws.some(w => w.startsWith(t))); });
  if (m) return { c: m.c, s: m.s || '', tg: (m.tg || []).slice(), ac: m.ac };
  const cl = MMImport.classify(kind, v, '');
  return { c: cl.c === 'Other' && kind === 'I' ? 'Penghasilan Lain' : cl.c, s: cl.s || '', tg: (cl.tg || []).slice(), ac: '' };
}
function oddFor(note, a) {   // nominal >= 8x median riwayat catatan yang sama (min. 3 riwayat) -> minta dicek di form
  const v = cn(note).toLowerCase(), l = recs.filter(r => r.k === 'E' && r.n && cn(r.n).toLowerCase() === v).map(r => r.a);
  if (l.length < 3 || l.includes(a)) return false;
  l.sort((p, q) => p - q); const h = l.length >> 1, med = l.length % 2 ? l[h] : (l[h - 1] + l[h]) / 2;
  return med > 0 && a >= med * 8;
}
function lineRec(p, names) {   // hasil urai -> transaksi: kategori dari catatan lama, dompet dari kalimat / catatan lama / terakhir dipakai
  const g = guessCat(p.note, p.kind), ok = x => x && names.some(w => wkey(w) === wkey(x));
  const ac = p.wal || [g.ac, meta.lastWal].find(ok) || names[0] || 'Accounts';
  return { t: lineWhen(p) + ':' + (p.hm ? '00' : p2(new Date().getSeconds())), k: p.kind, c: g.c, s: g.s, tg: g.tg, n: p.note, a: p.a, ac };
}
/* tempel banyak baris: satu baris satu transaksi, ada pratinjau sebelum disimpan */
function batchSheet(text) {
  const n = el(`<div class="form"><label>Satu baris satu transaksi<textarea id="bt-t" rows="6" placeholder="kopi 18k&#10;ayam soendari 25k gopay kemarin&#10;+gaji 2jt bca" autocapitalize="none"></textarea></label>
    <div class="btl" id="bt-l"></div>
    <div class="acts"><button type="button" class="btn-p" id="bt-s" disabled>Simpan</button></div></div>`);
  const ta = n.querySelector('#bt-t'), box = n.querySelector('#bt-l'), sv = n.querySelector('#bt-s'); let ok = [];
  const draw = () => {
    const names = walNames(), ls = ta.value.split('\n').map(x => x.trim()).filter(Boolean); ok = [];
    box.innerHTML = ls.map(l => { const p = parseLine(l, names); if (!p) return `<div class="btr bad"><span>${esc(l)}</span><small>nggak kebaca (butuh nominal)</small></div>`; ok.push(p); const odd = p.kind === 'E' && oddFor(p.note, p.a); return `<div class="btr"><b>✦</b><span>${esc(lineSummary(p))}</span>${odd ? '<small class="w">nominal janggal?</small>' : ''}</div>`; }).join('');
    sv.disabled = !ok.length; sv.textContent = ok.length ? 'Simpan ' + ok.length + ' transaksi' : 'Simpan';
  };
  ta.oninput = draw; if (text) ta.value = text; draw();
  sv.onclick = () => {
    if (!ok.length) return; const names = walNames(), list = ok.map(p => lineRec(p, names)), snap = recs.slice();
    meta.lastWal = list[list.length - 1].ac; addBatch(list, { skipDup: false });
    meta.changes++; save(); dirtyAll(); fillFilters(); refresh(); closeSheet();
    toast(list.length + ' transaksi dicatat', () => { recs = snap; fillFilters(); changed(); toast('Dibatalkan'); });
  };
  openSheet('Catat banyak', n); setTimeout(() => ta.focus(), 60);
}
function lineSave(text) {   // baris dari Beranda: langsung simpan (ada Batalkan); kalau tak terbaca atau nominal janggal -> buka form terisi
  if (qlBusy) return;
  const names = walNames(), p = parseLine(text, names);
  if (!p || (p.kind === 'E' && oddFor(p.note, p.a))) { formSheet(null, text); return; }
  qlBusy = 1; setTimeout(() => qlBusy = 0, 700);
  const r = lineRec(p, names); meta.lastWal = r.ac;
  const snap = recs.slice();
  addBatch([r], { skipDup: false });
  meta.changes++; save(); dirtyAll(); fillFilters(); refresh();
  toast((p.kind === 'I' ? 'Pemasukan dicatat ' : 'Dicatat ') + rp(r.a) + ' · ' + cn(r.n) + (p.dlabel ? ' · ' + p.dlabel : '') + budgetWarn(r), () => { recs = snap; fillFilters(); changed(); toast('Dibatalkan'); });
}
function quickLog(m) {
  if (qlBusy) return; qlBusy = 1; setTimeout(() => qlBusy = 0, 700);   // cegah dobel ketuk
  const w = meta.wallets.find(x => wkey(x.name) === wkey(m.ac)) || meta.wallets.find(x => wkey(x.name) === wkey(meta.lastWal)) || meta.wallets[0];
  const r = { t: nowSec(), k: 'E', c: m.c, s: m.s || '', tg: (m.tg || []).slice(), n: m.n, a: m.a, ac: w ? w.name : m.ac };
  const snap = recs.slice();
  addBatch([r], { skipDup: false });
  meta.changes++; save(); dirtyAll(); fillFilters(); refresh();
  toast('Dicatat ' + rp(r.a) + ' · ' + cn(r.n) + budgetWarn(r), () => { recs = snap; fillFilters(); changed(); toast('Dibatalkan'); });
}

let _plDashLast = null;
function plDashHome() {
  const c = simCalc(), d = dashAmounts(plGet(), meta.plPays, c.s.items, c.base, c.cut, thisMonth());
  _plDashLast = d.hasPL ? d : null;
  if (!d.hasPL) return '';
  const lunas = d.PL_semua === 0;
  const st = lunas ? '<b class="ok" id="hd-st">Lunas · Rp0</b>' : `<b id="hd-st">Kewajiban ${rp(d.PL_semua)}</b>`;
  let dueBadge = '';
  if (!lunas) {
    const nxt = plRows().find(r => r.ex && r.rem > 0);
    if (nxt) {
      const df = Math.round((new Date(nxt.due + 'T00:00:00') - new Date(plToday() + 'T00:00:00')) / 864e5);
      const cls = df <= 0 ? 'hot' : df <= 5 ? 'warn' : '';
      const txt = df < 0 ? `Telat ${-df} hari` : df === 0 ? 'Jatuh tempo hari ini' : df <= 5 ? `Tenggat H-${df}` : `Tenggat ${plDM(nxt.due)}`;
      dueBadge = `<div class="hd-meta"><span class="pl-due${cls ? ' ' + cls : ''}" id="hd-due">${txt}</span></div>`;
    }
  }
  return `<div class="bud sim-card" id="h-pldash"><div class="bud-t"><span>Ringkasan PayLater</span>${st}</div>${dueBadge}` +
    `<div class="kv"><span>Saldo aktual</span><b id="hd-saldo" class="${d.saldo < 0 ? 'hot' : ''}">${rpS(d.saldo)}</b></div>` +
    `<div class="kv hd-hero"><span>Uang aman bulan ini</span><b id="hd-aman" class="${d.aman < 0 ? 'hot' : ''}">${rpS(d.aman)}</b></div>` +
    `<div class="kv"><span>Sisa setelah semua tagihan</span><b id="hd-sisa" class="${d.sisa < 0 ? 'hot' : ''}">${rpS(d.sisa)}</b></div>` +
    `<div class="hint">Biaya/bunga saat bayar belum masuk hitungan. Pastikan cicilan PayLater tidak ganda di Daftar rencana.</div></div>`;
}
function animPlDash() {
  const d = _plDashLast; if (!d) return;
  setNum($('#hd-saldo'), d.saldo, rpS, 320);
  setNum($('#hd-aman'), d.aman, rpS, 320);
  setNum($('#hd-sisa'), d.sisa, rpS, 320);
}
function renderHome() {
  const tm = thisMonth(), ms = monthSpend(tm), dom = new Date().getDate(), dim = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  if (!recs.length) {
    delete root.dataset.mood;
    $('#home').innerHTML = `<div class="bud welc"><h2>Selamat datang</h2><p>Tiga langkah untuk mulai:</p>
      <button type="button" class="wstep" id="w-add"><b>1</b><span><strong>Catat transaksi</strong><small>Ketuk tombol + kapan aja buat nyatet pengeluaran atau pemasukan.</small></span></button>
      <button type="button" class="wstep" id="w-plan"><b>2</b><span><strong>Atur budget</strong><small>Di tab Rencana: budget bulanan, per kategori, dan target tabungan.</small></span></button>
      <button type="button" class="wstep" id="w-imp"><b>3</b><span><strong>Punya data lama?</strong><small>Impor dari Money Manager lewat ⚙ di pojok atas.</small></span></button></div>` + plDashHome();
    $('#w-add').onclick = () => formSheet(); $('#w-plan').onclick = () => go('plan'); $('#w-imp').onclick = () => { backTab = 'home'; go('data'); };
    animPlDash();
    return;
  }
  if (meta.budget) root.dataset.mood = ms.t >= meta.budget ? 'hot' : ms.t / meta.budget >= .8 ? 'warn' : 'ok'; else delete root.dataset.mood;
  let h = bkNudge(); h += recs.some(r => r.s == null) && meta.catV !== 2 ? `<div class="bud nudge"><div><b>Kategori versi baru</b><small>Grup + sub-kategori + tag supaya pengeluaran lebih rapi di statistik.</small></div><button type="button" class="btn-p" id="h-tidy">Rapikan</button></div>` : '';
  h += `<div class="bud hm"><small>${mLabel(tm)}</small>${momPill(tm, ms, dom)}`;
  if (meta.budget) { const left = meta.budget - ms.t, p = ms.t / meta.budget * 100;
    h += `<div class="ring-row"><div class="ring-main"><div class="hm-n ${left < 0 ? 'r' : ''}">${left < 0 ? 'Lewat ' + rp(-left) : rp(left)}</div><div class="bud-s"><span>${left < 0 ? 'Budget bulan ini terlewat' : 'Aman ±' + rp(left / Math.max(1, dim - dom + 1)) + ' per hari'}</span></div><div class="bud-s"><span>${rp(ms.t)} / ${rp(meta.budget)}</span></div></div>${ring(p, 76, p >= 100 ? '#ff8a8a' : p >= 80 ? '#ffd60a' : '#fff')}</div>`;
  } else h += `<div class="hm-n">${rp(ms.t)}</div><div class="bud-s"><span>Pengeluaran bulan ini</span><button type="button" class="btn-s" id="h-bud">Atur budget</button></div>`;
  h += sparkHTML(tm, ms, dom, dim) + '</div>';
  const ql = quickList();
  const nm0 = walNames(), w0 = (nm0[0] || '').toLowerCase(), w1 = (nm0[1] || nm0[0] || '').toLowerCase(), sp = x => x ? ' ' + x : '';
  const EX = ['kopi 18k', 'ayam soendari 25k' + sp(w0) + ' kemarin', 'bensin 30rb senin jam 7 pagi', 'pulsa 50.000' + sp(w1) + ' 3 hari lalu', '+gaji 2jt' + sp(w1)];
  h += `<h2 class="sec qsec">Catat cepat <small>· ${DOWL[new Date().getDay()]} ${dayPart(new Date().getHours())}</small><button type="button" class="qhelp" id="h-qh" aria-expanded="false" aria-controls="h-qx" aria-label="Contoh cara mengisi">?</button></h2><form class="qline" id="h-qf" autocomplete="off"><input id="h-qi" placeholder="ayam soendari 25k gopay kemarin" enterkeyhint="done" autocapitalize="none" aria-label="Ketik satu baris transaksi"><button type="submit" class="btn-p">Catat</button></form><small class="qlp" id="h-qp" aria-live="polite"></small><div class="qex" id="h-qx" hidden><small>Ketuk contoh untuk mengisi. Nominal wajib; dompet, tanggal, dan jam opsional, urutannya bebas. Awali <b>+</b> untuk pemasukan.</small>${EX.map(x => `<button type="button" class="qexb" data-t="${esc(x)}">${esc(x)}</button>`).join('')}<button type="button" class="qexb more" id="h-qb">Tempel banyak baris sekaligus ›</button></div>`;
  if (ql.length) h += `<div class="qk" id="h-ql" aria-label="Ketuk untuk langsung mencatat ulang">${ql.map((o, i) => `<button type="button" class="qchip" data-i="${i}">${ico(o.r.c, '', o.r.n)}<span>${esc(cn(o.r.n))} <small style="opacity:.65;font-weight:600">${jt(o.r.a)}</small></span></button>`).join('')}</div>`;
  h += walHome() + plDashHome();
  h += runwayHTML(0) + paceCard(tm, ms, dom, dim);
  h += weekCard();
  h += topCats(tm, ms);
  const hot = Object.keys(meta.cats).filter(c => meta.cats[c] && (ms.c[c] || 0) / meta.cats[c] >= .8);
  if (hot.length) h += `<div class="bud walert">${hot.map(c => { const p = Math.round((ms.c[c] || 0) / meta.cats[c] * 100); return `<span>${esc(cat(c))} ${p >= 100 ? 'terlewat' : 'sudah ' + p + '%'}</span>`; }).join('')}</div>`;
  const days = [], now = new Date(); for (let i = 6; i >= 0; i--) { const d = new Date(now); d.setDate(d.getDate() - i); const k = d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); days.push({ k, d, s: 0 }); }
  recs.forEach(r => { if (r.k === 'E') { const o = days.find(x => x.k === r.t.slice(0, 10)); if (o) o.s += r.a; } });
  const mx = Math.max(1, ...days.map(x => x.s));
  h += `<h2 class="sec">7 hari terakhir</h2><div class="bud h7">${days.map(x => `<div class="h7c"><i style="height:${Math.max(3, x.s / mx * 64)}px"></i><small>${DOW[x.d.getDay()]}</small></div>`).join('')}</div>`;
  h += `<h2 class="sec">Transaksi terakhir</h2><div id="h-last">${recs.slice(0, 3).map(rowHTML).join('') || '<div class="empty">Belum ada transaksi. Ketuk + untuk mencatat.</div>'}</div>`;
  h += `<h2 class="sec">Tabungan</h2>` + (meta.goals.length ? meta.goals.map(g => { const p = goalSaved(g) / g.target * 100; return `<div class="bud gs"><div class="bud-t"><span>${esc(g.name)}</span><span><b>${Math.round(p)}%</b></span></div><div class="bar"><i style="width:${Math.min(100, p)}%"></i></div></div>`; }).join('') : '<div class="bud-s"><span>Belum ada target tabungan.</span><button type="button" class="btn-s" id="h-goal">Buat target</button></div>');
  $('#home').innerHTML = h;
  const ht = $('#h-tidy'); if (ht) ht.onclick = tidySheet;
  const hw = $('#h-wal'); if (hw) hw.onclick = () => meta.wallets.length ? go('wal') : walSheet(); const hk = $('#h-bk'); if (hk) hk.onclick = downloadBackup; if ($('#hw-total')) setNum($('#hw-total'), walBal().total, rpS);
  animPlDash();
  document.querySelectorAll('#home .tile').forEach(b => b.onclick = () => { F.from = F.to = tm; F.cat = b.dataset.c; F.sub = ''; tlMonths = 3; dirty.sum = dirty.tl = dirty.st = 1; fillFilters(); syncURL(); go('tl'); });
  const qi = $('#h-qi'); if (qi) {
    qi.oninput = () => { const p = parseLine(qi.value, walNames()); $('#h-qp').textContent = p ? '✦ ' + lineSummary(p) : ''; };
    const qx = $('#h-qx'), qh = $('#h-qh'), qclose = () => { qx.hidden = true; qh.setAttribute('aria-expanded', 'false'); qh.classList.remove('on'); };
    qh.onclick = () => { const o = qx.hidden; qx.hidden = !o; qh.setAttribute('aria-expanded', String(o)); qh.classList.toggle('on', o); };
    qi.addEventListener('input', e => { if (e.isTrusted) qclose(); });   // mulai mengetik -> panel contoh menutup sendiri
    qx.onclick = e => { const b = e.target.closest('.qexb'); if (!b) return; if (b.id === 'h-qb') { batchSheet(''); return; } qi.value = b.dataset.t; qi.oninput(); qi.focus(); };
    // tempel beberapa baris: <input> membuang baris baru, jadi ditangkap dulu dan dibuka di sheet banyak baris
    qi.addEventListener('paste', e => { const t = (e.clipboardData || window.clipboardData).getData('text'); if (t && t.trim().split(/\r?\n/).filter(x => x.trim()).length > 1) { e.preventDefault(); batchSheet(t.trim()); } });
    $('#h-qf').onsubmit = e => { e.preventDefault(); const t = qi.value.trim(); if (t) lineSave(t); };
  }
  const hq = $('#h-ql'); if (hq) hq.onclick = e => { const b = e.target.closest('.qchip'); if (b) quickLog(ql[+b.dataset.i].r); };
  const hb = $('#h-bud'); if (hb) hb.onclick = () => go('plan'); const hg = $('#h-goal'); if (hg) hg.onclick = () => { planSub = 'tab'; dirty.plan = 1; go('plan'); };
  $('#h-last').onclick = e => { const b = e.target.closest('.tl-i'); if (b) detailSheet(b.dataset.id); };
}

/* ---------- Dompet (wallet): saldo tiap akun, isi saldo, transfer ---------- */
const WI = {
  bank: '<path d="M3 10l9-6 9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18"/>',
  ewallet: '<rect x="7" y="3" width="10" height="18" rx="2.6"/><path d="M11 17.5h2"/>',
  cash: '<rect x="3" y="6" width="18" height="12" rx="2.6"/><circle cx="12" cy="12" r="2.6"/>',
  point: '<path d="M12 3l2.6 5.6 6 .7-4.4 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.4 9.3l6-.7z"/>',
  save: '<path d="M12 3v18M16.5 7.5C16 6 14.3 5 12 5S8 6.2 8 8s1.6 2.5 4 3 4 1.2 4 3-1.8 3-4 3-4-1-4.5-2.5"/>'
};
const WT = { bank: 'Bank', ewallet: 'E-Wallet', cash: 'Tunai', save: 'Tabungan', point: 'Point' };
const WCOL = ['#0a84ff', '#5e5ce6', '#bf5af2', '#ff375f', '#ff9f0a', '#30d158', '#64d2ff', '#ac8e68'];
const WPRE = [['Livin Mandiri', 'bank', '#ff9f0a'], ['GoPay', 'ewallet', '#30d158'], ['ShopeePay', 'ewallet', '#ff453a'], ['Bank Jago', 'bank', '#ffb800'], ['OVO', 'ewallet', '#bf5af2'], ['DANA', 'ewallet', '#64d2ff'], ['BCA', 'bank', '#0a84ff'], ['BRI', 'bank', '#5e5ce6'], ['Mandiri', 'bank', '#ff9f0a'], ['SeaBank', 'bank', '#ff6a3d'], ['Tunai', 'cash', '#30d158']];
const wIco = (t, sz = 22) => `<svg viewBox="0 0 24 24" width="${sz}" height="${sz}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${WI[t] || WI.cash}</svg>`;
const relL = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, n >> 8 & 255, n & 255].map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }).reduce((a, v, i) => a + v * [.2126, .7152, .0722][i], 0); };
const lightCard = h => /^#[0-9a-f]{6}$/i.test(h || '') && relL(h) > .4;   // warna terang (kuning, oranye, hijau muda): teks jadi gelap supaya terbaca
const wkey = s => String(s == null ? '' : s).trim().toLowerCase();
const nowSec = () => nowLocal() + ':' + p2(new Date().getSeconds());
const wid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const greet = () => { const h = new Date().getHours(); return h < 4 ? 'Selamat malam' : h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 19 ? 'Selamat sore' : 'Selamat malam'; };
const glassOff = () => { try { return localStorage.getItem('md_glass') === 'off'; } catch (e) { return false; } };
const buzz = () => { try { if (navigator.vibrate) navigator.vibrate(8); } catch (e) {} };

/* Model saldo patokan: saldo = patokan (angka yang kamu isi) + transaksi & transfer SESUDAH waktu patokan.
   Riwayat sebelum patokan tidak menyentuh saldo. Dompet mode manual (auto === false) = murni angka patokan. */
function migrateWal() {   // dompet versi lama (saldo awal + seluruh riwayat) -> patokan = saldo hari ini, mulai dihitung dari sekarang
  const old = meta.wallets.filter(w => w.base === undefined); if (!old.length) return;
  const since = nowSec();
  old.forEach(w => {
    let b = +w.init || 0; const k = wkey(w.name);
    recs.forEach(r => { if (wkey(r.ac) === k) b += r.k === 'I' ? r.a : -r.a; });
    meta.xfers.forEach(x => { if (x.f === w.id) b -= x.a; if (x.to === w.id) b += x.a; });
    w.base = b; w.since = since; w.auto = w.auto !== false; delete w.init;
  });
  save();
}
const plRes = () => PLR || (PLR = PL.resolve(recs, plGet()));   // tautan PayLater -> transaksi (di-cache, dibatalkan oleh dirtyAll)
function walBal() {
  if (WB) return WB;
  return (WB = walBalances({ wallets: meta.wallets, recs, xfers: meta.xfers, pays: meta.plPays, linked: plRes().linked, tm: thisMonth(), wkey }));
}
const walSnap = () => ({ r: recs.slice(), w: JSON.parse(JSON.stringify(meta.wallets)), x: JSON.parse(JSON.stringify(meta.xfers)), ...plSnap() });
const walRestore = s => { recs = s.r; meta.wallets = s.w; meta.xfers = s.x; if (s.pl) plUnsnap(s); fillFilters(); walChanged('Dibatalkan'); };
function walChanged(msg, undo) { meta.changes++; save(); dirtyAll(); refresh(); if (msg) toast(msg, undo); }

/* blok nominal (kolom + tombol cepat + keypad sentuh), dipakai semua sheet dompet */
const TOUCH = () => matchMedia('(hover:none) and (pointer:coarse)').matches;
const amtHTML = (id, v) => `<div class="amtbox"><span class="rpx">Rp</span><input class="amt" id="${id}" inputmode="${TOUCH() ? 'none' : 'numeric'}" placeholder="0" aria-label="Nominal (Rp)" value="${v ? NF.format(v) : ''}"></div>
  <div class="amtq" data-for="${id}">${[10000, 50000, 100000, 500000].map(x => `<button type="button" data-v="${x}">+${jt(x)}</button>`).join('')}<button type="button" data-v="0" class="clr">Hapus</button></div>
  <div class="kp" data-for="${id}">${kpHTML()}</div>`;
function bindAmt(n, id) {
  const inp = n.querySelector('#' + id); if (!inp) return;
  bindAmtInput(inp);
  n.querySelector('.amtq[data-for="' + id + '"]').onclick = e => { const b = e.target.closest('button'); if (!b) return; const v = +b.dataset.v, a = parseAmt(inp.value); inp.value = v ? NF.format(Math.min(AMT_MAX, a + v)) : ''; };
  n.querySelector('.kp[data-for="' + id + '"]').onclick = e => { const b = e.target.closest('button'); if (b) kpPress(inp, b.dataset.k); };
}
const amtVal = (n, id) => parseAmt(n.querySelector('#' + id).value);
const wChips = (id, sel) => `<div class="ccs" id="${id}">${meta.wallets.map(w => `<button type="button" class="cc wch${w.id === sel ? ' on' : ''}" data-id="${w.id}" style="--c:${w.color}"><i></i>${esc(w.name)}</button>`).join('')}</div>`;
function pickOne(box, cb) { box.onclick = e => { const b = e.target.closest('button'); if (!b) return; box.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); cb(b); }; }

/* ---- buat / ubah dompet ---- */
function walSheet(w) {
  const edit = !!w, pres = WPRE.filter(p => !meta.wallets.some(x => wkey(x.name) === wkey(p[0])));
  let type = w ? w.type : 'bank', color = w ? w.color : WCOL[meta.wallets.length % WCOL.length];
  const cur = w ? walBal().byId[w.id].bal : 0, curB = w ? Math.max(0, walBal().byId[w.id].bonus) : 0;
  const n = el(`<form class="form" autocomplete="off">
    ${edit ? '' : `<div class="cf"><span>Mulai cepat</span><div class="ccs" id="wf-pre">${pres.map((p, i) => `<button type="button" class="cc wch" data-i="${i}" style="--c:${p[2]}"><i></i>${p[0]}</button>`).join('')}</div></div>`}
    <label>Nama dompet<input id="wf-n" placeholder="mis. BCA, GoPay, Dompet kuliah" maxlength="24" value="${esc(w ? w.name : '')}" required></label>
    <div class="cf"><span>Jenis</span><div class="ccs" id="wf-t">${Object.keys(WT).map(k => `<button type="button" class="cc${k === type ? ' on' : ''}" data-t="${k}">${WT[k]}</button>`).join('')}</div></div>
    <div class="cf"><span>Warna</span><div class="swat" id="wf-c">${WCOL.map(c => `<button type="button" class="sw${c === color ? ' on' : ''}" data-c="${c}" style="--c:${c}" aria-label="Warna ${c}"></button>`).join('')}</div></div>
    <div class="cf"><span>Saldo sekarang <em>(samain sama yang di aplikasi bank/e-walletmu)</em></span>${amtHTML('wf-a', Math.max(0, cur))}</div>
    <div class="cf" id="wf-bw"${type === 'point' ? '' : ' hidden'}><span>Saldo bonus point <em>(terpisah, nggak bisa digabung)</em></span><input id="wf-b" inputmode="numeric" placeholder="0" value="${curB ? NF.format(curB) : ''}"></div>
    <label class="chk"><input type="checkbox" id="wf-au"${!w || w.auto !== false ? ' checked' : ''}> Ikut transaksi baru <small>Matikan kalau saldonya mau kamu isi sendiri, mis. dana darurat.</small></label>
    <label class="chk"><input type="checkbox" id="wf-x"${w && w.excl ? ' checked' : ''}> Jangan masukkan ke total saldo <small>Mis. dana darurat atau point.</small></label>
    ${edit ? `<p class="hint">Saldo dihitung dari ${w.since ? w.since.slice(8, 10) + '/' + w.since.slice(5, 7) + '/' + w.since.slice(0, 4) + ' ' + w.since.slice(11, 16) : '-'}. Kalau saldo di atas kamu ubah, hitungannya mulai lagi dari sekarang.</p>` : `<details class="mored"><summary>Lanjutan</summary><label>Hitung transaksi mulai<input type="datetime-local" id="wf-s" value="${nowLocal()}"></label><p class="hint">Transaksi sebelum waktu ini nggak ngaruh ke saldo.</p></details>`}
    <div class="acts">${edit ? '<button type="button" class="btn-s btn-d" id="wf-del">Hapus</button>' : ''}<button type="submit" class="btn-p">${edit ? 'Simpan' : 'Buat dompet'}</button></div></form>`);
  const q = s => n.querySelector(s);
  bindAmt(n, 'wf-a'); q('#wf-b').oninput = e => { e.target.value = fmtAmt(e.target.value); };
  const setType = t => { type = t; q('#wf-bw').hidden = t !== 'point'; if (t === 'point' && !edit) q('#wf-x').checked = true; q('#wf-t').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.t === t)); };
  const setColor = c => { color = c; q('#wf-c').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.c === c)); };
  q('#wf-t').onclick = e => { const b = e.target.closest('button'); if (b) setType(b.dataset.t); };
  q('#wf-c').onclick = e => { const b = e.target.closest('button'); if (b) setColor(b.dataset.c); };
  const pre = q('#wf-pre'); if (pre) pre.onclick = e => { const b = e.target.closest('button'); if (!b) return; const p = pres[+b.dataset.i]; q('#wf-n').value = p[0]; setType(p[1]); setColor(p[2]); q('#wf-a').focus && !TOUCH() && q('#wf-a').focus(); };
  q('form').onsubmit = e => {
    e.preventDefault();
    const name = q('#wf-n').value.trim(); if (!name) return;
    if (meta.wallets.some(x => (!w || x.id !== w.id) && wkey(x.name) === wkey(name))) { toast('Nama dompet itu udah ada'); return; }
    const snap = walSnap(), target = amtVal(n, 'wf-a'), bt = type === 'point' ? (+q('#wf-b').value.replace(/\D/g, '') || 0) : 0, excl = q('#wf-x').checked, auto = q('#wf-au').checked;
    if (edit) {
      const old = w.name; w.name = name; w.type = type; w.color = color; w.excl = excl;
      if (old !== name) recs.forEach(r => { if (wkey(r.ac) === wkey(old)) r.ac = name; });
      if (target !== Math.max(0, cur) || bt !== curB || auto !== (w.auto !== false)) { w.base = target; w.bbase = bt; w.since = nowSec(); }   // geser patokan ke sekarang
      w.auto = auto;
    } else { const sv = q('#wf-s') && q('#wf-s').value; meta.wallets.push({ id: wid('w'), name, type, color, base: target, bbase: bt, since: sv ? sv.slice(0, 16) + ':00' : nowSec(), auto, excl }); }
    closeSheet(); buzz(); walChanged(edit ? 'Dompet diperbarui' : 'Dompet ' + name + ' dibuat', () => walRestore(snap));
  };
  const del = q('#wf-del');
  if (del) del.onclick = () => confirmBtn(del, 'Yakin? Ketuk lagi', () => {
    const snap = walSnap(); meta.wallets = meta.wallets.filter(x => x.id !== w.id); meta.xfers = meta.xfers.filter(x => x.f !== w.id && x.to !== w.id);
    closeSheet(); walChanged('Dompet dihapus (transaksinya tetap ada)', () => walRestore(snap));
  });
  openSheet(edit ? 'Ubah dompet' : 'Dompet baru', n);
  if (!edit && !TOUCH()) setTimeout(() => q('#wf-n').focus(), 60);
}

/* ---- isi saldo (pemasukan) & transfer antar dompet ---- */
function fundSheet(o = {}) {
  if (!meta.wallets.length) { walSheet(); return; }
  const W = meta.wallets; let mode = o.mode || 'I', to = o.to || W[0].id, from = o.from || (W.find(x => x.id !== to && /mandiri/i.test(x.name)) || W.find(x => x.id !== to) || W[0]).id, fee = 0;
  const m = {}; recs.forEach(r => { if (r.k === 'I') m[r.c] = (m[r.c] || 0) + 1; });
  const cats = Object.keys(m).sort((a, b) => m[b] - m[a]); ['Allowance', 'Penghasilan Lain', 'Other'].forEach(b => { if (!cats.includes(b)) cats.push(b); });
  let ic = cats[0], bmode = 'auto';
  const isPt = () => { const d = W.find(x => x.id === to); return !!d && d.type === 'point'; };
  const n = el(`<form class="form" autocomplete="off">
    <div class="seg"><button type="button" data-m="I">Isi saldo</button><button type="button" data-m="T">Transfer</button></div>
    ${amtHTML('fd-a', 0)}
    <div class="cf" id="fd-fw"><span>Dari dompet</span>${wChips('fd-f', from)}</div>
    <div class="cf"><span id="fd-tl">Masuk ke dompet</span>${wChips('fd-t', to)}</div>
    <div class="cf" id="fd-cw"><span>Sumber pemasukan</span><div class="ccs" id="fd-c">${cats.slice(0, 6).map(c => `<button type="button" class="cc${c === ic ? ' on' : ''}" data-c="${esc(c)}">${esc(cat(c))}</button>`).join('')}</div></div>
    <div class="cf" id="fd-ew"><span>Biaya admin <em>(opsional, dicatat sebagai pengeluaran)</em></span><div class="ccs" id="fd-e">${[0, 1000, 2500, 6500].map(v => `<button type="button" class="cc${v === 0 ? ' on' : ''}" data-v="${v}">${v ? rp(v) : 'Tanpa'}</button>`).join('')}</div><input id="fd-fc" inputmode="numeric" placeholder="atau ketik nominal lain, mis. 5940" style="margin-top:8px"></div>
    <div class="cf" id="fd-bw" hidden><span>Bonus point <em>(5% untuk top-up minimal Rp1.000.000)</em></span><div class="ccs" id="fd-b"><button type="button" class="cc on" data-b="auto">5% otomatis</button><button type="button" class="cc" data-b="0">Tanpa</button></div><input id="fd-bc" inputmode="numeric" placeholder="atau ketik bonus lain" style="margin-top:8px"><div class="hint" id="fd-pi"></div></div>
    <label class="chk" id="fd-xw" hidden><input type="checkbox" id="fd-ex" checked> Catat top-up sebagai pengeluaran <small>Masuk statistik, saldo sumbernya cuma berkurang sekali.</small></label>
    <label>Catatan <small>(opsional)</small><input id="fd-n" placeholder="mis. uang saku mingguan"></label>
    <div class="acts"><button type="submit" class="btn-p" id="fd-go">Simpan</button></div></form>`);
  const q = s => n.querySelector(s);
  bindAmt(n, 'fd-a');
  const feeOf = () => { const c = +q('#fd-fc').value.replace(/\D/g, ''); return c || fee; };
  const bonusOf = a => { const c = +q('#fd-bc').value.replace(/\D/g, ''); return c || (bmode === 'auto' && a >= 1e6 ? Math.round(a * .05) : 0); };
  const info = () => { const a = amtVal(n, 'fd-a'), b = bonusOf(a), el2 = q('#fd-pi'); if (el2) el2.textContent = a ? 'Point masuk: ' + rp(a) + (b ? ' · Bonus point (terpisah): ' + rp(b) : '') : ''; };
  const sync = () => {
    n.querySelectorAll('.seg button').forEach(b => b.classList.toggle('on', b.dataset.m === mode));
    q('#fd-fw').hidden = q('#fd-ew').hidden = mode !== 'T'; q('#fd-cw').hidden = mode !== 'I';
    const pt = mode === 'T' && isPt(); q('#fd-bw').hidden = q('#fd-xw').hidden = !pt; info();
    q('#fd-tl').textContent = mode === 'T' ? 'Ke dompet' : 'Masuk ke dompet'; q('#fd-go').textContent = mode === 'T' ? 'Transfer' : 'Isi saldo';
  };
  sync();
  n.querySelector('.seg').onclick = e => { const b = e.target.closest('button'); if (b) { mode = b.dataset.m; sync(); } };
  pickOne(q('#fd-f'), b => { from = b.dataset.id; }); pickOne(q('#fd-t'), b => {
    to = b.dataset.id;
    if (from === to) { from = (W.find(x => x.id !== to && /mandiri/i.test(x.name)) || W.find(x => x.id !== to) || W[0]).id; q('#fd-f').querySelectorAll('button').forEach(x => x.classList.toggle('on', x.dataset.id === from)); }
    sync();
  });
  pickOne(q('#fd-b'), b => { bmode = b.dataset.b; q('#fd-bc').value = ''; info(); });
  n.addEventListener('input', info); n.addEventListener('click', () => setTimeout(info, 0));
  q('#fd-fc').oninput = e => { e.target.value = e.target.value.replace(/\D/g, ''); q('#fd-e').querySelectorAll('button').forEach(x => x.classList.remove('on')); };
  pickOne(q('#fd-c'), b => { ic = b.dataset.c; }); pickOne(q('#fd-e'), b => { fee = +b.dataset.v; q('#fd-fc').value = ''; });
  q('form').onsubmit = e => {
    e.preventDefault();
    const a = amtVal(n, 'fd-a'); if (!a) { q('#fd-a').focus(); toast('Isi nominalnya dulu'); return; }
    const snap = walSnap(), note = q('#fd-n').value.trim(), tw = W.find(x => x.id === to);
    if (mode === 'I') {
      addBatch([{ t: nowSec(), k: 'I', c: ic, s: '', tg: [], n: note || 'Isi saldo ' + tw.name, a, ac: tw.name }], { skipDup: false });
      closeSheet(); buzz(); fillFilters(); walChanged(tw.name + ' +' + rp(a), () => walRestore(snap));
    } else {
      if (!from || from === to) { toast('Dompet asal dan tujuannya harus beda'); return; }
      const fw = W.find(x => x.id === from), pt = isPt(), fe = feeOf(), x = { id: wid('x'), t: nowSec(), f: from, to, a, fee: fe, n: note };
      if (pt) { const b = bonusOf(a); if (b) x.bonus = b; if (q('#fd-ex').checked) { x.ns = 1; x.eid = addBatch([{ t: x.t, k: 'E', c: 'Hiburan & Game', s: 'Hobi', tg: ['topup'], n: 'Top up ' + tw.name, a, ac: fw.name }], { skipDup: false }).ids[0]; } }
      if (fe) x.fid = addBatch([{ t: x.t, k: 'E', c: pt ? 'Hiburan & Game' : 'Other', s: pt ? 'Hobi' : '', tg: ['admin'], n: 'Biaya admin transfer', a: fe, ac: fw.name }], { skipDup: false }).ids[0];
      meta.xfers.unshift(x); closeSheet(); buzz(); fillFilters(); walChanged(fw.name + ' → ' + tw.name + ' ' + rp(a), () => walRestore(snap));
    }
  };
  openSheet(mode === 'T' ? 'Transfer antar dompet' : 'Isi saldo', n);
}

function xferInfo(id) {
  const x = meta.xfers.find(v => v.id === id); if (!x) return;
  const f = meta.wallets.find(w => w.id === x.f), t = meta.wallets.find(w => w.id === x.to), d = dateOf(x.t);
  const n = el(`<div class="det"><div class="big">${rp(x.a)}</div>
    <div class="kv"><span>Dari</span><b>${esc(f ? f.name : '(dompet dihapus)')}</b></div><div class="kv"><span>Ke</span><b>${esc(t ? t.name : '(dompet dihapus)')}</b></div>
    ${x.bonus ? `<div class="kv"><span>Bonus point</span><b>+${rp(x.bonus)}</b></div>` : ''}${x.fee ? `<div class="kv"><span>Biaya admin</span><b>${rp(x.fee)}</b></div>` : ''}${x.n ? `<div class="kv"><span>Catatan</span><b>${esc(x.n)}</b></div>` : ''}
    <div class="kv"><span>Waktu</span><b>${DOWL[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()} · ${x.t.slice(11, 16)}</b></div>
    <div class="acts"><button type="button" class="btn-s btn-d" id="xf-del">Hapus transfer</button></div></div>`);
  openSheet('Detail transfer', n);
  const b = n.querySelector('#xf-del');
  b.onclick = () => confirmBtn(b, 'Yakin? Ketuk lagi', () => { const snap = walSnap(); if (!plDropRecords(recs.filter(r => r.id === x.fid || r.id === x.eid))) return; meta.xfers = meta.xfers.filter(v => v.id !== id); recs = recs.filter(r => r.id !== x.fid && r.id !== x.eid); closeSheet(); fillFilters(); walChanged('Transfer dihapus', () => walRestore(snap)); });
}

/* ---- cocokkan saldo dengan aplikasi bank/e-wallet ---- */
const ago = t => { if (!t) return ''; const d = Math.floor((Date.now() - new Date(t.slice(0, 19))) / 864e5); return d <= 0 ? 'hari ini' : d + ' hari lalu'; };
function reconSheet(w) {
  const B0 = walBal().byId[w.id], cur = B0.bal, curB = B0.bonus, pt = w.type === 'point';
  const n = el(`<form class="form" autocomplete="off"><p class="hint" style="margin:0">Saldo di sini: <b>${rpS(cur)}</b>${pt ? ' · bonus <b>' + rpS(curB) + '</b>' : ''}. Ketik angka yang tampil di aplikasi ${esc(w.name)} sekarang.</p>
    ${amtHTML('rc-a', Math.max(0, cur))}${pt ? `<div class="cf"><span>Bonus point</span><input id="rc-b" inputmode="numeric" placeholder="0" value="${curB > 0 ? NF.format(curB) : ''}"></div>` : ''}<div class="rc-d" id="rc-d"></div>
    <div class="acts"><button type="submit" class="btn-p">Cocokkan</button></div></form>`);
  bindAmt(n, 'rc-a');
  const d = n.querySelector('#rc-d'), inp = n.querySelector('#rc-a');
  const upd = () => { const v = amtVal(n, 'rc-a'), df = v - cur; d.className = 'rc-d ' + (df ? (df < 0 ? 'neg' : 'pos') : 'ok'); d.textContent = df === 0 ? 'Udah cocok.' : df < 0 ? 'Di aplikasi lebih kecil ' + rp(-df) + '. Mungkin ada pengeluaran yang belum kamu catat.' : 'Di aplikasi lebih besar ' + rp(df) + '. Mungkin ada pemasukan yang belum kamu catat.'; };
  const rb = n.querySelector('#rc-b'); if (rb) rb.oninput = e => { e.target.value = fmtAmt(e.target.value); };
  upd(); n.addEventListener('input', upd); n.addEventListener('click', () => setTimeout(upd, 0));
  n.querySelector('form').onsubmit = e => {
    e.preventDefault(); const v = amtVal(n, 'rc-a'), snap = walSnap(), df = v - cur, vb = rb ? (+rb.value.replace(/\D/g, '') || 0) : 0;
    w.base = v; if (pt) w.bbase = vb; w.since = nowSec(); w.rec = { t: w.since, d: df };
    closeSheet(); buzz(); walChanged(df ? 'Dicocokkan (selisih ' + rpS(df) + ')' : 'Saldo udah cocok', () => walRestore(snap));
  };
  openSheet('Cocokkan saldo', n);
}

/* ---- catatan pemakaian point (tidak mengubah saldo maupun statistik) ---- */
function logSheet(w, id) {
  const cur = id && (w.log || []).find(l => l.id === id);
  const n = el(`<form class="form" autocomplete="off">${amtHTML('lg-a', cur ? cur.a : 0)}${w.type === 'point' ? `<div class="cf"><span>Dari</span><div class="ccs" id="lg-s"><button type="button" class="cc${cur && cur.s === 'b' ? '' : ' on'}" data-s="p">Point</button><button type="button" class="cc${cur && cur.s === 'b' ? ' on' : ''}" data-s="b">Bonus point</button></div></div>` : ''}<label>Dipakai untuk<input id="lg-n" placeholder="mis. voucher, hadiah" value="${esc(cur ? cur.n : '')}"></label>
    <label>Waktu<input type="datetime-local" id="lg-t" value="${cur ? cur.t.slice(0, 16) : nowLocal()}"></label><p class="hint">Cuma buat arsip. Saldo dan statistik nggak berubah. Kalau saldo point udah beda, pakai Cocokkan.</p>
    <div class="acts">${cur ? '<button type="button" class="btn-s btn-d" id="lg-del">Hapus</button>' : ''}<button type="submit" class="btn-p">Simpan</button></div></form>`);
  bindAmt(n, 'lg-a'); const ls = n.querySelector('#lg-s'); if (ls) pickOne(ls, () => {});
  n.querySelector('form').onsubmit = e => {
    e.preventDefault(); const a = amtVal(n, 'lg-a'); if (!a) { toast('Isi nominalnya dulu'); return; }
    const snap = walSnap(), o = { id: cur ? cur.id : wid('l'), t: (n.querySelector('#lg-t').value || nowLocal()).slice(0, 16) + ':00', n: n.querySelector('#lg-n').value.trim(), a, s: ls && ls.querySelector('.on').dataset.s === 'b' ? 'b' : 'p' };
    w.log = (w.log || []).filter(l => l.id !== o.id).concat(o).sort((x, y) => x.t < y.t ? 1 : -1);
    closeSheet(); walChanged('Pemakaian dicatat', () => walRestore(snap));
  };
  const d = n.querySelector('#lg-del'); if (d) d.onclick = () => { const snap = walSnap(); w.log = w.log.filter(l => l.id !== id); closeSheet(); walChanged('Catatan dihapus', () => walRestore(snap)); };
  openSheet(cur ? 'Ubah catatan' : 'Catat pemakaian', n);
}

/* ---- detail satu dompet ---- */
function walDetail(id) {
  const B = walBal(), o = B.byId[id]; if (!o) return; const w = o.w, k = wkey(w.name), act = [];
  for (const r of recs) { if (wkey(r.ac) !== k) continue; act.push({ t: r.t, id: r.id, ty: 'r', lab: r.n ? cn(r.n) : cat(r.c), sub: cat(r.c) + (plRes().linked.has(r.id) ? ' · PayLater: belum memotong saldo' : !o.auto || r.t <= o.since ? ' · tidak dihitung' : ''), a: r.k === 'I' ? r.a : -r.a }); if (act.length >= 10) break; }
  (meta.plPays || []).forEach(y => { const sr = plPaySrc(y); sr.forEach(x => { if (x.w === id) act.push({ t: y.t, id: y.id, ty: 'p', lab: 'Bayar PayLater', sub: (sr.length > 1 ? 'Rp' + NF.format(x.a) + ' dari ' + rp(y.a) + ' (' + sr.length + ' dompet)' : 'pokok') + (!o.auto || y.t <= o.since ? ' · tidak dihitung' : ''), a: -x.a }); }); });
  meta.xfers.forEach(x => { if (x.f !== id && x.to !== id) return; const out = x.f === id, ot = B.byId[out ? x.to : x.f]; act.push({ t: x.t, id: x.id, ty: 'x', lab: (out ? 'Transfer ke ' : 'Transfer dari ') + (ot ? ot.w.name : 'dompet dihapus'), sub: x.n || '', a: out ? -x.a : x.a }); });
  act.sort((a, b) => a.t < b.t ? 1 : -1);
  const n = el(`<div class="wd"><div class="wd-hero${lightCard(w.color) ? ' lt' : ''}" style="--c:${w.color}"><span class="wc-ic">${wIco(w.type, 24)}</span><div><small>${WT[w.type]} · ${o.auto ? 'otomatis' : 'manual'}${w.excl ? ' · di luar total' : ''}</small><b class="${o.bal < 0 ? 'r' : ''}">${rpS(o.bal)}</b></div></div>
    ${w.type === 'point' ? `<div class="wd-bonus"><span>Bonus point <small>(terpisah)</small></span><b>${rp(Math.max(0, o.bonus))}</b></div>` : ''}<div class="wd-m"><span>Bulan ini</span><b class="g">+${rp(o.mi)}</b><b class="e">−${rp(o.me)}</b></div>
    <div class="acts wd-acts"><button type="button" class="btn-p" id="wd-fund">Isi saldo</button><button type="button" class="btn-s" id="wd-xf">Transfer</button><button type="button" class="btn-s" id="wd-rc">Cocokkan</button><button type="button" class="btn-s" id="wd-ed">Ubah</button></div>
    <div class="wd-rec">${w.rec ? 'Terakhir cocok ' + ago(w.rec.t) + (w.rec.d ? ' · selisih ' + rpS(w.rec.d) : '') : 'Belum pernah dicocokkan'}</div>
    ${w.type === 'point' ? `<h4 class="wd-h">Catatan pemakaian <small>Cuma arsip, nggak ngubah saldo atau statistik.</small></h4>${(w.log || []).slice(0, 8).map(l => `<button type="button" class="wa-r" data-ty="l" data-id="${esc(l.id)}"><span><b>${esc(l.n || 'Dipakai')}</b><small>${l.t.slice(8, 10)}/${l.t.slice(5, 7)}${l.s === 'b' ? ' · bonus' : ''}</small></span><b>${rp(l.a)}</b></button>`).join('') || '<div class="empty">Belum ada catatan.</div>'}<div class="acts"><button type="button" class="btn-s" id="wd-lg">+ Catat pemakaian</button></div>` : ''}
    <h4 class="wd-h">Aktivitas terakhir</h4>
    ${act.slice(0, 10).map(a => `<button type="button" class="wa-r" data-ty="${a.ty}" data-id="${esc(a.id)}"><span><b>${esc(a.lab)}</b><small>${a.t.slice(8, 10)}/${a.t.slice(5, 7)}${a.sub ? ' · ' + esc(a.sub) : ''}</small></span><b class="${a.a > 0 ? 'in' : ''}">${a.a > 0 ? '+' : '−'}${rp(Math.abs(a.a))}</b></button>`).join('') || '<div class="empty">Belum ada aktivitas di dompet ini.</div>'}</div>`);
  openSheet(w.name, n);
  n.querySelector('#wd-fund').onclick = () => fundSheet({ to: id });
  n.querySelector('#wd-xf').onclick = () => fundSheet({ mode: 'T', from: id, to: (meta.wallets.find(x => x.id !== id) || w).id });
  n.querySelector('#wd-ed').onclick = () => walSheet(w);
  n.querySelector('#wd-rc').onclick = () => reconSheet(w);
  const lg = n.querySelector('#wd-lg'); if (lg) lg.onclick = () => logSheet(w);
  n.onclick = e => { const b = e.target.closest('.wa-r'); if (!b) return; b.dataset.ty === 'x' ? xferInfo(b.dataset.id) : b.dataset.ty === 'p' ? plPayInfo(b.dataset.id) : b.dataset.ty === 'l' ? logSheet(w, b.dataset.id) : detailSheet(b.dataset.id); };
}

let xhN = 20;
let wkSel = '';
/* FLIP: ubah tata letak langsung, lalu geser kartu dari posisi lama lewat transform (bukan animasi margin) */
function flipCards(box, change) {
  const cs = [...box.querySelectorAll('.wk')], y0 = cs.map(c => c.getBoundingClientRect().top);
  change();
  if (reduce) return;
  cs.forEach((c, i) => { const d = y0[i] - c.getBoundingClientRect().top; if (Math.abs(d) > 1) c.animate([{ transform: `translate3d(0,${d}px,0)` }, { transform: 'none' }], { duration: 450 * SPD, easing: IOS }); });
}
document.addEventListener('click', e => { if (!wkSel || e.target.closest('.wstack,.overlay,.ctxm,#toast')) return; const bx = document.querySelector('.wstack'); const un = () => { wkSel = ''; document.querySelectorAll('.wk.sel').forEach(x => x.classList.remove('sel')); }; bx ? flipCards(bx, un) : un(); });
function renderWal() {
  const B = walBal(), box = $('#wallets');
  if (!meta.wallets.length) {
    box.innerHTML = `<div class="bud welc"><h2>Dompetmu</h2><p>Isi saldo rekening dan e-walletmu sesuai angka di aplikasinya. Yang nambah atau ngurangin saldo cuma transaksi yang kamu catat sesudahnya. Riwayat lama nggak ikut dihitung.</p>
      <div class="ccs" id="wl-pre">${WPRE.slice(0, 6).map((p, i) => `<button type="button" class="cc wch" data-i="${i}" style="--c:${p[2]}"><i></i>${p[0]}</button>`).join('')}</div>
      <div class="acts"><button type="button" class="btn-p" id="wl-new">Buat dompet pertama</button></div></div>`;
    $('#wl-new').onclick = () => walSheet();
    $('#wl-pre').onclick = e => { const b = e.target.closest('button'); if (!b) return; walSheet(); const p = WPRE[+b.dataset.i], nm = document.querySelector('#sheet-body #wf-n'); if (nm) { nm.value = p[0]; const bt = document.querySelector('#wf-t [data-t="' + p[1] + '"]'), bc = document.querySelector('#wf-c [data-c="' + p[2] + '"]'); if (bt) bt.click(); if (bc) bc.click(); } };
  } else {
    const pos = B.list.filter(o => o.bal > 0 && !o.w.excl), sum = pos.reduce((s, o) => s + o.bal, 0) || 1;
    box.innerHTML = `<div class="wl-hero"><small>Total saldo</small><div class="wl-n" id="wl-total"></div>
      <div class="wl-bar">${pos.map(o => `<i style="flex:${Math.max(.03, o.bal / sum)};--c:${o.w.color}"></i>`).join('')}</div>
      <div class="wl-acts"><button type="button" class="btn-s" id="wl-fund">+ Isi saldo</button><button type="button" class="btn-s" id="wl-xf">⇄ Transfer</button></div></div>
      <div class="wk-head"><h2 class="sec">Dompetku</h2><button type="button" class="wk-plus" id="wl-new" aria-label="Tambah dompet"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button></div>
      <div class="wstack">${B.list.map((o, i) => `<button type="button" class="wcard wk${wkSel === o.w.id ? ' sel' : ''}${lightCard(o.w.color) ? ' lt' : ''}" data-id="${o.w.id}" style="--c:${o.w.color};z-index:${i + 1}"><span class="wk-top"><span class="wk-l"><span class="wc-ic">${wIco(o.w.type, 18)}</span><b class="wc-n">${esc(o.w.name)}</b></span><span class="wc-b" id="wb-${o.w.id}"></span></span>
        <span class="wk-chip" aria-hidden="true"><svg class="chip" viewBox="0 0 40 30" width="40" height="30"><rect x="1" y="1" width="38" height="28" rx="6" stroke="rgba(0,0,0,.28)"/><path d="M1 10h12M1 20h12M27 10h12M27 20h12M13 1v28M27 1v28M13 15h14" fill="none" stroke="rgba(0,0,0,.3)"/></svg><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M8 8.5a5 5 0 0 1 0 7M12 6a8.500 8.500 0 0 1 0 12M16 3.500a12 12 0 0 1 0 17"/></svg></span>
        <span class="wk-num" aria-hidden="true">•••• •••• •••• ${String(Math.abs([...o.w.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)) % 10000).padStart(4, '0')}</span>
        <span class="wk-bot"><span class="wk-ho"><small>PEMEGANG</small><b>${esc(userName().toUpperCase())}</b><small class="wc-m">${o.bal < 0 ? 'Saldo minus. Ketuk buat dibenerin' : !o.auto ? 'Manual, nggak ikut transaksi' : o.mi || o.me ? 'Bulan ini ' + (o.mi ? '+' + jt(o.mi) + ' ' : '') + (o.me ? '−' + jt(o.me) : '') : 'Belum ada aktivitas bulan ini'}</small></span>
        <span class="wk-rt"><span class="wc-t">${WT[o.w.type]}${o.auto ? '' : ' · manual'}${o.w.excl ? ' · di luar total' : ''}</span>${o.w.type === 'point' ? '<span class="wc-bn">+ Bonus ' + rp(Math.max(0, o.bonus)) + '</span>' : ''}${o.w.type === 'ewallet' ? '<span class="wc-up" role="button" tabindex="0" data-up="' + o.w.id + '">+ Top-up</span>' : ''}</span></span></button>`).join('')}</div>${B.list.length > 1 ? '<p class="hint wk-hint">Ketuk kartu untuk membukanya, ketuk bagian atasnya lagi untuk menutup. Ketuk badan kartu untuk melihat detail.</p>' : ''}
      ${meta.xfers.length ? `<h2 class="sec">Riwayat transfer</h2><div class="xhist" id="wl-xh">${meta.xfers.slice(0, xhN).map(x => { const f = B.byId[x.f], t = B.byId[x.to]; return `<button type="button" class="wa-r" data-id="${esc(x.id)}"><span><b>${esc(f ? f.w.name : 'dompet dihapus')} → ${esc(t ? t.w.name : 'dompet dihapus')}</b><small>${x.t.slice(8, 10)}/${x.t.slice(5, 7)}/${x.t.slice(0, 4)} ${x.t.slice(11, 16)}${x.bonus ? ' · bonus ' + rp(x.bonus) : ''}${x.fee ? ' · admin ' + rp(x.fee) : ''}${x.n ? ' · ' + esc(x.n) : ''}</small></span><b>${rp(x.a)}</b></button>`; }).join('')}</div>${meta.xfers.length > xhN ? '<button type="button" class="btn-s" id="wl-xmore">Tampilkan lebih banyak</button>' : ''}` : ''}`;
    setNum($('#wl-total'), B.total, rpS); $('#wl-total').classList.toggle('r', B.total < 0);
    B.list.forEach(o => setNum($('#wb-' + o.w.id), o.bal, rpS));
    const xh = $('#wl-xh'); if (xh) xh.onclick = e => { const b = e.target.closest('.wa-r'); if (b) xferInfo(b.dataset.id); }; const xm = $('#wl-xmore'); if (xm) xm.onclick = () => { xhN += 20; renderWal(); };
    $('#wl-fund').onclick = () => fundSheet(); $('#wl-xf').onclick = () => fundSheet({ mode: 'T' }); $('#wl-new').onclick = () => walSheet();
    box.querySelectorAll('.wcard[data-id]').forEach(b => b.onclick = e => {
      // kartu paling bawah: ketuk = detail. Kartu lain: ketuk = naik ke depan; ketuk bagian atasnya lagi = turun; ketuk badan kartu = detail
      const u = e.target.closest('[data-up]'); if (u) { fundSheet({ mode: 'T', to: u.dataset.up }); return; }
      const id = b.dataset.id, nx = b.nextElementSibling, last = !nx || !nx.classList.contains('wk'), strip = !!e.target.closest('.wk-top');
      if (last) { walDetail(id); return; }
      if (wkSel === id) { if (strip) flipCards(box, () => { b.classList.remove('sel'); wkSel = ''; }); else walDetail(id); return; }
      flipCards(box, () => { box.querySelectorAll('.wk.sel').forEach(x => x.classList.remove('sel')); b.classList.add('sel'); wkSel = id; });
      if (!reduce && b.scrollIntoView) setTimeout(() => b.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 60);
    });
  }
}

function walHome() {
  if (!meta.wallets.length) return `<div class="bud nudge"><div><b>Saldo semua akunmu</b><small>Bikin dompet buat Mandiri, GoPay, tunai, dll. Saldonya ikut jalan tiap kamu nyatet.</small></div><button type="button" class="btn-p" id="h-wal">Buat dompet</button></div>`;
  const B = walBal(), top = B.list.slice(0, 3);
  return `<button type="button" class="bud wl-home" id="h-wal"><span class="wh-t"><small>Total saldo</small><b id="hw-total"></b></span><span class="wh-r">${top.map(o => `<span class="wh-c" style="--c:${o.w.color}"><i></i>${esc(o.w.name)} <b>${jt(o.bal)}</b></span>`).join('')}${B.list.length > 3 ? `<span class="wh-c mute">+${B.list.length - 3} lagi</span>` : ''}</span></button>`;
}
function bkNudge() {
  const age = meta.lastBackup ? (Date.now() - meta.lastBackup) / 864e5 : Infinity;
  if (!recs.length || !(meta.changes >= 20 || (meta.changes >= 1 && age >= 7))) return '';
  const when = meta.lastBackup ? 'Backup terakhir ' + Math.floor(age) + ' hari lalu' : 'Belum pernah backup';
  return `<div class="bud nudge"><div><b>Waktunya backup</b><small>${when}, ada ${meta.changes} perubahan yang belum aman. Datamu cuma ada di browser ini.</small></div><button type="button" class="btn-p" id="h-bk">Cadangkan</button></div>`;
}

/* ---------- navigasi ---------- */
const topKey = () => tab === 'tl' ? 'tl' : tab === 'cal' ? 'cal' : tab === 'st' ? stTab : tab === 'sum' ? 'ins' : '';
/* pil tab (lensa kaca): posisi dihitung dari tab aktif; saat pindah, tepi depan melaju duluan lalu tepi belakang menyusul */
let indX = null, indW = 0, indAnim = null;
const indEl = () => document.querySelector('.tab-ind');
const indBase = () => { const bar = $('#tabbar'); return bar.getBoundingClientRect().left + bar.clientLeft + 5; };
function setInd(x, w) { const el = indEl(); el.style.width = w + 'px'; el.style.transform = 'translate3d(' + x + 'px,0,0)'; indX = x; indW = w; }
function slideInd(animate) {
  const on = document.querySelector('.tab.on'), el = indEl(); if (!el) return; el.style.opacity = on ? '' : '0'; if (!on) return;
  const base = indBase(), x1 = on.offsetLeft - 5, w1 = on.offsetWidth;   // ukuran layout: tidak terpengaruh efek tekan (scale) pada tab
  if (!animate || reduce || indX == null) { if (indAnim) { indAnim.cancel(); indAnim = null; } setInd(x1, w1); return; }
  const cur = el.getBoundingClientRect(), x0 = cur.left - base, w0 = cur.width;
  if (indAnim) { indAnim.cancel(); indAnim = null; }
  if (Math.abs(x0 - x1) < 1 && Math.abs(w0 - w1) < 1) { setInd(x1, w1); return; }
  const lo = Math.min(x0, x1), hi = Math.max(x0 + w0, x1 + w1);
  setInd(x1, w1);
  indAnim = el.animate([
    { transform: 'translate3d(' + x0 + 'px,0,0) scaleX(' + (w0 / w1) + ')' },
    { transform: 'translate3d(' + lo + 'px,0,0) scaleX(' + ((hi - lo) / w1) + ')', offset: .42 },
    { transform: 'translate3d(' + x1 + 'px,0,0) scaleX(1)' }
  ], { duration: (lite ? 460 : 560) * SPD, easing: IOS });
}
function moveBot(animate) {
  const b = tab === 'home' ? 'home' : tab === 'wal' ? 'wal' : tab === 'tl' || tab === 'cal' ? 'tl' : tab === 'st' || tab === 'sum' ? 'cat' : tab === 'plan' ? 'plan' : '';
  document.querySelectorAll('.tab').forEach(x => x.classList.toggle('on', x.dataset.nav === b));
  root.dataset.tab = b || 'data';
  const pt = $('#ptitle');
  if (pt) {
    pt.classList.toggle('gr', b === 'home');
    if (b === 'home') { const d = new Date(); pt.innerHTML = '<span class="gr-t"><small>' + DOWL[d.getDay()].toUpperCase() + ', ' + d.getDate() + ' ' + MS[d.getMonth()].toUpperCase() + '</small><b>Halo, ' + esc(userName()) + '</b></span><span class="gr-av" aria-hidden="true">' + avatarHTML() + '</span>'; }
    else pt.textContent = ({ wal: 'Dompet', tl: tab === 'cal' ? 'Kalender' : 'Transaksi', cat: tab === 'sum' ? 'Insight' : 'Statistik', plan: 'Rencana' })[b] || 'Pengaturan';
  }
  const nt = $('#nb-t'); if (nt) nt.textContent = ({ home: 'Beranda', wal: 'Dompet', tl: tab === 'cal' ? 'Kalender' : 'Transaksi', cat: tab === 'sum' ? 'Insight' : 'Statistik', plan: 'Rencana' })[b] || 'Pengaturan';
  slideInd(animate === true);
}
const TOPS = { A: [['tl', 'Harian'], ['cal', 'Kalender']], B: [['cat', 'Kategori'], ['m', 'Bulanan'], ['y', 'Tahunan'], ['ins', 'Insight']] };
let topSet = '';
function syncTop() {
  const t = topKey(), bar = $('#toptabs'), set = tab === 'tl' || tab === 'cal' ? 'A' : tab === 'st' || tab === 'sum' ? 'B' : '';
  bar.hidden = !set; if (!set) return;
  if (set !== topSet) { topSet = set; bar.innerHTML = '<div class="seg-track">' + TOPS[set].map(x => `<button type="button" class="ttab" data-top="${x[0]}">${x[1]}</button>`).join('') + '</div>'; bar.style.setProperty('--n', TOPS[set].length); }
  const i = TOPS[set].findIndex(x => x[0] === t);
  bar.querySelectorAll('.ttab').forEach(x => x.classList.toggle('on', x.dataset.top === t));
  bar.style.setProperty('--i', Math.max(0, i)); if (i < 0) bar.dataset.none = 1; else delete bar.dataset.none;
}
function moveInd(animate) { syncTop(); moveBot(animate); }
function navTo(k) {   // tab atas
  if (k === 'cat' || k === 'm' || k === 'y') {
    if (tab !== 'st') { stTab = k; dirty.st = 1; go('st'); return; }
    if (stTab === k) return; const o = ['cat', 'm', 'y'], d = o.indexOf(k) > o.indexOf(stTab) ? 1 : -1;
    stTab = k; renderSt(); moveInd(); slide($('#st-body'), d);
  } else go(k === 'ins' ? 'sum' : k);
}
function navBot(k) {   // menu bawah: ingat sub-tab terakhir di tiap bagian
  if (k === 'tl') go(tab === 'cal' ? 'cal' : 'tl');
  else if (k === 'cat') go(tab === 'sum' ? 'sum' : 'st');
  else go(k);
}
(() => { /* geser pil tab dengan jari: lepas di atas tab tujuan untuk pindah */
  const bar = $('#tabbar'); let d = null, swallow = false;
  bar.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse' && e.button !== 0) return; d = { id: e.pointerId, x0: e.clientX, start: indX == null ? 0 : indX, on: false }; });
  bar.addEventListener('pointermove', e => {
    if (!d || e.pointerId !== d.id) return; const dx = e.clientX - d.x0;
    if (!d.on) { if (Math.abs(dx) < 8) return; d.on = true; try { bar.setPointerCapture(e.pointerId); } catch (x) {} if (indAnim) { indAnim.cancel(); indAnim = null; } }
    const tabs = bar.querySelectorAll('.tab'), max = tabs[tabs.length - 1].offsetLeft - 5;
    setInd(Math.min(max, Math.max(0, d.start + dx)), indW);
  });
  const end = e => {
    if (!d || e.pointerId !== d.id) return; const was = d.on; d = null; if (!was) return;
    swallow = true; setTimeout(() => { swallow = false; }, 0);
    const cx = indX + indW / 2; let best = null, bd = 1e9;
    bar.querySelectorAll('.tab').forEach(t => { const dd = Math.abs(t.offsetLeft - 5 + t.offsetWidth / 2 - cx); if (dd < bd) { bd = dd; best = t; } });
    if (best && best.dataset.nav !== (document.querySelector('.tab.on') || {}).dataset.nav) navBot(best.dataset.nav); else slideInd(true);
  };
  bar.addEventListener('pointerup', end); bar.addEventListener('pointercancel', end);
  bar.addEventListener('click', e => { if (swallow) { e.stopPropagation(); e.preventDefault(); } }, true);
})();
let backTab = 'home';
$('#m-set').onclick = () => { if (tab === 'data') go(backTab); else { backTab = tab; go('data'); } };
let slow = +(sessionStorage.getItem('md_slow') || 0);
function guard(ms) { /* pengaman frame drop: matikan kaca jika transisi sering patah-patah */
  if (root.dataset.glass !== 'on') return; const t0 = performance.now(); let last = t0, n = 0, bad = 0;
  const f = now => { n++; if (now - last > 40) bad++; last = now;
    if (now - t0 < ms) return requestAnimationFrame(f);
    if (n > 6 && bad / n > .5 && ++slow >= 6) { root.dataset.glass = 'off'; try { sessionStorage.setItem('md_slow', slow); } catch (e) {} toast('Efek kaca dimatikan biar lebih lancar'); } };
  requestAnimationFrame(f);
}
function slide(node, dir) { if (!reduce) node.animate([{ transform: `translate3d(${dir * (lite ? 12 : 20)}px,0,0)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: (lite ? 260 : 340) * SPD, easing: IOS }); }
let goTk = 0, ghost = null;
const shownView = () => TABS.map(v => $('#view-' + v)).find(v => !v.hidden && !v.classList.contains('ghost-v'));
function dropGhost() { if (!ghost) return; const g = ghost; ghost = null; g.a.cancel(); g.v.classList.remove('ghost-v'); g.v.removeAttribute('style'); g.v.hidden = true; }
/* Pindah tab. Urutannya: (1) layar lama dilepas jadi "hantu" yang memudar di compositor, (2) layar baru dirender SEKALI
   di tugas yang sama, (3) semua animasi dimulai di frame yang sama. Tidak ada kerja berat di tengah animasi. */
function go(t) {
  if (t === tab) { window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }); return; }
  dropGhost(); goTk++;
  const dir = TABS.indexOf(t) > TABS.indexOf(tab) ? 1 : -1, old = shownView(), nv = $('#view-' + t);
  root.classList.add('nt');   // aksen berganti: tahan transisi warna di kontrol yang terdampak
  tab = t; root.dataset.tab = t; moveBot(true);
  if (old) {
    if (reduce) old.hidden = true;
    else { const r = old.getBoundingClientRect(); old.classList.add('ghost-v'); old.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px`; }
  }
  nv.hidden = false; nv.getAnimations().forEach(x => x.cancel());
  NV = {}; $('#filters').hidden = NOFLT.includes(t); $('#tl-bar').hidden = t !== 'tl';
  syncTop(); fx = 1; syncURL(); refresh(); window.scrollTo(0, 0);
  if (old && !reduce) { const an = old.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150 * SPD, easing: OUT, fill: 'forwards' }); ghost = { v: old, a: an }; an.finished.then(() => { if (ghost && ghost.a === an) dropGhost(); }, () => {}); }
  slide(nv, dir); guard((lite ? 300 : 380) * SPD);
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('nt')));
}
/* ganti isi layar yang sedang tampil (ganti bulan/filter): render langsung, lalu isi baru masuk halus (tanpa menunggu pudar dulu) */
function transit(fn, dir) {
  const v = shownView(); fn();
  if (reduce || !v) return;
  v.getAnimations().forEach(x => x.cancel());
  v.animate([{ transform: `translate3d(${(dir || 1) * 10}px,0,0)`, opacity: .35 }, { transform: 'none', opacity: 1 }], { duration: (lite ? 240 : 300) * SPD, easing: IOS });
}
function safeRender(fn) {   // satu layar yang error tidak boleh menjatuhkan layar lain
  const v = document.querySelector('#view-' + tab), old = v && v.querySelector('.render-err'); if (old) old.remove();
  try { fn(); } catch (e) {
    console.error(e);
    if (v) { const m = document.createElement('div'); m.className = 'bud render-err'; m.innerHTML = '<b>Layar ini gagal dimuat</b><p class="hint">Datamu aman. Coba muat ulang halaman. Kalau masih gini, unduh backup dari Pengaturan dulu.</p>'; v.prepend(m); }
  }
}
function refresh() {
  renderStrip(); renderChips();
  const st = $('#status');
  if (!recs.length && tab !== 'home') { st.className = 'warn'; st.textContent = 'Belum ada data. Buka ⚙ → Impor dari Money Manager, atau ketuk + Catat.'; }
  else if (st.className === 'warn') { st.className = ''; st.textContent = ''; }
  if (dirty[tab]) { dirty[tab] = 0; const sy = scrollY; safeRender(({ home: renderHome, wal: renderWal, sum: renderSum, tl: renderTl, cal: renderMonth, st: renderSt, plan: renderPlan, data: renderData })[tab]); if (scrollY !== sy) window.scrollTo(0, sy); }
  if (fx) { const m = fx; fx = 0; requestAnimationFrame(() => playFx(m)); }
}
function applyFilter(dir) { dirty.sum = dirty.tl = dirty.st = 1; fillFilters(); tlMonths = 3; syncURL(); transit(() => { fx = 2; refresh(); }, dir || 0); }

document.querySelectorAll('.tab').forEach(b => b.onclick = () => { buzz(); navBot(b.dataset.nav); });
$('#toptabs').onclick = e => { const b = e.target.closest('.ttab'); if (b) navTo(b.dataset.top); };
$('#add-btn').onclick = () => { buzz(); formSheet(); };
$('#flt-info').onclick = e => { const b = e.target.closest('.fchip'); if (!b) return; const x = b.dataset.x; if (x === 'cat') { if (F.sub) F.sub = ''; else F.cat = ''; } else if (x === 'k') F.k = ''; else if (x === 'w') F.w = ''; else if (x === 'tg') F.tg = ''; else { F.q = ''; $('#tl-q').value = ''; } applyFilter(); };
let qt; $('#tl-q').oninput = e => { clearTimeout(qt); qt = setTimeout(() => { F.q = e.target.value; tlMonths = 3; dirty.tl = 1; refresh(); }, 160); };
$('#tl-more').onclick = () => { tlMonths += 3; dirty.tl = 1; refresh(); };
$('#timeline').onclick = e => { const b = e.target.closest('.tl-i'); if (b) detailSheet(b.dataset.id); };
window.addEventListener('resize', () => moveInd());
addEventListener('scroll', () => root.classList.toggle('scrolled', scrollY > 36), { passive: true });
(() => { /* geser kiri/kanan di area konten untuk pindah bulan/tahun (bukan di grafik yang bisa digulir) */
  const m = document.querySelector('main'); let s0 = null;
  m.addEventListener('touchstart', e => { if (e.touches.length !== 1 || e.target.closest('#mchart,#cal-wrap,input,#pie,#timeline .tl-i')) { s0 = null; return; } const t = e.touches[0]; s0 = { x: t.clientX, y: t.clientY, t: Date.now() }; }, { passive: true });
  m.addEventListener('touchend', e => {
    if (!s0) return; const t = e.changedTouches[0], dx = t.clientX - s0.x, dy = t.clientY - s0.y, ok = Date.now() - s0.t < 600 && Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 2; s0 = null;
    if (!ok || tab === 'data' || tab === 'plan' || tab === 'home' || tab === 'wal') return; const md = mode();
    if (tab === 'cal' || md === 'month' || md === 'year') shiftMonth(dx < 0 ? 1 : -1);
  }, { passive: true });
})();

/* ---------- angka besar dikecilkan sampai muat (tidak menimpa cincin di sebelahnya) ---------- */
function fitNums() {
  document.querySelectorAll('.hm .hm-n,.sim-left').forEach(n => {
    if (!n.offsetParent) return;   // tab tersembunyi: jangan direset (ukuran muat dihitung ulang begitu tab tampil lagi, lihat ResizeObserver di bawah)
    n.style.fontSize = '';
    let fs = parseFloat(getComputedStyle(n).fontSize), g = 0;
    while (n.scrollWidth > n.clientWidth + 1 && fs > 20 && g++ < 40) { fs -= 1; n.style.fontSize = fs + 'px'; }
  });
}
let fitQ = 0; const fitSoon = () => { if (!fitQ) fitQ = requestAnimationFrame(() => { fitQ = 0; fitNums(); }); };
['#home', '#budget'].forEach(sel => { const e = document.querySelector(sel); if (e) new MutationObserver(fitSoon).observe(e, { childList: true, subtree: true, characterData: true }); });
addEventListener('resize', fitSoon); addEventListener('orientationchange', fitSoon); addEventListener('pageshow', fitSoon);
document.addEventListener('visibilitychange', () => { if (!document.hidden) fitSoon(); });
if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitSoon); fitSoon();
/* Beranda/Rencana tampil lagi (display:none -> tampil) atau lebarnya berubah saat tersembunyi: hitung ulang. Yang dipantau cuma lebar, supaya perubahan tinggi dari fitNums tidak memicu putaran. */
if (window.ResizeObserver) { const ro = new ResizeObserver(es => { es.forEach(e => { const w = Math.round(e.contentRect.width); if (e.target._fw !== w) { e.target._fw = w; fitSoon(); } }); }); ['#home', '#budget'].forEach(sel => { const e = document.querySelector(sel); if (e) ro.observe(e); }); }

/* ---------- sembunyikan nominal ----------
   Elemen yang teks-nya berisi angka rupiah diberi class .nv (otomatis, termasuk yang dirender belakangan).
   Blur-nya diatur CSS lewat html.hide-amt; Transaksi & Kalender dikecualikan lewat html[data-tab]. */
const NVRX = /Rp\s?\d|\d{1,3}(?:\.\d{3})+|\d+(?:,\d)?\s?(?:jt|rb)\b/;
const NVSKIP = /^(SCRIPT|STYLE|TEXTAREA|OPTION|INPUT|SELECT)$/;
function markNv(node) {
  if (!node) return;
  if (node.nodeType === 3) { const p = node.parentElement; if (p && !NVSKIP.test(p.tagName) && !p.closest('#toast') && NVRX.test(node.nodeValue)) p.classList.add('nv'); return; }
  if (node.nodeType !== 1 || NVSKIP.test(node.tagName) || node.closest('#toast')) return;
  const w = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  for (let n; (n = w.nextNode());) markNv(n);
}
let HIDE = root.classList.contains('hide-amt');
function setHide(v, anim) {
  HIDE = v; root.classList.toggle('hide-amt', v);
  const b = $('#m-eye'); if (b) { b.setAttribute('aria-pressed', String(!v)); b.title = v ? 'Tampilkan nominal' : 'Sembunyikan nominal'; }
  if (anim) { buzz(); toast(v ? 'Nominal disembunyikan' : 'Nominal ditampilkan'); }
}
(() => {
  root.classList.toggle('amt-still', reduce);
  let q = new Set(), tk = 0;
  const flush = () => { tk = 0; q.forEach(markNv); q.clear(); };
  new MutationObserver(ms => {
    for (const m of ms) { if (m.type === 'characterData') q.add(m.target); else m.addedNodes.forEach(n => q.add(n)); }
    if (!tk) tk = requestAnimationFrame(flush);
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
  markNv(document.body);
  const eye = $('#m-eye'); if (eye) { setHide(HIDE, false); eye.onclick = () => setHide(!HIDE, true); }
  /* tahan satu angka (~0,35 dtk) untuk mengintip angka itu saja, tertutup lagi otomatis */
  let hold = 0, shown = null, swallow = false;
  document.addEventListener('pointerdown', e => {
    const t = e.target.closest && e.target.closest('.nv'); if (!t || !HIDE) return;
    clearTimeout(hold); hold = setTimeout(() => { t.classList.add('rv'); shown = t; swallow = true; buzz(); setTimeout(() => { t.classList.remove('rv'); }, 2600); }, 350);
  });
  const cancel = () => { clearTimeout(hold); setTimeout(() => { swallow = false; }, 0); };
  document.addEventListener('pointerup', cancel); document.addEventListener('pointercancel', cancel);
  document.addEventListener('pointermove', e => { if (hold && e.pointerType !== 'mouse' && Math.abs(e.movementX) + Math.abs(e.movementY) > 6) clearTimeout(hold); });
  document.addEventListener('click', e => { if (swallow) { e.stopPropagation(); e.preventDefault(); } }, true);
  document.addEventListener('contextmenu', e => { if (HIDE && e.target.closest && e.target.closest('.nv:not(.rv)')) e.preventDefault(); });
})();

/* ---------- mulai ---------- */
(async function init() {
  readURL(); root.dataset.tab = tab;
  if (!QP.has('from') && !QP.has('to')) F.from = F.to = thisMonth();   // buka Transaksi/Statistik langsung di bulan berjalan, bukan semua waktu
  const had = load(); sortRecs();
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}   // minta browser jangan menghapus data otomatis saat ruang penyimpanan menipis
  if (!had) {
    try { await seed(false); } catch (e) { /* data.json bersifat opsional: tanpa file itu mulai dari kosong */ }
  }
  fillFilters(); $('#tl-q').value = F.q;
  $('#filters').hidden = NOFLT.includes(tab); $('#tl-bar').hidden = tab !== 'tl';
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  TABS.forEach(v => { $('#view-' + v).hidden = v !== tab; });
  refresh(); requestAnimationFrame(moveInd); plLoadNotice(PLLOADREP); runBankAdmin(false);
  if (QP.get('add') === '1') { syncURL(); setTimeout(() => formSheet(), 300); }   // pintasan ikon: Catat transaksi
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(moveInd);
  /* tombol/gestur back: tutup lembar yang terbuka -> kembali ke Beranda -> di Beranda perlu dua kali untuk keluar */
  try {
    let exitArm = false;
    history.pushState({ g: 1 }, '');   // satu entri penjaga di atas halaman awal
    addEventListener('popstate', () => {
      if ($('#sheet-ov').classList.contains('open')) { closeSheet(); history.pushState({ g: 1 }, ''); return; }
      if (tab !== 'home') { go('home'); history.pushState({ g: 1 }, ''); return; }
      if (exitArm) return;
      exitArm = true; toast('Geser back sekali lagi untuk keluar');
      setTimeout(() => { if (exitArm) { exitArm = false; history.pushState({ g: 1 }, ''); } }, 2200);
    });
  } catch (e) {}
  window.__mm = { get recs() { return recs; }, get meta() { return meta; } }; // untuk pengujian
})();

/* ---------- geser baris di Transaksi: Ubah / Hapus (HP & layar sentuh) ---------- */
(() => {
  const box = $('#timeline'), W = 152; let row = null, openR = null, x0 = 0, y0 = 0, base = 0, cx = 0, lock = null, moved = false;
  const setX = (r, x, anim) => { r.classList.toggle('sw-drag', !anim); r.style.transform = x ? `translate3d(${x}px,0,0)` : ''; };
  const mk = r => { if (r.querySelector('.sw-b')) return; r.style.contentVisibility = 'visible'; r.insertAdjacentHTML('beforeend', '<span class="sw-b sw-e" data-act="edit" aria-hidden="true">Ubah</span><span class="sw-b sw-d" data-act="del" aria-hidden="true">Hapus</span>'); };
  const rm = r => setTimeout(() => { if (r === openR || r === row) return; r.querySelectorAll('.sw-b').forEach(x => x.remove()); r.style.contentVisibility = ''; }, 500);
  const shut = () => { if (openR) { const r = openR; setX(r, 0, true); openR = null; rm(r); } };
  box.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse') return;
    const r = e.target.closest('.tl-i'); if (openR && openR !== r) shut(); if (!r) return;
    row = r; x0 = e.clientX; y0 = e.clientY; base = r === openR ? -W : 0; cx = base; lock = null; moved = false;
  });
  box.addEventListener('pointermove', e => {
    if (!row) return; const dx = e.clientX - x0, dy = e.clientY - y0;
    if (lock == null) { if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return; lock = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'; if (lock === 'x') { mk(row); try { row.setPointerCapture(e.pointerId); } catch (x) {} } }
    if (lock !== 'x') return; moved = true; cx = Math.max(-W - 30, Math.min(0, base + dx)); setX(row, cx);
  });
  const end = () => {
    if (!row) return; const r = row; row = null; if (lock !== 'x') return;
    const open = cx < -W / 2; setX(r, open ? -W : 0, true);
    if (open) { if (openR && openR !== r) setX(openR, 0, true); openR = r; } else { if (openR === r) openR = null; rm(r); }
    setTimeout(() => { moved = false; }, 60);
  };
  box.addEventListener('pointerup', end); box.addEventListener('pointercancel', end);
  document.addEventListener('pointerdown', e => { if (openR && !e.target.closest('#timeline')) shut(); });
  box.addEventListener('click', e => {   // capture: jalan sebelum pembuka detail
    const b = e.target.closest('.sw-b'), r = e.target.closest('.tl-i');
    if (b && r) { e.stopPropagation(); const id = r.dataset.id; shut(); if (b.dataset.act === 'edit') { const rec = recs.find(x => x.id === id); if (rec) formSheet(rec); } else deleteRec(id); return; }
    if (moved || openR) { e.stopPropagation(); e.preventDefault(); if (!moved) shut(); }
  }, true);
})();

/* ---------- menu klik kanan (mouse/trackpad) di daftar transaksi ---------- */
(() => {
  let m = null; const close = () => { if (m) { m.remove(); m = null; } };
  const open = (x, y, id) => {
    close(); m = document.createElement('div'); m.className = 'ctxm'; m.setAttribute('role', 'menu');
    m.innerHTML = '<button type="button" role="menuitem" data-a="edit">Ubah</button><button type="button" role="menuitem" data-a="dup">Duplikat</button><button type="button" role="menuitem" data-a="del" class="d">Hapus</button>';
    document.body.appendChild(m); m.style.left = Math.max(8, Math.min(x, innerWidth - m.offsetWidth - 8)) + 'px'; m.style.top = Math.max(8, Math.min(y, innerHeight - m.offsetHeight - 8)) + 'px';
    m.onclick = e => { const b = e.target.closest('button'); if (!b) return; const a = b.dataset.a; close(); const rec = recs.find(r => r.id === id); if (!rec) return;
      if (a === 'edit') formSheet(rec); else if (a === 'del') deleteRec(id);
      else { const snap = recs.slice(); addBatch([{ t: nowLocal().slice(0, 16) + ':' + p2(new Date().getSeconds()), k: rec.k, c: rec.c, s: rec.s, tg: rec.tg, n: rec.n, a: rec.a, ac: rec.ac }], { skipDup: false });
        fillFilters(); changed(); toast('Transaksi diduplikat', () => { recs = snap; fillFilters(); changed(); toast('Dibatalkan'); }); } };
  };
  document.addEventListener('contextmenu', e => { const r = e.target.closest('#timeline .tl-i,#h-last .tl-i'); if (!r || matchMedia('(hover:none) and (pointer:coarse)').matches) return; e.preventDefault(); open(e.clientX, e.clientY, r.dataset.id); });
  document.addEventListener('pointerdown', e => { if (m && !e.target.closest('.ctxm')) close(); }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  addEventListener('scroll', () => { if (m) close(); }, { capture: true, passive: true }); addEventListener('resize', close);
})();
})();
