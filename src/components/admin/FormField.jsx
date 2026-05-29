// Tiny wrapper matching the field-label / input-base CSS already used on
// auth/onboarding pages. Keeps every admin form visually consistent.
export default function FormField({ label, error, hint, required, children, span }) {
  return (
    <label className={'admin-field' + (span === 2 ? ' admin-field-span-2' : '')}>
      <span className="field-label">
        {label}
        {required && <span style={{ color: 'var(--destructive)' }}> *</span>}
      </span>
      {children}
      {hint && !error && <span className="admin-field-hint">{hint}</span>}
      {error && <span className="admin-field-error">{error}</span>}
      <style>{`
        .admin-field { display: flex; flex-direction: column; gap: .25rem; min-width: 0; }
        .admin-field-span-2 { grid-column: span 2; }
        .admin-field-hint { font-size: .75rem; color: var(--muted-foreground); }
        .admin-field-error { font-size: .75rem; color: var(--destructive); }
      `}</style>
    </label>
  );
}
