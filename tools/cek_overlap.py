#!/usr/bin/env python3
"""Cek kerapian layout Money Diary: tumpang-tindih elemen mengambang dan layar meluber ke samping.

Pakai:
    pip install playwright && playwright install chromium
    python -m http.server 8000            # di folder proyek, terminal lain
    python tools/cek_overlap.py           # atau: python tools/cek_overlap.py http://localhost:8000/ --shot

Yang dicek di setiap tab (Beranda, Dompet, Transaksi, Statistik, Rencana) pada lebar 320/360/390/430/768/1100:
  1. tab bar, FAB, dan toast tidak saling menimpa (toast disimulasikan tampil dengan tombol Batalkan)
  2. ketiganya tidak keluar dari layar
  3. halaman tidak punya scroll horizontal, dan tidak ada elemen yang melewati tepi kanan
     (kecuali yang memang berada di dalam wadah yang bisa digeser)
Di layar >= 1024px tab bar menjadi sidebar dan FAB memang di dalamnya, jadi pasangan itu dilewati.
Keluar dengan kode 1 jika ada masalah, jadi bisa dipasang di CI.
"""
import sys
from playwright.sync_api import sync_playwright

URL = next((a for a in sys.argv[1:] if not a.startswith('--')), 'http://localhost:8000/')
SHOT = '--shot' in sys.argv
SIZES = [(320, 640), (360, 740), (390, 844), (430, 932), (768, 1024), (1100, 800)]
TABS = ['home', 'wal', 'tl', 'cat', 'plan']

RECT = """(sel) => { const e = document.querySelector(sel); if (!e) return null;
  const c = getComputedStyle(e); if (c.display === 'none' || c.visibility === 'hidden') return null;
  const r = e.getBoundingClientRect(); return r.width ? {l: r.left, r: r.right, t: r.top, b: r.bottom} : null; }"""

SHOW_TOAST = """() => { const t = document.querySelector('#toast'); if (!t) return;
  t.innerHTML = 'Pengeluaran dicatat Rp65.000 · makan <button class="tundo">Batalkan</button>'; t.classList.add('on'); }"""

WIDE = """() => { const W = innerWidth, out = [];
  const scroller = e => { for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) {
    const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden') return true; } return false; };
  for (const e of document.querySelectorAll('body *')) {
    const c = getComputedStyle(e); if (c.display === 'none' || c.position === 'fixed' || e.closest('[hidden]')) continue;
    const r = e.getBoundingClientRect(); if (!r.width || r.right <= W + 1) continue;
    if (scroller(e)) continue;
    out.push(e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\\s+/).join('.') : '') + ' (kanan ' + Math.round(r.right) + 'px)');
    if (out.length >= 5) break; }
  return out; }"""

def hit(a, b):
    return not (a['r'] <= b['l'] or b['r'] <= a['l'] or a['b'] <= b['t'] or b['b'] <= a['t'])

problems = []
with sync_playwright() as p:
    browser = p.chromium.launch()
    for w, h in SIZES:
        ctx = browser.new_context(viewport={'width': w, 'height': h}, has_touch=w < 700)
        page = ctx.new_page(); page.goto(URL); page.wait_for_timeout(900)
        for tab in TABS:
            page.click(f'.tab[data-nav="{tab}"]'); page.wait_for_timeout(700)
            page.evaluate(SHOW_TOAST); page.wait_for_timeout(450)
            r = {k: page.evaluate(RECT, s) for k, s in (('tab bar', '#tabbar'), ('FAB', '#add-btn'), ('toast', '#toast.on'))}
            tag = f'{w}px / {tab}'
            pairs = [('tab bar', 'toast'), ('FAB', 'toast')] + ([] if w >= 1024 else [('FAB', 'tab bar')])
            for x, y in pairs:
                if r[x] and r[y] and hit(r[x], r[y]): problems.append(f'{tag}: {x} menimpa {y}')
            for k, v in r.items():
                if v and (v['l'] < -1 or v['r'] > w + 1 or v['t'] < -1 or v['b'] > h + 1): problems.append(f'{tag}: {k} keluar layar')
            if page.evaluate('document.documentElement.scrollWidth > document.documentElement.clientWidth + 1'):
                problems.append(f'{tag}: halaman bisa digeser ke samping')
            for e in page.evaluate(WIDE): problems.append(f'{tag}: meluber -> {e}')
            if SHOT: page.screenshot(path=f'overlap_{w}_{tab}.png')
        ctx.close()
    browser.close()

if problems:
    print('\n'.join(sorted(set(problems)))); print(f'\n{len(set(problems))} masalah'); sys.exit(1)
print(f'Rapi: {len(SIZES)} lebar x {len(TABS)} tab, tidak ada yang bertumpuk atau meluber.')
