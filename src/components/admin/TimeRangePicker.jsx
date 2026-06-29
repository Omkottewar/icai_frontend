import { IconClock } from '../../icons';
import TimeStepper from './TimeStepper';

// Side-by-side time range picker. Wire format stays
// { start: 'HH:MM', end: 'HH:MM' } (24h) so existing callers don't change.
// Visually matches DateTimePicker's TimeStepper so the checklist form has
// one consistent time UI everywhere.

function parseHHMM(s) {
  if (typeof s !== 'string') return null;
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return { h, min };
}

function fmtHHMM(h, min) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(min)}`;
}

export default function TimeRangePicker({ value, onChange, disabled = false }) {
  const v = (value && typeof value === 'object') ? value : { start: '', end: '' };
  const s = parseHHMM(v.start);
  const e = parseHHMM(v.end);

  // Default to 9:00 AM start, 11:00 AM end when the field is empty so the
  // user can fine-tune from a sensible base instead of from "00:00".
  const sHour = s ? s.h : 9;
  const sMin  = s ? s.min : 0;
  const eHour = e ? e.h : 11;
  const eMin  = e ? e.min : 0;

  const emit = (next) => onChange({ start: v.start || '', end: v.end || '', ...next });

  return (
    <div className={'trp-wrap' + (disabled ? ' is-disabled' : '')}>
      <div className="trp-slot">
        <span className="trp-icon"><IconClock size="sm" /></span>
        <TimeStepper
          hour={sHour}
          minute={sMin}
          onHour={(h) => emit({ start: fmtHHMM(h, sMin) })}
          onMinute={(m) => emit({ start: fmtHHMM(sHour, m) })}
          compact
        />
      </div>
      <span className="trp-sep" aria-hidden>—</span>
      <div className="trp-slot">
        <TimeStepper
          hour={eHour}
          minute={eMin}
          onHour={(h) => emit({ end: fmtHHMM(h, eMin) })}
          onMinute={(m) => emit({ end: fmtHHMM(eHour, m) })}
          compact
        />
      </div>
      <style>{`
        .trp-wrap {
          display: inline-flex; align-items: center; gap: .65rem;
          flex-wrap: wrap;
          padding: .35rem .55rem;
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: .375rem;
        }
        .trp-wrap.is-disabled { opacity: .55; pointer-events: none; }
        .trp-slot {
          display: inline-flex; align-items: center; gap: .35rem;
        }
        .trp-icon {
          color: var(--muted-foreground);
          display: inline-flex; align-items: center;
        }
        .trp-sep {
          font-size: .9rem; color: var(--muted-foreground);
          padding: 0 .15rem;
        }
      `}</style>
    </div>
  );
}
