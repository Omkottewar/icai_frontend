import { useEffect, useState } from 'react';
import { useRoute, navigate } from '../../hooks/useRoute';
import { useAuth } from '../../context/AuthContext';
import {
  IconHome, IconCalendar, IconSearch, IconUser, IconMenu, IconX,
  IconBookOpen, IconBriefcase, IconHandshake, IconGraduationCap,
  IconBot, IconArrowRight, IconLogOut, IconBell, IconMessageSquare,
} from '../../icons';

// Fixed bottom-of-viewport navigation strip — mobile-only (hidden ≥768 px).
// Five primary destinations + a "More" sheet that holds everything else.
// Honours iOS safe-area-inset-bottom so the home indicator doesn't overlap
// the tabs.

const PRIMARY_TABS = [
  { to: '/',         Icon: IconHome,     label: 'Home' },
  { to: '/events',   Icon: IconCalendar, label: 'Events' },
  { to: '/search',   Icon: IconSearch,   label: 'Search' },
  // 4th slot is dynamic: Dashboard if signed in, Sign in otherwise (filled below)
];

// Items in the slide-up "More" sheet. Each shown only when the user has
// access (filtered at render time based on auth state).
const SHEET_ITEMS = [
  { to: '/about',               Icon: IconBookOpen,        label: 'About branch' },
  { to: '/members',             Icon: IconUser,            label: 'Members' },
  { to: '/students',            Icon: IconGraduationCap,   label: 'Students' },
  { to: '/resources',           Icon: IconBookOpen,        label: 'Resources & papers' },
  { to: '/announcements',       Icon: IconBell,            label: 'Announcements' },
  { to: '/praygyaan',           Icon: IconBot,             label: 'Ask PrayGyaan AI' },
  { to: '/job-vacancies',       Icon: IconBriefcase,       label: 'Job vacancies' },
  { to: '/members-directory',   Icon: IconUser,            label: 'Members directory', authOnly: true },
  { to: '/mock-tests',          Icon: IconGraduationCap,   label: 'Mock tests' },
  { to: '/book-room',           Icon: IconCalendar,        label: 'Book a room' },
  { to: '/gallery',             Icon: IconBookOpen,        label: 'Photo gallery' },
  { to: '/student-suggestions', Icon: IconMessageSquare,   label: 'Student suggestions' },
  { to: '/track-grievance',     Icon: IconHandshake,       label: 'Track grievance' },
  { to: '/contact',             Icon: IconHandshake,       label: 'Contact us' },
  { to: '/my-library',          Icon: IconBookOpen,        label: 'My library', authOnly: true },
];

function isActive(currentPath, to) {
  if (to === '/') return currentPath === '/';
  // Match exact + child routes (so /events/foo highlights the Events tab).
  return currentPath === to || currentPath.startsWith(to + '/');
}

export default function BottomNav() {
  const { user, logout } = useAuth();
  const { path } = useRoute();
  const [sheetOpen, setSheetOpen] = useState(false);

  // Close the sheet whenever the route changes.
  useEffect(() => { setSheetOpen(false); }, [path]);

  // Lock scroll while sheet is up so the user can flick through it without
  // accidentally dragging the page underneath.
  useEffect(() => {
    if (!sheetOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [sheetOpen]);

  const fourthTab = user
    ? { to: '/dashboard', Icon: IconUser, label: 'Dashboard' }
    : { to: '/login',     Icon: IconUser, label: 'Sign in'   };
  const visibleTabs = [...PRIMARY_TABS, fourthTab];
  // Slot count includes the Menu tab for indicator positioning.
  const totalSlots = visibleTabs.length + 1;
  // Find which slot the indicator should sit under.
  let activeIndex = visibleTabs.findIndex((t) => isActive(path, t.to));
  if (sheetOpen) activeIndex = totalSlots - 1;            // Menu is "active" when its sheet is open
  if (activeIndex < 0) activeIndex = 0;                    // fallback so the pill always exists

  return (
    <>
      <nav className="bottom-nav" aria-label="Primary mobile navigation">
        {/* Animated active indicator. Slides smoothly between tabs on
            route change — the bit that makes the nav feel app-like
            instead of "5 links in a row". */}
        <span
          className="bottom-nav-indicator"
          aria-hidden="true"
          style={{
            width: `calc(100% / ${totalSlots})`,
            left:  `calc(${activeIndex} * (100% / ${totalSlots}))`,
          }}
        />
        {visibleTabs.map(({ to, Icon, label }) => {
          const active = isActive(path, to) && !sheetOpen;
          return (
            <a
              key={to}
              href={to}
              className={'bottom-nav-tab' + (active ? ' is-active' : '')}
              aria-current={active ? 'page' : undefined}
            >
              <span className="bottom-nav-icon"><Icon /></span>
              <span className="bottom-nav-label">{label}</span>
            </a>
          );
        })}
        <button
          type="button"
          className={'bottom-nav-tab' + (sheetOpen ? ' is-active' : '')}
          onClick={() => setSheetOpen((v) => !v)}
          aria-expanded={sheetOpen}
          aria-haspopup="dialog"
        >
          <span className="bottom-nav-icon">{sheetOpen ? <IconX /> : <IconMenu />}</span>
          <span className="bottom-nav-label">Menu</span>
        </button>
      </nav>

      {sheetOpen && (
        <BottomSheet
          onClose={() => setSheetOpen(false)}
          authed={!!user}
          onLogout={() => { setSheetOpen(false); logout(); }}
        />
      )}
    </>
  );
}

function BottomSheet({ onClose, authed, onLogout }) {
  const items = SHEET_ITEMS.filter((i) => !i.authOnly || authed);

  return (
    <div className="bottom-sheet-backdrop" role="dialog" aria-modal="true" aria-label="More menu" onClick={onClose}>
      <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="bottom-sheet-handle" aria-hidden="true" />
        <h2 className="bottom-sheet-title">More</h2>

        <div className="bottom-sheet-grid">
          {items.map(({ to, Icon, label }) => (
            <a key={to} href={to} className="bottom-sheet-item" onClick={onClose}>
              <span className="bottom-sheet-item-icon" aria-hidden="true"><Icon /></span>
              <span className="bottom-sheet-item-label">{label}</span>
            </a>
          ))}
        </div>

        {/* Auth controls live at the bottom of the sheet, separated. */}
        <div className="bottom-sheet-footer">
          {authed ? (
            <button type="button" className="btn btn-outline" onClick={onLogout} style={{ width: '100%', justifyContent: 'center' }}>
              <IconLogOut size="sm" /> Sign out
            </button>
          ) : (
            <div className="col gap-2">
              <a href="/login" className="btn btn-primary" onClick={onClose} style={{ justifyContent: 'center' }}>
                Sign in <IconArrowRight size="sm" />
              </a>
              <a href="/signup" className="btn btn-outline" onClick={onClose} style={{ justifyContent: 'center' }}>
                Create account
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
