import { useMemo, useState, useCallback } from "react";
import type { Piece, Highlight, Arrow, DragItem, PieceSide, PieceType, BoardTheme } from "../types";
import {
  files, ranks, sqSize, boardSize, boardThemes,
  squareFromFileRank, squareToHintPosition, pieceSymbols,
} from "../utils/chess";
import ArrowPolygonSVG from "./ArrowPolygonSVG";

export default function InteractiveBoard({
  pieces, highlights, arrows, moveHints, hintSourceSquare,
  onPieceDrop, onPieceMove, onPieceRemove,
  dragItem, setDragItem,
  onHighlightToggle, onArrowDraw, onPieceHint, editMode,
  flipped, theme,
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
  flipped: boolean;
  theme: BoardTheme;
}) {
  const [hoverSquare, setHoverSquare] = useState<string | null>(null);
  const [arrowStart, setArrowStart] = useState<string | null>(null);
  const [arrowPreview, setArrowPreview] = useState<string | null>(null);

  const colors = boardThemes[theme] ?? boardThemes.green;

  const getPieceAt = useCallback(
    (square: string) => pieces.find((p) => p.square === square),
    [pieces]
  );

  const highlightMap = useMemo(() => {
    const map = new Map<string, Highlight>();
    highlights.forEach((h) => map.set(h.square, h));
    return map;
  }, [highlights]);

  const displayFiles = flipped ? [...files].reverse() : files;
  const displayRanks = flipped ? [...ranks].reverse() : ranks;

  return (
    <div className="inline-block select-none">
      <div className="flex" style={{ paddingLeft: 22 }}>
        {displayFiles.map((f) => (
          <div key={f} className="text-center text-[10px] font-bold text-slate-400" style={{ width: sqSize }}>{f}</div>
        ))}
      </div>
      <div className="flex">
        <div className="flex flex-col">
          {displayRanks.map((r) => (
            <div key={r} className="flex items-center justify-center text-[10px] font-bold text-slate-400" style={{ width: 22, height: sqSize }}>{r}</div>
          ))}
        </div>

        <div className="relative" style={{ width: boardSize, height: boardSize }}>
          <div
            className="grid border border-stone-500"
            style={{ gridTemplateColumns: `repeat(8, ${sqSize}px)`, gridTemplateRows: `repeat(8, ${sqSize}px)` }}
          >
            {displayRanks.map((_, rankIdx) =>
              displayFiles.map((_, fileIdx) => {
                const actualFileIdx = flipped ? 7 - fileIdx : fileIdx;
                const actualRankIdx = flipped ? 7 - rankIdx : rankIdx;
                const square = squareFromFileRank(actualFileIdx, actualRankIdx);
                const isLight = (actualRankIdx + actualFileIdx) % 2 === 0;
                const piece = getPieceAt(square);
                const isHover = hoverSquare === square;
                const isArrowSrc = arrowStart === square;
                const isArrowTgt = arrowPreview === square && arrowStart !== null;
                const hl = highlightMap.get(square);
                const isSelected = hintSourceSquare === square;

                let bg = isLight ? colors.light : colors.dark;
                if (isHover && dragItem) bg = isLight ? "#f5f5a0" : "#8aad5a";
                if (isArrowSrc) bg = "#f87171";
                if (isArrowTgt) bg = "#60a5fa";

                return (
                  <div
                    key={square}
                    className="relative flex items-center justify-center"
                    style={{ width: sqSize, height: sqSize, backgroundColor: bg, transition: "background-color 0.12s" }}
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setHoverSquare(square); }}
                    onDragLeave={() => setHoverSquare(null)}
                    onDrop={(e) => {
                      e.preventDefault(); setHoverSquare(null);
                      if (!dragItem) return;
                      if (dragItem.sourceSquare && dragItem.pieceId) {
                        if (dragItem.sourceSquare !== square) onPieceMove(dragItem.pieceId, square);
                      } else { onPieceDrop(dragItem.side, dragItem.type, square); }
                      setDragItem(null);
                    }}
                    onClick={() => {
                      if (editMode === "piece") onPieceHint(square);
                      else if (editMode === "highlight") onHighlightToggle(square);
                      else if (editMode === "arrow") {
                        if (!arrowStart) { setArrowStart(square); setArrowPreview(null); }
                        else { if (arrowStart !== square) onArrowDraw(arrowStart, square); setArrowStart(null); setArrowPreview(null); }
                      }
                    }}
                    onMouseEnter={() => { if (editMode === "arrow" && arrowStart) setArrowPreview(square); }}
                    onContextMenu={(e) => { e.preventDefault(); const p = getPieceAt(square); if (p) onPieceRemove(p.id); }}
                  >
                    {hl && <div className="pointer-events-none absolute inset-0" style={{ backgroundColor: hl.color, opacity: hl.opacity }} />}
                    {isSelected && <div className="pointer-events-none absolute inset-0 bg-yellow-400/40" />}
                    {piece && (
                      <span
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = "move";
                          setDragItem({ side: piece.side, type: piece.type, sourceSquare: piece.square, pieceId: piece.id });
                        }}
                        className="relative z-10 cursor-grab leading-none active:cursor-grabbing"
                        style={{
                          fontSize: sqSize * 0.72,
                          filter: piece.side === "white"
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

          <div className="pointer-events-none absolute inset-0">
            {moveHints.map((square) => {
              const pos = squareToHintPosition(square, flipped);
              const isCapture = pieces.some((p) => p.square === square);
              return (
                <div
                  key={`hint-${square}`}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full ${
                    isCapture ? "h-10 w-10 border-[6px] border-black/30 bg-transparent" : "h-3.5 w-3.5 bg-black/30"
                  }`}
                  style={{ left: pos.left, top: pos.top }}
                />
              );
            })}
          </div>

          <svg viewBox="0 0 200 200" className="pointer-events-none absolute inset-0 z-20 h-full w-full">
            {arrows.map((a) => <ArrowPolygonSVG key={a.id} arrow={a} idPrefix="ib" flipped={flipped} />)}
          </svg>
        </div>

        <div className="flex flex-col">
          {displayRanks.map((r) => (
            <div key={r} className="flex items-center justify-center text-[10px] font-bold text-slate-400" style={{ width: 22, height: sqSize }}>{r}</div>
          ))}
        </div>
      </div>
      <div className="flex" style={{ paddingLeft: 22 }}>
        {displayFiles.map((f) => (
          <div key={f} className="text-center text-[10px] font-bold text-slate-400" style={{ width: sqSize }}>{f}</div>
        ))}
      </div>
    </div>
  );
}
