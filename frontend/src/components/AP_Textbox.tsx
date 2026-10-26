import {
  ChangeEvent,
  InputHTMLAttributes,
  useId,
} from 'react';

export interface APTextboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value'> {
  label: string;
  value: string | number;
  error?: string;
  helpText?: string;
}

export default function AP_Textbox({
  label,
  value,
  error,
  helpText,
  id,
  onChange,
  className = '',
  ...props
}: APTextboxProps) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const helpId = `${inputId}-help`;
  const errorId = `${inputId}-error`;

  const handleChange = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    onChange?.(event);
  };

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={inputId}
        className="block text-sm font-medium text-gray-800"
      >
        {label}
      </label>

      <input
        {...props}
        id={inputId}
        value={value}
        onChange={handleChange}
        aria-invalid={Boolean(error)}
        aria-describedby={
          error ? errorId : helpText ? helpId : undefined
        }
        className={[
          'block w-full rounded-lg border px-3 py-2 text-sm',
          'bg-white text-gray-900 outline-none transition',
          'focus:ring-2',
          error
            ? 'border-red-500 focus:border-red-500 focus:ring-red-200'
            : 'border-gray-300 focus:border-blue-500 focus:ring-blue-200',
          'disabled:cursor-not-allowed disabled:bg-gray-100',
          className,
        ].join(' ')}
      />

      {error && (
        <p
          id={errorId}
          className="text-sm text-red-600"
          role="alert"
        >
          {error}
        </p>
      )}

      {!error && helpText && (
        <p
          id={helpId}
          className="text-sm text-gray-500"
        >
          {helpText}
        </p>
      )}
    </div>
  );
}