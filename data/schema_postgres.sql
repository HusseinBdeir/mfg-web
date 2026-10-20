-- ============================================================================
-- ISABI Systems — Manufacturing Operations Standalone PostgreSQL / Supabase Schema
-- Replaces Microsoft Dataverse & Power BI PPU with 100% Owned SQL + Row-Level Security
-- Companies: WTC, BBConstruction, Lions Transport
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS companies (
    key TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    currency TEXT DEFAULT 'USD',
    usd_rate NUMERIC(14,2) DEFAULT 90000,
    min_date DATE DEFAULT '2024-01-01'
);

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL CHECK (role IN ('Full Access (Owner)', 'Supervisor + Entry', 'Supervisor', 'Entry', 'Sales')),
    companies TEXT[] NOT NULL,
    pbi_access TEXT DEFAULT 'full',
    statements_access TEXT DEFAULT 'full',
    status TEXT DEFAULT 'Active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    official_name TEXT NOT NULL,
    type TEXT NOT NULL,
    uom TEXT NOT NULL,
    ton_factor NUMERIC(10,3) DEFAULT 1.000,
    input_product TEXT,
    revenue_account TEXT DEFAULT '701',
    purchase_account TEXT DEFAULT '601'
);

CREATE TABLE IF NOT EXISTS sites (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    is_jv BOOLEAN DEFAULT FALSE,
    region TEXT,
    supplier TEXT,
    address TEXT
);

CREATE TABLE IF NOT EXISTS equipment (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    plate_no TEXT,
    type TEXT NOT NULL,
    ownership TEXT NOT NULL,
    capacity NUMERIC(10,2) DEFAULT 0,
    supplier TEXT,
    customer TEXT,
    default_driver TEXT
);

CREATE TABLE IF NOT EXISTS price_rules (
    id UUID PRIMARY KEY,
    name TEXT,
    company TEXT NOT NULL,
    rule_type TEXT NOT NULL,
    customer TEXT,
    supplier TEXT,
    product TEXT,
    site TEXT,
    unit TEXT DEFAULT 'm³',
    unit_price NUMERIC(12,2) DEFAULT 0,
    trans_unit_price NUMERIC(12,2) DEFAULT 0,
    start_date DATE,
    end_date DATE
);

CREATE TABLE IF NOT EXISTS sales_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT,
    ticket_no TEXT NOT NULL,
    date DATE NOT NULL,
    rep_date DATE NOT NULL,
    company TEXT NOT NULL,
    sale_type TEXT NOT NULL,
    transport_by TEXT NOT NULL,
    customer TEXT NOT NULL,
    product TEXT NOT NULL,
    site TEXT,
    truck_owner TEXT,
    truck TEXT,
    driver TEXT,
    uom TEXT NOT NULL,
    qty NUMERIC(12,2) NOT NULL,
    unit_price NUMERIC(12,2) NOT NULL,
    price NUMERIC(14,2) NOT NULL,
    trans_unit_price NUMERIC(12,2) DEFAULT 0,
    trans_price NUMERIC(14,2) DEFAULT 0,
    discount NUMERIC(14,2) DEFAULT 0,
    total NUMERIC(14,2) NOT NULL,
    vat NUMERIC(14,2) DEFAULT 0,
    total_ttc NUMERIC(14,2) NOT NULL,
    method TEXT NOT NULL,
    vat_invoice TEXT,
    time TEXT DEFAULT '12:00',
    overtime BOOLEAN DEFAULT FALSE,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Business Unit Row-Level Security (RLS) matching Dataverse BU ownership
ALTER TABLE sales_tickets ENABLE ROW LEVEL SECURITY;
