import { useState } from 'react';
import type { DateRange } from '../api/client';
import { customRange, presetRange, RANGE_LABEL, toDateInput, type RangePreset } from '../lib/dates';

const PRESETS: Exclude<RangePreset, 'custom'>[] = ['today', 'yesterday', '7d', '30d', 'month'];

/** Preset date ranges plus a custom from/to. Calls onChange with an exclusive ISO range. */
export default function RangePicker({ preset, onChange }: { preset: RangePreset; onChange: (preset: RangePreset, range: DateRange) => void }) {
  const today = toDateInput(new Date());
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);

  function setCustom(f: string, t: string) {
    setFrom(f);
    setTo(t);
    if (f && t && f <= t) onChange('custom', customRange(f, t));
  }

  return (
    <div className="row">
      <div className="segmented" role="tablist" aria-label="Date range">
        {[...PRESETS, 'custom' as const].map((p) => (
          <button
            key={p}
            role="tab"
            aria-selected={preset === p}
            className="segmented-item"
            onClick={() => (p === 'custom' ? setCustom(from, to) : onChange(p, presetRange(p)))}
          >
            {RANGE_LABEL[p]}
          </button>
        ))}
      </div>
      {preset === 'custom' && (
        <div className="row">
          <input type="date" className="input input-sm" value={from} max={to} onChange={(e) => setCustom(e.target.value, to)} aria-label="From date" />
          <span className="subtle">to</span>
          <input type="date" className="input input-sm" value={to} min={from} onChange={(e) => setCustom(from, e.target.value)} aria-label="To date" />
        </div>
      )}
    </div>
  );
}
