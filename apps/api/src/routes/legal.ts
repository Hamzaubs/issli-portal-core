// apps/api/src/routes/legal.ts
import { Router } from 'express';
import { InvoicesController } from '../controllers/InvoicesController';
import { LegalController } from '../controllers/LegalController';
import { LegalReportController } from '../controllers/LegalReportController'; 
import { LegalProductsController } from '../controllers/LegalProductsController'; 
import { SettingsController } from '../controllers/SettingsController'; 
import { ExpenseController } from '../controllers/ExpenseController'; 
import { ClientsController } from '../controllers/ClientsController';

// 🛡️ SECURITY FIX: Replaced old requireAuth with authenticateToken
import { authenticateToken } from '../middleware/AuthMiddleware';
import { requireLegalAccess, requireAdmin } from '../middleware/RoleMiddleware';

const router = Router();

// =================================================================
// 🛑 1. BASE SECURITY: Hermetically sealed for Legal / Admin ONLY
// =================================================================
router.use(authenticateToken, requireLegalAccess);

// 📄 NEW DOCUMENTS SYSTEM
router.get('/documents', InvoicesController.getDocuments); 
router.get('/invoices/:id', InvoicesController.getDocumentById);
router.post('/documents', InvoicesController.createDocument); 
router.post('/invoices/:id/payment', InvoicesController.addPayment); 
router.post('/invoices/:id/convert-quote', InvoicesController.convertQuote);
router.post('/invoices/exchange', requireAdmin, InvoicesController.processLegacyExchange);
router.post('/invoices/:id/credit-note', requireAdmin, InvoicesController.createCreditNote); 
router.post('/invoices/:id/cancel', requireAdmin, InvoicesController.cancelInvoice);

// 📦 PRODUCTS
router.get('/products', LegalProductsController.getProducts); 
router.post('/products', requireAdmin, LegalProductsController.createProduct); 
router.put('/products/:id', requireAdmin, LegalProductsController.updateProduct); 
router.delete('/products/:id', requireAdmin, LegalProductsController.deleteProduct); 
router.get('/products/:id/history', LegalProductsController.getProductHistory);
// ✅ NEW ROUTE: Secure Batch Import for Silo A
router.post('/products/batch-import', requireAdmin, LegalProductsController.importBatchProducts);

// 👥 CLIENTS
router.get('/clients', ClientsController.getClients); 
router.get('/clients/:id', ClientsController.getClientDetailsGlobal); 
router.get('/clients/:id/statement', ClientsController.getClientStatement); 
router.get('/clients/:id/history', ClientsController.getClientHistory); 
router.post('/clients', ClientsController.createClientGlobal); 
router.put('/clients/:id', requireAdmin, ClientsController.updateClientGlobal);
router.delete('/clients/:id', requireAdmin, ClientsController.deleteClientGlobal);

// 📊 STATS & REPORTS
router.get('/stats', LegalController.getStats); 
router.get('/reports/analytics', LegalReportController.getAnalytics); 
router.get('/reports/:type', LegalReportController.getExport);

// ⚙️ SETTINGS & EXPENSES
router.get('/settings', SettingsController.getSettings); 
router.get('/settings/backup', requireAdmin, SettingsController.downloadBackup); 
router.put('/settings', requireAdmin, SettingsController.updateSettings);
router.get('/expenses', requireAdmin, ExpenseController.getExpenses);
router.post('/expenses', requireAdmin, ExpenseController.createExpense);
router.delete('/expenses/:id', requireAdmin, ExpenseController.deleteExpense);

export default router;