import React from 'react';
import { X } from 'lucide-react';
import { SystemNotice } from '../types/blockhaven';

interface SystemToastStackProps {
  notices: SystemNotice[];
  onDismiss: (id: string) => void;
  belowMinimap?: boolean;
}

const TONE_STYLES: Record<SystemNotice['tone'], { border: string; kicker: string; kickerLabel: string }> = {
  system: { border: 'border-sky-400/70', kicker: 'text-sky-300', kickerLabel: 'System' },
  level: { border: 'border-amber-400/80', kicker: 'text-amber-300', kickerLabel: 'Level Up' },
  quest: { border: 'border-emerald-400/80', kicker: 'text-emerald-300', kickerLabel: 'Quest Update' },
  warning: { border: 'border-orange-400/80', kicker: 'text-orange-300', kickerLabel: 'Warning' },
  death: { border: 'border-rose-400/80', kicker: 'text-rose-300', kickerLabel: 'Rebirth Notice' },
};

export const SystemToastStack: React.FC<SystemToastStackProps> = ({
  notices,
  onDismiss,
  belowMinimap = false,
}) => {
  if (notices.length === 0) return null;

  return (
    <div
      className={`pointer-events-none fixed right-3 z-30 flex w-full max-w-xs sm:max-w-sm flex-col gap-2.5 ${
        belowMinimap ? 'top-[19rem]' : 'top-20'
      }`}
    >
      {notices.map((notice) => {
        const style = TONE_STYLES[notice.tone];
        return (
          <div
            key={notice.id}
            className={`pointer-events-auto rounded-xl border ${style.border} bg-slate-950/94 px-4 py-3 text-slate-100 shadow-xl`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className={`text-xs font-semibold tracking-wide ${style.kicker}`}>
                  {style.kickerLabel}
                </p>
                <p className="mt-0.5 text-sm font-bold text-white">{notice.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-300">{notice.body}</p>
              </div>
              <button
                type="button"
                onClick={() => onDismiss(notice.id)}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
                aria-label="Dismiss notice"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
