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
    <div
      data-gamepad-scope="modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0D0A08]/88 p-4"
    >
      <div className="w-full max-w-md rounded-xl border border-[#8E4036] bg-[#1C1613] p-6 text-[#EDE2CC] shadow-2xl">
        <p className="text-xs font-semibold tracking-wide text-[#DC8477]">
          Shrine Recall · Spirit Returned
        </p>
        <h2 className="mt-1 font-[var(--font-display)] text-2xl font-bold text-[#F3E9D6]">
          You Fell in Battle
        </h2>
        <p className="mt-2 text-sm text-[#CFC2AA]">
          Defeated by <strong className="text-[#F3E9D6]">{cause}</strong>. The Awakening Shrine
          pulls your spirit back to your Home Spawn—at a real cost.
        </p>

        <div className="mt-4 space-y-2 rounded-xl border border-[#4E4032] bg-[#241D17] p-4 text-xs text-[#CFC2AA]">
          <p>
            • Level Penalty:{' '}
            <strong className={lostLevel ? 'text-[#DF8E81]' : 'text-[#EDE2CC]'}>
              {lostLevel
                ? `Lost 1 Level (Now Level ${newLevel})`
                : 'Level 1 protected (no further level loss)'}
            </strong>
          </p>
          <p>
            • Soulbound Gear Kept:{' '}
            <strong className="text-[#D4A65C]">{keptSoulboundCount} item(s)</strong>
          </p>
          <p>
            • Unbound Gear Dropped:{' '}
            <strong className={droppedCount > 0 ? 'text-[#DFB461]' : 'text-[#EDE2CC]'}>
              {droppedCount > 0
                ? `${droppedCount} item(s) left in a recoverable Grave marker`
                : 'None (all gear was Soulbound)'}
            </strong>
          </p>
        </div>

        <button
          type="button"
          onClick={onRespawn}
          className="mt-5 flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-[#C99A4E]/75 bg-[#9C6C30] px-5 py-3 text-sm font-bold text-[#FDF6E8] transition-colors hover:bg-[#AE7A39] cursor-pointer"
        >
          <RotateCcw className="h-4 w-4" />
          Awaken at Home Spawn
        </button>
      </div>
    </div>
  );
};
