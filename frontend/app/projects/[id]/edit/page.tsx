'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi, Project } from '@/lib/api';

// ── Icons ────────────────────────────────────────────────────
const BackIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);

const SaveIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M5 13l4 4L19 7" />
  </svg>
);

// ── Form types ───────────────────────────────────────────────
interface EditForm {
  name: string;
  plannedEndDate: string;
  breakfastCount: number;
  salaryBrutto: string; // string w formularzu, konwertujemy przy zapisie
}

function toDateInput(dt: string | null | undefined): string {
  if (!dt) return '';
  return dt.slice(0, 10);
}

export default function EditProjectPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const projectId = params.id as string;

  const [form, setForm] = useState<EditForm>({
    name: '',
    plannedEndDate: '',
    breakfastCount: 0,
    salaryBrutto: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Pobierz projekt
  const { data: projectData, isLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId),
  });

  const project: Project | undefined = projectData?.data?.data;

  // Wypełnij formularz danymi projektu gdy się załaduje
  useEffect(() => {
    if (project) {
      setForm({
        name: project.name,
        plannedEndDate: toDateInput(project.plannedEndDatetime),
        breakfastCount: project.breakfastCount ?? 0,
        salaryBrutto: project.salaryBrutto != null && project.salaryBrutto > 0
          ? String(project.salaryBrutto)
          : '',
      });
    }
  }, [project]);

  // Mutacja zapisu
  const saveMutation = useMutation({
    mutationFn: (data: Parameters<typeof projectsApi.update>[1]) =>
      projectsApi.update(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      setSaved(true);
      setTimeout(() => {
        router.push(`/projects/${projectId}`);
      }, 800);
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr?.response?.data?.error ?? 'Błąd zapisu. Spróbuj ponownie.');
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) {
      setError('Nazwa projektu jest wymagana.');
      return;
    }

    const payload: Parameters<typeof projectsApi.update>[1] = {
      name: form.name.trim(),
      breakfastCount: form.breakfastCount,
    };

    if (form.plannedEndDate) {
      payload.plannedEndDatetime = `${form.plannedEndDate}T23:59:00.000Z`;
    } else {
      payload.plannedEndDatetime = null;
    }

    const salary = parseFloat(form.salaryBrutto);
    if (form.salaryBrutto && !isNaN(salary) && salary > 0) {
      payload.salaryBrutto = salary;
    }

    saveMutation.mutate(payload);
  }

  // ── Render ───────────────────────────────────────────────────

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
        <div className="text-center space-y-3">
          <p className="text-gray-500">Nie znaleziono projektu.</p>
          <Link href="/dashboard" className="text-blue-600 hover:underline text-sm">
            Wróć do dashboardu
          </Link>
        </div>
      </div>
    );
  }

  if (project.status === 'CLOSED') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center space-y-3 max-w-sm">
          <p className="text-2xl">🔒</p>
          <p className="font-semibold text-gray-900">Projekt jest zamknięty</p>
          <p className="text-sm text-gray-500">Zamkniętych projektów nie można edytować.</p>
          <Link
            href={`/projects/${projectId}`}
            className="inline-block mt-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
          >
            Wróć do projektu
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <Link
            href={`/projects/${projectId}`}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <BackIcon />
          </Link>
          <div className="flex-1">
            <h1 className="text-base font-semibold text-gray-900">Edytuj delegację</h1>
            <p className="text-xs text-gray-500 truncate">{project.name}</p>
          </div>
          {saved && (
            <span className="text-xs text-green-600 font-medium flex items-center gap-1">
              <SaveIcon /> Zapisano
            </span>
          )}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Błąd */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          {/* Nazwa */}
          <div className="bg-white rounded-2xl border p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Podstawowe</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Nazwa delegacji <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="np. Targi w Berlinie"
                maxLength={100}
                required
              />
            </div>
          </div>

          {/* Daty */}
          <div className="bg-white rounded-2xl border p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Daty</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Data wyjazdu</label>
              <input
                type="date"
                value={toDateInput(project.startDatetime)}
                disabled
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-400 cursor-not-allowed"
              />
              <p className="text-xs text-gray-400 mt-1">
                Data wyjazdu nie może być zmieniana po utworzeniu projektu.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Planowana data powrotu
              </label>
              <input
                type="date"
                value={form.plannedEndDate}
                onChange={e => setForm(f => ({ ...f, plannedEndDate: e.target.value }))}
                min={toDateInput(project.startDatetime)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-400 mt-1">Opcjonalna — zostaw puste jeśli nieznana.</p>
            </div>
          </div>

          {/* Diety */}
          <div className="bg-white rounded-2xl border p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Diety</h2>

            {/* Info o kraju */}
            <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2.5">
              <div>
                <p className="text-xs text-gray-500">Kraj</p>
                <p className="text-sm font-medium text-gray-800">{project.countryName}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Stawka diety</p>
                <p className="text-sm font-medium text-gray-800">
                  {project.dietAmountSnapshot} {project.currency}/dzień
                </p>
              </div>
            </div>

            <p className="text-xs text-gray-400">
              Kraj i stawka diety są ustalane przy tworzeniu projektu jako snapshot przepisów i nie mogą być zmieniane.
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Śniadania wliczone w cenę noclegu
              </label>
              <p className="text-xs text-gray-500 mb-2">
                Każde śniadanie pomniejsza dietę o 25%.
              </p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, breakfastCount: Math.max(0, f.breakfastCount - 1) }))}
                  className="w-9 h-9 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                  disabled={form.breakfastCount <= 0}
                >
                  −
                </button>
                <span className="w-12 text-center font-semibold text-gray-900 text-lg">
                  {form.breakfastCount}
                </span>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, breakfastCount: f.breakfastCount + 1 }))}
                  className="w-9 h-9 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  +
                </button>
                <span className="text-sm text-gray-500">śniadań</span>
              </div>
            </div>
          </div>

          {/* Wynagrodzenie */}
          <div className="bg-white rounded-2xl border p-5 space-y-4">
            <div className="flex items-start justify-between">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Wynagrodzenie</h2>
              <span className="text-xs text-gray-400">opcjonalne</span>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Brutto za okres delegacji
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={form.salaryBrutto}
                  onChange={e => setForm(f => ({ ...f, salaryBrutto: e.target.value }))}
                  min="0"
                  step="0.01"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="np. 5000.00"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">
                  {project.currency}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Potrzebne do obliczenia snapshotu podatkowego przy zamknięciu delegacji.
                Dane są szyfrowane.
              </p>
            </div>
          </div>

          {/* Przyciski */}
          <div className="flex gap-3 pb-8">
            <Link
              href={`/projects/${projectId}`}
              className="flex-1 py-3 text-center border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Anuluj
            </Link>
            <button
              type="submit"
              disabled={saveMutation.isPending || saved}
              className="flex-1 py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
            >
              {saveMutation.isPending ? (
                <>
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  Zapisuję...
                </>
              ) : saved ? (
                <>
                  <SaveIcon />
                  Zapisano ✓
                </>
              ) : (
                'Zapisz zmiany'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
