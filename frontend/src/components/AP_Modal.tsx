import {
  ReactNode,
  useEffect,
} from 'react';

export interface APModalAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  isLoading?: boolean;
  disabled?: boolean;
}

export interface APModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  actions?: APModalAction[];
  closeOnBackdropClick?: boolean;
  className?: string;
}

const actionClasses: Record<
  NonNullable<APModalAction['variant']>,
  string
> = {
  primary:
    'bg-blue-600 text-white hover:bg-blue-700',
  secondary:
    'border border-gray-300 bg-white text-gray-800 hover:bg-gray-50',
  danger:
    'bg-red-600 text-white hover:bg-red-700',
};

export default function AP_Modal({
  isOpen,
  onClose,
  title,
  children,
  actions = [],
  closeOnBackdropClick = true,
  className = '',
}: APModalProps) {
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener(
      'keydown',
      handleKeyDown,
    );

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener(
        'keydown',
        handleKeyDown,
      );

      document.body.style.overflow =
        previousOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ap-modal-title"
    >
      <button
        type="button"
        aria-label="Close modal"
        className="absolute inset-0 cursor-default bg-black/40"
        onClick={() => {
          if (closeOnBackdropClick) {
            onClose();
          }
        }}
      />

      <div
        className={[
          'relative z-10 w-full max-w-lg rounded-2xl bg-white shadow-xl',
          className,
        ].join(' ')}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2
            id="ap-modal-title"
            className="text-lg font-semibold text-gray-900"
          >
            {title}
          </h2>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md px-2 py-1 text-xl text-gray-500 hover:bg-gray-100 hover:text-gray-900"
          >
            ×
          </button>
        </div>

        <div className="px-5 py-5">
          {children}
        </div>

        {actions.length > 0 && (
          <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 px-5 py-4">
            {actions.map((action) => {
              const variant =
                action.variant || 'primary';

              return (
                <button
                  key={action.label}
                  type="button"
                  onClick={action.onClick}
                  disabled={
                    action.disabled ||
                    action.isLoading
                  }
                  className={[
                    'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium',
                    'disabled:cursor-not-allowed disabled:opacity-60',
                    actionClasses[variant],
                  ].join(' ')}
                >
                  {action.isLoading && (
                    <span
                      className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                      aria-hidden="true"
                    />
                  )}

                  {action.isLoading
                    ? 'Saving…'
                    : action.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}