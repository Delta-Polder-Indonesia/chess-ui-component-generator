export type PieceType = "pawn" | "knight" | "bishop" | "rook" | "queen" | "king";
export type PieceSide = "white" | "black";

export type Piece = {
  id: number;
  square: string;
  side: PieceSide;
  type: PieceType;
};

export type Highlight = {
  id: number;
  square: string;
  color: string;
  opacity: number;
};

export type Arrow = {
  id: number;
  from: string;
  to: string;
  color: string;
  opacity: number;
};

export type DragItem = {
  side: PieceSide;
  type: PieceType;
  sourceSquare: string | null;
  pieceId: number | null;
};

export type BoardTheme = "green" | "blue" | "brown" | "purple" | "gray";

export type SectionData = {
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
  boardTheme: BoardTheme;
};
