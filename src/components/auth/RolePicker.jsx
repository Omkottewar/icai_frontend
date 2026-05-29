import { IconShield, IconGraduationCap, IconBriefcase } from '../../icons';

// Self-signup roles only — Employee, MCM, Chairman and Admin are
// provisioned by the branch admin, never self-registered.
export default function RolePicker({ value, onChange }) {
  return (
    <div>
      <label className="field-label">I am a…</label>
      <div className="role-pills">
        {[
          { v: 'Member',   Icon: IconShield,          l: 'CA Member' },
          { v: 'Student',  Icon: IconGraduationCap,   l: 'Student' },
          { v: 'Employer', Icon: IconBriefcase,       l: 'Employer' },
        ].map((o) => (
          <button
            key={o.v}
            type="button"
            className={'role-pill' + (value === o.v ? ' active' : '')}
            onClick={() => onChange(o.v)}
          >
            <o.Icon size="sm" /> {o.l}
          </button>
        ))}
      </div>
    </div>
  );
}
