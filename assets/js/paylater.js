/* paylater.js — tautan transaksi ke tagihan PayLater (murni). Transaksi TIDAK pernah diubah: tautan = ringkasan isi + urutan.
   Kunci tautan = t|a|n|ac; transaksi identik dibedakan lewat urutannya di array recs (ord). addBatch menambah di akhir dan
   sortRecs stabil, jadi urutan relatif transaksi identik tidak berubah oleh penambahan, restore, maupun backup. */
(function (root) {
'use strict';
const P = typeof module === 'object' && module.exports ? require('./plan.js') : root.MDPlan;
const linkKey = r => r.t + '|' + r.a + '|' + r.n + '|' + r.ac;
const srcKey = s => s.t + '|' + s.a + '|' + s.n + '|' + s.ac;
function groups(recs) { const g = new Map(); recs.forEach(r => { if (r.k !== 'E') return; const k = linkKey(r); (g.get(k) || g.set(k, []).get(k)).push(r); }); return g; }
/* resolve: linked = id transaksi yang tertaut; bad = tautan yang tak ketemu pasangan / bentrok (perlu ditinjau); by = id -> {item, src} */
function resolve(recs, items) {
  const g = groups(recs), linked = new Set(), by = new Map(), bad = [];
  items.forEach(it => { if (!it.ex) return; (it.src || []).forEach(s => {
    const r = (g.get(srcKey(s)) || [])[s.ord];
    if (!r) bad.push({ item: it, src: s, why: 'hilang' });
    else if (linked.has(r.id)) bad.push({ item: it, src: s, why: 'ganda' });
    else { linked.add(r.id); by.set(r.id, { item: it, src: s }); }
  }); });
  return { linked, by, bad };
}
const ordOf = (recs, rec) => { const k = linkKey(rec); let n = 0; for (const r of recs) { if (r === rec || r.id === rec.id) return n; if (r.k === 'E' && linkKey(r) === k) n++; } return -1; };
const srcOf = (recs, rec) => ({ t: rec.t.slice(0, 19), a: rec.a, n: String(rec.n || '').slice(0, 120), ac: String(rec.ac || '').slice(0, 60), ord: ordOf(recs, rec) });
/* sebelum transaksi dihapus: lepas tautannya dan geser urutan sisanya. Kembalikan item yang terpengaruh. */
function dropRecord(items, recs, rec) {
  const k = linkKey(rec), o = ordOf(recs, rec), hit = [];
  items.forEach(it => { if (!it.ex || !it.src) return; let ch = false;
    it.src = it.src.filter(s => { if (srcKey(s) !== k) return true; if (s.ord === o) { ch = true; return false; } return true; });
    it.src.forEach(s => { if (srcKey(s) === k && s.ord > o) { s.ord--; ch = true; } });
    if (ch) { hit.push(it); if (it.stmt) it.a = it.src.reduce((x, s) => x + s.a, 0); } });
  return hit;
}
const isLinked = (items, recs, rec) => resolve(recs, items).linked.has(rec.id);
/* kelompokkan transaksi terpilih menurut bulan jatuh tempo (aturan 15/25) atau satu bulan yang dipaksa */
const dueMonthOf = dateStr => P.plDue({ o: dateStr.slice(0, 10) }, 0).slice(0, 7);
function buildItems(selected, recs, { forceYm, idGen } = {}) {
  const by = {}; selected.forEach(r => { const ym = forceYm || dueMonthOf(r.t); (by[ym] = by[ym] || []).push(r); });
  return Object.keys(by).sort().map(ym => {
    const src = by[ym].map(r => srcOf(recs, r)), a = src.reduce((x, s) => x + s.a, 0);
    return { id: idGen ? idGen(ym) : 'st' + ym.replace('-', '') + Math.random().toString(36).slice(2, 6), n: ('Tagihan lama · ' + src.length + ' transaksi').slice(0, 40), c: '', a, k: 1, o: ym + '-01', w: '', d: {}, ex: true, stmt: true, src };
  });
}
var api = { linkKey, resolve, groups, ordOf, srcOf, dropRecord, isLinked, dueMonthOf, buildItems };
if (typeof module === 'object' && module.exports) module.exports = api; else root.MDPayLater = api;
})(typeof window !== 'undefined' ? window : globalThis);
