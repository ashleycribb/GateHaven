import React, { useRef, useState } from 'react';
import { ArrowUp, Flame, Hammer, Hand, Pickaxe } from 'lucide-react';
import { WorldMode } from '../types/blockhaven';

interface TouchControlsProps {
  visible: boolean;
  worldMode: WorldMode;
  onJoystickMove: (x: number, y: number) => void;
  onJump: () => void;
  onBreak: () => void;
  onPlace: () => void;
  onInteract: () => void;
  onCastSkill: () => void;
}

export const TouchControls: React.FC<TouchControlsProps> = ({
  visible,
  worldMode,
  onJoystickMove,
  onJump,
  onBreak,
  onPlace,
  onInteract,
  onCastSkill,
}) => {
  const padRef = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const touchIdRef = useRef<number | null>(null);

  if (!visible) return null;

  const maxRadius = 38;

  const updateStick = (clientX: number, clientY: number) => {
    const pad = padRef.current;
    if (!pad) return;
    const rect = pad.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxRadius) {
      dx = (dx / dist) * maxRadius;
      dy = (dy / dist) * maxRadius;
    }
    setKnob({ x: dx, y: dy });
    onJoystickMove(dx / maxRadius, dy / maxRadius);
  };

  const resetStick = () => {
    touchIdRef.current = null;
    setKnob({ x: 0, y: 0 });
    onJoystickMove(0, 0);
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-20 flex items-end justify-between px-4 sm:px-6">
      {/* Left Virtual Movement Joystick */}
      <div
        ref={padRef}
        onTouchStart={(e) => {
          e.stopPropagation();
          const t = e.changedTouches[0];
          if (!t) return;
          touchIdRef.current = t.identifier;
          updateStick(t.clientX, t.clientY);
        }}
        onTouchMove={(e) => {
          e.stopPropagation();
          for (let i = 0; i < e.changedTouches.length; i++) {
            const t = e.changedTouches[i];
            if (t.identifier === touchIdRef.current) updateStick(t.clientX, t.clientY);
          }
        }}
        onTouchEnd={(e) => {
          e.stopPropagation();
          for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === touchIdRef.current) resetStick();
          }
        }}
        onTouchCancel={resetStick}
        className="pointer-events-auto relative flex h-28 w-28 items-center justify-center rounded-full border-2 border-white/60 bg-slate-900/60 shadow-lg select-none"
        aria-label="Movement joystick"
      >
        <div
          className="h-12 w-12 rounded-full border border-white/80 bg-white/90 shadow-md"
          style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }}
        />
      </div>

      {/* Right Action Buttons */}
      <div className="pointer-events-auto flex flex-col items-end gap-2">
        {worldMode === 'play' && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onInteract}
              className="flex h-12 w-12 flex-col items-center justify-center rounded-full border-2 border-white/70 bg-sky-600/95 text-white shadow-lg active:scale-95"
              aria-label="Interact"
            >
              <Hand className="h-4 w-4" />
              <span className="text-[9px] font-bold">Use</span>
            </button>
            <button
              type="button"
              onClick={onCastSkill}
              className="flex h-12 w-12 flex-col items-center justify-center rounded-full border-2 border-white/70 bg-orange-600/95 text-white shadow-lg active:scale-95"
              aria-label="Cast skill"
            >
              <Flame className="h-4 w-4" />
              <span className="text-[9px] font-bold">Skill</span>
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBreak}
            className="flex h-13 w-13 flex-col items-center justify-center rounded-full border-2 border-white/70 bg-rose-600/90 text-white shadow-lg active:scale-95"
            aria-label="Attack or break block"
          >
            <Pickaxe className="h-4 w-4" />
            <span className="text-[9px] font-bold">{worldMode === 'play' ? 'Hit' : 'Erase'}</span>
          </button>
          <button
            type="button"
            onClick={onPlace}
            className="flex h-13 w-13 flex-col items-center justify-center rounded-full border-2 border-white/70 bg-blue-600/90 text-white shadow-lg active:scale-95"
            aria-label="Place block"
          >
            <Hammer className="h-4 w-4" />
            <span className="text-[9px] font-bold">Place</span>
          </button>
          <button
            type="button"
            onClick={onJump}
            className="flex h-14 w-14 flex-col items-center justify-center rounded-full border-2 border-white/80 bg-emerald-600/95 text-white shadow-lg active:scale-95"
            aria-label="Jump"
          >
            <ArrowUp className="h-5 w-5" />
            <span className="text-[9px] font-bold">{worldMode === 'create' ? 'Rise' : 'Jump'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
