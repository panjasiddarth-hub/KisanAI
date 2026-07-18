// src/hooks/useCrops.js
import { useState, useEffect } from 'react';

const MOCK_CROPS = [
  { id: '1', name: 'Wheat', farmId: '1', variety: 'HD-2967', sowingDate: '2026-11-15', expectedHarvest: '2027-03-20', stage: 'Tillering', progress: 45, area: 2.5, yield: null, notes: 'Showing healthy tillering. Apply urea in 2 weeks.' },
  { id: '2', name: 'Onion', farmId: '1', variety: 'Nasik Red', sowingDate: '2026-12-01', expectedHarvest: '2027-04-10', stage: 'Bulbing', progress: 60, area: 1.5, yield: null, notes: 'Good moisture levels. Monitor for thrips.' },
  { id: '3', name: 'Tomato', farmId: '2', variety: 'Pusa Ruby', sowingDate: '2026-10-20', expectedHarvest: '2027-01-15', stage: 'Fruiting', progress: 80, area: 2.0, yield: null, notes: 'Fruit set is good. Watch for blight.' },
  { id: '4', name: 'Sugarcane', farmId: '2', variety: 'Co-86032', sowingDate: '2026-02-10', expectedHarvest: '2027-01-10', stage: 'Grand Growth', progress: 70, area: 1.8, yield: null, notes: 'Growing well. Irrigation on schedule.' },
  { id: '5', name: 'Soybean', farmId: '3', variety: 'JS-335', sowingDate: '2026-06-25', expectedHarvest: '2026-10-15', stage: 'Pod Fill', progress: 90, area: 4.0, yield: null, notes: 'Ready for harvest in 2 weeks.' },
];

export function useCrops() {
  const [crops, setCrops] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      const saved = localStorage.getItem('kisan_crops');
      setCrops(saved ? JSON.parse(saved) : MOCK_CROPS);
      setLoading(false);
    }, 700);
    return () => clearTimeout(timer);
  }, []);

  const addCrop = (crop) => {
    const newCrop = { ...crop, id: String(Date.now()), progress: 5, yield: null };
    const updated = [...crops, newCrop];
    setCrops(updated);
    localStorage.setItem('kisan_crops', JSON.stringify(updated));
    return newCrop;
  };

  const updateCrop = (id, updates) => {
    const updated = crops.map(c => c.id === id ? { ...c, ...updates } : c);
    setCrops(updated);
    localStorage.setItem('kisan_crops', JSON.stringify(updated));
  };

  const deleteCrop = (id) => {
    const updated = crops.filter(c => c.id !== id);
    setCrops(updated);
    localStorage.setItem('kisan_crops', JSON.stringify(updated));
  };

  return { crops, loading, addCrop, updateCrop, deleteCrop };
}
