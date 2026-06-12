// Compact horizontal row of headline numbers. Used by every home variant so
// the user always knows the basic shape of the branch at a glance.
export default function StatStrip({ items }) {
  return (
    <div className="home-stat-strip">
      {items.map((s, i) => (
        <div key={i} className="home-stat-cell">
          <div className="home-stat-value">{s.value}</div>
          <div className="home-stat-label">{s.label}</div>
        </div>
      ))}

      <style>{`
        .home-stat-strip {
          display: grid; gap: 1px;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          background: var(--border, #e5e7eb);
          border: 1px solid var(--border);
          border-radius: .5rem; overflow: hidden;
        }
        .home-stat-cell {
          background: white; padding: .875rem 1rem;
          display: flex; flex-direction: column; gap: .125rem;
        }
        .home-stat-value { font-size: 1.5rem; font-weight: 700; line-height: 1.1; }
        .home-stat-label { font-size: .7rem; color: var(--muted-foreground); text-transform: uppercase; letter-spacing: .04em; }
      `}</style>
    </div>
  );
}
