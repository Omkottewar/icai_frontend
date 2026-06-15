import { useEffect, useState } from 'react';

// Hybrid date+time input.
//
// Desktop (>=768px wide): keeps the native <input type="datetime-local">.
// Chromium and Firefox render a perfectly usable popover there, and the
// form already validates against this format.
//
// Mobile (<768px): native datetime-local is unreliable — Safari iOS hides
// the time picker, older Android Chrome falls back to a plain text field.
// We split into two well-supported inputs:
//   <input type="date"> + <input type="time">
// Both have rock-solid mobile pickers across every browser.
//
// Wire format (the parent's `value` and the value passed back to `onChange`)
// stays "YYYY-MM-DDTHH:MM" — same as datetime-local — so callers don't
// need to know which mode they're in.
export default function DateTimePicker({
  value,
  onChange,
  required = false,
  disabled = false,
  className = 'input-base',
}) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(max-width: 767px)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(max-width: 767px)');
    const handler = (e) => setIsMobile(e.matches);
    // Safari < 14 only supports addListener/removeListener.
    if (mq.addEventListener) {
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
    mq.addListener(handler);
    return () => mq.removeListener(handler);
  }, []);

  if (!isMobile) {
    return (
      <input
        type="datetime-local"
        className={className}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={disabled}
      />
    );
  }

  // Mobile path — split fields. The wire format is "YYYY-MM-DDTHH:MM".
  const [datePart, timePart] = value ? splitValue(value) : ['', ''];

  const emit = (d, t) => {
    if (!d && !t) {
      onChange('');
      return;
    }
    // If only one side is filled, fall back to a sensible default for the
    // other so the parent gets a complete value to validate. Users will
    // see the missing field highlighted by required-field validation.
    const finalDate = d || todayLocalISO();
    const finalTime = t || '09:00';
    onChange(`${finalDate}T${finalTime}`);
  };

  return (
    <div className="dtp-mobile">
      <input
        type="date"
        className={className}
        value={datePart}
        onChange={(e) => emit(e.target.value, timePart)}
        required={required}
        disabled={disabled}
        style={{ flex: '1.4 1 0', minWidth: 0 }}
      />
      <input
        type="time"
        className={className}
        value={timePart}
        onChange={(e) => emit(datePart, e.target.value)}
        required={required}
        disabled={disabled}
        style={{ flex: '1 1 0', minWidth: 0 }}
      />
      <style>{`
        .dtp-mobile { display: flex; gap: .5rem; }
      `}</style>
    </div>
  );
}

function splitValue(v) {
  if (typeof v !== 'string' || !v.includes('T')) return ['', ''];
  const [d, t] = v.split('T');
  return [d || '', (t || '').slice(0, 5)];
}

function todayLocalISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
