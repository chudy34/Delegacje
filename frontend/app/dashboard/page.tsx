'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { projectsApi, type Project } from '@/lib/api';
import { formatCurrency, formatDate, formatDays } from '@/lib/utils';
import {
  PlusIcon,
  MapPinIcon,
  CalendarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ClockIcon,
} from 'lucide-react';

export default function DashboardPage() {
  const { data: projectsResp, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.list({ limit: 10 }),
  });

  const { data: balancesData } = useQuery({
    queryKey: ['active-balances'],
    queryFn: async () => {
      const active = projectsResp?.data?.data?.filter((p) => p.status === 'ACTIVE') ?? [];
      const results = await Promise.allSettled(
        active.map((p) => projectsApi.balance(p.id))
      );
      return Object.fromEntries(
        active.map((p, i) => [
          p.id,
          results[i]?.status === 'fulfilled' ? results[i].value?.data?.data : null,
        ])
      );
    },
    enabled: !!projectsResp?.data?.data?.length,
  });

  const projects = projectsResp?.data?.data ?? [];
  const activeProjects = projects.filter((p) => p.status === 'ACTIVE');
  const closedProjects = projects.filter((p) => p.status === 'CLOSED');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Delegacje</h1>
          <p className="text-gray-500 mt-1">Zarządzaj swoimi wyjazdami służbowymi</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/settings"
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Ustawienia"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </Link>
          <Link href="/projects/new" className="btn-primary flex items-center gap-2">
            <PlusIcon className="w-4 h-4" />
            Nowa delegacja
          </Link>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="card">
          <p className="text-sm text-gray-500">Aktywne</p>
          <p className="text-3xl font-bold text-brand-600 mt-1">{activeProjects.length}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Zakończone</p>
          <p className="text-3xl font-bold text-gray-700 mt-1">{closedProjects.length}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Łącznie</p>
          <p className="text-3xl font-bold text-gray-700 mt-1">{projects.length}</p>
        </div>
      </div>

      {/* Active Projects */}
      {activeProjects.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <ClockIcon className="w-5 h-5 text-brand-600" />
            Aktywne delegacje
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                balance={balancesData?.[project.id]}
              />
            ))}
          </div>
        </section>
      )}

      {/* Recent Closed Projects */}
      {closedProjects.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Ostatnie delegacje</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {closedProjects.slice(0, 4).map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
          {closedProjects.length > 4 && (
            <div className="text-center mt-4">
              <Link href="/projects" className="text-brand-600 hover:underline text-sm">
                Zobacz wszystkie ({projects.length})
              </Link>
            </div>
          )}
        </section>
      )}

      {/* Empty state */}
      {projects.length === 0 && (
        <div className="text-center py-16">
          <MapPinIcon className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-700 mb-2">Brak delegacji</h3>
          <p className="text-gray-500 mb-6">Utwórz swoją pierwszą delegację, aby zacząć.</p>
          <Link href="/projects/new" className="btn-primary inline-flex items-center gap-2">
            <PlusIcon className="w-4 h-4" />
            Nowa delegacja
          </Link>
        </div>
      )}
    </div>
  );
}

function ProjectCard({
  project,
  balance,
}: {
  project: Project;
  balance?: { balance: number; currency?: string } | null;
}) {
  const isActive = project.status === 'ACTIVE';

  const startDate = new Date(project.startDatetime);
  const endDate = project.actualEndDatetime
    ? new Date(project.actualEndDatetime)
    : project.plannedEndDatetime
    ? new Date(project.plannedEndDatetime)
    : null;

  const now = new Date();
  const tripDays = endDate
    ? Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    : Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

  return (
    <Link href={`/projects/${project.id}`}>
      <div className="card hover:shadow-md transition-shadow cursor-pointer">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-semibold text-gray-900">{project.name}</h3>
            <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
              <MapPinIcon className="w-3 h-3" />
              {project.countryName} · {project.currency}
            </p>
          </div>
          <span
            className={`text-xs px-2 py-1 rounded-full font-medium ${
              isActive
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {isActive ? 'Aktywna' : 'Zakończona'}
          </span>
        </div>

        {/* Dates */}
        <div className="flex items-center gap-1 text-sm text-gray-500 mb-3">
          <CalendarIcon className="w-3 h-3" />
          <span>{formatDate(project.startDatetime)}</span>
          {endDate && <span>→ {formatDate(endDate.toISOString())}</span>}
          <span className="ml-auto">{formatDays(tripDays)}</span>
        </div>

        {/* Diet info */}
        <div className="text-xs text-gray-400 mb-3">
          Dieta: {formatCurrency(project.dietAmountSnapshot, project.currency)}/dobę
        </div>

        {/* Balance (if available) */}
        {balance && (
          <div
            className={`flex items-center gap-2 text-sm font-medium ${
              balance.balance >= 0 ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {balance.balance >= 0 ? (
              <ArrowTrendingUpIcon className="w-4 h-4" />
            ) : (
              <ArrowTrendingDownIcon className="w-4 h-4" />
            )}
            <span>
              {balance.balance >= 0
                ? `Oszczędność: +${formatCurrency(balance.balance, project.currency)}`
                : `Do zwrotu: ${formatCurrency(Math.abs(balance.balance), project.currency)}`}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}
