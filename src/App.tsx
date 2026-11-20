import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppScreen,
  AvatarConfig,
  BlockId,
  BrushSize,
  CameraViewMode,
  CharacterClassId,
  CreatureHudTarget,
  DroppedGrave,
  DungeonId,
  EditorTool,
  GearItem,
  InspectResult,
  LootChestPoint,
  NpcDefinition,
  NpcDialogueBranch,
  PlaceableBlockId,
  RealmId,
  RpgPlayerState,
  SafetyReportStub,
  SavedWorldMeta,
  SystemNotice,
  TimeOfDayState,
  WorldMode,
  WorldPortalPoint,
  WorldTemplateId,
} from './types/blockhaven';
import {
  generateDungeonWorld,
  generateRealmWorld,
  generateWorldFromTemplate,
} from './engine/worldGen';
import { CreatureKilledPayload, VoxelEngine } from './engine/VoxelEngine';
import {
  addSafetyLog,
  deleteWorldRecord,
  exportWorldCode,
  importWorldCode,
  listSavedWorlds,
  loadRpgState,
  loadSafetyLogs,
  loadSavedAvatar,
  loadUiPrefs,
  loadWorldRecord,
  resetRpgState,
  saveAvatarConfig,
  saveRpgState,
  saveUiPrefs,
  saveWorldRecord,
} from './storage/worldStorage';
import {
  CLASS_BY_ID,
  CraftRecipe,
  DUNGEON_BY_ID,
  generateGearItem,
  QUEST_BOARD_LIST,
  REALM_BY_ID,
  SKILL_CATALOG,
  xpRequiredForLevel,
} from './rpg/rpgData';
import { sfx } from './engine/audio';
import { HomeScreen } from './components/HomeScreen';
import { TopHud } from './components/TopHud';
import { TouchControls } from './components/TouchControls';
import { NpcDialogueCard } from './components/NpcDialogueCard';
import { AvatarModal } from './components/AvatarModal';
import { MyWorldsModal } from './components/MyWorldsModal';
import { SafetyModal } from './components/SafetyModal';
import { HelpModal } from './components/HelpModal';
import { RebirthModal } from './components/RebirthModal';
import { SystemToastStack } from './components/SystemToastStack';
import { ClassAwakeningModal } from './components/ClassAwakeningModal';
import { RpgMenuModal, RpgMenuTab } from './components/RpgMenuModal';
import { QuestBoardModal } from './components/QuestBoardModal';
import { ShrineModal } from './components/ShrineModal';
import { PortalConfirmModal, PortalPromptState } from './components/PortalConfirmModal';
import { DeathModal } from './components/DeathModal';
import { BLOCK_LIST } from './engine/blocks';
import {
  ControllerBrand,
  gamepadManager,
  InputModality,
} from './input/gamepadManager';
import {
  activateGamepadUiFocus,
  clearGamepadUiFocus,
  cycleGamepadModalTabs,
  ensureGamepadUiFocus,
  moveGamepadUiFocus,
} from './input/useGamepadUiNav';
import { MinimapHud } from './components/MinimapHud';
import { InspectCard } from './components/InspectCard';

const SKILL_STRIP_ORDER = ['bow', 'firebolt', 'mend', 'tame', 'inspect'] as const;

type ActiveModal =
  | null
  | 'rebirth'
  | 'avatar'
  | 'worlds'
  | 'safety'
  | 'help'
  | 'class'
  | 'rpg_menu'
  | 'quests'
  | 'shrine'
  | 'portal'
  | 'death';

interface DeathSummary {
  cause: string;
  lostLevel: boolean;
  newLevel: number;
  droppedCount: number;
  keptSoulboundCount: number;
}

function computeDerivedMaxHp(rpg: RpgPlayerState): number {
  const base = 100 + (rpg.level - 1) * 12;
  const clsBonus = rpg.playerClass === 'warrior' ? 25 : rpg.playerClass === 'cleric' ? 20 : 0;
  const gearBonus = (rpg.equipped.armor?.bonusHp ?? 0) + (rpg.equipped.accessory?.bonusHp ?? 0);
  return base + clsBonus + gearBonus;
}

function computeDerivedMaxStamina(rpg: RpgPlayerState): number {
  const base = 100 + (rpg.level - 1) * 5;
  const clsBonus = rpg.playerClass === 'mage' ? 20 : 0;
  return base + clsBonus;
}

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<VoxelEngine | null>(null);

  // Core app & world state
  const [screen, setScreen] = useState<AppScreen>('home');
  const [worldMode, setWorldMode] = useState<WorldMode>('play');
  const [cameraView, setCameraView] = useState<CameraViewMode>('first-person');
  const [selectedBlock, setSelectedBlock] = useState<PlaceableBlockId>(BlockId.Wood);
  const [editorTool, setEditorTool] = useState<EditorTool>('paint');
  const [brushSize, setBrushSize] = useState<BrushSize>(1);
  const [undoCount, setUndoCount] = useState(0);
  const [redoCount, setRedoCount] = useState(0);
  const [pointerLocked, setPointerLocked] = useState(false);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [mapExpanded, setMapExpanded] = useState(false);

  // Active world metadata (Create / Save / Share)
  const [worldId, setWorldId] = useState<string | undefined>(undefined);
  const [worldName, setWorldName] = useState('Elderglen (Home World)');
  const [worldTemplate, setWorldTemplate] = useState<WorldTemplateId>('village');
  const [localNotes, setLocalNotes] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Persistent user state
  const [avatar, setAvatar] = useState<AvatarConfig>(() => loadSavedAvatar());
  const [rpg, setRpg] = useState<RpgPlayerState>(() => loadRpgState());
  const [savedWorlds, setSavedWorlds] = useState<SavedWorldMeta[]>([]);
  const [safetyLogs, setSafetyLogs] = useState<SafetyReportStub[]>(() => loadSafetyLogs());
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showOverheadLabels, setShowOverheadLabels] = useState<boolean>(
    () => loadUiPrefs().showOverheadLabels,
  );
  const [touchControlsEnabled, setTouchControlsEnabled] = useState(() => {
    if (typeof window === 'undefined') return false;
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  });

  // Live HUD & Modals
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [rpgMenuTab, setRpgMenuTab] = useState<RpgMenuTab>('status');
  const [activeNpc, setActiveNpc] = useState<NpcDefinition | null>(null);
  const [portalPrompt, setPortalPrompt] = useState<PortalPromptState | null>(null);
  const [deathSummary, setDeathSummary] = useState<DeathSummary | null>(null);
  const [reportDefaultTarget, setReportDefaultTarget] = useState<string | undefined>(undefined);
  const [webglLost, setWebglLost] = useState(false);
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDayState>({
    cycle: 0.17,
    phase: 'Day',
    paused: false,
  });
  const [targetCreature, setTargetCreature] = useState<CreatureHudTarget | null>(null);
  const [inspectResult, setInspectResult] = useState<InspectResult | null>(null);
  const [interactPrompt, setInteractPrompt] = useState<string | null>(null);
  const [statusHint, setStatusHint] = useState<string | null>(null);
  const [damageFlash, setDamageFlash] = useState(false);
  const [notices, setNotices] = useState<SystemNotice[]>([]);

  // Gamepad & Seamless Input Modality State
  const [controllerInfo, setControllerInfo] = useState(() => gamepadManager.getStatus());
  const [inputMode, setInputMode] = useState<InputModality>(() => {
    if (gamepadManager.getStatus().connected) return 'gamepad';
    if (typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0)) {
      return 'touch';
    }
    return 'keyboard';
  });
  const [skillStripFocused, setSkillStripFocused] = useState(false);
  const [activeSkillIndex, setActiveSkillIndex] = useState(0);
  const [isBlockingHud, setIsBlockingHud] = useState(false);

  const statusHintTimerRef = useRef<number | null>(null);
  const inspectTimerRef = useRef<number | null>(null);
  const lastInspectedRef = useRef<{ key: string; ts: number }>({ key: '', ts: 0 });
  const damageFlashTimerRef = useRef<number | null>(null);
  const rpgRef = useRef<RpgPlayerState>(rpg);
  rpgRef.current = rpg;

  const pushNotice = useCallback(
    (title: string, body: string, tone: SystemNotice['tone'] = 'system') => {
      const id = `sys-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setNotices((prev) => [{ id, title, body, tone }, ...prev].slice(0, 4));
      window.setTimeout(() => {
        setNotices((prev) => prev.filter((n) => n.id !== id));
      }, 6500);
    },
    [],
  );

  const showStatusHint = useCallback((msg: string) => {
    setStatusHint(msg);
    if (statusHintTimerRef.current) window.clearTimeout(statusHintTimerRef.current);
    statusHintTimerRef.current = window.setTimeout(() => setStatusHint(null), 2800);
  }, []);

  // Persist RPG state & sync engine combat stats + pet + graves
  useEffect(() => {
    saveRpgState(rpg);
    const engine = engineRef.current;
    if (!engine) return;
    const weaponAtk = rpg.equipped.weapon?.attack ?? 6;
    const clsMult = rpg.playerClass === 'warrior' ? 1.3 : 1.0;
    const speedMult =
      rpg.playerClass === 'rogue' ? 1.2 : rpg.playerClass === 'ranger' ? 1.15 : 1.0;
    engine.syncPlayerCombatStats({
      meleeDamage: Math.round((8 + weaponAtk + rpg.level * 2) * clsMult),
      walkSpeedMult: speedMult,
      canSprint: rpg.stamina > 6,
      hasTracking: rpg.skills.some((s) => s.id === 'tracking'),
    });
    engine.syncGraves(rpg.graves);
  }, [rpg]);

  // Sync tamed pet only when pet changes
  useEffect(() => {
    engineRef.current?.syncTamedPet(rpg.tamedPet);
  }, [rpg.tamedPet]);

  // Load saved worlds list on boot
  useEffect(() => {
    listSavedWorlds().then(setSavedWorlds).catch(() => {});
  }, []);

  // Pause engine input whenever a modal, NPC dialog, or expanded map is open
  useEffect(() => {
    const paused = activeModal !== null || activeNpc !== null || mapExpanded;
    engineRef.current?.setPaused(paused);
    if (paused) setInspectResult(null);
  }, [activeModal, activeNpc, mapExpanded]);

  // Persist & apply overhead floating label visibility immediately
  useEffect(() => {
    saveUiPrefs({ showOverheadLabels });
    engineRef.current?.setShowOverheadLabels(showOverheadLabels);
  }, [showOverheadLabels]);

  /* ============================================================================
   * RPG Core Helpers (XP / Level-Up / Skill XP / Quests / Death)
   * ============================================================================ */

  const applyXpAndQuests = useCallback(
    (
      updater: (draft: RpgPlayerState) => {
        xpGain?: number;
        goldGain?: number;
        skillIdUsed?: string;
        questKey?: string;
        questDelta?: number;
      },
    ) => {
      setRpg((prev) => {
        const next: RpgPlayerState = {
          ...prev,
          playstyle: { ...prev.playstyle },
          resources: { ...prev.resources },
          equipped: { ...prev.equipped },
          skills: prev.skills.map((s) => ({ ...s })),
          quests: prev.quests.map((q) => ({ ...q })),
          inventory: [...prev.inventory],
          clearedDungeons: [...prev.clearedDungeons],
        };

        const outcome = updater(next);

        // Skill XP progression
        if (outcome.skillIdUsed) {
          const sk = next.skills.find((s) => s.id === outcome.skillIdUsed);
          if (sk) {
            sk.xp += 18;
            if (sk.xp >= sk.maxXp) {
              sk.xp -= sk.maxXp;
              sk.level += 1;
              sk.maxXp = Math.round(sk.maxXp * 1.45);
              pushNotice(
                `${sk.name} reached Lv ${sk.level}!`,
                'Your skill grows sharper through practice.',
                'level',
              );
            }
          }
        }

        // Quest progression
        if (outcome.questKey && (outcome.questDelta ?? 0) > 0) {
          for (const aq of next.quests) {
            if (aq.completed || aq.claimed) continue;
            const def = QUEST_BOARD_LIST.find((q) => q.id === aq.questId);
            if (!def) continue;
            if (
              def.targetKey === outcome.questKey ||
              (def.targetKey === 'escort_patrol' && outcome.questKey === 'monster_or_wolf')
            ) {
              aq.progress = Math.min(def.targetCount, aq.progress + (outcome.questDelta ?? 1));
              if (aq.progress >= def.targetCount) {
                aq.completed = true;
                sfx.playChime();
                pushNotice(
                  `Quest Ready: ${def.title}`,
                  'Open the Quest Board to claim your XP, Gold, and Gear reward!',
                  'quest',
                );
              }
            }
          }
        }

        // Gold & XP + Level-Up Loop
        if (outcome.goldGain) next.gold += outcome.goldGain;
        if (outcome.xpGain) {
          next.xp += outcome.xpGain;
          let leveledUp = false;
          while (next.xp >= next.xpToNext) {
            next.xp -= next.xpToNext;
            next.level += 1;
            next.xpToNext = xpRequiredForLevel(next.level);
            leveledUp = true;
          }
          if (leveledUp) {
            next.maxHp = computeDerivedMaxHp(next);
            next.maxStamina = computeDerivedMaxStamina(next);
            next.hp = next.maxHp;
            next.stamina = next.maxStamina;
            sfx.playLevelUp();
            pushNotice(
              `Level Up! You reached Level ${next.level}`,
              `Max HP is now ${next.maxHp}. Vitals fully restored.`,
              'level',
            );
            if (next.level >= 5 && next.playerClass === 'unawakened') {
              next.classChoicePending = true;
              pushNotice(
                'Level 5 Class Awakening Ready!',
                'The System has analyzed your playstyle and is ready to suggest a class.',
                'level',
              );
              window.setTimeout(() => setActiveModal('class'), 450);
            }
          }
        }

        return next;
      });
    },
    [pushNotice],
  );

  const handlePlayerDamage = useCallback(
    (rawAmount: number, source: string, pos: { x: number; y: number; z: number }) => {
      const isGuarding = engineRef.current?.isBlocking() ?? false;
      setDamageFlash(true);
      if (damageFlashTimerRef.current) window.clearTimeout(damageFlashTimerRef.current);
      damageFlashTimerRef.current = window.setTimeout(() => setDamageFlash(false), 320);

      let wasFatal = false;
      setRpg((prev) => {
        const armorDef = (prev.equipped.armor?.defense ?? 0) + (prev.equipped.accessory?.defense ?? 0);
        const shieldSkill = prev.skills.find((s) => s.id === 'arcane_shield');
        const shieldReduction = shieldSkill ? 0.1 + shieldSkill.level * 0.04 : 0;
        const guardMult = isGuarding ? 0.55 : 1.0;
        const mitigated = Math.max(
          isGuarding ? 1 : 2,
          Math.round((rawAmount - armorDef * 0.35) * (1 - Math.min(0.45, shieldReduction)) * guardMult),
        );
        const nextHp = prev.hp - mitigated;

        if (nextHp > 0) {
          return { ...prev, hp: nextHp };
        }
        wasFatal = true;

        // REAL DEATH PENALTY
        sfx.playDeath();
        const lostLevel = prev.level > 1;
        const newLevel = lostLevel ? prev.level - 1 : 1;

        const keptEquipped = { ...prev.equipped };
        const droppedItems: GearItem[] = [];
        let keptSoulboundCount = 0;

        for (const slot of ['weapon', 'armor', 'accessory'] as const) {
          const item = keptEquipped[slot];
          if (!item) continue;
          if (item.soulbound) {
            keptSoulboundCount += 1;
          } else {
            droppedItems.push(item);
            keptEquipped[slot] = null;
          }
        }

        const keptInventory: GearItem[] = [];
        for (const item of prev.inventory) {
          if (item.soulbound) {
            keptSoulboundCount += 1;
            keptInventory.push(item);
          } else {
            droppedItems.push(item);
          }
        }

        const nextGraves = [...prev.graves];
        if (droppedItems.length > 0) {
          nextGraves.push({
            id: `grave-${Date.now()}`,
            realmId: prev.activeRealm,
            position: { ...pos },
            items: droppedItems,
            createdAt: Date.now(),
          });
        }

        const nextState: RpgPlayerState = {
          ...prev,
          level: newLevel,
          xp: 0,
          xpToNext: xpRequiredForLevel(newLevel),
          deaths: prev.deaths + 1,
          equipped: keptEquipped,
          inventory: keptInventory,
          graves: nextGraves,
        };
        nextState.maxHp = computeDerivedMaxHp(nextState);
        nextState.maxStamina = computeDerivedMaxStamina(nextState);
        nextState.hp = nextState.maxHp;
        nextState.stamina = nextState.maxStamina;
        nextState.hunger = Math.max(60, prev.hunger);

        setDeathSummary({
          cause: source,
          lostLevel,
          newLevel,
          droppedCount: droppedItems.length,
          keptSoulboundCount,
        });
        setActiveModal('death');
        pushNotice(
          'Soul Returned to Awakening Shrine',
          lostLevel
            ? `Defeated by ${source}. Lost 1 level and dropped ${droppedItems.length} unbound item(s).`
            : `Defeated by ${source}. Dropped ${droppedItems.length} unbound item(s).`,
          'death',
        );

        return nextState;
      });

      if (isGuarding && !wasFatal) {
        showStatusHint('Blocked strike — damage reduced');
      }
      gamepadManager.rumble(wasFatal ? 'death' : 'hit');
    },
    [pushNotice, showStatusHint],
  );

  const handleSkillTrigger = useCallback(
    (skill: 'bow' | 'firebolt' | 'mend' | 'tame' | 'inspect') => {
      const current = rpgRef.current;
      const engine = engineRef.current;
      if (!engine) return;

      if (skill === 'bow') {
        const sk = current.skills.find((s) => s.id === 'bow_mastery');
        if (!sk) {
          showStatusHint('Learn Bow Mastery from Kael the Hunter in Elderglen Village!');
          return;
        }
        if (current.stamina < 8) {
          showStatusHint('Low Stamina — rest a moment before firing.');
          return;
        }
        const clsBonus = current.playerClass === 'ranger' ? 1.3 : 1.0;
        const dmg = Math.round((14 + sk.level * 5 + (current.equipped.weapon?.attack ?? 0) * 0.6) * clsBonus);
        engine.fireProjectile('bow', dmg);
        setRpg((prev) => ({
          ...prev,
          stamina: Math.max(0, prev.stamina - 8),
          playstyle: { ...prev.playstyle, bowShots: prev.playstyle.bowShots + 1 },
        }));
      } else if (skill === 'firebolt') {
        const sk = current.skills.find((s) => s.id === 'firebolt');
        if (!sk) {
          showStatusHint('Learn Firebolt (free!) from Lyra the Village Mage!');
          return;
        }
        if (current.stamina < 12) {
          showStatusHint('Low Stamina — recover before casting Firebolt.');
          return;
        }
        const clsBonus = current.playerClass === 'mage' ? 1.35 : 1.0;
        const dmg = Math.round((18 + sk.level * 6 + current.level * 2) * clsBonus);
        engine.fireProjectile('magic', dmg);
        setRpg((prev) => ({
          ...prev,
          stamina: Math.max(0, prev.stamina - 12),
          playstyle: { ...prev.playstyle, magicCasts: prev.playstyle.magicCasts + 1 },
        }));
      } else if (skill === 'mend') {
        const sk = current.skills.find((s) => s.id === 'shrine_mend');
        if (!sk) {
          showStatusHint('Learn Shrine Mend (free!) from Sera beside the Awakening Shrine!');
          return;
        }
        if (current.stamina < 16) {
          showStatusHint('Need 16 Stamina to channel Shrine Mend.');
          return;
        }
        sfx.playHeal();
        const clsBonus = current.playerClass === 'cleric' ? 1.45 : 1.0;
        const healAmt = Math.round((24 + sk.level * 7) * clsBonus);
        applyXpAndQuests((draft) => {
          draft.stamina = Math.max(0, draft.stamina - 16);
          draft.hp = Math.min(draft.maxHp, draft.hp + healAmt);
          draft.playstyle.healsDone += 1;
          return { skillIdUsed: 'shrine_mend' };
        });
        showStatusHint(`Shrine Mend restored +${healAmt} HP!`);
      } else if (skill === 'tame') {
        const canTame =
          current.playerClass === 'tamer' || current.skills.some((s) => s.id === 'beast_bond');
        engine.attemptTameNearest(canTame);
      } else if (skill === 'inspect') {
        const sk = current.skills.find((s) => s.id === 'inspect');
        if (!sk) {
          showStatusHint('Earn Inspect (10 Gold) by speaking to Lyra the Village Mage in Elderglen!');
          return;
        }
        const result = engine.inspectAimTarget(sk.level);
        if (!result) {
          showStatusHint('Aim at a creature, villager, portal, chest, or block within range to Inspect.');
          return;
        }
        sfx.playChime();
        setInspectResult(result);
        if (inspectTimerRef.current) window.clearTimeout(inspectTimerRef.current);
        inspectTimerRef.current = window.setTimeout(() => setInspectResult(null), 7500);

        const now = Date.now();
        const sameRecent =
          lastInspectedRef.current.key === result.targetKey &&
          now - lastInspectedRef.current.ts < 8000;
        if (!sameRecent) {
          lastInspectedRef.current = { key: result.targetKey, ts: now };
          applyXpAndQuests(() => ({ skillIdUsed: 'inspect' }));
        }
      }
    },
    [applyXpAndQuests, showStatusHint],
  );

  // Store latest handlers in ref for VoxelEngine mount
  const handlersRef = useRef({
    handlePlayerDamage,
    handleSkillTrigger,
    applyXpAndQuests,
    showStatusHint,
    pushNotice,
  });
  handlersRef.current = {
    handlePlayerDamage,
    handleSkillTrigger,
    applyXpAndQuests,
    showStatusHint,
    pushNotice,
  };

  /* ============================================================================
   * Mount Persistent Three.js VoxelEngine ONCE
   * ============================================================================ */

  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const engine = new VoxelEngine(mount, avatar, {
      onUndoRedoChange: (u, r) => {
        setUndoCount(u);
        setRedoCount(r);
      },
      onPointerLockChange: (locked) => setPointerLocked(locked),
      onNpcClick: (npc) => setActiveNpc(npc),
      onPortalInteract: (portal: WorldPortalPoint) => {
        if (portal.kind === 'map_pedestal') {
          engineRef.current?.revealDungeonMap();
          sfx.playLevelUp();
          handlersRef.current.pushNotice(
            'Dungeon Map Obtained!',
            'The Cartographer’s Pedestal illuminated every procedural room, trap, chest, and Boss Sanctum.',
            'quest',
          );
          return;
        }
        if (portal.kind === 'shrine') {
          setActiveModal('shrine');
        } else if (portal.kind === 'quest_board') {
          setActiveModal('quests');
        } else if (portal.kind === 'dungeon') {
          setPortalPrompt({ kind: 'dungeon', targetId: portal.targetId as DungeonId });
          setActiveModal('portal');
        } else if (portal.kind === 'dungeon_exit') {
          setPortalPrompt({ kind: 'dungeon_exit', targetId: portal.targetId as RealmId });
          setActiveModal('portal');
        } else {
          setPortalPrompt({ kind: 'realm', targetId: portal.targetId as RealmId });
          setActiveModal('portal');
        }
      },
      onChestOpen: (chest: LootChestPoint) => {
        const lvl = rpgRef.current.level;
        const loot = generateGearItem({ level: Math.max(1, lvl), rarity: chest.rarity });
        const goldBonus = chest.rarity === 'Legendary' ? 120 : chest.rarity === 'Epic' ? 75 : 35;
        const bonusMapScroll = chest.id.startsWith('dung-side-chest');
        handlersRef.current.applyXpAndQuests((draft) => {
          draft.inventory.push(loot);
          if (bonusMapScroll) draft.dungeonMapScrolls += 1;
          return { xpGain: 35, goldGain: goldBonus };
        });
        handlersRef.current.pushNotice(
          `Opened ${chest.rarity} Chest!`,
          `Found ${loot.name} (${loot.rarity}), ${goldBonus}g${bonusMapScroll ? ', and 1 Dungeon Map Scroll' : ''}.`,
          'quest',
        );
      },
      onGraveRecover: (grave: DroppedGrave) => {
        setRpg((prev) => ({
          ...prev,
          inventory: [...prev.inventory, ...grave.items],
          graves: prev.graves.filter((g) => g.id !== grave.id),
        }));
        handlersRef.current.pushNotice(
          'Dropped Gear Recovered!',
          `Retrieved ${grave.items.length} item(s) from your grave marker.`,
          'system',
        );
      },
      onSelectedBlockChange: (blockId) => setSelectedBlock(blockId),
      onCameraViewChange: (view) => setCameraView(view),
      onWorldModified: () => setHasUnsavedChanges(true),
      onWebglContextLost: (lost) => setWebglLost(lost),
      onTimeOfDayChange: (tod) => setTimeOfDay(tod),
      onPlayerDamage: (amt, src, pos) => handlersRef.current.handlePlayerDamage(amt, src, pos),
      onSurvivalTick: (dt, isSprinting, isMoving) => {
        setRpg((prev) => {
          let sta = prev.stamina;
          if (isSprinting) sta = Math.max(0, sta - dt * 16);
          else sta = Math.min(prev.maxStamina, sta + dt * (isMoving ? 9 : 15));

          const hungerDrain = dt * (isSprinting ? 0.85 : isMoving ? 0.35 : 0.12);
          const hunger = Math.max(0, prev.hunger - hungerDrain);
          let hp = prev.hp;
          if (hunger > 50 && hp < prev.maxHp) {
            hp = Math.min(prev.maxHp, hp + dt * 1.6);
          }
          if (
            Math.abs(sta - prev.stamina) < 0.05 &&
            Math.abs(hunger - prev.hunger) < 0.05 &&
            Math.abs(hp - prev.hp) < 0.05
          ) {
            return prev;
          }
          return { ...prev, stamina: sta, hunger, hp };
        });
      },
      onResourceGathered: (res, blockId) => {
        const isArtificer = rpgRef.current.playerClass === 'artificer';
        const yieldAmt = isArtificer ? 2 : 1;
        handlersRef.current.applyXpAndQuests((draft) => {
          draft.resources[res] += yieldAmt;
          draft.playstyle.craftsAndBuilds += 1;
          return {
            xpGain: blockId === BlockId.DiamondOre ? 22 : blockId === BlockId.GoldOre ? 16 : 5,
            questKey: res,
            questDelta: yieldAmt,
          };
        });
        handlersRef.current.showStatusHint(`+${yieldAmt} ${res} gathered`);
      },
      onBlockPlacedInPlay: () => {
        setRpg((prev) => ({
          ...prev,
          playstyle: { ...prev.playstyle, craftsAndBuilds: prev.playstyle.craftsAndBuilds + 1 },
        }));
      },
      onCreatureTargetChange: (t) => setTargetCreature(t),
      onCreatureHit: (attackKind, damage, isCrit) => {
        handlersRef.current.applyXpAndQuests((draft) => {
          if (attackKind === 'melee') draft.playstyle.meleeHits += 1;
          if (isCrit) draft.playstyle.stealthCrits += 1;
          if (draft.equipped.weapon && draft.equipped.weapon.durability > 1) {
            draft.equipped.weapon.durability -= 1;
          }
          return {
            skillIdUsed:
              attackKind === 'bow'
                ? 'bow_mastery'
                : attackKind === 'magic'
                  ? 'firebolt'
                  : undefined,
          };
        });
        handlersRef.current.showStatusHint(
          `${isCrit ? 'Critical ' : ''}${damage} damage!`,
        );
      },
      onCreatureKilled: (payload: CreatureKilledPayload) => {
        gamepadManager.rumble('kill');
        const hasTracking = rpgRef.current.skills.some((s) => s.id === 'tracking');
        const xpGain = payload.isBoss
          ? 145 + payload.level * 18
          : payload.hostile
            ? 32 + payload.level * 10
            : 18 + payload.level * 5;
        const goldGain = payload.isBoss ? 85 + payload.level * 10 : payload.hostile ? 12 + payload.level * 4 : 4;
        const activeDungeon = rpgRef.current.activeDungeon;

        handlersRef.current.applyXpAndQuests((draft) => {
          if (!payload.hostile || payload.species === 'wolf' || payload.species === 'boar') {
            const meatYield = hasTracking ? 2 : 1;
            draft.resources.meat += meatYield;
            draft.resources.hide += 1;
          }
          if (payload.isBoss && activeDungeon) {
            if (!draft.clearedDungeons.includes(activeDungeon)) {
              draft.clearedDungeons.push(activeDungeon);
            }
            const bossLoot = generateGearItem({
              level: Math.max(draft.level, payload.level),
              rarity: payload.level >= 15 ? 'Legendary' : payload.level >= 10 ? 'Epic' : 'Rare',
            });
            draft.inventory.push(bossLoot);
            handlersRef.current.pushNotice(
              `Dungeon Boss Defeated: ${payload.name}!`,
              `Dungeon cleared! Looted ${bossLoot.name} (${bossLoot.rarity}) + ${goldGain}g.`,
              'level',
            );
            return {
              xpGain,
              goldGain,
              questKey: activeDungeon,
              questDelta: 1,
            };
          }
          return {
            xpGain,
            goldGain,
            skillIdUsed: hasTracking && !payload.hostile ? 'tracking' : undefined,
            questKey: payload.hostile ? 'monster_or_wolf' : undefined,
            questDelta: payload.hostile ? 1 : 0,
          };
        });

        if (!payload.isBoss) {
          handlersRef.current.showStatusHint(
            `Defeated ${payload.name} (+${xpGain} XP, +${goldGain}g)`,
          );
        }
      },
      onSkillHotkey: (sk) => handlersRef.current.handleSkillTrigger(sk),
      onTameResult: (species, name, level) => {
        handlersRef.current.applyXpAndQuests((draft) => {
          draft.tamedPet = { species, name, level };
          draft.playstyle.tamesAndAnimals += 3;
          return { xpGain: 30, skillIdUsed: 'beast_bond' };
        });
        handlersRef.current.pushNotice(
          `Companion Tamed: ${name}`,
          `Your loyal ${species} now follows beside you!`,
          'quest',
        );
      },
      onInteractPromptChange: (p) => setInteractPrompt(p),
      onStatusHint: (m) => handlersRef.current.showStatusHint(m),
      onToggleMap: () => setMapExpanded((v) => !v),
    });

    engineRef.current = engine;
    engine.setShowOverheadLabels(loadUiPrefs().showOverheadLabels);
    const home = generateRealmWorld('home');
    engine.loadGeneratedWorld(home);
    engine.syncTamedPet(rpgRef.current.tamedPet);
    engine.syncGraves(rpgRef.current.graves);
    engine.setShowcaseMode(true);

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ============================================================================
   * Full Game Controller Support (Gamepad API + Seamless Input Modality)
   * ============================================================================ */

  const gamepadStateRef = useRef({
    screen,
    worldMode,
    activeModal,
    activeNpc,
    mapExpanded,
    selectedBlock,
    brushSize,
    editorTool,
    skillStripFocused,
    activeSkillIndex,
    inputMode,
    isBlockingHud,
  });
  gamepadStateRef.current = {
    screen,
    worldMode,
    activeModal,
    activeNpc,
    mapExpanded,
    selectedBlock,
    brushSize,
    editorTool,
    skillStripFocused,
    activeSkillIndex,
    inputMode,
    isBlockingHud,
  };

  // Seamless switching between controller, keyboard/mouse, and touch
  useEffect(() => {
    let wasConnected = gamepadManager.getStatus().connected;
    const unsub = gamepadManager.subscribeStatus((info) => {
      setControllerInfo(info);
      if (info.connected && !wasConnected) {
        setInputMode('gamepad');
        handlersRef.current.showStatusHint(
          `${info.brand === 'playstation' ? 'PlayStation' : 'Xbox / Standard'} controller connected`,
        );
      } else if (!info.connected && wasConnected) {
        setInputMode((prev) => (prev === 'gamepad' ? 'keyboard' : prev));
        clearGamepadUiFocus();
        engineRef.current?.setGamepadAxes(0, 0, 0, 0);
        engineRef.current?.setGamepadVertical(false, false);
        engineRef.current?.setAimBlock(false);
        setIsBlockingHud(false);
        handlersRef.current.showStatusHint('Controller disconnected — switched to Keyboard & Mouse');
      }
      wasConnected = info.connected;
    });

    const onKeyboardOrMouse = (ev: Event) => {
      if (!ev.isTrusted) return;
      if (gamepadStateRef.current.inputMode !== 'keyboard') {
        setInputMode('keyboard');
        clearGamepadUiFocus();
      }
    };
    const onTouch = (ev: Event) => {
      if (!ev.isTrusted) return;
      if (gamepadStateRef.current.inputMode !== 'touch') {
        setInputMode('touch');
        clearGamepadUiFocus();
      }
    };

    window.addEventListener('keydown', onKeyboardOrMouse, { passive: true });
    window.addEventListener('mousedown', onKeyboardOrMouse, { passive: true });
    window.addEventListener('touchstart', onTouch, { passive: true });

    return () => {
      unsub();
      window.removeEventListener('keydown', onKeyboardOrMouse);
      window.removeEventListener('mousedown', onKeyboardOrMouse);
      window.removeEventListener('touchstart', onTouch);
    };
  }, []);

  // Re-ensure D-pad focus whenever a modal/screen opens while using a controller
  useEffect(() => {
    const isUiOpen = screen === 'home' || activeModal !== null || activeNpc !== null || mapExpanded;
    if (isUiOpen && inputMode === 'gamepad') {
      const id = window.requestAnimationFrame(() => ensureGamepadUiFocus());
      return () => window.cancelAnimationFrame(id);
    }
    if (!isUiOpen) {
      clearGamepadUiFocus();
    }
  }, [screen, activeModal, activeNpc, mapExpanded, inputMode]);

  // 60Hz Gamepad Polling Loop (Play Mode, Create Mode, & Full Menu Navigation)
  useEffect(() => {
    let rafId = 0;

    const cycleHotbarBlock = (delta: number) => {
      const cur = gamepadStateRef.current.selectedBlock;
      const idx = Math.max(0, BLOCK_LIST.findIndex((b) => b.id === cur));
      const next = BLOCK_LIST[(idx + delta + BLOCK_LIST.length) % BLOCK_LIST.length];
      setSelectedBlock(next.id);
      engineRef.current?.setSelectedBlock(next.id);
    };

    const tick = (nowMs: number) => {
      rafId = window.requestAnimationFrame(tick);
      const snap = gamepadManager.poll(nowMs);
      const engine = engineRef.current;
      const st = gamepadStateRef.current;

      if (!snap.connected) return;

      const hasActivity = gamepadManager.hasAnyActivity(snap);
      if (hasActivity && st.inputMode !== 'gamepad') {
        setInputMode('gamepad');
      }

      const isMenuOpen =
        st.screen === 'home' || st.activeModal !== null || st.activeNpc !== null || st.mapExpanded;

      if (isMenuOpen) {
        if (engine) {
          engine.setGamepadAxes(0, 0, 0, 0);
          engine.setGamepadVertical(false, false);
          engine.setAimBlock(false);
        }
        if (st.isBlockingHud) setIsBlockingHud(false);

        if (hasActivity) {
          ensureGamepadUiFocus();
        }
        if (snap.navDir) {
          moveGamepadUiFocus(snap.navDir);
        }
        if (snap.pressed.a) {
          activateGamepadUiFocus();
        }
        if (snap.pressed.lb) {
          cycleGamepadModalTabs(-1);
        }
        if (snap.pressed.rb) {
          cycleGamepadModalTabs(1);
        }
        if (snap.pressed.b) {
          if (st.mapExpanded) {
            setMapExpanded(false);
          } else if (st.activeNpc) {
            setActiveNpc(null);
          } else if (st.activeModal && st.activeModal !== 'death') {
            setPortalPrompt(null);
            setActiveModal(null);
          }
        }
        if (snap.pressed.start) {
          if (st.activeModal === 'help') {
            setActiveModal(null);
          } else if (st.screen === 'world' && st.activeModal === null && st.activeNpc === null) {
            setMapExpanded(false);
            setActiveModal('help');
          }
        }
        if (snap.pressed.select) {
          if (st.activeModal === 'rpg_menu') {
            setActiveModal(null);
          } else if (st.screen === 'world' && st.activeModal === null && st.activeNpc === null) {
            setMapExpanded(false);
            setRpgMenuTab('status');
            setActiveModal('rpg_menu');
          }
        }
        return;
      }

      // Active 3D World Gameplay Controls
      if (!engine) return;
      engine.setGamepadAxes(snap.lx, snap.ly, snap.rx, snap.ry);

      // Start: Pause / Settings & Controls Menu
      if (snap.pressed.start) {
        setSkillStripFocused(false);
        setActiveModal('help');
        return;
      }
      // Select / Back: System Window (Status / Skills / Gear / Craft / Worlds)
      if (snap.pressed.select) {
        setSkillStripFocused(false);
        setRpgMenuTab('status');
        setActiveModal('rpg_menu');
        return;
      }

      if (st.worldMode === 'play') {
        engine.setGamepadVertical(snap.held.a, false);

        // A / Cross: Jump
        if (snap.pressed.a) {
          engine.triggerJump();
        }
        // X / Square: Interact (same as E)
        if (snap.pressed.x) {
          engine.interactNearest();
        }
        // B / Circle: Cancel Skill Strip or Dodge
        if (snap.pressed.b) {
          if (st.skillStripFocused) {
            setSkillStripFocused(false);
          } else {
            engine.triggerDodge();
          }
        }
        // LT / L2: Aim / Guard Block
        engine.setAimBlock(snap.held.lt);
        if (snap.held.lt !== st.isBlockingHud) {
          setIsBlockingHud(snap.held.lt);
        }
        // Y / Triangle: Open / Toggle Skill Strip
        if (snap.pressed.y) {
          const nextOpen = !st.skillStripFocused;
          setSkillStripFocused(nextOpen);
          if (nextOpen) setDockCollapsed(false);
        }
        // RT / R2: Melee Attack (or Cast Highlighted Skill while Skill Strip is open)
        if (snap.pressed.rt) {
          if (st.skillStripFocused) {
            handlersRef.current.handleSkillTrigger(SKILL_STRIP_ORDER[st.activeSkillIndex]);
          } else {
            engine.triggerPrimaryAction();
          }
        }
        // RB / LB: Cycle Skills (when Skill Strip open) or Cycle Hotbar Blocks
        if (snap.pressed.lb) {
          if (st.skillStripFocused) {
            setActiveSkillIndex((i) => (i - 1 + SKILL_STRIP_ORDER.length) % SKILL_STRIP_ORDER.length);
          } else {
            cycleHotbarBlock(-1);
          }
        }
        if (snap.pressed.rb) {
          if (st.skillStripFocused) {
            setActiveSkillIndex((i) => (i + 1) % SKILL_STRIP_ORDER.length);
          } else {
            cycleHotbarBlock(1);
          }
        }
        // D-Pad: Left/Right selects hotbar slots, Up casts active skill, Down cycles skills
        if (snap.pressed.dpadLeft) {
          cycleHotbarBlock(-1);
        }
        if (snap.pressed.dpadRight) {
          cycleHotbarBlock(1);
        }
        if (snap.pressed.dpadUp) {
          handlersRef.current.handleSkillTrigger(SKILL_STRIP_ORDER[st.activeSkillIndex]);
        }
        if (snap.pressed.dpadDown) {
          setDockCollapsed(false);
          setActiveSkillIndex((i) => (i + 1) % SKILL_STRIP_ORDER.length);
        }
      } else {
        // CREATE MODE: RT paint, LT erase, LB/RB brush size, D-Pad pick blocks, A/B fly up/down
        engine.setAimBlock(false);
        if (st.isBlockingHud) setIsBlockingHud(false);
        engine.setGamepadVertical(snap.held.a, snap.held.b);

        if (snap.pressed.rt) {
          engine.triggerCreatePaint();
        }
        if (snap.pressed.lt) {
          engine.triggerCreateErase();
        }
        if (snap.pressed.rb || snap.pressed.lb) {
          const nextSize: BrushSize = st.brushSize === 1 ? 3 : 1;
          setBrushSize(nextSize);
          engine.setBrushSize(nextSize);
          handlersRef.current.showStatusHint(`Brush size: ${nextSize}×${nextSize}`);
        }
        if (snap.pressed.dpadLeft) cycleHotbarBlock(-1);
        if (snap.pressed.dpadRight) cycleHotbarBlock(1);
        if (snap.pressed.dpadUp) cycleHotbarBlock(-5);
        if (snap.pressed.dpadDown) cycleHotbarBlock(5);
        if (snap.pressed.y) {
          const order: EditorTool[] = ['paint', 'erase', 'fill'];
          const nextTool = order[(order.indexOf(st.editorTool) + 1) % order.length];
          setEditorTool(nextTool);
          engine.setEditorTool(nextTool);
        }
        if (snap.pressed.x) {
          engine.undo();
        }
      }
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, []);

  /* ============================================================================
   * Navigation, Rebirth, World Travel & Dungeon Entry
   * ============================================================================ */

  const enterHomeWorld = useCallback(
    (mode: WorldMode, customSpawn?: { x: number; y: number; z: number }) => {
      const home = generateRealmWorld('home');
      engineRef.current?.loadGeneratedWorld(home);
      if (customSpawn) engineRef.current?.respawnPlayer(customSpawn);
      engineRef.current?.syncGraves(rpgRef.current.graves);
      engineRef.current?.syncTamedPet(rpgRef.current.tamedPet);
      engineRef.current?.setShowcaseMode(false);
      engineRef.current?.setWorldMode(mode);
      setWorldId(undefined);
      setWorldTemplate('village');
      setWorldName(home.suggestedName);
      setWorldMode(mode);
      setScreen('world');
      setRpg((prev) => ({ ...prev, activeRealm: 'home', activeDungeon: null }));
    },
    [],
  );

  const handlePlayAdventure = () => {
    if (!rpg.rebirthCompleted) {
      setActiveModal('rebirth');
      return;
    }
    enterHomeWorld('play', rpg.homeSpawn);
  };

  const handleCompleteRebirth = (newAvatar: AvatarConfig) => {
    setAvatar(newAvatar);
    saveAvatarConfig(newAvatar);
    engineRef.current?.updateAvatar(newAvatar);
    setRpg((prev) => ({ ...prev, rebirthCompleted: true }));
    setActiveModal(null);
    enterHomeWorld('play');
    sfx.playLevelUp();
    pushNotice(
      `Welcome to Gate Haven, ${newAvatar.displayName}`,
      'You start with no class. Speak to Sera beside the Shrine, learn skills from villagers, and reach Level 5 to awaken your class!',
      'system',
    );
  };

  const handleStartNewRebirth = () => {
    const fresh = resetRpgState();
    setRpg(fresh);
    setActiveModal('rebirth');
  };

  const handleStartTemplate = (template: WorldTemplateId, mode: WorldMode) => {
    const gen = generateWorldFromTemplate(template);
    engineRef.current?.loadGeneratedWorld(gen);
    engineRef.current?.setShowcaseMode(false);
    engineRef.current?.setWorldMode(mode);
    setWorldId(undefined);
    setWorldTemplate(template);
    setWorldName(gen.suggestedName);
    setLocalNotes('');
    setHasUnsavedChanges(false);
    setWorldMode(mode);
    setScreen('world');
    setActiveModal(null);
  };

  const handleConfirmPortalTravel = () => {
    if (!portalPrompt || !engineRef.current) return;
    sfx.playPortal();

    if (portalPrompt.kind === 'dungeon') {
      const dungId = portalPrompt.targetId as DungeonId;
      const dung = DUNGEON_BY_ID[dungId];
      const gen = generateDungeonWorld(dungId, Date.now() % 1000);
      engineRef.current.loadGeneratedWorld(gen);
      engineRef.current.setWorldMode('play');
      setWorldMode('play');
      setWorldName(gen.suggestedName);
      setRpg((prev) => ({ ...prev, activeDungeon: dungId }));
      setPortalPrompt(null);
      setActiveModal(null);
      pushNotice(
        `Entered ${dung.name}`,
        `Auto-map starts dark—explore procedural rooms, find the Map Pedestal, or use a Map Scroll to reveal ${dung.bossName}’s sanctum!`,
        'warning',
      );
      return;
    }

    const targetRealm = portalPrompt.targetId as RealmId;
    const isExitFromDungeon = portalPrompt.kind === 'dungeon_exit';

    // Apply Portal Soulbound Gear rule when crossing between realms (not when exiting a dungeon back to same realm)
    if (!isExitFromDungeon && targetRealm !== rpg.activeRealm) {
      const fromRealm = rpg.activeRealm;
      setRpg((prev) => {
        const nextChests = {
          ...prev.worldChests,
          [fromRealm]: [...(prev.worldChests[fromRealm] ?? [])],
          [targetRealm]: [...(prev.worldChests[targetRealm] ?? [])],
        };
        const keptEquipped = { ...prev.equipped };
        let storedCount = 0;

        for (const slot of ['weapon', 'armor', 'accessory'] as const) {
          const item = keptEquipped[slot];
          if (item && !item.soulbound) {
            nextChests[fromRealm].push(item);
            keptEquipped[slot] = null;
            storedCount += 1;
          }
        }
        const keptInventory: GearItem[] = [];
        for (const item of prev.inventory) {
          if (item.soulbound) keptInventory.push(item);
          else {
            nextChests[fromRealm].push(item);
            storedCount += 1;
          }
        }
        // Automatically return any items previously stored in destination realm's chest
        const returningItems = nextChests[targetRealm];
        nextChests[targetRealm] = [];

        if (storedCount > 0) {
          pushNotice(
            `Portal Crossing to ${REALM_BY_ID[targetRealm].name}`,
            `Soulbound gear crossed with you. ${storedCount} unbound item(s) stored in ${REALM_BY_ID[fromRealm].name}’s World Chest.`,
            'system',
          );
        }

        return {
          ...prev,
          activeRealm: targetRealm,
          activeDungeon: null,
          equipped: keptEquipped,
          inventory: [...keptInventory, ...returningItems],
          worldChests: nextChests,
        };
      });
    } else {
      setRpg((prev) => ({ ...prev, activeRealm: targetRealm, activeDungeon: null }));
    }

    const gen = generateRealmWorld(targetRealm, 101 + targetRealm.length * 17);
    engineRef.current.loadGeneratedWorld(gen);
    engineRef.current.syncGraves(rpgRef.current.graves);
    engineRef.current.syncTamedPet(rpgRef.current.tamedPet);
    engineRef.current.setWorldMode('play');
    setWorldMode('play');
    setWorldName(gen.suggestedName);
    setPortalPrompt(null);
    setActiveModal(null);
  };

  /* ============================================================================
   * NPC Branches, Skills, Quests, Shrine, Gear, Crafting
   * ============================================================================ */

  const handleNpcBranchAction = (branch: NpcDialogueBranch) => {
    if (branch.action === 'teach_skill' && branch.skillId) {
      const template = SKILL_CATALOG[branch.skillId];
      if (!template) return;
      setRpg((prev) => {
        if (prev.skills.some((s) => s.id === template.id)) return prev;
        if (prev.gold < template.costGold) return prev;
        sfx.playLevelUp();
        pushNotice(
          `Skill Learned: ${template.name}`,
          template.description,
          'quest',
        );
        return {
          ...prev,
          gold: prev.gold - template.costGold,
          skills: [
            ...prev.skills,
            {
              id: template.id,
              name: template.name,
              description: template.description,
              teacherNpcId: template.teacherNpcId,
              category: template.category,
              level: 1,
              xp: 0,
              maxXp: 60,
            },
          ],
        };
      });
    } else if (branch.action === 'open_quests') {
      setActiveNpc(null);
      setActiveModal('quests');
    } else if (branch.action === 'open_shrine') {
      setActiveNpc(null);
      setActiveModal('shrine');
    } else if (branch.action === 'open_craft') {
      setActiveNpc(null);
      setRpgMenuTab('craft');
      setActiveModal('rpg_menu');
    } else if (branch.action === 'repair_gear') {
      const cost = rpg.skills.some((s) => s.id === 'repair') ? 10 : 20;
      if (rpg.gold < cost) {
        showStatusHint(`Need ${cost}g to repair gear.`);
        return;
      }
      setRpg((prev) => {
        const nextEq = { ...prev.equipped };
        for (const slot of ['weapon', 'armor', 'accessory'] as const) {
          const item = nextEq[slot];
          if (item) nextEq[slot] = { ...item, durability: item.maxDurability };
        }
        return { ...prev, gold: prev.gold - cost, equipped: nextEq };
      });
      sfx.playChime();
      pushNotice('Gear Repaired', `All equipped gear restored to 100% durability (-${cost}g).`, 'system');
    } else if (branch.action === 'buy_dungeon_map') {
      handleBuyDungeonMapScroll();
    }
  };

  const handleBuyDungeonMapScroll = () => {
    const cost = 30;
    if (rpgRef.current.gold < cost) {
      showStatusHint(`Need ${cost}g to buy a Dungeon Map Scroll.`);
      return;
    }
    setRpg((prev) => {
      if (prev.gold < cost) return prev;
      return {
        ...prev,
        gold: prev.gold - cost,
        dungeonMapScrolls: prev.dungeonMapScrolls + 1,
      };
    });
    sfx.playChime();
    pushNotice(
      'Purchased Dungeon Map Scroll',
      'Use it from the Dungeon Auto-Map HUD inside any dungeon to reveal all procedural rooms.',
      'quest',
    );
  };

  const handleUseDungeonMapScroll = () => {
    if (rpgRef.current.dungeonMapScrolls <= 0 || rpgRef.current.activeDungeon === null) return;
    setRpg((prev) => {
      if (prev.dungeonMapScrolls <= 0) return prev;
      return { ...prev, dungeonMapScrolls: prev.dungeonMapScrolls - 1 };
    });
    engineRef.current?.revealDungeonMap();
    sfx.playLevelUp();
    pushNotice(
      'Dungeon Map Activated!',
      'Fog lifted — every procedural chamber, trap trench, loot chest, and the Boss Sanctum are now visible.',
      'quest',
    );
  };

  const handleSelectClass = (classId: Exclude<CharacterClassId, 'unawakened'>) => {
    const meta = CLASS_BY_ID[classId];
    setRpg((prev) => {
      const nextSkills = [...prev.skills];
      if (meta.starterSkillId && !nextSkills.some((s) => s.id === meta.starterSkillId)) {
        const sk = SKILL_CATALOG[meta.starterSkillId];
        if (sk) {
          nextSkills.push({
            id: sk.id,
            name: sk.name,
            description: sk.description,
            teacherNpcId: sk.teacherNpcId,
            category: sk.category,
            level: 1,
            xp: 0,
            maxXp: 60,
          });
        }
      }
      const updated: RpgPlayerState = {
        ...prev,
        playerClass: classId,
        classChoicePending: false,
        skills: nextSkills,
      };
      updated.maxHp = computeDerivedMaxHp(updated);
      updated.maxStamina = computeDerivedMaxStamina(updated);
      updated.hp = updated.maxHp;
      updated.stamina = updated.maxStamina;
      return updated;
    });
    sfx.playLevelUp();
    setActiveModal(null);
    pushNotice(`Class Awakened: ${meta.name}`, meta.bonusSummary, 'level');
  };

  const handleEquipGear = (itemId: string) => {
    setRpg((prev) => {
      const target = prev.inventory.find((i) => i.id === itemId);
      if (!target) return prev;
      const oldEquipped = prev.equipped[target.slot];
      const nextInv = prev.inventory.filter((i) => i.id !== itemId);
      if (oldEquipped) nextInv.push(oldEquipped);
      const next: RpgPlayerState = {
        ...prev,
        equipped: { ...prev.equipped, [target.slot]: target },
        inventory: nextInv,
      };
      next.maxHp = computeDerivedMaxHp(next);
      next.hp = Math.min(next.hp, next.maxHp);
      return next;
    });
    sfx.playPlace();
  };

  const handleCraftRecipe = (recipe: CraftRecipe) => {
    const isArtificer = rpg.playerClass === 'artificer';
    const hasSmithing = rpg.skills.some((s) => s.id === 'smithing');
    applyXpAndQuests((draft) => {
      const entries = Object.entries(recipe.cost) as Array<[keyof RpgPlayerState['resources'], number]>;
      for (const [res, amt] of entries) {
        const eff = isArtificer ? Math.max(1, Math.ceil(amt * 0.7)) : amt;
        if (draft.resources[res] < eff) return {};
      }
      for (const [res, amt] of entries) {
        const eff = isArtificer ? Math.max(1, Math.ceil(amt * 0.7)) : amt;
        draft.resources[res] -= eff;
      }

      draft.playstyle.craftsAndBuilds += 3;

      if (recipe.resultType === 'food') {
        draft.hunger = Math.min(draft.maxHunger, draft.hunger + 45);
        draft.hp = Math.min(draft.maxHp, draft.hp + 35);
        sfx.playHeal();
        pushNotice('Cooked Hearty Stew', 'Restored +45 Hunger and +35 HP.', 'system');
        return { xpGain: 15 };
      }

      const crafted = generateGearItem({
        level: Math.max(1, draft.level + (hasSmithing ? 1 : 0)),
        rarity: recipe.rarity ?? 'Uncommon',
        slot: recipe.slot,
        weaponKind: recipe.weaponKind,
        customName: recipe.name,
      });
      draft.inventory.push(crafted);
      sfx.playOreSparkle();
      pushNotice(`Crafted ${crafted.name}`, `Added ${crafted.rarity} gear to your bag!`, 'quest');
      return { xpGain: 30, skillIdUsed: hasSmithing ? 'smithing' : undefined };
    });
  };

  /* ============================================================================
   * Save / Load / Export / Import Worlds (Create Mode & My Worlds)
   * ============================================================================ */

  const handleSaveCurrentWorld = async (name: string, saveAsNew: boolean) => {
    const engine = engineRef.current;
    if (!engine) return;
    const saved = await saveWorldRecord({
      id: saveAsNew ? undefined : worldId,
      name,
      template: worldTemplate,
      blocks: engine.getBlocksSnapshot(),
      spawn: engine.getSpawnPoint(),
      npcs: engine.getNpcs(),
      notes: localNotes,
    });
    setWorldId(saved.id);
    setWorldName(saved.name);
    setHasUnsavedChanges(false);
    setSavedWorlds(await listSavedWorlds());
    sfx.playChime();
  };

  const handleLoadSavedWorld = async (id: string, mode: WorldMode) => {
    const rec = await loadWorldRecord(id);
    if (!rec || !engineRef.current) return;
    const { decodeRle } = await import('./storage/worldStorage');
    const blocks = decodeRle(rec.rleBlocks);
    engineRef.current.loadWorld(blocks, rec.spawn, rec.npcs);
    engineRef.current.setShowcaseMode(false);
    engineRef.current.setWorldMode(mode);
    setWorldId(rec.id);
    setWorldName(rec.name);
    setWorldTemplate(rec.template);
    setLocalNotes(rec.notes);
    setHasUnsavedChanges(false);
    setWorldMode(mode);
    setScreen('world');
    setActiveModal(null);
  };

  const handleDeleteSavedWorld = async (id: string) => {
    await deleteWorldRecord(id);
    if (worldId === id) setWorldId(undefined);
    setSavedWorlds(await listSavedWorlds());
  };

  const handleExportCurrentWorld = async (): Promise<string> => {
    const engine = engineRef.current;
    if (!engine) return '';
    return exportWorldCode({
      name: worldName,
      template: worldTemplate,
      blocks: engine.getBlocksSnapshot(),
      spawn: engine.getSpawnPoint(),
    });
  };

  const handleImportWorldCode = async (code: string) => {
    const decoded = await importWorldCode(code);
    const engine = engineRef.current;
    if (!engine) return;
    engine.loadWorld(decoded.blocks, decoded.spawn, decoded.npcs);
    engine.setShowcaseMode(false);
    engine.setWorldMode('play');
    setWorldId(undefined);
    setWorldTemplate(decoded.template);
    setWorldName(decoded.name);
    setWorldMode('play');
    setScreen('world');
    setActiveModal(null);
    sfx.playChime();
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-slate-950 select-none">
      {/* Dedicated WebGL Mount Container (never unmounted by HUD changes) */}
      <div ref={canvasMountRef} className="fixed inset-0 z-0 h-full w-full" />

      {/* Damage Flash Vignette */}
      {damageFlash && (
        <div
          className="pointer-events-none fixed inset-0 z-10 border-8 border-rose-500/60"
          style={{ backgroundColor: 'rgba(225, 29, 72, 0.16)' }}
        />
      )}

      {/* WebGL Context Lost Banner */}
      {webglLost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/92 p-6 text-center text-white">
          <div className="max-w-sm space-y-3 rounded-2xl border border-slate-700 bg-slate-900 p-6">
            <h2 className="text-lg font-bold">3D Graphics Context Paused</h2>
            <p className="text-xs text-slate-300">
              Your browser temporarily paused WebGL rendering. Reload the page to restore your world.
            </p>
          </div>
        </div>
      )}

      {/* Home Screen */}
      {screen === 'home' && (
        <HomeScreen
          avatar={avatar}
          rpg={rpg}
          savedWorlds={savedWorlds}
          inputMode={inputMode}
          controllerBrand={controllerInfo.brand}
          onPlayAdventure={handlePlayAdventure}
          onStartNewRebirth={handleStartNewRebirth}
          onStartTemplate={handleStartTemplate}
          onOpenMyWorlds={() => setActiveModal('worlds')}
          onOpenAvatar={() => setActiveModal('avatar')}
          onOpenSafety={() => {
            setReportDefaultTarget(undefined);
            setActiveModal('safety');
          }}
          onOpenHelp={() => setActiveModal('help')}
        />
      )}

      {/* Active World HUD & Touch Controls */}
      {screen === 'world' && (
        <>
          <TopHud
            worldName={worldName}
            worldMode={worldMode}
            cameraView={cameraView}
            selectedBlock={selectedBlock}
            editorTool={editorTool}
            brushSize={brushSize}
            undoCount={undoCount}
            redoCount={redoCount}
            pointerLocked={pointerLocked}
            hasUnsavedChanges={hasUnsavedChanges}
            timeOfDay={timeOfDay}
            rpg={rpg}
            targetCreature={targetCreature}
            interactPrompt={interactPrompt}
            statusHint={statusHint}
            dockCollapsed={dockCollapsed}
            inputMode={inputMode}
            controllerBrand={controllerInfo.brand}
            isBlocking={isBlockingHud}
            skillStripFocused={skillStripFocused}
            activeSkillIndex={activeSkillIndex}
            onToggleDock={() => setDockCollapsed((c) => !c)}
            onGoHome={() => {
              setScreen('home');
              setActiveNpc(null);
              setInspectResult(null);
              setMapExpanded(false);
              engineRef.current?.setShowcaseMode(true);
            }}
            onSetWorldMode={(mode) => {
              setWorldMode(mode);
              engineRef.current?.setWorldMode(mode);
            }}
            onSelectBlock={(id) => {
              setSelectedBlock(id);
              engineRef.current?.setSelectedBlock(id);
            }}
            onSetEditorTool={(tool) => {
              setEditorTool(tool);
              engineRef.current?.setEditorTool(tool);
            }}
            onSetBrushSize={(size) => {
              setBrushSize(size);
              engineRef.current?.setBrushSize(size);
            }}
            onUndo={() => engineRef.current?.undo()}
            onRedo={() => engineRef.current?.redo()}
            onRespawn={() => engineRef.current?.respawnPlayer()}
            onToggleCameraView={() => {
              const next: CameraViewMode =
                cameraView === 'first-person' ? 'third-person' : 'first-person';
              setCameraView(next);
              engineRef.current?.setCameraView(next);
            }}
            onCycleTimeOfDay={() => {
              const st = engineRef.current?.cycleTimeOfDay();
              if (st) setTimeOfDay(st);
            }}
            onOpenStatus={() => {
              setRpgMenuTab('status');
              setActiveModal('rpg_menu');
            }}
            onOpenQuests={() => setActiveModal('quests')}
            onOpenWorlds={() => {
              setRpgMenuTab('worlds');
              setActiveModal('rpg_menu');
            }}
            onOpenClassModal={() => setActiveModal('class')}
            onOpenMyWorlds={() => setActiveModal('worlds')}
            onOpenSafety={() => {
              setReportDefaultTarget(undefined);
              setActiveModal('safety');
            }}
            onOpenHelp={() => setActiveModal('help')}
            onTriggerSkill={handleSkillTrigger}
            onTriggerInteract={() => engineRef.current?.interactNearest()}
            onRequestPointerLock={() => engineRef.current?.requestPointerLock()}
          />

          <MinimapHud
            getSnapshot={() => engineRef.current?.getMinimapSnapshot() ?? null}
            expanded={mapExpanded}
            onSetExpanded={setMapExpanded}
            dungeonMapScrolls={rpg.dungeonMapScrolls}
            hasTracking={rpg.skills.some((s) => s.id === 'tracking')}
            onUseDungeonMapScroll={handleUseDungeonMapScroll}
          />

          {inspectResult && (
            <InspectCard result={inspectResult} onClose={() => setInspectResult(null)} />
          )}

          <TouchControls
            visible={touchControlsEnabled && activeModal === null && activeNpc === null && !mapExpanded}
            worldMode={worldMode}
            onJoystickMove={(x, y) => engineRef.current?.setTouchJoystick(x, y)}
            onJump={() => engineRef.current?.triggerJump()}
            onBreak={() => engineRef.current?.triggerPrimaryAction()}
            onPlace={() => engineRef.current?.triggerSecondaryAction()}
            onInteract={() => engineRef.current?.interactNearest()}
            onCastSkill={() => {
              if (rpg.skills.some((s) => s.id === 'firebolt')) handleSkillTrigger('firebolt');
              else if (rpg.skills.some((s) => s.id === 'bow_mastery')) handleSkillTrigger('bow');
              else handleSkillTrigger('mend');
            }}
          />
        </>
      )}

      {/* System Notification Stack */}
      <SystemToastStack
        notices={notices}
        belowMinimap={screen === 'world'}
        onDismiss={(id) => setNotices((prev) => prev.filter((n) => n.id !== id))}
      />

      {/* NPC Dialogue Tree */}
      {activeNpc && (
        <NpcDialogueCard
          npc={activeNpc}
          learnedSkills={rpg.skills}
          playerGold={rpg.gold}
          onBranchAction={handleNpcBranchAction}
          onClose={() => setActiveNpc(null)}
          onReportNpc={(name) => {
            setActiveNpc(null);
            setReportDefaultTarget(`NPC: ${name}`);
            setActiveModal('safety');
          }}
        />
      )}

      {/* Rebirth Modal */}
      {activeModal === 'rebirth' && (
        <RebirthModal
          initialAvatar={avatar}
          onCompleteRebirth={handleCompleteRebirth}
          onCancel={() => setActiveModal(null)}
        />
      )}

      {/* Level 5 Class Awakening Modal */}
      {activeModal === 'class' && (
        <ClassAwakeningModal
          level={rpg.level}
          currentClass={rpg.playerClass}
          playstyle={rpg.playstyle}
          skills={rpg.skills}
          onSelectClass={handleSelectClass}
          onClose={() => setActiveModal(null)}
        />
      )}

      {/* Unified System Status / Skills / Gear / Craft / Worlds Modal */}
      {activeModal === 'rpg_menu' && (
        <RpgMenuModal
          initialTab={rpgMenuTab}
          playerName={avatar.displayName}
          rpg={rpg}
          onClose={() => setActiveModal(null)}
          onOpenClassModal={() => setActiveModal('class')}
          onTogglePvp={() =>
            setRpg((prev) => {
              const nextPvp = !prev.pvpEnabled;
              pushNotice(
                nextPvp ? 'PvP Flag Enabled' : 'PvE Safe Mode Active',
                nextPvp
                  ? 'You opted into PvP flagging. Toggle back off anytime.'
                  : 'PvP is off by default for relaxed PvE exploration.',
                'system',
              );
              return { ...prev, pvpEnabled: nextPvp };
            })
          }
          onEquipGear={handleEquipGear}
          onWithdrawChestGear={(itemId) => {
            setRpg((prev) => {
              const chest = prev.worldChests[prev.activeRealm] ?? [];
              const target = chest.find((i) => i.id === itemId);
              if (!target) return prev;
              return {
                ...prev,
                inventory: [...prev.inventory, target],
                worldChests: {
                  ...prev.worldChests,
                  [prev.activeRealm]: chest.filter((i) => i.id !== itemId),
                },
              };
            });
          }}
          onCraftRecipe={handleCraftRecipe}
          onRequestRealmTravel={(realmId) => {
            setPortalPrompt({ kind: 'realm', targetId: realmId });
            setActiveModal('portal');
          }}
          onRequestDungeonEnter={(dungeonId) => {
            setPortalPrompt({ kind: 'dungeon', targetId: dungeonId });
            setActiveModal('portal');
          }}
          onOpenShrine={() => setActiveModal('shrine')}
        />
      )}

      {/* Village Quest Board Modal */}
      {activeModal === 'quests' && (
        <QuestBoardModal
          playerLevel={rpg.level}
          activeQuests={rpg.quests}
          onAcceptQuest={(questId) => {
            setRpg((prev) => {
              if (prev.quests.some((q) => q.questId === questId)) return prev;
              return {
                ...prev,
                quests: [...prev.quests, { questId, progress: 0, completed: false, claimed: false }],
              };
            });
            sfx.playChime();
          }}
          onClaimQuest={(questId) => {
            const def = QUEST_BOARD_LIST.find((q) => q.id === questId);
            if (!def) return;
            applyXpAndQuests((draft) => {
              const aq = draft.quests.find((q) => q.questId === questId);
              if (!aq || !aq.completed || aq.claimed) return {};
              aq.claimed = true;
              if (def.rewardRarity) {
                draft.inventory.push(
                  generateGearItem({ level: draft.level, rarity: def.rewardRarity }),
                );
              }
              return { xpGain: def.rewardXp, goldGain: def.rewardGold };
            });
            sfx.playLevelUp();
            pushNotice(
              `Quest Completed: ${def.title}`,
              `Earned +${def.rewardXp} XP, +${def.rewardGold}g${def.rewardRarity ? ` & ${def.rewardRarity} Gear` : ''}!`,
              'quest',
            );
          }}
          onClose={() => setActiveModal(null)}
        />
      )}

      {/* Awakening Shrine Modal */}
      {activeModal === 'shrine' && (
        <ShrineModal
          rpg={rpg}
          onRestAndHeal={() => {
            setRpg((prev) => ({
              ...prev,
              hp: prev.maxHp,
              stamina: prev.maxStamina,
              hunger: prev.maxHunger,
            }));
            sfx.playHeal();
            pushNotice('Shrine Blessing', 'HP, Stamina, and Hunger fully restored.', 'system');
          }}
          onSetHomeSpawn={() => {
            const pos = engineRef.current?.getPlayerPosition() ?? rpg.homeSpawn;
            setRpg((prev) => ({
              ...prev,
              homeSpawn: pos,
              homeRealm: prev.activeRealm,
            }));
            sfx.playChime();
            pushNotice(
              'Home Spawn Bound',
              `Your spirit will now return to ${REALM_BY_ID[rpg.activeRealm].name} if you fall.`,
              'system',
            );
          }}
          onSoulbindItem={(itemId, cost) => {
            setRpg((prev) => {
              if (prev.gold < cost) return prev;
              const nextEq = { ...prev.equipped };
              for (const slot of ['weapon', 'armor', 'accessory'] as const) {
                const it = nextEq[slot];
                if (it && it.id === itemId) nextEq[slot] = { ...it, soulbound: true };
              }
              const nextInv = prev.inventory.map((it) =>
                it.id === itemId ? { ...it, soulbound: true } : it,
              );
              return { ...prev, gold: prev.gold - cost, equipped: nextEq, inventory: nextInv };
            });
            sfx.playOreSparkle();
            pushNotice(
              'Item Soulbound!',
              'This item will stay with you on death and cross dimensional portals.',
              'quest',
            );
          }}
          onRepairAll={(cost) => {
            setRpg((prev) => {
              if (prev.gold < cost) return prev;
              const nextEq = { ...prev.equipped };
              for (const slot of ['weapon', 'armor', 'accessory'] as const) {
                const it = nextEq[slot];
                if (it) nextEq[slot] = { ...it, durability: it.maxDurability };
              }
              return { ...prev, gold: prev.gold - cost, equipped: nextEq };
            });
            sfx.playChime();
            pushNotice('Gear Repaired', `Restored all equipped gear to 100% durability (-${cost}g).`, 'system');
          }}
          onClose={() => setActiveModal(null)}
        />
      )}

      {/* Portal / Dungeon Entry Confirmation Modal */}
      {activeModal === 'portal' && portalPrompt && (
        <PortalConfirmModal
          prompt={portalPrompt}
          playerLevel={rpg.level}
          playerGold={rpg.gold}
          dungeonMapScrolls={rpg.dungeonMapScrolls}
          clearedDungeons={rpg.clearedDungeons}
          unboundGear={[
            rpg.equipped.weapon,
            rpg.equipped.armor,
            rpg.equipped.accessory,
            ...rpg.inventory,
          ].filter((x): x is GearItem => x !== null && !x.soulbound)}
          onBuyDungeonMap={handleBuyDungeonMapScroll}
          onConfirm={handleConfirmPortalTravel}
          onCancel={() => {
            setPortalPrompt(null);
            setActiveModal(null);
          }}
        />
      )}

      {/* Real Death Penalty Modal */}
      {activeModal === 'death' && deathSummary && (
        <DeathModal
          cause={deathSummary.cause}
          lostLevel={deathSummary.lostLevel}
          newLevel={deathSummary.newLevel}
          droppedCount={deathSummary.droppedCount}
          keptSoulboundCount={deathSummary.keptSoulboundCount}
          onRespawn={() => {
            setDeathSummary(null);
            setActiveModal(null);
            enterHomeWorld('play', rpg.homeSpawn);
          }}
        />
      )}

      {/* Avatar Customizer Modal */}
      {activeModal === 'avatar' && (
        <AvatarModal
          avatar={avatar}
          cameraView={cameraView}
          onSave={(nextAvatar, nextView) => {
            setAvatar(nextAvatar);
            saveAvatarConfig(nextAvatar);
            setCameraView(nextView);
            engineRef.current?.updateAvatar(nextAvatar);
            engineRef.current?.setCameraView(nextView);
            setActiveModal(null);
            sfx.playChime();
          }}
          onClose={() => setActiveModal(null)}
        />
      )}

      {/* My Worlds Save/Load/Export/Import Modal */}
      {activeModal === 'worlds' && (
        <MyWorldsModal
          savedWorlds={savedWorlds}
          inWorld={screen === 'world'}
          currentWorldName={worldName}
          currentWorldId={worldId ?? null}
          onSaveCurrent={handleSaveCurrentWorld}
          onLoadWorld={handleLoadSavedWorld}
          onDeleteWorld={handleDeleteSavedWorld}
          onStartTemplate={handleStartTemplate}
          onExportCode={handleExportCurrentWorld}
          onImportCode={handleImportWorldCode}
          onClose={() => setActiveModal(null)}
        />
      )}

      {/* Family Safety, Local Notes & Report/Block Stubs */}
      {activeModal === 'safety' && (
        <SafetyModal
          worldName={worldName}
          localNotes={localNotes}
          safetyLogs={safetyLogs}
          initialTarget={reportDefaultTarget}
          onUpdateNotes={(notes) => {
            setLocalNotes(notes);
            setHasUnsavedChanges(true);
          }}
          onLogStubAction={(type, targetLabel, reason) => {
            const next = addSafetyLog({ type, targetLabel, reason });
            setSafetyLogs(next);
            sfx.playChime();
          }}
          onClose={() => setActiveModal(null)}
        />
      )}

      {/* Settings, Controls & Controller Layout Modal */}
      {activeModal === 'help' && (
        <HelpModal
          soundEnabled={soundEnabled}
          touchControlsEnabled={touchControlsEnabled}
          showOverheadLabels={showOverheadLabels}
          controllerConnected={controllerInfo.connected}
          controllerBrand={controllerInfo.brand}
          controllerId={controllerInfo.id}
          supportsRumble={controllerInfo.supportsRumble}
          inputMode={inputMode}
          onTestRumble={() => gamepadManager.rumble('test')}
          onToggleSound={() => {
            const next = !soundEnabled;
            setSoundEnabled(next);
            sfx.enabled = next;
          }}
          onToggleTouchControls={() => setTouchControlsEnabled((v) => !v)}
          onToggleOverheadLabels={() => setShowOverheadLabels((v) => !v)}
          onClose={() => setActiveModal(null)}
        />
      )}
    </div>
  );
}
