import { Request, Response } from 'express';
import { prismaLegal } from '@marine/db-legal';

export const ExpenseController = {
    // Get all expenses
    getExpenses: async (req: Request, res: Response) => {
        try {
            // 🛡️ CAST AS ANY: Forces TypeScript to ignore the missing type definition
            const expenses = await (prismaLegal as any).expense.findMany({ orderBy: { date: 'desc' } });
            res.json(expenses);
        } catch (e) { 
            console.error(e);
            res.status(500).json({ error: "Erreur chargement dépenses" }); 
        }
    },

    // Create a new expense
    createExpense: async (req: Request, res: Response) => {
        try {
            const { description, amount, date, category } = req.body;
            
            // 🛡️ CAST AS ANY
            const expense = await (prismaLegal as any).expense.create({
                data: {
                    description,
                    amount: Number(amount),
                    date: date ? new Date(date) : new Date(),
                    category: category || "AUTRE"
                }
            });
            res.json(expense);
        } catch (e) { 
            console.error(e);
            res.status(500).json({ error: "Erreur création dépense" }); 
        }
    },

    // Delete an expense
    deleteExpense: async (req: Request, res: Response) => {
        try {
            // 🛡️ CAST AS ANY
            await (prismaLegal as any).expense.delete({ where: { id: req.params.id } });
            res.json({ success: true });
        } catch (e) { 
            console.error(e);
            res.status(500).json({ error: "Erreur suppression" }); 
        }
    }
};