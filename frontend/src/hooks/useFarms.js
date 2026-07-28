// src/hooks/useFarms.js
import { useState, useEffect } from 'react';
import { api } from '../api/client';
import toast from 'react-hot-toast';

export function useFarms() {
  const [farms, setFarms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const fetchFarms = async () => {
      try {
        const { data } = await api.get('/farms');
        if (mounted) {
          setFarms(data);
          setLoading(false);
        }
      } catch (e) {
        if (mounted) {
          toast.error('Failed to load farms');
          setLoading(false);
        }
      }
    };
    fetchFarms();
    return () => { mounted = false; };
  }, []);

  const addFarm = async (farmData) => {
    try {
      const { data } = await api.post('/farms', farmData);
      setFarms(prev => [data, ...prev]);
      return data;
    } catch (e) {
      toast.error('Failed to add farm');
      throw e;
    }
  };

  const updateFarm = async (id, updates) => {
    try {
      const { data } = await api.patch(`/farms/${id}`, updates);
      setFarms(prev => prev.map(f => f.id === id ? data : f));
      return data;
    } catch (e) {
      toast.error('Failed to update farm');
      throw e;
    }
  };

  const deleteFarm = async (id) => {
    try {
      await api.delete(`/farms/${id}`);
      setFarms(prev => prev.filter(f => f.id !== id));
    } catch (e) {
      toast.error('Failed to delete farm');
      throw e;
    }
  };

  return { farms, loading, addFarm, updateFarm, deleteFarm };
}
