# ANGGARAN v0.6.1

PWA offline-first untuk menyusun RAB proyek konstruksi dan mencatat realisasi pembelian/pengeluaran.

## Prinsip proyek
- Rp0: tidak ada API, database, framework, font, atau layanan berbayar.
- Data tersimpan lokal di IndexedDB perangkat.
- PWA bisa dipasang ke home screen ketika di-host via HTTPS.
- UI punya mode Otomatis / Mobile / PC. Tidak memakai dropdown HTML native untuk pilihan aplikasi.
- Multi-proyek ada di struktur sejak awal.

## Menjalankan lokal
Karena service worker dan module JS membutuhkan HTTP, jangan buka `index.html` langsung dari file explorer.

```bash
python3 -m http.server 8080
```

Lalu buka `http://localhost:8080`.

## Deploy gratis
Folder ini adalah static site. Bisa di-deploy apa adanya ke Vercel, GitHub Pages, Cloudflare Pages, atau static hosting lain yang menyediakan tier gratis. Tidak ada build command.

### Vercel
- Framework Preset: `Other`
- Build Command: kosong
- Output Directory: `.`

## Data
Store IndexedDB:
- `projects`
- `items`
- `realizations`
- `settings`

Nilai turunan seperti subtotal, sisa qty, sisa nominal, harga rata-rata aktual, dan selisih harga dihitung saat render dan tidak disimpan sebagai sumber data kedua.


## Backup & Restore
Pengaturan menyediakan backup data ke file JSON dan restore penuh dari file backup. Backup memuat proyek, item anggaran, dan realisasi. Preferensi UI seperti mode Mobile/PC tidak ikut dipindahkan karena sifatnya per perangkat.

## Input angka
Semua kolom angka bisnis diformat langsung dengan format Indonesia saat mengetik. Contoh: `1000` → `1.000`, `10000` → `10.000`. Qty pecahan menggunakan koma, misalnya `1,5`.


## v0.3
- Picker satuan custom bertema ANGGARAN, dengan pencarian, satuan populer, satuan yang pernah dipakai, dan opsi satuan sendiri.
- Date picker custom untuk tanggal proyek dan realisasi; tidak lagi memakai date picker bawaan browser.
- Dashboard membedakan Sisa Anggaran dengan Estimasi Kebutuhan Tersisa.
- Insight Bahan dan Upah ditampilkan terpisah.
- Kartu item menampilkan sisa anggaran, sisa qty, estimasi kebutuhan tersisa, dan selisih harga rata-rata.


## v0.4
- Alur Belanja Cepat: pilih/cari item → qty → harga aktual → simpan.
- Tombol tambah utama, dashboard, daftar item, dan halaman realisasi memakai alur cepat untuk transaksi baru.
- Item yang terakhir dipakai diprioritaskan di daftar Belanja Cepat.
- Setelah memilih item, aplikasi langsung memfokuskan Qty; Enter lanjut ke Harga dan Enter berikutnya menyimpan.
- Tanggal otomatis hari ini. Tanggal lain dan catatan tetap tersedia lewat bagian tambahan.
- Harga rencana ditampilkan sebagai referensi tetapi tidak otomatis disalin ke harga aktual.
- Total transaksi dihitung live sebelum disimpan.


## v0.5
- Tombol Back Android/browser menutup picker terlebih dahulu, lalu sheet utama, sebelum meninggalkan aplikasi.
- Overlay memakai Visual Viewport agar tinggi sheet mengikuti area layar yang tersisa saat keyboard terbuka.
- Background dikunci saat sheet terbuka agar halaman di belakang tidak ikut bergeser.
- Fokus input di dalam sheet digeser ke area terlihat ketika keyboard muncul.
- Validasi form memakai pesan bertema ANGGARAN, bukan popup validasi browser.
- Harga kosong tidak lagi dianggap Rp0; Rp0 tetap valid bila pengguna memang mengetik 0.
- Pengamanan tambahan untuk layar sangat sempit, teks panjang, dan overflow horizontal.


## v0.6
- Visual polish tanpa perubahan logika bisnis.
- Hierarki dashboard diperkuat untuk Rencana, Realisasi, Sisa Anggaran, Estimasi Kebutuhan, dan alert lewat batas.
- State over-budget dibuat lebih terlihat tanpa mengganggu pembacaan angka.
- Bottom navigation, sidebar PC, top bar, kartu, tombol, input, sheet, toast, dan empty state diselaraskan ke satu bahasa visual ANGGARAN.
- Micro-interaction hanya aktif bila perangkat mendukung hover/pointer yang sesuai dan tetap menghormati prefers-reduced-motion.
- Tampilan desktop menyesuaikan kepadatan kartu di lebar menengah agar tidak memaksa lima kartu terlalu sempit.
- Tidak ada font, CDN, gambar eksternal, framework UI, atau dependency baru.


## v0.6.1
- Tambah Item di dashboard memakai kartu berwarna hijau lembut, bukan putih.
- Tidak ada input yang otomatis difokuskan saat sheet, picker, atau Belanja Cepat dibuka. Keyboard baru muncul setelah pengguna menyentuh input.
- Kartu Item Dipilih di Belanja Cepat sekarang menjadi tombol penuh yang timbul, berwarna berbeda, dan bisa ditekan untuk membuka daftar item.
- Ikon navigasi memakai kotak optik tetap dan ikon Pengaturan digambar ulang tanpa transform yang menggeser pusat.
- Kartu informasi Penyimpanan di Pengaturan dihapus; fitur Backup Data tetap tersedia.
