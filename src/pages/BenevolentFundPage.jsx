import GenericPage from '../components/ui/GenericPage';
import { IconHandshake, IconArrowRight } from '../icons';

// CABF online contribution is administered by ICAI HQ (CABF Trust). The
// branch portal does not collect contributions directly — the Razorpay
// integration for branch fees / event payments is separate. Until ICAI's
// own donation flow is linked from here, this page surfaces the fund's
// purpose, the indicative slabs, and a clear "contact the branch /
// ICAI HQ" path so members aren't dead-ended on a debug toast.
export default function BenevolentFundPage() {
  return (
    <GenericPage
      title="CA Benevolent Fund"
      subtitle="Financial relief for members and their families in distress."
      body={
        <div style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          <div className="card">
            <div className="icon-tile green"><IconHandshake size="lg" /></div>
            <h3 style={{ marginTop: '.75rem', fontWeight: 600 }}>About CABF</h3>
            <p className="muted-text" style={{ marginTop: '.5rem', fontSize: '.875rem' }}>
              The Chartered Accountants Benevolent Fund (CABF) provides financial assistance to members and
              their dependents in case of distress, illness or untimely demise. The fund is administered by the
              ICAI Head Office; the Nagpur branch facilitates contributions and disbursement requests.
            </p>
          </div>
          <div className="card">
            <h3 style={{ fontWeight: 600 }}>Contribute</h3>
            <p className="muted-text" style={{ marginTop: '.25rem', fontSize: '.875rem' }}>
              Contributions are eligible for deduction under Section 80G. Suggested slabs:
            </p>
            <div className="row gap-2" style={{ marginTop: '.75rem', flexWrap: 'wrap' }}>
              {['₹501', '₹1,001', '₹5,001', '₹11,001'].map((a) => (
                <span key={a} className="badge" style={{ padding: '.35rem .7rem', background: 'var(--muted)', color: 'var(--foreground)', fontWeight: 600 }}>{a}</span>
              ))}
            </div>
            <div style={{
              marginTop: '1.1rem', padding: '.75rem .9rem',
              background: 'oklch(0.95 0.05 90)',
              border: '1px solid oklch(0.85 0.08 90)',
              borderRadius: '.4rem', fontSize: '.8125rem', lineHeight: 1.5,
            }}>
              <strong>Online contributions open soon.</strong>{' '}
              In the meantime, contribute via the official ICAI CABF portal or contact the Nagpur branch directly.
            </div>
            <div className="col gap-2" style={{ marginTop: '.75rem' }}>
              <a
                href="https://www.icai.org/post/cabf"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
                style={{ justifyContent: 'center' }}
              >
                ICAI CABF (HQ) ↗ <IconArrowRight size="sm" />
              </a>
              <a
                href="#/contact"
                className="btn btn-outline"
                style={{ justifyContent: 'center' }}
              >
                Contact Nagpur Branch
              </a>
            </div>
          </div>
        </div>
      }
    />
  );
}
