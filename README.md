# ANGGARAN v0.9

ANGGARAN sekarang difokuskan sebagai aplikasi pencatatan keuangan per project.

## Fungsi utama
- Multi-project.
- Catat Uang Masuk per project.
- Catat Uang Keluar per project.
- Omzet = total Uang Masuk.
- Pengeluaran = total Uang Keluar.
- Untung/Rugi sementara = Omzet - Pengeluaran.
- Riwayat transaksi per project.
- Ringkasan semua project.
- Backup & Restore lokal.
- Mode tampilan Otomatis / Mobile / PC.
- Offline-first dan tanpa akun.

## Struktur data
IndexedDB `anggaran-db` versi 2:
- `projects`
- `transactions`
- `settings`
- `items` dan `realizations` tetap dipertahankan sebagai legacy dari versi RAB lama agar data lama tidak dihapus diam-diam.

### Transaction
```text
id
projectId
type            income | expense
amount
description
category
date
createdAt
updatedAt
```

## Perhitungan
```text
Omzet        = Σ Uang Masuk
Pengeluaran  = Σ Uang Keluar
Untung/Rugi  = Omzet - Pengeluaran
```

Semua angka turunan dihitung saat render dan tidak disimpan sebagai sumber data kedua.

## Backup
Backup v0.7 menggunakan schema version 2 dan menyimpan:
- projects
- transactions
- data legacy RAB lama sebagai arsip

Backup schema version 1 dari versi RAB lama masih dapat dipulihkan. Project lama akan kembali, sementara data item/realisasi lama tetap disimpan sebagai legacy dan tidak ditampilkan di UI keuangan baru.

## Prinsip
- Data lokal di perangkat.
- Tidak ada server, login, API, font eksternal, CDN, atau dependency runtime.
- Rp0 untuk penggunaan aplikasi.
- UI custom; tidak memakai dropdown HTML native untuk pilihan utama.
- Tidak membuka keyboard otomatis. Keyboard muncul setelah user menyentuh input.
- Tidak ada horizontal page scroll.

## Menjalankan lokal
Jalankan lewat HTTP:

```bash
python3 -m http.server 8080
```

Lalu buka `http://localhost:8080`.

## Deploy
Static site, tanpa build command.

### Vercel
- Framework Preset: `Other`
- Build Command: kosong
- Output Directory: `.`

## Riwayat pivot
v0.7 mengubah total fokus aplikasi dari RAB/realisasi barang menjadi pencatatan keuangan per project. Tema visual charcoal + amber + warm off-white dipertahankan, dengan hijau untuk uang masuk/untung dan merah untuk uang keluar/rugi.


## v0.7.1 UI/UX polish
- Tema visual dikonsolidasikan ke warm off-white, charcoal, amber, dengan hijau/merah hanya untuk makna keuangan.
- Logo aplikasi dan ikon PWA 192/512 diganti dengan mark A geometris yang simetris.
- Nama tab Ringkas menjadi Ringkasan.
- Ringkasan mode PC dibuat lebih padat agar informasi utama muat dalam satu viewport pada layar laptop/desktop normal.
- Tombol tambah project di header tab Proyek dihapus. Satu jalur tambah project tetap melalui tombol + Project baru.
- Mode PC memakai canvas terpusat maksimum 1000px agar tidak stretch mengikuti monitor.
- Layout Mobile pada tablet/layar touch >=700px dibatasi maksimum 680px agar card tidak melebar.


## v0.7.2 screenshot-driven UI fixes
- Header project tidak sticky lagi dan ikut naik saat halaman discroll.
- Navigasi sidebar PC diposisikan di bagian bawah sidebar.
- Ringkasan PC dibatasi satu viewport; daftar panjang memakai scroll internal.
- Zoom pinch, Ctrl/Cmd +/-, dan gesture zoom dinonaktifkan.
- Tombol + di header atas dihapus sepenuhnya.
- Tambah project tetap hanya melalui tombol + Project baru pada tab Proyek.


## v0.7.3 layout correction
- Navigasi Ringkasan / Transaksi / Proyek / Pengaturan selalu berada di bottom navigation pada HP, tablet, dan PC.
- Sidebar desktop dihapus.
- Perbedaan Mobile vs PC/Tablet hanya pada Ringkasan: Mobile boleh scroll, PC/Tablet dipadatkan dalam satu viewport.
- Tab Transaksi, Proyek, dan Pengaturan mempertahankan komposisi single-column yang sama di semua layout.
- Mode Otomatis: viewport >=700px dianggap PC/Tablet; viewport <700px dianggap Mobile. Pointer/mouse tidak lagi dipakai untuk menentukan layout.


## v0.8.1 UI reference cleanup
- Stylesheet lama yang bertumpuk dihapus dan diganti satu sistem CSS bersih.
- Desktop/Tablet mengikuti referensi final Ringkasan dan Transaksi.
- Bottom navigation hanya Ringkasan / Transaksi / Proyek, fixed-width, centered, dan tidak stretch.
- Pengaturan dipindah ke tombol gear di header.
- Header desktop berisi brand ANGGARAN, project aktif, dan Pengaturan dengan alignment konsisten.
- Panel kosong diberi tinggi terkontrol supaya tidak membengkak memenuhi ruang.
- Ringkasan desktop tetap muat satu viewport; tabel mengambil sisa ruang secara proporsional.
- Mobile tetap memakai komposisi satu kolom yang rapi dengan bottom navigation 3 tab.
- Auto layout: viewport >=700px menggunakan layout PC/Tablet.


## v0.9 approved desktop visual
- Desktop Ringkasan, Transaksi, dan Proyek disusun mengikuti visual referensi yang sudah disetujui.
- Header desktop memakai mark A amber, nama ANGGARAN, project aktif, dan tombol Pengaturan di kanan.
- Bottom navigation desktop berisi Ringkasan / Transaksi / Proyek, fixed-width, centered, dan tidak stretch.
- Transaksi desktop memakai layout judul + search/filter, tiga KPI, control bar, tombol Uang Masuk/Keluar, dan tabel besar.
- Proyek desktop memakai judul + search + Proyek Baru, tiga KPI project, daftar project kiri, dan panel Buat Project Baru kanan.
- Ringkasan desktop ditingkatkan keterbacaannya: font lebih besar, hero dan KPI lebih lega, panel kosong tidak terlalu pipih, dan tabel tetap proporsional.
- Tablet >=700px tetap memakai layout PC yang dikompres tanpa horizontal overflow.
- Mobile tetap memakai layout satu kolom dan bottom navigation tiga tab.
