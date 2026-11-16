import { useEffect, useState } from 'react';
import { formatTime, parseTime, type Minutes } from '../model/time';

/** A forgiving time box: "7", "7p", "7:30pm" all work. Shows red when it can't read what was typed. */
export function TimeInput({ value, onChange, label, autoFocus }: {
  value: Minutes | null;
  onChange(v: Minutes | null): void;
  label: string;
  autoFocus?: boolean;
}) {
  const [text, setText] = useState(value === null ? '' : formatTime(value));
  useEffect(() => {
    setText((t) => (parseTime(t, { lenient: true }) === value ? t : value === null ? '' : formatTime(value)));
  }, [value]);
  const bad = text.trim() !== '' && parseTime(text, { lenient: true }) === null;
  return (
    <input
      className={`time-input${bad ? ' bad' : ''}`}
      value={text}
      aria-label={label}
      aria-invalid={bad}
      placeholder="7AM"
      autoFocus={autoFocus}
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        setText(e.target.value);
        onChange(parseTime(e.target.value, { lenient: true }));
      }}
      onBlur={() => { if (value !== null) setText(formatTime(value)); }}
    />
  );
}
