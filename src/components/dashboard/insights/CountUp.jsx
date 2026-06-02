import { useEffect, useRef, useState } from 'react';

// Smoothly animates a number from its previous value to the new one. Used in
// KPI tiles so the dashboard "comes alive" when filters change or polling
// refreshes data. Respects prefers-reduced-motion: just snaps to the value.
export default function CountUp({ value, duration = 700, format = (n) => Math.round(n).toLocaleString('en-IN') }) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef(null);

  useEffect(() => {
    const reduce = typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || typeof value !== 'number' || !Number.isFinite(value)) {
      setDisplay(value);
      fromRef.current = value;
      return undefined;
    }

    const from = Number(fromRef.current) || 0;
    const to = value;
    const start = performance.now();

    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      const next = from + (to - from) * eased;
      setDisplay(next);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [value, duration]);

  return <>{typeof display === 'number' && Number.isFinite(display) ? format(display) : display ?? '—'}</>;
}
