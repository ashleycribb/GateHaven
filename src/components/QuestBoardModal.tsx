import React from 'react';
import { Check, ScrollText, X } from 'lucide-react';
import { ActiveQuestState } from '../types/blockhaven';
import { QUEST_BOARD_LIST } from '../rpg/rpgData';

interface QuestBoardModalProps {
  playerLevel: number;
  activeQuests: ActiveQuestState[];
  onAcceptQuest: (questId: string) => void;
  onClaimQuest: (questId: string) => void;
  onClose: () => void;
}

export const QuestBoardModal: React.FC<QuestBoardModalProps> = ({
  playerLevel,
  activeQuests,
  onAcceptQuest,
  onClaimQuest,
  onClose,
}) => {
  return (
    <div
      data-gamepad-scope="modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0D0A08]/82 p-4"
    >
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-[#725C43] bg-[#1C1713] text-[#EDE2CC] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#46392C] bg-[#231C16] px-6 py-4">
          <div className="flex items-center gap-2.5">
            <ScrollText className="h-5 w-5 text-[#D4A65C]" />
            <div>
              <h2 className="font-[var(--font-display)] text-lg font-bold text-[#F3E9D6]">
                Elderglen Quest Board
              </h2>
              <p className="text-xs text-[#B8A990]">
                Fetch, Hunt, Escort &amp; Dungeon bounties with XP, Gold, and Gear rewards
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Quest Board"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#B8A990] hover:bg-[#322820] hover:text-[#F3E9D6] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-6">
          {QUEST_BOARD_LIST.map((q) => {
            const state = activeQuests.find((a) => a.questId === q.id);
            const pct = state ? Math.min(100, Math.round((state.progress / q.targetCount) * 100)) : 0;

            return (
              <div
                key={q.id}
                className="rounded-xl border border-[#4D3F31] bg-[#241D17] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-[#B8A990]">
                      <span className="font-semibold capitalize text-[#D9AD62]">{q.kind}</span>
                      {' · '}Posted by {q.giverName}
                      {' · '}Recommended Lv {q.minLevel}+
                    </p>
                    <h3 className="mt-0.5 text-sm font-bold text-[#F3E9D6]">{q.title}</h3>
                    <p className="mt-1 text-xs text-[#CFC2AA]">{q.description}</p>
                    <p className="mt-2 text-xs text-[#D4A65C] tabular-nums">
                      Reward: +{q.rewardXp} XP · +{q.rewardGold}g
                      {q.rewardRarity ? ` · ${q.rewardRarity} Gear` : ''}
                    </p>
                  </div>

                  <div className="shrink-0">
                    {!state ? (
                      <button
                        type="button"
                        onClick={() => onAcceptQuest(q.id)}
                        className="whitespace-nowrap rounded-lg border border-[#C99A4E]/75 bg-[#9C6C30] px-3.5 py-2 text-xs font-bold text-[#FDF6E8] hover:bg-[#AE7A39] cursor-pointer"
                      >
                        Accept Quest
                      </button>
                    ) : state.claimed ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#98B986]">
                        <Check className="h-3.5 w-3.5" />
                        Claimed
                      </span>
                    ) : state.completed ? (
                      <button
                        type="button"
                        onClick={() => onClaimQuest(q.id)}
                        className="whitespace-nowrap rounded-lg border border-[#8BB178] bg-[#557547] px-3.5 py-2 text-xs font-bold text-[#F3EFE6] hover:bg-[#648853] cursor-pointer"
                      >
                        Claim Reward
                      </button>
                    ) : (
                      <span className="text-xs font-semibold text-[#D9AD62] tabular-nums">
                        {state.progress} / {q.targetCount}
                      </span>
                    )}
                  </div>
                </div>

                {state && !state.claimed && (
                  <div className="mt-3 h-1.5 overflow-hidden rounded bg-[#322820]">
                    <div
                      className={`h-full ${state.completed ? 'bg-[#7EA56E]' : 'bg-[#C99A4E]'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}

                {playerLevel < q.minLevel && !state && (
                  <p className="mt-2 text-[11px] text-[#DF9A62]">
                    Note: Recommended for Level {q.minLevel} or higher.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
