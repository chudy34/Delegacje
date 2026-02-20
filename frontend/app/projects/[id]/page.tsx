'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { projectsApi } from '@/lib/api';
import { formatCurrency, formatDate, formatDateTime, getCategoryLabel, getCategoryColor } from '@/lib/utils';
import {
  ArrowLeftIcon,
  CalendarIcon,
  MapPinIcon,
  ReceiptIcon,
  BanknoteIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  ClipboardListIcon,
  HotelIcon,
  UtensilsIcon,
  CarIcon,
  PlusIcon,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

export default function ProjectDetailPage() {
  const params = useParams();
  const projectId = params.id as string;

  const { data: projectResp, isLoading: projectLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId),
  });

  const { data: balanceResp, isLoading: balanceLoading } = useQuery({
    queryKey: ['project-balance', projectId],
    queryFn: () => projectsApi.balance(projectId),
    refetchInterval: 30000, // refresh every 30s for live mode
  });

  const project = projectResp?.data?.data;
  const balance = balanceResp?.data?.data;

  if (projectLoading || balanceLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <p className="text-gray-500">Projekt nie znaleziony.</p>
      </div>
    );
  }

  const isActive = project.status === 'ACTIVE';
  const balancePositive = (balance?.balance ?? 0) >= 0;

  // Chart data
  const chartData = balance
    ? Object.entries(balance.categoryTotals)
        .filter(([, v]) => v > 0)
        .map(([key, value]) => ({
          name: getCategoryLabel(key),
          value,
          color: getCategoryColor(key),
        }))
    : [];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Back navigation */}
      <Link href="/dashboard" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeftIcon className="w-4 h-4" />
        Powrót
      </Link>

      {/* Project header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
          <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <MapPinIcon className="w-4 h-4" />
              {project.countryName}
            </span>
            <span className="flex items-center gap-1">
              <CalendarIcon className="w-4 h-4" />
              {formatDate(project.startDatetime)}
              {project.plannedEndDatetime && ` → ${formatDate(project.plannedEndDatetime)}`}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${
              isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {isActive ? 'Aktywna' : 'Zakończona'}
          </span>
          {isActive && (
            <>
              <Link
                href={`/projects/${projectId}/edit`}
                className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-600 hover:bg-gray-50 rounded-lg text-sm font-medium transition-colors"
              >
                ✏️ Edytuj
              </Link>
              <Link
                href={`/projects/${projectId}/close`}
                className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-600 hover:bg-gray-50 rounded-lg text-sm font-medium transition-colors"
              >
                🔒 Zamknij
              </Link>
              <Link href={`/projects/${projectId}/transactions?new=1`} className="btn-primary flex items-center gap-2 text-sm">
                <PlusIcon className="w-4 h-4" />
                Dodaj wydatek
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Balance card */}
      {balance && (
        <div
          className={`rounded-2xl p-6 mb-8 ${
            balancePositive
              ? 'bg-gradient-to-br from-green-500 to-emerald-600'
              : 'bg-gradient-to-br from-red-500 to-rose-600'
          } text-white`}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-white/80 text-sm font-medium">Saldo projektu</p>
              <p className="text-4xl font-bold mt-1">
                {balancePositive ? '+' : ''}
                {formatCurrency(balance.balance, project.currency)}
              </p>
              <p className="text-white/80 text-sm mt-2">
                {balancePositive ? '✓ Firma dopłaci do wypłaty' : '⚠ Do zwrotu firmie'}
              </p>
            </div>
            {balancePositive ? (
              <TrendingUpIcon className="w-12 h-12 text-white/30" />
            ) : (
              <TrendingDownIcon className="w-12 h-12 text-white/30" />
            )}
          </div>

          {/* Balance breakdown */}
          <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-white/20">
            <div>
              <p className="text-white/70 text-xs">Zaliczki</p>
              <p className="text-white font-semibold">+{formatCurrency(balance.advancesTotal, project.currency)}</p>
            </div>
            <div>
              <p className="text-white/70 text-xs">Wydatki</p>
              <p className="text-white font-semibold">-{formatCurrency(balance.expensesTotal, project.currency)}</p>
            </div>
            <div>
              <p className="text-white/70 text-xs">Dieta</p>
              <p className="text-white font-semibold">+{formatCurrency(balance.diet.totalDiet, project.currency)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Stats grid */}
      {balance && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="card text-center">
            <p className="text-gray-500 text-xs mb-1">Doby diety</p>
            <p className="text-2xl font-bold text-gray-900">{balance.diet.fullDays}</p>
            <p className="text-xs text-gray-400">+ {balance.diet.partialDay}h</p>
          </div>
          <div className="card text-center">
            <p className="text-gray-500 text-xs mb-1">Liczba wydatków</p>
            <p className="text-2xl font-bold text-gray-900">{balance.transactionCount}</p>
          </div>
          <div className="card text-center">
            <p className="text-gray-500 text-xs mb-1">Śr. dzienna</p>
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrency(balance.averageDailyExpense, project.currency)}
            </p>
          </div>
          <div className="card text-center">
            <p className="text-gray-500 text-xs mb-1">Hotel + parking</p>
            <p className={`text-2xl font-bold ${balance.hotelStatus === 'over_limit' ? 'text-red-600' : 'text-gray-900'}`}>
              {formatCurrency(balance.hotelCombined, project.currency)}
            </p>
            <p className="text-xs text-gray-400">
              limit: {formatCurrency(balance.hotelLimit, project.currency)}
            </p>
          </div>
        </div>
      )}

      {/* Content grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Expenses chart */}
        {chartData.length > 0 && (
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-4">Wydatki wg kategorii</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) =>
                    formatCurrency(value, project.currency)
                  }
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Diet breakdown */}
        {balance && (
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-4">Kalkulacja diety</h3>
            <pre className="text-sm text-gray-600 whitespace-pre-wrap font-mono bg-gray-50 rounded-lg p-4">
              {balance.diet.breakdown}
            </pre>
          </div>
        )}

        {/* Quick links */}
        <div className="card md:col-span-2">
          <h3 className="font-semibold text-gray-900 mb-4">Zarządzaj delegacją</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Link
              href={`/projects/${projectId}/transactions`}
              className="flex flex-col items-center p-4 rounded-xl border border-gray-100 hover:border-brand-200 hover:bg-brand-50 transition-colors"
            >
              <ReceiptIcon className="w-6 h-6 text-brand-600 mb-2" />
              <span className="text-sm font-medium text-gray-700">Wydatki</span>
            </Link>
            <Link
              href={`/projects/${projectId}/advances`}
              className="flex flex-col items-center p-4 rounded-xl border border-gray-100 hover:border-brand-200 hover:bg-brand-50 transition-colors"
            >
              <BanknoteIcon className="w-6 h-6 text-brand-600 mb-2" />
              <span className="text-sm font-medium text-gray-700">Zaliczki</span>
            </Link>
            <Link
              href={`/projects/${projectId}/receipts`}
              className="flex flex-col items-center p-4 rounded-xl border border-gray-100 hover:border-brand-200 hover:bg-brand-50 transition-colors"
            >
              <ClipboardListIcon className="w-6 h-6 text-brand-600 mb-2" />
              <span className="text-sm font-medium text-gray-700">Dokumenty</span>
            </Link>
            <Link
              href={`/projects/${projectId}/receipts/scan`}
              className="flex flex-col items-center p-4 rounded-xl border border-gray-100 hover:border-brand-200 hover:bg-brand-50 transition-colors"
            >
              <span className="text-2xl mb-1">📷</span>
              <span className="text-sm font-medium text-gray-700">Skanuj paragon</span>
            </Link>
            <Link
              href={`/projects/${projectId}/import`}
              className="flex flex-col items-center p-4 rounded-xl border border-gray-100 hover:border-brand-200 hover:bg-brand-50 transition-colors"
            >
              <span className="text-2xl mb-1">📂</span>
              <span className="text-sm font-medium text-gray-700">Import CSV</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
