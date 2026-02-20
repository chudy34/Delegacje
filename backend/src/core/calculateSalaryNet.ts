/**
 * calculateSalaryNet.ts
 * Polish salary calculation for civil contracts (umowa zlecenie)
 * Tax rates for 2024/2025
 */

export interface TaxRates {
  // ZUS składki społeczne
  pensionRate: number;       // emerytalne: 9.76%
  disabilityRate: number;    // rentowe: 1.5%
  sicknessRate: number;      // chorobowe: 2.45% (dobrowolne)

  // Ubezpieczenie zdrowotne
  healthInsuranceRate: number; // 9%

  // Podatek dochodowy
  incomeTaxRate: number;     // 12% (PIT-2 złożony) or base
  taxFreeMonthly: number;    // kwota wolna od podatku: 300 PLN/miesiąc
  costOfIncome: number;      // koszty uzyskania przychodu: 20%
  maxCostOfIncome: number;   // max miesięcznie: 250 PLN (if KUP capped)
}

// Snapshot of 2024/2025 Polish tax law for civil contracts
export const TAX_RATES_2024_2025: TaxRates = {
  pensionRate: 0.0976,
  disabilityRate: 0.015,
  sicknessRate: 0.0245,
  healthInsuranceRate: 0.09,
  incomeTaxRate: 0.12,
  taxFreeMonthly: 300,
  costOfIncome: 0.20,
  maxCostOfIncome: 250,
};

export interface SalaryInput {
  brutto: number;              // gross salary in PLN
  voluntarySocialSecurity: boolean;  // dobrowolna składka chorobowa
  ppkEnabled: boolean;         // Pracownicze Plany Kapitałowe
  ppkPercentage: number;       // PPK employee %, default 2%
  taxRates?: TaxRates;         // optional snapshot (historical projects)
}

export interface SalaryResult {
  brutto: number;
  netto: number;

  // ZUS breakdown
  pensionContribution: number;    // składka emerytalna
  disabilityContribution: number; // składka rentowa
  sicknessContribution: number;   // składka chorobowa (if applicable)
  totalSocialSecurity: number;    // suma składek społecznych

  // Health insurance
  healthInsuranceBase: number;    // podstawa do zdrowotnego
  healthInsurance: number;        // składka zdrowotna

  // Income tax
  incomeBase: number;             // przychód do PIT
  costOfIncome: number;           // koszty uzyskania przychodu
  taxBase: number;                // podstawa opodatkowania
  taxBeforeDeduction: number;     // podatek przed ulgą
  taxFreeDeduction: number;       // kwota wolna
  incomeTax: number;              // podatek do zapłaty

  // PPK
  ppkEmployee: number;            // wpłata pracownika do PPK

  breakdown: { [key: string]: number };
  description: string;
}

/**
 * Calculate net salary from gross for Polish civil contract (umowa zlecenie)
 */
export function calculateSalaryNet(input: SalaryInput): SalaryResult {
  const { brutto, voluntarySocialSecurity, ppkEnabled, ppkPercentage } = input;
  const rates = input.taxRates ?? TAX_RATES_2024_2025;

  // Step 1: Social security contributions (ZUS) from gross
  const pensionContribution = round2(brutto * rates.pensionRate);
  const disabilityContribution = round2(brutto * rates.disabilityRate);
  const sicknessContribution = voluntarySocialSecurity
    ? round2(brutto * rates.sicknessRate)
    : 0;

  const totalSocialSecurity = pensionContribution + disabilityContribution + sicknessContribution;

  // Step 2: Health insurance base = brutto - social security
  const healthInsuranceBase = round2(brutto - totalSocialSecurity);
  const healthInsurance = round2(healthInsuranceBase * rates.healthInsuranceRate);

  // Step 3: Income tax calculation
  // Income base for PIT = brutto - social security
  const incomeBase = round2(brutto - totalSocialSecurity);

  // Koszty uzyskania przychodu: 20% of income base, max 250 PLN
  const rawCostOfIncome = round2(incomeBase * rates.costOfIncome);
  const costOfIncome = Math.min(rawCostOfIncome, rates.maxCostOfIncome);

  // Tax base rounded to full PLN
  const taxBase = Math.round(Math.max(0, incomeBase - costOfIncome));

  // Tax before free allowance
  const taxBeforeDeduction = round2(taxBase * rates.incomeTaxRate);

  // Monthly tax-free amount (kwota wolna = 300 PLN/miesiąc for 12% bracket)
  const taxFreeDeduction = Math.min(taxBeforeDeduction, rates.taxFreeMonthly);

  // Final income tax
  const incomeTax = Math.max(0, round2(taxBeforeDeduction - taxFreeDeduction));

  // Step 4: PPK employee contribution (paid from netto but affects take-home)
  const ppkEmployee = ppkEnabled ? round2(brutto * (ppkPercentage / 100)) : 0;

  // Step 5: Net salary
  // netto = brutto - social security - health insurance - income tax - PPK
  const netto = round2(brutto - totalSocialSecurity - healthInsurance - incomeTax - ppkEmployee);

  const breakdown = {
    brutto,
    pensionContribution,
    disabilityContribution,
    sicknessContribution,
    totalSocialSecurity,
    healthInsuranceBase,
    healthInsurance,
    incomeBase,
    costOfIncome,
    taxBase,
    taxBeforeDeduction,
    taxFreeDeduction,
    incomeTax,
    ppkEmployee,
    netto,
  };

  const description = buildSalaryDescription(breakdown, voluntarySocialSecurity, ppkEnabled);

  return {
    brutto,
    netto,
    pensionContribution,
    disabilityContribution,
    sicknessContribution,
    totalSocialSecurity,
    healthInsuranceBase,
    healthInsurance,
    incomeBase,
    costOfIncome,
    taxBase,
    taxBeforeDeduction,
    taxFreeDeduction,
    incomeTax,
    ppkEmployee,
    breakdown,
    description,
  };
}

function buildSalaryDescription(
  b: { [key: string]: number },
  voluntarySS: boolean,
  ppkEnabled: boolean
): string {
  const lines = [
    `Wynagrodzenie brutto: ${b.brutto.toFixed(2)} PLN`,
    ``,
    `SKŁADKI ZUS:`,
    `  Emerytalna (9.76%): -${b.pensionContribution.toFixed(2)} PLN`,
    `  Rentowa (1.5%): -${b.disabilityContribution.toFixed(2)} PLN`,
  ];

  if (voluntarySS) {
    lines.push(`  Chorobowa (2.45%): -${b.sicknessContribution.toFixed(2)} PLN`);
  }

  lines.push(
    `  Łącznie ZUS: -${b.totalSocialSecurity.toFixed(2)} PLN`,
    ``,
    `UBEZPIECZENIE ZDROWOTNE:`,
    `  Podstawa: ${b.healthInsuranceBase.toFixed(2)} PLN`,
    `  Składka (9%): -${b.healthInsurance.toFixed(2)} PLN`,
    ``,
    `PODATEK DOCHODOWY:`,
    `  Podstawa przychodu: ${b.incomeBase.toFixed(2)} PLN`,
    `  Koszty uzyskania (20%, max 250): -${b.costOfIncome.toFixed(2)} PLN`,
    `  Podstawa opodatkowania: ${b.taxBase.toFixed(2)} PLN`,
    `  Podatek (12%): ${b.taxBeforeDeduction.toFixed(2)} PLN`,
    `  Kwota wolna: -${b.taxFreeDeduction.toFixed(2)} PLN`,
    `  Podatek do zapłaty: -${b.incomeTax.toFixed(2)} PLN`,
  );

  if (ppkEnabled) {
    lines.push(``, `PPK (pracownik): -${b.ppkEmployee.toFixed(2)} PLN`);
  }

  lines.push(``, `WYNAGRODZENIE NETTO: ${b.netto.toFixed(2)} PLN`);

  return lines.join('\n');
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
