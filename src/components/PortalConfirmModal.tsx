import React from 'react';
import { AlertTriangle, Compass, Lock, Scroll, X } from 'lucide-react';
import { DungeonId, GearItem, RealmId } from '../types/blockhaven';
import { DUNGEON_BY_ID, REALM_BY_ID } from '../rpg/rpgData';

export interface PortalPromptState {
  kind: 'realm' | 'dungeon' | 'dungeon_exit';
  targetId: RealmId | DungeonId;
}

interface PortalConfirmModalProps {
  prompt: PortalPromptState;
  playerLevel: number;
  playerGold: number;
  dungeonMapScrolls: number;
  clearedDungeons: DungeonId[];
  unboundGear: GearItem[];
  onBuyDungeonMap: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export const PortalConfirmModal: React.FC<PortalConfirmModalProps> = ({
  prompt,
  playerLevel,
  playerGold,
  dungeonMapScrolls,
  clearedDungeons,
  unboundGear,
  onBuyDungeonMap,
  onConfirm,
  onCancel,
}) => {
  if (prompt.kind === 'dungeon') {
    const dung = DUNGEON_BY_ID[prompt.targetId as DungeonId];
    const locked =
      dung.requiresCleared !== undefined && !clearedDungeons.includes(dung.requiresCleared);
    const overLeveled = playerLevel < dung.minLevel;

    return (
      <div
        data-gamepad-scope="modal"
        className="fixed inset-0 z-50 flex items-center justify-center bg-[#0D0A08]/82 p-4"
      >
        <div className="w-full max-w-md rounded-xl border border-[#6B5740] bg-[#1C1713] p-6 text-[#EDE2CC] shadow-2xl">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-[#D4A65C]">Dungeon Gate</p>
              <h2 className="mt-0.5 font-[var(--font-display)] text-xl font-bold text-[#F3E9D6]">
                {dung.name}
              </h2>
              <p className="mt-0.5 text-xs text-[#B8A990]">
                Recommended Lv {dung.minLevel}–{dung.maxLevel} · Boss: {dung.bossName}
              </p>
            </div>
            <button
              type="button"
              onClick={onCancel}
              aria-label="Close Dungeon Gate"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[#B8A990] hover:bg-[#322820] hover:text-[#F3E9D6] cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="mt-3 text-sm leading-relaxed text-[#CFC2AA]">{dung.description}</p>

          {locked && (
            <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-[#5A4B3A] bg-[#241D17] p-3.5 text-xs text-[#CFC2AA]">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[#B8A990]" />
              <span>
                This gate is sealed. Clear{' '}
                <strong className="text-[#F3E9D6]">
                  {DUNGEON_BY_ID[dung.requiresCleared!].name}
                </strong>{' '}
                first to unlock it.
              </span>
            </div>
          )}

          {!locked && overLeveled && (
            <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-[#B66A38]/70 bg-[#342014] p-3.5 text-xs text-[#F1CBA6]">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#DF9A62]" />
              <span>
                <strong>High-Level Warning:</strong> You are Level {playerLevel}, below this
                dungeon’s recommended Level {dung.minLevel}. Remember: dying costs 1 full level and
                drops unbound gear.
              </span>
            </div>
          )}

          {!locked && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#4D3F31] bg-[#241D17] p-3.5 text-xs">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-[#D9AD62]">
                  Dungeon Auto-Map · {dungeonMapScrolls} Scroll{dungeonMapScrolls === 1 ? '' : 's'}
                </p>
                <p className="mt-0.5 text-[#B8A990]">
                  Chambers start dark until explored—or activate a Dungeon Map Scroll (or find the
                  Map Pedestal inside).
                </p>
              </div>
              <button
                type="button"
                disabled={playerGold < 30}
                onClick={onBuyDungeonMap}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 font-bold transition-colors ${
                  playerGold >= 30
                    ? 'border border-[#E2BA72] bg-[#B7833B] text-[#1A140F] hover:bg-[#C89347] cursor-pointer'
                    : 'cursor-not-allowed bg-[#2D251E] text-[#7D7160]'
                }`}
              >
                <Scroll className="h-3.5 w-3.5" />
                Buy Map (30g)
              </button>
            </div>
          )}

          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="whitespace-nowrap rounded-lg border border-[#5B4B3A] bg-[#261F18] px-4 py-2 text-xs font-semibold text-[#D6C8AF] hover:bg-[#332920] cursor-pointer"
            >
              Step Back
            </button>
            {!locked && (
              <button
                type="button"
                onClick={onConfirm}
                className={`whitespace-nowrap rounded-lg px-4 py-2 text-xs font-bold cursor-pointer ${
                  overLeveled
                    ? 'border border-[#D48349] bg-[#A55628] text-[#FDF6E8] hover:bg-[#B86230]'
                    : 'border border-[#C99A4E]/75 bg-[#9C6C30] text-[#FDF6E8] hover:bg-[#AE7A39]'
                }`}
              >
                Enter Dungeon
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const realm = REALM_BY_ID[prompt.targetId as RealmId];
  const isExit = prompt.kind === 'dungeon_exit';

  return (
    <div
      data-gamepad-scope="modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0D0A08]/82 p-4"
    >
      <div className="w-full max-w-md rounded-xl border border-[#6B5740] bg-[#1C1713] p-6 text-[#EDE2CC] shadow-2xl">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <Compass className="h-5 w-5 text-[#D4A65C]" />
            <div>
              <p className="text-xs font-semibold text-[#D4A65C]">
                {isExit ? 'Dungeon Exit' : 'Dimensional Portal'}
              </p>
              <h2 className="font-[var(--font-display)] text-xl font-bold text-[#F3E9D6]">
                {realm.name}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close Portal Prompt"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#B8A990] hover:bg-[#322820] hover:text-[#F3E9D6] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-[#CFC2AA]">{realm.description}</p>

        {!isExit && (
          <div className="mt-4 rounded-xl border border-[#4D3F31] bg-[#241D17] p-3.5 text-xs text-[#CFC2AA]">
            <p className="font-semibold text-[#D9AD62]">Portal Crossing Rule</p>
            <p className="mt-1">
              Your <strong className="text-[#F3E9D6]">Soulbound gear</strong> travels with you across
              worlds.{' '}
              {unboundGear.length > 0
                ? `${unboundGear.length} unbound item(s) will be stored safely in this world’s World Chest until you return.`
                : 'All of your gear is Soulbound and ready to cross!'}
            </p>
          </div>
        )}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="whitespace-nowrap rounded-lg border border-[#5B4B3A] bg-[#261F18] px-4 py-2 text-xs font-semibold text-[#D6C8AF] hover:bg-[#332920] cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="whitespace-nowrap rounded-lg border border-[#C99A4E]/75 bg-[#9C6C30] px-4 py-2 text-xs font-bold text-[#FDF6E8] hover:bg-[#AE7A39] cursor-pointer"
          >
            {isExit ? 'Return to World' : 'Cross Portal'}
          </button>
        </div>
      </div>
    </div>
  );
};
