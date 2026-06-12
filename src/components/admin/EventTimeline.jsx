// Horizontal timeline of an event's lifecycle. Shows where the event is RIGHT
// NOW across both its lifecycle state (draft → pending_approval → approved
// → published → completed) AND its checklist state (none → with-committee
// → with-chairman → approved).
//
// Visual layout:
//
//   ●━━●━━○━━○━━○
//   Draft  Pending  Approved  Published  Completed
//        ↑ checklist with chairman ma'am
//
// The two state machines are merged into one stream so the chairman, treasurer
// or committee chair can see at a glance "where is this event in its journey?"
// without cross-referencing two pills.

const STEPS = [
  { key: 'draft',            label: 'Draft' },
  { key: 'pending_approval', label: 'Approval' },
  { key: 'published',        label: 'Live' },
  { key: 'in_progress',      label: 'Running' },
  { key: 'completed',        label: 'Done' },
];

// Given the event row + its instance status, return:
//   activeIndex — which step is "current"
//   note        — short context line under the timeline
function resolveTimelineState(event) {
  const status = event?.status;
  const inst = event?.instance_status;

  // Hard branches first.
  if (status === 'cancelled') {
    return { activeIndex: -1, note: 'Event cancelled', tone: 'red' };
  }
  if (status === 'completed') {
    return { activeIndex: 4, note: 'Past event', tone: 'grey' };
  }
  if (status === 'published') {
    const start = event?.starts_at ? new Date(event.starts_at) : null;
    const end   = event?.ends_at   ? new Date(event.ends_at)   : null;
    const now   = new Date();
    if (start && end && start <= now && now <= end) {
      return { activeIndex: 3, note: 'Happening now', tone: 'green' };
    }
    return { activeIndex: 2, note: 'Live — accepting registrations', tone: 'green' };
  }
  if (status === 'approved') {
    return { activeIndex: 2, note: 'Approved — ready to publish', tone: 'blue' };
  }
  if (status === 'pending_approval') {
    if (inst === 'awaiting_fill') {
      return { activeIndex: 1, note: 'Checklist with committee chair', tone: 'amber' };
    }
    if (inst === 'awaiting_review') {
      return { activeIndex: 1, note: 'Checklist with chairman ma\'am', tone: 'blue' };
    }
    if (inst === 'rejected') {
      return { activeIndex: 1, note: 'Sent back to committee with comments', tone: 'red' };
    }
    return { activeIndex: 1, note: 'Awaiting approval', tone: 'amber' };
  }
  // status === 'draft' (or any unknown) — checklist may or may not exist
  if (inst === 'awaiting_fill') {
    return { activeIndex: 0, note: 'Checklist with committee chair', tone: 'amber' };
  }
  if (inst === 'awaiting_review') {
    return { activeIndex: 1, note: 'Checklist with chairman ma\'am', tone: 'blue' };
  }
  return { activeIndex: 0, note: 'Draft', tone: 'muted' };
}

const TONE_DOT_COLOR = {
  muted: '#cbd5e1',
  amber: '#f59e0b',
  blue:  '#2563eb',
  green: '#16a34a',
  red:   '#dc2626',
  grey:  '#9ca3af',
};

export default function EventTimeline({ event, compact = false }) {
  const { activeIndex, note, tone } = resolveTimelineState(event);
  const dotColor = TONE_DOT_COLOR[tone] ?? TONE_DOT_COLOR.muted;

  return (
    <div className={'event-timeline' + (compact ? ' event-timeline-compact' : '')}>
      <div className="event-timeline-track">
        {STEPS.map((s, i) => {
          const isPast    = activeIndex >= 0 && i <  activeIndex;
          const isActive  = activeIndex >= 0 && i === activeIndex;
          const isFuture  = activeIndex >= 0 && i >  activeIndex;
          const isCancelled = activeIndex < 0;
          return (
            <div key={s.key} className="event-timeline-step">
              <div
                className={
                  'event-timeline-dot' +
                  (isPast ? ' past' : '') +
                  (isActive ? ' active' : '') +
                  (isFuture ? ' future' : '') +
                  (isCancelled ? ' cancelled' : '')
                }
                style={isActive ? { background: dotColor, boxShadow: `0 0 0 3px ${dotColor}30` } : undefined}
              />
              {!compact && <div className="event-timeline-label">{s.label}</div>}
              {i < STEPS.length - 1 && (
                <div
                  className={
                    'event-timeline-line' +
                    (isPast || (isActive && tone === 'green') ? ' done' : '')
                  }
                />
              )}
            </div>
          );
        })}
      </div>
      {!compact && note && (
        <div className="event-timeline-note" style={{ color: dotColor }}>
          {note}
        </div>
      )}

      <style>{`
        .event-timeline { display: flex; flex-direction: column; gap: .25rem; }
        .event-timeline-track {
          display: grid;
          grid-template-columns: repeat(${STEPS.length}, 1fr);
          align-items: center;
          gap: 0;
          position: relative;
        }
        .event-timeline-step {
          display: flex; flex-direction: column; align-items: center; gap: .25rem;
          position: relative; min-width: 0;
        }
        .event-timeline-dot {
          width: 10px; height: 10px; border-radius: 999px;
          background: #cbd5e1;
          flex-shrink: 0; z-index: 1;
          transition: background .2s, box-shadow .2s;
        }
        .event-timeline-dot.past { background: #16a34a; }
        .event-timeline-dot.active { width: 12px; height: 12px; }
        .event-timeline-dot.cancelled { background: #dc2626; }
        .event-timeline-line {
          position: absolute;
          top: 5px;
          left: 50%;
          right: -50%;
          height: 2px;
          background: #e5e7eb;
          z-index: 0;
        }
        .event-timeline-compact .event-timeline-line { top: 4px; }
        .event-timeline-line.done { background: #16a34a; }
        .event-timeline-label {
          font-size: .6875rem; color: var(--muted-foreground);
          text-align: center; white-space: nowrap;
        }
        .event-timeline-note {
          font-size: .75rem; font-weight: 600;
          text-align: left;
        }
        .event-timeline-compact {
          width: 120px;
        }
        .event-timeline-compact .event-timeline-dot {
          width: 8px; height: 8px;
        }
        .event-timeline-compact .event-timeline-dot.active {
          width: 10px; height: 10px;
        }
      `}</style>
    </div>
  );
}
