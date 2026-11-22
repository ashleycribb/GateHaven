import React, { useState } from 'react';
import { X, Eye, Check } from 'lucide-react';
import { AvatarConfig, CameraViewMode } from '../types/blockhaven';
import {
  BEARD_STYLES,
  BODY_COLORS,
  HAIR_COLORS,
  HAIR_STYLES,
  HAT_COLORS,
  HAT_STYLES,
  SHIRT_COLORS,
  SHIRT_STYLES,
} from '../engine/avatarBuilder';
import { AvatarPreviewSvg } from './AvatarPreviewSvg';

interface AvatarModalProps {
  avatar: AvatarConfig;
  cameraView: CameraViewMode;
  onSave: (next: AvatarConfig, nextView: CameraViewMode) => void;
  onClose: () => void;
}

export const AvatarModal: React.FC<AvatarModalProps> = ({
  avatar,
  cameraView,
  onSave,
  onClose,
}) => {
  const [draft, setDraft] = useState<AvatarConfig>({
    hairStyle: 'short',
    beardStyle: 'none',
    hairColor: '#5F4936',
    ...avatar,
  });
  const [viewDraft, setViewDraft] = useState<CameraViewMode>(cameraView);

  const showHairColors =
    (draft.hairStyle && draft.hairStyle !== 'bald') ||
    (draft.beardStyle && draft.beardStyle !== 'none');

  return (
    <div
      data-gamepad-scope="modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0D0A08]/80 p-4"
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-[#65523D] bg-[#1C1713] text-[#EDE2CC] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#46392C] bg-[#231C16] px-6 py-4">
          <div>
            <h2 className="font-[var(--font-display)] text-xl font-bold text-[#F3E9D6]">
              Avatar Studio
            </h2>
            <p className="text-xs text-[#B8A990]">
              Pick your traveler look, display name, and preferred camera view
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#B8A990] hover:bg-[#322820] hover:text-[#F3E9D6] cursor-pointer"
            aria-label="Close Avatar Studio"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6 overflow-y-auto p-6 md:grid-cols-[210px_1fr]">
          {/* Live Preview Column */}
          <div className="flex flex-col items-center justify-between rounded-xl border border-[#4D3F31] bg-[#241D17] p-4">
            <div className="text-center">
              <p className="font-[var(--font-display)] text-base font-bold text-[#F3E9D6] truncate max-w-[170px]">
                {draft.displayName.trim() || 'Player'}
              </p>
              <p className="text-[11px] text-[#B8A990]">Visible in 3rd-person view</p>
            </div>

            <AvatarPreviewSvg avatar={draft} />

            {/* Camera View Toggle */}
            <div className="w-full">
              <label className="mb-1.5 flex items-center justify-center gap-1 text-[11px] font-semibold text-[#CFC2AA]">
                <Eye className="h-3.5 w-3.5 text-[#D4A65C]" />
                Camera View (Key V)
              </label>
              <div className="grid grid-cols-2 gap-1 rounded-lg border border-[#4D3F31] bg-[#1C1612] p-1">
                <button
                  type="button"
                  onClick={() => setViewDraft('first-person')}
                  className={`rounded-md py-1.5 text-xs font-semibold cursor-pointer ${
                    viewDraft === 'first-person'
                      ? 'bg-[#9C6C30] text-[#FDF6E8]'
                      : 'text-[#C8B9A0] hover:text-[#F3E9D6]'
                  }`}
                >
                  1st Person
                </button>
                <button
                  type="button"
                  onClick={() => setViewDraft('third-person')}
                  className={`rounded-md py-1.5 text-xs font-semibold cursor-pointer ${
                    viewDraft === 'third-person'
                      ? 'bg-[#9C6C30] text-[#FDF6E8]'
                      : 'text-[#C8B9A0] hover:text-[#F3E9D6]'
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
              <label className="block text-xs font-semibold text-[#D6C8AF]" htmlFor="avatar-name">
                Display Name
              </label>
              <input
                id="avatar-name"
                type="text"
                maxLength={20}
                value={draft.displayName}
                onChange={(e) => setDraft({ ...draft, displayName: e.target.value })}
                placeholder="Your builder name"
                className="mt-1.5 w-full rounded-lg border border-[#5B4B3A] bg-[#241D17] px-3 py-2 text-sm text-[#F3E9D6] focus:border-[#D4A65C] focus:outline-none"
              />
            </div>

            <div>
              <span className="block text-xs font-semibold text-[#D6C8AF]">Body Colour</span>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {BODY_COLORS.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    title={c.label}
                    onClick={() => setDraft({ ...draft, bodyColor: c.hex })}
                    className={`h-8 w-8 rounded-lg border-2 transition-transform cursor-pointer ${
                      draft.bodyColor === c.hex
                        ? 'border-[#E3B86A] scale-110'
                        : 'border-[#5A4B3A] hover:scale-105'
                    }`}
                    style={{ backgroundColor: c.hex }}
                    aria-label={`Body color ${c.label}`}
                  />
                ))}
              </div>
            </div>

            <div>
              <span className="block text-xs font-semibold text-[#D6C8AF]">
                Shirt Style &amp; Colour
              </span>
              <div className="mt-1.5 grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {SHIRT_STYLES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setDraft({ ...draft, shirtStyle: s.id })}
                    className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap ${
                      draft.shirtStyle === s.id
                        ? 'border-[#C99A4E] bg-[#3A2C1D] text-[#F6E9CE]'
                        : 'border-[#4D3F31] bg-[#241D17] text-[#C8B9A0] hover:bg-[#2F261E]'
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
                      draft.shirtColor === c.hex ? 'border-[#E3B86A] scale-110' : 'border-[#5A4B3A]'
                    }`}
                    style={{ backgroundColor: c.hex }}
                    aria-label={`Shirt color ${c.label}`}
                  />
                ))}
              </div>
            </div>

            <div>
              <span className="block text-xs font-semibold text-[#D6C8AF]">Hair &amp; Beard</span>
              <div className="mt-1.5 grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                {HAIR_STYLES.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => setDraft({ ...draft, hairStyle: h.id })}
                    className={`rounded-lg border px-2 py-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap ${
                      (draft.hairStyle ?? 'short') === h.id
                        ? 'border-[#C99A4E] bg-[#3A2C1D] text-[#F6E9CE]'
                        : 'border-[#4D3F31] bg-[#241D17] text-[#C8B9A0] hover:bg-[#2F261E]'
                    }`}
                  >
                    {h.label}
                  </button>
                ))}
              </div>
              <div className="mt-1.5 grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                {BEARD_STYLES.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setDraft({ ...draft, beardStyle: b.id })}
                    className={`rounded-lg border px-2 py-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap ${
                      (draft.beardStyle ?? 'none') === b.id
                        ? 'border-[#C99A4E] bg-[#3A2C1D] text-[#F6E9CE]'
                        : 'border-[#4D3F31] bg-[#241D17] text-[#C8B9A0] hover:bg-[#2F261E]'
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
              {showHairColors && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {HAIR_COLORS.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      title={c.label}
                      onClick={() => setDraft({ ...draft, hairColor: c.hex })}
                      className={`h-7 w-7 rounded-lg border-2 cursor-pointer ${
                        (draft.hairColor ?? '#5F4936') === c.hex
                          ? 'border-[#E3B86A] scale-110'
                          : 'border-[#5A4B3A]'
                      }`}
                      style={{ backgroundColor: c.hex }}
                      aria-label={`Hair color ${c.label}`}
                    />
                  ))}
                </div>
              )}
            </div>

            <div>
              <span className="block text-xs font-semibold text-[#D6C8AF]">Hat</span>
              <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                {HAT_STYLES.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => setDraft({ ...draft, hat: h.id })}
                    className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap ${
                      draft.hat === h.id
                        ? 'border-[#C99A4E] bg-[#3A2C1D] text-[#F6E9CE]'
                        : 'border-[#4D3F31] bg-[#241D17] text-[#C8B9A0] hover:bg-[#2F261E]'
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
                        draft.hatColor === c.hex ? 'border-[#E3B86A] scale-110' : 'border-[#5A4B3A]'
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

        <div className="flex items-center justify-end gap-2 border-t border-[#46392C] bg-[#231C16] px-6 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[#5B4B3A] bg-[#261F18] px-4 py-2 text-xs font-semibold text-[#D6C8AF] hover:bg-[#332920] cursor-pointer"
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
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#C99A4E]/75 bg-[#9C6C30] px-5 py-2 text-xs font-semibold text-[#FDF6E8] hover:bg-[#AE7A39] cursor-pointer"
          >
            <Check className="h-4 w-4" />
            Save Avatar
          </button>
        </div>
      </div>
    </div>
  );
};
