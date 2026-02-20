'use client';

import { formatCurrency, formatDate, formatFileSize, cn } from '@/lib/utils';
import { Receipt } from '@/lib/api';

interface DuplicateMatch {
  id: string;
  similarity: number;
  matchReason: string;
  receipt?: Partial<Receipt>;
}

interface DuplicateModalProps {
  /** Nowo wgrany paragon (potencjalny duplikat) */
  newReceipt: Receipt;
  /** Znalezione pasujące dokumenty */
  matches: DuplicateMatch[];
  /** Callback gdy użytkownik wybierze akcję */
  onAction: (action: 'merge' | 'add_new' | 'cancel', matchId?: string) => void;
  /** Czy trwa przetwarzanie akcji */
  loading?: boolean;
}

// Tłumaczenia powodów dopasowania
const MATCH_REASON_LABELS: Record<string, string> = {
  exact_fingerprint: '100% zgodność (ta sama faktura)',
  amount_and_date: 'Taka sama kwota i data',
  amount_and_fuzzy_date: 'Taka sama kwota, podobna data (±1 dzień)',
  invoice_number: 'Ten sam numer faktury',
};

// Kolor pewności dopasowania
function confidenceColor(similarity: number) {
  if (similarity >= 0.95) return 'text-red-600 bg-red-50 border-red-200';
  if (similarity >= 0.8) return 'text-orange-600 bg-orange-50 border-orange-200';
  return 'text-yellow-600 bg-yellow-50 border-yellow-200';
}

function confidenceLabel(similarity: number) {
  if (similarity >= 0.95) return 'Bardzo wysoka';
  if (similarity >= 0.8) return 'Wysoka';
  return 'Średnia';
}

// ── Blok porównania dokumentu ────────────────────────
function ReceiptCompareBlock({
  label,
  receipt,
  highlight,
}: {
  label: string;
  receipt: Partial<Receipt>;
  highlight?: boolean;
}) {
  return (
    <div className={cn(
      'rounded-xl border p-4 space-y-2.5',
      highlight ? 'border-blue-200 bg-blue-50/50' : 'border-gray-200 bg-gray-50'
    )}>
      <p className={cn(
        'text-[10px] font-bold uppercase tracking-wider',
        highlight ? 'text-blue-600' : 'text-gray-500'
      )}>
        {label}
      </p>

      {receipt.originalFilename && (
        <div>
          <p className="text-[10px] text-gray-400">Plik</p>
          <p className="text-sm font-medium text-gray-900 truncate">{receipt.originalFilename}</p>
        </div>
      )}

      {receipt.detectedAmount != null && receipt.currency && (
        <div>
          <p className="text-[10px] text-gray-400">Kwota</p>
          <p className="text-base font-bold text-gray-900">
            {formatCurrency(receipt.detectedAmount, receipt.currency)}
          </p>
        </div>
      )}

      {receipt.detectedDate && (
        <div>
          <p className="text-[10px] text-gray-400">Data</p>
          <p className="text-sm text-gray-900">{formatDate(receipt.detectedDate)}</p>
        </div>
      )}

      {receipt.vendorName && (
        <div>
          <p className="text-[10px] text-gray-400">Sprzedawca</p>
          <p className="text-sm text-gray-900">{receipt.vendorName}</p>
        </div>
      )}

      {receipt.invoiceNumber && (
        <div>
          <p className="text-[10px] text-gray-400">Nr faktury</p>
          <p className="text-sm text-gray-900 font-mono">{receipt.invoiceNumber}</p>
        </div>
      )}

      {receipt.fileSize != null && (
        <div>
          <p className="text-[10px] text-gray-400">Rozmiar</p>
          <p className="text-sm text-gray-900">{formatFileSize(receipt.fileSize)}</p>
        </div>
      )}

      {receipt.createdAt && (
        <div>
          <p className="text-[10px] text-gray-400">Wgrany</p>
          <p className="text-sm text-gray-900">{formatDate(receipt.createdAt)}</p>
        </div>
      )}
    </div>
  );
}

// ── Main Modal ───────────────────────────────────────
export function DuplicateModal({
  newReceipt,
  matches,
  onAction,
  loading = false,
}: DuplicateModalProps) {
  const topMatch = matches[0];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60">
      <div className="bg-white w-full sm:max-w-xl rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 p-5 border-b">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center text-lg">
              ⚠️
            </div>
            <h2 className="text-base font-bold text-gray-900">Możliwy duplikat dokumentu</h2>
          </div>
          <p className="text-sm text-gray-500">
            Znaleziono {matches.length === 1 ? 'podobny dokument' : `${matches.length} podobne dokumenty`} w bazie.
            Sprawdź i wybierz co zrobić.
          </p>
        </div>

        {/* Content – scrollable */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {matches.map((match, idx) => (
            <div key={match.id} className="space-y-3">
              {matches.length > 1 && (
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Dopasowanie {idx + 1}
                </p>
              )}

              {/* Pewność dopasowania */}
              <div className={cn(
                'inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium',
                confidenceColor(match.similarity)
              )}>
                <span>Pewność: {confidenceLabel(match.similarity)}</span>
                <span className="opacity-60">({Math.round(match.similarity * 100)}%)</span>
              </div>

              {/* Powód */}
              <p className="text-sm text-gray-600">
                <span className="font-medium text-gray-800">Powód: </span>
                {MATCH_REASON_LABELS[match.matchReason] ?? match.matchReason}
              </p>

              {/* Porównanie side-by-side */}
              <div className="grid grid-cols-2 gap-3">
                <ReceiptCompareBlock
                  label="Nowy (wgrany teraz)"
                  receipt={newReceipt}
                  highlight
                />
                <ReceiptCompareBlock
                  label="Istniejący w bazie"
                  receipt={match.receipt ?? { id: match.id }}
                />
              </div>

              {idx < matches.length - 1 && <hr className="border-gray-200" />}
            </div>
          ))}
        </div>

        {/* Footer – akcje */}
        <div className="flex-shrink-0 p-5 border-t space-y-3">
          <p className="text-xs text-gray-500 text-center">Co chcesz zrobić?</p>

          <div className="grid grid-cols-1 gap-2">
            {/* Połącz — zastąp starszy nowszym */}
            <button
              onClick={() => onAction('merge', topMatch?.id)}
              disabled={loading}
              className="w-full px-4 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              🔗 Połącz z istniejącym (zastąp plik)
              <span className="text-xs font-normal opacity-80">— zachowa dane OCR z nowego</span>
            </button>

            {/* Dodaj jako nowy */}
            <button
              onClick={() => onAction('add_new')}
              disabled={loading}
              className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
            >
              ➕ Dodaj jako nowy (oba istnieją)
            </button>

            {/* Anuluj / usuń nowo wgrany */}
            <button
              onClick={() => onAction('cancel')}
              disabled={loading}
              className="w-full px-4 py-3 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
            >
              ✕ Anuluj — usuń nowo wgrany dokument
            </button>
          </div>

          <p className="text-[10px] text-gray-400 text-center">
            Opcja „Połącz" jest zalecana gdy to ten sam dokument zeskanowany dwukrotnie.
          </p>
        </div>
      </div>
    </div>
  );
}

export default DuplicateModal;
