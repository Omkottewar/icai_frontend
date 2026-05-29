import GenericPage from '../components/ui/GenericPage';

export default function InvestorAwarenessPage() {
  return (
    <GenericPage
      title="Investor Awareness"
      subtitle="Free programmes promoting financial literacy and safe investing."
      body={
        <div className="col gap-5">
          <p className="muted-text" style={{ lineHeight: 1.6 }}>
            The branch conducts public investor awareness programmes in association with regulators and industry
            bodies to promote financial literacy, safe investing, fraud awareness and basic personal finance for
            students, salaried individuals and senior citizens.
          </p>
          <div className="card">
            <h3 style={{ fontWeight: 600 }}>Upcoming sessions</h3>
            <ul className="col gap-3" style={{ marginTop: '.75rem', padding: 0, listStyle: 'none' }}>
              {[
                { t: 'Financial Planning for Young Professionals', d: '12 May · ICAI Bhawan' },
                { t: 'Beware of Online Investment Frauds', d: '19 May · Online' },
                { t: "Senior Citizens' Money Health", d: '26 May · Chitnavis Centre' },
              ].map((s) => (
                <li key={s.t} className="row" style={{ justifyContent: 'space-between', padding: '.75rem 0', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '.875rem' }}>{s.t}</div>
                    <div className="muted-text" style={{ fontSize: '.75rem' }}>{s.d}</div>
                  </div>
                  <button className="btn btn-outline" style={{ padding: '.4rem .9rem' }}>Reserve</button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      }
    />
  );
}
