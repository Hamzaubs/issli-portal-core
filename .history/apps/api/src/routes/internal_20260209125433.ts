import { Router } from 'express';
import { InternalController } from '../controllers/InternalController';
import { StatsController } from '../controllers/StatsController';
import { InternalClientController } from '../controllers/InternalClientController'; // ✅ IMPORT
import { authenticateToken } from '../middleware/AuthMiddleware';

const router = Router();

router.use(authenticateToken);

// ... (Keep existing Products, Transactions, Stats routes) ...

// 👥 CLIENTS (BIG DATA OPTIMIZED)
router.get('/clients', InternalClientController.searchClients);
router.post('/clients', InternalClientController.createClient);
router.put('/clients/:id', InternalClientController.updateClient);
router.delete('/clients/:id', InternalClientController.deleteClient);

export default router;