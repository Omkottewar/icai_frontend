export default function PageHeader({ title, subtitle }) {
  return (
    <section
      style={{
        borderBottom: '1px solid var(--border)',
        background: 'linear-gradient(135deg, var(--primary), var(--primary-darker))',
        color: 'var(--primary-foreground)',
        padding: 'clamp(2rem, 6vw, 3.5rem) 0',
      }}
    >
      <div className="container">
        <h1 style={{ fontSize: 'clamp(1.5rem, 5vw, 2.25rem)', fontWeight: 700, letterSpacing: '-.01em', margin: 0, lineHeight: 1.15 }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{ marginTop: '.5rem', maxWidth: '42rem', color: 'rgba(255,255,255,.8)', fontSize: 'clamp(.875rem, 2.5vw, 1rem)', lineHeight: 1.5 }}>
            {subtitle}
          </p>
        )}
      </div>
    </section>
  );
}
