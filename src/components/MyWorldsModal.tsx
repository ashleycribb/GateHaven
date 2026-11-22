import React, { useState } from 'react';
import {
  X,
  Save,
  Trash2,
  Share2,
  Download,
  Copy,
  Check,
  Compass,
  Hammer,
  Sparkles,
} from 'lucide-react';
import { SavedWorldMeta, WorldMode, WorldTemplateId } from '../types/blockhaven';
import { WORLD_TEMPLATES } from '../engine/worldGen';

interface MyWorldsModalProps {
  currentWorldId: string | null;
  currentWorldName: string;
  savedWorlds: SavedWorldMeta[];
  inWorld: boolean;
  onSaveCurrent: (name: string, saveAsNew: boolean) => Promise<void>;
  onLoadWorld: (id: string, mode: WorldMode) => Promise<void>;
  onDeleteWorld: (id: string) => Promise<void>;
  onStartTemplate: (template: WorldTemplateId, mode: WorldMode) => void;
  onExportCode: () => Promise<string>;
  onImportCode: (code: string) => Promise<void>;
  onClose: () => void;
}

export const MyWorldsModal: React.FC<MyWorldsModalProps> = ({
  currentWorldId,
  currentWorldName,
  savedWorlds,
  inWorld,
  onSaveCurrent,
  onLoadWorld,
  onDeleteWorld,
  onStartTemplate,
  onExportCode,
  onImportCode,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'saved' | 'share' | 'templates'>('saved');
  const [worldNameInput, setWorldNameInput] = useState(currentWorldName);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [exportCodeStr, setExportCodeStr] = useState('');
  const [copied, setCopied] = useState(false);
  const [importInput, setImportInput] = useState('');
  const [importing, setImporting] = useState(false);

  const handleSave = async (asNew: boolean) => {
    setSaving(true);
    setErrorMessage(null);
    try {
      await onSaveCurrent(worldNameInput.trim() || 'My Gate Haven World', asNew);
      setStatusMessage(
        asNew ? 'Saved as a new world in your browser.' : 'World saved in your browser.',
      );
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not save world.');
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateExport = async () => {
    setErrorMessage(null);
    setCopied(false);
    try {
      const code = await onExportCode();
      setExportCodeStr(code);
      setStatusMessage(`Export code ready (${code.length.toLocaleString()} characters).`);
    } catch {
      setErrorMessage('Failed to generate world code.');
    }
  };

  const handleCopyCode = async () => {
    if (!exportCodeStr) return;
    try {
      await navigator.clipboard.writeText(exportCodeStr);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setErrorMessage('Could not copy automatically — select the text and press Ctrl+C / Cmd+C.');
    }
  };

  const handleImport = async () => {
    if (!importInput.trim()) return;
    setImporting(true);
    setErrorMessage(null);
    try {
      await onImportCode(importInput);
      onClose();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Invalid world code.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div
      data-gamepad-scope="modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0D0A08]/80 p-4"
    >
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-[#65523D] bg-[#1C1713] text-[#EDE2CC] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#46392C] bg-[#231C16] px-6 py-4">
          <div>
            <h2 className="font-[var(--font-display)] text-xl font-bold text-[#F3E9D6]">
              My Worlds
            </h2>
            <p className="text-xs text-[#B8A990]">
              Saved privately in this browser · Share worlds with short export codes
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#B8A990] hover:bg-[#322820] hover:text-[#F3E9D6] cursor-pointer"
            aria-label="Close My Worlds"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Segmented Tabs */}
        <div className="border-b border-[#46392C] bg-[#1F1914] px-6 py-2.5">
          <div className="inline-flex items-center gap-1.5">
            <button
              type="button"
              data-modal-tab="true"
              data-active={activeTab === 'saved' ? 'true' : 'false'}
              onClick={() => setActiveTab('saved')}
              className={`rounded-lg border px-3.5 py-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap ${
                activeTab === 'saved'
                  ? 'border-[#C99A4E] bg-[#3A2C1D] text-[#F6E9CE]'
                  : 'border-[#4D3F31] bg-[#241D17] text-[#C8B9A0] hover:bg-[#2F261E]'
              }`}
            >
              Saved Worlds ({savedWorlds.length})
            </button>
            <button
              type="button"
              data-modal-tab="true"
              data-active={activeTab === 'share' ? 'true' : 'false'}
              onClick={() => setActiveTab('share')}
              className={`rounded-lg border px-3.5 py-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap ${
                activeTab === 'share'
                  ? 'border-[#C99A4E] bg-[#3A2C1D] text-[#F6E9CE]'
                  : 'border-[#4D3F31] bg-[#241D17] text-[#C8B9A0] hover:bg-[#2F261E]'
              }`}
            >
              Export / Import Code
            </button>
            <button
              type="button"
              data-modal-tab="true"
              data-active={activeTab === 'templates' ? 'true' : 'false'}
              onClick={() => setActiveTab('templates')}
              className={`rounded-lg border px-3.5 py-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap ${
                activeTab === 'templates'
                  ? 'border-[#C99A4E] bg-[#3A2C1D] text-[#F6E9CE]'
                  : 'border-[#4D3F31] bg-[#241D17] text-[#C8B9A0] hover:bg-[#2F261E]'
              }`}
            >
              Starter Templates
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {statusMessage && (
            <div className="rounded-lg border border-[#5F8052] bg-[#222D1F] px-3.5 py-2.5 text-xs font-medium text-[#CBE0BC]">
              {statusMessage}
            </div>
          )}
          {errorMessage && (
            <div className="rounded-lg border border-[#9F453B] bg-[#3A1E1B] px-3.5 py-2.5 text-xs font-medium text-[#F2BEB6]">
              {errorMessage}
            </div>
          )}

          {activeTab === 'saved' && (
            <>
              {inWorld && (
                <div className="rounded-xl border border-[#4D3F31] bg-[#241D17] p-4">
                  <label
                    htmlFor="world-save-name"
                    className="block text-xs font-semibold text-[#D6C8AF]"
                  >
                    Save Current World
                  </label>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <input
                      id="world-save-name"
                      type="text"
                      maxLength={32}
                      value={worldNameInput}
                      onChange={(e) => setWorldNameInput(e.target.value)}
                      placeholder="Give your world a name..."
                      className="flex-1 rounded-lg border border-[#5B4B3A] bg-[#1C1612] px-3 py-2 text-sm text-[#F3E9D6] focus:border-[#D4A65C] focus:outline-none"
                    />
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleSave(false)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#C99A4E]/75 bg-[#9C6C30] px-4 py-2 text-xs font-semibold text-[#FDF6E8] hover:bg-[#AE7A39] disabled:opacity-50 cursor-pointer whitespace-nowrap"
                    >
                      <Save className="h-3.5 w-3.5" />
                      {currentWorldId ? 'Save Changes' : 'Save World'}
                    </button>
                    {currentWorldId && (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => handleSave(true)}
                        className="rounded-lg border border-[#5B4B3A] bg-[#2B231C] px-3.5 py-2 text-xs font-semibold text-[#E8DCC5] hover:bg-[#382D24] cursor-pointer whitespace-nowrap"
                      >
                        Save Copy
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-xs font-semibold text-[#B8A990]">Your Browser Worlds</h3>
                {savedWorlds.length === 0 ? (
                  <div className="mt-3 rounded-xl border border-dashed border-[#5A4B3A] bg-[#221B16] p-8 text-center">
                    <p className="text-sm font-semibold text-[#F3E9D6]">No saved worlds yet</p>
                    <p className="mt-1 text-xs text-[#B8A990]">
                      Build something in Play or Create mode, then save it here or import a shared
                      code.
                    </p>
                  </div>
                ) : (
                  <div className="mt-3 divide-y divide-[#3F3327] rounded-xl border border-[#4D3F31] bg-[#241D17]">
                    {savedWorlds.map((w) => (
                      <div
                        key={w.id}
                        className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-[var(--font-display)] text-sm font-bold text-[#F3E9D6]">
                            {w.name}
                          </p>
                          <p className="mt-0.5 text-xs text-[#B8A990]">
                            <span className="capitalize">{w.template}</span>
                            <span aria-hidden="true"> · </span>
                            <span className="font-mono-code">{w.blockCount.toLocaleString()}</span>{' '}
                            blocks
                            <span aria-hidden="true"> · </span>
                            Updated {new Date(w.updatedAt).toLocaleDateString()}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => onLoadWorld(w.id, 'play')}
                            className="inline-flex items-center gap-1 rounded-lg border border-[#C99A4E]/75 bg-[#9C6C30] px-3 py-1.5 text-xs font-semibold text-[#FDF6E8] hover:bg-[#AE7A39] cursor-pointer whitespace-nowrap"
                          >
                            <Compass className="h-3.5 w-3.5" />
                            Play
                          </button>
                          <button
                            type="button"
                            onClick={() => onLoadWorld(w.id, 'create')}
                            className="inline-flex items-center gap-1 rounded-lg border border-[#5B4B3A] bg-[#2B231C] px-3 py-1.5 text-xs font-semibold text-[#E8DCC5] hover:bg-[#382D24] cursor-pointer whitespace-nowrap"
                          >
                            <Hammer className="h-3.5 w-3.5" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteWorld(w.id)}
                            title="Delete world"
                            className="rounded-lg border border-[#8E4036] bg-[#3A1E1B] p-1.5 text-[#E8A398] hover:bg-[#4B2622] cursor-pointer"
                            aria-label={`Delete ${w.name}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === 'share' && (
            <div className="space-y-6">
              {/* Export Section */}
              <div className="rounded-xl border border-[#4D3F31] bg-[#241D17] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-[var(--font-display)] text-sm font-bold text-[#F3E9D6]">
                      Export Current World Code
                    </h3>
                    <p className="text-xs text-[#B8A990]">
                      Creates a compact BH1 share string you can send to friends or save in a note.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerateExport}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#C99A4E]/75 bg-[#9C6C30] px-3.5 py-2 text-xs font-semibold text-[#FDF6E8] hover:bg-[#AE7A39] cursor-pointer whitespace-nowrap"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    Generate Code
                  </button>
                </div>

                {exportCodeStr && (
                  <div className="mt-3 space-y-2">
                    <textarea
                      readOnly
                      rows={3}
                      value={exportCodeStr}
                      className="font-mono-code w-full rounded-lg border border-[#5B4B3A] bg-[#1C1612] p-2.5 text-xs text-[#E8DCC5] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleCopyCode}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#6A5743] bg-[#30261D] px-3.5 py-1.5 text-xs font-semibold text-[#F1E4CD] hover:bg-[#3E3125] cursor-pointer"
                    >
                      {copied ? (
                        <Check className="h-3.5 w-3.5 text-[#98B986]" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      {copied ? 'Copied to Clipboard' : 'Copy Code'}
                    </button>
                  </div>
                )}
              </div>

              {/* Import Section */}
              <div className="rounded-xl border border-[#4D3F31] bg-[#241D17] p-4">
                <h3 className="font-[var(--font-display)] text-sm font-bold text-[#F3E9D6]">
                  Import a Shared World Code
                </h3>
                <p className="mt-0.5 text-xs text-[#B8A990]">
                  Paste any code starting with{' '}
                  <span className="font-mono-code font-semibold text-[#D9AD62]">BH1:</span> to load
                  it immediately.
                </p>
                <textarea
                  rows={3}
                  value={importInput}
                  onChange={(e) => setImportInput(e.target.value)}
                  placeholder="BH1:..."
                  className="font-mono-code mt-2.5 w-full rounded-lg border border-[#5B4B3A] bg-[#1C1612] p-2.5 text-xs text-[#F3E9D6] focus:border-[#D4A65C] focus:outline-none"
                />
                <div className="mt-2.5 flex justify-end">
                  <button
                    type="button"
                    disabled={importing || !importInput.trim()}
                    onClick={handleImport}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#C99A4E]/75 bg-[#9C6C30] px-4 py-2 text-xs font-semibold text-[#FDF6E8] hover:bg-[#AE7A39] disabled:opacity-50 cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" />
                    {importing ? 'Importing...' : 'Load Shared World'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'templates' && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {WORLD_TEMPLATES.map((tpl) => (
                <div
                  key={tpl.id}
                  className="flex flex-col justify-between rounded-xl border border-[#4D3F31] bg-[#241D17] p-4"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-[#D4A65C] shrink-0" />
                      <h3 className="font-[var(--font-display)] text-sm font-bold text-[#F3E9D6]">
                        {tpl.name}
                      </h3>
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-[#CFC2AA]">
                      {tpl.description}
                    </p>
                  </div>

                  <div className="mt-4 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onStartTemplate(tpl.id, 'play');
                        onClose();
                      }}
                      className="flex-1 rounded-lg border border-[#C99A4E]/75 bg-[#9C6C30] px-3 py-1.5 text-xs font-semibold text-[#FDF6E8] hover:bg-[#AE7A39] cursor-pointer"
                    >
                      Play
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onStartTemplate(tpl.id, 'create');
                        onClose();
                      }}
                      className="flex-1 rounded-lg border border-[#5B4B3A] bg-[#2B231C] px-3 py-1.5 text-xs font-semibold text-[#E8DCC5] hover:bg-[#382D24] cursor-pointer"
                    >
                      Create Here
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
