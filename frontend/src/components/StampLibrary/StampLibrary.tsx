import { useState, useEffect, useRef } from 'react';
import { useStampStore } from '../../store/stampStore';
import { useCanvasStore } from '../../store/canvasStore';
import { convertImageToStitchCells, type DitherMode } from '../../utils/imageConvert';
import { LettersTab } from './LettersTab';
import './StampLibrary.css';

export function StampLibrary() {
  const stamps = useStampStore(s => s.stamps);
  const saveStamp = useStampStore(s => s.saveStamp);
  const saveFromCells = useStampStore(s => s.saveFromCells);
  const deleteStamp = useStampStore(s => s.deleteStamp);
  const loadToClipboard = useStampStore(s => s.loadToClipboard);

  const selection = useCanvasStore(s => s.selection);
  const hasSelection = selection && selection.size > 0;

  const [toast, setToast] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadUrl, setUploadUrl] = useState<string | null>(null);
  const [uploadSize, setUploadSize] = useState<{ w: number; h: number } | null>(null);
  const [uploadSettings, setUploadSettings] = useState({
    targetWidth: 50,
    targetHeight: 50,
    colorCount: 15,
    ditherMode: 'floyd-steinberg' as DitherMode,
    lockAspect: true,
  });
  const [converting, setConverting] = useState(false);
  const [tab, setTab] = useState<'designs' | 'letters'>('designs');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(timer);
  }, [toast]);

  const handleSave = () => {
    if (!hasSelection) return;
    const name = prompt('Name this design:', `Stamp ${stamps.length + 1}`);
    if (!name) return;
    const ok = saveStamp(name.trim() || `Stamp ${stamps.length + 1}`);
    if (ok) {
      setToast('Saved to library');
    }
  };

  const handleLoad = (id: string) => {
    loadToClipboard(id);
    setToast('Loaded — paste with Ctrl+V');
  };

  const handleDelete = (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    if (confirm(`Delete "${name}"?`)) {
      deleteStamp(id);
    }
  };

  // ─── Image Upload ──────────────────────────────────────────────

  const handleUploadFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setUploadSize({ w: img.naturalWidth, h: img.naturalHeight });
      const aspect = img.naturalWidth / img.naturalHeight;
      setUploadSettings(s => ({
        ...s,
        targetHeight: Math.round(s.targetWidth / aspect),
      }));
    };
    img.src = url;
    setUploadUrl(url);
  };

  const handleWidthChange = (w: number) => {
    if (uploadSettings.lockAspect && uploadSize) {
      const aspect = uploadSize.w / uploadSize.h;
      setUploadSettings(s => ({ ...s, targetWidth: w, targetHeight: Math.round(w / aspect) }));
    } else {
      setUploadSettings(s => ({ ...s, targetWidth: w }));
    }
  };

  const handleHeightChange = (h: number) => {
    if (uploadSettings.lockAspect && uploadSize) {
      const aspect = uploadSize.w / uploadSize.h;
      setUploadSettings(s => ({ ...s, targetHeight: h, targetWidth: Math.round(h * aspect) }));
    } else {
      setUploadSettings(s => ({ ...s, targetHeight: h }));
    }
  };

  const handleConvertAndSave = async () => {
    if (!uploadUrl) return;
    setConverting(true);
    try {
      const { cells, width, height } = await convertImageToStitchCells(
        uploadUrl,
        uploadSettings.targetWidth,
        uploadSettings.targetHeight,
        uploadSettings.colorCount,
        uploadSettings.ditherMode,
      );
      const name = prompt('Name this design:', `Image ${stamps.length + 1}`);
      if (!name) {
        setConverting(false);
        return;
      }
      saveFromCells(name.trim() || `Image ${stamps.length + 1}`, cells, width, height);
      setToast('Saved to library');
      closeUpload();
    } catch (err) {
      console.error('Image conversion failed:', err);
      setToast('Conversion failed');
    } finally {
      setConverting(false);
    }
  };

  const closeUpload = () => {
    if (uploadUrl) URL.revokeObjectURL(uploadUrl);
    setShowUpload(false);
    setUploadUrl(null);
    setUploadSize(null);
  };

  return (
    <div className="stamp-panel">
      <div className="stamp-header">
        <span className="stamp-title">
          Design Library
        </span>
      </div>

      <div className="stamp-tabs">
        <button
          className={`stamp-tab-btn ${tab === 'designs' ? 'active' : ''}`}
          onClick={() => setTab('designs')}
        >
          Designs{stamps.length > 0 ? ` (${stamps.length})` : ''}
        </button>
        <button
          className={`stamp-tab-btn ${tab === 'letters' ? 'active' : ''}`}
          onClick={() => setTab('letters')}
        >
          Letters
        </button>
      </div>

      {tab === 'letters' && <LettersTab />}

      {tab === 'designs' && <>
        <button
          className={`stamp-save-btn ${hasSelection ? 'has-selection' : ''}`}
          onClick={handleSave}
          disabled={!hasSelection}
          title={hasSelection ? 'Save selected cells to the design library' : 'Select cells first, then save'}
        >
          {hasSelection ? `Save Selection (${selection!.size})` : 'Save Selection'}
        </button>

        <button
          className="stamp-upload-btn"
          onClick={() => { setShowUpload(!showUpload); setUploadUrl(null); setUploadSize(null); }}
          title="Upload an image and convert to a reusable stamp"
        >
          Upload Image
        </button>

        {showUpload && (
          <div className="stamp-upload-form">
            {!uploadUrl ? (
              <div
                className="stamp-dropzone"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="stamp-dropzone-text">Click to choose image</div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={e => { if (e.target.files?.[0]) handleUploadFile(e.target.files[0]); }}
                />
              </div>
            ) : (
              <>
                <img className="stamp-upload-preview" src={uploadUrl} alt="Upload preview" />
                <div className="stamp-upload-row">
                  <label>W</label>
                  <input
                    type="number" min={5} max={200}
                    value={uploadSettings.targetWidth}
                    onChange={e => handleWidthChange(Number(e.target.value))}
                  />
                  <label>H</label>
                  <input
                    type="number" min={5} max={200}
                    value={uploadSettings.targetHeight}
                    onChange={e => handleHeightChange(Number(e.target.value))}
                  />
                </div>
                <div className="stamp-upload-row">
                  <label>
                    <input
                      type="checkbox"
                      checked={uploadSettings.lockAspect}
                      onChange={e => setUploadSettings(s => ({ ...s, lockAspect: e.target.checked }))}
                    />
                    Lock ratio
                  </label>
                </div>
                <div className="stamp-upload-row">
                  <label>Colors</label>
                  <input
                    type="number" min={2} max={50}
                    value={uploadSettings.colorCount}
                    onChange={e => setUploadSettings(s => ({ ...s, colorCount: Number(e.target.value) }))}
                  />
                </div>
                <div className="stamp-upload-row">
                  <label>Dither</label>
                  <select
                    value={uploadSettings.ditherMode}
                    onChange={e => setUploadSettings(s => ({ ...s, ditherMode: e.target.value as DitherMode }))}
                    className="stamp-upload-select"
                  >
                    <option value="none">None</option>
                    <option value="floyd-steinberg">Floyd-Steinberg</option>
                    <option value="ordered">Ordered</option>
                  </select>
                </div>
                <div className="stamp-upload-actions">
                  <button className="stamp-upload-cancel" onClick={closeUpload}>Cancel</button>
                  <button
                    className="stamp-upload-convert"
                    onClick={handleConvertAndSave}
                    disabled={converting}
                  >
                    {converting ? 'Converting...' : 'Convert & Save'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {toast && <div className="stamp-toast">{toast}</div>}

        <div className="stamp-list">
          {stamps.length === 0 && (
            <div className="stamp-empty">
              Select cells on the canvas and save them here for reuse across projects
            </div>
          )}
          {stamps.map(stamp => (
            <div
              key={stamp.id}
              className="stamp-item"
              onClick={() => handleLoad(stamp.id)}
              title={`${stamp.name} — ${stamp.width}x${stamp.height} — click to load`}
            >
              <img
                className="stamp-thumb"
                src={stamp.thumbnail}
                alt={stamp.name}
                draggable={false}
              />
              <div className="stamp-info">
                <div className="stamp-name">{stamp.name}</div>
                <div className="stamp-meta">{stamp.width}x{stamp.height}</div>
              </div>
              <button
                className="stamp-delete"
                onClick={e => handleDelete(e, stamp.id, stamp.name)}
                title="Delete"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </>}
    </div>
  );
}
