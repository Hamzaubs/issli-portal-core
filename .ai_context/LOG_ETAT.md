# 📋 State Log - ISSLI PECHE ERP

**Last Updated:** April 2026
**Version:** 5.2.0 - "The Hermetic Fortress Update"
**Status:** 🟢 STABLE
---

## 🏢 System Architecture: The "Twin Silo" Model
### 1. 🛡️ Cent-Math Sovereignty (Full-Stack Audit)
* **Problem:** Floating-point drift was causing `NaN` errors and micro-debt ghosting (e.g., 0.0000004 MAD).
* **Fix:** Conducted a system-wide audit of all React components and backend controllers (`InternalController`, `InternalPurchaseController`, `InternalClientController`, `StatsController`).
* **Implementation:** All financial math (Margins, VAT, Waterfall payments, and Treasury) is now aggregated in **Cents (Integers)** at the backend level before conversion to decimals, ensuring absolute banking precision.

### 2. 📊 Global Stock Harmonization (Formerly Silo B)
* **Standardization:** Completely deprecated "Silo B" and "Stock B" terminology in favor of **"Global Stock"**.
* **Pricing Truth:** Internal products now strictly use the `priceHT`, `vatRate`, and `priceTTC` schema to align with the professional Purchase/Stock-in engine.
* **Data Safety:** Upgraded `InternalAssetImport.tsx` and `ProductForm.tsx` to strictly map to the new schema, preventing invalid data injection during creation.

### 3. 🔐 Portal & View Segregation
* **Silo A Isolation:** Unlinked "Accès DGI" and "Gestion Légale" from the Global Admin Dashboard to ensure Silo A remains a focused tax-compliance environment.
* **Sidebar Intelligence:** `App.tsx` now dynamically renders sidebar groups based on the active Portal Context (`LEGAL`, `POS`, or `ADMIN`).
* **Collapsible Interface:** Integrated a **"Mini-Sidebar"** icon-only mode to maximize screen real estate for operators using the Sales Terminal.

### 4. 🛡️ Global Error Shield (System Integrity)
* **Fault Interceptor:** Injected a root middleware in `index.ts` to capture and format Prisma exceptions (P2002, P2003, P2025).
* **Resilience:** Automatically translates technical database errors into clear French messages (e.g., "Action Refused: Item linked to transaction history"), preventing `500 Internal Server Error` crashes.
---

## 🚀 Major Functional Modules

### 1. 🔐 Zero-Trust Portal Isolation & Security
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
* **Exact Due Waterfall Math:** Replaced flawed proportional/ratio-based return calculations with the Enterprise-Grade "Absolute Net-Down" logic.
    * Mathematically computes `Effective Total = Total Sale - Returns`.
    * Fluidly catches overpayments: If a client partially pays and then returns an item, the system automatically zeroes the debt and correctly flags the overflow as **Store Credit (Avoir)**, eradicating counter disputes.
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

### 4. 🛒 Advanced Purchasing & Accounts Payable (STOCK B)
* **Dynamic Document State Machine:** Seamless handling of *Bons de Commande* (no stock/debt impact), *Bons de Réception* (stock impact, no debt), and *Factures d'Achat* (full stock and debt impact).
* **Accounts Payable Ledger (Relevé Fournisseur):** Perfect chronological ledger calculating running balances, paired with a dedicated DGI-styled A4 PDF generation engine (`SupplierStatementPrint.tsx`).
* **Treasury Double-Count Shield:** Backend logic strictly sets physical stock movements to `amount: 0` to prevent ghost cash from inflating the drawer, while routing actual *Acomptes* securely out of the treasury.
* **Overpayment & "Crédit Paradox" Locks:** Frontend and backend validations completely block users from paying more than the invoice total or the supplier's outstanding balance, and instantly lock the payment input if "À Crédit" is selected.
* **Ghost/Expense Products:** POS gracefully handles "Hors-Stock" manual entries (expenses like office supplies) with visual DOM warnings (`AlertTriangle`) without artificially inflating warehouse inventory.
* **Standalone Payment Routing:** Global supplier payments are flawlessly routed to a hidden, auto-generated system product (`SYS-FINANCE`) to maintain relational database integrity for analytics.
* **Enterprise Void Engine:** A strict "Annuler" feature that executes a Compensating Reversal (subtracts stock, refunds treasury, zeroes debt) instead of deleting records, maintaining flawless audit trails.
* **Referential Integrity Shield:** Backend actively blocks the deletion of any Supplier that possesses a financial footprint (purchases, movements, or debt), preventing Foreign Key crashes and ledger corruption.
* **Front-End Floating-Point Eradication:** JavaScript `.reduce()` loops and validation checks upgraded to use strict Cent-based integer math (`Math.round(val * 100)`), preventing decimal drift from blocking valid payments.

### 5. 🌍 The Executive Bridge (Global Dashboard)
* **Polymorphic UI Components:** `ExecutiveDashboard.tsx` dynamically adapts to different JSON payloads (`Silo B` vs `Global`).
* **Dynamic Charting:** CSS Stacked Bar charts auto-scale based on the highest volume day (`maxChartValue`).
* **Big Data Formatting:** Compact financial formatters (e.g., auto-shrinking `1,500,000` to `1.5M MAD`).
* **Cross-Silo Alerts:** Actively aggregates "Low Stock" warnings from both Database A and Database B.
* **True Cash Treasury Math:** * The God View actively isolates and ignores virtual `COMPENSATION` money. 
    * Auto-refunds (`AVOIR` cash returns) are strictly subtracted from the daily drawer, ensuring `realCash` always matches the physical till.

### 6. 👥 Advanced Client Manager & Smart Debt
* **"Chameleon" Frontend Component:**
    * `ClientStatement.tsx` is now entirely "dumb". It relies 100% on the backend for math, preventing UI freezing or paginated calculation glitches. It safely routes to either `/legal/...` or `/internal/...`.
* **"100k Client" Architecture:**
    * **Server-Side Search:** API-driven, case-insensitive search. UI selectors (like `InvoiceWizard.tsx`) now safely handle paginated API metadata objects.
* **UI Defense Layers:** All React loops use safe wrappers (`extractArray()`) to elegantly handle paginated metadata payloads without crashing.

### 7. 📊 Fiscal Analytics & Big Data
* **HT/TTC Margin Splitting:** Analytics natively splits Gross Revenue (HT), Net Margins, and Invoiced VAT across the fiscal year.
* **Memory-Safe Aggregations:** Financial totals (like Global Debt) are strictly processed by PostgreSQL via `_sum`, eradicating RAM leaks previously caused by Node.js mapping arrays of 100k+ rows.
* **CSV Export Hardening:** Journal des Ventes, Relevé de TVA, Bilan, and Inventory exports now explicitly map `PARTIEL` states and utilize Cent-math to eradicate decimal drift in accountant reports.

### 8. ⚡ Database Optimization & Cloud Ops
* **Render Deployment Hardening:** Hardened schema `binaryTargets` strictly to `["native", "debian-openssl-3.0.x"]`, guaranteeing flawless compilation on Render's modern Ubuntu instances and eradicating `ERR_MODULE_NOT_FOUND` crashes.
* **Production Sync Safety:** Transitioned CI/CD pipeline to use `npx prisma db push --skip-generate`. This seamlessly bypasses `P3005` (Non-empty database) sync conflicts, injecting new columns into the live Neon DB without risking production data loss.
* **B-Tree Indexing:** Deployed `@@index` on high-frequency columns (`createdAt`, `type`, `clientId`, `balance`, `status`, `paidAt`), eradicating "Sequential Scans" for <100ms dashboard loads.

---

## 📂 Updated File Structure (Key Modules)

### Database (`packages/db-*/prisma/`)
* **`schema.prisma`:** Injected composite indexes and established the critical `returnedQuantity` tracking column for Silo B's Exact Due Waterfall math.
* **`apps/api/seed.mjs`:** Engineered a robust ES Module seed script bypassing monorepo workspace resolution to securely inject root `SUPER_ADMIN`, `POS_USER`, and `LEGAL_USER` roles directly into the internal DB.

### Backend (`apps/api/src/`)
* **`controllers/AuthController.ts`:** Hosts the strict Portal-Role matching engine.
* **`middleware/AuthMiddleware.ts & RoleMiddleware.ts`:** Employs precise "Context Guards" to ensure tokens remain locked within designated Silos.
* **`controllers/ClientsController.ts`:** Hosts the bulletproof Silo A Ledger Engine with Cent-based math and Auto-Refund safeguards.
* **`controllers/InvoicesController.ts`:** Handles intelligent `cancelInvoice` lifecycle and strictly locks the `PAYEE`/`PARTIEL` state machine via `toCents()` math.
* **`controllers/InternalClientController.ts`:** Hosts the harmonized Silo B Ledger Engine, integrating Exact Due Waterfall Math alongside the FIFO Payment Allocator.
* **`controllers/InternalPurchaseController.ts`:** Hosts the secure Supplier Document State Machine, Cent-based validation, Void Engine, and strict Supplier Deletion Shields.
* **`controllers/StatsController.ts`:** Hosts the flawless A+B Treasury math and RAM-safe aggregation engines.
* **`services/InvoiceService.ts`:** The heart of Silo A. Enforces `toCents` math, `PARTIEL` state locking, and strict Deferred Quote conversions.
* **`controllers/LegalReportController.ts`:** CSV Streaming engine fortified with Compensation-awareness and Cent-based math for flawless accountant exports.
* **`routes/internal.ts`:** API Gateway dynamically locking all purchasing, voiding, and supplier payment routes behind `requireAdmin` context guards.

### Frontend (`web-ui/src/`)
* **`App.tsx`:** Replaced `SessionSelector` with a strict `PortalGateway` routing directly to `/portal/admin`, `/portal/legal`, and `/portal/pos`.
* **`components/Login.tsx`:** Stripped of front-end logic; strictly passes portal routing context to the Node.js vault.
* **`components/Dashboard.tsx`:** Upgraded Silo B POS to enforce Anonymous "Client Comptoir" checkout shields.
* **`components/PurchaseManager.tsx`:** Cent-math fortified POS for incoming stock and expenses with exact payment constraints and Void triggers.
* **`components/SupplierManager.tsx`:** Debt tracking hub with interactive Relevé generation and strict relational deletion blocks.
* **`components/SupplierStatementPrint.tsx`:** DGI-styled A4 generation for accurate chronological supplier ledgers.
* **`components/ClientStatement.tsx`:** Backend-driven Chameleon component for rendering perfect A4 statements for both silos.
* **`components/InvoiceWizard.tsx`:** Hardened to process paginated Big Data responses gracefully.
* **`components/GlobalDashboard.tsx` & `ExecutiveDashboard.tsx`:** Complete UI overhaul with dynamic CSS charts.
* **`components/InvoicePrint.tsx` & `InvoiceTemplate.tsx`:** Fully DGI-compliant with precise rounding, text-spelling macros, and dynamic "Type de Gestion" (Unit) rendering.

---

## 📝 Roadmap & Next Steps

1.  **Audit Logs:** Implement a "User Action Log" to track *who* deleted a document or modified a transaction.
2.  **Mobile View:** Optimize the POS and Wizard components for tablet usage (warehouse floor).
3.  **Global Treasury Reconciliation:** Build a dedicated End-of-Day cash drawer reconciliation screen bridging sales inflows and purchasing outflows.