/**
 * utils.ts
 * Frontend utility functions
 */

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(dateStr: string | Date): string {
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  return new Intl.DateTimeFormat('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

export function formatDateTime(dateStr: string | Date): string {
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  return new Intl.DateTimeFormat('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatDays(days: number): string {
  const d = Math.abs(Math.round(days));
  if (d === 1) return '1 dzień';
  if (d >= 2 && d <= 4) return `${d} dni`;
  return `${d} dni`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const CATEGORY_LABELS: Record<string, string> = {
  FOOD: 'Jedzenie',
  TRANSPORT: 'Transport',
  HOTEL: 'Nocleg',
  PARKING: 'Parking',
  FUEL: 'Paliwo',
  OTHER: 'Inne',
};

export const CATEGORY_COLORS: Record<string, string> = {
  FOOD: '#f97316',
  TRANSPORT: '#3b82f6',
  HOTEL: '#8b5cf6',
  PARKING: '#06b6d4',
  FUEL: '#84cc16',
  OTHER: '#9ca3af',
};

export function getCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

export function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] ?? '#9ca3af';
}
