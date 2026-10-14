import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Menu, Sprout, X, LogOut, LayoutDashboard } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const NAV_LINKS = [
    { label: "Agents", href: "/#agents" },
    { label: "Pipeline", href: "/#pipeline" },
    { label: "Mandi", href: "/#mandi" },
    { label: "Promise", href: "/#promise" },
];

function initials(name) {
    return name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase())
        .join("");
}

export function Navbar() {
    const { user, loading, logout } = useAuth();
    const navigate = useNavigate();
    const [scrolled, setScrolled] = useState(false);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 12);
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    const handleLogout = async () => {
        await logout();
        setOpen(false);
        navigate("/");
    };

    return (<header className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${scrolled
            ? "border-b border-line bg-ink/85 shadow-[0_10px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl"
            : "bg-transparent"}`}>
      <div className="mx-auto flex h-18 max-w-7xl items-center justify-between gap-4 px-6">
        <Link to="/" className="group flex items-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-leaf text-ink shadow-[0_8px_24px_rgba(163,230,53,0.35)] transition-transform duration-300 group-hover:scale-105">
            <Sprout className="h-5.5 w-5.5 animate-sprout" strokeWidth={2.2}/>
          </span>
          <span className="leading-tight">
            <span className="block font-display text-xl font-semibold tracking-tight text-cream">
              KisanAI
            </span>
            <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-mist">
              AI for Smarter Farming
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-8 lg:flex">
          {NAV_LINKS.map((link) => (<Link key={link.href} to={link.href} className="text-sm font-medium text-mist transition-colors hover:text-leaf">
              {link.label}
            </Link>))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          {loading ? (<div className="h-10 w-28 animate-pulse rounded-full bg-ink-3"/>) : user ? (<>
              <Link to="/dashboard" className="inline-flex items-center gap-2 rounded-full bg-leaf px-5 py-2.5 text-sm font-semibold text-ink shadow-[0_10px_28px_rgba(163,230,53,0.3)] transition-all hover:-translate-y-0.5 hover:bg-leaf-soft">
                <LayoutDashboard className="h-4 w-4"/>
                Dashboard
              </Link>
              <div className="flex items-center gap-2.5 rounded-full border border-line bg-ink-2 py-1.5 pl-1.5 pr-3 backdrop-blur">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-marigold text-xs font-bold text-ink">
                  {initials(user.name)}
                </span>
                <span className="max-w-28 truncate text-sm font-medium text-cream">
                  {user.name.split(" ")[0]}
                </span>
                <button onClick={handleLogout} title="Log out" className="grid h-7 w-7 place-items-center rounded-full text-mist transition-colors hover:bg-ink-3 hover:text-cream">
                  <LogOut className="h-3.5 w-3.5"/>
                </button>
              </div>
            </>) : (<>
              <Link to="/login" className="rounded-full px-5 py-2.5 text-sm font-semibold text-cream transition-colors hover:bg-ink-3">
                Log in
              </Link>
              <Link to="/register" className="rounded-full bg-leaf px-5 py-2.5 text-sm font-semibold text-ink shadow-[0_10px_28px_rgba(163,230,53,0.3)] transition-all hover:-translate-y-0.5 hover:bg-leaf-soft">
                Sign up free
              </Link>
            </>)}
        </div>

        <button className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-ink-2 text-cream lg:hidden" onClick={() => setOpen((v) => !v)} aria-label="Toggle menu">
          {open ? <X className="h-5 w-5"/> : <Menu className="h-5 w-5"/>}
        </button>
      </div>

      {open && (<div className="border-t border-line bg-ink/95 px-6 py-4 backdrop-blur-xl lg:hidden">
          <div className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (<Link key={link.href} to={link.href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-medium text-mist hover:bg-ink-3 hover:text-cream">
                {link.label}
              </Link>))}
            <div className="mt-3 flex flex-col gap-2 border-t border-line pt-4">
              {user ? (<>
                  <Link to="/dashboard" onClick={() => setOpen(false)} className="rounded-full bg-leaf px-5 py-2.5 text-center text-sm font-semibold text-ink">
                    Dashboard
                  </Link>
                  <button onClick={handleLogout} className="rounded-full px-5 py-2.5 text-sm font-semibold text-cream hover:bg-ink-3">
                    Log out
                  </button>
                </>) : (<>
                  <Link to="/register" onClick={() => setOpen(false)} className="rounded-full bg-leaf px-5 py-2.5 text-center text-sm font-semibold text-ink">
                    Sign up free
                  </Link>
                  <Link to="/login" onClick={() => setOpen(false)} className="rounded-full px-5 py-2.5 text-center text-sm font-semibold text-cream hover:bg-ink-3">
                    Log in
                  </Link>
                </>)}
            </div>
          </div>
        </div>)}
    </header>);
}