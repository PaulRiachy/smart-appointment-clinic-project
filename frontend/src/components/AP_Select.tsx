import {
  SelectHTMLAttributes,
  useId,
} from 'react';

export interface APSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface APSelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'value'> {
  label: string;
  options: APSelectOption[];
  value: string;
  error?: string;
  placeholder?: string;
}

export default function AP_Select({
  label,
  options,
  value,
  error,
  placeholder,
  id,
  className = '',
  ...props
}: APSelectProps) {
  const generatedId = useId();
  const selectId = id || generatedId;
  const errorId = `${selectId}-error`;

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={selectId}
        className="block text-sm font-medium text-gray-800"
      >
        {label}
      </label>

      <select
        {...props}
        id={selectId}
        value={value}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
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
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}

        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </option>
        ))}
      </select>

      {error && (
        <p
          id={errorId}
          className="text-sm text-red-600"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}