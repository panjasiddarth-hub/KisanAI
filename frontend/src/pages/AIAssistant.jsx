import { useEffect, useRef, useState } from 'react';
import { Bot, Loader2, Mic, MicOff, RefreshCw, Send, Volume2, VolumeX } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import { api } from '../api/client';

const LANGUAGES = [
  { name: 'English', code: 'en-IN' },
  { name: 'हिन्दी', code: 'hi-IN' },
  { name: 'తెలుగు', code: 'te-IN' },
  { name: 'தமிழ்', code: 'ta-IN' },
  { name: 'ಕನ್ನಡ', code: 'kn-IN' },
  { name: 'मराठी', code: 'mr-IN' },
];

const SUGGESTIONS = [
  'How do I improve soil health?',
  'What information should I use to choose a crop?',
  'What should I verify before selling a crop?',
];

const OFFICIAL_REFERENCES = [
  { label: 'PM-KISAN', url: 'https://pmkisan.gov.in/' },
  { label: 'Kisan Credit Card eligibility', url: 'https://fasalrin.gov.in/eligibility' },
  { label: 'Soil Health Card Portal', url: 'https://soilhealth.dac.gov.in/' },
];

function Message({ message, onSpeak }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isUser ? 'bg-green-600' : 'bg-indigo-600'}`}>
        {isUser ? <span className="text-white text-xs">You</span> : <Bot className="w-4 h-4 text-white" />}
      </div>
      <div className={`max-w-[82%] flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
        <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${isUser ? 'bg-green-600 text-white rounded-tr-sm' : 'bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] rounded-tl-sm'}`}>
          {message.content}
        </div>
        {!isUser && message.sources?.length > 0 && (
          <details className="text-xs text-[var(--color-text-muted)]">
            <summary className="cursor-pointer">Sources ({message.sources.length})</summary>
            <ul className="list-disc pl-5 mt-1 space-y-1">
              {message.sources.map((source, index) => <li key={index}>{source.title || source.source || `Reference ${index + 1}`}</li>)}
            </ul>
          </details>
        )}
        {!isUser && message.content && <button className="text-xs text-indigo-600 flex items-center gap-1" onClick={() => onSpeak(message.content)}><Volume2 className="w-3 h-3" /> Listen</button>}
        <span className="text-[0.65rem] text-[var(--color-text-muted)]">{message.time}</span>
      </div>
    </div>
  );
}

export default function AIAssistant() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [language, setLanguage] = useState(LANGUAGES[0]);
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');
  const [knowledgeAssistantAvailable, setKnowledgeAssistantAvailable] = useState(false);
  const bottomRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);
  useEffect(() => () => recognitionRef.current?.stop(), []);
  useEffect(() => {
    let active = true;
    api.get('/agents/meta')
      .then(({ data }) => { if (active) setKnowledgeAssistantAvailable(data.knowledgeAssistantAvailable === true); })
      .catch(() => { if (active) setKnowledgeAssistantAvailable(false); });
    return () => { active = false; };
  }, []);

  const speak = (text) => {
    if (!('speechSynthesis' in window)) {
      setError('Speech playback is not supported by this browser.');
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language.code;
    window.speechSynthesis.speak(utterance);
  };

  const toggleListening = () => {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Speech recognition is not supported by this browser. You can still type your question.');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = language.code;
    recognition.interimResults = false;
    recognition.onresult = (event) => setInput((current) => `${current}${current ? ' ' : ''}${event.results[0][0].transcript}`);
    recognition.onerror = () => setError('Could not recognize speech. Check microphone permission and try again.');
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setError('');
    setListening(true);
    recognition.start();
  };

  const sendMessage = async (text = input) => {
    if (!knowledgeAssistantAvailable) return;
    const question = text.trim();
    if (!question || loading) return;
    const now = () => new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    setMessages((previous) => [...previous, { role: 'user', content: question, time: now() }]);
    setInput('');
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/orchestrator', { question, language: language.name });
      const rag = data.agentResults?.rag;
      const answer = data.orchestration?.answer?.text
        || (rag?.error ? `I couldn't retrieve the knowledge sources: ${rag.error}` : 'No grounded answer was returned.');
      setMessages((previous) => [...previous, {
        role: 'assistant',
        content: answer,
        sources: rag?.results || [],
        validation: data.orchestration?.validation?.status,
        time: now(),
      }]);
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Could not reach the KisanAI assistant. Check that the backend and ML service are running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-content">
      <PageHeader title="KisanAI Assistant" subtitle={knowledgeAssistantAvailable ? 'Answers based on verified reference documents, with browser speech tools' : 'Knowledge assistant paused while its source documents are verified'} />
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-[var(--color-border)]">
          <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center"><Bot className="w-5 h-5 text-white" /></div>
          <div className="mr-auto"><p className="font-bold text-sm">Farm knowledge assistant</p><p className="text-xs text-[var(--color-text-muted)]">{knowledgeAssistantAvailable ? 'Disease diagnosis is unavailable. Verify important advice with current official sources.' : 'Replies are paused because the bundled reference documents have no verified provenance or publication date.'}</p></div>
          <label className="text-xs flex items-center gap-2">Language
            <select className="input py-1" value={language.code} onChange={(event) => setLanguage(LANGUAGES.find((item) => item.code === event.target.value) || LANGUAGES[0])}>
              {LANGUAGES.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
            </select>
          </label>
          <button aria-label="Stop speech" title="Stop speech" className="p-2 rounded-lg hover:bg-gray-100" onClick={() => window.speechSynthesis?.cancel()}><VolumeX className="w-4 h-4" /></button>
          <button aria-label="Clear conversation" title="Clear conversation" className="p-2 rounded-lg hover:bg-gray-100" onClick={() => setMessages([])}><RefreshCw className="w-4 h-4" /></button>
        </div>

        <div className="h-[26rem] overflow-y-auto p-5 space-y-4 bg-gray-50/50 dark:bg-slate-800/20">
          {messages.length === 0 && <div className="max-w-xl mx-auto text-center py-10"><Bot className="w-10 h-10 mx-auto mb-3 text-indigo-500" /><p className="font-semibold">{knowledgeAssistantAvailable ? 'Ask a farming question' : 'Assistant replies are temporarily paused'}</p><p className="text-sm text-[var(--color-text-muted)] mt-1">{knowledgeAssistantAvailable ? 'Model predictions remain in their dedicated crop, soil, and market tools.' : 'Use these official portals for current scheme information while the knowledge sources are being verified.'}</p>{!knowledgeAssistantAvailable && <ul className="mt-4 flex flex-wrap justify-center gap-3">{OFFICIAL_REFERENCES.map(reference => <li key={reference.url}><a className="text-sm font-semibold text-emerald-700 underline dark:text-emerald-400" href={reference.url} target="_blank" rel="noopener noreferrer">{reference.label}</a></li>)}</ul>}</div>}
          {messages.map((message, index) => <Message key={index} message={message} onSpeak={speak} />)}
          {loading && <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]"><Loader2 className="w-4 h-4 animate-spin" />Retrieving sources and preparing an answer…</div>}
          <div ref={bottomRef} />
        </div>

        {error && <p role="alert" className="px-5 pt-3 text-sm text-red-600">{error}</p>}
        <div className="px-5 py-3 border-t border-[var(--color-border)]">
          {knowledgeAssistantAvailable && <div className="flex flex-wrap gap-2 mb-3">{SUGGESTIONS.map((question) => <button key={question} onClick={() => sendMessage(question)} disabled={loading} className="px-3 py-1.5 rounded-full bg-green-50 text-green-800 text-xs border border-green-200 disabled:opacity-50">{question}</button>)}</div>}
          <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); sendMessage(); }}>
            <button type="button" aria-label={listening ? 'Stop listening' : 'Start voice input'} title={listening ? 'Stop listening' : 'Speak your question'} onClick={toggleListening} disabled={!knowledgeAssistantAvailable} className={`btn-secondary px-3 ${listening ? 'text-red-600' : ''} disabled:opacity-50`}>{listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}</button>
            <input value={input} onChange={(event) => setInput(event.target.value)} placeholder={knowledgeAssistantAvailable ? `Ask in ${language.name}…` : 'Assistant unavailable until sources are verified'} className="input flex-1" disabled={!knowledgeAssistantAvailable || loading} />
            <button type="submit" disabled={!knowledgeAssistantAvailable || !input.trim() || loading} className="btn-primary px-4 disabled:opacity-50">{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}</button>
          </form>
        </div>
      </div>
      <p className="text-center text-xs text-[var(--color-text-muted)] mt-3">Voice recognition and playback depend on browser support. Multilingual text answers require GEMINI_API_KEY. Official scheme links are available above while assistant replies are paused.</p>
    </div>
  );
}
