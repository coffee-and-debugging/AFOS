import { useRef, useState, useCallback } from 'react';
import Cropper, { type ReactCropperElement } from 'react-cropper';
import 'cropperjs/dist/cropper.css';

interface Props {
  src: string;
  onSave: (blob: Blob) => void;
  onCancel: () => void;
}

export default function ImageEditor({ src, onSave, onCancel }: Props) {
  const cropperRef = useRef<ReactCropperElement>(null);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);

  const rotate = useCallback((deg: number) => {
    cropperRef.current?.cropper.rotate(deg);
  }, []);

  const zoom = useCallback((factor: number) => {
    cropperRef.current?.cropper.zoom(factor);
  }, []);

  const flipH = useCallback(() => {
    const c = cropperRef.current?.cropper;
    if (!c) return;
    const data = c.getImageData();
    c.scaleX(data.scaleX === -1 ? 1 : -1);
  }, []);

  const flipV = useCallback(() => {
    const c = cropperRef.current?.cropper;
    if (!c) return;
    const data = c.getImageData();
    c.scaleY(data.scaleY === -1 ? 1 : -1);
  }, []);

  const reset = useCallback(() => {
    cropperRef.current?.cropper.reset();
    setBrightness(100);
    setContrast(100);
  }, []);

  function handleSave() {
    const canvas = cropperRef.current?.cropper.getCroppedCanvas({ maxWidth: 800, maxHeight: 600 });
    if (!canvas) return;

    // Apply brightness/contrast via a second canvas
    const out = document.createElement('canvas');
    out.width = canvas.width;
    out.height = canvas.height;
    const ctx = out.getContext('2d')!;
    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
    ctx.drawImage(canvas, 0, 0);

    out.toBlob((blob) => {
      if (blob) onSave(blob);
    }, 'image/jpeg', 0.92);
  }

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }} onClick={onCancel}>
      <div className="modal" style={{ maxWidth: 720, width: '95vw' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Edit Image</h2>
          <button className="modal-close" onClick={onCancel}>&times;</button>
        </div>

        {/* Cropper */}
        <div style={{ background: '#111', borderRadius: 8, overflow: 'hidden', marginBottom: 12, filter: `brightness(${brightness}%) contrast(${contrast}%)` }}>
          <Cropper
            ref={cropperRef}
            src={src}
            style={{ height: 340, width: '100%' }}
            aspectRatio={NaN}
            viewMode={1}
            autoCropArea={1}
            responsive
            guides
          />
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* Rotate & Flip & Zoom row */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => rotate(-90)}>↺ 90°</button>
            <button className="btn btn-secondary btn-sm" onClick={() => rotate(90)}>↻ 90°</button>
            <button className="btn btn-secondary btn-sm" onClick={flipH}>⇄ Flip H</button>
            <button className="btn btn-secondary btn-sm" onClick={flipV}>⇅ Flip V</button>
            <button className="btn btn-secondary btn-sm" onClick={() => zoom(0.1)}>🔍+</button>
            <button className="btn btn-secondary btn-sm" onClick={() => zoom(-0.1)}>🔍−</button>
            <button className="btn btn-secondary btn-sm" onClick={reset}>Reset</button>
          </div>

          {/* Brightness */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 90, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Brightness</span>
            <input
              type="range" min={20} max={200} value={brightness}
              onChange={(e) => setBrightness(Number(e.target.value))}
              style={{ flex: 1 }}
            />
            <span style={{ width: 36, fontSize: '0.82rem', textAlign: 'right' }}>{brightness}%</span>
          </div>

          {/* Contrast */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 90, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Contrast</span>
            <input
              type="range" min={20} max={200} value={contrast}
              onChange={(e) => setContrast(Number(e.target.value))}
              style={{ flex: 1 }}
            />
            <span style={{ width: 36, fontSize: '0.82rem', textAlign: 'right' }}>{contrast}%</span>
          </div>
        </div>

        <div className="modal-footer" style={{ marginTop: 16 }}>
          <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>Apply & Use</button>
        </div>
      </div>
    </div>
  );
}
