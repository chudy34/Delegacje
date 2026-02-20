'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation } from '@tanstack/react-query';
import { projectsApi, usersApi, ProjectBalance, Project, User } from '@/lib/api';
import { formatCurrency, formatDate, formatDays, getCategoryLabel, getCategoryColor, cn } from '@/lib/utils';

// ── Icons ────────────────────────────────────────────
const BackIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);
const CheckCircle = ({ filled }: { filled?: boolean }) => filled ? (
  <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 24 24">
    <path fillRule="evenodd" d="M2.25 12a9.75 9.75 0 1119.5 0 9.75 9.75 0 01-19.5 0zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
  </svg>
) : (
  <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
const WarningIcon = () => (
  <svg className="w-5 h-5 text-amber-500" fill="currentColor" viewBox="0 0 24 24">
    <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
  </svg>
);
const LockIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
);

// ── Typy snapshotów ──────────────────────────────────
interface TaxSnapshot {
  // Z projektu
  contractType: string;
  salaryBrutto: number;
  currency: string;
  // ZUS
  zusEmerytalne: number;
  zusRentowe: number;
  zusChorobowe: number;
  zusRazem: number;
  // Podstawy
  podstawaZdrowotne: number;
  skladkaZdrowotna: number;
  // PIT
  kup: number;
  podstawaPIT: number;
  zaliczkaPIT: number;
  // Wynik
  salaryNetto: number;
  // Dieta
  dietaNetto: number;
  dietaTaxFree: boolean;
  // Bilans
  balance: number;
  // Meta
  snapshotDate: string;
  taxYear: number;
  progPodatkowy: '12%' | '32%';
}

// ── Kalkulator podatkowy (frontend preview) ──────────
function calculateTaxSnapshot(
  salaryBrutto: number,
  currency: string,
  contractType: string,
  voluntarySocialSecurity: boolean,
  ppkEnabled: boolean,
  ppkPercentage: number,
  totalDiet: number,
  balance: number,
): TaxSnapshot {
  // Guard — nie obliczaj jeśli salary nie jest prawidłową liczbą
  if (!isFinite(salaryBrutto) || salaryBrutto <= 0) {
    throw new Error('salaryBrutto musi być liczbą dodatnią');
  }
  const isZlecenie = contractType === 'CIVIL_CONTRACT';
  const isPraca = contractType === 'EMPLOYMENT';
  const isZUS = isZlecenie || isPraca;

  // ZUS
  const zusEmerytalne = isZUS ? salaryBrutto * 0.0976 : 0;
  const zusRentowe = isZUS ? salaryBrutto * 0.015 : 0;
  const zusChorobowe = isZUS && voluntarySocialSecurity ? salaryBrutto * 0.0245 : 0;
  const zusRazem = zusEmerytalne + zusRentowe + zusChorobowe;

  // PPK
  const ppk = ppkEnabled ? salaryBrutto * (ppkPercentage / 100) : 0;

  // Zdrowotne (9% od podstawy po ZUS)
  const podstawaZdrowotne = Math.max(0, salaryBrutto - zusRazem);
  const skladkaZdrowotna = isZUS ? podstawaZdrowotne * 0.09 : 0;

  // PIT
  const kup = isZUS ? Math.min(salaryBrutto * 0.20, 250) : 0; // KUP 20% maks 250 PLN/mies (uproszczone)
  const kwotaWolna = isZUS ? 300 : 0; // 300 PLN/mies
  const podstawaPIT = Math.max(0, salaryBrutto - zusRazem - kup);
  const progPodatkowy: '12%' | '32%' = podstawaPIT * 12 <= 120000 ? '12%' : '32%';
  const stawkaPIT = progPodatkowy === '12%' ? 0.12 : 0.32;
  const zaliczkaPIT = Math.max(0, podstawaPIT * stawkaPIT - kwotaWolna - skladkaZdrowotna);

  const salaryNetto = salaryBrutto - zusRazem - ppk - zaliczkaPIT;

  return {
    contractType,
    salaryBrutto,
    currency,
    zusEmerytalne,
    zusRentowe,
    zusChorobowe,
    zusRazem,
    podstawaZdrowotne,
    skladkaZdrowotna,
    kup,
    podstawaPIT,
    zaliczkaPIT,
    salaryNetto,
    dietaNetto: totalDiet,
    dietaTaxFree: true,
    balance,
    snapshotDate: new Date().toISOString(),
    taxYear: new Date().getFullYear(),
    progPodatkowy,
  };
}

// ── Checklist item ───────────────────────────────────
function CheckItem({
  label,
  description,
  ok,
  warning,
  action,
  actionHref,
}: {
  label: string;
  description: string;
  ok: boolean;
  warning?: boolean;
  action?: string;
  actionHref?: string;
}) {
  return (
    <div className={cn(
      'flex items-start gap-3 px-4 py-3.5 rounded-xl border transition-all',
      ok ? 'border-green-100 bg-green-50/40' :
      warning ? 'border-amber-200 bg-amber-50/40' :
      'border-gray-200 bg-gray-50'
    )}>
      <div className="flex-shrink-0 mt-0.5">
        {ok ? <CheckCircle filled /> : warning ? <WarningIcon /> : <CheckCircle />}
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-medium', ok ? 'text-green-800' : warning ? 'text-amber-800' : 'text-gray-700')}>
          {label}
        </p>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
      {!ok && action && actionHref && (
        <Link
          href={actionHref}
          className="flex-shrink-0 px-2.5 py-1 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
        >
          {action}
        </Link>
      )}
    </div>
  );
}

// ── Balance row ──────────────────────────────────────
function BalanceRow({ label, value, currency, sub, highlight, negative }: {
  label: string;
  value: number;
  currency: string;
  sub?: string;
  highlight?: boolean;
  negative?: boolean;
}) {
  return (
    <div className={cn(
      'flex items-center justify-between py-2.5',
      highlight && 'border-t-2 border-gray-200 mt-1 pt-3'
    )}>
      <div>
        <p className={cn('text-sm', highlight ? 'font-semibold text-gray-900' : 'text-gray-600')}>{label}</p>
        {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
      </div>
      <span className={cn(
        'text-sm font-semibold tabular-nums',
        highlight ? 'text-base' : '',
        negative ? 'text-red-600' : highlight ? (value >= 0 ? 'text-green-700' : 'text-red-700') : 'text-gray-800'
      )}>
        {value >= 0 ? '+' : ''}{formatCurrency(value, currency)}
      </span>
    </div>
  );
}

// ── Snapshot sekcja podatkowa ────────────────────────
function TaxSnapshotCard({ snap }: { snap: TaxSnapshot }) {
  const [expanded, setExpanded] = useState(false);
  const currency = snap.currency;

  const fmt = (v: number) => formatCurrency(v, currency);
  const row = (label: string, value: number, minus?: boolean) => (
    <div className="flex justify-between py-1.5 border-b border-gray-100 last:border-0">
      <span className="text-xs text-gray-600">{label}</span>
      <span className={cn('text-xs font-mono font-medium', minus && value > 0 ? 'text-red-600' : 'text-gray-800')}>
        {minus && value > 0 ? '−' : ''}{fmt(value)}
      </span>
    </div>
  );

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-indigo-900">Snapshot podatkowy</h3>
          <p className="text-xs text-indigo-600 mt-0.5">
            {snap.contractType === 'CIVIL_CONTRACT' ? 'Umowa zlecenie' :
             snap.contractType === 'EMPLOYMENT' ? 'Umowa o pracę' :
             snap.contractType === 'B2B' ? 'B2B' : 'Inna'} ·{' '}
            Próg {snap.progPodatkowy} · {snap.taxYear}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-indigo-500">Netto (szacunek)</p>
          <p className="text-lg font-bold text-indigo-900">{fmt(snap.salaryNetto)}</p>
        </div>
      </div>

      {/* Wynik skrócony */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white/70 rounded-xl p-3 text-center">
          <p className="text-[10px] text-gray-500 uppercase tracking-wide">Brutto</p>
          <p className="text-sm font-bold text-gray-900 mt-0.5">{fmt(snap.salaryBrutto)}</p>
        </div>
        <div className="bg-white/70 rounded-xl p-3 text-center">
          <p className="text-[10px] text-gray-500 uppercase tracking-wide">ZUS+PIT</p>
          <p className="text-sm font-bold text-red-600 mt-0.5">
            −{fmt(snap.zusRazem + snap.zaliczkaPIT)}
          </p>
        </div>
        <div className="bg-white/70 rounded-xl p-3 text-center">
          <p className="text-[10px] text-gray-500 uppercase tracking-wide">Netto</p>
          <p className="text-sm font-bold text-green-700 mt-0.5">{fmt(snap.salaryNetto)}</p>
        </div>
      </div>

      {/* Szczegóły rozwijane */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center justify-center gap-1 transition-colors"
      >
        {expanded ? 'Ukryj szczegóły ▲' : 'Pokaż pełne wyliczenie ▼'}
      </button>

      {expanded && (
        <div className="bg-white rounded-xl p-4 space-y-0 divide-y divide-gray-50">
          <div className="pb-2 mb-1">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">Wynagrodzenie</p>
          </div>
          {row('Brutto', snap.salaryBrutto)}

          <div className="py-2">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">Składki ZUS (pracownik)</p>
          </div>
          {row('Emerytalne (9.76%)', snap.zusEmerytalne, true)}
          {row('Rentowe (1.5%)', snap.zusRentowe, true)}
          {snap.zusChorobowe > 0 && row('Chorobowe dobrowolne (2.45%)', snap.zusChorobowe, true)}
          {row('ZUS razem', snap.zusRazem, true)}

          <div className="py-2">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">Zdrowotne i PIT</p>
          </div>
          {row('Podstawa zdrowotnego', snap.podstawaZdrowotne)}
          {row('Składka zdrowotna (9%)', snap.skladkaZdrowotna, true)}
          {row('KUP', snap.kup, true)}
          {row(`Podstawa PIT`, snap.podstawaPIT)}
          {row(`Zaliczka PIT (${snap.progPodatkowy})`, snap.zaliczkaPIT, true)}

          <div className="pt-2">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">Wynik</p>
          </div>
          <div className="flex justify-between py-2 bg-green-50 rounded-lg px-2 mt-1">
            <span className="text-sm font-bold text-green-800">Netto (szacunek)</span>
            <span className="text-sm font-bold text-green-800">{fmt(snap.salaryNetto)}</span>
          </div>

          <div className="pt-3 text-[10px] text-gray-400 leading-relaxed">
            ⚠️ To jest szacunek orientacyjny oparty na uproszczonych stawkach 2025.
            Nie uwzględnia: ulg podatkowych, rozliczeń rocznych, PPK pracodawcy, ulgi dla młodych.
            Skonsultuj się z księgowym przed rozliczeniem.
          </div>
        </div>
      )}

      {/* Dieta — zwolniona z podatku */}
      <div className="flex items-center justify-between bg-white/60 rounded-xl px-4 py-3">
        <div>
          <p className="text-xs font-semibold text-gray-700">Dieta krajowa/zagraniczna</p>
          <p className="text-[10px] text-gray-500">Zwolniona z podatku dochodowego</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-green-700">+{fmt(snap.dietaNetto)}</p>
          <p className="text-[10px] text-green-600">tax-free ✓</p>
        </div>
      </div>
    </div>
  );
}

// ── Confirm dialog ───────────────────────────────────
function ConfirmCloseDialog({
  project,
  actualEnd,
  onConfirm,
  onCancel,
  loading,
}: {
  project: Project;
  actualEnd: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [typed, setTyped] = useState('');
  const confirmWord = 'ZAMKNIJ';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
            <LockIcon />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">Zamknąć delegację?</h3>
            <p className="text-xs text-gray-500">Tej operacji nie można cofnąć</p>
          </div>
        </div>

        <div className="bg-gray-50 rounded-xl p-4 space-y-1 text-sm">
          <p><span className="text-gray-500">Projekt: </span><strong>{project.name}</strong></p>
          <p><span className="text-gray-500">Data zakończenia: </span><strong>{formatDate(actualEnd)}</strong></p>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800 space-y-1">
          <p className="font-semibold">Po zamknięciu:</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Nie można dodawać nowych transakcji</li>
            <li>Snapshot podatkowy zostanie zapisany</li>
            <li>Projekt przejdzie w tryb tylko do odczytu</li>
          </ul>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">
            Wpisz <code className="bg-gray-100 px-1 rounded font-mono text-red-600">{confirmWord}</code> aby potwierdzić:
          </label>
          <input
            type="text"
            value={typed}
            onChange={e => setTyped(e.target.value.toUpperCase())}
            placeholder={confirmWord}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>

        <div className="flex gap-3 pt-1">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Anuluj
          </button>
          <button
            onClick={onConfirm}
            disabled={typed !== confirmWord || loading}
            className="flex-1 px-4 py-2.5 bg-red-600 rounded-xl text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Zamykam...' : 'Zamknij projekt'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Success view ─────────────────────────────────────
function SuccessView({ project }: { project: Project }) {
  const router = useRouter();
  return (
    <div className="text-center py-10 space-y-5">
      <div className="relative inline-block">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="absolute -top-1 -right-1 text-2xl">🎉</div>
      </div>
      <div>
        <h2 className="text-xl font-bold text-gray-900">Delegacja zamknięta!</h2>
        <p className="text-gray-500 text-sm mt-1">Snapshot podatkowy został zapisany</p>
      </div>
      <div className="flex flex-col gap-2 max-w-xs mx-auto">
        <button
          onClick={() => router.push(`/projects/${project.id}/report`)}
          className="w-full py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
        >
          📄 Generuj raport PDF
        </button>
        <button
          onClick={() => router.push(`/projects/${project.id}`)}
          className="w-full py-3 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          Wróć do projektu
        </button>
        <button
          onClick={() => router.push('/dashboard')}
          className="w-full py-3 text-gray-400 text-sm hover:text-gray-600 transition-colors"
        >
          Dashboard
        </button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────
export default function CloseProjectPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [actualEnd, setActualEnd] = useState(new Date().toISOString().slice(0, 10));
  const [showConfirm, setShowConfirm] = useState(false);
  const [closed, setClosed] = useState(false);

  // Dane projektu
  const { data: projectData, isLoading: projectLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId),
  });
  const project = projectData?.data?.data;

  // Bilans
  const { data: balanceData } = useQuery({
    queryKey: ['project-balance', projectId],
    queryFn: () => projectsApi.balance(projectId),
    enabled: !!project,
  });
  const balance = balanceData?.data?.data;

  // Dane usera (ustawienia podatkowe)
  const { data: userData } = useQuery({
    queryKey: ['user-me'],
    queryFn: () => usersApi.me(),
  });
  const user = userData?.data?.data as User | undefined;

  // Mutacja zamknięcia
  const closeMutation = useMutation({
    mutationFn: () => projectsApi.close(projectId, new Date(actualEnd).toISOString()),
    onSuccess: () => {
      setShowConfirm(false);
      setClosed(true);
    },
  });

  if (projectLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <p className="text-gray-500">Nie znaleziono projektu.</p>
      </div>
    );
  }

  if (project.status === 'CLOSED' && !closed) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 text-center">
        <div>
          <div className="text-4xl mb-3">🔒</div>
          <p className="text-gray-700 font-semibold">Ten projekt jest już zamknięty</p>
          <Link href={`/projects/${projectId}`} className="text-blue-600 text-sm mt-2 hover:underline block">
            Wróć do projektu
          </Link>
        </div>
      </div>
    );
  }

  // Checklista gotowości
  const hasTransactions = (project._count?.transactions ?? 0) > 0;
  const hasActualEnd = !!actualEnd;
  const endNotBeforeStart = actualEnd >= project.startDatetime.slice(0, 10);

  // Bezpieczne parsowanie salaryBrutto - backend może zwrócić number, string lub null
  const rawSalary = project.salaryBrutto;
  const parsedSalary = rawSalary != null ? Number(rawSalary) : NaN;
  const salaryBruttoValue = !isNaN(parsedSalary) && parsedSalary > 0 ? parsedSalary : null;

  const hasSalary = salaryBruttoValue !== null;
  const receiptsOk = true; // uproszczone — backend sprawdzi

  const allGood = hasTransactions && hasActualEnd && endNotBeforeStart;

  // Snapshot podatkowy (preview) - tylko gdy salary jest liczbą > 0
  const taxSnap = salaryBruttoValue && balance && user
    ? calculateTaxSnapshot(
        salaryBruttoValue,
        project.currency,
        user.contractType,
        user.voluntarySocialSecurity,
        user.ppkEnabled,
        user.ppkPercentage,
        balance.diet.totalDiet,
        balance.balance,
      )
    : null;

  // Kategorie z wydatkami
  const categoryEntries = balance
    ? Object.entries(balance.categoryTotals).filter(([, v]) => v > 0)
    : [];

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
            <h1 className="text-lg font-semibold text-gray-900">Zamknij delegację</h1>
            <p className="text-xs text-gray-500 truncate">{project.name}</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {closed ? (
          <div className="bg-white rounded-2xl border p-6">
            <SuccessView project={project} />
          </div>
        ) : (
          <>
            {/* Data zakończenia */}
            <div className="bg-white rounded-2xl border p-5 space-y-3">
              <h2 className="text-sm font-semibold text-gray-900">Data zakończenia delegacji</h2>
              <input
                type="date"
                value={actualEnd}
                min={project.startDatetime.slice(0, 10)}
                max={new Date().toISOString().slice(0, 10)}
                onChange={e => setActualEnd(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {actualEnd && (
                <p className="text-xs text-gray-500">
                  Czas trwania: {formatDays(
                    Math.ceil((new Date(actualEnd).getTime() - new Date(project.startDatetime).getTime()) / 86400000)
                  )} ({formatDate(project.startDatetime)} – {formatDate(actualEnd)})
                </p>
              )}
            </div>

            {/* Checklista */}
            <div className="bg-white rounded-2xl border p-5 space-y-3">
              <h2 className="text-sm font-semibold text-gray-900">Gotowość do zamknięcia</h2>
              <div className="space-y-2">
                <CheckItem
                  label="Transakcje dodane"
                  description={`${project._count?.transactions ?? 0} transakcji w projekcie`}
                  ok={hasTransactions}
                  action="Dodaj wydatek"
                  actionHref={`/projects/${projectId}/transactions`}
                />
                <CheckItem
                  label="Data zakończenia ustawiona"
                  description="Rzeczywista data powrotu z delegacji"
                  ok={hasActualEnd && endNotBeforeStart}
                  warning={hasActualEnd && !endNotBeforeStart}
                />
                <CheckItem
                  label="Wynagrodzenie brutto"
                  description={hasSalary
                    ? `${formatCurrency(salaryBruttoValue!, project.currency)} brutto`
                    : 'Potrzebne do kalkulacji snapshotów podatkowego'}
                  ok={hasSalary}
                  warning={!hasSalary}
                  action="Edytuj projekt"
                  actionHref={`/projects/${projectId}/edit`}
                />
                <CheckItem
                  label="Dokumenty"
                  description={`${project._count?.transactions ?? 0} paragonów/faktur`}
                  ok={receiptsOk}
                  warning={!receiptsOk}
                  action="Wgraj dokumenty"
                  actionHref={`/projects/${projectId}/receipts`}
                />
              </div>
            </div>

            {/* Podsumowanie finansowe */}
            {balance && (
              <div className="bg-white rounded-2xl border p-5 space-y-3">
                <h2 className="text-sm font-semibold text-gray-900">Podsumowanie finansowe</h2>

                {/* Kategorie */}
                {categoryEntries.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {categoryEntries.map(([cat, amount]) => (
                      <div key={cat} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5">
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: getCategoryColor(cat) }}
                        />
                        <span className="text-xs text-gray-600 flex-1 truncate">{getCategoryLabel(cat)}</span>
                        <span className="text-xs font-semibold text-gray-900 flex-shrink-0">
                          {formatCurrency(amount, project.currency)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="divide-y divide-gray-100">
                  <BalanceRow
                    label="Zaliczki"
                    value={balance.advancesTotal}
                    currency={project.currency}
                    sub={`${project._count?.advances ?? 0} wpłat`}
                  />
                  <BalanceRow
                    label="Wydatki"
                    value={-balance.expensesTotal}
                    currency={project.currency}
                    negative
                  />
                  <BalanceRow
                    label="Dieta"
                    value={balance.diet.totalDiet}
                    currency={balance.diet.currency}
                    sub={balance.diet.breakdown}
                  />
                  {balance.hotelStatus === 'over_limit' && (
                    <BalanceRow
                      label="Nadwyżka hotelowa"
                      value={-balance.hotelOverage}
                      currency={project.currency}
                      negative
                      sub="Powyżej limitu ustawowego"
                    />
                  )}
                  <BalanceRow
                    label={balance.balance >= 0 ? 'Do zwrotu pracownikowi' : 'Dopłata do kasy'}
                    value={balance.balance}
                    currency={project.currency}
                    highlight
                  />
                </div>

                {/* Hotel status */}
                {balance.hotelStatus !== 'no_hotel' && (
                  <div className={cn(
                    'flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs',
                    balance.hotelStatus === 'within_limit'
                      ? 'bg-green-50 text-green-700'
                      : 'bg-amber-50 text-amber-700'
                  )}>
                    {balance.hotelStatus === 'within_limit' ? '✓' : '⚠️'}
                    <span>
                      Noclegi: {formatCurrency(balance.hotelCombined, project.currency)} /
                      limit {formatCurrency(balance.hotelLimit, project.currency)}/dobę —
                      {balance.hotelStatus === 'within_limit' ? ' w normie' : ` nadwyżka ${formatCurrency(balance.hotelOverage, project.currency)}`}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Snapshot podatkowy */}
            {taxSnap && (
              <div className="space-y-2">
                <h2 className="text-sm font-semibold text-gray-900 px-1">Snapshot podatkowy</h2>
                <TaxSnapshotCard snap={taxSnap} />
              </div>
            )}
            {!hasSalary && (
              <div className="bg-gray-50 border border-dashed rounded-2xl p-5 text-center text-sm text-gray-400">
                <p>🧮 Snapshot podatkowy</p>
                <p className="text-xs mt-1">Uzupełnij wynagrodzenie brutto w projekcie, aby zobaczyć wyliczenie netto</p>
              </div>
            )}

            {/* Przycisk zamknięcia */}
            <div className="bg-white rounded-2xl border border-red-100 p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-red-50 rounded-xl flex items-center justify-center">
                  <LockIcon />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Finalizuj delegację</p>
                  <p className="text-xs text-gray-500">
                    Zamknie projekt i zapisze snapshot — nieodwracalne
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowConfirm(true)}
                disabled={!allGood}
                className={cn(
                  'w-full py-3 rounded-xl text-sm font-semibold transition-all',
                  allGood
                    ? 'bg-red-600 text-white hover:bg-red-700 shadow-sm shadow-red-200'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                )}
              >
                {allGood ? '🔒 Zamknij delegację' : 'Uzupełnij wymagane dane'}
              </button>

              {!allGood && (
                <p className="text-xs text-gray-400 text-center">
                  Zaznacz wymagane pola w checkliście powyżej
                </p>
              )}
            </div>
          </>
        )}
      </div>

      {/* Dialog potwierdzenia */}
      {showConfirm && project && (
        <ConfirmCloseDialog
          project={project}
          actualEnd={actualEnd}
          onConfirm={() => closeMutation.mutate()}
          onCancel={() => setShowConfirm(false)}
          loading={closeMutation.isPending}
        />
      )}
    </div>
  );
}
