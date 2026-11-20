import React from 'react';
import {
  Compass,
  Hammer,
  FolderOpen,
  ShieldCheck,
  HelpCircle,
  UserRound,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';
import { AvatarConfig, RpgPlayerState, SavedWorldMeta, WorldTemplateId } from '../types/blockhaven';
import { WORLD_TEMPLATES } from '../engine/worldGen';
import { CLASS_BY_ID } from '../rpg/rpgData';

interface HomeScreenProps {
  avatar: AvatarConfig;
  rpg: RpgPlayerState;
  savedWorlds: SavedWorldMeta[];
  onPlayAdventure: () => void;
  onStartNewRebirth: () => void;
  onStartTemplate: (template: WorldTemplateId, mode: 'play' | 'create') => void;
  onOpenMyWorlds: () => void;
  onOpenAvatar: () => void;
  onOpenSafety: () => void;
  onOpenHelp: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  avatar,
  rpg,
  savedWorlds,
  onPlayAdventure,
  onStartNewRebirth,
  onStartTemplate,
  onOpenMyWorlds,
  onOpenAvatar,
  onOpenSafety,
  onOpenHelp,
}) => {
  const classText =
    rpg.playerClass === 'unawakened' ? 'Unawakened' : CLASS_BY_ID[rpg.playerClass].name;

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between">
      {/* Top Bar Contract: 3 clean zones separated by gap-8 */}
      <header className="pointer-events-auto flex items-center justify-between gap-8 border-b border-slate-900/10 bg-white/96 px-6 py-3.5 shadow-sm">
        <span className="font-[var(--font-display)] text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
          Gate Haven
        </span>

        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
          <button
            type="button"
            onClick={onPlayAdventure}
            className="hover:text-slate-900 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            Play
          </button>
          <button
            type="button"
            onClick={() => onStartTemplate('flat', 'create')}
            className="hover:text-slate-900 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            Create
          </button>
          <button
            type="button"
            onClick={onOpenMyWorlds}
            className="hover:text-slate-900 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            My Worlds
          </button>
          <button
            type="button"
            onClick={onOpenSafety}
            className="hover:text-slate-900 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            Safety
          </button>
          <button
            type="button"
            onClick={onOpenHelp}
            className="hover:text-slate-900 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            Settings &amp; Controls
          </button>
        </nav>

        <button
          type="button"
          onClick={onOpenAvatar}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          <UserRound className="h-4 w-4" />
          <span className="max-w-[120px] truncate">{avatar.displayName || 'Traveler'}</span>
        </button>
      </header>

      {/* Main Content */}
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-between px-4 py-6 sm:px-6 lg:py-8 overflow-y-auto">
        <div className="pointer-events-auto max-w-xl rounded-2xl border border-slate-900/12 bg-white/96 p-6 sm:p-8 shadow-xl">
          <p className="text-xs font-semibold text-sky-700">
            Voxel RPG &amp; Fine-Block Sandbox · Family Friendly · Offline Browser Saves
          </p>

          <h1 className="font-[var(--font-display)] mt-2 text-3xl sm:text-5xl font-bold leading-tight tracking-tight text-slate-900 text-balance">
            Explore a tactile voxel world of fine blocks, skills, and dungeons.
          </h1>

          <p className="mt-3 text-sm sm:text-base leading-relaxed text-slate-600">
            Begin beside Elderglen’s Awakening Shrine with no class, learn practical skills from
            villagers, delve into procedural dungeons, cross portals to new realms, or sculpt with
            half-size blocks in Create Mode.
          </p>

          {/* Primary Actions */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onPlayAdventure}
              className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white hover:bg-sky-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Compass className="h-4 w-4" />
              {rpg.rebirthCompleted
                ? `Continue Adventure (Lv ${rpg.level} ${classText})`
                : 'Start Adventure'}
            </button>

            <button
              type="button"
              onClick={() => onStartTemplate('flat', 'create')}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Hammer className="h-4 w-4" />
              Create World
            </button>

            <button
              type="button"
              onClick={onOpenMyWorlds}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <FolderOpen className="h-4 w-4" />
              My Worlds ({savedWorlds.length})
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-500">
            {rpg.rebirthCompleted && (
              <button
                type="button"
                onClick={onStartNewRebirth}
                className="inline-flex items-center gap-1.5 font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                New Adventure
              </button>
            )}
            <button
              type="button"
              onClick={onOpenSafety}
              className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 hover:text-emerald-800 cursor-pointer"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Family Safety &amp; PvE Default
            </button>
            <button
              type="button"
              onClick={onOpenHelp}
              className="inline-flex items-center gap-1.5 font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              Settings &amp; Controls
            </button>
          </div>
        </div>

        {/* Bottom 4 Starter Templates Strip */}
        <section className="pointer-events-auto mt-6">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-white drop-shadow">
              Starter Templates · 64×64 Fine-Block Worlds
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {WORLD_TEMPLATES.map((tpl) => (
              <div
                key={tpl.id}
                className="flex flex-col justify-between rounded-xl border border-slate-900/12 bg-white/95 p-4 shadow-md"
              >
                <div>
                  <h2 className="font-[var(--font-display)] text-sm font-bold text-slate-900">
                    {tpl.name}
                  </h2>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">{tpl.tagline}</p>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onStartTemplate(tpl.id, 'play')}
                    className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer whitespace-nowrap"
                  >
                    Play
                    <ArrowRight className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onStartTemplate(tpl.id, 'create')}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer whitespace-nowrap"
                  >
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};
