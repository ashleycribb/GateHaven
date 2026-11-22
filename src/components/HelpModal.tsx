import React, { useState } from 'react';
import {
  X,
  Volume2,
  VolumeX,
  Smartphone,
  Tag,
  Gamepad2,
  Keyboard,
  Vibrate,
} from 'lucide-react';
import { ControllerBrand, getGamepadGlyphs, InputModality } from '../input/gamepadManager';

interface HelpModalProps {
  soundEnabled: boolean;
  touchControlsEnabled: boolean;
  showOverheadLabels: boolean;
  controllerConnected: boolean;
  controllerBrand: ControllerBrand;
  controllerId: string;
  supportsRumble: boolean;
  inputMode: InputModality;
  onTestRumble: () => void;
  onToggleSound: () => void;
  onToggleTouchControls: () => void;
  onToggleOverheadLabels: () => void;
  onClose: () => void;
}

type HelpTab = 'settings' | 'controller';

export const HelpModal: React.FC<HelpModalProps> = ({
  soundEnabled,
  touchControlsEnabled,
  showOverheadLabels,
  controllerConnected,
  controllerBrand,
  controllerId,
  supportsRumble,
  inputMode,
  onTestRumble,
  onToggleSound,
  onToggleTouchControls,
  onToggleOverheadLabels,
  onClose,
}) => {
  const [tab, setTab] = useState<HelpTab>(inputMode === 'gamepad' ? 'controller' : 'settings');
  const glyphs = getGamepadGlyphs(controllerBrand);

  const playControllerRows = [
    { action: 'Move', xbox: 'Left Stick', ps: 'Left Stick' },
    { action: 'Look / Camera', xbox: 'Right Stick', ps: 'Right Stick' },
    { action: 'Jump / Swim', xbox: 'A', ps: 'Cross (✕)' },
    { action: 'Interact (same as E)', xbox: 'X', ps: 'Square (□)' },
    { action: 'Dodge / Cancel / Back', xbox: 'B', ps: 'Circle (○)' },
    { action: 'Attack (Melee / Mine)', xbox: 'RT', ps: 'R2' },
    { action: 'Aim / Block Guard', xbox: 'LT (Hold)', ps: 'L2 (Hold)' },
    { action: 'Open / Close Skill Strip', xbox: 'Y', ps: 'Triangle (△)' },
    { action: 'Cycle Hotbar & Skills', xbox: 'LB / RB', ps: 'L1 / R1' },
    { action: 'Select Hotbar / Cast Skill', xbox: 'D-Pad', ps: 'D-Pad' },
    { action: 'Pause / Settings Menu', xbox: 'Start', ps: 'Options' },
    { action: 'Open System Window', xbox: 'Back / Select', ps: 'Share / Create' },
  ];

  const createControllerRows = [
    { action: 'Fly Horizontally', xbox: 'Left Stick', ps: 'Left Stick' },
    { action: 'Look / Aim Cursor', xbox: 'Right Stick', ps: 'Right Stick' },
    { action: 'Fly Up / Fly Down', xbox: 'A / B', ps: '✕ / ○' },
    { action: 'Paint Block', xbox: 'RT', ps: 'R2' },
    { action: 'Erase Block', xbox: 'LT', ps: 'L2' },
    { action: 'Toggle Brush Size (1×1 / 3×3)', xbox: 'LB / RB', ps: 'L1 / R1' },
    { action: 'Pick Block Palette', xbox: 'D-Pad', ps: 'D-Pad' },
    { action: 'Cycle Paint / Erase / Fill', xbox: 'Y', ps: 'Triangle (△)' },
    { action: 'Undo Last Stroke', xbox: 'X', ps: 'Square (□)' },
  ];

  const menuControllerRows = [
    { action: 'Navigate Buttons & Lists', xbox: 'D-Pad / L Stick', ps: 'D-Pad / L Stick' },
    { action: 'Confirm / Select', xbox: 'A', ps: 'Cross (✕)' },
    { action: 'Back / Close Dialog', xbox: 'B', ps: 'Circle (○)' },
    { action: 'Switch Modal Tabs', xbox: 'LB / RB', ps: 'L1 / R1' },
  ];

  return (
    <div
      data-gamepad-scope="modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0D0A08]/80 p-4"
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-[#65523D] bg-[#1C1713] text-[#EDE2CC] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#46392C] bg-[#231C16] px-6 py-4">
          <div>
            <h2 className="font-[var(--font-display)] text-xl font-bold text-[#F3E9D6]">
              Settings, Controls &amp; Guide
            </h2>
            <p className="text-xs text-[#B9AA92]">
              Keyboard/Mouse, Xbox &amp; PlayStation Controller, Touch, Labels &amp; Adventure Rules
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#BFB098] hover:bg-[#322820] hover:text-[#F3E9D6] cursor-pointer"
            aria-label="Close Settings and Controls"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs (LB / RB switchable) */}
        <div className="flex items-center gap-2 border-b border-[#46392C] bg-[#1F1914] px-6 py-2.5">
          <button
            type="button"
            data-modal-tab="true"
            data-active={tab === 'settings' ? 'true' : 'false'}
            onClick={() => setTab('settings')}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
              tab === 'settings'
                ? 'border-[#C99A4E] bg-[#3A2C1D] text-[#F6E9CE]'
                : 'border-[#4D3F31] bg-[#241D17] text-[#C4B59C] hover:bg-[#2F261E]'
            }`}
          >
            <Keyboard className="h-3.5 w-3.5" />
            Settings &amp; Keyboard
          </button>
          <button
            type="button"
            data-modal-tab="true"
            data-active={tab === 'controller' ? 'true' : 'false'}
            onClick={() => setTab('controller')}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
              tab === 'controller'
                ? 'border-[#C99A4E] bg-[#3A2C1D] text-[#F6E9CE]'
                : 'border-[#4D3F31] bg-[#241D17] text-[#C4B59C] hover:bg-[#2F261E]'
            }`}
          >
            <Gamepad2 className="h-3.5 w-3.5" />
            Controller Layout
          </button>
          {inputMode === 'gamepad' && (
            <span className="ml-auto hidden sm:inline text-[11px] text-[#B8A990]">
              [{glyphs.lb}/{glyphs.rb}] Switch Tab
            </span>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {tab === 'settings' ? (
            <>
              {/* Quick Settings */}
              <div className="rounded-xl border border-[#4E4032] bg-[#241D17] p-3.5 space-y-2.5">
                <p className="text-xs font-bold text-[#E9DBC3]">Display &amp; Audio Settings</p>
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={onToggleOverheadLabels}
                    className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                      showOverheadLabels
                        ? 'border-[#C99A4E]/80 bg-[#36291B] text-[#F4E7CE] hover:bg-[#433322]'
                        : 'border-[#544536] bg-[#1E1813] text-[#C4B59C] hover:bg-[#2A221B]'
                    }`}
                  >
                    <Tag
                      className={`h-4 w-4 ${showOverheadLabels ? 'text-[#D4A65C]' : 'text-[#8F816C]'}`}
                    />
                    Overhead Labels (People &amp; Objects): {showOverheadLabels ? 'On' : 'Off'}
                  </button>

                  <button
                    type="button"
                    onClick={onToggleSound}
                    className="inline-flex items-center gap-2 rounded-lg border border-[#544536] bg-[#1E1813] px-3.5 py-2 text-xs font-semibold text-[#E8DCC5] hover:bg-[#2A221B] cursor-pointer"
                  >
                    {soundEnabled ? (
                      <Volume2 className="h-4 w-4 text-[#8FB37C]" />
                    ) : (
                      <VolumeX className="h-4 w-4 text-[#8F816C]" />
                    )}
                    Sound Effects: {soundEnabled ? 'On' : 'Muted'}
                  </button>

                  <button
                    type="button"
                    onClick={onToggleTouchControls}
                    className="inline-flex items-center gap-2 rounded-lg border border-[#544536] bg-[#1E1813] px-3.5 py-2 text-xs font-semibold text-[#E8DCC5] hover:bg-[#2A221B] cursor-pointer"
                  >
                    <Smartphone className="h-4 w-4 text-[#CBB58D]" />
                    Touch Controls: {touchControlsEnabled ? 'Shown' : 'Auto (Mobile)'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Play Mode Controls */}
                <div className="rounded-xl border border-[#4E4032] bg-[#221C16] p-4">
                  <h3 className="font-[var(--font-display)] text-sm font-bold text-[#D9AD62]">
                    Play Mode (Keyboard &amp; Mouse)
                  </h3>
                  <dl className="mt-3 space-y-2 text-xs">
                    <div className="flex justify-between gap-2">
                      <dt className="font-semibold text-[#E7DAC3]">Move / Sprint</dt>
                      <dd className="font-mono text-[#BCAE97]">W A S D + Shift</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="font-semibold text-[#E7DAC3]">Jump / Swim</dt>
                      <dd className="font-mono text-[#BCAE97]">Space</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="font-semibold text-[#E7DAC3]">Melee / Mine / Click NPC</dt>
                      <dd className="font-mono text-[#BCAE97]">Left Click</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="font-semibold text-[#E7DAC3]">Place Fine Block</dt>
                      <dd className="font-mono text-[#BCAE97]">Right Click / Key F</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="font-semibold text-[#E7DAC3]">Interact (NPC/Portal/Chest)</dt>
                      <dd className="font-mono text-[#BCAE97]">Key E</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="font-semibold text-[#E7DAC3]">Bow / Firebolt / Mend / Tame</dt>
                      <dd className="font-mono text-[#BCAE97]">R / G / C / Y</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="font-semibold text-[#E7DAC3]">Inspect Target (Skill)</dt>
                      <dd className="font-mono text-[#BCAE97]">Key I</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="font-semibold text-[#E7DAC3]">1st / 3rd Person View</dt>
                      <dd className="font-mono text-[#BCAE97]">Key V</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="font-semibold text-[#E7DAC3]">Cycle Day / Night</dt>
                      <dd className="font-mono text-[#BCAE97]">Key T</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="font-semibold text-[#E7DAC3]">Expand World / Dungeon Map</dt>
                      <dd className="font-mono text-[#BCAE97]">Key M / Tab</dd>
                    </div>
                  </dl>
                </div>

                {/* Create Mode Controls */}
                <div className="rounded-xl border border-[#4E4032] bg-[#221C16] p-4">
                  <h3 className="font-[var(--font-display)] text-sm font-bold text-[#9FC08D]">
                    Create Mode (Fine-Block Editor)
                  </h3>
                  <dl className="mt-3 space-y-2 text-xs">
                    <div className="flex justify-between gap-2">
                      <dt className="font-semibold text-[#E7DAC3]">Fly Horizontally</dt>
                      <dd className="font-mono text-[#BCAE97]">W A S D / Arrows</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="font-semibold text-[#E7DAC3]">Fly Up / Down</dt>
                      <dd className="font-mono text-[#BCAE97]">Space / C</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="font-semibold text-[#E7DAC3]">Paint / Erase / Fill</dt>
                      <dd className="font-mono text-[#BCAE97]">Left Click</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="font-semibold text-[#E7DAC3]">Quick Secondary Tool</dt>
                      <dd className="font-mono text-[#BCAE97]">Right Click</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="font-semibold text-[#E7DAC3]">20 Fine Blocks</dt>
                      <dd className="font-mono text-[#BCAE97]">Bottom Dock / Keys</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="font-semibold text-[#E7DAC3]">Undo / Redo (50 steps)</dt>
                      <dd className="font-mono text-[#BCAE97]">Ctrl+Z / Ctrl+Shift+Z</dd>
                    </div>
                  </dl>
                </div>
              </div>

              {/* Adventure Rules Summary */}
              <div className="rounded-xl border border-[#5A4B3A] bg-[#241E18] p-4 space-y-1.5 text-xs text-[#CFC2AA]">
                <h3 className="font-[var(--font-display)] text-sm font-bold text-[#F3E9D6]">
                  Adventure Rules, Skills &amp; Portals
                </h3>
                <p>
                  <strong className="text-[#EDE2CC]">No Class at Start:</strong> Play your way until
                  Level 5. Your melee hits, spells, arrows, heals, builds, and animal bonds shape a
                  recommended class (Warrior, Mage, Ranger, Rogue, Cleric, Artificer, or Tamer).
                </p>
                <p>
                  <strong className="text-[#EDE2CC]">Earnable Inspect Skill [I]:</strong> Visit Lyra
                  the Village Mage in Elderglen to learn <em>Inspect</em> (10 Gold). Aim at any
                  creature, villager, portal, chest, or material block and press{' '}
                  <span className="font-mono text-[#E0B465]">I</span> to scan stats, drops, and
                  tips.
                </p>
                <p>
                  <strong className="text-[#EDE2CC]">Real Cost of Defeat:</strong> Falling in battle
                  costs 1 Level (above Lv 1), returns you to your Home Spawn, and drops unbound gear
                  at a recoverable Grave marker.
                </p>
                <p>
                  <strong className="text-[#EDE2CC]">Soulbound Gear:</strong> Spend Gold at the
                  Awakening Shrine to Soulbind your favorite gear so it stays with you on defeat and
                  crosses Dimensional Portals.
                </p>
              </div>
            </>
          ) : (
            /* CONTROLLER LAYOUT SCREEN */
            <div className="space-y-4">
              {/* Live Auto-Detection Banner */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#5D4C3A] bg-[#241D17] p-4">
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#F3E9D6]">
                    <Gamepad2 className="h-4 w-4 text-[#D4A65C]" />
                    <span>
                      {controllerConnected
                        ? `Connected: ${glyphs.brandLabel}`
                        : 'No Controller Detected (Plug in or Press Any Button)'}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#B8A990] truncate max-w-md">
                    {controllerConnected
                      ? controllerId
                      : 'Supports Xbox & PlayStation controllers via Standard Gamepad API. HUD hints switch automatically.'}
                  </p>
                  <p className="text-[11px] text-[#9EB08D]">
                    Vibration (Hit / Killing Blow / Death):{' '}
                    {controllerConnected
                      ? supportsRumble
                        ? 'Supported & Active'
                        : 'Not reported by this controller/browser'
                      : 'Activates automatically when supported controller connects'}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={!controllerConnected}
                  onClick={onTestRumble}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#7B6345] bg-[#32271D] px-3.5 py-2 text-xs font-semibold text-[#F1E4CD] hover:bg-[#403225] disabled:opacity-45 cursor-pointer whitespace-nowrap"
                >
                  <Vibrate className="h-3.5 w-3.5 text-[#D4A65C]" />
                  Test Rumble
                </button>
              </div>

              {/* Play Mode Controller Mapping */}
              <div className="rounded-xl border border-[#4E4032] bg-[#221C16] overflow-hidden">
                <div className="border-b border-[#3F3327] bg-[#2A221B] px-4 py-2.5">
                  <h3 className="font-[var(--font-display)] text-sm font-bold text-[#D9AD62]">
                    Play Mode — Standard Controller Mapping
                  </h3>
                </div>
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#3D3126] text-[#B3A48C]">
                      <th className="px-4 py-2 font-semibold">Action</th>
                      <th className="px-4 py-2 font-semibold">Xbox</th>
                      <th className="px-4 py-2 font-semibold">PlayStation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#342A20]">
                    {playControllerRows.map((row) => (
                      <tr key={row.action}>
                        <td className="px-4 py-1.5 font-medium text-[#ECE0CA]">{row.action}</td>
                        <td className="px-4 py-1.5 font-mono text-[#D9AD62]">{row.xbox}</td>
                        <td className="px-4 py-1.5 font-mono text-[#C7B89E]">{row.ps}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Create Mode + Menu Navigation */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-[#4E4032] bg-[#221C16] overflow-hidden">
                  <div className="border-b border-[#3F3327] bg-[#2A221B] px-4 py-2.5">
                    <h3 className="font-[var(--font-display)] text-sm font-bold text-[#9FC08D]">
                      Create Mode
                    </h3>
                  </div>
                  <div className="divide-y divide-[#342A20] px-4 py-1 text-xs">
                    {createControllerRows.map((row) => (
                      <div key={row.action} className="flex items-center justify-between gap-2 py-1.5">
                        <span className="text-[#E6D9C2]">{row.action}</span>
                        <span className="font-mono text-[#CBBBA2] whitespace-nowrap">
                          {row.xbox} / {row.ps}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-[#4E4032] bg-[#221C16] overflow-hidden flex flex-col justify-between">
                  <div>
                    <div className="border-b border-[#3F3327] bg-[#2A221B] px-4 py-2.5">
                      <h3 className="font-[var(--font-display)] text-sm font-bold text-[#E6D6B8]">
                        Menus &amp; Dialogs
                      </h3>
                    </div>
                    <div className="divide-y divide-[#342A20] px-4 py-1 text-xs">
                      {menuControllerRows.map((row) => (
                        <div
                          key={row.action}
                          className="flex items-center justify-between gap-2 py-1.5"
                        >
                          <span className="text-[#E6D9C2]">{row.action}</span>
                          <span className="font-mono text-[#CBBBA2] whitespace-nowrap">
                            {row.xbox} / {row.ps}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <p className="border-t border-[#3F3327] bg-[#1D1712] px-4 py-3 text-[11px] leading-relaxed text-[#B8A990]">
                    Analog sticks include a radial dead zone (17%) to eliminate drift. Switch freely
                    between controller, keyboard/mouse, and touch at any time mid-game.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[#46392C] bg-[#231C16] px-6 py-3">
          <span className="text-[11px] text-[#B4A58D]">
            {inputMode === 'gamepad'
              ? `Controller Active (${glyphs.brandLabel}) · [${glyphs.b}] Close`
              : 'Keyboard / Mouse / Touch ready'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[#C99A4E]/70 bg-[#9C6C30] px-5 py-2 text-xs font-semibold text-[#FDF6E8] hover:bg-[#AE7A39] cursor-pointer"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
