/**
 * SHARED DATA CONTRACTS (ISSLI PECHE ERP 2026)
 * * Nomenclature:
 * - STOCK A = Legal/Official (Tax Compliance)
 * - STOCK B = Internal/Physical (Cash Flow)
 * - STOCK GLOBALE = Aggregation (Executive)
 */

export type VatRate = 0 | 0.10 | 0.14 | 0.20;
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
  id: string;           
  name: string;         
  internalSku: string;  
  purchaseCost: number; // Coût Achat Reel (CUMP)
  priceHT: number;      // Prix de vente HT
  vatRate: VatRate;     // Taux TVA (0, 0.10, 0.14, 0.20)
  priceTTC: number;     // Prix de vente TTC (Cash/Net - Replaces sellingPrice)
  quantity: number;     
  unit: ProductUnit;    
}

export interface TransactionB {
  id: string;
  type: 'SALE' | 'RETURN' | 'RESTOCK' | 'ADJUSTMENT' | 'PAYMENT' | 'QUOTE';
  amount: number;       
  paymentMethod: 'CASH' | 'CHECK' | 'CREDIT' | 'TRANSFER';
  date: string;
}

export interface SupplierB {
  id: string;
  name: string;
  ice: string;          // ICE Fournisseur
  balance: number;      // Dette actuelle envers le fournisseur (Accounts Payable)
  totalPurchased: number; // Volume total d'achats historique
}

export interface PurchaseB {
  id: string;
  supplierId: string;
  reference: string;
  type: 'FACTURE_ACHAT' | 'BON_COMMANDE' | 'BON_RECEPTION' | 'PAIEMENT';
  status: 'EN_ATTENTE' | 'PARTIEL' | 'PAYEE' | 'ANNULEE';
  totalHT: number;
  totalTTC: number;
  amountPaid: number;
}

export interface StockMovement {
  id: string;
  productId: string;
  supplierId?: string;
  type: 'RESTOCK' | 'PAYMENT' | 'ADJUSTMENT';
  quantity: number;
  amount: number;
  date: string;
}

// ==========================================
// 🌊 STOCK GLOBALE (AGGREGATION)
// ==========================================

export interface GlobalMetrics {
  totalCA: number;      // (CA Stock A) + (CA Stock B)
  totalProfits: number; // (Margin A) + (Margin B)
  salesCount: number;   // Volume total des ventes
  realCash: number;     // Physical Cash in Drawer
  totalDue: number;     // Total Global Debt (Accounts Receivable)
  stockValueCost: number; // CUMP Valuation
  stockValuePotential: number; // Selling Potential
  period: { startDate: string; endDate: string; };
}