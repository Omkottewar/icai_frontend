import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import GenericPage from '../components/ui/GenericPage';
import { useLang } from '../context/LanguageContext';
import { IconHandshake, IconArrowRight } from '../icons';

export default function BenevolentFundPage() {
  const { t } = useLang();
  const [amount, setAmount] = useState('');
  const { showToast } = useAuth();

  return (
    <GenericPage
      title={t('ui.benevolent.page_title', 'CA Benevolent Fund')}
      subtitle={t('ui.benevolent.page_subtitle', 'Financial relief for members and their families in distress.')}
      body={
        <div style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          <div className="card">
            <div className="icon-tile green"><IconHandshake size="lg" /></div>
            <h3 style={{ marginTop: '.75rem', fontWeight: 600 }}>{t('ui.benevolent.about_heading', 'About CABF')}</h3>
            <p className="muted-text" style={{ marginTop: '.5rem', fontSize: '.875rem' }}>
              {t('ui.benevolent.about_desc', 'The Chartered Accountants Benevolent Fund (CABF) provides financial assistance to members and their dependents in case of distress, illness or untimely demise.')}
            </p>
          </div>
          <div className="card">
            <h3 style={{ fontWeight: 600 }}>{t('ui.benevolent.contribute_heading', 'Contribute')}</h3>
            <p className="muted-text" style={{ marginTop: '.25rem', fontSize: '.875rem' }}>
              {t('ui.benevolent.contribute_desc', 'Contributions are eligible for deduction under Section 80G.')}
            </p>
            <div className="row gap-2" style={{ marginTop: '1rem', flexWrap: 'wrap' }}>
              {['₹501', '₹1,001', '₹5,001', '₹11,001'].map((a) => (
                <button
                  key={a}
                  onClick={() => setAmount(a)}
                  className={'btn ' + (amount === a ? 'btn-primary' : 'btn-outline')}
                >{a}</button>
              ))}
            </div>
            <div style={{ marginTop: '.75rem' }}>
              <input
                className="input-base"
                placeholder={t('ui.benevolent.custom_amount', 'Or enter custom amount (₹)')}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <button
              onClick={() => showToast('Demo: contribution flow stubbed')}
              className="btn btn-primary"
              style={{ marginTop: '1rem', width: '100%', justifyContent: 'center' }}
            >
              {t('ui.benevolent.contribute_btn', 'Contribute now')} <IconArrowRight size="sm" />
            </button>
          </div>
        </div>
      }
    />
  );
}
