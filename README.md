# ANGGARAN v0.1.1

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
