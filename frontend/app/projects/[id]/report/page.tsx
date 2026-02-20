'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { projectsApi } from '@/lib/api';
import { formatCurrency, formatDate, getCategoryLabel, getCategoryColor } from '@/lib/utils';

const BackIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);

export default function ReportPage() {
  const params = useParams();
  const projectId = params.id as string;

  const { data: projectData, isLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId),
  });

  const { data: balanceData } = useQuery({
    queryKey: ['project-balance', projectId],
    queryFn: () => projectsApi.balance(projectId),
    enabled: !!projectData,
  });

  const project = projectData?.data?.data;
  const balance = balanceData?.data?.data;

  if (isLoading) {
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
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-gray-900">Raport delegacji</h1>
            <p className="text-xs text-gray-500 truncate">{project.name}</p>
          </div>
          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-medium">
            Wkrótce
          </span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {/* Zapowiedź PDF */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 text-white space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-2xl">
              📄
            </div>
            <div>
              <h2 className="text-base font-bold">Generowanie PDF</h2>
              <p className="text-blue-200 text-xs">Funkcja w przygotowaniu</p>
            </div>
          </div>
          <p className="text-sm text-blue-100">
            Raport PDF będzie zawierał pełne podsumowanie delegacji: wydatki według kategorii,
            wyliczenie diety, zestawienie zaliczek, snapshot podatkowy i listę transakcji.
          </p>
          <button
            disabled
            className="w-full py-2.5 bg-white/20 rounded-xl text-sm font-semibold text-white/60 cursor-not-allowed"
          >
            Pobierz PDF (wkrótce)
          </button>
        </div>

        {/* Podgląd danych raportu */}
        {balance && (
          <>
            {/* Nagłówek projektu */}
            <div className="bg-white rounded-2xl border p-5 space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Dane projektu</h3>
              <div className="grid grid-cols-2 gap-y-2 text-sm">
                <span className="text-gray-500">Projekt</span>
                <span className="font-medium text-gray-900">{project.name}</span>

                <span className="text-gray-500">Kraj</span>
                <span className="font-medium text-gray-900">{project.countryName}</span>

                <span className="text-gray-500">Okres</span>
                <span className="font-medium text-gray-900">
                  {formatDate(project.startDatetime)}
                  {project.actualEndDatetime
                    ? ` – ${formatDate(project.actualEndDatetime)}`
                    : project.plannedEndDatetime
                    ? ` – ${formatDate(project.plannedEndDatetime)}`
                    : ''}
                </span>

                <span className="text-gray-500">Status</span>
                <span className={`font-medium ${project.status === 'CLOSED' ? 'text-gray-600' : 'text-green-600'}`}>
                  {project.status === 'CLOSED' ? 'Zamknięta' : 'Aktywna'}
                </span>

                <span className="text-gray-500">Waluta</span>
                <span className="font-medium text-gray-900">{project.currency}</span>
              </div>
            </div>

            {/* Wydatki według kategorii */}
            {categoryEntries.length > 0 && (
              <div className="bg-white rounded-2xl border p-5 space-y-3">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Wydatki według kategorii</h3>
                <div className="space-y-2">
                  {categoryEntries.map(([cat, amount]) => {
                    const total = balance.expensesTotal;
                    const pct = total > 0 ? (amount / total) * 100 : 0;
                    return (
                      <div key={cat} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: getCategoryColor(cat) }}
                            />
                            <span className="text-gray-700">{getCategoryLabel(cat)}</span>
                          </div>
                          <span className="font-semibold text-gray-900">
                            {formatCurrency(amount, project.currency)}
                          </span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: getCategoryColor(cat),
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Podsumowanie finansowe */}
            <div className="bg-white rounded-2xl border p-5 space-y-2">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Podsumowanie finansowe</h3>
              {[
                { label: 'Łączne wydatki', value: balance.expensesTotal, neg: true },
                { label: 'Dieta', value: balance.diet.totalDiet, neg: false, sub: balance.diet.breakdown },
                { label: 'Zaliczki', value: balance.advancesTotal, neg: false },
              ].map(({ label, value, neg, sub }) => (
                <div key={label} className="flex items-start justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm text-gray-600">{label}</p>
                    {sub && <p className="text-[10px] text-gray-400">{sub}</p>}
                  </div>
                  <span className={`text-sm font-semibold ${neg ? 'text-red-600' : 'text-gray-900'}`}>
                    {neg ? '−' : '+'}{formatCurrency(value, project.currency)}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-3">
                <span className="text-sm font-bold text-gray-900">Saldo końcowe</span>
                <span className={`text-base font-bold ${balance.balance >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {balance.balance >= 0 ? '+' : ''}{formatCurrency(balance.balance, project.currency)}
                </span>
              </div>
            </div>

            {/* Dieta - szczegóły */}
            <div className="bg-white rounded-2xl border p-5 space-y-2">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Dieta</h3>
              <div className="grid grid-cols-2 gap-y-2 text-sm">
                <span className="text-gray-500">Stawka dzienna</span>
                <span className="font-medium">{formatCurrency(project.dietAmountSnapshot, project.currency)}</span>
                <span className="text-gray-500">Pełne doby</span>
                <span className="font-medium">{balance.diet.fullDays}</span>
                <span className="text-gray-500">Niepełna doba</span>
                <span className="font-medium">{(balance.diet.partialDayMultiplier * 100).toFixed(0)}%</span>
                <span className="text-gray-500">Razem dieta</span>
                <span className="font-semibold text-green-700">{formatCurrency(balance.diet.totalDiet, balance.diet.currency)}</span>
              </div>
              <p className="text-[10px] text-gray-400 pt-1">
                Dieta zagraniczna jest zwolniona z podatku dochodowego (art. 21 ust. 1 pkt 16 updof)
              </p>
            </div>
          </>
        )}

        {/* Akcje */}
        <div className="flex gap-3">
          <Link
            href={`/projects/${projectId}`}
            className="flex-1 py-3 text-center border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Wróć do projektu
          </Link>
          <Link
            href={`/projects/${projectId}/transactions`}
            className="flex-1 py-3 text-center bg-blue-600 rounded-xl text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            Lista transakcji
          </Link>
        </div>
      </div>
    </div>
  );
}
