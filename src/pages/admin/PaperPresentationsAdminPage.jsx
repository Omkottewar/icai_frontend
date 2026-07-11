import BranchContentAdmin, { fmt } from '../../components/admin/BranchContentAdmin';

const COMMITTEES = [
  'GST', 'Direct Tax', 'IT', 'Audit', 'CPE', 'WICASA', 'Branch',
].map((c) => ({ value: c, label: c }));

const FIELDS = [
  { name: 'title',        label: 'Title',         type: 'text',     required: true, maxLength: 300 },
  { name: 'speaker_name', label: 'Speaker name',  type: 'text',     required: true },
  { type: 'group', children: [
    { name: 'committee_tag', label: 'Committee tag', type: 'select', options: COMMITTEES },
    { name: 'presented_on',  label: 'Presented on',  type: 'date' },
  ]},
  { name: 'description',  label: 'Description (optional)', type: 'textarea' },
  { name: 'pdf_file_id',  label: 'PDF',          type: 'file',     accept: 'application/pdf', bucket: 'paper_presentations' },
  // Best Paper award — tick the box to feature this paper on the homepage
  // showcase. Only one paper per year can hold the flag (enforced by a
  // partial unique index in migration 0089); the server auto-unsets the
  // previous winner for the same year when a new one is saved.
  { type: 'group', children: [
    { name: 'is_winner',  label: '🏆 Best Paper winner', type: 'checkbox', help: 'shown on the homepage Award Spotlight card' },
    { name: 'award_year', label: 'Award year',           type: 'number',   help: 'required when Best Paper is ticked, e.g. 2026' },
  ]},
  { type: 'group', children: [
    { name: 'sort_order', label: 'Sort order', type: 'number' },
    { name: 'hidden',     label: 'Hide from public', type: 'checkbox', help: 'unchecked = visible' },
  ]},
];

const COLUMNS = [
  { key: 'title', label: 'Title', render: (r) => (
    <span>
      {r.is_winner && <span title={`Best Paper ${r.award_year ?? ''}`} style={{ marginRight: '.35rem' }}>🏆</span>}
      <strong>{r.title}</strong>
    </span>
  ) },
  { key: 'speaker_name', label: 'Speaker' },
  { key: 'committee_tag', label: 'Committee' },
  { key: 'presented_on', label: 'Date', render: (r) => fmt(r.presented_on) },
  { key: 'award', label: 'Best Paper', render: (r) => (
    r.is_winner
      ? <span style={{ background: 'oklch(0.72 0.16 90 / 0.18)', color: 'oklch(0.42 0.14 65)', padding: '.1rem .5rem', borderRadius: 999, fontSize: '.7rem', fontWeight: 700 }}>
          Winner · {r.award_year ?? '—'}
        </span>
      : <span style={{ color: 'var(--muted-foreground)' }}>—</span>
  )},
  { key: 'hidden', label: 'Status', render: (r) => r.hidden ? 'Hidden' : 'Live' },
];

export default function PaperPresentationsAdminPage() {
  return (
    <BranchContentAdmin
      title="Paper presentations"
      subtitle="PDFs from past Nagpur Branch seminars (with ICAI disclaimer)"
      endpoint="/api/admin/paper-presentations"
      columns={COLUMNS}
      fields={FIELDS}
      newButtonLabel="+ New presentation"
      drawerTitle="paper presentation"
      emptyMessage="No presentations uploaded yet."
    />
  );
}
