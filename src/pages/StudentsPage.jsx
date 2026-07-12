import { useState } from 'react';
import PageHeader from '../components/layout/PageHeader';
import { useSiteContent } from '../hooks/useSiteContent';
import { useAuth } from '../context/AuthContext';
import { renderMarkdown } from '../lib/markdown.jsx';
import { navigate } from '../hooks/useRoute';
import { IconGraduationCap, IconArrowRight, IconBriefcase, IconBookOpen, IconUsers, IconAward, IconMessageSquare } from '../icons';
import RequestMentorshipModal from '../components/student/RequestMentorshipModal';

// All copy is admin-editable via /admin/site-content → Students tab.
// Icons + href targets stay structural (they map to internal routes / icon
// components), but the title and description on each of the 6 service tiles
// pulls from the `students_services` slot, so the admin can rename or
// rewrite any card without touching code.
//
// Some cards open in-page modals rather than linking out — those pass an
// `action` string that the render handler dispatches on. Everything else
// still follows the plain `<a href>` path so admin-blanked cards silently
// drop out.
const CARD_FRAMES = [
  { Icon: IconGraduationCap, href: '/mock-tests',                        comingSoon: false },
  { Icon: IconBriefcase,     action: 'articleship',                       comingSoon: false },
  { Icon: IconUsers,         href: '/career-counselling',                 comingSoon: true  },
  { Icon: IconBookOpen,      href: '/resources',                          comingSoon: false },
  { Icon: IconAward,         href: '/scholarships',                       comingSoon: false },
  { Icon: IconMessageSquare, href: '/student-forum',                       comingSoon: false },
];

export default function StudentsPage() {
  const header      = useSiteContent('students_page_header');
  const banner      = useSiteContent('students_icai_banner');
  const quickAccess = useSiteContent('students_quick_access');
  const services    = useSiteContent('students_services');
  const { user } = useAuth();

  const [modal, setModal] = useState(null); // 'mentorship' | null

  function openAction(action) {
    // Articleship goes to the openings list for EVERYONE (guest, student,
    // member). The list page carries its own "Submit your preferences"
    // CTA that opens the RequestArticleshipModal — that's where the
    // form belongs, not as the primary action of this tile.
    if (action === 'articleship') {
      navigate('/job-vacancies?type=articleship');
      return;
    }
    // Other actions (mentorship, etc.) still write to the DB and need a
    // signed-in student.
    if (!user) {
      navigate('/login?next=/students');
      return;
    }
    if (user.primary_role !== 'student') {
      navigate('/contact');
      return;
    }
    setModal(action);
  }

  return (
    <>
      <PageHeader title={header.title} subtitle={header.subtitle} />

      {/* ICAI.org link banner (per Web-Media Policy 5d) */}
      <div style={{ background: 'oklch(0.50 0.16 145 / 0.07)', borderBottom: '1px solid oklch(0.50 0.16 145 / 0.18)' }}>
        <div className="container row gap-3" style={{ padding: '.875rem 1rem', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="row gap-2" style={{ fontSize: '.875rem', color: 'var(--foreground)' }}>
            <IconGraduationCap size="sm" style={{ color: 'var(--secondary)' }} />
            <span>{renderMarkdown(banner.body)}</span>
          </div>
          <a
            href={banner.button_url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
            style={{ padding: '.4rem 1rem', flexShrink: 0 }}
          >
            {banner.button_label} <IconArrowRight size="sm" />
          </a>
        </div>
      </div>

      <section className="container" style={{ padding: '3rem 1rem' }}>

        {/* Quick access row */}
        <div className="row gap-3" style={{ marginBottom: '2.5rem', flexWrap: 'wrap' }}>
          <a href="/mock-tests" className="btn btn-primary" style={{ gap: '.5rem' }}>
            <IconGraduationCap size="sm" /> {quickAccess.mock_tests_label}
          </a>
          <button type="button" className="btn btn-outline" style={{ gap: '.5rem' }} onClick={() => openAction('articleship')}>
            <IconBriefcase size="sm" /> {quickAccess.articleship_label}
          </button>
          <a href="/events?audience=Students" className="btn btn-outline" style={{ gap: '.5rem' }}>
            <IconGraduationCap size="sm" /> {quickAccess.events_label}
          </a>
        </div>

        {/* 1-on-1 support strip removed. Mentor requests live on the
            student dashboard's Quick actions tab; articleship preferences
            are reachable via the Articleship card + the quick-access
            "Articleship" button above. */}

        <div style={{ display: 'grid', gap: '1.25rem', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          {CARD_FRAMES.map((frame, i) => {
            const n = i + 1;
            const title = services[`card_${n}_title`];
            const desc  = services[`card_${n}_desc`];
            // Skip the tile entirely if the admin has blanked out the title —
            // lets them shrink the grid from 6 → fewer cards without code.
            if (!title) return null;

            const commonInner = (
              <>
                <div className="row gap-2" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div className="icon-tile green"><frame.Icon size="lg" /></div>
                  {frame.comingSoon && (
                    <span className="badge" style={{ background: 'var(--muted)', color: 'var(--muted-foreground)', fontSize: '.7rem', padding: '.2rem .55rem', borderRadius: 999 }}>
                      Coming soon
                    </span>
                  )}
                </div>
                <h3 style={{ marginTop: '.75rem', fontWeight: 600 }}>{title}</h3>
                <p className="muted-text" style={{ marginTop: '.25rem', fontSize: '.875rem' }}>{desc}</p>
                <div className="row gap-1" style={{ marginTop: '.75rem', fontSize: '.8125rem', color: 'var(--primary)', fontWeight: 600 }}>
                  {frame.comingSoon ? 'Ask the branch' : 'Open'}
                  <IconArrowRight size="sm" />
                </div>
              </>
            );

            // Modal-triggering cards render as buttons; the rest stay as
            // anchors so shift-click / middle-click still work like normal links.
            // Explicitly do NOT zero out the border — the .card class supplies
            // the 1px border and the button-rendered tiles need it too so they
            // don't look bare next to the anchor tiles.
            if (frame.action) {
              return (
                <button
                  key={n}
                  type="button"
                  className="card students-svc-card"
                  style={{ textAlign: 'left', font: 'inherit', color: 'inherit', cursor: 'pointer', display: 'block', width: '100%' }}
                  onClick={() => openAction(frame.action)}
                >
                  {commonInner}
                </button>
              );
            }

            return (
              <a
                key={n}
                href={frame.href}
                className="card students-svc-card"
                style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
              >
                {commonInner}
              </a>
            );
          })}
        </div>
      </section>

      {modal === 'mentorship' && (
        <RequestMentorshipModal
          onClose={() => setModal(null)}
          onSubmitted={() => setModal(null)}
        />
      )}
      {/* Articleship preferences modal moved to /job-vacancies?type=articleship — the vacancies list carries its own "Submit your preferences" button. */}

      <style>{`
        /* Same tile layout as before — no colour changes, no accent bar.
           Just a heavier neutral shadow on hover so the tile "pops" more
           clearly against the section background. */
        .students-svc-card {
          transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease;
        }
        .students-svc-card:hover {
          transform: translateY(-3px);
          box-shadow:
            0 18px 36px -14px rgba(15, 23, 42, .22),
            0 4px 10px rgba(15, 23, 42, .08);
          border-color: rgba(15, 23, 42, .18);
        }
        .students-svc-card:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
      `}</style>
    </>
  );
}
