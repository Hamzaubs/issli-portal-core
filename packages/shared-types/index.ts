// packages/shared-types/index.ts

export type VatRate = 0.10 | 0.20;

// ✅ UPDATED: Fishing/Marine Specifics
export type MeasureUnit = 'UNIT' | 'METER' | 'KG' | 'LITER';

export interface StockAProduct {
  id: string;
  name: string;
  serialNumber: string;
  priceHT: number;
  vatRate: VatRate;
  quantity: number;
  // ✅ New Fields
  measureUnit: string; 
  technicalSpecs?: string; 
}

export interface StockBProduct {
  id: string;
  name: string;
  internalSku: string;
  purchaseCost: number;
  sellingPrice: number;
  quantity: number;
  // ✅ New Fields
  measureUnit: string;
  technicalSpecs?: string;
}

export interface GlobalMetrics {
  totalCA: number;
  totalProfits: number;
  salesCount: number;
  period: { startDate: string; endDate: string; };
}
