import React, { useState } from 'react';
import { Check, X } from 'lucide-react';
import { CharacterClassId, LearnedSkill, PlaystyleStats } from '../types/blockhaven';
import { CLASS_LIST, suggestClassFromPlaystyle } from '../rpg/rpgData';

interface ClassAwakeningModalProps {
  level: number;
  currentClass: CharacterClassId;
  playstyle: PlaystyleStats;
  skills: LearnedSkill[];
  onSelectClass: (classId: Exclude<CharacterClassId, 'unawakened'>) => void;
  onClose: () => void;
}

export const ClassAwakeningModal: React.FC<ClassAwakeningModalProps> = ({
  level,
  currentClass,
  playstyle,
  skills,
  onSelectClass,
  onClose,
}) => {
  const recommended = suggestClassFromPlaystyle(playstyle, skills) as Exclude<
    CharacterClassId,
    'unawakened'
  >;
  const [selected, setSelected] = useState<Exclude<CharacterClassId, 'unawakened'>>(
    currentClass !== 'unawakened' ? currentClass : recommended,
  );

  const statSummary = [
    { label: 'Melee Hits', value: playstyle.meleeHits },
    { label: 'Magic Casts', value: playstyle.magicCasts },
    { label: 'Bow Shots', value: playstyle.bowShots },
    { label: 'Crits', value: playstyle.stealthCrits },
    { label: 'Heals', value: playstyle.healsDone },
    { label: 'Crafts & Builds', value: playstyle.craftsAndBuilds },
    { label: 'Animal Bonds', value: playstyle.tamesAndAnimals },
  ];

  return (
    <div
      data-gamepad-scope="modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0D0A08]/84 p-4"
    >
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-[#C99A4E]/70 bg-[#1C1713] text-[#EDE2CC] shadow-2xl">
        <div className="flex items-start justify-between border-b border-[#46392C] bg-[#231C16] px-6 py-5">
          <div>
            <p className="text-xs font-semibold tracking-wide text-[#D4A65C]">
              System Evaluation · Level {level} Class Awakening
            </p>
            <h2 className="mt-1 font-[var(--font-display)] text-2xl font-bold text-[#F3E9D6]">
              Choose Your Class
            </h2>
            <p className="mt-1.5 text-sm text-[#CFC2AA]">
              Based on your journey so far, the System recommends{' '}
              <span className="font-bold text-[#E3B86A]">
                {CLASS_LIST.find((c) => c.id === recommended)?.name}
              </span>
              . You may accept the recommendation or pick any class below.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#B8A990] hover:bg-[#322820] hover:text-[#F3E9D6] cursor-pointer"
            aria-label="Close class modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-6">
          {/* Playstyle Analysis Strip */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-[#46392C] pb-3 text-xs text-[#B8A990]">
            <span className="font-semibold text-[#E8DCC5]">Playstyle Log:</span>
            {statSummary.map((s) => (
              <span key={s.label} className="tabular-nums">
                {s.label}: <strong className="text-[#F3E9D6]">{s.value}</strong>
              </span>
            ))}
          </div>

          {/* 7 Classes Grid */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {CLASS_LIST.map((cls) => {
              const isRec = cls.id === recommended;
              const isSelected = cls.id === selected;
              return (
                <button
                  key={cls.id}
                  type="button"
                  onClick={() => setSelected(cls.id as Exclude<CharacterClassId, 'unawakened'>)}
                  className={`flex flex-col rounded-xl border p-4 text-left transition-colors cursor-pointer ${
                    isSelected
                      ? 'border-[#D4A65C] bg-[#30261D]'
                      : 'border-[#4D3F31] bg-[#241D17] hover:border-[#6F5A43]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-[var(--font-display)] text-base font-bold text-[#F3E9D6]">
                      {cls.name}
                    </span>
                    <span className="text-xs font-semibold text-[#D4A65C]">
                      {isRec ? 'Recommended' : cls.title}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-[#CFC2AA]">{cls.description}</p>
                  <p className="mt-2.5 text-xs font-semibold" style={{ color: cls.accentColor }}>
                    {cls.bonusSummary}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-[#46392C] bg-[#231C16] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="whitespace-nowrap rounded-lg border border-[#5B4B3A] bg-[#261F18] px-4 py-2 text-xs font-semibold text-[#D6C8AF] hover:bg-[#332920] cursor-pointer"
          >
            Decide Later
          </button>
          <button
            type="button"
            onClick={() => onSelectClass(selected)}
            className="flex items-center gap-2 whitespace-nowrap rounded-lg border border-[#E2BA72] bg-[#B7833B] px-5 py-2.5 text-sm font-bold text-[#1A140F] transition-colors hover:bg-[#C89347] cursor-pointer"
          >
            <Check className="h-4 w-4" />
            Awaken as {CLASS_LIST.find((c) => c.id === selected)?.name}
          </button>
        </div>
      </div>
    </div>
  );
};
