import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import JSZip from "jszip";
import type { SectionData, PieceSide, PieceType, DragItem, BoardTheme } from "./types";
import {
  files, createStartingPosition, uid, parseTableGrid, resizeTableGrid, stringifyTableGrid,
  squareToCoordSVG, svgSqSize, lightSquarePositions, pieceSymbols, boardThemes,
  parseFEN, generateFEN, getPseudoLegalMoves,
} from "./utils/chess";
import { generateSVG, generateHintLayer, generateTableHtml, generateStandaloneSVG, escapeHtml, minifyHtml, parseMarkdownToHtml as genParseMarkdown, parseMarkdownToHtml } from "./utils/generator";
import PieceTray from "./components/PieceTray";
import InteractiveBoard from "./components/InteractiveBoard";
import ArrowPolygonSVG from "./components/ArrowPolygonSVG";

function createDefaultSection(id: number): SectionData {
  return {
    id,
    sectionNumber: String(id),
    sectionTitle: "Judul Bagian",
    description: "Deskripsi bagian ini...",
    movementTitle: "Gerakan:",
    movementText: "Gerakan pertama\nGerakan kedua",
    boardPlacement: "right",
    showPieceValueTable: false,
    showBoardPanel: true,
    tableColumnCount: 3,
    tableRowCount: 7,
    tableRowsText:
      "Bidak|Nilai|Perbandingan\n♟ Pion|1|Satuan dasar\n♞ Kuda|3|= 3 Pion\n♗ Gajah|3|= 3 Pion\n♖ Benteng|5|= 5 Pion\n♕ Ratu|9|= 9 Pion (terkuat)\n♔ Raja|∞|Tak ternilai",
    pieces: [],
    highlights: [],
    arrows: [],
    moveHints: [],
    hintSourceSquare: null,
    boardFlipped: false,
    boardTheme: "green",
  };
}

export default function App() {
  const [sections, setSections] = useState<SectionData[]>([{
    id: 1, sectionNumber: "1", sectionTitle: "PION (Pawn)",
    description: "Kunci Utama: Pion adalah jiwa permainan catur. Mereka menentukan karakter posisi, membatasi gerakan bidak lawan, dan seringkali menjadi faktor penentu dalam endgame.",
    movementTitle: "Gerakan:",
    movementText: "Maju 1 kotak ke depan\nLangkah PERTAMA boleh maju 2 kotak\nMakan secara DIAGONAL (serong 1 kotak ke depan)",
    boardPlacement: "right", showPieceValueTable: false, showBoardPanel: true,
    tableColumnCount: 3, tableRowCount: 7,
    tableRowsText: "Bidak|Nilai|Perbandingan\n♟ Pion|1|Satuan dasar\n♞ Kuda|3|= 3 Pion\n♗ Gajah|3|= 3 Pion\n♖ Benteng|5|= 5 Pion\n♕ Ratu|9|= 9 Pion (terkuat)\n♔ Raja|∞|Tak ternilai",
    pieces: createStartingPosition(),
    highlights: [
      ...files.map(f => ({ id: uid(), square: `${f}7`, color: "#facc15", opacity: 0.45 })),
      ...files.map(f => ({ id: uid(), square: `${f}2`, color: "#facc15", opacity: 0.45 })),
    ],
    arrows: [], moveHints: [], hintSourceSquare: null,
    boardFlipped: false, boardTheme: "green",
  }]);

  const [activeSectionId, setActiveSectionId] = useState(1);
  const [dragItem, setDragItem] = useState<DragItem | null>(null);
  const [outputMode, setOutputMode] = useState<"pretty" | "minified">("pretty");
  const [previewCodeView, setPreviewCodeView] = useState<"split" | "preview" | "code">("split");
  const [statusMessage, setStatusMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [fenInput, setFenInput] = useState("");
  const [showFenInput, setShowFenInput] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [rcHighlightColor, setRcHighlightColor] = useState("#ef4444");
  const [rcArrowColor, setRcArrowColor] = useState("#ef4444");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tabsScrollRef = useRef<HTMLDivElement>(null);

  // ─── LocalStorage: Load on mount ─────────────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem("chess-article-data");
      if (raw) {
        const data = JSON.parse(raw);
        if (Array.isArray(data.sections) && data.sections.length > 0) {
          const migrated = data.sections.map((s: SectionData, i: number) => ({
            ...createDefaultSection(s.id),
            ...s,
            sectionNumber: String(i + 1),
            boardFlipped: s.boardFlipped ?? false,
            boardTheme: (s.boardTheme as BoardTheme) || "green",
            moveHints: [],
            hintSourceSquare: null,
          }));
          setSections(migrated);
          setActiveSectionId(data.activeSectionId ?? migrated[0]?.id ?? 1);
          setLastSaved(data.savedAt ? new Date(data.savedAt).toLocaleString("id-ID") : null);
          setStatusMessage("Data dimuat dari penyimpanan lokal");
        }
      }
    } catch {
      // ignore corrupt localStorage
    }
  }, []);

  // ─── LocalStorage: Auto-save ─────────────────────────────────────────
  useEffect(() => {
    const payload = {
      sections,
      activeSectionId,
      savedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem("chess-article-data", JSON.stringify(payload));
      setLastSaved(new Date().toLocaleString("id-ID"));
    } catch {
      // storage full or disabled
    }
  }, [sections, activeSectionId]);

  const resetToDefault = useCallback(() => {
    if (!confirm("Yakin hapus semua data dan mulai dari awal?")) return;
    const fresh = [{
      id: 1, sectionNumber: "1", sectionTitle: "PION (Pawn)",
      description: "Kunci Utama: Pion adalah jiwa permainan catur. Mereka menentukan karakter posisi, membatasi gerakan bidak lawan, dan seringkali menjadi faktor penentu dalam endgame.",
      movementTitle: "Gerakan:",
      movementText: "Maju 1 kotak ke depan\nLangkah PERTAMA boleh maju 2 kotak\nMakan secara DIAGONAL (serong 1 kotak ke depan)",
      boardPlacement: "right" as const, showPieceValueTable: false, showBoardPanel: true,
      tableColumnCount: 3, tableRowCount: 7,
      tableRowsText: "Bidak|Nilai|Perbandingan\n♟ Pion|1|Satuan dasar\n♞ Kuda|3|= 3 Pion\n♗ Gajah|3|= 3 Pion\n♖ Benteng|5|= 5 Pion\n♕ Ratu|9|= 9 Pion (terkuat)\n♔ Raja|∞|Tak ternilai",
      pieces: createStartingPosition(),
      highlights: [
        ...files.map(f => ({ id: uid(), square: `${f}7`, color: "#facc15", opacity: 0.45 })),
        ...files.map(f => ({ id: uid(), square: `${f}2`, color: "#facc15", opacity: 0.45 })),
      ],
      arrows: [], moveHints: [], hintSourceSquare: null,
      boardFlipped: false, boardTheme: "green" as BoardTheme,
    }];
    setSections(fresh);
    setActiveSectionId(1);
    localStorage.removeItem("chess-article-data");
    setLastSaved(null);
    setStatusMessage("Data direset ke default");
  }, []);

  const activeSection = sections.find(s => s.id === activeSectionId) ?? sections[0];

  useEffect(() => {
    if (!statusMessage) return;
    const t = setTimeout(() => setStatusMessage(""), 3000);
    return () => clearTimeout(t);
  }, [statusMessage]);

  const updateSection = useCallback((id: number, updates: Partial<SectionData>) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  }, []);

  const addSection = useCallback(() => {
    const newId = uid();
    const ns = createDefaultSection(newId);
    ns.sectionNumber = String(sections.length + 1);
    setSections(prev => [...prev, ns]);
    setActiveSectionId(newId);
    setStatusMessage("Bagian baru ditambahkan");
  }, [sections.length]);

  const removeSection = useCallback((id: number) => {
    if (sections.length <= 1) { setStatusMessage("Minimal 1 bagian"); return; }
    const remaining = sections.filter(s => s.id !== id);
    setSections(remaining);
    if (activeSectionId === id) setActiveSectionId(remaining[0].id);
    setStatusMessage("Bagian dihapus");
    setShowDeleteConfirm(false);
  }, [sections, activeSectionId]);

  const duplicateSection = useCallback((id: number) => {
    const src = sections.find(s => s.id === id);
    if (!src) return;
    const newId = uid();
    setSections(prev => [...prev, {
      ...src, id: newId, sectionNumber: String(sections.length + 1),
      pieces: src.pieces.map(p => ({ ...p, id: uid() })),
      highlights: src.highlights.map(h => ({ ...h, id: uid() })),
      arrows: src.arrows.map(a => ({ ...a, id: uid() })),
      moveHints: [], hintSourceSquare: null,
    }]);
    setActiveSectionId(newId);
    setStatusMessage("Bagian diduplikasi");
  }, [sections]);

  const moveSection = useCallback((id: number, direction: "up" | "down") => {
    const idx = sections.findIndex(s => s.id === id);
    if (idx < 0) return;
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === sections.length - 1) return;
    const newSections = [...sections];
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    [newSections[idx], newSections[swapIdx]] = [newSections[swapIdx], newSections[idx]];
    // Re-number sections to match new order
    const renumbered = newSections.map((s, i) => ({ ...s, sectionNumber: String(i + 1) }));
    setSections(renumbered);
  }, [sections]);

  const handlePieceDrop = useCallback((side: PieceSide, type: PieceType, square: string) => {
    const prev = activeSection.pieces;
    const idx = prev.findIndex(p => p.square === square);
    const next = idx >= 0 ? prev.map((p, i) => i === idx ? { ...p, side, type } : p) : [...prev, { id: uid(), square, side, type }];
    updateSection(activeSectionId, { pieces: next, moveHints: [], hintSourceSquare: null });
    setStatusMessage(`${side} ${type} → ${square}`);
  }, [activeSection, activeSectionId, updateSection]);

  const handlePieceMove = useCallback((pieceId: number, newSquare: string) => {
    updateSection(activeSectionId, {
      pieces: activeSection.pieces.filter(p => p.square !== newSquare || p.id === pieceId).map(p => p.id === pieceId ? { ...p, square: newSquare } : p),
      moveHints: [], hintSourceSquare: null,
    });
    setStatusMessage(`Bidak → ${newSquare}`);
  }, [activeSection, activeSectionId, updateSection]);

  const handlePieceRemove = useCallback((pieceId: number) => {
    const removed = activeSection.pieces.find(p => p.id === pieceId);
    const wasSource = removed?.square === activeSection.hintSourceSquare;
    updateSection(activeSectionId, {
      pieces: activeSection.pieces.filter(p => p.id !== pieceId),
      moveHints: wasSource ? [] : activeSection.moveHints,
      hintSourceSquare: wasSource ? null : activeSection.hintSourceSquare,
    });
    setStatusMessage("Bidak dihapus");
  }, [activeSection, activeSectionId, updateSection]);

  const handleHighlightToggle = useCallback((square: string, color: string, opacity: number) => {
    const prev = activeSection.highlights;
    const idx = prev.findIndex(h => h.square === square);
    updateSection(activeSectionId, {
      highlights: idx >= 0 ? prev.filter((_, i) => i !== idx) : [...prev, { id: uid(), square, color, opacity }],
    });
  }, [activeSection, activeSectionId, updateSection]);

  const handleArrowDraw = useCallback((from: string, to: string, color: string, opacity: number) => {
    const prev = activeSection.arrows;
    const idx = prev.findIndex(a => a.from === from && a.to === to);
    updateSection(activeSectionId, {
      arrows: idx >= 0 ? prev.filter((_, i) => i !== idx) : [...prev, { id: uid(), from, to, color, opacity }],
    });
  }, [activeSection, activeSectionId, updateSection]);

  const handlePieceHint = useCallback((square: string) => {
    const sel = activeSection.pieces.find(p => p.square === square);
    if (!sel) { updateSection(activeSectionId, { moveHints: [], hintSourceSquare: null }); return; }
    if (activeSection.hintSourceSquare === square) { updateSection(activeSectionId, { moveHints: [], hintSourceSquare: null }); return; }
    const hints = getPseudoLegalMoves(sel, activeSection.pieces);
    updateSection(activeSectionId, { moveHints: hints, hintSourceSquare: square });
    setStatusMessage(`${sel.type} ${sel.square}: ${hints.length} langkah`);
  }, [activeSection, activeSectionId, updateSection]);

  const applyFEN = useCallback(() => {
    const parsed = parseFEN(fenInput);
    if (!parsed) { setStatusMessage("FEN tidak valid"); return; }
    updateSection(activeSectionId, { pieces: parsed, moveHints: [], hintSourceSquare: null });
    setStatusMessage(`FEN diterapkan: ${parsed.length} bidak`);
    setShowFenInput(false);
    setFenInput("");
  }, [fenInput, activeSectionId, updateSection]);

  const copyFEN = useCallback(() => {
    const fen = generateFEN(activeSection.pieces);
    navigator.clipboard.writeText(fen).then(() => {
      setStatusMessage("FEN disalin ke clipboard");
    }).catch(() => setStatusMessage("Gagal menyalin FEN"));
  }, [activeSection.pieces]);

  // Code generation
  const generatedCode = useMemo(() => {
    const blocks = sections.map(sec => {
      const movHtml = genParseMarkdown(sec.movementText);
      const descHtml = genParseMarkdown(sec.description);
      const flex = sec.boardPlacement === "left" ? "md:flex-row-reverse" : "md:flex-row";
      let panel = "";
      if (sec.showBoardPanel) {
        if (sec.showPieceValueTable) {
          panel = `                <div class="board-panel table-panel">\n${generateTableHtml(sec)}\n                </div>`;
        } else {
          const svg = generateSVG(sec);
          const hints = generateHintLayer(sec);
          panel = [`                <div class="board-panel relative">`, svg, hints, `                </div>`].filter(s => s.trim()).join("\n");
        }
      }
      return [
        ``, `            <!-- Section ${escapeHtml(sec.sectionNumber)} -->`,
        `            <div class="section-block">`,
        `                <div class="flex items-center gap-4 mb-4">`,
        `                    <span class="section-number text-3xl">${escapeHtml(sec.sectionNumber)}</span>`,
        `                    <h3 class="text-2xl font-extrabold text-chess-green uppercase leading-tight">${escapeHtml(sec.sectionTitle)}</h3>`,
        `                </div>`,
        `                <p class="text-gray-600 mb-6 leading-snug">${descHtml}</p>`,
        `                <div class="flex flex-col gap-6 ${flex} items-start">`,
        `                    <div class="flex-1 min-w-0">`,
        `                        <h3 class="text-xl font-extrabold text-chess-green uppercase mb-3 leading-tight">${escapeHtml(sec.movementTitle)}</h3>`,
        `                        <p class="text-gray-600 leading-relaxed text-sm">${movHtml}</p>`,
        `                    </div>`,
        panel,
        `                </div>`,
        `            </div>`,
      ].join("\n");
    }).join("\n");

    return [
      `<!DOCTYPE html>`,
      `<html lang="id">`,
      `<head>`,
      `    <meta charset="UTF-8">`,
      `    <meta name="viewport" content="width=device-width, initial-scale=1.0">`,
      `    <title>Panduan Mudah Bermain Catur</title>`,
      `    <script src="https://cdn.tailwindcss.com"><\/script>`,
      `    <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;800&display=swap" rel="stylesheet">`,
      `    <style>`,
      `        body { font-family: 'Nunito', sans-serif; background-color: #f1f1f1; color: #312e2b; }`,
      `        .header-bg { background-color: #81b64c; }`,
      `        .section-number { background-color: #81b64c; color: white; padding: 2px 10px; border-radius: 4px; font-weight: 800; display: inline-block; }`,
      `        .text-chess-green { color: #81b64c; }`,
      `        .section-block { margin-bottom: 2.5rem; padding-bottom: 2rem; border-bottom: 1px solid #e5e7eb; }`,
      `        .section-block:last-child { border-bottom: none; margin-bottom: 0; }`,
      `        .board-panel { width: 220px; height: 220px; flex-shrink: 0; position: relative; }`,
      `        .table-panel { width: auto; min-width: 200px; max-width: 260px; height: auto; flex-shrink: 0; }`,
      `        .hint-layer { position: absolute; inset: 0; pointer-events: none; }`,
      `        .hint { position: absolute; width: 14px; height: 14px; border-radius: 9999px; transform: translate(-50%, -50%); background: rgba(0,0,0,0.3); }`,
      `    </style>`,
      `</head>`,
      `<body class="p-0 m-0">`,
      `    <div class="max-w-4xl mx-auto bg-white shadow-xl min-h-screen">`,
      `        <header class="header-bg p-6 flex justify-between items-center text-white">`,
      `            <div class="flex items-center gap-2">`,
      `                <svg viewBox="0 0 100 100" class="w-12 h-12 fill-current"><path d="M50 10c-15 0-20 10-20 15 0 10 5 15 5 25H30v10h40V50h-5c0-10 5-15 5-25 0-5-5-15-20-15z"/><path d="M25 75h50v5H25zM20 85h60v5H20z"/></svg>`,
      `                <h1 class="text-4xl font-extrabold tracking-tighter">Chess<span class="font-normal text-3xl">.com</span></h1>`,
      `            </div>`,
      `            <div class="text-right">`,
      `                <p class="text-xl font-bold uppercase tracking-widest leading-none">Panduan Mudah</p>`,
      `                <p class="text-5xl font-extrabold uppercase leading-none mt-1">Bermain Catur</p>`,
      `            </div>`,
      `        </header>`,
      `        <main class="p-8">`,
      blocks,
      `        </main>`,
      `    </div>`,
      `</body>`,
      `</html>`,
    ].join("\n");
  }, [sections]);

  const outputCode = useMemo(() => outputMode === "minified" ? minifyHtml(generatedCode) : generatedCode, [generatedCode, outputMode]);

  const editorTableGrid = useMemo(
    () => resizeTableGrid(parseTableGrid(activeSection.tableRowsText), activeSection.tableRowCount, activeSection.tableColumnCount),
    [activeSection.tableColumnCount, activeSection.tableRowCount, activeSection.tableRowsText]
  );

  const updateTableShape = useCallback((nextRows: number, nextCols: number) => {
    const r = Math.max(1, nextRows), c = Math.max(1, nextCols);
    updateSection(activeSectionId, { tableRowCount: r, tableColumnCount: c, tableRowsText: stringifyTableGrid(resizeTableGrid(editorTableGrid, r, c)) });
  }, [activeSectionId, editorTableGrid, updateSection]);

  const updateTableCell = useCallback((ri: number, ci: number, val: string) => {
    updateSection(activeSectionId, {
      tableRowsText: stringifyTableGrid(editorTableGrid.map((row, r) => row.map((cell, c) => r === ri && c === ci ? val : cell))),
    });
  }, [activeSectionId, editorTableGrid, updateSection]);

  const copyCode = useCallback(async () => {
    try { await navigator.clipboard.writeText(outputCode); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { setStatusMessage("Gagal menyalin"); }
  }, [outputCode]);

  const downloadZipProject = useCallback(async () => {
    setIsZipping(true);
    try {
      const zip = new JSZip();
      const root = zip.folder("chess-article-project")!;
      root.file("index.html", generatedCode);
      const svgs = root.folder("boards");
      sections.forEach(sec => {
        if (sec.showBoardPanel && !sec.showPieceValueTable)
          svgs?.file(`board-section-${sec.sectionNumber}.svg`, generateStandaloneSVG(sec));
      });
      root.file("package.json", JSON.stringify({ name: "chess-article", private: true, version: "1.0.0", type: "module", scripts: { dev: "vite", build: "vite build" }, dependencies: { react: "^19.0.0", "react-dom": "^19.0.0" }, devDependencies: { typescript: "^5.0.0", vite: "^6.0.0", "@vitejs/plugin-react": "^4.0.0", tailwindcss: "^4.0.0", "@tailwindcss/vite": "^4.0.0" } }, null, 2));
      root.file(".gitignore", "node_modules\ndist\n.DS_Store\n");
      root.file("README.md", `# Chess Article\n\nGenerated ${sections.length} section(s).\n\n\`\`\`bash\nnpm install && npm run dev\n\`\`\``);
      root.file("article-data.json", JSON.stringify({ exportedAt: new Date().toISOString(), sections: sections.map(s => ({ ...s, moveHints: [], hintSourceSquare: null })) }, null, 2));
      const blob = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "chess-article-project.zip";
      link.click();
      URL.revokeObjectURL(link.href);
      setStatusMessage("ZIP berhasil di-download!");
    } catch (err) {
      setStatusMessage(`Gagal ZIP: ${err instanceof Error ? err.message : "Error"}`);
    } finally { setIsZipping(false); }
  }, [generatedCode, sections]);

  const exportJSON = useCallback(() => {
    const data = JSON.stringify({ exportedAt: new Date().toISOString(), sections }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "chess-article-data.json";
    link.click();
    URL.revokeObjectURL(link.href);
    setStatusMessage("JSON berhasil di-export");
  }, [sections]);

  const downloadWord = useCallback(() => {
    try {
      const wordHtml = `
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<title>Panduan Catur</title>
<style>
body { font-family: 'Nunito', sans-serif; background-color: #f1f1f1; color: #312e2b; }
.header-bg { background-color: #81b64c; }
.section-number { background-color: #81b64c; color: white; padding: 2px 10px; border-radius: 4px; font-weight: 800; display: inline-block; }
.text-chess-green { color: #81b64c; }
.section-block { margin-bottom: 2.5rem; padding-bottom: 2rem; border-bottom: 1px solid #e5e7eb; }
.section-block:last-child { border-bottom: none; margin-bottom: 0; }
.board-panel { width: 220px; height: 220px; flex-shrink: 0; position: relative; }
.table-panel { width: auto; min-width: 200px; max-width: 260px; height: auto; flex-shrink: 0; }
.hint-layer { position: absolute; inset: 0; pointer-events: none; }
.hint { position: absolute; width: 14px; height: 14px; border-radius: 9999px; transform: translate(-50%, -50%); background: rgba(0,0,0,0.3); }
table { border-collapse: collapse; }
th, td { border: 1px solid #d1d5db; padding: 8px 12px; text-align: left; }
thead { background-color: #f3f4f6; }
</style>
</head>
<body>
${generatedCode.replace(/<!DOCTYPE html>[\s\S]*?<body[^>]*>/i, "").replace(/<\/body>[\s\S]*?<\/html>/i, "")}
</body>
</html>`;
      const blob = new Blob([wordHtml], { type: "application/msword" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "artikel-catur.doc";
      link.click();
      URL.revokeObjectURL(link.href);
      setStatusMessage("File Word berhasil di-download! Buka di Microsoft Word.");
    } catch (err) {
      setStatusMessage("Gagal membuat file Word: " + (err instanceof Error ? err.message : "Error"));
    }
  }, [generatedCode]);

  const importJSON = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        if (!text || !text.trim()) {
          setStatusMessage("File JSON kosong");
          return;
        }
        const data = JSON.parse(text);
        if (!Array.isArray(data.sections) || data.sections.length === 0) {
          setStatusMessage("Format JSON tidak valid: sections tidak ditemukan");
          return;
        }
        const migrated: SectionData[] = data.sections.map((s: Partial<SectionData>, i: number) => {
          const base = createDefaultSection(s.id ?? uid());
          return {
            ...base,
            ...s,
            id: s.id ?? base.id,
            sectionNumber: String(i + 1),
            sectionTitle: s.sectionTitle ?? base.sectionTitle,
            description: s.description ?? base.description,
            movementTitle: s.movementTitle ?? base.movementTitle,
            movementText: s.movementText ?? base.movementText,
            boardPlacement: s.boardPlacement ?? base.boardPlacement,
            showPieceValueTable: s.showPieceValueTable ?? base.showPieceValueTable,
            showBoardPanel: s.showBoardPanel ?? base.showBoardPanel,
            tableColumnCount: s.tableColumnCount ?? base.tableColumnCount,
            tableRowCount: s.tableRowCount ?? base.tableRowCount,
            tableRowsText: s.tableRowsText ?? base.tableRowsText,
            pieces: Array.isArray(s.pieces) ? s.pieces : base.pieces,
            highlights: Array.isArray(s.highlights) ? s.highlights : base.highlights,
            arrows: Array.isArray(s.arrows) ? s.arrows : base.arrows,
            moveHints: [],
            hintSourceSquare: null,
            boardFlipped: s.boardFlipped ?? false,
            boardTheme: (s.boardTheme as BoardTheme) || "green",
          };
        });
        setSections(migrated);
        setActiveSectionId(migrated[0].id);
        setStatusMessage(`Data berhasil di-import: ${migrated.length} bagian`);
      } catch (err) {
        console.error("Import JSON error:", err);
        setStatusMessage("Gagal memparse JSON: " + (err instanceof Error ? err.message : "Error tidak diketahui"));
      }
    };
    reader.onerror = () => {
      setStatusMessage("Gagal membaca file");
    };
    reader.readAsText(file);
  }, []);

  // Preview helpers
  const renderPreviewSection = (sec: SectionData) => {
    const grid = resizeTableGrid(parseTableGrid(sec.tableRowsText), sec.tableRowCount, sec.tableColumnCount);
    const theme = boardThemes[sec.boardTheme] ?? boardThemes.green;
    return (
      <div key={sec.id} className="mb-8 border-b border-gray-200 pb-6 last:border-0 last:pb-0 last:mb-0">
        <div className="mb-3 flex items-center gap-3">
          <span className="rounded bg-[#81b64c] px-2.5 py-0.5 text-2xl font-extrabold text-white">{sec.sectionNumber}</span>
          <h3 className="text-xl font-extrabold uppercase leading-tight" style={{ color: "#81b64c" }}>{sec.sectionTitle}</h3>
        </div>
        <p className="mb-4 text-sm leading-snug text-gray-600" dangerouslySetInnerHTML={{ __html: parseMarkdownToHtml(sec.description) }} />
        <div className={`flex flex-col gap-6 ${sec.boardPlacement === "left" ? "md:flex-row-reverse" : "md:flex-row"} items-start`}>
          <div className="min-w-0 flex-1">
            <h4 className="mb-2 text-lg font-extrabold uppercase leading-tight" style={{ color: "#81b64c" }}>{sec.movementTitle}</h4>
            <div className="text-sm leading-relaxed text-gray-600" dangerouslySetInnerHTML={{ __html: parseMarkdownToHtml(sec.movementText) }} />
          </div>
          {sec.showBoardPanel && (
            sec.showPieceValueTable ? (
              <div className="shrink-0" style={{ width: 'auto', minWidth: 200, maxWidth: 260 }}>
                <table className="w-full border border-gray-300 text-left text-xs text-gray-700">
                  <thead className="bg-gray-100">
                    <tr>{(grid[0] ?? []).map((h, i) => <th key={i} className="border border-gray-300 px-2 py-1.5">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {grid.slice(1).map((row, ri) => (
                      <tr key={ri}>{row.map((cell, ci) => <td key={ci} className="border border-gray-300 px-2 py-1.5">{cell}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="relative shrink-0" style={{ width: 220, height: 220 }}>
                <svg viewBox="0 0 200 200" className="h-full w-full">
                  <rect width={200} height={200} fill={theme.dark} />
                  <g fill={theme.light}>{lightSquarePositions.map(sq => <rect key={`${sq.x}-${sq.y}`} width={svgSqSize} height={svgSqSize} x={sq.x} y={sq.y} />)}</g>
                  {sec.highlights.map(h => { const c = squareToCoordSVG(h.square, sec.boardFlipped); return <rect key={h.id} x={c.x} y={c.y} width={svgSqSize} height={svgSqSize} fill={h.color} fillOpacity={h.opacity} />; })}
                  {sec.pieces.map(p => { const c = squareToCoordSVG(p.square, sec.boardFlipped); return <text key={p.id} x={c.centerX} y={c.centerY} fontSize="20" fill={p.side === "white" ? "white" : "black"} textAnchor="middle" dominantBaseline="central">{pieceSymbols[p.side][p.type]}</text>; })}
                  {sec.arrows.map(a => <ArrowPolygonSVG key={a.id} arrow={a} idPrefix={`pv-${sec.id}`} flipped={sec.boardFlipped} />)}
                </svg>
                <div className="pointer-events-none absolute inset-0">
                  {sec.moveHints.map(sq => {
                    const pos = { left: `${((squareToCoordSVG(sq, sec.boardFlipped).x / svgSqSize + 0.5) / 8) * 100}%`, top: `${((squareToCoordSVG(sq, sec.boardFlipped).y / svgSqSize + 0.5) / 8) * 100}%` };
                    const cap = sec.pieces.some(p => p.square === sq);
                    return <div key={`pvh-${sec.id}-${sq}`} className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full ${cap ? "border-[3px] border-black/30 bg-transparent" : "bg-black/30"}`} style={{ left: pos.left, top: pos.top, width: cap ? 22 : 10, height: cap ? 22 : 10 }} />;
                  })}
                </div>
              </div>
            )
          )}
        </div>
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-stone-100 px-3 py-6 text-slate-900 md:px-6">
      <div className="mx-auto w-full max-w-7xl space-y-5">
        {/* Header */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tight text-[#2f5f2a] md:text-4xl">♟ Chess Article Builder</h1>
            <p className="mt-1 max-w-2xl text-xs text-slate-500 md:text-sm">
              Buat artikel catur bergaya Chess.com — drag-drop, highlight, panah, hint langkah, tabel. Output HTML + ZIP.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {lastSaved && (
              <span className="shrink-0 rounded bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-600">
                💾 Tersimpan {lastSaved}
              </span>
            )}
            <button onClick={resetToDefault}
              className="shrink-0 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-500 shadow-sm transition hover:bg-red-100">
              🔄 Reset
            </button>
            <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) importJSON(f); e.target.value = ""; }} />
            <button onClick={() => fileInputRef.current?.click()}
              className="shrink-0 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-stone-50">
              📁 Import JSON
            </button>
            <button onClick={exportJSON}
              className="shrink-0 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-stone-50">
              💾 Export JSON
            </button>
            <button onClick={downloadZipProject} disabled={isZipping}
              className="shrink-0 rounded-lg bg-slate-800 px-4 py-2 text-sm font-bold text-white shadow transition hover:bg-slate-700 disabled:opacity-60">
              {isZipping ? "⏳ Membuat ZIP..." : "📦 Download ZIP"}
            </button>
            <button onClick={copyCode}
              className={`shrink-0 rounded-lg px-4 py-2 text-sm font-bold text-white shadow transition ${copied ? "bg-emerald-600" : "bg-[#81b64c] hover:bg-[#6da03d]"}`}>
              {copied ? "✓ Tersalin!" : "📋 Copy Full HTML"}
            </button>
            <button onClick={downloadWord}
              className="shrink-0 rounded-lg border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700 shadow-sm transition hover:bg-blue-100">
              📝 Download Word
            </button>
          </div>
        </header>

        {/* Section Tabs */}
        <div className="flex items-center gap-2 rounded-lg border border-stone-300 bg-white p-2.5 shadow-sm">
          <span className="shrink-0 text-xs font-bold uppercase text-slate-400">Bagian:</span>
          <button
            onClick={() => tabsScrollRef.current?.scrollBy({ left: -200, behavior: "smooth" })}
            className="shrink-0 rounded bg-stone-100 px-1.5 py-1 text-xs font-bold text-slate-500 hover:bg-stone-200 transition"
            title="Scroll kiri"
          >
            ‹
          </button>
          <div
            ref={tabsScrollRef}
            className="flex flex-1 items-center gap-2 overflow-x-auto py-0.5 scrollbar-thin"
            style={{ scrollbarWidth: "thin", scrollbarColor: "#d6d3d1 transparent" }}
          >
            {sections.map((sec, idx) => (
              <div key={sec.id} className="flex shrink-0 items-center gap-0.5">
                <button onClick={() => setActiveSectionId(sec.id)}
                  className={`rounded px-3 py-1.5 text-xs font-bold transition whitespace-nowrap ${activeSectionId === sec.id ? "bg-[#81b64c] text-white shadow" : "bg-stone-100 text-slate-600 hover:bg-stone-200"}`}>
                  {sec.sectionNumber}. {sec.sectionTitle.substring(0, 18)}{sec.sectionTitle.length > 18 ? "…" : ""}
                </button>
                {activeSectionId === sec.id && sections.length > 1 && (
                  <>
                    <button onClick={() => moveSection(sec.id, "up")} disabled={idx === 0} className="rounded bg-stone-100 px-1 py-1 text-[10px] text-slate-500 hover:bg-stone-200 disabled:opacity-30" title="Naik">↑</button>
                    <button onClick={() => moveSection(sec.id, "down")} disabled={idx === sections.length - 1} className="rounded bg-stone-100 px-1 py-1 text-[10px] text-slate-500 hover:bg-stone-200 disabled:opacity-30" title="Turun">↓</button>
                  </>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={() => tabsScrollRef.current?.scrollBy({ left: 200, behavior: "smooth" })}
            className="shrink-0 rounded bg-stone-100 px-1.5 py-1 text-xs font-bold text-slate-500 hover:bg-stone-200 transition"
            title="Scroll kanan"
          >
            ›
          </button>
          <button onClick={addSection}
            className="shrink-0 rounded border border-dashed border-[#81b64c] bg-green-50 px-3 py-1.5 text-xs font-bold text-[#81b64c] transition hover:bg-green-100 whitespace-nowrap">
            + Tambah
          </button>
        </div>

        {/* Editor + Board */}
        <section className="grid gap-5 lg:grid-cols-[1fr_auto]">
          {/* Editor */}
          <div className="space-y-3 rounded-lg border border-stone-300 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">Editor — Bagian {activeSection.sectionNumber}</h2>
              <div className="flex gap-1.5">
                <button onClick={() => duplicateSection(activeSectionId)} className="rounded bg-stone-100 px-2 py-1 text-[10px] font-semibold text-slate-500 hover:bg-stone-200">⧉ Duplikasi</button>
                <button onClick={() => setShowDeleteConfirm(true)} className="rounded bg-red-50 px-2 py-1 text-[10px] font-semibold text-red-500 hover:bg-red-100">🗑 Hapus</button>
              </div>
            </div>

            {showDeleteConfirm && (
              <div className="rounded border border-red-200 bg-red-50 p-2.5 text-[11px]">
                <p className="mb-1.5 font-medium text-red-700">Yakin hapus bagian <strong>{activeSection.sectionTitle}</strong>?</p>
                <div className="flex gap-2">
                  <button onClick={() => removeSection(activeSectionId)} className="rounded bg-red-500 px-2 py-1 text-[10px] font-bold text-white hover:bg-red-600">Ya, Hapus</button>
                  <button onClick={() => setShowDeleteConfirm(false)} className="rounded border border-red-200 px-2 py-1 text-[10px] font-bold text-red-500 hover:bg-red-100">Batal</button>
                </div>
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-[11px] font-bold text-slate-500">Nomor</span>
                <input value={activeSection.sectionNumber} onChange={e => updateSection(activeSectionId, { sectionNumber: e.target.value })}
                  className="w-full rounded border border-stone-300 px-2.5 py-1.5 text-sm outline-none focus:border-[#81b64c]" />
              </label>
              <label className="block space-y-1">
                <span className="text-[11px] font-bold text-slate-500">Judul</span>
                <input value={activeSection.sectionTitle} onChange={e => updateSection(activeSectionId, { sectionTitle: e.target.value })}
                  className="w-full rounded border border-stone-300 px-2.5 py-1.5 text-sm outline-none focus:border-[#81b64c]" />
              </label>
            </div>

            <label className="block space-y-1">
              <span className="text-[11px] font-bold text-slate-500">Deskripsi <span className="font-normal text-slate-400">(**bold**, *italic*, `code`, - list)</span></span>
              <textarea value={activeSection.description} onChange={e => updateSection(activeSectionId, { description: e.target.value })}
                rows={3} className="w-full rounded border border-stone-300 px-2.5 py-1.5 text-sm outline-none focus:border-[#81b64c]" />
            </label>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-[11px] font-bold text-slate-500">Judul Teks</span>
                <input value={activeSection.movementTitle} onChange={e => updateSection(activeSectionId, { movementTitle: e.target.value })}
                  className="w-full rounded border border-stone-300 px-2.5 py-1.5 text-sm outline-none focus:border-[#81b64c]" />
              </label>
              <label className="block space-y-1">
                <span className="text-[11px] font-bold text-slate-500">Layout Panel</span>
                <select
                  value={!activeSection.showBoardPanel ? "text-only" : activeSection.showPieceValueTable ? (activeSection.boardPlacement === "left" ? "table-left" : "table-right") : (activeSection.boardPlacement === "left" ? "board-left" : "board-right")}
                  onChange={e => {
                    const v = e.target.value;
                    if (v === "text-only") updateSection(activeSectionId, { showBoardPanel: false, showPieceValueTable: false });
                    else if (v.startsWith("board-")) updateSection(activeSectionId, { showBoardPanel: true, showPieceValueTable: false, boardPlacement: v === "board-left" ? "left" : "right" });
                    else updateSection(activeSectionId, { showBoardPanel: true, showPieceValueTable: true, boardPlacement: v === "table-left" ? "left" : "right" });
                  }}
                  className="w-full rounded border border-stone-300 px-2.5 py-1.5 text-sm outline-none focus:border-[#81b64c]">
                  <option value="board-right">📋 Teks kiri, Papan kanan</option>
                  <option value="board-left">Papan kiri, Teks kanan 📋</option>
                  <option value="table-right">📋 Teks kiri, Tabel kanan</option>
                  <option value="table-left">Tabel kiri, Teks kanan 📋</option>
                  <option value="text-only">Tanpa Panel</option>
                </select>
              </label>
            </div>

            <label className="block space-y-1">
              <span className="text-[11px] font-bold text-slate-500">Isi Teks <span className="font-normal text-slate-400">(1 baris = 1 paragraf. **bold**, *italic*, `code`, - list)</span></span>
              <textarea value={activeSection.movementText} onChange={e => updateSection(activeSectionId, { movementText: e.target.value })}
                rows={3} className="w-full rounded border border-stone-300 px-2.5 py-1.5 text-sm outline-none focus:border-[#81b64c]" />
            </label>

            {/* Panduan Interaksi */}
            <div className="border-t border-stone-200 pt-3">
              <p className="rounded bg-green-50 p-2 text-[11px] text-slate-500 leading-relaxed">
                <strong>Klik kiri</strong> bidak = hint langkah. <strong>Double-click</strong> bidak = hapus. <strong>Tarik</strong> = pindah bidak.<br />
                <strong>Klik kanan</strong> 1x = highlight merah. <strong>Klik kanan + drag</strong> = panah merah.
              </p>
            </div>

            {/* Quick Buttons */}
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => { updateSection(activeSectionId, { pieces: createStartingPosition(), moveHints: [], hintSourceSquare: null }); setStatusMessage("New Game — posisi awal"); }}
                className="rounded border border-[#81b64c] bg-green-50 px-2 py-1 text-[10px] font-bold text-[#81b64c] hover:bg-green-100">🆕 New Game</button>
              <button onClick={() => { updateSection(activeSectionId, { pieces: [], highlights: [], arrows: [], moveHints: [], hintSourceSquare: null }); setStatusMessage("Papan bersih"); }}
                className="rounded border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-bold text-red-500 hover:bg-red-100">🗑 Hapus Semua</button>
              <button onClick={() => updateSection(activeSectionId, { pieces: [], moveHints: [], hintSourceSquare: null })}
                className="rounded border border-stone-200 px-2 py-1 text-[10px] font-semibold text-slate-500 hover:bg-stone-100">Hapus Bidak</button>
              <button onClick={() => updateSection(activeSectionId, { moveHints: [], hintSourceSquare: null })}
                className="rounded border border-stone-200 px-2 py-1 text-[10px] font-semibold text-slate-500 hover:bg-stone-100">Hapus Hint</button>
              <button onClick={() => updateSection(activeSectionId, { highlights: [] })}
                className="rounded border border-stone-200 px-2 py-1 text-[10px] font-semibold text-slate-500 hover:bg-stone-100">Hapus Highlight</button>
              <button onClick={() => updateSection(activeSectionId, { arrows: [] })}
                className="rounded border border-stone-200 px-2 py-1 text-[10px] font-semibold text-slate-500 hover:bg-stone-100">Hapus Panah</button>
            </div>

            {/* FEN */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button onClick={() => setShowFenInput(v => !v)}
                className="rounded border border-stone-300 bg-stone-50 px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-stone-100">
                {showFenInput ? "✕ Tutup FEN" : "📋 FEN Import/Export"}
              </button>
              <button onClick={copyFEN}
                className="rounded border border-stone-300 bg-stone-50 px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-stone-100">
                📤 Copy FEN
              </button>
            </div>
            {showFenInput && (
              <div className="space-y-1.5 rounded border border-stone-200 bg-stone-50 p-2">
                <input value={fenInput} onChange={e => setFenInput(e.target.value)}
                  placeholder="Paste FEN di sini..."
                  className="w-full rounded border border-stone-300 px-2 py-1 text-[11px] outline-none focus:border-[#81b64c]" />
                <div className="flex gap-1.5">
                  <button onClick={applyFEN} className="rounded bg-[#81b64c] px-2 py-1 text-[10px] font-bold text-white hover:bg-[#6da03d]">Terapkan FEN</button>
                  <button onClick={() => { setFenInput(generateFEN(activeSection.pieces)); }} className="rounded border border-stone-300 px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-stone-100">Load FEN Papan Ini</button>
                </div>
              </div>
            )}

            {/* Summary */}
            <div className="grid gap-2 text-[11px] text-slate-500 md:grid-cols-3">
              <div>
                <p className="font-bold text-slate-700">Bidak ({activeSection.pieces.length})</p>
                {!activeSection.pieces.length && <p className="italic text-slate-400">—</p>}
                <div className="max-h-24 overflow-y-auto">
                  {activeSection.pieces.map(p => (
                    <div key={p.id} className="flex items-center justify-between border-b border-stone-100 py-px">
                      <span>{pieceSymbols[p.side][p.type]} <span className="font-mono">{p.square}</span></span>
                      <button onClick={() => handlePieceRemove(p.id)} className="text-red-400 hover:text-red-600">✕</button>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="font-bold text-slate-700">Highlight ({activeSection.highlights.length})</p>
                {!activeSection.highlights.length && <p className="italic text-slate-400">—</p>}
                <div className="max-h-24 overflow-y-auto">
                  {activeSection.highlights.map(h => (
                    <div key={h.id} className="flex items-center justify-between border-b border-stone-100 py-px">
                      <span className="flex items-center gap-1">
                        <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: h.color }} />
                        <span className="font-mono">{h.square}</span>
                      </span>
                      <button onClick={() => updateSection(activeSectionId, { highlights: activeSection.highlights.filter(x => x.id !== h.id) })} className="text-red-400 hover:text-red-600">✕</button>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="font-bold text-slate-700">Panah ({activeSection.arrows.length})</p>
                {!activeSection.arrows.length && <p className="italic text-slate-400">—</p>}
                <div className="max-h-24 overflow-y-auto">
                  {activeSection.arrows.map(a => (
                    <div key={a.id} className="flex items-center justify-between border-b border-stone-100 py-px">
                      <span className="flex items-center gap-1">
                        <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: a.color }} />
                        <span className="font-mono">{a.from}→{a.to}</span>
                      </span>
                      <button onClick={() => updateSection(activeSectionId, { arrows: activeSection.arrows.filter(x => x.id !== a.id) })} className="text-red-400 hover:text-red-600">✕</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {statusMessage && (
              <p className="rounded border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-medium text-emerald-700 animate-pulse">{statusMessage}</p>
            )}
          </div>

          {/* Board Panel */}
          <div className="flex w-[420px] max-w-full flex-col items-center gap-2 rounded-lg border border-stone-300 bg-white p-4 shadow-sm">
            {/* Board controls */}
            <div className="flex w-full items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase text-slate-400">Tema:</span>
                {(Object.keys(boardThemes) as BoardTheme[]).map(t => (
                  <button key={t} onClick={() => updateSection(activeSectionId, { boardTheme: t })}
                    className={`h-4 w-4 rounded-sm border border-stone-300 ${activeSection.boardTheme === t ? "ring-1 ring-offset-1 ring-stone-500" : ""}`}
                    style={{ background: `linear-gradient(135deg, ${boardThemes[t].light} 50%, ${boardThemes[t].dark} 50%)` }}
                    title={boardThemes[t].name} />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-bold text-slate-400">Mark:</span>
                  <button onClick={() => setRcHighlightColor("#ef4444")} className={`h-5 w-5 rounded-full border-2 ${rcHighlightColor === "#ef4444" ? "border-stone-600 ring-1 ring-stone-300" : "border-stone-300"}`} style={{ background: "#ef4444" }} title="Merah" />
                  <button onClick={() => setRcHighlightColor("#facc15")} className={`h-5 w-5 rounded-full border-2 ${rcHighlightColor === "#facc15" ? "border-stone-600 ring-1 ring-stone-300" : "border-stone-300"}`} style={{ background: "#facc15" }} title="Kuning" />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-bold text-slate-400">Panah:</span>
                  <button onClick={() => setRcArrowColor("#ef4444")} className={`h-5 w-5 rounded-full border-2 ${rcArrowColor === "#ef4444" ? "border-stone-600 ring-1 ring-stone-300" : "border-stone-300"}`} style={{ background: "#ef4444" }} title="Merah" />
                  <button onClick={() => setRcArrowColor("#facc15")} className={`h-5 w-5 rounded-full border-2 ${rcArrowColor === "#facc15" ? "border-stone-600 ring-1 ring-stone-300" : "border-stone-300"}`} style={{ background: "#facc15" }} title="Kuning" />
                </div>
                <button onClick={() => updateSection(activeSectionId, { boardFlipped: !activeSection.boardFlipped })}
                  className="rounded border border-stone-300 bg-stone-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600 hover:bg-stone-100">
                  {activeSection.boardFlipped ? "⚫ Sisi Hitam" : "⚪ Sisi Putih"}
                </button>
              </div>
            </div>

            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Bidak Hitam</p>
            <PieceTray side="black" onDragStart={item => setDragItem(item)} />
            <InteractiveBoard
              pieces={activeSection.pieces} highlights={activeSection.highlights} arrows={activeSection.arrows}
              moveHints={activeSection.moveHints} hintSourceSquare={activeSection.hintSourceSquare}
              onPieceDrop={handlePieceDrop} onPieceMove={handlePieceMove} onPieceRemove={handlePieceRemove}
              dragItem={dragItem} setDragItem={setDragItem}
              onHighlightToggle={handleHighlightToggle} onArrowDraw={handleArrowDraw} onPieceHint={handlePieceHint}
              flipped={activeSection.boardFlipped} theme={activeSection.boardTheme}
              rcHighlightColor={rcHighlightColor} rcArrowColor={rcArrowColor}
            />
            <PieceTray side="white" onDragStart={item => setDragItem(item)} />
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Bidak Putih</p>

            {activeSection.showBoardPanel && activeSection.showPieceValueTable && (
              <div className="w-full space-y-2 border-t border-stone-200 pt-3">
                <p className="text-[11px] font-bold text-slate-500">Editor Tabel</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="space-y-1">
                    <span className="block text-[11px] font-semibold text-slate-500">Kolom</span>
                    <input type="number" min={1} max={8} value={activeSection.tableColumnCount}
                      onChange={e => updateTableShape(activeSection.tableRowCount, Number(e.target.value) || 1)}
                      className="w-full rounded border border-stone-300 px-2 py-1.5 text-sm outline-none focus:border-[#81b64c]" />
                  </label>
                  <label className="space-y-1">
                    <span className="block text-[11px] font-semibold text-slate-500">Baris</span>
                    <input type="number" min={1} max={20} value={activeSection.tableRowCount}
                      onChange={e => updateTableShape(Number(e.target.value) || 1, activeSection.tableColumnCount)}
                      className="w-full rounded border border-stone-300 px-2 py-1.5 text-sm outline-none focus:border-[#81b64c]" />
                  </label>
                </div>
                <div className="max-h-64 w-full overflow-auto rounded border border-stone-300">
                  <table className="min-w-max border-collapse text-xs">
                    <tbody>
                      {editorTableGrid.map((row, ri) => (
                        <tr key={`erow-${ri}`}>
                          <td className="w-6 border border-stone-200 bg-stone-50 px-1 py-0.5 text-center text-[9px] font-bold text-slate-400">{ri === 0 ? "H" : ri}</td>
                          {row.map((cell, ci) => (
                            <td key={`ecell-${ri}-${ci}`} className="border border-stone-300 p-0.5">
                              <input value={cell} onChange={e => updateTableCell(ri, ci, e.target.value)}
                                className="w-full min-w-[60px] border-0 bg-transparent px-1 py-1 text-xs outline-none"
                                placeholder={ri === 0 ? `Header ${ci + 1}` : ""} />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Preview / Code View Toggle */}
        <section className="space-y-3">
          <div className="flex items-center justify-end gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Tampilan:</span>
            {(["split", "preview", "code"] as const).map(mode => (
              <button key={mode} onClick={() => setPreviewCodeView(mode)}
                className={`rounded px-2.5 py-1 text-[11px] font-bold transition ${previewCodeView === mode ? "bg-[#81b64c] text-white" : "bg-stone-200 text-slate-700 hover:bg-stone-300"}`}>
                {mode === "split" ? "Split" : mode === "preview" ? "Preview" : "Code"}
              </button>
            ))}
          </div>

          <div className={`grid gap-5 ${previewCodeView === "split" ? "lg:grid-cols-[1fr_1.2fr]" : ""}`}>
            {/* Preview */}
            {previewCodeView !== "code" && (
              <article className="overflow-hidden rounded-lg border border-stone-300 bg-white shadow-sm">
                <div className="bg-[#81b64c] px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-white">Preview Full Article</div>
                <div className="max-h-[600px] overflow-y-auto p-6" style={{ fontFamily: "'Nunito', sans-serif", color: "#312e2b" }}>
                  <div className="mb-6 flex items-center justify-between rounded-lg bg-[#81b64c] p-4 text-white">
                    <div className="flex items-center gap-2">
                      <svg viewBox="0 0 100 100" className="h-10 w-10 fill-current"><path d="M50 10c-15 0-20 10-20 15 0 10 5 15 5 25H30v10h40V50h-5c0-10 5-15 5-25 0-5-5-15-20-15z"/><path d="M25 75h50v5H25zM20 85h60v5H20z"/></svg>
                      <h1 className="text-2xl font-extrabold tracking-tighter">Chess<span className="font-normal text-xl">.com</span></h1>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold uppercase tracking-widest leading-none">Panduan Mudah</p>
                      <p className="text-3xl font-extrabold uppercase leading-none mt-1">Bermain Catur</p>
                    </div>
                  </div>
                  {sections.map(renderPreviewSection)}
                </div>
              </article>
            )}

            {/* Code */}
            {previewCodeView !== "preview" && (
              <article className="flex flex-col rounded-lg border border-stone-300 bg-white shadow-sm">
                <div className="flex items-center justify-between bg-stone-800 px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-widest text-stone-400">HTML</span>
                    <span className="text-[10px] text-stone-500">{outputCode.length.toLocaleString()} chars</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <select value={outputMode} onChange={e => setOutputMode(e.target.value as "pretty" | "minified")}
                      className="rounded border border-stone-600 bg-stone-700 px-2 py-1 text-[11px] font-semibold text-stone-200 outline-none">
                      <option value="pretty">Pretty</option>
                      <option value="minified">Minified</option>
                    </select>
                    <button onClick={copyCode}
                      className={`rounded px-3 py-1 text-[11px] font-bold text-white transition ${copied ? "bg-emerald-600" : "bg-[#81b64c] hover:bg-[#6da03d]"}`}>
                      {copied ? "✓ Tersalin!" : "📋 Copy"}
                    </button>
                  </div>
                </div>
                <textarea readOnly value={outputCode}
                  className="flex-1 border-0 bg-stone-900 p-4 font-mono text-[11px] leading-relaxed text-green-400 outline-none"
                  style={{ minHeight: 480 }} />
              </article>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
