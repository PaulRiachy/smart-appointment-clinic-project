import { useEffect, useMemo, useState } from 'react';
import './styles/AP_DatePicker.css';

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

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function parseDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) return null;

  return date;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getTodayString(): string {
  const today = new Date();
  return formatDate(today.getFullYear(), today.getMonth(), today.getDate());
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
    () => new Date(initialDate.getFullYear(), initialDate.getMonth(), 1),
  );

  useEffect(() => {
    const nextSelectedDate = parseDate(value);
    if (nextSelectedDate) {
      setVisibleMonth(new Date(nextSelectedDate.getFullYear(), nextSelectedDate.getMonth(), 1));
    }
  }, [value]);

  const cells = useMemo(() => {
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const mondayFirstOffset = (firstDay.getDay() + 6) % 7;
    const totalCells = Math.ceil((mondayFirstOffset + lastDay.getDate()) / 7) * 7;

    return Array.from({ length: totalCells }, (_, index) => {
      const day = index - mondayFirstOffset + 1;
      return day < 1 || day > lastDay.getDate()
        ? null
        : { day, date: formatDate(year, month, day) };
    });
  }, [visibleMonth]);

  const minimumDate = parseDate(minDate) || startOfDay(new Date());
  const disabledSet = useMemo(() => new Set(disabledDates), [disabledDates]);
  const availableSet = useMemo(() => new Set(availableDates), [availableDates]);
  const monthLabel = visibleMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const goPreviousMonth = () => {
    const previous = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1);
    const minimumMonth = new Date(minimumDate.getFullYear(), minimumDate.getMonth(), 1);
    if (!disabled && previous >= minimumMonth) setVisibleMonth(previous);
  };

  const goNextMonth = () => {
    if (!disabled) {
      setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1));
    }
  };

  const handleSelect = (dateString: string) => {
    const date = parseDate(dateString);
    if (disabled || !date || startOfDay(date) < startOfDay(minimumDate) || disabledSet.has(dateString)) return;
    onChange(dateString);
  };

  const minimumMonth = new Date(minimumDate.getFullYear(), minimumDate.getMonth(), 1);
  const previousMonthDisabled = disabled || new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1) < minimumMonth;

  return (
    <section className={`ap-date-picker ${className}`.trim()} aria-label={label}>
      <div className="ap-date-picker__header">
        <h3 className="ap-date-picker__label">{label}</h3>
        <div className="ap-date-picker__month-controls">
          <button type="button" onClick={goPreviousMonth} disabled={previousMonthDisabled} aria-label="Previous month" className="ap-date-picker__nav">‹</button>
          <span className="ap-date-picker__month" aria-live="polite">{monthLabel}</span>
          <button type="button" onClick={goNextMonth} disabled={disabled} aria-label="Next month" className="ap-date-picker__nav">›</button>
        </div>
      </div>

      <div className="ap-date-picker__calendar" role="grid" aria-label={monthLabel}>
        {WEEKDAYS.map((weekday) => (
          <div key={weekday} className="ap-date-picker__weekday" role="columnheader">{weekday}</div>
        ))}
        {cells.map((cell, index) => {
          if (!cell) return <div key={`empty-${index}`} className="ap-date-picker__empty" aria-hidden="true" />;

          const date = parseDate(cell.date);
          const isPast = !date || startOfDay(date) < startOfDay(minimumDate);
          const isDisabled = disabled || isPast || disabledSet.has(cell.date);
          const isSelected = value === cell.date;
          const isAvailable = availableSet.has(cell.date) && !isDisabled;
          const classes = [
            'ap-date-picker__day',
            isSelected ? 'is-selected' : '',
            isDisabled ? 'is-disabled' : '',
            isAvailable ? 'is-available' : '',
          ].filter(Boolean).join(' ');

          return (
            <button
              key={cell.date}
              type="button"
              onClick={() => handleSelect(cell.date)}
              disabled={isDisabled}
              aria-label={cell.date}
              aria-pressed={isSelected}
              className={classes}
              role="gridcell"
            >
              <span>{cell.day}</span>
              {isAvailable && <span className="ap-date-picker__dot" aria-hidden="true" />}
            </button>
          );
        })}
      </div>

      <div className="ap-date-picker__legend" aria-label="Calendar legend">
        <span><i className="ap-date-picker__legend-dot is-available" />Available</span>
        <span><i className="ap-date-picker__legend-dot is-disabled" />Unavailable</span>
      </div>
    </section>
  );
}
