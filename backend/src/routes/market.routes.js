import { Router } from 'express';

const router = Router();

// Base prices to derive dynamic live data from
const BASE_MARKET = [
  { crop: 'Wheat', basePrice: 2350, msp: 2275, unit: '₹/quintal', market: 'Nashik APMC', quality: 'A Grade' },
  { crop: 'Onion', basePrice: 1850, msp: 1200, unit: '₹/quintal', market: 'Lasalgaon APMC', quality: 'Medium' },
  { crop: 'Tomato', basePrice: 2100, msp: null, unit: '₹/quintal', market: 'Pune APMC', quality: 'Fresh' },
  { crop: 'Sugarcane', basePrice: 3200, msp: 3150, unit: '₹/tonne', market: 'Ahmednagar', quality: 'Standard' },
  { crop: 'Soybean', basePrice: 4800, msp: 4600, unit: '₹/quintal', market: 'Akola APMC', quality: 'A Grade' },
  { crop: 'Cotton', basePrice: 7200, msp: 6950, unit: '₹/quintal', market: 'Nagpur APMC', quality: 'Medium Staple' },
];

router.get('/', (_req, res) => {
  // Use current date to generate stable but dynamic daily fluctuations
  const today = new Date();
  const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();

  const prices = BASE_MARKET.map((item, index) => {
    // Generate a pseudo-random change between -5% and +5%
    const randomFactor = Math.sin(seed + index) * 0.05; 
    const currentPrice = Math.round(item.basePrice * (1 + randomFactor));
    const change = parseFloat((randomFactor * 100).toFixed(1));

    return {
      ...item,
      price: currentPrice,
      change,
    };
  });

  const nearbyMarkets = [
    { name: 'Nashik APMC', distance: '12 km', rating: 4.5, speciality: 'Grapes, Onion, Tomato', timing: '6 AM – 2 PM', days: 'Mon–Sat' },
    { name: 'Lasalgaon APMC', distance: '28 km', rating: 4.8, speciality: "Asia's largest onion market", timing: '5 AM – 12 PM', days: 'All days' },
    { name: 'Pune APMC (Gultekdi)', distance: '75 km', rating: 4.3, speciality: 'Vegetables, Fruits, Grains', timing: '4 AM – 10 AM', days: 'All days' },
    { name: 'Ahmednagar APMC', distance: '95 km', rating: 4.1, speciality: 'Sugarcane, Soybean', timing: '7 AM – 3 PM', days: 'Mon–Fri' },
  ];

  res.json({ prices, nearbyMarkets });
});

export default router;
