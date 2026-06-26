import { useMemo, useState } from 'react';
import EventRow from '../ui/EventRow';
import { committeeColor } from '../../hooks/usePublicCommittees';
import { Shimmer } from '../ui/Shimmer';
import { IconChevronDown } from '../../icons';

// Indian convention: weeks start on Monday.
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

// First Monday on/before the 1st of the month. Always returns a Monday.
function gridStart(monthDate) {
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  // JS getDay: Sun=0..Sat=6. Convert to Mon=0..Sun=6.
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - offset);
  start.setHours(0, 0, 0, 0);
  return start;
}

function MonthShimmer() {
  return (
    <div aria-hidden="true" className="cal-grid">
      {Array.from({ length: 42 }).map((_, i) => (
        <div key={i} className="cal-cell cal-cell-shim">
          <Shimmer height=".75rem" width="1.25rem" />
          <Shimmer height=".6rem" width="80%" />
        </div>
      ))}
    </div>
  );
}

export default function EventMonthCalendar({ events, loading }) {
  // Pick a starting month: current month, or the month of the soonest
  // upcoming event if the current month is empty and events exist.
  const initial = useMemo(() => {
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    if (!events || events.length === 0) return thisMonth;
    const inThis = events.some((e) => {
      if (!e.starts_at) return false;
      const d = new Date(e.starts_at);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });
    if (inThis) return thisMonth;
    const future = events
      .map((e) => (e.starts_at ? new Date(e.starts_at) : null))
      .filter((d) => d && d >= startOfDay(now))
      .sort((a, b) => a - b)[0];
    return future ? new Date(future.getFullYear(), future.getMonth(), 1) : thisMonth;
  }, [events]);

  const [cursor, setCursor] = useState(initial);
  const [selectedDay, setSelectedDay] = useState(null);

  // Bucket events by yyyy-mm-dd for O(1) cell lookup.
  const byDay = useMemo(() => {
    const map = new Map();
    (events || []).forEach((ev) => {
      if (!ev.starts_at) return;
      const d = new Date(ev.starts_at);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(ev);
    });
    // Sort each day's events chronologically so chips appear in time order.
    for (const arr of map.values()) {
      arr.sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
    }
    return map;
  }, [events]);

  const today = startOfDay(new Date());
  const start = gridStart(cursor);
  const cells = useMemo(() => {
    const out = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      out.push(d);
    }
    return out;
  }, [start]);

  const monthLabel = cursor.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  function gotoPrev() {
    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1));
    setSelectedDay(null);
  }
  function gotoNext() {
    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1));
    setSelectedDay(null);
  }
  function gotoToday() {
    setCursor(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDay(today);
  }

  const selectedEvents = selectedDay
    ? (byDay.get(`${selectedDay.getFullYear()}-${selectedDay.getMonth()}-${selectedDay.getDate()}`) || [])
    : [];

  return (
    <div className="cal-wrap">
      <style>{CALENDAR_CSS}</style>

      {/* Toolbar: month nav + today */}
      <div className="cal-toolbar">
        <div className="cal-nav">
          <button type="button" className="btn btn-outline cal-nav-btn" onClick={gotoPrev} aria-label="Previous month">
            <IconChevronDown size="sm" style={{ transform: 'rotate(90deg)' }} />
          </button>
          <div className="cal-month-label">{monthLabel}</div>
          <button type="button" className="btn btn-outline cal-nav-btn" onClick={gotoNext} aria-label="Next month">
            <IconChevronDown size="sm" style={{ transform: 'rotate(-90deg)' }} />
          </button>
        </div>
        <button type="button" className="btn btn-outline cal-today-btn" onClick={gotoToday}>Today</button>
      </div>

      {/* Weekday header */}
      <div className="cal-weekdays" aria-hidden="true">
        {DAY_LABELS.map((d) => <div key={d} className="cal-weekday">{d}</div>)}
      </div>

      {/* Grid */}
      {loading ? (
        <MonthShimmer />
      ) : (
        <div className="cal-grid" role="grid" aria-label={`Events in ${monthLabel}`}>
          {cells.map((d) => {
            const inMonth = d.getMonth() === cursor.getMonth();
            const isToday = sameDay(d, today);
            const isSelected = selectedDay && sameDay(d, selectedDay);
            const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            const dayEvents = byDay.get(key) || [];
            const visible = dayEvents.slice(0, 2);
            const overflow = dayEvents.length - visible.length;

            return (
              <button
                key={key}
                type="button"
                role="gridcell"
                aria-selected={isSelected || undefined}
                className={[
                  'cal-cell',
                  inMonth ? '' : 'cal-cell-out',
                  isToday ? 'cal-cell-today' : '',
                  isSelected ? 'cal-cell-selected' : '',
                  dayEvents.length > 0 ? 'cal-cell-has' : '',
                ].filter(Boolean).join(' ')}
                onClick={() => setSelectedDay(d)}
                aria-label={`${d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}${dayEvents.length ? `, ${dayEvents.length} event${dayEvents.length === 1 ? '' : 's'}` : ', no events'}`}
              >
                <div className="cal-cell-num">{d.getDate()}</div>
                <div className="cal-cell-events">
                  {visible.map((ev) => (
                    <span
                      key={ev.id ?? ev.title}
                      className="cal-chip"
                      style={{ '--chip-bg': committeeColor(ev.committee) }}
                      title={`${ev.title}${ev.time ? ' · ' + ev.time : ''}`}
                    >
                      {ev.title}
                    </span>
                  ))}
                  {overflow > 0 && (
                    <span className="cal-chip cal-chip-more">+{overflow} more</span>
                  )}
                  {/* Mobile-compact: just a dot count, hidden on wider screens */}
                  {dayEvents.length > 0 && (
                    <span className="cal-dot-row" aria-hidden="true">
                      {dayEvents.slice(0, 3).map((ev, i) => (
                        <span
                          key={i}
                          className="cal-dot"
                          style={{ background: committeeColor(ev.committee) }}
                        />
                      ))}
                      {dayEvents.length > 3 && <span className="cal-dot-more">+{dayEvents.length - 3}</span>}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Day-detail panel */}
      {selectedDay && (
        <div className="cal-day-panel">
          <div className="cal-day-panel-head">
            <h3 className="cal-day-panel-title">
              {selectedDay.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </h3>
            <button type="button" className="cal-day-close" onClick={() => setSelectedDay(null)} aria-label="Close day detail">×</button>
          </div>
          {selectedEvents.length === 0 ? (
            <p className="muted-text" style={{ padding: '.75rem 0' }}>No events scheduled for this day.</p>
          ) : (
            <div>{selectedEvents.map((e) => <EventRow key={e.id ?? e.title} event={e} detailed />)}</div>
          )}
        </div>
      )}

      {!loading && (events?.length ?? 0) === 0 && (
        <p className="muted-text" style={{ marginTop: '1rem', textAlign: 'center' }}>No upcoming events to display.</p>
      )}
    </div>
  );
}

// Co-located CSS. Inlined via <style> so this component is self-contained —
// drops in anywhere without a separate stylesheet edit. Custom property
// `--chip-bg` is set per-chip from committeeColor().
const CALENDAR_CSS = `
.cal-wrap { width: 100%; }

.cal-toolbar {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: .75rem; flex-wrap: wrap; gap: .5rem;
}
.cal-nav { display: flex; align-items: center; gap: .5rem; }
.cal-nav-btn { padding: .35rem .5rem; min-width: 2.25rem; }
.cal-month-label {
  font-weight: 700; font-size: 1rem; min-width: 9.5rem; text-align: center;
}
.cal-today-btn { padding: .35rem .85rem; font-size: .8125rem; }

.cal-weekdays {
  display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 2px;
  margin-bottom: 2px; width: 100%;
}
.cal-weekday {
  text-align: center; font-size: .7rem; font-weight: 600;
  color: var(--muted-foreground); padding: .35rem 0;
  text-transform: uppercase; letter-spacing: .04em;
}

.cal-grid {
  display: grid; grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 2px; background: var(--border);
  border: 1px solid var(--border); border-radius: .5rem; overflow: hidden;
  width: 100%;
}

.cal-cell {
  background: var(--card); min-height: 5.75rem; padding: .35rem .4rem;
  text-align: left; display: flex; flex-direction: column;
  border: 0; cursor: pointer; transition: background .12s;
  position: relative; gap: .25rem;
  /* Grid items default to min-width: auto (= content width). Without this,
     a long event title forces the cell wider than 1/7 of the container,
     overflowing the Sunday column off-screen. */
  min-width: 0;
  overflow: hidden;
}
.cal-cell:hover { background: color-mix(in oklab, var(--primary) 6%, var(--card)); }
.cal-cell:focus-visible {
  outline: 2px solid var(--primary); outline-offset: -2px; z-index: 2;
}
.cal-cell-out { background: color-mix(in oklab, var(--muted) 35%, var(--card)); }
.cal-cell-out .cal-cell-num { color: var(--muted-foreground); opacity: .55; }

.cal-cell-num {
  font-size: .8125rem; font-weight: 600; line-height: 1; color: var(--foreground);
}
.cal-cell-today .cal-cell-num {
  background: var(--primary); color: white;
  width: 1.5rem; height: 1.5rem; border-radius: 50%;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: .75rem;
}
.cal-cell-selected { box-shadow: inset 0 0 0 2px var(--primary); }

.cal-cell-events {
  display: flex; flex-direction: column; gap: 2px; min-height: 0; flex: 1;
}
.cal-chip {
  background: var(--chip-bg, var(--primary));
  color: white; font-size: .68rem; line-height: 1.15;
  padding: .15rem .35rem; border-radius: 3px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  font-weight: 500;
  /* Render as block so the chip honours the cell width (spans are inline
     by default, which lets nowrap content push the cell wider). */
  display: block; max-width: 100%; min-width: 0;
}
.cal-chip-more {
  background: var(--muted); color: var(--muted-foreground); font-weight: 600;
}
.cal-dot-row { display: none; gap: 3px; align-items: center; }
.cal-dot { width: 6px; height: 6px; border-radius: 50%; display: inline-block; }
.cal-dot-more {
  font-size: .6rem; color: var(--muted-foreground); font-weight: 600;
  margin-left: 1px;
}

.cal-day-panel {
  margin-top: 1.5rem; padding-top: 1.25rem;
  border-top: 1px solid var(--border);
}
.cal-day-panel-head {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 1rem;
}
.cal-day-panel-title {
  margin: 0; font-size: 1.0625rem; font-weight: 700;
}
.cal-day-close {
  background: var(--muted); border: 0; cursor: pointer;
  width: 1.85rem; height: 1.85rem; border-radius: 50%;
  font-size: 1.15rem; line-height: 1; color: var(--muted-foreground);
}
.cal-day-close:hover { background: color-mix(in oklab, var(--primary) 12%, var(--muted)); }

/* Mobile / narrow: hide chip text, show coloured dots only. Day cells
   stay tappable; full event list comes from the day-detail panel. */
@media (max-width: 720px) {
  .cal-cell { min-height: 3.5rem; padding: .3rem .25rem; }
  .cal-chip, .cal-chip-more { display: none; }
  .cal-dot-row { display: inline-flex; }
  .cal-cell-num { font-size: .75rem; }
  .cal-cell-today .cal-cell-num { width: 1.35rem; height: 1.35rem; font-size: .7rem; }
  .cal-month-label { font-size: .9rem; min-width: 7.5rem; }
  .cal-weekday { font-size: .6rem; }
}
`;
