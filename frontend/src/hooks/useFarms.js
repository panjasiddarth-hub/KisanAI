// src/hooks/useFarms.js
import { useState, useEffect } from 'react';
import { api } from '../api/client';
import toast from 'react-hot-toast';

export function isConfirmedLocation(value) {
  const lat = Number(value?.lat);
  const lon = Number(value?.lon);
  return Number.isFinite(lat) && Math.abs(lat) <= 90
    && Number.isFinite(lon) && Math.abs(lon) <= 180
    && Boolean(value?.confirmedAt || value?.confirmed);
}

export function useFarms() {
  const [farms, setFarms] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const fetchFarms = async () => {
      try {
        const [farmsResponse, draftsResponse] = await Promise.allSettled([
          api.get('/farms'),
          api.get('/farms/drafts'),
        ]);
        if (farmsResponse.status === 'rejected') throw farmsResponse.reason;
        if (mounted) {
          setFarms(farmsResponse.value.data);
          if (draftsResponse.status === 'fulfilled') setDrafts(draftsResponse.value.data);
          else toast.error('Failed to load saved farm drafts');
          setLoading(false);
        }
      } catch {
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

  const saveDraft = async (profile, draftId) => {
    try {
      const { data } = draftId
        ? await api.patch(`/farms/drafts/${draftId}`, { profile })
        : await api.post('/farms/drafts', { profile });
      setDrafts(prev => [data, ...prev.filter(draft => draft.id !== data.id)]);
      return data;
    } catch (e) {
      toast.error('Failed to save farm draft');
      throw e;
    }
  };

  const completeDraft = async (draftId, profile) => {
    try {
      const { data } = await api.post(`/farms/drafts/${draftId}/complete`, { profile });
      setDrafts(prev => prev.filter(draft => draft.id !== draftId));
      setFarms(prev => [data, ...prev.filter(farm => farm.id !== data.id)]);
      return data;
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Failed to save farm profile');
      throw e;
    }
  };

  return {
    farms,
    drafts,
    loading,
    addFarm,
    updateFarm,
    deleteFarm,
    saveDraft,
    completeDraft,
  };
}
