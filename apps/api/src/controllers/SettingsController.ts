// apps/api/src/controllers/SettingsController.ts
import { Request, Response } from 'express';
import { prismaLegal } from '@marine/db-legal';
import { BackupService } from '../services/BackupService';
import path from 'path';
import fs from 'fs';

export const SettingsController = {
    // ==========================================
    // ⚙️ COMPANY SETTINGS 
    // ==========================================
    getSettings: async (req: Request, res: Response) => {
        try {
            let settings = await prismaLegal.companySettings.findUnique({ where: { id: "1" } });
            
            if (!settings) {
                settings = await prismaLegal.companySettings.create({
                    data: { 
                        id: "1", 
                        name: "MON ENTREPRISE", 
                        ice: "000000000",
                        address: "Adresse par défaut",
                        phone: "+212 6 00 00 00 00"
                    }
                });
            }
            res.json(settings);
        } catch (error) {
            console.error("Settings Load Error:", error);
            res.status(500).json({ error: "Erreur chargement paramètres" });
        }
    },

    updateSettings: async (req: Request, res: Response) => {
        try {
            const data = req.body;
            const settings = await prismaLegal.companySettings.upsert({
                where: { id: "1" },
                update: {
                    name: data.name,
                    ice: data.ice,
                    address: data.address,
                    phone: data.phone,
                    email: data.email,
                    logoUrl: data.logoUrl
                },
                create: {
                    id: "1",
                    name: data.name || "MON ENTREPRISE",
                    ice: data.ice,
                    address: data.address,
                    phone: data.phone,
                    email: data.email
                }
            });
            res.json(settings);
        } catch (error) {
            console.error("Settings Save Error:", error);
            res.status(500).json({ error: "Erreur sauvegarde" });
        }
    },

    // ==========================================
    // 💾 TWIN-SILO BACKUP ENGINE
    // ==========================================
    downloadBackup: async (req: Request, res: Response) => {
        try {
            // The routing layer (legal.ts) already ensures only SUPER_ADMIN reaches here
            const zipPath = await BackupService.performBackup();
            const fileName = path.basename(zipPath);

            // Stream the file directly to the admin's browser
            res.download(zipPath, fileName, (err) => {
                if (err) {
                    console.error("❌ Download stream failed:", err);
                }
                
                // Optional: Delete the zip after successful download to save server space
                // Since this is a critical system, we will keep the backups on disk 
                // but you can uncomment the next line to auto-delete:
                // if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath); 
            });

        } catch (error: any) {
            console.error("❌ Backup Generation Error:", error);
            res.status(500).json({ error: error.message || "Erreur critique lors de la génération de la sauvegarde." });
        }
    }
};