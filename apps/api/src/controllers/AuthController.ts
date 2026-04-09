// apps/api/src/controllers/AuthController.ts
import { Request, Response } from 'express';
import { prismaInternal } from '@marine/db-internal';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// 🛡️ SECURITY: Fail fast if secret is weak/missing in production
const SECRET_KEY = process.env.JWT_SECRET || "marine_default_secret_key_local_pos";

export const AuthController = {
  login: async (req: Request, res: Response) => {
    try {
      const { username, password, portal } = req.body;

      if (!portal || !['ADMIN', 'LEGAL', 'POS'].includes(portal)) {
          return res.status(400).json({ error: "Portail d'accès non spécifié ou invalide." });
      }

      // 1. Robust User Search (Case Insensitive)
      const user = await prismaInternal.user.findFirst({
        where: { 
          username: { equals: username, mode: 'insensitive' } 
        }
      });

      if (!user) {
        return res.status(401).json({ error: "Identifiants incorrects" });
      }

      // 2. Check Password
      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        return res.status(401).json({ error: "Identifiants incorrects" });
      }

      // 3. 🛡️ STRICT PORTAL-ROLE ENFORCEMENT (Backend Source of Truth)
      if (portal === 'ADMIN' && user.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ error: "Accès refusé : Ce portail est strictement réservé à la direction." });
      }
      if (portal === 'LEGAL' && !['SUPER_ADMIN', 'LEGAL_USER'].includes(user.role)) {
        return res.status(403).json({ error: "Accès refusé : Votre compte n'a pas accès au Bureau Légal (STOCK A)." });
      }
      if (portal === 'POS' && !['SUPER_ADMIN', 'POS_USER'].includes(user.role)) {
        return res.status(403).json({ error: "Accès refusé : Votre compte n'a pas accès au Magasin Interne (STOCK B)." });
      }

      // 4. GENERATE LONG-LIVED TOKEN
      // We embed the specific portal into the JWT context to prevent token reuse across portals
      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role, portal },
        SECRET_KEY,
        { expiresIn: '3650d' } 
      );

      console.log(`🔒 LOGIN SUCCESS: "${user.username}" authenticated securely on portal [${portal}].`);

      res.json({
        token,
        portal, // Return the validated portal confirmation
        user: { id: user.id, username: user.username, role: user.role }
      });

    } catch (error) {
      console.error("Login Error:", error);
      res.status(500).json({ error: "Erreur serveur lors de la connexion" });
    }
  },

  getMe: async (req: Request, res: Response) => {
      try {
          const user = (req as any).user;
          if (!user) return res.status(401).json({ error: "Non authentifié" });
          res.json({ id: user.id, username: user.username, role: user.role });
      } catch (error) {
          res.status(500).json({ error: "Erreur de validation de session" });
      }
  },

  register: async (req: Request, res: Response) => {
     res.status(403).json({error: "L'enregistrement public est désactivé sur ce système."}); 
  }
};