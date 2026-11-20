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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-amber-400/40 bg-slate-950 text-slate-100 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <ScrollText className="h-5 w-5 text-amber-400" />
            <div>
              <h2 className="font-[var(--font-display)] text-lg font-bold text-white">
                Elderglen Quest Board
              </h2>
              <p className="text-xs text-slate-400">
                Fetch, Hunt, Escort & Dungeon bounties with XP, Gold, and Gear rewards
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Quest Board"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"
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
                className="rounded-xl border border-slate-800 bg-slate-900/70 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-slate-400">
                      <span className="font-semibold capitalize text-amber-300">{q.kind}</span>
                      {' · '}Posted by {q.giverName}
                      {' · '}Recommended Lv {q.minLevel}+
                    </p>
                    <h3 className="mt-0.5 text-sm font-bold text-white">{q.title}</h3>
                    <p className="mt-1 text-xs text-slate-300">{q.description}</p>
                    <p className="mt-2 text-xs text-sky-300 tabular-nums">
                      Reward: +{q.rewardXp} XP · +{q.rewardGold}g
                      {q.rewardRarity ? ` · ${q.rewardRarity} Gear` : ''}
                    </p>
                  </div>

                  <div className="shrink-0">
                    {!state ? (
                      <button
                        type="button"
                        onClick={() => onAcceptQuest(q.id)}
                        className="whitespace-nowrap rounded-lg bg-sky-500 px-3.5 py-2 text-xs font-bold text-slate-950 hover:bg-sky-400"
                      >
                        Accept Quest
                      </button>
                    ) : state.claimed ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400">
                        <Check className="h-3.5 w-3.5" />
                        Claimed
                      </span>
                    ) : state.completed ? (
                      <button
                        type="button"
                        onClick={() => onClaimQuest(q.id)}
                        className="whitespace-nowrap rounded-lg bg-emerald-500 px-3.5 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400"
                      >
                        Claim Reward
                      </button>
                    ) : (
                      <span className="text-xs font-semibold text-amber-300 tabular-nums">
                        {state.progress} / {q.targetCount}
                      </span>
                    )}
                  </div>
                </div>

                {state && !state.claimed && (
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className={`h-full ${state.completed ? 'bg-emerald-400' : 'bg-sky-400'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}

                {playerLevel < q.minLevel && !state && (
                  <p className="mt-2 text-[11px] text-orange-300">
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
