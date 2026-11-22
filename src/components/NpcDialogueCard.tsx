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
    <div
      data-gamepad-scope="modal"
      className="fixed inset-x-0 bottom-5 z-40 mx-auto w-full max-w-2xl px-4"
    >
      <div className="rounded-xl border border-[#68553F] bg-[#1C1713]/96 p-5 text-[#EDE2CC] shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#B8A990]">
              <span className="font-semibold text-[#D4A65C]">{npc.role}</span>
              <span aria-hidden="true">·</span>
              <span>{npc.personality}</span>
            </div>
            <h3 className="mt-1 font-[var(--font-display)] text-xl font-bold text-[#F3E9D6]">
              {npc.name}
            </h3>
            <p className="mt-0.5 text-xs text-[#B8A990]">{npc.backstory}</p>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onReportNpc(npc.name)}
              title="Report issue (v1 safety stub)"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[#B8A990] hover:bg-[#322820] hover:text-[#DFB461] cursor-pointer"
            >
              <Flag className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialogue"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[#B8A990] hover:bg-[#322820] hover:text-[#F3E9D6] cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Speech Box */}
        <div className="mt-3.5 rounded-xl border border-[#4D3F31] bg-[#251E18] px-4 py-3">
          <p className="text-sm leading-relaxed text-[#F1E7D4]">“{currentLine}”</p>
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
                      ? 'cursor-default border-[#5D7C52]/60 bg-[#212B1E] text-[#9CC08B]'
                      : cantAfford
                        ? 'cursor-not-allowed border-[#3F3327] bg-[#211B16] text-[#847765]'
                        : 'border-[#7E6647] bg-[#30261D] text-[#F1E4CD] hover:bg-[#3E3125] cursor-pointer'
                  }`}
                >
                  {branch.action === 'teach_skill' && <BookOpen className="h-3.5 w-3.5 text-[#D4A65C]" />}
                  {branch.action === 'buy_dungeon_map' && <Scroll className="h-3.5 w-3.5 text-[#D9AD62]" />}
                  {alreadyLearned ? `${skillMeta?.name} (Learned)` : branch.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Footer Controls */}
        <div className="mt-4 flex items-center justify-between border-t border-[#46392C] pt-3">
          <span className="text-xs text-[#B8A990] tabular-nums">
            Your Gold: <strong className="text-[#D9AD62]">{playerGold}g</strong>
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setBranchReply(null);
                setLineIndex((i) => (i + 1) % allLines.length);
              }}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#5B4B3A] bg-[#261F18] px-3.5 py-2 text-xs font-semibold text-[#E8DCC5] hover:bg-[#332920] cursor-pointer"
            >
              More Lore
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="whitespace-nowrap rounded-lg border border-[#C99A4E]/70 bg-[#9C6C30] px-4 py-2 text-xs font-bold text-[#FDF6E8] hover:bg-[#AE7A39] cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
