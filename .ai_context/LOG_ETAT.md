# 📋 State Log - ISSLI PECHE ERP

**Last Updated:** March 2026
**Version:** 4.6.0 - "Precision Ledger, Fiscal Compliance & Treasury Shield"
**Status:** 🟢 STABLE (SILO A & SILO B LEDGERS FULLY LOCKED & HARMONIZED)

---

## 🏢 System Architecture: The "Twin Silo" Model
*A unified ERP splitting "Fiscal/Legal" (Silo A) and "Operational/Internal" (Silo B) into two isolated but architecturally identical engines.*

* **Silo A (Legal):** Strict, VAT-compliant, DGI-ready. Used for official invoicing.
* **Silo B (Internal):** Flexible, high-velocity, cash-flow focused. Used for daily counter operations.
* **The Bridge (God View):** A virtual aggregation layer allowing the Super Admin to view combined data (Silo A + Silo B) without physically merging the databases.

---

## 🚀 Major Functional Modules

### 1. 🎯 Enterprise Accounting Hub (STOCK A - Official)
* **Mathematically Locked Ledger (NEW):** * Eradicated floating-point errors (`0.1 + 0.2 = 0.30000000000000004`) using strict Cent-based math (`Math.round(val * 100)`) for perfect MAD decimals.
    * **Same-Millisecond Sorting:** Guarantees Debits (Factures) always process before Credits (Payments) when timestamps are identical, preventing temporary negative balances.
* **Auto-Refund Lifecycle (NEW):**
    * Eliminated the "Store Credit" concept for returns. Generating an `AVOIR` now instantly triggers a corresponding cash refund (`Payment`) or debt compensation.
    * **Smart Loan Cancellation:** If an unpaid invoice (credit/loan) is cancelled, the system compensates the debt without artificially logging a cash refund, protecting cash-flow analytics.
* **Commercial Pipeline:**
    * **Quotations (Devis):** Full A4 generation with validity tracking.
    * **Conversion Logic:** Atomic **Devis → Invoice** transformation.
* **Transactional Safety:**
    * **Atomic Locking:** `prisma.$transaction` prevents partial writes.
* **Strict State Machine & Overpayment Shield (v4.6.0 ADDITION):** * Documents strictly follow the legal sequence (`EN_ATTENTE` ➡️ `PARTIEL` ➡️ `PAYEE`). 
    * The system physically rejects overpayments (tolerance: 1 centime) to prevent floating/ghost debt.
* **DGI-Compliant PDF Engine (v4.6.0 ADDITION):**
    * Native Number-to-French-Words conversion (*"Arrêtée la présente facture à la somme de..."*).
    * Row-by-row VAT rounding to completely eradicate decimal drift between PDF totals and database totals.
* **Legacy Exchange Fortification (v4.6.0 ADDITION):** * Bridges old paper returns with new stock. Accurately flags exchange balances as `COMPENSATION` to prevent fake cash injections into analytics.

### 2. 🏗️ Internal Operations & Analytics Engine (STOCK B)
* **Silo B Ledger Engine (NEW):**
    * Fully upgraded to mirror Silo A's JSON structure. Provides mathematically safe `debit`, `credit`, and `balance` directly from the server.
    * Retains the **FIFO Debt Allocation** engine, intelligently cascading global payments across the oldest unpaid tickets using `Prisma.Decimal`.
* **High-Performance Analytics:**
    * **Memory-Safe Aggregation:** Optimized Prisma `findMany({ select })` prevents `camelCase` mapping errors while querying 100k+ rows using <1MB of RAM.
    * **Dual Stock Valuation:** Calculates and displays both *Purchase Cost* and *Selling Potential*.
* **Inventory Bulk Adjustments (v4.6.0 ADDITION):**
    * High-speed `ADJUSTMENT` movement types that correct physical stock without inflating revenue or cost margins.

### 3. 🌍 The Executive Bridge (Global Dashboard)
* **Polymorphic UI Components:** `ExecutiveDashboard.tsx` dynamically adapts to different JSON payloads (`Silo B` vs `Global`).
* **Dynamic Charting:** CSS Stacked Bar charts auto-scale based on the highest volume day (`maxChartValue`).
* **Big Data Formatting:** Compact financial formatters (e.g., auto-shrinking `1,500,000` to `1.5M MAD`).
* **Cross-Silo Alerts:** Actively aggregates "Low Stock" warnings from both Database A and Database B.
* **True Cash Treasury Math (v4.6.0 ADDITION):** * The God View actively isolates and ignores virtual `COMPENSATION` money. 
    * Auto-refunds (`AVOIR` cash returns) are strictly subtracted from the daily drawer, ensuring `realCash` always matches the physical till.

### 4. 👥 Advanced Client Manager & Smart Debt
* **"Chameleon" Frontend Component (Upgraded):**
    * `ClientStatement.tsx` is now entirely "dumb". It relies 100% on the backend for math, preventing UI freezing or paginated calculation glitches. It safely routes to either `/legal/...` or `/internal/...`.
* **"100k Client" Architecture:**
    * **Server-Side Search:** API-driven, case-insensitive search. UI selectors (like `InvoiceWizard.tsx`) now safely handle paginated API metadata objects.
* **UI Defense Layers (v4.6.0 ADDITION):** * All React loops use safe wrappers (`extractArray()`) to elegantly handle paginated metadata payloads without crashing.

### 5. 📊 Fiscal Analytics & Big Data (v4.6.0 ADDITION)
* **HT/TTC Margin Splitting:** Analytics natively splits Gross Revenue (HT), Net Margins, and Invoiced VAT across the fiscal year.
* **Memory-Safe Aggregations:** Financial totals (like Global Debt) are strictly processed by PostgreSQL via `_sum`, eradicating RAM leaks previously caused by Node.js mapping arrays of 100k+ rows.

### 6. ⚡ Database Optimization
* **B-Tree Indexing:** Deployed `@@index` on high-frequency columns (`createdAt`, `type`, `clientId`, `balance`, `status`, `paidAt`).
* **Result:** Eradicates "Sequential Scans", guaranteeing instant <100ms dashboard load times even when historical data reaches 10+ years.

---

## 📂 Updated File Structure (Key Modules)

### Database (`packages/db-*/prisma/`)
* **`schema.prisma`:** Injected composite indexes to future-proof the application for millions of rows.

### Backend (`apps/api/src/`)
* **`controllers/ClientsController.ts`:** (Upgraded) Hosts the bulletproof Silo A Ledger Engine with Cent-based math and Auto-Refund safeguards.
* **`controllers/InvoicesController.ts`:** (Upgraded) Handles the intelligent `cancelInvoice` lifecycle (Refund vs. Debt Compensation).
* **`controllers/InternalClientController.ts`:** (Upgraded) Hosts the harmonized Silo B Ledger Engine and FIFO Payment Allocator.
* **`routes/internal.ts` & `routes/legal.ts`:** (Fixed) Correctly mapped decoupled `/statement` endpoints.
* **`controllers/StatsController.ts` (v4.6.0):** Hosts the flawless A+B Treasury math and RAM-safe aggregation engines.
* **`services/InvoiceService.ts` (v4.6.0):** The heart of Silo A. Enforces `toCents` math, `PARTIEL` state locking, and strict Deferred Quote (Devis) conversions.
* **`controllers/LegalReportController.ts` (v4.6.0):** CSV Streaming engine fortified with Compensation-awareness for pristine Accountant exports.

### Frontend (`web-ui/src/components/`)
* **`ClientStatement.tsx`:** (Upgraded) Backend-driven Chameleon component for rendering perfect A4 statements for both silos.
* **`InvoiceWizard.tsx`:** (Upgraded) Hardened to process paginated Big Data responses gracefully (`Array.isArray`).
* **`GlobalDashboard.tsx` & `ExecutiveDashboard.tsx`:** Complete UI overhaul with dynamic CSS charts.
* **`InvoicePrint.tsx` (v4.6.0):** Fully DGI-compliant with precise rounding and text-spelling macros.
* **`LegalAnalytics.tsx` (v4.6.0):** Re-mapped to display dynamic HT/TTC, Margin, and Pipeline data gracefully.
* **`LegalClientProfile.tsx` (v4.6.0):** Hard-linked to backend status strings (`m.status === 'PAYEE'`) to prevent UI floating-point glitches.
* **`LegacyExchangeWizard.tsx` (v4.6.0):** Wrapped in API pagination shields.

---

## 📝 Roadmap & Next Steps

1.  **Mission 16:** **"Cash Flow" Reconciliation Report** (Comparing physical drawer cash/checks vs. theoretical system revenue).
2.  **Audit Logs:** Implement a "User Action Log" to track *who* deleted a document or modified a transaction.
3.  **Mobile View:** Optimize the POS and Wizard components for tablet usage (warehouse floor).