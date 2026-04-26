import type { PieceSide, DragItem } from "../types";
import { allPieceTypes, pieceSymbols } from "../utils/chess";

export default function PieceTray({ side, onDragStart }: { side: PieceSide; onDragStart: (item: DragItem) => void }) {
  return (
    <div className="flex items-center justify-center gap-1.5 py-2">
      {allPieceTypes.map((type) => (
        <div
          key={`${side}-${type}`}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = "move";
            onDragStart({ side, type, sourceSquare: null, pieceId: null });
          }}
          className="flex h-9 w-9 cursor-grab items-center justify-center rounded-lg bg-stone-200 text-2xl shadow-sm transition hover:bg-stone-300 hover:shadow active:cursor-grabbing"
          title={`${side} ${type}`}
        >
          {pieceSymbols[side][type]}
        </div>
      ))}
    </div>
  );
}
