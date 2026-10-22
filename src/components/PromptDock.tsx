import React, { useRef, useEffect } from 'react';
import { DetectionMode } from '../types';

interface PromptDockProps {
  attachedFile: { file: File | Blob; previewUrl: string; name: string } | null;
  onRemoveAttachment: () => void;
  onAttachFile: (file: File) => void;
  onOpenCamera: () => void;
  detectionMode: DetectionMode;
  onToggleMode: () => void;
  prompt: string;
  onPromptChange: (val: string) => void;
  onSend: () => void;
  isLoading: boolean;
  isListening: boolean;
  onToggleMic: () => void;
}

const MODE_LABELS: Record<DetectionMode, string> = {
  task_focused: 'TASK-FOCUSED',
  all_objects: 'ALL OBJECTS',
  hybrid: 'HYBRID SPOTLIGHT',
};

export const PromptDock: React.FC<PromptDockProps> = ({
  attachedFile,
  onRemoveAttachment,
  onAttachFile,
  onOpenCamera,
  detectionMode,
  onToggleMode,
  prompt,
  onPromptChange,
  onSend,
  isLoading,
  isListening,
  onToggleMic,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        140
      )}px`;
    }
  }, [prompt]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="chat-bottom-dock">
      {attachedFile && (
        <div className="attachment-preview-bar" id="attachmentPreviewBar" style={{ display: 'flex' }}>
          <div className="attached-img-chip">
            <img
              id="attachedThumb"
              src={attachedFile.previewUrl}
              alt="Attachment"
            />
            <span className="attached-filename" id="attachedFilename">
              {attachedFile.name}
            </span>
            <button
              className="remove-attach-btn"
              id="btnRemoveAttach"
              title="Remove image"
              type="button"
              onClick={onRemoveAttachment}
            >
              &times;
            </button>
          </div>
        </div>
      )}

      <div className="prompt-capsule-wrap">
        <div className="prompt-capsule">
          <input
            ref={fileInputRef}
            type="file"
            id="imageFileInput"
            accept="image/jpeg,image/png,image/webp,image/bmp"
            style={{ display: 'none' }}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                onAttachFile(e.target.files[0]);
                e.target.value = '';
              }
            }}
          />

          <button
            className="capsule-icon-btn attach-btn"
            id="btnAttachImage"
            type="button"
            title="Attach sensor image"
            onClick={() => fileInputRef.current?.click()}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            >
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>

          <button
            className="capsule-icon-btn camera-btn"
            id="btnCamera"
            type="button"
            title="Live optical feed"
            onClick={onOpenCamera}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
              <circle cx="12" cy="13" r="4"></circle>
            </svg>
          </button>

          <div className="mode-dropdown-wrap">
            <button
              className="think-pill"
              id="btnModeToggle"
              type="button"
              title="Toggle Grounding Mode"
              onClick={onToggleMode}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M12 16v-4"></path>
                <path d="M12 8h.01"></path>
              </svg>
              <span id="lblActiveMode">{MODE_LABELS[detectionMode]}</span>
            </button>
          </div>

          <textarea
            ref={textareaRef}
            id="promptInput"
            className="prompt-textarea"
            rows={1}
            placeholder="Ask question about image or object telemetry..."
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            onKeyDown={handleKeyDown}
          ></textarea>

          <button
            className={`capsule-icon-btn mic-btn ${
              isListening ? 'listening' : ''
            }`}
            id="btnMic"
            type="button"
            title={isListening ? 'Stop listening' : 'Voice dictation'}
            onClick={onToggleMic}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
              <line x1="12" y1="19" x2="12" y2="23"></line>
              <line x1="8" y1="23" x2="16" y2="23"></line>
            </svg>
          </button>

          <button
            className="send-arrow-btn"
            id="btnSend"
            type="button"
            title="Execute query"
            disabled={isLoading}
            onClick={onSend}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="19" x2="12" y2="5"></line>
              <polyline points="5 12 12 5 19 12"></polyline>
            </svg>
          </button>
        </div>
      </div>

    </div>
  );
};
