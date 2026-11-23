import React from 'react';
import { X } from 'lucide-react';

export interface HudNotice {
  id: string;
  tone: 'info' | 'score' | 'warning' | 'alert';
  title: string;
  body: string;
}

interface SystemToastStackProps {
  notices: HudNotice[];
  onDismiss: (id: string) => void;
}

const TONE_STYLES: Record<HudNotice['tone'], { border: string; kicker: string; kickerLabel: string }> = {
  info: { border: 'border-[#7E6A4F]', kicker: 'text-[#D4A65C]', kickerLabel: 'Island Feed' },
  score: { border: 'border-[#6A8C5D]', kicker: 'text-[#9BC089]', kickerLabel: 'Score' },
  warning: { border: 'border-[#B66A38]', kicker: 'text-[#DF9A62]', kickerLabel: 'Notice' },
  alert: { border: 'border-[#9F453B]', kicker: 'text-[#DC8477]', kickerLabel: 'Alert' },
};

export const SystemToastStack: React.FC<SystemToastStackProps> = ({ notices, onDismiss }) => {
  if (notices.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-3 top-20 z-30 flex w-full max-w-xs sm:max-w-sm flex-col gap-2.5">
      {notices.map((notice) => {
        const style = TONE_STYLES[notice.tone];
        return (
          <div
            key={notice.id}
            className={`pointer-events-auto rounded-xl border ${style.border} bg-[#1A1511]/94 px-4 py-3 text-[#EDE2CC] shadow-xl`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className={`text-xs font-semibold tracking-wide ${style.kicker}`}>
                  {style.kickerLabel}
                </p>
                <p className="mt-0.5 font-[var(--font-display)] text-sm font-bold text-[#F3E9D6]">
                  {notice.title}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-[#CFC2AA]">{notice.body}</p>
              </div>
              <button
                type="button"
                onClick={() => onDismiss(notice.id)}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#B8A990] transition-colors hover:bg-[#322820] hover:text-[#F3E9D6] cursor-pointer"
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
