/**
 * types/index.ts
 * Shared TypeScript types for the Delegacje SaaS backend
 */

import { Request } from 'express';

// Authenticated request - userId is always present after auth middleware
export interface AuthenticatedRequest extends Request {
  userId: string;
  userEmail: string;
}

// API response wrapper
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// JWT payload
export interface JWTPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}

// Zod validation helpers
export type ValidationError = {
  field: string;
  message: string;
};

// File upload
export interface UploadedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  destination: string;
  filename: string;
  path: string;
  size: number;
}

// CSV import types
export interface CSVColumnMapping {
  date: string;
  amount: string;
  description: string;
  currency?: string;
  category?: string;
}

export interface CSVClassificationRule {
  keyword: string;
  category: string;
  isRegex?: boolean;
}

export interface CSVRow {
  [key: string]: string;
}

export interface CSVParseResult {
  headers: string[];
  rows: CSVRow[];
  separator: ',' | ';';
  dateFormat: string;
  totalRows: number;
}

export interface CSVImportPreview {
  headers: string[];
  sampleRows: CSVRow[];
  detectedSeparator: ',' | ';';
  detectedDateFormat: string;
  totalRows: number;
}

// AI provider types
export type AIProvider = 'gemini' | 'openai' | 'none';

export interface AIExtractionResult {
  invoiceNumber?: string;
  date?: string;  // ISO date string
  amount?: number;
  currency?: string;
  vendorName?: string;
  confidence: number; // 0-1
  rawResponse?: string;
}

// Encryption
export interface EncryptedData {
  iv: string;
  data: string;
}
