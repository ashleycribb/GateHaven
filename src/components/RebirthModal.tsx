import React, { useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { AvatarConfig } from '../types/blockhaven';
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
  const [draft, setDraft] = useState<AvatarConfig>({
    hairStyle: 'short',
    beardStyle: 'none',
    hairColor: '#5F4936',
    ...initialAvatar,
  });

  const showHairColors =
    (draft.hairStyle && draft.hairStyle !== 'bald') ||
    (draft.beardStyle && draft.beardStyle !== 'none');

  return (
    <div
      data-gamepad-scope="modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0D0A08]/82 p-4"
    >
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-[#6B5740] bg-[#1C1713] text-[#EDE2CC] shadow-2xl">
        {/* Character Awakening Header */}
        <div className="border-b border-[#46392C] bg-[#231C16] px-6 py-5">
          <p className="text-xs font-semibold tracking-wide text-[#D4A65C]">
            Character Creation · Elderglen
          </p>
          <h2 className="mt-1 font-[var(--font-display)] text-2xl font-bold tracking-tight text-[#F3E9D6]">
            Begin your adventure in Elderglen
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#CFC2AA]">
            You arrive beside the Awakening Shrine ready to chart your own path. You start with{' '}
            <span className="font-semibold text-[#F3E9D6]">no class</span> — your weapons, skills,
            builds, and companions will shape the class recommended for you at Level 5.
          </p>
        </div>

        {/* Body */}
        <div className="grid flex-1 grid-cols-1 gap-6 overflow-y-auto p-6 md:grid-cols-[240px_1fr]">
          {/* Left: Guide Sera + Live Humanoid Preview */}
          <div className="flex flex-col gap-4">
            <div className="flex flex-col items-center rounded-xl border border-[#4E4032] bg-[#241D17] p-4">
              <AvatarPreviewSvg avatar={draft} className="h-44 w-36" />
              <p className="mt-2 font-[var(--font-display)] text-sm font-bold text-[#F3E9D6]">
                {draft.displayName.trim() || 'Traveler'}
              </p>
              <p className="text-xs text-[#B8A990]">Lv 1 · Unawakened · PvE Safe</p>
            </div>

            <div className="rounded-xl border border-[#4E4032] bg-[#241D17] p-3.5">
              <p className="text-xs font-semibold text-[#8FB37C]">Sera · Shrine Keeper</p>
              <p className="mt-1 text-xs leading-relaxed text-[#CFC2AA]">
                “Speak with me beside the Shrine when you wake. I’ll help you bind your gear and
                introduce you to Bram, Kael, and Lyra.”
              </p>
            </div>
          </div>

          {/* Right: Customization Controls */}
          <div className="space-y-4">
            <div>
              <label htmlFor="rebirth-name" className="block text-xs font-semibold text-[#D6C8AF]">
                Traveler Name
              </label>
              <input
                id="rebirth-name"
                type="text"
                maxLength={20}
                value={draft.displayName}
                onChange={(e) => setDraft((d) => ({ ...d, displayName: e.target.value }))}
                placeholder="Enter your name"
                className="mt-1.5 w-full rounded-lg border border-[#5B4B3A] bg-[#241D17] px-3.5 py-2 text-sm text-[#F3E9D6] focus:border-[#D4A65C] focus:outline-none"
              />
            </div>

            <div>
              <span className="block text-xs font-semibold text-[#D6C8AF]">Skin Tone</span>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {BODY_COLORS.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, bodyColor: c.hex }))}
                    title={c.label}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-transform hover:scale-105 cursor-pointer ${
                      draft.bodyColor === c.hex
                        ? 'border-[#E3B86A] ring-2 ring-[#D4A65C]/50'
                        : 'border-[#5A4B3A]'
                    }`}
                    style={{ backgroundColor: c.hex }}
                  >
                    {draft.bodyColor === c.hex && <Check className="h-3.5 w-3.5 text-[#1C1611]" />}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="block text-xs font-semibold text-[#D6C8AF]">Tunic Color &amp; Style</span>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {SHIRT_COLORS.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, shirtColor: c.hex }))}
                    title={c.label}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-transform hover:scale-105 cursor-pointer ${
                      draft.shirtColor === c.hex
                        ? 'border-[#E3B86A] ring-2 ring-[#D4A65C]/50'
                        : 'border-[#5A4B3A]'
                    }`}
                    style={{ backgroundColor: c.hex }}
                  >
                    {draft.shirtColor === c.hex && <Check className="h-3.5 w-3.5 text-[#FDF6E8]" />}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {SHIRT_STYLES.map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, shirtStyle: st.id }))}
                    className={`whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                      draft.shirtStyle === st.id
                        ? 'border-[#C99A4E] bg-[#3A2C1D] text-[#F6E9CE]'
                        : 'border-[#4D3F31] bg-[#241D17] text-[#C8B9A0] hover:bg-[#2F261E]'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="block text-xs font-semibold text-[#D6C8AF]">Hair &amp; Beard</span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {HAIR_STYLES.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, hairStyle: h.id }))}
                    className={`whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                      (draft.hairStyle ?? 'short') === h.id
                        ? 'border-[#C99A4E] bg-[#3A2C1D] text-[#F6E9CE]'
                        : 'border-[#4D3F31] bg-[#241D17] text-[#C8B9A0] hover:bg-[#2F261E]'
                    }`}
                  >
                    {h.label}
                  </button>
                ))}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {BEARD_STYLES.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, beardStyle: b.id }))}
                    className={`whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
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
                      onClick={() => setDraft((d) => ({ ...d, hairColor: c.hex }))}
                      title={c.label}
                      className={`h-7 w-7 rounded-md border cursor-pointer ${
                        (draft.hairColor ?? '#5F4936') === c.hex
                          ? 'border-[#E3B86A] ring-2 ring-[#D4A65C]/50'
                          : 'border-[#5A4B3A]'
                      }`}
                      style={{ backgroundColor: c.hex }}
                    />
                  ))}
                </div>
              )}
            </div>

            <div>
              <span className="block text-xs font-semibold text-[#D6C8AF]">Headgear</span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {HAT_STYLES.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, hat: h.id }))}
                    className={`whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
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
                      onClick={() => setDraft((d) => ({ ...d, hatColor: c.hex }))}
                      title={c.label}
                      className={`h-7 w-7 rounded-md border cursor-pointer ${
                        draft.hatColor === c.hex
                          ? 'border-[#E3B86A] ring-2 ring-[#D4A65C]/50'
                          : 'border-[#5A4B3A]'
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
        <div className="flex items-center justify-between border-t border-[#46392C] bg-[#231C16] px-6 py-4">
          <button
            type="button"
            onClick={onCancel}
            className="whitespace-nowrap rounded-lg border border-[#5B4B3A] bg-[#261F18] px-4 py-2 text-xs font-semibold text-[#D6C8AF] transition-colors hover:bg-[#332920] cursor-pointer"
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
            className="flex items-center gap-2 whitespace-nowrap rounded-lg border border-[#C99A4E]/75 bg-[#9C6C30] px-5 py-2.5 text-sm font-bold text-[#FDF6E8] transition-colors hover:bg-[#AE7A39] cursor-pointer"
          >
            Wake in Elderglen
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
