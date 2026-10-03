'use client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Account {
  id: string;
  name: string;
  type: 'banco' | 'efectivo' | 'digital' | 'credito' | 'inversion';
  institution: string;
  balance: number;
  currency: string;
  icon: string;
  color: string;
  bgColor: string;
}

export interface Transaction {
  id: string;
  name: string;
  category: string;
  categoryIcon: string;
  account: string;
  accountId: string;
  amount: number;
  date: string;
  time: string;
  type: 'gasto' | 'ingreso' | 'transferencia';
  notes?: string;
}

export interface BudgetCategory {
  id: string;
  name: string;
  icon: string;
  budget: number;
  color: string;
  bgColor: string;
}

export interface SavingsGoal {
  id: string;
  name: string;
  icon: string;
  current: number;
  target: number;
  color: string;
  targetDate: string;
}

export interface Debt {
  id: string;
  name: string;
  institution: string;
  icon: string;
  balance: number;
  limit: number;
  monthlyPayment: number;
  dueDate: string;
  type: string;
  color: string;
  interestRate: number;
}

export interface Investment {
  id: string;
  name: string;
  ticker: string;
  type: string;
  shares: number;
  price: number;
  cost: number;
  icon: string;
  color: string;
}

export interface Subscription {
  id: string;
  name: string;
  category: string;
  amount: number;
  nextDate: string;
  nextPaymentDate: string | null; // ISO date string YYYY-MM-DD
  paymentDay: number; // day of month (1-31)
  paymentStatus: 'pending' | 'paid' | 'overdue';
  active: boolean;
  icon: string;
  color: string;
}

export interface FinanceData {
  accounts: Account[];
  transactions: Transaction[];
  budgetCategories: BudgetCategory[];
  savingsGoals: SavingsGoal[];
  debts: Debt[];
  investments: Investment[];
  subscriptions: Subscription[];
}

// ─── Default empty state ──────────────────────────────────────────────────────

export const defaultData: FinanceData = {
  accounts: [],
  transactions: [],
  budgetCategories: [],
  savingsGoals: [],
  debts: [],
  investments: [],
  subscriptions: [],
};

export function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ─── Category presets ─────────────────────────────────────────────────────────

export const CATEGORY_PRESETS = [
  { id: 'comida', label: 'Comida', icon: '🍽️', color: '#D97706' },
  { id: 'transporte', label: 'Transporte', icon: '🚗', color: '#2563EB' },
  { id: 'vivienda', label: 'Vivienda', icon: '🏠', color: '#DC2626' },
  { id: 'salud', label: 'Salud', icon: '💊', color: '#16A34A' },
  { id: 'entretenimiento', label: 'Entretenimiento', icon: '🎬', color: '#7C3AED' },
  { id: 'suscripciones', label: 'Suscripciones', icon: '📱', color: '#7C3AED' },
  { id: 'educacion', label: 'Educación', icon: '📚', color: '#0D9488' },
  { id: 'supermercado', label: 'Supermercado', icon: '🛒', color: '#D97706' },
  { id: 'servicios', label: 'Servicios', icon: '💡', color: '#64748B' },
  { id: 'ingreso', label: 'Ingreso', icon: '💼', color: '#16A34A' },
  { id: 'otros', label: 'Otros', icon: '📦', color: '#64748B' },
];

// ─── Legacy localStorage helpers (kept for backward compat, not used with Supabase) ──

export function loadData(): FinanceData {
  return defaultData;
}

export function saveData(_data: FinanceData): void {
  // No-op: data is now stored in Supabase
}
