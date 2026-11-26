/* sanitize.js — pembersih data yang masuk dari luar (backup .json, localStorage).
   Murni: tidak menyentuh DOM maupun penyimpanan, jadi bisa diuji di Node (tests/test_sanitize.js).
   Prinsip: bentuk data lama yang sah harus tetap lolos persis; yang rusak dibuang atau diperbaiki, tidak pernah melempar galat. */
(function (root) {
  'use strict';
  var MAX_AMT = 99999999999;                       // sama dengan batas parseAmt di app.js
  var BAD_KEY = { __proto__: 1, constructor: 1, prototype: 1 };
  var str = function (v, n) { return v == null || typeof v === 'object' ? '' : String(v).trim().slice(0, n); };

  /* nominal bulat 1..MAX_AMT, selain itu 0 */
  function cleanAmount(v) {
    if (typeof v !== 'number' && typeof v !== 'string') return 0;   // boolean, objek, array: bukan nominal
    if (typeof v === 'string' && /^\s*\d{1,3}(\.\d{3})+\s*$/.test(v)) v = v.replace(/\./g, '');   // "1.500.000" (format Indonesia)
    var n = typeof v === 'string' ? Number(v.trim()) : Number(v);
    return isFinite(n) && n >= 1 ? Math.min(MAX_AMT, Math.round(n)) : 0;
  }

  /* meta.budget: bilangan bulat >= 0 */
  function cleanBudget(v) { return cleanAmount(v); }

  /* meta.cats: { "Nama kategori": batas bulanan }. norm = pembuang emoji (cn) dari app.js. Kunci kembar dijumlahkan. */
  function cleanCats(o, norm) {
    var out = {}, n = 0;
    if (!o || typeof o !== 'object' || Array.isArray(o)) return out;
    Object.keys(o).forEach(function (k) {
      if (n >= 200) return;
      var key = str(norm ? norm(k) : k, 60), v = cleanAmount(o[k]);
      if (!key || BAD_KEY[key] || !v) return;
      if (!Object.prototype.hasOwnProperty.call(out, key)) n++;
      out[key] = Math.min(MAX_AMT, (out[key] || 0) + v);
    });
    return out;
  }

  /* meta.rules: [{k: kata kunci huruf kecil, kind: 'E'|'I', g: grup, s: sub, tg: [tag]}].
     Kata kunci + jenis yang kembar: yang pertama menang (urutan = prioritas). */
  function cleanRules(a) {
    var out = [], seen = {};
    if (!Array.isArray(a)) return out;
    a.forEach(function (u) {
      if (out.length >= 500 || !u || typeof u !== 'object') return;
      var k = str(u.k, 60).toLowerCase(), g = str(u.g, 40), kind = u.kind === 'I' ? 'I' : 'E';
      if (!k || !g || seen[kind + '|' + k]) return;
      seen[kind + '|' + k] = 1;
      var tg = [], ts = {};
      (Array.isArray(u.tg) ? u.tg : []).forEach(function (t) { t = str(t, 30); if (t && !ts[t] && tg.length < 10) { ts[t] = 1; tg.push(t); } });
      out.push({ k: k, kind: kind, g: g, s: str(u.s, 40), tg: tg });
    });
    return out;
  }

  /* Sumber dana pembayaran (src). Ketat: tidak ada perbaikan diam-diam, karena menebak berarti salah memotong dompet.
     Sah bila: array 1..6; tiap {w: id dompet tak kosong, a: bilangan bulat > 0}; dompet tidak kembar; jumlah a PERSIS sama dengan pokok. */
  var MAX_SRC = 6;
  function checkSrc(src, amt) {
    if (!Array.isArray(src) || !src.length) return { why: 'sumber dana kosong' };
    if (src.length > MAX_SRC) return { why: 'lebih dari ' + MAX_SRC + ' sumber dana' };
    var seen = {}, sum = 0, out = [];
    for (var i = 0; i < src.length; i++) {
      var x = src[i], w = x && typeof x === 'object' && typeof x.w === 'string' ? x.w.trim().slice(0, 60) : '';
      if (!w) return { why: 'dompet sumber tidak valid' };
      if (typeof x.a !== 'number' || !isFinite(x.a) || Math.floor(x.a) !== x.a || x.a < 1 || x.a > MAX_AMT) return { why: 'nominal sumber harus bilangan bulat positif' };
      if (seen[w]) return { why: 'dompet kembar dalam satu pembayaran' };
      seen[w] = 1; sum += x.a; out.push({ w: w, a: x.a });
    }
    if (sum !== amt) return { why: 'jumlah sumber dana (' + sum + ') tidak sama dengan pokok (' + amt + ')' };
    return { src: out };
  }
  /* meta.plPays: pembayaran tagihan PayLater. Saldo memakai a (per sumber); status tagihan memakai alloc.
     cleanPaysReport: pembayaran dengan src yang tidak sah TIDAK dimuat dan dilaporkan di bad (pemanggil memutuskan: tolak restore / simpan salinan). */
  function cleanPaysReport(a) {
    var out = [], bad = [], seen = {}, dropped = [], allocDropped = [], feeDropped = [];
    var rep = function () { return { pays: out, bad: bad, dropped: dropped, allocDropped: allocDropped, feeDropped: feeDropped }; };
    if (!Array.isArray(a)) return rep();
    a.forEach(function (y, ix) {
      if (!y || typeof y !== 'object') { dropped.push({ ix: ix, id: '', why: 'bukan_objek' }); return; }
      var rawFee = y.fee && typeof y.fee === 'object' && cleanAmount(y.fee.a) ? { rid: str(y.fee.rid, 60), a: cleanAmount(y.fee.a) } : null;
      if (out.length >= 5000) { dropped.push({ ix: ix, id: str(y.id, 40), why: 'melebihi_batas', fee: rawFee }); return; }
      var id = str(y.id, 40), t = typeof y.t === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(y.t) ? y.t.slice(0, 19) : '', w = str(y.w, 60), amt = cleanAmount(y.a), src = null;
      if (y.src !== undefined) {
        var c = checkSrc(y.src, amt);
        if (c.why) { bad.push({ id: id, why: c.why }); return; }
        if (c.src.length === 1) { w = c.src[0].w; }   // satu sumber = pembayaran biasa (tanpa src)
        else { src = c.src; w = src.reduce(function (b, x) { return x.a > b.a ? x : b; }, src[0]).w; }   // dompet utama = kontribusi terbesar (seri: yang pertama)
      }
      /* perilaku lama tetap: pembayaran tanpa id/tanggal/dompet/nominal sah, atau id ganda, TIDAK dimuat. Bedanya: sekarang dilaporkan di dropped. */
      var why = !id ? 'id_kosong' : !t ? 'timestamp_pola' : !w ? 'dompet_kosong' : !amt ? 'nominal' : seen[id] ? 'id_ganda' : '';
      if (why) { dropped.push({ ix: ix, id: id, why: why, a: amt || 0, t: typeof y.t === 'string' ? y.t.slice(0, 19) : '', fee: rawFee }); return; }
      seen[id] = 1;
      var rawAlloc = Array.isArray(y.alloc) ? y.alloc : [];
      var alloc = rawAlloc.map(function (x) {
        return x && typeof x === 'object' && /^[^:]{1,40}:\d{1,2}$/.test(String(x.k)) && cleanAmount(x.a) ? { k: String(x.k), a: cleanAmount(x.a) } : null;
      }).filter(Boolean).slice(0, 200);
      var lost = (y.alloc !== undefined && !Array.isArray(y.alloc)) ? 1 : rawAlloc.length - alloc.length;
      if (lost > 0) allocDropped.push({ id: id, n: lost });
      var fee = rawFee ? { rid: rawFee.rid, a: rawFee.a } : null;
      if (y.fee && !fee) feeDropped.push({ id: id });
      if (fee && y.fee.ac) fee.ac = str(y.fee.ac, 60);   /* akun catatan biaya saat dibuat: bagian dari identitasnya */
      var o = { id: id, t: t, w: w, a: amt }; if (src) o.src = src;
      o.alloc = alloc; o.fee = fee; o.n = str(y.n, 80); out.push(o);
    });
    return rep();
  }
  function cleanPays(a) { return cleanPaysReport(a).pays; }

  /* meta.plRecon (v2.1): { 'YYYY-MM': { x, sim, t, log[<=30] } }. x = tagihan aktual Shopee, sim = nilai terwakili simulasi saat dicocokkan (keduanya bilangan bulat >= 0). */
  var nonNeg = function (v) { return typeof v === 'number' && isFinite(v) && v >= 0 ? Math.min(MAX_AMT, Math.round(v)) : -1; };
  /* timestamp 'YYYY-MM-DDTHH:MM[:SS]' dengan validasi kalender nyata (bulan 1-12, hari sesuai bulan & tahun kabisat, jam<=23, menit<=59, detik<=59).
     Tambahan di belakangnya (milidetik, zona waktu) dipotong; yang tidak valid menjadi ''. */
  var TS_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/;
  function cleanTs(v) {
    var m = typeof v === 'string' ? TS_RE.exec(v) : null; if (!m) return '';
    var y = +m[1], mo = +m[2], d = +m[3], h = +m[4], mi = +m[5], se = m[6] === undefined ? 0 : +m[6];
    var dim = [31, (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return y >= 1 && mo >= 1 && mo <= 12 && d >= 1 && d <= dim[mo - 1] && h <= 23 && mi <= 59 && se <= 59 ? m[0] : '';
  }
  function cleanRecon(r) {
    if (!r || typeof r !== 'object' || Array.isArray(r)) return null;
    var x = nonNeg(r.x), sim = nonNeg(r.sim); if (x < 0 || sim < 0) return null;
    var log = [];
    (Array.isArray(r.log) ? r.log : []).forEach(function (e) {
      if (!e || typeof e !== 'object') return;
      var ex = nonNeg(e.x), es = nonNeg(e.sim); if (ex < 0 || es < 0) return;
      log.push({ t: cleanTs(e.t), x: ex, sim: es });
    });
    return { x: x, sim: sim, t: cleanTs(r.t), log: log.slice(-30) };
  }
  function cleanPlRecon(o) {
    var out = {}, n = 0;
    if (!o || typeof o !== 'object' || Array.isArray(o)) return out;
    Object.keys(o).forEach(function (k) {
      if (n >= 240 || BAD_KEY[k] || !/^\d{4}-(0[1-9]|1[0-2])$/.test(k)) return;
      var c = cleanRecon(o[k]); if (c) { out[k] = c; n++; }
    });
    return out;
  }

  var api = { cleanRecon: cleanRecon, cleanPlRecon: cleanPlRecon, MAX_SRC: MAX_SRC, checkSrc: checkSrc, cleanPaysReport: cleanPaysReport, cleanPays: cleanPays, cleanAmount: cleanAmount, cleanBudget: cleanBudget, cleanCats: cleanCats, cleanRules: cleanRules, MAX_AMT: MAX_AMT };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.MDSanitize = api;
})(typeof window !== 'undefined' ? window : globalThis);
