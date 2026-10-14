import { useState, type InputHTMLAttributes } from 'react';
import Icon from './Icon';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

/** Password field with a show/hide (eye) toggle. Accepts every normal <input> prop. */
export default function PasswordInput({ className = 'input', ...props }: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="password-field">
      <input {...props} type={visible ? 'text' : 'password'} className={className} />
      <button
        type="button"
        className="password-toggle"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        title={visible ? 'Hide password' : 'Show password'}
      >
        <Icon name={visible ? 'eyeOff' : 'eye'} size={18} />
      </button>
    </div>
  );
}
