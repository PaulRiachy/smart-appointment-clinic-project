import {
  ReactNode,
} from 'react';

export interface APTableColumn<T> {
  key: string;
  header: string;
  render: (row: T, index: number) => ReactNode;
  className?: string;
}

export interface APTableProps<T> {
  columns: APTableColumn<T>[];
  data: T[];
  rowKey?: (row: T, index: number) => string;
  isLoading?: boolean;
  loadingRows?: number;
  error?: string | null;
  emptyMessage?: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  retryLabel?: string;
  onRetry?: () => void;
  className?: string;
}

export default function AP_Table<T>({
  columns,
  data,
  rowKey,
  isLoading = false,
  loadingRows = 5,
  error = null,
  emptyMessage = 'No records found.',
  emptyActionLabel,
  onEmptyAction,
  retryLabel = 'Try again',
  onRetry,
  className = '',
}: APTableProps<T>) {
  const renderRows = () => {
    if (isLoading) {
      return Array.from(
        { length: loadingRows },
        (_, rowIndex) => (
          <tr key={`skeleton-${rowIndex}`}>
            {columns.map((column) => (
              <td
                key={column.key}
                className="px-4 py-4"
              >
                <div className="h-4 animate-pulse rounded bg-gray-200" />
              </td>
            ))}
          </tr>
        ),
      );
    }

    if (error) {
      return (
        <tr>
          <td
            colSpan={columns.length}
            className="px-6 py-12 text-center"
          >
            <div className="mx-auto max-w-md">
              <p className="font-medium text-gray-900">
                Couldn’t load the data.
              </p>

              <p className="mt-1 text-sm text-gray-500">
                {error}
              </p>

              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="mt-4 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
                >
                  {retryLabel}
                </button>
              )}
            </div>
          </td>
        </tr>
      );
    }

    if (data.length === 0) {
      return (
        <tr>
          <td
            colSpan={columns.length}
            className="px-6 py-12 text-center"
          >
            <p className="font-medium text-gray-900">
              {emptyMessage}
            </p>

            {emptyActionLabel && onEmptyAction && (
              <button
                type="button"
                onClick={onEmptyAction}
                className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                {emptyActionLabel}
              </button>
            )}
          </td>
        </tr>
      );
    }

    return data.map((row, index) => (
      <tr
        key={
          rowKey
            ? rowKey(row, index)
            : String(index)
        }
        className="border-t border-gray-100 hover:bg-gray-50"
      >
        {columns.map((column) => (
          <td
            key={column.key}
            className={[
              'px-4 py-3 text-sm text-gray-700',
              column.className || '',
            ].join(' ')}
          >
            {column.render(row, index)}
          </td>
        ))}
      </tr>
    ));
  };

  return (
    <div
      className={[
        'overflow-hidden rounded-xl border border-gray-200 bg-white',
        className,
      ].join(' ')}
    >
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={[
                    'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500',
                    column.className || '',
                  ].join(' ')}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>{renderRows()}</tbody>
        </table>
      </div>
    </div>
  );
}