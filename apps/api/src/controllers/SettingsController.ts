import { Request, Response } from 'express';
import { prismaLegal } from '@marine/db-legal';

export const SettingsController = {
    // Get Company Settings (Singleton ID: "1")
    getSettings: async (req: Request, res: Response) => {
        try {
            let settings = await prismaLegal.companySettings.findUnique({ where: { id: "1" } });
            
            // Auto-create if not exists
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

    // Update Settings
    updateSettings: async (req: Request, res: Response) => {
        try {
            const data = req.body;
            // Upsert ensures safety if DB was wiped
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
    }
};