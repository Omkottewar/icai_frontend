import { useEffect, useMemo, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { useAuth } from '../../context/AuthContext';
import { Shimmer, ShimmerLines } from '../../components/ui/Shimmer';
import { IconX, IconCheckCircle } from '../../icons';
import { dialog } from '../../lib/dialog';

// ─── PragyaanAdminPage ──────────────────────────────────────────────────────
//
// One page, four tabs. Backend routes documented in
// backend/server/routes/admin/pragyaan.ts. Tabs:
//   sources    — list / upload / re-index / retire / rollback (admin)
//   approvals  — chairman approval queue (chairman + admin)
//   feedback   — answer-quality review (admin)
//   analytics  — top questions, no-answer rate, daily volume (admin)
//
// The chairman role sees only approvals; admin sees all four. The server
// already gates each endpoint so the tab guards here are UX-only.

const TABS = [
  { id: 'sources',   label: 'Sources' },
  { id: 'approvals', label: 'Approvals' },
  { id: 'feedback',  label: 'Feedback' },
  { id: 'analytics', label: 'Analytics' },
];

export default function PragyaanAdminPage() {
  const [tab, setTab] = useState(() => window.location.hash.replace('#', '') || 'sources');

  // Keep URL hash in sync so deep-linking to a tab works.
  useEffect(() => {
    if (window.location.hash.replace('#', '') !== tab) {
      window.history.replaceState(null, '', `#${tab}`);
    }
  }, [tab]);

  return (
    <AdminLayout
      title="Pragyaan AI"
      subtitle="Knowledge base, approvals, feedback, analytics"
    >
      <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1.25rem', borderBottom: '1px solid #e5e7eb' }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="btn btn-ghost"
            style={{
              borderRadius: 0,
              borderBottom: tab === t.id ? '2px solid #0f172a' : '2px solid transparent',
              fontWeight: tab === t.id ? 600 : 400,
              padding: '.5rem 1rem',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'sources'   && <SourcesTab />}
      {tab === 'approvals' && <ApprovalsTab />}
      {tab === 'feedback'  && <FeedbackTab />}
      {tab === 'analytics' && <AnalyticsTab />}
    </AdminLayout>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Sources tab
// ════════════════════════════════════════════════════════════════════════════

function SourcesTab() {
  const { showToast } = useAuth();
  const [rows, setRows] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ status: '', scope: '', q: '' });
  const [showUpload, setShowUpload] = useState(false);
  const [reingesting, setReingesting] = useState(false);

  async function load() {
    setRows(null);
    const qs = new URLSearchParams();
    if (filters.status) qs.set('status', filters.status);
    if (filters.scope)  qs.set('scope',  filters.scope);
    if (filters.q)      qs.set('q',      filters.q);
    qs.set('page', String(page));
    qs.set('pageSize', '25');
    try {
      const r = await fetch(`/api/admin/pragyaan/sources?${qs}`, { credentials: 'include' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Failed to load');
      setRows(j.rows);
      setTotal(j.total);
    } catch (e) {
      showToast?.(e.message, 'error');
      setRows([]);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [page, filters.status, filters.scope]);

  async function reingestPublic() {
    if (reingesting) return;
    setReingesting(true);
    try {
      const r = await fetch('/api/admin/pragyaan/ingest/public', { method: 'POST', credentials: 'include' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Failed');
      showToast?.('Public corpus ingest started in the background', 'success');
      setTimeout(() => load(), 1500);
    } catch (e) {
      showToast?.(e.message, 'error');
    } finally {
      setReingesting(false);
    }
  }

  async function act(id, kind) {
    try {
      const r = await fetch(`/api/admin/pragyaan/sources/${id}/${kind}`, {
        method: kind === 'retention' ? 'PATCH' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Failed');
      showToast?.(`${kind} done`, 'success');
      load();
    } catch (e) {
      showToast?.(e.message, 'error');
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <input
          className="input-base"
          placeholder="Search title…"
          value={filters.q}
          onChange={(e) => setFilters({ ...filters, q: e.target.value })}
          onKeyDown={(e) => { if (e.key === 'Enter') { setPage(1); load(); } }}
          style={{ maxWidth: 260 }}
        />
        <select className="input-base" value={filters.status} onChange={(e) => { setPage(1); setFilters({ ...filters, status: e.target.value }); }}>
          <option value="">All statuses</option>
          {['pending', 'chunking', 'embedded', 'indexed', 'failed'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select className="input-base" value={filters.scope} onChange={(e) => { setPage(1); setFilters({ ...filters, scope: e.target.value }); }}>
          <option value="">All scopes</option>
          {['public', 'member', 'student', 'employer', 'internal'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <div style={{ flex: 1 }} />
        <button className="btn btn-ghost" onClick={reingestPublic} disabled={reingesting}>
          {reingesting ? 'Starting…' : 'Re-ingest public corpus'}
        </button>
        <button className="btn btn-primary" onClick={() => setShowUpload(true)}>+ Add source</button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.875rem' }}>
          <thead style={{ background: '#f8fafc' }}>
            <tr>
              <th style={th}>Title</th>
              <th style={th}>Scope</th>
              <th style={th}>Status</th>
              <th style={th}>Chunks</th>
              <th style={th}>Approved</th>
              <th style={th}>Updated</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {!rows && Array.from({ length: 6 }).map((_, i) => (
              <tr key={i}><td colSpan={7} style={td}><ShimmerLines count={1} /></td></tr>
            ))}
            {rows && rows.length === 0 && (
              <tr><td colSpan={7} style={{ ...td, textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                No sources match your filters. Click <strong>+ Add source</strong> or kick a public corpus re-ingest.
              </td></tr>
            )}
            {rows && rows.map((s) => (
              <tr key={s.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                <td style={td}>
                  <div style={{ fontWeight: 500 }}>{s.title}</div>
                  <div className="muted-text" style={{ fontSize: '.75rem' }}>{s.source_type} · v{s.version} · {s.lang}</div>
                </td>
                <td style={td}><ScopePill scope={s.scope} /></td>
                <td style={td}><StatusPill status={s.status} /></td>
                <td style={td}>{s.chunk_count ?? 0}</td>
                <td style={td}>
                  {s.retired_at && <span style={{ color: '#dc2626' }}>retired</span>}
                  {!s.retired_at && s.approved_at && <span style={{ color: '#059669' }}>✓</span>}
                  {!s.retired_at && !s.approved_at && <span style={{ color: '#d97706' }}>pending</span>}
                </td>
                <td style={td}>{formatDate(s.updated_at)}</td>
                <td style={{ ...td, whiteSpace: 'nowrap', textAlign: 'right' }}>
                  <button className="btn btn-ghost" style={btnSm} onClick={() => act(s.id, 'reindex')} disabled={!!s.retired_at}>Re-index</button>
                  <button className="btn btn-ghost" style={btnSm} onClick={() => act(s.id, 'rollback')}>Rollback</button>
                  <button className="btn btn-ghost" style={{ ...btnSm, color: '#dc2626' }} onClick={() => act(s.id, 'retire')} disabled={!!s.retired_at}>Retire</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pager page={page} pageSize={25} total={total} onChange={setPage} />

      {showUpload && <UploadSourceModal onClose={() => setShowUpload(false)} onSaved={async () => { setShowUpload(false); await load(); }} />}
    </div>
  );
}

function UploadSourceModal({ onClose, onSaved }) {
  const { showToast } = useAuth();
  const [mode, setMode] = useState('text'); // 'text' | 'file' | 'url'
  const [form, setForm] = useState({
    title: '', text: '', url: '',
    scope: 'internal', lang: 'en', source_type: 'internal_doc',
  });
  const [fileId, setFileId] = useState(null);
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);

  async function uploadFile(file) {
    if (file.size > 6 * 1024 * 1024) {
      showToast?.('File must be ≤ 6 MB', 'error');
      return;
    }
    const data_base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const r = await fetch('/api/admin/files', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: file.name, mime_type: file.type || 'application/octet-stream', bucket: 'public', data_base64 }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'Upload failed');
    setFileId(j.id);
    setFileName(file.name);
    if (!form.title) setForm((f) => ({ ...f, title: file.name.replace(/\.[^.]+$/, '') }));
  }

  async function submit() {
    if (busy) return;
    setBusy(true);
    try {
      const body = {
        title: form.title,
        scope: form.scope,
        lang: form.lang,
        source_type: form.source_type,
      };
      if (mode === 'text') body.text = form.text;
      if (mode === 'url')  { body.url = form.url; body.text = form.text; }
      if (mode === 'file') body.file_id = fileId;

      const r = await fetch('/api/admin/pragyaan/sources', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Failed');
      showToast?.(`Source added (${j.chunk_count} chunks) — awaiting chairman approval`, 'success');
      onSaved();
    } catch (e) {
      showToast?.(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  const ready = form.title.trim()
    && form.scope
    && form.source_type
    && ((mode === 'text' && form.text.trim())
       || (mode === 'file' && fileId)
       || (mode === 'url' && form.url.trim() && form.text.trim()));

  return (
    <Modal title="Add a source to Pragyaan's knowledge base" onClose={onClose}>
      <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1rem' }}>
        {[
          ['text', 'Paste text'],
          ['file', 'Upload PDF / file'],
          ['url',  'Link + summary'],
        ].map(([k, label]) => (
          <button key={k} onClick={() => setMode(k)} className="btn btn-ghost"
            style={{ borderBottom: mode === k ? '2px solid #0f172a' : '2px solid transparent' }}>
            {label}
          </button>
        ))}
      </div>

      <label style={fieldLbl}>Title</label>
      <input className="input-base" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g., Articleship Leave Policy 2026" />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '.5rem', marginTop: '.75rem' }}>
        <div>
          <label style={fieldLbl}>Scope</label>
          <select className="input-base" value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })}>
            <option value="public">public (everyone)</option>
            <option value="member">member (logged-in members)</option>
            <option value="student">student</option>
            <option value="employer">employer</option>
            <option value="internal">internal (branch staff only)</option>
          </select>
        </div>
        <div>
          <label style={fieldLbl}>Language</label>
          <select className="input-base" value={form.lang} onChange={(e) => setForm({ ...form, lang: e.target.value })}>
            <option value="en">English</option>
            <option value="hi">Hindi</option>
            <option value="mr">Marathi</option>
          </select>
        </div>
        <div>
          <label style={fieldLbl}>Type</label>
          <select className="input-base" value={form.source_type} onChange={(e) => setForm({ ...form, source_type: e.target.value })}>
            <option value="internal_doc">Internal doc</option>
            <option value="uploaded_pdf">Uploaded PDF</option>
            <option value="circular">Circular</option>
            <option value="newsletter">Newsletter</option>
            <option value="event_material">Event material</option>
            <option value="url">External URL</option>
          </select>
        </div>
      </div>

      <div style={{ marginTop: '1rem' }}>
        {mode === 'text' && (
          <>
            <label style={fieldLbl}>Paste the full text</label>
            <textarea className="input-base" rows={10} value={form.text}
              onChange={(e) => setForm({ ...form, text: e.target.value })}
              placeholder="Paste the policy text, FAQ content, or document body here…" />
          </>
        )}
        {mode === 'file' && (
          <>
            <label style={fieldLbl}>PDF or text file (≤ 6 MB)</label>
            <input type="file" accept=".pdf,.txt,.md,.html"
              onChange={async (e) => { try { await uploadFile(e.target.files[0]); } catch (err) { showToast?.(err.message, 'error'); } }} />
            {fileName && (
              <div style={{ marginTop: '.5rem', color: '#059669' }}>
                <IconCheckCircle /> {fileName}
              </div>
            )}
            <p className="muted-text" style={{ fontSize: '.8rem', marginTop: '.5rem' }}>
              Image-only PDFs (scans) won't extract — paste the text directly instead.
            </p>
          </>
        )}
        {mode === 'url' && (
          <>
            <label style={fieldLbl}>URL (citation deep-link)</label>
            <input className="input-base" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://…" />
            <label style={{ ...fieldLbl, marginTop: '.75rem' }}>Summary / extracted text</label>
            <textarea className="input-base" rows={8} value={form.text}
              onChange={(e) => setForm({ ...form, text: e.target.value })}
              placeholder="Paste the page's text — we don't fetch URLs server-side for security." />
          </>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '.5rem', marginTop: '1.25rem' }}>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={submit} disabled={!ready || busy}>
          {busy ? 'Uploading…' : 'Submit for approval'}
        </button>
      </div>
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Approvals tab
// ════════════════════════════════════════════════════════════════════════════

function ApprovalsTab() {
  const { showToast } = useAuth();
  const [rows, setRows] = useState(null);

  async function load() {
    setRows(null);
    try {
      const r = await fetch('/api/admin/pragyaan/approvals', { credentials: 'include' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Failed');
      setRows(j.rows);
    } catch (e) {
      showToast?.(e.message, 'error');
      setRows([]);
    }
  }
  useEffect(() => { load(); }, []);

  async function decide(id, action) {
    const reason = action === 'reject'
      ? await dialog.prompt({
          title: 'Reject source',
          message: 'Reason for rejecting?',
          placeholder: 'Explain the rejection',
          multiline: true,
          confirmText: 'Reject',
        })
      : null;
    if (action === 'reject' && reason == null) return;
    try {
      const r = await fetch(`/api/admin/pragyaan/sources/${id}/${action}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action === 'reject' ? { reason } : {}),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Failed');
      showToast?.(`${action === 'approve' ? 'Approved' : 'Rejected'}`, 'success');
      load();
    } catch (e) {
      showToast?.(e.message, 'error');
    }
  }

  return (
    <div>
      <p className="muted-text" style={{ marginBottom: '1rem' }}>
        Uploads waiting for chairman approval. An approved source goes live in Pragyaan immediately. A rejected source is retired and never used.
      </p>

      <div className="card" style={{ padding: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.875rem' }}>
          <thead style={{ background: '#f8fafc' }}>
            <tr>
              <th style={th}>Title</th>
              <th style={th}>Scope</th>
              <th style={th}>Type</th>
              <th style={th}>Chunks</th>
              <th style={th}>Uploaded</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {!rows && Array.from({ length: 3 }).map((_, i) => (
              <tr key={i}><td colSpan={6} style={td}><ShimmerLines count={1} /></td></tr>
            ))}
            {rows && rows.length === 0 && (
              <tr><td colSpan={6} style={{ ...td, textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                Nothing pending — Pragyaan is up to date.
              </td></tr>
            )}
            {rows && rows.map((s) => (
              <tr key={s.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                <td style={td}><strong>{s.title}</strong></td>
                <td style={td}><ScopePill scope={s.scope} /></td>
                <td style={td}>{s.source_type}</td>
                <td style={td}>{s.chunk_count}</td>
                <td style={td}>{formatDate(s.created_at)}</td>
                <td style={{ ...td, whiteSpace: 'nowrap', textAlign: 'right' }}>
                  <button className="btn btn-primary" style={btnSm} onClick={() => decide(s.id, 'approve')}>Approve</button>
                  <button className="btn btn-ghost" style={{ ...btnSm, color: '#dc2626' }} onClick={() => decide(s.id, 'reject')}>Reject</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Feedback tab
// ════════════════════════════════════════════════════════════════════════════

function FeedbackTab() {
  const { showToast } = useAuth();
  const [rows, setRows] = useState(null);
  const [rating, setRating] = useState('down');

  async function load() {
    setRows(null);
    try {
      const r = await fetch(`/api/admin/pragyaan/feedback?rating=${rating}&pageSize=50`, { credentials: 'include' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Failed');
      setRows(j.rows);
    } catch (e) {
      showToast?.(e.message, 'error');
      setRows([]);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [rating]);

  return (
    <div>
      <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1rem' }}>
        {['down', 'up', ''].map((r) => (
          <button key={r || 'all'} className="btn btn-ghost"
            style={{ borderBottom: rating === r ? '2px solid #0f172a' : '2px solid transparent' }}
            onClick={() => setRating(r)}>
            {r === 'down' ? '👎 Negative' : r === 'up' ? '👍 Positive' : 'All'}
          </button>
        ))}
      </div>

      {!rows && <ShimmerLines count={4} />}
      {rows && rows.length === 0 && <p className="muted-text">No feedback yet.</p>}
      {rows && rows.map((f) => (
        <div key={f.id} className="card" style={{ marginBottom: '.75rem', padding: '1rem' }}>
          <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', marginBottom: '.5rem' }}>
            <span style={{ fontSize: '1.5rem' }}>{f.rating === 'up' ? '👍' : '👎'}</span>
            <span className="muted-text" style={{ fontSize: '.75rem' }}>{formatDate(f.created_at)}</span>
            {f.conversation_lang && (
              <span className="muted-text" style={{ fontSize: '.75rem' }}>· {f.conversation_lang.toUpperCase()}</span>
            )}
          </div>
          {f.comment && (
            <div style={{ marginBottom: '.5rem', padding: '.5rem', background: '#fef3c7', borderRadius: 4 }}>
              <strong>Comment:</strong> {f.comment}
            </div>
          )}
          <div style={{ fontSize: '.875rem', whiteSpace: 'pre-wrap', color: '#334155' }}>
            <strong>Pragyaan said:</strong>
            <div style={{ marginTop: '.25rem' }}>{f.message_content}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Analytics tab
// ════════════════════════════════════════════════════════════════════════════

function AnalyticsTab() {
  const { showToast } = useAuth();
  const [data, setData] = useState(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    (async () => {
      setData(null);
      try {
        const r = await fetch(`/api/admin/pragyaan/analytics?days=${days}`, { credentials: 'include' });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || 'Failed');
        setData(j);
      } catch (e) {
        showToast?.(e.message, 'error');
        setData({});
      }
    })();
  }, [days]); // eslint-disable-line

  if (!data) return <ShimmerLines count={6} />;

  const cards = [
    { label: 'Total questions',     value: data.total ?? 0 },
    { label: 'Answered',            value: data.answered ?? 0 },
    { label: 'No-answer rate',      value: pct(data.no_answer_rate), tone: (data.no_answer_rate ?? 0) > 0.3 ? 'bad' : 'ok' },
    { label: 'Citation coverage',   value: pct(data.citation_coverage), tone: (data.citation_coverage ?? 0) >= 0.8 ? 'ok' : 'warn' },
  ];

  const maxDay = Math.max(1, ...(data.by_day ?? []).map((d) => d.count));

  return (
    <div>
      <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1rem' }}>
        {[7, 30, 90].map((d) => (
          <button key={d} className="btn btn-ghost"
            style={{ borderBottom: days === d ? '2px solid #0f172a' : '2px solid transparent' }}
            onClick={() => setDays(d)}>
            {d} days
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '.75rem', marginBottom: '1.25rem' }}>
        {cards.map((c) => (
          <div key={c.label} className="card" style={{ padding: '1rem' }}>
            <div className="muted-text" style={{ fontSize: '.75rem', textTransform: 'uppercase', letterSpacing: '.05em' }}>{c.label}</div>
            <div style={{
              fontSize: '1.75rem', fontWeight: 600, marginTop: '.25rem',
              color: c.tone === 'bad' ? '#dc2626' : c.tone === 'warn' ? '#d97706' : '#0f172a',
            }}>{c.value}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: '1rem', marginBottom: '1.25rem' }}>
        <h3 style={{ marginTop: 0 }}>Daily volume</h3>
        {(data.by_day ?? []).length === 0 ? (
          <p className="muted-text">No questions yet.</p>
        ) : (
          <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 120, paddingTop: '.5rem' }}>
            {data.by_day.map((d) => (
              <div key={d.day} title={`${d.day} — ${d.count} (${d.no_answer} no-answer)`} style={{ flex: 1, display: 'flex', flexDirection: 'column-reverse' }}>
                <div style={{ height: (d.count / maxDay) * 100 + '%', background: '#0f172a', minHeight: 1 }} />
                <div style={{ height: (d.no_answer / maxDay) * 100 + '%', background: '#dc2626', minHeight: 0 }} />
              </div>
            ))}
          </div>
        )}
        <div className="muted-text" style={{ fontSize: '.75rem', marginTop: '.5rem' }}>
          <span style={{ display: 'inline-block', width: 10, height: 10, background: '#0f172a', marginRight: 4 }} /> Answered
          <span style={{ display: 'inline-block', width: 10, height: 10, background: '#dc2626', marginLeft: 12, marginRight: 4 }} /> No-answer
        </div>
      </div>

      <div className="card" style={{ padding: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>Top questions ({days} days)</h3>
        {(data.top_questions ?? []).length === 0 ? (
          <p className="muted-text">No questions yet.</p>
        ) : (
          <ol style={{ margin: 0, paddingLeft: '1.25rem' }}>
            {data.top_questions.slice(0, 15).map((q) => (
              <li key={q.question} style={{ marginBottom: '.25rem' }}>
                <span>{q.question}</span>
                <span className="muted-text" style={{ marginLeft: '.5rem' }}>× {q.count}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Shared bits
// ════════════════════════════════════════════════════════════════════════════

function Modal({ title, children, onClose }) {
  const titleId = `modal-title-${title.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
         onClick={onClose}
         role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div style={{ background: 'white', borderRadius: 8, padding: '1.5rem', width: 'min(640px, 95vw)', maxHeight: '90vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 id={titleId} style={{ margin: 0, fontSize: '1.25rem' }}>{title}</h2>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: '.25rem' }} aria-label="Close dialog"><IconX /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Pager({ page, pageSize, total, onChange }) {
  const last = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '.75rem', fontSize: '.875rem' }}>
      <span className="muted-text">{total} sources</span>
      <div style={{ display: 'flex', gap: '.5rem' }}>
        <button className="btn btn-ghost" disabled={page <= 1} onClick={() => onChange(page - 1)}>Prev</button>
        <span style={{ alignSelf: 'center' }}>{page} / {last}</span>
        <button className="btn btn-ghost" disabled={page >= last} onClick={() => onChange(page + 1)}>Next</button>
      </div>
    </div>
  );
}

function ScopePill({ scope }) {
  const colours = {
    public:   { bg: '#dcfce7', fg: '#065f46' },
    member:   { bg: '#dbeafe', fg: '#1e3a8a' },
    student:  { bg: '#fef3c7', fg: '#92400e' },
    employer: { bg: '#f3e8ff', fg: '#6b21a8' },
    internal: { bg: '#fee2e2', fg: '#991b1b' },
  }[scope] ?? { bg: '#f1f5f9', fg: '#334155' };
  return (
    <span style={{ background: colours.bg, color: colours.fg, padding: '.125rem .5rem', borderRadius: 999, fontSize: '.75rem', fontWeight: 500 }}>{scope}</span>
  );
}

function StatusPill({ status }) {
  const colours = {
    pending:  { bg: '#fef3c7', fg: '#92400e' },
    chunking: { bg: '#fef3c7', fg: '#92400e' },
    embedded: { bg: '#dbeafe', fg: '#1e3a8a' },
    indexed:  { bg: '#dcfce7', fg: '#065f46' },
    failed:   { bg: '#fee2e2', fg: '#991b1b' },
  }[status] ?? { bg: '#f1f5f9', fg: '#334155' };
  return (
    <span style={{ background: colours.bg, color: colours.fg, padding: '.125rem .5rem', borderRadius: 999, fontSize: '.75rem' }}>{status}</span>
  );
}

function pct(v) {
  if (v == null) return '—';
  return (v * 100).toFixed(0) + '%';
}

function formatDate(d) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return String(d);
  }
}

// Reused inline styles — these match the patterns from GrievancesAdminPage.
const th = { textAlign: 'left', padding: '.5rem .75rem', fontWeight: 600, fontSize: '.75rem', textTransform: 'uppercase', letterSpacing: '.05em', color: '#475569' };
const td = { padding: '.5rem .75rem', verticalAlign: 'top' };
const btnSm = { padding: '.25rem .5rem', fontSize: '.75rem' };
const fieldLbl = { display: 'block', fontSize: '.75rem', fontWeight: 600, color: '#475569', marginBottom: '.25rem', textTransform: 'uppercase', letterSpacing: '.05em' };
