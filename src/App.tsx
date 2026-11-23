import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Crosshair,
  Flame,
  Gamepad2,
  Hand,
  HelpCircle,
  Play,
  RotateCcw,
  Shield,
  ShieldAlert,
  Trophy,
} from 'lucide-react';
import { DISPLAY_DESCRIPTION, DISPLAY_NAME, DISPLAY_SUBTITLE } from '../shared/branding';
import { ENGINE } from '../shared/engine';
import { ITEM_REGISTRY } from '../shared/itemRegistry';
import { HelpModal } from './components/HelpModal';
import { SystemToastStack, type HudNotice } from './components/SystemToastStack';
import { TouchControls } from './components/TouchControls';
import { PlayerController } from './entities/PlayerController';
import {
  gamepadManager,
  getGamepadGlyphs,
  type ControllerBrand,
  type InputModality,
} from './input/gamepadManager';
import { connectBattleIsland, type BattleIslandConnection } from './net/client';
import { IslandScene } from './world/IslandScene';

interface TeamHudSummary {
  teamId: string;
  label: string;
  points: number;
  coreHp: number;
  tier: number;
}

interface SlotHudItem {
  itemId: string;
  name: string;
  level: number;
}

interface HudSnapshot {
  connected: boolean;
  phase: string;
  winnerTeamId: string;
  timeRemainingSec: number;
  myTeamId: string;
  hp: number;
  maxHp: number;
  shieldHp: number;
  alive: boolean;
  activeWeaponIndex: number;
  weapons: SlotHudItem[];
  skills: SlotHudItem[];
  traps: SlotHudItem[];
  teams: TeamHudSummary[];
  contextPrompt: string | null;
}

const INITIAL_HUD: HudSnapshot = {
  connected: false,
  phase: 'active',
  winnerTeamId: '',
  timeRemainingSec: ENGINE.matchDurationSec,
  myTeamId: 'team_0',
  hp: ENGINE.playerMaxHp,
  maxHp: ENGINE.playerMaxHp,
  shieldHp: 0,
  alive: true,
  activeWeaponIndex: 0,
  weapons: [],
  skills: [],
  traps: [],
  teams: [],
  contextPrompt: null,
};

function formatClock(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem.toString().padStart(2, '0')}`;
}

function teamLabel(teamId: string): string {
  if (teamId === 'team_0') return 'Ember Squad';
  if (teamId === 'team_1') return 'Azure Squad';
  if (teamId === 'draw') return 'Draw';
  return teamId.replace('team_', 'Squad ');
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const connectionRef = useRef<BattleIslandConnection | null>(null);
  const controllerRef = useRef<PlayerController | null>(null);
  const sceneRef = useRef<IslandScene | null>(null);
  const prevHpRef = useRef<number>(ENGINE.playerMaxHp);
  const helpOpenRef = useRef<boolean>(false);

  const [started, setStarted] = useState(false);
  const [joining, setJoining] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [modality, setModality] = useState<InputModality>('keyboard');
  const [controllerBrand, setControllerBrand] = useState<ControllerBrand>('xbox');
  const [controllerConnected, setControllerConnected] = useState(false);
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [notices, setNotices] = useState<HudNotice[]>([]);

  useEffect(() => {
    document.title = DISPLAY_NAME;
  }, []);

  useEffect(() => {
    helpOpenRef.current = helpOpen;
  }, [helpOpen]);

  const pushNotice = useCallback((tone: HudNotice['tone'], title: string, body: string) => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setNotices((prev) => [{ id, tone, title, body }, ...prev].slice(0, 4));
    window.setTimeout(() => {
      setNotices((prev) => prev.filter((n) => n.id !== id));
    }, 4200);
  }, []);

  const dismissNotice = useCallback((id: string) => {
    setNotices((prev) => prev.filter((n) => n.id !== id));
  }, []);

  useEffect(() => {
    const isTouchCapable =
      typeof window !== 'undefined' &&
      ('ontouchstart' in window || navigator.maxTouchPoints > 0);
    if (isTouchCapable) {
      setModality('touch');
    }
    return gamepadManager.subscribeStatus((info) => {
      setControllerConnected(info.connected);
      setControllerBrand(info.brand);
      if (info.connected) {
        setModality('gamepad');
      }
    });
  }, []);

  const teardownMatch = useCallback(async () => {
    sceneRef.current?.dispose();
    sceneRef.current = null;
    controllerRef.current?.dispose();
    controllerRef.current = null;
    if (connectionRef.current) {
      await connectionRef.current.dispose();
      connectionRef.current = null;
    }
  }, []);

  const startMatch = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setJoining(true);
    setConnectError(null);

    try {
      await teardownMatch();
      const conn = await connectBattleIsland();
      connectionRef.current = conn;

      conn.room.onMessage('action_error', (msg: { error?: string }) => {
        if (msg?.error) {
          pushNotice('warning', 'Action Blocked', msg.error);
        }
      });

      const controller = new PlayerController(canvas, conn, {
        onModalityChange: (nextMod, brand) => {
          setModality(nextMod);
          setControllerBrand(brand);
        },
        onToggleHelp: () => setHelpOpen((prev) => !prev),
        onCloseModal: () => setHelpOpen(false),
        isModalOpen: () => helpOpenRef.current,
      });
      controllerRef.current = controller;

      const scene = new IslandScene(canvas, conn, controller);
      sceneRef.current = scene;

      setStarted(true);
      pushNotice('info', `Welcome to ${DISPLAY_NAME}`, 'Claim crates, fortify your base sockets, and outscore the rival squad.');
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : 'Unable to connect to match server');
    } finally {
      setJoining(false);
    }
  }, [pushNotice, teardownMatch]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      void teardownMatch();
    };
  }, [teardownMatch]);

  // Throttled read-only HUD sync from authoritative Colyseus state (React never mutates game state)
  useEffect(() => {
    if (!started) return;
    const interval = window.setInterval(() => {
      const conn = connectionRef.current;
      if (!conn) return;
      const state = conn.room.state;
      const self = state.players?.get(conn.room.sessionId);

      if (self && self.hp < prevHpRef.current) {
        controllerRef.current?.triggerRumble(self.hp <= 0 ? 'death' : 'hit');
      }
      if (self) {
        prevHpRef.current = self.hp;
      }

      const teams: TeamHudSummary[] = [];
      if (state.bases) {
        for (const base of state.bases.values()) {
          teams.push({
            teamId: base.teamId,
            label: teamLabel(base.teamId),
            points: base.points,
            coreHp: Math.round(base.coreHp),
            tier: base.tier,
          });
        }
        teams.sort((a, b) => a.teamId.localeCompare(b.teamId));
      }

      const mapSlots = (
        arr: Iterable<{ itemId: string; level: number }> | undefined,
      ): SlotHudItem[] => {
        if (!arr) return [];
        const out: SlotHudItem[] = [];
        for (const it of arr) {
          out.push({
            itemId: it.itemId,
            name: ITEM_REGISTRY[it.itemId]?.name ?? it.itemId,
            level: it.level,
          });
        }
        return out;
      };

      // Read-only proximity hint for nearest crate or own-base socket
      let contextPrompt: string | null = null;
      if (self && self.alive) {
        const pose = conn.getLocalPose() ?? self;
        if (state.crates) {
          for (const crate of state.crates.values()) {
            if (crate.opened) continue;
            if (Math.hypot(crate.x - pose.x, crate.z - pose.z) <= ENGINE.crateInteractRange) {
              contextPrompt = `Open Tier ${crate.tier} Loot Crate`;
              break;
            }
          }
        }
        if (!contextPrompt && state.bases) {
          const ownBase = state.bases.get(self.teamId);
          if (ownBase) {
            for (const sock of ownBase.sockets.values()) {
              if (sock.tier >= ENGINE.maxBaseTier) continue;
              if (Math.hypot(sock.x - pose.x, sock.z - pose.z) <= ENGINE.baseBuildRange * 0.65) {
                contextPrompt = `Build ${sock.type.replace('_', ' ')} (Tier ${sock.tier + 1})`;
                break;
              }
            }
          }
        }
      }

      setHud({
        connected: true,
        phase: state.phase || 'active',
        winnerTeamId: state.winnerTeamId || '',
        timeRemainingSec: state.matchTimeRemaining ?? 0,
        myTeamId: self?.teamId ?? 'team_0',
        hp: self ? Math.round(self.hp) : 0,
        maxHp: self ? Math.round(self.maxHp) : ENGINE.playerMaxHp,
        shieldHp: self ? Math.round(self.shieldHp) : 0,
        alive: self?.alive ?? true,
        activeWeaponIndex: self?.activeWeaponIndex ?? 0,
        weapons: mapSlots(self?.weaponSlots),
        skills: mapSlots(self?.skillSlots),
        traps: mapSlots(self?.trapSlots),
        teams,
        contextPrompt,
      });
    }, 100);

    return () => window.clearInterval(interval);
  }, [started]);

  const glyphs = getGamepadGlyphs(controllerBrand);
  const interactHint = modality === 'gamepad' ? glyphs.x : 'E';
  const skillHint = modality === 'gamepad' ? glyphs.y : 'Space';
  const trapHint = modality === 'gamepad' ? glyphs.b : 'Q';

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#171310] text-[#E8DEC8]">
      {/* Pure Babylon.js 3D Canvas */}
      <canvas
        ref={canvasRef}
        className="block h-full w-full touch-none outline-none"
      />

      {/* Home Overlay before entering match */}
      {!started && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-gradient-to-b from-[#172630]/92 via-[#191612]/90 to-[#14110E]/96 p-6">
          <div className="w-full max-w-xl rounded-2xl border border-[#6E5B44] bg-[#1E1914]/95 p-8 shadow-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#D4A65C]">
              {DISPLAY_SUBTITLE}
            </p>
            <h1 className="mt-2 font-[var(--font-display)] text-4xl font-bold tracking-tight text-[#F6EFE0] sm:text-5xl">
              {DISPLAY_NAME}
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-[#CFC2AA]">
              {DISPLAY_DESCRIPTION}
            </p>

            {connectError && (
              <div className="mt-4 rounded-xl border border-[#A8483E] bg-[#3E1B18]/80 px-4 py-3 text-xs text-[#F5C5BF]">
                {connectError}
              </div>
            )}

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={joining}
                onClick={() => void startMatch()}
                className="flex items-center gap-2 rounded-xl border border-[#DFB56A] bg-[#C99A4E] px-6 py-3 text-sm font-bold text-[#1A140E] shadow-lg transition hover:bg-[#D9AC62] disabled:opacity-60 cursor-pointer"
              >
                <Play className="h-4 w-4 fill-current" />
                <span>{joining ? 'Joining Island...' : 'Play Match'}</span>
              </button>

              <button
                type="button"
                onClick={() => setHelpOpen(true)}
                className="flex items-center gap-2 rounded-xl border border-[#5A4B3A] bg-[#29221B] px-5 py-3 text-sm font-semibold text-[#E8DEC8] transition hover:bg-[#352C23] cursor-pointer"
              >
                <HelpCircle className="h-4 w-4 text-[#D4A65C]" />
                <span>Controls</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live Match Top HUD */}
      {started && (
        <>
          <div className="pointer-events-none fixed inset-x-0 top-3 z-20 flex items-start justify-between px-4">
            {/* Title & Squad Badge */}
            <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-[#5A4B3A]/85 bg-[#1B1612]/88 px-3.5 py-2 shadow-lg">
              <div>
                <p className="font-[var(--font-display)] text-sm font-bold tracking-wide text-[#F3E9D6]">
                  {DISPLAY_NAME}
                </p>
                <p className="text-[11px] font-medium text-[#D4A65C]">
                  {teamLabel(hud.myTeamId)}
                </p>
              </div>
            </div>

            {/* Team Scoreboard & Match Timer */}
            <div className="flex items-center gap-3 rounded-xl border border-[#6A5742]/90 bg-[#1B1612]/90 px-4 py-2 shadow-lg">
              {hud.teams.map((t, idx) => (
                <React.Fragment key={t.teamId}>
                  {idx > 0 && <div className="h-7 w-px bg-[#4E4032]" />}
                  <div className="text-center">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[#B6A78E]">
                      {t.label}
                    </p>
                    <p className="font-mono text-lg font-bold tabular-nums text-[#F5ECD9]">
                      {t.points}
                      <span className="ml-1 text-[10px] font-normal text-[#B6A78E]">
                        / {ENGINE.winScoreThreshold}
                      </span>
                    </p>
                  </div>
                </React.Fragment>
              ))}
              <div className="h-7 w-px bg-[#4E4032]" />
              <div className="text-center">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#D4A65C]">
                  Time
                </p>
                <p className="font-mono text-lg font-bold tabular-nums text-[#F5ECD9]">
                  {formatClock(hud.timeRemainingSec)}
                </p>
              </div>
            </div>

            {/* Right Utility Buttons */}
            <div className="pointer-events-auto flex items-center gap-2">
              {controllerConnected && (
                <div className="flex items-center gap-1.5 rounded-xl border border-[#5A4B3A] bg-[#1B1612]/88 px-3 py-2 text-xs text-[#D4A65C]">
                  <Gamepad2 className="h-4 w-4" />
                  <span className="hidden sm:inline">{glyphs.brandLabel}</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => setHelpOpen(true)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#5A4B3A] bg-[#1B1612]/88 text-[#E8DEC8] hover:bg-[#2A221B] cursor-pointer"
                aria-label="Open controls help"
              >
                <HelpCircle className="h-4 w-4 text-[#D4A65C]" />
              </button>
            </div>
          </div>

          {/* Context Prompt for nearby crate / base socket */}
          {hud.contextPrompt && hud.phase === 'active' && (
            <div className="pointer-events-none fixed inset-x-0 bottom-32 z-20 flex justify-center px-4">
              <div className="flex items-center gap-2 rounded-xl border border-[#D4A65C]/80 bg-[#1B1612]/92 px-4 py-2 text-xs font-semibold text-[#F5ECD9] shadow-xl">
                <Hand className="h-4 w-4 text-[#D4A65C]" />
                <span>
                  Press <span className="font-mono text-[#E8C078]">{interactHint}</span> to {hud.contextPrompt}
                </span>
              </div>
            </div>
          )}

          {/* Respawn Banner */}
          {!hud.alive && hud.phase === 'active' && (
            <div className="pointer-events-none fixed inset-0 z-20 flex items-center justify-center">
              <div className="rounded-2xl border border-[#9F453B] bg-[#1B1311]/92 px-6 py-4 text-center shadow-2xl">
                <p className="font-[var(--font-display)] text-lg font-bold text-[#F3D2CC]">
                  Tagged Out
                </p>
                <p className="mt-1 text-xs text-[#CFC2AA]">Returning to your squad base...</p>
              </div>
            </div>
          )}

          {/* Bottom Vitals & Loadout Bar (Read-only mirror of authoritative slots) */}
          <div className="pointer-events-none fixed inset-x-0 bottom-3 z-20 flex flex-col items-center gap-2 px-4">
            <div className="flex w-full max-w-2xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#5A4B3A]/90 bg-[#1B1612]/92 px-4 py-2.5 shadow-xl">
              {/* HP & Shield */}
              <div className="min-w-[160px] flex-1">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-[#E8DEC8]">HP {hud.hp} / {hud.maxHp}</span>
                  {hud.shieldHp > 0 && (
                    <span className="flex items-center gap-1 text-[#7FD3F4]">
                      <Shield className="h-3.5 w-3.5" />
                      {hud.shieldHp}
                    </span>
                  )}
                </div>
                <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-[#312820]">
                  <div
                    className="h-full bg-[#5D9B52] transition-all duration-150"
                    style={{ width: `${Math.max(0, Math.min(100, (hud.hp / Math.max(1, hud.maxHp)) * 100))}%` }}
                  />
                </div>
              </div>

              {/* Weapon, Skill, Trap Slots */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {hud.weapons.map((w, idx) => (
                  <div
                    key={`w_${idx}`}
                    className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 ${
                      idx === hud.activeWeaponIndex
                        ? 'border-[#D4A65C] bg-[#33281C] text-[#F5ECD9]'
                        : 'border-[#4A3D30] bg-[#241E18] text-[#B6A78E]'
                    }`}
                  >
                    <Crosshair className="h-3.5 w-3.5 text-[#D4A65C]" />
                    <span className="font-semibold">{w.name}</span>
                    <span className="font-mono text-[10px] text-[#D4A65C]">Lv.{w.level}</span>
                  </div>
                ))}

                {hud.skills[0] && (
                  <div className="flex items-center gap-1.5 rounded-lg border border-[#4A3D30] bg-[#241E18] px-2.5 py-1.5 text-[#E8DEC8]">
                    <Flame className="h-3.5 w-3.5 text-[#E08A4F]" />
                    <span>{hud.skills[0].name}</span>
                    <span className="font-mono text-[10px] text-[#B6A78E]">[{skillHint}]</span>
                  </div>
                )}

                {hud.traps[0] && (
                  <div className="flex items-center gap-1.5 rounded-lg border border-[#4A3D30] bg-[#241E18] px-2.5 py-1.5 text-[#E8DEC8]">
                    <ShieldAlert className="h-3.5 w-3.5 text-[#D26C5B]" />
                    <span>{hud.traps[0].name}</span>
                    <span className="font-mono text-[10px] text-[#B6A78E]">[{trapHint}]</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Match End Overlay */}
          {hud.phase === 'ended' && (
            <div
              data-gamepad-scope="modal"
              className="fixed inset-0 z-40 flex items-center justify-center bg-black/72 p-4 backdrop-blur-xs"
            >
              <div className="w-full max-w-md rounded-2xl border border-[#C99A4E] bg-[#1E1914]/96 p-7 text-center shadow-2xl">
                <Trophy className="mx-auto h-10 w-10 text-[#DFB56A]" />
                <p className="mt-2 text-xs font-semibold uppercase tracking-widest text-[#D4A65C]">
                  Match Complete
                </p>
                <h2 className="mt-1 font-[var(--font-display)] text-3xl font-bold text-[#F5ECD9]">
                  {hud.winnerTeamId === 'draw'
                    ? 'Island Draw'
                    : `${teamLabel(hud.winnerTeamId)} Wins!`}
                </h2>
                <div className="mt-4 space-y-2 rounded-xl border border-[#4B3E30] bg-[#251F19] p-4">
                  {hud.teams.map((t) => (
                    <div key={t.teamId} className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-[#E8DEC8]">{t.label}</span>
                      <span className="font-mono font-bold text-[#E8C078]">{t.points} pts</span>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => void startMatch()}
                  className="mt-6 inline-flex items-center gap-2 rounded-xl border border-[#DFB56A] bg-[#C99A4E] px-6 py-2.5 text-sm font-bold text-[#1A140E] hover:bg-[#D9AC62] cursor-pointer"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>Play Again</span>
                </button>
              </div>
            </div>
          )}

          {/* Touch Controls on touch modality */}
          <TouchControls
            visible={modality === 'touch' && !helpOpen && hud.phase === 'active'}
            onJoystickMove={(x, y) => controllerRef.current?.setTouchJoystick(x, y)}
            onAttack={() => controllerRef.current?.pulseTouchAction('attack')}
            onSkill={() => controllerRef.current?.pulseTouchAction('skill')}
            onTrap={() => controllerRef.current?.pulseTouchAction('trap')}
            onInteract={() => controllerRef.current?.pulseTouchAction('interact')}
          />
        </>
      )}

      <SystemToastStack notices={notices} onDismiss={dismissNotice} />
      <HelpModal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        controllerBrand={controllerBrand}
        controllerConnected={controllerConnected}
      />
    </div>
  );
}
