import React, { useState } from 'react';
import { X, Eye, Check } from 'lucide-react';
import { AvatarConfig, CameraViewMode } from '../types/blockhaven';
import {
  BODY_COLORS,
  HAT_COLORS,
  HAT_STYLES,
  SHIRT_COLORS,
  SHIRT_STYLES,
} from '../engine/avatarBuilder';

interface AvatarModalProps {
  avatar: AvatarConfig;
  cameraView: CameraViewMode;
  onSave: (next: AvatarConfig, nextView: CameraViewMode) => void;
  onClose: () => void;
}

const AvatarPreviewSvg: React.FC<{ avatar: AvatarConfig }> = ({ avatar }) => {
  const hatFill = avatar.hat === 'crown' ? '#FBBF24' : avatar.hatColor;
  return (
    <svg
      viewBox="0 0 180 230"
      className="h-56 w-44 drop-shadow-sm"
      role="img"
      aria-label={`Preview of ${avatar.displayName || 'player'} avatar`}
    >
      {/* Ground shadow */}
      <ellipse cx="90" cy="216" rx="44" ry="8" fill="rgba(15,23,42,0.16)" />

      {/* Legs */}
      <rect x="64" y="148" width="22" height="52" rx="3" fill={avatar.pantsColor} />
      <rect x="94" y="148" width="22" height="52" rx="3" fill={avatar.pantsColor} />
      {/* Shoes */}
      <rect x="63" y="196" width="24" height="12" rx="2" fill="#1E293B" />
      <rect x="93" y="196" width="24" height="12" rx="2" fill="#1E293B" />

      {/* Arms */}
      <rect x="34" y="96" width="20" height="26" rx="3" fill={avatar.shirtColor} />
      <rect x="35" y="120" width="18" height="32" rx="3" fill={avatar.bodyColor} />
      <rect x="126" y="96" width="20" height="26" rx="3" fill={avatar.shirtColor} />
      <rect x="127" y="120" width="18" height="32" rx="3" fill={avatar.bodyColor} />

      {/* Torso */}
      <rect x="58" y="92" width="64" height="60" rx="4" fill={avatar.shirtColor} />
      {avatar.shirtStyle === 'striped' && (
        <>
          <rect x="58" y="106" width="64" height="9" fill="#FFFFFF" opacity="0.92" />
          <rect x="58" y="126" width="64" height="9" fill="#FFFFFF" opacity="0.92" />
        </>
      )}
      {avatar.shirtStyle === 'overalls' && (
        <>
          <rect x="68" y="114" width="44" height="38" rx="2" fill={avatar.pantsColor} />
          <rect x="70" y="92" width="9" height="24" fill={avatar.pantsColor} />
          <rect x="101" y="92" width="9" height="24" fill={avatar.pantsColor} />
        </>
      )}
      {avatar.shirtStyle === 'hoodie' && (
        <rect x="72" y="124" width="36" height="18" rx="4" fill="#FFFFFF" opacity="0.88" />
      )}

      {/* Head */}
      <rect x="62" y="38" width="56" height="52" rx="6" fill={avatar.bodyColor} />
      {/* Eyes & Smile */}
      <rect x="75" y="56" width="7" height="10" rx="2" fill="#0F172A" />
      <rect x="98" y="56" width="7" height="10" rx="2" fill="#0F172A" />
      <rect x="77" y="57" width="2.5" height="2.5" fill="#FFFFFF" />
      <rect x="100" y="57" width="2.5" height="2.5" fill="#FFFFFF" />
      <rect x="82" y="74" width="16" height="4" rx="2" fill="#0F172A" />

      {/* Hats */}
      {avatar.hat === 'cap' && (
        <>
          <rect x="58" y="24" width="64" height="20" rx="5" fill={hatFill} />
          <rect x="58" y="37" width="76" height="7" rx="3" fill={hatFill} />
          <rect x="85" y="19" width="10" height="5" rx="2" fill="#FFFFFF" />
        </>
      )}
      {avatar.hat === 'sunhat' && (
        <>
          <rect x="38" y="35" width="104" height="8" rx="4" fill={hatFill} />
          <rect x="60" y="19" width="60" height="18" rx="4" fill={hatFill} />
          <rect x="60" y="30" width="60" height="5" fill={avatar.shirtColor} />
        </>
      )}
      {avatar.hat === 'crown' && (
        <>
          <rect x="60" y="28" width="60" height="12" rx="2" fill={hatFill} />
          <polygon points="62,28 70,12 78,28" fill={hatFill} />
          <polygon points="82,28 90,10 98,28" fill={hatFill} />
          <polygon points="102,28 110,12 118,28" fill={hatFill} />
        </>
      )}
      {avatar.hat === 'wizard' && (
        <>
          <rect x="44" y="35" width="92" height="7" rx="3" fill={hatFill} />
          <polygon points="62,36 90,2 118,36" fill={hatFill} />
          <rect x="64" y="30" width="52" height="5" fill="#FFFFFF" opacity="0.9" />
        </>
      )}
      {avatar.hat === 'beanie' && (
        <>
          <rect x="60" y="20" width="60" height="18" rx="6" fill={hatFill} />
          <rect x="58" y="33" width="64" height="9" rx="3" fill="#FFFFFF" />
          <circle cx="90" cy="14" r="7" fill="#FFFFFF" />
        </>
      )}
    </svg>
  );
};

export const AvatarModal: React.FC<AvatarModalProps> = ({
  avatar,
  cameraView,
  onSave,
  onClose,
}) => {
  const [draft, setDraft] = useState<AvatarConfig>({ ...avatar });
  const [viewDraft, setViewDraft] = useState<CameraViewMode>(cameraView);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/55 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="font-display text-xl font-bold text-slate-900">Avatar Studio</h2>
            <p className="text-xs text-slate-500">
              Pick your blocky look, display name, and preferred camera view
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
            aria-label="Close Avatar Studio"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6 overflow-y-auto p-6 md:grid-cols-[210px_1fr]">
          {/* Live Preview Column */}
          <div className="flex flex-col items-center justify-between rounded-xl border border-slate-200 bg-sky-50 p-4">
            <div className="text-center">
              <p className="font-display text-base font-bold text-slate-900 truncate max-w-[170px]">
                {draft.displayName.trim() || 'Player'}
              </p>
              <p className="text-[11px] text-slate-500">
                Visible in 3rd-person view
              </p>
            </div>

            <AvatarPreviewSvg avatar={draft} />

            {/* Camera View Toggle */}
            <div className="w-full">
              <label className="mb-1.5 flex items-center justify-center gap-1 text-[11px] font-semibold text-slate-600">
                <Eye className="h-3.5 w-3.5" />
                Camera View (Key V)
              </label>
              <div className="grid grid-cols-2 gap-1 rounded-lg bg-white p-1 border border-slate-200">
                <button
                  type="button"
                  onClick={() => setViewDraft('first-person')}
                  className={`rounded-md py-1.5 text-xs font-semibold cursor-pointer ${
                    viewDraft === 'first-person'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  1st Person
                </button>
                <button
                  type="button"
                  onClick={() => setViewDraft('third-person')}
                  className={`rounded-md py-1.5 text-xs font-semibold cursor-pointer ${
                    viewDraft === 'third-person'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  3rd Person
                </button>
              </div>
            </div>
          </div>

          {/* Customization Controls */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700" htmlFor="avatar-name">
                Display Name
              </label>
              <input
                id="avatar-name"
                type="text"
                maxLength={20}
                value={draft.displayName}
                onChange={(e) => setDraft({ ...draft, displayName: e.target.value })}
                placeholder="Your builder name"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <span className="block text-xs font-semibold text-slate-700">Body Colour</span>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {BODY_COLORS.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    title={c.label}
                    onClick={() => setDraft({ ...draft, bodyColor: c.hex })}
                    className={`h-8 w-8 rounded-lg border-2 transition-transform cursor-pointer ${
                      draft.bodyColor === c.hex
                        ? 'border-slate-900 scale-110'
                        : 'border-slate-200 hover:scale-105'
                    }`}
                    style={{ backgroundColor: c.hex }}
                    aria-label={`Body color ${c.label}`}
                  />
                ))}
              </div>
            </div>

            <div>
              <span className="block text-xs font-semibold text-slate-700">Shirt Style &amp; Colour</span>
              <div className="mt-1.5 grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {SHIRT_STYLES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setDraft({ ...draft, shirtStyle: s.id })}
                    className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap ${
                      draft.shirtStyle === s.id
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {SHIRT_COLORS.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    title={c.label}
                    onClick={() => setDraft({ ...draft, shirtColor: c.hex })}
                    className={`h-7 w-7 rounded-lg border-2 cursor-pointer ${
                      draft.shirtColor === c.hex ? 'border-slate-900 scale-110' : 'border-slate-300'
                    }`}
                    style={{ backgroundColor: c.hex }}
                    aria-label={`Shirt color ${c.label}`}
                  />
                ))}
              </div>
            </div>

            <div>
              <span className="block text-xs font-semibold text-slate-700">Hat</span>
              <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                {HAT_STYLES.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => setDraft({ ...draft, hat: h.id })}
                    className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap ${
                      draft.hat === h.id
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
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
                      title={c.label}
                      onClick={() => setDraft({ ...draft, hatColor: c.hex })}
                      className={`h-7 w-7 rounded-lg border-2 cursor-pointer ${
                        draft.hatColor === c.hex ? 'border-slate-900 scale-110' : 'border-slate-300'
                      }`}
                      style={{ backgroundColor: c.hex }}
                      aria-label={`Hat color ${c.label}`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() =>
              onSave(
                { ...draft, displayName: draft.displayName.trim() || 'Builder' },
                viewDraft,
              )
            }
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 cursor-pointer"
          >
            <Check className="h-4 w-4" />
            Save Avatar
          </button>
        </div>
      </div>
    </div>
  );
};
