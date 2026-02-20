'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { advancesApi, projectsApi, Advance } from '@/lib/api';
import { formatCurrency, formatDate, cn } from '@/lib/utils';

// ── Icons ────────────────────────────────────────────
const BackIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);
const PlusIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);
const TrashIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);
const BanknoteIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
);
const InfoIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

// ── Add Advance Modal ────────────────────────────────
interface AdvanceFormData {
  date: string;
  amount: string;
  currency: string;
  description: string;
}

function AddAdvanceModal({
  projectId,
  projectCurrency,
  onClose,
  onSaved,
}: {
  projectId: string;
  projectCurrency: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<AdvanceFormData>({
    date: new Date().toISOString().slice(0, 10),
    amount: '',
    currency: projectCurrency,
    description: '',
  });
  const [error, setError] = useState('');

  const createMutation = useMutation({
    mutationFn: (data: Omit<Advance, 'id'>) => advancesApi.create(data),
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const amount = parseFloat(form.amount.replace(',', '.'));
    if (isNaN(amount) || amount <= 0) {
      setError('Kwota musi być liczbą większą od 0');
      return;
    }

    try {
      await createMutation.mutateAsync({
        projectId,
        date: new Date(form.date).toISOString(),
        amount,
        currency: form.currency,
        description: form.description.trim() || undefined,
      });
      onSaved();
    } catch {
      setError('Wystąpił błąd. Spróbuj ponownie.');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
              <BanknoteIcon />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Nowa zaliczka</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Info */}
        <div className="px-6 pt-4">
          <div className="flex items-start gap-2 bg-blue-50 rounded-xl px-3 py-2.5 text-xs text-blue-700">
            <InfoIcon />
            <p>Zaliczki to środki wpłacone przez firmę przed wyjazdem. Wchodzą do bilansu: <strong>Saldo = Zaliczki − Wydatki + Dieta</strong></p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Data */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data otrzymania</label>
            <input
              type="date"
              value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
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
                autoFocus
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

          {/* Opis (opcjonalny) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Opis <span className="text-gray-400 font-normal">(opcjonalny)</span>
            </label>
            <input
              type="text"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="np. Zaliczka na hotele i transport"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Buttons */}
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
              disabled={createMutation.isPending}
              className="flex-1 px-4 py-2 bg-green-600 rounded-lg text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60 transition-colors"
            >
              {createMutation.isPending ? 'Zapisuję...' : 'Dodaj zaliczkę'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Delete Confirm ───────────────────────────────────
function DeleteConfirm({
  advance,
  onConfirm,
  onCancel,
  loading,
}: {
  advance: Advance;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Usuń zaliczkę</h3>
        <p className="text-sm text-gray-600 mb-1">Czy na pewno chcesz usunąć tę zaliczkę?</p>
        <div className="bg-gray-50 rounded-xl px-4 py-3 my-4">
          <p className="text-base font-bold text-gray-900">
            {formatCurrency(advance.amount, advance.currency)}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">{formatDate(advance.date)}</p>
          {advance.description && (
            <p className="text-sm text-gray-600 mt-1">{advance.description}</p>
          )}
        </div>
        <p className="text-xs text-orange-600 mb-5">
          ⚠️ Usunięcie zmieni bilans projektu.
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
export default function AdvancesPage() {
  const params = useParams();
  const projectId = params.id as string;
  const queryClient = useQueryClient();

  const [showModal, setShowModal] = useState(false);
  const [deletingAdv, setDeletingAdv] = useState<Advance | undefined>();

  // Projekt
  const { data: projectData } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId),
  });
  const project = projectData?.data?.data;
  const projectCurrency = project?.currency ?? 'PLN';

  // Zaliczki
  const { data: advData, isLoading } = useQuery({
    queryKey: ['advances', projectId],
    queryFn: () => advancesApi.list({ projectId }),
  });
  const advances: Advance[] = (advData?.data?.data ?? []) as Advance[];

  // Sumy
  const totalByCurrency = advances.reduce<Record<string, number>>((acc, adv) => {
    acc[adv.currency] = (acc[adv.currency] ?? 0) + adv.amount;
    return acc;
  }, {});

  // Delete
  const deleteMutation = useMutation({
    mutationFn: (id: string) => advancesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['advances', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project-balance', projectId] });
      setDeletingAdv(undefined);
    },
  });

  function handleSaved() {
    queryClient.invalidateQueries({ queryKey: ['advances', projectId] });
    queryClient.invalidateQueries({ queryKey: ['project-balance', projectId] });
    setShowModal(false);
  }

  // Sortowanie od najnowszej
  const sorted = [...advances].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

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
            <h1 className="text-lg font-semibold text-gray-900">Zaliczki</h1>
            {project && <p className="text-xs text-gray-500 truncate">{project.name}</p>}
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
          >
            <PlusIcon />
            Dodaj
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">

        {/* Podsumowanie */}
        {advances.length > 0 && (
          <div className="bg-white rounded-2xl border p-5">
            <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-3">
              Łączne zaliczki
            </p>
            <div className="space-y-2">
              {Object.entries(totalByCurrency).map(([currency, total]) => (
                <div key={currency} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{currency}</span>
                  <span className="text-xl font-bold text-green-700">
                    {formatCurrency(total, currency)}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t flex items-center gap-1.5 text-xs text-gray-400">
              <InfoIcon />
              <span>Zaliczki pomniejszają kwotę do zwrotu lub zwiększają oszczędność</span>
            </div>
          </div>
        )}

        {/* Lista */}
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border h-20 animate-pulse" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="bg-white rounded-2xl border py-16 text-center">
            <div className="text-4xl mb-3">💰</div>
            <p className="text-gray-500 font-medium">Brak zaliczek</p>
            <p className="text-sm text-gray-400 mt-1 mb-5">
              Dodaj zaliczki otrzymane od firmy przed lub w trakcie delegacji
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="px-5 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
            >
              Dodaj pierwszą zaliczkę
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {sorted.map((adv, idx) => (
              <div
                key={adv.id}
                className={cn(
                  'bg-white rounded-xl border px-4 py-4 flex items-center gap-4 transition-all hover:border-gray-300',
                  idx === 0 && 'border-green-100 bg-green-50/30'
                )}
              >
                {/* Ikona */}
                <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <BanknoteIcon />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-base font-bold text-green-700">
                      {formatCurrency(adv.amount, adv.currency)}
                    </p>
                    <p className="text-sm text-gray-500 flex-shrink-0">
                      {formatDate(adv.date)}
                    </p>
                  </div>
                  {adv.description ? (
                    <p className="text-sm text-gray-600 mt-0.5 truncate">{adv.description}</p>
                  ) : (
                    <p className="text-sm text-gray-400 mt-0.5 italic">Brak opisu</p>
                  )}
                </div>

                {/* Usuń */}
                <button
                  onClick={() => setDeletingAdv(adv)}
                  className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                  title="Usuń zaliczkę"
                >
                  <TrashIcon />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Footer note */}
        {advances.length > 0 && (
          <p className="text-center text-xs text-gray-400 pb-4">
            {advances.length} {advances.length === 1 ? 'zaliczka' : advances.length < 5 ? 'zaliczki' : 'zaliczek'}
          </p>
        )}
      </div>

      {/* FAB mobile */}
      <div className="fixed bottom-6 right-6 md:hidden">
        <button
          onClick={() => setShowModal(true)}
          className="w-14 h-14 bg-green-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-green-700 transition-colors"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Modals */}
      {showModal && (
        <AddAdvanceModal
          projectId={projectId}
          projectCurrency={projectCurrency}
          onClose={() => setShowModal(false)}
          onSaved={handleSaved}
        />
      )}
      {deletingAdv && (
        <DeleteConfirm
          advance={deletingAdv}
          onConfirm={() => deleteMutation.mutate(deletingAdv.id)}
          onCancel={() => setDeletingAdv(undefined)}
          loading={deleteMutation.isPending}
        />
      )}
    </div>
  );
}
