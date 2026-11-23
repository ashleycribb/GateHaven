import React, { useRef, useState } from 'react';
import { Crosshair, Flame, Hand, ShieldAlert } from 'lucide-react';

interface TouchControlsProps {
  visible: boolean;
  onJoystickMove: (x: number, y: number) => void;
  onAttack: () => void;
  onSkill: () => void;
  onTrap: () => void;
  onInteract: () => void;
}

export const TouchControls: React.FC<TouchControlsProps> = ({
  visible,
  onJoystickMove,
  onAttack,
  onSkill,
  onTrap,
  onInteract,
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
        className="pointer-events-auto relative flex h-28 w-28 items-center justify-center rounded-full border-2 border-[#C8B28E]/65 bg-[#1B1612]/72 shadow-lg select-none"
        aria-label="Movement joystick"
      >
        <div
          className="h-12 w-12 rounded-full border border-[#E8D9BE]/85 bg-[#E6D7BC]/88 shadow-md"
          style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }}
        />
      </div>

      <div className="pointer-events-auto flex flex-col items-end gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onInteract}
            className="flex h-12 w-12 flex-col items-center justify-center rounded-full border-2 border-[#D4A65C]/75 bg-[#2A221B]/92 text-[#F3E9D6] shadow-lg active:scale-95"
            aria-label="Loot or Build"
          >
            <Hand className="h-4 w-4 text-[#D4A65C]" />
            <span className="text-[9px] font-bold">Use</span>
          </button>
          <button
            type="button"
            onClick={onTrap}
            className="flex h-12 w-12 flex-col items-center justify-center rounded-full border-2 border-[#BFA882]/75 bg-[#463829]/92 text-[#F3E9D6] shadow-lg active:scale-95"
            aria-label="Place trap"
          >
            <ShieldAlert className="h-4 w-4" />
            <span className="text-[9px] font-bold">Trap</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onSkill}
            className="flex h-13 w-13 flex-col items-center justify-center rounded-full border-2 border-[#C8844A]/75 bg-[#5E371E]/92 text-[#FDF3E3] shadow-lg active:scale-95"
            aria-label="Use skill"
          >
            <Flame className="h-4 w-4" />
            <span className="text-[9px] font-bold">Skill</span>
          </button>
          <button
            type="button"
            onClick={onAttack}
            className="flex h-14 w-14 flex-col items-center justify-center rounded-full border-2 border-[#C47467]/75 bg-[#6E3029]/92 text-[#FDF3E3] shadow-lg active:scale-95"
            aria-label="Attack"
          >
            <Crosshair className="h-5 w-5" />
            <span className="text-[9px] font-bold">Fire</span>
          </button>
        </div>
      </div>
    </div>
  );
};
