import BranchContentAdmin from '../../components/admin/BranchContentAdmin';

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHS = MONTH_NAMES.map((n, i) => ({ value: String(i + 1), label: n }));

const FIELDS = [
  { name: 'title',  label: 'Issue title', type: 'text', required: true },
  { type: 'group', children: [
    { name: 'issue_month', label: 'Month', type: 'select', options: MONTHS, required: true },
    { name: 'issue_year',  label: 'Year',  type: 'number', required: true, default: new Date().getFullYear() },
  ]},
  { name: 'editor_note',   label: "Editor's note (optional)", type: 'textarea' },
  { name: 'pdf_file_id',   label: 'Newsletter PDF',  type: 'file', accept: 'application/pdf', bucket: 'newsletters' },
  { name: 'cover_file_id', label: 'Cover image',     type: 'file', accept: 'image/*',         bucket: 'newsletters' },
  { name: 'published_at',  label: 'Published at (optional)', type: 'datetime' },
  { name: 'hidden',        label: 'Hide from public', type: 'checkbox' },
];

const COLUMNS = [
  { key: 'issue', label: 'Issue', render: (r) => `${MONTH_NAMES[r.issue_month - 1]} ${r.issue_year}` },
  { key: 'title', label: 'Title', render: (r) => <strong>{r.title}</strong> },
  { key: 'hidden', label: 'Status', render: (r) => r.hidden ? 'Hidden' : 'Live' },
];

export default function NewslettersAdminPage() {
  return (
    <BranchContentAdmin
      title="Branch Newsletter"
      subtitle="Monthly newsletter PDFs surfaced on the Resources page"
      endpoint="/api/admin/newsletters"
      columns={COLUMNS}
      fields={FIELDS}
      newButtonLabel="+ New issue"
      drawerTitle="newsletter issue"
      emptyMessage="No newsletter issues yet."
    />
  );
}
