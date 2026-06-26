import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { adminFetch } from '../../hooks/useAdminList';
import { ShimmerDrawerBody } from '../../components/ui/Shimmer';
import { dialog } from '../../lib/dialog';

// ICAI Directory admin — import the member master xlsx that signup gating
// validates against (Open Question #3). Soft launch by default: gating
// flag is OFF until the branch flips it on after verifying the import.

export default function IcaiDirectoryAdminPage() {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [result, setResult] = useState(null);
  const [file, setFile] = useState(null);

  async function load() {
    try {
      const j = await adminFetch('/api/admin/icai-directory');
      setStatus(j);
    } catch (e) { setErr(e.message); }
  }

  useEffect(() => { load(); }, []);

  async function onUpload(e) {
    e.preventDefault();
    if (!file) return;
    setBusy(true); setErr(''); setResult(null);
    try {
      const buf = await file.arrayBuffer();
      // Encode the buffer to base64 in chunks. The naive
      // `String.fromCharCode(...new Uint8Array(buf))` form spreads every
      // byte as a separate argument and blows the JS call stack for any
      // file bigger than ~50 KB ("Maximum call stack size exceeded").
      // 0x8000 (32 KB) per chunk is the standard safe size used across
      // the rest of this codebase (see MockTestQuestionsAdminPage).
      const bytes = new Uint8Array(buf);
      const CHUNK = 0x8000;
      let binary = '';
      for (let i = 0; i < bytes.length; i += CHUNK) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
      }
      const base64 = btoa(binary);
      const j = await adminFetch('/api/admin/icai-directory/import', {
        method: 'POST',
        body: { filename: file.name, data_base64: base64 },
      });
      setResult(j);
      await load();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  async function toggleGate() {
    if (!status) return;
    const next = !status.gating_enabled;
    if (next && status.total === 0) {
      setErr('Import the directory first — gating with an empty table would lock everyone out.');
      return;
    }
    const ok = await dialog.confirm({
      title: `${next ? 'Enable' : 'Disable'} MRN gating?`,
      message: next
        ? 'Member signups will be rejected unless their MRN exists in the imported directory.'
        : 'Member signups will be accepted from any email.',
      confirmText: next ? 'Enable gating' : 'Disable gating',
      danger: !next,
    });
    if (!ok) return;
    setBusy(true); setErr('');
    try {
      await adminFetch('/api/admin/icai-directory/flag', { method: 'POST', body: { enabled: next } });
      await load();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  async function wipe() {
    const ok = await dialog.confirm({
      title: 'Wipe directory?',
      message: 'Delete every row from icai_member_master? This is reversible only by re-importing the spreadsheet.',
      confirmText: 'Wipe directory',
      danger: true,
    });
    if (!ok) return;
    setBusy(true); setErr('');
    try {
      await adminFetch('/api/admin/icai-directory', {
        method: 'DELETE',
        body: { confirm: 'wipe-icai-directory' },
      });
      await load();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  return (
    <AdminLayout title="ICAI member directory" subtitle="Mirror of the master CSV/XLSX used to gate member signups (Open Question #3).">
      {err && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{err}</div>}

      <div className="card" style={{ marginBottom: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Status</h3>
        {!status ? (
          <ShimmerDrawerBody fields={3} cols={1} />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginTop: '.75rem' }}>
            <StatTile label="Members in master" value={status.total.toLocaleString()} />
            <StatTile label="Last imported"     value={status.last_imported ? new Date(status.last_imported).toLocaleString() : '—'} />
            <StatTile label="Last source file"  value={status.source_file ?? '—'} />
            <StatTile
              label="Signup gating"
              value={status.gating_enabled ? 'ENABLED' : 'OFF (soft launch)'}
              tone={status.gating_enabled ? 'success' : 'muted'}
            />
          </div>
        )}
        <div className="row gap-2" style={{ marginTop: '1rem' }}>
          <button className="btn btn-ghost" onClick={toggleGate} disabled={busy || !status}>
            {status?.gating_enabled ? 'Disable gating' : 'Enable gating'}
          </button>
          <button className="btn btn-ghost" onClick={wipe} disabled={busy || (status?.total ?? 0) === 0}>
            Wipe directory
          </button>
        </div>
      </div>

      <div className="card">
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Import / refresh</h3>
        <p className="muted-text" style={{ fontSize: '.875rem', marginTop: '.25rem' }}>
          Upload <code>ICAI_DIRECTORY.xlsx</code> or any spreadsheet with at least <strong>MRN</strong> and <strong>Name</strong> columns.
          Other recognised columns: Email, Phone, City, Firm, FCA flag, COP status. Existing rows
          are upserted on MRN — re-importing safely refreshes contact details.
        </p>
        <form onSubmit={onUpload} className="col gap-3" style={{ marginTop: '1rem' }}>
          <input
            type="file"
            accept=".xlsx,.xls,.csv,.ods"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            disabled={busy}
          />
          <button type="submit" className="btn btn-primary" disabled={!file || busy} style={{ alignSelf: 'flex-start' }}>
            {busy ? 'Importing…' : 'Upload & upsert'}
          </button>
        </form>
        {result && (
          <div className="alert alert-success" style={{ marginTop: '1rem' }}>
            Imported {result.imported.toLocaleString()} rows · skipped {result.skipped.toLocaleString()}.
            {result.errors?.length > 0 && (
              <div style={{ marginTop: '.5rem', fontSize: '.75rem' }}>
                <strong>{result.errors.length} errors:</strong>
                <ul style={{ margin: '.25rem 0 0 1rem' }}>
                  {result.errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

function StatTile({ label, value, tone = 'default' }) {
  const colors = {
    default: { bg: 'var(--surface-2, #f8fafc)', fg: 'var(--foreground)' },
    success: { bg: 'rgba(5,150,105,.1)',         fg: '#047857' },
    muted:   { bg: 'rgba(100,116,139,.1)',       fg: '#475569' },
  }[tone];
  return (
    <div style={{ background: colors.bg, padding: '.875rem 1rem', borderRadius: '.5rem' }}>
      <div className="muted-text" style={{ fontSize: '.75rem', textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
      <div style={{ fontSize: '1.125rem', fontWeight: 600, marginTop: '.125rem', color: colors.fg, wordBreak: 'break-word' }}>{value}</div>
    </div>
  );
}
