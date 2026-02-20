import { redirect } from 'next/navigation';

/**
 * Root page - redirect to dashboard.
 * Auth middleware (middleware.ts) handles unauthenticated users → login.
 */
export default function RootPage() {
  redirect('/dashboard');
}
