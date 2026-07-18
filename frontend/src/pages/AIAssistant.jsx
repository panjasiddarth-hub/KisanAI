// src/pages/AIAssistant.jsx
// Multi-agent AI assistant with chat interface and agent cards

import { useState, useRef, useEffect } from 'react';
import PageHeader from '../components/ui/PageHeader';
import { Bot, Send, User, Zap, RefreshCw, Loader2, Sparkles } from 'lucide-react';

const AGENTS = [
  { id: 'crop', name: 'Crop Agent', emoji: '🌱', description: 'Crop recommendation, sowing calendar, fertilization schedules', status: 'completed' },
  { id: 'weather', name: 'Weather Agent', emoji: '🌦️', description: 'Rainfall forecast, temperature trends, agricultural weather advisory', status: 'running' },
  { id: 'disease', name: 'Disease Agent', emoji: '🔬', description: 'Crop disease detection, treatment plans, prevention strategies', status: 'waiting' },
  { id: 'market', name: 'Market Agent', emoji: '📈', description: 'Live crop prices, market trends, selling recommendations', status: 'generating' },
  { id: 'finance', name: 'Finance Agent', emoji: '💰', description: 'Profit forecasting, loan eligibility, cost analysis', status: 'completed' },
  { id: 'scheme', name: 'Gov. Scheme Agent', emoji: '🏛️', description: 'Eligible government schemes, subsidy calculation, application guidance', status: 'completed' },
  { id: 'explainer', name: 'Explainable AI Agent', emoji: '🧠', description: 'Explains AI decisions in simple language, builds farmer trust', status: 'waiting' },
];

const STATUS_STYLE = {
  completed: { dot: 'completed', label: 'Completed', badge: 'badge-green' },
  running: { dot: 'running', label: 'Running...', badge: 'badge-yellow' },
  waiting: { dot: 'waiting', label: 'Waiting', badge: '' },
  generating: { dot: 'generating', label: 'Generating', badge: 'badge-purple' },
};

const SAMPLE_QUESTIONS = [
  '🌾 What crops should I sow in Rabi season?',
  '🔬 Why does my Tomato have yellow leaves?',
  '💧 When should I irrigate my Wheat field?',
  '📊 What is the best time to sell my Onion?',
  '🏛️ Am I eligible for PM-KISAN scheme?',
  '🌦️ Will it rain this week in Nashik?',
];

const INITIAL_MESSAGES = [
  { role: 'assistant', content: '🌾 Namaskar! I am your **Sampoorn Kisan AI Sahayak**.\n\nI have **7 specialized AI agents** working together to help you with:\n- Crop planning & recommendations\n- Disease detection & treatment\n- Weather & irrigation advice\n- Market prices & selling tips\n- Government schemes & subsidies\n\nHow can I help you today? You can ask me anything about your farm! 🌱', time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) },
];

const AGENT_RESPONSES = {
  crop: '🌱 **Crop Agent Analysis Complete**\n\nBased on your soil profile (Black Cotton soil, pH 7.2) and current season, I recommend:\n1. **Wheat (HD-2967)** — Best suited for your soil. Expected yield: 18-22 q/acre.\n2. **Chickpea (JAKI-9218)** — Excellent for nitrogen fixation. 10-12 q/acre expected.\n3. **Mustard (Pusa Bold)** — High market demand, low water requirement.\n\n💡 *Sow wheat between Nov 1-15 for optimal yield.*',
  weather: '🌦️ **Weather Agent Report**\n\nNext 7 days for Nashik district:\n- **Today-Tue**: Partly cloudy, 28-30°C, no rain\n- **Wednesday**: ⛈️ Heavy rain likely (80% probability, 45-60mm)\n- **Thu-Fri**: Light showers, 25-27°C\n- **Weekend**: Clear skies returning\n\n⚠️ **Advisory**: Complete Soybean harvest before Wednesday. Delay pesticide spray until Friday.',
  disease: '🔬 **Disease Agent Report**\n\nYellow leaves on Tomato can indicate:\n1. **Early Blight** (most likely, 78% match) — Brown spots with yellow halos\n2. **Nitrogen deficiency** (22% probability) — Uniform yellowing from older leaves\n\n💊 **Treatment**: Apply Mancozeb 75 WP @ 2g/L + urea spray (2%) immediately. Repeat after 7 days.\n\n*Upload an image for precise AI diagnosis with 95% accuracy.*',
  market: '📈 **Market Agent Update**\n\nCurrent best prices (Jul 18, 2026):\n- **Onion**: ₹1,850/q at Lasalgaon APMC (+12.5% ↑)\n- **Wheat**: ₹2,350/q at Nashik APMC (+3.2% ↑)\n- **Tomato**: ₹2,100/q at Pune APMC (-8.3% ↓)\n\n💡 **Advice**: Hold onion stock for 2 more weeks. Prices expected to rise 15% before Diwali season.',
  finance: '💰 **Finance Agent Report**\n\nYour financial summary:\n- Monthly profit: **₹85,000** (+22% vs last month)\n- Annual projection: **₹10.2 Lakhs**\n- KCC loan eligibility: **₹2.5 Lakhs** at 4% p.a.\n\n📋 **PM-KISAN Status**: Next installment of ₹2,000 expected in October 2026.',
  scheme: '🏛️ **Government Scheme Agent**\n\nYou are eligible for **4 schemes**:\n1. **PM-KISAN**: ₹6,000/year (Next: Oct 2026)\n2. **PM Fasal Bima**: Crop insurance for Kharif\n3. **KCC**: ₹2.5L loan at 4% interest\n4. **Soil Health Card**: Free soil testing\n\n*Apply for Fasal Bima before the cut-off date this month!*',
  explainer: '🧠 **Explainable AI Agent**\n\nYou asked why AI recommended Wheat for your farm:\n\nThe AI analyzed 12 factors:\n✅ Soil type (Black Cotton) — **+25 points** (Wheat thrives here)\n✅ pH 7.2 — **+15 points** (Ideal range: 6.5-7.5)\n✅ Water source (Borewell) — **+10 points** (Reliable irrigation)\n✅ November sowing date — **+20 points** (Optimal window)\n❌ Late monsoon exit — **-5 points** (Risk of stem rust)\n\nFinal confidence: **87%** that Wheat is your best Rabi choice.',
  default: '🤖 I\'m consulting my specialized agents to answer your question. Our **Crop Agent**, **Market Agent**, and **Weather Agent** are analyzing your query...\n\nBased on your farm profile in Nashik, Maharashtra:\n\n📍 Your 3 farms total 16.1 acres with healthy soil conditions. The AI recommends focusing on high-value crops (Onion, Soybean) and timely irrigation to maximize profit this season.\n\n*For specific queries, try asking about: diseases, prices, schemes, irrigation, or crop recommendations.*',
};

function MessageBubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''} fade-in`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isUser ? 'bg-green-500' : 'bg-gradient-to-br from-indigo-500 to-purple-600'}`}>
        {isUser ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-white" />}
      </div>
      <div className={`max-w-[80%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        <div className={`px-4 py-3 rounded-2xl text-xs leading-relaxed whitespace-pre-line ${isUser ? 'bg-green-500 text-white rounded-tr-sm' : 'bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] rounded-tl-sm'}`}>
          {msg.content.replace(/\*\*(.*?)\*\*/g, '$1')}
        </div>
        <span className="text-[0.6rem] text-[var(--color-text-muted)]">{msg.time}</span>
      </div>
    </div>
  );
}

export default function AIAssistant() {
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeAgent, setActiveAgent] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const detectAgent = (text) => {
    const t = text.toLowerCase();
    if (t.includes('disease') || t.includes('leaf') || t.includes('yellow') || t.includes('blight')) return 'disease';
    if (t.includes('weather') || t.includes('rain') || t.includes('temperature')) return 'weather';
    if (t.includes('price') || t.includes('market') || t.includes('sell') || t.includes('mandi')) return 'market';
    if (t.includes('scheme') || t.includes('kisan') || t.includes('subsidy') || t.includes('government')) return 'scheme';
    if (t.includes('profit') || t.includes('loan') || t.includes('money') || t.includes('finance')) return 'finance';
    if (t.includes('explain') || t.includes('why') || t.includes('how does')) return 'explainer';
    if (t.includes('crop') || t.includes('sow') || t.includes('plant') || t.includes('harvest')) return 'crop';
    return 'default';
  };

  const sendMessage = async (text = input) => {
    if (!text.trim() || loading) return;
    const userMsg = { role: 'user', content: text.trim(), time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    const agentKey = detectAgent(text);
    setActiveAgent(agentKey);

    await new Promise(r => setTimeout(r, 1500 + Math.random() * 1000));

    const response = AGENT_RESPONSES[agentKey] || AGENT_RESPONSES.default;
    setMessages(prev => [...prev, { role: 'assistant', content: response, time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) }]);
    setLoading(false);
    setActiveAgent(null);
  };

  return (
    <div className="page-content">
      <PageHeader title="AI Multi-Agent Assistant" subtitle="7 specialized AI agents working together for you" />

      {/* Agent cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 mb-5">
        {AGENTS.map(agent => {
          const s = STATUS_STYLE[agent.status];
          return (
            <div key={agent.id} className={`p-3 rounded-xl border text-center transition-all cursor-pointer hover:shadow-md ${activeAgent === agent.id ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 scale-105' : 'border-[var(--color-border)]'}`}>
              <div className="text-2xl mb-1">{agent.emoji}</div>
              <p className="text-[0.65rem] font-bold text-[var(--color-text)] mb-1">{agent.name}</p>
              <div className="flex items-center justify-center gap-1">
                <span className={`agent-dot ${s.dot}`} />
                <span className={`text-[0.55rem] font-semibold capitalize ${agent.status === 'running' || agent.status === 'generating' ? 'text-amber-600' : agent.status === 'completed' ? 'text-green-600' : 'text-slate-400'}`}>{s.label}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Chat window */}
      <div className="card overflow-hidden">
        {/* Chat header */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-[var(--color-border)] bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/20">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="font-bold text-sm text-[var(--color-text)]">Kisan AI Chat</p>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-[var(--color-text-muted)]">7 agents online</span>
            </div>
          </div>
          <button
            onClick={() => setMessages(INITIAL_MESSAGES)}
            className="ml-auto p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-[var(--color-text-muted)]"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Messages */}
        <div className="h-80 overflow-y-auto p-5 space-y-4 bg-gray-50/50 dark:bg-slate-800/20">
          {messages.map((m, i) => <MessageBubble key={i} msg={m} />)}
          {loading && (
            <div className="flex gap-3 fade-in">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-[var(--color-surface)] border border-[var(--color-border)]">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                  <span className="text-xs text-[var(--color-text-muted)]">
                    {activeAgent ? `${AGENTS.find(a => a.id === activeAgent)?.emoji} ${AGENTS.find(a => a.id === activeAgent)?.name} is analyzing...` : 'Analyzing...'}
                  </span>
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Sample questions */}
        <div className="px-5 py-3 border-t border-[var(--color-border)]">
          <p className="text-[0.65rem] text-[var(--color-text-muted)] mb-2 font-semibold">Try asking:</p>
          <div className="flex flex-wrap gap-1.5">
            {SAMPLE_QUESTIONS.map(q => (
              <button
                key={q}
                onClick={() => sendMessage(q)}
                disabled={loading}
                className="px-2.5 py-1.5 rounded-full bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 text-xs font-medium hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors border border-green-200 dark:border-green-800 disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Input */}
        <div className="flex gap-3 px-5 py-4 border-t border-[var(--color-border)]">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            placeholder="Ask about your crops, weather, diseases, prices, schemes..."
            className="input flex-1"
            disabled={loading}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            className="btn-primary px-4 flex items-center gap-2 shrink-0 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Powered by info */}
      <div className="mt-4 flex flex-wrap gap-2 justify-center">
        {['XGBoost', 'TensorFlow', 'OpenCV', 'CrewAI', 'Gemini API', 'FastAPI'].map(t => (
          <span key={t} className="badge badge-blue text-xs">{t}</span>
        ))}
      </div>
      <p className="text-center text-xs text-[var(--color-text-muted)] mt-2">Powered by Multi-Agent AI Framework with Explainable AI</p>
    </div>
  );
}
