'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi, authApi, User, UserSettings } from '@/lib/api';
import { CATEGORY_LABELS, getCategoryColor, cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

// ── Icons ────────────────────────────────────────────
const BackIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);
const CheckIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);
const TrashIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);
const PlusIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);
const EyeIcon = ({ show }: { show: boolean }) => show ? (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
  </svg>
) : (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

// ── Helpers ──────────────────────────────────────────
function SaveButton({ loading, saved }: { loading: boolean; saved: boolean }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className={cn(
        'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all',
        saved
          ? 'bg-green-600 text-white'
          : 'bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60'
      )}
    >
      {saved ? <><CheckIcon /> Zapisano</> : loading ? 'Zapisuję...' : 'Zapisz zmiany'}
    </button>
  );
}

function SectionCard({ title, description, children }: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border p-6 space-y-5">
      <div>
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        {description && <p className="text-sm text-gray-500 mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange, label, description }: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <div className="relative flex-shrink-0 mt-0.5">
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          onChange={e => onChange(e.target.checked)}
        />
        <div className={cn(
          'w-10 h-6 rounded-full transition-colors',
          checked ? 'bg-blue-600' : 'bg-gray-300'
        )} />
        <div className={cn(
          'absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform',
          checked ? 'left-5' : 'left-1'
        )} />
      </div>
      <div>
        <p className="text-sm font-medium text-gray-900">{label}</p>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
    </label>
  );
}

// ── Section 1: Profil ────────────────────────────────
function ProfileSection({ user }: { user: User }) {
  const [form, setForm] = useState({
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
  });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: (data: typeof form) => usersApi.updateProfile(data),
    onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 2500); },
    onError: () => setError('Błąd zapisu. Spróbuj ponownie.'),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    mutation.mutate(form);
  }

  return (
    <SectionCard title="Profil" description="Twoje dane osobowe i adres email">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Imię</label>
            <input
              type="text"
              value={form.firstName}
              onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nazwisko</label>
            <input
              type="text"
              value={form.lastName}
              onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
          <input
            type="email"
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end">
          <SaveButton loading={mutation.isPending} saved={saved} />
        </div>
      </form>
    </SectionCard>
  );
}

// ── Section 2: Hasło ─────────────────────────────────
function PasswordSection() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [showPasswords, setShowPasswords] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      usersApi.updateProfile(data),
    onSuccess: () => {
      setSaved(true);
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => setSaved(false), 2500);
    },
    onError: () => setError('Nieprawidłowe aktualne hasło lub błąd serwera.'),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (form.newPassword !== form.confirmPassword) {
      setError('Nowe hasła nie są identyczne');
      return;
    }
    if (form.newPassword.length < 8 || !/[A-Z]/.test(form.newPassword) || !/[0-9]/.test(form.newPassword)) {
      setError('Hasło musi mieć min. 8 znaków, wielką literę i cyfrę');
      return;
    }
    mutation.mutate({ currentPassword: form.currentPassword, newPassword: form.newPassword });
  }

  return (
    <SectionCard title="Zmiana hasła">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Aktualne hasło</label>
          <div className="relative">
            <input
              type={showPasswords ? 'text' : 'password'}
              value={form.currentPassword}
              onChange={e => setForm(f => ({ ...f, currentPassword: e.target.value }))}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={() => setShowPasswords(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
            >
              <EyeIcon show={showPasswords} />
            </button>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Nowe hasło</label>
          <input
            type={showPasswords ? 'text' : 'password'}
            value={form.newPassword}
            onChange={e => setForm(f => ({ ...f, newPassword: e.target.value }))}
            required
            placeholder="Min. 8 znaków, wielka litera, cyfra"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Potwierdź nowe hasło</label>
          <input
            type={showPasswords ? 'text' : 'password'}
            value={form.confirmPassword}
            onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
            required
            className={cn(
              'w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500',
              form.confirmPassword && form.confirmPassword !== form.newPassword
                ? 'border-red-300 bg-red-50'
                : 'border-gray-300'
            )}
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end">
          <SaveButton loading={mutation.isPending} saved={saved} />
        </div>
      </form>
    </SectionCard>
  );
}

// ── Section 3: Ustawienia podatkowe ─────────────────
const CONTRACT_TYPES = [
  { value: 'CIVIL_CONTRACT', label: 'Umowa zlecenie', desc: 'ZUS + PIT 12%' },
  { value: 'EMPLOYMENT', label: 'Umowa o pracę', desc: 'Pełny ZUS pracowniczy' },
  { value: 'B2B', label: 'B2B / działalność', desc: 'Rozliczenie własne' },
  { value: 'OTHER', label: 'Inne', desc: 'Niestandardowe' },
] as const;

function TaxSection({ user }: { user: User }) {
  const [form, setForm] = useState<UserSettings>({
    contractType: user.contractType,
    voluntarySocialSecurity: user.voluntarySocialSecurity,
    ppkEnabled: user.ppkEnabled,
    ppkPercentage: user.ppkPercentage,
  });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: (data: UserSettings) => usersApi.updateSettings(data),
    onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 2500); },
    onError: () => setError('Błąd zapisu.'),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    mutation.mutate(form);
  }

  return (
    <SectionCard
      title="Ustawienia podatkowe"
      description="Używane do kalkulacji wynagrodzenia netto w projektach. Zmiany nie wpływają na już zamknięte projekty (snapshot)."
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Typ umowy */}
        <div>
          <p className="text-xs font-medium text-gray-600 mb-2">Typ umowy</p>
          <div className="grid grid-cols-2 gap-2">
            {CONTRACT_TYPES.map(ct => (
              <label
                key={ct.value}
                className={cn(
                  'flex flex-col p-3 rounded-xl border-2 cursor-pointer transition-all',
                  form.contractType === ct.value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                )}
              >
                <input
                  type="radio"
                  name="contractType"
                  value={ct.value}
                  checked={form.contractType === ct.value}
                  onChange={() => setForm(f => ({ ...f, contractType: ct.value }))}
                  className="sr-only"
                />
                <span className={cn(
                  'text-sm font-semibold',
                  form.contractType === ct.value ? 'text-blue-700' : 'text-gray-800'
                )}>
                  {ct.label}
                </span>
                <span className="text-xs text-gray-500 mt-0.5">{ct.desc}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Opcje ZUS (tylko zlecenie/praca) */}
        {(form.contractType === 'CIVIL_CONTRACT' || form.contractType === 'EMPLOYMENT') && (
          <div className="space-y-4 pt-1">
            <Toggle
              checked={form.voluntarySocialSecurity ?? false}
              onChange={v => setForm(f => ({ ...f, voluntarySocialSecurity: v }))}
              label="Dobrowolne ubezpieczenie chorobowe"
              description="Składka 2.45% — zalecana dla ochrony zasiłkowej"
            />
            <Toggle
              checked={form.ppkEnabled ?? false}
              onChange={v => setForm(f => ({ ...f, ppkEnabled: v }))}
              label="Pracownicze Plany Kapitałowe (PPK)"
              description="Dodatkowe oszczędności emerytalne"
            />
            {form.ppkEnabled && (
              <div className="ml-13 pl-8">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Składka PPK (twoja część)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={2}
                    max={4}
                    step={0.5}
                    value={form.ppkPercentage ?? 2}
                    onChange={e => setForm(f => ({ ...f, ppkPercentage: parseFloat(e.target.value) }))}
                    className="flex-1 accent-blue-600"
                  />
                  <span className="text-sm font-semibold text-blue-700 w-12 text-right">
                    {form.ppkPercentage ?? 2}%
                  </span>
                </div>
                <p className="text-[10px] text-gray-400 mt-1">Min. 2%, maks. 4% wynagrodzenia brutto</p>
              </div>
            )}
          </div>
        )}

        {/* Info B2B */}
        {form.contractType === 'B2B' && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
            <p className="font-semibold mb-1">B2B — rozliczenie własne</p>
            <p className="text-xs">Kalkulacja netto dla B2B jest złożona i zależy od formy opodatkowania, składki zdrowotnej i ZUS. Skonsultuj z księgowym.</p>
          </div>
        )}

        {/* Stawki 2024 — info */}
        {form.contractType === 'CIVIL_CONTRACT' && (
          <div className="bg-gray-50 rounded-xl p-4 text-xs text-gray-600 space-y-1">
            <p className="font-semibold text-gray-700 mb-2">Stawki 2025 (umowa zlecenie)</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <span>Emerytalne (9.76%)</span><span className="text-gray-500">pracownik</span>
              <span>Rentowe (1.5%)</span><span className="text-gray-500">pracownik</span>
              <span>Zdrowotne (9%)</span><span className="text-gray-500">od podstawy po ZUS</span>
              <span>PIT (12%)</span><span className="text-gray-500">do 120 000 PLN/rok</span>
              <span>Kwota wolna</span><span className="text-gray-500">300 PLN/miesiąc</span>
              <span>KUP (20%)</span><span className="text-gray-500">max 250 PLN/mies.</span>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end">
          <SaveButton loading={mutation.isPending} saved={saved} />
        </div>
      </form>
    </SectionCard>
  );
}

// ── Section 4: Reguły klasyfikacji CSV ───────────────
interface ClassificationRule {
  keyword: string;
  category: string;
  isRegex: boolean;
}

function CsvRulesSection({ user }: { user: User }) {
  const [rules, setRules] = useState<ClassificationRule[]>(
    (user.csvClassificationRules ?? []).map(r => ({
      keyword: r.keyword,
      category: r.category,
      isRegex: r.isRegex ?? false,
    }))
  );
  const [newRule, setNewRule] = useState<ClassificationRule>({
    keyword: '',
    category: 'FOOD',
    isRegex: false,
  });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: (data: UserSettings) => usersApi.updateSettings(data),
    onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 2500); },
    onError: () => setError('Błąd zapisu.'),
  });

  function addRule() {
    if (!newRule.keyword.trim()) return;
    if (newRule.isRegex) {
      try { new RegExp(newRule.keyword); } catch {
        setError('Nieprawidłowe wyrażenie regularne');
        return;
      }
    }
    setRules(r => [...r, { ...newRule, keyword: newRule.keyword.trim() }]);
    setNewRule(r => ({ ...r, keyword: '' }));
    setError('');
  }

  function removeRule(idx: number) {
    setRules(r => r.filter((_, i) => i !== idx));
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate({ csvClassificationRules: rules });
  }

  return (
    <SectionCard
      title="Reguły klasyfikacji CSV"
      description="Gdy importujesz wyciąg bankowy, system automatycznie przypisuje kategorie. Dodaj własne reguły dopasowania słów kluczowych."
    >
      <form onSubmit={handleSave} className="space-y-5">
        {/* Istniejące reguły */}
        {rules.length > 0 ? (
          <div className="space-y-2">
            {rules.map((rule, idx) => (
              <div key={idx} className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 rounded-xl border">
                <code className="flex-1 text-xs font-mono text-gray-800 truncate">
                  {rule.isRegex ? `/${rule.keyword}/` : `"${rule.keyword}"`}
                </code>
                <span className="text-gray-400 text-xs">→</span>
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-medium text-white flex-shrink-0"
                  style={{ backgroundColor: getCategoryColor(rule.category) }}
                >
                  {CATEGORY_LABELS[rule.category] ?? rule.category}
                </span>
                {rule.isRegex && (
                  <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-mono">
                    regex
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => removeRule(idx)}
                  className="p-1 text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
                >
                  <TrashIcon />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-sm text-gray-400 bg-gray-50 rounded-xl border-dashed border">
            Brak reguł — używane są domyślne słowa kluczowe
          </div>
        )}

        {/* Dodaj nową regułę */}
        <div className="bg-blue-50 rounded-xl border border-blue-100 p-4 space-y-3">
          <p className="text-xs font-semibold text-blue-700">Dodaj regułę</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={newRule.keyword}
              onChange={e => setNewRule(r => ({ ...r, keyword: e.target.value }))}
              placeholder={newRule.isRegex ? 'np. hotel|airbnb|booking' : 'np. McDonald'}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addRule(); } }}
            />
            <select
              value={newRule.category}
              onChange={e => setNewRule(r => ({ ...r, category: e.target.value }))}
              className="w-32 border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={addRule}
              disabled={!newRule.keyword.trim()}
              className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors"
            >
              <PlusIcon />
            </button>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={newRule.isRegex}
              onChange={e => setNewRule(r => ({ ...r, isRegex: e.target.checked }))}
              className="rounded text-purple-600"
            />
            <span className="text-xs text-gray-600">
              Użyj wyrażenia regularnego <code className="bg-purple-100 text-purple-700 px-1 rounded text-[10px]">regex</code>
            </span>
          </label>
        </div>

        {/* Domyślne reguły — info */}
        <details className="group">
          <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 list-none flex items-center gap-1">
            <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
            Domyślne reguły wbudowane
          </summary>
          <div className="mt-2 text-[11px] text-gray-500 bg-gray-50 rounded-xl p-3 space-y-1">
            <p><code className="font-mono">hotel|airbnb|booking|hostel</code> → Nocleg</p>
            <p><code className="font-mono">parking</code> → Parking</p>
            <p><code className="font-mono">restaur|obiad|pizza|burger|kfc|mcdonald</code> → Jedzenie</p>
            <p><code className="font-mono">taxi|uber|bolt|train|pkp|ryanair|wizzair</code> → Transport</p>
            <p><code className="font-mono">paliwo|orlen|bp |shell|diesel</code> → Paliwo</p>
            <p className="text-gray-400 mt-1">Twoje reguły mają wyższy priorytet niż domyślne.</p>
          </div>
        </details>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end">
          <SaveButton loading={mutation.isPending} saved={saved} />
        </div>
      </form>
    </SectionCard>
  );
}

// ── Danger zone: wyloguj / usuń konto ───────────────
function DangerZone() {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const logoutMutation = useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: () => {
      localStorage.removeItem('accessToken');
      // Usuń cookie które sprawdza middleware
      document.cookie = 'accessToken=; path=/; max-age=0; SameSite=Lax';
      router.push('/auth/login');
    },
  });

  return (
    <div className="bg-white rounded-2xl border border-red-100 p-6 space-y-4">
      <h2 className="text-base font-semibold text-gray-900">Strefa niebezpieczna</h2>

      <div className="flex items-center justify-between py-3 border-b">
        <div>
          <p className="text-sm font-medium text-gray-700">Wyloguj się</p>
          <p className="text-xs text-gray-400">Zakończ bieżącą sesję</p>
        </div>
        <button
          onClick={() => logoutMutation.mutate()}
          disabled={logoutMutation.isPending}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          {logoutMutation.isPending ? 'Wylogowuję...' : 'Wyloguj'}
        </button>
      </div>

      <div className="flex items-center justify-between py-3">
        <div>
          <p className="text-sm font-medium text-red-700">Usuń konto</p>
          <p className="text-xs text-gray-400">Trwale usuwa konto i wszystkie dane</p>
        </div>
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="px-4 py-2 border border-red-200 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            Usuń konto
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmDelete(false)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              Anuluj
            </button>
            <button
              disabled
              className="px-3 py-2 bg-red-600 rounded-lg text-xs font-medium text-white opacity-60 cursor-not-allowed"
              title="Funkcja niedostępna — skontaktuj się z administratorem"
            >
              Potwierdź usunięcie
            </button>
          </div>
        )}
      </div>
      {confirmDelete && (
        <p className="text-xs text-red-500">
          Aby trwale usunąć konto i wszystkie dane, skontaktuj się z administratorem systemu.
        </p>
      )}
    </div>
  );
}

// ── Nav tabs ─────────────────────────────────────────
const TABS = [
  { id: 'profile', label: '👤 Profil' },
  { id: 'password', label: '🔒 Hasło' },
  { id: 'tax', label: '🧮 Podatki' },
  { id: 'csv', label: '📂 CSV' },
  { id: 'danger', label: '⚠️ Konto' },
] as const;

type TabId = typeof TABS[number]['id'];

// ── Main Page ────────────────────────────────────────
export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('profile');

  const { data, isLoading } = useQuery({
    queryKey: ['user-me'],
    queryFn: () => usersApi.me(),
  });
  const user = data?.data?.data as User | undefined;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <p className="text-gray-500">Nie można wczytać danych użytkownika.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link
            href="/dashboard"
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <BackIcon />
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-gray-900">Ustawienia</h1>
            <p className="text-xs text-gray-500">{user.firstName} {user.lastName} · {user.email}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-2xl mx-auto px-4 flex gap-1 overflow-x-auto pb-0 no-scrollbar">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex-shrink-0 px-3 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap',
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        {activeTab === 'profile' && <ProfileSection user={user} />}
        {activeTab === 'password' && <PasswordSection />}
        {activeTab === 'tax' && <TaxSection user={user} />}
        {activeTab === 'csv' && <CsvRulesSection user={user} />}
        {activeTab === 'danger' && <DangerZone />}
      </div>
    </div>
  );
}
