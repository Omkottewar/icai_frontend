import { useEffect, useMemo, useRef, useState } from 'react';
import { IconCalendar, IconClock } from '../../icons';
import FlipMenu from '../ui/FlipMenu';
import TimeStepper from './TimeStepper';

// Custom date + time picker.
//
// Trigger looks like a normal input ("24 Jun 2026, 5:30 PM ▾"). Click opens
// a popover with a calendar grid + a 12-hour time row + quick presets
// (Now, +1h, +1d). Keyboard: Esc closes, Enter on a date picks it.
//
// Wire format stays "YYYY-MM-DDTHH:MM" (same as native datetime-local) so
// any existing caller doesn't need to change. Empty value = '' (no selection).
//
// Why custom: native datetime-local is unstyleable, opens awkwardly in
// modals, and on Safari iOS hides the time picker entirely.
export default function DateTimePicker({
  value,
  onChange,
  required = false,
  disabled = false,
  className = 'input-base',
  placeholder,
  minDate,           // 'YYYY-MM-DD' — optional lower bound for picking
  maxDate,           // 'YYYY-MM-DD' — optional upper bound for picking
  // 'datetime' (default) — emits 'YYYY-MM-DDTHH:MM', shows calendar + time row
  // 'date'              — emits 'YYYY-MM-DD',         shows calendar only
  mode = 'datetime',
}) {
  const isDateOnly = mode === 'date';
  const effectivePlaceholder = placeholder ?? (isDateOnly ? 'Pick a date' : 'Pick date & time');
  const [open, setOpen] = useState(false);
  // Anchor month shown in the calendar — independent of `value` so users
  // can flip through months without committing.
  const [viewMonth, setViewMonth] = useState(() => {
    const d = parseValue(value) || new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const triggerRef = useRef(null);

  // Keep viewMonth in sync if a parent updates `value` (e.g. resetting form).
  useEffect(() => {
    const d = parseValue(value);
    if (d) setViewMonth(new Date(d.getFullYear(), d.getMonth(), 1));
  }, [value]);

  // FlipMenu handles click-outside + Escape + portal positioning + auto-flip,
  // so the calendar popover can no longer be cropped by parent overflow or
  // viewport edges.

  const picked = parseValue(value);
  const label = picked ? (isDateOnly ? formatPrettyDate(picked) : formatPretty(picked)) : '';

  const emit = (d) => onChange(isDateOnly ? formatWireDate(d) : formatWire(d));

  const setDateKeepTime = (newDate) => {
    const base = picked || defaultTime();
    const merged = new Date(
      newDate.getFullYear(), newDate.getMonth(), newDate.getDate(),
      base.getHours(), base.getMinutes(),
    );
    emit(merged);
  };

  const setHour = (newHour) => {
    const base = picked || defaultTime();
    const merged = new Date(
      base.getFullYear(), base.getMonth(), base.getDate(),
      newHour, base.getMinutes(),
    );
    emit(merged);
  };
  const setMinute = (newMinute) => {
    const base = picked || defaultTime();
    const merged = new Date(
      base.getFullYear(), base.getMonth(), base.getDate(),
      base.getHours(), newMinute,
    );
    emit(merged);
  };

  // Calendar grid: always show 6 weeks (42 cells) so the popover height
  // doesn't jitter month-to-month. Cells before/after the current month
  // fade out but stay clickable.
  const grid = useMemo(() => buildMonthGrid(viewMonth), [viewMonth]);

  const minD = minDate ? parseValue(minDate + 'T00:00') : null;
  const maxD = maxDate ? parseValue(maxDate + 'T23:59') : null;
  const isDisabledDay = (d) => {
    if (minD && d < startOfDay(minD)) return true;
    if (maxD && d > endOfDay(maxD)) return true;
    return false;
  };

  return (
    <div className="dtp-wrap">
      <button
        ref={triggerRef}
        type="button"
        className={className + ' dtp-trigger' + (picked ? '' : ' is-empty')}
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <IconCalendar size="sm" />
        <span className="dtp-trigger-text">
          {label || effectivePlaceholder}
        </span>
        <span className="dtp-trigger-chev" aria-hidden>▾</span>
      </button>

      {required && !picked && (
        <input
          type="text"
          required
          tabIndex={-1}
          value=""
          onChange={() => {}}
          aria-hidden
          style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
        />
      )}

      <FlipMenu
        open={open}
        triggerRef={triggerRef}
        onClose={() => setOpen(false)}
        align="left"
        offset={6}
        minWidth={320}
        className="dtp-pop"
      >
        <div role="dialog" aria-label="Choose date and time">
          {/* Quick presets — fewer when there's no time to nudge */}
          <div className="dtp-presets">
            <button type="button" className="dtp-preset" onClick={() => { emit(new Date()); }}>
              {isDateOnly ? 'Today' : 'Now'}
            </button>
            {!isDateOnly && (
              <button type="button" className="dtp-preset" onClick={() => {
                const base = picked || new Date();
                const d = new Date(base.getTime() + 60 * 60 * 1000);
                emit(d);
              }}>+1 hour</button>
            )}
            <button type="button" className="dtp-preset" onClick={() => {
              const base = picked || new Date();
              const d = new Date(base.getTime() + 24 * 60 * 60 * 1000);
              emit(d);
            }}>+1 day</button>
            <button type="button" className="dtp-preset" onClick={() => {
              const base = picked || new Date();
              const d = new Date(base.getTime() + 7 * 24 * 60 * 60 * 1000);
              emit(d);
            }}>+1 week</button>
          </div>

          {/* Month nav */}
          <div className="dtp-monthnav">
            <button
              type="button"
              className="dtp-navbtn"
              onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
              aria-label="Previous month"
            >‹</button>
            <strong className="dtp-monthlbl">{monthLabel(viewMonth)}</strong>
            <button
              type="button"
              className="dtp-navbtn"
              onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
              aria-label="Next month"
            >›</button>
          </div>

          {/* Day-of-week row */}
          <div className="dtp-dow">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <span key={d} className="dtp-dow-cell">{d}</span>
            ))}
          </div>

          {/* Day grid */}
          <div className="dtp-grid">
            {grid.map((d, i) => {
              const inMonth = d.getMonth() === viewMonth.getMonth();
              const isToday = sameDay(d, new Date());
              const isPicked = picked && sameDay(d, picked);
              const disabled = isDisabledDay(d);
              return (
                <button
                  type="button"
                  key={i}
                  className={
                    'dtp-day'
                    + (inMonth ? '' : ' is-other')
                    + (isToday ? ' is-today' : '')
                    + (isPicked ? ' is-picked' : '')
                  }
                  disabled={disabled}
                  onClick={() => setDateKeepTime(d)}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>

          {/* Time row — hidden in date-only mode */}
          {!isDateOnly && (
            <div className="dtp-time">
              <IconClock size="sm" />
              <TimeStepper
                hour={picked ? picked.getHours() : 9}
                minute={picked ? picked.getMinutes() : 0}
                onHour={setHour}
                onMinute={setMinute}
              />
            </div>
          )}

          {/* Footer actions */}
          <div className="dtp-foot">
            {picked && (
              <button type="button" className="dtp-clear" onClick={() => onChange('')}>
                Clear
              </button>
            )}
            <div style={{ flex: 1 }} />
            <button type="button" className="dtp-done" onClick={() => setOpen(false)}>
              Done
            </button>
          </div>
        </div>
      </FlipMenu>

      <style>{`
        .dtp-wrap { position: relative; }
        .dtp-trigger {
          display: flex; align-items: center; gap: .5rem;
          width: 100%;
          padding: .55rem .75rem;
          text-align: left;
          cursor: pointer;
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: .375rem;
          font: inherit; color: inherit;
          transition: border-color .15s, box-shadow .15s;
        }
        .dtp-trigger:hover:not(:disabled) {
          border-color: oklch(0.36 0.13 255 / 0.5);
        }
        .dtp-trigger:focus-visible {
          outline: 2px solid var(--primary);
          outline-offset: -1px;
        }
        .dtp-trigger:disabled {
          opacity: .55; cursor: not-allowed; background: var(--background, #f8fafc);
        }
        .dtp-trigger.is-empty .dtp-trigger-text {
          color: var(--muted-foreground);
        }
        .dtp-trigger-text {
          flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          font-size: .9rem;
        }
        .dtp-trigger-chev {
          font-size: .7rem; opacity: .55; color: var(--muted-foreground);
        }
        /* FlipMenu owns position + portal placement; we only style. */
        .dtp-pop {
          width: 320px; max-width: calc(100vw - 2rem);
          padding: .75rem;
          background: white;
          border: 1px solid var(--border);
          border-radius: .55rem;
          box-shadow: 0 10px 30px rgba(15, 23, 42, .12), 0 2px 6px rgba(15, 23, 42, .06);
          animation: dtpFade .12s ease-out;
        }
        @keyframes dtpFade {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .dtp-presets {
          display: flex; gap: .25rem; flex-wrap: wrap;
          padding-bottom: .55rem;
          border-bottom: 1px solid var(--border);
          margin-bottom: .55rem;
        }
        .dtp-preset {
          padding: .25rem .55rem;
          background: var(--background, #f8fafc);
          border: 1px solid var(--border);
          border-radius: 999px;
          font: inherit; font-size: .72rem; font-weight: 600;
          color: var(--muted-foreground);
          cursor: pointer;
          transition: all .12s;
        }
        .dtp-preset:hover {
          background: rgba(37, 99, 235, .08);
          color: var(--primary, #1e40af);
          border-color: rgba(37, 99, 235, .25);
        }
        .dtp-monthnav {
          display: grid;
          grid-template-columns: auto 1fr auto;
          gap: .25rem; align-items: center;
          margin-bottom: .35rem;
        }
        .dtp-navbtn {
          width: 1.85rem; height: 1.85rem;
          padding: 0;
          background: transparent;
          border: 1px solid transparent;
          border-radius: .35rem;
          font-size: 1.15rem; line-height: 1;
          color: var(--muted-foreground);
          cursor: pointer;
        }
        .dtp-navbtn:hover {
          background: var(--background, #f1f5f9);
          color: var(--foreground);
        }
        .dtp-monthlbl {
          text-align: center; font-size: .9rem; font-weight: 700;
          color: var(--foreground);
        }
        .dtp-dow {
          display: grid; grid-template-columns: repeat(7, 1fr); gap: .15rem;
          margin-bottom: .2rem;
        }
        .dtp-dow-cell {
          text-align: center; font-size: .68rem; font-weight: 700;
          color: var(--muted-foreground);
          letter-spacing: .04em; text-transform: uppercase;
          padding: .25rem 0;
        }
        .dtp-grid {
          display: grid; grid-template-columns: repeat(7, 1fr); gap: .15rem;
        }
        .dtp-day {
          aspect-ratio: 1 / 1;
          display: flex; align-items: center; justify-content: center;
          background: transparent; border: 1px solid transparent;
          border-radius: .35rem;
          font: inherit; font-size: .82rem; font-weight: 500;
          color: var(--foreground);
          cursor: pointer;
          transition: background .1s, color .1s;
        }
        .dtp-day:hover:not(:disabled) {
          background: rgba(37, 99, 235, .1);
          color: var(--primary, #1e40af);
        }
        .dtp-day.is-other {
          color: var(--muted-foreground); opacity: .5;
        }
        .dtp-day.is-today {
          border-color: rgba(37, 99, 235, .3);
          font-weight: 700;
        }
        .dtp-day.is-picked {
          background: var(--primary, #1e40af);
          color: white;
          font-weight: 700;
        }
        .dtp-day.is-picked:hover { background: oklch(0.32 0.13 255); color: white; }
        .dtp-day:disabled {
          color: var(--muted-foreground); opacity: .25;
          cursor: not-allowed;
        }
        .dtp-time {
          display: flex; align-items: center; gap: .5rem;
          margin-top: .65rem; padding-top: .65rem;
          border-top: 1px solid var(--border);
          color: var(--muted-foreground);
        }
        .dtp-foot {
          display: flex; gap: .35rem; align-items: center;
          margin-top: .65rem;
        }
        .dtp-clear {
          padding: .35rem .65rem;
          background: transparent;
          border: 1px solid var(--border);
          border-radius: .35rem;
          font: inherit; font-size: .75rem; font-weight: 600;
          color: var(--muted-foreground);
          cursor: pointer;
        }
        .dtp-clear:hover {
          color: var(--destructive, #b91c1c);
          border-color: var(--destructive, #fecaca);
        }
        .dtp-done {
          padding: .4rem 1.1rem;
          background: var(--primary, #1e40af);
          color: white;
          border: 0;
          border-radius: .375rem;
          font: inherit; font-size: .8125rem; font-weight: 700;
          cursor: pointer;
        }
        .dtp-done:hover { background: oklch(0.32 0.13 255); }
      `}</style>
    </div>
  );
}

// ─── Pure helpers ────────────────────────────────────────────────────────

function parseValue(v) {
  if (!v || typeof v !== 'string') return null;
  // Accept "YYYY-MM-DDTHH:MM" or full ISO. Treat as local time so the
  // calendar shows the user's intent (not UTC shifted).
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
  if (!m) return null;
  const [, y, mo, d, hh, mm] = m;
  const date = new Date(Number(y), Number(mo) - 1, Number(d), Number(hh || 0), Number(mm || 0));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatWire(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Date-only wire format — what `<input type="date">` would have emitted.
function formatWireDate(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatPrettyDate(d) {
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`;
}

function formatPretty(d) {
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const hours24 = d.getHours();
  const hours12 = ((hours24 % 12) || 12);
  const ampm = hours24 >= 12 ? 'PM' : 'AM';
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}, ${hours12}:${mm} ${ampm}`;
}

function monthLabel(d) {
  const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${MON[d.getMonth()]} ${d.getFullYear()}`;
}

function buildMonthGrid(viewMonth) {
  // 6 rows × 7 cols, Monday-first. First cell is the most recent Monday on
  // or before the 1st of the month.
  const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7; // 0 = Mon
  const start = new Date(first);
  start.setDate(first.getDate() - offset);
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push(d);
  }
  return cells;
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
      && a.getMonth() === b.getMonth()
      && a.getDate() === b.getDate();
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function endOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function defaultTime() {
  // Sensible default when the user types into the time fields before
  // picking a date: today at 09:00.
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 9, 0);
}
