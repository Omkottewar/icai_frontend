// Hover/focus link prefetching.
//
// Goal: when the user's cursor enters a nav link (or it gets keyboard focus,
// or a touch begins), kick off the dynamic `import()` for that route's chunk.
// By the time the click actually fires — typically 100-400 ms later — the
// JS is already parsed and React.lazy resolves synchronously, so the page
// paints with whatever data is in the apiCache instead of showing a fallback.
//
// Why a registry: the import specifier here must match the one in
// router/AppShell.jsx exactly. Vite/Rollup dedupe `import('./foo')` calls by
// resolved URL, so two callsites that import the same module share one
// promise. As long as the specifiers match, calling the loader here warms
// the same chunk React.lazy is going to wait on.
//
// Why delegated listening: instead of wrapping every <a> in a custom
// component, we attach one mouseover/focusin/touchstart handler to the
// document and read the closest <a href="/..."> at the event target. This
// covers nav links, dashboard CTAs, footer links, dropdown items, anchors
// inside markdown content — anything that uses the hashbang convention.

// ─── Loader registries ──────────────────────────────────────────────────
//
// Keep these specifiers in lockstep with router/AppShell.jsx. If you add a
// new lazy route there, mirror it here so it gets prefetched on hover.

const ROUTE_LOADERS = {
  '/about':              () => import('../pages/AboutPage'),
  '/events':             () => import('../pages/EventsPage'),
  '/members':            () => import('../pages/MembersPage'),
  '/students':           () => import('../pages/StudentsPage'),
  '/resources':          () => import('../pages/ResourcesPage'),
  '/contact':            () => import('../pages/ContactPage'),
  '/praygyaan':          () => import('../pages/PrayGyaanPage'),
  '/benevolent-fund':    () => import('../pages/BenevolentFundPage'),
  '/ca2-vision':         () => import('../pages/CA2VisionPage'),
  '/investor-awareness': () => import('../pages/InvestorAwarenessPage'),
  '/career-counselling': () => import('../pages/CareerCounsellingPage'),
  '/search':             () => import('../pages/SearchPage'),
  '/dashboard':          () => import('../pages/DashboardPage'),
  '/my-checklists':      () => import('../pages/ChecklistInstancesPage'),
  '/branch-insights':    () => import('../pages/BranchMetricsPage'),
  '/treasurer-insights': () => import('../pages/TreasurerInsightsPage'),
  '/onboarding':         () => import('../pages/auth/OnboardingPage'),
  '/gallery':            () => import('../pages/PhotoGalleryPage'),
  '/job-vacancies':      () => import('../pages/JobVacanciesPage'),
  '/members-directory':  () => import('../pages/MembersDirectoryPage'),
  '/book-room':          () => import('../pages/RoomBookingPage'),
  '/track-grievance':    () => import('../pages/TrackGrievancePage'),
  '/my-library':         () => import('../pages/MyLibraryPage'),
  '/resources/submit':   () => import('../pages/ResourceSubmitPage'),
  '/mock-tests':         () => import('../pages/MockTestsPage'),
  '/student-forum':      () => import('../pages/StudentForumPage'),
  '/scholarships':       () => import('../pages/ScholarshipsPage'),
};

// Every /admin/* visit needs the RequireAdmin gate, the AdminShell
// (persistent sidebar + topbar), and the leaf page. We prefetch all
// three together so a hover over any admin link warms the entire
// downstream chain in parallel — admin entry feels instant instead of
// downloading the shell on click.
const ADMIN_GATE_LOADER  = () => import('../components/admin/RequireAdmin');
const ADMIN_SHELL_LOADER = () => import('../components/admin/AdminShell');
const ADMIN_LOADERS = {
  '/admin':                     () => import('../pages/admin/AdminDashboardPage'),
  '/admin/events':              () => import('../pages/admin/EventsAdminPage'),
  '/admin/registrations':       () => import('../pages/admin/EventRegistrationsAdminPage'),
  '/admin/users':               () => import('../pages/admin/UsersAdminPage'),
  '/admin/signup-approvals':    () => import('../pages/admin/SignupApprovalsAdminPage'),
  '/admin/committees':          () => import('../pages/admin/CommitteesAdminPage'),
  '/admin/approvals':           () => import('../pages/admin/ApprovalsAdminPage'),
  '/admin/announcements':       () => import('../pages/admin/AnnouncementsAdminPage'),
  '/admin/checklist-templates': () => import('../pages/admin/ChecklistTemplatesAdminPage'),
  '/admin/jobs':                () => import('../pages/admin/JobPostingsAdminPage'),
  '/admin/notifications-log':   () => import('../pages/admin/NotificationsLogAdminPage'),
  '/admin/site-content':        () => import('../pages/admin/SiteContentAdminPage'),
  '/admin/site-settings':       () => import('../pages/admin/SiteSettingsAdminPage'),
  '/admin/paper-presentations': () => import('../pages/admin/PaperPresentationsAdminPage'),
  '/admin/newsletters':         () => import('../pages/admin/NewslettersAdminPage'),
  '/admin/gallery':             () => import('../pages/admin/GalleryAlbumsAdminPage'),
  '/admin/office-bearers':      () => import('../pages/admin/OfficeBearersAdminPage'),
  '/admin/annual-reports':      () => import('../pages/admin/AnnualReportsAdminPage'),
  '/admin/grievances':          () => import('../pages/admin/GrievancesAdminPage'),
  '/admin/grievance-routes':    () => import('../pages/admin/GrievanceRoutesAdminPage'),
  '/admin/resources':           () => import('../pages/admin/ResourcesAdminPage'),
  '/admin/mock-tests':          () => import('../pages/admin/MockTestsAdminPage'),
  '/admin/scholarships':        () => import('../pages/admin/ScholarshipsAdminPage'),
  '/admin/bills':               () => import('../pages/admin/BillsAdminPage'),
  '/admin/refunds':             () => import('../pages/admin/RefundsAdminPage'),
  '/admin/iut-transfers':       () => import('../pages/admin/IutTransfersAdminPage'),
};

const EMPLOYER_GATE_LOADER = () => import('../components/employer/RequireEmployer');
const EMPLOYER_LOADERS = {
  '/employer':              () => import('../pages/employer/EmployerDashboardPage'),
  '/employer/postings':     () => import('../pages/employer/EmployerPostingsPage'),
  '/employer/postings/new': () => import('../pages/employer/EmployerPostingFormPage'),
  '/employer/profile':      () => import('../pages/employer/EmployerProfilePage'),
};

// Slug-based routes — match by prefix, since every paper/journal/speaker has
// a unique slug we can't enumerate. One loader serves the whole prefix.
const SLUG_PREFIXES = [
  { prefix: '/resources/papers/',   suffix: '/quiz', loader: () => import('../pages/ResourceQuizPage') },
  { prefix: '/resources/papers/',                    loader: () => import('../pages/ResourcePaperPage') },
  { prefix: '/resources/journal/',                   loader: () => import('../pages/ResourceJournalPage') },
  { prefix: '/resources/speakers/',                  loader: () => import('../pages/ResourceSpeakerPage') },
];

// ─── Resolution + dedup ─────────────────────────────────────────────────
const PREFETCHED = new Set();

function resolveLoaders(path) {
  if (ROUTE_LOADERS[path]) return [ROUTE_LOADERS[path]];

  if (path === '/admin' || path.startsWith('/admin/')) {
    const out = [ADMIN_GATE_LOADER, ADMIN_SHELL_LOADER];
    if (ADMIN_LOADERS[path]) out.push(ADMIN_LOADERS[path]);
    // /admin/* paths with no exact match (e.g. /admin/resources/papers/<id>/quiz)
    // still warm the gate + shell. The leaf chunk loads on click.
    return out;
  }

  if (path === '/employer' || path.startsWith('/employer/')) {
    const out = [EMPLOYER_GATE_LOADER];
    if (EMPLOYER_LOADERS[path]) out.push(EMPLOYER_LOADERS[path]);
    // /employer/postings/<id>/edit is the EmployerPostingFormPage — also warm it.
    if (path.startsWith('/employer/postings/') && path.endsWith('/edit')) {
      out.push(EMPLOYER_LOADERS['/employer/postings/new']);
    }
    return out;
  }

  for (const r of SLUG_PREFIXES) {
    if (!path.startsWith(r.prefix)) continue;
    const rest = path.slice(r.prefix.length);
    if (r.suffix) {
      if (rest.endsWith(r.suffix)) return [r.loader];
    } else if (rest && !rest.includes('/')) {
      return [r.loader];
    }
  }
  return null;
}

// Public API. Idempotent — each path only fetches once per page load.
export function prefetchRoute(path) {
  if (!path || PREFETCHED.has(path)) return;
  PREFETCHED.add(path);
  const loaders = resolveLoaders(path);
  if (!loaders) return;
  for (const loader of loaders) {
    try { loader().catch(() => {}); } catch { /* ignore */ }
  }
}

// Convert an <a href> into a pathname we can look up in ROUTE_LOADERS.
// Handles both the new clean-URL shape ("/foo/bar?x=1") and the legacy
// hash shape ("#/foo/bar?x=1") so links from older emails/notifications
// still prefetch. Returns null for external / non-routable hrefs.
function pathFromHref(href) {
  if (!href) return null;
  // Legacy hash form — peel off the "#" prefix to expose "/foo/bar".
  const hashIdx = href.indexOf('#/');
  if (hashIdx !== -1) {
    const rest = href.slice(hashIdx + 1);
    const qIdx = rest.indexOf('?');
    return qIdx === -1 ? rest : rest.slice(0, qIdx);
  }
  // External / scheme-prefixed — skip.
  if (/^([a-z]+:)?\/\//i.test(href) || /^(mailto|tel|sms):/i.test(href)) return null;
  if (!href.startsWith('/')) return null;
  // Same-origin clean URL.
  const qIdx = href.indexOf('?');
  const hIdx = href.indexOf('#');
  let end = href.length;
  if (qIdx !== -1) end = Math.min(end, qIdx);
  if (hIdx !== -1) end = Math.min(end, hIdx);
  return href.slice(0, end);
}

// ─── Delegated event installer ──────────────────────────────────────────
//
// One listener on the document instead of per-link wiring — covers every
// <a href="/..."> anywhere in the tree, including those added dynamically
// (header dropdown, drawer detail panels, markdown content).
//
// Capture phase + passive: we only want to read the href; we never call
// preventDefault. Bubbling would still work but capture means we run before
// any per-element handlers and can never block them.
export function installLinkPrefetchListener() {
  if (typeof window === 'undefined' || window.__linkPrefetchInstalled) return;
  window.__linkPrefetchInstalled = true;

  const trigger = (event) => {
    let el = event.target;
    // Walk up at most a few hops to find the anchor — icons/spans inside the
    // link bubble events through their text node, not the anchor itself.
    for (let hop = 0; el && hop < 4; hop += 1, el = el.parentElement) {
      if (el.tagName === 'A') {
        const path = pathFromHref(el.getAttribute('href'));
        if (path) prefetchRoute(path);
        return;
      }
    }
  };

  // mouseover fires when entering any descendant — combined with the
  // PREFETCHED dedup, that's fine and avoids the mouseenter-doesn't-bubble
  // gotcha. focusin covers keyboard nav. touchstart gives mobile a head
  // start before the click resolves.
  document.addEventListener('mouseover',  trigger, { capture: true, passive: true });
  document.addEventListener('focusin',    trigger, { capture: true, passive: true });
  document.addEventListener('touchstart', trigger, { capture: true, passive: true });
}