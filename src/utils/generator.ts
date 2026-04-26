import type { SectionData, BoardTheme } from "../types";
import {
  lightSquarePositions, svgSqSize, squareToCoordSVG, computeArrowPolygon, pieceSymbols,
  parseTableGrid, resizeTableGrid, boardThemes,
} from "./chess";

export function escapeHtml(text: string) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

export function parseMarkdownToHtml(text: string): string {
  let html = text
    .replace(/```([\s\S]*?)```/g, '<pre class="bg-gray-100 p-2 rounded text-xs overflow-x-auto">$1</pre>')
    .replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-1 py-0.5 rounded text-xs">$1</code>')
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/__(.+?)__/g, '<u>$1</u>')
    .replace(/^\s*-\s+(.+)$/gm, '<li>$1</li>')
    .replace(/^\s*\d+\.\s+(.+)$/gm, '<li>$1</li>');
  // Group consecutive <li> into <ul> BEFORE replacing \n with <br>
  html = html.replace(/(<li>.*?<\/li>(?:\n|<br>)?)+/g, (match) => `<ul class="list-disc pl-5 space-y-1">${match.replace(/\n|<br>/g, '')}</ul>`);
  html = html.replace(/\n/g, '<br>');
  return html;
}

export function minifyHtml(html: string) {
  return html.replace(/\n+/g," ").replace(/>\s+</g,"><").replace(/\s{2,}/g," ").trim();
}

function getThemeColors(theme: BoardTheme) {
  return boardThemes[theme] ?? boardThemes.green;
}

export function generateStandaloneSVG(sec: SectionData): string {
  const theme = getThemeColors(sec.boardTheme);
  const lr = lightSquarePositions.map(sq => `<rect width="${svgSqSize}" height="${svgSqSize}" x="${sq.x}" y="${sq.y}"/>`).join("");
  const hl = sec.highlights.map(h => { const c = squareToCoordSVG(h.square, sec.boardFlipped); return `<rect x="${c.x}" y="${c.y}" width="${svgSqSize}" height="${svgSqSize}" fill="${h.color}" fill-opacity="${h.opacity}"/>`; }).join("\n");
  const pc = sec.pieces.map(p => { const c = squareToCoordSVG(p.square, sec.boardFlipped); return `<text x="${c.centerX}" y="${c.centerY}" font-size="20" fill="${p.side === "white" ? "white" : "black"}" text-anchor="middle" dominant-baseline="central">${pieceSymbols[p.side][p.type]}</text>`; }).join("\n");
  const ar = sec.arrows.map(a => { const ap = computeArrowPolygon(a.from, a.to, sec.boardFlipped); return `<polygon transform="rotate(${ap.rotation.toFixed(2)} ${ap.cx.toFixed(2)} ${ap.cy.toFixed(2)})" points="${ap.points}" style="fill:${a.color};opacity:${a.opacity};"/>`; }).join("\n");
  return [`<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">`,`<rect width="200" height="200" fill="${theme.dark}"/>`,`<g fill="${theme.light}">${lr}</g>`,hl,pc,ar,`</svg>`].filter(s => s.trim()).join("\n");
}

export function generateSVG(sec: SectionData) {
  const theme = getThemeColors(sec.boardTheme);
  const lr = lightSquarePositions.map(sq => `<rect width="${svgSqSize}" height="${svgSqSize}" x="${sq.x}" y="${sq.y}"/>`).join("");
  const hl = sec.highlights.map(h => { const c = squareToCoordSVG(h.square, sec.boardFlipped); return `                        <rect x="${c.x}" y="${c.y}" width="${svgSqSize}" height="${svgSqSize}" fill="${h.color}" fill-opacity="${h.opacity}"/>`; }).join("\n");
  const pc = sec.pieces.map(p => { const c = squareToCoordSVG(p.square, sec.boardFlipped); return `                        <text x="${c.centerX}" y="${c.centerY}" font-size="20" fill="${p.side === "white" ? "white" : "black"}" text-anchor="middle" dominant-baseline="central">${pieceSymbols[p.side][p.type]}</text>`; }).join("\n");
  const ar = sec.arrows.map(a => { const ap = computeArrowPolygon(a.from, a.to, sec.boardFlipped); return `                        <polygon id="arrow-${a.from}${a.to}" data-arrow="${a.from}${a.to}" class="arrow" transform="rotate(${ap.rotation.toFixed(2)} ${ap.cx.toFixed(2)} ${ap.cy.toFixed(2)})" points="${ap.points}" style="fill: ${a.color}; opacity: ${a.opacity};"/>`; }).join("\n");
  return [
    `                    <svg viewBox="0 0 200 200" class="w-full h-full">`,
    `                        <rect width="200" height="200" fill="${theme.dark}"/>`,
    `                        <g fill="${theme.light}">${lr}</g>`,
    hl, pc, ar,
    `                    </svg>`,
  ].filter(s => s.trim()).join("\n");
}

export function generateHintLayer(sec: SectionData) {
  if (!sec.moveHints.length) return "";
  const divs = sec.moveHints.map(sq => {
    const c = squareToCoordSVG(sq, sec.boardFlipped);
    const pos = { left: `${((c.x / svgSqSize + 0.5) / 8) * 100}%`, top: `${((c.y / svgSqSize + 0.5) / 8) * 100}%` };
    const cap = sec.pieces.some(p => p.square === sq);
    const style = cap
      ? `left:${pos.left};top:${pos.top};width:27.5px;height:27.5px;border:4px solid rgba(0,0,0,0.3);background:transparent;border-radius:9999px;`
      : `left:${pos.left};top:${pos.top};`;
    return `                    <div class="hint" style="${style}"></div>`;
  }).join("\n");
  return `                <div class="hint-layer">\n${divs}\n                </div>`;
}

export function generateTableHtml(sec: SectionData) {
  const grid = resizeTableGrid(parseTableGrid(sec.tableRowsText), sec.tableRowCount, sec.tableColumnCount);
  const th = (grid[0]??[]).map(h => `<th class="border border-gray-300 px-3 py-2 text-left">${escapeHtml(h)}</th>`).join("");
  const tb = grid.slice(1).map(row => `                            <tr>${row.map(c => `<td class="border border-gray-300 px-3 py-2">${escapeHtml(c)}</td>`).join("")}</tr>`).join("\n");
  return [
    `                    <table class="w-full text-left text-sm text-gray-700 border border-gray-300">`,
    `                        <thead class="bg-gray-100"><tr>${th}</tr></thead>`,
    `                        <tbody>`, tb, `                        </tbody>`,
    `                    </table>`,
  ].join("\n");
}
