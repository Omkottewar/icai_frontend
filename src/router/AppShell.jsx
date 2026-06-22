import { lazy, Suspense, useEffect } from 'react';
import { useRoute } from '../hooks/useRoute';
import { useAuth } from '../context/AuthContext';
import caIndiaLogo from '../assets/CA India Logo.png';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import PushPermissionBanner from '../components/PushPermissionBanner';
import { ShimmerFullPageSplash, Shimmer, ShimmerLines } from '../components/ui/Shimmer';

// Inner Suspense fallback used for the admin content region only — the
// sidebar/topbar stay visible because they live in AdminShell above this
// boundary. Lighter weight than ShimmerFullPageSplash since the user is
// already inside the admin shell.
function AdminContentShimmer() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }} aria-hidden="true">
      <Shimmer height="1.2rem" width="40%" />
      <Shimmer height=".75rem" width="60%" />
      <div style={{ marginTop: '.5rem', display: 'grid', gap: '.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Shimmer key={i} height="6rem" width="100%" radius=".5rem" />
        ))}
      </div>
      <div style={{ marginTop: '.5rem' }}>
        <ShimmerLines count={3} />
      </div>
    </div>
  );
}

// Eagerly loaded — the entry point and auth surfaces. Splitting these would
// just delay the first interaction visitors care about.
import HomePage from '../pages/HomePage';
import NotFound from '../pages/NotFound';
import LoginPage from '../pages/auth/LoginPage';
import SignupPage from '../pages/auth/SignupPage';
import ForgotPage from '../pages/auth/ForgotPage';

// Everything else is lazy — the browser only fetches a page's chunk when
// the user navigates to it. Cuts the initial JS payload dramatically, so
// HomePage paints faster and the dashboard/admin shells download in
// parallel with the API calls they fire on mount.
const AboutPage              = lazy(() => import('../pages/AboutPage'));
const EventsPage             = lazy(() => import('../pages/EventsPage'));
const MembersPage            = lazy(() => import('../pages/MembersPage'));
const StudentsPage           = lazy(() => import('../pages/StudentsPage'));
const ResourcesPage          = lazy(() => import('../pages/ResourcesPage'));
const ContactPage            = lazy(() => import('../pages/ContactPage'));
const PrayGyaanPage          = lazy(() => import('../pages/PrayGyaanPage'));
const BenevolentFundPage     = lazy(() => import('../pages/BenevolentFundPage'));
const CA2VisionPage          = lazy(() => import('../pages/CA2VisionPage'));
const InvestorAwarenessPage  = lazy(() => import('../pages/InvestorAwarenessPage'));
const CareerCounsellingPage  = lazy(() => import('../pages/CareerCounsellingPage'));
const SearchPage             = lazy(() => import('../pages/SearchPage'));
const DashboardPage          = lazy(() => import('../pages/DashboardPage'));
const ChecklistInstancesPage = lazy(() => import('../pages/ChecklistInstancesPage'));
const BranchMetricsPage      = lazy(() => import('../pages/BranchMetricsPage'));

const OnboardingPage     = lazy(() => import('../pages/auth/OnboardingPage'));
const PhotoGalleryPage   = lazy(() => import('../pages/PhotoGalleryPage'));
const JobVacanciesPage   = lazy(() => import('../pages/JobVacanciesPage'));
const MembersDirectoryPage = lazy(() => import('../pages/MembersDirectoryPage'));
const RoomBookingPage    = lazy(() => import('../pages/RoomBookingPage'));
const TrackGrievancePage = lazy(() => import('../pages/TrackGrievancePage'));
const PrayGyaanWidget    = lazy(() => import('../components/ui/PrayGyaanWidget'));

const RequireAdmin               = lazy(() => import('../components/admin/RequireAdmin'));
const AdminShell                 = lazy(() => import('../components/admin/AdminShell'));
const AdminDashboardPage         = lazy(() => import('../pages/admin/AdminDashboardPage'));
const EventsAdminPage            = lazy(() => import('../pages/admin/EventsAdminPage'));
const EventRegistrationsAdminPage = lazy(() => import('../pages/admin/EventRegistrationsAdminPage'));
const UsersAdminPage             = lazy(() => import('../pages/admin/UsersAdminPage'));
const CommitteesAdminPage        = lazy(() => import('../pages/admin/CommitteesAdminPage'));
const SiteContentAdminPage       = lazy(() => import('../pages/admin/SiteContentAdminPage'));
const SiteSettingsAdminPage      = lazy(() => import('../pages/admin/SiteSettingsAdminPage'));
const AnnouncementsAdminPage     = lazy(() => import('../pages/admin/AnnouncementsAdminPage'));
const ComingSoonPage             = lazy(() => import('../pages/admin/ComingSoonPage'));
const JobPostingsAdminPage       = lazy(() => import('../pages/admin/JobPostingsAdminPage'));
const ChecklistTemplatesAdminPage = lazy(() => import('../pages/admin/ChecklistTemplatesAdminPage'));
const NotificationsLogAdminPage  = lazy(() => import('../pages/admin/NotificationsLogAdminPage'));
const ApprovalsAdminPage         = lazy(() => import('../pages/admin/ApprovalsAdminPage'));
const PaperPresentationsAdminPage = lazy(() => import('../pages/admin/PaperPresentationsAdminPage'));
const NewslettersAdminPage       = lazy(() => import('../pages/admin/NewslettersAdminPage'));
const GalleryAlbumsAdminPage     = lazy(() => import('../pages/admin/GalleryAlbumsAdminPage'));
const OfficeBearersAdminPage     = lazy(() => import('../pages/admin/OfficeBearersAdminPage'));
const AnnualReportsAdminPage     = lazy(() => import('../pages/admin/AnnualReportsAdminPage'));
const GrievancesAdminPage        = lazy(() => import('../pages/admin/GrievancesAdminPage'));
const GrievanceRoutesAdminPage   = lazy(() => import('../pages/admin/GrievanceRoutesAdminPage'));
const ResourcesAdminPage         = lazy(() => import('../pages/admin/ResourcesAdminPage'));
const QuizEditorPage             = lazy(() => import('../pages/admin/QuizEditorPage'));
const MockTestsAdminPage         = lazy(() => import('../pages/admin/MockTestsAdminPage'));

// Section L (Resources) — public-facing pages with slug-based detail routes.
const ResourcePaperPage   = lazy(() => import('../pages/ResourcePaperPage'));
const PaperReaderPage     = lazy(() => import('../pages/PaperReaderPage'));
const ResourceJournalPage = lazy(() => import('../pages/ResourceJournalPage'));
const ResourceSpeakerPage = lazy(() => import('../pages/ResourceSpeakerPage'));
const ResourceQuizPage    = lazy(() => import('../pages/ResourceQuizPage'));
const ResourceSubmitPage  = lazy(() => import('../pages/ResourceSubmitPage'));
const MyLibraryPage       = lazy(() => import('../pages/MyLibraryPage'));
const MockTestsPage       = lazy(() => import('../pages/MockTestsPage'));

const RequireEmployer         = lazy(() => import('../components/employer/RequireEmployer'));
const EmployerDashboardPage   = lazy(() => import('../pages/employer/EmployerDashboardPage'));
const EmployerPostingsPage    = lazy(() => import('../pages/employer/EmployerPostingsPage'));
const EmployerPostingFormPage = lazy(() => import('../pages/employer/EmployerPostingFormPage'));
const EmployerProfilePage     = lazy(() => import('../pages/employer/EmployerProfilePage'));

const ROUTES = {
  '/': HomePage,
  '/about': AboutPage,
  '/events': EventsPage,
  '/members': MembersPage,
  '/students': StudentsPage,
  '/resources': ResourcesPage,
  '/contact': ContactPage,
  '/praygyaan': PrayGyaanPage,
  '/benevolent-fund': BenevolentFundPage,
  '/ca2-vision': CA2VisionPage,
  '/investor-awareness': InvestorAwarenessPage,
  '/career-counselling': CareerCounsellingPage,
  '/search': SearchPage,
  '/dashboard': DashboardPage,
  '/my-checklists': ChecklistInstancesPage,
  '/branch-insights': BranchMetricsPage,
  '/login': LoginPage,
  '/signup': SignupPage,
  '/forgot': ForgotPage,
  '/onboarding': OnboardingPage,
  '/gallery': PhotoGalleryPage,
  '/job-vacancies': JobVacanciesPage,
  '/members-directory': MembersDirectoryPage,
  '/book-room': RoomBookingPage,
  '/track-grievance': TrackGrievancePage,
  '/my-library': MyLibraryPage,
  '/resources/submit': ResourceSubmitPage,
  '/mock-tests': MockTestsPage,
};

// Slug-based public routes. Resolved by prefix match in resolvePublicPage().
const SLUG_ROUTES = [
  { prefix: '/resources/papers/',   suffix: '/read', Page: PaperReaderPage },
  { prefix: '/resources/papers/',   suffix: '/quiz', Page: ResourceQuizPage },
  { prefix: '/resources/papers/',                    Page: ResourcePaperPage },
  { prefix: '/resources/journal/',                   Page: ResourceJournalPage },
  { prefix: '/resources/speakers/',                  Page: ResourceSpeakerPage },
];

// Admin routes. Each is wrapped in <RequireAdmin> at render time. Placeholder
// sections render the shared ComingSoonPage with their own title.
const ADMIN_ROUTES = {
  '/admin': AdminDashboardPage,
  '/admin/events': EventsAdminPage,
  '/admin/registrations': EventRegistrationsAdminPage,
  '/admin/users': UsersAdminPage,
  '/admin/cpe': () => <ComingSoonPage title="CPE credits" description="Issue structured/unstructured CPE credits, bulk-issue from event attendees, audit member compliance." />,
  '/admin/approvals': ApprovalsAdminPage,
  '/admin/rooms': () => <ComingSoonPage title="Rooms" description="Manage seminar halls, reading room, library — capacity and hourly fees." />,
  '/admin/bookings': () => <ComingSoonPage title="Room bookings" description="Approve or reject incoming room booking requests; resolve slot conflicts." />,
  '/admin/committees': CommitteesAdminPage,
  '/admin/site-content': SiteContentAdminPage,
  '/admin/site-settings': SiteSettingsAdminPage,
  '/admin/announcements': AnnouncementsAdminPage,
  '/admin/checklist-templates': ChecklistTemplatesAdminPage,
  '/admin/jobs': JobPostingsAdminPage,
  '/admin/cabf': () => <ComingSoonPage title="CABF requests" description="Review CA Benevolent Fund assistance requests, approve disbursements, track audit trail." />,
  '/admin/payments': () => <ComingSoonPage title="Payments" description="Read-only view of payments with refunds, disputes, and invoices." />,
  '/admin/files': () => <ComingSoonPage title="Files" description="Browse uploaded banners, certificates, and other assets." />,
  '/admin/notifications-log': NotificationsLogAdminPage,
  // ─── Branch content (Resources page, Gallery, About page) ───
  '/admin/paper-presentations': PaperPresentationsAdminPage,
  '/admin/newsletters':         NewslettersAdminPage,
  '/admin/gallery':             GalleryAlbumsAdminPage,
  '/admin/office-bearers':      OfficeBearersAdminPage,
  '/admin/annual-reports':      AnnualReportsAdminPage,
  '/admin/grievances':          GrievancesAdminPage,
  '/admin/grievance-routes':    GrievanceRoutesAdminPage,
  '/admin/resources':           ResourcesAdminPage,
  '/admin/mock-tests':          MockTestsAdminPage,
};

const FULL_BLEED_ROUTES = new Set(['/login', '/signup', '/forgot', '/onboarding']);

function isAdminPath(path) {
  return path === '/admin' || path.startsWith('/admin/');
}

function isEmployerPath(path) {
  return path === '/employer' || path.startsWith('/employer/');
}

// Resolve any /employer/* path (including dynamic /:id/edit) to a component.
// Returns null if no employer page matches → caller falls back to NotFound.
function resolveEmployerPage(path) {
  if (path === '/employer')              return EmployerDashboardPage;
  if (path === '/employer/postings')     return EmployerPostingsPage;
  if (path === '/employer/postings/new') return EmployerPostingFormPage;
  if (path === '/employer/profile')      return EmployerProfilePage;
  if (path.startsWith('/employer/postings/') && path.endsWith('/edit')) return EmployerPostingFormPage;
  return null;
}

function ScrollToTop() {
  const route = useRoute();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route.path]);
  return null;
}

// Minimal branded splash shown on a brand-new visit before /api/auth/me
// has resolved. We only see this when there's no cached user in
// localStorage — on subsequent visits hydration is synchronous and this
// component never mounts. Keeps the page from flashing "Sign in" before
// snapping to the authenticated header.
function AuthBootstrapSplash() {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: 'white', zIndex: 9999,
    }}>
      <div style={{
        width: '4rem', height: '4rem', borderRadius: '.5rem',
        background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '.25rem', boxShadow: '0 2px 8px rgba(0,0,0,.06)',
      }}>
        <img src={caIndiaLogo} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      </div>
      <div style={{ marginTop: '1rem', fontSize: '.85rem', fontWeight: 600, color: 'var(--muted-foreground, #64748b)' }}>
        Nagpur Branch of ICAI
      </div>
      <div className="bs-spinner" />
      <style>{`
        .bs-spinner {
          margin-top: 1rem;
          width: 1.4rem; height: 1.4rem;
          border: 2px solid rgba(30, 64, 175, .15);
          border-top-color: var(--primary, #1e40af);
          border-radius: 50%;
          animation: bs-spin .8s linear infinite;
        }
        @keyframes bs-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// Routes that don't depend on auth state and should NOT be blocked behind
// the splash — public login/signup/forgot pages render instantly even on a
// brand-new device. (If a user is already signed in those routes redirect
// elsewhere anyway, but that's a separate concern.)
const SPLASH_BYPASS_ROUTES = new Set(['/login', '/signup', '/forgot']);

export default function AppShell() {
  const route = useRoute();
  const { loading: authLoading } = useAuth();

  // Block the entire app on first paint until /api/auth/me resolves —
  // but only if we don't have a cached user (otherwise authLoading is
  // already false and this branch is skipped). Login/signup pages bypass
  // so users can sign in even with a stale cookie.
  if (authLoading && !SPLASH_BYPASS_ROUTES.has(route.path)) {
    return <AuthBootstrapSplash />;
  }

  if (isAdminPath(route.path)) {
    // Slug-based admin routes for quiz authoring:
    //   /admin/resources/papers/<paperId>/quiz
    let AdminPage = ADMIN_ROUTES[route.path];
    if (!AdminPage && /^\/admin\/resources\/papers\/[^/]+\/quiz$/.test(route.path)) {
      AdminPage = QuizEditorPage;
    }
    AdminPage = AdminPage ?? (() => <ComingSoonPage title="Not found" description="No admin page exists at this path." />);
    // RequireAdmin gates the shell once on entry. AdminShell sits INSIDE
    // RequireAdmin's verified branch but OUTSIDE the inner Suspense, so
    // its sidebar + topbar survive admin-to-admin route changes — only the
    // lazy page chunk swaps via the inner Suspense. This is what makes
    // navigation feel instant instead of "full page reload".
    return (
      <>
        <ScrollToTop />
        <Suspense fallback={<ShimmerFullPageSplash />}>
          <RequireAdmin>
            <AdminShell>
              <Suspense fallback={<AdminContentShimmer />}>
                <AdminPage />
              </Suspense>
            </AdminShell>
          </RequireAdmin>
        </Suspense>
      </>
    );
  }

  if (isEmployerPath(route.path)) {
    const EmployerPage = resolveEmployerPage(route.path) ?? NotFound;
    return (
      <>
        <ScrollToTop />
        <Suspense fallback={<ShimmerFullPageSplash />}>
          <RequireEmployer>
            <EmployerPage />
          </RequireEmployer>
        </Suspense>
      </>
    );
  }

  // Try exact match first, then slug-route prefix match (Resources pages
  // are /resources/papers/<slug>, /resources/journal/<slug>, etc.).
  let Page = ROUTES[route.path];
  if (!Page) {
    for (const r of SLUG_ROUTES) {
      if (!route.path.startsWith(r.prefix)) continue;
      const rest = route.path.slice(r.prefix.length);
      if (r.suffix) {
        if (rest.endsWith(r.suffix)) { Page = r.Page; break; }
      } else {
        // No suffix → match if there's a slug and no extra segments.
        if (rest && !rest.includes('/')) { Page = r.Page; break; }
      }
    }
  }
  Page = Page ?? NotFound;
  const fullBleed = FULL_BLEED_ROUTES.has(route.path);

  if (fullBleed) {
    return (
      <>
        <ScrollToTop />
        <Suspense fallback={<ShimmerFullPageSplash />}>
          <Page />
        </Suspense>
      </>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <ScrollToTop />
      <Header />
      <PushPermissionBanner />
      <main style={{ flex: 1 }}>
        <Suspense fallback={<ShimmerFullPageSplash />}>
          <Page />
        </Suspense>
      </main>
      <Footer />
      <Suspense fallback={null}>
        <PrayGyaanWidget />
      </Suspense>
    </div>
  );
}
