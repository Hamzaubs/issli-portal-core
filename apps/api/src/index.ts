// apps/api/src/index.ts
import 'dotenv/config'; 
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet'; 
import rateLimit from 'express-rate-limit'; 

import authRoutes from './routes/auth'; 
import dashboardRoutes from './routes/dashboard';
import legalRoutes from './routes/legal'; 
import clientRoutes from './routes/clients'; 
import internalRoutes from './routes/internal'; 
import supplierRoutes from './routes/supplier';
import purchaseRoutes from './routes/purchase';

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// 🛡️ SECURITY & ZERO-TRUST LAYER
// ==========================================
app.use(helmet());

// 🛑 Enterprise CORS Whitelist
const allowedOrigins = [
    'http://localhost:5173', 
    'http://localhost:3000', 
    process.env.FRONTEND_URL || 'https://issli-portal-core-web-ui.vercel.app' 
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.warn(`[CORS BLOCKED] Unauthorized access attempt from: ${origin}`);
            callback(new Error('Accès refusé par la politique CORS (Zero-Trust)'));
        }
    },
    credentials: true, 
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 1000, 
    standardHeaders: true,
    legacyHeaders: false,
    message: "Trop de requêtes, veuillez patienter."
});
app.use(limiter);

app.use(express.json());

// ==========================================
// 🚪 PORTAL GATEWAYS & ROUTES
// ==========================================

app.use('/api/auth', authRoutes);
app.use('/api/legal', legalRoutes); 
app.use('/api/clients', clientRoutes); 
app.use('/api/suppliers', supplierRoutes); 
app.use('/api/purchases', purchaseRoutes); 
app.use('/api/internal', internalRoutes); 
app.use('/api/dashboard', dashboardRoutes); 

// ==========================================
// 🚨 GLOBAL ERROR INTERCEPTOR (THE SHIELD)
// ==========================================
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error(`[GLOBAL ERROR] ${req.method} ${req.url} ->`, err.message);

    // Prisma-specific error handling
    if (err.code === 'P2002') {
        return res.status(409).json({ error: "Conflit : Cette donnée existe déjà (Nom, Téléphone, ou ICE en doublon)." });
    }
    if (err.code === 'P2003') {
        return res.status(403).json({ error: "Action refusée : Cette ressource est liée à d'autres documents dans l'historique." });
    }
    if (err.code === 'P2025') {
        return res.status(404).json({ error: "La ressource demandée est introuvable ou a déjà été supprimée." });
    }
    
    // CORS Error fallback
    if (err.message.includes('CORS')) {
        return res.status(403).json({ error: "Accès refusé : Origine non autorisée." });
    }

    // Generic server fallback
    res.status(500).json({ error: "Erreur interne du serveur. Veuillez contacter l'administrateur." });
});

// ==========================================
// 🚀 SERVER IGNITION
// ==========================================
app.listen(PORT, () => {
  console.log(`✅ API PORTAIL ISSLI EN LIGNE : http://localhost:${PORT}`);
  console.log(`🛡️ Statut : SÉCURITÉ ZÉRO-CONFIANCE ACTIVE (Limiteur de requêtes, Bouclier Contextuel & Intercepteur d'erreurs)`);
});