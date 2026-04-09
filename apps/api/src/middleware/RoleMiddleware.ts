// apps/api/src/middleware/RoleMiddleware.ts
import { Response, NextFunction } from 'express';
import { AuthRequest } from './AuthMiddleware'; 

const checkUser = (req: AuthRequest, res: Response): boolean => {
  if (!req.user || !req.user.role) {
    res.status(401).json({ error: "Non authentifié" });
    return false;
  }
  return true;
};

// ==========================================
// 1. SUPER ADMIN (God View Exemption)
// ==========================================
export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!checkUser(req, res)) return;
  
  if (req.user!.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: "⛔ ACCÈS INTERDIT: Administrateur uniquement." });
  }
  
  // Super Admin is exempted from strict portal context checks here to allow cross-silo aggregations.
  next();
};

// ==========================================
// 2. LEGAL ACCESS (Stock A - Silo A)
// ==========================================
export const requireLegalAccess = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!checkUser(req, res)) return;
  
  const { role, portal } = req.user!;
  const allowed = ['SUPER_ADMIN', 'LEGAL_USER']; 

  // Check 1: Role Verification
  if (!allowed.includes(role)) {
    return res.status(403).json({ error: "⛔ ACCÈS RESTREINT: Réservé au Département Légal." });
  }

  // Check 2: 🔐 Zero-Trust Context Guard (Cross-Silo Exploitation Prevention)
  if (role !== 'SUPER_ADMIN' && portal !== 'LEGAL') {
    return res.status(403).json({ error: "⛔ ANOMALIE DE SÉCURITÉ: Jeton d'accès invalide pour le contexte Légal." });
  }

  next();
};

// ==========================================
// 3. POS ACCESS (Stock B - Silo B)
// ==========================================
export const requirePosAccess = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!checkUser(req, res)) return;
  
  const { role, portal } = req.user!;
  const allowed = ['SUPER_ADMIN', 'POS_USER'];

  // Check 1: Role Verification
  if (!allowed.includes(role)) {
    return res.status(403).json({ error: "⛔ ACCÈS RESTREINT: Réservé au Point de Vente." });
  }

  // Check 2: 🔐 Zero-Trust Context Guard (Cross-Silo Exploitation Prevention)
  if (role !== 'SUPER_ADMIN' && portal !== 'POS') {
    return res.status(403).json({ error: "⛔ ANOMALIE DE SÉCURITÉ: Jeton d'accès invalide pour le contexte POS." });
  }

  next();
};