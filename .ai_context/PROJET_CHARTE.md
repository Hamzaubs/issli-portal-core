# PROJET_CHARTE: ISSLI PECHE ERP (Morocco 2026)

## 🎯 Project Mission
A dual-database management system for Moroccan marine equipment, balancing official tax compliance with fast internal operations.

## 🏗️ The Dual-Stock Architecture (MANDATORY)

### 1. STOCK A (Official / Legal)
* **Purpose:** Strict compliance with Moroccan tax laws (DGI).
* **Content:** High-value assets (Engines, Sonars, Radar).
* **Rules:**
    * MUST apply VAT (10%, 14%, or 20%).
    * MUST generate invoices with ICE, RC, and IF.
    * No deletion of finalized invoices (Credit Notes required).
    * **User View:** "Bureau Légal" or "STOCK A".

### 2. STOCK B (Internal / Operational)
* **Purpose:** Real-world cash flow, physical stock management, and Accounts Payable.
* **Content:** Consumables (Oil, Filters, small hardware) & Counter Sales.
* **Rules:**
    * **Harmonized Pricing:** Uses standard `priceHT`, `vatRate`, and `priceTTC` to align with purchasing logic, but focused on the final "Cash/Net" price for POS speed.
    * **Daily Reconciliation:** Requires a physical "Clôture de Caisse (Z)" at the end of each shift.
    * Supports quick adjustments and returns.
    * **Enterprise Void Engine:** Financial records are NEVER hard-deleted; mistakes are reversed via "Annuler" to maintain audit trails.

### 3. STOCK GLOBALE (Executive View)
* **Purpose:** High-level aggregation for Direction Générale.
* **Access:** STRICTLY RESTRICTED to **SUPER_ADMIN**.
* **Hermetic Isolation:** To ensure data integrity, Silo A (Legal) management tools are unlinked from the Global View. Users must log into the specific Legal Portal for DGI operations.

## 🏗️ Technical Isolation & Math Engine
* **Database A:** `prisma.schema` (Postgres) -> Handles `Invoice`, `ClientA`, `ProductA`.
* **Database B:** `internal.db` (Postgres) -> Handles `TransactionB`, `ClientB`, `ProductB`, `SupplierB`, `PurchaseB`.
* **Cent-Based Math Engine (MANDATORY):** All financial calculations (TTC, HT, TVA, Balances, and Grouping) MUST be performed using absolute integer centimes (`Math.round(val * 100)`) in both **Frontend** and **Backend** to eradicate floating-point drift.

## 🌍 Localization & Language
* **Currency:** Values formatted in **MAD** (Dirham Marocain) with 2 decimal precision.
* **UI Language:** Strictly **French**.
* **Compliance:** Mandatory support for Moroccan ICE and standardized VAT rates (0%, 10%, 14%, 20%).

## 🔐 Security & Roles
* **SUPER_ADMIN:** Full access. Only role allowed to view "Profits" and trigger "Annuler".
* **LEGAL_USER / POS_USER:** Portal-restricted access. Tokens are locked to their specific silo to prevent cross-silo data leaks.