import type { Piece, PieceType, PieceSide, BoardTheme } from "../types";

export const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
export const ranks = [8, 7, 6, 5, 4, 3, 2, 1];
export const allPieceTypes: PieceType[] = ["king", "queen", "rook", "bishop", "knight", "pawn"];

export const pieceSymbols: Record<PieceSide, Record<PieceType, string>> = {
  white: { pawn: "♙", knight: "♘", bishop: "♗", rook: "♖", queen: "♕", king: "♔" },
  black: { pawn: "♟", knight: "♞", bishop: "♝", rook: "♜", queen: "♛", king: "♚" },
};

export const boardThemes: Record<BoardTheme, { light: string; dark: string; name: string }> = {
  green:  { light: "#eeeed2", dark: "#769656", name: "Hijau" },
  blue:   { light: "#dee3e6", dark: "#8ca2ad", name: "Biru" },
  brown:  { light: "#f0d9b5", dark: "#b58863", name: "Coklat" },
  purple: { light: "#e8e8ff", dark: "#7d6db5", name: "Ungu" },
  gray:   { light: "#e0e0e0", dark: "#888888", name: "Abu-abu" },
};

export const boardSize = 384;
export const sqSize = boardSize / 8;
export const svgSqSize = 200 / 8;

export const lightSquarePositions: { x: number; y: number }[] = [];
for (let row = 0; row < 8; row++) {
  for (let col = 0; col < 8; col++) {
    if ((row + col) % 2 === 0) {
      lightSquarePositions.push({ x: col * svgSqSize, y: row * svgSqSize });
    }
  }
}

export function squareToCoordSVG(square: string, flipped = false) {
  const n = square.toLowerCase();
  let fileIndex = files.indexOf(n[0]);
  let rankIndex = 8 - parseInt(n[1], 10);
  if (flipped) {
    fileIndex = 7 - fileIndex;
    rankIndex = 7 - rankIndex;
  }
  return {
    x: fileIndex * svgSqSize,
    y: rankIndex * svgSqSize,
    centerX: fileIndex * svgSqSize + svgSqSize / 2,
    centerY: rankIndex * svgSqSize + svgSqSize / 2,
  };
}

export function squareFromFileRank(fileIdx: number, rankIdx: number, flipped = false) {
  const fi = flipped ? 7 - fileIdx : fileIdx;
  const ri = flipped ? 7 - rankIdx : rankIdx;
  return `${files[fi]}${ranks[ri]}`;
}

export function squareToCoord(square: string) {
  const n = square.toLowerCase();
  return { fileIndex: files.indexOf(n[0]), rank: parseInt(n[1], 10) };
}

export function isInsideBoard(fileIndex: number, rank: number) {
  return fileIndex >= 0 && fileIndex < 8 && rank >= 1 && rank <= 8;
}

export function toSquare(fileIndex: number, rank: number) {
  return `${files[fileIndex]}${rank}`;
}

export function squareToHintPosition(square: string, flipped = false) {
  const { fileIndex, rank } = squareToCoord(square);
  const fi = flipped ? 7 - fileIndex : fileIndex;
  const ri = flipped ? 8 - rank : rank;
  return {
    left: `${((fi + 0.5) / 8) * 100}%`,
    top: `${((8 - ri + 0.5) / 8) * 100}%`,
  };
}

export function getPseudoLegalMoves(piece: Piece, pieces: Piece[]) {
  const { fileIndex, rank } = squareToCoord(piece.square);
  const occupied = new Map(pieces.map((p) => [p.square, p]));
  const results: string[] = [];

  if (piece.type === "pawn") {
    const dir = piece.side === "white" ? 1 : -1;
    const startRank = piece.side === "white" ? 2 : 7;
    if (isInsideBoard(fileIndex, rank + dir)) {
      const oneStep = toSquare(fileIndex, rank + dir);
      if (!occupied.has(oneStep)) {
        results.push(oneStep);
        if (rank === startRank && isInsideBoard(fileIndex, rank + dir * 2)) {
          const twoStep = toSquare(fileIndex, rank + dir * 2);
          if (!occupied.has(twoStep)) results.push(twoStep);
        }
      }
    }
    [fileIndex - 1, fileIndex + 1].forEach((df) => {
      const dr = rank + dir;
      if (!isInsideBoard(df, dr)) return;
      const sq = toSquare(df, dr);
      const target = occupied.get(sq);
      if (target && target.side !== piece.side) results.push(sq);
    });
    return results;
  }

  const pushIfValid = (tf: number, tr: number) => {
    if (!isInsideBoard(tf, tr)) return false;
    const target = toSquare(tf, tr);
    const blocker = occupied.get(target);
    if (!blocker) { results.push(target); return true; }
    if (blocker.side !== piece.side) results.push(target);
    return false;
  };

  if (piece.type === "knight") {
    [[1,2],[2,1],[2,-1],[1,-2],[-1,-2],[-2,-1],[-2,1],[-1,2]]
      .forEach(([dx, dy]) => pushIfValid(fileIndex + dx, rank + dy));
    return results;
  }

  if (piece.type === "king") {
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        if (dx || dy) pushIfValid(fileIndex + dx, rank + dy);
    return results;
  }

  const dirs: [number, number][] = [];
  if (piece.type === "rook" || piece.type === "queen")
    dirs.push([1,0],[-1,0],[0,1],[0,-1]);
  if (piece.type === "bishop" || piece.type === "queen")
    dirs.push([1,1],[1,-1],[-1,1],[-1,-1]);

  dirs.forEach(([dx, dy]) => {
    let nf = fileIndex + dx, nr = rank + dy;
    while (isInsideBoard(nf, nr)) {
      const sq = toSquare(nf, nr);
      const blocker = occupied.get(sq);
      if (!blocker) { results.push(sq); }
      else { if (blocker.side !== piece.side) results.push(sq); break; }
      nf += dx; nr += dy;
    }
  });

  return results;
}

export function computeArrowPolygon(fromSq: string, toSq: string, flipped = false) {
  const f = squareToCoordSVG(fromSq, flipped);
  const t = squareToCoordSVG(toSq, flipped);
  const dx = t.centerX - f.centerX, dy = t.centerY - f.centerY;
  const dist = Math.sqrt(dx*dx + dy*dy);
  const angleDeg = (Math.atan2(dx, -dy) * 180) / Math.PI;
  const cx = (f.centerX + t.centerX) / 2, cy = (f.centerY + t.centerY) / 2;
  const sw = 2.75, hw = 4.5, hl = 4.5;
  const half = dist / 2, pad = 3;
  const bot = half - pad, top = -(half - pad), hb = top + hl;
  const pts = [
    [cx-sw,cy+bot],[cx-sw,cy+hb],[cx-hw,cy+hb],
    [cx,cy+top],
    [cx+hw,cy+hb],[cx+sw,cy+hb],[cx+sw,cy+bot],
  ];
  return {
    points: pts.map(p => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(" "),
    rotation: angleDeg, cx, cy,
  };
}

export function createStartingPosition(): Piece[] {
  const p: Piece[] = [];
  const back: PieceType[] = ["rook","knight","bishop","queen","king","bishop","knight","rook"];
  for (let i = 0; i < 8; i++) {
    p.push({ id: uid(), square: `${files[i]}1`, side: "white", type: back[i] });
    p.push({ id: uid(), square: `${files[i]}2`, side: "white", type: "pawn" });
    p.push({ id: uid(), square: `${files[i]}7`, side: "black", type: "pawn" });
    p.push({ id: uid(), square: `${files[i]}8`, side: "black", type: back[i] });
  }
  return p;
}

// ─── FEN ───────────────────────────────────────────────────────────────

const fenPieceMap: Record<string, { side: PieceSide; type: PieceType }> = {
  p: { side: "black", type: "pawn" }, n: { side: "black", type: "knight" },
  b: { side: "black", type: "bishop" }, r: { side: "black", type: "rook" },
  q: { side: "black", type: "queen" }, k: { side: "black", type: "king" },
  P: { side: "white", type: "pawn" }, N: { side: "white", type: "knight" },
  B: { side: "white", type: "bishop" }, R: { side: "white", type: "rook" },
  Q: { side: "white", type: "queen" }, K: { side: "white", type: "king" },
};

export function parseFEN(fen: string): Piece[] | null {
  const parts = fen.trim().split(" ");
  const rows = parts[0].split("/");
  if (rows.length !== 8) return null;
  const pieces: Piece[] = [];
  for (let rankIdx = 0; rankIdx < 8; rankIdx++) {
    let fileIdx = 0;
    for (const ch of rows[rankIdx]) {
      const empty = parseInt(ch, 10);
      if (!isNaN(empty)) {
        fileIdx += empty;
      } else {
        const mapped = fenPieceMap[ch];
        if (!mapped) return null;
        pieces.push({ id: uid(), square: `${files[fileIdx]}${ranks[rankIdx]}`, side: mapped.side, type: mapped.type });
        fileIdx++;
      }
      if (fileIdx > 8) return null;
    }
  }
  return pieces;
}

export function generateFEN(pieces: Piece[]): string {
  const board: (string | null)[][] = Array.from({ length: 8 }, () => Array(8).fill(null));
  pieces.forEach(p => {
    const { fileIndex, rank } = squareToCoord(p.square);
    const rankIdx = 8 - rank;
    board[rankIdx][fileIndex] = p.type === "pawn" ? (p.side === "white" ? "P" : "p")
      : p.type === "knight" ? (p.side === "white" ? "N" : "n")
      : p.type === "bishop" ? (p.side === "white" ? "B" : "b")
      : p.type === "rook" ? (p.side === "white" ? "R" : "r")
      : p.type === "queen" ? (p.side === "white" ? "Q" : "q")
      : (p.side === "white" ? "K" : "k");
  });
  const rows = board.map(r => {
    let rowStr = "";
    let emptyCount = 0;
    for (const cell of r) {
      if (cell === null) {
        emptyCount++;
      } else {
        if (emptyCount > 0) { rowStr += emptyCount; emptyCount = 0; }
        rowStr += cell;
      }
    }
    if (emptyCount > 0) rowStr += emptyCount;
    return rowStr;
  });
  return rows.join("/") + " w - - 0 1";
}

// ─── Markdown ──────────────────────────────────────────────────────────

export function parseMarkdown(text: string): string {
  return text
    .replace(/```([\s\S]*?)```/g, '<pre class="bg-gray-100 p-2 rounded text-xs overflow-x-auto">$1</pre>')
    .replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-1 py-0.5 rounded text-xs">$1</code>')
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/__(.+?)__/g, '<u>$1</u>')
    .replace(/^\s*-\s+(.+)$/gm, '<li>$1</li>')
    .replace(/^\s*\d+\.\s+(.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul class="list-disc pl-5 space-y-1">${match}</ul>`)
    .replace(/\n/g, '<br>');
}

export function uid() { return Date.now() + Math.floor(Math.random() * 1_000_000); }

export function parseTableGrid(text: string) {
  return text.split("\n").map(l => l.trim()).filter(Boolean).map(l => l.split("|").map(c => c.trim()));
}

export function resizeTableGrid(grid: string[][], rows: number, cols: number) {
  const r = Math.max(1, rows), c = Math.max(1, cols);
  return Array.from({ length: r }, (_, ri) => Array.from({ length: c }, (_, ci) => grid[ri]?.[ci] ?? ""));
}

export function stringifyTableGrid(grid: string[][]) {
  return grid.map(row => row.map(c => c.trim()).join("|")).join("\n");
}
