import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Clock } from 'lucide-react';

interface TimeInputProps {
  label?: string;
  value: string; // 24h "HH:MM" or ""
  onChange: (value: string) => void;
  required?: boolean;
}

function to12h(value: string) {
  if (!value) return { h: 12, m: 0, period: 'AM' as 'AM' | 'PM' };
  const [hh, mm] = value.split(':').map(Number);
  const period: 'AM' | 'PM' = hh >= 12 ? 'PM' : 'AM';
  let h = hh % 12;
  if (h === 0) h = 12;
  return { h, m: mm, period };
}

function to24h(h: number, m: number, period: 'AM' | 'PM'): string {
  let hours = h % 12;
  if (period === 'PM') hours += 12;
  return `${String(hours).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatDisplay(value: string): string {
  if (!value) return '';
  const { h, m, period } = to12h(value);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const ITEM_H = 36; // px height per item

function ScrollColumn<T extends number>({
  items,
  selected,
  onSelect,
  format,
}: {
  items: T[];
  selected: T;
  onSelect: (v: T) => void;
  format: (v: T) => string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startScroll = useRef(0);

  const scrollToIndex = useCallback(
    (idx: number, smooth = true) => {
      ref.current?.scrollTo({
        top: idx * ITEM_H,
        behavior: smooth ? 'smooth' : 'auto',
      });
    },
    []
  );

  // Initial scroll without animation
  useEffect(() => {
    const idx = items.indexOf(selected);
    if (idx !== -1) scrollToIndex(idx, false);
  }, []); // intentionally only on mount

  // Smooth scroll when selected changes externally
  useEffect(() => {
    const idx = items.indexOf(selected);
    if (idx !== -1) scrollToIndex(idx, true);
  }, [selected, items, scrollToIndex]);

  const handleScroll = () => {
    if (isDragging.current) return;
    const el = ref.current;
    if (!el) return;
    const idx = Math.round(el.scrollTop / ITEM_H);
    const clamped = Math.max(0, Math.min(idx, items.length - 1));
    if (items[clamped] !== selected) onSelect(items[clamped]);
  };

  // Snap on scroll end
  const snapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleScrollWithSnap = () => {
    handleScroll();
    if (snapTimer.current) clearTimeout(snapTimer.current);
    snapTimer.current = setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const idx = Math.round(el.scrollTop / ITEM_H);
      scrollToIndex(idx, true);
    }, 80);
  };

  return (
    <div className="relative flex flex-col items-center" style={{ width: 56 }}>
      {/* Top fade */}
      <div className="absolute top-0 left-0 right-0 h-8 z-10 pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, var(--paper), transparent)' }} />

      {/* Scroll list */}
      <div
        ref={ref}
        onScroll={handleScrollWithSnap}
        className="overflow-y-auto w-full outline-none"
        style={{
          height: ITEM_H * 5,
          scrollbarWidth: 'none',
          scrollSnapType: 'y mandatory',
        }}
      >
        {/* Padding so first/last item can center */}
        <div style={{ height: ITEM_H * 2 }} />
        {items.map(v => (
          <div
            key={v}
            onClick={() => { onSelect(v); scrollToIndex(items.indexOf(v)); }}
            style={{ height: ITEM_H, scrollSnapAlign: 'center' }}
            className={`flex items-center justify-center text-sm font-mono cursor-pointer select-none transition-all rounded-lg mx-1 ${
              v === selected
                ? 'bg-[var(--accent)] text-white font-bold'
                : 'text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--rule)]/30'
            }`}
          >
            {format(v)}
          </div>
        ))}
        <div style={{ height: ITEM_H * 2 }} />
      </div>
      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-8 z-10 pointer-events-none"
        style={{ background: 'linear-gradient(to top, var(--paper), transparent)' }} />
    </div>
  );
}

export const TimeInput: React.FC<TimeInputProps> = ({ label, value, onChange, required }) => {
  const [open, setOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const { h, m, period } = to12h(value);

  const openDropdown = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 6, left: rect.left });
    }
    setOpen(o => !o);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        // Also check if click was inside the fixed dropdown (rendered outside container)
        const dropdown = document.getElementById('time-input-dropdown');
        if (dropdown && dropdown.contains(e.target as Node)) return;
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const setHour = (newH: number) => onChange(to24h(newH, m, period));
  const setMinute = (newM: number) => onChange(to24h(h, newM, period));
  const togglePeriod = (p: 'AM' | 'PM') => onChange(to24h(h, m, p));

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label className="block text-sm font-medium text-[var(--ink)] mb-1">
          {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}

      {/* Trigger */}
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={label || 'Select time'}
        onClick={openDropdown}
        className={`w-full flex items-center h-10 px-3 bg-[var(--paper)] border rounded-md text-sm transition-colors ${
          open
            ? 'border-[var(--accent)] ring-1 ring-[var(--accent)]'
            : 'border-[var(--rule)] hover:border-[var(--accent)]/50'
        }`}
      >
        <span className={`flex-1 text-left font-mono tabular-nums tracking-wide ${value ? 'text-[var(--ink)]' : 'text-[var(--ink-muted)]'}`}>
          {value ? formatDisplay(value) : '--:-- --'}
        </span>
        <Clock size={14} className="text-[var(--ink-muted)] shrink-0" aria-hidden="true" />
      </button>

      {/* Dropdown — fixed so it escapes modal overflow clipping */}
      {open && (
        <div
          id="time-input-dropdown"
          role="dialog"
          aria-modal="true"
          aria-label="Time picker"
          className="rounded-xl border border-[var(--rule)] bg-[var(--paper)] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 ease-out"
          style={{ position: 'fixed', top: dropdownPos.top, left: dropdownPos.left, minWidth: 200, zIndex: 9999 }}
        >

          {/* Columns */}
          <div className="flex items-center justify-center gap-0 px-2 pt-2">
            {/* Hours */}
            <ScrollColumn
              items={HOURS}
              selected={h}
              onSelect={setHour}
              format={v => String(v).padStart(2, '0')}
            />

            <span className="text-[var(--ink-muted)] font-bold text-xl pb-1 select-none px-0.5" aria-hidden="true">:</span>

            {/* Minutes */}
            <ScrollColumn
              items={MINUTES}
              selected={m}
              onSelect={setMinute}
              format={v => String(v).padStart(2, '0')}
            />

            {/* AM / PM */}
            <div className="flex flex-col gap-2 ml-3 mb-1">
              {(['AM', 'PM'] as const).map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => togglePeriod(p)}
                  className={`px-3 py-2 rounded-lg text-xs font-bold tracking-widest transition-colors ${
                    period === p
                      ? 'bg-[var(--accent)] text-white shadow-sm'
                      : 'text-[var(--ink-muted)] hover:bg-[var(--paper-subtle)] hover:text-[var(--ink)]'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-[var(--rule)] px-3 py-2 flex justify-between items-center mt-1">
            <span className="text-xs text-[var(--ink-muted)] font-mono tabular-nums">
              {value ? formatDisplay(value) : 'No time set'}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs font-semibold text-[var(--accent)] hover:opacity-80 transition-opacity cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
