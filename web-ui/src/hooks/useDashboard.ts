import { useState, useEffect } from 'react';
import axios from 'axios';

// Ensure this matches your API base URL
const API_URL = 'http://localhost:3000/api/dashboard/stats'; 

export const useDashboard = (dateRange?: {from: string, to: string}) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('marine_token');
      const query = dateRange ? `?from=${dateRange.from}&to=${dateRange.to}` : '';
      
      const res = await axios.get(`${API_URL}${query}`, {
          headers: { Authorization: `Bearer ${token}` }
      });
      
      setData(res.data.metrics || res.data); // Handle both formats
    } catch (err: any) {
      console.error("Erreur Dashboard:", err);
      setError("Impossible de charger les statistiques.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
      loadData(); 
  }, [dateRange?.from, dateRange?.to]);

  return { data, loading, error, refetch: loadData };
};