# 📋 State Log - ISSLI PECHE ERP

**Last Updated:** February 02, 2026
**Version:** 3.7.0 - "Dual-Silo Unified Command & Accounting Suite"
**Status:** 🟢 STABLE (PRODUCTION READY)

---

## 🚀 Latest Major Upgrades (Version 3.7.0)

### 29. 🎯 Enterprise Accounting Hub (Silo A - Legal)
* **Authenticated Export Suite:**
    * **Sales Journal (IS):** Chronological log of invoices and credit notes with exact VAT 10% and 20% splits, formatted for Corporate Tax declaration.
    * **Receipts & VAT Journal (TVA):** Detailed tracking of collections (cash basis) providing the HT Base and Tax breakdown per payment for official VAT returns.
    * **Bilan Actif (Assets):** Consolidated situation report merging current **Stock A** valuation with **Client Receivables** (Total Debt).
* **Excel Interoperability:**
    * **French Format Localization:** Automated conversion of decimal dots to commas and implementation of `sep=;` headers to ensure files open perfectly in French Excel.
    * **UTF-8 BOM Encoding:** Fixed character corruption (mojibake) for accented French characters in all CSV exports.

### 30. 🏭 Internal Operations Engine (Silo B - Operations)
* **Decoupled Architecture:**
    * **Independent Performance:** Silo B handles high-frequency operational transactions (consumables, oils, filters) without impacting the Legal database.
    * **Invincibility Protocol:** Integrated the `safeDbCall` wrapper, ensuring Silo A remains 100% functional even if the Internal database is offline or undergoing maintenance.
* **Inventory & Logistics:**
    * **Stock B Lifecycle:** Management of items using `internalSku` and real purchase costs, distinct from legal selling prices.
    * **Internal Tools:** Generation of **Internal Delivery Notes** (Bon de Livraison) and **Inventory Sheets** for physical warehouse audits.
    * **Label System:** Integrated `InternalLabelPrint.tsx` for physical stock tagging and tracking.
* **Unified Client Portfolio:**
    * **Global Timeline:** The Client view now pulls and merges events from both silos chronologically, using badges to distinguish between "OFFICIEL" (Silo A) and "INTERNE" (Silo B) transactions.

### 31. 🛡️ Security & Performance
* **Authenticated Binary Fetching:** Replaced open-link downloads with secure Axios "Blob" requests, ensuring financial exports are only accessible with a valid session token.
* **Crash-Proof KPI Logic:** Implemented "Zero-Fallback" math across all dashboards to prevent `NaN` errors in the UI during empty reporting periods.

---

## 📜 Previous Upgrades (v3.6.0)

### 24-25. 💳 Debt Management & Returns
* **Flexible Sales:** Choice between "Cash" or "Credit" (Acompte) at the point of sale.
* **Ghost Product Handling:** Secure protocol to accept returns for items not found in the current database via temporary "Legacy" records.

---

## 📂 Current Directory Structure (Verified)
* **Root:** `marine-ops-monorepo/`
* **Backend (`apps/api/`):** * `LegalReportController.ts` (Accounting Hub)
    * `InternalController.ts` (Warehouse Ops)
    * `InvoicesController.ts` (Silo A Documents)
* **Frontend (`web-ui/`):** * `FinancialReportModal.tsx` (Export Center)
    * `InternalDeliveryNote.tsx` (Silo B Logistics)
    * `LegalDashboard.tsx` (Management Command)
* **Databases:**
    * `packages/db-legal/` (Prisma - PostgreSQL)
    * `packages/db-internal/` (Prisma - PostgreSQL)

---

**System Signature:** ISSLI PECHE ERP v3.7.0
**Current Focus:** System handover and final staff orientation for the new Accounting Suite.