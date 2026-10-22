import React, { useState, useEffect } from 'react';
import { testGeminiApiKey } from '../services/visualGrounding';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onKeySaved: (key: string) => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({
  isOpen,
  onClose,
  onKeySaved,
}) => {
  const [keyInput, setKeyInput] = useState('');
  const [status, setStatus] = useState('');
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const saved = localStorage.getItem('gemini_api_key') || '';
      setKeyInput(saved);
      setStatus(
        saved
          ? 'A key is saved in this browser.'
          : 'No browser key saved. Offline heuristics active, or add key for live Gemini multimodal.'
      );
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveAndTest = async () => {
    const trimmed = keyInput.trim();
    if (!trimmed) {
      setStatus('Paste an API key first.');
      return;
    }

    setTesting(true);
    setStatus('Testing API key with Gemini...');
    try {
      const result = await testGeminiApiKey(trimmed);
      setStatus(result.message);
      if (result.valid) {
        localStorage.setItem('gemini_api_key', trimmed);
        onKeySaved(trimmed);
      }
    } catch (e: any) {
      setStatus(`Could not validate: ${e?.message || e}`);
    } finally {
      setTesting(false);
    }
  };

  const handleClear = () => {
    localStorage.removeItem('gemini_api_key');
    setKeyInput('');
    setStatus('Browser key cleared.');
    onKeySaved('');
  };

  return (
    <div
      className="drawer-backdrop"
      id="apiKeyModal"
      style={{ display: 'flex' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="drawer-card key-modal-card">
        <div className="drawer-header">
          <div>
            <h3>Gemini API Key</h3>
            <p>Used for live visual grounding and multimodal reasoning</p>
          </div>
          <button
            className="drawer-close"
            id="btnCloseApiKey"
            type="button"
            onClick={onClose}
          >
            &times;
          </button>
        </div>
        <div className="key-modal-body">
          <input
            type="password"
            id="apiKeyInput"
            className="key-input"
            placeholder="Paste your Gemini API key"
            autoComplete="off"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveAndTest();
            }}
          />
          <p className="key-hint">
            Get a free key from Google AI Studio. Saved locally in this browser.
          </p>
          <div className="key-modal-actions">
            <button
              className="btn-drawer-upload"
              id="btnSaveApiKey"
              type="button"
              disabled={testing}
              onClick={handleSaveAndTest}
            >
              {testing ? 'Testing...' : 'Save & Test'}
            </button>
            <button
              className="think-pill"
              id="btnClearApiKey"
              type="button"
              onClick={handleClear}
            >
              Clear
            </button>
          </div>
          <p className="key-status" id="apiKeyStatus">
            {status}
          </p>
        </div>
      </div>
    </div>
  );
};
