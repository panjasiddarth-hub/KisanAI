import { useEffect, useState } from 'react';
import { api, isOfflineError, apiErrorMessage } from '../api/client';
import { FALLBACK_META } from '../api/fallback';
import OfflineCard from '../components/ui/OfflineCard';
import { Stethoscope, Loader2, Sparkles, UploadCloud, X } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Disease() {
  const [meta, setMeta] = useState(FALLBACK_META);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    api.get('/agents/meta').then((response) => setMeta(response.data)).catch(() => {});
  }, []);

  const onFile = (event) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;
    if (selectedFile.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5 MB');
      event.target.value = '';
      return;
    }
    if (!['image/jpeg', 'image/png'].includes(selectedFile.type)) {
      toast.error('Choose a JPG or PNG image');
      event.target.value = '';
      return;
    }
    setFile(selectedFile);
    setPreview(URL.createObjectURL(selectedFile));
    setResult(null);
  };

  const clearFile = () => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
    setResult(null);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!file) {
      toast.error('Upload a leaf photo first');
      return;
    }
    setBusy(true);
    setOffline(false);
    try {
      const form = new FormData();
      form.append('image', file);
      const { data } = await api.post('/agents/disease', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(data);
    } catch (error) {
      if (isOfflineError(error)) {
        setOffline(true);
        setResult(null);
      } else {
        toast.error(apiErrorMessage(error));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page-content" style={{ maxWidth: '1100px' }}>
      <div className="mb-5">
        <h2 className="text-xl font-extrabold text-[var(--color-text)] flex items-center gap-2">
          <span className="w-9 h-9 rounded-xl bg-red-100 dark:bg-red-950/50 flex items-center justify-center">
            <Stethoscope className="w-5 h-5 text-red-500" />
          </span>
          Disease Agent
        </h2>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          Upload a crop leaf photo for preliminary image-model screening.
        </p>
      </div>

      {!meta.diseaseModelAvailable && (
        <div role="status" className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          Disease image screening is disabled while its model artifact or TensorFlow runtime is unavailable.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[400px_minmax(0,1fr)] gap-5 items-start">
        <form onSubmit={submit} className="card p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-[var(--color-text)] block mb-1.5">Leaf photo</label>
            {preview ? (
              <div className="relative inline-block">
                <img src={preview} alt="Uploaded leaf" className="w-28 h-28 object-cover rounded-xl border border-[var(--color-border)]" />
                <button type="button" onClick={clearFile} aria-label="Remove photo" className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-[var(--color-border)] rounded-xl py-5 cursor-pointer hover:border-green-400 transition-colors">
                <UploadCloud className="w-6 h-6 text-[var(--color-text-muted)]" />
                <span className="text-[0.7rem] text-[var(--color-text-muted)]">Click to upload JPG/PNG (max 5 MB)</span>
                <input type="file" accept="image/jpeg,image/png" className="hidden" onChange={onFile} />
              </label>
            )}
          </div>

          <button type="submit" disabled={busy || !meta.diseaseModelAvailable} className="w-full flex items-center justify-center gap-2 bg-[#15803d] hover:bg-[#166534] disabled:opacity-60 text-white font-bold text-sm py-3 rounded-xl transition-colors">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {busy ? 'Running model…' : meta.diseaseModelAvailable ? 'Run screening' : 'Model unavailable'}
          </button>
        </form>

        <div className="space-y-4">
          {offline && <OfflineCard onRetry={submit} />}
          {!offline && !result && (
            <div className="card p-8 text-center text-sm text-[var(--color-text-muted)]">
              <Stethoscope className="w-10 h-10 mx-auto mb-3 text-red-300" />
              Upload a clear leaf photo from one of the model's supported crops, then press <b>Run screening</b>.
            </div>
          )}
          {result && (
            <div className="card p-5 space-y-3">
              <h3 className="font-bold text-[var(--color-text)]">Image screening result</h3>
              {result.accepted ? (
                <>
                  <p className="text-lg font-bold text-[var(--color-text)]">{result.prediction.replaceAll('___', ' — ').replaceAll('_', ' ')}</p>
                  <p className="text-sm text-[var(--color-text-muted)]">Model score: {result.confidence}%</p>
                </>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    The model’s top score was {result.confidence}%, below the {result.threshold}% cutoff, so no disease label is shown. This does not mean the leaf is healthy.
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Try a sharp, close-up photo of one leaf in good light. Field photos may differ from the images used to train this model.
                  </p>
                </div>
              )}
              <p className="text-xs text-[var(--color-text-muted)]">{result.disclaimer}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
