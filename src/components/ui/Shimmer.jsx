// Reusable shimmer (skeleton-loading) primitives. Pure CSS, no deps.
//
// Use the small helpers below for the common shapes:
//   <Shimmer width="100%" height="1rem" />        — a single bar
//   <ShimmerLines count={3} lastWidth="60%" />    — text paragraph
//   <ShimmerTableRow cols={5} />                  — table row matching cols
//   <ShimmerStatTile />                            — dashboard stat tile
//   <ShimmerFormField />                           — labeled form field
//   <ShimmerCardBody lines={3} />                  — a content card body
//   <ShimmerPageBody />                            — page-level skeleton
//   <ShimmerDropdownItems count={4} />             — bell / picker dropdowns
//   <ShimmerListRows count={5} />                  — list/table row skeleton
//   <ShimmerDrawerBody fields={4} />               — drawer/modal skeleton
//   <ShimmerFullPageSplash />                      — full-page route splash

// One CSS animation, mounted once via the shared <ShimmerStyles /> block.
// All shimmer primitives share the same .shimmer class so the gradient
// keyframes only ever exist once in the DOM.

export function Shimmer({ width = '100%', height = '1rem', radius = '.25rem', style }) {
  return (
    <span className="shimmer" style={{ width, height, borderRadius: radius, ...style }} aria-hidden="true" />
  );
}

export function ShimmerLines({ count = 3, lastWidth = '70%', gap = '.5rem', height = '.75rem' }) {
  return (
    <span style={{ display: 'flex', flexDirection: 'column', gap }}>
      {Array.from({ length: count }).map((_, i) => (
        <Shimmer key={i} width={i === count - 1 ? lastWidth : '100%'} height={height} />
      ))}
    </span>
  );
}

// One row of N shimmer cells matching the admin table layout.
export function ShimmerTableRow({ cols = 4 }) {
  return (
    <tr aria-hidden="true">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} style={{ padding: '.75rem .875rem' }}>
          <Shimmer height=".875rem" width={i === 0 ? '85%' : (i === cols - 1 ? '40%' : '60%')} />
        </td>
      ))}
    </tr>
  );
}

// Full skeleton for a dashboard stat tile.
export function ShimmerStatTile() {
  return (
    <div className="shimmer-stat-tile" aria-hidden="true">
      <Shimmer width="2.5rem" height="2.5rem" radius=".375rem" />
      <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
        <Shimmer height="1.25rem" width="50%" />
        <Shimmer height=".7rem" width="70%" />
      </span>
      <style>{`
        .shimmer-stat-tile {
          display: flex; gap: .875rem; align-items: center;
          background: var(--card); border: 1px solid var(--border);
          border-radius: .5rem; padding: 1rem;
        }
      `}</style>
    </div>
  );
}

// Skeleton for one labeled form field — used while drawer detail is loading.
export function ShimmerFormField({ span = 1 }) {
  return (
    <span style={{ display: 'flex', flexDirection: 'column', gap: '.35rem', gridColumn: span === 2 ? 'span 2' : undefined }}>
      <Shimmer height=".7rem" width="30%" />
      <Shimmer height="2.25rem" width="100%" radius=".375rem" />
    </span>
  );
}

// Generic card body skeleton — a title bar plus a few lines of body content.
// Drop-in replacement for "<p>Loading…</p>" inside a card.
export function ShimmerCardBody({ lines = 3, showTitle = false }) {
  return (
    <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: '.65rem', padding: '.25rem 0' }}>
      {showTitle && <Shimmer height="1rem" width="40%" />}
      <ShimmerLines count={lines} />
    </div>
  );
}

// Page-level skeleton when we don't know yet what's going to render — used
// in place of "Loading…" centred text on big pages (dashboard, branch
// insights, etc.). Renders a title bar and a few card-shaped blocks.
export function ShimmerPageBody({ cards = 3 }) {
  return (
    <section aria-hidden="true" className="container" style={{ padding: '1.5rem 1rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '.6rem', marginBottom: '1.25rem' }}>
        <Shimmer height=".75rem" width="6rem" />
        <Shimmer height="1.6rem" width="60%" radius=".4rem" />
        <Shimmer height=".75rem" width="40%" />
      </div>
      <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: '1fr' }}>
        {Array.from({ length: cards }).map((_, i) => (
          <div key={i} className="shimmer-card-block">
            <Shimmer height="1rem" width="35%" />
            <div style={{ marginTop: '.85rem' }}>
              <ShimmerLines count={3} />
            </div>
          </div>
        ))}
      </div>
      <style>{`
        .shimmer-card-block {
          background: var(--card); border: 1px solid var(--border);
          border-radius: .75rem; padding: 1.15rem;
        }
      `}</style>
    </section>
  );
}

// A vertical list of dropdown-style rows (bell, autocomplete, picker).
export function ShimmerDropdownItems({ count = 3 }) {
  return (
    <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: '.5rem', padding: '.5rem .75rem' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '.3rem', padding: '.5rem 0', borderBottom: i === count - 1 ? 'none' : '1px solid var(--border)' }}>
          <Shimmer height=".8rem" width={`${50 + ((i * 13) % 35)}%`} />
          <Shimmer height=".65rem" width={`${30 + ((i * 17) % 50)}%`} />
        </div>
      ))}
    </div>
  );
}

// A vertical list of list-style rows (events list, checklist list, etc.).
// `withMeta` adds a thin sub-line under each title.
export function ShimmerListRows({ count = 4, withMeta = true }) {
  return (
    <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '.75rem 0', borderBottom: '1px solid var(--border)', gap: '1rem' }}>
          <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '.35rem' }}>
            <Shimmer height=".9rem" width={`${55 + ((i * 11) % 35)}%`} />
            {withMeta && <Shimmer height=".7rem" width={`${30 + ((i * 7) % 30)}%`} />}
          </span>
          <Shimmer height="1.25rem" width="3.5rem" radius="999px" />
        </div>
      ))}
    </div>
  );
}

// A grid of form-field skeletons — drop-in body for any drawer / modal that's
// fetching detail data. `cols` decides the grid columns at desktop widths.
export function ShimmerDrawerBody({ fields = 6, cols = 2 }) {
  return (
    <div
      aria-hidden="true"
      className="shimmer-drawer-grid"
      style={{ '--shimmer-drawer-cols': cols }}
    >
      {Array.from({ length: fields }).map((_, i) => (
        <ShimmerFormField key={i} span={i % 4 === 3 ? 2 : 1} />
      ))}
      <style>{`
        .shimmer-drawer-grid {
          display: grid; gap: .9rem;
          grid-template-columns: 1fr;
        }
        @media (min-width: 640px) {
          .shimmer-drawer-grid {
            grid-template-columns: repeat(var(--shimmer-drawer-cols), 1fr);
          }
        }
      `}</style>
    </div>
  );
}

// Single rectangle skeleton sized to the parent's height — for chart cards.
export function ShimmerChartBlock({ height = 200, radius = 10 }) {
  return <Shimmer height={`${height}px`} width="100%" radius={`${radius}px`} />;
}

// Inline-level skeleton (text-sized) used in place of "Loading…" tiny
// substrings inside a sentence or pill.
export function ShimmerInline({ width = '6rem', height = '.8rem' }) {
  return <Shimmer width={width} height={height} radius="999px" />;
}

// Full-route splash — shown by lazy-loaded routes while their chunk is
// fetching. Uses a light skeleton frame so the layout doesn't jump.
export function ShimmerFullPageSplash() {
  return <ShimmerPageBody cards={4} />;
}

// Mount this once at the app root or inside any page that uses shimmers.
// (Inline-styled keyframes don't deduplicate, so we expose this for
// callers that prefer a single explicit mount.)
export function ShimmerStyles() {
  return (
    <style>{`
      .shimmer {
        display: inline-block;
        background: linear-gradient(90deg,
          var(--shimmer-base, #e5e7eb) 0%,
          var(--shimmer-highlight, #f3f4f6) 50%,
          var(--shimmer-base, #e5e7eb) 100%);
        background-size: 200% 100%;
        animation: shimmer-pulse 1.4s ease-in-out infinite;
      }
      @keyframes shimmer-pulse {
        0%   { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
      @media (prefers-reduced-motion: reduce) {
        .shimmer { animation: none; opacity: .6; }
      }
    `}</style>
  );
}
