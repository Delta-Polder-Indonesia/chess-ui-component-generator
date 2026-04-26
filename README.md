# Frontend Folder Structure — Clean • Scalable • Maintainable

Struktur folder ini dirancang untuk menjaga proyek frontend tetap **rapi**, **mudah dipelihara**, dan **skalabel**. Dengan pembagian yang jelas, tim dapat berkolaborasi lebih efektif dan pengembangan fitur menjadi lebih cepat.

 
## 📂 Struktur Folder Proyek
```bash
frontend/
├──.github
│   └── workflows/               # Github Pages
├──📁 node_modules/              # Dependency hasil install npm/pnpm
├──📁 public/                    # File statis (favicon, index.html, dll) yang disajikan langsung
├──📁 src/                       # Source code utama aplikasi
│   ├──📁 assets/                # Gambar, ikon, font, dan aset statis
│   ├──📁 components/            # Komponen UI reusable (Button, Card, dll)
│   ├──📁 layout/                # Komponen tata letak (Header, Footer, Sidebar)
│   ├──📁 pages/                 # Halaman aplikasi dan routing (Home, About, dll)
│   ├──📁 features/              # Modul berbasis fitur (auth, dashboard, dll)
│   ├──📁 hooks/                 # Custom React hooks
│   ├──📁 context/               # Global state dengan React Context API
│   ├──📁 redux/                 # Store, slice, dan logic Redux
│   ├──📁 services/              # API calls dan integrasi eksternal
│   ├──📁 utils/                 # Fungsi helper dan utilitas umum
│   ├──📁 App.jsx                # Root component aplikasi
│   ├──📁 index.css              # Style global aplikasi
│   └──📁 main.jsx               # Entry point React, render ke DOM
├──📄 .eslintrc.json             # Konfigurasi ESLint untuk konsistensi kode
├──📄 .gitignore                 # File/folder yang diabaikan Git
├──📄 package.json               # Metadata project & daftar dependencies
├──📄 README.md                  # Dokumentasi proyek
└──📄 vite.config.js             # Konfigurasi Vite (bundler & dev server)
 ```
 
## 📁 Penjelasan Folder Github Pages
 ```bash
└──📁.github
    └──📁 workflows/                # Github Pages
        └──📄 deploy.yml            # </>
 ```
 ```bash
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
## 📄 Penjelasan file vite.config.js

```bash
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  base: './', // ⭐ PENTING: Untuk GitHub Pages
})
```
## 📄 Penjelasan .gitignore 

```bash
node_modules
dist
.DS_Store
.log
```
## 📁 Penjelasan Folder
- **public/** → File statis yang disajikan langsung (favicon, index.html, dll).
- **assets/** → Gambar, ikon, font, dan aset statis lainnya.
- **components/** → Komponen UI yang dapat digunakan ulang.
- **layout/** → Komponen tata letak (Header, Footer, Sidebar).
- **pages/** → Halaman aplikasi dan routing.
- **features/** → Modul berbasis fitur (misalnya auth, dashboard).
- **hooks/** → Custom React hooks.
- **context/** → Global state menggunakan React Context API.
- **redux/** → Store, slice, dan logic Redux.
- **services/** → API calls dan integrasi eksternal.
- **utils/** → Fungsi helper dan utilitas umum.

## ✅ Pro Tips

- **Easy to navigate** → Struktur jelas memudahkan pencarian file.
- **Feature scalability** → Mudah menambah fitur baru tanpa mengganggu yang lama.
- **Better maintainability** → Kode lebih terorganisir dan mudah dirawat.
- **Team friendly** → Mempermudah kolaborasi antar developer.



## 🚀 Cara Memulai

1. Install dependencies:
 ```bash
   npm install
  ```  
atau gunakan pnpm untuk performa lebih baik:
 ```bash
pnpm install
 ```
Jalankan development server:
 ```bash
npm run dev
 ```
Build untuk produksi:
 ```bash
npm run build
 ```
📌 Catatan
- Gunakan ESLint untuk menjaga konsistensi kode.

- Simpan konfigurasi di vite.config.js untuk build dan dev server.

- Tambahkan file yang tidak perlu di-track ke .gitignore.