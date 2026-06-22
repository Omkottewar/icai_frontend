import { useEffect, useMemo, useState } from 'react';
import Drawer from '../admin/Drawer';
import { useAuth } from '../../context/AuthContext';
import { apiWrite, invalidate } from '../../lib/apiCache';
import { IconX, IconCheck, IconPlus, IconShield } from '../../icons';

// Profile editor for the current Member. Reads its initial state from the
// dashboard payload (passed in as `profile`) and PATCHes
// /api/members/profile on save. The editable surface is everything we
// store locally — ICAI-owned fields (MRN, FCA status, COP, member-since)
// are surfaced read-only with a hint that they update via ICAI sync.
//
// On save we invalidate the dashboard cache so the rest of the page
// (identity card, services, suggestions) reflects the new state without
// requiring a page reload.

// Suggested areas-of-practice chips. The user can free-text any tag too;
// this is just a starter set tuned to the committees we have.
const AREA_SUGGESTIONS = [
  'GST', 'Direct Tax', 'Audit', 'IT', 'CPE', 'WICASA',
  'FEMA', 'Internal Audit', 'NCLT & Corporate Law', 'Forensic',
  'Indirect Tax', 'Banking & Insurance',
];

const GENDERS = [
  { value: 'unspecified', label: 'Prefer not to say' },
  { value: 'male',        label: 'Male' },
  { value: 'female',      label: 'Female' },
  { value: 'other',       label: 'Other' },
];

export default function MemberProfileDrawer({ open, onClose, profile, userPhone, onSaved }) {
  const { showToast } = useAuth();

  // Form state initialised from the dashboard payload each time the drawer
  // opens. We deliberately copy rather than refer so the user can cancel
  // their edits cleanly.
  const initial = useMemo(() => ({
    phone: userPhone ?? '',
    gender: profile?.gender || 'unspecified',
    is_practising: !!profile?.is_practising,
    address: profile?.address ?? '',
    city: profile?.city ?? '',
    pincode: profile?.pincode ?? '',
    areas_of_practice: Array.isArray(profile?.areas_of_practice) ? [...profile.areas_of_practice] : [],
  }), [profile, userPhone]);

  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [areaInput, setAreaInput] = useState('');

  // Reset whenever the drawer reopens with potentially new data.
  useEffect(() => {
    if (open) {
      setForm(initial);
      setError('');
      setAreaInput('');
    }
  }, [open, initial]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const addArea = (raw) => {
    const t = (raw ?? areaInput).trim();
    if (!t) return;
    const exists = form.areas_of_practice.some((a) => a.toLowerCase() === t.toLowerCase());
    if (exists) { setAreaInput(''); return; }
    if (form.areas_of_practice.length >= 12) {
      setError('Up to 12 areas of practice');
      return;
    }
    set('areas_of_practice', [...form.areas_of_practice, t]);
    setAreaInput('');
  };
  const removeArea = (i) => set('areas_of_practice', form.areas_of_practice.filter((_, idx) => idx !== i));

  const onSave = async () => {
    setSaving(true);
    setError('');
    try {
      const body = {
        phone: form.phone || null,
        gender: form.gender,
        is_practising: !!form.is_practising,
        address: form.address || null,
        city: form.city || null,
        pincode: form.pincode || null,
        areas_of_practice: form.areas_of_practice,
      };
      const j = await apiWrite('/api/members/profile', {
        method: 'PATCH',
        body,
        // Bust every dashboard read so the page refetches.
        invalidates: ['/api/dashboard'],
      });
      // Also clear caches for downstream lookups that may surface the
      // new fields (members directory, etc.).
      invalidate('/api/members');
      showToast?.('Profile updated', 'success');
      onSaved?.(j.profile);
      onClose?.();
    } catch (err) {
      setError(err.message || 'Could not save profile');
    } finally {
      setSaving(false);
    }
  };

  // ICAI-owned read-only fields shown at the top for context.
  const mrn        = profile?.mrn || '—';
  const fcaLabel   = profile?.is_fca ? 'FCA' : 'ACA';
  const copStatus  = profile?.cop_status && profile.cop_status !== 'none' ? profile.cop_status : 'None';
  const copNumber  = profile?.cop_number || null;
  const memberSince = profile?.member_since
    ? new Date(profile.member_since).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: '2-digit' })
    : '—';

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Edit profile"
      width={620}
      footer={
        <>
          {error && (
            <span style={{ color: 'var(--destructive)', marginRight: 'auto', fontSize: '.85rem' }}>{error}</span>
          )}
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={onSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </>
      }
    >
      <div className="mpd">
        {/* ── Read-only ICAI fields ───────────────────────────── */}
        <section className="mpd-readonly">
          <div className="mpd-readonly-head">
            <IconShield size="sm" />
            <div>
              <div className="mpd-readonly-title">From ICAI records</div>
              <div className="mpd-readonly-sub">These fields update via your ICAI account — edit on the official portal.</div>
            </div>
          </div>
          <div className="mpd-readonly-grid">
            <ReadField label="Membership No." value={mrn} mono />
            <ReadField label="Status"          value={fcaLabel} />
            <ReadField label="COP status"      value={copStatus + (copNumber ? ` · ${copNumber}` : '')} />
            <ReadField label="Member since"    value={memberSince} />
          </div>
        </section>

        {/* ── Editable contact ────────────────────────────────── */}
        <Section title="Contact">
          <Field label="Phone" hint="Include the country code if international (e.g. +91 98765 43210).">
            <input
              type="tel"
              className="input-base"
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
              placeholder="+91 98765 43210"
              maxLength={20}
            />
          </Field>
          <Field label="Address" hint="Building / street / locality.">
            <textarea
              className="input-base"
              value={form.address}
              onChange={(e) => set('address', e.target.value)}
              rows={2}
              maxLength={400}
            />
          </Field>
          <div className="mpd-row-2">
            <Field label="City">
              <input className="input-base" value={form.city} onChange={(e) => set('city', e.target.value)} maxLength={80} />
            </Field>
            <Field label="Pincode">
              <input
                className="input-base"
                value={form.pincode}
                onChange={(e) => set('pincode', e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                maxLength={6}
                placeholder="440010"
              />
            </Field>
          </div>
        </Section>

        {/* ── Practice details ────────────────────────────────── */}
        <Section title="Practice">
          <div className="mpd-row-2">
            <Field label="Gender">
              <select className="input-base" value={form.gender} onChange={(e) => set('gender', e.target.value)}>
                {GENDERS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
              </select>
            </Field>
            <Field label="Currently practising?">
              <label className="mpd-toggle">
                <input
                  type="checkbox"
                  checked={form.is_practising}
                  onChange={(e) => set('is_practising', e.target.checked)}
                />
                <span>Yes, I am in practice</span>
              </label>
            </Field>
          </div>

          <Field
            label="Areas of practice"
            hint="Tags help us recommend relevant events. Up to 12."
          >
            <div className="mpd-area-row">
              {form.areas_of_practice.map((a, i) => (
                <span key={a + i} className="mpd-area-chip">
                  {a}
                  <button type="button" onClick={() => removeArea(i)} aria-label={`Remove ${a}`}>
                    <IconX size="sm" />
                  </button>
                </span>
              ))}
              <div className="mpd-area-input-wrap">
                <input
                  type="text"
                  className="mpd-area-input"
                  value={areaInput}
                  onChange={(e) => setAreaInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addArea(); }
                    else if (e.key === 'Backspace' && !areaInput && form.areas_of_practice.length > 0) {
                      removeArea(form.areas_of_practice.length - 1);
                    }
                  }}
                  placeholder={form.areas_of_practice.length === 0 ? 'Type and press Enter…' : 'Add another…'}
                  maxLength={60}
                />
                {areaInput.trim() && (
                  <button type="button" className="mpd-area-add" onClick={() => addArea()} title="Add">
                    <IconPlus size="sm" />
                  </button>
                )}
              </div>
            </div>

            {/* Suggestion chips — quick way to seed common areas. */}
            <div className="mpd-area-suggestions">
              {AREA_SUGGESTIONS
                .filter((s) => !form.areas_of_practice.some((a) => a.toLowerCase() === s.toLowerCase()))
                .slice(0, 8)
                .map((s) => (
                  <button key={s} type="button" className="mpd-area-suggest" onClick={() => addArea(s)}>
                    <IconPlus size="sm" /> {s}
                  </button>
                ))}
            </div>
          </Field>
        </Section>
      </div>

      <style>{`
        .mpd { display: flex; flex-direction: column; gap: 1.25rem; }
        .mpd-readonly {
          background: oklch(0.36 0.13 255 / .05);
          border: 1px solid oklch(0.36 0.13 255 / .15);
          border-radius: 10px; padding: .85rem 1rem;
        }
        .mpd-readonly-head { display: flex; gap: .55rem; align-items: flex-start; color: var(--primary); }
        .mpd-readonly-head > svg { flex-shrink: 0; margin-top: .15rem; }
        .mpd-readonly-title { font-size: .85rem; font-weight: 700; }
        .mpd-readonly-sub { font-size: .72rem; color: var(--muted-foreground); margin-top: .1rem; }
        .mpd-readonly-grid {
          margin-top: .65rem;
          display: grid; gap: .5rem;
          grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
        }
        .mpd-read-label {
          font-size: .62rem; font-weight: 700; text-transform: uppercase;
          letter-spacing: .06em; color: var(--muted-foreground);
        }
        .mpd-read-value { font-size: .88rem; font-weight: 600; margin-top: .15rem; color: var(--foreground); }
        .mpd-read-value-mono { font-family: ui-monospace, Menlo, monospace; font-size: .82rem; }

        .mpd-section-title {
          font-size: .7rem; font-weight: 700; letter-spacing: .08em;
          text-transform: uppercase; color: var(--muted-foreground);
          margin: 0 0 .65rem;
        }

        .mpd-field { display: flex; flex-direction: column; gap: .3rem; }
        .mpd-field-label { font-size: .8rem; font-weight: 600; color: var(--foreground); }
        .mpd-field-hint  { font-size: .72rem; color: var(--muted-foreground); }

        .mpd-row-2 {
          display: grid; gap: .75rem;
          grid-template-columns: 1fr;
        }
        @media (min-width: 540px) {
          .mpd-row-2 { grid-template-columns: 1fr 1fr; }
        }

        .mpd-toggle {
          display: inline-flex; align-items: center; gap: .5rem;
          padding: .5rem .65rem; border: 1px solid var(--border);
          border-radius: 8px; cursor: pointer; font-size: .85rem;
          background: var(--background);
        }
        .mpd-toggle input { accent-color: var(--primary); }

        /* ── Areas of practice — chip input ──────────────────────── */
        .mpd-area-row {
          display: flex; flex-wrap: wrap; gap: .35rem;
          padding: .4rem .45rem; min-height: 2.5rem;
          border: 1px solid var(--border);
          border-radius: 8px; background: var(--background);
        }
        .mpd-area-row:focus-within { border-color: var(--primary); box-shadow: 0 0 0 2px oklch(0.36 0.13 255 / .12); }
        .mpd-area-chip {
          display: inline-flex; align-items: center; gap: .3rem;
          padding: .2rem .4rem .2rem .55rem;
          background: oklch(0.36 0.13 255 / .10);
          color: var(--primary);
          border-radius: 999px; font-size: .75rem; font-weight: 600;
        }
        .mpd-area-chip > button {
          background: transparent; border: none; padding: 0;
          color: inherit; opacity: .65; cursor: pointer;
          display: grid; place-items: center;
        }
        .mpd-area-chip > button:hover { opacity: 1; }
        .mpd-area-input-wrap {
          display: flex; flex: 1; min-width: 8rem;
          align-items: center; gap: .25rem;
        }
        .mpd-area-input {
          flex: 1; min-width: 0;
          background: transparent; border: none; outline: none;
          font-size: .85rem; padding: .15rem .15rem;
        }
        .mpd-area-add {
          background: var(--primary); color: white; border: none;
          width: 1.6rem; height: 1.6rem; border-radius: 6px;
          display: grid; place-items: center; cursor: pointer;
        }

        .mpd-area-suggestions {
          margin-top: .5rem;
          display: flex; flex-wrap: wrap; gap: .3rem;
        }
        .mpd-area-suggest {
          display: inline-flex; align-items: center; gap: .25rem;
          padding: .25rem .55rem;
          background: var(--background); border: 1px dashed var(--border);
          color: var(--muted-foreground); font-size: .72rem; font-weight: 600;
          border-radius: 999px; cursor: pointer;
        }
        .mpd-area-suggest:hover {
          color: var(--primary); border-color: var(--primary);
          background: oklch(0.36 0.13 255 / .06);
        }
      `}</style>
    </Drawer>
  );
}

function Section({ title, children }) {
  return (
    <section>
      <h3 className="mpd-section-title">{title}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>{children}</div>
    </section>
  );
}

function Field({ label, hint, children }) {
  return (
    <label className="mpd-field">
      <span className="mpd-field-label">{label}</span>
      {children}
      {hint && <span className="mpd-field-hint">{hint}</span>}
    </label>
  );
}

function ReadField({ label, value, mono }) {
  return (
    <div>
      <div className="mpd-read-label">{label}</div>
      <div className={'mpd-read-value' + (mono ? ' mpd-read-value-mono' : '')}>{value}</div>
    </div>
  );
}
