import React from 'react';
import { Gamepad2, Keyboard, X } from 'lucide-react';
import { DISPLAY_NAME } from '../../shared/branding';
import { getGamepadGlyphs, type ControllerBrand } from '../input/gamepadManager';

interface HelpModalProps {
  open: boolean;
  onClose: () => void;
  controllerBrand: ControllerBrand;
  controllerConnected: boolean;
}

export const HelpModal: React.FC<HelpModalProps> = ({
  open,
  onClose,
  controllerBrand,
  controllerConnected,
}) => {
  if (!open) return null;
  const g = getGamepadGlyphs(controllerBrand);

  return (
    <div
      data-gamepad-scope="modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-2xl rounded-2xl border border-[#6E5B44] bg-[#1D1813]/97 p-6 text-[#EDE2CC] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[#46392B] pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#D4A65C]">
              Field Guide
            </p>
            <h2 className="mt-1 font-[var(--font-display)] text-2xl font-bold text-[#F5ECD9]">
              {DISPLAY_NAME} Controls
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close help"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#5A4B3A] bg-[#29221B] text-[#CFC2AA] hover:text-[#F5ECD9] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-[#493C2E] bg-[#241E18] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#E8C078]">
              <Keyboard className="h-4 w-4" />
              <span>Keyboard & Mouse</span>
            </div>
            <ul className="mt-3 space-y-2 text-xs text-[#D3C6AE]">
              <li className="flex justify-between"><span>Move</span><span className="font-mono text-[#F3E9D6]">W A S D</span></li>
              <li className="flex justify-between"><span>Look / Aim</span><span className="font-mono text-[#F3E9D6]">Drag Mouse</span></li>
              <li className="flex justify-between"><span>Attack</span><span className="font-mono text-[#F3E9D6]">Left Click / F</span></li>
              <li className="flex justify-between"><span>Use Skill</span><span className="font-mono text-[#F3E9D6]">Space / Shift</span></li>
              <li className="flex justify-between"><span>Place Trap</span><span className="font-mono text-[#F3E9D6]">Q</span></li>
              <li className="flex justify-between"><span>Loot Crate / Build Socket</span><span className="font-mono text-[#F3E9D6]">E</span></li>
              <li className="flex justify-between"><span>Switch Weapon</span><span className="font-mono text-[#F3E9D6]">1 / 2</span></li>
            </ul>
          </div>

          <div className="rounded-xl border border-[#493C2E] bg-[#241E18] p-4">
            <div className="flex items-center justify-between text-sm font-semibold text-[#E8C078]">
              <span className="flex items-center gap-2">
                <Gamepad2 className="h-4 w-4" />
                <span>{g.brandLabel}</span>
              </span>
              <span className="text-[11px] font-normal text-[#B6A78E]">
                {controllerConnected ? 'Connected' : 'Ready'}
              </span>
            </div>
            <ul className="mt-3 space-y-2 text-xs text-[#D3C6AE]">
              <li className="flex justify-between"><span>Move</span><span className="font-mono text-[#F3E9D6]">{g.leftStick}</span></li>
              <li className="flex justify-between"><span>Camera Look</span><span className="font-mono text-[#F3E9D6]">{g.rightStick}</span></li>
              <li className="flex justify-between"><span>Attack</span><span className="font-mono text-[#F3E9D6]">{g.rt}</span></li>
              <li className="flex justify-between"><span>Use Skill</span><span className="font-mono text-[#F3E9D6]">{g.y} / {g.a}</span></li>
              <li className="flex justify-between"><span>Place Trap</span><span className="font-mono text-[#F3E9D6]">{g.b}</span></li>
              <li className="flex justify-between"><span>Loot / Build</span><span className="font-mono text-[#F3E9D6]">{g.x}</span></li>
              <li className="flex justify-between"><span>Cycle Weapon</span><span className="font-mono text-[#F3E9D6]">{g.lb} / {g.rb}</span></li>
            </ul>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-[#493C2E] bg-[#241E18]/75 p-4 text-xs leading-relaxed text-[#CFC2AA]">
          <p className="font-semibold text-[#F3E9D6]">How to Win</p>
          <p className="mt-1">
            Claim loot crates around the island and the high-tier center ring, fortify your team base
            sockets, place traps, and tag rivals or breach the opposing base core. First team to reach
            the target score or lead when the match timer finishes wins.
          </p>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[#C99A4E] bg-[#C99A4E]/20 px-5 py-2 text-sm font-semibold text-[#F5ECD9] hover:bg-[#C99A4E]/30 cursor-pointer"
          >
            Back to Island
          </button>
        </div>
      </div>
    </div>
  );
};
