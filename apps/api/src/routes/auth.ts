import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';
// ✅ FIX: Ensure we import from the correct file (AuthMiddleware.ts)
import { authenticateToken } from '../middleware/AuthMiddleware'; 

const router = Router();

// Public Routes
router.post('/login', AuthController.login);
router.post('/register', AuthController.register); // ⚠️ Comment this out in production after creating staff

// Protected Routes (Requires Token)
// Used by Frontend to check if the user is still logged in
router.get('/me', authenticateToken, AuthController.getMe);

export default router;