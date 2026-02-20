/**
 * api.ts
 * Axios API client with auth token handling
 */

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '/api/v1';

export const api = axios.create({
  baseURL: API_BASE.endsWith('/api/v1') ? API_BASE : `${API_BASE}/api/v1`,
  withCredentials: true, // send cookies
  timeout: 30000,
});

// Request interceptor - add auth header from localStorage if available
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Response interceptor - handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshResponse = await axios.post(
          `${API_BASE}/auth/refresh`,
          {},
          { withCredentials: true }
        );

        const newToken = (refreshResponse.data as { data: { accessToken: string } }).data.accessToken;
        localStorage.setItem('accessToken', newToken);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
        }

        return api(originalRequest);
      } catch {
        // Refresh failed - redirect to login
        localStorage.removeItem('accessToken');
        if (typeof window !== 'undefined') {
          window.location.href = '/auth/login';
        }
      }
    }

    return Promise.reject(error);
  }
);

// ── Typed API functions ──────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface Project {
  id: string;
  name: string;
  status: 'ACTIVE' | 'CLOSED' | 'DRAFT';
  countryCode: string;
  countryName: string;
  currency: string;
  dietAmountSnapshot: number;
  hotelLimitSnapshot: number;
  breakfastCount: number;
  startDatetime: string;
  plannedEndDatetime?: string;
  actualEndDatetime?: string;
  salaryBrutto?: number;
  salaryNetto?: number;
  createdAt: string;
  _count?: { transactions: number; advances: number };
}

export interface Transaction {
  id: string;
  projectId: string;
  date: string;
  description: string;
  amount: number;
  currency: string;
  category: string;
  isPrivate: boolean;
  excludedFromProject: boolean;
  isDeleted: boolean;
  receiptId?: string;
  receipt?: { id: string; originalFilename: string; processingStatus: string };
}

export interface Advance {
  id: string;
  projectId: string;
  date: string;
  amount: number;
  currency: string;
  description?: string;
}

export interface Receipt {
  id: string;
  projectId?: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  processingStatus: string;
  isDuplicate: boolean;
  invoiceNumber?: string;
  detectedDate?: string;
  detectedAmount?: number;
  vendorName?: string;
  currency?: string;
  ocrConfidence?: number;
  createdAt: string;
}

export interface ProjectBalance {
  advancesTotal: number;
  expensesTotal: number;
  categoryTotals: {
    FOOD: number;
    TRANSPORT: number;
    HOTEL: number;
    PARKING: number;
    FUEL: number;
    OTHER: number;
  };
  hotelCombined: number;
  hotelLimit: number;
  hotelStatus: 'within_limit' | 'over_limit' | 'no_hotel';
  hotelOverage: number;
  diet: {
    fullDays: number;
    partialDay: number;
    partialDayMultiplier: number;
    totalDays: number;
    totalDiet: number;
    currency: string;
    breakdown: string;
  };
  balance: number;
  balanceDescription: string;
  averageDailyExpense: number;
  transactionCount: number;
}

export interface Country {
  code: string;
  name: string;
  nameEn: string;
  currency: string;
  dailyRate: number;
  accommodation: number;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  contractType: 'EMPLOYMENT' | 'CIVIL_CONTRACT' | 'B2B' | 'OTHER';
  voluntarySocialSecurity: boolean;
  ppkEnabled: boolean;
  ppkPercentage: number;
  csvColumnMapping?: Record<string, string>;
  csvClassificationRules?: Array<{ keyword: string; category: string; isRegex?: boolean }>;
  createdAt: string;
}

export interface UserSettings {
  contractType?: User['contractType'];
  voluntarySocialSecurity?: boolean;
  ppkEnabled?: boolean;
  ppkPercentage?: number;
  csvColumnMapping?: Record<string, string>;
  csvClassificationRules?: User['csvClassificationRules'];
}

// Users
export const usersApi = {
  me: () => api.get<ApiResponse<User>>('/users/me'),

  updateProfile: (data: { firstName?: string; lastName?: string; email?: string; currentPassword?: string; newPassword?: string }) =>
    api.put<ApiResponse<User>>('/users/me', data),

  updateSettings: (data: UserSettings) => {
    // Backend przechowuje csvClassificationRules i csvColumnMapping jako JSON string
    // serializujemy tutaj zeby kazdy wywolujacy byl chroniony automatycznie
    const payload: Record<string, unknown> = { ...data };
    if (data.csvClassificationRules !== undefined) {
      payload.csvClassificationRules = JSON.stringify(data.csvClassificationRules);
    }
    if (data.csvColumnMapping !== undefined) {
      payload.csvColumnMapping = JSON.stringify(data.csvColumnMapping);
    }
    return api.put<ApiResponse<User>>('/users/me/settings', payload);
  },
};

// Auth
export const authApi = {
  login: (email: string, password: string) =>
    api.post<ApiResponse<{ user: object; accessToken: string }>>('/auth/login', { email, password }),

  register: (data: { email: string; password: string; firstName: string; lastName: string }) =>
    api.post<ApiResponse<{ user: object; accessToken: string }>>('/auth/register', data),

  logout: () => api.post('/auth/logout'),
};

// Projects
export const projectsApi = {
  list: (params?: { status?: string; page?: number; limit?: number }) =>
    api.get<ApiResponse<Project[]>>('/projects', { params }),

  get: (id: string) =>
    api.get<ApiResponse<Project>>(`/projects/${id}`),

  create: (data: {
    name: string;
    countryCode: string;
    startDatetime: string;
    plannedEndDatetime?: string;
    breakfastCount?: number;
    salaryBrutto?: number;
  }) => api.post<ApiResponse<Project>>('/projects', data),

  update: (id: string, data: {
    name?: string;
    plannedEndDatetime?: string | null;
    breakfastCount?: number;
    salaryBrutto?: number;
    countryCode?: string;
  }) =>
    api.put<ApiResponse<Project>>(`/projects/${id}`, data),

  close: (id: string, actualEndDatetime: string) =>
    api.post<ApiResponse<Project>>(`/projects/${id}/close`, { actualEndDatetime }),

  delete: (id: string) =>
    api.delete(`/projects/${id}`),

  balance: (id: string) =>
    api.get<ApiResponse<ProjectBalance>>(`/projects/${id}/balance`),
};

// Transactions
export const transactionsApi = {
  list: (params?: { projectId?: string; page?: number; limit?: number }) =>
    api.get<ApiResponse<Transaction[]>>('/transactions', { params }),

  create: (data: Omit<Transaction, 'id' | 'isDeleted' | 'receipt'>) =>
    api.post<ApiResponse<Transaction>>('/transactions', data),

  update: (id: string, data: Partial<Transaction>) =>
    api.put<ApiResponse<Transaction>>(`/transactions/${id}`, data),

  delete: (id: string) =>
    api.delete(`/transactions/${id}`),
};

// Advances
export const advancesApi = {
  list: (params?: { projectId?: string }) =>
    api.get<ApiResponse<Advance[]>>('/advances', { params }),

  create: (data: Omit<Advance, 'id'>) =>
    api.post<ApiResponse<Advance>>('/advances', data),

  delete: (id: string) =>
    api.delete(`/advances/${id}`),
};

// Receipts
export const receiptsApi = {
  list: (params?: { projectId?: string; page?: number }) =>
    api.get<ApiResponse<Receipt[]>>('/receipts', { params }),

  upload: (file: File, projectId?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (projectId) formData.append('projectId', projectId);
    return api.post<ApiResponse<Receipt>>('/receipts/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  get: (id: string) =>
    api.get<ApiResponse<Receipt>>(`/receipts/${id}`),

  checkDuplicate: (id: string) =>
    api.get(`/receipts/${id}/duplicate-check`),
};

// Countries
export const countriesApi = {
  list: () => api.get<ApiResponse<Country[]>>('/countries'),
};

// Import
export const importApi = {
  previewCSV: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('preview', 'true');
    return api.post('/import/csv', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  importCSV: (file: File, projectId: string, mapping?: object) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('projectId', projectId);
    if (mapping) formData.append('mapping', JSON.stringify(mapping));
    return api.post('/import/csv', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  getMappings: () => api.get('/import/mappings'),
  saveMappings: (data: object) => api.put('/import/mappings', data),
};
