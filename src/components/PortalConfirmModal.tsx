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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-950 p-6 text-slate-100 shadow-2xl">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-sky-400">Dungeon Gate</p>
              <h2 className="mt-0.5 font-[var(--font-display)] text-xl font-bold text-white">
                {dung.name}
              </h2>
              <p className="mt-0.5 text-xs text-slate-400">
                Recommended Lv {dung.minLevel}–{dung.maxLevel} · Boss: {dung.bossName}
              </p>
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="mt-3 text-sm leading-relaxed text-slate-300">{dung.description}</p>

          {locked && (
            <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-slate-700 bg-slate-900 p-3.5 text-xs text-slate-300">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <span>
                This gate is sealed. Clear{' '}
                <strong>{DUNGEON_BY_ID[dung.requiresCleared!].name}</strong> first to unlock it.
              </span>
            </div>
          )}

          {!locked && overLeveled && (
            <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-orange-500/50 bg-orange-950/50 p-3.5 text-xs text-orange-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-orange-400" />
              <span>
                <strong>High-Level Warning:</strong> You are Level {playerLevel}, below this
                dungeon’s recommended Level {dung.minLevel}. Remember: dying costs 1 full level and
                drops unbound gear.
              </span>
            </div>
          )}

          {!locked && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900 p-3.5 text-xs">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-amber-300">
                  Dungeon Auto-Map · {dungeonMapScrolls} Scroll{dungeonMapScrolls === 1 ? '' : 's'}
                </p>
                <p className="mt-0.5 text-slate-400">
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
                    ? 'bg-amber-400 text-slate-950 hover:bg-amber-300 cursor-pointer'
                    : 'cursor-not-allowed bg-slate-800 text-slate-500'
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
              className="whitespace-nowrap rounded-lg px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-900"
            >
              Step Back
            </button>
            {!locked && (
              <button
                type="button"
                onClick={onConfirm}
                className={`whitespace-nowrap rounded-lg px-4 py-2 text-xs font-bold ${
                  overLeveled
                    ? 'bg-orange-500 text-slate-950 hover:bg-orange-400'
                    : 'bg-sky-500 text-slate-950 hover:bg-sky-400'
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
      <div className="w-full max-w-md rounded-2xl border border-sky-400/50 bg-slate-950 p-6 text-slate-100 shadow-2xl">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <Compass className="h-5 w-5 text-sky-400" />
            <div>
              <p className="text-xs font-semibold text-sky-400">
                {isExit ? 'Dungeon Exit' : 'Dimensional Portal'}
              </p>
              <h2 className="font-[var(--font-display)] text-xl font-bold text-white">
                {realm.name}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-slate-300">{realm.description}</p>

        {!isExit && (
          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900 p-3.5 text-xs text-slate-300">
            <p className="font-semibold text-sky-300">Portal Crossing Rule</p>
            <p className="mt-1">
              Your <strong>Soulbound gear</strong> travels with you across worlds.{' '}
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
            className="whitespace-nowrap rounded-lg px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-900"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="whitespace-nowrap rounded-lg bg-sky-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-sky-400"
          >
            {isExit ? 'Return to World' : 'Cross Portal'}
          </button>
        </div>
      </div>
    </div>
  );
};
