// Reusable shimmer (skeleton-loading) primitives. Pure CSS, no deps.
//
// Use the small helpers below for the common shapes:
//   <Shimmer width="100%" height="1rem" />        — a single bar
//   <ShimmerLines count={3} lastWidth="60%" />    — text paragraph
//   <ShimmerTableRow cols={5} />                  — table row matching cols
//   <ShimmerStatTile />                            — dashboard stat tile
//   <ShimmerFormField />                           — labeled form field

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
