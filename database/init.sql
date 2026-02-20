-- Delegacje SaaS - Database initialization
-- This runs once when PostgreSQL container first starts
-- Prisma migrations handle the actual schema

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "pg_crypto";

-- These will be created by Prisma migrations
-- This file can be used for initial setup steps
