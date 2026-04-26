import { useMemo } from "react";
import type { Arrow } from "../types";
import { computeArrowPolygon } from "../utils/chess";

export default function ArrowPolygonSVG({ arrow, idPrefix, flipped = false }: { arrow: Arrow; idPrefix: string; flipped?: boolean }) {
  const { points, rotation, cx, cy } = useMemo(
    () => computeArrowPolygon(arrow.from, arrow.to, flipped),
    [arrow.from, arrow.to, flipped]
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
