/* util.js — fungsi murni: tanggal lokal, format angka/teks, nominal. Dipindah dari app.js tanpa perubahan perilaku.
   Tidak menyentuh DOM/penyimpanan; dipakai app.js lewat window.MDUtil dan diuji di Node (tests/test_util.js). */
(function (root) {
'use strict';
const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const MS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
const DOW = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
const DOWL = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
const NF = new Intl.NumberFormat('id-ID');
const EMO = /[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}️‍⃣]/gu;
const cn = s => { const t = String(s == null ? '' : s).replace(EMO, '').replace(/\s+/g, ' ').trim().replace(/^[^\x00-\x7F]+\s*(?=[A-Za-z0-9])/, ''); return t || String(s == null ? '' : s); };   // juga membuang emoji rusak di depan nama   // tanpa emoji
const rp = n => 'Rp' + NF.format(Math.round(n));
const rpS = n => (n < 0 ? '−' : '') + rp(Math.abs(n));
const jt = n => {
  const a = Math.abs(n);
  if (a >= 1e6) return (a / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace('.', ',') + 'jt';
  if (a >= 1e3) return Math.round(a / 1e3) + 'rb';
  return String(Math.round(a));
};
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const p2 = n => String(n).padStart(2, '0');
const mLabel = ym => MONTHS[+ym.slice(5, 7) - 1] + ' ' + ym.slice(0, 4);
const mShort = ym => MS[+ym.slice(5, 7) - 1] + ' ' + ym.slice(2, 4);
const dateOf = t => new Date(+t.slice(0, 4), +t.slice(5, 7) - 1, +t.slice(8, 10));
const dkey = d => d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
const nowLocal = () => { const d = new Date(); return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) + 'T' + p2(d.getHours()) + ':' + p2(d.getMinutes()); };
const thisMonth = () => nowLocal().slice(0, 7);
const addM = (ym, d) => { let [yy, mm] = ym.split('-').map(Number); mm += d; while (mm < 1) { mm += 12; yy--; } while (mm > 12) { mm -= 12; yy++; } return yy + '-' + p2(mm); };
const fmtAmt = v => { const d = String(v).replace(/\D/g, ''); return d ? NF.format(+d) : ''; };
/* nominal: "25k", "25rb", "25ribu", "1,5jt", "2juta", "25.000", "25000" -> angka (0 kalau tak terbaca) */
const AMT_SUF = { k: 1e3, rb: 1e3, ribu: 1e3, jt: 1e6, juta: 1e6 }, AMT_MAX = 99999999999;
const AMT_ABBR = /^(\d+(?:[.,]\d{1,2})?)(k|rb|ribu|jt|juta)$/;
function parseAmt(v) {
  const s = String(v == null ? '' : v).toLowerCase().replace(/rp\.?|\s/g, ''), m = s.match(AMT_ABBR);
  return Math.min(AMT_MAX, m ? Math.round(parseFloat(m[1].replace(',', '.')) * AMT_SUF[m[2]]) : +s.replace(/\D/g, '') || 0);
}
var api = { MONTHS, MS, DOW, DOWL, NF, EMO, cn, rp, rpS, jt, esc, p2, mLabel, mShort, dateOf, dkey, nowLocal, thisMonth, addM, fmtAmt, parseAmt, AMT_SUF, AMT_MAX, AMT_ABBR };
if (typeof module === 'object' && module.exports) module.exports = api; else root.MDUtil = api;
})(typeof window !== 'undefined' ? window : globalThis);
