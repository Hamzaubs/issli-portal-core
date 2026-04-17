// apps/api/src/middleware/AuthMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// 🛡️ Explicitly define and export the Request interface
export interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
    role: 'SUPER_ADMIN' | 'LEGAL_USER' | 'POS_USER';
    portal: 'ADMIN' | 'LEGAL' | 'POS'; 
  };
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  
  // 🚨 SECURITY FIX: Strict Bearer Format Enforcement (Prevents malformed string crashes)
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: "Authentification requise (Format Bearer invalide ou manquant)" });
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: "Authentification requise (Jeton introuvable)" });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
      console.error("🚨 CRITICAL SECURITY ERROR: JWT_SECRET is not defined in .env");
      return res.status(500).json({ error: "Erreur de configuration serveur" });
  }

  jwt.verify(token, secret, (err: any, decodedUser: any) => {
    if (err) {
      // Return 401 instead of 403 for expired/invalid signatures, as 401 correctly triggers frontend logout logic
      console.warn(`[AUTH GUARD] Rejet du jeton: ${err.message}`);
      return res.status(401).json({ error: "Session expirée ou jeton invalide. Veuillez vous reconnecter." });
    }

    // 🛡️ Ensure the payload actually contains the minimum required fields
    if (!decodedUser.id || !decodedUser.role || !decodedUser.portal) {
        return res.status(403).json({ error: "Jeton d'accès corrompu (Payload incomplet)." });
    }

    req.user = decodedUser; 
    next();
  });
};