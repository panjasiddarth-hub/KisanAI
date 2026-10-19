// src/pages/AIAssistant.jsx — the chat assistant is not connected to the agents yet.
//
// The previous version answered every question with pre-written text after a random 1.5–2.5 s
// delay, presented as live analysis by "specialized agents" (with invented figures such as
// "78% match" and "95% accuracy"). Nothing was computed, so it was removed. The real orchestrator
// will be connected here, with the farmer's plot as context, in a later milestone.
import { Link } from 'react-router-dom';
import { Bot, Sprout, FlaskConical, CalendarDays, Bug, Store, CloudSun, Landmark, Info } from 'lucide-react';

const TOOLS = [
  { to: '/farms', icon: Sprout, title: 'Crop recommendations', text: 'My Farm → your farm → Get AI Crop Recommendations. Uses the trained crop model where the inputs allow, plus soil and season rules.' },
  { to: '/agents/fertilizer', icon: FlaskConical, title: 'Fertilizer plan', text: 'Dose, products and stage-wise split calculated from the crop and your soil test.' },
  { to: '/calendar', icon: CalendarDays, title: 'Farm calendar', text: 'Season tasks generated for the crop you selected, with dates.' },
  { to: '/disease', icon: Bug, title: 'Disease check', text: 'Symptom matching against the disease guide. Photos are not analysed.' },
  { to: '/market', icon: Store, title: 'Market', text: 'Price-model forecasts for the crops and mandis the model covers.' },
  { to: '/weather', icon: CloudSun, title: 'Weather', text: 'Live Open-Meteo forecast for a confirmed farm location.' },
  { to: '/schemes', icon: Landmark, title: 'Government schemes', text: 'Scheme summaries with links to the official sites.' },
];

export default function AIAssistant() {
  return (
    <div className="page-content" style={{ maxWidth: '900px' }}>
      <div className="card p-6" data-testid="assistant-unavailable">
        <div className="flex gap-3">
          <span className="w-11 h-11 rounded-xl bg-gray-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
            <Bot className="w-5 h-5 text-[var(--color-text-muted)]" />
          </span>
          <div>
            <h2 className="text-lg font-extrabold text-[var(--color-text)]">AI Assistant — not connected yet</h2>
            <p className="text-sm text-[var(--color-text)] mt-1.5 leading-relaxed">
              The chat assistant is not yet connected to the KisanAI agents, so it cannot answer questions about your farm.
              Earlier versions of this page showed pre-written example replies; they were not results from any model and have been removed.
            </p>
            <p className="text-xs text-[var(--color-text-muted)] mt-2 flex gap-1.5">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" /> Until it is connected, use the tools below — each shows where its answer comes from.
            </p>
          </div>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-3 mt-4">
        {TOOLS.map(({ to, icon: Icon, title, text }) => (
          <Link key={to} to={to} className="card p-4 flex gap-3 hover:border-green-400 transition-colors">
            <Icon className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
            <span>
              <span className="block text-sm font-bold text-[var(--color-text)]">{title}</span>
              <span className="block text-xs text-[var(--color-text-muted)] mt-0.5">{text}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
