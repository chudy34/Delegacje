'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { transactionsApi, projectsApi, Transaction } from '@/lib/api';
import {
  formatCurrency,
  formatDate,
  getCategoryLabel,
  getCategoryColor,
  CATEGORY_LABELS,
  cn,
} from '@/lib/utils';

// ── Icons ────────────────────────────────────────────
const PlusIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);
const EditIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);
const TrashIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);
const BackIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);
const FilterIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
  </svg>
);
const ReceiptIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
  </svg>
);

// ── Category badge ───────────────────────────────────
function CategoryBadge({ category }: { category: string }) {
  const color = getCategoryColor(category);
  const label = getCategoryLabel(category);
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white"
      style={{ backgroundColor: color }}
    >
      {label}
    </span>
  );
}

// ── Transaction Form Modal ───────────────────────────
interface TransactionFormData {
  date: string;
  description: string;
  amount: string;
  currency: string;
  category: string;
  isPrivate: boolean;
  excludedFromProject: boolean;
}

interface TransactionModalProps {
  projectId: string;
  projectCurrency: string;
  transaction?: Transaction;
  onClose: () => void;
  onSaved: () => void;
}

function TransactionModal({
  projectId,
  projectCurrency,
  transaction,
  onClose,
  onSaved,
}: TransactionModalProps) {
  const isEdit = !!transaction;
  const [form, setForm] = useState<TransactionFormData>({
    date: transaction?.date
      ? new Date(transaction.date).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10),
    description: transaction?.description ?? '',
    amount: transaction?.amount?.toString() ?? '',
    currency: transaction?.currency ?? projectCurrency,
    category: transaction?.category ?? 'OTHER',
    isPrivate: transaction?.isPrivate ?? false,
    excludedFromProject: transaction?.excludedFromProject ?? false,
  });
  const [error, setError] = useState('');

  const createMutation = useMutation({
    mutationFn: (data: Omit<Transaction, 'id' | 'isDeleted' | 'receipt'>) =>
      transactionsApi.create(data),
  });
  const updateMutation = useMutation({
    mutationFn: (data: Partial<Transaction>) =>
      transactionsApi.update(transaction!.id, data),
  });

  const loading = createMutation.isPending || updateMutation.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const amount = parseFloat(form.amount.replace(',', '.'));
    if (isNaN(amount) || amount <= 0) {
      setError('Kwota musi być liczbą większą od 0');
      return;
    }
    if (!form.description.trim()) {
      setError('Opis jest wymagany');
      return;
    }

    const payload = {
      projectId,
      date: new Date(form.date).toISOString(),
      description: form.description.trim(),
      amount,
      currency: form.currency,
      category: form.category,
      isPrivate: form.isPrivate,
      excludedFromProject: form.excludedFromProject,
    };

    try {
      if (isEdit) {
        await updateMutation.mutateAsync(payload);
      } else {
        await createMutation.mutateAsync(payload);
      }
      onSaved();
    } catch {
      setError('Wystąpił błąd. Spróbuj ponownie.');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEdit ? 'Edytuj wydatek' : 'Nowy wydatek'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Data */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
            <input
              type="date"
              value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Opis */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Opis</label>
            <input
              type="text"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="np. Obiad w restauracji"
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Kwota + waluta */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Kwota</label>
              <input
                type="text"
                inputMode="decimal"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="0,00"
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="w-28">
              <label className="block text-sm font-medium text-gray-700 mb-1">Waluta</label>
              <select
                value={form.currency}
                onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {['PLN', 'EUR', 'USD', 'GBP', 'CHF', 'CZK', 'SEK', 'NOK', 'DKK'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Kategoria */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kategoria</label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, category: key }))}
                  className={cn(
                    'px-3 py-2 rounded-lg text-sm font-medium border transition-all',
                    form.category === key
                      ? 'text-white border-transparent'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                  )}
                  style={form.category === key ? { backgroundColor: getCategoryColor(key) } : {}}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Flagi */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isPrivate}
                onChange={e => setForm(f => ({ ...f, isPrivate: e.target.checked }))}
                className="rounded text-blue-600"
              />
              <span className="text-sm text-gray-700">Wydatek prywatny (nie firmowy)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.excludedFromProject}
                onChange={e => setForm(f => ({ ...f, excludedFromProject: e.target.checked }))}
                className="rounded text-blue-600"
              />
              <span className="text-sm text-gray-700">Wyklucz z bilansu projektu</span>
            </label>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Przyciski */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Anuluj
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 rounded-lg text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              {loading ? 'Zapisuję...' : isEdit ? 'Zapisz zmiany' : 'Dodaj wydatek'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Delete Confirm Dialog ────────────────────────────
function DeleteConfirm({
  transaction,
  onConfirm,
  onCancel,
  loading,
}: {
  transaction: Transaction;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Usuń wydatek</h3>
        <p className="text-sm text-gray-600 mb-1">
          Czy na pewno chcesz usunąć:
        </p>
        <p className="text-sm font-medium text-gray-900 mb-4">
          „{transaction.description}" – {formatCurrency(transaction.amount, transaction.currency)}
        </p>
        <p className="text-xs text-gray-500 mb-6">
          Wydatek zostanie przeniesiony do archiwum (soft delete).
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Anuluj
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-red-600 rounded-lg text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60 transition-colors"
          >
            {loading ? 'Usuwam...' : 'Usuń'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────
export default function TransactionsPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = params.id as string;
  const queryClient = useQueryClient();

  const [showModal, setShowModal] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | undefined>();
  const [deletingTx, setDeletingTx] = useState<Transaction | undefined>();
  const [filterCategory, setFilterCategory] = useState('');
  const [filterPrivate, setFilterPrivate] = useState<'all' | 'project' | 'private'>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Otwórz modal dodawania gdy URL ma ?new=1 (np. przekierowanie z project detail)
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setShowModal(true);
      // Wyczyść parametr z URL bez odświeżania strony
      const url = new URL(window.location.href);
      url.searchParams.delete('new');
      window.history.replaceState({}, '', url.toString());
    }
  }, [searchParams]);

  // Dane projektu
  const { data: projectData } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId),
  });
  const project = projectData?.data?.data;

  // Lista transakcji
  const { data: txData, isLoading } = useQuery({
    queryKey: ['transactions', projectId],
    queryFn: () => transactionsApi.list({ projectId, limit: 200 }),
  });
  const allTransactions: Transaction[] = (txData?.data?.data ?? []) as Transaction[];

  // Filtrowanie lokalne
  const transactions = allTransactions.filter(tx => {
    if (filterCategory && tx.category !== filterCategory) return false;
    if (filterPrivate === 'private' && !tx.isPrivate) return false;
    if (filterPrivate === 'project' && tx.isPrivate) return false;
    return true;
  });

  // Podsumowanie
  const totalAmount = transactions.reduce((sum, tx) => {
    if (!tx.excludedFromProject && !tx.isPrivate) return sum + tx.amount;
    return sum;
  }, 0);
  const projectCurrency = project?.currency ?? 'PLN';

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => transactionsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project-balance', projectId] });
      setDeletingTx(undefined);
    },
  });

  function handleSaved() {
    queryClient.invalidateQueries({ queryKey: ['transactions', projectId] });
    queryClient.invalidateQueries({ queryKey: ['project-balance', projectId] });
    setShowModal(false);
    setEditingTx(undefined);
  }

  function openEdit(tx: Transaction) {
    setEditingTx(tx);
    setShowModal(true);
  }

  function openNew() {
    setEditingTx(undefined);
    setShowModal(true);
  }

  // Grupowanie po dacie
  const grouped = transactions.reduce<Record<string, Transaction[]>>((acc, tx) => {
    const day = new Date(tx.date).toISOString().slice(0, 10);
    if (!acc[day]) acc[day] = [];
    acc[day].push(tx);
    return acc;
  }, {});
  const sortedDays = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  const activeFilters = (filterCategory ? 1 : 0) + (filterPrivate !== 'all' ? 1 : 0);

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
            <h1 className="text-lg font-semibold text-gray-900 truncate">
              Wydatki
            </h1>
            {project && (
              <p className="text-xs text-gray-500 truncate">{project.name}</p>
            )}
          </div>
          <button
            onClick={() => setShowFilters(v => !v)}
            className={cn(
              'relative p-2 rounded-lg transition-colors',
              showFilters || activeFilters > 0
                ? 'bg-blue-50 text-blue-600'
                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
            )}
          >
            <FilterIcon />
            {activeFilters > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-600 text-white text-[10px] rounded-full flex items-center justify-center">
                {activeFilters}
              </span>
            )}
          </button>
          <button
            onClick={openNew}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <PlusIcon />
            Dodaj
          </button>
        </div>

        {/* Filtry */}
        {showFilters && (
          <div className="max-w-2xl mx-auto px-4 pb-4 flex flex-wrap gap-3">
            {/* Kategoria */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-gray-500 font-medium">Kategoria:</span>
              <button
                onClick={() => setFilterCategory('')}
                className={cn(
                  'px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
                  !filterCategory ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                Wszystkie
              </button>
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setFilterCategory(key === filterCategory ? '' : key)}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
                    filterCategory === key ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                  style={filterCategory === key ? { backgroundColor: getCategoryColor(key) } : {}}
                >
                  {label}
                </button>
              ))}
            </div>
            {/* Prywatne / firmowe */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500 font-medium">Typ:</span>
              {(['all', 'project', 'private'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setFilterPrivate(v)}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
                    filterPrivate === v ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                >
                  {v === 'all' ? 'Wszystkie' : v === 'project' ? 'Firmowe' : 'Prywatne'}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Summary bar */}
      <div className="max-w-2xl mx-auto px-4 py-3">
        <div className="bg-white rounded-xl border px-4 py-3 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            <span className="font-medium text-gray-900">{transactions.length}</span> wydatków
            {activeFilters > 0 && <span className="text-blue-600 ml-1">(filtrowane)</span>}
          </div>
          <div className="text-sm font-semibold text-gray-900">
            Razem: {formatCurrency(totalAmount, projectCurrency)}
          </div>
        </div>
      </div>

      {/* Lista */}
      <div className="max-w-2xl mx-auto px-4 pb-24 space-y-4">
        {isLoading ? (
          <div className="space-y-3 mt-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border h-20 animate-pulse" />
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="bg-white rounded-2xl border py-16 text-center">
            <div className="text-4xl mb-3">🧾</div>
            <p className="text-gray-500 font-medium">
              {activeFilters > 0 ? 'Brak wydatków dla wybranych filtrów' : 'Brak wydatków w tym projekcie'}
            </p>
            {activeFilters === 0 && (
              <button
                onClick={openNew}
                className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Dodaj pierwszy wydatek
              </button>
            )}
          </div>
        ) : (
          sortedDays.map(day => (
            <div key={day}>
              {/* Nagłówek dnia */}
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {formatDate(day)}
                </span>
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400">
                  {formatCurrency(
                    grouped[day].reduce((s, tx) => s + (tx.isPrivate || tx.excludedFromProject ? 0 : tx.amount), 0),
                    projectCurrency
                  )}
                </span>
              </div>

              {/* Transakcje danego dnia */}
              <div className="space-y-2">
                {grouped[day].map(tx => (
                  <div
                    key={tx.id}
                    className={cn(
                      'bg-white rounded-xl border px-4 py-3 flex items-center gap-3 transition-all',
                      tx.isPrivate && 'opacity-60',
                      tx.excludedFromProject && 'border-dashed'
                    )}
                  >
                    {/* Kategoria dot */}
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-0.5"
                      style={{ backgroundColor: getCategoryColor(tx.category) }}
                    />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-gray-900 truncate">{tx.description}</p>
                        <p className={cn(
                          'text-sm font-semibold flex-shrink-0',
                          tx.isPrivate || tx.excludedFromProject ? 'text-gray-400' : 'text-gray-900'
                        )}>
                          {formatCurrency(tx.amount, tx.currency)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <CategoryBadge category={tx.category} />
                        {tx.isPrivate && (
                          <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full font-medium">
                            prywatny
                          </span>
                        )}
                        {tx.excludedFromProject && (
                          <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-medium">
                            wyklucz.
                          </span>
                        )}
                        {tx.receiptId && (
                          <span className="text-[10px] text-blue-600 flex items-center gap-0.5">
                            <ReceiptIcon />
                            paragon
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Akcje */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => openEdit(tx)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edytuj"
                      >
                        <EditIcon />
                      </button>
                      <button
                        onClick={() => setDeletingTx(tx)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Usuń"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* FAB na mobile */}
      <div className="fixed bottom-6 right-6 md:hidden">
        <button
          onClick={openNew}
          className="w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-blue-700 transition-colors"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Modals */}
      {showModal && project && (
        <TransactionModal
          projectId={projectId}
          projectCurrency={projectCurrency}
          transaction={editingTx}
          onClose={() => { setShowModal(false); setEditingTx(undefined); }}
          onSaved={handleSaved}
        />
      )}
      {deletingTx && (
        <DeleteConfirm
          transaction={deletingTx}
          onConfirm={() => deleteMutation.mutate(deletingTx.id)}
          onCancel={() => setDeletingTx(undefined)}
          loading={deleteMutation.isPending}
        />
      )}
    </div>
  );
}
