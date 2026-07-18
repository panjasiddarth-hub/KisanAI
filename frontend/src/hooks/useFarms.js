// src/hooks/useFarms.js
import { useState, useEffect } from 'react';

const MOCK_FARMS = [
  { id: '1', name: 'Shri Ram Farm', location: 'Nashik, Maharashtra', area: 5.2, areaUnit: 'acres', soilType: 'Black Cotton', waterSource: 'Borewell', crops: ['Wheat', 'Onion'], images: [], healthScore: 84, lastUpdated: '2026-07-15' },
  { id: '2', name: 'Green Valley Plot', location: 'Ahmednagar, Maharashtra', area: 3.8, areaUnit: 'acres', soilType: 'Red Laterite', waterSource: 'Canal', crops: ['Tomato', 'Sugarcane'], images: [], healthScore: 71, lastUpdated: '2026-07-10' },
  { id: '3', name: 'North Field', location: 'Solapur, Maharashtra', area: 7.1, areaUnit: 'acres', soilType: 'Alluvial', waterSource: 'River', crops: ['Soybean', 'Cotton'], images: [], healthScore: 90, lastUpdated: '2026-07-17' },
];

export function useFarms() {
  const [farms, setFarms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      const saved = localStorage.getItem('kisan_farms');
      setFarms(saved ? JSON.parse(saved) : MOCK_FARMS);
      setLoading(false);
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  const addFarm = (farm) => {
    const newFarm = { ...farm, id: String(Date.now()), healthScore: 75, lastUpdated: new Date().toISOString().split('T')[0] };
    const updated = [...farms, newFarm];
    setFarms(updated);
    localStorage.setItem('kisan_farms', JSON.stringify(updated));
    return newFarm;
  };

  const updateFarm = (id, updates) => {
    const updated = farms.map(f => f.id === id ? { ...f, ...updates } : f);
    setFarms(updated);
    localStorage.setItem('kisan_farms', JSON.stringify(updated));
  };

  const deleteFarm = (id) => {
    const updated = farms.filter(f => f.id !== id);
    setFarms(updated);
    localStorage.setItem('kisan_farms', JSON.stringify(updated));
  };

  return { farms, loading, addFarm, updateFarm, deleteFarm };
}
