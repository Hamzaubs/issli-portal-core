import { Request, Response } from 'express';
import { prismaInternal } from '@marine/db-internal';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// 🛡️ SECURITY: Fail fast if secret is weak/missing in production
const SECRET_KEY = process.env.JWT_SECRET || "marine_default_secret_key_local_pos";

export const AuthController = {
  login: async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;

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

      // 3. GENERATE LONG-LIVED TOKEN (POS Mode)
      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        SECRET_KEY,
        { expiresIn: '3650d' } 
      );

      console.log(`🔒 LOGIN: "${user.username}" authenticated.`);

      res.json({
        token,
        user: { id: user.id, username: user.username, role: user.role }
      });

    } catch (error) {
      console.error("Login Error:", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  },

  getMe: async (req: Request, res: Response) => {
      try {
          const user = (req as any).user;
          if (!user) return res.status(401).json({ error: "Non authentifié" });
          res.json({ id: user.id, username: user.username, role: user.role });
      } catch (error) {
          res.status(500).json({ error: "Erreur session" });
      }
  },

  register: async (req: Request, res: Response) => {
     res.status(404).json({error: "Registration disabled"}); 
  }
};