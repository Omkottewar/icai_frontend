import { IconArrowRight } from '../../icons';
import { navigate } from '../../hooks/useRoute';

export default function CategoryCard({ committee, info, count, nextEvent }) {
  const onClick = () => navigate('/events?committee=' + encodeURIComponent(committee));
  return (
    <button
      onClick={onClick}
      className="cat-card"
      style={{ '--cat-accent': info.color || 'var(--primary)' }}
      aria-label={`View ${info.fullName} events`}
    >
      <span className="cat-card-bar" aria-hidden="true" />
      <div className="cat-card-top">
        <span className="cat-card-short">{info.short}</span>
        <span className="cat-card-count">{count} UPCOMING</span>
      </div>
      <div className="cat-card-title">{info.fullName}</div>
      <div className="cat-card-next">
        {nextEvent
          ? `${nextEvent.title.split('—')[0].trim().split(':')[0]} — ${nextEvent.date.split(' ').slice(0, 2).join(' ')}`
          : 'No upcoming events'}
      </div>
      <div className="cat-card-cta">View events <IconArrowRight size="sm" /></div>
    </button>
  );
}
