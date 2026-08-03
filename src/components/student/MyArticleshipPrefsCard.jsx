import { useEffect, useState } from 'react';
import { cachedGet, apiWrite, invalidate, subscribe } from '../../lib/apiCache';
import { toast } from '../../lib/notify';
import { dialog } from '../../lib/dialog';
import { IconBriefcase, IconArrowRight } from '../../icons';

// Full detail view of the student's most recent articleship-preferences
// submission. StudentRequestsCard already shows a one-line summary in the
// mixed list; this card is the dedicated view so the student can see and
// verify everything they submitted (specialisations, firm size, stipend,
// CV attachment, WICASA's recommended firms, etc.) without opening the
// modal to re-submit.
//
// Displays the latest row from /api/articleship-matches/my. If the
// student has multiple submissions (rare — usually one per seminar),
// older ones are still visible via StudentRequestsCard's list.

const FIRM_SIZE_LABEL = {
  sole_practitioner: 'Sole practitioner',
  small:             'Small firm (2–10 CAs)',
  medium:            'Mid-size firm (10–50 CAs)',
  large:             'Large firm (50+ CAs)',
  big4:              'Big 4',
};

const STATUS_PALETTE = {
  submitted: { bg: 'oklch(0.90 0.10 90)',  fg: 'oklch(0.35 0.15 60)' },
  matched:   { bg: 'oklch(0.90 0.10 250)', fg: 'oklch(0.35 0.13 250)' },
  placed:    { bg: 'oklch(0.90 0.10 145)', fg: 'oklch(0.35 0.14 145)' },
  cancelled: { bg: 'oklch(0.94 0 0)',      fg: 'oklch(0.45 0 0)' },
};

function fmtStipend(paise) {
  if (paise == null) return null;
  const rupees = Math.round(Number(paise) / 100);
  if (!Number.isFinite(rupees)) return null;
  return `₹${rupees.toLocaleString('en-IN')}/month`;
}

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-IN', { dateStyle: 'medium' });
}

export default function MyArticleshipPrefsCard() {
  const [rows, setRows] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      cachedGet('/api/articleship-matches/my', null, 30_000)
        .then((j) => { if (!cancelled) setRows(j?.rows || []); })
        .catch(() => { if (!cancelled) setRows([]); });
    };
    load();
    const unsub = subscribe('/api/articleship-matches/my', load);
    return () => { cancelled = true; unsub(); };
  }, []);

  if (rows === null) {
    return (
      <div className="card">
        <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Articleship preferences</h2>
        <p className="muted-text" style={{ fontSize: '.875rem', marginTop: '.75rem' }}>Loading…</p>
      </div>
    );
  }

  const latest = rows[0];

  if (!latest) {
    return (
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Articleship preferences</h2>
          <a href="/students#actions" className="btn btn-outline" style={{ fontSize: '.8rem', padding: '.35rem .75rem' }}>
            <IconBriefcase size="sm" /> Submit preferences
          </a>
        </div>
        <p className="muted-text" style={{ fontSize: '.875rem', marginTop: '.75rem' }}>
          You haven't submitted articleship preferences yet. WICASA uses these to shortlist
          member firms that match your interests.
        </p>
      </div>
    );
  }

  const specs = Array.isArray(latest.preferred_specialisations) ? latest.preferred_specialisations : [];
  const firmSizeLabel = latest.preferred_firm_size ? FIRM_SIZE_LABEL[latest.preferred_firm_size] : null;
  const stipendLabel = fmtStipend(latest.expected_stipend_paise);
  const palette = STATUS_PALETTE[latest.status] || STATUS_PALETTE.submitted;
  const canCancel = latest.status === 'submitted';
  const recommendedFirms = Array.isArray(latest.recommended_firms) ? latest.recommended_firms : [];
  const canFinalise = latest.status === 'matched'
    && !latest.student_confirmed_at
    && !latest.student_declined_at
    && recommendedFirms.length > 0;

  async function cancel() {
    try {
      await apiWrite(`/api/articleship-matches/${latest.id}/cancel`, { method: 'POST' });
      invalidate('/api/articleship-matches/my');
      toast.success('Articleship request cancelled');
    } catch (err) {
      toast.error(err?.message || 'Could not cancel — try again in a bit.');
    }
  }

  async function confirmPlacement(firm) {
    const ok = await dialog.confirm({
      title: `Confirm you've joined ${firm.name}?`,
      message: 'This tells WICASA you accepted this firm\'s offer. Only mark this after you\'ve actually signed on — the record is used for placement tracking.',
      confirmText: 'Yes, I\'ve joined',
    });
    if (!ok) return;
    try {
      await apiWrite(`/api/articleship-matches/${latest.id}/confirm-placement`, {
        method: 'POST',
        body: { firm_id: firm.id },
      });
      invalidate('/api/articleship-matches/my');
      toast.success('Placement recorded. Congrats!');
    } catch (err) {
      toast.error(err?.message || 'Could not record placement — try again shortly.');
    }
  }

  async function declineShortlist() {
    const ok = await dialog.confirm({
      title: 'None of the shortlisted firms worked?',
      message: 'WICASA will see this so they can revise the shortlist. Your submission stays open.',
      confirmText: 'Yes, decline shortlist',
    });
    if (!ok) return;
    try {
      await apiWrite(`/api/articleship-matches/${latest.id}/decline-shortlist`, { method: 'POST' });
      invalidate('/api/articleship-matches/my');
      toast.success('Feedback sent to WICASA');
    } catch (err) {
      toast.error(err?.message || 'Could not update — try again shortly.');
    }
  }

  return (
    <div className="card" id="articleship">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: '.75rem' }}>
        <div className="row gap-2" style={{ alignItems: 'center' }}>
          <span className="icon-tile green" style={{ width: '2rem', height: '2rem', padding: '.3rem' }}>
            <IconBriefcase size="sm" />
          </span>
          <div>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, margin: 0 }}>Articleship preferences</h2>
            <div className="muted-text" style={{ fontSize: '.7rem', marginTop: '.15rem' }}>
              Submitted {fmtDate(latest.created_at)}
            </div>
          </div>
        </div>
        <span className="badge" style={{
          background: palette.bg, color: palette.fg,
          fontSize: '.7rem', padding: '.2rem .55rem', borderRadius: 999,
          textTransform: 'capitalize',
        }}>{latest.status.replace(/_/g, ' ')}</span>
      </div>

      {/* Specialisations */}
      {specs.length > 0 && (
        <div style={{ marginTop: '.9rem' }}>
          <div className="ap-label">Areas of interest</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.35rem', marginTop: '.3rem' }}>
            {specs.map((s) => (
              <span key={s} className="ap-chip">{s}</span>
            ))}
          </div>
        </div>
      )}

      {/* Two-column detail grid */}
      <div style={{
        marginTop: '.9rem',
        display: 'grid',
        gap: '.6rem',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
      }}>
        {firmSizeLabel && (
          <div>
            <div className="ap-label">Firm size</div>
            <div className="ap-value">{firmSizeLabel}</div>
          </div>
        )}
        {stipendLabel && (
          <div>
            <div className="ap-label">Expected stipend</div>
            <div className="ap-value">{stipendLabel}</div>
          </div>
        )}
        <div>
          <div className="ap-label">CV / résumé</div>
          <div className="ap-value">{latest.cv_file_id ? 'Attached ✓' : 'Not attached'}</div>
        </div>
      </div>

      {/* Notes */}
      {latest.notes && (
        <div style={{ marginTop: '.9rem' }}>
          <div className="ap-label">Notes to WICASA</div>
          <p className="ap-value" style={{ marginTop: '.2rem', whiteSpace: 'pre-wrap' }}>{latest.notes}</p>
        </div>
      )}

      {/* WICASA response — shortlist with contact details + accept / decline
          actions. Once the student confirms or declines, the buttons are
          replaced by an outcome badge. */}
      {latest.status === 'matched' && recommendedFirms.length > 0 && (
        <div style={{ marginTop: '.9rem' }}>
          <div className="ap-label">WICASA shortlisted these firms</div>
          <div style={{ marginTop: '.35rem', display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
            {recommendedFirms.map((f) => (
              <div key={f.id} style={{
                padding: '.55rem .7rem',
                background: 'oklch(0.96 0.03 250 / .6)',
                border: '1px solid oklch(0.82 0.06 250 / .4)',
                borderRadius: '.4rem',
                display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '.5rem',
                alignItems: 'center',
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '.88rem', fontWeight: 600 }}>{f.name}</div>
                  <div className="muted-text" style={{ fontSize: '.72rem' }}>
                    {[f.city, f.phone, f.email].filter(Boolean).join(' · ') || 'Contact the branch office for details'}
                  </div>
                </div>
                {canFinalise && (
                  <button
                    type="button"
                    onClick={() => confirmPlacement(f)}
                    className="btn btn-primary"
                    style={{ padding: '.3rem .7rem', fontSize: '.72rem', whiteSpace: 'nowrap' }}
                    title="I've accepted this firm's offer"
                  >
                    I joined this firm
                  </button>
                )}
              </div>
            ))}
          </div>
          {canFinalise && (
            <div style={{ marginTop: '.5rem' }}>
              <button
                type="button"
                onClick={declineShortlist}
                className="btn btn-outline"
                style={{ fontSize: '.72rem', padding: '.3rem .7rem', color: '#991b1b' }}
              >
                None of these worked — let WICASA know
              </button>
            </div>
          )}
          {latest.student_declined_at && (
            <div className="muted-text" style={{ fontSize: '.75rem', marginTop: '.5rem', fontStyle: 'italic' }}>
              You told WICASA the shortlist didn't work. They'll revise and get back to you.
            </div>
          )}
        </div>
      )}

      {/* Placed outcome — set either by student (self-confirm) or WICASA. */}
      {latest.status === 'placed' && (
        <div style={{
          marginTop: '.9rem', padding: '.6rem .8rem',
          background: 'oklch(0.94 0.10 145 / .5)',
          border: '1px solid oklch(0.65 0.14 145 / .35)',
          borderRadius: '.4rem', fontSize: '.85rem',
        }}>
          🎉 <strong>Placed.</strong> WICASA has recorded your placement. All the best for articleship!
        </div>
      )}

      {/* Actions */}
      <div className="row gap-2" style={{ marginTop: '.9rem', flexWrap: 'wrap' }}>
        <a href="/job-vacancies?type=articleship" className="btn btn-outline" style={{ fontSize: '.8rem', padding: '.4rem .75rem' }}>
          Browse openings <IconArrowRight size="sm" />
        </a>
        {canCancel && (
          <button
            type="button"
            onClick={cancel}
            className="btn btn-outline"
            style={{ fontSize: '.8rem', padding: '.4rem .75rem', color: 'var(--destructive)', borderColor: 'oklch(0.577 0.245 27.325 / 0.3)' }}
            title="Withdraw this submission"
          >
            Withdraw
          </button>
        )}
      </div>

      <style>{`
        .ap-label {
          font-size: .65rem;
          text-transform: uppercase;
          letter-spacing: .06em;
          font-weight: 700;
          color: var(--muted-foreground);
        }
        .ap-value {
          font-size: .85rem;
          font-weight: 500;
          margin-top: .15rem;
          color: var(--foreground);
        }
        .ap-chip {
          display: inline-flex;
          align-items: center;
          font-size: .72rem;
          padding: .2rem .55rem;
          background: oklch(0.55 0.14 155 / 0.12);
          color: var(--secondary);
          border-radius: 999px;
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}
