// web-ui/src/components/MovementHistory.tsx
import React, { useEffect, useState } from 'react';
import { 
    RefreshCw, ArrowUpRight, ArrowDownLeft, RotateCcw, 
    User, FileText, Banknote, Printer, Search, Calendar, 
    ChevronLeft, ChevronRight, FilterX, Trash2, X, 
    ChevronDown, ChevronUp, Package
} from 'lucide-react';
import client from '../api/client';
import { InternalDeliveryNote } from './InternalDeliveryNote';

interface MovementItem {
    id: string; 
    productName: string;
    sku: string;
    quantity: number;
    returnedQuantity: number;
    measureUnit: string;
    unitPrice: number;
    total: number;
}

interface MovementGroup {
    groupId: string;
    id: string; 
    type: string;
    date: string;
    clientName: string;
    paymentMethod: string;
    paymentRef: string;
    userName: string;
    items: MovementItem[];
    totalAmount: number;
    paid: number;
}

export const MovementHistory = () => {
    const currentUser = JSON.parse(localStorage.getItem('marine_user') || '{}');
    const isAdmin = currentUser.role === 'SUPER_ADMIN';

    const [groups, setGroups] = useState<MovementGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [printTicketData, setPrintTicketData] = useState<any>(null);

    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);
    const limit = 50; 

    const [search, setSearch] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const [returnModal, setReturnModal] = useState<{isOpen: boolean, item: MovementItem | null, qty: number, parentType: string}>({ 
        isOpen: false, item: null, qty: 1, parentType: ''
    });

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(), limit: limit.toString(),
                ...(search && { search }), ...(startDate && { startDate }), ...(endDate && { endDate })
            });
            const res = await client.get(`/internal/transactions?${params.toString()}`);
            setGroups(res.data.data); 
            setTotalPages(res.data.meta.totalPages);
            setTotalRecords(res.data.meta.total);
        } catch (e) { 
            console.error("History error", e); 
        } finally { 
            setLoading(false); 
        }
    };

    useEffect(() => {
        const timeoutId = setTimeout(() => { setPage(1); fetchHistory(); }, 500);
        return () => clearTimeout(timeoutId);
    }, [search, startDate, endDate]);

    useEffect(() => { fetchHistory(); }, [page]);

    const resetFilters = () => { setSearch(''); setStartDate(''); setEndDate(''); setPage(1); };

    const formatMAD = (val: any) => {
        let num = 0;
        if (val !== null && val !== undefined) {
            if (typeof val === 'object') {
                num = Number(val.toString());
            } else if (typeof val === 'string') {
                num = Number(val.replace(/[^0-9.-]+/g, ""));
            } else {
                num = Number(val);
            }
        }
        if (isNaN(num)) num = 0;
        return new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
    };

    const toggleExpand = (groupId: string) => {
        const newSet = new Set(expandedGroups);
        if (newSet.has(groupId)) newSet.delete(groupId);
        else newSet.add(groupId);
        setExpandedGroups(newSet);
    };

    const handleSubmitReturn = async () => {
        if (!returnModal.item) return;
        try {
            await client.post(`/internal/transactions/${returnModal.item.id}/void`, { returnQty: returnModal.qty });
            alert("✅ Retour enregistré avec succès.");
            setReturnModal({ isOpen: false, item: null, qty: 1, parentType: '' });
            fetchHistory();
        } catch (error: any) { alert("Erreur: " + (error.response?.data?.error || "Erreur serveur")); }
    };

    const handleDeleteDevis = async (item: MovementItem) => {
        if (!window.confirm(`Voulez-vous supprimer ce devis ?`)) return;
        try {
            await client.post(`/internal/transactions/${item.id}/void`);
            fetchHistory();
        } catch (error: any) { alert("Erreur suppression devis."); }
    };

    const handlePrintGroup = (g: MovementGroup) => {
        setPrintTicketData({
            id: g.id,
            isQuote: g.type === 'QUOTE',
            isReturn: g.type === 'RETURN',
            date: new Date(g.date),
            clientName: g.clientName,
            paymentMethod: g.paymentMethod,
            paymentRef: g.paymentRef,
            items: g.items,
            total: g.totalAmount
        });
    };

    const getTypeBadge = (type: string) => {
        switch (type) {
            case 'SALE':
            case 'SALE_CASH': 
            case 'SALE_CREDIT': return <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-50 text-blue-700 text-xs font-bold uppercase"><ArrowUpRight size={12}/> Vente</span>;
            case 'RETURN': return <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-50 text-red-700 text-xs font-bold uppercase"><RotateCcw size={12}/> Retour</span>;
            case 'RESTOCK': return <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-50 text-emerald-700 text-xs font-bold uppercase"><ArrowDownLeft size={12}/> Arrivage</span>;
            case 'QUOTE': return <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-amber-50 text-amber-700 text-xs font-bold uppercase"><FileText size={12}/> Devis</span>;
            case 'ADJUSTMENT': return <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-orange-50 text-orange-700 text-xs font-bold uppercase"><Package size={12}/> Ajustement</span>;
            case 'PAYMENT': return <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-purple-50 text-purple-700 text-xs font-bold uppercase"><Banknote size={12}/> Paiement</span>;
            default: return <span className="px-2 py-1 rounded bg-slate-100 text-slate-500 text-xs font-bold uppercase">{type}</span>;
        }
    };

    const getDocumentTitle = (type: string) => {
        if (type === 'QUOTE') return 'Devis';
        if (type === 'RETURN') return "Bon d'Avoir";
        return 'Bon de Livraison';
    };

    return (
        <div className="h-full flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden relative pb-16">
            <div className="p-4 border-b border-slate-100 flex flex-col gap-4 bg-slate-50 shrink-0">
                <div className="flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        Historique Mouvements 
                        <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full uppercase tracking-wide">STOCK GLOBAL</span>
                        <span className="ml-2 text-xs text-slate-400 font-normal">({totalRecords} documents)</span>
                    </h3>
                    <button onClick={fetchHistory} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors">
                        <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                    </button>
                </div>

                <div className="flex flex-wrap gap-3 items-center">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                        <input type="text" placeholder="Rechercher (Réf, Client, Produit)..." className="w-full pl-10 p-2 text-sm bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500" value={search} onChange={(e) => setSearch(e.target.value)} />
                    </div>
                    
                    <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-1">
                        <Calendar className="text-slate-400 ml-2" size={16}/>
                        <input type="date" className="p-1 text-sm outline-none bg-transparent text-slate-600" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                        <span className="text-slate-300">-</span>
                        <input type="date" className="p-1 text-sm outline-none bg-transparent text-slate-600" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                    </div>

                    {(search || startDate || endDate) && (
                        <button onClick={resetFilters} className="text-xs font-bold text-red-500 hover:text-red-700 flex items-center gap-1 bg-red-50 px-2 py-1.5 rounded-lg border border-red-100 transition-colors">
                            <FilterX size={14}/> Effacer
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-white text-slate-500 font-bold sticky top-0 z-10 border-b border-slate-100 shadow-sm">
                        <tr>
                            <th className="p-4">Date / Réf</th>
                            <th className="p-4">Type / Paiement</th>
                            <th className="p-4">Désignation</th>
                            <th className="p-4">Client</th>
                            <th className="p-4 text-center">Qté</th>
                            <th className="p-4 text-right">Montant</th>
                            <th className="p-4 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {loading && groups.length === 0 ? (
                            <tr><td colSpan={7} className="p-8 text-center text-slate-400">Chargement...</td></tr> 
                        ) : groups.length === 0 ? (
                            <tr><td colSpan={7} className="p-8 text-center text-slate-400">Aucun historique trouvé.</td></tr>
                        ) : groups.map((g) => {
                            const isExpanded = expandedGroups.has(g.groupId);
                            const isMulti = g.items.length > 1;
                            const isReturn = g.type === 'RETURN';
                            
                            const canReturnParent = !isMulti && g.type !== 'QUOTE' && (g.items[0]?.quantity > (g.items[0]?.returnedQuantity || 0));

                            return (
                                <React.Fragment key={g.groupId}>
                                    <tr className={`transition-colors hover:bg-slate-50 ${isMulti ? 'bg-slate-50/50 cursor-pointer' : ''}`} 
                                        onClick={() => isMulti && toggleExpand(g.groupId)}>
                                        <td className="p-4 text-slate-500 font-mono text-xs">
                                            {new Date(g.date).toLocaleString('fr-MA')}
                                            <div className="text-[10px] text-slate-400 mt-1">{g.id}</div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-col gap-1 items-start">
                                                {getTypeBadge(g.type)}
                                                {g.paymentMethod && (
                                                    <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold uppercase border border-slate-200">
                                                        {g.paymentMethod} {g.paymentRef && g.paymentRef !== g.id ? ` - ${g.paymentRef}` : ''}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            {isMulti ? (
                                                <div className="flex items-center gap-2">
                                                    {isExpanded ? <ChevronUp size={16} className="text-blue-500"/> : <ChevronDown size={16} className="text-slate-400"/>}
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-slate-700">{getDocumentTitle(g.type)}</span>
                                                        <span className="text-[10px] text-blue-500 font-bold bg-blue-50 px-1.5 py-0.5 rounded w-fit mt-0.5">{g.items.length} articles inclus</span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-slate-700">{g.items[0]?.productName || '-'}</span>
                                                    <span className="text-[10px] text-slate-400 font-mono">{g.items[0]?.sku || '-'}</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4 text-slate-600 font-bold">
                                            {g.clientName !== '-' ? <span className="flex items-center gap-1.5 text-blue-900 bg-blue-50 px-2 py-1 rounded w-fit text-xs"><User size={12}/> {g.clientName}</span> : '-'}
                                        </td>
                                        <td className="p-4 text-center font-black text-slate-800">
                                            {isMulti ? '-' : (
                                                <>
                                                    {g.items[0]?.quantity || 0} {g.items[0]?.measureUnit || ''}
                                                    {g.items[0]?.returnedQuantity > 0 && <span className="block text-[10px] text-red-500 font-bold mt-1">(Ret: {g.items[0].returnedQuantity})</span>}
                                                </>
                                            )}
                                        </td>
                                        <td className={`p-4 text-right font-bold ${isReturn || g.totalAmount < 0 ? 'text-red-500' : 'text-slate-700'}`}>
                                            {formatMAD(g.totalAmount)}
                                        </td>
                                        <td className="p-4 text-right flex justify-end gap-2" onClick={e => e.stopPropagation()}>
                                            <button onClick={() => handlePrintGroup(g)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Imprimer Document"><Printer size={16}/></button>
                                            
                                            {!isReturn && isAdmin && !isMulti && (
                                                g.type === 'QUOTE' ? (
                                                    <button onClick={() => handleDeleteDevis(g.items[0])} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16}/></button>
                                                ) : (
                                                    canReturnParent && (
                                                        <button onClick={() => setReturnModal({ isOpen: true, item: g.items[0], qty: 1, parentType: g.type })} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Faire un retour">
                                                            <RotateCcw size={16}/>
                                                        </button>
                                                    )
                                                )
                                            )}
                                            {!isReturn && isAdmin && isMulti && (
                                                <button onClick={() => toggleExpand(g.groupId)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Dérouler pour retourner">
                                                    <RotateCcw size={16}/>
                                                </button>
                                            )}
                                        </td>
                                    </tr>

                                    {isMulti && isExpanded && g.items.map((sub: MovementItem) => (
                                        <tr key={sub.id} className="bg-slate-50/80 border-l-4 border-l-blue-400">
                                            <td colSpan={2} className="p-4 border-t border-slate-200/50"></td>
                                            <td className="p-4 border-t border-slate-200/50">
                                                <div className="text-sm font-bold text-slate-600">↳ {sub.productName}</div>
                                                <div className="text-[10px] text-slate-400 font-mono">{sub.sku}</div>
                                            </td>
                                            <td className="p-4 border-t border-slate-200/50"></td>
                                            <td className="p-4 text-center font-bold text-slate-600 border-t border-slate-200/50">
                                                {sub.quantity} {sub.measureUnit}
                                                {sub.returnedQuantity > 0 && <span className="block text-[10px] text-red-500 font-bold mt-1">(Ret: {sub.returnedQuantity})</span>}
                                            </td>
                                            <td className="p-4 text-right font-bold text-slate-600 border-t border-slate-200/50">{formatMAD(sub.total)}</td>
                                            <td className="p-4 text-right flex justify-end border-t border-slate-200/50">
                                                {!isReturn && !sub.productName.includes('ANNULATION') && isAdmin && (
                                                    g.type === 'QUOTE' ? (
                                                        <button onClick={() => handleDeleteDevis(sub)} className="p-1.5 text-xs text-red-500 bg-red-50 hover:bg-red-100 rounded-md font-bold flex items-center gap-1"><Trash2 size={12}/> Supprimer</button>
                                                    ) : (
                                                        (sub.quantity > (sub.returnedQuantity || 0)) && (
                                                            <button onClick={() => setReturnModal({ isOpen: true, item: sub, qty: 1, parentType: g.type })} className="p-1.5 text-xs text-red-500 bg-red-50 hover:bg-red-100 rounded-md font-bold flex items-center gap-1"><RotateCcw size={12}/> Retourner</button>
                                                        )
                                                    )
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="p-4 border-t border-slate-100 bg-white flex justify-between items-center shrink-0">
                <span className="text-xs text-slate-400 font-medium">Affichage {groups.length} sur {totalRecords}</span>
                <div className="flex items-center gap-4">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1 || loading} className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"><ChevronLeft size={16}/></button>
                    <span className="text-sm font-bold text-slate-700">Page {page} / {totalPages || 1}</span>
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages || totalPages === 0 || loading} className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"><ChevronRight size={16}/></button>
                </div>
            </div>

            {returnModal.isOpen && returnModal.item && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
                        <h2 className="text-xl font-black text-slate-800 mb-6">Retour Marchandise</h2>
                        <div className="bg-slate-50 p-4 rounded-xl mb-6 text-sm">
                            <p className="font-bold text-slate-700">{returnModal.item.productName}</p>
                            <p className="text-slate-500">Quantité éligible au retour: <span className="font-bold text-slate-800 text-red-600">{returnModal.item.quantity - (returnModal.item.returnedQuantity || 0)}</span></p>
                        </div>
                        <div className="mb-6">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Quantité à retourner</label>
                            <input 
                                type="number" min="1" 
                                max={returnModal.item.quantity - (returnModal.item.returnedQuantity || 0)} 
                                value={returnModal.qty} 
                                onChange={e => {
                                    const val = Number(e.target.value);
                                    const maxAllowed = returnModal.item!.quantity - (returnModal.item!.returnedQuantity || 0);
                                    setReturnModal({...returnModal, qty: val > maxAllowed ? maxAllowed : val});
                                }} 
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-lg text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none" 
                            />
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setReturnModal({isOpen: false, item: null, qty: 1, parentType: ''})} className="flex-1 px-4 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200">Annuler</button>
                            <button onClick={handleSubmitReturn} className="flex-1 px-4 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 flex items-center justify-center gap-2"><RotateCcw size={18}/> Confirmer</button>
                        </div>
                    </div>
                </div>
            )}
            
            {printTicketData && <InternalDeliveryNote data={printTicketData} onClose={() => setPrintTicketData(null)} />}
        </div>
    );
};