'use client';

import { useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { receiptsApi, projectsApi, Receipt } from '@/lib/api';
import { formatDate, formatFileSize, formatCurrency, cn } from '@/lib/utils';

// ── Icons ────────────────────────────────────────────
const BackIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);
const UploadIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
  </svg>
);
const CameraIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);
const RefreshIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);
const EyeIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);
const DuplicateIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

// ── Status badge ─────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    PENDING:    { label: 'Oczekuje',    className: 'bg-yellow-100 text-yellow-700' },
    PROCESSING: { label: 'Przetwarza...', className: 'bg-blue-100 text-blue-700 animate-pulse' },
    COMPLETED:  { label: 'Gotowy',      className: 'bg-green-100 text-green-700' },
    FAILED:     { label: 'Błąd OCR',    className: 'bg-red-100 text-red-700' },
  };
  const { label, className } = map[status] ?? { label: status, className: 'bg-gray-100 text-gray-600' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

// ── OCR Confidence bar ───────────────────────────────
function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 80 ? 'bg-green-500' : value >= 50 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-200 rounded-full h-1.5">
        <div className={`${color} h-1.5 rounded-full transition-all`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs text-gray-500 w-8 text-right">{value}%</span>
    </div>
  );
}

// ── Upload Drop Zone ─────────────────────────────────
interface UploadZoneProps {
  onFiles: (files: File[]) => void;
  uploading: boolean;
}

function UploadZone({ onFiles, uploading }: UploadZoneProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(f =>
      ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(f.type)
    );
    if (files.length) onFiles(files);
  }, [onFiles]);

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !uploading && inputRef.current?.click()}
      className={cn(
        'border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all',
        dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-300 hover:bg-gray-50',
        uploading && 'pointer-events-none opacity-60'
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        multiple
        className="hidden"
        onChange={e => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) onFiles(files);
          e.target.value = '';
        }}
      />
      <div className="flex justify-center mb-3">
        <div className={cn(
          'w-12 h-12 rounded-xl flex items-center justify-center',
          dragging ? 'bg-blue-100' : 'bg-gray-100'
        )}>
          {uploading ? (
            <svg className="w-6 h-6 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <UploadIcon />
          )}
        </div>
      </div>
      <p className="text-sm font-medium text-gray-700">
        {uploading ? 'Wysyłam...' : 'Przeciągnij plik lub kliknij aby wybrać'}
      </p>
      <p className="text-xs text-gray-400 mt-1">JPG, PNG, WebP, PDF – maks. 50 MB</p>
    </div>
  );
}

// ── Receipt Card ─────────────────────────────────────
function ReceiptCard({
  receipt,
  onView,
  onReprocess,
  reprocessing,
}: {
  receipt: Receipt;
  onView: () => void;
  onReprocess: () => void;
  reprocessing: boolean;
}) {
  const isImage = receipt.mimeType.startsWith('image/');
  const isPDF = receipt.mimeType === 'application/pdf';

  return (
    <div className={cn(
      'bg-white rounded-xl border p-4 flex gap-4 transition-all',
      receipt.isDuplicate && 'border-orange-200 bg-orange-50/30'
    )}>
      {/* Thumbnail / ikona */}
      <div className="w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
        {isImage ? (
          <span className="text-3xl">🖼️</span>
        ) : isPDF ? (
          <span className="text-3xl">📄</span>
        ) : (
          <span className="text-3xl">📎</span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-gray-900 truncate">{receipt.originalFilename}</p>
          <StatusBadge status={receipt.processingStatus} />
        </div>

        <p className="text-xs text-gray-400 mt-0.5">
          {formatDate(receipt.createdAt)} · {formatFileSize(receipt.fileSize)}
        </p>

        {/* Dane wyciągnięte przez AI */}
        {receipt.processingStatus === 'COMPLETED' && (
          <div className="mt-2 space-y-1">
            {receipt.vendorName && (
              <p className="text-xs text-gray-700">
                <span className="text-gray-400">Sprzedawca: </span>
                {receipt.vendorName}
              </p>
            )}
            <div className="flex items-center gap-3 flex-wrap">
              {receipt.detectedAmount != null && receipt.currency && (
                <span className="text-sm font-semibold text-gray-900">
                  {formatCurrency(receipt.detectedAmount, receipt.currency)}
                </span>
              )}
              {receipt.detectedDate && (
                <span className="text-xs text-gray-500">
                  {formatDate(receipt.detectedDate)}
                </span>
              )}
              {receipt.invoiceNumber && (
                <span className="text-xs text-gray-500 font-mono">
                  #{receipt.invoiceNumber}
                </span>
              )}
            </div>
            {receipt.ocrConfidence != null && (
              <div className="w-32">
                <p className="text-[10px] text-gray-400 mb-0.5">Jakość OCR</p>
                <ConfidenceBar value={receipt.ocrConfidence} />
              </div>
            )}
          </div>
        )}

        {/* Duplikat warning */}
        {receipt.isDuplicate && (
          <div className="flex items-center gap-1.5 mt-2 text-orange-600">
            <DuplicateIcon />
            <span className="text-xs font-medium">Możliwy duplikat</span>
          </div>
        )}

        {/* Akcje */}
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={onView}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-medium text-gray-700 transition-colors"
          >
            <EyeIcon />
            Podgląd
          </button>
          {receipt.processingStatus !== 'PROCESSING' && (
            <button
              onClick={onReprocess}
              disabled={reprocessing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-medium text-gray-700 transition-colors disabled:opacity-50"
            >
              <RefreshIcon />
              {reprocessing ? 'Przetwarzam...' : 'Przetwórz ponownie'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Receipt Detail Modal ─────────────────────────────
function ReceiptModal({
  receipt,
  onClose,
}: {
  receipt: Receipt;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60">
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900 truncate max-w-xs">
              {receipt.originalFilename}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {formatDate(receipt.createdAt)} · {formatFileSize(receipt.fileSize)}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          {/* Status */}
          <div className="flex items-center gap-3">
            <StatusBadge status={receipt.processingStatus} />
            {receipt.isDuplicate && (
              <span className="flex items-center gap-1 text-orange-600 text-xs font-medium">
                <DuplicateIcon /> Możliwy duplikat
              </span>
            )}
          </div>

          {/* Dane AI */}
          {receipt.processingStatus === 'COMPLETED' && (
            <div className="bg-blue-50 rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-semibold text-blue-900">Dane wyciągnięte przez AI</h3>
              <div className="grid grid-cols-2 gap-3">
                {receipt.vendorName && (
                  <div>
                    <p className="text-[10px] text-blue-600 uppercase tracking-wide font-semibold">Sprzedawca</p>
                    <p className="text-sm text-gray-900 font-medium">{receipt.vendorName}</p>
                  </div>
                )}
                {receipt.detectedAmount != null && receipt.currency && (
                  <div>
                    <p className="text-[10px] text-blue-600 uppercase tracking-wide font-semibold">Kwota</p>
                    <p className="text-sm text-gray-900 font-semibold">
                      {formatCurrency(receipt.detectedAmount, receipt.currency)}
                    </p>
                  </div>
                )}
                {receipt.detectedDate && (
                  <div>
                    <p className="text-[10px] text-blue-600 uppercase tracking-wide font-semibold">Data</p>
                    <p className="text-sm text-gray-900">{formatDate(receipt.detectedDate)}</p>
                  </div>
                )}
                {receipt.invoiceNumber && (
                  <div>
                    <p className="text-[10px] text-blue-600 uppercase tracking-wide font-semibold">Nr faktury</p>
                    <p className="text-sm text-gray-900 font-mono">{receipt.invoiceNumber}</p>
                  </div>
                )}
                {receipt.currency && (
                  <div>
                    <p className="text-[10px] text-blue-600 uppercase tracking-wide font-semibold">Waluta</p>
                    <p className="text-sm text-gray-900">{receipt.currency}</p>
                  </div>
                )}
              </div>

              {receipt.ocrConfidence != null && (
                <div>
                  <p className="text-[10px] text-blue-600 uppercase tracking-wide font-semibold mb-1.5">
                    Jakość OCR
                  </p>
                  <ConfidenceBar value={receipt.ocrConfidence} />
                  {receipt.ocrConfidence < 60 && (
                    <p className="text-xs text-orange-600 mt-1">
                      ⚠️ Niska jakość skanowania – sprawdź dane ręcznie
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Tekst OCR */}
          {receipt.processingStatus === 'COMPLETED' && (
            <OcrTextSection receiptId={receipt.id} />
          )}

          {/* Błąd przetwarzania */}
          {receipt.processingStatus === 'FAILED' && (
            <div className="bg-red-50 rounded-xl p-4">
              <p className="text-sm font-semibold text-red-800 mb-1">Przetwarzanie nie powiodło się</p>
              <p className="text-xs text-red-600">
                OCR nie mógł odczytać dokumentu. Sprawdź czy plik jest czytelny i spróbuj ponownie.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Zamknij
          </button>
        </div>
      </div>
    </div>
  );
}

// Lazy-load tekstu OCR (może być długi)
function OcrTextSection({ receiptId }: { receiptId: string }) {
  const [expanded, setExpanded] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['receipt', receiptId],
    queryFn: () => receiptsApi.get(receiptId),
    enabled: expanded,
  });

  // @ts-expect-error – backend returns ocrText in data
  const ocrText: string | undefined = data?.data?.data?.ocrText;

  return (
    <div>
      <button
        onClick={() => setExpanded(v => !v)}
        className="text-sm text-blue-600 hover:underline font-medium"
      >
        {expanded ? 'Ukryj tekst OCR ▲' : 'Pokaż surowy tekst OCR ▼'}
      </button>
      {expanded && (
        <div className="mt-2 bg-gray-50 rounded-xl p-4">
          {isLoading ? (
            <div className="animate-pulse h-20 bg-gray-200 rounded" />
          ) : ocrText ? (
            <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono leading-relaxed">
              {ocrText}
            </pre>
          ) : (
            <p className="text-xs text-gray-400">Brak tekstu OCR</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Upload progress queue ────────────────────────────
interface UploadItem {
  id: string;
  file: File;
  status: 'uploading' | 'done' | 'error';
  error?: string;
}

// ── Main Page ────────────────────────────────────────
export default function ReceiptsPage() {
  const params = useParams();
  const projectId = params.id as string;
  const queryClient = useQueryClient();

  const [uploadQueue, setUploadQueue] = useState<UploadItem[]>([]);
  const [viewingReceipt, setViewingReceipt] = useState<Receipt | null>(null);
  const [reprocessingId, setReprocessingId] = useState<string | null>(null);

  // Dane projektu
  const { data: projectData } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId),
  });
  const project = projectData?.data?.data;

  // Lista paragonów
  const { data: receiptsData, isLoading } = useQuery({
    queryKey: ['receipts', projectId],
    queryFn: () => receiptsApi.list({ projectId }),
    refetchInterval: uploadQueue.some(u => u.status === 'uploading') ? 3000 : false,
  });
  const receipts: Receipt[] = (receiptsData?.data?.data ?? []) as Receipt[];

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: ({ file }: { file: File; queueId: string }) =>
      receiptsApi.upload(file, projectId),
  });

  async function handleFiles(files: File[]) {
    const newItems: UploadItem[] = files.map(file => ({
      id: Math.random().toString(36).slice(2),
      file,
      status: 'uploading' as const,
    }));
    setUploadQueue(q => [...newItems, ...q]);

    for (const item of newItems) {
      try {
        await uploadMutation.mutateAsync({ file: item.file, queueId: item.id });
        setUploadQueue(q => q.map(u => u.id === item.id ? { ...u, status: 'done' } : u));
        queryClient.invalidateQueries({ queryKey: ['receipts', projectId] });
      } catch {
        setUploadQueue(q => q.map(u =>
          u.id === item.id ? { ...u, status: 'error', error: 'Błąd wysyłania' } : u
        ));
      }
    }
  }

  async function handleReprocess(receiptId: string) {
    setReprocessingId(receiptId);
    try {
      await receiptsApi.get(receiptId); // endpoint re-process
      queryClient.invalidateQueries({ queryKey: ['receipts', projectId] });
    } finally {
      setReprocessingId(null);
    }
  }

  const pendingUploads = uploadQueue.filter(u => u.status === 'uploading').length;
  const duplicates = receipts.filter(r => r.isDuplicate).length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link
            href={`/projects/${projectId}`}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <BackIcon />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-gray-900">Dokumenty</h1>
            {project && <p className="text-xs text-gray-500 truncate">{project.name}</p>}
          </div>
          <Link
            href={`/projects/${projectId}/receipts/scan`}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <CameraIcon />
            <span className="hidden sm:inline">Skanuj</span>
          </Link>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-5">
        {/* Upload zone */}
        <UploadZone onFiles={handleFiles} uploading={pendingUploads > 0} />

        {/* Upload queue */}
        {uploadQueue.length > 0 && (
          <div className="space-y-2">
            {uploadQueue.map(item => (
              <div key={item.id} className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-xl border text-sm',
                item.status === 'uploading' && 'bg-blue-50 border-blue-200',
                item.status === 'done' && 'bg-green-50 border-green-200',
                item.status === 'error' && 'bg-red-50 border-red-200',
              )}>
                <span className="text-lg">
                  {item.status === 'uploading' ? '⏳' : item.status === 'done' ? '✅' : '❌'}
                </span>
                <span className="flex-1 truncate text-gray-700">{item.file.name}</span>
                <span className="text-xs text-gray-500">{formatFileSize(item.file.size)}</span>
              </div>
            ))}
            {uploadQueue.every(u => u.status !== 'uploading') && (
              <button
                onClick={() => setUploadQueue([])}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                Wyczyść listę
              </button>
            )}
          </div>
        )}

        {/* Statystyki */}
        {receipts.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-xl border p-3 text-center">
              <p className="text-2xl font-bold text-gray-900">{receipts.length}</p>
              <p className="text-xs text-gray-500">dokumentów</p>
            </div>
            <div className="bg-white rounded-xl border p-3 text-center">
              <p className="text-2xl font-bold text-green-600">
                {receipts.filter(r => r.processingStatus === 'COMPLETED').length}
              </p>
              <p className="text-xs text-gray-500">przetworzonych</p>
            </div>
            <div className={cn(
              'rounded-xl border p-3 text-center',
              duplicates > 0 ? 'bg-orange-50 border-orange-200' : 'bg-white'
            )}>
              <p className={`text-2xl font-bold ${duplicates > 0 ? 'text-orange-600' : 'text-gray-900'}`}>
                {duplicates}
              </p>
              <p className="text-xs text-gray-500">duplikatów</p>
            </div>
          </div>
        )}

        {/* Lista paragonów */}
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border h-28 animate-pulse" />
            ))}
          </div>
        ) : receipts.length === 0 ? (
          <div className="bg-white rounded-2xl border py-16 text-center">
            <div className="text-4xl mb-3">📄</div>
            <p className="text-gray-500 font-medium">Brak dokumentów</p>
            <p className="text-sm text-gray-400 mt-1">
              Przeciągnij paragon lub kliknij strefę powyżej
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {receipts.map(receipt => (
              <ReceiptCard
                key={receipt.id}
                receipt={receipt}
                onView={() => setViewingReceipt(receipt)}
                onReprocess={() => handleReprocess(receipt.id)}
                reprocessing={reprocessingId === receipt.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal podglądu */}
      {viewingReceipt && (
        <ReceiptModal
          receipt={viewingReceipt}
          onClose={() => setViewingReceipt(null)}
        />
      )}
    </div>
  );
}
