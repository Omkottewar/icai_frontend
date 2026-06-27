import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconX } from '../../icons';

// Lightweight image cropper modal. Opens with a freshly-picked File, lets
// the admin drag and resize a crop rectangle over the image (with aspect-
// ratio presets and optional explicit output pixels), and resolves with a
// base64 data URL + mime type ready to POST to /api/admin/files.
//
// Drag the crop box body → moves the selection.
// Drag the 8 handles → resizes from the corresponding edge / corner.
// Aspect ratio chips lock the box to a ratio (or "Free" lets either side go).
// Output size shows what the cropped image will actually be in pixels.
//
// Self-contained — no external dependency. The canvas extraction at confirm
// time produces a JPEG (lossy, smaller payload) for photos, or keeps PNG /
// WebP when the source uses one of those formats.

const ASPECTS = [
  { key: 'free',  label: 'Free',   ratio: null },
  { key: 'sq',    label: '1:1',    ratio: 1 },
  { key: 'wide',  label: '16:9',   ratio: 16 / 9 },
  { key: '43',    label: '4:3',    ratio: 4 / 3 },
  { key: 'port',  label: '3:4',    ratio: 3 / 4 },
];

// Cap the displayed image so the editor fits a typical drawer. The natural
// resolution is preserved internally — output uses the source pixels, not
// the display-scaled ones.
const MAX_DISPLAY = 560;

export default function ImageCropper({ file, onConfirm, onCancel, minWidth = 0, minHeight = 0 }) {
  const [imageBitmap, setImageBitmap] = useState(null);   // HTMLImageElement
  const [aspectKey,   setAspectKey]   = useState('free');
  const [crop,        setCrop]        = useState(null);   // { x, y, w, h } in NATURAL pixels
  const [busy,        setBusy]        = useState(false);
  const imgRef = useRef(null);
  const wrapperRef = useRef(null);
  const dragRef = useRef(null);   // {kind: 'move'|'nw'|..., startX, startY, startCrop}

  // Source-dimension check. If the admin picks an image smaller than what
  // the slot requires, we refuse the upload outright — even a 100% crop
  // would still look pixelated on the live site. Computed once after the
  // image loads; falsy when there are no constraints OR the image is large
  // enough.
  const sourceTooSmall = useMemo(() => {
    if (!imageBitmap) return null;
    const w = imageBitmap.naturalWidth;
    const h = imageBitmap.naturalHeight;
    if (minWidth > 0 && w < minWidth)   return { dim: 'width',  actual: w, required: minWidth };
    if (minHeight > 0 && h < minHeight) return { dim: 'height', actual: h, required: minHeight };
    return null;
  }, [imageBitmap, minWidth, minHeight]);

  // ── Load the picked file as an Image element ────────────────────────
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImageBitmap(img);
      // Default crop = centered, 80% of the shorter side, free aspect.
      const side = Math.round(Math.min(img.naturalWidth, img.naturalHeight) * 0.8);
      setCrop({
        x: Math.round((img.naturalWidth  - side) / 2),
        y: Math.round((img.naturalHeight - side) / 2),
        w: side, h: side,
      });
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Convert natural-pixel crop into screen-pixel rectangle for the overlay.
  const display = useMemo(() => {
    if (!imageBitmap) return null;
    const scale = MAX_DISPLAY / Math.max(imageBitmap.naturalWidth, imageBitmap.naturalHeight, 1);
    return {
      width:  Math.round(imageBitmap.naturalWidth  * scale),
      height: Math.round(imageBitmap.naturalHeight * scale),
      scale,
    };
  }, [imageBitmap]);

  // Drag / resize handlers — work in screen pixels then convert back to natural.
  const beginDrag = useCallback((kind) => (e) => {
    if (!display || !crop) return;
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = {
      kind,
      startX: e.clientX,
      startY: e.clientY,
      startCrop: { ...crop },
    };
  }, [display, crop]);

  useEffect(() => {
    function onMove(e) {
      const d = dragRef.current;
      if (!d || !display || !imageBitmap) return;
      const dxNat = Math.round((e.clientX - d.startX) / display.scale);
      const dyNat = Math.round((e.clientY - d.startY) / display.scale);
      let { x, y, w, h } = d.startCrop;

      const W = imageBitmap.naturalWidth;
      const H = imageBitmap.naturalHeight;

      if (d.kind === 'move') {
        x = clamp(x + dxNat, 0, W - w);
        y = clamp(y + dyNat, 0, H - h);
      } else {
        // Resize from the corresponding edge / corner.
        if (d.kind.includes('n')) { y = y + dyNat; h = h - dyNat; }
        if (d.kind.includes('s')) { h = h + dyNat; }
        if (d.kind.includes('w')) { x = x + dxNat; w = w - dxNat; }
        if (d.kind.includes('e')) { w = w + dxNat; }

        // Enforce aspect ratio if locked.
        const def = ASPECTS.find((a) => a.key === aspectKey);
        const ratio = def?.ratio;
        if (ratio) {
          if (d.kind === 'n' || d.kind === 's') {
            const newW = Math.round(h * ratio);
            const dw = newW - w;
            w = newW;
            // recentre horizontally
            x = clamp(x - Math.round(dw / 2), 0, W - w);
          } else if (d.kind === 'w' || d.kind === 'e') {
            const newH = Math.round(w / ratio);
            const dh = newH - h;
            h = newH;
            y = clamp(y - Math.round(dh / 2), 0, H - h);
          } else {
            // Corner drag — match the larger of the two deltas, preserve ratio.
            const candByW = Math.round(w / ratio);
            const candByH = Math.round(h * ratio);
            if (Math.abs(candByW - h) < Math.abs(candByH - w)) {
              h = candByW;
            } else {
              w = candByH;
            }
          }
        }

        // Clamp to image bounds and enforce a sensible minimum.
        const MIN = 20;
        if (w < MIN) { if (d.kind.includes('w')) x -= (MIN - w); w = MIN; }
        if (h < MIN) { if (d.kind.includes('n')) y -= (MIN - h); h = MIN; }
        if (x < 0)         { w += x; x = 0; }
        if (y < 0)         { h += y; y = 0; }
        if (x + w > W)     { w = W - x; }
        if (y + h > H)     { h = H - y; }
      }

      setCrop({ x, y, w, h });
    }
    function onUp() { dragRef.current = null; }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
  }, [aspectKey, display, imageBitmap]);

  // Aspect ratio change — keep the crop centred, fit to current bounds.
  function pickAspect(key) {
    setAspectKey(key);
    if (!imageBitmap || !crop) return;
    const def = ASPECTS.find((a) => a.key === key);
    const ratio = def?.ratio;
    if (!ratio) return;
    const W = imageBitmap.naturalWidth;
    const H = imageBitmap.naturalHeight;
    // Preserve the current centre, snap dimensions to the new ratio.
    let w = crop.w;
    let h = Math.round(w / ratio);
    if (h > H) { h = H; w = Math.round(h * ratio); }
    if (w > W) { w = W; h = Math.round(w / ratio); }
    const cx = crop.x + crop.w / 2;
    const cy = crop.y + crop.h / 2;
    const x = clamp(Math.round(cx - w / 2), 0, W - w);
    const y = clamp(Math.round(cy - h / 2), 0, H - h);
    setCrop({ x, y, w, h });
  }

  // ── Export cropped image ─────────────────────────────────────────────
  async function confirm() {
    if (!imageBitmap || !crop) return;
    setBusy(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width  = crop.w;
      canvas.height = crop.h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(
        imageBitmap,
        crop.x, crop.y, crop.w, crop.h,    // source rect
        0, 0, crop.w, crop.h,              // destination
      );
      // Preserve PNG/WebP for sources that have an alpha channel; default
      // to JPEG for photos (smaller payload, no alpha loss).
      const sourceMime = file?.type || 'image/jpeg';
      const outMime = /png|webp/i.test(sourceMime) ? sourceMime : 'image/jpeg';
      const quality = outMime === 'image/jpeg' ? 0.9 : undefined;
      const dataUrl = canvas.toDataURL(outMime, quality);
      const ext = outMime.split('/')[1];
      const outFile = {
        name: `${(file?.name || 'image').replace(/\.[^.]+$/, '')}-cropped.${ext}`,
        mime_type: outMime,
        data_base64: dataUrl,
        width:  crop.w,
        height: crop.h,
      };
      await onConfirm(outFile);
    } finally {
      setBusy(false);
    }
  }

  if (!file) return null;

  // Render via a portal directly into document.body. The cropper modal is
  // typically mounted inside a <FormField>, which is itself a <label>
  // wrapping a hidden <input type="file">. Without a portal, every click
  // (and drag-end) inside the cropper would bubble to that label and
  // re-open the file picker. createPortal lifts the modal out of that
  // ancestor chain so events stay contained.
  const portalTarget = typeof document !== 'undefined' ? document.body : null;
  if (!portalTarget) return null;

  return createPortal(
    <div className="dialog-overlay" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="dialog-shell" role="dialog" aria-modal="true" aria-labelledby="cropper-title" style={{ width: 'min(720px, 100%)' }}
        // Stop clicks inside the modal from bubbling to any ancestor
        // listeners (belt-and-braces — the portal already removes the
        // <label> ancestor, but this protects against any future move).
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog-header">
          <h2 id="cropper-title" className="dialog-title">Crop image</h2>
          <button type="button" className="dialog-close" onClick={onCancel} aria-label="Close"><IconX /></button>
        </div>

        <div className="dialog-body">
          {/* Source-too-small banner — shown when the picked image fails the
              slot's min-dimensions check. The Crop & upload button is also
              disabled below until the admin picks a bigger one. */}
          {sourceTooSmall && (
            <div
              role="alert"
              style={{
                padding: '.75rem 1rem',
                marginBottom: '.75rem',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '.5rem',
                color: '#991b1b',
                fontSize: '.875rem',
                lineHeight: 1.5,
              }}
            >
              <strong>Image too small.</strong>{' '}
              The {sourceTooSmall.dim} of this image is <strong>{sourceTooSmall.actual}px</strong>,
              but this slot needs at least <strong>{sourceTooSmall.required}px</strong>.
              Cropping a smaller image would look pixelated on the live site.
              Please cancel and pick a larger image.
            </div>
          )}
          {(minWidth > 0 || minHeight > 0) && !sourceTooSmall && imageBitmap && (
            <div
              style={{
                padding: '.5rem .75rem',
                marginBottom: '.75rem',
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '.375rem',
                color: '#166534',
                fontSize: '.75rem',
              }}
            >
              ✓ Image meets the minimum size for this slot
              {minWidth > 0 && minHeight > 0 && ` (≥ ${minWidth} × ${minHeight} px)`}.
            </div>
          )}

          {/* Aspect ratio picker */}
          <div className="row gap-2" style={{ flexWrap: 'wrap', marginBottom: '.75rem' }}>
            {ASPECTS.map((a) => (
              <button
                key={a.key}
                type="button"
                onClick={() => pickAspect(a.key)}
                className={'btn ' + (aspectKey === a.key ? 'btn-primary' : 'btn-outline')}
                style={{ padding: '.25rem .75rem', fontSize: '.8125rem' }}
              >
                {a.label}
              </button>
            ))}
          </div>

          {/* Image + crop overlay */}
          {imageBitmap && display && crop && (
            <div
              ref={wrapperRef}
              style={{
                position: 'relative',
                width:  display.width,
                height: display.height,
                margin: '0 auto',
                userSelect: 'none',
                touchAction: 'none',
                background: 'oklch(0.95 0.005 240)',
                border: '1px solid var(--border)',
                borderRadius: '.375rem',
                overflow: 'hidden',
              }}
            >
              <img
                ref={imgRef}
                src={imageBitmap.src}
                alt=""
                draggable={false}
                style={{ width: '100%', height: '100%', display: 'block', objectFit: 'contain', pointerEvents: 'none' }}
              />
              {/* Dim mask outside the crop */}
              <div style={{ position: 'absolute', inset: 0, boxShadow: `inset 0 0 0 9999px rgba(0,0,0,.45)`, clipPath: clipPathForCrop(crop, imageBitmap, display) }} />
              {/* Crop rectangle */}
              <CropOverlay
                crop={crop}
                imageBitmap={imageBitmap}
                display={display}
                beginDrag={beginDrag}
              />
            </div>
          )}

          {/* Output dimensions readout */}
          {crop && (
            <div className="muted-text" style={{ fontSize: '.75rem', marginTop: '.75rem', textAlign: 'center' }}>
              Output size: <strong>{crop.w} × {crop.h} px</strong>
              {imageBitmap && (
                <> · Source: {imageBitmap.naturalWidth} × {imageBitmap.naturalHeight} px</>
              )}
            </div>
          )}
        </div>

        <div className="dialog-footer">
          <button type="button" className="btn btn-outline" onClick={onCancel} disabled={busy}>Cancel</button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={confirm}
            disabled={busy || !imageBitmap || !!sourceTooSmall}
            title={sourceTooSmall ? `Image is too small for this slot — please pick a larger one` : undefined}
          >
            {busy ? 'Cropping…' : 'Crop & upload'}
          </button>
        </div>
      </div>
    </div>,
    portalTarget,
  );
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// CSS clip-path that exposes everything OUTSIDE the crop rectangle (for the
// dimming mask). Built by walking the perimeter of the container and then
// inserting the inverted crop rectangle as an inner ring.
function clipPathForCrop(crop, img, display) {
  const x = (crop.x / img.naturalWidth)  * 100;
  const y = (crop.y / img.naturalHeight) * 100;
  const w = (crop.w / img.naturalWidth)  * 100;
  const h = (crop.h / img.naturalHeight) * 100;
  return `polygon(
    0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%,
    ${x}% ${y}%, ${x}% ${y + h}%, ${x + w}% ${y + h}%, ${x + w}% ${y}%, ${x}% ${y}%
  )`;
}

function CropOverlay({ crop, imageBitmap, display, beginDrag }) {
  const left   = (crop.x / imageBitmap.naturalWidth)  * display.width;
  const top    = (crop.y / imageBitmap.naturalHeight) * display.height;
  const width  = (crop.w / imageBitmap.naturalWidth)  * display.width;
  const height = (crop.h / imageBitmap.naturalHeight) * display.height;

  const handles = [
    { k: 'nw', style: { top: -5,    left: -5,    cursor: 'nwse-resize' } },
    { k: 'n',  style: { top: -5,    left: '50%', marginLeft: -5, cursor: 'ns-resize' } },
    { k: 'ne', style: { top: -5,    right: -5,   cursor: 'nesw-resize' } },
    { k: 'e',  style: { top: '50%', right: -5,   marginTop: -5,  cursor: 'ew-resize' } },
    { k: 'se', style: { bottom: -5, right: -5,   cursor: 'nwse-resize' } },
    { k: 's',  style: { bottom: -5, left: '50%', marginLeft: -5, cursor: 'ns-resize' } },
    { k: 'sw', style: { bottom: -5, left: -5,    cursor: 'nesw-resize' } },
    { k: 'w',  style: { top: '50%', left: -5,    marginTop: -5,  cursor: 'ew-resize' } },
  ];

  return (
    <div
      onMouseDown={beginDrag('move')}
      style={{
        position: 'absolute',
        left, top, width, height,
        boxSizing: 'border-box',
        border: '2px solid #fff',
        boxShadow: '0 0 0 1px rgba(0,0,0,.4)',
        cursor: 'move',
      }}
    >
      {/* Rule-of-thirds guide lines */}
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', left: '33.33%', top: 0, bottom: 0, borderLeft: '1px dashed rgba(255,255,255,.4)' }} />
        <div style={{ position: 'absolute', left: '66.66%', top: 0, bottom: 0, borderLeft: '1px dashed rgba(255,255,255,.4)' }} />
        <div style={{ position: 'absolute', top: '33.33%', left: 0, right: 0, borderTop: '1px dashed rgba(255,255,255,.4)' }} />
        <div style={{ position: 'absolute', top: '66.66%', left: 0, right: 0, borderTop: '1px dashed rgba(255,255,255,.4)' }} />
      </div>
      {handles.map((h) => (
        <span
          key={h.k}
          onMouseDown={beginDrag(h.k)}
          style={{
            position: 'absolute',
            width: 12, height: 12,
            background: '#fff',
            border: '1px solid rgba(0,0,0,.5)',
            borderRadius: 2,
            ...h.style,
          }}
        />
      ))}
    </div>
  );
}
