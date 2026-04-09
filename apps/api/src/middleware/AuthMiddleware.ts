// apps/api/src/middleware/AuthMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// 🛡️ Explicitly define and export the Request interface
export interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
    role: 'SUPER_ADMIN' | 'LEGAL_USER' | 'POS_USER';
    portal: 'ADMIN' | 'LEGAL' | 'POS'; // The strict context we added in AuthController
  };
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: "Authentification requise (Token manquant)" });
  }

  // ✅ SECURITY FIX: Enforce Environment Variable
  const secret = process.env.JWT_SECRET;
  if (!secret) {
      console.error("🚨 CRITICAL SECURITY ERROR: JWT_SECRET is not defined in .env");
      return res.status(500).json({ error: "Erreur configuration serveur" });
  }

  jwt.verify(token, secret, (err: any, decodedUser: any) => {
    if (err) {
      console.error("❌ Invalid Token:", err.message);
      return res.status(403).json({ error: "Session expirée ou invalide" });
    }

    req.user = decodedUser; 
    next();
  });
};