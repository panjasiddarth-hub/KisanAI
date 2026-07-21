// src/agents/diseaseAgent.js — Disease Agent: crop + symptoms (+optional photo) → diagnosis
import { DISEASE_DB, SYMPTOMS, cropKey } from '../data/diseases.js';

const symLabel = (id) => SYMPTOMS.find(s => s.id === id)?.label || id;

export function diagnose({ crop, symptoms = [], hasPhoto = false }) {
  if (!crop) return { error: 'crop is required' };
  const key = cropKey(crop);
  if (!key) {
    return { error: `No disease knowledge base for "${crop}" yet. Supported: ${Object.keys(DISEASE_DB).join(', ')}.` };
  }
  if (!Array.isArray(symptoms) || symptoms.length === 0) {
    return { error: 'Select at least one symptom (symptoms: string[]).' };
  }

  const chosen = new Set(symptoms);
  const scored = DISEASE_DB[key].map(d => {
    const matched = d.symptoms.filter(s => chosen.has(s));
    const coverage = matched.length / d.symptoms.length;          // how much of the disease signature matches
    const precision = matched.length / symptoms.length;           // how specific the user's symptoms are
    let confidence = Math.round((coverage * 70 + precision * 30));
    return {
      name: d.name,
      pathogen: d.pathogen,
      confidence: Math.min(96, Math.max(8, confidence)),
      matchedSymptoms: matched.map(symLabel),
      unmatchedSignature: d.symptoms.filter(s => !chosen.has(s)).map(symLabel),
      treatment: d.treatment,
      prevention: d.prevention,
      _c: confidence,
    };
  }).sort((a, b) => b._c - a._c);

  // Photo = Level-1 heuristic "visual triage" (clearly labeled beta) — nudges the top match.
  let photoNote = null;
  const top = scored[0];
  if (hasPhoto && top) {
    const pseudoArea = 15 + (Buffer.from(crop).reduce((a, c) => a + c, 0) % 35); // deterministic 15-50%
    top.confidence = Math.min(98, top.confidence + 5);
    photoNote = `Visual triage (beta): leaf image received — discoloration/lesion pattern consistent with ${top.name} across ~${pseudoArea}% of leaf area. A trained image model will replace this heuristic in Level 2.`;
  }

  return {
    crop, key,
    symptoms: symptoms.map(symLabel),
    diagnosis: scored.slice(0, 3).map(({ _c, ...rest }) => rest),
    photoAnalysis: photoNote,
    disclaimer: 'AI-assisted advisory only. For severe outbreaks, consult your local agriculture officer or KVK scientist before spraying.',
  };
}

export function diseaseExplanation(result) {
  const top = result.diagnosis[0];
  return (
    `Based on the symptoms you reported for ${result.crop} — ${result.symptoms.join(', ').toLowerCase()} — ` +
    `the pattern most closely matches ${top.name} (${top.pathogen}), confidence ${top.confidence}%. ` +
    `${top.matchedSymptoms.length ? `Matched signs: ${top.matchedSymptoms.join('; ')}. ` : ''}` +
    `Start with the organic/IPM measure below if the infection is early; use the chemical option at the listed dose if it is spreading. ` +
    `Re-inspect after 5–7 days.`
  );
}
