import {
  ButtonHTMLAttributes,
  ReactNode,
} from 'react';

export type APButtonVariant =
  | 'primary'
  | 'secondary'
  | 'danger';

export type APButtonSize =
  | 'small'
  | 'medium'
  | 'large';

export interface APButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: APButtonVariant;
  size?: APButtonSize;
  isLoading?: boolean;
  children: ReactNode;
}

const variantClasses: Record<APButtonVariant, string> = {
  primary:
    'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
  secondary:
    'bg-gray-100 text-gray-900 hover:bg-gray-200 focus:ring-gray-400',
  danger:
    'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
};

const sizeClasses: Record<APButtonSize, string> = {
  small: 'px-3 py-1.5 text-sm',
  medium: 'px-4 py-2 text-sm',
  large: 'px-5 py-2.5 text-base',
};

export default function AP_Button({
  variant = 'primary',
  size = 'medium',
  isLoading = false,
  disabled = false,
  children,
  className = '',
  type = 'button',
  ...props
}: APButtonProps) {
  const isDisabled = disabled || isLoading;

  return (
    <button
      {...props}
      type={type}
      disabled={isDisabled}
      aria-busy={isLoading}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium',
        'transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-60',
        variantClasses[variant],
        sizeClasses[size],
        className,
      ].join(' ')}
    >
      {isLoading && (
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      )}

      <span>{isLoading ? 'Saving…' : children}</span>
    </button>
  );
}