import React from 'react';
import { RotateCcw } from 'lucide-react';

interface DeathModalProps {
  cause: string;
  lostLevel: boolean;
  newLevel: number;
  droppedCount: number;
  keptSoulboundCount: number;
  onRespawn: () => void;
}

export const DeathModal: React.FC<DeathModalProps> = ({
  cause,
  lostLevel,
  newLevel,
  droppedCount,
  keptSoulboundCount,
  onRespawn,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/88 p-4">
      <div className="w-full max-w-md rounded-2xl border border-rose-500/60 bg-slate-950 p-6 text-slate-100 shadow-2xl">
        <p className="text-xs font-semibold tracking-wide text-rose-400">
          System Notice · Soul Returned
        </p>
        <h2 className="mt-1 font-[var(--font-display)] text-2xl font-bold text-white">
          You Fell in Battle
        </h2>
        <p className="mt-2 text-sm text-slate-300">
          Defeated by <strong className="text-white">{cause}</strong>. The Awakening Shrine pulls
          your spirit back to your Home Spawn—at a real cost.
        </p>

        <div className="mt-4 space-y-2 rounded-xl border border-slate-800 bg-slate-900/80 p-4 text-xs text-slate-300">
          <p>
            • Level Penalty:{' '}
            <strong className={lostLevel ? 'text-rose-300' : 'text-slate-200'}>
              {lostLevel
                ? `Lost 1 Level (Now Level ${newLevel})`
                : 'Level 1 protected (no further level loss)'}
            </strong>
          </p>
          <p>
            • Soulbound Gear Kept:{' '}
            <strong className="text-sky-300">{keptSoulboundCount} item(s)</strong>
          </p>
          <p>
            • Unbound Gear Dropped:{' '}
            <strong className={droppedCount > 0 ? 'text-amber-300' : 'text-slate-200'}>
              {droppedCount > 0
                ? `${droppedCount} item(s) left in a recoverable Grave marker`
                : 'None (all gear was Soulbound)'}
            </strong>
          </p>
        </div>

        <button
          type="button"
          onClick={onRespawn}
          className="mt-5 flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-sky-500 px-5 py-3 text-sm font-bold text-slate-950 transition-colors hover:bg-sky-400"
        >
          <RotateCcw className="h-4 w-4" />
          Awaken at Home Spawn
        </button>
      </div>
    </div>
  );
};
