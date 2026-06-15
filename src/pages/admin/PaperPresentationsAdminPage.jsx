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
  { type: 'group', children: [
    { name: 'sort_order', label: 'Sort order', type: 'number' },
    { name: 'hidden',     label: 'Hide from public', type: 'checkbox', help: 'unchecked = visible' },
  ]},
];

const COLUMNS = [
  { key: 'title', label: 'Title', render: (r) => <strong>{r.title}</strong> },
  { key: 'speaker_name', label: 'Speaker' },
  { key: 'committee_tag', label: 'Committee' },
  { key: 'presented_on', label: 'Date', render: (r) => fmt(r.presented_on) },
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
