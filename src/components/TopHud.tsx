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
  Shield,
  Gamepad2,
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
import { ControllerBrand, getGamepadGlyphs, InputModality } from '../input/gamepadManager';

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
  inputMode: InputModality;
  controllerBrand: ControllerBrand;
  isBlocking: boolean;
  skillStripFocused: boolean;
  activeSkillIndex: number;
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
  inputMode,
  controllerBrand,
  isBlocking,
  skillStripFocused,
  activeSkillIndex,
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
  const isGamepad = inputMode === 'gamepad';
  const glyphs = useMemo(() => getGamepadGlyphs(controllerBrand), [controllerBrand]);

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

  // Format proximity interact prompt dynamically for controller vs keyboard
  const formattedInteractPrompt = useMemo(() => {
    if (!interactPrompt) return null;
    if (!isGamepad) return interactPrompt;
    return interactPrompt.replace(/\[E\]/gi, `[${glyphs.x}]`);
  }, [interactPrompt, isGamepad, glyphs.x]);

  const skillItems = [
    {
      id: 'bow' as const,
      keyLabel: 'R',
      label: `Bow${hasBow ? '' : ' (Kael)'}`,
      unlocked: hasBow,
      icon: Crosshair,
      accentClass: 'border-[#5F8052]/70 bg-[#232D1F] text-[#CBE0BC] hover:bg-[#2C3926]',
    },
    {
      id: 'firebolt' as const,
      keyLabel: 'G',
      label: `Firebolt${hasFirebolt ? '' : ' (Lyra)'}`,
      unlocked: hasFirebolt,
      icon: Flame,
      accentClass: 'border-[#B06C3A]/70 bg-[#322116] text-[#F1CBA6] hover:bg-[#3F2A1C]',
    },
    {
      id: 'mend' as const,
      keyLabel: 'C',
      label: `Mend${hasMend ? '' : ' (Sera)'}`,
      unlocked: hasMend,
      icon: Heart,
      accentClass: 'border-[#968352]/70 bg-[#2C271C] text-[#EAE0C2] hover:bg-[#393224]',
    },
    {
      id: 'tame' as const,
      keyLabel: 'Y',
      label: `Tame${canTame ? '' : ' (Tamer/Kael)'}`,
      unlocked: canTame,
      icon: PawPrint,
      accentClass: 'border-[#4F7D73]/70 bg-[#1D2B28] text-[#C2E0D8] hover:bg-[#253834]',
    },
    {
      id: 'inspect' as const,
      keyLabel: 'I',
      label: `Inspect${inspectSkill ? ` Lv ${inspectSkill.level}` : ' (Lyra)'}`,
      unlocked: Boolean(inspectSkill),
      icon: ScanSearch,
      accentClass: 'border-[#8D7856]/70 bg-[#2B241B] text-[#E6D6B8] hover:bg-[#382F23]',
    },
  ];

  return (
    <>
      {/* TOP BAR — Rustic weathered wood & parchment */}
      <header className="pointer-events-auto fixed inset-x-0 top-0 z-20 flex items-center justify-between gap-3 border-b border-[#594938] bg-[#1A1511]/94 px-3 py-2 text-[#EDE2CC] shadow-md">
        {/* Left: Home + World / Realm Title + Mode Switch */}
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onGoHome}
            title="Home Screen"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#5B4B3A] bg-[#261F18] text-[#E8DCC5] hover:bg-[#332920] cursor-pointer"
          >
            <Home className="h-4 w-4" />
          </button>

          <div className="hidden lg:block min-w-0">
            <p className="font-[var(--font-display)] truncate max-w-[180px] text-xs font-bold text-[#F3E9D6]">
              {worldMode === 'play' ? locationLabel : worldName}
            </p>
            <p className="text-[11px] text-[#B4A48C]">
              {worldMode === 'play'
                ? rpg.pvpEnabled
                  ? 'PvP Active'
                  : 'PvE Safe'
                : hasUnsavedChanges
                  ? 'Unsaved edits'
                  : 'Saved locally'}
            </p>
          </div>

          <div className="flex items-center rounded-lg border border-[#5B4B3A] bg-[#231C16] p-0.5">
            <button
              type="button"
              onClick={() => onSetWorldMode('play')}
              className={`flex items-center gap-1 whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                worldMode === 'play'
                  ? 'bg-[#9C6C30] text-[#FDF6E8]'
                  : 'text-[#C8B9A0] hover:text-[#F3E9D6]'
              }`}
            >
              <Compass className="h-3.5 w-3.5" />
              Play
            </button>
            <button
              type="button"
              onClick={() => onSetWorldMode('create')}
              className={`flex items-center gap-1 whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                worldMode === 'create'
                  ? 'bg-[#6F5839] text-[#FDF6E8]'
                  : 'text-[#C8B9A0] hover:text-[#F3E9D6]'
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
                className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#7A6243] bg-[#272019] px-3 py-1.5 text-xs font-semibold text-[#F0E4CE] hover:bg-[#342A20] cursor-pointer"
              >
                <UserRound className="h-3.5 w-3.5 text-[#D4A65C]" />
                Status &amp; Gear{isGamepad ? ` [${glyphs.select}]` : ''}
              </button>
              <button
                type="button"
                onClick={onOpenQuests}
                className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#5B4B3A] bg-[#261F18] px-3 py-1.5 text-xs font-semibold text-[#E8DCC5] hover:bg-[#332920] cursor-pointer"
              >
                <ScrollText className="h-3.5 w-3.5 text-[#D4A65C]" />
                Quests{readyToClaimQuests > 0 ? ` (${readyToClaimQuests}!)` : ''}
              </button>
              <button
                type="button"
                onClick={onOpenWorlds}
                className="hidden sm:flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#5B4B3A] bg-[#261F18] px-3 py-1.5 text-xs font-semibold text-[#E8DCC5] hover:bg-[#332920] cursor-pointer"
              >
                <Compass className="h-3.5 w-3.5 text-[#8FB37C]" />
                Worlds &amp; Dungeons
              </button>
              {rpg.level >= 5 && rpg.playerClass === 'unawakened' && (
                <button
                  type="button"
                  onClick={onOpenClassModal}
                  className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#E2BA72] bg-[#B7833B] px-3 py-1.5 text-xs font-bold text-[#1C1611] hover:bg-[#C89347] cursor-pointer"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Awaken Class
                </button>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center rounded-lg border border-[#5B4B3A] bg-[#231C16] p-0.5">
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
                        editorTool === t.id
                          ? 'bg-[#9C6C30] text-[#FDF6E8]'
                          : 'text-[#C8B9A0] hover:text-[#F3E9D6]'
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
                className="whitespace-nowrap rounded-lg border border-[#5B4B3A] bg-[#261F18] px-2.5 py-1.5 text-xs font-semibold text-[#E8DCC5] hover:bg-[#332920] cursor-pointer"
              >
                Brush {brushSize}×{brushSize}
                {isGamepad ? ` [${glyphs.lb}/${glyphs.rb}]` : ''}
              </button>

              <button
                type="button"
                disabled={undoCount === 0}
                onClick={onUndo}
                title={isGamepad ? `Undo (${glyphs.x})` : 'Undo (Ctrl+Z)'}
                className="flex items-center gap-1 whitespace-nowrap rounded-lg border border-[#5B4B3A] bg-[#261F18] px-2.5 py-1.5 text-xs font-semibold text-[#E8DCC5] hover:bg-[#332920] disabled:opacity-40 cursor-pointer"
              >
                <Undo2 className="h-3.5 w-3.5" />
                {undoCount}
              </button>
              <button
                type="button"
                disabled={redoCount === 0}
                onClick={onRedo}
                title="Redo (Ctrl+Shift+Z)"
                className="flex items-center gap-1 whitespace-nowrap rounded-lg border border-[#5B4B3A] bg-[#261F18] px-2.5 py-1.5 text-xs font-semibold text-[#E8DCC5] hover:bg-[#332920] disabled:opacity-40 cursor-pointer"
              >
                <Redo2 className="h-3.5 w-3.5" />
                {redoCount}
              </button>
            </>
          )}
        </div>

        {/* Right: Time, Camera, Save, Respawn, Safety, Help */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onCycleTimeOfDay}
            title="Cycle Time of Day (Key T)"
            className="flex items-center gap-1 whitespace-nowrap rounded-lg border border-[#5B4B3A] bg-[#261F18] px-2.5 py-1.5 text-xs font-semibold text-[#E8DCC5] hover:bg-[#332920] cursor-pointer"
          >
            <TimeIcon className="h-3.5 w-3.5 text-[#D9AD62]" />
            <span className="hidden md:inline">{timeOfDay.phase}</span>
          </button>

          <button
            type="button"
            onClick={onToggleCameraView}
            title="Switch 1st / 3rd Person (Key V)"
            className="flex items-center gap-1 whitespace-nowrap rounded-lg border border-[#5B4B3A] bg-[#261F18] px-2.5 py-1.5 text-xs font-semibold text-[#E8DCC5] hover:bg-[#332920] cursor-pointer"
          >
            <Eye className="h-3.5 w-3.5 text-[#CBB58D]" />
            <span className="hidden sm:inline">{cameraView === 'first-person' ? '1P' : '3P'}</span>
          </button>

          <button
            type="button"
            onClick={onOpenMyWorlds}
            title="Save, Load & Share Worlds"
            className="flex items-center gap-1 whitespace-nowrap rounded-lg border border-[#5B4B3A] bg-[#261F18] px-2.5 py-1.5 text-xs font-semibold text-[#E8DCC5] hover:bg-[#332920] cursor-pointer"
          >
            <Save className="h-3.5 w-3.5 text-[#8FB37C]" />
            <span className="hidden md:inline">Save</span>
          </button>

          <button
            type="button"
            onClick={onRespawn}
            title="Return to Spawn"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#5B4B3A] bg-[#261F18] text-[#E8DCC5] hover:bg-[#332920] cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={onOpenSafety}
            title="Safety, Report & Block"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#5B4B3A] bg-[#261F18] text-[#E8DCC5] hover:bg-[#332920] cursor-pointer"
          >
            <ShieldAlert className="h-3.5 w-3.5 text-[#D4A65C]" />
          </button>

          <button
            type="button"
            onClick={onOpenHelp}
            title={
              isGamepad
                ? `Settings & Controller Layout (${glyphs.start})`
                : 'Settings, Labels & Controls'
            }
            className="flex h-8 items-center justify-center gap-1 rounded-lg border border-[#5B4B3A] bg-[#261F18] px-2 text-[#E8DCC5] hover:bg-[#332920] cursor-pointer"
          >
            {isGamepad ? (
              <>
                <Gamepad2 className="h-3.5 w-3.5 text-[#D4A65C]" />
                <span className="hidden xl:inline text-[11px] font-semibold">{glyphs.start}</span>
              </>
            ) : (
              <HelpCircle className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </header>

      {/* PLAY MODE COMPACT VITALS STRIP (Top-Left, minimal Nordic wood/parchment) */}
      {worldMode === 'play' && (
        <div className="pointer-events-auto fixed left-3 top-14 z-10 w-60 rounded-xl border border-[#5E4D3B]/90 bg-[#1A1511]/90 p-3 text-[#EDE2CC] shadow-lg">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-[var(--font-display)] text-xs font-bold text-[#F3E9D6] tabular-nums">
              Lv {rpg.level} · {classLabel}
            </span>
            <span className="text-xs font-bold text-[#D9AD62] tabular-nums">{rpg.gold}g</span>
          </div>

          {/* HP / Stamina / Hunger / XP bars */}
          <div className="mt-2 space-y-1.5 text-[11px] tabular-nums">
            <div className="flex items-center gap-2">
              <span className="w-7 text-[#D98A7E] font-semibold">HP</span>
              <div className="h-2 flex-1 overflow-hidden rounded bg-[#2D251E]">
                <div
                  className="h-full bg-[#B54B3E] transition-all"
                  style={{ width: `${Math.min(100, (rpg.hp / rpg.maxHp) * 100)}%` }}
                />
              </div>
              <span className="w-12 text-right text-[#D7C9B2]">
                {Math.round(rpg.hp)}/{rpg.maxHp}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-7 text-[#DFB86C] font-semibold">STA</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded bg-[#2D251E]">
                <div
                  className="h-full bg-[#C7943D] transition-all"
                  style={{ width: `${Math.min(100, (rpg.stamina / rpg.maxStamina) * 100)}%` }}
                />
              </div>
              <span className="w-12 text-right text-[#BDB099]">{Math.round(rpg.stamina)}</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-7 text-[#98B986] font-semibold">HGR</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded bg-[#2D251E]">
                <div
                  className="h-full bg-[#648A58] transition-all"
                  style={{ width: `${Math.min(100, (rpg.hunger / rpg.maxHunger) * 100)}%` }}
                />
              </div>
              <span className="w-12 text-right text-[#BDB099]">{Math.round(rpg.hunger)}</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-7 text-[#CBB58D] font-semibold">XP</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded bg-[#2D251E]">
                <div
                  className="h-full bg-[#A89268] transition-all"
                  style={{ width: `${Math.min(100, (rpg.xp / rpg.xpToNext) * 100)}%` }}
                />
              </div>
              <span className="w-12 text-right text-[#BDB099]">
                {rpg.xp}/{rpg.xpToNext}
              </span>
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-[#403428] pt-1.5 text-[11px] text-[#B8A990] tabular-nums">
            <span>
              W:{rpg.resources.wood} · S:{rpg.resources.stone} · O:{rpg.resources.ore}
            </span>
            {rpg.tamedPet && (
              <span className="text-[#96BFB4] truncate max-w-[80px]">{rpg.tamedPet.name}</span>
            )}
          </div>
        </div>
      )}

      {/* CREATURE / BOSS TARGET BAR (Top-Center) */}
      {worldMode === 'play' && targetCreature && (
        <div className="pointer-events-none fixed left-1/2 top-16 z-20 w-72 -translate-x-1/2 rounded-xl border border-[#65523D] bg-[#1A1511]/92 px-4 py-2.5 text-center shadow-lg">
          <div className="flex items-center justify-between text-xs">
            <span className="font-[var(--font-display)] font-bold text-[#F3E9D6]">
              {targetCreature.isBoss ? 'BOSS · ' : ''}
              {targetCreature.name}
            </span>
            <span className="font-semibold text-[#CBBBA2] tabular-nums">
              Lv {targetCreature.level}
              {targetCreature.tameable ? (isGamepad ? ' · Tameable' : ' · Tameable [Y]') : ''}
            </span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded bg-[#2D251E]">
            <div
              className={`h-full ${
                targetCreature.isBoss
                  ? 'bg-[#B54B3E]'
                  : targetCreature.hostile
                    ? 'bg-[#C47438]'
                    : 'bg-[#6F9660]'
              }`}
              style={{
                width: `${Math.min(100, (targetCreature.hp / Math.max(1, targetCreature.maxHp)) * 100)}%`,
              }}
            />
          </div>
          <p className="mt-1 text-[11px] text-[#B8A990] tabular-nums">
            {targetCreature.hp} / {targetCreature.maxHp} HP
          </p>
        </div>
      )}

      {/* CENTER CROSSHAIR (+ Guard Indicator when LT/L2 held) */}
      <div className="pointer-events-none fixed inset-0 z-10 flex items-center justify-center">
        <div className="relative h-5 w-5">
          <div
            className={`absolute left-1/2 top-0 h-5 w-0.5 -translate-x-1/2 shadow ${
              isBlocking ? 'bg-[#E3B86A]' : 'bg-[#F4EAD8]/85'
            }`}
          />
          <div
            className={`absolute left-0 top-1/2 h-0.5 w-5 -translate-y-1/2 shadow ${
              isBlocking ? 'bg-[#E3B86A]' : 'bg-[#F4EAD8]/85'
            }`}
          />
        </div>
        {isBlocking && (
          <div className="absolute mt-14 flex items-center gap-1.5 rounded-lg border border-[#C99A4E]/80 bg-[#1B1612]/90 px-2.5 py-1 text-[11px] font-semibold text-[#F0DFBE]">
            <Shield className="h-3.5 w-3.5 text-[#D4A65C]" />
            Guard Raised ({glyphs.lt})
          </div>
        )}
      </div>

      {/* PROXIMITY INTERACT PROMPT OR STATUS HINT OR DYNAMIC CONTROL HINTS */}
      {(formattedInteractPrompt || statusHint || !pointerLocked || isGamepad) && (
        <div className="pointer-events-none fixed left-1/2 bottom-28 z-20 flex -translate-x-1/2 flex-col items-center gap-1.5">
          {formattedInteractPrompt && (
            <button
              type="button"
              onClick={onTriggerInteract}
              className="pointer-events-auto whitespace-nowrap rounded-lg border border-[#C99A4E]/80 bg-[#1B1612]/94 px-4 py-1.5 text-xs font-bold text-[#F3E5C8] shadow-lg hover:bg-[#2A221B] cursor-pointer"
            >
              {formattedInteractPrompt}
            </button>
          )}
          {statusHint && (
            <div className="rounded-lg border border-[#5D4C3A] bg-[#1A1511]/92 px-3.5 py-1 text-xs font-medium text-[#E8DCC5] shadow">
              {statusHint}
            </div>
          )}
          {!formattedInteractPrompt && !statusHint && isGamepad && (
            <div className="rounded-lg border border-[#5B4B3A] bg-[#1A1511]/88 px-3 py-1 text-[11px] font-medium text-[#D6C8AF] shadow">
              {worldMode === 'play'
                ? `${glyphs.leftStick} Move · ${glyphs.rightStick} Look · [${glyphs.rt}] Attack · [${glyphs.lt}] Block · [${glyphs.a}] Jump · [${glyphs.b}] Dodge · [${glyphs.x}] Interact · [${glyphs.y}] Skills`
                : `${glyphs.leftStick} Fly · ${glyphs.rightStick} Look · [${glyphs.rt}] Paint · [${glyphs.lt}] Erase · [${glyphs.lb}/${glyphs.rb}] Brush · ${glyphs.dpad} Block · [${glyphs.x}] Undo`}
            </div>
          )}
          {!isGamepad && !pointerLocked && !formattedInteractPrompt && !statusHint && (
            <button
              type="button"
              onClick={onRequestPointerLock}
              className="pointer-events-auto whitespace-nowrap rounded-lg border border-[#5B4B3A] bg-[#1A1511]/88 px-3 py-1 text-[11px] font-medium text-[#D6C8AF] hover:bg-[#29211A] hover:text-[#F3E9D6] cursor-pointer"
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
          className="pointer-events-auto mb-1 flex items-center gap-1 rounded-t-lg border border-b-0 border-[#5B4B3A] bg-[#1A1511]/92 px-3 py-0.5 text-[11px] font-semibold text-[#CFC2AA] hover:text-[#F3E9D6] cursor-pointer"
        >
          {dockCollapsed ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {dockCollapsed ? 'Show Palette & Skills' : 'Hide Dock'}
        </button>

        {!dockCollapsed && (
          <div className="pointer-events-auto flex max-w-[min(980px,96vw)] flex-col gap-2 rounded-xl border border-[#5E4D3B] bg-[#1A1511]/94 px-3 py-2 shadow-2xl">
            {/* Play Mode Skill Strip */}
            {worldMode === 'play' && (
              <div
                className={`flex flex-wrap items-center justify-center gap-1.5 border-b border-[#3F3327] pb-2 ${
                  skillStripFocused ? 'rounded-lg bg-[#2A2118]/90 px-2 pt-1.5 ring-1 ring-[#D4A65C]/70' : ''
                }`}
              >
                {skillStripFocused && isGamepad && (
                  <span className="mr-1 text-[10px] font-bold uppercase tracking-wider text-[#E0B465]">
                    Skill Strip · [{glyphs.lb}/{glyphs.rb}] Pick · [{glyphs.rt}] Cast · [{glyphs.b}] Close
                  </span>
                )}
                {skillItems.map((sk, idx) => {
                  const Icon = sk.icon;
                  const isHighlighted = isGamepad && idx === activeSkillIndex;
                  return (
                    <button
                      key={sk.id}
                      type="button"
                      onClick={() => onTriggerSkill(sk.id)}
                      className={`flex items-center gap-1 whitespace-nowrap rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                        sk.unlocked
                          ? sk.accentClass
                          : 'border-[#3E3328] bg-[#221C16] text-[#948671]'
                      } ${
                        isHighlighted
                          ? skillStripFocused
                            ? 'ring-2 ring-[#E3B86A] border-[#E3B86A]'
                            : 'ring-1 ring-[#C99A4E]/75'
                          : ''
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {isGamepad ? (isHighlighted ? `[${glyphs.rt}] ` : '') : `[${sk.keyLabel}] `}
                      {sk.label}
                    </button>
                  );
                })}
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
                        ? 'border-[#D4A65C] bg-[#3A2C1D]'
                        : 'border-[#41352A] bg-[#231C16] hover:border-[#6A5743]'
                    }`}
                  >
                    <img
                      src={icons[b.id]}
                      alt={b.name}
                      className="h-7 w-7 object-contain"
                      draggable={false}
                    />
                    <span className="text-[9px] font-medium leading-none text-[#D8CAB3] truncate max-w-[40px]">
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
