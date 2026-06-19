import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { adminFetch } from '../../hooks/useAdminList';
import { useAuth } from '../../context/AuthContext';
import { IconPlus, IconCheck, IconX, IconEdit, IconTrash, IconArrowRight } from '../../icons';
import { Shimmer } from '../../components/ui/Shimmer';

function ResourceListShimmer({ count = 5 }) {
  return (
    <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '.85rem 1rem' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '.35rem' }}>
            <Shimmer height=".9rem" width={`${45 + ((i * 13) % 35)}%`} />
            <Shimmer height=".7rem" width="55%" />
          </div>
          <Shimmer height="1.1rem" width="4rem" radius="999px" />
        </div>
      ))}
    </div>
  );
}

// Single admin page for all of Section L. Tabs:
//   Moderation queue · Papers · E-Journal · Topics · ICAI Link Cards
// Sub-flows (paper edit, ejournal upload, link card edit, quiz authoring)
// open as in-place expansions or modals — kept simple to avoid sprawl.

const TABS = [
  { id: 'queue',    label: 'Moderation queue' },
  { id: 'papers',   label: 'Paper presentations' },
  { id: 'ejournal', label: 'E-Journal issues' },
  { id: 'topics',   label: 'Topics' },
  { id: 'links',    label: 'ICAI link cards' },
];

export default function ResourcesAdminPage() {
  const [tab, setTab] = useState('queue');

  return (
    <AdminLayout title="Resources" subtitle="Papers, e-journal, topics and curated ICAI link-outs.">
      <div className="ra-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={'ra-tab' + (tab === t.id ? ' is-on' : '')}
            onClick={() => setTab(t.id)}
          >{t.label}</button>
        ))}
      </div>

      {tab === 'queue'    && <ModerationQueue />}
      {tab === 'papers'   && <PapersTab />}
      {tab === 'ejournal' && <EjournalTab />}
      {tab === 'topics'   && <TopicsTab />}
      {tab === 'links'    && <LinkCardsTab />}

      <style>{`
        .ra-tabs { display: flex; gap: .25rem; border-bottom: 1px solid var(--border); margin-bottom: 1rem; flex-wrap: wrap; }
        .ra-tab { padding: .55rem .85rem; background: transparent; border: 0; border-bottom: 2px solid transparent; font: inherit; font-size: .875rem; font-weight: 600; color: var(--muted-foreground); cursor: pointer; margin-bottom: -1px; }
        .ra-tab:hover { color: var(--foreground); }
        .ra-tab.is-on { color: var(--primary); border-bottom-color: var(--primary); }

        .ra-table { width: 100%; border-collapse: collapse; background: var(--card); border: 1px solid var(--border); border-radius: .5rem; overflow: hidden; }
        .ra-table th, .ra-table td { padding: .55rem .75rem; text-align: left; vertical-align: top; font-size: .85rem; border-bottom: 1px solid var(--border); }
        .ra-table th { background: var(--background, #f8fafc); font-weight: 700; color: var(--muted-foreground); font-size: .72rem; text-transform: uppercase; letter-spacing: .04em; }
        .ra-table tr:last-child td { border-bottom: 0; }

        .ra-empty { padding: 2rem; text-align: center; color: var(--muted-foreground); background: var(--card); border: 1px dashed var(--border); border-radius: .55rem; }

        .ra-pill { display: inline-block; padding: .1rem .55rem; border-radius: 999px; font-size: .65rem; font-weight: 700; text-transform: uppercase; letter-spacing: .03em; }
        .ra-pill-pending { background: #fef3c7; color: #92400e; }
        .ra-pill-published { background: #dcfce7; color: #166534; }
        .ra-pill-rejected { background: #fee2e2; color: #991b1b; }
        .ra-pill-draft { background: #f1f5f9; color: #475569; }
        .ra-pill-archived { background: #e2e8f0; color: #475569; }

        .ra-icon-btn { background: transparent; border: 1px solid transparent; padding: .35rem; cursor: pointer; border-radius: .3rem; color: var(--muted-foreground); }
        .ra-icon-btn:hover { background: var(--background); color: var(--foreground); border-color: var(--border); }
      `}</style>
    </AdminLayout>
  );
}

// ─── Moderation queue ─────────────────────────────────────────────────────
function ModerationQueue() {
  const { showToast } = useAuth();
  const [items, setItems] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = () => adminFetch('/api/admin/resources/papers/pending').then((r) => setItems(r.items || [])).catch(() => setItems([]));
  useEffect(() => { load(); }, []);

  const act = async (id, action, note) => {
    setBusy(id);
    try {
      await adminFetch(`/api/admin/resources/papers/${id}/${action}`, {
        method: 'POST',
        body: action === 'reject' ? { review_note: note } : {},
      });
      showToast(action === 'approve' ? 'Approved + submitter notified' : 'Rejected + submitter notified', 'success');
      load();
    } catch (e) { showToast(e.message, 'error'); }
    finally { setBusy(null); }
  };

  const reject = async (item) => {
    const note = prompt(`Tell ${item.submitted_by_name || 'the submitter'} what needs to change:`);
    if (!note?.trim()) return;
    act(item.id, 'reject', note.trim());
  };

  if (items === null) return <ResourceListShimmer count={5} />;
  if (items.length === 0) return <div className="ra-empty">No papers awaiting review.</div>;

  return (
    <table className="ra-table">
      <thead>
        <tr>
          <th>Paper</th>
          <th>Submitter</th>
          <th>Submitted</th>
          <th style={{ textAlign: 'right' }}>Actions</th>
        </tr>
      </thead>
      <tbody>
        {items.map((p) => (
          <tr key={p.id}>
            <td>
              <strong>{p.title}</strong>
              <div className="muted-text" style={{ fontSize: '.75rem', marginTop: '.15rem' }}>
                {p.abstract?.slice(0, 140)}{p.abstract && p.abstract.length > 140 ? '…' : ''}
              </div>
            </td>
            <td>
              {p.submitted_by_name}
              <div className="muted-text" style={{ fontSize: '.72rem' }}>{p.submitted_by_email}</div>
            </td>
            <td>{new Date(p.submitted_at).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</td>
            <td style={{ textAlign: 'right' }}>
              <a href={`#/resources/papers/${p.slug}`} className="ra-icon-btn" title="Preview" target="_blank" rel="noopener noreferrer">👁</a>
              <button className="ra-icon-btn" title="Approve" disabled={busy === p.id} onClick={() => act(p.id, 'approve')} style={{ color: '#16a34a' }}><IconCheck /></button>
              <button className="ra-icon-btn" title="Reject with note" disabled={busy === p.id} onClick={() => reject(p)} style={{ color: '#dc2626' }}><IconX /></button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── Papers tab — all statuses ────────────────────────────────────────────
function PapersTab() {
  const { showToast } = useAuth();
  const [items, setItems] = useState(null);
  const [status, setStatus] = useState('');

  const load = () => {
    const url = status ? `/api/admin/resources/papers?status=${status}` : '/api/admin/resources/papers';
    adminFetch(url).then((r) => setItems(r.items || [])).catch(() => setItems([]));
  };
  useEffect(load, [status]);

  const remove = async (id) => {
    if (!confirm('Delete this paper? This cannot be undone.')) return;
    try { await adminFetch(`/api/admin/resources/papers/${id}`, { method: 'DELETE' }); showToast('Deleted', 'success'); load(); }
    catch (e) { showToast(e.message, 'error'); }
  };

  if (items === null) return <ResourceListShimmer count={5} />;

  return (
    <>
      <div style={{ display: 'flex', gap: '.5rem', marginBottom: '.75rem', alignItems: 'center' }}>
        <label style={{ fontSize: '.85rem' }}>
          Status:&nbsp;
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ padding: '.35rem .55rem', borderRadius: '.35rem', border: '1px solid var(--border)' }}>
            <option value="">All</option>
            <option value="published">Published</option>
            <option value="pending_review">Pending review</option>
            <option value="rejected">Rejected</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <span className="muted-text" style={{ marginLeft: 'auto', fontSize: '.8rem' }}>{items.length} paper(s)</span>
      </div>
      {items.length === 0
        ? <div className="ra-empty">No papers match this filter.</div>
        : (
          <table className="ra-table">
            <thead><tr><th>Title</th><th>Speaker</th><th>Status</th><th>Views</th><th></th></tr></thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id}>
                  <td>
                    <a href={`#/resources/papers/${p.slug}`} target="_blank" rel="noopener noreferrer"><strong>{p.title}</strong></a>
                  </td>
                  <td>{p.speaker_name}</td>
                  <td><span className={'ra-pill ra-pill-' + p.status}>{p.status.replace('_', ' ')}</span></td>
                  <td>{p.view_count}</td>
                  <td style={{ textAlign: 'right' }}>
                    <a href={`#/admin/resources/papers/${p.id}/quiz`} className="ra-icon-btn" title="Quiz">📝</a>
                    <button className="ra-icon-btn" title="Delete" onClick={() => remove(p.id)} style={{ color: '#dc2626' }}><IconTrash /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      }
    </>
  );
}

// ─── E-Journal tab ────────────────────────────────────────────────────────
function EjournalTab() {
  const { showToast } = useAuth();
  const [items, setItems] = useState(null);
  const [editing, setEditing] = useState(null); // null | {} for new | row for edit
  const [topics, setTopics] = useState([]);

  const load = () => adminFetch('/api/admin/resources/ejournal-issues').then((r) => setItems(r.items || [])).catch(() => setItems([]));
  useEffect(() => {
    load();
    adminFetch('/api/admin/resources/topics').then((r) => setTopics(r.items || []));
  }, []);

  const remove = async (id) => {
    if (!confirm('Delete this issue?')) return;
    try { await adminFetch(`/api/admin/resources/ejournal-issues/${id}`, { method: 'DELETE' }); showToast('Deleted', 'success'); load(); }
    catch (e) { showToast(e.message, 'error'); }
  };

  if (items === null) return <ResourceListShimmer count={5} />;

  return (
    <>
      <div style={{ marginBottom: '.75rem', textAlign: 'right' }}>
        <button className="btn btn-primary" onClick={() => setEditing({})}><IconPlus size="sm" /> <span>New issue</span></button>
      </div>
      {items.length === 0
        ? <div className="ra-empty">No e-journal issues yet.</div>
        : (
          <table className="ra-table">
            <thead><tr><th>Title</th><th>Issue</th><th>Year</th><th></th></tr></thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id}>
                  <td><strong>{i.title}</strong></td>
                  <td>{i.issue_label}</td>
                  <td>{i.issue_year}{i.issue_quarter ? ` Q${i.issue_quarter}` : ''}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="ra-icon-btn" title="Edit" onClick={() => setEditing(i)}><IconEdit /></button>
                    <button className="ra-icon-btn" title="Delete" onClick={() => remove(i.id)} style={{ color: '#dc2626' }}><IconTrash /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      }
      {editing !== null && <EjournalEditor row={editing} topics={topics} onClose={() => { setEditing(null); load(); }} />}
    </>
  );
}

function EjournalEditor({ row, topics, onClose }) {
  const { showToast } = useAuth();
  const isNew = !row.id;
  const [form, setForm] = useState({
    title: row.title || '',
    issue_label: row.issue_label || '',
    issue_year: row.issue_year || new Date().getFullYear(),
    issue_quarter: row.issue_quarter || '',
    pdf_file_id: row.pdf_file_id || '',
    cover_file_id: row.cover_file_id || '',
    editorial_summary: row.editorial_summary || '',
    topic_ids: [],
  });
  const [busy, setBusy] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const url = isNew ? '/api/admin/resources/ejournal-issues' : `/api/admin/resources/ejournal-issues/${row.id}`;
      const method = isNew ? 'POST' : 'PATCH';
      await adminFetch(url, { method, body: form });
      showToast(isNew ? 'Created' : 'Updated', 'success');
      onClose();
    } catch (e2) { showToast(e2.message, 'error'); }
    finally { setBusy(false); }
  };

  return (
    <div className="ra-modal" onClick={onClose}>
      <form onSubmit={save} className="ra-modal-card" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ margin: 0, fontSize: '1.1rem' }}>{isNew ? 'New e-journal issue' : 'Edit issue'}</h2>

        <label>Title<input required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} /></label>
        <label>Issue label<input required placeholder="e.g. Vol III, Issue 2 — Apr-Jun 2026" value={form.issue_label} onChange={(e) => setForm((f) => ({ ...f, issue_label: e.target.value }))} /></label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.5rem' }}>
          <label>Year<input type="number" required value={form.issue_year} onChange={(e) => setForm((f) => ({ ...f, issue_year: Number(e.target.value) }))} /></label>
          <label>Quarter (1-4)<input type="number" min="1" max="4" value={form.issue_quarter} onChange={(e) => setForm((f) => ({ ...f, issue_quarter: e.target.value }))} /></label>
        </div>
        <label>PDF file ID<input required value={form.pdf_file_id} onChange={(e) => setForm((f) => ({ ...f, pdf_file_id: e.target.value }))} placeholder="Paste file UUID" /></label>
        <label>Cover file ID (optional)<input value={form.cover_file_id} onChange={(e) => setForm((f) => ({ ...f, cover_file_id: e.target.value }))} /></label>
        <label>Editorial summary<textarea rows={3} value={form.editorial_summary} onChange={(e) => setForm((f) => ({ ...f, editorial_summary: e.target.value }))} /></label>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '.5rem', marginTop: '.5rem' }}>
          <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
      <style>{MODAL_STYLES}</style>
    </div>
  );
}

// ─── Topics tab ───────────────────────────────────────────────────────────
function TopicsTab() {
  const { showToast } = useAuth();
  const [items, setItems] = useState(null);

  const load = () => adminFetch('/api/admin/resources/topics').then((r) => setItems(r.items || [])).catch(() => setItems([]));
  useEffect(load, []);

  const toggleActive = async (t) => {
    try { await adminFetch(`/api/admin/resources/topics/${t.id}`, { method: 'PATCH', body: { active: !t.active } }); load(); }
    catch (e) { showToast(e.message, 'error'); }
  };

  const addTopic = async () => {
    const name = prompt('Topic name (e.g. "Crypto Tax"):');
    if (!name?.trim()) return;
    const code = prompt('Short code (lowercase, no spaces — e.g. "crypto"):', name.toLowerCase().replace(/[^a-z0-9]+/g, '_'));
    if (!code?.trim()) return;
    try { await adminFetch('/api/admin/resources/topics', { method: 'POST', body: { name: name.trim(), code: code.trim() } }); load(); }
    catch (e) { showToast(e.message, 'error'); }
  };

  if (items === null) return <ResourceListShimmer count={5} />;
  return (
    <>
      <div style={{ marginBottom: '.75rem', textAlign: 'right' }}>
        <button className="btn btn-primary" onClick={addTopic}><IconPlus size="sm" /> <span>New topic</span></button>
      </div>
      <table className="ra-table">
        <thead><tr><th>Name</th><th>Code</th><th>Description</th><th>Active</th></tr></thead>
        <tbody>
          {items.map((t) => (
            <tr key={t.id}>
              <td><strong>{t.name}</strong></td>
              <td><code>{t.code}</code></td>
              <td className="muted-text">{t.description || '—'}</td>
              <td>
                <button className="ra-icon-btn" onClick={() => toggleActive(t)}>
                  {t.active ? '✓ Active' : '○ Inactive'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

// ─── Link cards tab ──────────────────────────────────────────────────────
function LinkCardsTab() {
  const { showToast } = useAuth();
  const [items, setItems] = useState(null);
  const [editing, setEditing] = useState(null);

  const load = () => adminFetch('/api/admin/resources/link-cards').then((r) => setItems(r.items || [])).catch(() => setItems([]));
  useEffect(load, []);

  const remove = async (id) => {
    if (!confirm('Delete this link card?')) return;
    try { await adminFetch(`/api/admin/resources/link-cards/${id}`, { method: 'DELETE' }); load(); }
    catch (e) { showToast(e.message, 'error'); }
  };

  if (items === null) return <ResourceListShimmer count={5} />;
  return (
    <>
      <div style={{ marginBottom: '.75rem', textAlign: 'right' }}>
        <button className="btn btn-primary" onClick={() => setEditing({})}><IconPlus size="sm" /> <span>New link card</span></button>
      </div>
      <table className="ra-table">
        <thead><tr><th>Title</th><th>Category</th><th>URL</th><th></th></tr></thead>
        <tbody>
          {items.map((c) => (
            <tr key={c.id}>
              <td><strong>{c.icon_emoji} {c.title}</strong>{c.description && <div className="muted-text" style={{ fontSize: '.72rem' }}>{c.description}</div>}</td>
              <td><span className="ra-pill ra-pill-draft">{c.category}</span></td>
              <td><a href={c.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '.78rem' }}>{c.url.slice(0, 50)}…</a></td>
              <td style={{ textAlign: 'right' }}>
                <button className="ra-icon-btn" onClick={() => setEditing(c)}><IconEdit /></button>
                <button className="ra-icon-btn" onClick={() => remove(c.id)} style={{ color: '#dc2626' }}><IconTrash /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {editing !== null && <LinkCardEditor row={editing} onClose={() => { setEditing(null); load(); }} />}
    </>
  );
}

function LinkCardEditor({ row, onClose }) {
  const { showToast } = useAuth();
  const isNew = !row.id;
  const [form, setForm] = useState({
    category: row.category || 'circulars',
    title: row.title || '',
    description: row.description || '',
    url: row.url || '',
    icon_emoji: row.icon_emoji || '🔗',
    sort_order: row.sort_order ?? 0,
    active: row.active ?? true,
  });
  const [busy, setBusy] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const url = isNew ? '/api/admin/resources/link-cards' : `/api/admin/resources/link-cards/${row.id}`;
      await adminFetch(url, { method: isNew ? 'POST' : 'PATCH', body: form });
      showToast(isNew ? 'Created' : 'Updated', 'success');
      onClose();
    } catch (e2) { showToast(e2.message, 'error'); }
    finally { setBusy(false); }
  };

  return (
    <div className="ra-modal" onClick={onClose}>
      <form onSubmit={save} className="ra-modal-card" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ margin: 0, fontSize: '1.1rem' }}>{isNew ? 'New link card' : 'Edit link card'}</h2>
        <label>Category
          <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
            <option value="circulars">Circulars</option>
            <option value="standards">Standards</option>
            <option value="knowledge_repo">Knowledge Repo</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label>Title<input required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} /></label>
        <label>Description<input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></label>
        <label>URL<input required type="url" value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} /></label>
        <label>Icon emoji<input value={form.icon_emoji} onChange={(e) => setForm((f) => ({ ...f, icon_emoji: e.target.value }))} maxLength={4} /></label>
        <label>Sort order<input type="number" value={form.sort_order} onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) }))} /></label>
        <label style={{ display: 'flex', gap: '.4rem', alignItems: 'center', flexDirection: 'row' }}>
          <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} />
          <span>Active</span>
        </label>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '.5rem', marginTop: '.5rem' }}>
          <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
      <style>{MODAL_STYLES}</style>
    </div>
  );
}

const MODAL_STYLES = `
  .ra-modal { position: fixed; inset: 0; background: rgba(15,23,42,.45); z-index: 200; display: flex; align-items: flex-start; justify-content: center; padding: 4vh 1rem; overflow-y: auto; }
  .ra-modal-card { background: var(--card); border-radius: .55rem; box-shadow: 0 20px 50px rgba(0,0,0,.25); padding: 1.25rem; width: 100%; max-width: 560px; display: flex; flex-direction: column; gap: .65rem; }
  .ra-modal-card label { display: flex; flex-direction: column; gap: .25rem; font-size: .85rem; font-weight: 600; }
  .ra-modal-card input, .ra-modal-card textarea, .ra-modal-card select { width: 100%; padding: .45rem .55rem; border: 1px solid var(--border); border-radius: .35rem; font: inherit; }
`;
