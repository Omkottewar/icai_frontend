import GenericPage from '../components/ui/GenericPage';
import { IconHeart, IconUsers, IconSparkles } from '../icons';

export default function CA2VisionPage() {
  return (
    <GenericPage
      title="CA 2.0 — Life After Office"
      subtitle="A meaningful second innings for senior CAs"
      body={
        <div className="col gap-5">
          <p className="muted-text" style={{ lineHeight: 1.6 }}>
            CA 2.0 is the Nagpur Branch's flagship vision for senior chartered accountants — a community programme
            that combines wellness, mentorship and hobby circles, ensuring that veterans of the profession continue
            to live a meaningful, engaged and joyful life after retirement from active practice.
          </p>
          <div style={{ display: 'grid', gap: '1.25rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            {[
              { Icon: IconHeart, t: 'Wellness circles', d: 'Yoga, walks, health camps and mental wellness sessions.' },
              { Icon: IconUsers, t: 'Mentor a junior', d: 'Structured 6-month mentor pairing with juniors and students.' },
              { Icon: IconSparkles, t: 'Hobby clubs', d: 'Music, theatre, painting, photography — pick your circle.' },
            ].map((p) => (
              <div key={p.t} className="card">
                <div className="icon-tile green"><p.Icon size="lg" /></div>
                <div style={{ marginTop: '.75rem', fontWeight: 600 }}>{p.t}</div>
                <div className="muted-text" style={{ fontSize: '.875rem' }}>{p.d}</div>
              </div>
            ))}
          </div>
        </div>
      }
    />
  );
}
