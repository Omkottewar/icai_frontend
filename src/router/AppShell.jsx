import { useEffect } from 'react';
import { useRoute } from '../hooks/useRoute';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';

import HomePage from '../pages/HomePage';
import AboutPage from '../pages/AboutPage';
import EventsPage from '../pages/EventsPage';
import MembersPage from '../pages/MembersPage';
import StudentsPage from '../pages/StudentsPage';
import ResourcesPage from '../pages/ResourcesPage';
import ContactPage from '../pages/ContactPage';
import PrayGyaanPage from '../pages/PrayGyaanPage';
import BenevolentFundPage from '../pages/BenevolentFundPage';
import CA2VisionPage from '../pages/CA2VisionPage';
import InvestorAwarenessPage from '../pages/InvestorAwarenessPage';
import CareerCounsellingPage from '../pages/CareerCounsellingPage';
import SearchPage from '../pages/SearchPage';
import DashboardPage from '../pages/DashboardPage';
import ChecklistsPage from '../pages/ChecklistsPage';
import BranchMetricsPage from '../pages/BranchMetricsPage';
import CommunityPage from '../pages/CommunityPage';
import NotFound from '../pages/NotFound';

import LoginPage from '../pages/auth/LoginPage';
import SignupPage from '../pages/auth/SignupPage';
import ForgotPage from '../pages/auth/ForgotPage';
import OnboardingPage from '../pages/auth/OnboardingPage';
import PhotoGalleryPage from '../pages/PhotoGalleryPage';
import JobVacanciesPage from '../pages/JobVacanciesPage';
import MembersDirectoryPage from '../pages/MembersDirectoryPage';
import RoomBookingPage from '../pages/RoomBookingPage';
import PrayGyaanWidget from '../components/ui/PrayGyaanWidget';

import RequireAdmin from '../components/admin/RequireAdmin';
import AdminDashboardPage from '../pages/admin/AdminDashboardPage';
import EventsAdminPage from '../pages/admin/EventsAdminPage';
import EventRegistrationsAdminPage from '../pages/admin/EventRegistrationsAdminPage';
import UsersAdminPage from '../pages/admin/UsersAdminPage';
import CommitteesAdminPage from '../pages/admin/CommitteesAdminPage';
import SiteContentAdminPage from '../pages/admin/SiteContentAdminPage';
import SiteSettingsAdminPage from '../pages/admin/SiteSettingsAdminPage';
import ComingSoonPage from '../pages/admin/ComingSoonPage';

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
  '/checklists': ChecklistsPage,
  '/branch-insights': BranchMetricsPage,
  '/community': CommunityPage,
  '/login': LoginPage,
  '/signup': SignupPage,
  '/forgot': ForgotPage,
  '/onboarding': OnboardingPage,
  '/gallery': PhotoGalleryPage,
  '/job-vacancies': JobVacanciesPage,
  '/members-directory': MembersDirectoryPage,
  '/book-room': RoomBookingPage,
};

// Admin routes. Each is wrapped in <RequireAdmin> at render time. Placeholder
// sections render the shared ComingSoonPage with their own title.
const ADMIN_ROUTES = {
  '/admin': AdminDashboardPage,
  '/admin/events': EventsAdminPage,
  '/admin/registrations': EventRegistrationsAdminPage,
  '/admin/users': UsersAdminPage,
  '/admin/cpe': () => <ComingSoonPage title="CPE credits" description="Issue structured/unstructured CPE credits, bulk-issue from event attendees, audit member compliance." />,
  '/admin/approvals': () => <ComingSoonPage title="Approvals inbox" description="Unified MCM → Chairman approval queue across events, newsletters, circulars, gallery albums, and more." />,
  '/admin/rooms': () => <ComingSoonPage title="Rooms" description="Manage seminar halls, reading room, library — capacity and hourly fees." />,
  '/admin/bookings': () => <ComingSoonPage title="Room bookings" description="Approve or reject incoming room booking requests; resolve slot conflicts." />,
  '/admin/committees': CommitteesAdminPage,
  '/admin/site-content': SiteContentAdminPage,
  '/admin/site-settings': SiteSettingsAdminPage,
  '/admin/jobs': () => <ComingSoonPage title="Job postings" description="Moderate articleship vacancies and employment postings; review payments." />,
  '/admin/cabf': () => <ComingSoonPage title="CABF requests" description="Review CA Benevolent Fund assistance requests, approve disbursements, track audit trail." />,
  '/admin/payments': () => <ComingSoonPage title="Payments" description="Read-only view of payments with refunds, disputes, and invoices." />,
  '/admin/files': () => <ComingSoonPage title="Files" description="Browse uploaded banners, certificates, and other assets." />,
};

const FULL_BLEED_ROUTES = new Set(['/login', '/signup', '/forgot', '/onboarding']);

function isAdminPath(path) {
  return path === '/admin' || path.startsWith('/admin/');
}

function ScrollToTop() {
  const route = useRoute();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route.path]);
  return null;
}

export default function AppShell() {
  const route = useRoute();

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
      <main style={{ flex: 1 }}>
        <Page />
      </main>
      <Footer />
      <PrayGyaanWidget />
    </div>
  );
}
