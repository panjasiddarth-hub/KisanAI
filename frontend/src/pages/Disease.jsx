// src/pages/Disease.jsx — Disease agent: crop + symptoms (+ optional photo) → diagnosis
import { useEffect, useState } from 'react';
import { api, isOfflineError, apiErrorMessage } from '../api/client';
import { FALLBACK_META } from '../api/fallback';
import OfflineCard from '../components/ui/OfflineCard';
import {
  Stethoscope, Loader2, Sparkles, UploadCloud, X, CheckCircle2,
  ShieldCheck, FlaskConical, Leaf, ImageIcon
} from 'lucide-react';
import toast from 'react-hot-toast';

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const confColor = (c) => (c >= 70 ? 'text-red-500' : c >= 40 ? 'text-amber-500' : 'text-slate-400');
const confBar = (c) => (c >= 70 ? 'from-red-500 to-orange-500' : c >= 40 ? 'from-amber-400 to-yellow-500' : 'from-slate-400 to-slate-500');

export default function Disease() {
  const [meta, setMeta] = useState(FALLBACK_META);
  const [crop, setCrop] = useState('cotton');
  const [selected, setSelected] = useState([]);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    api.get('/agents/meta').then(r => setMeta(r.data)).catch(() => {});
  }, []);

  const toggleSymptom = (id) =>
    setSelected(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { toast.error('Image must be under 5 MB'); return; }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const clearFile = () => { setFile(null); setPreview(null); };

  const submit = async (e) => {
    e.preventDefault();
    if (selected.length === 0) { toast.error('Select at least one symptom'); return; }
    setBusy(true); setOffline(false);
    try {
      const fd = new FormData();
      fd.append('crop', crop);
      fd.append('symptoms', JSON.stringify(selected));
      if (file) fd.append('image', file);
      const { data } = await api.post('/agents/disease', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setResult(data);
    } catch (err) {
      if (isOfflineError(err)) { setOffline(true); setResult(null); }
      else toast.error(apiErrorMessage(err));
    } finally { setBusy(false); }
  };

  return (
    <div className="page-content" style={{ maxWidth: '1100px' }}>
      <div className="mb-5">
        <h2 className="text-xl font-extrabold text-[var(--color-text)] flex items-center gap-2">
          <span className="w-9 h-9 rounded-xl bg-red-100 dark:bg-red-950/50 flex items-center justify-center"><Stethoscope className="w-5 h-5 text-red-500" /></span>
          Disease Agent
        </h2>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">Tell the agent what you see on the crop — it matches symptoms against known disease signatures.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[400px_minmax(0,1fr)] gap-5 items-start">
        {/* Input */}
        <form onSubmit={submit} className="card p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-[var(--color-text)] block mb-1.5">Crop</label>
            <div className="grid grid-cols-3 gap-2">
              {meta.diseaseCrops.map(c => (
                <button type="button" key={c} onClick={() => { setCrop(c); setResult(null); }}
                  className={`py-2 rounded-xl text-xs font-bold border transition-colors ${crop === c ? 'bg-[#15803d] text-white border-[#15803d]' : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-green-400'}`}>
                  {c === 'paddy' ? 'Paddy (Rice)' : cap(c)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-[var(--color-text)] block mb-1.5">
              Symptoms observed <span className="text-green-600">({selected.length} selected)</span>
            </label>
            <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto pr-1">
              {meta.symptoms.map(s => (
                <button type="button" key={s.id} onClick={() => toggleSymptom(s.id)}
                  className={`text-[0.68rem] font-semibold px-2.5 py-1.5 rounded-full border transition-colors ${selected.includes(s.id) ? 'bg-red-500 text-white border-red-500' : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-red-300'}`}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-[var(--color-text)] block mb-1.5">Leaf photo <span className="text-[var(--color-text-muted)] font-normal">(optional — beta visual triage)</span></label>
            {preview ? (
              <div className="relative inline-block">
                <img src={preview} alt="Leaf sample" className="w-28 h-28 object-cover rounded-xl border border-[var(--color-border)]" />
                <button type="button" onClick={clearFile} className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow"><X className="w-3.5 h-3.5" /></button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-[var(--color-border)] rounded-xl py-5 cursor-pointer hover:border-green-400 transition-colors">
                <UploadCloud className="w-6 h-6 text-[var(--color-text-muted)]" />
                <span className="text-[0.7rem] text-[var(--color-text-muted)]">Click to upload JPG/PNG (max 5 MB)</span>
                <input type="file" accept="image/*" className="hidden" onChange={onFile} />
              </label>
            )}
          </div>

          <button type="submit" disabled={busy} className="w-full flex items-center justify-center gap-2 bg-[#15803d] hover:bg-[#166534] disabled:opacity-60 text-white font-bold text-sm py-3 rounded-xl transition-colors">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {busy ? 'Diagnosing…' : 'Diagnose'}
          </button>
        </form>

        {/* Results */}
        <div className="space-y-4">
          {offline && <OfflineCard onRetry={submit} />}
          {!offline && !result && (
            <div className="card p-8 text-center text-sm text-[var(--color-text-muted)]">
              <Stethoscope className="w-10 h-10 mx-auto mb-3 text-red-300" />
              Pick the crop, tick the symptoms you see, optionally attach a photo, then press <b>Diagnose</b>.
            </div>
          )}
          {result && (
            <>
              <div className="rounded-2xl border border-green-200/70 bg-[#e9f7ee] dark:bg-green-950/15 dark:border-green-900/30 p-4 flex gap-3">
                <span className="w-8 h-8 rounded-full bg-[#15803d] flex items-center justify-center shrink-0"><Sparkles className="w-4 h-4 text-white" /></span>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-bold text-sm text-[var(--color-text)]">Agent's Reading</h4>
                    <span className={`badge ${result.explanationSource === 'gemini' ? 'badge-purple' : 'badge-blue'}`}>
                      {result.explanationSource === 'gemini' ? '✨ Gemini AI' : 'Rule Engine'}
                    </span>
                  </div>
                  <p className="text-[0.82rem] text-[var(--color-text)] leading-relaxed mt-1.5">{result.explanation}</p>
                  {result.photoAnalysis && (
                    <p className="text-[0.72rem] text-indigo-600 dark:text-indigo-400 mt-2 flex gap-1.5"><ImageIcon className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {result.photoAnalysis}</p>
                  )}
                </div>
              </div>

              {result.diagnosis.map((d, i) => (
                <div key={d.name} className={`card p-5 fade-in ${i === 0 ? 'ring-2 ring-red-400/40' : ''}`}>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <h4 className="font-bold text-sm text-[var(--color-text)]">{i === 0 && <span className="text-red-500 mr-1">●</span>}{d.name}</h4>
                      <p className="text-[0.7rem] text-[var(--color-text-muted)] mt-0.5">{d.pathogen}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-2xl font-extrabold ${confColor(d.confidence)}`}>{d.confidence}%</p>
                      <p className="text-[0.62rem] text-[var(--color-text-muted)]">confidence</p>
                    </div>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden">
                    <div className={`h-full rounded-full bg-gradient-to-r ${confBar(d.confidence)}`} style={{ width: `${d.confidence}%` }} />
                  </div>

                  {d.matchedSymptoms.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {d.matchedSymptoms.map(s => (
                        <span key={s} className="inline-flex items-center gap-1 text-[0.66rem] font-medium px-2 py-1 rounded-lg bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400"><CheckCircle2 className="w-3 h-3" /> {s}</span>
                      ))}
                    </div>
                  )}

                  {i === 0 && (
                    <>
                      <div className="grid sm:grid-cols-2 gap-3 mt-4">
                        <div className="rounded-xl bg-blue-50 dark:bg-blue-950/20 p-3">
                          <p className="flex items-center gap-1.5 text-[0.72rem] font-bold text-blue-700 dark:text-blue-400 mb-1"><FlaskConical className="w-3.5 h-3.5" /> Chemical control</p>
                          <p className="text-[0.74rem] text-[var(--color-text)] leading-relaxed">{d.treatment.chemical}</p>
                        </div>
                        <div className="rounded-xl bg-green-50 dark:bg-green-950/20 p-3">
                          <p className="flex items-center gap-1.5 text-[0.72rem] font-bold text-green-700 dark:text-green-400 mb-1"><Leaf className="w-3.5 h-3.5" /> Organic / IPM</p>
                          <p className="text-[0.74rem] text-[var(--color-text)] leading-relaxed">{d.treatment.organic}</p>
                        </div>
                      </div>
                      <div className="mt-3">
                        <p className="flex items-center gap-1.5 text-[0.72rem] font-bold text-[var(--color-text)] mb-1.5"><ShieldCheck className="w-3.5 h-3.5 text-green-600" /> Prevention for next season</p>
                        <ul className="space-y-1">
                          {d.prevention.map((p, j) => <li key={j} className="text-[0.74rem] text-[var(--color-text-muted)] flex gap-2"><span className="text-green-600 font-bold">•</span>{p}</li>)}
                        </ul>
                      </div>
                    </>
                  )}
                </div>
              ))}
              <p className="text-[0.68rem] text-[var(--color-text-muted)] text-center italic">{result.disclaimer}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
