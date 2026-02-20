'use client';

import { QueryClient, QueryClientProvider, MutationCache, QueryCache } from '@tanstack/react-query';
import { useState } from 'react';

// ── Globalny toast na błędy sieciowe ────────────────────────
// Prosty system bez zewnętrznej biblioteki – jeden komponent
// który żyje na poziomie providera i nasłuchuje na błędy React Query.

function isNetworkError(error: unknown): boolean {
  const err = error as { code?: string; message?: string; response?: unknown };
  return !err?.response && (err?.code === 'ERR_NETWORK' || err?.code === 'ECONNABORTED' || err?.message === 'Network Error');
}

function getErrorMessage(error: unknown): string {
  const err = error as { response?: { data?: { error?: string }; status?: number }; code?: string; message?: string };

  if (isNetworkError(error)) return 'Brak połączenia z serwerem. Sprawdź połączenie sieciowe.';

  const status = err?.response?.status;
  const serverMsg = err?.response?.data?.error;

  if (serverMsg) return serverMsg;
  if (status === 401) return 'Sesja wygasła. Zaloguj się ponownie.';
  if (status === 403) return 'Brak uprawnień do tej operacji.';
  if (status === 404) return 'Nie znaleziono zasobu.';
  if (status === 422) return 'Nieprawidłowe dane formularza.';
  if (status && status >= 500) return 'Błąd serwera. Spróbuj ponownie za chwilę.';

  return err?.message ?? 'Wystąpił nieoczekiwany błąd.';
}

// ── Toast store (mini globalny state bez zewnętrznej lib) ────
type ToastItem = { id: number; message: string; type: 'error' | 'warning' };
let toastListeners: Array<(toasts: ToastItem[]) => void> = [];
let toastList: ToastItem[] = [];
let nextId = 1;

function addToast(message: string, type: ToastItem['type'] = 'error') {
  const id = nextId++;
  toastList = [...toastList, { id, message, type }];
  toastListeners.forEach(fn => fn(toastList));
  // Auto-usuń po 5s
  setTimeout(() => removeToast(id), 5000);
}

function removeToast(id: number) {
  toastList = toastList.filter(t => t.id !== id);
  toastListeners.forEach(fn => fn(toastList));
}

// ── Toast komponent ──────────────────────────────────────────
import { useEffect, useState as useStateReact } from 'react';

function GlobalToasts() {
  const [toasts, setToasts] = useStateReact<ToastItem[]>([]);

  useEffect(() => {
    const listener = (list: ToastItem[]) => setToasts([...list]);
    toastListeners.push(listener);
    return () => { toastListeners = toastListeners.filter(l => l !== listener); };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-full max-w-sm px-4 pointer-events-none">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-start gap-3 rounded-xl px-4 py-3 shadow-lg text-sm font-medium text-white
            ${toast.type === 'error' ? 'bg-red-600' : 'bg-amber-500'}`}
        >
          <span className="mt-0.5 flex-shrink-0">{toast.type === 'error' ? '⚠️' : '⚡'}</span>
          <span className="flex-1 leading-snug">{toast.message}</span>
          <button
            onClick={() => removeToast(toast.id)}
            className="flex-shrink-0 opacity-75 hover:opacity-100 text-base leading-none"
            aria-label="Zamknij"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Główny Provider ──────────────────────────────────────────
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError(error, query) {
            // Pokaż toast tylko dla nieoczekiwanych błędów (nie 401/404 które
            // są obsługiwane lokalnie w komponentach)
            const err = error as { response?: { status?: number } };
            const status = err?.response?.status;
            // Pomiń 401 (wylogowanie), 404 (lokalna obsługa pustych stanów)
            if (status === 401 || status === 404) return;
            // Pomiń błędy z queries które mają swój własny error handler
            if (query.meta?.suppressGlobalError) return;
            addToast(getErrorMessage(error), 'error');
          },
        }),
        mutationCache: new MutationCache({
          onError(error) {
            const err = error as { response?: { status?: number }; _suppressGlobalError?: boolean };
            if (err?._suppressGlobalError) return;
            const status = err?.response?.status;
            // 400/422 mają szczegółowe komunikaty w formularzach – nie duplikuj
            if (status === 400 || status === 422) return;
            addToast(getErrorMessage(error), 'error');
          },
        }),
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minuta
            retry(failureCount, error) {
              // Nie ponawiaj błędów auth ani not found
              const err = error as { response?: { status?: number } };
              const status = err?.response?.status;
              if (status === 401 || status === 403 || status === 404) return false;
              return failureCount < 1;
            },
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <GlobalToasts />
    </QueryClientProvider>
  );
}
