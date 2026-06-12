import { navigate } from '../../../hooks/useRoute';

// Small grid of "shortcut tiles". Each variant supplies the actions list as
// { label, description, href } OR { label, description, onClick }. href
// navigates via the hash router; onClick is fired directly (used for things
// like CSV downloads that bypass the SPA).
export default function QuickActions({ title, actions }) {
  return (
    <div className="home-card">
      <div className="home-card-head">
        <h2 className="home-card-title">{title}</h2>
      </div>
      <div className="home-quick-grid">
        {actions.map((a, i) => (
          <button
            key={a.href ?? a.label ?? i}
            type="button"
            onClick={() => (a.onClick ? a.onClick() : navigate(a.href))}
            className="home-quick-tile"
          >
            <div className="home-quick-label">{a.label}</div>
            {a.description && (
              <div className="home-quick-desc">{a.description}</div>
            )}
          </button>
        ))}
      </div>

      <style>{`
        .home-quick-grid {
          display: grid; gap: .75rem;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          padding: 1rem 1.125rem 1.125rem;
        }
        .home-quick-tile {
          text-align: left; padding: .875rem 1rem;
          background: var(--muted, #fafaf9);
          border: 1px solid var(--border);
          border-radius: .5rem;
          cursor: pointer; transition: background .12s, border-color .12s;
        }
        .home-quick-tile:hover {
          background: white;
          border-color: var(--primary, #1e40af);
        }
        .home-quick-label { font-size: .875rem; font-weight: 600; }
        .home-quick-desc { font-size: .75rem; color: var(--muted-foreground); margin-top: .25rem; line-height: 1.4; }
      `}</style>
    </div>
  );
}
