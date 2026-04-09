// apps/api/src/index.ts
import 'dotenv/config'; 
import express from 'express';
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
    'http://localhost:5173', // For local React development
    'http://localhost:3000', // Alternative local port
    process.env.FRONTEND_URL || 'https://issli-portal-core-web-ui.vercel.app' // Production Web App
];

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (Mobile Apps, Postman, server-to-server) 
        // OR if the origin is explicitly in our whitelist.
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.warn(`[CORS BLOCKED] Unauthorized access attempt from: ${origin}`);
            callback(new Error('Accès refusé par la politique CORS (Zero-Trust)'));
        }
    },
    credentials: true, // Required if you ever switch to secure HTTP-only cookies
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate Limiter against brute-force
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

// 🔓 Public / Authentication
app.use('/api/auth', authRoutes);

// 🟦 SILO A: Bureau Légal (Tax Compliance)
// Access: SUPER_ADMIN & LEGAL_USER strictly.
app.use('/api/legal', legalRoutes); 
app.use('/api/clients', clientRoutes); 
app.use('/api/suppliers', supplierRoutes); 
app.use('/api/purchases', purchaseRoutes); 

// 🟩 SILO B: Magasin Interne (High-Velocity POS)
// Access: SUPER_ADMIN & POS_USER strictly.
app.use('/api/internal', internalRoutes); 

// 🌊 EXECUTIVE BRIDGE: Aggregation & God View
// Access: SUPER_ADMIN ONLY (Cross-Silo Read Access).
app.use('/api/dashboard', dashboardRoutes); 

// ==========================================
// 🚀 SERVER IGNITION
// ==========================================
app.listen(PORT, () => {
  console.log(`✅ API PORTAIL ISSLI EN LIGNE : http://localhost:${PORT}`);
  console.log(`🛡️ Statut : SÉCURITÉ ZÉRO-CONFIANCE ACTIVE (Limiteur de requêtes & Bouclier Contextuel)`);
});