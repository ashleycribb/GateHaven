import React from 'react';
import { X, Volume2, VolumeX, Smartphone, Tag } from 'lucide-react';

interface HelpModalProps {
  soundEnabled: boolean;
  touchControlsEnabled: boolean;
  showOverheadLabels: boolean;
  onToggleSound: () => void;
  onToggleTouchControls: () => void;
  onToggleOverheadLabels: () => void;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({
  soundEnabled,
  touchControlsEnabled,
  showOverheadLabels,
  onToggleSound,
  onToggleTouchControls,
  onToggleOverheadLabels,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="font-[var(--font-display)] text-xl font-bold text-slate-900">
              Settings, Controls &amp; Guide
            </h2>
            <p className="text-xs text-slate-500">
              Voxel RPG Play Mode, Skills, Labels, Portals, Fine-Block Create Mode, and Mobile Touch
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
            aria-label="Close Settings and Controls"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Quick Settings */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2.5">
            <p className="text-xs font-bold text-slate-800">Display &amp; Audio Settings</p>
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={onToggleOverheadLabels}
                className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                  showOverheadLabels
                    ? 'border-sky-300 bg-sky-50 text-sky-900 hover:bg-sky-100'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Tag className={`h-4 w-4 ${showOverheadLabels ? 'text-sky-600' : 'text-slate-400'}`} />
                Overhead Labels (People &amp; Objects): {showOverheadLabels ? 'On' : 'Off'}
              </button>

              <button
                type="button"
                onClick={onToggleSound}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 cursor-pointer"
              >
                {soundEnabled ? (
                  <Volume2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <VolumeX className="h-4 w-4 text-slate-400" />
                )}
                Sound Effects: {soundEnabled ? 'On' : 'Muted'}
              </button>

              <button
                type="button"
                onClick={onToggleTouchControls}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 cursor-pointer"
              >
                <Smartphone className="h-4 w-4 text-blue-600" />
                Touch Controls: {touchControlsEnabled ? 'Shown' : 'Auto (Mobile)'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Play Mode Controls */}
            <div className="rounded-xl border border-slate-200 p-4">
              <h3 className="font-[var(--font-display)] text-sm font-bold text-sky-700">
                Play Mode (Voxel RPG)
              </h3>
              <dl className="mt-3 space-y-2 text-xs">
                <div className="flex justify-between gap-2">
                  <dt className="font-semibold text-slate-800">Move / Sprint</dt>
                  <dd className="font-mono text-slate-600">W A S D + Shift</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="font-semibold text-slate-800">Jump / Swim</dt>
                  <dd className="font-mono text-slate-600">Space</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="font-semibold text-slate-800">Melee / Mine / Click NPC</dt>
                  <dd className="font-mono text-slate-600">Left Click</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="font-semibold text-slate-800">Place Fine Block</dt>
                  <dd className="font-mono text-slate-600">Right Click / Key F</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="font-semibold text-slate-800">Interact (NPC/Portal/Chest)</dt>
                  <dd className="font-mono text-slate-600">Key E</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="font-semibold text-slate-800">Bow / Firebolt / Mend / Tame</dt>
                  <dd className="font-mono text-slate-600">R / G / C / Y</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="font-semibold text-slate-800">Inspect Target (Skill)</dt>
                  <dd className="font-mono text-slate-600">Key I</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="font-semibold text-slate-800">1st / 3rd Person View</dt>
                  <dd className="font-mono text-slate-600">Key V</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="font-semibold text-slate-800">Cycle Day / Night</dt>
                  <dd className="font-mono text-slate-600">Key T</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="font-semibold text-slate-800">Expand World / Dungeon Map</dt>
                  <dd className="font-mono text-slate-600">Key M / Tab</dd>
                </div>
              </dl>
            </div>

            {/* Create Mode Controls */}
            <div className="rounded-xl border border-slate-200 p-4">
              <h3 className="font-[var(--font-display)] text-sm font-bold text-blue-700">
                Create Mode (Fine-Block Editor)
              </h3>
              <dl className="mt-3 space-y-2 text-xs">
                <div className="flex justify-between gap-2">
                  <dt className="font-semibold text-slate-800">Fly Horizontally</dt>
                  <dd className="font-mono text-slate-600">W A S D / Arrows</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="font-semibold text-slate-800">Fly Up / Down</dt>
                  <dd className="font-mono text-slate-600">Space / C</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="font-semibold text-slate-800">Paint / Erase / Fill</dt>
                  <dd className="font-mono text-slate-600">Left Click</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="font-semibold text-slate-800">Quick Secondary Tool</dt>
                  <dd className="font-mono text-slate-600">Right Click</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="font-semibold text-slate-800">20 Fine Blocks</dt>
                  <dd className="font-mono text-slate-600">Bottom Dock / Keys</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="font-semibold text-slate-800">Undo / Redo (50 steps)</dt>
                  <dd className="font-mono text-slate-600">Ctrl+Z / Ctrl+Shift+Z</dd>
                </div>
              </dl>
            </div>
          </div>

          {/* Adventure Rules Summary */}
          <div className="rounded-xl border border-slate-200 bg-sky-50/70 p-4 space-y-1.5 text-xs text-slate-700">
            <h3 className="font-[var(--font-display)] text-sm font-bold text-slate-900">
              Adventure Rules, Skills &amp; Portals
            </h3>
            <p>
              <strong>No Class at Start:</strong> Play your way until Level 5. Your melee hits,
              spells, arrows, heals, builds, and animal bonds shape a recommended class (Warrior,
              Mage, Ranger, Rogue, Cleric, Artificer, or Tamer).
            </p>
            <p>
              <strong>Earnable Inspect Skill [I]:</strong> Visit Lyra the Village Mage in Elderglen
              to learn <em>Inspect</em> (10 Gold). Aim at any creature, villager, portal, chest, or
              material block and press <span className="font-mono">I</span> to scan stats, drops,
              and tips. Using Inspect levels it up to extend range and reveal extra intel.
            </p>
            <p>
              <strong>Real Cost of Defeat:</strong> Falling in battle costs 1 Level (above Lv 1),
              returns you to your Home Spawn, and drops unbound gear at a recoverable Grave marker.
            </p>
            <p>
              <strong>Soulbound Gear:</strong> Spend Gold at the Awakening Shrine to Soulbind your
              favorite gear so it stays with you on defeat and crosses Dimensional Portals into
              Sunscar Desert, Frostveil Tundra, Aether Isles, and Shadowreach.
            </p>
            <p>
              <strong>World Mini-Map &amp; Dungeon Auto-Map:</strong> The overworld mini-map shows
              live terrain, portals, and villagers. Inside dungeons, the map starts dark and
              auto-populates as you walk through procedural rooms—or reveal the entire dungeon at
              once by finding its glowing Map Pedestal or using a Dungeon Map Scroll (sold by Kael
              or at Dungeon Gates).
            </p>
          </div>
        </div>

        <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-900 px-5 py-2 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
