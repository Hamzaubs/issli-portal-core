/**
 * SHARED DATA CONTRACTS (ISSLI PECHE ERP 2026)
 * * Nomenclature:
 * - STOCK A = Legal/Official (Tax Compliance)
 * - STOCK B = Internal/Physical (Cash Flow)
 * - STOCK GLOBALE = Aggregation (Executive)
 */

export type VatRate = 0.10 | 0.20;
export type ProductUnit = 'U' | 'KG' | 'L' | 'M';

// ==========================================
// 🟦 STOCK A (LEGAL) CONTRACTS
// ==========================================

export interface StockAProduct {
  id: string;           // UUID
  name: string;         // Désignation Officielle
  serialNumber: string; // N° Série (Crucial for Engines/Electronics)
  priceHT: number;      // Prix Vente HT
  vatRate: VatRate;     // Taux TVA (10% or 20%)
  quantity: number;     // Stock Comptable
  unit: ProductUnit;    // Unité de mesure
}

export interface InvoiceA {
  id: string;
  reference: string;    // Sequential (FAC-2026-001)
  clientIce: string;    // MANDATORY
  totalHT: number;
  totalTTC: number;
  status: 'PAID' | 'UNPAID' | 'CANCELLED';
  items: StockAProduct[];
}

// ==========================================
// 🟩 STOCK B (INTERNAL) CONTRACTS
// ==========================================

export interface StockBProduct {
  id: string;           // UUID
  name: string;         // Désignation Courante
  internalSku: string;  // SKU Magasin (e.g., HUILE-01)
  purchaseCost: number; // Coût Achat Reel
  sellingPrice: number; // Prix de vente (Cash/Net)
  quantity: number;     // Stock Physique Reel
  unit: ProductUnit;    // Unité de mesure
}

export interface TransactionB {
  id: string;
  type: 'SALE' | 'RETURN' | 'RESTOCK';
  amount: number;       // Cash Flow Impact
  paymentMethod: 'CASH' | 'CHECK' | 'CREDIT';
  date: string;
}

// ==========================================
// 🌊 STOCK GLOBALE (AGGREGATION)
// ==========================================

export interface GlobalMetrics {
  totalCA: number;      // (CA Stock A) + (CA Stock B)
  totalProfits: number; // (Margin A) + (Margin B)
  salesCount: number;   // Volume total des ventes
  period: { startDate: string; endDate: string; };
}