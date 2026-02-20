'use client';

import { useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { importApi, projectsApi } from '@/lib/api';
import { formatCurrency, getCategoryLabel, getCategoryColor, CATEGORY_LABELS, cn } from '@/lib/utils';

// ── Types ────────────────────────────────────────────
interface CsvPreview {
  headers: string[];
  rows: string[][];
  separator: string;
  dateFormat: string;
  totalRows: number;
}

interface ColumnMapping {
  date: string;
  amount: string;
  description: string;
  currency?: string;
  category?: string;
}

interface ParsedRow {
  date: string;
  amount: number;
  description: string;
  currency: string;
  category: string;
  raw: Record<string, string>;
  skipped?: boolean;
  skipReason?: string;
}

interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

type Step = 'upload' | 'mapping' | 'preview' | 'done';

// ── Icons ────────────────────────────────────────────
const BackIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);
const UploadIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
  </svg>
);
const ChevronRight = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);
const CheckCircle = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

// ── Step indicator ───────────────────────────────────
const STEPS = ['Plik', 'Mapowanie', 'Podgląd', 'Gotowe'];

function StepBar({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-6">
      {STEPS.map((label, i) => (
        <div key={i} className="flex items-center">
          <div className="flex flex-col items-center">
            <div className={cn(
              'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all',
              i < current ? 'bg-blue-600 text-white' :
              i === current ? 'bg-blue-600 text-white ring-4 ring-blue-100' :
              'bg-gray-200 text-gray-400'
            )}>
              {i < current ? '✓' : i + 1}
            </div>
            <span className={cn(
              'text-[10px] mt-1 font-medium whitespace-nowrap',
              i === current ? 'text-blue-600' : 'text-gray-400'
            )}>
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={cn(
              'w-10 h-0.5 mx-1 mb-4 transition-all',
              i < current ? 'bg-blue-600' : 'bg-gray-200'
            )} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Step 1: Upload ───────────────────────────────────
function UploadStep({
  onPreview,
  loading,
}: {
  onPreview: (file: File) => void;
  loading: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith('.csv') && !file.name.endsWith('.txt')) {
      return; // tylko CSV/TSV
    }
    onPreview(file);
  }, [onPreview]);

  return (
    <div className="space-y-5">
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file);
        }}
        onClick={() => !loading && inputRef.current?.click()}
        className={cn(
          'border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all',
          dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-300 hover:bg-gray-50',
          loading && 'pointer-events-none opacity-60'
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.txt"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = '';
          }}
        />
        <div className="flex justify-center mb-3">
          <div className={cn('w-14 h-14 rounded-2xl flex items-center justify-center', dragging ? 'bg-blue-100' : 'bg-gray-100')}>
            {loading ? (
              <svg className="w-7 h-7 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <UploadIcon />
            )}
          </div>
        </div>
        <p className="text-sm font-semibold text-gray-700">
          {loading ? 'Analizuję plik...' : 'Przeciągnij plik CSV lub kliknij'}
        </p>
        <p className="text-xs text-gray-400 mt-1">Pliki .csv lub .txt, separator , lub ;</p>
      </div>

      {/* Banki info */}
      <div className="bg-gray-50 rounded-xl p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Obsługiwane formaty wyciągów bankowych
        </p>
        <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
          {[
            ['mBank', 'Historia operacji CSV'],
            ['PKO BP', 'Eksport historii operacji'],
            ['ING', 'Wyciąg w formacie CSV'],
            ['Santander', 'Historia transakcji'],
            ['Millennium', 'Operacje historyczne CSV'],
            ['Revolut', 'Statement CSV'],
            ['Wise', 'Account statement CSV'],
            ['Własny', 'Dowolna struktura CSV'],
          ].map(([bank, desc]) => (
            <div key={bank} className="flex items-start gap-1.5">
              <span className="text-green-500 mt-0.5">✓</span>
              <span><strong>{bank}</strong> — {desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Step 2: Column Mapping ───────────────────────────
function MappingStep({
  preview,
  mapping,
  onChange,
  savedMappings,
  onLoadSaved,
}: {
  preview: CsvPreview;
  mapping: Partial<ColumnMapping>;
  onChange: (m: Partial<ColumnMapping>) => void;
  savedMappings: Record<string, ColumnMapping>;
  onLoadSaved: (key: string) => void;
}) {
  const REQUIRED_FIELDS = [
    { key: 'date' as const, label: 'Data', required: true, hint: 'Kolumna z datą transakcji' },
    { key: 'amount' as const, label: 'Kwota', required: true, hint: 'Kolumna z kwotą (może być ujemna)' },
    { key: 'description' as const, label: 'Opis', required: true, hint: 'Tytuł / opis operacji' },
    { key: 'currency' as const, label: 'Waluta', required: false, hint: 'Kolumna z walutą (opcjonalna)' },
    { key: 'category' as const, label: 'Kategoria', required: false, hint: 'Kolumna z kategorią (opcjonalna)' },
  ];

  const savedKeys = Object.keys(savedMappings);

  return (
    <div className="space-y-5">
      {/* Wczytaj zapisane mapowanie */}
      {savedKeys.length > 0 && (
        <div className="bg-blue-50 rounded-xl p-4">
          <p className="text-xs font-semibold text-blue-700 mb-2">📋 Zapisane mapowania</p>
          <div className="flex flex-wrap gap-2">
            {savedKeys.map(key => (
              <button
                key={key}
                onClick={() => onLoadSaved(key)}
                className="px-3 py-1.5 bg-white border border-blue-200 rounded-lg text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors"
              >
                {key}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Podgląd nagłówków */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Wykryte kolumny ({preview.headers.length})
        </p>
        <div className="flex flex-wrap gap-2">
          {preview.headers.map(h => (
            <span key={h} className="px-2.5 py-1 bg-gray-100 rounded-lg text-xs font-mono text-gray-700">
              {h}
            </span>
          ))}
        </div>
        <p className="text-[10px] text-gray-400 mt-2">
          Separator: <strong>{preview.separator === ';' ? 'średnik (;)' : 'przecinek (,)'}</strong> ·
          Format daty: <strong>{preview.dateFormat}</strong> ·
          Wierszy danych: <strong>{preview.totalRows}</strong>
        </p>
      </div>

      {/* Mapowanie pól */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Przypisz kolumny do pól
        </p>
        {REQUIRED_FIELDS.map(field => (
          <div key={field.key} className="flex items-center gap-3">
            <div className="w-28 flex-shrink-0">
              <span className="text-sm font-medium text-gray-700">{field.label}</span>
              {field.required && <span className="text-red-500 ml-0.5">*</span>}
            </div>
            <select
              value={mapping[field.key] ?? ''}
              onChange={e => onChange({ ...mapping, [field.key]: e.target.value || undefined })}
              className={cn(
                'flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500',
                field.required && !mapping[field.key]
                  ? 'border-red-300 bg-red-50'
                  : 'border-gray-300'
              )}
            >
              <option value="">— nie mapuj —</option>
              {preview.headers.map(h => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
            <p className="text-[10px] text-gray-400 hidden sm:block w-32">{field.hint}</p>
          </div>
        ))}
      </div>

      {/* Podgląd pierwszych wierszy */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Podgląd danych (pierwsze 3 wiersze)
        </p>
        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="text-xs w-full">
            <thead>
              <tr className="bg-gray-50 border-b">
                {preview.headers.map(h => (
                  <th key={h} className={cn(
                    'px-3 py-2 text-left font-semibold whitespace-nowrap',
                    Object.values(mapping).includes(h) ? 'text-blue-600' : 'text-gray-400'
                  )}>
                    {h}
                    {Object.values(mapping).includes(h) && (
                      <span className="ml-1 text-[9px] bg-blue-100 text-blue-600 px-1 rounded">
                        {Object.entries(mapping).find(([, v]) => v === h)?.[0]}
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.rows.slice(0, 3).map((row, i) => (
                <tr key={i} className="border-b last:border-0">
                  {row.map((cell, j) => (
                    <td key={j} className="px-3 py-2 text-gray-600 whitespace-nowrap max-w-[120px] truncate">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Step 3: Preview parsed rows ──────────────────────
function PreviewStep({
  rows,
  currency,
  onToggle,
}: {
  rows: ParsedRow[];
  currency: string;
  onToggle: (idx: number) => void;
}) {
  const toImport = rows.filter(r => !r.skipped);
  const skipped = rows.filter(r => r.skipped);
  const total = toImport.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="space-y-4">
      {/* Podsumowanie */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-green-700">{toImport.length}</p>
          <p className="text-xs text-green-600">do importu</p>
        </div>
        <div className="bg-gray-50 border rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-gray-500">{skipped.length}</p>
          <p className="text-xs text-gray-400">pominięte</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
          <p className="text-sm font-bold text-blue-700 truncate">
            {formatCurrency(Math.abs(total), currency)}
          </p>
          <p className="text-xs text-blue-600">łącznie</p>
        </div>
      </div>

      {/* Lista wierszy */}
      <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
        {rows.map((row, idx) => (
          <div
            key={idx}
            className={cn(
              'flex items-center gap-3 px-3 py-3 rounded-xl border text-sm transition-all',
              row.skipped
                ? 'border-gray-200 bg-gray-50 opacity-50'
                : 'border-gray-200 bg-white hover:border-blue-200'
            )}
          >
            {/* Checkbox */}
            <input
              type="checkbox"
              checked={!row.skipped}
              onChange={() => onToggle(idx)}
              className="rounded text-blue-600 flex-shrink-0"
            />

            {/* Data */}
            <span className="text-xs text-gray-400 flex-shrink-0 w-20">{row.date}</span>

            {/* Opis */}
            <span className="flex-1 text-gray-700 truncate">{row.description}</span>

            {/* Kategoria */}
            <span
              className="flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium text-white"
              style={{ backgroundColor: getCategoryColor(row.category) }}
            >
              {getCategoryLabel(row.category)}
            </span>

            {/* Kwota */}
            <span className={cn(
              'flex-shrink-0 font-semibold text-sm w-24 text-right',
              row.amount < 0 ? 'text-red-600' : 'text-green-600'
            )}>
              {formatCurrency(row.amount, row.currency || currency)}
            </span>
          </div>
        ))}
      </div>

      {skipped.length > 0 && (
        <p className="text-xs text-gray-400 text-center">
          Odznaczone wiersze nie zostaną zaimportowane. Możesz je zaznaczyć ponownie.
        </p>
      )}
    </div>
  );
}

// ── Step 4: Done ─────────────────────────────────────
function DoneStep({
  result,
  projectId,
  onImportAnother,
}: {
  result: ImportResult;
  projectId: string;
  onImportAnother: () => void;
}) {
  const router = useRouter();
  return (
    <div className="text-center py-6 space-y-5">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
        <CheckCircle />
      </div>
      <div>
        <h3 className="text-xl font-bold text-gray-900">Import zakończony!</h3>
        <p className="text-gray-500 text-sm mt-1">Transakcje zostały dodane do projektu</p>
      </div>

      <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-3xl font-bold text-green-700">{result.imported}</p>
          <p className="text-xs text-green-600 mt-0.5">zaimportowanych</p>
        </div>
        <div className="bg-gray-50 border rounded-xl p-4">
          <p className="text-3xl font-bold text-gray-400">{result.skipped}</p>
          <p className="text-xs text-gray-400 mt-0.5">pominiętych</p>
        </div>
      </div>

      {result.errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-left max-w-xs mx-auto">
          <p className="text-xs font-semibold text-red-700 mb-2">Błędy ({result.errors.length}):</p>
          <ul className="text-xs text-red-600 space-y-1">
            {result.errors.slice(0, 5).map((e, i) => <li key={i}>• {e}</li>)}
            {result.errors.length > 5 && (
              <li>...i {result.errors.length - 5} więcej</li>
            )}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-2 max-w-xs mx-auto">
        <button
          onClick={() => router.push(`/projects/${projectId}/transactions`)}
          className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
        >
          Zobacz zaimportowane transakcje
        </button>
        <button
          onClick={onImportAnother}
          className="w-full py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          Importuj kolejny plik
        </button>
        <button
          onClick={() => router.push(`/projects/${projectId}`)}
          className="w-full py-2.5 text-gray-400 text-sm hover:text-gray-600 transition-colors"
        >
          Wróć do projektu
        </button>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────
export default function ImportCsvPage() {
  const params = useParams();
  const projectId = params.id as string;
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>('upload');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CsvPreview | null>(null);
  const [mapping, setMapping] = useState<Partial<ColumnMapping>>({});
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');

  // Projekt
  const { data: projectData } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId),
  });
  const project = projectData?.data?.data;

  // Zapisane mapowania
  const { data: savedMappingsData } = useQuery({
    queryKey: ['import-mappings'],
    queryFn: () => importApi.getMappings(),
  });
  const savedMappings: Record<string, ColumnMapping> = (savedMappingsData?.data as { data?: Record<string, ColumnMapping> })?.data ?? {};

  // Preview mutation
  const previewMutation = useMutation({
    mutationFn: (file: File) => importApi.previewCSV(file),
    onSuccess: (res) => {
      const data = (res.data as { data?: CsvPreview }).data;
      if (data) {
        setPreview(data);
        // Auto-mapowanie na podstawie nazw kolumn
        const autoMap: Partial<ColumnMapping> = {};
        const headers = data.headers.map(h => h.toLowerCase());
        const find = (kws: string[]) =>
          data.headers[headers.findIndex(h => kws.some(kw => h.includes(kw)))] ?? '';

        autoMap.date = find(['data', 'date', 'czas', 'time', 'dzień']);
        autoMap.amount = find(['kwota', 'amount', 'suma', 'wartość', 'value', 'obciążenia']);
        autoMap.description = find(['opis', 'tytuł', 'title', 'description', 'tytul', 'szczegóły']);
        autoMap.currency = find(['waluta', 'currency', 'curr']);

        setMapping(autoMap);
        setStep('mapping');
      }
    },
    onError: () => setError('Nie udało się wczytać pliku. Sprawdź czy to poprawny plik CSV.'),
  });

  // Import mutation
  const importMutation = useMutation({
    mutationFn: () => importApi.importCSV(csvFile!, projectId, mapping),
    onSuccess: (res) => {
      const data = (res.data as { data?: ImportResult }).data;
      if (data) {
        setImportResult(data);
        setStep('done');
        queryClient.invalidateQueries({ queryKey: ['transactions', projectId] });
        queryClient.invalidateQueries({ queryKey: ['project-balance', projectId] });
      }
    },
    onError: () => setError('Błąd podczas importu. Spróbuj ponownie.'),
  });

  // Symulacja parsowania na frontendzie (podgląd przed importem)
  function parsePreviewRows(): ParsedRow[] {
    if (!preview || !mapping.date || !mapping.amount || !mapping.description) return [];

    return preview.rows.map(row => {
      const raw: Record<string, string> = {};
      preview.headers.forEach((h, i) => { raw[h] = row[i] ?? ''; });

      const dateStr = raw[mapping.date!] ?? '';
      const amountStr = (raw[mapping.amount!] ?? '').replace(/\s/g, '').replace(',', '.');
      const description = raw[mapping.description!] ?? '';
      const currency = (mapping.currency ? raw[mapping.currency] : null) || project?.currency || 'PLN';

      const amount = parseFloat(amountStr);

      // Auto-klasyfikacja
      const desc = description.toLowerCase();
      let category = 'OTHER';
      if (/hotel|airbnb|booking|nocleg|hostel/.test(desc)) category = 'HOTEL';
      else if (/parking|park\./.test(desc)) category = 'PARKING';
      else if (/restaur|obiad|kolacja|śniadanie|kawiar|pizza|burger|kebab|mcdonald|kfc|sushi/.test(desc)) category = 'FOOD';
      else if (/taxi|uber|bolt|train|pociąg|lot|flight|ryanair|wizzair|easyjet|pkp|bus/.test(desc)) category = 'TRANSPORT';
      else if (/paliwo|tankow|orlen|bp |shell|lotos|neste|diesel|petrol/.test(desc)) category = 'FUEL';

      const skipped = isNaN(amount) || !dateStr || !description;

      return {
        date: dateStr,
        amount,
        description,
        currency: currency.trim().toUpperCase() || 'PLN',
        category,
        raw,
        skipped,
        skipReason: isNaN(amount) ? 'Nieprawidłowa kwota' : !dateStr ? 'Brak daty' : !description ? 'Brak opisu' : undefined,
      };
    });
  }

  function handleGoToPreview() {
    if (!mapping.date || !mapping.amount || !mapping.description) {
      setError('Musisz przypisać kolumny: Data, Kwota i Opis');
      return;
    }
    setError('');
    const rows = parsePreviewRows();
    setParsedRows(rows);
    setStep('preview');
  }

  function toggleRow(idx: number) {
    setParsedRows(rows => rows.map((r, i) =>
      i === idx ? { ...r, skipped: !r.skipped } : r
    ));
  }

  function reset() {
    setStep('upload');
    setCsvFile(null);
    setPreview(null);
    setMapping({});
    setParsedRows([]);
    setImportResult(null);
    setError('');
  }

  const stepIndex: Record<Step, number> = { upload: 0, mapping: 1, preview: 2, done: 3 };

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
            <h1 className="text-lg font-semibold text-gray-900">Import CSV</h1>
            {project && <p className="text-xs text-gray-500 truncate">{project.name}</p>}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        <StepBar current={stepIndex[step]} />

        {/* Error */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
            <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600">✕</button>
          </div>
        )}

        {/* Step content */}
        <div className="bg-white rounded-2xl border p-6">
          {step === 'upload' && (
            <UploadStep
              loading={previewMutation.isPending}
              onPreview={file => {
                setCsvFile(file);
                previewMutation.mutate(file);
              }}
            />
          )}

          {step === 'mapping' && preview && (
            <MappingStep
              preview={preview}
              mapping={mapping}
              onChange={setMapping}
              savedMappings={savedMappings}
              onLoadSaved={key => setMapping(savedMappings[key])}
            />
          )}

          {step === 'preview' && (
            <PreviewStep
              rows={parsedRows}
              currency={project?.currency ?? 'PLN'}
              onToggle={toggleRow}
            />
          )}

          {step === 'done' && importResult && (
            <DoneStep
              result={importResult}
              projectId={projectId}
              onImportAnother={reset}
            />
          )}
        </div>

        {/* Nawigacja kroków */}
        {step !== 'upload' && step !== 'done' && (
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => {
                setError('');
                if (step === 'mapping') setStep('upload');
                if (step === 'preview') setStep('mapping');
              }}
              className="flex items-center gap-1.5 px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <BackIcon /> Wstecz
            </button>

            <button
              onClick={() => {
                if (step === 'mapping') handleGoToPreview();
                if (step === 'preview') {
                  const toImport = parsedRows.filter(r => !r.skipped);
                  if (toImport.length === 0) {
                    setError('Nie wybrano żadnych wierszy do importu');
                    return;
                  }
                  importMutation.mutate();
                }
              }}
              disabled={importMutation.isPending}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-blue-600 rounded-xl text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              {importMutation.isPending ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Importuję...
                </>
              ) : (
                <>
                  {step === 'mapping' ? 'Dalej — podgląd' : `Importuj ${parsedRows.filter(r => !r.skipped).length} transakcji`}
                  <ChevronRight />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
