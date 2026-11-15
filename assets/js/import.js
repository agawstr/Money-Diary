/* import.js — mengubah baris hasil ekspor Money Manager (xlsx/csv) jadi catatan.
   Tidak bergantung pada pustaka apa pun, jadi bisa diuji di Node. */
(function (root) {
  const p2 = n => String(n).padStart(2, '0');
  const fmt = (y, mo, d, h, mi, s) => `${y}-${p2(mo)}-${p2(d)}T${p2(h || 0)}:${p2(mi || 0)}:${p2(s || 0)}`;

  /* nomor seri Excel -> 'YYYY-MM-DDTHH:mm:ss' (tanpa zona waktu, apa adanya seperti di Money Manager) */
  function serialToStr(n) {
    const d = new Date(Math.floor(Math.round((n - 25569) * 86400000) / 1000) * 1000); // bulatkan ke ms, lalu buang ms (sama dengan data awal)
    return fmt(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds());
  }

  function parseDate(v) {
    if (v == null || v === '') return null;
    if (v instanceof Date) return isNaN(v) ? null : fmt(v.getFullYear(), v.getMonth() + 1, v.getDate(), v.getHours(), v.getMinutes(), v.getSeconds());
    if (typeof v === 'number') return v > 20000 && v < 80000 ? serialToStr(v) : null;
    const s = String(v).trim();
    let m = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (m) return fmt(+m[1], +m[2], +m[3], +m[4], +m[5], +m[6]);
    m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (m) { // m/d/y (Money Manager), kecuali angka pertama jelas > 12 -> d/m/y
      const a = +m[1], b = +m[2];
      const [mo, d] = a > 12 ? [b, a] : [a, b];
      return fmt(+m[3], mo, d, m[4], m[5], m[6]);
    }
    return null;
  }

  function parseAmount(v) {
    if (typeof v === 'number') return Math.abs(v);
    if (v == null) return NaN;
    let s = String(v).replace(/[^\d.,-]/g, '');
    if (!s) return NaN;
    if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.'); // "1.234,50"
    else s = s.replace(/,/g, '');                                       // "1,234" / "29900.0"
    const n = parseFloat(s);
    return isNaN(n) ? NaN : Math.abs(n);
  }

  /* CSV sederhana: dukung tanda kutip, koma atau titik-koma */
  function parseCSV(text) {
    text = text.replace(/^﻿/, '');
    const first = text.split(/\r?\n/, 1)[0] || '';
    const sep = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : ',';
    const rows = []; let row = [], cur = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c;
      } else if (c === '"') q = true;
      else if (c === sep) { row.push(cur); cur = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some(x => x !== '')) rows.push(row); row = []; }
      else cur += c;
    }
    row.push(cur); if (row.some(x => x !== '')) rows.push(row);
    if (!rows.length) return [];
    const head = rows[0].map(h => h.trim());
    return rows.slice(1).map(r => { const o = {}; head.forEach((h, i) => { if (!(h in o)) o[h] = r[i] === undefined ? '' : r[i]; }); return o; });
  }

  /* rows: array objek berkunci nama kolom (header baris pertama). */
  function rowsToRecords(rows) {
    const out = [], skipped = { transfer: 0, invalid: 0, currency: 0 };
    if (!rows.length) return { recs: out, skipped, ok: false };
    const keys = Object.keys(rows[0]);
    const find = (...names) => keys.find(k => names.includes(k.trim().toLowerCase()));
    const kDate = find('date', 'tanggal'), kType = find('income/expense', 'type', 'jenis'),
      kAmt = find('idr', 'amount', 'jumlah'), kAmt2 = find('amount', 'jumlah'),
      kCat = find('category', 'kategori'), kNote = find('note', 'catatan'),
      kAcc = find('account', 'akun'), kDesc = find('description', 'deskripsi'), kCur = find('currency', 'mata uang');
    if (!kDate || !kType || !kAmt) return { recs: out, skipped, ok: false };
    for (const r of rows) {
      const t = parseDate(r[kDate]);
      const ty = String(r[kType] == null ? '' : r[kType]).toLowerCase();
      const k = /income|pemasukan/.test(ty) ? 'I' : /expense|pengeluaran/.test(ty) ? 'E' : null;
      if (!t) { skipped.invalid++; continue; }
      if (!k) { skipped.transfer++; continue; }
      let a = parseAmount(r[kAmt]);
      if ((isNaN(a) || a === 0) && kAmt2 && kAmt2 !== kAmt) a = parseAmount(r[kAmt2]);
      if (kCur && kAmt.toLowerCase() !== 'idr' && String(r[kCur] || 'IDR').toUpperCase() !== 'IDR') { skipped.currency++; continue; }
      if (isNaN(a) || a <= 0) { skipped.invalid++; continue; }
      const note = String((kNote && r[kNote]) || '').trim() || String((kDesc && r[kDesc]) || '').trim();   // catatan kosong -> pakai Deskripsi
      const cl = classify(k, note, String((kCat && r[kCat]) || 'Other').trim() || 'Other', kDesc && r[kDesc]);
      out.push({ t, k, a: Math.round(a), c: cl.c, s: cl.s, tg: cl.tg, n: note, ac: String((kAcc && r[kAcc]) || 'Accounts').trim() || 'Accounts' });
    }
    return { recs: out, skipped, ok: true };
  }


  /* ---------- kategori: GRUP + SUB-KATEGORI + TAG ----------
     Tiap transaksi punya c (grup), s (sub-kategori) dan tg (tag, mis. "darurat").
     Aturan dicek berurutan pada catatan (huruf kecil); yang cocok pertama menang.
     Bentuk: [regex, grup, sub, tag?]. Bagian "kamu bisa tambah di sini" cukup menambah baris. */
  const G = { FOOD: 'Food', TRANS: 'Transport', HOBI: 'Hobi & Koleksi', FUN: 'Hiburan & Game', BILL: 'Tagihan & Langganan', SHOP: 'Belanja', SOC: 'Sosial & Hadiah', HEAL: 'Kesehatan & Pendidikan', OTHER: 'Other', ALLOW: 'Allowance', INC: 'Penghasilan Lain' };
  /* sub-kategori yang tersedia per grup (urutan = urutan chip di form) */
  const SUBS = {
    'Food': ['Makan harian', 'Ayam & Fast food', 'Kopi & Jajan', 'Minimarket'],
    'Transport': ['Ojol', 'Mobil', 'KRL & Bus', 'e-Money'],
    'Hobi & Koleksi': ['Langganan & Live', 'Event & Konser', 'Merch & Koleksi', 'Lainnya'],
    'Hiburan & Game': ['Game', 'Koleksi', 'Nonton & Hangout', 'Hobi', 'Liburan'],
    'Tagihan & Langganan': ['Langganan', 'Pulsa & Internet', 'Listrik & Air'],
    'Belanja': ['Online', 'Pakaian', 'Kecantikan', 'Rumah tangga', 'Elektronik'],
    'Sosial & Hadiah': ['Traktir', 'Kas & Patungan', 'Hadiah', 'Oleh-oleh'],
    'Kesehatan & Pendidikan': ['Kesehatan', 'Pendidikan', 'Darurat'],
    'Other': [],
    'Allowance': [],
    'Penghasilan Lain': ['Joki', 'Jualan', 'Saham']
  };
  const R = (re, g, s, tag) => [re, g, s, tag];
  const SUB_RULES = [
    /* --- hobi & koleksi (paling atas supaya tidak tertimpa aturan umum) --- */
    R(/\b(konser|concert|festival|fest|nobar|offair)\b/, G.HOBI, 'Event & Konser'),
    R(/\b(merch|merchandise|photocard|poster)\b/, G.HOBI, 'Merch & Koleksi'),
    /* --- tagihan & langganan (sebelum ojol/game supaya "gojek plus" tidak jadi Ojol) --- */
    R(/\b(spotify|netflix|youtube|disney|vidio|icloud|google|lightroom|capcut|gojek plus|grab unlimited|shopee vip|getcontact|gencontact|prime video)\b|^(tiktok|app)$/, G.BILL, 'Langganan'),
    R(/\b(telkom|telkomsel|pulsa|kuota|paket data|indosat|axis|smartfren|by\.?u|indihome|wifi|internet)\b/, G.BILL, 'Pulsa & Internet'),
    R(/\b(token|pln|listrik|pdam|air galon)\b/, G.BILL, 'Listrik & Air'),
    /* --- transport --- */
    R(/\b(e-?money|flazz|brizzi|tapcash)\b/, G.TRANS, 'e-Money'),
    R(/\b(towing)\b/, G.TRANS, 'Mobil', 'darurat'),
    R(/\b(bensin|pertamax|pertalite|bbm|parkir|cuci mobil|ban mobil|bengkel|servis|tol|oli)\b/, G.TRANS, 'Mobil'),
    R(/\b(kereta|krl|mrt|lrt|bus|transjakarta|tj|travel)\b/, G.TRANS, 'KRL & Bus'),
    R(/\b(gojek|gocar|go-?car|grab ?(bike|car)?|ojol|ojek|maxim|indrive)\b/, G.TRANS, 'Ojol'),
    /* --- hiburan & game --- */
    R(/\b(penginapan|hotel|villa|homestay|tiket (pesawat|kereta))\b/, G.FUN, 'Liburan', 'away'),
    R(/\b(figure|hotwheels|labubu|pop ?mart|gundam|diecast)\b/, G.FUN, 'Koleksi'),
    R(/\b(mobile legends|game|steam|roblo[xc]|valorant|top ?up)\b|^ml$/, G.FUN, 'Game'),
    R(/\b(bioskop|ice skating|kidzania|billiard|bowling|photobooth|htm|photo studio|karaoke|timezone)\b/, G.FUN, 'Nonton & Hangout'),
    R(/\b(gitar|guitar|senar|ukulele)\b/, G.FUN, 'Hobi', 'gitar'),
    /* --- makan & minum --- */
    R(/\b(indomaret|alfamart|alfa|hypermart|superindo|supermarket|minimarket)\b/, G.FOOD, 'Minimarket'),
    R(/\b(kopi|coffee|starbucks|janji jiwa|kenangan|latte|boba|es teh|jajan|snack|dessert|ice cream|gelato|donat|donut|roti)\b/, G.FOOD, 'Kopi & Jajan'),
    R(/\b(wingstop|mcd|mcdonald|kfc|moon chicken|geprek|nashville|chicken|ayam|burger|pizza|hokben|richeese|gacoan|pop bowl|waka waka)\b/, G.FOOD, 'Ayam & Fast food'),
    /* --- belanja --- */
    R(/\b(laundry|galon|kabel|charger|dekor)\b/, G.SHOP, 'Rumah tangga'),
    R(/\b(baterai|lcd|casing|headset|earphone|powerbank|keyboard|mouse)\b/, G.SHOP, 'Elektronik'),
    R(/\b(thrift|parfume|parfum|h&m|miniso|uniqlo|baju|kaos|celana|sepatu)\b/, G.SHOP, 'Pakaian'),
    R(/\b(cukur|barber|erha|guardian|watsons|skincare|salon)\b/, G.SHOP, 'Kecantikan'),
    R(/\b(shopee|tokopedia|tokped|tiktok shop|lazada|blibli)\b/, G.SHOP, 'Online'),
    /* --- kesehatan & pendidikan --- */
    R(/\b(gym|pijet|pijat|rumah sakit|dokter|klinik|apotek|obat|vitamin)\b/, G.HEAL, 'Kesehatan'),
    R(/\b(fotokopi|print|buku|ukt|spp|kursus|kuliah|praktikum)\b/, G.HEAL, 'Pendidikan'),
    /* --- sosial --- */
    R(/\b(kas|patungan|iuran)\b/, G.SOC, 'Kas & Patungan'),
    R(/\b(hadiah|kado|ultah|gift)\b/, G.SOC, 'Hadiah'),
    R(/\b(oleh-?oleh)\b/, G.SOC, 'Oleh-oleh'),
    R(/\b(traktir|treat)\b/, G.SOC, 'Traktir')
  ];
  const INC_RULES = [
    R(/\b(uang bulanan|duit jajan|uang jajan|uang saku|jajan)\b/, G.ALLOW, ''),
    R(/\bjoki\b/, G.INC, 'Joki'), R(/\b(jualan|jual)\b/, G.INC, 'Jualan'), R(/\b(stock|saham|dividen)\b/, G.INC, 'Saham'),
    R(/\bthr\b/, G.OTHER, 'THR'), R(/\b(gaji|salary)\b/, G.OTHER, 'Gaji'), R(/\bsubsidi\b/, G.OTHER, 'Subsidi')
  ];
  /* kategori lama (Money Manager / versi sebelumnya) -> [grup, sub bawaan, tag] */
  const LEGACY = {
    food: [G.FOOD, 'Makan harian'], transport: [G.TRANS, ''], kendaraan: [G.TRANS, 'Mobil'],
    household: [G.SHOP, 'Rumah tangga'], 'belanja harian': [G.SHOP, 'Rumah tangga'], 'belanja online': [G.SHOP, 'Online'], belanja: [G.SHOP, ''],
    apparel: [G.SHOP, 'Pakaian'], beauty: [G.SHOP, 'Kecantikan'], 'kesehatan & perawatan': [G.HEAL, 'Kesehatan'],
    health: [G.HEAL, 'Kesehatan'], education: [G.HEAL, 'Pendidikan'], pendidikan: [G.HEAL, 'Pendidikan'],
    'social life': [G.SOC, 'Traktir'], 'sosial & hiburan': [G.SOC, ''], hiburan: [G.FUN, ''], 'hobi & game': [G.FUN, 'Game'], culture: [G.FUN, 'Nonton & Hangout'],
    tagihan: [G.BILL, ''], langganan: [G.BILL, 'Langganan'], handphone: [G.BILL, 'Pulsa & Internet', 'handphone'],
    guitar: [G.FUN, 'Hobi', 'gitar'], 'oleh-oleh': [G.SOC, 'Oleh-oleh'],
    darurat: [G.OTHER, '', 'darurat'], away: [G.FUN, 'Liburan', 'away'], subsidi: [G.OTHER, '', 'subsidi'], stock: [G.OTHER, '', 'investasi'],
    'hobi & koleksi': [G.HOBI, ''], other: [G.OTHER, ''], lainnya: [G.OTHER, '']
  };
  const LEGACY_INC = { allowance: [G.ALLOW, ''], salary: [G.OTHER, 'Gaji'], thr: [G.OTHER, 'THR', 'thr'], joki: [G.INC, 'Joki', 'joki'], stock: [G.INC, 'Saham', 'investasi'], subsidi: [G.OTHER, 'Subsidi', 'subsidi'], handphone: [G.OTHER, 'Lainnya', 'handphone'], other: [G.OTHER, 'Lainnya'], lainnya: [G.OTHER, 'Lainnya'] };
  /* pemasukan: 3 kelompok = Uang saku (Allowance) | Penghasilan sampingan (Penghasilan Lain) | Lain-lain (Other) */
  const SUBS_I = { 'Penghasilan Lain': ['Joki', 'Jualan', 'Saham'], 'Other': ['THR', 'Gaji', 'Subsidi', 'Lainnya'] };
  /* aturan buatan sendiri (disimpan di meta.rules oleh app): kata di catatan -> grup/sub/tag; menang atas aturan bawaan */
  const USER = [];
  function setRules(a) { USER.length = 0; (Array.isArray(a) ? a : []).forEach(u => { if (u && u.k && u.g) USER.push({ k: String(u.k).toLowerCase(), kind: u.kind === 'I' ? 'I' : 'E', g: u.g, s: u.s || '', tg: Array.isArray(u.tg) ? u.tg : [] }); }); }
  const plain = c => String(c || '').replace(/[^\x00-\x7F]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  const KNOWN = new Set(Object.keys(SUBS).map(k => k.toLowerCase()));
  /* hasil: { c: grup, s: sub, tg: [tag] }. k = 'E' | 'I' */
  function classify(k, note, cat, desc) {
    const n = String(note || '').toLowerCase().trim(), d = String(desc || '').toLowerCase().trim(), old = plain(cat);
    const tg = [];
    const rules = k === 'I' ? INC_RULES : SUB_RULES;
    const lg = (k === 'I' ? LEGACY_INC : LEGACY)[old];
    if (lg && lg[2]) tg.push(lg[2]);
    for (const u of USER) if (u.kind === k && n && n.includes(u.k)) return { c: u.g, s: u.s, tg: [...new Set(tg.concat(u.tg))] };
    for (const [re, g, s, t] of rules) {
      if (re.test(n) || (d && g === G.HOBI && re.test(d) && (!old || old === 'other'))) {
        if (t && !tg.includes(t)) tg.push(t);
        return { c: g, s, tg };
      }
    }
    if (lg) return { c: lg[0], s: lg[1] || '', tg };
    /* kategori yang sudah berupa nama grup baru dipertahankan; kategori tak dikenal dibiarkan (kategori buatan sendiri) */
    const exact = Object.keys(SUBS).find(x => x.toLowerCase() === old);
    if (exact) return { c: exact, s: '', tg };
    return { c: String(cat || '').trim() || G.OTHER, s: '', tg };
  }
  /* kompatibel dengan kode lama: hanya nama grup */
  function recategorize(note, cat, desc) { return classify('E', note, cat, desc).c; }

  const api = { recategorize, classify, setRules, SUBS, SUBS_I, SUB_RULES, parseDate, parseAmount, parseCSV, rowsToRecords, serialToStr };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.MMImport = api;
})(typeof window !== 'undefined' ? window : globalThis);
