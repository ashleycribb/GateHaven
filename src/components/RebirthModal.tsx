import React, { useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { AvatarConfig } from '../types/blockhaven';
import {
  BODY_COLORS,
  HAT_COLORS,
  HAT_STYLES,
  SHIRT_COLORS,
  SHIRT_STYLES,
} from '../engine/avatarBuilder';

interface RebirthModalProps {
  initialAvatar: AvatarConfig;
  onCompleteRebirth: (avatar: AvatarConfig) => void;
  onCancel: () => void;
}

export const RebirthModal: React.FC<RebirthModalProps> = ({
  initialAvatar,
  onCompleteRebirth,
  onCancel,
}) => {
  const [draft, setDraft] = useState<AvatarConfig>({ ...initialAvatar });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/82 p-4">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-sky-400/50 bg-slate-950 text-slate-100 shadow-2xl">
        {/* Character Awakening Header */}
        <div className="border-b border-slate-800 px-6 py-5">
          <p className="text-xs font-semibold tracking-wide text-sky-400">
            Character Creation · Elderglen
          </p>
          <h2 className="mt-1 font-[var(--font-display)] text-2xl font-bold tracking-tight text-white">
            Begin your adventure in Elderglen
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">
            You arrive beside the Awakening Shrine ready to chart your own path. You start with{' '}
            <span className="font-semibold text-white">no class</span> — your weapons, skills,
            builds, and companions will shape the class recommended for you at Level 5.
          </p>
        </div>

        {/* Body */}
        <div className="grid flex-1 grid-cols-1 gap-6 overflow-y-auto p-6 md:grid-cols-[240px_1fr]">
          {/* Left: Guide Sera + Live Blocky Preview */}
          <div className="flex flex-col gap-4">
            <div className="flex flex-col items-center rounded-xl border border-slate-800 bg-slate-900 p-4">
              <svg viewBox="0 0 140 165" className="h-40 w-36" aria-label="Reborn avatar preview">
                <ellipse cx="70" cy="152" rx="34" ry="8" fill="#0F172A" opacity="0.65" />
                <rect x="48" y="106" width="18" height="42" rx="3" fill={draft.pantsColor} />
                <rect x="74" y="106" width="18" height="42" rx="3" fill={draft.pantsColor} />
                <rect x="44" y="58" width="52" height="50" rx="4" fill={draft.shirtColor} />
                {draft.shirtStyle === 'striped' && (
                  <>
                    <rect x="44" y="68" width="52" height="7" fill="#FFFFFF" opacity="0.88" />
                    <rect x="44" y="84" width="52" height="7" fill="#FFFFFF" opacity="0.88" />
                  </>
                )}
                {draft.shirtStyle === 'overalls' && (
                  <>
                    <rect x="52" y="58" width="9" height="48" fill="#1D4ED8" />
                    <rect x="79" y="58" width="9" height="48" fill="#1D4ED8" />
                    <rect x="48" y="84" width="44" height="24" fill="#1D4ED8" />
                  </>
                )}
                <rect x="26" y="60" width="16" height="42" rx="3" fill={draft.shirtColor} />
                <rect x="26" y="88" width="16" height="14" rx="2" fill={draft.bodyColor} />
                <rect x="98" y="60" width="16" height="42" rx="3" fill={draft.shirtColor} />
                <rect x="98" y="88" width="16" height="14" rx="2" fill={draft.bodyColor} />
                <rect x="47" y="18" width="46" height="40" rx="5" fill={draft.bodyColor} />
                <rect x="57" y="33" width="6" height="6" rx="1" fill="#0F172A" />
                <rect x="77" y="33" width="6" height="6" rx="1" fill="#0F172A" />
                <rect x="64" y="45" width="12" height="3" rx="1.5" fill="#7C4A33" />
                {draft.hat === 'cap' && (
                  <>
                    <rect x="45" y="12" width="50" height="10" rx="3" fill={draft.hatColor} />
                    <rect x="49" y="19" width="52" height="5" rx="2" fill={draft.hatColor} />
                  </>
                )}
                {draft.hat === 'sunhat' && (
                  <>
                    <rect x="33" y="18" width="74" height="6" rx="3" fill={draft.hatColor} />
                    <rect x="48" y="9" width="44" height="11" rx="3" fill={draft.hatColor} />
                  </>
                )}
                {draft.hat === 'crown' && (
                  <polygon points="48,20 53,6 63,16 70,4 77,16 87,6 92,20" fill="#FBBF24" />
                )}
                {draft.hat === 'wizard' && (
                  <>
                    <rect x="36" y="18" width="68" height="6" rx="3" fill={draft.hatColor} />
                    <polygon points="48,18 70,1 92,18" fill={draft.hatColor} />
                  </>
                )}
                {draft.hat === 'beanie' && (
                  <>
                    <rect x="46" y="10" width="48" height="13" rx="5" fill={draft.hatColor} />
                    <circle cx="70" cy="8" r="5" fill={draft.hatColor} />
                  </>
                )}
              </svg>
              <p className="mt-2 text-sm font-bold text-white">{draft.displayName.trim() || 'Traveler'}</p>
              <p className="text-xs text-slate-400">Lv 1 · Unawakened · PvE Safe</p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3.5">
              <p className="text-xs font-semibold text-teal-400">Sera · Shrine Keeper</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-300">
                “Speak with me beside the Shrine when you wake. I’ll help you bind your gear and
                introduce you to Bram, Kael, and Lyra.”
              </p>
            </div>
          </div>

          {/* Right: Customization Controls */}
          <div className="space-y-4">
            <div>
              <label htmlFor="rebirth-name" className="block text-xs font-semibold text-slate-300">
                Traveler Name
              </label>
              <input
                id="rebirth-name"
                type="text"
                maxLength={20}
                value={draft.displayName}
                onChange={(e) => setDraft((d) => ({ ...d, displayName: e.target.value }))}
                placeholder="Enter your name"
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 text-sm text-white focus:border-sky-400 focus:outline-none"
              />
            </div>

            <div>
              <span className="block text-xs font-semibold text-slate-300">Skin Tone</span>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {BODY_COLORS.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, bodyColor: c.hex }))}
                    title={c.label}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-transform hover:scale-105 ${
                      draft.bodyColor === c.hex ? 'border-sky-400 ring-2 ring-sky-400/40' : 'border-slate-700'
                    }`}
                    style={{ backgroundColor: c.hex }}
                  >
                    {draft.bodyColor === c.hex && <Check className="h-3.5 w-3.5 text-slate-950" />}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="block text-xs font-semibold text-slate-300">Tunic Color & Style</span>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {SHIRT_COLORS.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, shirtColor: c.hex }))}
                    title={c.label}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-transform hover:scale-105 ${
                      draft.shirtColor === c.hex ? 'border-sky-400 ring-2 ring-sky-400/40' : 'border-slate-700'
                    }`}
                    style={{ backgroundColor: c.hex }}
                  >
                    {draft.shirtColor === c.hex && <Check className="h-3.5 w-3.5 text-white" />}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {SHIRT_STYLES.map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, shirtStyle: st.id }))}
                    className={`whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      draft.shirtStyle === st.id
                        ? 'border-sky-400 bg-sky-500/20 text-sky-200'
                        : 'border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="block text-xs font-semibold text-slate-300">Headgear</span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {HAT_STYLES.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, hat: h.id }))}
                    className={`whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      draft.hat === h.id
                        ? 'border-sky-400 bg-sky-500/20 text-sky-200'
                        : 'border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {h.label}
                  </button>
                ))}
              </div>
              {draft.hat !== 'none' && draft.hat !== 'crown' && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {HAT_COLORS.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setDraft((d) => ({ ...d, hatColor: c.hex }))}
                      title={c.label}
                      className={`h-7 w-7 rounded-md border ${
                        draft.hatColor === c.hex ? 'border-sky-400 ring-2 ring-sky-400/40' : 'border-slate-700'
                      }`}
                      style={{ backgroundColor: c.hex }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-800 px-6 py-4">
          <button
            type="button"
            onClick={onCancel}
            className="whitespace-nowrap rounded-lg px-4 py-2 text-xs font-semibold text-slate-400 transition-colors hover:bg-slate-900 hover:text-white"
          >
            Back to Title
          </button>
          <button
            type="button"
            onClick={() =>
              onCompleteRebirth({
                ...draft,
                displayName: draft.displayName.trim() || 'Traveler',
              })
            }
            className="flex items-center gap-2 whitespace-nowrap rounded-lg bg-sky-500 px-5 py-2.5 text-sm font-bold text-slate-950 transition-colors hover:bg-sky-400"
          >
            Wake in Elderglen
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
