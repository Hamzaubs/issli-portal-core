// web-ui/src/components/ClientsDebtPage.tsx
import React, { useState, useEffect } from 'react';
import { 
    Search, User, Phone, MapPin, 
    ArrowLeft, Coins, CheckCircle, 
    Wallet, X
} from 'lucide-react';
import client from '../api/client'; 

interface ClientB {
    id: string;
    name: string;
    phone?: string;
    city?: string;
    balance: number; // Positive = Debt
    totalSpent: number;
    history?: any[];
}

export const ClientsDebtPage = ({ onBack }: { onBack: () => void }) => {
    const [clients, setClients] = useState<ClientB[]>([]);
    const [selectedClient, setSelectedClient] = useState<ClientB | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    
    // Payment Modal
    const [paymentModalData, setPaymentModalData] = useState<{id: string, name: string, balance: number} | null>(null);
    const [paymentAmount, setPaymentAmount] = useState('');

    useEffect(() => { fetchClients(); }, []);

    const fetchClients = async () => {
        setIsLoading(true);
        try {
            // ✅ Silo B Endpoint
            const res = await client.get('/internal/clients');
            setClients(res.data);
            
            if (selectedClient) {
                const updated = res.data.find((c: ClientB) => c.id === selectedClient.id);
                if (updated) handleSelectClient(updated);
            }
        } catch (error) { console.error("Error fetching clients", error); }
        finally { setIsLoading(false); }
    };

    const handleSelectClient = async (c: ClientB) => {
        try {
            const res = await client.get(`/internal/clients/${c.id}/details`);
            // Combine list data with detailed history
            setSelectedClient({ 
                ...c, 
                history: [...(res.data.history.internal || []), ...(res.data.history.payments || [])]
                    .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()) 
            });
        } catch (err) { console.error(err); }
    };

    const handlePayment = async () => {
        if (!paymentModalData || !paymentAmount) return;
        try {
            await client.post(`/internal/payments`, {
                clientId: paymentModalData.id,
                amount: parseFloat(paymentAmount),
                method: 'ESPECES',
                note: 'Réglement via Dashboard Dettes'
            });
            setPaymentModalData(null);
            setPaymentAmount('');
            fetchClients(); // Refresh global list
        } catch (err: any) { alert("Erreur: " + err.response?.data?.error); }
    };

    const formatMAD = (n: number) => new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(n);
    const filteredClients = clients.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));
    const sortedClients = filteredClients.sort((a, b) => Number(b.balance) - Number(a.balance));

    return (
        <div className="flex h-screen bg-slate-100 overflow-hidden">
            
            {/* LEFT: Client List */}
            <div className="w-1/3 bg-white border-r border-slate-200 flex flex-col z-10">
                <div className="p-5 border-b border-slate-100 bg-slate-50">
                    <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-blue-600 font-bold text-sm mb-4 transition-colors">
                        <ArrowLeft size={16}/> Retour STOCK B
                    </button>
                    <h1 className="text-2xl font-black text-slate-800 mb-1">Dettes Clients (STOCK B)</h1>
                    <div className="mt-4 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                        <input type="text" placeholder="Rechercher..." className="w-full pl-10 p-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-100" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {sortedClients.map(c => (
                        <button key={c.id} onClick={() => handleSelectClient(c)} className={`w-full p-4 border-b border-slate-50 flex justify-between items-center hover:bg-slate-50 transition-all text-left ${selectedClient?.id === c.id ? 'bg-blue-50 border-blue-100' : ''}`}>
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs ${Number(c.balance) > 1 ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'}`}>{c.name.substring(0,2).toUpperCase()}</div>
                                <div><div className="font-bold text-sm text-slate-700">{c.name}</div><div className="text-[11px] text-slate-400">{c.city || '-'}</div></div>
                            </div>
                            <div className="text-right">
                                {Number(c.balance) > 1 ? (
                                    <div><span className="text-red-600 font-black text-sm">{formatMAD(Number(c.balance))}</span><br/><span className="text-[9px] font-bold text-red-400 bg-red-50 px-1.5 rounded">DÛ</span></div>
                                ) : (
                                    <span className="text-emerald-600 font-bold text-xs bg-emerald-50 px-2 py-1 rounded-full flex items-center gap-1"><CheckCircle size={10}/> Ok</span>
                                )}
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* RIGHT: Details & Payment */}
            <div className="flex-1 flex flex-col bg-slate-100 relative">
                {selectedClient ? (
                    <>
                        <div className="bg-white p-8 border-b border-slate-200 shadow-sm flex justify-between items-start">
                            <div className="flex gap-5">
                                <div className="w-16 h-16 rounded-2xl bg-slate-900 text-white flex items-center justify-center text-xl font-bold shadow-lg">{selectedClient.name.substring(0,2).toUpperCase()}</div>
                                <div>
                                    <h2 className="text-3xl font-black text-slate-800">{selectedClient.name}</h2>
                                    <div className="flex gap-4 mt-2 text-sm text-slate-500 font-medium">
                                        {selectedClient.phone && <span className="flex items-center gap-1"><Phone size={14}/> {selectedClient.phone}</span>}
                                        {selectedClient.city && <span className="flex items-center gap-1"><MapPin size={14}/> {selectedClient.city}</span>}
                                    </div>
                                </div>
                            </div>
                            <div className={`text-right p-4 rounded-xl border ${Number(selectedClient.balance) > 1 ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}>
                                <div className="text-xs font-bold uppercase tracking-wider opacity-60 mb-1">Reste à Payer Global</div>
                                <div className={`text-3xl font-black ${Number(selectedClient.balance) > 1 ? 'text-red-600' : 'text-emerald-600'}`}>{formatMAD(Number(selectedClient.balance))}</div>
                                {Number(selectedClient.balance) > 1 && (
                                    <button onClick={() => setPaymentModalData({ id: selectedClient.id, name: selectedClient.name, balance: Number(selectedClient.balance) })} className="mt-3 w-full py-2 bg-red-600 text-white font-bold text-xs rounded-lg hover:bg-red-700 flex items-center justify-center gap-2"><Coins size={14}/> Encaisser</button>
                                )}
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8">
                            <h3 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2"><Wallet className="text-blue-500"/> Historique Mouvements (STOCK B)</h3>
                            <div className="space-y-3">
                                {(selectedClient.history || []).map((item: any, i: number) => (
                                    <div key={i} className="bg-white p-4 rounded-xl border border-slate-200 flex justify-between items-center hover:shadow-sm">
                                            <div className="flex gap-4 items-center">
                                                <div className="bg-slate-50 p-2 rounded text-center min-w-[60px]">
                                                    <div className="text-xs text-slate-400 uppercase">{new Date(item.date).toLocaleDateString('fr-MA', {month:'short'})}</div>
                                                    <div className="text-lg font-black text-slate-700">{new Date(item.date).getDate()}</div>
                                                </div>
                                                <div>
                                                    <div className="text-sm font-bold text-slate-900">{item.type || (item.product ? 'ACHAT' : 'PAIEMENT')}</div>
                                                    <div className="text-xs text-slate-500">{item.product ? item.product.name : (item.method || 'Réglement')}</div>
                                                </div>
                                            </div>
                                            <div className={`font-bold ${item.amount < 0 || item.method ? 'text-emerald-600' : 'text-slate-800'}`}>
                                                {item.method ? `- ${formatMAD(item.amount)}` : formatMAD(item.amount)}
                                            </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-300"><User size={64} strokeWidth={1} className="mb-4"/><p className="text-lg font-medium">Sélectionnez un client</p></div>
                )}
            </div>

            {paymentModalData && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
                        <div className="flex justify-between items-center mb-6"><h3 className="font-bold text-xl text-slate-800">Encaissement Dette</h3><button onClick={() => setPaymentModalData(null)}><X className="text-slate-400 hover:text-slate-600"/></button></div>
                        <div className="mb-6"><label className="text-xs font-bold text-slate-400 uppercase ml-1">Montant Reçu</label><input autoFocus type="number" className="w-full mt-1 p-3 border border-blue-200 rounded-xl text-xl font-bold text-slate-800 outline-none" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} /></div>
                        <button onClick={handlePayment} className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg">Confirmer</button>
                    </div>
                </div>
            )}
        </div>
    );
};