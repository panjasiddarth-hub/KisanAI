import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { isOfflineError, apiErrorMessage } from '../api/client';
import { runOrchestratedAgent } from '../api/orchestrator';
import { api } from '../api/client';
import { useFarms } from '../hooks/useFarms';
import OfflineCard from '../components/ui/OfflineCard';
import { FlaskConical, Loader2, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

const NUMERIC_FIELDS = [
  ['pH', 'Soil pH', ''],
  ['EC_dS_per_m', 'Electrical conductivity', 'dS/m'],
  ['OC_percent', 'Organic carbon', '%'],
  ['N_kg_per_ha', 'Nitrogen (N)', 'kg/ha'],
  ['P_kg_per_ha', 'Phosphorus (P)', 'kg/ha'],
  ['K_kg_per_ha', 'Potassium (K)', 'kg/ha'],
  ['S_ppm', 'Sulphur (S)', 'ppm'],
  ['Zn_ppm', 'Zinc (Zn)', 'ppm'],
  ['B_ppm', 'Boron (B)', 'ppm'],
  ['Fe_ppm', 'Iron (Fe)', 'ppm'],
  ['Cu_ppm', 'Copper (Cu)', 'ppm'],
  ['Mn_ppm', 'Manganese (Mn)', 'ppm'],
];
const NUTRIENT_INPUT_FIELDS = {
  N: 'N_kg_per_ha', P: 'P_kg_per_ha', K: 'K_kg_per_ha',
  S: 'S_ppm', Zn: 'Zn_ppm', B: 'B_ppm', Fe: 'Fe_ppm', Cu: 'Cu_ppm', Mn: 'Mn_ppm',
};
const FIELD_LABELS = Object.fromEntries(NUMERIC_FIELDS.map(([key, label, unit]) => [key, `${label}${unit ? ` (${unit})` : ''}`]));
const SOIL_TYPES = ['Alluvial', 'Black (Regur)', 'Clay Loam', 'Laterite', 'Red', 'Sandy Loam'];
const SEASONS = ['Kharif', 'Rabi', 'Zaid'];
const hasRegionalRecommendation = (crop) => [true, 'true', 'yes', '1'].includes(
  typeof crop?.GFRavailable === 'string' ? crop.GFRavailable.trim().toLowerCase() : crop?.GFRavailable,
);
const FARM_SOIL_FIELD_MAP = {
  pH: 'soilPH', EC_dS_per_m: 'soilEC', OC_percent: 'soilOC',
  N_kg_per_ha: 'soilN', P_kg_per_ha: 'soilP', K_kg_per_ha: 'soilK',
  S_ppm: 'soilS', Zn_ppm: 'soilZn', B_ppm: 'soilB', Fe_ppm: 'soilFe',
  Cu_ppm: 'soilCu', Mn_ppm: 'soilMn',
};
const EMPTY_FORM = {
  pH: '', EC_dS_per_m: '', OC_percent: '', N_kg_per_ha: '', P_kg_per_ha: '',
  K_kg_per_ha: '', S_ppm: '', Zn_ppm: '', B_ppm: '', Fe_ppm: '', Cu_ppm: '',
  Mn_ppm: '', Soil_Type: '', Season: '',
};

function flattenReference(value, prefix = '') {
  if (value === null || value === undefined || value === '') return [];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => flattenReference(item, prefix ? `${prefix} ${index + 1}` : `Item ${index + 1}`));
  }
  if (typeof value === 'object') {
    return Object.entries(value).flatMap(([key, item]) => flattenReference(item, prefix ? `${prefix} · ${key}` : key));
  }
  return [{ label: prefix || 'Value', value: String(value) }];
}

export default function FertilizerAgent() {
  const location = useLocation();
  const { farms, loading: farmsLoading } = useFarms();
  const incomingFarm = location.state?.farm || null;
  const [selectedFarmId, setSelectedFarmId] = useState(incomingFarm?.id || '');
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);
  const [prediction, setPrediction] = useState(null);
  const [referenceCrop, setReferenceCrop] = useState('');
  const [referenceCropId, setReferenceCropId] = useState('');
  const [reference, setReference] = useState(null);
  const [referenceBusy, setReferenceBusy] = useState(false);
  const [officialCrops, setOfficialCrops] = useState([]);
  const [cropCatalogUnavailable, setCropCatalogUnavailable] = useState(false);
  const [officialLookupEnabled, setOfficialLookupEnabled] = useState(null);
  const selectedFarm = farms.find(farm => farm.id === selectedFarmId)
    || (incomingFarm?.id === selectedFarmId ? incomingFarm : null);

  useEffect(() => {
    if (!selectedFarmId && farms.length === 1) setSelectedFarmId(farms[0].id);
  }, [farms, selectedFarmId]);

  useEffect(() => {
    let active = true;
    api.get('/agents/meta')
      .then(({ data }) => { if (active) setOfficialLookupEnabled(Boolean(data.officialSoilHealthCardLookupAvailable)); })
      .catch(() => { if (active) setOfficialLookupEnabled(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!selectedFarm) {
      setReference(null);
      setReferenceCrop('');
      setReferenceCropId('');
      setOfficialCrops([]);
      setCropCatalogUnavailable(false);
      return undefined;
    }
    const soilTypeMap = { Alluvial: 'Alluvial', 'Black Cotton': 'Black (Regur)' };
    setForm({
      pH: selectedFarm.soilPH ?? '',
      EC_dS_per_m: selectedFarm.soilEC ?? '',
      OC_percent: selectedFarm.soilOC ?? '',
      N_kg_per_ha: selectedFarm.soilN ?? '',
      P_kg_per_ha: selectedFarm.soilP ?? '',
      K_kg_per_ha: selectedFarm.soilK ?? '',
      S_ppm: selectedFarm.soilS ?? '',
      Zn_ppm: selectedFarm.soilZn ?? '',
      B_ppm: selectedFarm.soilB ?? '',
      Fe_ppm: selectedFarm.soilFe ?? '',
      Cu_ppm: selectedFarm.soilCu ?? '',
      Mn_ppm: selectedFarm.soilMn ?? '',
      Soil_Type: soilTypeMap[selectedFarm.soilType] || '',
      Season: SEASONS.includes(selectedFarm.season) ? selectedFarm.season : '',
    });
    setPrediction(null);
    setReference(null);
    setReferenceCrop(selectedFarm.crops?.[0] || selectedFarm.previousCrop || '');
    setReferenceCropId('');
    setOfficialCrops([]);
    setCropCatalogUnavailable(officialLookupEnabled === false);
    if (officialLookupEnabled !== true) return undefined;
    let active = true;
    api.post('/agents/fertilizer/crops', { farmId: selectedFarm.id })
      .then(({ data }) => {
        if (!active) return;
        const crops = data.crops || [];
        setOfficialCrops(crops);
        const preferredCrop = selectedFarm.crops?.[0] || selectedFarm.previousCrop || '';
        const exactMatch = crops.find(crop => crop.name.toLowerCase() === preferredCrop.trim().toLowerCase() && hasRegionalRecommendation(crop));
        const selected = exactMatch || crops.find(hasRegionalRecommendation);
        setReferenceCrop(selected?.name || '');
        setReferenceCropId(selected?.id || '');
        setCropCatalogUnavailable(false);
      })
      .catch(() => { if (active) setCropCatalogUnavailable(true); });
    return () => { active = false; };
  }, [selectedFarm, officialLookupEnabled]);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setOffline(false);
    setPrediction(null);
    try {
      const input = { ...form };
      for (const [key] of NUMERIC_FIELDS) input[key] = Number(input[key]);
      const result = await runOrchestratedAgent('fertilizer', input);
      setPrediction({ ...result, inputSnapshot: input });
    } catch (error) {
      if (isOfflineError(error)) { setOffline(true); setPrediction(null); }
      else toast.error(apiErrorMessage(error, error.message || 'Soil model request failed'));
    } finally {
      setBusy(false);
    }
  };

  const loadOfficialReference = async (event) => {
    event.preventDefault();
    if (!selectedFarm) return toast.error('Select a saved farm with its state and district first.');
    setReferenceBusy(true);
    try {
      const { data } = await api.post('/agents/fertilizer/reference', {
        farmId: selectedFarm.id,
        crop: referenceCrop,
        ...(referenceCropId ? { cropId: referenceCropId } : {}),
      });
      setReference(data);
      if (!data.results?.length) toast('No regional reference was returned for this crop and location.');
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Could not load the official reference.'));
    } finally {
      setReferenceBusy(false);
    }
  };

  return (
    <div className="page-content" style={{ maxWidth: '1100px' }}>
      <div className="mb-5">
        <h2 className="text-xl font-extrabold text-[var(--color-text)] flex items-center gap-2">
          <span className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/50 flex items-center justify-center"><FlaskConical className="w-5 h-5 text-amber-600" /></span>
          Fertilizer guidance for your farm
        </h2>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">Use your saved farm and soil report to review nutrient status, then check the Government Soil Health Card Portal’s regional crop guidance. We show the evidence and source; we don’t invent fertilizer doses.</p>
      </div>

      <div className="card mb-5 p-4">
        <label htmlFor="fertilizer-farm" className="mb-1.5 block text-xs font-semibold text-[var(--color-text)]">Prefill from a saved farm</label>
        <select id="fertilizer-farm" value={selectedFarmId} onChange={event => {
          setSelectedFarmId(event.target.value);
          if (!event.target.value) { setForm(EMPTY_FORM); setPrediction(null); }
        }} disabled={farmsLoading} className="input text-sm">
          <option value="">Enter readings manually</option>
          {farms.map(farm => <option key={farm.id} value={farm.id}>{farm.name} · {farm.location}</option>)}
        </select>
        {selectedFarm && <div className="mt-3 rounded-xl bg-[var(--color-bg)] p-3 text-xs text-[var(--color-text-muted)]">
          <p className="font-semibold text-[var(--color-text)]">Farm context used for this guidance</p>
          <p className="mt-1">{selectedFarm.name} · {selectedFarm.area} {selectedFarm.areaUnit || 'acres'} · {selectedFarm.district || selectedFarm.location}{selectedFarm.state ? `, ${selectedFarm.state}` : ''}</p>
          <p>Crop: {selectedFarm.crops?.[0] || selectedFarm.previousCrop || 'Choose a crop below'} · Season: {selectedFarm.season || 'not recorded'} · Soil: {selectedFarm.soilType || 'not recorded'}</p>
          <p className="mt-1">{Object.values(FARM_SOIL_FIELD_MAP).filter(field => selectedFarm[field] != null).length} of 12 numeric readings prefilled. Verify values and units against the report; missing readings remain blank. {selectedFarm.soilTestDate ? `Soil test date: ${selectedFarm.soilTestDate}.` : 'Soil test date not recorded.'}</p>
        </div>}
      </div>

      <section className="card mb-5 p-4" aria-labelledby="official-reference-title">
        <h3 id="official-reference-title" className="font-bold text-sm text-[var(--color-text)]">Official regional fertilizer reference</h3>
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">When this farm has NPK results and an official crop match, KisanAI requests the portal’s crop recommendation using those soil readings and the farm state. If readings are missing, it labels the result as general regional guidance.</p>
        <form onSubmit={loadOfficialReference} className="mt-3 flex flex-col sm:flex-row gap-2">
          {officialCrops.length > 0 ? (
            <select aria-label="Crop for official regional reference" value={referenceCropId} onChange={event => {
              const selected = officialCrops.find(crop => crop.id === event.target.value);
              setReferenceCropId(selected?.id || '');
              setReferenceCrop(selected?.name || '');
              setReference(null);
            }} required className="input text-sm">
              <option value="" disabled>Choose a crop available for this region</option>
              {officialCrops.map(crop => <option key={crop.id} value={crop.id} disabled={!hasRegionalRecommendation(crop)}>{crop.name}{hasRegionalRecommendation(crop) ? '' : ' — no regional reference'}</option>)}
            </select>
          ) : (
            <input aria-label="Crop for official regional reference" value={referenceCrop} onChange={event => setReferenceCrop(event.target.value)} maxLength={80} required placeholder="Crop, for example rice" className="input text-sm" />
          )}
          <button disabled={referenceBusy || !selectedFarm || officialLookupEnabled !== true} className="shrink-0 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{referenceBusy ? 'Loading…' : 'Fetch official reference'}</button>
        </form>
        {!selectedFarm && <p className="mt-2 text-xs text-amber-700">Select a saved farm above to use its state and district.</p>}
        {officialLookupEnabled === null && <p className="mt-2 text-xs text-[var(--color-text-muted)]">Checking official reference availability…</p>}
        {officialLookupEnabled === false && <p className="mt-2 text-xs text-[var(--color-text-muted)]">Official reference is not connected right now. You can still use the soil nutrient model above.</p>}
        {officialCrops.length > 0 && <p className="mt-2 text-xs text-[var(--color-text-muted)]">Crop names are suggested from the official portal’s catalog for your farm state.</p>}
        {officialLookupEnabled === true && cropCatalogUnavailable && <p className="mt-2 text-xs text-[var(--color-text-muted)]">Official crop choices could not be loaded. You can still enter a crop name manually.</p>}
        {reference && <div className="mt-4 rounded-xl border border-[var(--color-border)] p-3">
          <p className="text-xs font-semibold text-[var(--color-text)]">{reference.source} · {reference.location.district}, {reference.location.state}</p>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">{reference.personalized ? 'Based on this farm’s saved NPK soil readings and state.' : 'General regional requirement; not personalized to this soil test.'} Retrieved {new Date(reference.retrievedAt).toLocaleString()}.</p>
          {reference.missingSoilInputs?.length > 0 && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">Add these readings from the soil report to personalize: {reference.missingSoilInputs.join(', ')}.</p>}
          {reference.personalized && reference.inputsUsed && <p className="mt-2 text-xs text-[var(--color-text-muted)]">Soil values sent: N {reference.inputsUsed.N}, P {reference.inputsUsed.P}, K {reference.inputsUsed.K} kg/ha.</p>}
          {reference.results.length ? reference.results.map((entry, index) => {
            const rows = flattenReference(entry?.nutrients ?? entry);
            return <div key={`${entry?.crop?.id || entry?.crop?.name || 'reference'}-${index}`} className="mt-3 rounded-lg border border-[var(--color-border)] p-3">
              <p className="text-sm font-semibold text-[var(--color-text)]">{entry?.crop?.name || reference.crop}{entry?.region ? ` · ${entry.region}` : ''}</p>
              {rows.length ? <dl className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">{rows.slice(0, 60).map((row, rowIndex) => <div key={`${row.label}-${rowIndex}`} className="rounded-lg bg-[var(--color-bg)] p-2"><dt className="text-[0.68rem] text-[var(--color-text-muted)]">{row.label.replaceAll('_', ' ')}</dt><dd className="mt-0.5 text-xs font-semibold text-[var(--color-text)] break-words">{row.value}</dd></div>)}</dl> : <p className="mt-2 text-xs text-[var(--color-text-muted)]">The portal returned a regional record without nutrient details.</p>}
            </div>;
          }) : <p className="mt-3 text-sm text-[var(--color-text-muted)]">No reference is available for this crop and location.</p>}
          <p className="mt-3 text-xs text-[var(--color-text-muted)]">KisanAI displays the portal’s returned values. It does not convert nutrient quantities into fertilizer product quantities or multiply them by farm area. Follow the Soil Health Card’s units and confirm unclear application details locally.</p>
          <a className="mt-2 inline-block text-xs font-semibold text-emerald-700 underline" href={reference.sourceUrl} target="_blank" rel="noreferrer">Open Soil Health Card Portal</a>
        </div>}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-[420px_minmax(0,1fr)] gap-5 items-start">
        <form onSubmit={submit} className="card p-5 space-y-3">
          <p className="text-xs text-[var(--color-text-muted)]">Use the readings from your soil report. Do not estimate missing measurements. Review prefilled values before running the model.</p>
          {NUMERIC_FIELDS.map(([key, label, unit]) => (
            <div key={key}>
              <label htmlFor={`fertilizer-${key}`} className="text-xs font-semibold text-[var(--color-text)] block mb-1.5">{label}{unit ? ` (${unit})` : ''}</label>
              <input id={`fertilizer-${key}`} type="number" required min="0" max={key === 'pH' ? 14 : undefined} step="any" value={form[key]}
                onChange={event => { setPrediction(null); setForm(current => ({ ...current, [key]: event.target.value })); }} className="input text-sm" />
            </div>
          ))}
          <div>
            <label htmlFor="fertilizer-soil" className="text-xs font-semibold text-[var(--color-text)] block mb-1.5">Soil type</label>
            <select id="fertilizer-soil" required value={form.Soil_Type} onChange={event => { setPrediction(null); setForm(current => ({ ...current, Soil_Type: event.target.value })); }} className="input text-sm">
              <option value="">Choose the soil type</option>
              {SOIL_TYPES.map(soil => <option key={soil} value={soil}>{soil}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="fertilizer-season" className="text-xs font-semibold text-[var(--color-text)] block mb-1.5">Growing season</label>
            <select id="fertilizer-season" required value={form.Season} onChange={event => { setPrediction(null); setForm(current => ({ ...current, Season: event.target.value })); }} className="input text-sm">
              <option value="">Choose the season</option>
              {SEASONS.map(season => <option key={season} value={season}>{season}</option>)}
            </select>
          </div>
          <button type="submit" disabled={busy} className="w-full flex items-center justify-center gap-2 bg-[#15803d] hover:bg-[#166534] disabled:opacity-60 text-white font-bold text-sm py-3 rounded-xl transition-colors">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {busy ? 'Running the model…' : 'Classify Soil Nutrients'}
          </button>
        </form>

        <div className="space-y-4">
          {offline && <OfflineCard onRetry={submit} />}
          {!offline && !prediction && (
            <div className="card p-8 text-center text-sm text-[var(--color-text-muted)]">
              <FlaskConical className="w-10 h-10 mx-auto mb-3 text-amber-300" />
              Enter all lab measurements to get the model’s nutrient ratings.
            </div>
          )}
          {prediction && (
            <>
              <div className="rounded-2xl border border-green-200/70 bg-[#e9f7ee] dark:bg-green-950/15 dark:border-green-900/30 p-4 flex gap-3">
                <span className="w-8 h-8 rounded-full bg-[#15803d] flex items-center justify-center shrink-0"><Sparkles className="w-4 h-4 text-white" /></span>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-bold text-sm text-[var(--color-text)]">Model result</h4>
                    <span className="badge badge-blue">Trained ML model</span>
                  </div>
              <p className="text-[0.82rem] text-[var(--color-text)] leading-relaxed mt-1.5">{prediction.explanation}</p>
              <p className="mt-2 text-xs text-[var(--color-text-muted)]">This is a nutrient-screening result. It is not a fertilizer product or dose recommendation.</p>
                </div>
              </div>
              <div className="card p-5">
                <h3 className="font-bold text-sm text-[var(--color-text)] mb-4">Predicted nutrient ratings</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {Object.entries(prediction.ratings).map(([nutrient, rating]) => {
                    const field = NUTRIENT_INPUT_FIELDS[nutrient];
                    const inputLabel = NUMERIC_FIELDS.find(([key]) => key === field);
                    const inputValue = prediction.inputSnapshot?.[field];
                    return (
                    <div key={nutrient} className="rounded-xl border border-[var(--color-border)] p-4 text-center">
                      <p className="text-xs text-[var(--color-text-muted)]">{nutrient}</p>
                      <p className="mt-1 text-lg font-bold text-[var(--color-text)]">{rating}</p>
                      <p className="mt-1 text-[0.68rem] text-[var(--color-text-muted)]">Input: {inputLabel?.[1]} — {inputValue} {inputLabel?.[2]}</p>
                    </div>
                    );
                  })}
                </div>
                <p className="mt-4 text-xs text-[var(--color-text-muted)]">Ratings are model classifications, not a fertilizer prescription. Ask a local agronomist for application rates.</p>
              </div>
              <div className="card p-5">
                <h3 className="font-bold text-sm text-[var(--color-text)]">How the model makes this prediction</h3>
                <p className="mt-2 text-xs leading-relaxed text-[var(--color-text-muted)]">The trained multi-output classifier receives 12 numeric soil readings plus soil type and season. It predicts a Low, Medium, or High category for each of nine nutrients. The model package does not include its training dataset, evaluation metrics, or a reliable per-result explanation, so KisanAI cannot currently say which reading caused a particular rating or how accurate it is for this farm.</p>
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  {[...NUMERIC_FIELDS.map(([key]) => [FIELD_LABELS[key], prediction.inputSnapshot?.[key]]), ['Soil type', prediction.inputSnapshot?.Soil_Type], ['Season', prediction.inputSnapshot?.Season]].map(([label, value]) => (
                    <div key={label} className="rounded-lg bg-[var(--color-bg)] p-2"><span className="text-[var(--color-text-muted)]">{label}</span><strong className="block mt-0.5 text-[var(--color-text)]">{value ?? 'Not supplied'}</strong></div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
