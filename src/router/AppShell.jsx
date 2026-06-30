import { lazy, Suspense, useEffect } from 'react';
import { useRoute } from '../hooks/useRoute';
import { useAuth } from '../context/AuthContext';
import caIndiaLogo from '../assets/CA India Logo.png';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import BottomNav from '../components/layout/BottomNav';
import MobileAppBar from '../components/layout/MobileAppBar';
import PushPermissionBanner from '../components/PushPermissionBanner';
import CookieConsentBanner from '../components/CookieConsentBanner';
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
const AnnouncementsPage  = lazy(() => import('../pages/AnnouncementsPage'));
const PhotoGalleryPage   = lazy(() => import('../pages/PhotoGalleryPage'));
const JobVacanciesPage   = lazy(() => import('../pages/JobVacanciesPage'));
const MembersDirectoryPage = lazy(() => import('../pages/MembersDirectoryPage'));
const RoomBookingPage    = lazy(() => import('../pages/RoomBookingPage'));
const TrackGrievancePage = lazy(() => import('../pages/TrackGrievancePage'));
const StudentSuggestionsPage = lazy(() => import('../pages/StudentSuggestionsPage'));
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
const PragyaanAdminPage          = lazy(() => import('../pages/admin/PragyaanAdminPage'));
const CpeAdminPage               = lazy(() => import('../pages/admin/CpeAdminPage'));
const RoomsAdminPage             = lazy(() => import('../pages/admin/RoomsAdminPage'));
const BookingsAdminPage          = lazy(() => import('../pages/admin/BookingsAdminPage'));
const CabfAdminPage              = lazy(() => import('../pages/admin/CabfAdminPage'));
const PaymentsAdminPage          = lazy(() => import('../pages/admin/PaymentsAdminPage'));
const PaperPresentationsAdminPage = lazy(() => import('../pages/admin/PaperPresentationsAdminPage'));
const NewslettersAdminPage       = lazy(() => import('../pages/admin/NewslettersAdminPage'));
const GalleryAlbumsAdminPage     = lazy(() => import('../pages/admin/GalleryAlbumsAdminPage'));
const GalleryVideosAdminPage     = lazy(() => import('../pages/admin/GalleryVideosAdminPage'));
const OfficeBearersAdminPage     = lazy(() => import('../pages/admin/OfficeBearersAdminPage'));
const AnnualReportsAdminPage     = lazy(() => import('../pages/admin/AnnualReportsAdminPage'));
const GrievancesAdminPage        = lazy(() => import('../pages/admin/GrievancesAdminPage'));
const GrievanceRoutesAdminPage   = lazy(() => import('../pages/admin/GrievanceRoutesAdminPage'));
const ResourcesAdminPage         = lazy(() => import('../pages/admin/ResourcesAdminPage'));
const QuizEditorPage             = lazy(() => import('../pages/admin/QuizEditorPage'));
const MockTestsAdminPage         = lazy(() => import('../pages/admin/MockTestsAdminPage'));
const IcaiDirectoryAdminPage     = lazy(() => import('../pages/admin/IcaiDirectoryAdminPage'));
const StudentSuggestionsAdminPage      = lazy(() => import('../pages/admin/StudentSuggestionsAdminPage'));
const StudentSuggestionTopicsAdminPage = lazy(() => import('../pages/admin/StudentSuggestionTopicsAdminPage'));

// Section L (Resources) — public-facing pages with slug-based detail routes.
const ResourcePaperPage   = lazy(() => import('../pages/ResourcePaperPage'));
const PaperReaderPage     = lazy(() => import('../pages/PaperReaderPage'));
const ResourceJournalPage = lazy(() => import('../pages/ResourceJournalPage'));
const ResourceSpeakerPage = lazy(() => import('../pages/ResourceSpeakerPage'));
const ResourceQuizPage    = lazy(() => import('../pages/ResourceQuizPage'));
const ResourceSubmitPage  = lazy(() => import('../pages/ResourceSubmitPage'));
const MyLibraryPage       = lazy(() => import('../pages/MyLibraryPage'));
const MockTestsPage       = lazy(() => import('../pages/MockTestsPage'));
const MockTestAttemptPage = lazy(() => import('../pages/MockTestAttemptPage'));
const MockTestQuestionsAdminPage = lazy(() => import('../pages/admin/MockTestQuestionsAdminPage'));

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
  '/announcements': AnnouncementsPage,
  '/gallery': PhotoGalleryPage,
  '/job-vacancies': JobVacanciesPage,
  '/members-directory': MembersDirectoryPage,
  '/book-room': RoomBookingPage,
  '/track-grievance': TrackGrievancePage,
  '/student-suggestions': StudentSuggestionsPage,
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
  // Mock-test online attempts. /mock-tests/<id>/attempt boots a new
  // attempt and forwards to /attempts/<aid> which is the live UI.
  { prefix: '/mock-tests/',         suffix: '/attempt', Page: MockTestAttemptPage },
  { prefix: '/attempts/',                              Page: MockTestAttemptPage },
];

// Routes where the floating Pragyaan FAB should NOT render. These pages
// have sticky action footers (Save / Submit / Approve buttons) or full-
// screen forms where the bird would overlap with the primary CTAs. Drawer
// / modal cases elsewhere are handled by the widget's own :has() CSS rule.
const WIDGET_HIDDEN_ROUTES = new Set([
  '/my-checklists',
  '/praygyaan',          // already AI page — no point showing the FAB too
]);

// Admin routes. Each is wrapped in <RequireAdmin> at render time. Placeholder
// sections render the shared ComingSoonPage with their own title.
const ADMIN_ROUTES = {
  '/admin': AdminDashboardPage,
  '/admin/events': EventsAdminPage,
  '/admin/registrations': EventRegistrationsAdminPage,
  '/admin/users': UsersAdminPage,
  '/admin/cpe': CpeAdminPage,
  '/admin/approvals': ApprovalsAdminPage,
  '/admin/rooms': RoomsAdminPage,
  '/admin/bookings': BookingsAdminPage,
  '/admin/committees': CommitteesAdminPage,
  '/admin/site-content': SiteContentAdminPage,
  '/admin/site-settings': SiteSettingsAdminPage,
  '/admin/announcements': AnnouncementsAdminPage,
  '/admin/checklist-templates': ChecklistTemplatesAdminPage,
  '/admin/jobs': JobPostingsAdminPage,
  '/admin/cabf': CabfAdminPage,
  '/admin/payments': PaymentsAdminPage,
  '/admin/notifications-log': NotificationsLogAdminPage,
  // ─── Branch content (Resources page, Gallery, About page) ───
  '/admin/paper-presentations': PaperPresentationsAdminPage,
  '/admin/newsletters':         NewslettersAdminPage,
  '/admin/gallery':             GalleryAlbumsAdminPage,
  '/admin/gallery-videos':      GalleryVideosAdminPage,
  '/admin/office-bearers':      OfficeBearersAdminPage,
  '/admin/annual-reports':      AnnualReportsAdminPage,
  '/admin/grievances':          GrievancesAdminPage,
  '/admin/grievance-routes':    GrievanceRoutesAdminPage,
  '/admin/resources':           ResourcesAdminPage,
  '/admin/mock-tests':          MockTestsAdminPage,
  '/admin/pragyaan':            PragyaanAdminPage,
  '/admin/icai-directory':      IcaiDirectoryAdminPage,
  '/admin/student-suggestions':       StudentSuggestionsAdminPage,
  '/admin/student-suggestion-topics': StudentSuggestionTopicsAdminPage,
  // Sidebar entries exist but the admin UIs are not yet built. Backend
  // endpoints (bills, refunds, iut-transfers, mentorship, articleship-
  // matches) are already wired — these stubs ship the navigation without
  // 404s while the views land in follow-up releases.
  '/admin/bills':                () => <ComingSoonPage title="Bills" description="Vendor bill submissions, approvals, and payment tracking. Backend wiring is ready; the admin view ships in a follow-up." />,
  '/admin/refunds':              () => <ComingSoonPage title="Refunds" description="Event-fee refund requests with approvals and payout tracking. Backend wiring is ready; the admin view ships in a follow-up." />,
  '/admin/iut-transfers':        () => <ComingSoonPage title="IUT transfers" description="Inter-unit transfer ledger between the branch and other ICAI units. Backend wiring is ready; the admin view ships in a follow-up." />,
  '/admin/mentorship':           () => <ComingSoonPage title="Mentorship" description="Member-mentor pairings and meeting logs. Backend wiring is ready; the admin view ships in a follow-up." />,
  '/admin/articleship-matches':  () => <ComingSoonPage title="Articleship matching" description="Match students to firms offering articleship vacancies. Backend wiring is ready; the admin view ships in a follow-up." />,
};

const FULL_BLEED_ROUTES = new Set(['/login', '/signup', '/forgot', '/onboarding']);

// Prefix-matched full-bleed routes — used for the mock-test attempt
// surface, which is an exam-mode "kiosk" that owns the entire viewport
// (timer + question palette + submit button) and must NOT be visually
// overlapped by the global Header. Previously the attempt page rendered
// underneath the site header, which covered its topbar (so the Submit
// button was unreachable) and cropped the top of every question.
function isFullBleedPath(path) {
  if (FULL_BLEED_ROUTES.has(path)) return true;
  // Live attempt UI: /attempts/<uuid>
  if (path.startsWith('/attempts/')) return true;
  // Attempt bootstrap: /mock-tests/<uuid>/attempt
  if (path.startsWith('/mock-tests/') && path.endsWith('/attempt')) return true;
  return false;
}

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
    if (!AdminPage && /^\/admin\/mock-tests\/[^/]+\/questions$/.test(route.path)) {
      AdminPage = MockTestQuestionsAdminPage;
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
  const fullBleed = isFullBleedPath(route.path);

  if (fullBleed) {
    return (
      <>
        <ScrollToTop />
        <Suspense fallback={<ShimmerFullPageSplash />}>
          <Page />
        </Suspense>
        <CookieConsentBanner />
      </>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* WCAG 2.4.1 Bypass Blocks — visually hidden until focused. */}
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <ScrollToTop />
      {/* Desktop header — CSS-hidden ≤768 px. */}
      <div className="hide-on-mobile-only"><Header /></div>
      {/* Mobile-only slim app bar. The CSS gate is on the component so
          desktop never even paints it. */}
      <MobileAppBar />
      <PushPermissionBanner />
      <main id="main-content" style={{ flex: 1 }} tabIndex={-1}>
        <Suspense fallback={<ShimmerFullPageSplash />}>
          {/* `key` on the wrapper forces a remount per route, which
              re-triggers the .page-enter animation — that's how we get
              the native-feeling slide-in on every navigation. */}
          <div key={route.path} className="page-enter">
            <Page />
          </div>
        </Suspense>
      </main>
      <Footer />
      {/* Hide the floating Pragyaan widget on full-page form routes where it
          overlaps with sticky action footers (Save progress / Submit for
          review, etc.). Modal/drawer overlays elsewhere are handled by the
          widget's own :has() CSS rule. */}
      {!WIDGET_HIDDEN_ROUTES.has(route.path) && (
        <Suspense fallback={null}>
          <PrayGyaanWidget />
        </Suspense>
      )}
      <CookieConsentBanner />
      {/* Bottom tab bar — CSS-gated to ≤768 px so it's a no-op on desktop. */}
      <BottomNav />
    </div>
  );
}
