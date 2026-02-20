'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { projectsApi, countriesApi, type Country } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, MapPinIcon } from 'lucide-react';

const STEPS = ['Kraj i diety', 'Daty wyjazdu', 'Wynagrodzenie'];

const step1Schema = z.object({
  countryCode: z.string().length(2, 'Wybierz kraj'),
});

const step2Schema = z.object({
  name: z.string().min(1, 'Nazwa jest wymagana').max(100),
  startDate: z.string().min(1, 'Data wyjazdu jest wymagana'),
  startTime: z.string().default('08:00'),
  plannedEndDate: z.string().optional(),
  breakfastCount: z.coerce.number().int().min(0).default(0),
});

const step3Schema = z.object({
  salaryBrutto: z.coerce.number().positive().optional(),
});

type Step1 = z.infer<typeof step1Schema>;
type Step2 = z.infer<typeof step2Schema>;
type Step3 = z.infer<typeof step3Schema>;

export default function NewProjectPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [formData, setFormData] = useState<Partial<Step1 & Step2 & Step3>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countrySearch, setCountrySearch] = useState('');

  const { data: countriesResp } = useQuery({
    queryKey: ['countries'],
    queryFn: () => countriesApi.list(),
  });

  const countries = countriesResp?.data?.data ?? [];

  const filteredCountries = countries.filter(
    (c) =>
      c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
      c.code.toLowerCase().includes(countrySearch.toLowerCase())
  );

  const step1Form = useForm<Step1>({ resolver: zodResolver(step1Schema) });
  const step2Form = useForm<Step2>({ resolver: zodResolver(step2Schema) });
  const step3Form = useForm<Step3>({ resolver: zodResolver(step3Schema) });

  function handleStep1(data: Step1) {
    const country = countries.find((c) => c.code === data.countryCode);
    setSelectedCountry(country ?? null);
    setFormData((prev) => ({ ...prev, ...data }));
    setStep(1);
  }

  function handleStep2(data: Step2) {
    setFormData((prev) => ({ ...prev, ...data }));
    setStep(2);
  }

  async function handleStep3(data: Step3) {
    setFormData((prev) => ({ ...prev, ...data }));
    setLoading(true);
    setError(null);

    const merged = { ...formData, ...data };

    try {
      const startDatetime = `${merged.startDate}T${merged.startTime ?? '08:00'}:00.000Z`;
      const plannedEndDatetime = merged.plannedEndDate
        ? `${merged.plannedEndDate}T23:59:00.000Z`
        : undefined;

      const response = await projectsApi.create({
        name: merged.name!,
        countryCode: merged.countryCode!,
        startDatetime,
        plannedEndDatetime,
        breakfastCount: merged.breakfastCount ?? 0,
        salaryBrutto: merged.salaryBrutto ?? undefined,
      });

      const projectId = response.data.data?.id;
      router.push(`/projects/${projectId}`);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error ?? 'Błąd tworzenia projektu.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Back */}
      <button onClick={() => router.back()} className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeftIcon className="w-4 h-4" />
        Powrót
      </button>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Nowa delegacja</h1>

      {/* Steps indicator */}
      <div className="flex items-center mb-8">
        {STEPS.map((label, index) => (
          <div key={index} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  index < step
                    ? 'bg-brand-600 text-white'
                    : index === step
                    ? 'bg-brand-600 text-white ring-4 ring-brand-100'
                    : 'bg-gray-100 text-gray-400'
                }`}
              >
                {index < step ? <CheckIcon className="w-4 h-4" /> : index + 1}
              </div>
              <span className={`text-xs mt-1 ${index === step ? 'text-brand-600 font-medium' : 'text-gray-400'}`}>
                {label}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <div className={`flex-1 h-px mx-2 mb-4 ${index < step ? 'bg-brand-600' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Country selection */}
      {step === 0 && (
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4">Wybierz kraj delegacji</h2>

          <input
            type="text"
            placeholder="Szukaj kraju..."
            value={countrySearch}
            onChange={(e) => setCountrySearch(e.target.value)}
            className="input mb-4"
          />

          <div className="max-h-80 overflow-y-auto space-y-1">
            {filteredCountries.map((country) => (
              <button
                key={country.code}
                type="button"
                onClick={() => {
                  step1Form.setValue('countryCode', country.code);
                  setSelectedCountry(country);
                }}
                className={`w-full flex items-center justify-between p-3 rounded-lg border text-left transition-colors ${
                  step1Form.watch('countryCode') === country.code
                    ? 'border-brand-500 bg-brand-50'
                    : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <MapPinIcon className="w-4 h-4 text-gray-400" />
                  <div>
                    <p className="font-medium text-gray-800">{country.name}</p>
                    <p className="text-xs text-gray-400">{country.code}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-700">
                    {formatCurrency(country.dailyRate, country.currency)}/dobę
                  </p>
                  <p className="text-xs text-gray-400">
                    nocleg do {formatCurrency(country.accommodation, country.currency)}
                  </p>
                </div>
              </button>
            ))}
          </div>

          {step1Form.formState.errors.countryCode && (
            <p className="error-text mt-2">{step1Form.formState.errors.countryCode.message}</p>
          )}

          <div className="mt-6">
            <button
              type="button"
              onClick={() => step1Form.handleSubmit(handleStep1)()}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              Dalej
              <ArrowRightIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Dates */}
      {step === 1 && (
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-1">Szczegóły delegacji</h2>
          {selectedCountry && (
            <p className="text-sm text-gray-500 mb-4">
              {selectedCountry.name} · {formatCurrency(selectedCountry.dailyRate, selectedCountry.currency)}/dobę
            </p>
          )}

          <form onSubmit={step2Form.handleSubmit(handleStep2)} className="space-y-4">
            <div>
              <label className="label">Nazwa delegacji</label>
              <input
                className="input"
                placeholder="np. Cypr - projekt XYZ"
                {...step2Form.register('name')}
              />
              {step2Form.formState.errors.name && (
                <p className="error-text">{step2Form.formState.errors.name.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Data wyjazdu</label>
                <input type="date" className="input" {...step2Form.register('startDate')} />
                {step2Form.formState.errors.startDate && (
                  <p className="error-text">{step2Form.formState.errors.startDate.message}</p>
                )}
              </div>
              <div>
                <label className="label">Godzina wyjazdu</label>
                <input type="time" className="input" defaultValue="08:00" {...step2Form.register('startTime')} />
              </div>
            </div>

            <div>
              <label className="label">Planowana data powrotu (opcjonalnie)</label>
              <input type="date" className="input" {...step2Form.register('plannedEndDate')} />
            </div>

            <div>
              <label className="label">Liczba śniadań w cenie noclegu</label>
              <p className="text-xs text-gray-400 mb-2">
                Każde śniadanie zmniejsza dietę o 25% stawki dziennej
              </p>
              <input
                type="number"
                min={0}
                max={100}
                className="input"
                defaultValue={0}
                {...step2Form.register('breakfastCount')}
              />
            </div>

            <div className="flex gap-3 mt-6">
              <button type="button" onClick={() => setStep(0)} className="btn-secondary flex-1">
                Wstecz
              </button>
              <button type="submit" className="btn-primary flex-1 flex items-center justify-center gap-2">
                Dalej
                <ArrowRightIcon className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Step 3: Salary */}
      {step === 2 && (
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-1">Wynagrodzenie (opcjonalnie)</h2>
          <p className="text-sm text-gray-500 mb-4">
            Podaj wynagrodzenie brutto, aby zobaczyć kalkulację netto. Dane są szyfrowane.
          </p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          <form onSubmit={step3Form.handleSubmit(handleStep3)} className="space-y-4">
            <div>
              <label className="label">Wynagrodzenie brutto (PLN)</label>
              <input
                type="number"
                min={0}
                step={0.01}
                className="input"
                placeholder="np. 8000"
                {...step3Form.register('salaryBrutto')}
              />
            </div>

            {/* Summary */}
            <div className="bg-gray-50 rounded-lg p-4 text-sm">
              <h3 className="font-medium text-gray-700 mb-2">Podsumowanie:</h3>
              <p><span className="text-gray-500">Kraj:</span> {selectedCountry?.name}</p>
              <p><span className="text-gray-500">Dieta:</span> {selectedCountry && formatCurrency(selectedCountry.dailyRate, selectedCountry.currency)}/dobę</p>
              <p><span className="text-gray-500">Limit noclegu:</span> {selectedCountry && formatCurrency(selectedCountry.accommodation, selectedCountry.currency)}/noc</p>
              <p><span className="text-gray-500">Projekt:</span> {formData.name}</p>
            </div>

            <div className="flex gap-3 mt-6">
              <button type="button" onClick={() => setStep(1)} className="btn-secondary flex-1">
                Wstecz
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {loading ? 'Tworzenie...' : (
                  <>
                    <CheckIcon className="w-4 h-4" />
                    Utwórz delegację
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
