// apps/api/src/routes/legal.ts
import { Router } from 'express';
// ✅ NEW: The Controller for Sales, Returns, Debt & Exchanges
import { InvoicesController } from '../controllers/InvoicesController';

// ♻️ EXISTING: Keeping your old controllers for other features
import { LegalController } from '../controllers/LegalController';
import { LegalReportController } from '../controllers/LegalReportController'; 
import { LegalProductsController } from '../controllers/LegalProductsController'; 
import { SettingsController } from '../controllers/SettingsController'; 
import { ExpenseController } from '../controllers/ExpenseController'; 

// 🛡️ SECURITY
import { requireAuth } from '../middleware/auth';
import { requireLegalAccess, requireAdmin } from '../middleware/RoleMiddleware';

const router = Router();

// =================================================================
// 🛑 1. BASE SECURITY (Only Admin & Legal Users)
// =================================================================
router.use(requireAuth, requireLegalAccess);


// =================================================================
// 📄 NEW DOCUMENTS SYSTEM (Sales, Returns, Quotes, Debt)
// =================================================================
// 🔍 List & Search
router.get('/documents', InvoicesController.getDocuments); 

// ➕ Create Global (Sale / Return / Quote) - Supports Ghost Products
router.post('/documents', InvoicesController.createDocument); 

// 💰 Solder / Pay Debt (Partial Payments)
router.post('/invoices/:id/payment', InvoicesController.addPayment); 

// 🔄 Convert Quote -> Invoice
router.post('/invoices/:id/convert-quote', InvoicesController.convertQuote);

// 💱 LEGACY EXCHANGE (Old System Returns -> New System Buy)
// 🔒 Secured: Only Admin can validate a return of items that don't exist in DB.
router.post('/invoices/exchange', requireAdmin, InvoicesController.processLegacyExchange);

// ↩️ Returns & Cancellations (Unified "Avoir" Logic)
router.post('/invoices/:id/credit-note', InvoicesController.createCreditNote); 
router.post('/invoices/:id/cancel', InvoicesController.cancelInvoice); 


// =================================================================
// 📦 PRODUCTS (Inventory Management)
// =================================================================
// We keep your existing LegalProductsController for CRUD operations
router.get('/products', LegalProductsController.getProducts); 
router.post('/products', requireAdmin, LegalProductsController.createProduct); // 🔒 ADMIN ONLY
router.put('/products/:id', requireAdmin, LegalProductsController.updateProduct); // 🔒 ADMIN ONLY
router.delete('/products/:id', requireAdmin, LegalProductsController.deleteProduct); // 🔒 ADMIN ONLY

// ✅ NEW: Product History (Audit Traceability)
router.get('/products/:id/history', LegalProductsController.getProductHistory);


// =================================================================
// 👥 CLIENTS
// =================================================================
router.get('/clients', LegalController.getClients); 
router.get('/clients/:id', LegalController.getClientDetails); 
router.post('/clients', LegalController.createClient); 
router.put('/clients/:id', requireAdmin, LegalController.updateClient); // 🔒 ADMIN ONLY
router.delete('/clients/:id', requireAdmin, LegalController.deleteClient); // 🔒 ADMIN ONLY


// =================================================================
// 📊 STATS & REPORTS (Silo A)
// =================================================================
router.get('/stats', LegalController.getStats); 
router.get('/reports/analytics', LegalReportController.getAnalytics); 

// ✅ FIX: Dynamic CSV Export Route (Matches Controller logic)
router.get('/reports/:type', LegalReportController.getExport);


// =================================================================
// ⚙️ SETTINGS & EXPENSES (Admin Only Features)
// =================================================================
router.get('/settings', SettingsController.getSettings); 
router.put('/settings', requireAdmin, SettingsController.updateSettings); // 🔒 ADMIN ONLY

router.get('/expenses', requireAdmin, ExpenseController.getExpenses); // 🔒 ADMIN ONLY
router.post('/expenses', requireAdmin, ExpenseController.createExpense); // 🔒 ADMIN ONLY
router.delete('/expenses/:id', requireAdmin, ExpenseController.deleteExpense); // 🔒 ADMIN ONLY

export default router;