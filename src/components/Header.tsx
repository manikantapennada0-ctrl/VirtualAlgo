import React from 'react';

interface HeaderProps {
  onReset: () => void;
  onOpenApiKey: () => void;
  hasApiKey: boolean;
  onOpenSamples: () => void;
  onOpenOutputs: () => void;
  samplesCount: number;
  outputsCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  onReset,
  onOpenApiKey,
  hasApiKey,
  onOpenSamples,
  onOpenOutputs,
  samplesCount,
  outputsCount,
}) => {
  return (
    <header className="chat-header">
      <div className="nav-brand-section">
        <div
          className="brand-logo-area"
          id="brandLogoHome"
          title="Reset VisualAlgo"
          onClick={onReset}
        >
          <div className="brand-icon">
            {/* Rocket / Satellite Inspired Brand Mark */}
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"></path>
              <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"></path>
              <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"></path>
              <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"></path>
            </svg>
            <div className="brand-icon-pulse"></div>
          </div>
          <div className="brand-text-block">
            <span className="brand-title">
              <span className="brand-title-cyan">VISUAL</span>
              <span className="brand-title-saffron">ALGO</span>
            </span>
          </div>
        </div>
      </div>

      <div className="nav-center-menu">
        <button
          className="nav-tab"
          type="button"
          onClick={onOpenSamples}
          title="Browse Sample Library"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <circle cx="8.5" cy="8.5" r="1.5"></circle>
            <polyline points="21 15 16 10 5 21"></polyline>
          </svg>
          <span>SAMPLES</span>
          <span className="nav-tab-badge">{samplesCount}</span>
        </button>

        <button
          className="nav-tab"
          type="button"
          onClick={onOpenOutputs}
          title="View Generated Outputs"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
          </svg>
          <span>OUTPUTS</span>
          {outputsCount > 0 && (
            <span className="nav-tab-badge saffron">{outputsCount}</span>
          )}
        </button>
      </div>

      <div className="nav-actions-section">
        <button
          className="nav-cta-btn"
          id="btnApiKey"
          type="button"
          title="Configure Gemini API key"
          onClick={onOpenApiKey}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
          </svg>
          <span>{hasApiKey ? 'API KEY ACTIVE' : 'API KEY'}</span>
        </button>

        <div className="telemetry-badges">
          <div className="telemetry-chip gemini-chip" title="Gemini Vision">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="m12 0 2.8 9.2L24 12l-9.2 2.8L12 24l-2.8-9.2L0 12l9.2-2.8z" />
            </svg>
            <span>GEMINI FLASH</span>
          </div>
          <div className="telemetry-chip opencv-chip" title="OpenCV Grounding">
            <span className="telemetry-dot"></span>
            <span>OPENCV</span>
          </div>
        </div>
      </div>
    </header>
  );
};
