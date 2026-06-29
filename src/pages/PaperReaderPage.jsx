import { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { useRoute, navigate } from '../hooks/useRoute';
import { IconArrowLeft, IconArrowRight, IconDownload } from '../icons';

// Configure PDF.js worker once at module load. Vite's `?url` import emits
// the worker as a static asset and gives us the resolved URL — no manual
// public/ copying required.
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const THEMES = {
  light: { bg: '#f8f5f0',                fg: '#1a1a1a', filter: 'none',                                          label: 'Light' },
  sepia: { bg: '#f4e8d0',                fg: '#3b2e1c', filter: 'sepia(.18) saturate(.85)',                     label: 'Sepia' },
  dark:  { bg: '#121212',                fg: '#e6e1d6', filter: 'invert(.92) hue-rotate(180deg) brightness(.95)', label: 'Dark' },
};

const STORAGE_KEY_THEME = 'icai_reader_theme';
const STORAGE_KEY_ZOOM  = 'icai_reader_zoom';

// Multipliers applied on top of the auto-fit-to-width scale.
// 1.0 = fit width; 2.0 = double; 0.5 = half.
const ZOOM_MIN  = 0.5;
const ZOOM_MAX  = 3.0;
const ZOOM_STEP = 0.2;

async function api(url) {
  const r = await fetch(url, { credentials: 'include' });
  if (r.status === 401) return null;
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}

export default function PaperReaderPage() {
  const route = useRoute();
  // Path looks like "/resources/papers/<slug>/read"
  const parts = route.path.split('/').filter(Boolean);
  const slug = parts[parts.length - 2];   // "<slug>" between "papers" and "read"

  const [paper, setPaper]     = useState(null);
  const [err, setErr]         = useState('');
  const [pdf, setPdf]         = useState(null);   // loaded PDFDocumentProxy
  const [pageNum, setPageNum] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [theme, setTheme]     = useState(() => {
    if (typeof window === 'undefined') return 'light';
    return localStorage.getItem(STORAGE_KEY_THEME) || 'light';
  });
  const [zoom, setZoom] = useState(() => {
    if (typeof window === 'undefined') return 1;
    const raw = parseFloat(localStorage.getItem(STORAGE_KEY_ZOOM) || '1');
    return Number.isFinite(raw) ? Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, raw)) : 1;
  });
  const [chromeVisible, setChromeVisible] = useState(true);

  const canvasRef    = useRef(null);
  const containerRef = useRef(null);
  // Tracks the in-flight render so a rapid page flip can cancel the previous
  // one — pdf.js complains loudly if you call render() twice on the same
  // canvas without cancelling first.
  const renderTaskRef = useRef(null);

  // ── Load paper metadata + PDF binary ─────────────────────────────────
  useEffect(() => {
    if (!slug) return;
    api(`/api/resources/papers/${slug}`)
      .then((r) => {
        if (!r?.paper?.pdf_url) {
          setErr('This paper has no PDF attached.');
          return;
        }
        setPaper(r.paper);
      })
      .catch((e) => setErr(e.message));
  }, [slug]);

  useEffect(() => {
    if (!paper?.pdf_url) return;
    let cancelled = false;
    const task = pdfjsLib.getDocument({ url: paper.pdf_url, withCredentials: false });
    task.promise
      .then((doc) => {
        if (cancelled) { doc.destroy(); return; }
        setPdf(doc);
        setPageCount(doc.numPages);
        setPageNum(1);
      })
      .catch((e) => { if (!cancelled) setErr(`Couldn't load PDF — ${e.message}`); });
    return () => {
      cancelled = true;
      task.destroy();
    };
  }, [paper?.pdf_url]);

  // ── Render the current page onto the canvas ──────────────────────────
  //
  // We size the canvas to the container width (so it always fits), and
  // multiply the backing-store resolution by devicePixelRatio for crisp
  // text on retina displays. The canvas's CSS width stays at the layout
  // size; only the bitmap is denser.
  const renderPage = useCallback(async (num) => {
    if (!pdf || !canvasRef.current || !containerRef.current) return;
    if (renderTaskRef.current) {
      try { renderTaskRef.current.cancel(); } catch { /* already done */ }
    }
    let page;
    try { page = await pdf.getPage(num); }
    catch { return; /* page got out of range during a fast flip */ }

    const container = containerRef.current;
    const dpr = window.devicePixelRatio || 1;
    // 32px of horizontal padding inside the reader frame. The user-zoom
    // multiplier scales the fit-to-width baseline.
    const containerWidth = Math.max(240, container.clientWidth - 32);
    const baseViewport = page.getViewport({ scale: 1 });
    const fitScale = containerWidth / baseViewport.width;
    const viewport = page.getViewport({ scale: fitScale * zoom });

    const canvas = canvasRef.current;
    canvas.width  = Math.floor(viewport.width  * dpr);
    canvas.height = Math.floor(viewport.height * dpr);
    canvas.style.width  = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const task = page.render({ canvasContext: ctx, viewport });
    renderTaskRef.current = task;
    try { await task.promise; }
    catch (e) {
      if (e?.name !== 'RenderingCancelledException') {
        // eslint-disable-next-line no-console
        console.error('PDF render failed', e);
      }
    }
  }, [pdf, zoom]);

  // Trigger render on page change, zoom change, or container resize.
  useEffect(() => { renderPage(pageNum); }, [renderPage, pageNum]);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(() => renderPage(pageNum));
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [renderPage, pageNum]);

  // ── Theme + zoom persistence ─────────────────────────────────────────
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY_THEME, theme); } catch { /* private mode */ }
  }, [theme]);
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY_ZOOM, String(zoom)); } catch { /* ignore */ }
  }, [zoom]);

  const zoomOut  = useCallback(() => setZoom((z) => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2))), []);
  const zoomIn   = useCallback(() => setZoom((z) => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2))), []);
  const zoomReset = useCallback(() => setZoom(1), []);

  // ── Keyboard nav (← →, PgUp/PgDn, Home/End, +/-/0, Esc) ──────────────
  useEffect(() => {
    const onKey = (e) => {
      if (e.target?.tagName === 'INPUT' || e.target?.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        setPageNum((p) => Math.min(pageCount || p, p + 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        setPageNum((p) => Math.max(1, p - 1));
      } else if (e.key === 'Home') {
        e.preventDefault(); setPageNum(1);
      } else if (e.key === 'End') {
        e.preventDefault(); if (pageCount) setPageNum(pageCount);
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault(); zoomIn();
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault(); zoomOut();
      } else if (e.key === '0') {
        e.preventDefault(); zoomReset();
      } else if (e.key === 'Escape') {
        e.preventDefault(); navigate(`/resources/papers/${slug}`);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pageCount, slug, zoomIn, zoomOut, zoomReset]);

  // ── Ctrl+wheel zoom (desktop) ────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      if (e.deltaY < 0) zoomIn(); else zoomOut();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomIn, zoomOut]);

  // ── Touch swipe (mobile page flip) ───────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let startX = null, startY = null;
    const onStart = (e) => {
      const t = e.touches[0];
      startX = t.clientX; startY = t.clientY;
    };
    const onEnd = (e) => {
      if (startX === null) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      startX = startY = null;
      // Horizontal swipe with >60px and not too vertical.
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        if (dx < 0) setPageNum((p) => Math.min(pageCount || p, p + 1));
        else        setPageNum((p) => Math.max(1, p - 1));
      } else if (Math.abs(dx) < 8 && Math.abs(dy) < 8) {
        // A tap — toggle chrome so the reader can go truly fullscreen.
        setChromeVisible((v) => !v);
      }
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchend',   onEnd,   { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchend',   onEnd);
    };
  }, [pageCount]);

  // ── Click on left / right half to flip page ──────────────────────────
  const onCanvasClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const mid = rect.width / 2;
    // Center 20% of the canvas toggles chrome — letting users read without
    // accidentally flipping every tap.
    if (Math.abs(x - mid) < rect.width * 0.1) {
      setChromeVisible((v) => !v);
    } else if (x > mid) {
      setPageNum((p) => Math.min(pageCount || p, p + 1));
    } else {
      setPageNum((p) => Math.max(1, p - 1));
    }
  };

  if (err) {
    return (
      <section className="container" style={{ padding: '3rem 1rem' }}>
        <p style={{ color: 'var(--destructive)' }}>{err}</p>
        <a href={`/resources/papers/${slug}`}>← Back to paper</a>
      </section>
    );
  }

  const t = THEMES[theme] || THEMES.light;
  const progressPct = pageCount > 0 ? (pageNum / pageCount) * 100 : 0;

  return (
    <div className="pr-shell" style={{ background: t.bg, color: t.fg }}>
      {/* Top chrome ────────────────────────────────────────────────── */}
      <header className={'pr-topbar' + (chromeVisible ? '' : ' is-hidden')}>
        <button
          type="button"
          className="pr-icon-btn"
          onClick={() => navigate(`/resources/papers/${slug}`)}
          title="Close (Esc)"
        >
          <IconArrowLeft size="sm" /> <span className="pr-icon-btn-label">Back</span>
        </button>
        <div className="pr-title">
          <strong>{paper?.title || (pdf ? 'Loading…' : ' ')}</strong>
          {paper?.speaker_name && <span className="pr-byline">by {paper.speaker_name}</span>}
        </div>
        <div className="pr-theme-picker" role="radiogroup" aria-label="Reader theme">
          {Object.entries(THEMES).map(([k, v]) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={theme === k}
              className={'pr-theme-btn' + (theme === k ? ' is-active' : '')}
              style={{ background: v.bg, color: v.fg, borderColor: theme === k ? 'var(--primary)' : 'transparent' }}
              onClick={() => setTheme(k)}
              title={v.label}
            >
              <span className="pr-theme-dot">Aa</span>
            </button>
          ))}
        </div>
        {paper?.pdf_url && (
          <a href={paper.pdf_url} target="_blank" rel="noopener noreferrer" className="pr-icon-btn" title="Download PDF">
            <IconDownload size="sm" />
          </a>
        )}
      </header>

      {/* Canvas viewport ──────────────────────────────────────────── */}
      <main ref={containerRef} className="pr-viewport" onClick={onCanvasClick}>
        {!pdf && (
          <div className="pr-loading">
            <div className="pr-spinner" /> Loading paper…
          </div>
        )}
        <canvas
          ref={canvasRef}
          className="pr-canvas"
          style={{
            filter: t.filter,
            visibility: pdf ? 'visible' : 'hidden',
            boxShadow: theme === 'dark' ? '0 8px 28px rgba(0,0,0,.6)' : '0 8px 28px rgba(0,0,0,.18)',
          }}
        />
      </main>

      {/* Bottom chrome — page nav + progress ─────────────────────── */}
      <footer className={'pr-bottombar' + (chromeVisible ? '' : ' is-hidden')}>
        <div className="pr-progress-track">
          <div className="pr-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
        <div className="pr-bottombar-inner">
          <button
            type="button"
            className="pr-icon-btn"
            disabled={pageNum <= 1}
            onClick={() => setPageNum((p) => Math.max(1, p - 1))}
            title="Previous page (←)"
          >
            <IconArrowLeft size="sm" />
          </button>
          <div className="pr-page-input">
            <input
              type="number"
              min={1}
              max={pageCount || 1}
              value={pageNum}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n)) setPageNum(Math.min(pageCount || 1, Math.max(1, n)));
              }}
              aria-label="Current page"
            />
            <span>/ {pageCount || '—'}</span>
          </div>
          <button
            type="button"
            className="pr-icon-btn"
            disabled={pageCount > 0 && pageNum >= pageCount}
            onClick={() => setPageNum((p) => Math.min(pageCount || p, p + 1))}
            title="Next page (→)"
          >
            <IconArrowRight size="sm" />
          </button>

          <div className="pr-zoom-group" role="group" aria-label="Zoom">
            <button
              type="button"
              className="pr-icon-btn pr-zoom-btn"
              onClick={zoomOut}
              disabled={zoom <= ZOOM_MIN + 0.001}
              title="Zoom out (−)"
            >−</button>
            <button
              type="button"
              className="pr-icon-btn pr-zoom-pct"
              onClick={zoomReset}
              title="Reset zoom (0)"
            >{Math.round(zoom * 100)}%</button>
            <button
              type="button"
              className="pr-icon-btn pr-zoom-btn"
              onClick={zoomIn}
              disabled={zoom >= ZOOM_MAX - 0.001}
              title="Zoom in (+)"
            >+</button>
          </div>
        </div>
      </footer>

      <style>{READER_STYLES}</style>
    </div>
  );
}

const READER_STYLES = `
  .pr-shell {
    position: fixed; inset: 0;
    display: grid;
    grid-template-rows: auto 1fr auto;
    transition: background-color .25s ease, color .25s ease;
    z-index: 50;
  }

  .pr-topbar, .pr-bottombar {
    display: flex; align-items: center; gap: .75rem;
    padding: .55rem .9rem;
    background: rgba(0,0,0,.04);
    backdrop-filter: blur(8px);
    transition: transform .2s ease, opacity .2s ease;
  }
  .pr-shell[style*="background: rgb(18, 18, 18)"] .pr-topbar,
  .pr-shell[style*="background: rgb(18, 18, 18)"] .pr-bottombar {
    background: rgba(255,255,255,.05);
  }
  .pr-topbar.is-hidden    { transform: translateY(-105%); opacity: 0; pointer-events: none; }
  .pr-bottombar.is-hidden { transform: translateY( 105%); opacity: 0; pointer-events: none; }

  .pr-title { flex: 1; min-width: 0; line-height: 1.2; }
  .pr-title strong {
    display: block; font-size: .92rem; font-weight: 600;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .pr-byline { font-size: .72rem; opacity: .65; }

  .pr-icon-btn {
    display: inline-flex; align-items: center; gap: .35rem;
    padding: .35rem .6rem; border-radius: .4rem;
    background: transparent; border: 1px solid currentColor;
    color: inherit; cursor: pointer; font: inherit; font-size: .8rem;
    text-decoration: none;
    opacity: .8; transition: opacity .12s, background .12s;
  }
  .pr-icon-btn:hover { opacity: 1; background: rgba(0,0,0,.06); }
  .pr-icon-btn:disabled { opacity: .35; cursor: not-allowed; }
  .pr-icon-btn-label { font-size: .78rem; }
  @media (max-width: 640px) { .pr-icon-btn-label { display: none; } }

  .pr-theme-picker { display: inline-flex; gap: .3rem; }
  .pr-theme-btn {
    width: 2rem; height: 2rem; border-radius: 999px;
    display: inline-flex; align-items: center; justify-content: center;
    border: 2px solid transparent; cursor: pointer;
    font-size: .68rem; font-weight: 700;
    transition: transform .12s, border-color .12s;
  }
  .pr-theme-btn:hover { transform: scale(1.08); }
  .pr-theme-btn.is-active { transform: scale(1.05); }

  .pr-viewport {
    position: relative;
    overflow: auto;
    display: flex; align-items: flex-start; justify-content: center;
    padding: 1rem;
    cursor: pointer;
    -webkit-user-select: none; user-select: none;
  }
  .pr-canvas {
    max-width: 100%;
    border-radius: 4px;
    transition: filter .25s ease;
  }

  .pr-loading {
    position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
    display: flex; align-items: center; gap: .65rem;
    font-size: .9rem; opacity: .85;
  }
  .pr-spinner {
    width: 1.1rem; height: 1.1rem;
    border: 2px solid currentColor; border-top-color: transparent;
    border-radius: 999px; animation: pr-spin 1s linear infinite;
  }
  @keyframes pr-spin { to { transform: rotate(360deg); } }

  .pr-bottombar { flex-direction: column; padding: 0 0 .6rem; gap: 0; }
  .pr-progress-track {
    width: 100%; height: 3px;
    background: rgba(0,0,0,.08);
    overflow: hidden;
  }
  .pr-progress-fill {
    height: 100%; background: var(--primary);
    transition: width .2s ease;
  }
  .pr-bottombar-inner {
    display: flex; align-items: center; justify-content: center; gap: 1rem;
    padding: .55rem .9rem 0;
  }
  .pr-page-input {
    display: inline-flex; align-items: center; gap: .4rem;
    font-size: .85rem;
  }
  .pr-page-input input {
    width: 3.2rem; padding: .25rem .4rem;
    text-align: center; font: inherit;
    background: rgba(0,0,0,.06); border: 1px solid transparent;
    border-radius: .3rem; color: inherit;
  }
  .pr-page-input input:focus {
    outline: none; border-color: var(--primary);
    background: rgba(0,0,0,.02);
  }

  .pr-zoom-group {
    display: inline-flex; align-items: center; gap: .25rem;
    margin-left: 1rem; padding-left: 1rem;
    border-left: 1px solid currentColor;
  }
  .pr-zoom-btn {
    width: 2rem; height: 2rem; padding: 0;
    justify-content: center; font-size: 1.05rem; font-weight: 700;
  }
  .pr-zoom-pct {
    min-width: 3.4rem; padding: .25rem .55rem;
    font-size: .78rem; font-weight: 600;
    justify-content: center;
  }
  @media (max-width: 480px) {
    .pr-zoom-group { margin-left: .5rem; padding-left: .5rem; }
    .pr-zoom-pct { display: none; }
  }
`;
