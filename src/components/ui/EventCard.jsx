import { IconCalendar, IconClock, IconMapPin, IconAward } from '../../icons';

export default function EventCard({ event: e, withRegister = false }) {
  return (
    <article className="card col hover-lift" style={{ display: 'flex', padding: '1.25rem' }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="badge badge-secondary">{e.committee}</span>
        {e.cpe > 0 && (
          <span className="badge badge-accent">
            {e.cpe} CPE{withRegister ? ' hrs' : ''}
          </span>
        )}
      </div>
      <h3 style={{ marginTop: '.75rem', fontSize: '1rem', fontWeight: 600 }}>{e.title}</h3>
      <div className="col gap-1 muted-text" style={{ marginTop: '.75rem', fontSize: '.75rem' }}>
        <div className="row gap-2"><IconCalendar size="sm" /> {e.date}</div>
        <div className="row gap-2"><IconClock size="sm" /> {e.time}</div>
        <div className="row gap-2"><IconMapPin size="sm" /> {e.venue}</div>
      </div>
      {withRegister && (
        <button className="btn btn-primary" style={{ marginTop: '1.25rem', justifyContent: 'center' }}>
          Register
        </button>
      )}
    </article>
  );
}
