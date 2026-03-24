import { Router } from 'express';
import { ClientsController } from '../controllers/ClientsController';
import { requireAuth } from '../middleware/auth';

const router = Router();

// ✅ GET / - List Clients (Paginated & Searchable)
router.get('/', requireAuth, ClientsController.getClients);

// ✅ GET /:id/global-details - Fast Profile 360° (Instant Load)
router.get('/:id/global-details', requireAuth, ClientsController.getClientDetailsGlobal);

// ✅ GET /:id/history - Infinite History (Cursor Based)
router.get('/:id/history', requireAuth, ClientsController.getClientHistory);

// ✅ CRUD Operations (Dual Write A+B)
router.post('/', requireAuth, ClientsController.createClientGlobal);
router.put('/:id', requireAuth, ClientsController.updateClientGlobal);
router.delete('/:id', requireAuth, ClientsController.deleteClientGlobal);

export default router;