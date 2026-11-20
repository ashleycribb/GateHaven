import React, { useState } from 'react';
import { X, ShieldCheck, Flag, Ban, BookOpen, Check } from 'lucide-react';
import { SafetyReportStub } from '../types/blockhaven';

interface SafetyModalProps {
  worldName: string;
  localNotes: string;
  initialTarget?: string;
  safetyLogs: SafetyReportStub[];
  onUpdateNotes: (notes: string) => void;
  onLogStubAction: (type: 'report' | 'block', targetLabel: string, reason: string) => void;
  onClose: () => void;
}

export const SafetyModal: React.FC<SafetyModalProps> = ({
  worldName,
  localNotes,
  initialTarget,
  safetyLogs,
  onUpdateNotes,
  onLogStubAction,
  onClose,
}) => {
  const [notesDraft, setNotesDraft] = useState(localNotes);
  const [notesSavedToast, setNotesSavedToast] = useState(false);

  const [stubTarget, setStubTarget] = useState(initialTarget || worldName || 'Current World');
  const [stubReason, setStubReason] = useState('Unfriendly or inappropriate content');
  const [stubFeedback, setStubFeedback] = useState<string | null>(null);

  const handleSaveNotes = () => {
    onUpdateNotes(notesDraft);
    setNotesSavedToast(true);
    setTimeout(() => setNotesSavedToast(false), 2000);
  };

  const handleStub = (type: 'report' | 'block') => {
    onLogStubAction(type, stubTarget.trim() || 'Item', stubReason);
    setStubFeedback(
      type === 'report'
        ? `Report recorded locally (v1 stub) for "${stubTarget}". In v2, this will notify Gate Haven moderators.`
        : `Block recorded locally (v1 stub) for "${stubTarget}". In v2, this will hide that player or shared world from your feed.`,
    );
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/55 p-4">
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            <div>
              <h2 className="font-display text-xl font-bold text-slate-900">
                Family Safety &amp; Local Notes
              </h2>
              <p className="text-xs text-slate-500">
                Family-friendly by default · No stranger chat · No purchases · No ads
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
            aria-label="Close Safety Center"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Safety Guarantees */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
              <p className="text-xs font-bold text-slate-900">No Chat With Strangers</p>
              <p className="mt-1 text-xs text-slate-600">
                v1 runs completely offline in your browser. Only local notes and scripted village NPCs exist.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
              <p className="text-xs font-bold text-slate-900">Zero Purchases or Ads</p>
              <p className="mt-1 text-xs text-slate-600">
                Every block, hat, and template is unlocked for everyone with no store or tracking ads.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
              <p className="text-xs font-bold text-slate-900">Safe Exploration</p>
              <p className="mt-1 text-xs text-slate-600">
                No fall damage or losing items. Falling off an edge simply pops you back to the start pad.
              </p>
            </div>
          </div>

          {/* Local Notes Only */}
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-blue-600" />
                <h3 className="font-display text-sm font-bold text-slate-900">
                  Local World Notes (Private to This Device)
                </h3>
              </div>
              {notesSavedToast && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                  <Check className="h-3.5 w-3.5" /> Saved locally
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Jot down build ideas, obby rules, or village stories for &ldquo;{worldName}&rdquo;. Notes never leave your browser.
            </p>
            <textarea
              rows={3}
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              placeholder="Example: Add a wooden bridge from the bakery to the pond..."
              className="mt-2.5 w-full rounded-lg border border-slate-300 p-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            />
            <div className="mt-2.5 flex justify-end">
              <button
                type="button"
                onClick={handleSaveNotes}
                className="rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer"
              >
                Save Local Note
              </button>
            </div>
          </div>

          {/* Visible Report & Block Buttons (Clearly Labeled v1 Stubs) */}
          <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4">
            <h3 className="font-display text-sm font-bold text-slate-900">
              Report &amp; Block Tools (v1 Preview Stub)
            </h3>
            <p className="mt-1 text-xs text-slate-600">
              There are no live players in v1 yet, so these controls are wired as local safety stubs ready for v2 multiplayer moderation.
            </p>

            <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700" htmlFor="safety-target">
                  World Code or Label
                </label>
                <input
                  id="safety-target"
                  type="text"
                  value={stubTarget}
                  onChange={(e) => setStubTarget(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700" htmlFor="safety-reason">
                  Reason
                </label>
                <select
                  id="safety-reason"
                  value={stubReason}
                  onChange={(e) => setStubReason(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900"
                >
                  <option>Unfriendly or inappropriate content</option>
                  <option>Unwanted shared world code</option>
                  <option>Bug or visual glitch</option>
                </select>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => handleStub('report')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 cursor-pointer whitespace-nowrap"
              >
                <Flag className="h-3.5 w-3.5" />
                Report (v1 Stub)
              </button>
              <button
                type="button"
                onClick={() => handleStub('block')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-4 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 cursor-pointer whitespace-nowrap"
              >
                <Ban className="h-3.5 w-3.5" />
                Block (v1 Stub)
              </button>
            </div>

            {stubFeedback && (
              <p className="mt-3 rounded-lg border border-rose-200 bg-white p-2.5 text-xs text-slate-700">
                {stubFeedback}
              </p>
            )}

            {safetyLogs.length > 0 && (
              <div className="mt-3 border-t border-rose-200/70 pt-3">
                <p className="text-[11px] font-semibold text-slate-600">
                  Recent local safety log ({safetyLogs.length})
                </p>
                <ul className="mt-1.5 space-y-1 text-xs text-slate-600">
                  {safetyLogs.slice(0, 3).map((item) => (
                    <li key={item.id}>
                      <span className="font-semibold capitalize">{item.type}</span> · {item.targetLabel} · {item.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
