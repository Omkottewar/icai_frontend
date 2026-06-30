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
  // Link this entry to a real user account so portal access stays in sync.
  // Backend: when this email matches a user AND role_code maps to an ACL
  // role (chairman / vice_chairman / secretary / treasurer / managing_
  // committee), the matching user_role_assignment is created on save and
  // ended when this row is hidden / deleted / unlinked.
  {
    name: 'linked_user_email',
    label: 'Link user (by email)',
    type: 'email',
    placeholder: 'leave blank for a display-only entry',
    help: 'When linked, removing or hiding this row also revokes the user\'s portal access for the matching role. Leave blank for historical office bearers without a portal account.',
  },
  // MCM photo — uses the in-browser ImageCropper modal so admins can pick
  // any source image and frame it square (matches the round avatar shown
  // on /about). Min source dims keep the public roster from going grainy.
  {
    name: 'photo_file_id',
    label: 'Photo',
    type: 'file',
    accept: 'image/*',
    bucket: 'office_bearers',
    crop: true,
    minWidth: 300,
    minHeight: 300,
  },
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
  {
    key: 'linked_user_email',
    label: 'Portal user',
    render: (r) => r.linked_user_email
      ? <span title="Portal access syncs with this entry" style={{ color: 'var(--primary)' }}>{r.linked_user_email}</span>
      : <span className="muted-text" title="Display-only — does not grant portal access">—</span>,
  },
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
