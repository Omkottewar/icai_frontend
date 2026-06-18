import { useCallback, useEffect, useState } from 'react';
import DataTable from '../DataTable';
import Drawer from '../Drawer';
import FormField from '../FormField';
import { useAuth } from '../../../context/AuthContext';
import {
  listSources,
  createSource,
  reindexSource,
  rollbackSource,
  retireSource,
  ingestPublic,
  uploadFile,
} from '../../../lib/pragyaanAdmin';

// ─── Enums (kept in sync with the backend) ───────────────────────────────
const SCOPES = ['public', 'member', 'student', 'employer', 'internal'];
const LANGS = ['en', 'hi', 'mr'];
const SOURCE_TYPES = [
  'uploaded_pdf', 'url', 'internal_doc', 'event_material', 'newsletter', 'circular',
];
// Statuses surfaced by the sources list. `pending` = awaiting approval (where
// admin uploads land), `active` = approved + indexed, `failed` = rejected /
// errored, `retired` = withdrawn from the index.
const STATUSES = ['active', 'pending', 'failed', 'retired'];

const PAGE_SIZE = 25;

const EMPTY_FORM = {
  mode: 'file',          // 'file' | 'url' | 'text'
  title: '',
  scope: 'public',
  lang: 'en',
  source_type: 'uploaded_pdf',
  url: '',
  text: '',
  file_id: null,
  file_name: '',
};

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { dateStyle: 'medium' });
}

export default function PragyaanSources() {
  const { showToast } = useAuth();

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [scope, setScope] = useState('');
  const [q, setQ] = useState('');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [adding, setAdding] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  // id of the row whose action is in-flight (disables that row's buttons).
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await listSources({ status, scope, q, page, pageSize: PAGE_SIZE });
      setData(d);
    } catch (e) {
      setError(e.message || 'Failed to load sources');
    } finally {
      setLoading(false);
    }
  }, [status, scope, q, page]);

  useEffect(() => { load(); }, [load]);

  // Row actions ───────────────────────────────────────────────────────────
  async function onReindex(row) {
    setBusyId(row.id);
    try {
      const r = await reindexSource(row.id);
      showToast?.(
        r.skipped
          ? 'Reindex skipped — source already up to date'
          : `Reindexed — ${r.chunk_count} chunk${r.chunk_count === 1 ? '' : 's'}`,
        'success',
      );
      await load();
    } catch (e) {
      showToast?.(e.message || 'Reindex failed', 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function onRollback(row) {
    if (!confirm(`Roll back "${row.title}" to its previous version? The current version will be retired.`)) return;
    setBusyId(row.id);
    try {
      const r = await rollbackSource(row.id);
      showToast?.(`Rolled back to version ${r.active_version}`, 'success');
      await load();
    } catch (e) {
      showToast?.(e.message || 'Rollback failed', 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function onRetire(row) {
    if (!confirm(`Retire "${row.title}"? It will be removed from the knowledge base index.`)) return;
    setBusyId(row.id);
    try {
      await retireSource(row.id);
      showToast?.('Source retired', 'success');
      await load();
    } catch (e) {
      showToast?.(e.message || 'Retire failed', 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function onRunIngest() {
    setIngesting(true);
    try {
      const r = await ingestPublic({});
      // 202 Accepted — work is queued, not done synchronously.
      showToast?.(r.message || 'Public ingest queued', 'info');
    } catch (e) {
      showToast?.(e.message || 'Failed to start public ingest', 'error');
    } finally {
      setIngesting(false);
    }
  }

  const columns = [
    {
      key: 'title',
      header: 'Title',
      render: (r) => (
        <div>
          <div style={{ fontWeight: 600 }}>{r.title || <span className="muted-text">Untitled</span>}</div>
          <div className="muted-text" style={{ fontSize: '.72rem' }}>
            <span className="admin-chip">{r.source_type}</span>
            {r.lang && <span style={{ marginLeft: '.4rem', textTransform: 'uppercase' }}>{r.lang}</span>}
          </div>
        </div>
      ),
    },
    {
      key: 'scope',
      header: 'Scope',
      width: 100,
      render: (r) => <span className="admin-chip" style={{ textTransform: 'capitalize' }}>{r.scope}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      width: 110,
      render: (r) => (
        <span className={'admin-pill admin-pill-' + (r.status || 'pending')}>{r.status}</span>
      ),
    },
    {
      key: 'version',
      header: 'Ver.',
      width: 60,
      render: (r) => <span>v{r.version}</span>,
    },
    {
      key: 'chunk_count',
      header: 'Chunks',
      width: 80,
      render: (r) => <span>{r.chunk_count ?? 0}</span>,
    },
    {
      key: 'state',
      header: 'Indexed / retired',
      width: 150,
      render: (r) => (
        <div className="muted-text" style={{ fontSize: '.72rem', lineHeight: 1.4 }}>
          {r.approved_at
            ? <div>✓ Approved {fmtDate(r.approved_at)}</div>
            : <div>Not approved</div>}
          {r.retired_at && <div style={{ color: 'var(--destructive)' }}>Retired {fmtDate(r.retired_at)}</div>}
          {r.retention_expires_at && <div>Retention → {fmtDate(r.retention_expires_at)}</div>}
        </div>
      ),
    },
    {
      key: 'updated_at',
      header: 'Updated',
      width: 110,
      render: (r) => (
        <div className="muted-text" style={{ fontSize: '.72rem', lineHeight: 1.4 }}>
          <div>{fmtDate(r.updated_at || r.created_at)}</div>
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: 230,
      render: (r) => {
        const rowBusy = busyId === r.id;
        const canRollback = (r.version > 1) || !!r.supersedes_id;
        const isRetired = !!r.retired_at || r.status === 'retired';
        return (
          <div className="row gap-2" style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn btn-outline"
              disabled={rowBusy}
              onClick={() => onReindex(r)}
              style={{ padding: '.25rem .5rem', fontSize: '.72rem' }}
            >
              {rowBusy ? '…' : 'Reindex'}
            </button>
            {canRollback && (
              <button
                type="button"
                className="btn btn-outline"
                disabled={rowBusy}
                onClick={() => onRollback(r)}
                style={{ padding: '.25rem .5rem', fontSize: '.72rem' }}
              >
                Rollback
              </button>
            )}
            {!isRetired && (
              <button
                type="button"
                className="btn btn-ghost"
                disabled={rowBusy}
                onClick={() => onRetire(r)}
                style={{ padding: '.25rem .5rem', fontSize: '.72rem', color: 'var(--destructive)' }}
              >
                Retire
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <div className="row gap-2" style={{ justifyContent: 'flex-end', marginBottom: '.875rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn btn-outline"
          onClick={onRunIngest}
          disabled={ingesting}
          style={{ padding: '.5rem 1rem' }}
        >
          {ingesting ? 'Starting…' : 'Run public ingest'}
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setAdding(true)}
          style={{ padding: '.5rem 1rem' }}
        >
          + Add source
        </button>
      </div>

      {error && <div className="admin-error" style={{ marginBottom: '.875rem' }}>{error}</div>}

      <DataTable
        columns={columns}
        rows={data?.rows}
        loading={loading}
        total={data?.total ?? 0}
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        onSearch={(v) => { setQ(v); setPage(1); }}
        searchPlaceholder="Search sources…"
        emptyMessage="No sources match these filters."
        filters={
          <>
            <select className="input-base" style={{ padding: '.375rem .5rem', maxWidth: 150 }}
                    value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="">All statuses</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select className="input-base" style={{ padding: '.375rem .5rem', maxWidth: 150 }}
                    value={scope} onChange={(e) => { setScope(e.target.value); setPage(1); }}>
              <option value="">All scopes</option>
              {SCOPES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </>
        }
      />

      {adding && (
        <AddSourceDrawer
          onClose={() => setAdding(false)}
          onCreated={() => { setAdding(false); setPage(1); load(); }}
          showToast={showToast}
        />
      )}

      <style>{`
        .admin-chip {
          display: inline-block; padding: .1rem .45rem; border-radius: 999px;
          background: var(--muted, #f5f5f4); color: var(--foreground);
          font-size: .68rem; font-weight: 600; border: 1px solid var(--border);
        }
        .admin-pill {
          display: inline-block; padding: .15rem .55rem; border-radius: 999px;
          font-size: .7rem; font-weight: 600; text-transform: capitalize;
        }
        .admin-pill-active   { background: #d1fae5; color: #065f46; }
        .admin-pill-pending  { background: #fef3c7; color: #92400e; }
        .admin-pill-failed   { background: #fee2e2; color: #991b1b; }
        .admin-pill-retired  { background: #e5e7eb; color: #374151; }
        .admin-error {
          background: #fef2f2; border: 1px solid #fecaca; color: #991b1b;
          padding: .625rem .875rem; border-radius: .375rem; font-size: .8125rem;
        }
      `}</style>
    </div>
  );
}

// ─── Add source drawer ───────────────────────────────────────────────────
function AddSourceDrawer({ onClose, onCreated, showToast }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null); // created source (post-submit summary)

  function setField(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  // When the mode flips, pick a sensible default source_type so the
  // dropdown isn't left on an unrelated value.
  function setMode(mode) {
    setForm((f) => ({
      ...f,
      mode,
      source_type: mode === 'url' ? 'url' : mode === 'file' ? 'uploaded_pdf' : f.source_type,
    }));
  }

  async function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      // Mirror the existing admin upload pattern (SiteContentAdminPage's
      // ImageField): read as a data URL and POST to /api/admin/files.
      const data_base64 = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result || ''));
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      const resp = await uploadFile({
        name: file.name,
        mime_type: file.type,
        data_base64,
        bucket: 'pragyaan',
      });
      setForm((f) => ({
        ...f,
        file_id: resp.id,
        file_name: file.name,
        // Default the title to the filename if the admin hasn't typed one.
        title: f.title || file.name.replace(/\.[^.]+$/, ''),
      }));
      showToast?.('File uploaded', 'success');
    } catch (err) {
      setError(err.message || 'Upload failed');
      showToast?.(err.message || 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  }

  function validate() {
    if (form.mode === 'file' && !form.file_id) return 'Upload a file first.';
    if (form.mode === 'url' && !form.url.trim()) return 'Enter a URL.';
    if (form.mode === 'text' && !form.text.trim()) return 'Enter some text.';
    return null;
  }

  async function save() {
    const v = validate();
    if (v) { setError(v); return; }
    setSaving(true);
    setError(null);
    try {
      const body = {
        title: form.title.trim() || undefined,
        scope: form.scope,
        lang: form.lang,
        source_type: form.source_type,
      };
      // Exactly one of file_id / url / text.
      if (form.mode === 'file') body.file_id = form.file_id;
      else if (form.mode === 'url') body.url = form.url.trim();
      else body.text = form.text;

      const created = await createSource(body);
      setResult(created);
      // Admin uploads are NOT auto-approved — surface where it landed.
      showToast?.(
        created.status === 'active'
          ? 'Source created and active'
          : 'Source submitted — pending approval',
        created.status === 'active' ? 'success' : 'info',
      );
    } catch (e) {
      setError(e.message || 'Failed to create source');
      showToast?.(e.message || 'Failed to create source', 'error');
    } finally {
      setSaving(false);
    }
  }

  // Once created, show a confirmation summary instead of the form.
  if (result) {
    return (
      <Drawer
        open
        onClose={() => { onCreated?.(); }}
        title="Source submitted"
        width={560}
        footer={
          <button type="button" className="btn btn-primary" onClick={() => onCreated?.()} style={{ padding: '.5rem 1rem' }}>
            Done
          </button>
        }
      >
        <div className="admin-callout" style={{ marginTop: 0 }}>
          {result.status === 'active' ? (
            <span><strong>Active.</strong> The source is indexed and live in the knowledge base.</span>
          ) : (
            <span>
              <strong>Pending approval.</strong> Admin uploads are not auto-approved — this source
              now sits in the Approvals queue. A reviewer must approve it before it is indexed.
            </span>
          )}
        </div>
        <ul className="result-list">
          <li><span>Title</span><span>{result.title || '—'}</span></li>
          <li><span>Status</span><span className={'admin-pill admin-pill-' + (result.status || 'pending')}>{result.status}</span></li>
          <li><span>Scope</span><span style={{ textTransform: 'capitalize' }}>{result.scope}</span></li>
          <li><span>Version</span><span>v{result.version}</span></li>
          <li><span>Chunks</span><span>{result.chunk_count ?? 0}</span></li>
        </ul>
        <style>{`
          .admin-callout {
            margin-top: 1rem; padding: .75rem .875rem;
            background: var(--muted, #f5f5f4); border-radius: .375rem;
            font-size: .8125rem; color: var(--muted-foreground);
          }
          .result-list { list-style: none; padding: 0; margin: 1rem 0 0; }
          .result-list li {
            display: flex; justify-content: space-between; align-items: center;
            padding: .55rem 0; border-bottom: 1px solid var(--border); font-size: .8125rem;
          }
          .result-list li:last-child { border-bottom: 0; }
          .result-list li > span:first-child { color: var(--muted-foreground); }
          .admin-pill {
            display: inline-block; padding: .15rem .55rem; border-radius: 999px;
            font-size: .7rem; font-weight: 600; text-transform: capitalize;
          }
          .admin-pill-active   { background: #d1fae5; color: #065f46; }
          .admin-pill-pending  { background: #fef3c7; color: #92400e; }
          .admin-pill-failed   { background: #fee2e2; color: #991b1b; }
          .admin-pill-retired  { background: #e5e7eb; color: #374151; }
        `}</style>
      </Drawer>
    );
  }

  const busy = saving || uploading;

  return (
    <Drawer
      open
      onClose={onClose}
      title="Add source"
      width={560}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={busy} style={{ padding: '.5rem 1rem' }}>
            {saving ? 'Submitting…' : 'Submit source'}
          </button>
        </>
      }
    >
      {error && <div className="admin-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      {/* Mode picker */}
      <div className="mode-tabs">
        {[['file', 'File'], ['url', 'URL'], ['text', 'Text']].map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={'mode-tab' + (form.mode === key ? ' is-active' : '')}
            onClick={() => setMode(key)}
            disabled={busy}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="admin-form-grid">
        <FormField label="Title" span={2} hint="Optional — defaults to the filename for uploads.">
          <input className="input-base" value={form.title}
                 onChange={(e) => setField('title', e.target.value)}
                 placeholder="e.g. CPE Guidelines 2026" />
        </FormField>

        {form.mode === 'file' && (
          <FormField label="File" required span={2}>
            <div className="row gap-2" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <label className="btn btn-outline" style={{ padding: '.45rem .85rem', cursor: 'pointer' }}>
                {uploading ? 'Uploading…' : (form.file_id ? 'Replace file' : 'Choose file')}
                <input type="file" onChange={onFile} disabled={uploading} style={{ display: 'none' }} />
              </label>
              {form.file_name && <span className="muted-text" style={{ fontSize: '.8125rem' }}>{form.file_name}</span>}
            </div>
          </FormField>
        )}

        {form.mode === 'url' && (
          <FormField label="URL" required span={2}>
            <input className="input-base" type="url" value={form.url}
                   onChange={(e) => setField('url', e.target.value)}
                   placeholder="https://…" />
          </FormField>
        )}

        {form.mode === 'text' && (
          <FormField label="Text" required span={2}>
            <textarea className="input-base" value={form.text}
                      onChange={(e) => setField('text', e.target.value)}
                      rows={8} placeholder="Paste the content to index…"
                      style={{ resize: 'vertical', fontFamily: 'inherit' }} />
          </FormField>
        )}

        <FormField label="Scope" required>
          <select className="input-base" value={form.scope}
                  onChange={(e) => setField('scope', e.target.value)}>
            {SCOPES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </FormField>

        <FormField label="Language" required>
          <select className="input-base" value={form.lang}
                  onChange={(e) => setField('lang', e.target.value)}>
            {LANGS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </FormField>

        <FormField label="Source type" required span={2}>
          <select className="input-base" value={form.source_type}
                  onChange={(e) => setField('source_type', e.target.value)}>
            {SOURCE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </FormField>
      </div>

      <div className="admin-callout">
        <strong>Heads up:</strong> admin uploads are not auto-approved. After submitting, the
        source lands in the Approvals queue and must be approved before it is indexed.
      </div>

      <style>{`
        .mode-tabs {
          display: inline-flex; gap: .25rem; margin-bottom: 1rem;
          background: var(--muted, #f5f5f4); padding: .25rem; border-radius: .5rem;
        }
        .mode-tab {
          border: 0; background: transparent; cursor: pointer;
          padding: .35rem .85rem; border-radius: .375rem;
          font-size: .8125rem; font-weight: 600; color: var(--muted-foreground);
        }
        .mode-tab.is-active { background: var(--card); color: var(--foreground); box-shadow: 0 1px 2px rgba(0,0,0,.08); }
        .admin-form-grid {
          display: grid; grid-template-columns: 1fr 1fr; gap: .875rem 1rem;
        }
        .admin-error {
          background: #fef2f2; border: 1px solid #fecaca; color: #991b1b;
          padding: .625rem .875rem; border-radius: .375rem; font-size: .8125rem;
        }
        .admin-callout {
          margin-top: 1rem; padding: .75rem .875rem;
          background: var(--muted, #f5f5f4); border-radius: .375rem;
          font-size: .8125rem; color: var(--muted-foreground);
        }
      `}</style>
    </Drawer>
  );
}
