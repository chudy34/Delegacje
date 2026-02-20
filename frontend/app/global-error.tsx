'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Tu można dodać logowanie błędów (Sentry, etc.)
    console.error('[GlobalError]', error);
  }, [error]);

  return (
    <html lang="pl">
      <body className="bg-gray-50">
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="text-center max-w-md">
            <div className="text-8xl mb-6">⚠️</div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Ups!</h1>
            <h2 className="text-xl font-semibold text-gray-700 mb-4">Coś poszło nie tak</h2>
            <p className="text-gray-500 mb-2">
              Wystąpił nieoczekiwany błąd. Twoje dane są bezpieczne.
            </p>
            {error.digest && (
              <p className="text-xs text-gray-400 mb-6 font-mono">
                Kod błędu: {error.digest}
              </p>
            )}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={reset}
                className="px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
              >
                Spróbuj ponownie
              </button>
              <Link
                href="/dashboard"
                className="px-6 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                Wróć do dashboardu
              </Link>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
