import PageHeader from '../layout/PageHeader';

export default function GenericPage({ title, subtitle, body }) {
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      <section className="container" style={{ padding: '3rem 1rem', maxWidth: '56rem' }}>
        {body}
      </section>
    </>
  );
}
