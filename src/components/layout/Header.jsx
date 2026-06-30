import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { navigate } from '../../hooks/useRoute';
import Link from '../ui/Link';
import { NAV, SOCIALS } from '../../data/constants';
import { useSiteSettings } from '../../hooks/useSiteSettings';
import { firstName, initials } from '../../lib/displayName';
import caIndiaLogo from '../../assets/CA India Logo.png';
import NotificationsBell from './NotificationsBell';
import {
  IconSearch, IconBot, IconChevronDown, IconUser, IconShield,
  IconSettings, IconLogOut, IconMenu, IconX,
  IconPhone, IconMail, IconMapPin,
} from '../../icons';

export default function Header() {
  const { user, logout } = useAuth();
  const { settings } = useSiteSettings();
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [q, setQ] = useState('');
  const menuRef = useRef(null);
  const headerRef = useRef(null);

  // The audience tab bar on /events (and any other page-level sticky bar)
  // needs to stick *below* this header. The header height changes with
  // viewport (mobile collapses the top-bar items) and with the mobile-nav
  // expand state, so we publish the live height as a CSS variable that
  // children can read with `top: var(--header-h)`.
  useLayoutEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const publish = () => {
      document.documentElement.style.setProperty('--header-h', `${el.offsetHeight}px`);
    };
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    window.addEventListener('resize', publish);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', publish);
    };
  }, [open]);

  // tel: links need digits-only; mailto can pass the raw email through.
  const phoneTel = (settings.branch_phone || '').replace(/[^\d+]/g, '');

  useEffect(() => {
    const close = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const onSearch = (e) => {
    e.preventDefault();
    navigate('/search?q=' + encodeURIComponent(q));
  };

  return (
    <header ref={headerRef} style={{ position: 'sticky', top: 0, zIndex: 100, background: 'var(--primary)', color: 'var(--primary-foreground)', borderBottom: '1px solid rgba(255,255,255,.12)' }}>
      {/* Top bar */}
      <div style={{ background: 'white', color: 'var(--foreground)', borderBottom: '1px solid rgba(0,0,0,.08)' }}>
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '.375rem 1rem', fontSize: '.75rem' }}>
          <div className="row gap-3" style={{ fontSize: '.75rem', color: 'rgba(0,0,0,.75)' }}>
            <span className="row gap-1" style={{ fontWeight: 600, color: 'var(--primary)' }}>
              <span className="live-dot" /> Branch Open · {settings.branch_hours}
            </span>
            <span style={{ opacity: .35, color: 'black' }} className="hide-on-mobile">|</span>
            <a href={`tel:${phoneTel}`} className="row gap-1 hide-on-mobile" style={{ color: 'black', opacity: .8 }}>
              <IconPhone size="sm" /> {settings.branch_phone}
            </a>
            <span style={{ opacity: .35, color: 'black' }} className="hide-on-mobile">|</span>
            <a href={`mailto:${settings.branch_email}`} className="row gap-1 hide-on-mobile" style={{ color: 'black', opacity: .8 }}>
              <IconMail size="sm" /> {settings.branch_email}
            </a>
            {settings.branch_map_url && (
              <>
                <span style={{ opacity: .35, color: 'black', display: 'none' }} className="hide-on-tablet">|</span>
                <a
                  href={settings.branch_map_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hide-on-tablet row gap-1"
                  style={{ opacity: .75, color: 'black' }}
                  aria-label="Open branch address in Google Maps"
                >
                  <IconMapPin size="sm" /> ICAI Bhawan, Nagpur
                </a>
              </>
            )}
          </div>
          <div className="row gap-3" style={{ color: 'var(--primary)', opacity: .9 }}>
            {SOCIALS.map((s) => (
              <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label} style={{ color: 'var(--primary)' }}><s.Icon size="sm" /></a>
            ))}
          </div>
        </div>
      </div>

      {/* Main nav bar */}
      <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '.75rem 1rem' }}>
        <a href="/" className="row gap-3" style={{ color: 'white' }}>
          <div style={{ width: '2.75rem', height: '2.75rem', borderRadius: '.5rem', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: '.25rem' }}>
            <img src={caIndiaLogo} alt="CA India" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
          </div>
          <div>
            <div style={{ fontSize: '.875rem', fontWeight: 700, lineHeight: 1.2 }}>ICAI Nagpur Branch (WIRC)</div>
          </div>
        </a>

        <nav className="row gap-1" style={{ display: 'none' }} data-desktop-nav>
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} className="nav-link" activeClassName="nav-link-active">
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="row gap-2">
          <form onSubmit={onSearch} className="row gap-2 search-form" style={{ display: 'none', border: '1px solid rgba(255,255,255,.2)', background: 'rgba(255,255,255,.08)', borderRadius: '.375rem', padding: '.375rem .75rem' }}>
            <IconSearch size="sm" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search…"
              style={{ background: 'transparent', border: 0, outline: 'none', fontSize: '.875rem', width: '11rem', color: 'white' }}
            />
          </form>

          {/* <a href="/praygyaan" className="row gap-1 praygyaan-pill" style={{ display: 'none', padding: '.375rem .75rem', background: 'rgba(255,255,255,.12)', color: 'white', borderRadius: '.375rem', fontSize: '.75rem', fontWeight: 600 }}>
            <IconBot size="sm" /> PrayGyaan AI
          </a> */}

          {user && <NotificationsBell />}

          {user ? (
            <div ref={menuRef} style={{ position: 'relative' }}>
              <button className="avatar-trigger" onClick={() => setMenuOpen(!menuOpen)}>
                <span className="avatar-circle">{initials(user.name)}</span>
                <span className="hide-on-mobile">{firstName(user.name)}</span>
                <IconChevronDown size="sm" />
              </button>
              {menuOpen && (
                <div className="avatar-menu">
                  <div style={{ padding: '.5rem .625rem', borderBottom: '1px solid var(--border)', marginBottom: '.25rem' }}>
                    <div style={{ fontSize: '.8125rem', fontWeight: 600 }}>{user.name}</div>
                    <div style={{ fontSize: '.75rem', color: 'var(--muted-foreground)' }}>{user.email}</div>
                    <span className="badge badge-secondary" style={{ marginTop: '.375rem' }}>{user.role}</span>
                  </div>
                  <a href="/dashboard" className="menu-item" onClick={() => setMenuOpen(false)}><IconUser size="sm" /> Dashboard</a>
                  {(() => {
                    // Office bearers get a prominent shortcut into the role-aware
                    // /admin home (chairman → ChairmanHome, treasurer → TreasurerHome,
                    // etc.). The label changes based on the most-specific role we
                    // can identify so the menu reads as "your" workspace, not a
                    // generic "Admin console".
                    const codes = new Set((user.roles ?? []).map((r) => r.code));
                    const label =
                      codes.has('admin')                  ? 'Admin console' :
                      codes.has('branch_treasurer')        ? 'Treasurer dashboard' :
                      codes.has('branch_chairman')         ? 'Chairman dashboard' :
                      codes.has('branch_vice_chairman')    ? 'Vice-Chairman dashboard' :
                      codes.has('branch_secretary')        ? 'Secretary dashboard' :
                      codes.has('committee_chairman')      ? 'Committee dashboard' :
                      codes.has('accountant')              ? 'Bills register' :
                      codes.has('branch_manager')          ? 'Branch console' :
                      null;
                    if (!label) return null;
                    return (
                      <a href="/admin" className="menu-item" onClick={() => setMenuOpen(false)} style={{ color: 'var(--primary)', fontWeight: 600 }}>
                        <IconShield size="sm" /> {label}
                      </a>
                    );
                  })()}
                  {user.role === 'Employer' && (
                    <a href="/employer" className="menu-item" onClick={() => setMenuOpen(false)} style={{ color: 'var(--primary)', fontWeight: 600 }}>
                      <IconShield size="sm" /> Employer dashboard
                    </a>
                  )}
                  <a href="/members" className="menu-item" onClick={() => setMenuOpen(false)}><IconShield size="sm" /> Member services</a>
                  <a href="/dashboard" className="menu-item" onClick={() => setMenuOpen(false)}><IconSettings size="sm" /> Settings</a>
                  <button className="menu-item" onClick={() => { setMenuOpen(false); logout(); }} style={{ color: 'var(--destructive)', width: '100%', textAlign: 'left' }}>
                    <IconLogOut size="sm" /> Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <a href="/login" className="btn btn-outline" style={{ padding: '.4rem .9rem' }}>Sign in</a>
              <a href="/signup" className="btn btn-primary signup-cta" style={{ display: 'none', padding: '.4rem .9rem' }}>Sign up</a>
            </>
          )}

          <button className="mobile-toggle" style={{ display: 'inline-flex' }} onClick={() => setOpen(!open)} aria-label="Menu">
            {open ? <IconX /> : <IconMenu />}
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      {open && (
        <div className="container" style={{ paddingBottom: '.75rem' }}>
          <nav className="col" style={{ borderTop: '1px solid var(--border)', paddingTop: '.5rem' }}>
            {NAV.map((n) => (
              <a key={n.to} href={n.to} onClick={() => setOpen(false)} style={{ padding: '.5rem 0', fontSize: '.875rem', fontWeight: 500 }}>
                {n.label}
              </a>
            ))}
            <a href="/praygyaan" onClick={() => setOpen(false)} style={{ padding: '.5rem 0', fontSize: '.875rem', fontWeight: 600, color: 'var(--secondary)' }}>PrayGyaan AI</a>
            {user && (() => {
              // Office bearers get a direct mobile link into /admin too — the
              // chairman approving from her phone during a meeting shouldn't
              // have to dig into the avatar dropdown to find it.
              const codes = new Set((user.roles ?? []).map((r) => r.code));
              const officeBearer = ['admin','branch_chairman','branch_vice_chairman',
                'branch_secretary','branch_treasurer','committee_chairman',
                'accountant','branch_manager'].some((c) => codes.has(c));
              if (!officeBearer) return null;
              return (
                <a href="/admin" onClick={() => setOpen(false)} style={{ padding: '.5rem 0', fontSize: '.875rem', fontWeight: 600, color: 'var(--primary)' }}>
                  Open your dashboard →
                </a>
              );
            })()}
            {!user && (
              <a href="/signup" onClick={() => setOpen(false)} style={{ padding: '.5rem 0', fontSize: '.875rem', fontWeight: 600, color: 'var(--primary)' }}>Create account →</a>
            )}
          </nav>
        </div>
      )}

      <style>{`
        .nav-link { padding: .5rem .75rem; border-radius: .25rem; font-size: .875rem; font-weight: 500; color: rgba(255,255,255,.9); transition: all .15s; }
        .nav-link:hover { background: rgba(255,255,255,.15); color: white; }
        .nav-link-active { background: rgba(255,255,255,.18); color: white; font-weight: 600; }
        .live-dot { width: .5rem; height: .5rem; border-radius: 9999px; background: #22c55e; box-shadow: 0 0 0 0 rgba(34,197,94,.7); animation: livePulse 1.8s ease-out infinite; display: inline-block; }
        @keyframes livePulse {
          0% { box-shadow: 0 0 0 0 rgba(34,197,94,.55); }
          70% { box-shadow: 0 0 0 .45rem rgba(34,197,94,0); }
          100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); }
        }
        @media (min-width: 1024px) {
          [data-desktop-nav] { display: flex !important; }
          .mobile-toggle { display: none !important; }
          .hide-on-tablet { display: inline-flex !important; }
        }
        @media (min-width: 768px) {
          .search-form { display: flex !important; }
          .praygyaan-pill { display: inline-flex !important; }
          .signup-cta { display: inline-flex !important; }
        }
        @media (max-width: 1023px) {
          .hide-on-tablet { display: none !important; }
        }
        @media (max-width: 600px) {
          .hide-on-mobile { display: none !important; }
        }
      `}</style>
    </header>
  );
}
