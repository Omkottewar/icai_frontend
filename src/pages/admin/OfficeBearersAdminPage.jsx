import BranchContentAdmin, { fmt } from '../../components/admin/BranchContentAdmin';

const ROLE_CODES = [
  { value: 'chairman',           label: 'Chairman' },
  { value: 'vice_chairman',      label: 'Vice-Chairman' },
  { value: 'secretary',          label: 'Secretary' },
  { value: 'treasurer',          label: 'Treasurer' },
  { value: 'wicasa_chairman',    label: 'WICASA Chairman' },
  { value: 'imm_past_chairman',  label: 'Immediate Past Chairman' },
  { value: 'managing_committee', label: 'Managing Committee' },
  { value: 'member',             label: 'Member' },
];

const FIELDS = [
  { type: 'group', children: [
    { name: 'term_label',  label: 'Term label', type: 'text', required: true, placeholder: '2025-26', help: 'e.g. 2025-26' },
    { name: 'role_label',  label: 'Role label', type: 'text', required: true, placeholder: 'Chairman' },
  ]},
  { name: 'role_code',    label: 'Role code (canonical)', type: 'select', options: ROLE_CODES },
  { name: 'person_name',  label: 'Person name', type: 'text', required: true },
  { name: 'photo_file_id', label: 'Photo',      type: 'file', accept: 'image/*', bucket: 'office_bearers' },
  { name: 'bio',          label: 'Bio (optional)', type: 'textarea', rows: 4 },
  { type: 'group', children: [
    { name: 'email', label: 'Email (optional)', type: 'email' },
    { name: 'phone', label: 'Phone (optional)', type: 'text' },
  ]},
  { type: 'group', children: [
    { name: 'tenure_start', label: 'Tenure start', type: 'date' },
    { name: 'tenure_end',   label: 'Tenure end',   type: 'date' },
  ]},
  { type: 'group', children: [
    { name: 'is_current', label: 'Current Managing Committee member', type: 'checkbox' },
    { name: 'sort_order', label: 'Sort order', type: 'number' },
  ]},
  { name: 'hidden', label: 'Hide from public', type: 'checkbox' },
];

const COLUMNS = [
  { key: 'term_label', label: 'Term', width: '90px' },
  { key: 'person_name', label: 'Person', render: (r) => <strong>{r.person_name}</strong> },
  { key: 'role_label', label: 'Role' },
  { key: 'tenure', label: 'Tenure', render: (r) => `${fmt(r.tenure_start)} → ${fmt(r.tenure_end)}` },
  { key: 'is_current', label: 'Current?', render: (r) => r.is_current ? '✓' : '' },
  { key: 'hidden', label: 'Status', render: (r) => r.hidden ? 'Hidden' : 'Live' },
];

export default function OfficeBearersAdminPage() {
  return (
    <BranchContentAdmin
      title="Office bearers"
      subtitle="Current Managing Committee + historical record (Past Chairmen are filtered from this list)"
      endpoint="/api/admin/office-bearers"
      columns={COLUMNS}
      fields={FIELDS}
      newButtonLabel="+ New office bearer"
      drawerTitle="office bearer"
      emptyMessage="No office bearers added yet."
    />
  );
}
