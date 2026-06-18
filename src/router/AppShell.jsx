import { useEffect } from 'react';
import { useRoute } from '../hooks/useRoute';
import { useAuth } from '../context/AuthContext';
import caIndiaLogo from '../assets/CA India Logo.png';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import PushPermissionBanner from '../components/PushPermissionBanner';

import HomePage from '../pages/HomePage';
import AboutPage from '../pages/AboutPage';
import EventsPage from '../pages/EventsPage';
import MembersPage from '../pages/MembersPage';
import StudentsPage from '../pages/StudentsPage';
import ResourcesPage from '../pages/ResourcesPage';
import ContactPage from '../pages/ContactPage';
import PragyaanPage from '../pages/PragyaanPage';
import BenevolentFundPage from '../pages/BenevolentFundPage';
import CA2VisionPage from '../pages/CA2VisionPage';
import InvestorAwarenessPage from '../pages/InvestorAwarenessPage';
import CareerCounsellingPage from '../pages/CareerCounsellingPage';
import SearchPage from '../pages/SearchPage';
import DashboardPage from '../pages/DashboardPage';
import ChecklistInstancesPage from '../pages/ChecklistInstancesPage';
import BranchMetricsPage from '../pages/BranchMetricsPage';
import NotFound from '../pages/NotFound';

import LoginPage from '../pages/auth/LoginPage';
import SignupPage from '../pages/auth/SignupPage';
import ForgotPage from '../pages/auth/ForgotPage';
import OnboardingPage from '../pages/auth/OnboardingPage';
import PhotoGalleryPage from '../pages/PhotoGalleryPage';
import JobVacanciesPage from '../pages/JobVacanciesPage';
import MembersDirectoryPage from '../pages/MembersDirectoryPage';
import RoomBookingPage from '../pages/RoomBookingPage';
import TrackGrievancePage from '../pages/TrackGrievancePage';
import PragyaanWidget from '../components/ui/PragyaanWidget';

import RequireAdmin from '../components/admin/RequireAdmin';
import AdminDashboardPage from '../pages/admin/AdminDashboardPage';
import EventsAdminPage from '../pages/admin/EventsAdminPage';
import EventRegistrationsAdminPage from '../pages/admin/EventRegistrationsAdminPage';
import UsersAdminPage from '../pages/admin/UsersAdminPage';
import CommitteesAdminPage from '../pages/admin/CommitteesAdminPage';
import SiteContentAdminPage from '../pages/admin/SiteContentAdminPage';
import SiteSettingsAdminPage from '../pages/admin/SiteSettingsAdminPage';
import AnnouncementsAdminPage from '../pages/admin/AnnouncementsAdminPage';
import ComingSoonPage from '../pages/admin/ComingSoonPage';
import JobPostingsAdminPage from '../pages/admin/JobPostingsAdminPage';
import ChecklistTemplatesAdminPage from '../pages/admin/ChecklistTemplatesAdminPage';
import NotificationsLogAdminPage from '../pages/admin/NotificationsLogAdminPage';
import ApprovalsAdminPage from '../pages/admin/ApprovalsAdminPage';
import PaperPresentationsAdminPage from '../pages/admin/PaperPresentationsAdminPage';
import NewslettersAdminPage from '../pages/admin/NewslettersAdminPage';
import GalleryAlbumsAdminPage from '../pages/admin/GalleryAlbumsAdminPage';
import OfficeBearersAdminPage from '../pages/admin/OfficeBearersAdminPage';
import AnnualReportsAdminPage from '../pages/admin/AnnualReportsAdminPage';
import GrievancesAdminPage from '../pages/admin/GrievancesAdminPage';
import GrievanceRoutesAdminPage from '../pages/admin/GrievanceRoutesAdminPage';
import PragyaanAdminPage from '../pages/admin/PragyaanAdminPage';

import RequireEmployer from '../components/employer/RequireEmployer';
import EmployerDashboardPage from '../pages/employer/EmployerDashboardPage';
import EmployerPostingsPage from '../pages/employer/EmployerPostingsPage';
import EmployerPostingFormPage from '../pages/employer/EmployerPostingFormPage';
import EmployerProfilePage from '../pages/employer/EmployerProfilePage';

const ROUTES = {
  '/': HomePage,
  '/about': AboutPage,
  '/events': EventsPage,
  '/members': MembersPage,
  '/students': StudentsPage,
  '/resources': ResourcesPage,
  '/contact': ContactPage,
  '/pragyaan': PragyaanPage,
  // Backward-compat alias — old links to #/praygyaan still resolve to the
  // Pragyaan page. This is the only place the legacy token remains.
  '/praygyaan': PragyaanPage,
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
};

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
  // ─── Pragyaan assistant (knowledge base + analytics) ───
  '/admin/pragyaan':            PragyaanAdminPage,
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
    const AdminPage = ADMIN_ROUTES[route.path] ?? (() => <ComingSoonPage title="Not found" description="No admin page exists at this path." />);
    return (
      <>
        <ScrollToTop />
        <RequireAdmin>
          <AdminPage />
        </RequireAdmin>
      </>
    );
  }

  if (isEmployerPath(route.path)) {
    const EmployerPage = resolveEmployerPage(route.path) ?? NotFound;
    return (
      <>
        <ScrollToTop />
        <RequireEmployer>
          <EmployerPage />
        </RequireEmployer>
      </>
    );
  }

  const Page = ROUTES[route.path] ?? NotFound;
  const fullBleed = FULL_BLEED_ROUTES.has(route.path);

  if (fullBleed) {
    return (
      <>
        <ScrollToTop />
        <Page />
      </>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <ScrollToTop />
      <Header />
      <PushPermissionBanner />
      <main style={{ flex: 1 }}>
        <Page />
      </main>
      <Footer />
      <PragyaanWidget />
    </div>
  );
}
