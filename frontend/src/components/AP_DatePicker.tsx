import {
  useEffect,
  useMemo,
  useState,
} from 'react';

export interface APDatePickerProps {
  value: string;
  onChange: (date: string) => void;
  minDate?: string;
  disabledDates?: string[];
  availableDates?: string[];
  label?: string;
  disabled?: boolean;
  className?: string;
}

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function formatDate(
  year: number,
  month: number,
  day: number,
): string {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function parseDate(value: string): Date | null {
  if (!value) {
    return null;
  }

  const [year, month, day] = value
    .split('-')
    .map(Number);

  if (
    !year ||
    !month ||
    !day ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }

  return new Date(year, month - 1, day);
}

function startOfDay(date: Date): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
}

function getTodayString(): string {
  const today = new Date();

  return formatDate(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
}

export default function AP_DatePicker({
  value,
  onChange,
  minDate = getTodayString(),
  disabledDates = [],
  availableDates = [],
  label = 'Date',
  disabled = false,
  className = '',
}: APDatePickerProps) {
  const selectedDate = parseDate(value);
  const initialDate = selectedDate || parseDate(minDate) || new Date();

  const [visibleMonth, setVisibleMonth] = useState(
    new Date(
      initialDate.getFullYear(),
      initialDate.getMonth(),
      1,
    ),
  );

  useEffect(() => {
    const nextSelectedDate = parseDate(value);

    if (nextSelectedDate) {
      setVisibleMonth(
        new Date(
          nextSelectedDate.getFullYear(),
          nextSelectedDate.getMonth(),
          1,
        ),
      );
    }
  }, [value]);

  const cells = useMemo(() => {
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const mondayFirstOffset =
      (firstDay.getDay() + 6) % 7;

    const totalCells = Math.ceil(
      (mondayFirstOffset + lastDay.getDate()) / 7,
    ) * 7;

    return Array.from({ length: totalCells }, (_, index) => {
      const dayNumber =
        index - mondayFirstOffset + 1;

      if (
        dayNumber < 1 ||
        dayNumber > lastDay.getDate()
      ) {
        return null;
      }

      return {
        day: dayNumber,
        date: formatDate(year, month, dayNumber),
      };
    });
  }, [visibleMonth]);

  const minimumDate = parseDate(minDate) || startOfDay(new Date());

  const disabledSet = useMemo(
    () => new Set(disabledDates),
    [disabledDates],
  );

  const availableSet = useMemo(
    () => new Set(availableDates),
    [availableDates],
  );

  const monthLabel = visibleMonth.toLocaleDateString(
    'en-US',
    {
      month: 'long',
      year: 'numeric',
    },
  );

  const goPreviousMonth = () => {
    const previous = new Date(
      visibleMonth.getFullYear(),
      visibleMonth.getMonth() - 1,
      1,
    );

    const minimumMonth = new Date(
      minimumDate.getFullYear(),
      minimumDate.getMonth(),
      1,
    );

    if (previous >= minimumMonth) {
      setVisibleMonth(previous);
    }
  };

  const goNextMonth = () => {
    setVisibleMonth(
      new Date(
        visibleMonth.getFullYear(),
        visibleMonth.getMonth() + 1,
        1,
      ),
    );
  };

  const handleSelect = (dateString: string) => {
    if (disabled) {
      return;
    }

    const date = parseDate(dateString);

    if (!date) {
      return;
    }

    if (startOfDay(date) < startOfDay(minimumDate)) {
      return;
    }

    if (disabledSet.has(dateString)) {
      return;
    }

    onChange(dateString);
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-800">
          {label}
        </h3>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={goPreviousMonth}
            disabled={disabled}
            aria-label="Previous month"
            className="rounded-md px-2 py-1 text-gray-600 hover:bg-gray-100 disabled:opacity-40"
          >
            ‹
          </button>

          <span className="min-w-32 text-center text-sm font-semibold">
            {monthLabel}
          </span>

          <button
            type="button"
            onClick={goNextMonth}
            disabled={disabled}
            aria-label="Next month"
            className="rounded-md px-2 py-1 text-gray-600 hover:bg-gray-100 disabled:opacity-40"
          >
            ›
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((weekday) => (
          <div
            key={weekday}
            className="py-2 text-center text-xs font-semibold text-gray-500"
          >
            {weekday}
          </div>
        ))}

        {cells.map((cell, index) => {
          if (!cell) {
            return (
              <div
                key={`empty-${index}`}
                className="h-10"
              />
            );
          }

          const date = parseDate(cell.date);
          const isPast =
            !date ||
            startOfDay(date) < startOfDay(minimumDate);

          const isDisabled =
            disabled ||
            isPast ||
            disabledSet.has(cell.date);

          const isSelected = value === cell.date;
          const isAvailable = availableSet.has(cell.date);

          return (
            <button
              key={cell.date}
              type="button"
              onClick={() => handleSelect(cell.date)}
              disabled={isDisabled}
              aria-label={cell.date}
              aria-pressed={isSelected}
              className={[
                'relative flex h-10 items-center justify-center rounded-lg text-sm',
                'transition-colors',
                isSelected
                  ? 'bg-blue-600 text-white'
                  : isDisabled
                    ? 'cursor-not-allowed text-gray-300'
                    : 'text-gray-800 hover:bg-blue-50',
              ].join(' ')}
            >
              {cell.day}

              {isAvailable && !isDisabled && (
                <span
                  aria-hidden="true"
                  className={[
                    'absolute bottom-1 h-1 w-1 rounded-full',
                    isSelected
                      ? 'bg-white'
                      : 'bg-blue-600',
                  ].join(' ')}
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-gray-500">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-blue-600" />
          Available
        </span>

        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-gray-300" />
          Disabled
        </span>
      </div>
    </div>
  );
}