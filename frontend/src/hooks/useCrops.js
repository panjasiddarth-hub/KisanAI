// src/hooks/useCrops.js
import { useState, useEffect } from 'react';
import { api } from '../api/client';
import toast from 'react-hot-toast';

export function useCrops() {
  const [crops, setCrops] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const fetchCrops = async () => {
      try {
        const { data } = await api.get('/crops');
        if (mounted) {
          setCrops(data);
          setLoading(false);
        }
      } catch {
        if (mounted) {
          toast.error('Failed to load crops');
          setLoading(false);
        }
      }
    };
    fetchCrops();
    return () => { mounted = false; };
  }, []);

  const addCrop = async (cropData) => {
    try {
      const { data } = await api.post('/crops', cropData);
      setCrops(prev => [data, ...prev]);
      return data;
    } catch (e) {
      toast.error('Failed to add crop');
      throw e;
    }
  };

  const updateCrop = async (id, updates) => {
    try {
      const { data } = await api.patch(`/crops/${id}`, updates);
      setCrops(prev => prev.map(c => c.id === id ? data : c));
      return data;
    } catch (e) {
      toast.error('Failed to update crop');
      throw e;
    }
  };

  const deleteCrop = async (id) => {
    try {
      await api.delete(`/crops/${id}`);
      setCrops(prev => prev.filter(c => c.id !== id));
    } catch (e) {
      toast.error('Failed to delete crop');
      throw e;
    }
  };

  return { crops, loading, addCrop, updateCrop, deleteCrop };
}
