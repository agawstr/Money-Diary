/* plan.js — logika murni target tabungan & Paylater (tenggat cicilan, pembersihan data, daftar cicilan). Dipindah dari app.js
   tanpa perubahan perilaku; bagian yang menyentuh meta/DOM tetap di app.js. Diuji di Node (tests/test_plan.js). */
(function (root) {
'use strict';
const U = typeof module === 'object' && module.exports ? require('./util.js') : root.MDUtil;
const { p2, nowLocal } = U;
function goalClean(g) {   // target tabungan dari data lama/backup/edit manual: buang yang rusak, lengkapi yang kurang
  if (!g || !g.id || !g.name || !(+g.target > 0)) return null;
  const dep = Array.isArray(g.dep) ? g.dep.filter(d => d && isFinite(+d.a) && +d.a !== 0).map(d => ({ t: String(d.t || '').slice(0, 10), a: +d.a })) : [];
  if (!dep.length && +g.saved > 0) dep.push({ t: nowLocal().slice(0, 10), a: +g.saved });
  return { id: String(g.id), name: String(g.name).slice(0, 40), target: +g.target, dep };
}
const goalSaved = g => (g.dep || []).reduce((s, d) => s + d.a, 0);
const PL_CUT = 15, PL_DAY = 25;
const realDate = d => {   // 'YYYY-MM-DD' yang benar-benar ada di kalender (tahun kabisat dihitung)
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(d)); if (!m) return false;
  const y = +m[1], mo = +m[2], dd = +m[3], dim = [31, (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return y >= 1 && mo >= 1 && mo <= 12 && dd >= 1 && dd <= dim[mo - 1];
};
function plClean(x) {
  if (!x || !x.id || !x.n || !(+x.a > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(String(x.o || ''))) return null;
  const k = Math.min(60, Math.max(1, Math.round(+x.k) || 1)), d = {}; if (x.d && typeof x.d === 'object') Object.keys(x.d).forEach(i => { if (+i >= 0 && +i < k && /^\d{4}-\d{2}-\d{2}$/.test(String(x.d[i]))) d[i] = x.d[i]; });
  const out = { id: String(x.id), n: String(x.n).slice(0, 40), c: String(x.c || ''), a: +x.a, k, o: x.o, w: String(x.w || ''), d };
  // PayLater v2 (opsional): pengeluaran sudah tercatat (ex), hasil tautan massal (stmt), harga barang (pr), transaksi tertaut (src)
  if (x.ex === true) {
    out.ex = true; if (x.stmt === true) out.stmt = true;
    const pr = Math.round(+x.pr); if (pr > 0 && pr <= 99999999999) out.pr = pr;
    out.src = (Array.isArray(x.src) ? x.src : []).slice(0, 2000).map(plSrcClean).filter(Boolean);
    // Rekonsiliasi (v2.1): item kewajiban historis. Hanya bentuk sah yang dipertahankan: id 'rc'+YYYY-MM, 1 baris, tanpa harga/transaksi tertaut.
    // ID adalah acuan periode: bulan 01-12. Bila o bukan tanggal kalender nyata atau jatuh temponya (plDue) tidak di bulan ID, o dinormalisasi ke ID-bulan + '-01'
    // (item tidak dibuang, kewajiban tidak bergeser). o tgl 2..15 di bulan yang sama tetap sah. Hanya berlaku untuk item hist; tagihan biasa tidak disentuh.
    if (x.hist === true && /^rc\d{4}-(0[1-9]|1[0-2])$/.test(out.id) && k === 1) {
      out.hist = true; out.src = []; delete out.pr; delete out.stmt;
      const ym = out.id.slice(2); if (!realDate(out.o) || plDue(out, 0).slice(0, 7) !== ym) out.o = ym + '-01';
    }
  }
  return out;
}
function plSrcClean(s) {   // ringkasan transaksi tertaut: dicocokkan lewat isi + urutan, bukan id (id berubah saat diedit/restore)
  if (!s || typeof s !== 'object' || typeof s.t !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s.t) || !(+s.a > 0) || !(+s.ord >= 0)) return null;
  return { t: s.t.slice(0, 19), a: Math.round(+s.a), n: String(s.n == null ? '' : s.n).slice(0, 120), ac: String(s.ac == null ? '' : s.ac).slice(0, 60), ord: Math.min(9999, Math.floor(+s.ord)) };
}
function plDue(p, i) {   // tanggal jatuh tempo cicilan ke-i (mulai 0) sebagai 'YYYY-MM-DD'
  const y = +p.o.slice(0, 4), m = +p.o.slice(5, 7) - 1, dd = +p.o.slice(8, 10), t = new Date(y, m + (dd <= PL_CUT ? 0 : 1) + i, PL_DAY);
  return t.getFullYear() + '-' + p2(t.getMonth() + 1) + '-' + p2(PL_DAY);
}
/* pokok baris ke-i. Tagihan lama (tanpa ex): a. Tagihan ex dengan harga (pr) dan cicilan: pr dibagi rata, sisa pembulatan di cicilan terakhir. */
function plPrincipal(p, i) {
  if (!p.ex || !p.pr || p.k < 2) return p.a;
  const base = Math.floor(p.pr / p.k); return i === p.k - 1 ? p.pr - base * (p.k - 1) : base;
}
/* saran bunga/biaya untuk baris ke-i: cicilan dari Shopee (a) dikurangi pokok. Hanya untuk tagihan ex yang punya harga. */
function plFeeHint(p, i) { return p.ex && p.pr && p.k > 1 ? Math.max(0, p.a - plPrincipal(p, i)) : 0; }
/* semua cicilan dari daftar, urut tanggal tenggat. pays = buku pembayaran (opsional). Tiap baris:
   D pokok, got terbayar, rem sisa, st 'lunas'|'sebagian'|'belum', paid (tanggal lunas / '' untuk kompatibilitas kode lama). */
function plRowsOf(list, pays) {
  const got = {}, last = {};
  (pays || []).forEach(y => (y.alloc || []).forEach(a => { got[a.k] = (got[a.k] || 0) + a.a; if (!last[a.k] || y.t > last[a.k]) last[a.k] = y.t; }));
  const out = []; list.forEach(p => { for (let i = 0; i < p.k; i++) {
    const D = plPrincipal(p, i), key = p.id + ':' + i;
    let g, paid;
    if (p.ex) { g = Math.min(D, got[key] || 0); paid = g >= D ? (last[key] || '').slice(0, 10) || '1' : ''; }
    else { paid = (p.d || {})[i] || ''; g = paid ? D : 0; }
    out.push({ p, i, due: plDue(p, i), paid, D, got: g, rem: D - g, st: g >= D ? 'lunas' : g > 0 ? 'sebagian' : 'belum', ex: !!p.ex });
  } });
  return out.sort((a, b) => a.due.localeCompare(b.due) || a.p.n.localeCompare(b.p.n));
}
function plMonthDueOf(list, tm, pays) { return plRowsOf(list, pays).reduce((a, r) => a + (r.due.slice(0, 7) <= tm ? r.rem : 0), 0); }   // sisa; yang telat juga ikut
/* rekap per bulan jatuh tempo: {ym, rows, D, got, rem, st} urut bulan */
function plMonths(rows, tm) {
  const m = {}; rows.forEach(r => { const ym = r.due.slice(0, 7); (m[ym] = m[ym] || { ym, rows: [], D: 0, got: 0, rem: 0 }); const o = m[ym]; o.rows.push(r); o.D += r.D; o.got += r.got; o.rem += r.rem; });
  return Object.values(m).sort((a, b) => a.ym.localeCompare(b.ym)).map(o => Object.assign(o, { st: o.rem <= 0 ? 'lunas' : o.got > 0 ? 'sebagian' : 'belum', late: o.rem > 0 && o.ym < tm }));
}
/* membagi pembayaran ke baris ex yang masih punya sisa (urut tenggat lalu nama). Ditolak bila melebihi total sisa. */
function plAllocate(rows, amount) {
  const amt = Math.round(+amount); if (!(amt > 0)) return { error: 'nominal' };
  /* Tahap 4: dalam satu periode jatuh tempo baris simulasi terisi dulu, item historis (hist) terakhir. Sort stabil: tanpa hist urutannya sama persis dengan sebelumnya. */
  const open = rows.filter(r => r.ex && r.rem > 0).map((r, n) => ({ r, n })).sort((a, b) => a.r.due.localeCompare(b.r.due) || (isHist(a.r.p) ? 1 : 0) - (isHist(b.r.p) ? 1 : 0) || a.n - b.n).map(x => x.r);
  const total = open.reduce((s, r) => s + r.rem, 0);
  if (amt > total) return { error: 'lebih', total };
  let left = amt; const alloc = [];
  for (const r of open) { if (left <= 0) break; const x = Math.min(left, r.rem); alloc.push({ k: r.p.id + ':' + r.i, a: x }); left -= x; }
  return { alloc, total };
}
/* Sumber dana sebuah pembayaran. Pembayaran lama (hanya field w) dibaca sebagai satu sumber; pembayaran multi-sumber memakai src. */
const PL_MAX_SRC = 6;
const plPaySrc = y => (Array.isArray(y.src) && y.src.length ? y.src : [{ w: y.w, a: y.a }]);
/* ===== Rekonsiliasi SPayLater (spesifikasi v2.1, Tahap 1): fungsi murni, tidak menyentuh meta/DOM/penyimpanan, tidak membuat transaksi. ===== */
const PL_LOG_MAX = 30;
const isHist = p => !!(p && p.hist === true && p.ex === true);
const plHistId = ym => 'rc' + ym;
const YM_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
/* item kewajiban historis untuk periode ym (bulan jatuh tempo). o = tanggal 1 sehingga plDue jatuh di bulan ym (tgl <= 15). */
function plHistItem(ym, amount) {
  const a = Math.round(+amount);
  if (!YM_RE.test(String(ym)) || !(a > 0)) return null;
  return { id: plHistId(ym), n: 'Tagihan Shopee sebelumnya', c: '', a, k: 1, o: ym + '-01', w: 'SPayLater', d: {}, ex: true, src: [], hist: true };
}
/* Pembagian fee.a sebuah pembayaran ke entri alloc-nya menurut porsi pokok. Deterministik dan eksak: Σ bagian = fee.a persis.
   Hanya entri alloc yang bentuknya sah (k teks, a > 0) ikut dalam penyebut; fee tanpa fee.a > 0 atau tanpa alloc sah menghasilkan [].
   Pembulatan: lantai per entri (BigInt, aman untuk nominal besar), sisa +1 diberikan ke sisa pecahan terbesar, seri -> entri paling awal. */
function plFeeShares(pay) {
  const fee = pay && pay.fee && isFinite(+pay.fee.a) ? Math.round(+pay.fee.a) : 0;
  const ents = (pay && Array.isArray(pay.alloc) ? pay.alloc : []).filter(x => x && typeof x.k === 'string' && isFinite(+x.a) && Math.round(+x.a) > 0).map(x => ({ k: x.k, a: Math.round(+x.a) }));
  if (!(fee > 0) || !ents.length) return [];
  const total = ents.reduce((s, x) => s + BigInt(x.a), 0n), F = BigInt(fee);
  const q = ents.map(x => ({ k: x.k, f: Number(F * BigInt(x.a) / total), r: F * BigInt(x.a) % total }));
  let left = fee - q.reduce((s, x) => s + x.f, 0);
  q.map((x, i) => i).sort((a, b) => (q[a].r === q[b].r ? a - b : q[a].r > q[b].r ? -1 : 1)).slice(0, left).forEach(i => { q[i].f++; });
  return q.map(x => ({ k: x.k, f: x.f }));
}
/* angka sebuah periode (ym = bulan jatuh tempo). Satuan Shopee: terbayar = pokok (alloc, atau penanda d untuk tagihan lama) + bagian fee.a pembayaran.
   - terwakili = Σ max(D, a) per baris simulasi (bukan hist); a-D (bunga simulasi) hanya dipakai di sini, tidak pernah di terbayar.
   - paidPokok / feePaid / paid (= pokok + fee); histGot (pokok hist), histFee, histPaid (= histGot + histFee).
   - fee hanya dihitung untuk entri alloc ke baris ex yang ada di periode ini; alloc ke baris lama atau baris yang sudah tidak ada tidak membawa fee ke periode mana pun.
   Keterbatasan yang diketahui (dibahas ulang di Tahap 4): fee pada pembayaran item hist menambah terbayar (X benar) tetapi tidak mengurangi sisa item hist di plRowsOf;
   untuk saat ini pembayaran hist diasumsikan tanpa fee tambahan. */
function plPeriodStats(list, pays, ym) {
  const all = plRowsOf(list || [], pays), byKey = {}; all.forEach(r => { byKey[r.p.id + ':' + r.i] = r; });
  const rows = all.filter(r => r.due.slice(0, 7) === ym), sim = rows.filter(r => !isHist(r.p)), h = rows.filter(r => isHist(r.p));
  let feePaid = 0, histFee = 0;
  (Array.isArray(pays) ? pays : []).forEach(y => plFeeShares(y).forEach(sh => {
    const r = Object.prototype.hasOwnProperty.call(byKey, sh.k) ? byKey[sh.k] : null;
    if (r && r.ex && r.due.slice(0, 7) === ym) { feePaid += sh.f; if (isHist(r.p)) histFee += sh.f; }
  }));
  const paidPokok = rows.reduce((s, r) => s + r.got, 0), histGot = h.reduce((s, r) => s + r.got, 0);
  return {
    rows, simRows: sim, terwakili: sim.reduce((s, r) => s + Math.max(r.D, r.p.a), 0),
    paidPokok, feePaid, paid: paidPokok + feePaid, histGot, histFee, histPaid: histGot + histFee,
    histA: h.reduce((s, r) => s + r.D, 0), rem: rows.reduce((s, r) => s + r.rem, 0)
  };
}
/* Hitung rekonsiliasi satu periode. input = { mode: 'total' | 'sisa', value }. prev = entri plRecon lama periode ini (opsional); opts.t = stempel waktu (diberikan pemanggil agar fungsi tetap murni).
   Hasil sukses: { ok, x, terwakili, hist, paid, warn, changed, action: 'add'|'update'|'remove'|'none', item, recon }.
   Gagal: { ok:false, error: 'periode'|'mode'|'nominal'|'kurang'|'kurang_hist', ... }. Tidak mengubah list/pays/prev. */
function plReconcile(list, pays, ym, input, prev, opts) {
  if (!YM_RE.test(String(ym))) return { ok: false, error: 'periode' };
  const mode = input && input.mode;
  if (mode !== 'total' && mode !== 'sisa') return { ok: false, error: 'mode' };
  const raw = input.value;
  if ((typeof raw !== 'number' && typeof raw !== 'string') || (typeof raw === 'string' && !raw.trim())) return { ok: false, error: 'nominal' };
  const v = Math.round(+raw);
  if (!isFinite(v) || v < 0 || v > 99999999999 || (mode === 'total' && v < 1)) return { ok: false, error: 'nominal' };
  const st = plPeriodStats(list, pays, ym), x = mode === 'total' ? v : st.paid + v;
  if (x < st.paid) return { ok: false, error: 'kurang', paid: st.paid };   // tagihan aktual < yang sudah dibayar: ditolak
  const hist = Math.max(0, x - st.terwakili);
  if (hist < st.histPaid) return { ok: false, error: 'kurang_hist', histGot: st.histPaid, hist };   // bagian historis yang sudah dibayar tidak boleh menyusut
  const warn = st.terwakili > x ? 'sim_lebih' : null;   // simulasi > aktual: hanya peringatan, tidak ada yang dikurangi/dihapus
  const same = !!(prev && prev.x === x && prev.sim === st.terwakili && st.histA === hist);
  const action = st.histA === hist ? 'none' : hist === 0 ? 'remove' : st.histA === 0 ? 'add' : 'update';
  const t = opts && typeof opts.t === 'string' ? opts.t.slice(0, 19) : '';
  let recon;
  if (same) recon = prev;
  else {
    const log = (prev && Array.isArray(prev.log) ? prev.log.slice() : []); if (prev) log.push({ t: prev.t || '', x: prev.x, sim: prev.sim });
    recon = { x, sim: st.terwakili, t, log: log.slice(-PL_LOG_MAX) };
  }
  return { ok: true, x, terwakili: st.terwakili, hist, paid: st.paid, warn, changed: !same, action, item: hist > 0 ? plHistItem(ym, hist) : null, recon };
}
/* kewajiban untuk Dashboard: sisa pokok seluruh PayLater (PL_semua) dan yang jatuh tempo <= bulan tm (PL_bulan, telat ikut). */
function plObligations(list, pays, tm) {
  const rows = plRowsOf(list || [], pays);
  return { PL_bulan: rows.reduce((s, r) => s + (r.due.slice(0, 7) <= tm ? r.rem : 0), 0), PL_semua: rows.reduce((s, r) => s + r.rem, 0) };
}
/* R: rencana pengeluaran aktif (pemasukan 'I' tidak dihitung), sama dengan jumlah yang dipakai simCalc. */
const planExpense = items => (Array.isArray(items) ? items : []).reduce((s, x) => s + (x && x.k === 'I' ? 0 : (+(x && x.a) || 0)), 0);
/* tiga angka kartu Dashboard. S saldo total dompet, T potongan tabungan (simCalc().cut), items rencana. hasPL=false -> kartu disembunyikan. */
function dashAmounts(list, pays, items, S, T, tm) {
  const o = plObligations(list, pays, tm), R = planExpense(items), s = +S || 0, t = +T || 0;
  return { hasPL: Array.isArray(list) && list.length > 0, saldo: s, aman: s - t - o.PL_bulan - R, sisa: s - t - o.PL_semua - R, PL_bulan: o.PL_bulan, PL_semua: o.PL_semua, R, T: t };
}
/* item ex tanpa src hanya boleh dipangkas bila bukan kewajiban historis (dipakai plPrune di app.js pada Tahap 2). */
const plPrunable = it => !!(it && it.ex && !isHist(it) && !/^rc\d{4}-\d{2}$/.test(String(it.id)) && (!it.src || !it.src.length));   // id rc... dilindungi walau penanda hist rusak: dilaporkan sebagai anomali, tidak dipangkas diam-diam


/* ===== Tahap 2: pemeriksaan integritas data PayLater saat load/restore. Murni: hanya MELAPORKAN, tidak mengubah alokasi, nominal, pembayaran, atau catatan biaya. ===== */
const TS_PAT = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/;
const tsCalendarOk = t => { const m = typeof t === 'string' ? TS_PAT.exec(t) : null; return !!(m && realDate(m[1]) && +m[2] <= 23 && +m[3] <= 59 && (m[4] === undefined || +m[4] <= 59)); };
const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
/* pays: hasil cleanPays; list: tagihan yang sudah dibersihkan (plClean).
   BLOK  : alloc_lebih  (Σ alloc > pokok a; tidak mungkin lewat UI)
   WARN  : alloc_kurang (Σ alloc < a), key_hilang (key tidak menunjuk baris tertaut yang ada), alloc_lebih_D (alokasi total satu baris > D),
           timestamp_kalender (pola valid tetapi bukan tanggal/jam nyata: membuat perbandingan t > since di wallet tidak terduga). */
function plCheckPays(pays, list) {
  const block = [], warn = [], D = {}, ex = {};
  plRowsOf((Array.isArray(list) ? list : []).filter(x => x && typeof x === 'object'), []).forEach(r => { const k = r.p.id + ':' + r.i; D[k] = r.D; ex[k] = r.ex; });
  const per = {};
  (Array.isArray(pays) ? pays : []).forEach(y => {
    if (!y) return;
    const al = Array.isArray(y.alloc) ? y.alloc : [], sum = al.reduce((s, x) => s + (+x.a || 0), 0), a = +y.a || 0;
    if (sum > a) block.push({ id: y.id, code: 'alloc_lebih', sum, a });
    else if (sum < a) warn.push({ id: y.id, code: 'alloc_kurang', sum, a });
    al.forEach(x => {
      if (!hasOwn(D, x.k)) warn.push({ id: y.id, code: 'key_hilang', k: x.k, why: 'tidak_ada' });
      else if (!ex[x.k]) warn.push({ id: y.id, code: 'key_hilang', k: x.k, why: 'bukan_tertaut' });
      else { const o = per[x.k] = per[x.k] || { sum: 0, ids: [] }; o.sum += +x.a || 0; if (!o.ids.includes(y.id)) o.ids.push(y.id); }
    });
    if (typeof y.t === 'string' && TS_PAT.test(y.t) && !tsCalendarOk(y.t)) warn.push({ id: y.id, code: 'timestamp_kalender', t: y.t });
  });
  Object.keys(per).forEach(k => { if (per[k].sum > D[k]) warn.push({ code: 'alloc_lebih_D', k, sum: per[k].sum, D: D[k], ids: per[k].ids }); });
  return { block, warn };
}
/* anomali item historis. rawList = daftar mentah sebelum plClean, list = hasil plClean.
   hist_hilang: item mentah berpenanda hist hilang total setelah dibersihkan; hist_tidak_sah: penanda hist terlepas (mis. k bukan 1, id/bulan tidak sah);
   rc_tanpa_penanda: item ber-id rcYYYY-MM tanpa penanda hist (mis. lewat aplikasi lama). Item TIDAK diubah/dibuang; data mentah dipertahankan lewat salinan aman. */
function plHistAnomalies(rawList, list) {
  const by = {}; (Array.isArray(list) ? list : []).forEach(p => { if (p && !hasOwn(by, p.id)) by[p.id] = p; });
  const out = [];
  (Array.isArray(rawList) ? rawList : []).forEach(x => {
    if (!x || typeof x !== 'object') return;
    const id = String(x.id), c = hasOwn(by, id) ? by[id] : null;
    if (x.hist === true) {
      if (!c) out.push({ id, code: 'hist_hilang' });
      else if (c.hist !== true) out.push({ id, code: 'hist_tidak_sah', k: x.k, ex: x.ex === true });
    } else if (c && /^rc\d{4}-\d{2}$/.test(id) && c.ex && !c.hist) out.push({ id, code: 'rc_tanpa_penanda' });
  });
  return out;
}
/* catatan biaya PayLater yang mungkin yatim karena pembayarannya dibuang. dropped = keluaran cleanPaysReport.dropped. Tidak menghapus apa pun.
   certain: rid cocok dengan catatan yang ada. Tanpa id (restore: catatan backup tidak membawa id): kecocokan tag 'biaya-paylater' + nominal, ditandai tidak pasti. */
function plOrphanFees(dropped, recs) {
  const out = [], rs = Array.isArray(recs) ? recs : [];
  (Array.isArray(dropped) ? dropped : []).forEach(d => {
    if (!d || !d.fee || !(d.fee.a > 0)) return;
    const isFee = r => r && Array.isArray(r.tg) && r.tg.includes('biaya-paylater');   // sama dengan plFeeRec di app.js: id + tag biaya-paylater + nominal sama
    const byId = d.fee.rid && rs.find(r => r && r.id === d.fee.rid && isFee(r) && r.a === d.fee.a);
    if (byId) { out.push({ pay: d.id, a: d.fee.a, rid: d.fee.rid, certain: true }); return; }
    const n = rs.filter(r => r && r.k === 'E' && r.a === d.fee.a && Array.isArray(r.tg) && r.tg.includes('biaya-paylater')).length;
    if (n) out.push({ pay: d.id, a: d.fee.a, rid: d.fee.rid || '', certain: false, n });
  });
  return out;
}
/* laporan gabungan untuk load/restore. rep = MDSanitize.cleanPaysReport(rawPays); list = plClean-ed; rawList = mentah. */
function plDataReport(rep, list, rawList, recs) {
  const r = rep || { pays: [], bad: [], dropped: [], allocDropped: [], feeDropped: [] }, c = plCheckPays(r.pays, list), an = plHistAnomalies(rawList, list);
  const dropped = r.dropped || [], allocDropped = r.allocDropped || [], feeDropped = r.feeDropped || [], orphans = plOrphanFees(dropped, recs);
  return { dropped, allocDropped, feeDropped, srcBad: r.bad || [], block: c.block, warn: c.warn, anomalies: an, orphans,
    hasBlock: c.block.length > 0, hasAny: !!((r.bad || []).length || dropped.length || allocDropped.length || feeDropped.length || c.block.length || c.warn.length || an.length) };
}


/* ===== Tahap 3: bantuan murni untuk lembar "Cocokkan dengan Shopee" (tidak mengubah apa pun) ===== */
/* periode (bulan jatuh tempo) yang ditawarkan: bulan jatuh tempo sebelumnya .. 3 bulan sesudah bulan ini (5 periode), ditambah periode yang punya
   tagihan terbuka atau rekonsiliasi di luar rentang itu. tm = 'YYYY-MM' bulan ini. */
function plReconPeriods(list, pays, recon, tm) {
  if (!YM_RE.test(String(tm))) return [];
  const set = new Set(); for (let d = -1; d <= 3; d++) set.add(U.addM(tm, d));
  plRowsOf((Array.isArray(list) ? list : []).filter(x => x && typeof x === 'object'), pays).forEach(r => { if (r.rem > 0) set.add(r.due.slice(0, 7)); });
  Object.keys(recon && typeof recon === 'object' && !Array.isArray(recon) ? recon : {}).forEach(k => { if (YM_RE.test(k)) set.add(k); });
  return [...set].sort();
}
/* baris simulasi yang dihitung sebagai Terwakili (nilai = max(D, a)), maksimal max baris pertama + jumlah sisanya */
function plReconRows(list, pays, ym, max) {
  const st = plPeriodStats(list, pays, ym), rows = st.simRows.map(r => ({ n: String(r.p.n || ''), a: Math.max(r.D, r.p.a) })), m = max > 0 ? max : 5;
  return { rows: rows.slice(0, m), more: Math.max(0, rows.length - m), total: rows.length, terwakili: st.terwakili };
}
/* status rekonsiliasi periode ym: stale = simulasi berubah sejak dicocokkan (hanya penanda, tidak mengubah apa pun) */
function plReconStatus(recon, ym, list, pays) {
  const rc = recon && typeof recon === 'object' && hasOwn(recon, ym) ? recon[ym] : null, st = plPeriodStats(list, pays, ym);
  return { has: !!rc, x: rc ? rc.x : 0, t: rc ? rc.t : '', sim: rc ? rc.sim : 0, terwakili: st.terwakili, stale: !!rc && rc.sim !== st.terwakili, rem: st.rem };
}
/* bandingkan dua hasil plReconcile (pratinjau vs saat Simpan): daftar bidang yang berbeda */
function plReconChanged(a, b) {
  return ['ok', 'error', 'x', 'terwakili', 'hist', 'paid', 'warn', 'action'].filter(k => ((a && a[k]) ?? null) !== ((b && b[k]) ?? null)).map(k => ({ k, from: (a && a[k]) ?? null, to: (b && b[k]) ?? null }));
}

var api = { plReconPeriods, plReconRows, plReconStatus, plReconChanged, plCheckPays, plHistAnomalies, plOrphanFees, plDataReport, tsCalendarOk, plFeeShares, realDate, PL_LOG_MAX, isHist, plHistId, plHistItem, plPeriodStats, plReconcile, plObligations, planExpense, dashAmounts, plPrunable, PL_MAX_SRC, plPaySrc, goalClean, goalSaved, PL_CUT, PL_DAY, plClean, plSrcClean, plDue, plPrincipal, plFeeHint, plRowsOf, plMonthDueOf, plMonths, plAllocate };
if (typeof module === 'object' && module.exports) module.exports = api; else root.MDPlan = api;
})(typeof window !== 'undefined' ? window : globalThis);
