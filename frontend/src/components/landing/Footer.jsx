import { Link } from "react-router-dom";
import { Sprout } from "lucide-react";

export function Footer() {
    return (<footer className="dot-grid border-t border-line bg-ink text-mist">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-12 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-leaf text-ink">
                <Sprout className="h-5.5 w-5.5" strokeWidth={2.2}/>
              </span>
              <div className="leading-tight">
                <p className="font-display text-xl font-semibold text-cream">
                  KisanAI
                </p>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-dim">
                  AI for Smarter Farming
                </p>
              </div>
            </div>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-mist/80">
              Farm planning tools under development: experimental crop and
              soil models, forecast context, draft calendars, and official
              source links. Disease diagnosis is not available yet.
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-dim">
              Product
            </p>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <Link to="/#agents" className="text-mist/85 transition-colors hover:text-leaf">
                  Agents
                </Link>
              </li>
              <li>
                <Link to="/#pipeline" className="text-mist/85 transition-colors hover:text-leaf">
                  Pipeline
                </Link>
              </li>
              <li>
                <Link to="/#promise" className="text-mist/85 transition-colors hover:text-leaf">
                  The promise
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-dim">
              Account
            </p>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <Link to="/login" className="text-mist/85 transition-colors hover:text-leaf">
                  Log in
                </Link>
              </li>
              <li>
                <Link to="/register" className="text-mist/85 transition-colors hover:text-leaf">
                  Create account
                </Link>
              </li>
              <li>
                <Link to="/dashboard" className="text-mist/85 transition-colors hover:text-leaf">
                  Dashboard
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-line pt-8 text-xs text-dim sm:flex-row">
          <p>© 2026 KisanAI. All rights reserved.</p>
          <p>Keshav Memorial Institute of Technology, Hyderabad</p>
        </div>
      </div>
    </footer>);
}
