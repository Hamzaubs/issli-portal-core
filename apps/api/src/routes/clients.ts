// apps/api/src/routes/clients.ts
import { Router } from 'express';
import { ClientsController } from '../controllers/ClientsController';
import { authenticateToken } from '../middleware/AuthMiddleware';
import { requireLegalAccess } from '../middleware/RoleMiddleware';

const router = Router();

// 🛑 SECURITY FIX: Lock entire route
router.use(authenticateToken, requireLegalAccess);

router.get('/', ClientsController.getClients);
router.get('/:id/global-details', ClientsController.getClientDetailsGlobal);
router.get('/:id/history', ClientsController.getClientHistory);
router.post('/', ClientsController.createClientGlobal);
router.put('/:id', ClientsController.updateClientGlobal);
router.delete('/:id', ClientsController.deleteClientGlobal);

export default router;