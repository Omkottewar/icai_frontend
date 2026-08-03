// `size="compact"` shrinks the vertical padding + heading so subpages
// with dense content (e.g. committee detail) don't get a huge hero band
// pushing the actual content below the fold. Default size stays as-is
// so every other consumer keeps its current visual weight.
export default function PageHeader({ title, subtitle, size = 'default' }) {
  const compact = size === 'compact';
  return (
    <section
      style={{
        borderBottom: '1px solid var(--border)',
        background: 'linear-gradient(135deg, var(--primary), var(--primary-darker))',
        color: 'var(--primary-foreground)',
        padding: compact ? 'clamp(1rem, 2.5vw, 1.35rem) 0' : 'clamp(2rem, 6vw, 3.5rem) 0',
      }}
    >
      <div className="container">
        <h1 style={{
          fontSize: compact ? 'clamp(1.125rem, 3vw, 1.5rem)' : 'clamp(1.5rem, 5vw, 2.25rem)',
          fontWeight: 700, letterSpacing: '-.01em', margin: 0, lineHeight: 1.15,
        }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{
            marginTop: compact ? '.2rem' : '.5rem',
            maxWidth: '42rem',
            color: 'rgba(255,255,255,.8)',
            fontSize: compact ? '.8125rem' : 'clamp(.875rem, 2.5vw, 1rem)',
            lineHeight: 1.5,
          }}>
            {subtitle}
          </p>
        )}
      </div>
    </section>
  );
}
