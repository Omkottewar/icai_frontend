import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import FormField from '../../components/admin/FormField';
import { adminFetch } from '../../hooks/useAdminList';
import { invalidate } from '../../lib/apiCache';
import { useAuth } from '../../context/AuthContext';
import { SITE_SETTINGS } from '../../lib/siteContentSlots';
import { SITE_SETTINGS_DEFAULTS } from '../../hooks/useSiteSettings';
import { ShimmerDrawerBody } from '../../components/ui/Shimmer';
import Button from '../../components/ui/Button';

// Group definitions in declaration order so the form is stable as keys are
// added. SITE_SETTINGS already encodes the group per key.
function groupSettings() {
  const groups = {};
  for (const def of SITE_SETTINGS) {
    (groups[def.group] ||= []).push(def);
  }
  return groups;
}

export default function SiteSettingsAdminPage() {
  const { showToast } = useAuth();
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const groups = groupSettings();

  // Load current settings; merge with defaults so empty rows still show
  // the baseline value the form expects.
  useEffect(() => {
    let cancelled = false;
    adminFetch('/api/admin/site/settings')
      .then((j) => {
        if (cancelled) return;
        setForm({ ...SITE_SETTINGS_DEFAULTS, ...j });
      })
      .catch(() => { if (!cancelled) setForm({ ...SITE_SETTINGS_DEFAULTS }); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  function setField(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function save() {
    setSaving(true);
    try {
      await adminFetch('/api/admin/site/settings', { method: 'PUT', body: form });
      invalidate('/api/site/settings');
      showToast?.('Settings saved', 'success');
    } catch (e) {
      showToast?.(e.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminLayout
      title="Site settings"
      subtitle="Contact details, footer text, and social links shown across the site"
      actions={
        <Button className="btn btn-primary" onClick={save} disabled={loading} loading={saving} style={{ padding: '.5rem 1rem' }}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      }
    >
      {loading ? (
        <div style={{ maxWidth: 640 }}>
          <ShimmerDrawerBody fields={8} cols={1} />
        </div>
      ) : (
        <div className="col gap-4" style={{ maxWidth: 640 }}>
          {Object.entries(groups).map(([group, items]) => (
            <section key={group} className="card" style={{ padding: '1.25rem' }}>
              <div className="tiny-eyebrow" style={{ marginBottom: '1rem' }}>{group}</div>
              <div className="col gap-3">
                {items.map((def) => (
                  <FormField key={def.key} label={def.label} hint={def.hint}>
                    <input
                      className="input-base"
                      value={form[def.key] ?? ''}
                      onChange={(e) => setField(def.key, e.target.value)}
                    />
                  </FormField>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
