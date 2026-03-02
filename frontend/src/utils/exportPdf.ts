import jsPDF from 'jspdf';
import type { CanvasConfig, Layer, DmcColor, StitchCell, ColorCount } from '../types';
import { assignSymbols } from '../data/symbolSet';

// ── helpers ──

export function gatherVisibleCells(layers: Layer[]): Record<string, StitchCell> {
  const merged: Record<string, StitchCell> = {};
  for (const layer of layers) {
    if (!layer.visible) continue;
    for (const [key, cell] of Object.entries(layer.cells)) {
      if (cell.color) merged[key] = cell;
    }
  }
  return merged;
}

function computeColorCounts(
  cells: Record<string, StitchCell>,
  meshCount: number,
  palette: DmcColor[],
): ColorCount[] {
  const counts = new Map<string, { hex: string; name: string; stitchCount: number }>();

  for (const cell of Object.values(cells)) {
    const id = cell.dmcNumber ?? cell.color ?? '';
    if (!id) continue;
    const existing = counts.get(id);
    if (existing) {
      existing.stitchCount++;
    } else {
      const palEntry = palette.find(c => c.number === id);
      counts.set(id, {
        hex: cell.color ?? '#000000',
        name: palEntry?.name ?? id,
        stitchCount: 1,
      });
    }
  }

  const stitchesPerInch = meshCount;
  const strandLength = 18; // inches per cut length
  const stitchCoverage = 1.5; // inches of thread per stitch (front + back)

  const result: ColorCount[] = [];
  for (const [dmcNumber, data] of counts) {
    const sqIn = data.stitchCount / (stitchesPerInch * stitchesPerInch);
    const totalInches = data.stitchCount * stitchCoverage;
    const yards = totalInches / 36;
    const skeins = Math.ceil(yards / (8.7)); // 8.7 yards per DMC skein
    result.push({
      dmcNumber,
      name: data.name,
      hex: data.hex,
      stitchCount: data.stitchCount,
      squareInches: Math.round(sqIn * 10) / 10,
      yardage: Math.round(yards * 10) / 10,
      skeins,
    });
  }

  result.sort((a, b) => b.stitchCount - a.stitchCount);
  return result;
}

// ── PNG export ──

export function exportPng(
  stage: { toDataURL(opts?: { pixelRatio?: number }): string },
  projectName: string,
) {
  const dataUrl = stage.toDataURL({ pixelRatio: 2 });
  const link = document.createElement('a');
  link.download = `${projectName || 'needlepoint'}.png`;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ── PDF export ──

interface ExportPdfOptions {
  config: CanvasConfig;
  layers: Layer[];
  palette: DmcColor[];
  projectName: string;
  includeColor: boolean;
}

export function exportPdf({
  config,
  layers,
  palette,
  projectName,
  includeColor,
}: ExportPdfOptions) {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
  const pageW = pdf.internal.pageSize.getWidth();   // 612
  const pageH = pdf.internal.pageSize.getHeight();   // 792
  const margin = 36; // 0.5 inch
  const usableW = pageW - margin * 2;
  const usableH = pageH - margin * 2;

  const cells = gatherVisibleCells(layers);
  const colorCounts = computeColorCounts(cells, config.meshCount, palette);
  const dmcNumbers = colorCounts.map(c => c.dmcNumber);
  const symbolMap = assignSymbols(dmcNumbers);

  const name = projectName || 'Untitled Design';
  const physW = (config.width / config.meshCount).toFixed(1);
  const physH = (config.height / config.meshCount).toFixed(1);

  // ── Page 1: Cover ──
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(24);
  pdf.text(name, pageW / 2, margin + 60, { align: 'center' });

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(12);
  const info = [
    `Dimensions: ${config.width} x ${config.height} stitches`,
    `Physical size: ${physW}" x ${physH}" (${config.meshCount}-count mesh)`,
    `Canvas fabric: ${(parseFloat(physW) + 6).toFixed(0)}" x ${(parseFloat(physH) + 6).toFixed(0)}" (design + 3" margin)`,
    `Colors: ${colorCounts.length} DMC colors`,
    `Total stitches: ${Object.keys(cells).length.toLocaleString()}`,
    `Generated: ${new Date().toLocaleDateString()}`,
  ];
  let y = margin + 100;
  for (const line of info) {
    pdf.text(line, pageW / 2, y, { align: 'center' });
    y += 18;
  }

  // Small color preview on cover
  const previewMaxW = Math.min(300, usableW);
  const previewCellSize = Math.min(previewMaxW / config.width, previewMaxW / config.height, 4);
  const prevW = config.width * previewCellSize;
  const prevH = config.height * previewCellSize;
  const prevX = (pageW - prevW) / 2;
  const prevY = y + 30;

  // Draw preview background
  pdf.setFillColor(255, 255, 255);
  pdf.setDrawColor(180, 180, 180);
  pdf.rect(prevX - 2, prevY - 2, prevW + 4, prevH + 4, 'FD');

  for (const [key, cell] of Object.entries(cells)) {
    if (!cell.color) continue;
    const [r, c] = key.split(',').map(Number);
    const hex = cell.color;
    const rr = parseInt(hex.slice(1, 3), 16);
    const gg = parseInt(hex.slice(3, 5), 16);
    const bb = parseInt(hex.slice(5, 7), 16);
    pdf.setFillColor(rr, gg, bb);
    pdf.rect(prevX + c * previewCellSize, prevY + r * previewCellSize, previewCellSize, previewCellSize, 'F');
  }

  // ── Pages 2+: Pattern Chart ──
  const chartCellSize = 10; // points per stitch cell in chart
  const cellsPerPageX = Math.floor(usableW / chartCellSize);
  const cellsPerPageY = Math.floor((usableH - 30) / chartCellSize); // 30pt for header
  const pagesX = Math.ceil(config.width / cellsPerPageX);
  const pagesY = Math.ceil(config.height / cellsPerPageY);

  for (let py = 0; py < pagesY; py++) {
    for (let px = 0; px < pagesX; px++) {
      pdf.addPage();
      const startCol = px * cellsPerPageX;
      const startRow = py * cellsPerPageY;
      const endCol = Math.min(startCol + cellsPerPageX, config.width);
      const endRow = Math.min(startRow + cellsPerPageY, config.height);
      const cols = endCol - startCol;
      const rows = endRow - startRow;

      // Page header
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      pdf.setTextColor(0, 0, 0);
      pdf.text(
        `${name} — Rows ${startRow + 1}-${endRow}, Cols ${startCol + 1}-${endCol}`,
        margin,
        margin + 10,
      );

      const gridX = margin;
      const gridY = margin + 24;

      // Draw cells
      for (let r = startRow; r < endRow; r++) {
        for (let c = startCol; c < endCol; c++) {
          const key = `${r},${c}`;
          const cell = cells[key];
          const cx = gridX + (c - startCol) * chartCellSize;
          const cy = gridY + (r - startRow) * chartCellSize;

          if (cell?.color && includeColor) {
            const hex = cell.color;
            const rr = parseInt(hex.slice(1, 3), 16);
            const gg = parseInt(hex.slice(3, 5), 16);
            const bb = parseInt(hex.slice(5, 7), 16);
            pdf.setFillColor(rr, gg, bb);
            pdf.rect(cx, cy, chartCellSize, chartCellSize, 'F');
          }

          // Symbol
          if (cell?.color) {
            const dmcKey = cell.dmcNumber ?? cell.color ?? '';
            const sym = symbolMap.get(dmcKey) ?? '?';
            pdf.setFont('courier', 'bold');
            pdf.setFontSize(7);
            if (includeColor) {
              // Light text on colored background
              const hex = cell.color;
              const rr = parseInt(hex.slice(1, 3), 16);
              const gg = parseInt(hex.slice(3, 5), 16);
              const bb = parseInt(hex.slice(5, 7), 16);
              const lum = 0.299 * rr + 0.587 * gg + 0.114 * bb;
              pdf.setTextColor(lum > 128 ? 0 : 255, lum > 128 ? 0 : 255, lum > 128 ? 0 : 255);
            } else {
              pdf.setTextColor(0, 0, 0);
            }
            pdf.text(sym, cx + chartCellSize / 2, cy + chartCellSize * 0.72, { align: 'center' });
          }
        }
      }

      // Grid lines
      pdf.setDrawColor(180, 180, 180);
      pdf.setLineWidth(0.25);
      for (let c = 0; c <= cols; c++) {
        const isGuide = (startCol + c) % 10 === 0;
        if (isGuide) {
          pdf.setDrawColor(80, 80, 80);
          pdf.setLineWidth(0.75);
        } else {
          pdf.setDrawColor(180, 180, 180);
          pdf.setLineWidth(0.25);
        }
        const lx = gridX + c * chartCellSize;
        pdf.line(lx, gridY, lx, gridY + rows * chartCellSize);
      }
      for (let r = 0; r <= rows; r++) {
        const isGuide = (startRow + r) % 10 === 0;
        if (isGuide) {
          pdf.setDrawColor(80, 80, 80);
          pdf.setLineWidth(0.75);
        } else {
          pdf.setDrawColor(180, 180, 180);
          pdf.setLineWidth(0.25);
        }
        const ly = gridY + r * chartCellSize;
        pdf.line(gridX, ly, gridX + cols * chartCellSize, ly);
      }

      // Row/col numbers every 10
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(6);
      pdf.setTextColor(100, 100, 100);
      for (let c = startCol; c < endCol; c++) {
        if (c % 10 === 0) {
          pdf.text(
            String(c + 1),
            gridX + (c - startCol) * chartCellSize + 1,
            gridY - 2,
          );
        }
      }
      for (let r = startRow; r < endRow; r++) {
        if (r % 10 === 0) {
          pdf.text(
            String(r + 1),
            gridX - 2,
            gridY + (r - startRow) * chartCellSize + chartCellSize * 0.7,
            { align: 'right' },
          );
        }
      }

      // Page number
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(120, 120, 120);
      pdf.text(
        `Page ${py * pagesX + px + 2}`,
        pageW / 2,
        pageH - margin / 2,
        { align: 'center' },
      );
    }
  }

  // ── Legend & Thread List ──
  pdf.addPage();
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.setTextColor(0, 0, 0);
  pdf.text('Color Legend & Thread List', margin, margin + 20);

  const tableTop = margin + 40;
  const colX = {
    swatch: margin,
    symbol: margin + 30,
    dmc: margin + 55,
    name: margin + 100,
    stitches: margin + 260,
    yards: margin + 330,
    skeins: margin + 390,
  };

  // Table header
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.text('Color', colX.swatch, tableTop);
  pdf.text('Sym', colX.symbol, tableTop);
  pdf.text('DMC #', colX.dmc, tableTop);
  pdf.text('Color Name', colX.name, tableTop);
  pdf.text('Stitches', colX.stitches, tableTop);
  pdf.text('Yards', colX.yards, tableTop);
  pdf.text('Skeins', colX.skeins, tableTop);

  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.5);
  pdf.line(margin, tableTop + 4, margin + 420, tableTop + 4);

  let ty = tableTop + 18;
  let totalYards = 0;
  let totalSkeins = 0;
  let totalStitches = 0;

  for (const cc of colorCounts) {
    if (ty > pageH - margin - 40) {
      pdf.addPage();
      ty = margin + 20;
    }

    // Color swatch
    const rr = parseInt(cc.hex.slice(1, 3), 16) || 0;
    const gg = parseInt(cc.hex.slice(3, 5), 16) || 0;
    const bb = parseInt(cc.hex.slice(5, 7), 16) || 0;
    pdf.setFillColor(rr, gg, bb);
    pdf.setDrawColor(150, 150, 150);
    pdf.setLineWidth(0.25);
    pdf.rect(colX.swatch, ty - 8, 18, 10, 'FD');

    // Symbol
    const sym = symbolMap.get(cc.dmcNumber) ?? '?';
    pdf.setFont('courier', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(0, 0, 0);
    pdf.text(sym, colX.symbol + 6, ty, { align: 'center' });

    // Text columns
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.text(cc.dmcNumber, colX.dmc, ty);
    pdf.text(cc.name.substring(0, 28), colX.name, ty);
    pdf.text(cc.stitchCount.toLocaleString(), colX.stitches, ty);
    pdf.text(cc.yardage.toFixed(1), colX.yards, ty);
    pdf.text(String(cc.skeins), colX.skeins, ty);

    totalYards += cc.yardage;
    totalSkeins += cc.skeins;
    totalStitches += cc.stitchCount;
    ty += 16;
  }

  // Totals
  ty += 8;
  if (ty > pageH - margin - 30) {
    pdf.addPage();
    ty = margin + 20;
  }
  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.5);
  pdf.line(margin, ty - 6, margin + 420, ty - 6);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.text('TOTAL', colX.name, ty + 4);
  pdf.text(totalStitches.toLocaleString(), colX.stitches, ty + 4);
  pdf.text(totalYards.toFixed(1), colX.yards, ty + 4);
  pdf.text(String(totalSkeins), colX.skeins, ty + 4);

  ty += 30;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text(
    `Recommended canvas: ${(parseFloat(physW) + 6).toFixed(0)}" x ${(parseFloat(physH) + 6).toFixed(0)}" ${config.meshCount}-count mono canvas`,
    margin,
    ty,
  );

  // Save
  pdf.save(`${name}.pdf`);
}

// ── Thread Shopping List (standalone PDF) ──

interface ThreadListOptions {
  config: CanvasConfig;
  layers: Layer[];
  palette: DmcColor[];
  projectName: string;
}

export function exportThreadList({
  config,
  layers,
  palette,
  projectName,
}: ThreadListOptions) {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 36;

  const cells = gatherVisibleCells(layers);
  const colorCounts = computeColorCounts(cells, config.meshCount, palette);
  const name = projectName || 'Untitled Design';
  const physW = (config.width / config.meshCount).toFixed(1);
  const physH = (config.height / config.meshCount).toFixed(1);

  // Title
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(20);
  pdf.setTextColor(0, 0, 0);
  pdf.text('Thread Shopping List', pageW / 2, margin + 30, { align: 'center' });

  // Project info
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(11);
  pdf.setTextColor(80, 80, 80);
  pdf.text(name, pageW / 2, margin + 52, { align: 'center' });
  pdf.setFontSize(10);
  pdf.text(
    `${config.width} x ${config.height} stitches | ${physW}" x ${physH}" | ${config.meshCount}-count mesh | ${colorCounts.length} colors`,
    pageW / 2, margin + 68, { align: 'center' }
  );

  // Table
  const tableTop = margin + 95;
  const col = {
    check: margin,
    swatch: margin + 20,
    dmc: margin + 48,
    name: margin + 100,
    yards: margin + 320,
    skeins: margin + 385,
  };

  // Header
  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.75);
  pdf.line(margin, tableTop + 5, pageW - margin, tableTop + 5);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(0, 0, 0);
  pdf.text('', col.check, tableTop);
  pdf.text('Color', col.swatch, tableTop);
  pdf.text('DMC #', col.dmc, tableTop);
  pdf.text('Color Name', col.name, tableTop);
  pdf.text('Yards', col.yards, tableTop);
  pdf.text('Skeins', col.skeins, tableTop);

  let y = tableTop + 22;
  let totalYards = 0;
  let totalSkeins = 0;

  for (const cc of colorCounts) {
    if (y > pageH - margin - 50) {
      pdf.addPage();
      y = margin + 20;
    }

    // Checkbox
    pdf.setDrawColor(150, 150, 150);
    pdf.setLineWidth(0.5);
    pdf.rect(col.check, y - 8, 10, 10);

    // Swatch
    const rr = parseInt(cc.hex.slice(1, 3), 16) || 0;
    const gg = parseInt(cc.hex.slice(3, 5), 16) || 0;
    const bb = parseInt(cc.hex.slice(5, 7), 16) || 0;
    pdf.setFillColor(rr, gg, bb);
    pdf.setDrawColor(150, 150, 150);
    pdf.setLineWidth(0.25);
    pdf.rect(col.swatch, y - 8, 18, 10, 'FD');

    // Text
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(0, 0, 0);
    pdf.text(cc.dmcNumber, col.dmc, y);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.text(cc.name.substring(0, 35), col.name, y);

    pdf.setFontSize(10);
    pdf.text(cc.yardage.toFixed(1), col.yards, y);
    pdf.setFont('helvetica', 'bold');
    pdf.text(String(cc.skeins), col.skeins, y);

    totalYards += cc.yardage;
    totalSkeins += cc.skeins;
    y += 20;
  }

  // Totals
  y += 6;
  if (y > pageH - margin - 40) {
    pdf.addPage();
    y = margin + 20;
  }
  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.75);
  pdf.line(margin, y - 8, pageW - margin, y - 8);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.text('TOTAL', col.name, y + 4);
  pdf.text(totalYards.toFixed(1), col.yards, y + 4);
  pdf.text(String(totalSkeins), col.skeins, y + 4);

  // Footer notes
  y += 30;
  if (y > pageH - margin - 60) {
    pdf.addPage();
    y = margin + 20;
  }
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(100, 100, 100);
  const notes = [
    `Canvas: ${(parseFloat(physW) + 6).toFixed(0)}" x ${(parseFloat(physH) + 6).toFixed(0)}" ${config.meshCount}-count mono canvas (design + 3" margin per side)`,
    'Thread estimate: ~1.5" per stitch (front + back). Buy 1 extra skein of dominant colors.',
    'DMC 6-strand cotton floss: 8.7 yards per skein.',
  ];
  for (const note of notes) {
    pdf.text(note, margin, y);
    y += 14;
  }

  pdf.save(`${name} - Thread List.pdf`);
}
