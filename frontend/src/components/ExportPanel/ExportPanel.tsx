import { useState, useMemo, useRef } from 'react';
import { useCanvasStore } from '../../store/canvasStore';
import { exportPdf, exportPng, exportThreadList } from '../../utils/exportPdf';
import { getGlobalStage } from '../../utils/stageRef';
import {
  exportCanvasPrint,
  estimatePrintExport,
  getExportWarnings,
} from '../../utils/exportCanvasPrint';
import { exportWatermarkedPreview } from '../../utils/exportWatermarked';
import type { CanvasPrintConfig } from '../../types';
import './ExportPanel.css';

const SCALE_OPTIONS = [10, 15, 20, 25, 30] as const;

export function ExportPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [includeColor, setIncludeColor] = useState(true);

  // Print config state
  const [scaleFactor, setScaleFactor] = useState(20);
  const [marginTop, setMarginTop] = useState(3.0);
  const [marginBottom, setMarginBottom] = useState(3.0);
  const [marginLeft, setMarginLeft] = useState(3.0);
  const [marginRight, setMarginRight] = useState(3.0);
  const [printFormat, setPrintFormat] = useState<'tiff' | 'png'>('tiff');
  const [colorProfile, setColorProfile] = useState<'srgb' | 'adobe-rgb' | 'custom'>('srgb');
  const [embedIcc, setEmbedIcc] = useState(true);
  const [customIcc, setCustomIcc] = useState<ArrayBuffer | null>(null);
  const iccInputRef = useRef<HTMLInputElement>(null);

  const config = useCanvasStore(s => s.config);
  const layers = useCanvasStore(s => s.layers);
  const palette = useCanvasStore(s => s.palette);

  // Build print config from state
  const printConfig: CanvasPrintConfig = useMemo(() => ({
    meshCount: config.meshCount,
    scaleFactor,
    margins: { top: marginTop, bottom: marginBottom, left: marginLeft, right: marginRight },
    format: printFormat,
    colorProfile,
    customIccProfile: customIcc ?? undefined,
    embedIccProfile: embedIcc,
  }), [config.meshCount, scaleFactor, marginTop, marginBottom, marginLeft, marginRight, printFormat, colorProfile, customIcc, embedIcc]);

  // Live estimate
  const estimate = useMemo(
    () => estimatePrintExport(config, printConfig, layers),
    [config, printConfig, layers]
  );

  const warnings = useMemo(
    () => getExportWarnings(estimate, printConfig),
    [estimate, printConfig]
  );

  // ── Handlers ────────────────────────────────────────────────────────

  const handlePrintExport = () => {
    exportCanvasPrint(config, layers, printConfig);
  };

  const handleExportPdf = () => {
    exportPdf({
      config,
      layers,
      palette,
      projectName: 'Needlepoint Design',
      includeColor,
    });
  };

  const handleExportThreadList = () => {
    exportThreadList({
      config,
      layers,
      palette,
      projectName: 'Needlepoint Design',
    });
  };

  const handleExportPreviewPng = () => {
    const stage = getGlobalStage();
    if (!stage) return;
    exportPng(stage, 'needlepoint-preview');
  };

  const handleExportWatermarked = () => {
    exportWatermarkedPreview({
      config,
      layers,
      projectName: 'Needlepoint Design',
    });
  };

  const handleIccUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    file.arrayBuffer().then(buf => setCustomIcc(buf));
  };

  // ── Closed state ────────────────────────────────────────────────────

  if (!isOpen) {
    return (
      <button
        className="tool-btn"
        onClick={() => setIsOpen(true)}
        title="Export design"
      >
        Export...
      </button>
    );
  }

  // ── Open panel ──────────────────────────────────────────────────────

  return (
    <div className="export-panel">
      <div className="export-header">
        <span className="export-title">Export Design</span>
        <button className="export-close" onClick={() => setIsOpen(false)}>x</button>
      </div>

      {/* ─── Section 1: Canvas Print ───────────────────────────────── */}
      <div className="export-section">
        <div className="export-section-header">Canvas Print</div>
        <div className="export-section-desc">Production file for printing onto mesh canvas</div>

        {/* Info row: mesh + design size */}
        <div className="print-info-row">
          <span className="print-info-label">Mesh count:</span>
          <span className="print-info-value">{config.meshCount}-count</span>
        </div>
        <div className="print-info-row">
          <span className="print-info-label">Design:</span>
          <span className="print-info-value">{config.width} × {config.height} stitches</span>
        </div>

        {/* Scale factor */}
        <div className="print-field">
          <label className="print-field-label">Scale factor:</label>
          <select
            className="print-select"
            value={scaleFactor}
            onChange={e => setScaleFactor(Number(e.target.value))}
          >
            {SCALE_OPTIONS.map(s => (
              <option key={s} value={s}>{s}x{s === 20 ? ' (recommended)' : ''}</option>
            ))}
          </select>
        </div>

        {/* Margins */}
        <div className="print-field">
          <label className="print-field-label">Margins (inches):</label>
          <div className="margin-grid">
            <div className="margin-input-group">
              <span className="margin-label">T</span>
              <input type="number" className="margin-input" min="0" max="10" step="0.5"
                value={marginTop} onChange={e => setMarginTop(Number(e.target.value))} />
            </div>
            <div className="margin-input-group">
              <span className="margin-label">B</span>
              <input type="number" className="margin-input" min="0" max="10" step="0.5"
                value={marginBottom} onChange={e => setMarginBottom(Number(e.target.value))} />
            </div>
            <div className="margin-input-group">
              <span className="margin-label">L</span>
              <input type="number" className="margin-input" min="0" max="10" step="0.5"
                value={marginLeft} onChange={e => setMarginLeft(Number(e.target.value))} />
            </div>
            <div className="margin-input-group">
              <span className="margin-label">R</span>
              <input type="number" className="margin-input" min="0" max="10" step="0.5"
                value={marginRight} onChange={e => setMarginRight(Number(e.target.value))} />
            </div>
          </div>
        </div>

        {/* Format */}
        <div className="print-field">
          <label className="print-field-label">Format:</label>
          <div className="print-radio-group">
            <label className="print-radio">
              <input type="radio" name="print-format" value="tiff"
                checked={printFormat === 'tiff'} onChange={() => setPrintFormat('tiff')} />
              TIFF <span className="radio-hint">(recommended)</span>
            </label>
            <label className="print-radio">
              <input type="radio" name="print-format" value="png"
                checked={printFormat === 'png'} onChange={() => setPrintFormat('png')} />
              PNG
            </label>
          </div>
        </div>

        {/* Color Profile */}
        <div className="print-field">
          <label className="print-field-label">Color profile:</label>
          <select
            className="print-select"
            value={colorProfile}
            onChange={e => setColorProfile(e.target.value as 'srgb' | 'adobe-rgb' | 'custom')}
          >
            <option value="srgb">sRGB (default)</option>
            <option value="adobe-rgb">Adobe RGB</option>
            <option value="custom">Custom ICC...</option>
          </select>
        </div>

        {colorProfile === 'custom' && (
          <div className="print-field">
            <button className="print-upload-btn" onClick={() => iccInputRef.current?.click()}>
              {customIcc ? 'ICC profile loaded' : 'Upload .icc file'}
            </button>
            <input ref={iccInputRef} type="file" accept=".icc,.icm"
              style={{ display: 'none' }} onChange={handleIccUpload} />
          </div>
        )}

        <label className="export-checkbox">
          <input type="checkbox" checked={embedIcc} onChange={e => setEmbedIcc(e.target.checked)} />
          Embed ICC profile in file
        </label>

        {/* Live calculated info */}
        <div className="print-calc-box">
          <div className="print-calc-row">
            <span>DPI:</span>
            <span className="print-calc-value">{estimate.actualDpi} ({config.meshCount} × {scaleFactor})</span>
          </div>
          <div className="print-calc-row">
            <span>Image:</span>
            <span className="print-calc-value">{estimate.imageWidthPx.toLocaleString()} × {estimate.imageHeightPx.toLocaleString()} px</span>
          </div>
          <div className="print-calc-row">
            <span>Print size:</span>
            <span className="print-calc-value">
              {estimate.totalWidthIn}" × {estimate.totalHeightIn}"
              ({estimate.designWidthIn}" × {estimate.designHeightIn}" + margins)
            </span>
          </div>
          <div className="print-calc-row">
            <span>Est. file:</span>
            <span className="print-calc-value">~{estimate.estimatedFileSizeMb} MB</span>
          </div>
        </div>

        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="print-warnings">
            {warnings.map((w, i) => (
              <div key={i} className={`print-warning print-warning-${w.level}`}>
                {w.level === 'error' ? '!!' : w.level === 'warning' ? '!' : 'i'} {w.message}
              </div>
            ))}
          </div>
        )}

        <button className="export-action-btn" onClick={handlePrintExport}>
          Export for Canvas Printing
        </button>
      </div>

      {/* ─── Section 2: Pattern Chart (PDF) ────────────────────────── */}
      <div className="export-section">
        <div className="export-section-header">Pattern Chart</div>
        <div className="export-section-desc">Stitch guide with legend and thread list</div>

        <label className="export-checkbox">
          <input
            type="checkbox"
            checked={includeColor}
            onChange={e => setIncludeColor(e.target.checked)}
          />
          Color chart (vs. B&W symbols only)
        </label>

        <button className="export-action-btn export-action-secondary" onClick={handleExportPdf}>
          Export PDF
        </button>
      </div>

      {/* ─── Section 3: Thread Shopping List ─────────────────────────── */}
      <div className="export-section">
        <div className="export-section-header">Thread Shopping List</div>
        <div className="export-section-desc">Printable list of DMC threads with yardage and skein counts</div>

        <button className="export-action-btn export-action-secondary" onClick={handleExportThreadList}>
          Export Thread List PDF
        </button>
      </div>

      {/* ─── Section 4: Preview Images ─────────────────────────────── */}
      <div className="export-section">
        <div className="export-section-header">Preview Images</div>
        <div className="export-section-desc">For web, social media, and customer approval</div>

        <button className="export-action-btn export-action-secondary" onClick={handleExportPreviewPng}>
          Export Preview PNG
        </button>
        <button className="export-action-btn export-action-secondary" onClick={handleExportWatermarked} style={{ marginTop: 4 }}>
          Export Watermarked Preview
        </button>
      </div>
    </div>
  );
}
