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
  Gamepad2,
} from 'lucide-react';
import { AvatarConfig, RpgPlayerState, SavedWorldMeta, WorldTemplateId } from '../types/blockhaven';
import { WORLD_TEMPLATES } from '../engine/worldGen';
import { CLASS_BY_ID } from '../rpg/rpgData';
import { ControllerBrand, getGamepadGlyphs, InputModality } from '../input/gamepadManager';

interface HomeScreenProps {
  avatar: AvatarConfig;
  rpg: RpgPlayerState;
  savedWorlds: SavedWorldMeta[];
  inputMode: InputModality;
  controllerBrand: ControllerBrand;
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
  inputMode,
  controllerBrand,
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
  const glyphs = getGamepadGlyphs(controllerBrand);

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between">
      {/* Top Bar Contract: 3 clean zones separated by gap-8 */}
      <header className="pointer-events-auto flex items-center justify-between gap-8 border-b border-[#5A4B3A]/85 bg-[#1B1612]/94 px-6 py-3.5 shadow-md">
        <span className="font-[var(--font-display)] text-xl font-bold tracking-wide text-[#EFE4CE] whitespace-nowrap shrink-0">
          Gate Haven
        </span>

        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#C8B9A0]">
          <button
            type="button"
            onClick={onPlayAdventure}
            className="hover:text-[#F4E9D4] transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            Play
          </button>
          <button
            type="button"
            onClick={() => onStartTemplate('flat', 'create')}
            className="hover:text-[#F4E9D4] transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            Create
          </button>
          <button
            type="button"
            onClick={onOpenMyWorlds}
            className="hover:text-[#F4E9D4] transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            My Worlds
          </button>
          <button
            type="button"
            onClick={onOpenSafety}
            className="hover:text-[#F4E9D4] transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            Safety
          </button>
          <button
            type="button"
            onClick={onOpenHelp}
            className="hover:text-[#F4E9D4] transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            Settings &amp; Controls
          </button>
        </nav>

        <button
          type="button"
          onClick={onOpenAvatar}
          className="inline-flex items-center gap-2 rounded-lg border border-[#6C5841] bg-[#2B231C] px-4 py-2 text-sm font-semibold text-[#F0E5D1] hover:bg-[#382D24] transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          <UserRound className="h-4 w-4 text-[#D2A358]" />
          <span className="max-w-[120px] truncate">{avatar.displayName || 'Traveler'}</span>
        </button>
      </header>

      {/* Main Content */}
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-between px-4 py-6 sm:px-6 lg:py-8 overflow-y-auto">
        <div className="pointer-events-auto max-w-xl rounded-xl border border-[#665440]/90 bg-[#1B1612]/92 p-6 sm:p-8 shadow-2xl">
          <p className="text-xs font-semibold tracking-wide text-[#D4A65C]">
            Voxel RPG &amp; Fine-Block Sandbox · Family Friendly · Play Together
          </p>

          <h1 className="font-[var(--font-display)] mt-2 text-3xl sm:text-5xl font-bold leading-tight tracking-tight text-[#F3E9D6] text-balance">
            You decide your adventure.
          </h1>

          <p className="mt-3 text-sm sm:text-base leading-relaxed text-[#CFC2AA]">
            Come join the adventure with your friends. Wake up beside Elderglen&apos;s Awakening
            Shrine with no class and a whole world ahead — choose your class, your skills, your
            path, and the worlds you visit, then share them with a code and invite your friends in.
          </p>

          {/* Primary Actions */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onPlayAdventure}
              className="inline-flex items-center gap-2 rounded-lg border border-[#D4A65C]/70 bg-[#9C6C30] px-5 py-3 text-sm font-semibold text-[#FDF6E8] hover:bg-[#AE7A39] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Compass className="h-4 w-4" />
              {rpg.rebirthCompleted
                ? `Continue Adventure (Lv ${rpg.level} ${classText})`
                : 'Start Adventure'}
            </button>

            <button
              type="button"
              onClick={() => onStartTemplate('flat', 'create')}
              className="inline-flex items-center gap-2 rounded-lg border border-[#6A5743] bg-[#2D241C] px-5 py-3 text-sm font-semibold text-[#EFE4CE] hover:bg-[#3A2F24] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Hammer className="h-4 w-4 text-[#D2A358]" />
              Create World
            </button>

            <button
              type="button"
              onClick={onOpenMyWorlds}
              className="inline-flex items-center gap-2 rounded-lg border border-[#5A4B3A] bg-[#211B16] px-4 py-3 text-sm font-semibold text-[#DFD2BA] hover:bg-[#2E251E] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <FolderOpen className="h-4 w-4 text-[#BFA983]" />
              My Worlds ({savedWorlds.length})
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-[#B3A48C]">
            {rpg.rebirthCompleted && (
              <button
                type="button"
                onClick={onStartNewRebirth}
                className="inline-flex items-center gap-1.5 font-semibold text-[#C8B9A0] hover:text-[#F4E9D4] cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                New Adventure
              </button>
            )}
            <button
              type="button"
              onClick={onOpenSafety}
              className="inline-flex items-center gap-1.5 font-semibold text-[#8FB37C] hover:text-[#A9CC96] cursor-pointer"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Family Safety &amp; PvE Default
            </button>
            <button
              type="button"
              onClick={onOpenHelp}
              className="inline-flex items-center gap-1.5 font-semibold text-[#C8B9A0] hover:text-[#F4E9D4] cursor-pointer"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              Settings &amp; Controls
            </button>
          </div>
        </div>

        {/* Bottom 4 Starter Templates Strip */}
        <section className="pointer-events-auto mt-6">
          <div className="mb-2 flex items-center justify-between gap-4">
            <span className="text-xs font-semibold tracking-wide text-[#EFE4CE] drop-shadow">
              Starter Templates · 64×64 Fine-Block Worlds
            </span>
            {inputMode === 'gamepad' && (
              <span className="inline-flex items-center gap-1.5 rounded border border-[#665440] bg-[#1B1612]/92 px-2.5 py-0.5 text-[11px] font-medium text-[#E4D6BD]">
                <Gamepad2 className="h-3.5 w-3.5 text-[#D4A65C]" />
                {glyphs.dpad} Navigate · [{glyphs.a}] Select · [{glyphs.b}] Back
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {WORLD_TEMPLATES.map((tpl) => (
              <div
                key={tpl.id}
                className="flex flex-col justify-between rounded-xl border border-[#5D4C3A]/90 bg-[#1B1612]/92 p-4 shadow-lg"
              >
                <div>
                  <h2 className="font-[var(--font-display)] text-sm font-bold text-[#F0E5D1]">
                    {tpl.name}
                  </h2>
                  <p className="mt-1 text-xs leading-relaxed text-[#C0B199]">{tpl.tagline}</p>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onStartTemplate(tpl.id, 'play')}
                    className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-[#745F46] bg-[#2F261D] px-3 py-1.5 text-xs font-semibold text-[#F2E7D3] hover:bg-[#3D3125] cursor-pointer whitespace-nowrap"
                  >
                    Play
                    <ArrowRight className="h-3 w-3 text-[#D4A65C]" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onStartTemplate(tpl.id, 'create')}
                    className="rounded-lg border border-[#5A4B3A] bg-[#211B16] px-3 py-1.5 text-xs font-semibold text-[#D5C7AE] hover:bg-[#2E251E] cursor-pointer whitespace-nowrap"
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
