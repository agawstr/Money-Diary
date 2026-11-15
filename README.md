# Money Diary

Catatan pengeluaran pribadi, bergaya Liquid Glass sky blue dan meniru tata letak Money Manager. Proyek ini tidak berafiliasi dengan Money Manager. Tanpa backend dan tanpa build: file statis, bisa di GitHub Pages/Vercel. Setelah dibuka sekali, bisa dipakai offline (service worker).

## Menjalankan
- Vercel: impor repo (Framework Preset: *Other*, tanpa build command), atau `vercel --prod` dari folder ini.
- Lokal: `python3 -m http.server 8000`, buka `http://localhost:8000`.
- Service worker butuh `https://` atau `localhost`; tidak jalan lewat `file://`.
- Setelah mengubah file statis, naikkan `VERSION` di `sw.js` supaya cache lama diganti.

## Tampilan
Bar atas: periode (panah ‹ › untuk pindah bulan/tahun; **ketuk nama periode untuk membuka pemilih**: grid bulan per tahun + pintasan *Bulan ini*, *3 bln terakhir*, *Tahun ini*, *Semua waktu*) dan pencarian. Di tab Kalender pemilih memilih bulan yang ditampilkan. Geser kiri/kanan di area konten juga memindah bulan/tahun. Di bawahnya ringkasan **Pemasukan / Pengeluaran / Total** untuk rentang yang sedang dilihat. Menu bawah punya empat tab; tombol **+** mengambang untuk mencatat.

| Tab bawah | Isinya |
|---|---|
| **Transaksi** | Sub-tab **Harian** (daftar per hari, anggaran bulan ini, pencarian), **Kalender** (total per hari, ketuk hari untuk melihat transaksinya), **Bulanan** dan **Tahunan** (rekap) |
| **Statistik** | Donat kategori (label nama+persen di luar donat, ketuk irisan untuk menyorot); ketuk kategori untuk memfilter riwayat. Sub-tab Harian/Kalender/Bulanan/Tahunan tetap tampil di atas |
| **Ringkasan** | Rata-rata per bulan/hari, hari tanpa pengeluaran, pengeluaran terbesar, grafik per bulan (ketuk bulan untuk memfilter), heatmap harian, catatan paling sering dibeli |
| **Data** | Impor Money Manager (.xlsx/.csv), backup/pulihkan (.json), ekspor CSV, budget bulanan, reset |

Filter bulan/kategori tersimpan di URL (`?from=2026-11&to=2026-11&cat=Food&tab=sum`).

Pintasan laptop: `←` `→` pindah tab, `/` cari, `n` catat.

## CSS
Satu file: `assets/css/style.css`, terbagi tiga bagian bertanda `####` (app → ios → fix). Urutannya sama dengan cascade lama, jadi bagian bawah menang atas bagian atas; jangan diacak. Isi `liquid.css` yang lama sudah ada di bagian app.

- **Skala**: radius pakai `--r-xs/-sm/-md/--r/-xl/-pill`, jarak (padding, margin, gap) pakai `--sp-1` sampai `--sp-8`. Jangan tulis angka sendiri.
- **Posisi mengambang**: tab bar, FAB, dan toast diatur dari `--tabbar-h`, `--fab-bottom`, `--toast-bottom` di `:root` paling atas.
- **Blur**: cuma tab bar dan navbar yang memakai `backdrop-filter` (satu blok di akhir file). Modal, FAB, toast, dan kartu tanpa blur.
- **Animasi**: hanya `transform` dan `opacity`. Perubahan ukuran sheet dan susunan kartu dompet digerakkan lewat FLIP di `app.js` (`expandSheet`, `flipCards`).
- **Aurora**: tiga lingkaran warna di `.aurora` (`index.html`), mengikuti warna aksen tab; mati otomatis di mode hemat.
- Cek tata letak: `python tools/cek_overlap.py` (butuh Playwright dan server lokal).

## Ikon & warna kategori
Setiap kategori punya ikon SVG dan warna tetap (Food oranye, Transport biru, dst), dipakai di daftar transaksi, donat, kartu ringkasan, dan detail. Kategori baru/tak dikenal memakai ikon label dan warna cadangan. Ikon ada di `ICONS`, warna di `SEM` (awal `app.js`).

## Emoji kategori
Money Manager menaruh emoji di nama kategori (mis. `🍜 Food`). Emoji dibuang saat impor dan saat data lama dimuat, jadi tidak ada lagi kotak kosong di HP yang fontnya tidak punya emoji. Pengenal duplikat memakai waktu+jenis+nominal+catatan (tanpa kategori), jadi mengimpor ulang file ekspor yang masih ber-emoji tetap aman: tidak ada duplikat dan kategori tidak terpecah.

## Gerak dan performa
- Pindah tab/bulan/filter: layar lama memudar dulu, lalu layar baru masuk (tidak lagi berganti mendadak). Garis bawah tab atas dan Pemasukan/Pengeluaran meluncur; donat berubah bentuk secara halus saat data berganti.
- Service worker memakai *jaringan dulu* untuk file aplikasi, jadi versi baru langsung terpakai (tidak tersangkut di cache lama).
- Satu kurva untuk semua gerak (`cubic-bezier(.32,.72,0,1)`, tanpa memantul) dan hanya `transform`/`opacity` yang dianimasikan.
- **Pil tab bawah** berupa lensa kaca: memanjang saat pindah tab, dan bisa digeser dengan jari lalu dilepas di tab tujuan.
- Saat membuka tab atau mengganti filter, kartu yang terlihat naik bergantian dan bar tumbuh dari tepinya; angka berhitung naik.
- Di desktop ada kilau kaca yang mengikuti kursor pada kartu.
- Tingkat performa otomatis: `lite` untuk layar kecil/sentuh/perangkat lemah, `full` selain itu; kaca (blur) mati sendiri di perangkat lemah atau jika transisi sering patah-patah.
- "Kurangi gerakan" di sistem dihormati (semua animasi dilewati).
- Uji manual lewat URL: `?speed=0..4` (pengali kecepatan, default 1), `?perf=lite|full`, `?glass=on|off`.

## Ketik satu baris
Di Beranda (**Catat cepat**) dan di kolom Catatan pada form: `ayam soendari 25k gopay kemarin` diurai jadi catatan, nominal, dompet, dan tanggal. Yang dikenali hanya dari ujung kalimat, urutannya bebas, sisanya jadi catatan.
- Nominal: `25k`, `25rb`, `1,5jt`, `25 rb`, `Rp25.000`, `25000` (angka polos minimal 1.000). Wajib ada.
- Dompet: nama persis, atau satu katanya kalau unik (`bca` untuk `BCA Digital`, `jago` untuk `Bank Jago`); `tunai` = Cash.
- Tanggal: `kemarin`, `kemarin lusa`, `hari ini`, `senin`…`minggu` (hari terakhir yang lewat), `3 hari lalu`, `seminggu lalu`, `tgl 12`. Jamnya jam sekarang.
- Jam: `jam 7`, `jam 14.30`, `jam 8 malam`, `tadi pagi`, `kemarin malam`, `semalam` (pagi 08.00, siang 12.00, sore 16.00, malam 20.00). Kata `pagi/siang/sore/malam` sendirian tidak dibaca sebagai jam, supaya `makan malam 50k` tetap jadi catatan.
- Awali `+` untuk pemasukan (`+gaji 2jt bca`).
- Beranda: Enter langsung menyimpan (ada Batalkan); kategori dari catatan lama yang sama. Tombol **?** di judul membuka contoh yang bisa diketuk. Menempel beberapa baris (atau tombol *Tempel banyak baris*) membuka sheet dengan pratinjau per baris, lalu simpan sekaligus. Chip Catat cepat diurutkan menurut jam & hari yang mirip sekarang. Kalau tak terbaca atau nominalnya ≥8× biasanya, form terbuka terisi supaya bisa dicek. Di form: Enter/ketuk pratinjau untuk menerapkan, lalu Simpan.

## Impor Money Manager
Tab **Data → Pilih file…**. Hanya transaksi sejak bulan "Mulai dari" (default: bulan saat app pertama dibuka; bisa diubah) yang diambil. Duplikat dikenali dari waktu+jenis+nominal+catatan, jadi aman mengimpor ulang file yang lebih baru; ada ringkasan dan konfirmasi dulu. Membaca .xlsx memuat pustaka SheetJS dari cdnjs (butuh internet); .csv tidak butuh.

## Data & privasi
Semua data (transaksi, anggaran, dompet, target) disimpan **hanya di localStorage browser masing-masing pengguna**. Tidak ada server, akun, atau analitik; tidak ada data yang dikirim ke mana pun. Konsekuensinya: data tidak tersinkron antar perangkat, bisa hilang kalau data situs dihapus atau ganti perangkat, dan bisa dilihat orang lain yang memakai browser yang sama. **Unduh backup berkala** dari tab Data, dan jangan commit file backup/ekspor ke repo.

Repo ini **tidak berisi data**. Impor file Money Manager lewat tab Data; data hidup di localStorage browser, jadi **unduh backup berkala**. Kalau ada `data.json` di sebelah `index.html` (format `{start, rows:[[t,k,c,n,a,ac]]}`), isinya dimuat sebagai data awal, tapi jangan taruh data pribadi di situ kalau situsnya publik.

## Struktur
- `index.html`: kerangka halaman
- `assets/css/style.css`: seluruh gaya (satu file; satu-satunya yang dimuat `index.html` dan `sw.js`). `app.css`, `ios.css`, `fix.css`, dan `liquid.css` di folder yang sama hanya sisa lama, tidak dimuat, dan aman dihapus
- `assets/js/app.js`: logika aplikasi; `assets/js/import.js`: pembaca file Money Manager
- `sw.js`: cache offline; `manifest.webmanifest`: pengaturan PWA
- Tanpa font dari internet: memakai font sistem (SF Pro di iOS/macOS, Roboto/Segoe di lainnya)

## Pembaruan: kategori v2 + tampilan iOS 26
- **Kategori = grup › sub-kategori + tag.** 9 grup pengeluaran (Makan & Minum, Transportasi, Hobi & Koleksi, Hiburan & Game, Tagihan & Langganan, Belanja, Sosial & Hadiah, Kesehatan & Pendidikan, Lain-lain). Aturannya ada di `SUB_RULES` (`assets/js/import.js`): tambah satu baris `R(/regex/, grup, sub, tag)` untuk kata baru. Label lama seperti `darurat`, `away`, `stock` menjadi **tag**.
- Data lama: buka Beranda, ketuk **Rapikan** (atau Data → Rapikan kategori). Ada pratinjau dan tombol Batalkan.
- Statistik: ketuk grup untuk membuka sub-kategorinya, ketuk sub untuk melihat transaksinya (`?cat=Hobi+%26+Koleksi&sub=Event+%26+Konser`).
- Tampilan baru ada di bagian IOS di `assets/css/style.css`: aksen per tab, tab bar kaca mengambang + tombol Catat terpisah, sidebar di layar ≥1024px, mode terang/gelap (Data → Tampilan), kartu hero, ikon squircle. Bagian mode terang dibuat otomatis dari bagian APP.
- Sheet Catat: nominal besar, tombol +5rb/+10rb/+20rb/+50rb, catatan dulu lalu kategori + sub-kategori ditebak otomatis (dengan keterangan sumber tebakan).

## Pembaruan v6: performa, alur, dan Dompet
**Performa (animasi pindah tab / buka-tutup sheet)**
- Penyebab lag: blur ditumpuk di tab bar, sheet, FAB, toast, dan menu; sheet berblur ikut dianimasikan; dan "pengaman kaca" tidak benar-benar mematikan blur karena kalah oleh bagian IOS. Sekarang semua blur lewat tiga variabel (`--bf-bar`, `--bf-ov`, `--ov-bg`) di lapisan paling akhir `style.css` (bagian BLUR). Mode `lite` dan `glass=off` mematikannya sungguhan, dan sheet tidak pernah berblur sendiri.
- `go()` (pindah tab): layar lama dilepas jadi "hantu" `position:fixed` yang memudar di compositor, layar baru dirender **sekali** di tugas yang sama, lalu semua animasi mulai di frame yang sama. Tidak ada lagi render berat di tengah animasi. `transit()` (ganti bulan/filter) langsung render lalu isi baru masuk halus.
- Pil tab bawah hanya menganimasikan `transform` (dulu juga `width`). `will-change` permanen pada layar penuh, `drop-shadow` pada donat, dan selektor `html.nt *` (menghitung ulang style seluruh DOM) dihapus.
- Service worker: aset statis memakai *stale-while-revalidate* (buka instan), halaman memakai jaringan dulu dengan timeout 3 dtk.
- Data → Tampilan → **Efek kaca: Mati** untuk perangkat yang masih berat. `liquid.css` (tidak pernah dimuat) dihapus.

**Alur & kegunaan**
- Judul Beranda berupa sapaan sesuai jam. Bar periode (panah bulan) hanya muncul di tab yang memang memakai filter.
- Beranda menampilkan kartu **Total saldo** dan pengingat **backup** (data hanya ada di browser).
- Getar singkat (Android) saat pindah tab dan membuka form catat.

**Dompet (tab baru)**
- Saldo = saldo awal + pemasukan − pengeluaran (transaksi dengan nama akun yang sama) + transfer masuk − transfer keluar. Form Catat kini memilih dompet lewat chip berwarna dan mengingat dompet terakhir.
- Buat dompet (preset BCA/BRI/GoPay/OVO/DANA/Tunai dst.), isi saldo, transfer antar dompet dengan biaya admin opsional (dicatat sebagai pengeluaran), sesuaikan saldo, dan opsi "jangan hitung di total".
- Akun dari riwayat Money Manager (mis. `Accounts`, `Cash`) bisa dijadikan dompet sekali ketuk.
- Transfer tidak dihitung sebagai pemasukan/pengeluaran di statistik. Dompet dan transfer ikut di backup .json.

## Pembaruan: saran catatan + "Simpan & tambah lagi"
- Kolom **Catatan** di form Catat tidak lagi memakai `<datalist>`; daftar saran buatan sendiri (`#fm-nsl`). Cocok sampai ke tengah kata ("soendari" menemukan "ayam soendari"), diurutkan menurut seberapa sering dan seberapa baru dipakai (skor meluruh setengah tiap 45 hari), tiap baris menampilkan ikon kategori dan nominal terakhir. Ketuk (atau ↑ ↓ Enter di desktop) mengisi kategori, sub, tag, dompet, dan nominal bila masih kosong.
- Saran kategori otomatis saat mengetik hanya memakai catatan yang cocok di awal kata, supaya potongan di tengah kata tidak menebak kategori yang salah.
- **Simpan & tambah lagi** sekarang membiarkan form tetap terbuka: catatan, nominal, dan tag dikosongkan; jenis, kategori, dompet, dan waktu dipertahankan (waktu hanya dibawa bila diubah manual, kalau tidak diperbarui ke jam sekarang).

## Pembaruan: nominal singkat, keypad, dan tag
- **Nominal singkat**: di kolom nominal (form Catat dan sheet Dompet) `25k`, `25rb`, `25ribu`, `1,5jt`, `2juta` langsung jadi angka. Pembacanya `parseAmt()` di `app.js`; `1,5` ditahan mentah sampai `rb`/`jt` diketik. Desimal maksimal dua digit.
- **Keypad HP** punya baris tambahan `rb`, `jt`, dan koma: ketuk `2` lalu `jt` jadi 2.000.000; `1` `,` `5` `jt` jadi 1.500.000. Susunan tombol ada di `KP_KEYS`, logikanya di `kpPress()`.
- **Tag** dipisah dengan koma saja; spasi di dalam tag diganti `-` ("trip jogja" jadi `trip-jogja`). Sebelumnya spasi ikut memecah tag.

## Pembaruan: chip nominal per catatan
Begitu kolom Catatan berisi catatan yang pernah dipakai dengan 2 nominal berbeda atau lebih, muncul baris **Biasanya** berisi sampai 3 nominal (mis. `18rb  22rb`). Urutannya memakai bobot yang sama dengan saran catatan (harga baru lebih berat, meluruh setengah tiap 45 hari), jadi harga yang naik ikut naik ke depan. Ketuk satu chip untuk mengganti nominal tanpa mengetik ulang; chip yang sama dengan isi kolom nominal ditandai. Datanya dari `nIdx[].amts` (`buildIdx()` di `formSheet`).

## Pembaruan: peringatan nominal janggal
Saat menyimpan pengeluaran baru, kalau nominalnya minimal **8× median** nominal lama untuk catatan yang sama (catatan itu sudah ada minimal 3 kali, dan nominalnya belum pernah dipakai sebelumnya), muncul peringatan kecil di bawah kotak nominal: **Jadi 20rb** (mengganti ke median) atau **Memang benar** (menyimpan apa adanya). Mengubah nominal atau catatan menutup peringatan. Hanya menjaga nominal yang terlalu besar; nominal yang terlalu kecil tidak diperiksa. Logikanya `oddMedian()` di `formSheet`; ini terpisah dari peringatan top-up ganda yang sudah ada.
