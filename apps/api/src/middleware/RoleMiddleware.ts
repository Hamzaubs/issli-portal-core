import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth'; 

const checkUser = (req: AuthRequest, res: Response): boolean => {
  if (!req.user || !req.user.role) {
    res.status(401).json({ error: "Non authentifié" });
    return false;
  }
  return true;
};

// 1. SUPER ADMIN
export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!checkUser(req, res)) return;
  if (req.user!.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: "⛔ ACCÈS INTERDIT: Administrateur uniquement." });
  }
  next();
};

// 2. LEGAL ACCESS (Admin + Legal User)
export const requireLegalAccess = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!checkUser(req, res)) return;
  
  const allowed = ['SUPER_ADMIN', 'LEGAL_USER']; 
  if (!allowed.includes(req.user!.role)) {
    return res.status(403).json({ error: "⛔ ACCÈS RESTREINT: Réservé au Département Légal." });
  }
  next();
};

// 3. POS ACCESS (Admin + POS User)
export const requirePosAccess = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!checkUser(req, res)) return;
  
  const allowed = ['SUPER_ADMIN', 'POS_USER'];
  if (!allowed.includes(req.user!.role)) {
    return res.status(403).json({ error: "⛔ ACCÈS RESTREINT: Réservé au Point de Vente." });
  }
  next();
};