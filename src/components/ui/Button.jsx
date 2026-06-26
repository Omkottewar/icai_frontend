import { forwardRef, useRef, useState } from 'react';

// Drop-in replacement for a native <button>. Two ways to drive the loading
// state:
//   1. Auto: if `onClick` returns a Promise, the button shows a spinner +
//      disables itself until the promise settles. No state plumbing in the
//      caller, no risk of double-clicks during async work.
//   2. Manual: pass `loading={busy}` for callers that already track their own
//      pending state (form `saving` flags, etc.).
//
// While loading the button is disabled (clicks ignored), shows a circular
// spinner, sets aria-busy="true" for screen readers, and applies the
// .btn-loading visual treatment from index.css.

const Button = forwardRef(function Button(
  {
    onClick,
    loading: externalLoading,
    disabled,
    className = '',
    children,
    type = 'button',
    spinnerPosition = 'leading', // 'leading' | 'trailing' | 'overlay'
    ...rest
  },
  ref,
) {
  const [internalLoading, setInternalLoading] = useState(false);
  // Track unmount so we don't setState after the component is gone (e.g. an
  // onClick that navigates away mid-flight).
  const unmountedRef = useRef(false);

  const loading = externalLoading || internalLoading;
  const isDisabled = disabled || loading;

  const handleClick = async (e) => {
    if (isDisabled) {
      e.preventDefault();
      return;
    }
    if (!onClick) return;
    let result;
    try {
      result = onClick(e);
    } catch (err) {
      // Synchronous error — propagate after we've ensured no stuck state.
      throw err;
    }
    if (result && typeof result.then === 'function') {
      setInternalLoading(true);
      try {
        await result;
      } finally {
        if (!unmountedRef.current) setInternalLoading(false);
      }
    }
  };

  const cls = [
    className,
    loading ? 'btn-loading' : '',
    loading && spinnerPosition === 'overlay' ? 'btn-loading-overlay' : '',
  ].filter(Boolean).join(' ');

  return (
    <button
      ref={ref}
      type={type}
      className={cls}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      data-loading={loading ? 'true' : undefined}
      onClick={handleClick}
      {...rest}
    >
      {loading && spinnerPosition === 'leading' && <Spinner />}
      <span className="btn-label">{children}</span>
      {loading && spinnerPosition === 'trailing' && <Spinner />}
      {loading && spinnerPosition === 'overlay' && (
        <span className="btn-spinner-overlay" aria-hidden="true"><Spinner /></span>
      )}
    </button>
  );
});

function Spinner() {
  return <span className="btn-spinner" aria-hidden="true" />;
}

export default Button;
