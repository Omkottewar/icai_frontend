import { IconChevronUp, IconChevronDownAlt } from '../../icons';

// 12-hour time stepper with AM/PM toggle. Pulled out of DateTimePicker.jsx
// so it can be reused by TimeRangePicker (and anywhere else that needs the
// same hour/minute UX without a full calendar grid).
//
// Props:
//   hour   — 0..23
//   minute — 0..59
//   onHour, onMinute — receive the new 0..23 / 0..59 value
//   compact — optional, slightly tighter spacing for narrow layouts
export default function TimeStepper({ hour, minute, onHour, onMinute, compact = false }) {
  const isPM = hour >= 12;
  const display12 = ((hour % 12) || 12);

  const setH12 = (h12) => {
    const h24 = isPM ? (h12 === 12 ? 12 : h12 + 12) : (h12 === 12 ? 0 : h12);
    onHour(h24);
  };
  const togglePM = () => {
    onHour(isPM ? hour - 12 : hour + 12);
  };
  const bumpMinute = (delta) => {
    const next = (minute + delta + 60) % 60;
    onMinute(next);
  };
  const bumpHour12 = (delta) => {
    let next = display12 + delta;
    if (next < 1) next = 12;
    if (next > 12) next = 1;
    setH12(next);
  };

  return (
    <div className={'ts-wrap' + (compact ? ' is-compact' : '')}>
      <div className="ts-field">
        <button type="button" className="ts-up" onClick={() => bumpHour12(1)} aria-label="Hour up">
          <IconChevronUp size="xs" />
        </button>
        <input
          type="number"
          min="1" max="12"
          value={display12}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n) && n >= 1 && n <= 12) setH12(n);
          }}
          aria-label="Hour"
        />
        <button type="button" className="ts-down" onClick={() => bumpHour12(-1)} aria-label="Hour down">
          <IconChevronDownAlt size="xs" />
        </button>
      </div>
      <span className="ts-colon">:</span>
      <div className="ts-field">
        <button type="button" className="ts-up" onClick={() => bumpMinute(5)} aria-label="Minute up">
          <IconChevronUp size="xs" />
        </button>
        <input
          type="number"
          min="0" max="59"
          value={String(minute).padStart(2, '0')}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n) && n >= 0 && n <= 59) onMinute(n);
          }}
          aria-label="Minute"
        />
        <button type="button" className="ts-down" onClick={() => bumpMinute(-5)} aria-label="Minute down">
          <IconChevronDownAlt size="xs" />
        </button>
      </div>
      <button
        type="button"
        className={'ts-ampm' + (isPM ? ' is-pm' : '')}
        onClick={togglePM}
        aria-label="Toggle AM/PM"
      >
        {isPM ? 'PM' : 'AM'}
      </button>
      <style>{`
        .ts-wrap { display: flex; align-items: center; gap: .35rem; }
        .ts-wrap.is-compact { gap: .2rem; }
        .ts-field {
          position: relative;
          display: flex; flex-direction: column; align-items: center;
        }
        .ts-field input {
          width: 2.4rem; height: 2rem;
          padding: 0;
          text-align: center;
          font: inherit; font-size: .95rem; font-weight: 700;
          color: var(--foreground);
          background: var(--background, #f8fafc);
          border: 1px solid var(--border);
          border-radius: .35rem;
          -moz-appearance: textfield;
        }
        .ts-wrap.is-compact .ts-field input { width: 2.1rem; height: 1.85rem; font-size: .85rem; }
        .ts-field input::-webkit-outer-spin-button,
        .ts-field input::-webkit-inner-spin-button {
          -webkit-appearance: none; margin: 0;
        }
        .ts-field input:focus { outline: 2px solid var(--primary); outline-offset: -1px; }
        .ts-up, .ts-down {
          position: absolute;
          width: 1.4rem; height: .9rem;
          padding: 0;
          background: transparent; border: 0; cursor: pointer;
          color: var(--muted-foreground);
          display: flex; align-items: center; justify-content: center;
          opacity: 0; transition: opacity .12s;
        }
        .ts-field:hover .ts-up, .ts-field:hover .ts-down,
        .ts-field:focus-within .ts-up, .ts-field:focus-within .ts-down {
          opacity: 1;
        }
        .ts-up { top: -1.05rem; }
        .ts-down { bottom: -1.05rem; }
        .ts-up:hover, .ts-down:hover { color: var(--primary, #1e40af); }
        .ts-colon {
          font-size: 1rem; font-weight: 700;
          color: var(--muted-foreground);
          padding-bottom: .15rem;
        }
        .ts-ampm {
          padding: .3rem .65rem;
          background: var(--background, #f8fafc);
          border: 1px solid var(--border);
          border-radius: .35rem;
          font: inherit; font-size: .8rem; font-weight: 700;
          color: var(--muted-foreground);
          cursor: pointer;
          margin-left: .25rem;
        }
        .ts-wrap.is-compact .ts-ampm { padding: .25rem .5rem; font-size: .72rem; }
        .ts-ampm.is-pm {
          background: var(--primary, #1e40af);
          color: white;
          border-color: var(--primary, #1e40af);
        }
        .ts-ampm:hover:not(.is-pm) { color: var(--foreground); }
      `}</style>
    </div>
  );
}
