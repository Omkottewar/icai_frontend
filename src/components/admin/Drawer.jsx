import { useEffect } from 'react';
import { IconX } from '../../icons';

// Right-side slide-over for create/edit forms.
// Closes on Esc + backdrop click. Renders nothing when !open.
export default function Drawer({ open, onClose, title, children, footer, width = 560 }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="admin-drawer-root" role="dialog" aria-modal="true">
      <div className="admin-drawer-backdrop" onClick={onClose} />
      <aside className="admin-drawer-panel" style={{ width }}>
        <div className="admin-drawer-head">
          <h2 className="admin-drawer-title">{title}</h2>
          <button type="button" className="admin-drawer-close" onClick={onClose} aria-label="Close">
            <IconX size="sm" />
          </button>
        </div>
        <div className="admin-drawer-body">{children}</div>
        {footer && <div className="admin-drawer-foot">{footer}</div>}
      </aside>

      <style>{`
        .admin-drawer-root { position: fixed; inset: 0; z-index: 100; }
        .admin-drawer-backdrop {
          position: absolute; inset: 0; background: rgba(15,23,42,.45);
          animation: admin-fade-in .12s ease-out;
        }
        .admin-drawer-panel {
          position: absolute; top: 0; right: 0; bottom: 0;
          max-width: 100vw; background: var(--card);
          display: flex; flex-direction: column;
          box-shadow: -8px 0 30px rgba(0,0,0,.15);
          animation: admin-slide-in .18s ease-out;
        }
        .admin-drawer-head {
          display: flex; justify-content: space-between; align-items: center;
          padding: 1rem 1.25rem; border-bottom: 1px solid var(--border);
        }
        .admin-drawer-title { font-size: 1rem; font-weight: 700; margin: 0; }
        .admin-drawer-close {
          background: transparent; border: 0; cursor: pointer;
          padding: .375rem; color: var(--muted-foreground);
        }
        .admin-drawer-close:hover { color: var(--foreground); }
        .admin-drawer-body { flex: 1; overflow-y: auto; padding: 1.25rem; }
        .admin-drawer-foot {
          padding: .875rem 1.25rem; border-top: 1px solid var(--border);
          background: var(--background); display: flex; gap: .5rem; justify-content: flex-end;
        }
        @keyframes admin-fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes admin-slide-in { from { transform: translateX(100%); } to { transform: translateX(0); } }
      `}</style>
    </div>
  );
}
