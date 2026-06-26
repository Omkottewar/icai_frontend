// Singleton bridge so any module — not just components — can fire a toast.
// The ToastProvider registers its push fn here on mount.

let pushFn = null;
let queue = [];

export function _registerToastPusher(fn) {
  pushFn = fn;
  if (queue.length && fn) {
    queue.forEach((t) => fn(t));
    queue = [];
  }
}

function emit(text, kind, opts = {}) {
  const t = { text: String(text ?? ''), kind, duration: opts.duration, title: opts.title };
  if (pushFn) pushFn(t);
  else queue.push(t);
}

export const toast = {
  success: (text, opts) => emit(text, 'success', opts),
  error:   (text, opts) => emit(text, 'error',   opts),
  info:    (text, opts) => emit(text, 'info',    opts),
  warning: (text, opts) => emit(text, 'warning', opts),
  show:    (text, kind = 'info', opts) => emit(text, kind, opts),
};

export default toast;
