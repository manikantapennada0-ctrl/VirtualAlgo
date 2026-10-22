import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { ChatViewport } from './components/ChatViewport';
import { PromptDock } from './components/PromptDock';
import { ApiKeyModal } from './components/ApiKeyModal';
import { CameraModal } from './components/CameraModal';
import { SamplesDrawer } from './components/SamplesDrawer';
import { OutputsDrawer } from './components/OutputsDrawer';
import { ChatMessage, DetectionMode, GroundingResult, SamplePreset } from './types';
import { analyzeImage } from './services/visualGrounding';

const INITIAL_SAMPLES: SamplePreset[] = [
  {
    id: 'traffic_light',
    filename: 'traffic_light.jpg',
    title: 'Traffic Signal',
    question: 'Is the traffic light red?',
    image_url: '/samples/traffic_light.jpg',
    icon: '🚦',
    description: 'Verify illuminated light status and street entities',
  },
  {
    id: 'dog',
    filename: 'dog.jpg',
    title: 'Golden Retriever',
    question: 'What type of animal is this?',
    image_url: '/samples/dog.jpg',
    icon: '🐕',
    description: 'Animal breed identification & foreground grounding',
  },
  {
    id: 'cyclist',
    filename: 'cyclist.jpg',
    title: 'City Cyclist',
    question: 'Find the person riding a bicycle',
    image_url: '/samples/cyclist.jpg',
    icon: '🚴',
    description: 'Locate cyclist and bike gear amidst city traffic',
  },
  {
    id: 'bmw',
    filename: 'bmw_m4_gt4_2022_4k_8k_6-5120x2880.jpg',
    title: 'BMW M4 GT4',
    question: 'Detect and highlight the sports coupe vehicle',
    image_url: '/samples/bmw_m4_gt4_2022_4k_8k_6-5120x2880.jpg',
    icon: '🚗',
    description: 'Track high-performance racecar aerodynamics & body',
  },
  {
    id: 'dodge',
    filename: 'dodge.webp',
    title: 'Dodge Muscle Car',
    question: 'Identify the car and license plate',
    image_url: '/samples/dodge.webp',
    icon: '🏎️',
    description: 'Vehicle detection and license plate area recognition',
  },
  {
    id: 'action_scene',
    filename: 'rrr-jr-ntr-komaram-bheem-2022-movies-telugu-movies-tollywood-3840x2160-7006.jpg',
    title: 'Cinematic Action',
    question: 'Find the primary character in the scene',
    image_url: '/samples/rrr-jr-ntr-komaram-bheem-2022-movies-telugu-movies-tollywood-3840x2160-7006.jpg',
    icon: '🎬',
    description: 'Movie still actor detection & background isolation',
  },
];

interface OutputRecord {
  id: string;
  timestamp: number;
  result: GroundingResult;
}

export const App: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [prompt, setPrompt] = useState('');
  const [detectionMode, setDetectionMode] = useState<DetectionMode>('task_focused');
  const [attachedFile, setAttachedFile] = useState<{
    file: File | Blob;
    previewUrl: string;
    name: string;
  } | null>(null);
  const [lastFile, setLastFile] = useState<{
    file: File | Blob;
    previewUrl: string;
    name: string;
  } | null>(null);

  const [samples, setSamples] = useState<SamplePreset[]>(INITIAL_SAMPLES);
  const [outputs, setOutputs] = useState<OutputRecord[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [isSamplesDrawerOpen, setIsSamplesDrawerOpen] = useState(false);
  const [isOutputsDrawerOpen, setIsOutputsDrawerOpen] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);

  // Voice dictation
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const saved = localStorage.getItem('gemini_api_key') || '';
    setHasApiKey(Boolean(saved.trim()));

    // Window drag and drop
    const handleDragOver = (e: DragEvent) => e.preventDefault();
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
        const file = e.dataTransfer.files[0];
        if (file.type.startsWith('image/')) {
          handleAttachFile(file);
        }
      }
    };

    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsApiKeyModalOpen(false);
        setIsCameraModalOpen(false);
        setIsSamplesDrawerOpen(false);
        setIsOutputsDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleAttachFile = (file: File | Blob, customName?: string) => {
    const previewUrl = URL.createObjectURL(file);
    const name = customName || (file instanceof File ? file.name : 'image.jpg');
    setAttachedFile({ file, previewUrl, name });
  };

  const handleRemoveAttachment = () => {
    if (attachedFile?.previewUrl) {
      URL.revokeObjectURL(attachedFile.previewUrl);
    }
    setAttachedFile(null);
  };

  const handleSelectPreset = async (preset: SamplePreset) => {
    try {
      const response = await fetch(preset.image_url);
      const blob = await response.blob();
      const file = new File([blob], preset.filename, {
        type: blob.type || 'image/jpeg',
      });
      handleAttachFile(file, preset.filename);
      setPrompt(preset.question);
    } catch (e) {
      console.error('Failed to load preset image:', e);
      setAttachedFile({
        file: new Blob(),
        previewUrl: preset.image_url,
        name: preset.filename,
      });
      setPrompt(preset.question);
    }
  };

  const handleUploadSample = (file: File) => {
    const newSample: SamplePreset = {
      id: `sample_${Date.now()}`,
      filename: file.name,
      title: file.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' '),
      question: `Detect and highlight objects in ${file.name}`,
      image_url: URL.createObjectURL(file),
      icon: '🖼️',
      description: 'Custom user sample added during this session',
    };
    setSamples((prev) => [newSample, ...prev]);
    handleSelectPreset(newSample);
    setIsSamplesDrawerOpen(false);
  };

  const handleToggleMode = () => {
    const modes: DetectionMode[] = ['task_focused', 'all_objects', 'hybrid'];
    const nextIdx = (modes.indexOf(detectionMode) + 1) % modes.length;
    setDetectionMode(modes[nextIdx]);
  };

  const handleToggleMic = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    try {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';

      rec.onresult = (e: any) => {
        const transcript = e.results?.[0]?.[0]?.transcript || '';
        if (transcript) {
          setPrompt((prev) => (prev ? `${prev} ${transcript}` : transcript));
        }
      };

      rec.onend = () => setIsListening(false);
      rec.onerror = () => setIsListening(false);

      recognitionRef.current = rec;
      rec.start();
      setIsListening(true);
    } catch (err) {
      console.error('Voice dictation error:', err);
      setIsListening(false);
    }
  };

  const handleResetChat = () => {
    setMessages([]);
    handleRemoveAttachment();
    setLastFile(null);
    setPrompt('');
  };

  const handleSend = async () => {
    const targetFile = attachedFile || lastFile;
    const finalQuestion =
      prompt.trim() || 'Detect and highlight the main objects in this image';

    if (!prompt.trim() && !targetFile) {
      return;
    }

    if (!targetFile) {
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-err-${Date.now()}`,
          sender: 'bot',
          error: 'Attach an image with + so OpenCV can detect objects.',
          timestamp: Date.now(),
        },
      ]);
      return;
    }

    if (attachedFile) {
      setLastFile(attachedFile);
    }

    const userMsgId = `user-${Date.now()}`;
    const botMsgId = `bot-${Date.now()}`;

    setMessages((prev) => [
      ...prev,
      {
        id: userMsgId,
        sender: 'user',
        text: finalQuestion,
        timestamp: Date.now(),
      },
      {
        id: botMsgId,
        sender: 'bot',
        isLoading: true,
        timestamp: Date.now(),
      },
    ]);

    setPrompt('');
    setIsLoading(true);

    try {
      const imageSource =
        targetFile.file && targetFile.file.size > 0
          ? targetFile.file
          : targetFile.previewUrl;

      const result = await analyzeImage({
        image: imageSource,
        question: finalQuestion,
        mode: detectionMode,
      });

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === botMsgId
            ? {
                ...msg,
                isLoading: false,
                result,
              }
            : msg
        )
      );

      // Record in outputs gallery
      setOutputs((prev) => [
        {
          id: String(Date.now()),
          timestamp: Date.now(),
          result,
        },
        ...prev,
      ]);
    } catch (err: any) {
      console.error('Analysis error:', err);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === botMsgId
            ? {
                ...msg,
                isLoading: false,
                error: `Failed to analyze image: ${err?.message || err}`,
              }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="chatgpt-layout">
      <main className="chat-main">
        <Header
          onReset={handleResetChat}
          onOpenApiKey={() => setIsApiKeyModalOpen(true)}
          hasApiKey={hasApiKey}
          onOpenSamples={() => setIsSamplesDrawerOpen(true)}
          onOpenOutputs={() => setIsOutputsDrawerOpen(true)}
          samplesCount={samples.length}
          outputsCount={outputs.length}
        />

        <ChatViewport
          messages={messages}
          onSelectPromptSuggestion={(text) => setPrompt(text)}
        />

        <PromptDock
          attachedFile={attachedFile}
          onRemoveAttachment={handleRemoveAttachment}
          onAttachFile={(file) => handleAttachFile(file)}
          onOpenCamera={() => setIsCameraModalOpen(true)}
          detectionMode={detectionMode}
          onToggleMode={handleToggleMode}
          prompt={prompt}
          onPromptChange={setPrompt}
          onSend={handleSend}
          isLoading={isLoading}
          isListening={isListening}
          onToggleMic={handleToggleMic}
        />
      </main>

      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
        onKeySaved={(k) => setHasApiKey(Boolean(k.trim()))}
      />

      <CameraModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        onCapture={(file) => handleAttachFile(file)}
      />

      <SamplesDrawer
        isOpen={isSamplesDrawerOpen}
        onClose={() => setIsSamplesDrawerOpen(false)}
        samples={samples}
        onSelectSample={handleSelectPreset}
        onUploadSample={handleUploadSample}
      />

      <OutputsDrawer
        isOpen={isOutputsDrawerOpen}
        onClose={() => setIsOutputsDrawerOpen(false)}
        outputs={outputs}
      />
    </div>
  );
};
export default App;
