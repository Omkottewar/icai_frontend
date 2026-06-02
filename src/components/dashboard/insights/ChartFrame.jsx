// Card wrapper for any chart or table block — header row + content body,
// matching the chairman-pulse-main visual: rounded-14, border, title +
// subtitle on the left, optional action on the right, divider, body.
//
// `eyebrow` is still accepted from the legacy callsites but no longer
// rendered as its own pill — the chairman-pulse layout keeps the header
// to just title + subtitle.
export default function ChartFrame({
  // eslint-disable-next-line no-unused-vars
  eyebrow,
  title, subtitle, actions, children,
  loading = false, empty = false, emptyText = 'No data in this range.',
}) {
  return (
    <div className="insight-frame">
      <div className="insight-frame-header">
        <div className="insight-frame-titles">
          <div className="insight-frame-title">{title}</div>
          {subtitle && <div className="insight-frame-subtitle">{subtitle}</div>}
        </div>
        {actions && <div className="insight-frame-actions">{actions}</div>}
      </div>
      <div className="insight-frame-body">
        {loading ? (
          <div className="insight-frame-skeleton" />
        ) : empty ? (
          <div className="insight-frame-empty">{emptyText}</div>
        ) : children}
      </div>
    </div>
  );
}
