import React from 'react';
import { ScanSearch, X } from 'lucide-react';
import { InspectResult } from '../types/blockhaven';

interface InspectCardProps {
  result: InspectResult;
  onClose: () => void;
}

const KIND_LABELS: Record<InspectResult['kind'], string> = {
  creature: 'Creature',
  npc: 'Villager',
  portal: 'Landmark',
  chest: 'Treasure',
  grave: 'Grave Marker',
  block: 'Material',
};

export const InspectCard: React.FC<InspectCardProps> = ({ result, onClose }) => {
  return (
    <aside
      aria-label="Inspect Analysis"
      className="pointer-events-auto fixed right-3 bottom-28 sm:bottom-32 z-20 w-72 sm:w-80 overflow-hidden rounded-xl border border-[#65523D] bg-[#1A1511]/95 text-[#EDE2CC] shadow-2xl"
    >
      {/* Accent Top Line */}
      <div className="h-1 w-full" style={{ backgroundColor: result.accentColor }} />

      {/* Header */}
      <div className="flex items-start justify-between gap-2 border-b border-[#403428] bg-[#221C16] px-3.5 py-2.5">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#D4A65C] tabular-nums">
            <ScanSearch className="h-3.5 w-3.5 shrink-0" />
            <span>
              {KIND_LABELS[result.kind]} · {result.distanceMeters.toFixed(1)}m · Inspect Lv{' '}
              {result.inspectLevel}
            </span>
          </div>
          <h3 className="mt-0.5 truncate font-[var(--font-display)] text-sm font-bold text-[#F3E9D6]">
            {result.title}
          </h3>
          <p className="truncate text-[11px] text-[#B8A990]">{result.subtitle}</p>
        </div>

        <button
          type="button"
          onClick={onClose}
          title="Close Inspect"
          aria-label="Close Inspect"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[#B8A990] hover:bg-[#322820] hover:text-[#F3E9D6] cursor-pointer"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Body */}
      <div className="space-y-2.5 px-3.5 py-2.5 text-xs">
        {result.hp !== undefined && result.maxHp !== undefined && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] tabular-nums">
              <span className="font-semibold text-[#D6C8AF]">Health</span>
              <span className="font-mono text-[#EDE2CC]">
                {result.hp} / {result.maxHp}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded bg-[#2D251E]">
              <div
                className="h-full transition-all"
                style={{
                  width: `${Math.min(100, (result.hp / Math.max(1, result.maxHp)) * 100)}%`,
                  backgroundColor: result.accentColor,
                }}
              />
            </div>
          </div>
        )}

        {/* 2-Column Clean Spec Grid */}
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 border-b border-[#3F3327] pb-2.5">
          {result.stats.map((st) => (
            <div key={st.label} className="min-w-0">
              <dt className="text-[10px] font-medium text-[#B0A188]">{st.label}</dt>
              <dd className="truncate text-[11px] font-semibold text-[#F0E5D1] tabular-nums">
                {st.value}
              </dd>
            </div>
          ))}
        </dl>

        <p className="text-[11px] leading-relaxed text-[#CFC2AA]">{result.notes}</p>

        {result.tip && (
          <p className="border-t border-[#3F3327] pt-2 text-[11px] leading-snug text-[#D9AD62]">
            {result.tip}
          </p>
        )}
      </div>
    </aside>
  );
};
