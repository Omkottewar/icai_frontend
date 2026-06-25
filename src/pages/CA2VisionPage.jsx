import GenericPage from '../components/ui/GenericPage';
import { useLang } from '../context/LanguageContext';
import { IconHeart, IconUsers, IconSparkles } from '../icons';

export default function CA2VisionPage() {
  const { t } = useLang();

  const FEATURES = [
    { Icon: IconHeart,    key: 'wellness', title: t('ui.ca2.wellness_title', 'Wellness circles'), desc: t('ui.ca2.wellness_desc', 'Yoga, walks, health camps and mental wellness sessions.') },
    { Icon: IconUsers,    key: 'mentor',   title: t('ui.ca2.mentor_title',   'Mentor a junior'),  desc: t('ui.ca2.mentor_desc',   'Structured 6-month mentor pairing with juniors and students.') },
    { Icon: IconSparkles, key: 'hobbies',  title: t('ui.ca2.hobbies_title',  'Hobby clubs'),      desc: t('ui.ca2.hobbies_desc',  'Music, theatre, painting, photography — pick your circle.') },
  ];

  return (
    <GenericPage
      title={t('ui.ca2.page_title', 'CA 2.0 — Life After Office')}
      subtitle={t('ui.ca2.page_subtitle', 'A meaningful second innings for senior CAs')}
      body={
        <div className="col gap-5">
          <p className="muted-text" style={{ lineHeight: 1.6 }}>
            {t('ui.ca2.body', 'CA 2.0 is the Nagpur Branch\'s flagship vision for senior chartered accountants — a community programme that combines wellness, mentorship and hobby circles, ensuring that veterans of the profession continue to live a meaningful, engaged and joyful life after retirement from active practice.')}
          </p>
          <div style={{ display: 'grid', gap: '1.25rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            {FEATURES.map((f) => (
              <div key={f.key} className="card">
                <div className="icon-tile green"><f.Icon size="lg" /></div>
                <div style={{ marginTop: '.75rem', fontWeight: 600 }}>{f.title}</div>
                <div className="muted-text" style={{ fontSize: '.875rem' }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      }
    />
  );
}
