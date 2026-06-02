import { useEffect, useRef, useState } from 'react';

// Apple-style segmented control. The selected segment has a frosted "thumb"
// that animates between positions. Pure CSS — no spring lib needed.
export default function SegmentedControl({ value, onChange, options }) {
  const wrapRef = useRef(null);
  const [thumb, setThumb] = useState({ left: 0, width: 0, ready: false });

  useEffect(() => {
    if (!wrapRef.current) return;
    const el = wrapRef.current.querySelector(`[data-seg-value="${CSS.escape(String(value))}"]`);
    if (el) {
      const wrap = wrapRef.current.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      setThumb({ left: r.left - wrap.left, width: r.width, ready: true });
    }
  }, [value, options.length]);

  return (
    <div ref={wrapRef} className="seg-ctrl">
      {thumb.ready && (
        <span
          className="seg-thumb"
          style={{ transform: `translateX(${thumb.left}px)`, width: thumb.width }}
        />
      )}
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          data-seg-value={o.value}
          className={'seg-btn' + (o.value === value ? ' is-active' : '')}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
