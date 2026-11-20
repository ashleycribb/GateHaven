import React, { useState } from 'react';
import { X, Shield, Swords, Hammer, Compass, BookOpen, Lock, Check } from 'lucide-react';
import {
  DungeonId,
  GearItem,
  RealmId,
  RpgPlayerState,
} from '../types/blockhaven';
import {
  CLASS_BY_ID,
  CRAFT_RECIPES,
  CraftRecipe,
  DUNGEON_LIST,
  RARITY_COLORS,
  REALM_LIST,
  SKILL_CATALOG,
} from '../rpg/rpgData';

export type RpgMenuTab = 'status' | 'skills' | 'gear' | 'craft' | 'worlds';

interface RpgMenuModalProps {
  initialTab: RpgMenuTab;
  playerName: string;
  rpg: RpgPlayerState;
  onClose: () => void;
  onOpenClassModal: () => void;
  onTogglePvp: () => void;
  onEquipGear: (itemId: string) => void;
  onWithdrawChestGear: (itemId: string) => void;
  onCraftRecipe: (recipe: CraftRecipe) => void;
  onRequestRealmTravel: (realmId: RealmId) => void;
  onRequestDungeonEnter: (dungeonId: DungeonId) => void;
  onOpenShrine: () => void;
}

export const RpgMenuModal: React.FC<RpgMenuModalProps> = ({
  initialTab,
  playerName,
  rpg,
  onClose,
  onOpenClassModal,
  onTogglePvp,
  onEquipGear,
  onWithdrawChestGear,
  onCraftRecipe,
  onRequestRealmTravel,
  onRequestDungeonEnter,
  onOpenShrine,
}) => {
  const [tab, setTab] = useState<RpgMenuTab>(initialTab);

  const classLabel =
    rpg.playerClass === 'unawakened'
      ? rpg.level >= 5
        ? 'Unawakened (Class Ready!)'
        : 'Unawakened (Unlocks Lv 5)'
      : CLASS_BY_ID[rpg.playerClass].name;

  const isArtificer = rpg.playerClass === 'artificer';
  const currentChest = rpg.worldChests[rpg.activeRealm] ?? [];

  const renderGearRow = (item: GearItem, actionLabel: string, onAction: () => void) => {
    const rc = RARITY_COLORS[item.rarity];
    const durPct = Math.round((item.durability / Math.max(1, item.maxDurability)) * 100);
    return (
      <div
        key={item.id}
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-white">{item.name}</span>
            <span className="text-xs font-semibold" style={{ color: rc.border }}>
              {item.rarity}
            </span>
            {item.soulbound && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-sky-400">
                <Lock className="h-3 w-3" />
                Soulbound
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-slate-400 tabular-nums">
            {item.slot.toUpperCase()}
            {item.attack > 0 ? ` · ATK +${item.attack}` : ''}
            {item.defense > 0 ? ` · DEF +${item.defense}` : ''}
            {item.bonusHp > 0 ? ` · HP +${item.bonusHp}` : ''}
            {` · Durability ${durPct}%`}
          </p>
        </div>
        <button
          type="button"
          onClick={onAction}
          className="whitespace-nowrap rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
        >
          {actionLabel}
        </button>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-sky-500/40 bg-slate-950 text-slate-100 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div>
            <p className="text-xs font-semibold text-sky-400">System Status Window</p>
            <h2 className="font-[var(--font-display)] text-xl font-bold text-white">
              {playerName} · Level {rpg.level} {classLabel}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close System Status"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-800 bg-slate-900/60 px-6 py-2.5">
          {(
            [
              { id: 'status', label: 'Status', icon: Shield },
              { id: 'skills', label: `Skills (${rpg.skills.length})`, icon: BookOpen },
              { id: 'gear', label: `Gear (${rpg.inventory.length})`, icon: Swords },
              { id: 'craft', label: 'Crafting', icon: Hammer },
              { id: 'worlds', label: 'Worlds & Dungeons', icon: Compass },
            ] as const
          ).map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
                  tab === t.id
                    ? 'bg-sky-500 text-slate-950'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'status' && (
            <div className="space-y-6">
              {/* Vitals */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                  <p className="text-xs text-slate-400">Health (HP)</p>
                  <p className="mt-1 text-2xl font-bold text-rose-400 tabular-nums">
                    {Math.round(rpg.hp)} / {rpg.maxHp}
                  </p>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full bg-rose-500"
                      style={{ width: `${Math.min(100, (rpg.hp / rpg.maxHp) * 100)}%` }}
                    />
                  </div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                  <p className="text-xs text-slate-400">Stamina</p>
                  <p className="mt-1 text-2xl font-bold text-amber-300 tabular-nums">
                    {Math.round(rpg.stamina)} / {rpg.maxStamina}
                  </p>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full bg-amber-400"
                      style={{ width: `${Math.min(100, (rpg.stamina / rpg.maxStamina) * 100)}%` }}
                    />
                  </div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                  <p className="text-xs text-slate-400">Hunger</p>
                  <p className="mt-1 text-2xl font-bold text-emerald-400 tabular-nums">
                    {Math.round(rpg.hunger)} / {rpg.maxHunger}
                  </p>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full bg-emerald-500"
                      style={{ width: `${Math.min(100, (rpg.hunger / rpg.maxHunger) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* XP, Gold, Class, Pet */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-400">Experience (XP)</span>
                    <span className="text-xs font-bold text-sky-300 tabular-nums">
                      {rpg.xp} / {rpg.xpToNext} XP
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full bg-sky-400"
                      style={{ width: `${Math.min(100, (rpg.xp / rpg.xpToNext) * 100)}%` }}
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-slate-300 tabular-nums">
                    <span>Gold: <strong className="text-amber-300">{rpg.gold}g</strong></span>
                    <span>Map Scrolls: <strong className="text-sky-300">{rpg.dungeonMapScrolls}</strong></span>
                    <span>Deaths: <strong className="text-slate-100">{rpg.deaths}</strong></span>
                    <span>Dungeons Cleared: <strong className="text-emerald-400">{rpg.clearedDungeons.length}</strong></span>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs text-slate-400">Class Awakening</p>
                      <p className="text-sm font-bold text-white">{classLabel}</p>
                    </div>
                    {rpg.level >= 5 && (
                      <button
                        type="button"
                        onClick={onOpenClassModal}
                        className="whitespace-nowrap rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-300"
                      >
                        {rpg.playerClass === 'unawakened' ? 'Awaken Class' : 'View Classes'}
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">
                    {rpg.tamedPet
                      ? `Companion: ${rpg.tamedPet.name} (Lv ${rpg.tamedPet.level} ${rpg.tamedPet.species})`
                      : 'Companion: None yet (Learn Beast Bond from Kael or pick Tamer at Lv 5).'}
                  </p>
                </div>
              </div>

              {/* Safety / PvP Flag */}
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                <div>
                  <p className="text-sm font-bold text-white">Combat Flag (PvE by Default)</p>
                  <p className="text-xs text-slate-400">
                    PvP stays off unless you opt in. Safe for family-friendly exploration and building.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onTogglePvp}
                  className={`whitespace-nowrap rounded-lg border px-4 py-2 text-xs font-bold transition-colors ${
                    rpg.pvpEnabled
                      ? 'border-rose-500 bg-rose-500/20 text-rose-200'
                      : 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
                  }`}
                >
                  {rpg.pvpEnabled ? 'PvP Flagged ON' : 'PvE Protected (PvP Off)'}
                </button>
              </div>
            </div>
          )}

          {tab === 'skills' && (
            <div className="space-y-4">
              {rpg.skills.length === 0 ? (
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 text-center">
                  <p className="text-sm font-semibold text-white">No skills learned yet</p>
                  <p className="mt-1 text-xs text-slate-400">
                    Speak to Sera (Shrine Mend), Bram (Smithing & Repair), Kael (Tracking, Bow Mastery, Beast Bond), or Lyra (Firebolt & Arcane Shield) in Elderglen Village.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {rpg.skills.map((sk) => (
                    <div
                      key={sk.id}
                      className="rounded-xl border border-slate-800 bg-slate-900/70 p-4"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-white">{sk.name}</span>
                        <span className="text-xs font-bold text-sky-400 tabular-nums">
                          Lv {sk.level}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-300">{sk.description}</p>
                      <div className="mt-2.5 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
                          <div
                            className="h-full bg-sky-400"
                            style={{ width: `${Math.min(100, (sk.xp / sk.maxXp) * 100)}%` }}
                          />
                        </div>
                        <span className="text-[11px] text-slate-400 tabular-nums">
                          {sk.xp}/{sk.maxXp}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t border-slate-800 pt-4">
                <p className="text-xs font-semibold text-slate-400">All Teachable Skills in Elderglen</p>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {Object.values(SKILL_CATALOG).map((sk) => {
                    const owned = rpg.skills.some((s) => s.id === sk.id);
                    return (
                      <div
                        key={sk.id}
                        className="flex items-center justify-between rounded-lg border border-slate-800/80 px-3 py-2 text-xs"
                      >
                        <span className="font-semibold text-slate-200">{sk.name}</span>
                        <span className={owned ? 'text-emerald-400' : 'text-slate-400'}>
                          {owned ? 'Learned' : sk.costGold > 0 ? `${sk.costGold}g` : 'Free'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {tab === 'gear' && (
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white">Equipped Gear</h3>
                  <button
                    type="button"
                    onClick={onOpenShrine}
                    className="whitespace-nowrap rounded-lg border border-sky-500/40 bg-sky-500/15 px-3 py-1.5 text-xs font-semibold text-sky-300 hover:bg-sky-500/25"
                  >
                    Soulbind at Shrine
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {(['weapon', 'armor', 'accessory'] as const).map((slot) => {
                    const item = rpg.equipped[slot];
                    return (
                      <div
                        key={slot}
                        className="rounded-xl border border-slate-800 bg-slate-900/70 p-3.5"
                      >
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                          {slot}
                        </p>
                        {item ? (
                          <>
                            <p className="mt-1 text-sm font-bold text-white">{item.name}</p>
                            <p className="mt-0.5 text-xs text-slate-300 tabular-nums">
                              {item.rarity}
                              {item.soulbound ? ' · Soulbound' : ' · Unbound'}
                            </p>
                            <p className="mt-1 text-xs text-slate-400 tabular-nums">
                              {item.attack > 0 ? `ATK +${item.attack} ` : ''}
                              {item.defense > 0 ? `DEF +${item.defense} ` : ''}
                              {item.bonusHp > 0 ? `HP +${item.bonusHp}` : ''}
                            </p>
                            <p className="mt-1 text-[11px] text-slate-400 tabular-nums">
                              Durability: {item.durability}/{item.maxDurability}
                            </p>
                          </>
                        ) : (
                          <p className="mt-1 text-xs text-slate-500">Empty slot</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-white">Inventory Bag ({rpg.inventory.length})</h3>
                {rpg.inventory.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-400">
                    Open dungeon chests, complete quests, or craft weapons to fill your bag.
                  </p>
                ) : (
                  <div className="mt-2.5 space-y-2">
                    {rpg.inventory.map((item) =>
                      renderGearRow(item, 'Equip', () => onEquipGear(item.id)),
                    )}
                  </div>
                )}
              </div>

              {currentChest.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-amber-300">
                    World Chest ({rpg.activeRealm}) — Unbound Gear Stored Here
                  </h3>
                  <div className="mt-2.5 space-y-2">
                    {currentChest.map((item) =>
                      renderGearRow(item, 'Take to Bag', () => onWithdrawChestGear(item.id)),
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'craft' && (
            <div className="space-y-5">
              {/* Resource Strip */}
              <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-xs tabular-nums">
                <span className="font-semibold text-slate-400">Materials:</span>
                <span>Wood: <strong className="text-white">{rpg.resources.wood}</strong></span>
                <span>Stone: <strong className="text-white">{rpg.resources.stone}</strong></span>
                <span>Ore: <strong className="text-amber-300">{rpg.resources.ore}</strong></span>
                <span>Meat: <strong className="text-rose-300">{rpg.resources.meat}</strong></span>
                <span>Hide: <strong className="text-emerald-300">{rpg.resources.hide}</strong></span>
                {isArtificer && (
                  <span className="text-sky-400">· Artificer Discount Active</span>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {CRAFT_RECIPES.map((recipe) => {
                  const entries = Object.entries(recipe.cost) as Array<[keyof RpgPlayerState['resources'], number]>;
                  const canAfford = entries.every(([res, amt]) => {
                    const effective = isArtificer ? Math.max(1, Math.ceil(amt * 0.7)) : amt;
                    return rpg.resources[res] >= effective;
                  });

                  return (
                    <div
                      key={recipe.id}
                      className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-900/70 p-4"
                    >
                      <div>
                        <p className="text-sm font-bold text-white">{recipe.name}</p>
                        <p className="mt-1 text-xs text-slate-400">{recipe.description}</p>
                        <p className="mt-2 text-xs text-slate-300 tabular-nums">
                          Cost:{' '}
                          {entries
                            .map(([res, amt]) => {
                              const effective = isArtificer ? Math.max(1, Math.ceil(amt * 0.7)) : amt;
                              return `${effective} ${res}`;
                            })
                            .join(' · ')}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={!canAfford}
                        onClick={() => onCraftRecipe(recipe)}
                        className={`mt-3 w-full whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-bold transition-colors ${
                          canAfford
                            ? 'bg-sky-500 text-slate-950 hover:bg-sky-400'
                            : 'cursor-not-allowed bg-slate-800 text-slate-500'
                        }`}
                      >
                        {recipe.resultType === 'food' ? 'Cook & Eat' : 'Craft Item'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 'worlds' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-white">Connected Realms (Dimensional Portals)</h3>
                <p className="mt-0.5 text-xs text-slate-400">
                  Only Soulbound gear travels through portals. Unbound gear stays safe in your current world’s chest.
                </p>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {REALM_LIST.map((realm) => {
                    const isHere = rpg.activeRealm === realm.id && rpg.activeDungeon === null;
                    return (
                      <div
                        key={realm.id}
                        className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-900/70 p-4"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-bold text-white">{realm.name}</span>
                            <span className="text-xs font-semibold text-slate-400 tabular-nums">
                              Lv {realm.minLevel}–{realm.maxLevel}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-400">{realm.description}</p>
                        </div>
                        <button
                          type="button"
                          disabled={isHere}
                          onClick={() => onRequestRealmTravel(realm.id)}
                          className={`mt-3 w-full whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold transition-colors ${
                            isHere
                              ? 'cursor-default bg-emerald-950/60 text-emerald-300'
                              : 'bg-slate-800 text-white hover:bg-slate-700'
                          }`}
                        >
                          {isHere ? 'Current World' : `Travel to ${realm.name.split(' ')[0]}`}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-white">Dungeons & Boss Trials</h3>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {DUNGEON_LIST.map((dung) => {
                    const cleared = rpg.clearedDungeons.includes(dung.id);
                    const locked =
                      dung.requiresCleared !== undefined &&
                      !rpg.clearedDungeons.includes(dung.requiresCleared);
                    const highDanger = rpg.level < dung.minLevel;

                    return (
                      <div
                        key={dung.id}
                        className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-900/70 p-4"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-bold text-white">{dung.name}</span>
                            <span className="text-xs font-semibold tabular-nums text-slate-400">
                              Lv {dung.minLevel}–{dung.maxLevel}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-400">{dung.description}</p>
                          <p className="mt-1.5 text-xs text-slate-300">
                            Boss: <strong className="text-rose-300">{dung.bossName}</strong>
                            {cleared && (
                              <span className="ml-2 inline-flex items-center gap-0.5 text-emerald-400">
                                <Check className="h-3 w-3" /> Cleared
                              </span>
                            )}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={locked}
                          onClick={() => onRequestDungeonEnter(dung.id)}
                          className={`mt-3 w-full whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold transition-colors ${
                            locked
                              ? 'cursor-not-allowed bg-slate-800/60 text-slate-500'
                              : highDanger
                                ? 'bg-orange-500/20 text-orange-200 border border-orange-500/40 hover:bg-orange-500/30'
                                : 'bg-sky-500 text-slate-950 hover:bg-sky-400'
                          }`}
                        >
                          {locked
                            ? 'Clear Sunken Crypt First'
                            : highDanger
                              ? `Enter Anyway (Above Your Level)`
                              : `Enter ${dung.name}`}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
