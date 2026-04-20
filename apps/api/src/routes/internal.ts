// apps/api/src/routes/internal.ts
import { Router } from 'express';
import { InternalController } from '../controllers/InternalController';
import { StatsController } from '../controllers/StatsController';
import { InternalClientController } from '../controllers/InternalClientController'; 
import { DashboardController } from '../controllers/DashboardController';
import { InternalPurchaseController } from '../controllers/InternalPurchaseController';

// 🛡️ SECURITY IMPORTS
import { authenticateToken } from '../middleware/AuthMiddleware';
import { requireAdmin, requirePosAccess } from '../middleware/RoleMiddleware'; 

const router = Router();

// 🛑 SECURITY FIX: Globally lock this entire router to POS/Admin Context
router.use(authenticateToken, requirePosAccess);

// 📦 Products
router.get('/products', InternalController.getProducts); 
router.post('/products', requireAdmin, InternalController.createProduct); 
router.put('/products/:id', requireAdmin, InternalController.updateProduct); 
router.delete('/products/:id', requireAdmin, InternalController.deleteProduct); 
router.post('/products/batch-import', requireAdmin, InternalController.importBatchProducts);
router.post('/inventory/adjust', requireAdmin, InternalController.adjustInventoryBatch); 

// 💰 Transactions
router.get('/transactions', InternalController.getTransactions);
router.post('/transactions', InternalController.createTransaction);
router.post('/transactions/batch', InternalController.createBatchTransaction); 
router.post('/transactions/:id/void', requireAdmin, InternalController.voidTransaction); 

// 📊 Analytics & Stats (🚨 CRITICAL SECURITY LEAK CLOSED)
router.get('/stats', requireAdmin, StatsController.getGlobalStats);
router.get('/analytics', requireAdmin, DashboardController.getInternalAnalytics);
router.get('/till', requirePosAccess, DashboardController.getDailyTill);
// 👥 CLIENTS
router.get('/clients', InternalClientController.searchClients);
router.post('/clients', InternalClientController.createClient);
router.get('/clients/:id/details', InternalClientController.getClientDetails); 
router.get('/clients/:id/history', InternalClientController.getClientHistory); 
router.get('/clients/:id/statement', InternalClientController.getClientStatement); 
router.post('/clients/:id/payment', InternalClientController.registerPayment); 
router.post('/clients/:id/legacy-debt', requireAdmin, InternalClientController.importLegacyDebt);
router.put('/clients/:id', requireAdmin, InternalClientController.updateClient); 
router.delete('/clients/:id', requireAdmin, InternalClientController.deleteClient); 

// 🚛 INTERNAL SUPPLIERS 
router.get('/suppliers', InternalPurchaseController.getSuppliers);
router.post('/suppliers', requireAdmin, InternalPurchaseController.createSupplier);
router.post('/suppliers/:id/payment', requireAdmin, InternalPurchaseController.registerPayment);
// 🛡️ SECURITY FIX: Supplier financial history should be Admin only
router.get('/suppliers/:id/statement', requireAdmin, InternalPurchaseController.getSupplierStatement);
router.delete('/suppliers/:id', requireAdmin, InternalPurchaseController.deleteSupplier);
router.post('/suppliers/:id/legacy-debt', requireAdmin, InternalPurchaseController.addLegacyDebt);

// 🛒 INTERNAL PURCHASES
router.get('/purchases', InternalPurchaseController.getPurchaseHistory);
router.post('/purchases', InternalPurchaseController.createPurchase);
router.post('/purchases/:id/void', requireAdmin, InternalPurchaseController.voidPurchase);

export default router;