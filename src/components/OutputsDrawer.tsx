import React from 'react';
import { GroundingResult } from '../types';

interface OutputRecord {
  id: string;
  timestamp: number;
  result: GroundingResult;
}

interface OutputsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  outputs: OutputRecord[];
}

export const OutputsDrawer: React.FC<OutputsDrawerProps> = ({
  isOpen,
  onClose,
  outputs,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="drawer-backdrop"
      id="outputsDrawer"
      style={{ display: 'flex' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="drawer-card drawer-card-lg">
        <div className="drawer-header">
          <div>
            <h3>Generated Outputs</h3>
            <p>Stored grounding highlights, detections, and answers</p>
          </div>
          <button className="drawer-close" type="button" onClick={onClose}>
            &times;
          </button>
        </div>

        {outputs.length === 0 ? (
          <div
            style={{
              padding: '48px 24px',
              textAlign: 'center',
              color: 'var(--text-secondary)',
              fontSize: '0.95rem',
            }}
          >
            No outputs generated yet. Attach an image and ask a question to see
            results here!
          </div>
        ) : (
          <div className="drawer-grid">
            {outputs.map((out) => {
              const res = out.result;
              return (
                <div key={out.id} className="drawer-item-card">
                  <img
                    src={res.annotated_image}
                    alt={res.question}
                    className="drawer-item-thumb"
                  />
                  <div className="drawer-item-info">
                    <div className="drawer-item-title">{res.question}</div>
                    <div
                      className="drawer-item-sub"
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginTop: '6px',
                      }}
                    >
                      <span>
                        {res.total_detected} detected &bull; {res.image_dims.width}×
                        {res.image_dims.height}
                      </span>
                      <a
                        href={res.annotated_image}
                        download={`grounding_${out.id}.jpg`}
                        style={{
                          color: '#f97316',
                          fontWeight: 700,
                          textDecoration: 'none',
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        Save ↓
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
