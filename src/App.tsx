import { useMemo, useState, useCallback } from "react";
import JSZip from "jszip";

type PieceType = "pawn" | "knight" | "bishop" | "rook" | "queen" | "king";
type PieceSide = "white" | "black";

type Piece = {
  id: number;
  square: string;
  side: PieceSide;
  type: PieceType;
};

type Highlight = {
  id: number;
  square: string;
  color: string;
  opacity: number;
};

type Arrow = {
  id: number;
  from: string;
  to: string;
  color: string;
  opacity: number;
};

type DragItem = {
  side: PieceSide;
  type: PieceType;
  sourceSquare: string | null;
  pieceId: number | null;
};

const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
const ranks = [8, 7, 6, 5, 4, 3, 2, 1];
const boardSize = 320;
const sqSize = boardSize / 8;
const svgSqSize = 200 / 8;

const allPieceTypes: PieceType[] = [
  "king",
  "queen",
  "rook",
  "bishop",
  "knight",
  "pawn",
];

const lightSquarePositions: { x: number; y: number }[] = [];
for (let row = 0; row < 8; row++) {
  for (let col = 0; col < 8; col++) {
    if ((row + col) % 2 === 0) {
      lightSquarePositions.push({
        x: col * svgSqSize,
        y: row * svgSqSize,
      });
    }
  }
}

const pieceSymbols: Record<PieceSide, Record<PieceType, string>> = {
  white: {
    pawn: "♙",
    knight: "♘",
    bishop: "♗",
    rook: "♖",
    queen: "♕",
    king: "♔",
  },
  black: {
    pawn: "♟",
    knight: "♞",
    bishop: "♝",
    rook: "♜",
    queen: "♛",
    king: "♚",
  },
};

function squareToCoordSVG(square: string) {
  const n = square.toLowerCase();
  const fileIndex = files.indexOf(n[0]);
  const rankIndex = 8 - parseInt(n[1], 10);
  return {
    x: fileIndex * svgSqSize,
    y: rankIndex * svgSqSize,
    centerX: fileIndex * svgSqSize + svgSqSize / 2,
    centerY: rankIndex * svgSqSize + svgSqSize / 2,
  };
}

function squareFromFileRank(fileIdx: number, rankIdx: number) {
  return `${files[fileIdx]}${ranks[rankIdx]}`;
}

function squareToCoord(square: string) {
  const n = square.toLowerCase();
  return {
    fileIndex: files.indexOf(n[0]),
    rank: parseInt(n[1], 10),
  };
}

function isInsideBoard(fileIndex: number, rank: number) {
  return fileIndex >= 0 && fileIndex < 8 && rank >= 1 && rank <= 8;
}

function toSquare(fileIndex: number, rank: number) {
  return `${files[fileIndex]}${rank}`;
}

function squareToHintPosition(square: string) {
  const { fileIndex, rank } = squareToCoord(square);
  return {
    left: `${((fileIndex + 0.5) / 8) * 100}%`,
    top: `${((8 - rank + 0.5) / 8) * 100}%`,
  };
}

function getPseudoLegalMoves(piece: Piece, pieces: Piece[]) {
  const { fileIndex, rank } = squareToCoord(piece.square);
  const occupied = new Map(pieces.map((p) => [p.square, p]));
  const results: string[] = [];

  if (piece.type === "pawn") {
    const dir = piece.side === "white" ? 1 : -1;
    const startRank = piece.side === "white" ? 2 : 7;
    const oneStep = toSquare(fileIndex, rank + dir);
    if (isInsideBoard(fileIndex, rank + dir) && !occupied.has(oneStep)) {
      results.push(oneStep);
      const twoStep = toSquare(fileIndex, rank + dir * 2);
      if (rank === startRank && isInsideBoard(fileIndex, rank + dir * 2) && !occupied.has(twoStep)) {
        results.push(twoStep);
      }
    }
    [
      { file: fileIndex - 1, rank: rank + dir },
      { file: fileIndex + 1, rank: rank + dir },
    ].forEach((d) => {
      if (!isInsideBoard(d.file, d.rank)) return;
      const sq = toSquare(d.file, d.rank);
      const targetPiece = occupied.get(sq);
      if (targetPiece && targetPiece.side !== piece.side) results.push(sq);
    });
    return results;
  }

  const pushIfValid = (
    targetFile: number,
    targetRank: number
  ) => {
    if (!isInsideBoard(targetFile, targetRank)) return;
    const target = toSquare(targetFile, targetRank);
    const blocker = occupied.get(target);
    if (!blocker) {
      results.push(target);
      return;
    }
    if (blocker.side !== piece.side) {
      results.push(target);
    }
  };

  if (piece.type === "knight") {
    [
      [1, 2], [2, 1], [2, -1], [1, -2],
      [-1, -2], [-2, -1], [-2, 1], [-1, 2],
    ].forEach(([dx, dy]) => pushIfValid(fileIndex + dx, rank + dy));
    return results;
  }

  if (piece.type === "king") {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        pushIfValid(fileIndex + dx, rank + dy);
      }
    }
    return results;
  }

  const directions: [number, number][] = [];
  if (piece.type === "rook" || piece.type === "queen") {
    directions.push([1, 0], [-1, 0], [0, 1], [0, -1]);
  }
  if (piece.type === "bishop" || piece.type === "queen") {
    directions.push([1, 1], [1, -1], [-1, 1], [-1, -1]);
  }

  directions.forEach(([dx, dy]) => {
    let nf = fileIndex + dx;
    let nr = rank + dy;
    while (isInsideBoard(nf, nr)) {
      const sq = toSquare(nf, nr);
      const blocker = occupied.get(sq);
      if (!blocker) {
        results.push(sq);
      } else {
        if (blocker.side !== piece.side) results.push(sq);
        break;
      }
      nf += dx;
      nr += dy;
    }
  });

  return results;
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function uid() {
  return Date.now() + Math.floor(Math.random() * 1_000_000);
}

function minifyHtml(html: string) {
  return html
    .replace(/\n+/g, " ")
    .replace(/>\s+</g, "><")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function computeArrowPolygon(fromSquare: string, toSquare: string) {
  const f = squareToCoordSVG(fromSquare);
  const t = squareToCoordSVG(toSquare);
  const dx = t.centerX - f.centerX;
  const dy = t.centerY - f.centerY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const angleRad = Math.atan2(dx, -dy);
  const angleDeg = (angleRad * 180) / Math.PI;
  const cx = (f.centerX + t.centerX) / 2;
  const cy = (f.centerY + t.centerY) / 2;
  const shaftWidth = 2.75;
  const headWidth = 4.5;
  const headLength = 4.5;
  const halfLen = dist / 2;
  const pad = 3;
  const bottom = halfLen - pad;
  const top = -(halfLen - pad);
  const headBase = top + headLength;
  const pts = [
    [cx - shaftWidth, cy + bottom],
    [cx - shaftWidth, cy + headBase],
    [cx - headWidth, cy + headBase],
    [cx, cy + top],
    [cx + headWidth, cy + headBase],
    [cx + shaftWidth, cy + headBase],
    [cx + shaftWidth, cy + bottom],
  ];
  const points = pts
    .map((p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`)
    .join(" ");
  return { points, rotation: angleDeg, cx, cy };
}

// ─── Section Data ──────────────────────────────────────────────────────

type SectionData = {
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
};

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
  };
}

// ─── Components ────────────────────────────────────────────────────────

function PieceTray({
  side,
  onDragStart,
}: {
  side: PieceSide;
  onDragStart: (item: DragItem) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-1 py-1.5">
      {allPieceTypes.map((type) => (
        <div
          key={`${side}-${type}`}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = "move";
            onDragStart({
              side,
              type,
              sourceSquare: null,
              pieceId: null,
            });
          }}
          className="flex h-8 w-8 cursor-grab items-center justify-center rounded bg-stone-200 text-xl shadow-sm transition hover:bg-stone-300 hover:shadow active:cursor-grabbing"
          title={`${side} ${type}`}
        >
          {pieceSymbols[side][type]}
        </div>
      ))}
    </div>
  );
}

function ArrowPolygonSVG({
  arrow,
  idPrefix,
}: {
  arrow: Arrow;
  idPrefix: string;
}) {
  const { points, rotation, cx, cy } = useMemo(
    () => computeArrowPolygon(arrow.from, arrow.to),
    [arrow.from, arrow.to]
  );
  return (
    <polygon
      id={`${idPrefix}-${arrow.from}${arrow.to}`}
      transform={`rotate(${rotation.toFixed(2)} ${cx.toFixed(2)} ${cy.toFixed(2)})`}
      points={points}
      style={{ fill: arrow.color, opacity: arrow.opacity }}
    />
  );
}

function InteractiveBoard({
  pieces,
  highlights,
  arrows,
  moveHints,
  hintSourceSquare,
  onPieceDrop,
  onPieceMove,
  onPieceRemove,
  dragItem,
  setDragItem,
  onHighlightToggle,
  onArrowDraw,
  onPieceHint,
  editMode,
}: {
  pieces: Piece[];
  highlights: Highlight[];
  arrows: Arrow[];
  moveHints: string[];
  hintSourceSquare: string | null;
  onPieceDrop: (side: PieceSide, type: PieceType, square: string) => void;
  onPieceMove: (pieceId: number, newSquare: string) => void;
  onPieceRemove: (pieceId: number) => void;
  dragItem: DragItem | null;
  setDragItem: (item: DragItem | null) => void;
  onHighlightToggle: (square: string) => void;
  onArrowDraw: (from: string, to: string) => void;
  onPieceHint: (square: string) => void;
  editMode: "piece" | "highlight" | "arrow";
}) {
  const [hoverSquare, setHoverSquare] = useState<string | null>(null);
  const [arrowStart, setArrowStart] = useState<string | null>(null);
  const [arrowPreview, setArrowPreview] = useState<string | null>(null);

  const getPieceAt = useCallback(
    (square: string) => pieces.find((p) => p.square === square),
    [pieces]
  );

  // Build a Set of highlight squares for O(1) lookup
  const highlightMap = useMemo(() => {
    const map = new Map<string, Highlight>();
    highlights.forEach((h) => map.set(h.square, h));
    return map;
  }, [highlights]);

  // Build a Set of hint squares for O(1) lookup
  const hintSet = useMemo(() => new Set(moveHints), [moveHints]);

  return (
    <div className="inline-block select-none">
      {/* File labels top */}
      <div className="flex" style={{ paddingLeft: 18 }}>
        {files.map((f) => (
          <div
            key={f}
            className="text-center text-[9px] font-bold text-slate-400"
            style={{ width: sqSize }}
          >
            {f}
          </div>
        ))}
      </div>
      <div className="flex">
        {/* Rank labels left */}
        <div className="flex flex-col">
          {ranks.map((r) => (
            <div
              key={r}
              className="flex items-center justify-center text-[9px] font-bold text-slate-400"
              style={{ width: 18, height: sqSize }}
            >
              {r}
            </div>
          ))}
        </div>

        {/* Board area */}
        <div
          className="relative"
          style={{ width: boardSize, height: boardSize }}
        >
          {/* Square grid */}
          <div
            className="grid border border-stone-400"
            style={{
              gridTemplateColumns: `repeat(8, ${sqSize}px)`,
              gridTemplateRows: `repeat(8, ${sqSize}px)`,
            }}
          >
            {ranks.map((_, rankIdx) =>
              files.map((_, fileIdx) => {
                const square = squareFromFileRank(fileIdx, rankIdx);
                const isLight = (rankIdx + fileIdx) % 2 === 0;
                const piece = getPieceAt(square);
                const isHover = hoverSquare === square;
                const isArrowSrc = arrowStart === square;
                const isArrowTgt = arrowPreview === square && arrowStart !== null;
                const hl = highlightMap.get(square);

                // BUG FIX: Only highlight the SOURCE square of the hint, not all pieces
                const isSelectedSource = hintSourceSquare === square;

                let bg = isLight ? "#eeeed2" : "#769656";
                if (isHover && dragItem) bg = isLight ? "#f5f5a0" : "#8aad5a";
                if (isArrowSrc) bg = "#f87171";
                if (isArrowTgt) bg = "#60a5fa";

                return (
                  <div
                    key={square}
                    className="relative flex items-center justify-center"
                    style={{
                      width: sqSize,
                      height: sqSize,
                      backgroundColor: bg,
                      transition: "background-color 0.12s",
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      setHoverSquare(square);
                    }}
                    onDragLeave={() => setHoverSquare(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setHoverSquare(null);
                      if (!dragItem) return;
                      if (dragItem.sourceSquare && dragItem.pieceId) {
                        if (dragItem.sourceSquare !== square)
                          onPieceMove(dragItem.pieceId, square);
                      } else {
                        onPieceDrop(dragItem.side, dragItem.type, square);
                      }
                      setDragItem(null);
                    }}
                    onClick={() => {
                      if (editMode === "piece") {
                        onPieceHint(square);
                      } else if (editMode === "highlight") {
                        onHighlightToggle(square);
                      } else if (editMode === "arrow") {
                        if (!arrowStart) {
                          setArrowStart(square);
                          setArrowPreview(null);
                        } else {
                          if (arrowStart !== square)
                            onArrowDraw(arrowStart, square);
                          setArrowStart(null);
                          setArrowPreview(null);
                        }
                      }
                    }}
                    onMouseEnter={() => {
                      if (editMode === "arrow" && arrowStart)
                        setArrowPreview(square);
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      const p = getPieceAt(square);
                      if (p) onPieceRemove(p.id);
                    }}
                  >
                    {/* Highlight overlay */}
                    {hl && (
                      <div
                        className="pointer-events-none absolute inset-0"
                        style={{
                          backgroundColor: hl.color,
                          opacity: hl.opacity,
                        }}
                      />
                    )}

                    {/* BUG FIX: Only show yellow overlay on the actual source square */}
                    {isSelectedSource && (
                      <div className="pointer-events-none absolute inset-0 bg-yellow-400/40" />
                    )}

                    {/* Piece */}
                    {piece && (
                      <span
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = "move";
                          setDragItem({
                            side: piece.side,
                            type: piece.type,
                            sourceSquare: piece.square,
                            pieceId: piece.id,
                          });
                        }}
                        className="relative z-10 cursor-grab leading-none active:cursor-grabbing"
                        style={{
                          fontSize: sqSize * 0.7,
                          filter:
                            piece.side === "white"
                              ? "drop-shadow(0 1px 2px rgba(0,0,0,0.5))"
                              : "drop-shadow(0 1px 2px rgba(0,0,0,0.3))",
                        }}
                      >
                        {pieceSymbols[piece.side][piece.type]}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Move hint dots */}
          <div className="pointer-events-none absolute inset-0">
            {moveHints.map((square) => {
              const pos = squareToHintPosition(square);
              const isCapture = pieces.some((p) => p.square === square);
              return (
                <div
                  key={`hint-${square}`}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full ${
                    isCapture
                      ? "h-[34px] w-[34px] border-[5px] border-black/30 bg-transparent"
                      : "h-3 w-3 bg-black/30"
                  }`}
                  style={{
                    left: pos.left,
                    top: pos.top,
                  }}
                />
              );
            })}
          </div>

          {/* Arrow overlay */}
          <svg
            viewBox="0 0 200 200"
            className="pointer-events-none absolute inset-0 z-20 h-full w-full"
          >
            {arrows.map((a) => (
              <ArrowPolygonSVG key={a.id} arrow={a} idPrefix="ib" />
            ))}
          </svg>
        </div>

        {/* Rank labels right */}
        <div className="flex flex-col">
          {ranks.map((r) => (
            <div
              key={r}
              className="flex items-center justify-center text-[9px] font-bold text-slate-400"
              style={{ width: 18, height: sqSize }}
            >
              {r}
            </div>
          ))}
        </div>
      </div>
      {/* File labels bottom */}
      <div className="flex" style={{ paddingLeft: 18 }}>
        {files.map((f) => (
          <div
            key={f}
            className="text-center text-[9px] font-bold text-slate-400"
            style={{ width: sqSize }}
          >
            {f}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────

function createStartingPosition(): Piece[] {
  const p: Piece[] = [];
  const backRank: PieceType[] = [
    "rook", "knight", "bishop", "queen", "king", "bishop", "knight", "rook",
  ];
  for (let i = 0; i < 8; i++) {
    p.push({ id: uid(), square: `${files[i]}1`, side: "white", type: backRank[i] });
    p.push({ id: uid(), square: `${files[i]}2`, side: "white", type: "pawn" });
    p.push({ id: uid(), square: `${files[i]}7`, side: "black", type: "pawn" });
    p.push({ id: uid(), square: `${files[i]}8`, side: "black", type: backRank[i] });
  }
  return p;
}

function parseTableGrid(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split("|").map((cell) => cell.trim()));
}

function resizeTableGrid(grid: string[][], rowCount: number, colCount: number) {
  const rows = Math.max(1, rowCount);
  const cols = Math.max(1, colCount);
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => grid[r]?.[c] ?? "")
  );
}

function stringifyTableGrid(grid: string[][]) {
  return grid.map((row) => row.map((c) => c.trim()).join("|")).join("\n");
}

// ─── SVG Board as standalone (for export) ──────────────────────────────

function generateStandaloneSVG(sec: SectionData): string {
  const lightRects = lightSquarePositions
    .map(
      (sq) =>
        `<rect width="${svgSqSize}" height="${svgSqSize}" x="${sq.x}" y="${sq.y}"/>`
    )
    .join("");

  const hlRects = sec.highlights
    .map((h) => {
      const { x, y } = squareToCoordSVG(h.square);
      return `<rect x="${x}" y="${y}" width="${svgSqSize}" height="${svgSqSize}" fill="${h.color}" fill-opacity="${h.opacity}"/>`;
    })
    .join("\n");

  const pieceTexts = sec.pieces
    .map((p) => {
      const { centerX, centerY } = squareToCoordSVG(p.square);
      return `<text x="${centerX}" y="${centerY}" font-size="20" fill="${p.side === "white" ? "white" : "black"}" text-anchor="middle" dominant-baseline="central">${pieceSymbols[p.side][p.type]}</text>`;
    })
    .join("\n");

  const arrowPolygons = sec.arrows
    .map((a) => {
      const { points, rotation, cx, cy } = computeArrowPolygon(a.from, a.to);
      return `<polygon id="arrow-${a.from}${a.to}" transform="rotate(${rotation.toFixed(2)} ${cx.toFixed(2)} ${cy.toFixed(2)})" points="${points}" style="fill:${a.color};opacity:${a.opacity};"/>`;
    })
    .join("\n");

  return [
    `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">`,
    `<rect width="200" height="200" fill="#769656"/>`,
    `<g fill="#eeeed2">${lightRects}</g>`,
    hlRects,
    pieceTexts,
    arrowPolygons,
    `</svg>`,
  ]
    .filter((s) => s.trim() !== "")
    .join("\n");
}

// ─── Main App ──────────────────────────────────────────────────────────

export default function App() {
  const [sections, setSections] = useState<SectionData[]>([
    {
      id: 1,
      sectionNumber: "1",
      sectionTitle: "PION (Pawn)",
      description:
        "Kunci Utama: Pion adalah jiwa permainan catur. Mereka menentukan karakter posisi, membatasi gerakan bidak lawan, dan seringkali menjadi faktor penentu dalam endgame.",
      movementTitle: "Gerakan:",
      movementText:
        "Maju 1 kotak ke depan\nLangkah PERTAMA boleh maju 2 kotak\nMakan secara DIAGONAL (serong 1 kotak ke depan)",
      boardPlacement: "right",
      showPieceValueTable: false,
      showBoardPanel: true,
      tableColumnCount: 3,
      tableRowCount: 7,
      tableRowsText:
        "Bidak|Nilai|Perbandingan\n♟ Pion|1|Satuan dasar\n♞ Kuda|3|= 3 Pion\n♗ Gajah|3|= 3 Pion\n♖ Benteng|5|= 5 Pion\n♕ Ratu|9|= 9 Pion (terkuat)\n♔ Raja|∞|Tak ternilai",
      pieces: createStartingPosition(),
      highlights: [
        ...files.map((f) => ({
          id: uid(),
          square: `${f}7`,
          color: "#facc15",
          opacity: 0.45,
        })),
        ...files.map((f) => ({
          id: uid(),
          square: `${f}2`,
          color: "#facc15",
          opacity: 0.45,
        })),
      ],
      arrows: [],
      moveHints: [],
      hintSourceSquare: null,
    },
  ]);

  const [activeSectionId, setActiveSectionId] = useState(1);
  const [highlightColor, setHighlightColor] = useState("#facc15");
  const [highlightOpacity, setHighlightOpacity] = useState(0.45);
  const [arrowColor, setArrowColor] = useState("#ffaa00");
  const [arrowOpacity, setArrowOpacity] = useState(0.8);
  const [dragItem, setDragItem] = useState<DragItem | null>(null);
  const [editMode, setEditMode] = useState<"piece" | "highlight" | "arrow">("piece");
  const [outputMode, setOutputMode] = useState<"pretty" | "minified">("pretty");
  const [statusMessage, setStatusMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [isZipping, setIsZipping] = useState(false);

  const activeSection = sections.find((s) => s.id === activeSectionId)!;

  function updateSection(id: number, updates: Partial<SectionData>) {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
    );
  }

  function addSection() {
    const newId = uid();
    const ns = createDefaultSection(newId);
    ns.sectionNumber = String(sections.length + 1);
    setSections((prev) => [...prev, ns]);
    setActiveSectionId(newId);
    setStatusMessage("Bagian baru ditambahkan");
  }

  function removeSection(id: number) {
    if (sections.length <= 1) {
      setStatusMessage("Minimal harus ada 1 bagian");
      return;
    }
    const remaining = sections.filter((s) => s.id !== id);
    setSections(remaining);
    if (activeSectionId === id) setActiveSectionId(remaining[0].id);
    setStatusMessage("Bagian dihapus");
  }

  function duplicateSection(id: number) {
    const src = sections.find((s) => s.id === id);
    if (!src) return;
    const newId = uid();
    setSections((prev) => [
      ...prev,
      {
        ...src,
        id: newId,
        sectionNumber: String(sections.length + 1),
        pieces: src.pieces.map((p) => ({ ...p, id: uid() })),
        highlights: src.highlights.map((h) => ({ ...h, id: uid() })),
        arrows: src.arrows.map((a) => ({ ...a, id: uid() })),
        moveHints: [],
        hintSourceSquare: null,
      },
    ]);
    setActiveSectionId(newId);
    setStatusMessage("Bagian diduplikasi");
  }

  // ─── Board Handlers ─────────────────────────────────────────────────

  function handlePieceDrop(side: PieceSide, type: PieceType, square: string) {
    const prev = activeSection.pieces;
    const idx = prev.findIndex((p) => p.square === square);
    let nextPieces: Piece[];
    if (idx >= 0) {
      nextPieces = [...prev];
      nextPieces[idx] = { ...nextPieces[idx], side, type };
    } else {
      nextPieces = [...prev, { id: uid(), square, side, type }];
    }
    updateSection(activeSectionId, {
      pieces: nextPieces,
      moveHints: [],
      hintSourceSquare: null,
    });
    setStatusMessage(`${side} ${type} → ${square}`);
  }

  function handlePieceMove(pieceId: number, newSquare: string) {
    updateSection(activeSectionId, {
      pieces: activeSection.pieces
        .filter((p) => p.square !== newSquare || p.id === pieceId)
        .map((p) => (p.id === pieceId ? { ...p, square: newSquare } : p)),
      moveHints: [],
      hintSourceSquare: null,
    });
    setStatusMessage(`Bidak → ${newSquare}`);
  }

  function handlePieceRemove(pieceId: number) {
    const removedPiece = activeSection.pieces.find((p) => p.id === pieceId);
    const wasSource = removedPiece && removedPiece.square === activeSection.hintSourceSquare;
    updateSection(activeSectionId, {
      pieces: activeSection.pieces.filter((p) => p.id !== pieceId),
      moveHints: wasSource ? [] : activeSection.moveHints,
      hintSourceSquare: wasSource ? null : activeSection.hintSourceSquare,
    });
    setStatusMessage("Bidak dihapus");
  }

  function handleHighlightToggle(square: string) {
    const prev = activeSection.highlights;
    const idx = prev.findIndex((h) => h.square === square);
    updateSection(activeSectionId, {
      highlights:
        idx >= 0
          ? prev.filter((_, i) => i !== idx)
          : [
              ...prev,
              {
                id: uid(),
                square,
                color: highlightColor,
                opacity: highlightOpacity,
              },
            ],
    });
  }

  function handleArrowDraw(from: string, to: string) {
    const prev = activeSection.arrows;
    const idx = prev.findIndex((a) => a.from === from && a.to === to);
    updateSection(activeSectionId, {
      arrows:
        idx >= 0
          ? prev.filter((_, i) => i !== idx)
          : [
              ...prev,
              {
                id: uid(),
                from,
                to,
                color: arrowColor,
                opacity: arrowOpacity,
              },
            ],
    });
  }

  function handlePieceHint(square: string) {
    if (editMode !== "piece") return;
    const selectedPiece = activeSection.pieces.find((p) => p.square === square);

    // Clicked on empty square -> clear hints
    if (!selectedPiece) {
      updateSection(activeSectionId, {
        moveHints: [],
        hintSourceSquare: null,
      });
      return;
    }

    // Clicked on the same source again -> toggle off
    if (activeSection.hintSourceSquare === square) {
      updateSection(activeSectionId, {
        moveHints: [],
        hintSourceSquare: null,
      });
      return;
    }

    // Clicked on a different piece -> show its moves
    const hints = getPseudoLegalMoves(selectedPiece, activeSection.pieces);
    updateSection(activeSectionId, {
      moveHints: hints,
      hintSourceSquare: square,
    });
    setStatusMessage(
      `${selectedPiece.type} ${selectedPiece.square}: ${hints.length} langkah`
    );
  }

  // ─── Code Generation ────────────────────────────────────────────────

  function generateSVG(sec: SectionData) {
    const lightRects = lightSquarePositions
      .map(
        (sq) =>
          `<rect width="${svgSqSize}" height="${svgSqSize}" x="${sq.x}" y="${sq.y}"/>`
      )
      .join("");

    const hlRects = sec.highlights
      .map((h) => {
        const { x, y } = squareToCoordSVG(h.square);
        return `                        <rect x="${x}" y="${y}" width="${svgSqSize}" height="${svgSqSize}" fill="${h.color}" fill-opacity="${h.opacity}"/>`;
      })
      .join("\n");

    const pieceTexts = sec.pieces
      .map((p) => {
        const { centerX, centerY } = squareToCoordSVG(p.square);
        return `                        <text x="${centerX}" y="${centerY}" font-size="20" fill="${p.side === "white" ? "white" : "black"}" text-anchor="middle" dominant-baseline="central">${pieceSymbols[p.side][p.type]}</text>`;
      })
      .join("\n");

    const arrowPolygons = sec.arrows
      .map((a) => {
        const { points, rotation, cx, cy } = computeArrowPolygon(a.from, a.to);
        return `                        <polygon id="arrow-${a.from}${a.to}" data-arrow="${a.from}${a.to}" class="arrow" transform="rotate(${rotation.toFixed(2)} ${cx.toFixed(2)} ${cy.toFixed(2)})" points="${points}" style="fill: ${a.color}; opacity: ${a.opacity};"/>`;
      })
      .join("\n");

    return [
      `                    <svg viewBox="0 0 200 200" class="w-full h-full">`,
      `                        <rect width="200" height="200" fill="#769656"/>`,
      `                        <g fill="#eeeed2">`,
      `                            ${lightRects}`,
      `                        </g>`,
      hlRects,
      pieceTexts,
      arrowPolygons,
      `                    </svg>`,
    ]
      .filter((s) => s.trim() !== "")
      .join("\n");
  }

  function generateHintLayer(sec: SectionData) {
    if (sec.moveHints.length === 0) return "";
    const hintDivs = sec.moveHints
      .map((square) => {
        const pos = squareToHintPosition(square);
        const isCapture = sec.pieces.some((p) => p.square === square);
        const style = isCapture
          ? `left:${pos.left};top:${pos.top};width:27.5px;height:27.5px;border:4px solid rgba(0,0,0,0.3);background:transparent;border-radius:9999px;`
          : `left:${pos.left};top:${pos.top};`;
        return `                    <div class="hint" style="${style}"></div>`;
      })
      .join("\n");

    return [
      `                <div class="hint-layer">`,
      hintDivs,
      `                </div>`,
    ].join("\n");
  }

  function generateTableHtml(sec: SectionData) {
    const grid = resizeTableGrid(
      parseTableGrid(sec.tableRowsText),
      sec.tableRowCount,
      sec.tableColumnCount
    );
    const headers = grid[0] ?? [];
    const bodyRows = grid.slice(1);

    const thCells = headers
      .map(
        (h) =>
          `<th class="border border-gray-300 px-3 py-2 text-left">${escapeHtml(h)}</th>`
      )
      .join("");

    const tbodyRows = bodyRows
      .map((row) => {
        const cells = row
          .map(
            (cell) =>
              `<td class="border border-gray-300 px-3 py-2">${escapeHtml(cell)}</td>`
          )
          .join("");
        return `                            <tr>${cells}</tr>`;
      })
      .join("\n");

    return [
      `                    <table class="w-full text-left text-sm text-gray-700 border border-gray-300">`,
      `                        <thead class="bg-gray-100"><tr>${thCells}</tr></thead>`,
      `                        <tbody>`,
      tbodyRows,
      `                        </tbody>`,
      `                    </table>`,
    ].join("\n");
  }

  const generatedCode = useMemo(() => {
    const sectionBlocks = sections
      .map((sec) => {
        const movItems = sec.movementText
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean);
        const movHtml = movItems
          .map((item) => escapeHtml(item))
          .join("<br>\n                        ");
        const flexDir =
          sec.boardPlacement === "left" ? "md:flex-row-reverse" : "md:flex-row";

        let sidePanelBlock = "";
        if (sec.showBoardPanel) {
          if (sec.showPieceValueTable) {
            sidePanelBlock = [
              `                <div class="board-container relative">`,
              generateTableHtml(sec),
              `                </div>`,
            ].join("\n");
          } else {
            const svgBlock = generateSVG(sec);
            const hintLayer = generateHintLayer(sec);
            sidePanelBlock = [
              `                <div class="board-container relative">`,
              svgBlock,
              hintLayer,
              `                </div>`,
            ]
              .filter((s) => s.trim() !== "")
              .join("\n");
          }
        }

        return [
          ``,
          `            <!-- Section ${escapeHtml(sec.sectionNumber)} -->`,
          `            <div class="flex items-center gap-4 mb-4">`,
          `                <span class="section-number text-3xl">${escapeHtml(sec.sectionNumber)}</span>`,
          `                <h3 class="text-2xl font-extrabold text-chess-green uppercase mb-3 leading-tight">${escapeHtml(sec.sectionTitle)}</h3>`,
          `            </div>`,
          ``,
          `            <p class="text-gray-600 mb-8 leading-snug">`,
          `                ${escapeHtml(sec.description)}`,
          `            </p>`,
          ``,
          `            <div class="flex flex-col ${flexDir} gap-8 mb-10">`,
          `                <div class="flex-1">`,
          `                    <h3 class="text-2xl font-extrabold text-chess-green uppercase mb-3 leading-tight">${escapeHtml(sec.movementTitle)}</h3>`,
          `                    <p class="text-gray-600 leading-relaxed text-sm">`,
          `                        ${movHtml}`,
          `                    </p>`,
          `                </div>`,
          ``,
          sidePanelBlock,
          `            </div>`,
        ].join("\n");
      })
      .join("\n");

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
      `        .section-number { background-color: #81b64c; color: white; padding: 2px 10px; border-radius: 4px; font-weight: 800; }`,
      `        .text-chess-green { color: #81b64c; }`,
      `        .board-container { width: 220px; height: 220px; flex-shrink: 0; position: relative; }`,
      `        .hint-layer { position: absolute; inset: 0; pointer-events: none; }`,
      `        .hint { position: absolute; width: 14px; height: 14px; border-radius: 9999px; transform: translate(-50%, -50%); background: rgba(0,0,0,0.3); }`,
      `    </style>`,
      `</head>`,
      `<body class="p-0 m-0">`,
      `    <div class="max-w-4xl mx-auto bg-white shadow-xl min-h-screen">`,
      `        <header class="header-bg p-6 flex justify-between items-center text-white">`,
      `            <div class="flex items-center gap-2">`,
      `                <svg viewBox="0 0 100 100" class="w-12 h-12 fill-current">`,
      `                    <path d="M50 10c-15 0-20 10-20 15 0 10 5 15 5 25H30v10h40V50h-5c0-10 5-15 5-25 0-5-5-15-20-15z"/>`,
      `                    <path d="M25 75h50v5H25zM20 85h60v5H20z"/>`,
      `                </svg>`,
      `                <h1 class="text-4xl font-extrabold tracking-tighter">Chess<span class="font-normal text-3xl">.com</span></h1>`,
      `            </div>`,
      `            <div class="text-right">`,
      `                <p class="text-xl font-bold uppercase tracking-widest leading-none">Panduan Mudah</p>`,
      `                <p class="text-5xl font-extrabold uppercase leading-none mt-1">Bermain Catur</p>`,
      `            </div>`,
      `        </header>`,
      `        <main class="p-8">`,
      sectionBlocks,
      `        </main>`,
      `    </div>`,
      `</body>`,
      `</html>`,
    ].join("\n");
  }, [sections]);

  const outputCode = useMemo(
    () => (outputMode === "minified" ? minifyHtml(generatedCode) : generatedCode),
    [generatedCode, outputMode]
  );

  const editorTableGrid = useMemo(
    () =>
      resizeTableGrid(
        parseTableGrid(activeSection.tableRowsText),
        activeSection.tableRowCount,
        activeSection.tableColumnCount
      ),
    [activeSection.tableColumnCount, activeSection.tableRowCount, activeSection.tableRowsText]
  );

  function updateTableShape(nextRows: number, nextCols: number) {
    const r = Math.max(1, nextRows);
    const c = Math.max(1, nextCols);
    const nextGrid = resizeTableGrid(editorTableGrid, r, c);
    updateSection(activeSectionId, {
      tableRowCount: r,
      tableColumnCount: c,
      tableRowsText: stringifyTableGrid(nextGrid),
    });
  }

  function updateTableCell(rowIdx: number, colIdx: number, value: string) {
    const nextGrid = editorTableGrid.map((row, r) =>
      row.map((cell, c) => (r === rowIdx && c === colIdx ? value : cell))
    );
    updateSection(activeSectionId, {
      tableRowsText: stringifyTableGrid(nextGrid),
    });
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(outputCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setStatusMessage("Gagal menyalin");
    }
  }

  async function downloadZipProject() {
    setIsZipping(true);
    try {
      const zip = new JSZip();
      const root = zip.folder("chess-article-project");
      if (!root) throw new Error("Gagal membuat folder");

      root.file("index.html", generatedCode);

      const svgFolder = root.folder("boards");
      sections.forEach((sec) => {
        if (sec.showBoardPanel && !sec.showPieceValueTable) {
          const svgContent = generateStandaloneSVG(sec);
          svgFolder?.file(`board-section-${sec.sectionNumber}.svg`, svgContent);
        }
      });

      const packageJson = {
        name: "chess-article",
        private: true,
        version: "1.0.0",
        type: "module",
        scripts: {
          dev: "vite",
          build: "vite build",
          preview: "vite preview",
        },
        dependencies: {
          react: "^19.0.0",
          "react-dom": "^19.0.0",
        },
        devDependencies: {
          typescript: "^5.0.0",
          vite: "^6.0.0",
          "@vitejs/plugin-react": "^4.0.0",
          tailwindcss: "^4.0.0",
          "@tailwindcss/vite": "^4.0.0",
        },
      };

      root.file("package.json", JSON.stringify(packageJson, null, 2));
      root.file(".gitignore", ["node_modules", "dist", ".DS_Store", "*.log"].join("\n"));
      root.file(
        "README.md",
        [
          "# Chess Article Project",
          "",
          `Generated with ${sections.length} section(s).`,
          "",
          "## Quick Start",
          "```bash",
          "npm install",
          "npm run dev",
          "```",
          "",
          "## Files",
          "- `index.html` — Full article HTML",
          "- `boards/` — Individual SVG board files",
          "- `src/` — React source (wraps article in iframe)",
        ].join("\n")
      );

      root.file(
        "vite.config.ts",
        [
          'import { defineConfig } from "vite";',
          'import react from "@vitejs/plugin-react";',
          'import tailwindcss from "@tailwindcss/vite";',
          "",
          "export default defineConfig({",
          "  plugins: [",
          "    react(),",
          "    tailwindcss(),",
          "  ],",
          "  base: './',",
          "});",
        ].join("\n")
      );

      root.file(
        "tsconfig.json",
        JSON.stringify(
          {
            compilerOptions: {
              target: "ES2020",
              useDefineForClassFields: true,
              lib: ["ES2020", "DOM", "DOM.Iterable"],
              module: "ESNext",
              skipLibCheck: true,
              moduleResolution: "Bundler",
              allowImportingTsExtensions: true,
              resolveJsonModule: true,
              isolatedModules: true,
              noEmit: true,
              jsx: "react-jsx",
              strict: true,
            },
            include: ["src"],
          },
          null,
          2
        )
      );

      const publicFolder = root.folder("public");
      publicFolder?.file("chess-article.html", generatedCode);

      const srcFolder = root.folder("src");
      srcFolder?.file("index.css", '@import "tailwindcss";\n');
      srcFolder?.file(
        "main.tsx",
        [
          'import { StrictMode } from "react";',
          'import { createRoot } from "react-dom/client";',
          'import "./index.css";',
          'import App from "./App";',
          "",
          'createRoot(document.getElementById("root")!).render(',
          "  <StrictMode>",
          "    <App />",
          "  </StrictMode>",
          ");",
        ].join("\n")
      );
      srcFolder?.file(
        "App.tsx",
        [
          "export default function App() {",
          "  return (",
          '    <div className="min-h-screen bg-gray-100">',
          "      <iframe",
          '        title="Chess Article"',
          '        src="/chess-article.html"',
          '        className="mx-auto block h-screen w-full max-w-4xl border-0"',
          "      />",
          "    </div>",
          "  );",
          "}",
        ].join("\n")
      );

      root.file(
        "index-dev.html",
        [
          "<!doctype html>",
          '<html lang="id">',
          "  <head>",
          '    <meta charset="UTF-8" />',
          '    <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
          "    <title>Chess Article Viewer</title>",
          "  </head>",
          "  <body>",
          '    <div id="root"></div>',
          '    <script type="module" src="/src/main.tsx"></script>',
          "  </body>",
          "</html>",
        ].join("\n")
      );

      root.file(
        "article-data.json",
        JSON.stringify(
          {
            exportedAt: new Date().toISOString(),
            sections: sections.map((s) => ({
              ...s,
              moveHints: [],
              hintSourceSquare: null,
            })),
          },
          null,
          2
        )
      );

      const blob = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "chess-article-project.zip";
      link.click();
      URL.revokeObjectURL(link.href);
      setStatusMessage("ZIP berhasil di-download!");
    } catch (err) {
      setStatusMessage(
        `Gagal membuat ZIP: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    } finally {
      setIsZipping(false);
    }
  }

  const movementItems = activeSection.movementText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  // ─── Render ──────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-stone-100 px-3 py-6 text-slate-900 md:px-6">
      <div className="mx-auto w-full max-w-7xl space-y-5">
        {/* ── Header ──────────────────────────────────── */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tight text-[#2f5f2a] md:text-4xl">
              ♟ Chess Article Builder
            </h1>
            <p className="mt-1 max-w-2xl text-xs text-slate-500 md:text-sm">
              Buat artikel catur bergaya Chess.com — drag-drop, highlight, panah, hint langkah,
              tabel. Output HTML + ZIP.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={downloadZipProject}
              disabled={isZipping}
              className="shrink-0 rounded-lg bg-slate-800 px-4 py-2 text-sm font-bold text-white shadow transition hover:bg-slate-700 disabled:opacity-60"
            >
              {isZipping ? "⏳ Membuat ZIP..." : "📦 Download ZIP"}
            </button>
            <button
              onClick={copyCode}
              className={`shrink-0 rounded-lg px-4 py-2 text-sm font-bold text-white shadow transition ${
                copied ? "bg-emerald-600" : "bg-[#81b64c] hover:bg-[#6da03d]"
              }`}
            >
              {copied ? "✓ Tersalin!" : "📋 Copy Full HTML"}
            </button>
          </div>
        </header>

        {/* ── Section Tabs ────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-stone-300 bg-white p-2.5 shadow-sm">
          <span className="text-xs font-bold uppercase text-slate-400">Bagian:</span>
          {sections.map((sec) => (
            <button
              key={sec.id}
              onClick={() => setActiveSectionId(sec.id)}
              className={`rounded px-3 py-1.5 text-xs font-bold transition ${
                activeSectionId === sec.id
                  ? "bg-[#81b64c] text-white shadow"
                  : "bg-stone-100 text-slate-600 hover:bg-stone-200"
              }`}
            >
              {sec.sectionNumber}. {sec.sectionTitle.substring(0, 18)}
              {sec.sectionTitle.length > 18 ? "…" : ""}
            </button>
          ))}
          <button
            onClick={addSection}
            className="rounded border border-dashed border-[#81b64c] bg-green-50 px-3 py-1.5 text-xs font-bold text-[#81b64c] transition hover:bg-green-100"
          >
            + Tambah
          </button>
        </div>

        {/* ── Editor + Board ──────────────────────────── */}
        <section className="grid gap-5 lg:grid-cols-[1fr_auto]">
          {/* Left: Editor */}
          <div className="space-y-3 rounded-lg border border-stone-300 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Editor — Bagian {activeSection.sectionNumber}
              </h2>
              <div className="flex gap-1.5">
                <button
                  onClick={() => duplicateSection(activeSectionId)}
                  className="rounded bg-stone-100 px-2 py-1 text-[10px] font-semibold text-slate-500 hover:bg-stone-200"
                >
                  ⧉ Duplikasi
                </button>
                <button
                  onClick={() => removeSection(activeSectionId)}
                  className="rounded bg-red-50 px-2 py-1 text-[10px] font-semibold text-red-500 hover:bg-red-100"
                >
                  🗑 Hapus
                </button>
              </div>
            </div>

            {/* Form */}
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-[11px] font-bold text-slate-500">Nomor</span>
                <input
                  value={activeSection.sectionNumber}
                  onChange={(e) =>
                    updateSection(activeSectionId, { sectionNumber: e.target.value })
                  }
                  className="w-full rounded border border-stone-300 px-2.5 py-1.5 text-sm outline-none focus:border-[#81b64c]"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[11px] font-bold text-slate-500">Judul</span>
                <input
                  value={activeSection.sectionTitle}
                  onChange={(e) =>
                    updateSection(activeSectionId, { sectionTitle: e.target.value })
                  }
                  className="w-full rounded border border-stone-300 px-2.5 py-1.5 text-sm outline-none focus:border-[#81b64c]"
                />
              </label>
            </div>

            <label className="block space-y-1">
              <span className="text-[11px] font-bold text-slate-500">Deskripsi</span>
              <textarea
                value={activeSection.description}
                onChange={(e) =>
                  updateSection(activeSectionId, { description: e.target.value })
                }
                rows={3}
                className="w-full rounded border border-stone-300 px-2.5 py-1.5 text-sm outline-none focus:border-[#81b64c]"
              />
            </label>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-[11px] font-bold text-slate-500">Judul Teks</span>
                <input
                  value={activeSection.movementTitle}
                  onChange={(e) =>
                    updateSection(activeSectionId, { movementTitle: e.target.value })
                  }
                  className="w-full rounded border border-stone-300 px-2.5 py-1.5 text-sm outline-none focus:border-[#81b64c]"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[11px] font-bold text-slate-500">Layout Panel</span>
                <select
                  value={
                    !activeSection.showBoardPanel
                      ? "text-only"
                      : activeSection.showPieceValueTable
                        ? activeSection.boardPlacement === "left"
                          ? "table-left"
                          : "table-right"
                        : activeSection.boardPlacement === "left"
                          ? "board-left"
                          : "board-right"
                  }
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "text-only") {
                      updateSection(activeSectionId, {
                        showBoardPanel: false,
                        showPieceValueTable: false,
                      });
                    } else if (v === "board-left" || v === "board-right") {
                      updateSection(activeSectionId, {
                        showBoardPanel: true,
                        showPieceValueTable: false,
                        boardPlacement: v === "board-left" ? "left" : "right",
                      });
                    } else {
                      updateSection(activeSectionId, {
                        showBoardPanel: true,
                        showPieceValueTable: true,
                        boardPlacement: v === "table-left" ? "left" : "right",
                      });
                    }
                  }}
                  className="w-full rounded border border-stone-300 px-2.5 py-1.5 text-sm outline-none focus:border-[#81b64c]"
                >
                  <option value="board-right">📋 Teks kiri, Papan kanan</option>
                  <option value="board-left">Papan kiri, Teks kanan 📋</option>
                  <option value="table-right">📋 Teks kiri, Tabel kanan</option>
                  <option value="table-left">Tabel kiri, Teks kanan 📋</option>
                  <option value="text-only">Tanpa Panel</option>
                </select>
              </label>
            </div>

            <label className="block space-y-1">
              <span className="text-[11px] font-bold text-slate-500">
                Isi Teks{" "}
                <span className="font-normal text-slate-400">(1 baris = 1 paragraf)</span>
              </span>
              <textarea
                value={activeSection.movementText}
                onChange={(e) =>
                  updateSection(activeSectionId, { movementText: e.target.value })
                }
                rows={3}
                className="w-full rounded border border-stone-300 px-2.5 py-1.5 text-sm outline-none focus:border-[#81b64c]"
              />
            </label>

            {/* Edit Mode */}
            <div className="border-t border-stone-200 pt-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-bold uppercase text-slate-400">Mode:</span>
                {(["piece", "highlight", "arrow"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setEditMode(mode)}
                    className={`rounded px-2.5 py-1 text-[11px] font-bold transition ${
                      editMode === mode
                        ? "bg-[#81b64c] text-white shadow"
                        : "bg-stone-100 text-slate-500 hover:bg-stone-200"
                    }`}
                  >
                    {mode === "piece"
                      ? "🧩 Bidak"
                      : mode === "highlight"
                        ? "🟨 Highlight"
                        : "➡️ Panah"}
                  </button>
                ))}
              </div>

              {editMode === "highlight" && (
                <div className="mt-2 flex flex-wrap items-center gap-2 rounded bg-yellow-50 p-2 text-[11px]">
                  <span className="font-bold text-slate-500">Warna:</span>
                  <input
                    type="color"
                    value={highlightColor}
                    onChange={(e) => setHighlightColor(e.target.value)}
                    className="h-6 w-8 cursor-pointer border border-stone-300 p-0.5"
                  />
                  <span className="font-bold text-slate-500">Opacity:</span>
                  <input
                    type="number"
                    min={0.1}
                    max={1}
                    step={0.05}
                    value={highlightOpacity}
                    onChange={(e) => setHighlightOpacity(Number(e.target.value))}
                    className="w-14 rounded border border-stone-300 px-1.5 py-0.5 text-[11px]"
                  />
                  <span className="text-slate-400">Klik kotak papan</span>
                </div>
              )}
              {editMode === "arrow" && (
                <div className="mt-2 flex flex-wrap items-center gap-2 rounded bg-blue-50 p-2 text-[11px]">
                  <span className="font-bold text-slate-500">Warna:</span>
                  <input
                    type="color"
                    value={arrowColor}
                    onChange={(e) => setArrowColor(e.target.value)}
                    className="h-6 w-8 cursor-pointer border border-stone-300 p-0.5"
                  />
                  <span className="font-bold text-slate-500">Opacity:</span>
                  <input
                    type="number"
                    min={0.1}
                    max={1}
                    step={0.05}
                    value={arrowOpacity}
                    onChange={(e) => setArrowOpacity(Number(e.target.value))}
                    className="w-14 rounded border border-stone-300 px-1.5 py-0.5 text-[11px]"
                  />
                  <span className="text-slate-400">Klik asal → klik tujuan</span>
                </div>
              )}
              {editMode === "piece" && (
                <p className="mt-2 rounded bg-green-50 p-2 text-[11px] text-slate-500">
                  Tarik dari baki → papan. Tarik di papan → pindah.{" "}
                  <strong>Klik kanan</strong> → hapus. Klik bidak = hint langkah.
                </p>
              )}
            </div>

            {/* Quick Buttons */}
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => {
                  updateSection(activeSectionId, {
                    pieces: createStartingPosition(),
                    moveHints: [],
                    hintSourceSquare: null,
                  });
                  setStatusMessage("Posisi awal dimuat");
                }}
                className="rounded border border-[#81b64c] bg-green-50 px-2 py-1 text-[10px] font-bold text-[#81b64c] hover:bg-green-100"
              >
                ♟ Posisi Awal
              </button>
              <button
                onClick={() => {
                  updateSection(activeSectionId, {
                    pieces: [],
                    highlights: [],
                    arrows: [],
                    moveHints: [],
                    hintSourceSquare: null,
                  });
                  setStatusMessage("Papan bersih");
                }}
                className="rounded border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-bold text-red-500 hover:bg-red-100"
              >
                🗑 Hapus Semua
              </button>
              <button
                onClick={() =>
                  updateSection(activeSectionId, {
                    pieces: [],
                    moveHints: [],
                    hintSourceSquare: null,
                  })
                }
                className="rounded border border-stone-200 px-2 py-1 text-[10px] font-semibold text-slate-500 hover:bg-stone-100"
              >
                Hapus Bidak
              </button>
              <button
                onClick={() =>
                  updateSection(activeSectionId, {
                    moveHints: [],
                    hintSourceSquare: null,
                  })
                }
                className="rounded border border-stone-200 px-2 py-1 text-[10px] font-semibold text-slate-500 hover:bg-stone-100"
              >
                Hapus Hint
              </button>
              <button
                onClick={() => updateSection(activeSectionId, { highlights: [] })}
                className="rounded border border-stone-200 px-2 py-1 text-[10px] font-semibold text-slate-500 hover:bg-stone-100"
              >
                Hapus Highlight
              </button>
              <button
                onClick={() => updateSection(activeSectionId, { arrows: [] })}
                className="rounded border border-stone-200 px-2 py-1 text-[10px] font-semibold text-slate-500 hover:bg-stone-100"
              >
                Hapus Panah
              </button>
            </div>

            {/* Summary Lists */}
            <div className="grid gap-2 text-[11px] text-slate-500 md:grid-cols-3">
              <div>
                <p className="font-bold text-slate-700">
                  Bidak ({activeSection.pieces.length})
                </p>
                {activeSection.pieces.length === 0 && (
                  <p className="italic text-slate-400">—</p>
                )}
                <div className="max-h-24 overflow-y-auto">
                  {activeSection.pieces.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between border-b border-stone-100 py-px"
                    >
                      <span>
                        {pieceSymbols[p.side][p.type]}{" "}
                        <span className="font-mono">{p.square}</span>
                      </span>
                      <button
                        onClick={() => handlePieceRemove(p.id)}
                        className="text-red-400 hover:text-red-600"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="font-bold text-slate-700">
                  Highlight ({activeSection.highlights.length})
                </p>
                {activeSection.highlights.length === 0 && (
                  <p className="italic text-slate-400">—</p>
                )}
                <div className="max-h-24 overflow-y-auto">
                  {activeSection.highlights.map((h) => (
                    <div
                      key={h.id}
                      className="flex items-center justify-between border-b border-stone-100 py-px"
                    >
                      <span className="flex items-center gap-1">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-sm"
                          style={{ background: h.color }}
                        />
                        <span className="font-mono">{h.square}</span>
                      </span>
                      <button
                        onClick={() =>
                          updateSection(activeSectionId, {
                            highlights: activeSection.highlights.filter(
                              (x) => x.id !== h.id
                            ),
                          })
                        }
                        className="text-red-400 hover:text-red-600"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="font-bold text-slate-700">
                  Panah ({activeSection.arrows.length})
                </p>
                {activeSection.arrows.length === 0 && (
                  <p className="italic text-slate-400">—</p>
                )}
                <div className="max-h-24 overflow-y-auto">
                  {activeSection.arrows.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between border-b border-stone-100 py-px"
                    >
                      <span className="flex items-center gap-1">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-sm"
                          style={{ background: a.color }}
                        />
                        <span className="font-mono">
                          {a.from}→{a.to}
                        </span>
                      </span>
                      <button
                        onClick={() =>
                          updateSection(activeSectionId, {
                            arrows: activeSection.arrows.filter((x) => x.id !== a.id),
                          })
                        }
                        className="text-red-400 hover:text-red-600"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {statusMessage && (
              <p className="rounded border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-medium text-emerald-700">
                {statusMessage}
              </p>
            )}
          </div>

          {/* Right: Board + Trays */}
          <div className="flex w-[380px] max-w-full flex-col items-center gap-2 rounded-lg border border-stone-300 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Bidak Hitam
            </p>
            <PieceTray side="black" onDragStart={(item) => setDragItem(item)} />

            <InteractiveBoard
              pieces={activeSection.pieces}
              highlights={activeSection.highlights}
              arrows={activeSection.arrows}
              moveHints={activeSection.moveHints}
              hintSourceSquare={activeSection.hintSourceSquare}
              onPieceDrop={handlePieceDrop}
              onPieceMove={handlePieceMove}
              onPieceRemove={handlePieceRemove}
              dragItem={dragItem}
              setDragItem={setDragItem}
              onHighlightToggle={handleHighlightToggle}
              onArrowDraw={handleArrowDraw}
              onPieceHint={handlePieceHint}
              editMode={editMode}
            />

            <PieceTray side="white" onDragStart={(item) => setDragItem(item)} />
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Bidak Putih
            </p>

            {/* Table Editor (when table mode) */}
            {activeSection.showBoardPanel && activeSection.showPieceValueTable && (
              <div className="w-full space-y-2 border-t border-stone-200 pt-3">
                <p className="text-[11px] font-bold text-slate-500">Editor Tabel</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="space-y-1">
                    <span className="block text-[11px] font-semibold text-slate-500">
                      Kolom
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={8}
                      value={activeSection.tableColumnCount}
                      onChange={(e) =>
                        updateTableShape(
                          activeSection.tableRowCount,
                          Number(e.target.value) || 1
                        )
                      }
                      className="w-full rounded border border-stone-300 px-2 py-1.5 text-sm outline-none focus:border-[#81b64c]"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="block text-[11px] font-semibold text-slate-500">
                      Baris
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={activeSection.tableRowCount}
                      onChange={(e) =>
                        updateTableShape(
                          Number(e.target.value) || 1,
                          activeSection.tableColumnCount
                        )
                      }
                      className="w-full rounded border border-stone-300 px-2 py-1.5 text-sm outline-none focus:border-[#81b64c]"
                    />
                  </label>
                </div>
                <div className="max-h-64 w-full overflow-auto rounded border border-stone-300">
                  <table className="min-w-max border-collapse text-xs">
                    <tbody>
                      {editorTableGrid.map((row, rowIdx) => (
                        <tr key={`erow-${rowIdx}`}>
                          <td className="w-6 border border-stone-200 bg-stone-50 px-1 py-0.5 text-center text-[9px] font-bold text-slate-400">
                            {rowIdx === 0 ? "H" : rowIdx}
                          </td>
                          {row.map((cell, colIdx) => (
                            <td
                              key={`ecell-${rowIdx}-${colIdx}`}
                              className="border border-stone-300 p-0.5"
                            >
                              <input
                                value={cell}
                                onChange={(e) =>
                                  updateTableCell(rowIdx, colIdx, e.target.value)
                                }
                                className="w-full min-w-[60px] border-0 bg-transparent px-1 py-1 text-xs outline-none"
                                placeholder={rowIdx === 0 ? `Header ${colIdx + 1}` : ""}
                              />
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

        {/* ── Preview + Code ──────────────────────────── */}
        <section className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
          {/* Preview */}
          <article className="overflow-hidden rounded-lg border border-stone-300 bg-white shadow-sm">
            <div className="bg-[#81b64c] px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-white">
              Preview (220×220)
            </div>
            <div
              className="p-6"
              style={{
                fontFamily: "'Nunito', sans-serif",
                color: "#312e2b",
              }}
            >
              <div className="mb-4 flex items-center gap-3">
                <span className="rounded bg-[#81b64c] px-2.5 py-0.5 text-2xl font-extrabold text-white">
                  {activeSection.sectionNumber}
                </span>
                <h3
                  className="text-xl font-extrabold uppercase leading-tight"
                  style={{ color: "#81b64c" }}
                >
                  {activeSection.sectionTitle}
                </h3>
              </div>

              <p className="mb-6 text-sm leading-snug text-gray-600">
                {activeSection.description}
              </p>

              <div
                className={`flex flex-col gap-6 ${
                  activeSection.boardPlacement === "left"
                    ? "md:flex-row-reverse"
                    : "md:flex-row"
                }`}
              >
                <div className="flex-1">
                  <h4
                    className="mb-2 text-lg font-extrabold uppercase leading-tight"
                    style={{ color: "#81b64c" }}
                  >
                    {activeSection.movementTitle}
                  </h4>
                  <p className="text-sm leading-relaxed text-gray-600">
                    {movementItems.map((item, i) => (
                      <span key={i}>
                        {item}
                        <br />
                      </span>
                    ))}
                  </p>
                </div>

                {activeSection.showBoardPanel &&
                  (activeSection.showPieceValueTable ? (
                    <div className="relative shrink-0" style={{ width: 220 }}>
                      <table className="w-full border border-gray-300 text-left text-xs text-gray-700">
                        <thead className="bg-gray-100">
                          <tr>
                            {(editorTableGrid[0] ?? []).map((h, i) => (
                              <th
                                key={`ph-${i}`}
                                className="border border-gray-300 px-2 py-1.5"
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {editorTableGrid.slice(1).map((row, ri) => (
                            <tr key={`pr-${ri}`}>
                              {row.map((cell, ci) => (
                                <td
                                  key={`pc-${ri}-${ci}`}
                                  className="border border-gray-300 px-2 py-1.5"
                                >
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div
                      className="relative shrink-0"
                      style={{ width: 220, height: 220 }}
                    >
                      <svg viewBox="0 0 200 200" className="h-full w-full">
                        <rect width={200} height={200} fill="#769656" />
                        <g fill="#eeeed2">
                          {lightSquarePositions.map((sq) => (
                            <rect
                              key={`${sq.x}-${sq.y}`}
                              width={svgSqSize}
                              height={svgSqSize}
                              x={sq.x}
                              y={sq.y}
                            />
                          ))}
                        </g>
                        {activeSection.highlights.map((h) => {
                          const { x, y } = squareToCoordSVG(h.square);
                          return (
                            <rect
                              key={h.id}
                              x={x}
                              y={y}
                              width={svgSqSize}
                              height={svgSqSize}
                              fill={h.color}
                              fillOpacity={h.opacity}
                            />
                          );
                        })}
                        {activeSection.pieces.map((p) => {
                          const { centerX, centerY } = squareToCoordSVG(p.square);
                          return (
                            <text
                              key={p.id}
                              x={centerX}
                              y={centerY}
                              fontSize="20"
                              fill={p.side === "white" ? "white" : "black"}
                              textAnchor="middle"
                              dominantBaseline="central"
                            >
                              {pieceSymbols[p.side][p.type]}
                            </text>
                          );
                        })}
                        {activeSection.arrows.map((a) => (
                          <ArrowPolygonSVG key={a.id} arrow={a} idPrefix="pv" />
                        ))}
                      </svg>

                      {/* Hint dots in preview */}
                      <div className="pointer-events-none absolute inset-0">
                        {activeSection.moveHints.map((square) => {
                          const pos = squareToHintPosition(square);
                          const isCapture = activeSection.pieces.some(
                            (p) => p.square === square
                          );
                          return (
                            <div
                              key={`pvh-${square}`}
                              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full ${
                                isCapture
                                  ? "border-[3px] border-black/30 bg-transparent"
                                  : "bg-black/30"
                              }`}
                              style={{
                                left: pos.left,
                                top: pos.top,
                                width: isCapture ? 22 : 10,
                                height: isCapture ? 22 : 10,
                              }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </article>

          {/* Code Output */}
          <article className="flex flex-col rounded-lg border border-stone-300 bg-white shadow-sm">
            <div className="flex items-center justify-between bg-stone-800 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-widest text-stone-400">
                  HTML
                </span>
                <span className="text-[10px] text-stone-500">
                  {outputCode.length.toLocaleString()} chars
                </span>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={outputMode}
                  onChange={(e) =>
                    setOutputMode(e.target.value as "pretty" | "minified")
                  }
                  className="rounded border border-stone-600 bg-stone-700 px-2 py-1 text-[11px] font-semibold text-stone-200 outline-none"
                >
                  <option value="pretty">Pretty</option>
                  <option value="minified">Minified</option>
                </select>
                <button
                  onClick={copyCode}
                  className={`rounded px-3 py-1 text-[11px] font-bold text-white transition ${
                    copied ? "bg-emerald-600" : "bg-[#81b64c] hover:bg-[#6da03d]"
                  }`}
                >
                  {copied ? "✓ Tersalin!" : "📋 Copy"}
                </button>
              </div>
            </div>
            <textarea
              readOnly
              value={outputCode}
              className="flex-1 border-0 bg-stone-900 p-4 font-mono text-[11px] leading-relaxed text-green-400 outline-none"
              style={{ minHeight: 480 }}
            />
          </article>
        </section>
      </div>
    </main>
  );
}