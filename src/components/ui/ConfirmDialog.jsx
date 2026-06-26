import { useCallback, useEffect, useRef, useState } from 'react';
import { IconX } from '../../icons';
import { _registerDialogOpener } from '../../lib/dialog';

// Modal alert / confirm / prompt that replaces the native window.alert,
// window.confirm and window.prompt. Resolved through the singleton bridge in
// lib/dialog.js so non-component code can await a user response.

export default function ConfirmDialogProvider({ children }) {
  const [stack, setStack] = useState([]);
  const idRef = useRef(0);

  const open = useCallback((opts) => {
    return new Promise((resolve) => {
      const id = ++idRef.current;
      setStack((prev) => [...prev, { id, opts, resolve }]);
    });
  }, []);

  const close = useCallback((id, value) => {
    setStack((prev) => {
      const target = prev.find((d) => d.id === id);
      if (target) target.resolve(value);
      return prev.filter((d) => d.id !== id);
    });
  }, []);

  useEffect(() => {
    _registerDialogOpener(open);
    return () => _registerDialogOpener(null);
  }, [open]);

  return (
    <>
      {children}
      {stack.map((d) => (
        <DialogShell key={d.id} entry={d} onClose={close} />
      ))}
    </>
  );
}

function DialogShell({ entry, onClose }) {
  const { opts } = entry;
  const kind = opts.kind || 'alert';
  const [value, setValue] = useState(opts.defaultValue ?? '');
  const [error, setError] = useState('');
  const okBtnRef = useRef(null);
  const inputRef = useRef(null);
  const previouslyFocused = useRef(null);

  // Resolution values per dialog kind. Cancelling alert resolves undefined,
  // confirm resolves false, prompt resolves null — matching native behaviour.
  const cancelValue = kind === 'confirm' ? false : (kind === 'prompt' ? null : undefined);

  const submit = useCallback(() => {
    if (kind === 'prompt') {
      const v = value;
      if (opts.required && !String(v ?? '').trim()) {
        setError(opts.requiredMessage || 'This field is required.');
        return;
      }
      onClose(entry.id, v);
      return;
    }
    if (kind === 'confirm') { onClose(entry.id, true); return; }
    onClose(entry.id, undefined);
  }, [entry.id, kind, onClose, opts.required, opts.requiredMessage, value]);

  const cancel = useCallback(() => {
    onClose(entry.id, cancelValue);
  }, [entry.id, cancelValue, onClose]);

  // Trap focus inside the modal + restore focus to the trigger on close.
  useEffect(() => {
    previouslyFocused.current = document.activeElement;
    // Focus the input for prompts, the OK button otherwise — gives keyboard
    // users the most useful starting point.
    setTimeout(() => {
      if (kind === 'prompt' && inputRef.current) inputRef.current.focus();
      else if (okBtnRef.current) okBtnRef.current.focus();
    }, 0);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
      if (previouslyFocused.current && previouslyFocused.current.focus) {
        try { previouslyFocused.current.focus(); } catch { /* element gone */ }
      }
    };
  }, [kind]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); cancel(); }
      else if (e.key === 'Enter' && kind !== 'prompt') { e.preventDefault(); submit(); }
      else if (e.key === 'Enter' && kind === 'prompt' && !opts.multiline) { e.preventDefault(); submit(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cancel, kind, opts.multiline, submit]);

  const title = opts.title || (kind === 'confirm' ? 'Please confirm' : kind === 'prompt' ? 'Input required' : 'Notice');
  const okText = opts.confirmText || opts.okText || (kind === 'confirm' ? 'Confirm' : 'OK');
  const cancelText = opts.cancelText || 'Cancel';
  const danger = !!opts.danger;

  // Render a paragraph per newline-separated chunk so callers can keep using
  // `\n\n` for emphasis the way they did with native confirm().
  const lines = String(opts.message ?? '').split(/\n{2,}/);

  return (
    <div className="dialog-overlay" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) cancel(); }}>
      <div
        className="dialog-shell"
        role={kind === 'alert' ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby={`dialog-title-${entry.id}`}
        aria-describedby={`dialog-body-${entry.id}`}
      >
        <div className="dialog-header">
          <h2 id={`dialog-title-${entry.id}`} className="dialog-title">{title}</h2>
          <button type="button" className="dialog-close" onClick={cancel} aria-label="Close">
            <IconX />
          </button>
        </div>

        <div id={`dialog-body-${entry.id}`} className="dialog-body">
          {lines.map((p, i) => (
            <p key={i} className="dialog-text">{p}</p>
          ))}

          {kind === 'prompt' && (
            opts.multiline ? (
              <textarea
                ref={inputRef}
                className="input-base dialog-input"
                rows={4}
                placeholder={opts.placeholder || ''}
                value={value}
                onChange={(e) => { setValue(e.target.value); if (error) setError(''); }}
              />
            ) : (
              <input
                ref={inputRef}
                type={opts.inputType || 'text'}
                className="input-base dialog-input"
                placeholder={opts.placeholder || ''}
                value={value}
                onChange={(e) => { setValue(e.target.value); if (error) setError(''); }}
              />
            )
          )}

          {error && <div className="dialog-error" role="alert">{error}</div>}
        </div>

        <div className="dialog-footer">
          {kind !== 'alert' && (
            <button type="button" className="btn btn-outline" onClick={cancel}>{cancelText}</button>
          )}
          <button
            ref={okBtnRef}
            type="button"
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={submit}
          >
            {okText}
          </button>
        </div>
      </div>
    </div>
  );
}
