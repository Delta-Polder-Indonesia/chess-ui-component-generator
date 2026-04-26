# ♟ Chess Article Builder

Aplikasi web untuk membuat artikel panduan catur bergaya **Chess.com** secara visual — tanpa perlu menulis kode HTML manual. Drag-drop bidak, tambahkan highlight, panah, hint langkah, dan tabel nilai bidak. Output siap pakai dalam format HTML + ZIP.

![License](https://img.shields.io/badge/license-MIT-green)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript)
![Tailwind](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss)
![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite)

---

## ✨ Fitur

| Fitur | Deskripsi |
|-------|-----------|
| 🧩 **Drag & Drop Bidak** | Tarik bidak dari tray ke papan, pindahkan antar kotak |
| 🟨 **Highlight Kotak** | Klik kotak untuk menyorot dengan warna & opacity bebas |
| ➡️ **Panah Gerakan** | Gambar panah asal→tujuan untuk menjelaskan langkah |
| 💡 **Hint Langkah Legal** | Klik bidak untuk menampilkan semua langkah legal (pseudo-legal) |
| 🔄 **Flip Board** | Lihat papan dari sisi Putih atau Hitam |
| 🎨 **5 Tema Warna Papan** | Hijau, Biru, Coklat, Ungu, Abu-abu |
| 📝 **Markdown Formatting** | **bold**, *italic*, `code`, list di teks deskripsi |
| 📋 **FEN Import/Export** | Copy-paste posisi dari Chess.com / Lichess |
| 📊 **Tabel Nilai Bidak** | Editor spreadsheet untuk tabel perbandingan |
| 🏗️ **Multi-Section** | Buat artikel dengan banyak bagian, reorder dengan ↑↓ |
| 💾 **Auto-Save LocalStorage** | Data tersimpan otomatis, tidak hilang saat refresh |
| 📤 **Export HTML / ZIP / JSON** | Copy HTML, download ZIP project, atau export/import JSON |

---

## 🚀 Demo

Aplikasi ini dapat di-deploy ke **GitHub Pages**, **Vercel**, **Netlify**, atau platform static hosting lainnya.

---

## 🛠️ Tech Stack

- **Framework:** React 19 + TypeScript
- **Styling:** Tailwind CSS 4
- **Bundler:** Vite 7
- **Package Manager:** npm / pnpm
- **Additional:** JSZip (export ZIP)

---

## 📂 Struktur Folder

```bash
📁 chess-article-builder/
├──📁 .github/
│   └──📁 workflows/              # GitHub Actions (deploy ke GitHub Pages)
│       └──📄 deploy.yml
├──📁 node_modules/               # Dependencies
├──📁 public/                     # File statis
├──📁 src/                        # Source code utama
│   ├──📁 components/             # Komponen UI reusable
│   │   ├──📄 ArrowPolygonSVG.tsx # Render panah SVG
│   │   ├──📄 InteractiveBoard.tsx# Papan catur interaktif
│   │   └──📄 PieceTray.tsx       # Baki bidak (drag source)
│   ├──📁 utils/                  # Utilitas & helper
│   │   ├──📄 chess.ts            # Logika catur, FEN, konversi square
│   │   ├──📄 generator.ts        # Generator HTML/SVG output
│   │   └──📄 cn.ts               # Utility className (clsx + tailwind-merge)
│   ├──📄 App.tsx                 # Root component & state management
│   ├──📄 types.ts                # TypeScript types & interfaces
│   ├──📄 index.css               # Style global (Tailwind import)
│   └──📄 main.tsx                # Entry point React
├──📄 index.html                  # HTML entry
├──📄 package.json                # Dependencies & scripts
├──📄 tsconfig.json               # Konfigurasi TypeScript
├──📄 vite.config.ts              # Konfigurasi Vite
└──📄 README.md                   # Dokumentasi ini
```

### Penjelasan Folder

| Folder/File | Fungsi |
|-------------|--------|
| `src/components/` | Komponen React yang dapat digunakan ulang |
| `src/utils/chess.ts` | Semua logika catur: konversi square, gerakan legal, FEN parser/generator, tema papan |
| `src/utils/generator.ts` | Generator kode HTML & SVG yang di-export |
| `src/types.ts` | Definisi tipe TypeScript (Piece, SectionData, Arrow, dll) |
| `src/App.tsx` | State utama aplikasi, semua handler, dan layout |

---

## 📦 Instalasi

### 1. Clone repository

```bash
git clone https://github.com/Delta-Polder-Indonesia/chess-ui-component-generator.git
cd chess-article-builder
```

### 2. Install dependencies

```bash
npm install
# atau
pnpm install
```

### 3. Jalankan development server

```bash
npm run dev
```

Buka browser di `http://localhost:5173`

### 4. Build untuk produksi

```bash
npm run build
```

Output ada di folder `dist/`.

---

## 🎮 Cara Pakai

### Membuat Artikel

1. **Tambah Bagian** → klik tombol `+ Tambah` di kanan atas tab
2. **Isi Konten** →
   - **Judul** & **Deskripsi** → support Markdown (`**bold**`, *italic*, `- list`)
   - **Judul Teks** & **Isi Teks** → penjelasan gerakan / strategi
3. **Atur Papan** →
   - Mode **🧩 Bidak**: drag-drop dari tray ke papan
   - Mode **🟨 Highlight**: klik kotak untuk sorot
   - Mode **➡️ Panah**: klik asal → klik tujuan
   - Klik bidak → tampilkan hint langkah legal
   - Right-click bidak → hapus
4. **Pilih Layout** → Teks kiri/kanan, Tabel, atau tanpa panel
5. **Atur Tema** → klik swatch warna di atas papan (Hijau/Biru/Coklat/Ungu/Abu)
6. **Flip Board** → klik `⚪ Sisi Putih` / `⚫ Sisi Hitam`

### Export Hasil

| Tombol | Output |
|--------|--------|
| `📋 Copy Full HTML` | Copy kode HTML lengkap ke clipboard |
| `📦 Download ZIP` | Download project lengkap (HTML + SVG + JSON) |
| `💾 Export JSON` | Download data mentah sebagai JSON |
| `📁 Import JSON` | Muat kembali data dari file JSON |

### FEN (Forsyth-Edwards Notation)

- Klik `📋 FEN Import/Export` → paste FEN dari Chess.com/Lichess → `Terapkan FEN`
- Atau klik `📤 Copy FEN` untuk menyalin posisi saat ini

Contoh FEN posisi awal:
```
rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1
```

---

## 💾 Auto-Save (LocalStorage)

Data artikel Anda **tersimpan otomatis** di browser:

- ✅ Setiap perubahan langsung tersimpan
- ✅ Data dimuat otomatis saat buka aplikasi
- ✅ Tidak hilang saat refresh atau tutup tab
- ✅ Badge `💾 Tersimpan 15:30:45` menunjukkan waktu terakhir

> **Catatan:** Data tersimpan per-browser per-device. Untuk pindah device, gunakan **Export JSON**.

### Reset Data

Klik tombol `🔄 Reset` di header untuk menghapus semua data dan mulai dari awal (dengan konfirmasi).

---

## 🚀 Deploy ke GitHub Pages

### 1. Buat file `.github/workflows/deploy.yml`

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build -- --base=/${{ github.event.repository.name }}/

      - name: Setup Pages
        uses: actions/configure-pages@v4

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: './dist'

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

### 2. Aktifkan GitHub Pages

1. Buka **Settings** → **Pages** di repository GitHub
2. **Source**: GitHub Actions
3. Push ke branch `main` → deploy otomatis

### 3. Konfigurasi Vite

File `vite.config.ts` sudah disetel:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './', // Penting untuk GitHub Pages
})
```

---

## ⌨️ Tips & Trik

| Aksi | Cara |
|------|------|
| Pindah bidak | Drag ke kotak tujuan |
| Hapus bidak | Right-click pada bidak |
| Toggle highlight | Klik kotak (mode Highlight aktif) |
| Gambar panah | Klik asal → klik tujuan (mode Panah) |
| Lihat langkah legal | Klik bidak (mode Bidak) |
| Reorder section | Klik ↑ / ↓ di samping tab aktif |
| Scroll tab | Klik `‹` / `›` atau scroll mouse |

---

## 📝 Markdown Support

Teks deskripsi dan isi gerakan mendukung:

```markdown
**bold text**
*italic text*
***bold + italic***
`inline code`
__underlined__
- bullet list item
1. numbered list item
```

---

## 🧩 Tipe Data Utama

```typescript
// src/types.ts
interface SectionData {
  id: number;
  sectionNumber: string;
  sectionTitle: string;
  description: string;
  movementTitle: string;
  movementText: string;
  boardPlacement: "left" | "right";
  showPieceValueTable: boolean;
  showBoardPanel: boolean;
  tableColumnCount: number;
  tableRowCount: number;
  tableRowsText: string;
  pieces: Piece[];
  highlights: Highlight[];
  arrows: Arrow[];
  moveHints: string[];
  hintSourceSquare: string | null;
  boardFlipped: boolean;
  boardTheme: "green" | "blue" | "brown" | "purple" | "gray";
}
```

---

## 🤝 Kontribusi

Kontribusi sangat diterima! Silakan:

1. Fork repository
2. Buat branch fitur (`git checkout -b fitur-baru`)
3. Commit perubahan (`git commit -m 'Tambah fitur baru'`)
4. Push ke branch (`git push origin fitur-baru`)
5. Buat Pull Request

---

## 📄 Lisensi

[MIT](LICENSE) © 2025 Chess Article Builder

---

## 🙏 Terima Kasih

Dibuat dengan ❤️ untuk komunitas catur Indonesia.

> *"Pion adalah jiwa permainan catur."* — Philidor
