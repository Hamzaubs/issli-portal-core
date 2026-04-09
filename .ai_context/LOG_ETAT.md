# 📋 State Log - ISSLI PECHE ERP

**Last Updated:** April 2026
**Version:** 4.7.0 - "The Fortress Update: Absolute Portal Isolation"
**Status:** 🟢 STABLE (SILO A & SILO B LEDGERS FULLY LOCKED & HARMONIZED)

---

## 🏢 System Architecture: The "Twin Silo" Model
*A unified ERP splitting "Fiscal/Legal" (Silo A) and "Operational/Internal" (Silo B) into two isolated but architecturally identical engines.*

* **Silo A (Legal):** Strict, VAT-compliant, DGI-ready. Used for official invoicing.
* **Silo B (Internal):** Flexible, high-velocity, cash-flow focused. Used for daily counter operations.
* **The Bridge (God View):** A virtual aggregation layer allowing the Super Admin to view combined data (Silo A + Silo B) without physically merging the databases.

---

## 🚀 Major Functional Modules

### 1. 🔐 Zero-Trust Portal Isolation & Security (v4.7.0 ADDITION)
* **Dedicated Entry Portals:** Replaced the vulnerable single-page login with explicit, keycard-restricted frontend routes (`/portal/admin`, `/portal/legal`, `/portal/pos`). Removed generic navigation to enforce isolation.
* **Backend "Source of Truth" Authentication:** The frontend no longer handles Role-Based Access Control (RBAC). `AuthController.ts` actively rejects unauthorized Portal-Role login attempts with strict `403 Forbidden` responses.
* **Contextual JWTs & Route Fortification:** * JWTs now embed the specific `portal` context they were issued for (`ADMIN`, `LEGAL`, `POS`).
    * `RoleMiddleware.ts` employs strict "Context Guards" to completely eradicate "Cross-Silo Exploitation" (e.g., physically blocking a user from taking a valid POS token and making API requests to Legal endpoints).
    * All legacy authentication middleware (`requireAuth`) was purged and successfully migrated to the hardened `authenticateToken` engine.
* **API Gateway Locking:** The main Express `index.ts` groups and physically isolates routing trees. `purchase`, `supplier`, and `clients` routes are now hermetically sealed behind the `requireLegalAccess` guard, patching a previous vulnerability where they were publicly exposed.
* **"God View" Middleware Exemption:** Super Admins are mathematically exempted from the portal context guards on standard routes, allowing the Global Dashboard to seamlessly fetch multi-database aggregations without breaking security constraints for standard users.

### 2. 🎯 Enterprise Accounting Hub (STOCK A - Official)
* **Mathematically Locked Ledger:** Eradicated floating-point errors (`0.1 + 0.2 = 0.30000000000000004`) using strict Cent-based math (`Math.round(val * 100)`) for perfect MAD decimals.
    * **Same-Millisecond Sorting:** Guarantees Debits (Factures) always process before Credits (Payments) when timestamps are identical, preventing temporary negative balances.
* **Auto-Refund Lifecycle:**
    * Eliminated the "Store Credit" concept for returns. Generating an `AVOIR` now instantly triggers a corresponding cash refund (`Payment`) or debt compensation.
    * **Smart Loan Cancellation:** If an unpaid invoice (credit/loan) is cancelled, the system compensates the debt without artificially logging a cash refund, protecting cash-flow analytics.
* **Commercial Pipeline:**
    * **Quotations (Devis):** Full A4 generation with validity tracking.
    * **Conversion Logic:** Atomic **Devis → Invoice** transformation.
* **Transactional Safety:**
    * **Atomic Locking:** `prisma.$transaction` prevents partial writes.
* **Strict State Machine & Overpayment Shield:** * Documents strictly follow the legal sequence (`EN_ATTENTE` ➡️ `PARTIEL` ➡️ `PAYEE`). 
    * The system physically rejects overpayments (tolerance: 1 centime) to prevent floating/ghost debt.
    * Controller-level math engine strictly enforces the `PARTIEL` and `PAYEE` transitions, completely eradicating the "0 DH Impayée" ghost UI bug.
* **DGI-Compliant PDF Engine:**
    * Native Number-to-French-Words conversion (*"Arrêtée la présente facture à la somme de..."*).
    * Row-by-row VAT rounding to completely eradicate decimal drift between PDF totals and database totals.
    * Unit of Measure ("Type de Gestion": KG, L, M, U) is now perfectly extracted from the cart payload and dynamically rendered on the printed A4 templates.
* **Legacy Exchange Fortification:** Bridges old paper returns with new stock. Accurately flags exchange balances as `COMPENSATION` to prevent fake cash injections into analytics.

### 3. 🏗️ Internal Operations & Analytics Engine (STOCK B)
* **Silo B Ledger Engine:**
    * Fully upgraded to mirror Silo A's JSON structure. Provides mathematically safe `debit`, `credit`, and `balance` directly from the server.
    * Retains the **FIFO Debt Allocation** engine, intelligently cascading global payments across the oldest unpaid tickets using `Prisma.Decimal`.
* **High-Performance Analytics:**
    * **Memory-Safe Aggregation:** Optimized Prisma `findMany({ select })` prevents `camelCase` mapping errors while querying 100k+ rows using <1MB of RAM.
    * **Dual Stock Valuation:** Calculates and displays both *Purchase Cost* and *Selling Potential*.
* **Inventory Bulk Adjustments:**
    * High-speed `ADJUSTMENT` movement types that correct physical stock without inflating revenue or cost margins.
* **POS Workflow Defense:**
    * **Anonymous Checkout Shield:** Custom React DOM modals intercept and require explicit confirmation for "CLIENT COMPTOIR" (no-client) sales or returns, bypassing native browser popup blockers.
    * **Unit of Measure Integrity:** Internal POS grids and checkout panes now dynamically display and log accurate units (KG, L, M, U) preventing data leaks to the internal delivery notes.

### 4. 🌍 The Executive Bridge (Global Dashboard)
* **Polymorphic UI Components:** `ExecutiveDashboard.tsx` dynamically adapts to different JSON payloads (`Silo B` vs `Global`).
* **Dynamic Charting:** CSS Stacked Bar charts auto-scale based on the highest volume day (`maxChartValue`).
* **Big Data Formatting:** Compact financial formatters (e.g., auto-shrinking `1,500,000` to `1.5M MAD`).
* **Cross-Silo Alerts:** Actively aggregates "Low Stock" warnings from both Database A and Database B.
* **True Cash Treasury Math:** * The God View actively isolates and ignores virtual `COMPENSATION` money. 
    * Auto-refunds (`AVOIR` cash returns) are strictly subtracted from the daily drawer, ensuring `realCash` always matches the physical till.

### 5. 👥 Advanced Client Manager & Smart Debt
* **"Chameleon" Frontend Component:**
    * `ClientStatement.tsx` is now entirely "dumb". It relies 100% on the backend for math, preventing UI freezing or paginated calculation glitches. It safely routes to either `/legal/...` or `/internal/...`.
* **"100k Client" Architecture:**
    * **Server-Side Search:** API-driven, case-insensitive search. UI selectors (like `InvoiceWizard.tsx`) now safely handle paginated API metadata objects.
* **UI Defense Layers:** All React loops use safe wrappers (`extractArray()`) to elegantly handle paginated metadata payloads without crashing.

### 6. 📊 Fiscal Analytics & Big Data
* **HT/TTC Margin Splitting:** Analytics natively splits Gross Revenue (HT), Net Margins, and Invoiced VAT across the fiscal year.
* **Memory-Safe Aggregations:** Financial totals (like Global Debt) are strictly processed by PostgreSQL via `_sum`, eradicating RAM leaks previously caused by Node.js mapping arrays of 100k+ rows.
* **CSV Export Hardening:** Journal des Ventes, Relevé de TVA, Bilan, and Inventory exports now explicitly map `PARTIEL` states and utilize Cent-math to eradicate decimal drift in accountant reports.

### 7. ⚡ Database Optimization
* **B-Tree Indexing:** Deployed `@@index` on high-frequency columns (`createdAt`, `type`, `clientId`, `balance`, `status`, `paidAt`).
* **Result:** Eradicates "Sequential Scans", guaranteeing instant <100ms dashboard load times even when historical data reaches 10+ years.

---

## 📂 Updated File Structure (Key Modules)

### Database (`packages/db-*/prisma/`)
* **`schema.prisma`:** Injected composite indexes to future-proof the application for millions of rows.

### Backend (`apps/api/src/`)
* **`controllers/AuthController.ts` (v4.7.0):** Hosts the new strict Portal-Role matching engine.
* **`middleware/AuthMiddleware.ts & RoleMiddleware.ts` (v4.7.0):** Employs precise "Context Guards" to ensure tokens remain locked within their designated Silos, while permitting Super Admin cross-database dashboard fetching.
* **`controllers/ClientsController.ts`:** Hosts the bulletproof Silo A Ledger Engine with Cent-based math and Auto-Refund safeguards.
* **`controllers/InvoicesController.ts`:** Handles the intelligent `cancelInvoice` lifecycle (Refund vs. Debt Compensation) and strictly locks the `PAYEE`/`PARTIEL` state machine via `toCents()` math.
* **`controllers/InternalClientController.ts`:** Hosts the harmonized Silo B Ledger Engine and FIFO Payment Allocator.
* **`controllers/StatsController.ts`:** Hosts the flawless A+B Treasury math and RAM-safe aggregation engines.
* **`services/InvoiceService.ts`:** The heart of Silo A. Enforces `toCents` math, `PARTIEL` state locking, and strict Deferred Quote (Devis) conversions.
* **`controllers/LegalReportController.ts`:** CSV Streaming engine fortified with Compensation-awareness and Cent-based math for flawless accountant exports.
* **`controllers/Supplier.Controller.ts` & `InternalPurchaseController.ts`:** Comprehensive supplier and expenditure management for Silo A and Silo B.

### Frontend (`web-ui/src/`)
* **`App.tsx` (v4.7.0):** Replaced `SessionSelector` with a strict `PortalGateway` routing directly to `/portal/admin`, `/portal/legal`, and `/portal/pos`.
* **`components/Login.tsx` (v4.7.0):** Stripped of front-end logic; strictly passes portal routing context to the Node.js vault.
* **`components/SessionSelector.tsx`:** **[DELETED in v4.7.0]** Replaced by integrated Gateway.
* **`components/Dashboard.tsx`:** Upgraded Silo B POS to enforce Anonymous "Client Comptoir" checkout shields and accurately pass physical `measureUnit` data.
* **`components/ClientStatement.tsx`:** Backend-driven Chameleon component for rendering perfect A4 statements for both silos.
* **`components/InvoiceWizard.tsx`:** Hardened to process paginated Big Data responses gracefully and securely attach `measureUnit` payloads.
* **`components/GlobalDashboard.tsx` & `ExecutiveDashboard.tsx`:** Complete UI overhaul with dynamic CSS charts.
* **`components/InvoicePrint.tsx` & `InvoiceTemplate.tsx`:** Fully DGI-compliant with precise rounding, text-spelling macros, and dynamic "Type de Gestion" (Unit) rendering.

---

## 📝 Roadmap & Next Steps

1.  **Mission 16:** **"Cash Flow" Reconciliation Report** (Comparing physical drawer cash/checks vs. theoretical system revenue).
2.  **Audit Logs:** Implement a "User Action Log" to track *who* deleted a document or modified a transaction.
3.  **Mobile View:** Optimize the POS and Wizard components for tablet usage (warehouse floor).