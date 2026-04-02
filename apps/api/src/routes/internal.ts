// apps/api/src/routes/internal.ts
import { Router } from 'express';
import { InternalController } from '../controllers/InternalController';
import { StatsController } from '../controllers/StatsController';
import { InternalClientController } from '../controllers/InternalClientController'; 
import { DashboardController } from '../controllers/DashboardController';
import { InternalPurchaseController } from '../controllers/InternalPurchaseController';
import { authenticateToken } from '../middleware/AuthMiddleware';
// ✅ IMPORT THE ADMIN GUARD
import { requireAdmin } from '../middleware/RoleMiddleware'; 

const router = Router();
router.use(authenticateToken); // Basic login check

// 📦 Products
router.get('/products', InternalController.getProducts); // Anyone logged in can read

// 🔒 SUPER ADMIN ONLY (Create, Edit, Delete)
router.post('/products', requireAdmin, InternalController.createProduct); 
router.put('/products/:id', requireAdmin, InternalController.updateProduct); 
router.delete('/products/:id', requireAdmin, InternalController.deleteProduct); 
router.post('/products/batch-import', requireAdmin, InternalController.importBatchProducts);
// 📝 Inventory Bulk Adjustments
router.post('/inventory/adjust', requireAdmin, InternalController.adjustInventoryBatch); // 🔒 ADMIN ONLY

// 💰 Transactions
router.get('/transactions', InternalController.getTransactions);
router.post('/transactions', InternalController.createTransaction);
router.post('/transactions/batch', InternalController.createBatchTransaction); 
router.post('/transactions/:id/void', requireAdmin, InternalController.voidTransaction); // 🔒 ADMIN ONLY

// 📊 Analytics & Stats
router.get('/stats', StatsController.getGlobalStats);
router.get('/analytics', DashboardController.getInternalAnalytics);

// 👥 CLIENTS (BIG DATA OPTIMIZED)
router.get('/clients', InternalClientController.searchClients);
router.post('/clients', InternalClientController.createClient);
router.get('/clients/:id/details', InternalClientController.getClientDetails); 
router.get('/clients/:id/history', InternalClientController.getClientHistory); 
router.get('/clients/:id/statement', InternalClientController.getClientStatement); 
router.post('/clients/:id/payment', InternalClientController.registerPayment); 
router.post('/clients/:id/legacy-debt', requireAdmin, InternalClientController.importLegacyDebt);
router.put('/clients/:id', requireAdmin, InternalClientController.updateClient); // 🔒 ADMIN ONLY
router.delete('/clients/:id', requireAdmin, InternalClientController.deleteClient); // 🔒 ADMIN ONLY
// 🚛 INTERNAL SUPPLIERS (SILO B)
// Anyone logged in can view suppliers, but only Admin can create
router.get('/suppliers', InternalPurchaseController.getSuppliers);
router.post('/suppliers', requireAdmin, InternalPurchaseController.createSupplier);

// 🛒 INTERNAL PURCHASES / EXPENSES (SILO B)
// Logic mirrors the legal side but stays strictly in the internal DB
router.get('/purchases', InternalPurchaseController.getPurchaseHistory);
router.post('/purchases', InternalPurchaseController.createPurchase);

export default router;