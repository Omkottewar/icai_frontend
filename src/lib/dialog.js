// Singleton bridge so any module can open a modal alert/confirm/prompt and
// await its result. The DialogProvider registers its `open` fn here on mount.

let openFn = null;

export function _registerDialogOpener(fn) { openFn = fn; }

function open(opts) {
  if (openFn) return openFn(opts);
  // Fallback during early bootstrap — should never hit in practice.
  if (opts.kind === 'confirm') return Promise.resolve(window.confirm(opts.message));
  if (opts.kind === 'prompt')  return Promise.resolve(window.prompt(opts.message, opts.defaultValue ?? ''));
  if (opts.kind === 'alert')   { window.alert(opts.message); return Promise.resolve(); }
  return Promise.resolve(null);
}

export const dialog = {
  // confirm({ title, message, confirmText, cancelText, danger }) → Promise<boolean>
  confirm: (opts = {}) => open({ kind: 'confirm', ...opts }),
  // alert({ title, message, okText }) → Promise<void>
  alert: (opts = {}) => open({
    kind: 'alert',
    ...(typeof opts === 'string' ? { message: opts } : opts),
  }),
  // prompt({ title, message, defaultValue, placeholder, okText, cancelText,
  //          required, multiline, inputType }) → Promise<string|null>
  prompt: (opts = {}) => open({ kind: 'prompt', ...opts }),
};

export default dialog;
