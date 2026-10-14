import { useRef, useState } from 'react';
import Cropper, { type ReactCropperElement } from 'react-cropper';
import 'cropperjs/dist/cropper.css';
import Modal from './Modal';

interface Props {
  src: string;
  onSave: (blob: Blob) => void;
  onCancel: () => void;
}

export default function ImageEditor({ src, onSave, onCancel }: Props) {
  const cropperRef = useRef<ReactCropperElement>(null);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const cropper = () => cropperRef.current?.cropper;

  function flip(axis: 'x' | 'y') {
    const c = cropper();
    if (!c) return;
    const data = c.getImageData();
    if (axis === 'x') c.scaleX(data.scaleX === -1 ? 1 : -1);
    else c.scaleY(data.scaleY === -1 ? 1 : -1);
  }

  function reset() {
    cropper()?.reset();
    setBrightness(100);
    setContrast(100);
  }

  function save() {
    const canvas = cropper()?.getCroppedCanvas({ maxWidth: 800, maxHeight: 600 });
    if (!canvas) return;
    // Bake brightness/contrast into the exported image
    const out = document.createElement('canvas');
    out.width = canvas.width;
    out.height = canvas.height;
    const ctx = out.getContext('2d')!;
    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
    ctx.drawImage(canvas, 0, 0);
    out.toBlob((blob) => blob && onSave(blob), 'image/jpeg', 0.9);
  }

  const filter = `brightness(${brightness}%) contrast(${contrast}%)`;

  return (
    <Modal
      title="Edit photo"
      wide
      onClose={onCancel}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary" onClick={save}>Use photo</button>
        </>
      }
    >
      <div className="editor-canvas" style={{ filter }}>
        <Cropper ref={cropperRef} src={src} style={{ height: 340, width: '100%' }} viewMode={1} autoCropArea={1} responsive guides />
      </div>
      <div className="stack" style={{ gap: 'var(--space-3)' }}>
        <div className="row">
          <button className="btn btn-secondary btn-sm" onClick={() => cropper()?.rotate(-90)}>Rotate left</button>
          <button className="btn btn-secondary btn-sm" onClick={() => cropper()?.rotate(90)}>Rotate right</button>
          <button className="btn btn-secondary btn-sm" onClick={() => flip('x')}>Flip horizontal</button>
          <button className="btn btn-secondary btn-sm" onClick={() => flip('y')}>Flip vertical</button>
          <button className="btn btn-secondary btn-sm" onClick={() => cropper()?.zoom(0.1)}>Zoom in</button>
          <button className="btn btn-secondary btn-sm" onClick={() => cropper()?.zoom(-0.1)}>Zoom out</button>
          <button className="btn btn-ghost btn-sm" onClick={reset}>Reset</button>
        </div>
        <label className="slider-row">
          <span className="muted">Brightness</span>
          <input type="range" min={20} max={200} value={brightness} onChange={(e) => setBrightness(Number(e.target.value))} />
          <span className="num">{brightness}%</span>
        </label>
        <label className="slider-row">
          <span className="muted">Contrast</span>
          <input type="range" min={20} max={200} value={contrast} onChange={(e) => setContrast(Number(e.target.value))} />
          <span className="num">{contrast}%</span>
        </label>
      </div>
    </Modal>
  );
}
