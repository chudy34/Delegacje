'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { receiptsApi } from '@/lib/api';
import { formatFileSize, cn } from '@/lib/utils';

type ScanState = 'idle' | 'camera' | 'preview' | 'uploading' | 'done' | 'error';

// ── Icons ────────────────────────────────────────────
const BackIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);
const ShutterIcon = () => (
  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <circle cx="12" cy="12" r="8" strokeWidth={2} />
    <circle cx="12" cy="12" r="3" fill="currentColor" />
  </svg>
);
const FlipIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);
const GalleryIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);
const CheckIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

// ── Camera view ──────────────────────────────────────
function CameraView({
  onCapture,
  onGallery,
}: {
  onCapture: (blob: Blob) => void;
  onGallery: (file: File) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState('');
  const [ready, setReady] = useState(false);

  const startCamera = useCallback(async (facing: 'environment' | 'user') => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
    setReady(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => setReady(true);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Permission') || msg.includes('NotAllowed')) {
        setCameraError('Brak dostępu do kamery. Zezwól na dostęp w ustawieniach przeglądarki.');
      } else {
        setCameraError('Nie można uruchomić kamery na tym urządzeniu.');
      }
    }
  }, []);

  useEffect(() => {
    startCamera(facingMode);
    return () => streamRef.current?.getTracks().forEach(t => t.stop());
  }, [facingMode, startCamera]);

  function capture() {
    if (!videoRef.current || !canvasRef.current || !ready) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(blob => {
      if (blob) onCapture(blob);
    }, 'image/jpeg', 0.92);
  }

  function flipCamera() {
    setFacingMode(m => m === 'environment' ? 'user' : 'environment');
  }

  if (cameraError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-black">
        <div className="text-5xl mb-4">📷</div>
        <p className="text-white font-medium mb-2">Brak dostępu do kamery</p>
        <p className="text-gray-400 text-sm mb-6">{cameraError}</p>
        <button
          onClick={() => galleryInputRef.current?.click()}
          className="flex items-center gap-2 px-5 py-3 bg-white text-gray-900 rounded-xl font-medium text-sm"
        >
          <GalleryIcon />
          Wybierz z galerii
        </button>
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) onGallery(file);
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 relative bg-black overflow-hidden">
      {/* Video */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover"
      />
      <canvas ref={canvasRef} className="hidden" />

      {/* Overlay - viewfinder */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative w-4/5 aspect-[3/4] max-h-[65vh]">
          {/* Rogi */}
          {['top-0 left-0', 'top-0 right-0', 'bottom-0 left-0', 'bottom-0 right-0'].map((pos, i) => (
            <div
              key={i}
              className={`absolute w-8 h-8 border-white border-opacity-80 ${pos} ${
                i === 0 ? 'border-t-2 border-l-2' :
                i === 1 ? 'border-t-2 border-r-2' :
                i === 2 ? 'border-b-2 border-l-2' :
                'border-b-2 border-r-2'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Hint */}
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <div className="text-white text-sm">Uruchamiam kamerę...</div>
        </div>
      )}

      {/* Górne przyciski */}
      <div className="absolute top-4 right-4">
        <button
          onClick={flipCamera}
          className="w-10 h-10 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center text-white"
        >
          <FlipIcon />
        </button>
      </div>

      {/* Dolne sterowanie */}
      <div className="absolute bottom-0 left-0 right-0 pb-safe">
        <div className="flex items-center justify-around px-8 py-6">
          {/* Galeria */}
          <button
            onClick={() => galleryInputRef.current?.click()}
            className="w-12 h-12 bg-black/50 backdrop-blur-sm rounded-xl flex items-center justify-center text-white"
          >
            <GalleryIcon />
          </button>
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) onGallery(file);
            }}
          />

          {/* Migawka */}
          <button
            onClick={capture}
            disabled={!ready}
            className={cn(
              'w-20 h-20 rounded-full border-4 border-white flex items-center justify-center text-white transition-all',
              ready ? 'bg-white/20 active:scale-95 active:bg-white/40' : 'opacity-40'
            )}
          >
            <ShutterIcon />
          </button>

          {/* Placeholder (symetria) */}
          <div className="w-12 h-12" />
        </div>
      </div>
    </div>
  );
}

// ── Preview view ─────────────────────────────────────
function PreviewView({
  blob,
  file,
  onRetake,
  onUpload,
  uploading,
}: {
  blob?: Blob;
  file?: File;
  onRetake: () => void;
  onUpload: () => void;
  uploading: boolean;
}) {
  const src = blob
    ? URL.createObjectURL(blob)
    : file
    ? URL.createObjectURL(file)
    : '';

  const size = blob?.size ?? file?.size ?? 0;

  return (
    <div className="flex-1 flex flex-col bg-black">
      {/* Podgląd zdjęcia */}
      <div className="flex-1 relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="Podgląd paragonu" className="w-full h-full object-contain" />
      </div>

      {/* Dolny panel */}
      <div className="bg-gray-900 px-6 py-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-white text-sm font-medium">Podgląd zdjęcia</p>
          <p className="text-gray-400 text-xs">{formatFileSize(size)}</p>
        </div>

        <p className="text-gray-400 text-xs">
          Upewnij się, że cały paragon jest widoczny i czytelny.
          Im lepsza jakość zdjęcia, tym dokładniejszy odczyt OCR.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onRetake}
            disabled={uploading}
            className="flex-1 py-3 rounded-xl border border-gray-600 text-white text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            Zrób ponownie
          </button>
          <button
            onClick={onUpload}
            disabled={uploading}
            className="flex-1 py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {uploading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Wysyłam...
              </>
            ) : (
              'Wyślij i analizuj'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Done view ────────────────────────────────────────
function DoneView({
  projectId,
  onScanAnother,
}: {
  projectId: string;
  onScanAnother: () => void;
}) {
  const router = useRouter();
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gray-900">
      <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-green-500/30">
        <CheckIcon />
      </div>
      <h2 className="text-white text-xl font-bold mb-2">Paragon wysłany!</h2>
      <p className="text-gray-400 text-sm mb-8 max-w-xs">
        Przetwarzanie OCR odbywa się w tle. Wyniki zobaczysz w liście dokumentów za chwilę.
      </p>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button
          onClick={onScanAnother}
          className="py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
        >
          Skanuj kolejny paragon
        </button>
        <button
          onClick={() => router.push(`/projects/${projectId}/receipts`)}
          className="py-3 border border-gray-600 text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors"
        >
          Wróć do dokumentów
        </button>
        <button
          onClick={() => router.push(`/projects/${projectId}`)}
          className="py-3 text-gray-400 text-sm hover:text-gray-200 transition-colors"
        >
          Powrót do projektu
        </button>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────
export default function ScanPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [state, setState] = useState<ScanState>('camera');
  const [capturedBlob, setCapturedBlob] = useState<Blob | undefined>();
  const [galleryFile, setGalleryFile] = useState<File | undefined>();

  const uploadMutation = useMutation({
    mutationFn: (file: File) => receiptsApi.upload(file, projectId),
  });

  function handleCapture(blob: Blob) {
    setCapturedBlob(blob);
    setGalleryFile(undefined);
    setState('preview');
  }

  function handleGallery(file: File) {
    setGalleryFile(file);
    setCapturedBlob(undefined);
    setState('preview');
  }

  function handleRetake() {
    setCapturedBlob(undefined);
    setGalleryFile(undefined);
    setState('camera');
  }

  async function handleUpload() {
    setState('uploading');
    try {
      let file: File;
      if (capturedBlob) {
        const name = `paragon_${new Date().toISOString().replace(/[:.]/g, '-')}.jpg`;
        file = new File([capturedBlob], name, { type: 'image/jpeg' });
      } else if (galleryFile) {
        file = galleryFile;
      } else {
        return;
      }
      await uploadMutation.mutateAsync(file);
      setState('done');
    } catch {
      setState('error');
    }
  }

  function handleScanAnother() {
    setCapturedBlob(undefined);
    setGalleryFile(undefined);
    setState('camera');
  }

  return (
    <div className="flex flex-col h-screen bg-black">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 bg-black/80 backdrop-blur-sm z-10">
        <button
          onClick={() => router.back()}
          className="p-2 text-white hover:bg-white/10 rounded-lg transition-colors"
        >
          <BackIcon />
        </button>
        <h1 className="text-white font-semibold">
          {state === 'preview' || state === 'uploading' ? 'Podgląd' :
           state === 'done' ? 'Gotowe' :
           'Skanuj paragon'}
        </h1>
      </div>

      {/* Content */}
      {(state === 'camera' || state === 'idle') && (
        <CameraView onCapture={handleCapture} onGallery={handleGallery} />
      )}

      {(state === 'preview' || state === 'uploading') && (
        <PreviewView
          blob={capturedBlob}
          file={galleryFile}
          onRetake={handleRetake}
          onUpload={handleUpload}
          uploading={state === 'uploading'}
        />
      )}

      {state === 'done' && (
        <DoneView projectId={projectId} onScanAnother={handleScanAnother} />
      )}

      {state === 'error' && (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="text-5xl mb-4">❌</div>
          <p className="text-white font-medium mb-2">Błąd wysyłania</p>
          <p className="text-gray-400 text-sm mb-6">Sprawdź połączenie z internetem i spróbuj ponownie.</p>
          <button
            onClick={handleRetake}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Spróbuj ponownie
          </button>
        </div>
      )}
    </div>
  );
}
