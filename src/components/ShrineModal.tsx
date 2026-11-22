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
    <div
      data-gamepad-scope="modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0D0A08]/82 p-4"
    >
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-[#725C43] bg-[#1C1713] text-[#EDE2CC] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#46392C] bg-[#231C16] px-6 py-4">
          <div>
            <p className="text-xs font-semibold text-[#D4A65C]">Awakening Shrine · Safe Sanctuary</p>
            <h2 className="font-[var(--font-display)] text-xl font-bold text-[#F3E9D6]">
              Shrine of Soulbinding &amp; Rebirth
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Shrine"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#B8A990] hover:bg-[#322820] hover:text-[#F3E9D6] cursor-pointer"
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
              className="flex flex-col items-start gap-1 rounded-xl border border-[#4D3F31] bg-[#241D17] p-4 text-left hover:border-[#7EA56E] hover:bg-[#2C241C] cursor-pointer"
            >
              <Heart className="h-4 w-4 text-[#98B986]" />
              <span className="text-sm font-bold text-[#F3E9D6]">Restore Vitals</span>
              <span className="text-xs text-[#B8A990]">Free full HP, Stamina &amp; Hunger</span>
            </button>

            <button
              type="button"
              onClick={onSetHomeSpawn}
              className="flex flex-col items-start gap-1 rounded-xl border border-[#4D3F31] bg-[#241D17] p-4 text-left hover:border-[#C99A4E] hover:bg-[#2C241C] cursor-pointer"
            >
              <Home className="h-4 w-4 text-[#D4A65C]" />
              <span className="text-sm font-bold text-[#F3E9D6]">Bind Home Spawn</span>
              <span className="text-xs text-[#B8A990]">Respawn here after death</span>
            </button>

            <button
              type="button"
              disabled={!needsRepair || rpg.gold < repairCost}
              onClick={() => onRepairAll(repairCost)}
              className={`flex flex-col items-start gap-1 rounded-xl border p-4 text-left ${
                needsRepair && rpg.gold >= repairCost
                  ? 'border-[#4D3F31] bg-[#241D17] hover:border-[#D4A65C] hover:bg-[#2C241C] cursor-pointer'
                  : 'cursor-not-allowed border-[#3D3126] bg-[#1F1914] opacity-60'
              }`}
            >
              <Wrench className="h-4 w-4 text-[#DFB86C]" />
              <span className="text-sm font-bold text-[#F3E9D6]">Repair Gear ({repairCost}g)</span>
              <span className="text-xs text-[#B8A990]">
                {needsRepair ? 'Restore all durability' : 'All gear at 100%'}
              </span>
            </button>
          </div>

          {/* Soulbinding Section */}
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#F3E9D6]">Soulbind Equipment</h3>
              <span className="text-xs text-[#B8A990] tabular-nums">
                Gold: <strong className="text-[#D9AD62]">{rpg.gold}g</strong>
              </span>
            </div>
            <p className="mt-1 text-xs text-[#B8A990]">
              Soulbound items stay with you when you die and travel across dimensional portals to
              other worlds.
            </p>

            {allUnbound.length === 0 ? (
              <div className="mt-3 rounded-xl border border-[#4D3F31] bg-[#241D17] p-4 text-xs text-[#B8A990]">
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
                      className="flex items-center justify-between gap-3 rounded-xl border border-[#4D3F31] bg-[#241D17] px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-bold text-[#F3E9D6]">{item.name}</p>
                        <p className="text-xs text-[#B8A990]">
                          {item.rarity} · {item.slot}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={!canAfford}
                        onClick={() => onSoulbindItem(item.id, cost)}
                        className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-bold ${
                          canAfford
                            ? 'border border-[#C99A4E]/75 bg-[#9C6C30] text-[#FDF6E8] hover:bg-[#AE7A39] cursor-pointer'
                            : 'cursor-not-allowed bg-[#2D251E] text-[#7D7160]'
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
