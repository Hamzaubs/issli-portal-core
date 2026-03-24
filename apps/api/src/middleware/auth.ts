import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const SECRET_KEY = process.env.JWT_SECRET || "marine_default_secret_key_local_pos";

export interface AuthRequest extends Request {
    user?: {
        id: string;
        username: string;
        role: string;
    }
}

// 1. Basic Auth Verification
export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Token manquant" });

    const token = authHeader.split(' ')[1]; 
    if (!token) return res.status(401).json({ error: "Format token invalide" });

    const decoded = jwt.verify(token, SECRET_KEY) as any;
    (req as AuthRequest).user = decoded;
    
    next();
  } catch (error) {
    return res.status(401).json({ error: "Session expirée" });
  }
};