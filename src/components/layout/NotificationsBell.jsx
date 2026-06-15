import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../hooks/useNotifications';
import { IconBell, IconCheck } from '../../icons';

// Header bell + dropdown inbox. Mounts inside Header.jsx next to the avatar.
// Polls every 30s (handled inside the hook); on dropdown open we don't refetch
// — the freshness from polling is enough and an extra fetch would feel laggy.

function relativeTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60)    return `${Math.floor(diff)}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString();
}

export default function NotificationsBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [panelTop, setPanelTop] = useState(60); // px, used only when fixed-positioned on mobile
  const wrapRef = useRef(null);
  const triggerRef = useRef(null);

  // Hook is enabled only when the user is signed in — anonymous visitors
  // shouldn't be hitting /api/notifications.
  const { items, unread, loading, markRead, markAllRead } = useNotifications({ enabled: Boolean(user) });

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  // When opening on a narrow viewport the panel is fixed-positioned (see
  // CSS below). Anchor its top to the bottom of the bell trigger so it
  // hugs the sticky header regardless of how tall the header has rendered.
  useEffect(() => {
    if (!open) return;
    const update = () => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (r) setPanelTop(Math.max(8, Math.round(r.bottom + 8)));
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open]);

  if (!user) return null;

  const onItemClick = (n) => {
    if (!n.read_at) markRead(n.id);
    if (n.link_url) {
      if (n.link_url.startsWith('http')) window.open(n.link_url, '_blank');
      else window.location.hash = n.link_url.replace(/^#/, '');
    }
    setOpen(false);
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ''}`}
        className="bell-trigger"
      >
        <IconBell />
        {unread > 0 && (
          <span className="bell-badge">{unread > 99 ? '99+' : unread}</span>
        )}
      </button>

      {open && (
        <div className="bell-panel" style={{ '--bell-panel-top': `${panelTop}px` }}>
          <div className="bell-panel-head">
            <strong style={{ fontSize: '.875rem' }}>Notifications</strong>
            {unread > 0 && (
              <button type="button" onClick={markAllRead} className="bell-mark-all">
                <IconCheck size="sm" /> Mark all read
              </button>
            )}
          </div>

          <div className="bell-list">
            {loading && items.length === 0 && (
              <div className="bell-empty">Loading…</div>
            )}
            {!loading && items.length === 0 && (
              <div className="bell-empty">You're all caught up.</div>
            )}
            {items.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => onItemClick(n)}
                className={`bell-item ${n.read_at ? 'bell-item-read' : 'bell-item-unread'}`}
              >
                <div className="bell-item-title">
                  {!n.read_at && <span className="bell-item-dot" aria-hidden />}
                  {n.title}
                </div>
                {n.body && <div className="bell-item-body">{n.body}</div>}
                <div className="bell-item-meta">{relativeTime(n.created_at)}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      <style>{`
        .bell-trigger {
          position: relative; display: inline-flex; align-items: center; justify-content: center;
          width: 2.25rem; height: 2.25rem; border-radius: .375rem;
          background: rgba(255,255,255,.08); color: white; border: 0; cursor: pointer; transition: background .15s;
        }
        .bell-trigger:hover { background: rgba(255,255,255,.18); }
        .bell-badge {
          position: absolute; top: -.25rem; right: -.25rem;
          min-width: 1.1rem; height: 1.1rem; padding: 0 .3rem;
          background: var(--destructive, #dc2626); color: white;
          border-radius: 999px; font-size: .65rem; font-weight: 700;
          display: inline-flex; align-items: center; justify-content: center;
          line-height: 1; box-shadow: 0 0 0 2px var(--primary, #1e3a8a);
        }
        .bell-panel {
          position: absolute; top: calc(100% + .5rem); right: 0;
          width: 22rem; max-width: 92vw; max-height: 28rem;
          background: white; color: var(--foreground, #111);
          border: 1px solid var(--border, rgba(0,0,0,.1));
          border-radius: .5rem; box-shadow: 0 8px 32px rgba(0,0,0,.18);
          display: flex; flex-direction: column; z-index: 60;
        }
        /* On phones the bell isn't at the viewport edge (avatar + hamburger
           sit to its right), so anchoring the 22rem panel to the bell's
           right would clip off-screen on the left. Pin it to the viewport
           instead and let it span almost edge-to-edge. */
        @media (max-width: 640px) {
          .bell-panel {
            position: fixed;
            top: var(--bell-panel-top, 3.75rem);
            left: .5rem;
            right: .5rem;
            width: auto;
            max-width: none;
            max-height: 70vh;
          }
        }
        .bell-panel-head {
          display: flex; justify-content: space-between; align-items: center;
          padding: .625rem .75rem; border-bottom: 1px solid var(--border, rgba(0,0,0,.08));
        }
        .bell-mark-all {
          display: inline-flex; align-items: center; gap: .25rem;
          background: transparent; border: 0; color: var(--primary); font-size: .75rem;
          cursor: pointer; padding: .25rem .5rem; border-radius: .25rem;
        }
        .bell-mark-all:hover { background: rgba(0,0,0,.05); }
        .bell-list { overflow-y: auto; flex: 1; }
        .bell-empty { padding: 1.5rem; text-align: center; color: var(--muted-foreground); font-size: .8125rem; }
        .bell-item {
          width: 100%; text-align: left; padding: .625rem .75rem;
          border: 0; border-bottom: 1px solid var(--border, rgba(0,0,0,.06));
          background: white; cursor: pointer; display: block;
        }
        .bell-item:hover { background: rgba(0,0,0,.03); }
        .bell-item-unread { background: rgba(59,130,246,.06); }
        .bell-item-unread:hover { background: rgba(59,130,246,.10); }
        .bell-item-title {
          font-size: .8125rem; font-weight: 600; color: var(--foreground, #111);
          display: flex; align-items: center; gap: .375rem; line-height: 1.3;
        }
        .bell-item-read .bell-item-title { font-weight: 500; color: var(--muted-foreground, #555); }
        .bell-item-dot {
          width: .5rem; height: .5rem; border-radius: 999px;
          background: var(--primary, #2563eb); flex-shrink: 0;
        }
        .bell-item-body {
          font-size: .75rem; color: var(--muted-foreground, #555);
          margin-top: .125rem; line-height: 1.35;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
        }
        .bell-item-meta {
          font-size: .6875rem; color: var(--muted-foreground, #777);
          margin-top: .25rem;
        }
      `}</style>
    </div>
  );
}
