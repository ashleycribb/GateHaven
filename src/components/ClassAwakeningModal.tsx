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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/82 p-4">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-amber-400/60 bg-slate-950 text-slate-100 shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-800 px-6 py-5">
          <div>
            <p className="text-xs font-semibold tracking-wide text-amber-400">
              System Evaluation · Level {level} Class Awakening
            </p>
            <h2 className="mt-1 font-[var(--font-display)] text-2xl font-bold text-white">
              Choose Your Class
            </h2>
            <p className="mt-1.5 text-sm text-slate-300">
              Based on your journey so far, the System recommends{' '}
              <span className="font-bold text-amber-300">
                {CLASS_LIST.find((c) => c.id === recommended)?.name}
              </span>
              . You may accept the recommendation or pick any class below.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="Close class modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-6">
          {/* Playstyle Analysis Strip */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-slate-800 pb-3 text-xs text-slate-400">
            <span className="font-semibold text-slate-200">Playstyle Log:</span>
            {statSummary.map((s) => (
              <span key={s.label} className="tabular-nums">
                {s.label}: <strong className="text-slate-100">{s.value}</strong>
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
                  className={`flex flex-col rounded-xl border p-4 text-left transition-colors ${
                    isSelected
                      ? 'border-amber-400 bg-slate-900'
                      : 'border-slate-800 bg-slate-900/50 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-base font-bold text-white">{cls.name}</span>
                    <span className="text-xs font-semibold text-slate-400">
                      {isRec ? 'System Recommended' : cls.title}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-300">{cls.description}</p>
                  <p className="mt-2.5 text-xs font-semibold" style={{ color: cls.accentColor }}>
                    {cls.bonusSummary}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-800 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="whitespace-nowrap rounded-lg px-4 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-900 hover:text-white"
          >
            Decide Later
          </button>
          <button
            type="button"
            onClick={() => onSelectClass(selected)}
            className="flex items-center gap-2 whitespace-nowrap rounded-lg bg-amber-400 px-5 py-2.5 text-sm font-bold text-slate-950 transition-colors hover:bg-amber-300"
          >
            <Check className="h-4 w-4" />
            Awaken as {CLASS_LIST.find((c) => c.id === selected)?.name}
          </button>
        </div>
      </div>
    </div>
  );
};
