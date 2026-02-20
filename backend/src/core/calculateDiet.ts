/**
 * calculateDiet.ts
 * Polish business trip diet calculation based on MRiPS regulation
 * 
 * Legal basis: Rozporządzenie Ministra Rodziny i Polityki Społecznej
 * z dnia 25 października 2022 r.
 */

export type DietMode = 'LIVE' | 'PLANNED' | 'CLOSED';

export interface DietInput {
  startDatetime: Date;
  plannedEndDatetime?: Date;
  actualEndDatetime?: Date;
  mode: DietMode;
  dailyRate: number;    // diet amount per full day
  currency: string;
  breakfastCount?: number; // each breakfast reduces diet by 25%
}

export interface DietBreakdown {
  day: number;
  date: string;
  hours: number;
  multiplier: number;
  amount: number;
}

export interface DietResult {
  fullDays: number;
  partialDay: number;             // remaining hours after full days
  partialDayMultiplier: number;   // 0 | 0.33 | 0.5 | 1
  totalDays: number;              // effective days (full + partial fraction)
  dietBeforeBreakfast: number;    // raw diet before breakfast deductions
  breakfastDeduction: number;     // total deduction for breakfasts
  totalDiet: number;              // final diet amount
  currency: string;
  breakdown: string;              // human-readable summary in Polish
  detailedBreakdown: DietBreakdown[];
  endDatetime: Date;              // which datetime was used for calculation
  isLive: boolean;
}

/**
 * Determines the partial day multiplier based on hours
 * Polish law: < 8h = 1/3, 8-12h = 1/2, > 12h = full
 */
function getPartialDayMultiplier(hours: number): number {
  if (hours < 8) return 1 / 3;
  if (hours < 12) 0.5;
  return 1;
}

// Fix: proper range check
function getMultiplierForHours(hours: number): number {
  if (hours < 8) return 1 / 3;
  if (hours >= 8 && hours < 12) return 0.5;
  return 1; // >= 12h counts as full day
}

/**
 * Main diet calculation function
 * Handles LIVE (ongoing), PLANNED, and CLOSED trip modes
 */
export function calculateDiet(input: DietInput): DietResult {
  const { startDatetime, dailyRate, currency, breakfastCount = 0 } = input;

  // Determine end datetime based on mode
  let endDatetime: Date;
  let isLive = false;

  switch (input.mode) {
    case 'LIVE':
      endDatetime = new Date(); // current time
      isLive = true;
      break;
    case 'PLANNED':
      if (!input.plannedEndDatetime) {
        throw new Error('plannedEndDatetime required for PLANNED mode');
      }
      endDatetime = input.plannedEndDatetime;
      break;
    case 'CLOSED':
      if (!input.actualEndDatetime) {
        throw new Error('actualEndDatetime required for CLOSED mode');
      }
      endDatetime = input.actualEndDatetime;
      break;
  }

  if (endDatetime <= startDatetime) {
    return {
      fullDays: 0,
      partialDay: 0,
      partialDayMultiplier: 0,
      totalDays: 0,
      dietBeforeBreakfast: 0,
      breakfastDeduction: 0,
      totalDiet: 0,
      currency,
      breakdown: 'Delegacja jeszcze się nie zaczęła lub ma zerowy czas trwania.',
      detailedBreakdown: [],
      endDatetime,
      isLive,
    };
  }

  // Calculate total hours
  const totalMs = endDatetime.getTime() - startDatetime.getTime();
  const totalHours = totalMs / (1000 * 60 * 60);

  // Full 24h periods
  const fullDays = Math.floor(totalHours / 24);
  const remainingHours = totalHours % 24;
  const partialDayMultiplier = getMultiplierForHours(remainingHours);

  // Total effective days
  const partialDayFraction = remainingHours > 0 ? partialDayMultiplier : 0;
  const totalDays = fullDays + partialDayFraction;

  // Calculate raw diet
  const dietBeforeBreakfast = totalDays * dailyRate;

  // Breakfast deduction: each breakfast = 25% of daily rate
  const breakfastDeductionPerMeal = dailyRate * 0.25;
  const breakfastDeduction = Math.min(
    breakfastCount * breakfastDeductionPerMeal,
    dietBeforeBreakfast // cannot deduct more than total diet
  );

  const totalDiet = Math.max(0, dietBeforeBreakfast - breakfastDeduction);

  // Build detailed breakdown
  const detailedBreakdown: DietBreakdown[] = [];
  for (let day = 0; day < fullDays; day++) {
    const dayStart = new Date(startDatetime.getTime() + day * 24 * 60 * 60 * 1000);
    detailedBreakdown.push({
      day: day + 1,
      date: dayStart.toISOString().split('T')[0],
      hours: 24,
      multiplier: 1,
      amount: dailyRate,
    });
  }

  if (remainingHours > 0) {
    const partialStart = new Date(startDatetime.getTime() + fullDays * 24 * 60 * 60 * 1000);
    detailedBreakdown.push({
      day: fullDays + 1,
      date: partialStart.toISOString().split('T')[0],
      hours: Math.round(remainingHours * 10) / 10,
      multiplier: partialDayMultiplier,
      amount: dailyRate * partialDayMultiplier,
    });
  }

  // Human-readable breakdown in Polish
  const breakdown = buildPolishBreakdown({
    fullDays,
    remainingHours,
    partialDayMultiplier,
    totalDays,
    dietBeforeBreakfast,
    breakfastCount,
    breakfastDeduction,
    totalDiet,
    currency,
    dailyRate,
  });

  return {
    fullDays,
    partialDay: Math.round(remainingHours * 10) / 10,
    partialDayMultiplier,
    totalDays: Math.round(totalDays * 100) / 100,
    dietBeforeBreakfast: Math.round(dietBeforeBreakfast * 100) / 100,
    breakfastDeduction: Math.round(breakfastDeduction * 100) / 100,
    totalDiet: Math.round(totalDiet * 100) / 100,
    currency,
    breakdown,
    detailedBreakdown,
    endDatetime,
    isLive,
  };
}

interface BreakdownParams {
  fullDays: number;
  remainingHours: number;
  partialDayMultiplier: number;
  totalDays: number;
  dietBeforeBreakfast: number;
  breakfastCount: number;
  breakfastDeduction: number;
  totalDiet: number;
  currency: string;
  dailyRate: number;
}

function buildPolishBreakdown(p: BreakdownParams): string {
  const lines: string[] = [];

  lines.push(`Pełne doby: ${p.fullDays} × ${p.dailyRate} ${p.currency} = ${(p.fullDays * p.dailyRate).toFixed(2)} ${p.currency}`);

  if (p.remainingHours > 0) {
    const hours = Math.round(p.remainingHours * 10) / 10;
    let partialDesc = '';
    if (p.partialDayMultiplier === 1 / 3) {
      partialDesc = `${hours}h < 8h → 1/3 diety`;
    } else if (p.partialDayMultiplier === 0.5) {
      partialDesc = `${hours}h (8-12h) → 1/2 diety`;
    } else {
      partialDesc = `${hours}h ≥ 12h → pełna dieta`;
    }
    lines.push(`Niepełna doba: ${partialDesc} = ${(p.dailyRate * p.partialDayMultiplier).toFixed(2)} ${p.currency}`);
  }

  if (p.breakfastCount > 0) {
    lines.push(`Odliczenie śniadań: ${p.breakfastCount} × 25% = -${p.breakfastDeduction.toFixed(2)} ${p.currency}`);
  }

  lines.push(`ŁĄCZNIE: ${p.totalDiet.toFixed(2)} ${p.currency}`);

  return lines.join('\n');
}
