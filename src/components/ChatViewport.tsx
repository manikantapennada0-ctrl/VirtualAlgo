import React, { useEffect, useRef } from 'react';
import { ChatMessage } from '../types';

interface ChatViewportProps {
  messages: ChatMessage[];
  onSelectPromptSuggestion: (text: string) => void;
}

const QUICK_SUGGESTIONS = [
  'Detect and highlight all objects in this image',
  'What is the primary subject in the scene?',
  'Identify any text, signs, or labels',
  'Locate and box all vehicles or pedestrians',
];

export const ChatViewport: React.FC<ChatViewportProps> = ({
  messages,
  onSelectPromptSuggestion,
}) => {
  const viewportRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (viewportRef.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <section className="chat-viewport" id="chatViewport" ref={viewportRef}>
      <div className="chat-messages" id="chatMessages">
        {messages.length === 0 ? (
          <div className="workspace-hero" id="workspaceHero">
            {/* Celestial Planetary Glow */}
            <div className="cosmic-planet-glow"></div>
            <div className="cosmic-dust-particles"></div>

            {/* Space Hackathon Inspired Title */}
            <div className="hero-cosmic-title-wrap">
              <div className="hero-title-main">
                <span className="text-cyan">VISU</span>
                <span className="rocket-chevron-glyph" aria-hidden="true">
                  <svg width="42" height="74" viewBox="0 0 42 74" fill="none">
                    <path
                      d="M21 0L42 74H28L21 44L14 74H0L21 0Z"
                      fill="url(#chevronGradient)"
                    />
                    <defs>
                      <linearGradient
                        id="chevronGradient"
                        x1="21"
                        y1="0"
                        x2="21"
                        y2="74"
                        gradientUnits="userSpaceOnUse"
                      >
                        <stop stopColor="#FFAA00" />
                        <stop offset="0.6" stopColor="#FF7700" />
                        <stop offset="1" stopColor="#FF4400" />
                      </linearGradient>
                    </defs>
                  </svg>
                </span>
                <span className="text-saffron">L</span>
                <span className="text-white"> ALGO</span>
              </div>
              <div className="hero-title-sub">
                TASK-DRIVEN VISION AI &bull; OBJECT GROUNDING 2026
              </div>
            </div>

            <p className="hero-subline">
              Identifying the Most Relevant Visual Information from a Given Task.
              Powered by Multimodal Gemini Vision reasoning & OpenCV telemetry highlighting.
            </p>

            <div className="hero-suggestions-title">MISSION INQUIRY PRESETS</div>
            <div className="hero-suggestions-row">
              {QUICK_SUGGESTIONS.map((suggestion, index) => (
                <button
                  key={index}
                  type="button"
                  className="suggestion-pill-btn"
                  onClick={() => onSelectPromptSuggestion(suggestion)}
                >
                  <span className="suggestion-bullet">&bull;</span>
                  <span>{suggestion}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            if (msg.sender === 'user') {
              return (
                <div key={msg.id} className="message-item user">
                  <div className="msg-bubble">
                    <div className="msg-user-header">MISSION QUERY</div>
                    <div>{msg.text}</div>
                  </div>
                </div>
              );
            }

            if (msg.isLoading) {
              return (
                <div key={msg.id} className="message-item bot">
                  <div className="msg-bubble">
                    <div className="loading-bubble">
                      <div className="pulse-spinner"></div>
                      <span>EXTRACTING SENSOR FEEDS & GROUNDING COORDINATES...</span>
                    </div>
                  </div>
                </div>
              );
            }

            if (msg.error) {
              return (
                <div key={msg.id} className="message-item bot">
                  <div className="msg-bubble">
                    <div className="msg-error-banner">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                      </svg>
                      <span>{msg.error}</span>
                    </div>
                  </div>
                </div>
              );
            }

            if (msg.result) {
              const res = msg.result;
              const dims = res.image_dims || { width: 0, height: 0 };
              return (
                <div key={msg.id} className="message-item bot">
                  <div className="msg-bubble">
                    <div className="bot-telemetry-header">
                      <span className="telemetry-badge-pulse"></span>
                      <span>TELEMETRY GROUNDING REPORT</span>
                    </div>

                    <div className="bot-answer-text">
                      <span className="answer-badge-label">ANSWER:</span> {res.answer}
                    </div>

                    {/* Dedicated List of Detected Object Names */}
                    {res.detected_objects && res.detected_objects.length > 0 && (
                      <div className="bot-detected-objects-box">
                        <div className="detected-objects-title">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                            <circle cx="8.5" cy="8.5" r="1.5"></circle>
                            <polyline points="21 15 16 10 5 21"></polyline>
                          </svg>
                          <span>IDENTIFIED OBJECTS & ENTITIES ({res.detected_objects.length}):</span>
                        </div>
                        <div className="detected-objects-list">
                          {res.detected_objects.map((obj) => (
                            <div key={obj.id} className="detected-object-chip">
                              <span className="chip-indicator"></span>
                              <strong className="chip-name">{obj.label}</strong>
                              <span className="chip-conf">{Math.round(obj.confidence * 100)}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {res.relevant_visual_info ? (
                      <div className="bot-visual-reasoning-card">
                        <div className="reasoning-label">ATTENTION FOCUS & MASKING:</div>
                        <div>{res.relevant_visual_info}</div>
                      </div>
                    ) : null}

                    <div className="msg-result-card">
                      <div className="msg-result-img-wrap">
                        <img
                          src={res.annotated_image}
                          alt="OpenCV highlighted result"
                        />
                      </div>
                      <div className="msg-result-footer">
                        <div className="msg-stats-chips">
                          <span className="msg-stat-chip">
                            DETECTED: {res.total_detected} ENTITIES
                          </span>
                          <span className="msg-stat-chip">
                            {dims.width} × {dims.height}PX
                          </span>
                          <span className="msg-stat-chip source">
                            {res.source.toUpperCase()}
                          </span>
                        </div>
                        <a
                          href={res.annotated_image}
                          download={`grounding_telemetry_${Date.now()}.jpg`}
                          className="btn-msg-download"
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                          </svg>
                          <span>EXPORT IMAGE</span>
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            return null;
          })
        )}
      </div>
    </section>
  );
};
