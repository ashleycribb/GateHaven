import React, { useEffect, useState } from 'react';
import { ArrowRight, BookOpen, Flag, Scroll, X } from 'lucide-react';
import { LearnedSkill, NpcDefinition, NpcDialogueBranch } from '../types/blockhaven';
import { SKILL_CATALOG } from '../rpg/rpgData';

interface NpcDialogueCardProps {
  npc: NpcDefinition;
  learnedSkills: LearnedSkill[];
  playerGold: number;
  onBranchAction: (branch: NpcDialogueBranch) => void;
  onClose: () => void;
  onReportNpc: (npcName: string) => void;
}

export const NpcDialogueCard: React.FC<NpcDialogueCardProps> = ({
  npc,
  learnedSkills,
  playerGold,
  onBranchAction,
  onClose,
  onReportNpc,
}) => {
  const [lineIndex, setLineIndex] = useState(0);
  const [branchReply, setBranchReply] = useState<string | null>(null);

  useEffect(() => {
    setLineIndex(0);
    setBranchReply(null);
  }, [npc.id]);

  const allLines = [npc.greeting, ...npc.dialogue];
  const currentLine = branchReply ?? allLines[lineIndex % allLines.length];

  const handleBranch = (branch: NpcDialogueBranch) => {
    setBranchReply(branch.response);
    onBranchAction(branch);
  };

  return (
    <div className="fixed inset-x-0 bottom-5 z-40 mx-auto w-full max-w-2xl px-4">
      <div className="rounded-2xl border border-slate-700 bg-slate-950/96 p-5 text-slate-100 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span className="font-semibold text-sky-400">{npc.role}</span>
              <span aria-hidden="true">·</span>
              <span>{npc.personality}</span>
            </div>
            <h3 className="mt-1 font-[var(--font-display)] text-xl font-bold text-white">
              {npc.name}
            </h3>
            <p className="mt-0.5 text-xs text-slate-400">{npc.backstory}</p>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onReportNpc(npc.name)}
              title="Report issue (v1 safety stub)"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-amber-300"
            >
              <Flag className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialogue"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Speech Box */}
        <div className="mt-3.5 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
          <p className="text-sm leading-relaxed text-slate-100">“{currentLine}”</p>
        </div>

        {/* Dialogue Branches & Skill Teaching */}
        {npc.branches.length > 0 && (
          <div className="mt-3.5 flex flex-wrap gap-2">
            {npc.branches.map((branch) => {
              const skillMeta = branch.skillId ? SKILL_CATALOG[branch.skillId] : null;
              const alreadyLearned =
                branch.skillId !== undefined && learnedSkills.some((s) => s.id === branch.skillId);
              const cantAfford =
                (!alreadyLearned && skillMeta !== null && playerGold < skillMeta.costGold) ||
                (branch.action === 'buy_dungeon_map' && playerGold < 30);

              return (
                <button
                  key={branch.label}
                  type="button"
                  disabled={alreadyLearned || cantAfford}
                  onClick={() => handleBranch(branch)}
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                    alreadyLearned
                      ? 'cursor-default border-emerald-500/40 bg-emerald-950/50 text-emerald-300'
                      : cantAfford
                        ? 'cursor-not-allowed border-slate-800 bg-slate-900 text-slate-500'
                        : 'border-sky-500/50 bg-sky-500/15 text-sky-200 hover:bg-sky-500/25'
                  }`}
                >
                  {branch.action === 'teach_skill' && <BookOpen className="h-3.5 w-3.5" />}
                  {branch.action === 'buy_dungeon_map' && <Scroll className="h-3.5 w-3.5 text-amber-300" />}
                  {alreadyLearned ? `${skillMeta?.name} (Learned)` : branch.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Footer Controls */}
        <div className="mt-4 flex items-center justify-between border-t border-slate-800 pt-3">
          <span className="text-xs text-slate-400 tabular-nums">
            Your Gold: <strong className="text-amber-300">{playerGold}g</strong>
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setBranchReply(null);
                setLineIndex((i) => (i + 1) % allLines.length);
              }}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
            >
              More Lore
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="whitespace-nowrap rounded-lg bg-sky-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-sky-400"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
