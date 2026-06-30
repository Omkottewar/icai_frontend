import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRoute } from '../../hooks/useRoute';
import caIndiaLogo from '../../assets/CA India Logo.png';
import NotificationsBell from './NotificationsBell';
import { initials as displayInitials } from '../../lib/displayName';

// Mobile-only top app bar. Shown only ≤768 px; the desktop Header is
// hidden in that range via CSS. Slim 56-px tall, solid primary background,
// safe-area-top padding for the iPhone notch. Adds a small elevation
// shadow once the user scrolls so it feels like a native nav bar.
//
// Layout: [logo] [title]  ........  [bell] [avatar]
//
// Title is route-aware — shows the current section name (Events,
// Members, …) for context, falls back to "Nagpur Branch" on /.

const TITLE_BY_PATH = {
  '/':                  'Nagpur Branch',
  '/about':             'About',
  '/events':            'Events',
  '/members':           'Members',
  '/students':          'Students',
  '/resources':         'Resources',
  '/contact':           'Contact',
  '/praygyaan':         'Pragyaan AI',
  '/dashboard':         'Dashboard',
  '/announcements':     'Announcements',
  '/members-directory': 'Members Directory',
  '/job-vacancies':     'Job Vacancies',
  '/mock-tests':        'Mock Tests',
  '/book-room':         'Book a Room',
  '/track-grievance':   'Track Grievance',
  '/gallery':           'Photo Gallery',
  '/my-library':        'My Library',
  '/search':            'Search',
  '/login':             'Sign in',
  '/signup':            'Create account',
};

function resolveTitle(path) {
  if (TITLE_BY_PATH[path]) return TITLE_BY_PATH[path];
  // Walk back the path until we match a known section (e.g. /events/foo → Events).
  const head = path.split('/').slice(0, 2).join('/');
  if (TITLE_BY_PATH[head]) return TITLE_BY_PATH[head];
  return 'Nagpur Branch';
}

export default function MobileAppBar() {
  const { user } = useAuth();
  const { path } = useRoute();
  const [elevated, setElevated] = useState(false);

  // Shadow / blur kicks in once the user has scrolled past 8 px so the
  // bar reads as floating above content (Material's `app bar — scrolled`
  // pattern).
  useEffect(() => {
    const onScroll = () => setElevated(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const initials = user?.name ? displayInitials(user.name) : null;

  return (
    <header className={'mobile-appbar' + (elevated ? ' is-scrolled' : '')} aria-label="App header">
      <a href="/" className="mobile-appbar-brand" aria-label="Home">
        <span className="mobile-appbar-logo">
          <img src={caIndiaLogo} alt="" />
        </span>
        <span className="mobile-appbar-title">{resolveTitle(path)}</span>
      </a>
      <div className="mobile-appbar-actions">
        <NotificationsBell />
        {user ? (
          <a href="/dashboard" className="mobile-appbar-avatar" aria-label="Open dashboard">
            {initials}
          </a>
        ) : (
          <a href="/login" className="mobile-appbar-signin">Sign in</a>
        )}
      </div>
    </header>
  );
}
