import React, { useRef } from 'react';
import { SamplePreset } from '../types';

interface SamplesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  samples: SamplePreset[];
  onSelectSample: (sample: SamplePreset) => void;
  onUploadSample: (file: File) => void;
}

export const SamplesDrawer: React.FC<SamplesDrawerProps> = ({
  isOpen,
  onClose,
  samples,
  onSelectSample,
  onUploadSample,
}) => {
  const uploadInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  return (
    <div
      className="drawer-backdrop"
      id="samplesDrawer"
      style={{ display: 'flex' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="drawer-card drawer-card-lg">
        <div className="drawer-header">
          <div>
            <h3>Sample Gallery</h3>
            <p>Pick an image preset or upload your own to samples/</p>
          </div>
          <button
            className="drawer-close"
            type="button"
            onClick={onClose}
          >
            &times;
          </button>
        </div>

        <div className="drawer-actions">
          <input
            ref={uploadInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                onUploadSample(e.target.files[0]);
                e.target.value = '';
              }
            }}
          />
          <button
            className="btn-drawer-upload"
            type="button"
            onClick={() => uploadInputRef.current?.click()}
          >
            + Add New Image to Samples
          </button>
        </div>

        <div className="drawer-grid">
          {samples.map((sample) => (
            <div
              key={sample.id}
              className="drawer-item-card"
              onClick={() => {
                onSelectSample(sample);
                onClose();
              }}
            >
              <img
                src={sample.image_url}
                alt={sample.title}
                className="drawer-item-thumb"
                loading="lazy"
              />
              <div className="drawer-item-info">
                <div className="drawer-item-title">
                  {sample.icon} {sample.title}
                </div>
                <div className="drawer-item-sub">{sample.question}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
