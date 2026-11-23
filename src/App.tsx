import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Anchor,
  Cloud,
  CloudLightning,
  CloudRain,
  Crosshair,
  Flame,
  Gamepad2,
  Hand,
  HelpCircle,
  Play,
  RotateCcw,
  Shield,
  ShieldAlert,
  SlidersHorizontal,
  Sun,
  Trophy,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { DISPLAY_DESCRIPTION, DISPLAY_NAME, DISPLAY_SUBTITLE } from '../shared/branding';
import { ENGINE, type QualityPresetName, type RoomPhase, type WeatherKind } from '../shared/engine';
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
  pipColor: string;
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
  phase: RoomPhase;
  winnerTeamId: string;
  timeRemainingSec: number;
  myTeamId: string;
  landed: boolean;
  boatId: string;
  weatherKind: WeatherKind;
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
  phase: 'dock',
  winnerTeamId: '',
  timeRemainingSec: ENGINE.matchDurationSec,
  myTeamId: 'team_0',
  landed: false,
  boatId: '',
  weatherKind: ENGINE.defaultWeatherKind,
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

const TEAM_PIP_HEX: readonly string[] = [
  '#B84A38', // team_0: Weathered Rust Ember
  '#3A739C', // team_1: Fjord Slate Blue
  '#4D7B4A', // team_2: Pine Moss
  '#B58E3B', // team_3: Burnished Ochre
  '#7D4E86', // team_4: Heather Plum
];

function formatClock(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem.toString().padStart(2, '0')}`;
}

function teamLabel(teamId: string): string {
  if (teamId === 'team_0') return 'Ember';
  if (teamId === 'team_1') return 'Fjord';
  if (teamId === 'draw') return 'Draw';
  return teamId.replace('team_', 'Squad ');
}

function teamPipColor(teamId: string): string {
  const idx = Number(teamId.replace('team_', ''));
  if (Number.isInteger(idx) && idx >= 0 && idx < TEAM_PIP_HEX.length) {
    return TEAM_PIP_HEX[idx];
  }
  return TEAM_PIP_HEX[0];
}

function phaseLabel(phase: RoomPhase): string {
  switch (phase) {
    case 'dock':
      return 'Marina Gathering';
    case 'boarding':
      return 'Board Squad Boat';
    case 'sailing':
      return 'Sailing to Shore';
    case 'landing':
      return 'Landing on Coast';
    case 'match':
      return 'Match Live';
    case 'ended':
      return 'Match Complete';
  }
}

function WeatherIcon({ kind }: { kind: WeatherKind }) {
  if (kind === 'clear') return <Sun className="h-3.5 w-3.5 text-[#D8B468]" />;
  if (kind === 'rain') return <CloudRain className="h-3.5 w-3.5 text-[#8AB0C6]" />;
  if (kind === 'storm') return <CloudLightning className="h-3.5 w-3.5 text-[#C89C56]" />;
  return <Cloud className="h-3.5 w-3.5 text-[#9EA7AC]" />;
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
  const [quality, setQuality] = useState<QualityPresetName>(ENGINE.defaultQuality);
  const [audioEnabled, setAudioEnabled] = useState(true);
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

  const handleQualityChange = useCallback((next: QualityPresetName) => {
    setQuality(next);
    sceneRef.current?.setQualityPreset(next);
  }, []);

  const handleToggleAudio = useCallback(() => {
    setAudioEnabled((prev) => {
      const next = !prev;
      sceneRef.current?.setAudioEnabled(next);
      return next;
    });
  }, []);

  const handleBoardBoat = useCallback(() => {
    connectionRef.current?.sendBoardBoat();
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

      const scene = new IslandScene(canvas, conn, controller, {
        quality,
        audioEnabled,
      });
      sceneRef.current = scene;

      setStarted(true);
      pushNotice(
        'info',
        `Docked at ${DISPLAY_NAME}`,
        'Board your squad longboat at the marina to sail ashore and fortify your base.',
      );
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : 'Unable to connect to match server');
    } finally {
      setJoining(false);
    }
  }, [audioEnabled, pushNotice, quality, teardownMatch]);

  useEffect(() => {
    return () => {
      void teardownMatch();
    };
  }, [teardownMatch]);

  // Read-only HUD mirror of authoritative Colyseus state (React never owns sim state)
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
            pipColor: teamPipColor(base.teamId),
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

      const phase = (state.phase || 'dock') as RoomPhase;
      const weatherKind = (state.weather?.kind || ENGINE.defaultWeatherKind) as WeatherKind;

      let contextPrompt: string | null = null;
      if (self && self.alive && phase === 'boarding' && !self.boatId) {
        contextPrompt = 'Board Squad Longboat';
      } else if (self && self.alive && phase === 'match') {
        const pose = conn.getLocalPose() ?? self;
        if (state.crates) {
          for (const crate of state.crates.values()) {
            if (crate.opened) continue;
            if (Math.hypot(crate.x - pose.x, crate.z - pose.z) <= ENGINE.crateInteractRange) {
              contextPrompt = `Open Tier ${crate.tier} Crate`;
              break;
            }
          }
        }
        if (!contextPrompt && state.bases) {
          const ownBase = state.bases.get(self.teamId);
          if (ownBase) {
            for (const sock of ownBase.sockets.values()) {
              if (sock.tier >= ENGINE.maxBaseTier) continue;
              if (Math.hypot(sock.x - pose.x, sock.z - pose.z) <= ENGINE.baseBuildRange) {
                contextPrompt = `Fortify ${sock.type.replace('_', ' ')} (Tier ${sock.tier + 1})`;
                break;
              }
            }
          }
        }
      }

      setHud({
        connected: true,
        phase,
        winnerTeamId: state.winnerTeamId || '',
        timeRemainingSec: state.matchTimeRemaining ?? ENGINE.matchDurationSec,
        myTeamId: self?.teamId ?? 'team_0',
        landed: self?.landed ?? false,
        boatId: self?.boatId ?? '',
        weatherKind,
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
    <div className="relative h-screen w-screen overflow-hidden bg-[var(--hud-bg-deep)] text-[var(--hud-text)]">
      {/* Pure Babylon.js 3D Canvas */}
      <canvas ref={canvasRef} className="block h-full w-full touch-none outline-none" />

      {/* Landing Overlay */}
      {!started && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-gradient-to-b from-[#11191E]/92 via-[#121619]/92 to-[#0D1012]/96 p-6">
          <div className="w-full max-w-xl rounded-md border border-[var(--hud-panel-border)] bg-[var(--hud-panel-bg-strong)] p-8 shadow-2xl backdrop-blur-md">
            <div className="flex items-center gap-4">
              <img
                src="/assets/ui/battle_island_crest.jpg"
                alt={DISPLAY_NAME}
                className="h-14 w-14 rounded border border-[var(--hud-panel-border)] object-cover"
              />
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--hud-accent)]">
                  {DISPLAY_SUBTITLE}
                </p>
                <h1 className="mt-1 font-[var(--font-display)] text-4xl font-bold tracking-tight text-[#F2ECE0]">
                  {DISPLAY_NAME}
                </h1>
              </div>
            </div>

            <p className="mt-5 text-sm leading-relaxed text-[var(--hud-text-muted)]">
              {DISPLAY_DESCRIPTION}
            </p>

            {/* Explicit Quality Preset & Ocean Audio Controls */}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-y border-[var(--hud-panel-border)] py-3.5 text-xs">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-3.5 w-3.5 text-[var(--hud-accent)]" />
                <span className="uppercase tracking-wider text-[var(--hud-text-muted)]">
                  Graphics
                </span>
                <div className="flex overflow-hidden rounded border border-[var(--hud-panel-border)]">
                  {(['low', 'medium', 'high'] as const).map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => handleQualityChange(q)}
                      className={`px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide transition cursor-pointer ${
                        quality === q
                          ? 'bg-[#C99A4E] text-[#141719]'
                          : 'bg-transparent text-[var(--hud-text-muted)] hover:text-[var(--hud-text)]'
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={handleToggleAudio}
                className="flex items-center gap-1.5 rounded border border-[var(--hud-panel-border)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--hud-text)] hover:border-[var(--hud-accent)] cursor-pointer"
              >
                {audioEnabled ? (
                  <Volume2 className="h-3.5 w-3.5 text-[var(--hud-accent)]" />
                ) : (
                  <VolumeX className="h-3.5 w-3.5 text-[var(--hud-text-muted)]" />
                )}
                <span>Ocean Audio {audioEnabled ? 'On' : 'Off'}</span>
              </button>
            </div>

            {connectError && (
              <div className="mt-4 rounded border border-[#96423A] bg-[#361A18]/85 px-4 py-3 text-xs text-[#F2C3BD]">
                {connectError}
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={joining}
                onClick={() => void startMatch()}
                className="flex items-center gap-2 rounded border border-[#DFB56A] bg-[#C99A4E] px-6 py-2.5 text-sm font-bold text-[#141719] shadow-lg transition hover:bg-[#D7AA60] disabled:opacity-60 cursor-pointer"
              >
                <Play className="h-4 w-4 fill-current" />
                <span>{joining ? 'Launching Marina...' : 'Enter Island'}</span>
              </button>

              <button
                type="button"
                onClick={() => setHelpOpen(true)}
                className="flex items-center gap-2 rounded border border-[var(--hud-panel-border)] bg-[var(--hud-panel-bg)] px-5 py-2.5 text-sm font-semibold text-[var(--hud-text)] transition hover:border-[var(--hud-accent)] cursor-pointer"
              >
                <HelpCircle className="h-4 w-4 text-[var(--hud-accent)]" />
                <span>Controls</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live Match Minimal Translucent HUD */}
      {started && (
        <>
          <div className="pointer-events-none fixed inset-x-0 top-3 z-20 flex items-start justify-between gap-2 px-4">
            {/* Compact Title + Squad Pip */}
            <div className="pointer-events-auto flex items-center gap-2.5 rounded border border-[var(--hud-panel-border)] bg-[var(--hud-panel-bg)] px-3 py-1.5 backdrop-blur-md">
              <img
                src="/assets/ui/battle_island_crest.jpg"
                alt=""
                className="h-7 w-7 rounded-xs border border-[var(--hud-panel-border)] object-cover"
              />
              <div>
                <p className="font-[var(--font-display)] text-xs font-bold tracking-wider text-[#F2ECE0]">
                  {DISPLAY_NAME}
                </p>
                <div className="flex items-center gap-1.5 text-[11px] text-[var(--hud-text-muted)]">
                  <span
                    className="inline-block h-2 w-2 rounded-xs"
                    style={{ backgroundColor: teamPipColor(hud.myTeamId) }}
                  />
                  <span>{teamLabel(hud.myTeamId)}</span>
                </div>
              </div>
            </div>

            {/* Top Scoreboard (Minimal, team color pip only) */}
            <div
              data-hud-scoreboard
              className="flex items-center gap-3 rounded border border-[var(--hud-panel-border)] bg-[var(--hud-panel-bg)] px-4 py-1.5 shadow-lg backdrop-blur-md"
            >
              {hud.teams.map((t, idx) => (
                <React.Fragment key={t.teamId}>
                  {idx > 0 && <div className="h-6 w-px bg-[var(--hud-panel-border)]" />}
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-xs"
                      style={{ backgroundColor: t.pipColor }}
                    />
                    <div className="leading-tight">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--hud-text-muted)]">
                        {t.label}
                      </p>
                      <p className="font-mono text-sm font-bold tabular-nums text-[#F2ECE0]">
                        {t.points}
                        <span className="ml-1 text-[10px] font-normal text-[var(--hud-text-muted)]">
                          /{ENGINE.winScoreThreshold}
                        </span>
                      </p>
                    </div>
                  </div>
                </React.Fragment>
              ))}

              <div className="h-6 w-px bg-[var(--hud-panel-border)]" />

              <div className="text-center leading-tight">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--hud-accent)]">
                  {hud.phase === 'match' ? 'Clock' : phaseLabel(hud.phase)}
                </p>
                <p className="font-mono text-sm font-bold tabular-nums text-[#F2ECE0]">
                  {formatClock(hud.timeRemainingSec)}
                </p>
              </div>

              <div className="hidden h-6 w-px bg-[var(--hud-panel-border)] sm:block" />

              <div
                className="hidden items-center gap-1.5 text-[11px] uppercase tracking-wider text-[var(--hud-text-muted)] sm:flex"
                title={`Weather: ${hud.weatherKind}`}
              >
                <WeatherIcon kind={hud.weatherKind} />
                <span>{hud.weatherKind}</span>
              </div>
            </div>

            {/* Top-right Utility Controls (Quality, Audio, Controller, Help) */}
            <div className="pointer-events-auto flex items-center gap-1.5">
              <div className="hidden overflow-hidden rounded border border-[var(--hud-panel-border)] bg-[var(--hud-panel-bg)] backdrop-blur-md md:flex">
                {(['low', 'medium', 'high'] as const).map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => handleQualityChange(q)}
                    className={`px-2 py-1.5 text-[10px] font-semibold uppercase cursor-pointer ${
                      quality === q
                        ? 'bg-[#C99A4E] text-[#141719]'
                        : 'text-[var(--hud-text-muted)] hover:text-[var(--hud-text)]'
                    }`}
                  >
                    {q[0].toUpperCase()}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handleToggleAudio}
                className="flex h-8 w-8 items-center justify-center rounded border border-[var(--hud-panel-border)] bg-[var(--hud-panel-bg)] text-[var(--hud-text)] backdrop-blur-md hover:border-[var(--hud-accent)] cursor-pointer"
                aria-label="Toggle ocean audio"
                title={audioEnabled ? 'Mute Ocean Audio' : 'Enable Ocean Audio'}
              >
                {audioEnabled ? (
                  <Volume2 className="h-3.5 w-3.5 text-[var(--hud-accent)]" />
                ) : (
                  <VolumeX className="h-3.5 w-3.5 text-[var(--hud-text-muted)]" />
                )}
              </button>

              {controllerConnected && (
                <div className="flex h-8 items-center gap-1.5 rounded border border-[var(--hud-panel-border)] bg-[var(--hud-panel-bg)] px-2.5 text-[11px] text-[var(--hud-accent)] backdrop-blur-md">
                  <Gamepad2 className="h-3.5 w-3.5" />
                  <span className="hidden lg:inline">{glyphs.brandLabel}</span>
                </div>
              )}

              <button
                type="button"
                onClick={() => setHelpOpen(true)}
                className="flex h-8 w-8 items-center justify-center rounded border border-[var(--hud-panel-border)] bg-[var(--hud-panel-bg)] text-[var(--hud-text)] backdrop-blur-md hover:border-[var(--hud-accent)] cursor-pointer"
                aria-label="Open controls help"
              >
                <HelpCircle className="h-3.5 w-3.5 text-[var(--hud-accent)]" />
              </button>
            </div>
          </div>

          {/* Pre-match Marina / Boarding / Sailing Phase Banner */}
          {hud.phase !== 'match' && hud.phase !== 'ended' && (
            <div className="pointer-events-none fixed inset-x-0 top-16 z-20 flex justify-center px-4">
              <div className="pointer-events-auto flex items-center gap-3 rounded border border-[var(--hud-panel-border)] bg-[var(--hud-panel-bg-strong)] px-4 py-2 text-xs shadow-xl backdrop-blur-md">
                <Anchor className="h-4 w-4 text-[var(--hud-accent)]" />
                <span className="font-semibold tracking-wide text-[#F2ECE0]">
                  {phaseLabel(hud.phase)}
                </span>
                {hud.phase === 'boarding' && !hud.boatId && (
                  <button
                    type="button"
                    onClick={handleBoardBoat}
                    className="rounded border border-[#DFB56A] bg-[#C99A4E] px-2.5 py-1 text-[11px] font-bold text-[#141719] hover:bg-[#D8AA60] cursor-pointer"
                  >
                    Board Boat [{interactHint}]
                  </button>
                )}
                {hud.phase === 'boarding' && hud.boatId && (
                  <span className="text-[11px] text-[#8AB88A]">Aboard — preparing departure</span>
                )}
              </div>
            </div>
          )}

          {/* Contextual Interact Prompt (Crates / Base Sockets / Boat Boarding) */}
          {hud.contextPrompt && (hud.phase === 'match' || hud.phase === 'boarding') && (
            <div className="pointer-events-none fixed inset-x-0 bottom-28 z-20 flex justify-center px-4">
              <div className="flex items-center gap-2 rounded border border-[var(--hud-panel-border-active)] bg-[var(--hud-panel-bg-strong)] px-3.5 py-1.5 text-xs font-semibold text-[#F2ECE0] shadow-xl backdrop-blur-md">
                <Hand className="h-3.5 w-3.5 text-[var(--hud-accent)]" />
                <span>
                  Press <span className="font-mono text-[#E8C078]">{interactHint}</span> —{' '}
                  {hud.contextPrompt}
                </span>
              </div>
            </div>
          )}

          {/* Respawn Banner */}
          {!hud.alive && hud.phase === 'match' && (
            <div className="pointer-events-none fixed inset-0 z-20 flex items-center justify-center">
              <div className="rounded border border-[#8E3C34] bg-[var(--hud-panel-bg-strong)] px-6 py-4 text-center shadow-2xl backdrop-blur-md">
                <p className="font-[var(--font-display)] text-lg font-bold text-[#F0CBC6]">
                  Tagged Out
                </p>
                <p className="mt-1 text-xs text-[var(--hud-text-muted)]">
                  Returning to your squad base...
                </p>
              </div>
            </div>
          )}

          {/* Compact Bottom-Center Fortnite-Style Translucent Hotbar */}
          <div className="pointer-events-none fixed inset-x-0 bottom-3 z-20 flex justify-center px-4">
            <div
              data-hud-hotbar
              className="flex w-full max-w-xl flex-col gap-2 rounded border border-[var(--hud-panel-border)] bg-[var(--hud-panel-bg)] px-3.5 py-2.5 shadow-2xl backdrop-blur-md"
            >
              {/* Compact Health + Shield Strip */}
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center justify-between text-[11px] font-semibold">
                    <span className="font-mono tabular-nums text-[#F2ECE0]">
                      HP {hud.hp}/{hud.maxHp}
                    </span>
                    {hud.shieldHp > 0 && (
                      <span className="flex items-center gap-1 font-mono tabular-nums text-[#7BC4DE]">
                        <Shield className="h-3 w-3" />
                        {hud.shieldHp}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-xs bg-[#262B2E]">
                    <div
                      className="h-full bg-[#5C8E54] transition-all duration-150"
                      style={{
                        width: `${Math.max(0, Math.min(100, (hud.hp / Math.max(1, hud.maxHp)) * 100))}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Hotbar Slots */}
              <div className="flex flex-wrap items-center justify-center gap-1.5 text-xs">
                {hud.weapons.map((w, idx) => (
                  <div
                    key={`w_${idx}`}
                    className={`flex items-center gap-1.5 rounded-xs border px-2.5 py-1 ${
                      idx === hud.activeWeaponIndex
                        ? 'border-[var(--hud-panel-border-active)] bg-[#2A261E]/90 text-[#F2ECE0]'
                        : 'border-[var(--hud-panel-border)] bg-[#14171A]/80 text-[var(--hud-text-muted)]'
                    }`}
                  >
                    <span className="font-mono text-[10px] text-[var(--hud-text-muted)]">
                      {idx + 1}
                    </span>
                    <Crosshair className="h-3 w-3 text-[var(--hud-accent)]" />
                    <span className="font-semibold">{w.name}</span>
                    <span className="font-mono text-[10px] text-[var(--hud-accent)]">
                      Lv.{w.level}
                    </span>
                  </div>
                ))}

                {hud.skills[0] && (
                  <div className="flex items-center gap-1.5 rounded-xs border border-[var(--hud-panel-border)] bg-[#14171A]/80 px-2.5 py-1 text-[var(--hud-text)]">
                    <Flame className="h-3 w-3 text-[#C8844A]" />
                    <span>{hud.skills[0].name}</span>
                    <span className="font-mono text-[10px] text-[var(--hud-text-muted)]">
                      [{skillHint}]
                    </span>
                  </div>
                )}

                {hud.traps[0] && (
                  <div className="flex items-center gap-1.5 rounded-xs border border-[var(--hud-panel-border)] bg-[#14171A]/80 px-2.5 py-1 text-[var(--hud-text)]">
                    <ShieldAlert className="h-3 w-3 text-[#B95B4A]" />
                    <span>{hud.traps[0].name}</span>
                    <span className="font-mono text-[10px] text-[var(--hud-text-muted)]">
                      [{trapHint}]
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Match End Overlay */}
          {hud.phase === 'ended' && (
            <div
              data-gamepad-scope="modal"
              className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
            >
              <div className="w-full max-w-md rounded border border-[var(--hud-panel-border-active)] bg-[var(--hud-panel-bg-strong)] p-7 text-center shadow-2xl">
                <Trophy className="mx-auto h-10 w-10 text-[#DFB56A]" />
                <p className="mt-2 text-xs font-semibold uppercase tracking-widest text-[var(--hud-accent)]">
                  Match Complete
                </p>
                <h2 className="mt-1 font-[var(--font-display)] text-3xl font-bold text-[#F2ECE0]">
                  {hud.winnerTeamId === 'draw'
                    ? 'Island Draw'
                    : `${teamLabel(hud.winnerTeamId)} Squad Wins`}
                </h2>
                <div className="mt-4 space-y-2 rounded border border-[var(--hud-panel-border)] bg-[#14171A] p-4">
                  {hud.teams.map((t) => (
                    <div key={t.teamId} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 font-semibold text-[var(--hud-text)]">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-xs"
                          style={{ backgroundColor: t.pipColor }}
                        />
                        {t.label}
                      </span>
                      <span className="font-mono font-bold text-[#E8C078]">{t.points} pts</span>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => void startMatch()}
                  className="mt-6 inline-flex items-center gap-2 rounded border border-[#DFB56A] bg-[#C99A4E] px-6 py-2.5 text-sm font-bold text-[#141719] hover:bg-[#D9AC62] cursor-pointer"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>Sail Again</span>
                </button>
              </div>
            </div>
          )}

          {/* Touch Controls on touch modality */}
          <TouchControls
            visible={
              modality === 'touch' &&
              !helpOpen &&
              (hud.phase === 'match' || hud.phase === 'dock' || hud.phase === 'boarding')
            }
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
