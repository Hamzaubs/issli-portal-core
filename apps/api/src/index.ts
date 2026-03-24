import 'dotenv/config'; 
import express from 'express';
import cors from 'cors';
import helmet from 'helmet'; 
import rateLimit from 'express-rate-limit'; 
import dashboardRoutes from './routes/dashboard';
import legalRoutes from './routes/legal'; 
import authRoutes from './routes/auth'; 
import clientRoutes from './routes/clients'; 
import internalRoutes from './routes/internal'; // ✅ IMPORT NEW ROUTE

const app = express();
const PORT = process.env.PORT || 3000;

// === 🛡️ SECURITY LAYER ===
app.use(helmet());
app.use(cors()); 

// Rate Limiter
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 1000, 
    standardHeaders: true,
    legacyHeaders: false,
    message: "Trop de requêtes, veuillez patienter."
});
app.use(limiter);

app.use(express.json());

// === ROUTES ===
app.use('/api/auth', authRoutes);

// ✅ SILO A (Legal / Fiscal)
app.use('/api/legal', legalRoutes); 

// ✅ CLIENTS 
app.use('/api/clients', clientRoutes); 

// ✅ SILO B (Internal / Operations) - NEW DEDICATED ROUTE
// Directs traffic to the new "Safe Controller" logic
app.use('/api/internal', internalRoutes); 

// Legacy Dashboard (Global Stats)
app.use('/api/dashboard', dashboardRoutes); 

// 5. Server Start
app.listen(PORT, () => {
  console.log(`✅ MARINE ERP API: http://localhost:${PORT}`);
  console.log(`🛡️ Status: SECURE MODE (Rate Limit Active)`);
});