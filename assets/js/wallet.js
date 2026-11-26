/* wallet.js — saldo dompet (murni). Dipisah dari walBal() di app.js.
   Aturan lama tidak berubah. Tambahan PayLater v2:
   - transaksi yang TERTAUT ke tagihan PayLater (linked) tidak menggerakkan saldo: uangnya belum keluar;
   - pembayaran tagihan (pays) mengurangi saldo dompet pembayar, memakai aturan waktu yang sama dengan transfer (t > since).
   Tanpa linked dan pays, hasilnya harus identik dengan polish5 (tests/test_diff.js). */
(function (root) {
'use strict';
const paySrc = y => (Array.isArray(y.src) && y.src.length ? y.src : [{ w: y.w, a: y.a }]);   // sama dengan plPaySrc di plan.js (diuji sama)
const wkeyDef = s => String(s == null ? '' : s).trim().toLowerCase();
function balances({ wallets, recs, xfers, pays, linked, tm, wkey }) {
  wkey = wkey || wkeyDef;
  const m = new Map(), byId = {};
  wallets.forEach(w => { const o = { w, bal: +w.base || 0, bonus: +w.bbase || 0, auto: w.auto !== false, since: w.since || '', xin: 0, xout: 0, mi: 0, me: 0 }; m.set(wkey(w.name), o); byId[w.id] = o; });
  recs.forEach(r => {
    const o = m.get(wkey(r.ac));
    if (!o || !o.auto || r.t <= o.since) return;   // manual, atau transaksi sebelum patokan: tidak mempengaruhi saldo
    if (linked && linked.has(r.id)) return;         // belanja PayLater: saldo baru berkurang saat tagihan dibayar
    const cm = r.t.slice(0, 7) === tm;
    if (r.k === 'I') { o.bal += r.a; if (cm) o.mi += r.a; } else { o.bal -= r.a; if (cm) o.me += r.a; }
  });
  xfers.forEach(x => { const f = byId[x.f], t = byId[x.to]; if (f && f.auto && !x.ns && x.t > f.since) f.bal -= x.a; if (t && t.auto && x.t > t.since) { t.bal += x.a; t.bonus += x.bonus || 0; } });
  (pays || []).forEach(y => paySrc(y).forEach(x => { const o = byId[x.w]; if (o && o.auto && y.t > o.since) o.bal -= x.a; }));   // tiap dompet berkurang sebesar kontribusinya
  let total = 0;
  const list = wallets.map(w => { const o = byId[w.id]; if (!w.excl) total += o.bal; return o; });
  return { byId, list, total };
}
/* Pratinjau menautkan transaksi: berapa saldo tiap dompet NAIK (belanja yang sebelumnya sudah memotong saldo). */
function linkEffect({ wallets, selected, wkey }) {
  wkey = wkey || wkeyDef; const m = new Map(); wallets.forEach(w => m.set(wkey(w.name), { w, auto: w.auto !== false, since: w.since || '' }));
  const out = {}; selected.forEach(r => { const o = m.get(wkey(r.ac)); if (o && o.auto && r.t > o.since && r.k === 'E') out[o.w.name] = (out[o.w.name] || 0) + r.a; });
  return out;
}
var api = { balances, linkEffect, paySrc, wkey: wkeyDef };
if (typeof module === 'object' && module.exports) module.exports = api; else root.MDWallet = api;
})(typeof window !== 'undefined' ? window : globalThis);
