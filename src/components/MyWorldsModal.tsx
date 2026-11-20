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
      setStatusMessage(asNew ? 'Saved as a new world in your browser.' : 'World saved in your browser.');
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
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/55 p-4">
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="font-display text-xl font-bold text-slate-900">My Worlds</h2>
            <p className="text-xs text-slate-500">
              Saved privately in this browser · Share worlds with short export codes
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
            aria-label="Close My Worlds"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Segmented Tabs */}
        <div className="border-b border-slate-200 bg-slate-50 px-6 py-2.5">
          <div className="inline-flex items-center gap-1 rounded-lg bg-slate-200/75 p-1">
            <button
              type="button"
              onClick={() => setActiveTab('saved')}
              className={`rounded-md px-3.5 py-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap ${
                activeTab === 'saved'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Saved Worlds ({savedWorlds.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('share')}
              className={`rounded-md px-3.5 py-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap ${
                activeTab === 'share'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Export / Import Code
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('templates')}
              className={`rounded-md px-3.5 py-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap ${
                activeTab === 'templates'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Starter Templates
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {statusMessage && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-800">
              {statusMessage}
            </div>
          )}
          {errorMessage && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-800">
              {errorMessage}
            </div>
          )}

          {activeTab === 'saved' && (
            <>
              {inWorld && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <label
                    htmlFor="world-save-name"
                    className="block text-xs font-semibold text-slate-700"
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
                      className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                    />
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleSave(false)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer whitespace-nowrap"
                    >
                      <Save className="h-3.5 w-3.5" />
                      {currentWorldId ? 'Save Changes' : 'Save World'}
                    </button>
                    {currentWorldId && (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => handleSave(true)}
                        className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer whitespace-nowrap"
                      >
                        Save Copy
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-xs font-semibold text-slate-500">
                  Your Browser Worlds
                </h3>
                {savedWorlds.length === 0 ? (
                  <div className="mt-3 rounded-xl border border-dashed border-slate-300 p-8 text-center">
                    <p className="text-sm font-semibold text-slate-800">No saved worlds yet</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Build something in Play or Create mode, then save it here or import a shared code.
                    </p>
                  </div>
                ) : (
                  <div className="mt-3 divide-y divide-slate-200 rounded-xl border border-slate-200">
                    {savedWorlds.map((w) => (
                      <div
                        key={w.id}
                        className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-display text-sm font-bold text-slate-900">
                            {w.name}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            <span className="capitalize">{w.template}</span>
                            <span aria-hidden="true"> · </span>
                            <span className="font-mono-code">{w.blockCount.toLocaleString()}</span> blocks
                            <span aria-hidden="true"> · </span>
                            Updated {new Date(w.updatedAt).toLocaleDateString()}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => onLoadWorld(w.id, 'play')}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 cursor-pointer whitespace-nowrap"
                          >
                            <Compass className="h-3.5 w-3.5" />
                            Play
                          </button>
                          <button
                            type="button"
                            onClick={() => onLoadWorld(w.id, 'create')}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer whitespace-nowrap"
                          >
                            <Hammer className="h-3.5 w-3.5" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteWorld(w.id)}
                            title="Delete world"
                            className="rounded-lg border border-rose-200 bg-rose-50 p-1.5 text-rose-600 hover:bg-rose-100 cursor-pointer"
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
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-display text-sm font-bold text-slate-900">
                      Export Current World Code
                    </h3>
                    <p className="text-xs text-slate-500">
                      Creates a compact BH1 share string you can send to friends or save in a note.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerateExport}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer whitespace-nowrap"
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
                      className="font-mono-code w-full rounded-lg border border-slate-300 bg-slate-50 p-2.5 text-xs text-slate-800 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleCopyCode}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer"
                    >
                      {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied ? 'Copied to Clipboard' : 'Copy Code'}
                    </button>
                  </div>
                )}
              </div>

              {/* Import Section */}
              <div className="rounded-xl border border-slate-200 p-4">
                <h3 className="font-display text-sm font-bold text-slate-900">
                  Import a Shared World Code
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Paste any code starting with <span className="font-mono-code font-semibold">BH1:</span> to load it immediately.
                </p>
                <textarea
                  rows={3}
                  value={importInput}
                  onChange={(e) => setImportInput(e.target.value)}
                  placeholder="BH1:..."
                  className="font-mono-code mt-2.5 w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                />
                <div className="mt-2.5 flex justify-end">
                  <button
                    type="button"
                    disabled={importing || !importInput.trim()}
                    onClick={handleImport}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
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
                  className="flex flex-col justify-between rounded-xl border border-slate-200 p-4"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-slate-500 shrink-0" />
                      <h3 className="font-display text-sm font-bold text-slate-900">{tpl.name}</h3>
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
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
                      className="flex-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 cursor-pointer"
                    >
                      Play
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onStartTemplate(tpl.id, 'create');
                        onClose();
                      }}
                      className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer"
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
