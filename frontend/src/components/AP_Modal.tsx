import { useEffect, type ReactNode } from 'react';

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
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="ap-modal-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (
          closeOnBackdropClick &&
          event.target === event.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <section
        className={`ap-modal-dialog ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ap-modal-title"
      >
        <header className="ap-modal-header">
          <h2 id="ap-modal-title">{title}</h2>

          <button
            type="button"
            className="ap-modal-close"
            onClick={onClose}
            aria-label="Close dialog"
          >
            ×
          </button>
        </header>

        <div className="ap-modal-content">{children}</div>

        {actions.length > 0 && (
          <footer className="ap-modal-actions">
            {actions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={action.onClick}
                disabled={action.disabled || action.isLoading}
                className={`ap-modal-action ap-modal-action--${
                  action.variant ?? 'primary'
                }`}
              >
                {action.isLoading && (
                  <span className="ap-modal-spinner" aria-hidden="true" />
                )}
                {action.isLoading ? 'Saving…' : action.label}
              </button>
            ))}
          </footer>
        )}
      </section>
    </div>
  );
}