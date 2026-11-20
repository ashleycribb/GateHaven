import React, { useMemo } from 'react';
import {
  Home,
  Compass,
  Hammer,
  Eye,
  Save,
  ShieldAlert,
  HelpCircle,
  Paintbrush,
  Eraser,
  PaintBucket,
  Undo2,
  Redo2,
  RotateCcw,
  Sun,
  Sunset,
  Moon,
  Sunrise,
  ScrollText,
  Sparkles,
  UserRound,
  ChevronDown,
  ChevronUp,
  Flame,
  Crosshair,
  Heart,
  PawPrint,
  ScanSearch,
} from 'lucide-react';
import {
  BrushSize,
  CameraViewMode,
  CreatureHudTarget,
  EditorTool,
  PlaceableBlockId,
  RpgPlayerState,
  TimeOfDayState,
  WorldMode,
} from '../types/blockhaven';
import { BLOCK_LIST, getBlockIconUrls } from '../engine/blocks';
import { CLASS_BY_ID, DUNGEON_BY_ID, REALM_BY_ID } from '../rpg/rpgData';

interface TopHudProps {
  worldName: string;
  worldMode: WorldMode;
  cameraView: CameraViewMode;
  selectedBlock: PlaceableBlockId;
  editorTool: EditorTool;
  brushSize: BrushSize;
  undoCount: number;
  redoCount: number;
  pointerLocked: boolean;
  hasUnsavedChanges: boolean;
  timeOfDay: TimeOfDayState;
  rpg: RpgPlayerState;
  targetCreature: CreatureHudTarget | null;
  interactPrompt: string | null;
  statusHint: string | null;
  dockCollapsed: boolean;
  onToggleDock: () => void;
  onGoHome: () => void;
  onSetWorldMode: (mode: WorldMode) => void;
  onSelectBlock: (id: PlaceableBlockId) => void;
  onSetEditorTool: (tool: EditorTool) => void;
  onSetBrushSize: (size: BrushSize) => void;
  onUndo: () => void;
  onRedo: () => void;
  onRespawn: () => void;
  onToggleCameraView: () => void;
  onCycleTimeOfDay: () => void;
  onOpenStatus: () => void;
  onOpenQuests: () => void;
  onOpenWorlds: () => void;
  onOpenClassModal: () => void;
  onOpenMyWorlds: () => void;
  onOpenSafety: () => void;
  onOpenHelp: () => void;
  onTriggerSkill: (skill: 'bow' | 'firebolt' | 'mend' | 'tame' | 'inspect') => void;
  onTriggerInteract: () => void;
  onRequestPointerLock: () => void;
}

export const TopHud: React.FC<TopHudProps> = ({
  worldName,
  worldMode,
  cameraView,
  selectedBlock,
  editorTool,
  brushSize,
  undoCount,
  redoCount,
  pointerLocked,
  hasUnsavedChanges,
  timeOfDay,
  rpg,
  targetCreature,
  interactPrompt,
  statusHint,
  dockCollapsed,
  onToggleDock,
  onGoHome,
  onSetWorldMode,
  onSelectBlock,
  onSetEditorTool,
  onSetBrushSize,
  onUndo,
  onRedo,
  onRespawn,
  onToggleCameraView,
  onCycleTimeOfDay,
  onOpenStatus,
  onOpenQuests,
  onOpenWorlds,
  onOpenClassModal,
  onOpenMyWorlds,
  onOpenSafety,
  onOpenHelp,
  onTriggerSkill,
  onTriggerInteract,
  onRequestPointerLock,
}) => {
  const icons = useMemo(() => getBlockIconUrls(), []);

  const TimeIcon =
    timeOfDay.phase === 'Dawn'
      ? Sunrise
      : timeOfDay.phase === 'Day'
        ? Sun
        : timeOfDay.phase === 'Sunset'
          ? Sunset
          : Moon;

  const classLabel =
    rpg.playerClass === 'unawakened' ? 'Unawakened' : CLASS_BY_ID[rpg.playerClass].name;
  const locationLabel = rpg.activeDungeon
    ? DUNGEON_BY_ID[rpg.activeDungeon].name
    : REALM_BY_ID[rpg.activeRealm].name;

  const hasBow = rpg.skills.some((s) => s.id === 'bow_mastery');
  const hasFirebolt = rpg.skills.some((s) => s.id === 'firebolt');
  const hasMend = rpg.skills.some((s) => s.id === 'shrine_mend');
  const canTame = rpg.playerClass === 'tamer' || rpg.skills.some((s) => s.id === 'beast_bond');
  const inspectSkill = rpg.skills.find((s) => s.id === 'inspect');

  const readyToClaimQuests = rpg.quests.filter((q) => q.completed && !q.claimed).length;

  return (
    <>
      {/* TOP BAR */}
      <header className="pointer-events-auto fixed inset-x-0 top-0 z-20 flex items-center justify-between gap-3 border-b border-slate-800 bg-slate-950/94 px-3 py-2 text-slate-100 shadow-md">
        {/* Left: Home + World / Realm Title + Mode Switch */}
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onGoHome}
            title="Home Screen"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 cursor-pointer"
          >
            <Home className="h-4 w-4" />
          </button>

          <div className="hidden lg:block min-w-0">
            <p className="truncate max-w-[175px] text-xs font-bold text-white">
              {worldMode === 'play' ? locationLabel : worldName}
            </p>
            <p className="text-[11px] text-slate-400">
              {worldMode === 'play'
                ? rpg.pvpEnabled
                  ? 'PvP Active'
                  : 'PvE Safe'
                : hasUnsavedChanges
                  ? 'Unsaved edits'
                  : 'Saved locally'}
            </p>
          </div>

          <div className="flex items-center rounded-lg border border-slate-700 bg-slate-900 p-0.5">
            <button
              type="button"
              onClick={() => onSetWorldMode('play')}
              className={`flex items-center gap-1 whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                worldMode === 'play' ? 'bg-sky-500 text-slate-950' : 'text-slate-300 hover:text-white'
              }`}
            >
              <Compass className="h-3.5 w-3.5" />
              Play
            </button>
            <button
              type="button"
              onClick={() => onSetWorldMode('create')}
              className={`flex items-center gap-1 whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                worldMode === 'create' ? 'bg-blue-500 text-white' : 'text-slate-300 hover:text-white'
              }`}
            >
              <Hammer className="h-3.5 w-3.5" />
              Create
            </button>
          </div>
        </div>

        {/* Center: RPG Quick Access (Play) or Create Tools (Create) */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {worldMode === 'play' ? (
            <>
              <button
                type="button"
                onClick={onOpenStatus}
                className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-sky-500/40 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-sky-200 hover:bg-slate-800 cursor-pointer"
              >
                <UserRound className="h-3.5 w-3.5 text-sky-400" />
                Status &amp; Gear
              </button>
              <button
                type="button"
                onClick={onOpenQuests}
                className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 cursor-pointer"
              >
                <ScrollText className="h-3.5 w-3.5 text-amber-400" />
                Quests{readyToClaimQuests > 0 ? ` (${readyToClaimQuests}!)` : ''}
              </button>
              <button
                type="button"
                onClick={onOpenWorlds}
                className="hidden sm:flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 cursor-pointer"
              >
                <Compass className="h-3.5 w-3.5 text-emerald-400" />
                Worlds &amp; Dungeons
              </button>
              {rpg.level >= 5 && rpg.playerClass === 'unawakened' && (
                <button
                  type="button"
                  onClick={onOpenClassModal}
                  className="flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-300 cursor-pointer"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Awaken Class
                </button>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center rounded-lg border border-slate-700 bg-slate-900 p-0.5">
                {(
                  [
                    { id: 'paint', label: 'Paint', icon: Paintbrush },
                    { id: 'erase', label: 'Erase', icon: Eraser },
                    { id: 'fill', label: 'Fill', icon: PaintBucket },
                  ] as const
                ).map((t) => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => onSetEditorTool(t.id)}
                      className={`flex items-center gap-1 whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-semibold cursor-pointer ${
                        editorTool === t.id ? 'bg-blue-500 text-white' : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {t.label}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => onSetBrushSize(brushSize === 1 ? 3 : 1)}
                className="whitespace-nowrap rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 cursor-pointer"
              >
                Brush {brushSize}×{brushSize}
              </button>

              <button
                type="button"
                disabled={undoCount === 0}
                onClick={onUndo}
                title="Undo (Ctrl+Z)"
                className="flex items-center gap-1 whitespace-nowrap rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
              >
                <Undo2 className="h-3.5 w-3.5" />
                {undoCount}
              </button>
              <button
                type="button"
                disabled={redoCount === 0}
                onClick={onRedo}
                title="Redo (Ctrl+Shift+Z)"
                className="flex items-center gap-1 whitespace-nowrap rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
              >
                <Redo2 className="h-3.5 w-3.5" />
                {redoCount}
              </button>
            </>
          )}
        </div>

        {/* Right: Time, Camera, Save, Safety, Help */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onCycleTimeOfDay}
            title="Cycle Time of Day (Key T)"
            className="flex items-center gap-1 whitespace-nowrap rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 cursor-pointer"
          >
            <TimeIcon className="h-3.5 w-3.5 text-amber-300" />
            <span className="hidden md:inline">{timeOfDay.phase}</span>
          </button>

          <button
            type="button"
            onClick={onToggleCameraView}
            title="Switch 1st / 3rd Person (Key V)"
            className="flex items-center gap-1 whitespace-nowrap rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 cursor-pointer"
          >
            <Eye className="h-3.5 w-3.5 text-sky-400" />
            <span className="hidden sm:inline">{cameraView === 'first-person' ? '1P' : '3P'}</span>
          </button>

          <button
            type="button"
            onClick={onOpenMyWorlds}
            title="Save, Load & Share Worlds"
            className="flex items-center gap-1 whitespace-nowrap rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 cursor-pointer"
          >
            <Save className="h-3.5 w-3.5 text-emerald-400" />
            <span className="hidden md:inline">Save</span>
          </button>

          <button
            type="button"
            onClick={onRespawn}
            title="Return to Spawn"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={onOpenSafety}
            title="Safety, Report & Block"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 cursor-pointer"
          >
            <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />
          </button>

          <button
            type="button"
            onClick={onOpenHelp}
            title="Settings, Labels & Controls"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 cursor-pointer"
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {/* PLAY MODE COMPACT VITALS STRIP (Top-Left, unobtrusive) */}
      {worldMode === 'play' && (
        <div className="pointer-events-auto fixed left-3 top-14 z-10 w-60 rounded-xl border border-slate-700/90 bg-slate-950/90 p-3 text-slate-100 shadow-lg">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs font-bold text-white tabular-nums">
              Lv {rpg.level} · {classLabel}
            </span>
            <span className="text-xs font-bold text-amber-300 tabular-nums">{rpg.gold}g</span>
          </div>

          {/* HP / Stamina / Hunger bars */}
          <div className="mt-2 space-y-1.5 text-[11px] tabular-nums">
            <div className="flex items-center gap-2">
              <span className="w-7 text-rose-300 font-semibold">HP</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full bg-rose-500 transition-all"
                  style={{ width: `${Math.min(100, (rpg.hp / rpg.maxHp) * 100)}%` }}
                />
              </div>
              <span className="w-12 text-right text-slate-300">
                {Math.round(rpg.hp)}/{rpg.maxHp}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-7 text-amber-300 font-semibold">STA</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full bg-amber-400 transition-all"
                  style={{ width: `${Math.min(100, (rpg.stamina / rpg.maxStamina) * 100)}%` }}
                />
              </div>
              <span className="w-12 text-right text-slate-400">{Math.round(rpg.stamina)}</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-7 text-emerald-300 font-semibold">HGR</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full bg-emerald-500 transition-all"
                  style={{ width: `${Math.min(100, (rpg.hunger / rpg.maxHunger) * 100)}%` }}
                />
              </div>
              <span className="w-12 text-right text-slate-400">{Math.round(rpg.hunger)}</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-7 text-sky-300 font-semibold">XP</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full bg-sky-400 transition-all"
                  style={{ width: `${Math.min(100, (rpg.xp / rpg.xpToNext) * 100)}%` }}
                />
              </div>
              <span className="w-12 text-right text-slate-400">
                {rpg.xp}/{rpg.xpToNext}
              </span>
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-slate-800 pt-1.5 text-[11px] text-slate-400 tabular-nums">
            <span>W:{rpg.resources.wood} · S:{rpg.resources.stone} · O:{rpg.resources.ore}</span>
            {rpg.tamedPet && <span className="text-teal-300 truncate max-w-[80px]">{rpg.tamedPet.name}</span>}
          </div>
        </div>
      )}

      {/* CREATURE / BOSS TARGET BAR (Top-Center) */}
      {worldMode === 'play' && targetCreature && (
        <div className="pointer-events-none fixed left-1/2 top-16 z-20 w-72 -translate-x-1/2 rounded-xl border border-slate-700 bg-slate-950/92 px-4 py-2.5 text-center shadow-lg">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-white">
              {targetCreature.isBoss ? 'BOSS · ' : ''}
              {targetCreature.name}
            </span>
            <span className="font-semibold text-slate-300 tabular-nums">
              Lv {targetCreature.level}
              {targetCreature.tameable ? ' · Tameable [Y]' : ''}
            </span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-800">
            <div
              className={`h-full ${
                targetCreature.isBoss
                  ? 'bg-rose-500'
                  : targetCreature.hostile
                    ? 'bg-orange-500'
                    : 'bg-emerald-400'
              }`}
              style={{
                width: `${Math.min(100, (targetCreature.hp / Math.max(1, targetCreature.maxHp)) * 100)}%`,
              }}
            />
          </div>
          <p className="mt-1 text-[11px] text-slate-400 tabular-nums">
            {targetCreature.hp} / {targetCreature.maxHp} HP
          </p>
        </div>
      )}

      {/* CENTER CROSSHAIR */}
      <div className="pointer-events-none fixed inset-0 z-10 flex items-center justify-center">
        <div className="relative h-5 w-5">
          <div className="absolute left-1/2 top-0 h-5 w-0.5 -translate-x-1/2 bg-white/85 shadow" />
          <div className="absolute left-0 top-1/2 h-0.5 w-5 -translate-y-1/2 bg-white/85 shadow" />
        </div>
      </div>

      {/* PROXIMITY INTERACT PROMPT OR STATUS HINT */}
      {(interactPrompt || statusHint || !pointerLocked) && (
        <div className="pointer-events-none fixed left-1/2 bottom-28 z-20 flex -translate-x-1/2 flex-col items-center gap-1.5">
          {interactPrompt && (
            <button
              type="button"
              onClick={onTriggerInteract}
              className="pointer-events-auto whitespace-nowrap rounded-lg border border-sky-400/70 bg-slate-950/94 px-4 py-1.5 text-xs font-bold text-sky-200 shadow-lg hover:bg-slate-900 cursor-pointer"
            >
              {interactPrompt}
            </button>
          )}
          {statusHint && (
            <div className="rounded-lg border border-slate-700 bg-slate-950/92 px-3.5 py-1 text-xs font-medium text-slate-200 shadow">
              {statusHint}
            </div>
          )}
          {!pointerLocked && !interactPrompt && !statusHint && (
            <button
              type="button"
              onClick={onRequestPointerLock}
              className="pointer-events-auto whitespace-nowrap rounded-lg border border-slate-700 bg-slate-950/88 px-3 py-1 text-[11px] font-medium text-slate-300 hover:bg-slate-900 hover:text-white cursor-pointer"
            >
              Click for Mouse Look (or Drag) · Left-Click Attack/Mine · Right-Click Place · E Interact
            </button>
          )}
        </div>
      )}

      {/* UNIFIED COLLAPSIBLE BOTTOM DOCK (Skills + 20 Fine Blocks Palette) */}
      <div className="pointer-events-none fixed inset-x-0 bottom-3 z-20 flex flex-col items-center px-3">
        <button
          type="button"
          onClick={onToggleDock}
          className="pointer-events-auto mb-1 flex items-center gap-1 rounded-t-lg border border-b-0 border-slate-700 bg-slate-950/92 px-3 py-0.5 text-[11px] font-semibold text-slate-300 hover:text-white cursor-pointer"
        >
          {dockCollapsed ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {dockCollapsed ? 'Show Palette & Skills' : 'Hide Dock'}
        </button>

        {!dockCollapsed && (
          <div className="pointer-events-auto flex max-w-[min(980px,96vw)] flex-col gap-2 rounded-2xl border border-slate-700 bg-slate-950/94 px-3 py-2 shadow-2xl">
            {/* Play Mode Skill Strip */}
            {worldMode === 'play' && (
              <div className="flex flex-wrap items-center justify-center gap-1.5 border-b border-slate-800 pb-2">
                <button
                  type="button"
                  onClick={() => onTriggerSkill('bow')}
                  className={`flex items-center gap-1 whitespace-nowrap rounded-lg border px-2.5 py-1 text-xs font-semibold cursor-pointer ${
                    hasBow
                      ? 'border-emerald-500/50 bg-emerald-950/60 text-emerald-200 hover:bg-emerald-900/60'
                      : 'border-slate-800 bg-slate-900 text-slate-400'
                  }`}
                >
                  <Crosshair className="h-3.5 w-3.5" />
                  [R] Bow{hasBow ? '' : ' (Kael)'}
                </button>
                <button
                  type="button"
                  onClick={() => onTriggerSkill('firebolt')}
                  className={`flex items-center gap-1 whitespace-nowrap rounded-lg border px-2.5 py-1 text-xs font-semibold cursor-pointer ${
                    hasFirebolt
                      ? 'border-orange-500/50 bg-orange-950/60 text-orange-200 hover:bg-orange-900/60'
                      : 'border-slate-800 bg-slate-900 text-slate-400'
                  }`}
                >
                  <Flame className="h-3.5 w-3.5" />
                  [G] Firebolt{hasFirebolt ? '' : ' (Lyra)'}
                </button>
                <button
                  type="button"
                  onClick={() => onTriggerSkill('mend')}
                  className={`flex items-center gap-1 whitespace-nowrap rounded-lg border px-2.5 py-1 text-xs font-semibold cursor-pointer ${
                    hasMend
                      ? 'border-sky-500/50 bg-sky-950/60 text-sky-200 hover:bg-sky-900/60'
                      : 'border-slate-800 bg-slate-900 text-slate-400'
                  }`}
                >
                  <Heart className="h-3.5 w-3.5" />
                  [C] Mend{hasMend ? '' : ' (Sera)'}
                </button>
                <button
                  type="button"
                  onClick={() => onTriggerSkill('tame')}
                  className={`flex items-center gap-1 whitespace-nowrap rounded-lg border px-2.5 py-1 text-xs font-semibold cursor-pointer ${
                    canTame
                      ? 'border-teal-500/50 bg-teal-950/60 text-teal-200 hover:bg-teal-900/60'
                      : 'border-slate-800 bg-slate-900 text-slate-400'
                  }`}
                >
                  <PawPrint className="h-3.5 w-3.5" />
                  [Y] Tame{canTame ? '' : ' (Tamer/Kael)'}
                </button>
                <button
                  type="button"
                  onClick={() => onTriggerSkill('inspect')}
                  className={`flex items-center gap-1 whitespace-nowrap rounded-lg border px-2.5 py-1 text-xs font-semibold cursor-pointer ${
                    inspectSkill
                      ? 'border-indigo-400/50 bg-indigo-950/70 text-indigo-200 hover:bg-indigo-900/70'
                      : 'border-slate-800 bg-slate-900 text-slate-400'
                  }`}
                >
                  <ScanSearch className="h-3.5 w-3.5" />
                  [I] Inspect{inspectSkill ? ` Lv ${inspectSkill.level}` : ' (Lyra)'}
                </button>
              </div>
            )}

            {/* 20 Fine-Block Palette */}
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
              {BLOCK_LIST.map((b) => {
                const active = selectedBlock === b.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => onSelectBlock(b.id)}
                    title={`${b.name} (${b.key})`}
                    className={`group relative flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg border transition-colors cursor-pointer ${
                      active
                        ? 'border-sky-400 bg-sky-500/20'
                        : 'border-slate-800 bg-slate-900 hover:border-slate-600'
                    }`}
                  >
                    <img
                      src={icons[b.id]}
                      alt={b.name}
                      className="h-7 w-7 object-contain"
                      draggable={false}
                    />
                    <span className="text-[9px] font-medium leading-none text-slate-300 truncate max-w-[40px]">
                      {b.shortLabel}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </>
  );
};
