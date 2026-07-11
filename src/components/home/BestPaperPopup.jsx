import { useEffect, useState } from 'react';
import { cachedGet } from '../../lib/apiCache';
import { IconX, IconAward, IconArrowRight, IconDownload } from '../../icons';

// Homepage promotion popup for the current Best Paper Presentation winner.
//
// Behaviour:
//   • Delays 1.4 s after homepage load so the initial paint feels clean
//     and the popup lands *after* the user has taken in the hero.
//   • Stores dismissal in localStorage keyed on the winner's award_year,
//     so a user who X's it out doesn't get pestered on every visit —
//     but a new year's winner reopens the popup automatically because
//     the storage key changes.
//   • Hides entirely if no winner is flagged (backend returns 404) or if
//     the fetch fails, so a fresh install without a winner is silent.
//   • Backdrop click, Esc, or explicit dismiss all close and remember.
//   • Content strings (eyebrow, title, intro, CTA label) still come from
//     the `home_best_paper` Site Content slot — admin can rephrase the
//     popup copy without touching code.

const STORAGE_PREFIX = 'best-paper-popup-dismissed:';
const OPEN_DELAY_MS = 1400;

export default function BestPaperPopup({ text }) {
  const [paper, setPaper] = useState(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);   // controls the enter animation

  // Fetch on mount. Cached for 5 minutes through the shared apiCache so
  // hopping between pages doesn't re-hit the server.
  useEffect(() => {
    let cancelled = false;
    cachedGet('/api/resources/paper-presentations/best-paper', null, 300_000)
      .then((j) => {
        if (cancelled) return;
        if (!j?.slug) return;                     // no winner yet — stay silent
        const dismissedKey = STORAGE_PREFIX + (j.award_year ?? 'unknown');
        if (localStorage.getItem(dismissedKey) === '1') return;
        setPaper(j);
      })
      .catch(() => { /* 404 or network — silent */ });
    return () => { cancelled = true; };
  }, []);

  // Delay opening so the user perceives the hero first, then the promo
  // slides in. Setting `mounted` a tick after `open` fires the CSS enter
  // transition (from opacity 0 / scale .95 → 1 / 1).
  useEffect(() => {
    if (!paper) return;
    const t1 = setTimeout(() => setOpen(true), OPEN_DELAY_MS);
    const t2 = setTimeout(() => setMounted(true), OPEN_DELAY_MS + 30);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [paper]);

  // Esc to close — cheap accessibility win.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function close() {
    setMounted(false);
    // Wait for the fade-out to finish before actually removing the node so
    // the transition is visible. 220ms matches the CSS below.
    setTimeout(() => setOpen(false), 220);
    if (paper?.award_year) {
      try { localStorage.setItem(STORAGE_PREFIX + paper.award_year, '1'); } catch { /* incognito / disabled — silent */ }
    }
  }

  if (!open || !paper) return null;

  const authorName = paper.author_name || paper.speaker_name || 'Anonymous';
  const ctaLabel   = text?.cta_label || 'Read the winning paper →';

  return (
    <div
      className={'bpp-backdrop' + (mounted ? ' bpp-open' : '')}
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="bpp-title"
    >
      <div className={'bpp-card' + (mounted ? ' bpp-in' : '')}>
        {/* Corner ribbon */}
        <div className="bpp-ribbon">
          <IconAward size="sm" /> Award Spotlight
          {paper.award_year && <span className="bpp-year">· {paper.award_year}</span>}
        </div>

        <button
          type="button"
          onClick={close}
          aria-label="Dismiss"
          className="bpp-close"
        >
          <IconX size="sm" />
        </button>

        {/* Medal */}
        <div className="bpp-medal">🏆</div>

        <div className="bpp-eyebrow">Best Paper Presentation</div>
        <h2 id="bpp-title" className="bpp-title">{paper.title}</h2>

        <div className="bpp-byline">
          by <strong>{authorName}</strong>
          {paper.author_designation && <span className="bpp-desig"> · {paper.author_designation}</span>}
          {paper.committee_tag && <span className="bpp-committee">{paper.committee_tag}</span>}
        </div>

        {paper.abstract && (
          <p className="bpp-abstract">{paper.abstract}</p>
        )}

        <div className="bpp-actions">
          <a
            href={`/resources/papers/${paper.slug}`}
            className="btn btn-primary bpp-cta"
            onClick={() => {
              // Once the user has actively clicked through, mark dismissed
              // so the popup doesn't re-fire on their next visit.
              if (paper?.award_year) {
                try { localStorage.setItem(STORAGE_PREFIX + paper.award_year, '1'); } catch { /* silent */ }
              }
            }}
          >
            {ctaLabel}
          </a>
          {paper.pdf_url && (
            <a
              href={paper.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline bpp-pdf-btn"
            >
              <IconDownload size="sm" /> Download PDF
            </a>
          )}
          <button type="button" onClick={close} className="btn btn-ghost bpp-later">
            Not now
          </button>
        </div>
      </div>

      <style>{`
        .bpp-backdrop {
          position: fixed; inset: 0; z-index: 1000;
          background: oklch(0.18 0.05 250 / 0);
          backdrop-filter: blur(0);
          display: flex; align-items: center; justify-content: center;
          padding: 1.25rem;
          transition: background .22s ease, backdrop-filter .22s ease;
          pointer-events: none;
        }
        .bpp-backdrop.bpp-open {
          background: oklch(0.18 0.05 250 / 0.55);
          backdrop-filter: blur(4px);
          pointer-events: auto;
        }

        .bpp-card {
          position: relative;
          width: 100%;
          max-width: 30rem;
          background: linear-gradient(180deg, #fff 0%, oklch(0.98 0.02 90) 100%);
          border-radius: 1rem;
          padding: 2rem 1.75rem 1.5rem;
          box-shadow: 0 30px 80px oklch(0.2 0.05 250 / 0.35),
                      0 0 0 1px oklch(0.72 0.16 90 / 0.35);
          overflow: hidden;
          transform: translateY(24px) scale(.96);
          opacity: 0;
          transition: transform .28s cubic-bezier(.2, .8, .2, 1), opacity .28s ease;
        }
        .bpp-card.bpp-in {
          transform: translateY(0) scale(1);
          opacity: 1;
        }
        .bpp-card::before {
          content: "";
          position: absolute;
          right: -4rem; top: -4rem;
          width: 12rem; height: 12rem;
          background: radial-gradient(circle, oklch(0.72 0.16 90 / 0.28), transparent 65%);
          pointer-events: none;
        }
        .bpp-card::after {
          content: "";
          position: absolute;
          left: -3rem; bottom: -3rem;
          width: 9rem; height: 9rem;
          background: radial-gradient(circle, oklch(0.36 0.13 255 / 0.12), transparent 65%);
          pointer-events: none;
        }

        .bpp-ribbon {
          display: inline-flex;
          align-items: center;
          gap: .35rem;
          background: linear-gradient(90deg, oklch(0.72 0.16 90), oklch(0.62 0.16 65));
          color: white;
          padding: .3rem .75rem;
          border-radius: 999px;
          font-size: .7rem;
          font-weight: 700;
          letter-spacing: .04em;
          text-transform: uppercase;
          box-shadow: 0 4px 12px oklch(0.62 0.16 65 / 0.35);
          position: relative;
          z-index: 1;
        }
        .bpp-year { opacity: .85; margin-left: .15rem; }

        .bpp-close {
          position: absolute;
          top: .75rem; right: .75rem;
          background: rgba(0,0,0,.05);
          border: none;
          border-radius: 999px;
          width: 2rem; height: 2rem;
          display: inline-flex; align-items: center; justify-content: center;
          cursor: pointer;
          color: var(--muted-foreground);
          transition: background .12s;
          z-index: 2;
        }
        .bpp-close:hover { background: rgba(0,0,0,.1); color: var(--foreground); }

        .bpp-medal {
          font-size: 3.25rem;
          text-align: center;
          margin: 1rem 0 .5rem;
          filter: drop-shadow(0 6px 12px oklch(0.62 0.16 65 / 0.4));
          position: relative;
          z-index: 1;
        }

        .bpp-eyebrow {
          text-align: center;
          font-size: .72rem;
          font-weight: 700;
          letter-spacing: .08em;
          text-transform: uppercase;
          color: oklch(0.42 0.14 65);
          margin-bottom: .4rem;
          position: relative;
          z-index: 1;
        }

        .bpp-title {
          text-align: center;
          font-size: clamp(1.1rem, 3vw, 1.4rem);
          font-weight: 700;
          margin: 0 0 .75rem;
          line-height: 1.3;
          color: var(--foreground);
          letter-spacing: -.01em;
          position: relative;
          z-index: 1;
        }

        .bpp-byline {
          text-align: center;
          font-size: .875rem;
          color: var(--muted-foreground);
          margin-bottom: 1rem;
          display: flex;
          gap: .4rem;
          align-items: center;
          justify-content: center;
          flex-wrap: wrap;
          position: relative;
          z-index: 1;
        }
        .bpp-byline strong { color: var(--foreground); }
        .bpp-desig { color: var(--muted-foreground); }
        .bpp-committee {
          background: oklch(0.94 0.03 250);
          color: oklch(0.28 0.09 250);
          padding: .1rem .55rem;
          border-radius: 999px;
          font-size: .7rem;
          font-weight: 600;
        }

        .bpp-abstract {
          text-align: center;
          font-size: .875rem;
          line-height: 1.55;
          color: var(--muted-foreground);
          margin: 0 0 1.5rem;
          position: relative;
          z-index: 1;
          /* Truncate long abstracts so the popup stays compact. Users hit
             the primary CTA to read the full paper. */
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .bpp-actions {
          display: flex;
          flex-direction: column;
          gap: .5rem;
          position: relative;
          z-index: 1;
        }
        @media (min-width: 480px) {
          .bpp-actions {
            flex-direction: row;
            justify-content: center;
            flex-wrap: wrap;
          }
        }
        .bpp-cta { padding: .6rem 1.25rem; font-weight: 700; }
        .bpp-pdf-btn {
          padding: .6rem 1rem;
          display: inline-flex; align-items: center; gap: .35rem;
        }
        .bpp-later {
          padding: .6rem 1rem;
          color: var(--muted-foreground);
        }
      `}</style>
    </div>
  );
}
