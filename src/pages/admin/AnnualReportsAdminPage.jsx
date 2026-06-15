import BranchContentAdmin from '../../components/admin/BranchContentAdmin';

const FIELDS = [
  { name: 'fy_label', label: 'FY label', type: 'text', required: true, placeholder: '2024-25', help: 'Format: 2024-25' },
  { name: 'title',    label: 'Title (optional)', type: 'text' },
  { name: 'summary',  label: 'Summary (optional)', type: 'textarea' },
  { name: 'pdf_file_id',   label: 'Annual Report PDF', type: 'file', accept: 'application/pdf', bucket: 'annual_reports' },
  { name: 'cover_file_id', label: 'Cover image',       type: 'file', accept: 'image/*',         bucket: 'annual_reports' },
  { name: 'published_at',  label: 'Published at',      type: 'datetime' },
  { name: 'hidden',        label: 'Hide from public',  type: 'checkbox' },
];

const COLUMNS = [
  { key: 'fy_label', label: 'FY', render: (r) => <strong>FY {r.fy_label}</strong> },
  { key: 'title',    label: 'Title' },
  { key: 'hidden',   label: 'Status', render: (r) => r.hidden ? 'Hidden' : 'Live' },
];

export default function AnnualReportsAdminPage() {
  return (
    <BranchContentAdmin
      title="Annual reports"
      subtitle="Yearly branch reports surfaced on the About page"
      endpoint="/api/admin/annual-reports"
      columns={COLUMNS}
      fields={FIELDS}
      newButtonLabel="+ New annual report"
      drawerTitle="annual report"
      emptyMessage="No annual reports uploaded yet."
    />
  );
}
