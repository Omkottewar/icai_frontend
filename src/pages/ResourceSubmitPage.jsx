import { useEffect, useState } from 'react';
import PageHeader from '../components/layout/PageHeader';
import { useAuth } from '../context/AuthContext';
import { navigate } from '../hooks/useRoute';

// Member paper submission. Goes to status='pending_review' and shows up in
// admin moderation queue. Submitter gets notified on approve / reject.
//
// File upload uses the existing /api/admin/files endpoint — except it's
// admin-only. We add a public-facing /api/files/upload via a thin wrapper
// later; for now this page just expects the user to paste a PDF URL.
// (Quick MVP — the upload form gets wired in Phase 4 polish.)

async function api(url, opts = {}) {
  const r = await fetch(url, {
    credentials: 'include',
    method: opts.method || 'GET',
    headers: opts.body ? { 'content-type': 'application/json' } : undefined,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (r.status === 401) return null;
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}

export default function ResourceSubmitPage() {
  const { user, loading } = useAuth();
  const [topics, setTopics] = useState([]);
  const [committees, setCommittees] = useState([]);
  const [mine, setMine] = useState([]);
  const [form, setForm] = useState({
    title: '', abstract: '', description: '',
    author_designation: '',
    pdf_file_id: '', cover_file_id: '',
    committee_id: '', event_id: '',
    presented_on: '',
    topic_ids: [],
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate('/login'); return; }
    api('/api/resources/topics').then((r) => setTopics(r?.items || []));
    api('/api/committees').then((r) => setCommittees(r?.items || r?.rows || []));
    api('/api/resources/papers/mine').then((r) => setMine(r?.items || [])).catch(() => setMine([]));
  }, [user?.id, loading]);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    if (form.topic_ids.length === 0) { setMsg({ kind: 'error', text: 'Pick at least one topic.' }); return; }
    setBusy(true); setMsg(null);
    try {
      await api('/api/resources/papers/submit', {
        method: 'POST',
        body: form,
      });
      setMsg({ kind: 'success', text: 'Submitted! Admin will review and publish. You\'ll be notified.' });
      // Reset form
      setForm({
        title: '', abstract: '', description: '',
        author_designation: '',
        pdf_file_id: '', cover_file_id: '',
        committee_id: '', event_id: '',
        presented_on: '',
        topic_ids: [],
      });
      api('/api/resources/papers/mine').then((r) => setMine(r?.items || []));
    } catch (e2) {
      setMsg({ kind: 'error', text: e2.message });
    } finally {
      setBusy(false);
    }
  };

  const toggleTopic = (id) => {
    setForm((f) => ({
      ...f,
      topic_ids: f.topic_ids.includes(id)
        ? f.topic_ids.filter((x) => x !== id)
        : (f.topic_ids.length < 4 ? [...f.topic_ids, id] : f.topic_ids),
    }));
  };

  if (!user) return null;

  return (
    <>
      <PageHeader title="Submit a paper" subtitle="Share your work with the branch. Admin reviews before publishing." />
      <section className="container" style={{ padding: '1.5rem 1rem 3rem', maxWidth: '720px' }}>
        <a href="#/resources">← Back to Resources</a>

        <form onSubmit={submit} className="sub-form">
          <Field label="Paper title" required>
            <input type="text" required maxLength={300} value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </Field>
          <Field label="Abstract (2-3 sentences)" required>
            <textarea required rows={3} maxLength={1500} value={form.abstract}
              onChange={(e) => setForm((f) => ({ ...f, abstract: e.target.value }))} />
          </Field>
          <Field label="Full text / additional notes (optional)">
            <textarea rows={5} value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </Field>

          <Field label="Topics (pick 1-4)" required>
            <div className="sub-topics">
              {topics.map((t) => (
                <button
                  type="button"
                  key={t.id}
                  className={'sub-topic-chip' + (form.topic_ids.includes(t.id) ? ' is-on' : '')}
                  onClick={() => toggleTopic(t.id)}
                >
                  {form.topic_ids.includes(t.id) ? '✓ ' : ''}{t.name}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Your designation (optional)">
            <input type="text" value={form.author_designation} placeholder="e.g. Partner at XYZ & Co."
              onChange={(e) => setForm((f) => ({ ...f, author_designation: e.target.value }))} />
          </Field>

          <Field label="Committee (if presented at a branch event)">
            <select value={form.committee_id} onChange={(e) => setForm((f) => ({ ...f, committee_id: e.target.value }))}>
              <option value="">— None —</option>
              {committees.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>

          <Field label="Presented on">
            <input type="date" value={form.presented_on}
              onChange={(e) => setForm((f) => ({ ...f, presented_on: e.target.value }))} />
          </Field>

          <Field label="PDF file" required>
            <PdfUploader
              fileId={form.pdf_file_id}
              onUploaded={(id) => setForm((f) => ({ ...f, pdf_file_id: id }))}
              onCleared={() => setForm((f) => ({ ...f, pdf_file_id: '' }))}
            />
          </Field>

          {msg && (
            <p style={{
              padding: '.65rem .85rem', borderRadius: '.4rem',
              background: msg.kind === 'success' ? '#dcfce7' : '#fee2e2',
              color: msg.kind === 'success' ? '#166534' : '#991b1b',
            }}>{msg.text}</p>
          )}

          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Submitting…' : 'Submit for review'}
          </button>
        </form>

        {/* My submissions log */}
        {mine.length > 0 && (
          <>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '2rem 0 .75rem' }}>My submissions</h2>
            <div className="sub-mine">
              {mine.map((p) => (
                <div key={p.id} className="sub-mine-row">
                  <div>
                    <strong>{p.title}</strong>
                    <span className={'sub-status sub-status-' + p.status}>{STATUS_LABEL[p.status] || p.status}</span>
                  </div>
                  {p.review_note && p.status === 'rejected' && (
                    <p className="muted-text" style={{ fontSize: '.8rem', margin: '.25rem 0 0' }}>
                      <strong>Admin note:</strong> {p.review_note}
                    </p>
                  )}
                  {p.status === 'published' && (
                    <a href={`#/resources/papers/${p.slug}`} style={{ fontSize: '.8rem' }}>View live →</a>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        <style>{`
          .sub-form { display: flex; flex-direction: column; gap: 1rem; margin-top: 1.5rem; }
          .sub-topics { display: flex; gap: .35rem; flex-wrap: wrap; }
          .sub-topic-chip { padding: .3rem .7rem; background: var(--card); border: 1px solid var(--border); border-radius: 999px; font: inherit; font-size: .8rem; cursor: pointer; transition: all .12s; }
          .sub-topic-chip:hover { border-color: var(--primary); color: var(--primary); }
          .sub-topic-chip.is-on { background: var(--primary); color: white; border-color: var(--primary); }
          .sub-hint { display: block; font-size: .72rem; color: var(--muted-foreground); margin-top: .2rem; }
          .sub-mine { display: flex; flex-direction: column; gap: .5rem; }
          .sub-mine-row { padding: .65rem .85rem; background: var(--card); border: 1px solid var(--border); border-radius: .4rem; }
          .sub-mine-row > div { display: flex; justify-content: space-between; align-items: center; gap: .5rem; flex-wrap: wrap; }
          .sub-status { padding: .1rem .55rem; border-radius: 999px; font-size: .65rem; font-weight: 700; text-transform: uppercase; letter-spacing: .03em; }
          .sub-status-pending_review { background: #fef3c7; color: #92400e; }
          .sub-status-published { background: #dcfce7; color: #166534; }
          .sub-status-rejected { background: #fee2e2; color: #991b1b; }
          .sub-status-draft { background: #f1f5f9; color: #475569; }
        `}</style>
      </section>
    </>
  );
}

const STATUS_LABEL = {
  draft: 'Draft',
  pending_review: 'Awaiting review',
  published: 'Live',
  rejected: 'Needs changes',
  archived: 'Archived',
};

// ─── PDF uploader ─────────────────────────────────────────────────────────
// Picks a single PDF, validates client-side (PDF mime + 15 MB cap), base64-
// encodes, POSTs to /api/resources/upload-pdf, and reports the returned
// file_id back to the parent form. Supports drag-and-drop and click-to-pick.
//
// After a successful upload, replaces the picker with a tidy filename + size
// + "Remove" pill so the user has visual confirmation. Re-selecting a file
// replaces the previous one (the abandoned row in the files table becomes
// orphaned — an acceptable trade for the simpler UX).
const PDF_MAX_BYTES = 15 * 1024 * 1024;

function PdfUploader({ fileId, onUploaded, onCleared }) {
  const [uploading, setUploading] = useState(false);
  const [pickedName, setPickedName] = useState('');
  const [pickedSize, setPickedSize] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [err, setErr] = useState('');

  const handleFile = async (file) => {
    setErr('');
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setErr('Only PDF files are accepted.');
      return;
    }
    if (file.size > PDF_MAX_BYTES) {
      setErr(`PDF is too big (max ${Math.round(PDF_MAX_BYTES / (1024 * 1024))} MB).`);
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result));
        fr.onerror = () => reject(new Error('Could not read the file'));
        fr.readAsDataURL(file);
      });
      const data_base64 = dataUrl.replace(/^data:[^;]+;base64,/, '');
      const r = await fetch('/api/resources/upload-pdf', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: file.name,
          mime_type: 'application/pdf',
          data_base64,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Upload failed');
      onUploaded(j.id);
      setPickedName(file.name);
      setPickedSize(file.size);
    } catch (e) {
      setErr(e.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const clear = () => {
    setPickedName('');
    setPickedSize(0);
    setErr('');
    onCleared();
  };

  // Once uploaded, show a tidy file-card with remove button.
  if (fileId && pickedName) {
    return (
      <div className="pdf-up-done">
        <span className="pdf-up-done-icon" aria-hidden>📄</span>
        <div className="pdf-up-done-body">
          <strong>{pickedName}</strong>
          <span className="muted-text">{(pickedSize / (1024 * 1024)).toFixed(2)} MB · uploaded ✓</span>
        </div>
        <button type="button" className="pdf-up-done-remove" onClick={clear}>Remove</button>
        <style>{PDF_UP_STYLES}</style>
      </div>
    );
  }

  return (
    <>
      <div
        className={'pdf-up-drop' + (dragOver ? ' is-over' : '') + (uploading ? ' is-busy' : '')}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (uploading) return;
          const file = e.dataTransfer.files?.[0];
          if (file) handleFile(file);
        }}
        onClick={() => !uploading && document.getElementById('pdf-up-input')?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !uploading) document.getElementById('pdf-up-input')?.click(); }}
      >
        {uploading ? (
          <>
            <span className="pdf-up-spinner" />
            <strong>Uploading…</strong>
          </>
        ) : (
          <>
            <span className="pdf-up-icon" aria-hidden>📄</span>
            <strong>Click to choose a PDF, or drop it here</strong>
            <span className="muted-text">PDF only · max 15 MB</span>
          </>
        )}
        <input
          id="pdf-up-input"
          type="file"
          accept="application/pdf,.pdf"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            // Reset so the same file can be re-picked if needed.
            e.target.value = '';
          }}
        />
      </div>
      {err && <div className="pdf-up-err">{err}</div>}
      <style>{PDF_UP_STYLES}</style>
    </>
  );
}

const PDF_UP_STYLES = `
  .pdf-up-drop {
    display: flex; flex-direction: column; align-items: center; gap: .35rem;
    padding: 1.5rem 1rem; text-align: center;
    border: 2px dashed var(--border); border-radius: .5rem;
    background: var(--card); cursor: pointer;
    transition: all .12s;
  }
  .pdf-up-drop:hover, .pdf-up-drop.is-over {
    border-color: var(--primary); background: rgba(37, 99, 235, .04);
  }
  .pdf-up-drop.is-busy { cursor: wait; opacity: .85; }
  .pdf-up-icon { font-size: 1.85rem; line-height: 1; }
  .pdf-up-drop strong { font-size: .9rem; }
  .pdf-up-drop .muted-text { font-size: .75rem; }
  .pdf-up-spinner {
    width: 1.5rem; height: 1.5rem;
    border: 2px solid rgba(30, 64, 175, .15);
    border-top-color: var(--primary, #1e40af);
    border-radius: 50%;
    animation: pdf-up-spin .8s linear infinite;
  }
  @keyframes pdf-up-spin { to { transform: rotate(360deg); } }

  .pdf-up-done {
    display: flex; align-items: center; gap: .65rem;
    padding: .7rem .85rem;
    background: #ecfdf5; border: 1px solid #6ee7b7;
    border-radius: .5rem;
  }
  .pdf-up-done-icon { font-size: 1.5rem; line-height: 1; }
  .pdf-up-done-body { flex: 1; display: flex; flex-direction: column; gap: .1rem; min-width: 0; }
  .pdf-up-done-body strong { font-size: .875rem; color: #065f46; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pdf-up-done-body span { font-size: .72rem; }
  .pdf-up-done-remove {
    background: transparent; border: 1px solid #6ee7b7; color: #065f46;
    border-radius: .35rem; padding: .25rem .6rem;
    font: inherit; font-size: .72rem; font-weight: 600;
    cursor: pointer;
  }
  .pdf-up-done-remove:hover { background: #fee2e2; color: #991b1b; border-color: #fecaca; }

  .pdf-up-err {
    margin-top: .35rem; padding: .4rem .55rem;
    background: #fee2e2; color: #991b1b;
    border-radius: .35rem;
    font-size: .75rem;
  }
`;

function Field({ label, required, children }) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: '.8125rem', fontWeight: 600, marginBottom: '.35rem' }}>
        {label} {required && <span style={{ color: 'var(--destructive)' }}>*</span>}
      </div>
      {children}
      <style>{`
        label input[type=text], label input[type=date], label textarea, label select {
          width: 100%; padding: .55rem .65rem;
          border: 1px solid var(--border); border-radius: .375rem;
          background: var(--card); color: var(--foreground);
          font: inherit;
        }
        label input:focus, label textarea:focus, label select:focus { outline: 2px solid var(--primary); outline-offset: -1px; }
        label textarea { resize: vertical; min-height: 80px; }
      `}</style>
    </label>
  );
}
