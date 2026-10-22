import React, { useRef, useState, useEffect } from 'react';

interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
}

export const CameraModal: React.FC<CameraModalProps> = ({
  isOpen,
  onClose,
  onCapture,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fallbackInputRef = useRef<HTMLInputElement>(null);

  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  const [status, setStatus] = useState<'idle' | 'starting' | 'live' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('Initializing camera...');
  const [canSnap, setCanSnap] = useState(false);

  useEffect(() => {
    if (isOpen) {
      requestCameraAccess();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, facing]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCanSnap(false);
    setStatus('idle');
  };

  const requestCameraAccess = async () => {
    stopCamera();
    setStatus('starting');
    setStatusMessage('Requesting camera permission...');
    setCanSnap(false);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setStatus('error');
      setStatusMessage('Live camera capture is not supported in this browser environment.');
      return;
    }

    // Try progressive fallback constraints
    const constraintAttempts: MediaStreamConstraints[] = [
      {
        audio: false,
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      },
      {
        audio: false,
        video: {
          facingMode: facing,
        },
      },
      {
        audio: false,
        video: true,
      },
    ];

    let activeStream: MediaStream | null = null;
    let lastError: any = null;

    for (const constraints of constraintAttempts) {
      try {
        activeStream = await navigator.mediaDevices.getUserMedia(constraints);
        if (activeStream) break;
      } catch (err: any) {
        lastError = err;
      }
    }

    if (activeStream) {
      streamRef.current = activeStream;
      if (videoRef.current) {
        videoRef.current.srcObject = activeStream;
        try {
          await videoRef.current.play();
        } catch (_) {
          // Play might require user interaction in some browsers
        }
      }
      setStatus('live');
      setStatusMessage('Camera feed active. Align subject and capture.');
      setCanSnap(true);
    } else {
      setStatus('error');
      console.warn('Camera access failure:', lastError);

      if (lastError?.name === 'NotAllowedError' || lastError?.name === 'PermissionDeniedError') {
        setStatusMessage(
          'Camera access blocked by browser. Click the lock/camera icon in your URL address bar to enable permissions, or click "Request Access" below.'
        );
      } else if (lastError?.name === 'NotFoundError' || lastError?.name === 'DevicesNotFoundError') {
        setStatusMessage('No camera device detected on this system. You can upload an image directly.');
      } else if (lastError?.name === 'NotReadableError') {
        setStatusMessage('Camera is in use by another application. Close other camera apps and retry.');
      } else {
        setStatusMessage(`Could not access camera: ${lastError?.message || 'Permission needed'}. Click "Request Access" to prompt browser.`);
      }
    }
  };

  const handleSnap = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, width, height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const file = new File([blob], `live-capture-${stamp}.jpg`, {
          type: 'image/jpeg',
        });
        onCapture(file);
        stopCamera();
        onClose();
      },
      'image/jpeg',
      0.9
    );
  };

  const handleFlip = () => {
    setFacing((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  const handleFallbackFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onCapture(e.target.files[0]);
      stopCamera();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="drawer-backdrop"
      id="cameraModal"
      style={{ display: 'flex' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          stopCamera();
          onClose();
        }
      }}
    >
      <div className="drawer-card camera-modal-card">
        <div className="drawer-header">
          <div>
            <h3>LIVE OPTICAL CAPTURE</h3>
            <p>Real-time telemetry and camera frame snapshot</p>
          </div>
          <button
            className="drawer-close"
            id="btnCloseCamera"
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
          >
            &times;
          </button>
        </div>

        <div className="camera-stage">
          <div className="camera-feed-container">
            <video ref={videoRef} autoPlay playsInline muted id="cameraVideo" />
            <canvas ref={canvasRef} hidden id="cameraCanvas" />

            {/* Futuristic reticle target overlay */}
            <div className="camera-reticle-overlay">
              <div className="reticle-corner top-left"></div>
              <div className="reticle-corner top-right"></div>
              <div className="reticle-corner bottom-left"></div>
              <div className="reticle-corner bottom-right"></div>
              <div className="reticle-crosshair"></div>
            </div>
          </div>

          <div className="camera-status-bar">
            <div className={`status-indicator ${status}`}></div>
            <p className="camera-status" id="cameraStatus">
              {statusMessage}
            </p>
          </div>

          {status === 'error' && (
            <div className="camera-error-actions">
              <button
                className="btn-request-perm"
                type="button"
                onClick={requestCameraAccess}
              >
                Request Access Again
              </button>
              <input
                ref={fallbackInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: 'none' }}
                onChange={handleFallbackFile}
              />
              <button
                className="btn-fallback-capture"
                type="button"
                onClick={() => fallbackInputRef.current?.click()}
              >
                Use Device Camera Directly
              </button>
            </div>
          )}
        </div>

        <div className="camera-controls">
          <button
            className="think-pill"
            id="btnFlipCamera"
            type="button"
            onClick={handleFlip}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
            </svg>
            <span>Switch Lens ({facing === 'environment' ? 'Rear' : 'Front'})</span>
          </button>

          <button
            className="btn-capture"
            id="btnSnapCamera"
            type="button"
            disabled={!canSnap}
            onClick={handleSnap}
          >
            CAPTURE FRAME
          </button>
        </div>
      </div>
    </div>
  );
};
