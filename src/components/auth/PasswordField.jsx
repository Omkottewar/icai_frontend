import { IconEye, IconEyeOff } from '../../icons';

export default function PasswordField({ label, value, onChange, placeholder = '••••••••', show, setShow, autoComplete }) {
  return (
    <div>
      <label className="field-label">{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          className="input-base"
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          style={{ paddingRight: '2.5rem' }}
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          style={{ position: 'absolute', right: '.625rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)' }}
        >
          {show ? <IconEyeOff size="sm" /> : <IconEye size="sm" />}
        </button>
      </div>
    </div>
  );
}
