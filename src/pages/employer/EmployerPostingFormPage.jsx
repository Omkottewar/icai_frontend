import { useEffect, useState } from 'react';
import EmployerLayout from '../../components/employer/EmployerLayout';
import { useRoute, navigate } from '../../hooks/useRoute';
import { useAuth } from '../../context/AuthContext';
import { IconArrowRight, IconX } from '../../icons';
import { ShimmerDrawerBody } from '../../components/ui/Shimmer';
import Button from '../../components/ui/Button';
import { invalidate } from '../../lib/apiCache';
import { openRazorpayCheckout } from '../../lib/razorpayCheckout';

// Posting fees — mirror backend/server/lib/jobPostingFees.ts. Kept here
// (not fetched) because the form needs to show the fee before submit so
// the employer knows what they'll be charged. If the backend fees ever
// change, update both files together.
const POSTING_FEE_RUPEES = {
  job:         1000,
  articleship:  500,
  assignment:  1000,
};

// Location is not on the form — every branch posting defaults to "Nagpur"
// on the server (this is a Nagpur branch portal). If the employer needs to
// note a nearby city (Kamptee, Wardha, etc.) they call it out in the
// description; that keeps the schema simple and the listing tidy.
const EMPTY = {
  type:        'job',
  title:       '',
  description: '',
  seat_count:  1,
  experience_required: '',
  // Salary is captured in rupees on the form (readable) and converted to
  // paise server-side. Both ends optional so a firm can list "up to ₹8L"
  // or "from ₹12L". Period defaults to annual for jobs — matches the
  // per-type fallback the backend uses when period is omitted.
  salary_rupees_min: '',
  salary_rupees_max: '',
  salary_period:     'annual',
  expires_at:  '',
  category_id: '',
};

// Sensible default period keyed by posting type so switching type flips it.
const DEFAULT_PERIOD_BY_TYPE = {
  job:         'annual',
  articleship: 'monthly',
  assignment:  'per_engagement',
};

// Handles both /employer/postings/new and /employer/postings/:id/edit.
// Route is matched against the path pattern in AppShell; here we just look
// at route.path to decide between new vs edit, and the URL pattern uses
// trailing /:id/edit so we slice it out.
export default function EmployerPostingFormPage() {
  const route = useRoute();
  const { showToast } = useAuth();

  const editId = route.path.startsWith('/employer/postings/') && route.path.endsWith('/edit')
    ? route.path.replace('/employer/postings/', '').replace('/edit', '')
    : null;
  const isNew = !editId;

  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [paying, setPaying] = useState(false);
  const [err, setErr] = useState('');
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    fetch('/api/employer/postings/_meta/lookups', { credentials: 'include' })
      .then((r) => r.ok ? r.json() : { categories: [] })
      .then((j) => setCategories(j.categories || []));
  }, []);

  const update = (k, v) => setForm((f) => {
    // When the employer switches posting type, auto-flip the salary period
    // so the "per year / per month" label under the salary inputs matches
    // the audience (jobs = annual, articleship = monthly, etc.). Only
    // overrides if the user hasn't manually touched the period yet — we
    // detect that by checking against the previous default for the prior
    // type. Cheap heuristic; if they picked a matching period on purpose,
    // it flips anyway, but the user can always change it back.
    if (k === 'type' && DEFAULT_PERIOD_BY_TYPE[v] && f.salary_period === DEFAULT_PERIOD_BY_TYPE[f.type]) {
      return { ...f, type: v, salary_period: DEFAULT_PERIOD_BY_TYPE[v] };
    }
    return { ...f, [k]: v };
  });

  // Load existing posting if editing
  useEffect(() => {
    if (isNew) return;
    fetch(`/api/employer/postings/${editId}`, { credentials: 'include' })
      .then((r) => r.ok ? r.json() : Promise.reject(new Error('Posting not found')))
      .then((j) => {
        const p = j.item;
        setForm({
          type:        p.type,
          title:       p.title,
          description: p.description,
          seat_count:  p.seat_count,
          experience_required: p.experience_required ?? '',
          salary_rupees_min: p.salary_paise_min != null ? String(Math.round(p.salary_paise_min / 100)) : '',
          salary_rupees_max: p.salary_paise_max != null ? String(Math.round(p.salary_paise_max / 100)) : '',
          salary_period:     p.salary_period ?? DEFAULT_PERIOD_BY_TYPE[p.type] ?? 'annual',
          expires_at:  p.expires_at ? p.expires_at.slice(0, 10) : '',
          category_id: p.category_id ?? '',
        });
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [editId, isNew]);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setSaving(true);
    try {
      const url    = isNew ? '/api/employer/postings' : `/api/employer/postings/${editId}`;
      const method = isNew ? 'POST' : 'PATCH';
      const r = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? 'Save failed');

      // Bust the postings-list cache so EmployerPostingsPage shows the
      // new/edited row on the very next mount instead of after its 30s TTL.
      invalidate('/api/employer/postings');
      invalidate('/api/employer/me');

      if (isNew && j.payment?.razorpay?.order_id) {
        // New posting goes to Razorpay for the posting-fee payment. The
        // posting is already saved in 'pending_payment' state server-side;
        // on verify success it flips to 'active' + fires alerts to
        // subscribers (see razorpay/confirm.ts).
        showToast?.('Posting saved. Opening secure payment window…', 'info');
        setPaying(true);
        try {
          await openRazorpayCheckout({
            razorpay:    j.payment.razorpay,
            payment_id:  j.payment.payment_id,
            name:        'ICAI Nagpur Branch',
            description: `Posting fee — ${j.item?.title ?? 'Job posting'}`,
            onCancel: () => {
              setPaying(false);
              showToast?.('Payment cancelled. You can retry from "My postings".', 'info');
              navigate('/employer/postings');
            },
          });
          // openRazorpayCheckout handles navigation to /payments/result.
        } catch (payErr) {
          setPaying(false);
          showToast?.(payErr?.message || 'Payment failed. Retry from "My postings".', 'error');
          navigate('/employer/postings');
        }
        return;
      }

      showToast?.(isNew ? 'Posting created' : 'Posting saved', 'success');
      navigate('/employer/postings');
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  const feeRupees = POSTING_FEE_RUPEES[form.type] ?? 0;

  return (
    <EmployerLayout
      title={isNew ? 'New posting' : 'Edit posting'}
      subtitle={isNew ? `Goes live after Razorpay confirms the ₹${feeRupees.toLocaleString('en-IN')} posting fee` : ''}
      actions={
        <button type="button" className="btn btn-ghost" onClick={() => navigate('/employer/postings')}>
          Cancel
        </button>
      }
    >
      {loading && (
        <div className="card" style={{ padding: '1.5rem' }}>
          <ShimmerDrawerBody fields={8} cols={2} />
        </div>
      )}
      {err && <div className="alert alert-error"><IconX size="sm" /> {err}</div>}

      {!loading && (
        <form onSubmit={submit} className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: '1rem' }}>
            <div>
              <label className="field-label">Title *</label>
              <input className="input-base" type="text" value={form.title} required
                onChange={(e) => update('title', e.target.value)}
                placeholder="e.g. Senior Auditor — 3+ years experience" maxLength={200} />
            </div>
            <div>
              <label className="field-label">Type *</label>
              <select className="input-base" value={form.type} onChange={(e) => update('type', e.target.value)}>
                <option value="job">Job</option>
                <option value="articleship">Articleship</option>
                <option value="assignment">Assignment</option>
              </select>
            </div>
          </div>

          <div>
            <label className="field-label">Description *</label>
            <textarea className="input-base" rows={8} value={form.description} required
              onChange={(e) => update('description', e.target.value)}
              placeholder="Responsibilities, qualifications, what the candidate will do day-to-day…" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
            <div>
              <label className="field-label">Seats</label>
              <input className="input-base" type="number" min={1} max={50} value={form.seat_count}
                onChange={(e) => update('seat_count', Math.max(1, Number(e.target.value)))} />
            </div>
            <div>
              <label className="field-label">Experience</label>
              <input className="input-base" type="text" value={form.experience_required}
                onChange={(e) => update('experience_required', e.target.value)} placeholder="e.g. 3–5 years" />
            </div>
          </div>

          <div>
            <label className="field-label">
              Salary / stipend range <span className="muted-text" style={{ fontWeight: 400 }}>(₹, optional)</span>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 180px', gap: '.5rem' }}>
              <input
                className="input-base"
                type="number"
                min={0}
                inputMode="numeric"
                value={form.salary_rupees_min}
                onChange={(e) => update('salary_rupees_min', e.target.value)}
                placeholder="Min (e.g. 800000)"
              />
              <input
                className="input-base"
                type="number"
                min={0}
                inputMode="numeric"
                value={form.salary_rupees_max}
                onChange={(e) => update('salary_rupees_max', e.target.value)}
                placeholder="Max (e.g. 1200000)"
              />
              <select
                className="input-base"
                value={form.salary_period}
                onChange={(e) => update('salary_period', e.target.value)}
              >
                <option value="monthly">per month</option>
                <option value="annual">per year</option>
                <option value="per_engagement">per engagement</option>
              </select>
            </div>
            <p className="muted-text" style={{ fontSize: '.75rem', marginTop: '.25rem' }}>
              Members see this on the listing. Leave either end blank for open-ended ranges (e.g. "from ₹8L" or "up to ₹12L"). Skip entirely if you'd rather discuss on enquiry.
            </p>
          </div>

          <div>
            <label className="field-label">Category</label>
            <select className="input-base" value={form.category_id} onChange={(e) => update('category_id', e.target.value)}>
              <option value="">— pick a category (optional but recommended) —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <p className="muted-text" style={{ fontSize: '.75rem', marginTop: '.25rem' }}>
              Subscribers to this category will be alerted when the posting goes live.
            </p>
          </div>

          <div>
            <label className="field-label">Expires on (optional)</label>
            <input className="input-base" type="date" value={form.expires_at}
              onChange={(e) => update('expires_at', e.target.value)} />
            <p className="muted-text" style={{ fontSize: '.75rem', marginTop: '.25rem' }}>
              Leave blank to keep the posting active until you close it.
            </p>
          </div>

          {isNew && (
            <div style={{
              background: 'oklch(0.97 0.03 220)', border: '1px dashed oklch(0.75 0.1 220)',
              borderRadius: '.5rem', padding: '.75rem 1rem',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              fontSize: '.85rem',
            }}>
              <div>
                <div style={{ fontWeight: 600 }}>Posting fee</div>
                <div className="muted-text" style={{ fontSize: '.75rem' }}>
                  Paid once per posting. Secure payment via Razorpay — cards, UPI, netbanking, wallets.
                </div>
              </div>
              <div style={{ fontSize: '1.125rem', fontWeight: 700 }}>
                ₹{feeRupees.toLocaleString('en-IN')}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '.5rem', justifyContent: 'flex-end', marginTop: '.5rem' }}>
            <button type="button" className="btn btn-ghost" onClick={() => navigate('/employer/postings')}>Cancel</button>
            <Button type="submit" className="btn btn-primary" loading={saving || paying}>
              {paying ? 'Opening Razorpay…' : saving ? 'Saving…' : (
                <>{isNew ? `Continue to pay ₹${feeRupees.toLocaleString('en-IN')}` : 'Save'} <IconArrowRight size="sm" /></>
              )}
            </Button>
          </div>
        </form>
      )}
    </EmployerLayout>
  );
}
