// src/agents/gemini.js — optional AI-written explanation layer (hybrid mode).
// Returns null when GEMINI_API_KEY is not set, so routes fall back to templates.

import fs from 'node:fs';

const TIMEOUT_MS = 15000;

export async function aiAnalyzeImage(crop, imagePath) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

  try {
    const base64Image = fs.readFileSync(imagePath).toString('base64');
    
    // Determine mime type loosely
    let mimeType = 'image/jpeg';
    if (imagePath.endsWith('.png')) mimeType = 'image/png';
    else if (imagePath.endsWith('.webp')) mimeType = 'image/webp';

    const system = `You are an expert plant pathologist. I am a farmer growing ${crop}. I have attached an image of a problematic leaf/plant. Analyze the visual symptoms and identify the most likely disease or deficiency. Provide a short 3-4 sentence explanation.`;

    const body = {
      contents: [{
        parts: [
          { text: system },
          { inlineData: { mimeType, data: base64Image } }
        ]
      }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 250 },
    };

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal }
    );
    clearTimeout(t);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
  } catch (e) {
    console.error('Gemini Vision Error:', e.message);
    return null; 
  }
}

export async function aiExplain(kind, structuredResult) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

  const system = {
    crop: 'You are an Indian agronomist. In 3-4 short farmer-friendly sentences, explain this crop recommendation JSON. Mention the top crop, why it fits the soil/season/water, and one risk to watch. Plain English, no markdown.',
    fertilizer: 'You are an Indian agronomist. In 3-4 short farmer-friendly sentences, explain this fertilizer plan JSON: the N-P-K logic, why DAP is at sowing, and the most important caution. Plain English, no markdown.',
    disease: 'You are an Indian plant doctor. In 3-4 short sentences, explain this diagnosis JSON: the most likely disease, why it fits the symptoms, and what the farmer should do TODAY. Plain English, no markdown.',
    calendar: 'You are an Indian farm advisor. In 3 short sentences, summarize this crop calendar JSON: the critical first two weeks, the most important mid-season activity, and harvest timing. Plain English, no markdown.',
  }[kind] || 'Explain this JSON to a farmer simply.';

  const body = {
    contents: [{ parts: [{ text: `${system}\n\nJSON:\n${JSON.stringify(structuredResult).slice(0, 4000)}` }] }],
    generationConfig: { temperature: 0.4, maxOutputTokens: 220 },
  };

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal }
    );
    clearTimeout(t);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
  } catch {
    return null; // network/timeout/quota — caller falls back to template text
  }
}
