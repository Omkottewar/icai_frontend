import { useCallback, useEffect, useRef, useState } from 'react';
import { IconCheckCircle, IconX, IconBell } from '../../icons';
import { _registerToastPusher } from '../../lib/notify';

// Top-right notification stack. Multiple toasts stack vertically, auto-dismiss
// after `duration` ms (default 3500), and can be dismissed manually. Wired to
// the `toast.*` singleton in lib/notify.js so any module (not just React
// components) can fire one.

const DEFAULT_DURATION = 3500;

function ToastIcon({ kind }) {
  if (kind === 'success') return <IconCheckCircle />;
  if (kind === 'error')   return <IconX />;
  if (kind === 'warning') return <IconBell />;
  return <IconBell />;
}

function ToastItem({ toast, onDismiss }) {
  const [leaving, setLeaving] = useState(false);
  const timerRef = useRef(null);

  const dismiss = useCallback(() => {
    setLeaving(true);
    // Allow exit animation to finish before removing from the queue.
    setTimeout(() => onDismiss(toast.id), 220);
  }, [toast.id, onDismiss]);

  useEffect(() => {
    const dur = toast.duration ?? DEFAULT_DURATION;
    timerRef.current = setTimeout(dismiss, dur);
    return () => clearTimeout(timerRef.current);
  }, [toast.duration, dismiss]);

  return (
    <div
      className={`toast-item toast-${toast.kind} ${leaving ? 'toast-leaving' : ''}`}
      role={toast.kind === 'error' ? 'alert' : 'status'}
      aria-live={toast.kind === 'error' ? 'assertive' : 'polite'}
      onMouseEnter={() => clearTimeout(timerRef.current)}
      onMouseLeave={() => { timerRef.current = setTimeout(dismiss, 1500); }}
    >
      <span className="toast-icon" aria-hidden="true"><ToastIcon kind={toast.kind} /></span>
      <div className="toast-body">
        {toast.title && <div className="toast-title">{toast.title}</div>}
        <div className="toast-text">{toast.text}</div>
      </div>
      <button type="button" className="toast-close" onClick={dismiss} aria-label="Dismiss notification">
        <IconX />
      </button>
    </div>
  );
}

export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const push = useCallback((t) => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, ...t }]);
  }, []);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    _registerToastPusher(push);
    return () => _registerToastPusher(null);
  }, [push]);

  return (
    <>
      {children}
      <div className="toast-stack" aria-label="Notifications" role="region">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </>
  );
}
