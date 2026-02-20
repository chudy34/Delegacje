/**
 * calculateProjectBalance.ts
 * Calculates the financial balance of a business trip project
 * 
 * Formula: Balance = Advances - Expenses + Diet
 * Positive = company owes you money (savings)
 * Negative = you owe company money (must return)
 */

import { calculateDiet, DietMode, DietResult } from './calculateDiet';

export interface TransactionSummary {
  id: string;
  date: Date;
  amount: number;
  category: string;
  isPrivate: boolean;
  excludedFromProject: boolean;
}

export interface AdvanceSummary {
  id: string;
  date: Date;
  amount: number;
}

export interface ProjectBalanceInput {
  project: {
    startDatetime: Date;
    plannedEndDatetime?: Date;
    actualEndDatetime?: Date;
    status: 'ACTIVE' | 'CLOSED' | 'DRAFT';
    dietAmountSnapshot: number;
    hotelLimitSnapshot: number;
    currency: string;
    breakfastCount: number;
  };
  transactions: TransactionSummary[];
  advances: AdvanceSummary[];
}

export interface CategoryTotals {
  FOOD: number;
  TRANSPORT: number;
  HOTEL: number;
  PARKING: number;
  FUEL: number;
  OTHER: number;
}

export type HotelStatus = 'within_limit' | 'over_limit' | 'no_hotel';

export interface ProjectBalanceResult {
  // Advances total
  advancesTotal: number;

  // Expenses breakdown
  expensesTotal: number;        // all non-private, non-excluded
  categoryTotals: CategoryTotals;

  // Hotel + parking combined tracking
  hotelCombined: number;        // hotel + parking total
  hotelLimit: number;           // limit from project settings
  hotelStatus: HotelStatus;
  hotelOverage: number;         // amount over limit (0 if within)

  // Diet
  diet: DietResult;

  // Final balance
  // balance > 0 = company owes you (savings)
  // balance < 0 = you owe company (must return)
  balance: number;
  balanceDescription: string;

  // Stats
  averageDailyExpense: number;
  transactionCount: number;
}

/**
 * Determines which diet calculation mode to use based on project status
 */
function getDietMode(status: string, actualEndDatetime?: Date): DietMode {
  if (status === 'CLOSED' && actualEndDatetime) return 'CLOSED';
  if (status === 'ACTIVE') return 'LIVE';
  return 'PLANNED';
}

/**
 * Main project balance calculation
 */
export function calculateProjectBalance(input: ProjectBalanceInput): ProjectBalanceResult {
  const { project, transactions, advances } = input;

  // Filter valid transactions (not deleted, not private, not excluded)
  const validTransactions = transactions.filter(
    (t) => !t.isPrivate && !t.excludedFromProject
  );

  // Sum advances
  const advancesTotal = round2(
    advances.reduce((sum, a) => sum + a.amount, 0)
  );

  // Sum expenses by category
  const categoryTotals: CategoryTotals = {
    FOOD: 0,
    TRANSPORT: 0,
    HOTEL: 0,
    PARKING: 0,
    FUEL: 0,
    OTHER: 0,
  };

  for (const t of validTransactions) {
    const cat = t.category.toUpperCase() as keyof CategoryTotals;
    if (cat in categoryTotals) {
      categoryTotals[cat] = round2(categoryTotals[cat] + t.amount);
    } else {
      categoryTotals.OTHER = round2(categoryTotals.OTHER + t.amount);
    }
  }

  const expensesTotal = round2(
    Object.values(categoryTotals).reduce((sum, v) => sum + v, 0)
  );

  // Hotel + parking combined
  const hotelCombined = round2(categoryTotals.HOTEL + categoryTotals.PARKING);
  const hotelLimit = project.hotelLimitSnapshot;

  let hotelStatus: HotelStatus = 'no_hotel';
  let hotelOverage = 0;

  if (hotelCombined > 0) {
    if (hotelCombined <= hotelLimit) {
      hotelStatus = 'within_limit';
    } else {
      hotelStatus = 'over_limit';
      hotelOverage = round2(hotelCombined - hotelLimit);
    }
  }

  // Calculate diet
  const dietMode = getDietMode(project.status, project.actualEndDatetime);
  const diet = calculateDiet({
    startDatetime: project.startDatetime,
    plannedEndDatetime: project.plannedEndDatetime,
    actualEndDatetime: project.actualEndDatetime,
    mode: dietMode,
    dailyRate: project.dietAmountSnapshot,
    currency: project.currency,
    breakfastCount: project.breakfastCount,
  });

  // Final balance
  const balance = round2(advancesTotal - expensesTotal + diet.totalDiet);

  const balanceDescription = buildBalanceDescription(balance, project.currency, {
    advancesTotal,
    expensesTotal,
    dietTotal: diet.totalDiet,
  });

  // Stats
  const tripHours = calculateTripHours(project);
  const tripDays = tripHours / 24;
  const averageDailyExpense = tripDays > 0 ? round2(expensesTotal / tripDays) : 0;

  return {
    advancesTotal,
    expensesTotal,
    categoryTotals,
    hotelCombined,
    hotelLimit,
    hotelStatus,
    hotelOverage,
    diet,
    balance,
    balanceDescription,
    averageDailyExpense,
    transactionCount: validTransactions.length,
  };
}

function calculateTripHours(project: ProjectBalanceInput['project']): number {
  const now = new Date();
  let endDate: Date;

  if (project.status === 'CLOSED' && project.actualEndDatetime) {
    endDate = project.actualEndDatetime;
  } else if (project.plannedEndDatetime) {
    endDate = project.status === 'ACTIVE' ? now : project.plannedEndDatetime;
  } else {
    endDate = now;
  }

  const ms = endDate.getTime() - project.startDatetime.getTime();
  return Math.max(0, ms / (1000 * 60 * 60));
}

interface BalanceParts {
  advancesTotal: number;
  expensesTotal: number;
  dietTotal: number;
}

function buildBalanceDescription(
  balance: number,
  currency: string,
  parts: BalanceParts
): string {
  const sign = balance >= 0 ? '+' : '';
  const status = balance > 0
    ? '✅ Firma dopłaci Ci do wypłaty'
    : balance < 0
    ? '❌ Musisz zwrócić firmie'
    : '✓ Rozliczenie zerowe';

  return [
    `Zaliczki: +${parts.advancesTotal.toFixed(2)} ${currency}`,
    `Wydatki: -${parts.expensesTotal.toFixed(2)} ${currency}`,
    `Dieta: +${parts.dietTotal.toFixed(2)} ${currency}`,
    `────────────────────`,
    `SALDO: ${sign}${balance.toFixed(2)} ${currency}`,
    status,
  ].join('\n');
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
