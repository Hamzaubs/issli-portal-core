# PROJET_CHARTE: ISSLI PECHE ERP (Morocco 2026)

## 🎯 Project Mission
A dual-database management system for Moroccan marine equipment, balancing official tax compliance with fast internal operations.

## 🏗️ The Dual-Stock Architecture (MANDATORY)

### 1. STOCK A (Official / Legal)
* **Purpose:** Strict compliance with Moroccan tax laws (DGI).
* **Content:** High-value assets (Engines, Sonars, Radar).
* **Rules:**
    * MUST apply VAT (10% or 20%).
    * MUST generate invoices with ICE, RC, and IF.
    * No deletion of finalized invoices (Credit Notes required).
    * **User View:** "Bureau Légal" or "STOCK A".

### 2. STOCK B (Internal / Operational)
* **Purpose:** Real-world cash flow and physical stock management.
* **Content:** Consumables (Oil, Filters, small hardware) & Counter Sales.
* **Rules:**
    * Tax-blind (Net pricing).
    * Focus on "Cash in Drawer" and physical quantity.
    * Supports quick adjustments and returns.
    * **User View:** "Magasin Interne" or "STOCK B".

### 3. STOCK GLOBALE (Executive View)
* **Purpose:** The only view where A and B are combined.
* **Access:** STRICTLY RESTRICTED to **SUPER_ADMIN** (Direction Générale).
* **Logic:**
    * `Global CA` = `CA Stock A` + `CA Stock B`.
    * `Global Stock Value` = `Value A` + `Value B`.
* **Technical:** This is a *virtual* view. There is no "Global Database".

## 🏗️ Technical Isolation
* **Database A:** `prisma.schema` (Postgres/SQLite) -> Handles `Invoice`, `ClientA`, `ProductA`.
* **Database B:** `internal.db` (JSON/SQLite) -> Handles `TransactionB`, `ClientB`, `ProductB`.
* **No SQL Joins:** Data from A and B must never be joined at the database query level. Aggregation happens in Node.js only.

## 🌍 Localization & Language
* **Code:** All variables, database fields, and logic must be in **English**.
* **User Interface:** All buttons, labels, and reports must be in **French**.
* **Currency:** Values formatted in **MAD** (Dirham Marocain).
* **Compliance:** Support for Moroccan ICE (Identifiant Commun de l’Entreprise).

## 🔐 Security & Roles
* **SUPER_ADMIN:**
    * **Rights:** Read/Write ALL.
    * **Exclusive:** Only role allowed to **ADD** or **EDIT** products in Stock A or B.
    * **Exclusive:** Only role allowed to view "Profits" and "Total CA".
* **LEGAL_USER / POS_USER:**
    * **Rights:** "Sell-Only" (Read/Sale).
    * **Restriction:** Cannot create products, cannot edit stock manually, cannot view global financial stats.