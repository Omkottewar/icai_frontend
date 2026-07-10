import { useEffect, useState } from 'react';
import PageHeader from '../components/layout/PageHeader';
import { useAuth } from '../context/AuthContext';
import { navigate } from '../hooks/useRoute';
import { Shimmer, ShimmerLines } from '../components/ui/Shimmer';
import { IconCalendar, IconArrowRight } from '../icons';

const DATE_FMT = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit', month: 'short', year: 'numeric',
  hour: '2-digit', minute: '2-digit',
});

function fmtDateRange(startsAt, endsAt) {
  if (!startsAt) return '—';
  const s = new Date(startsAt);
  if (Number.isNaN(s.getTime())) return '—';
  const startStr = DATE_FMT.format(s);
  if (!endsAt) return startStr;
  const e = new Date(endsAt);
  if (Number.isNaN(e.getTime())) return startStr;
  const sameDay = s.toDateString() === e.toDateString();
  return sameDay
    ? `${startStr} – ${e.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
    : `${startStr} – ${DATE_FMT.format(e)}`;
}

const MODE_LABEL = { in_person: 'In person', online: 'Online', hybrid: 'Hybrid' };

export default function MySpeakerEventsPage() {
  const { user, loading: authLoading } = useAuth();
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!authLoading && !user) navigate('/login');
  }, [authLoading, user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/my-speaker-events', { credentials: 'include' });
        const j = await r.json();
        if (cancelled) return;
        if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
        setRows(j.rows || []);
      } catch (e) {
        if (!cancelled) setErr(e.message);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  if (authLoading || !user) return null;

  return (
    <>
      <PageHeader
        title="My speaking events"
        subtitle={`Welcome ${user.name}. Here are the events you're speaking at. Open one to post updates, answer questions, and address participants in the event chat.`}
      />
      <section className="container" style={{ padding: '2rem 1rem' }}>
        {rows === null && !err && <ShimmerLines count={3} />}
        {err && <div className="admin-error">{err}</div>}
        {rows !== null && rows.length === 0 && (
          <div style={{
            border: '1px dashed var(--border)', borderRadius: '.5rem',
            padding: '2rem', textAlign: 'center', color: 'var(--muted-foreground)',
          }}>
            <p style={{ margin: 0, fontSize: '.95rem' }}>
              You aren't linked to any event as a speaker yet.
            </p>
            <p style={{ margin: '.5rem 0 0', fontSize: '.85rem' }}>
              The branch admin will send you an email once you've been added to an event.
            </p>
          </div>
        )}
        {(rows ?? []).map((r) => (
          <SpeakerEventCard key={r.event_id} row={r} />
        ))}
      </section>
    </>
  );
}

function SpeakerEventCard({ row }) {
  const openChat = () => navigate(`/events/${row.slug}?chat=1`);
  const openEvent = () => navigate(`/events/${row.slug}`);
  const now = Date.now();
  const isPast = row.ends_at && new Date(row.ends_at).getTime() < now;
  const isLive = row.starts_at && row.ends_at
    && new Date(row.starts_at).getTime() <= now
    && new Date(row.ends_at).getTime() >= now;

  return (
    <article style={{
      border: '1px solid var(--border)',
      background: 'var(--card)',
      borderRadius: '.5rem',
      padding: '1rem 1.25rem',
      marginBottom: '.75rem',
      display: 'grid',
      gridTemplateColumns: '1fr auto',
      gap: '1rem',
      alignItems: 'center',
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <h2
            style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, cursor: 'pointer' }}
            onClick={openEvent}
          >
            {row.title}
          </h2>
          {isLive && (
            <span style={{
              background: 'oklch(0.55 0.14 155 / 0.15)', color: 'var(--secondary)',
              padding: '.1rem .5rem', borderRadius: 999, fontSize: '.7rem', fontWeight: 700,
            }}>Live now</span>
          )}
          {isPast && (
            <span style={{
              background: 'oklch(0.85 0.02 260 / 0.4)', color: 'var(--muted-foreground)',
              padding: '.1rem .5rem', borderRadius: 999, fontSize: '.7rem', fontWeight: 600,
            }}>Past</span>
          )}
        </div>
        <div className="muted-text" style={{ fontSize: '.8rem', marginTop: '.3rem', display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', gap: '.3rem', alignItems: 'center' }}>
            <IconCalendar size="sm" /> {fmtDateRange(row.starts_at, row.ends_at)}
          </span>
          {row.venue && <span>· {row.venue}</span>}
          {row.mode && <span>· {MODE_LABEL[row.mode] || row.mode}</span>}
          {row.committee_name && <span>· {row.committee_name}</span>}
        </div>
      </div>
      <button
        type="button"
        className="btn btn-primary"
        onClick={openChat}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '.3rem' }}
      >
        Open chat <IconArrowRight size="sm" />
      </button>
    </article>
  );
}
