// src/pages/Disease.jsx
// AI-powered crop disease detection with image upload

import { useState, useRef } from 'react';
import PageHeader from '../components/ui/PageHeader';
import ProgressBar from '../components/ui/ProgressBar';
import toast from 'react-hot-toast';
import { Upload, Bug, Loader2, X, CheckCircle, AlertTriangle, Leaf, Camera } from 'lucide-react';

const MOCK_DISEASES = [
  { name: 'Early Blight (Alternaria solani)', confidence: 89, severity: 'Moderate', crop: 'Tomato', treatments: ['Apply Mancozeb 75 WP @ 2g/L every 7 days', 'Remove infected leaves immediately', 'Improve air circulation between plants', 'Avoid overhead watering'], prevention: 'Use disease-resistant varieties and practice crop rotation. Apply copper-based fungicide preventively.' },
  { name: 'Powdery Mildew', confidence: 76, severity: 'Low', crop: 'Wheat', treatments: ['Apply Sulfur 80 WP @ 3g/L', 'Use Propiconazole 25 EC @ 1mL/L', 'Improve field drainage'], prevention: 'Avoid excessive nitrogen fertilization. Maintain proper plant spacing.' },
  { name: 'Leaf Blight (Helminthosporium)', confidence: 92, severity: 'High', crop: 'Maize', treatments: ['Apply Carbendazim 50 WP @ 1g/L', 'Spray Trifloxystrobin + Tebuconazole', 'Destroy infected crop debris'], prevention: 'Use certified disease-free seeds. Apply seed treatment before sowing.' },
];

const HISTORY = [
  { id: 1, date: '2026-07-15', crop: 'Tomato', disease: 'Early Blight', confidence: 89, severity: 'Moderate', status: 'treated' },
  { id: 2, date: '2026-07-10', crop: 'Wheat', disease: 'Rust', confidence: 72, severity: 'Low', status: 'monitoring' },
  { id: 3, date: '2026-07-05', crop: 'Onion', disease: 'Thrips', confidence: 95, severity: 'High', status: 'treated' },
];

export default function Disease() {
  const [dragOver, setDragOver] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const fileRef = useRef(null);

  const handleFile = (file) => {
    if (!file || !file.type.startsWith('image/')) {
      toast.error('Please upload a valid image file.');
      return;
    }
    const url = URL.createObjectURL(file);
    setSelectedImage(url);
    setResult(null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  };

  const handleAnalyze = async () => {
    if (!selectedImage) return;
    setAnalyzing(true);
    await new Promise(r => setTimeout(r, 2500));
    const mock = MOCK_DISEASES[Math.floor(Math.random() * MOCK_DISEASES.length)];
    setResult(mock);
    setAnalyzing(false);
    toast.success('Analysis complete!');
  };

  const severityColor = (s) => ({ Low: 'badge-green', Moderate: 'badge-yellow', High: 'badge-red' }[s] || 'badge-blue');

  return (
    <div className="page-content">
      <PageHeader title="AI Disease Detection" subtitle="Upload a crop photo for instant AI-powered diagnosis" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        {/* Upload section */}
        <div className="space-y-4">
          {/* Drop zone */}
          <div
            className={`relative card p-8 text-center cursor-pointer transition-all border-2 border-dashed ${dragOver ? 'border-green-500 bg-green-50 dark:bg-green-950/20 scale-[1.01]' : 'border-[var(--color-border)] hover:border-green-400'}`}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
          >
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => handleFile(e.target.files[0])} />

            {selectedImage
              ? <div className="relative">
                <img src={selectedImage} alt="Crop" className="w-full max-h-56 object-contain rounded-xl mx-auto" />
                <button
                  onClick={e => { e.stopPropagation(); setSelectedImage(null); setResult(null); }}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-500 text-white flex items-center justify-center shadow"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              : <div className="space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-green-50 dark:bg-green-950/30 flex items-center justify-center mx-auto">
                  <Camera className="w-8 h-8 text-green-400" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-[var(--color-text)]">Drop crop image here</p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">or click to browse · JPG, PNG, WebP · Max 10MB</p>
                </div>
                <p className="text-xs text-green-600 font-medium">📸 Take a clear photo of affected leaves/plants</p>
              </div>
            }
          </div>

          {selectedImage && (
            <button
              onClick={handleAnalyze}
              disabled={analyzing}
              className="btn-primary w-full flex items-center justify-center gap-2 h-11"
            >
              {analyzing
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing with AI...</>
                : <><Bug className="w-4 h-4" /> Detect Disease</>
              }
            </button>
          )}

          {/* Tips */}
          <div className="card p-4">
            <h4 className="font-bold text-xs text-[var(--color-text)] mb-3">📋 For Best Results</h4>
            <ul className="space-y-1.5">
              {['Capture affected leaves/stem/fruit clearly', 'Use natural daylight — avoid shadows', 'Include both healthy and diseased parts', 'Keep camera steady, avoid blur'].map(t => (
                <li key={t} className="flex items-start gap-2 text-xs text-[var(--color-text-muted)]">
                  <CheckCircle className="w-3.5 h-3.5 text-green-500 mt-0.5 shrink-0" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Results */}
        <div>
          {analyzing && (
            <div className="card p-8 text-center fade-in">
              <div className="w-16 h-16 rounded-2xl bg-purple-50 dark:bg-purple-950/30 flex items-center justify-center mx-auto mb-4">
                <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
              </div>
              <p className="font-bold text-sm text-[var(--color-text)] mb-2">AI is analyzing your crop...</p>
              <div className="space-y-2 text-xs text-[var(--color-text-muted)]">
                <p>🔍 Detecting visual patterns</p>
                <p>🧬 Matching disease signatures</p>
                <p>💊 Generating treatment plan</p>
              </div>
            </div>
          )}

          {result && !analyzing && (
            <div className="space-y-4 fade-in">
              {/* Diagnosis card */}
              <div className="card p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="w-5 h-5 text-amber-500" />
                      <h3 className="font-bold text-base text-[var(--color-text)]">{result.name}</h3>
                    </div>
                    <div className="flex gap-2">
                      <span className={`badge ${severityColor(result.severity)}`}>Severity: {result.severity}</span>
                      <span className="badge badge-blue">{result.crop}</span>
                    </div>
                  </div>
                </div>

                <div className="mb-4">
                  <ProgressBar value={result.confidence} label="AI Confidence" color={result.confidence >= 80 ? 'green' : 'yellow'} />
                </div>

                {/* Treatments */}
                <div className="mb-4">
                  <h4 className="font-bold text-xs text-[var(--color-text)] mb-2">💊 Recommended Treatments</h4>
                  <ul className="space-y-2">
                    {result.treatments.map((t, i) => (
                      <li key={i} className="flex items-start gap-2 p-2.5 rounded-xl bg-green-50 dark:bg-green-950/20">
                        <span className="w-5 h-5 rounded-full bg-green-500 text-white text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                        <span className="text-xs text-[var(--color-text)] leading-relaxed">{t}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Prevention */}
                <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30">
                  <div className="flex items-center gap-2 mb-1">
                    <Leaf className="w-4 h-4 text-blue-500" />
                    <span className="font-bold text-xs text-blue-700 dark:text-blue-400">Prevention</span>
                  </div>
                  <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">{result.prevention}</p>
                </div>

                <button
                  onClick={() => { setSelectedImage(null); setResult(null); }}
                  className="btn-secondary w-full mt-4 text-sm"
                >
                  Analyze Another Image
                </button>
              </div>
            </div>
          )}

          {!result && !analyzing && (
            <div className="card p-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gray-50 dark:bg-slate-700 flex items-center justify-center mx-auto mb-4">
                <Bug className="w-8 h-8 text-gray-400" />
              </div>
              <p className="font-semibold text-sm text-[var(--color-text)]">Upload an image to analyze</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">Our AI can detect 50+ crop diseases with high accuracy</p>
            </div>
          )}
        </div>
      </div>

      {/* Detection History */}
      <div className="card p-5">
        <h3 className="font-bold text-sm text-[var(--color-text)] mb-4">Detection History</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
                <th className="pb-2 font-semibold">Date</th>
                <th className="pb-2 font-semibold">Crop</th>
                <th className="pb-2 font-semibold">Disease</th>
                <th className="pb-2 font-semibold">Confidence</th>
                <th className="pb-2 font-semibold">Severity</th>
                <th className="pb-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {HISTORY.map(h => (
                <tr key={h.id} className="text-[var(--color-text)]">
                  <td className="py-2.5">{h.date}</td>
                  <td className="py-2.5 font-medium">{h.crop}</td>
                  <td className="py-2.5">{h.disease}</td>
                  <td className="py-2.5">
                    <span className={`badge ${h.confidence >= 80 ? 'badge-green' : 'badge-yellow'}`}>{h.confidence}%</span>
                  </td>
                  <td className="py-2.5"><span className={`badge ${severityColor(h.severity)}`}>{h.severity}</span></td>
                  <td className="py-2.5"><span className={`badge ${h.status === 'treated' ? 'badge-green' : 'badge-yellow'}`}>{h.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
