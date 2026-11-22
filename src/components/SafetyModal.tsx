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
    <div
      data-gamepad-scope="modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0D0A08]/80 p-4"
    >
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-[#65523D] bg-[#1C1713] text-[#EDE2CC] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#46392C] bg-[#231C16] px-6 py-4">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-5 w-5 text-[#98B986]" />
            <div>
              <h2 className="font-[var(--font-display)] text-xl font-bold text-[#F3E9D6]">
                Family Safety &amp; Local Notes
              </h2>
              <p className="text-xs text-[#B8A990]">
                Family-friendly by default · No stranger chat · No purchases · No ads
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#B8A990] hover:bg-[#322820] hover:text-[#F3E9D6] cursor-pointer"
            aria-label="Close Safety Center"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Safety Guarantees */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-[#4D3F31] bg-[#241D17] p-3.5">
              <p className="text-xs font-bold text-[#F3E9D6]">No Chat With Strangers</p>
              <p className="mt-1 text-xs text-[#B8A990]">
                v1 runs completely offline in your browser. Only local notes and scripted village
                NPCs exist.
              </p>
            </div>
            <div className="rounded-xl border border-[#4D3F31] bg-[#241D17] p-3.5">
              <p className="text-xs font-bold text-[#F3E9D6]">Zero Purchases or Ads</p>
              <p className="mt-1 text-xs text-[#B8A990]">
                Every block, hat, and template is unlocked for everyone with no store or tracking
                ads.
              </p>
            </div>
            <div className="rounded-xl border border-[#4D3F31] bg-[#241D17] p-3.5">
              <p className="text-xs font-bold text-[#F3E9D6]">Safe Exploration</p>
              <p className="mt-1 text-xs text-[#B8A990]">
                PvE safe by default. Falling off an edge simply pops you back to your spawn pad.
              </p>
            </div>
          </div>

          {/* Local Notes Only */}
          <div className="rounded-xl border border-[#4D3F31] bg-[#241D17] p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-[#D4A65C]" />
                <h3 className="font-[var(--font-display)] text-sm font-bold text-[#F3E9D6]">
                  Local World Notes (Private to This Device)
                </h3>
              </div>
              {notesSavedToast && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#98B986]">
                  <Check className="h-3.5 w-3.5" /> Saved locally
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-[#B8A990]">
              Jot down build ideas, obby rules, or village stories for &ldquo;{worldName}&rdquo;.
              Notes never leave your browser.
            </p>
            <textarea
              rows={3}
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              placeholder="Example: Add a wooden bridge from the bakery to the pond..."
              className="mt-2.5 w-full rounded-lg border border-[#5B4B3A] bg-[#1C1612] p-2.5 text-sm text-[#F3E9D6] focus:border-[#D4A65C] focus:outline-none"
            />
            <div className="mt-2.5 flex justify-end">
              <button
                type="button"
                onClick={handleSaveNotes}
                className="rounded-lg border border-[#C99A4E]/75 bg-[#9C6C30] px-4 py-1.5 text-xs font-semibold text-[#FDF6E8] hover:bg-[#AE7A39] cursor-pointer"
              >
                Save Local Note
              </button>
            </div>
          </div>

          {/* Visible Report & Block Buttons (Clearly Labeled v1 Stubs) */}
          <div className="rounded-xl border border-[#8E4036]/75 bg-[#2A1B18] p-4">
            <h3 className="font-[var(--font-display)] text-sm font-bold text-[#F3E9D6]">
              Report &amp; Block Tools (v1 Preview Stub)
            </h3>
            <p className="mt-1 text-xs text-[#CFC2AA]">
              There are no live players in v1 yet, so these controls are wired as local safety stubs
              ready for v2 multiplayer moderation.
            </p>

            <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <div>
                <label
                  className="block text-[11px] font-semibold text-[#D6C8AF]"
                  htmlFor="safety-target"
                >
                  World Code or Label
                </label>
                <input
                  id="safety-target"
                  type="text"
                  value={stubTarget}
                  onChange={(e) => setStubTarget(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#5B4B3A] bg-[#1C1612] px-3 py-1.5 text-xs text-[#F3E9D6]"
                />
              </div>
              <div>
                <label
                  className="block text-[11px] font-semibold text-[#D6C8AF]"
                  htmlFor="safety-reason"
                >
                  Reason
                </label>
                <select
                  id="safety-reason"
                  value={stubReason}
                  onChange={(e) => setStubReason(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#5B4B3A] bg-[#1C1612] px-3 py-1.5 text-xs text-[#F3E9D6]"
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
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#B54B3E] bg-[#8E392F] px-4 py-2 text-xs font-semibold text-[#FDF6E8] hover:bg-[#A34338] cursor-pointer whitespace-nowrap"
              >
                <Flag className="h-3.5 w-3.5" />
                Report (v1 Stub)
              </button>
              <button
                type="button"
                onClick={() => handleStub('block')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#8E4036] bg-[#241816] px-4 py-2 text-xs font-semibold text-[#E8A398] hover:bg-[#33201D] cursor-pointer whitespace-nowrap"
              >
                <Ban className="h-3.5 w-3.5" />
                Block (v1 Stub)
              </button>
            </div>

            {stubFeedback && (
              <p className="mt-3 rounded-lg border border-[#6E3B34] bg-[#1D1513] p-2.5 text-xs text-[#E5D5BE]">
                {stubFeedback}
              </p>
            )}

            {safetyLogs.length > 0 && (
              <div className="mt-3 border-t border-[#5A342E] pt-3">
                <p className="text-[11px] font-semibold text-[#CFC2AA]">
                  Recent local safety log ({safetyLogs.length})
                </p>
                <ul className="mt-1.5 space-y-1 text-xs text-[#B8A990]">
                  {safetyLogs.slice(0, 3).map((item) => (
                    <li key={item.id}>
                      <span className="font-semibold capitalize text-[#E8DCC5]">{item.type}</span> ·{' '}
                      {item.targetLabel} · {item.reason}
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
