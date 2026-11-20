import React from 'react';
import { Heart, Home, Lock, Wrench, X } from 'lucide-react';
import { GearItem, RpgPlayerState } from '../types/blockhaven';

interface ShrineModalProps {
  rpg: RpgPlayerState;
  onRestAndHeal: () => void;
  onSetHomeSpawn: () => void;
  onSoulbindItem: (itemId: string, cost: number) => void;
  onRepairAll: (cost: number) => void;
  onClose: () => void;
}

export const ShrineModal: React.FC<ShrineModalProps> = ({
  rpg,
  onRestAndHeal,
  onSetHomeSpawn,
  onSoulbindItem,
  onRepairAll,
  onClose,
}) => {
  const hasRepairSkill = rpg.skills.some((s) => s.id === 'repair');
  const repairCost = hasRepairSkill ? 10 : 20;

  const equippedList: GearItem[] = [
    rpg.equipped.weapon,
    rpg.equipped.armor,
    rpg.equipped.accessory,
  ].filter((x): x is GearItem => x !== null);

  const allUnbound = [...equippedList, ...rpg.inventory].filter((item) => !item.soulbound);
  const needsRepair = equippedList.some((item) => item.durability < item.maxDurability);

  const bindCostFor = (item: GearItem) =>
    item.rarity === 'Legendary'
      ? 90
      : item.rarity === 'Epic'
        ? 60
        : item.rarity === 'Rare'
          ? 40
          : 25;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-sky-400/50 bg-slate-950 text-slate-100 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div>
            <p className="text-xs font-semibold text-sky-400">Awakening Shrine · Safe Sanctuary</p>
            <h2 className="font-[var(--font-display)] text-xl font-bold text-white">
              Shrine of Soulbinding & Rebirth
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Shrine"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-6">
          {/* Quick Shrine Services */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <button
              type="button"
              onClick={onRestAndHeal}
              className="flex flex-col items-start gap-1 rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-left hover:border-emerald-400/60 hover:bg-slate-900"
            >
              <Heart className="h-4 w-4 text-emerald-400" />
              <span className="text-sm font-bold text-white">Restore Vitals</span>
              <span className="text-xs text-slate-400">Free full HP, Stamina & Hunger</span>
            </button>

            <button
              type="button"
              onClick={onSetHomeSpawn}
              className="flex flex-col items-start gap-1 rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-left hover:border-sky-400/60 hover:bg-slate-900"
            >
              <Home className="h-4 w-4 text-sky-400" />
              <span className="text-sm font-bold text-white">Bind Home Spawn</span>
              <span className="text-xs text-slate-400">Respawn here after death</span>
            </button>

            <button
              type="button"
              disabled={!needsRepair || rpg.gold < repairCost}
              onClick={() => onRepairAll(repairCost)}
              className={`flex flex-col items-start gap-1 rounded-xl border p-4 text-left ${
                needsRepair && rpg.gold >= repairCost
                  ? 'border-slate-800 bg-slate-900/70 hover:border-amber-400/60'
                  : 'cursor-not-allowed border-slate-800/60 bg-slate-900/30 opacity-60'
              }`}
            >
              <Wrench className="h-4 w-4 text-amber-400" />
              <span className="text-sm font-bold text-white">Repair Gear ({repairCost}g)</span>
              <span className="text-xs text-slate-400">
                {needsRepair ? 'Restore all durability' : 'All gear at 100%'}
              </span>
            </button>
          </div>

          {/* Soulbinding Section */}
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Soulbind Equipment</h3>
              <span className="text-xs text-slate-400 tabular-nums">
                Gold: <strong className="text-amber-300">{rpg.gold}g</strong>
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Soulbound items stay with you when you die and travel across dimensional portals to other worlds.
            </p>

            {allUnbound.length === 0 ? (
              <div className="mt-3 rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-xs text-slate-400">
                All of your current gear is already Soulbound!
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                {allUnbound.map((item) => {
                  const cost = bindCostFor(item);
                  const canAfford = rpg.gold >= cost;
                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-bold text-white">{item.name}</p>
                        <p className="text-xs text-slate-400">
                          {item.rarity} · {item.slot}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={!canAfford}
                        onClick={() => onSoulbindItem(item.id, cost)}
                        className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-bold ${
                          canAfford
                            ? 'bg-sky-500 text-slate-950 hover:bg-sky-400'
                            : 'cursor-not-allowed bg-slate-800 text-slate-500'
                        }`}
                      >
                        <Lock className="h-3.5 w-3.5" />
                        Soulbind ({cost}g)
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
