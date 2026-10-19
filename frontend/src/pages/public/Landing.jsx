import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, ArrowUpRight, BadgeCheck, CalendarRange, CloudSun, Cpu, FlaskConical, Leaf, LineChart, MapPin, MessagesSquare, Quote, Sprout, Stethoscope, TrendingDown, TrendingUp, Wheat, Landmark, ShieldCheck, Languages, Workflow, CheckCircle2, CloudOff, } from "lucide-react";
import { Chip, CountUp, Reveal, SectionHead, Wordmark } from "@/components/landing/ui";
import { cn } from "@/lib/utils";
import cottonImage from "@/assets/cotton-close.jpg";
import heroFieldImage from "@/assets/hero-field.jpg";
/* ———————————————— Nav ———————————————— */
function Nav() {
    const [scrolled, setScrolled] = useState(false);
    useEffect(() => {
        const fn = () => setScrolled(window.scrollY > 24);
        fn();
        window.addEventListener("scroll", fn, { passive: true });
        return () => window.removeEventListener("scroll", fn);
    }, []);
    return (<header className={cn("fixed inset-x-0 top-0 z-50 transition-all duration-300", scrolled
            ? "border-b border-line/70 bg-ink/85 shadow-[0_10px_40px_rgba(0,0,0,0.4)] backdrop-blur-xl"
            : "bg-transparent")}>
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 md:px-8">
        <Link to="/" aria-label="KisanAI home">
          <Wordmark dark={scrolled}/>
        </Link>
        <nav className={cn("hidden items-center gap-8 text-[13px] font-medium tracking-wide md:flex", scrolled ? "text-mist" : "text-ink/60")}>
          <a href="#agents" className="transition-colors hover:text-leaf">
            Agents
          </a>
          <a href="#pipeline" className="transition-colors hover:text-leaf">
            Pipeline
          </a>
          <a href="#mandi" className="transition-colors hover:text-leaf">
            Mandi
          </a>
          <a href="#promise" className="transition-colors hover:text-leaf">
            Promise
          </a>
        </nav>
        <div className="flex items-center gap-3">
          <Link to="/login" className={cn("hidden text-[13px] font-medium sm:block transition-colors", scrolled ? "text-mist hover:text-cream" : "text-ink/60 hover:text-ink")}>
            Sign in
          </Link>
          <Link to="/register" className="group inline-flex items-center gap-2 rounded-full bg-leaf px-4.5 py-2 text-[13px] font-bold text-ink transition-transform hover:scale-[1.04] active:scale-95">
            Get started
            <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"/>
          </Link>
        </div>
      </div>
    </header>);
}
/* ———————————————— Hero ———————————————— */
function Hero() {
    const { scrollY } = useScroll();
    const imgY = useTransform(scrollY, [0, 600], [0, 60]);
    return (<section className="relative overflow-hidden bg-cream pb-16 text-ink md:pb-24">
      {/* backdrop typography */}
      <div className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 font-display text-[26vw] font-bold tracking-tighter text-ink/[0.035] select-none md:text-[19vw]">
        धरती
      </div>
      <div className="glow-leaf pointer-events-none absolute -top-32 right-[-8rem] h-[28rem] w-[28rem] opacity-70 blur-2xl" aria-hidden/>
      <div className="relative mx-auto max-w-7xl px-5 pt-32 md:px-8 md:pt-40">
        <div className="grid items-end gap-10 lg:grid-cols-[1.35fr_1fr]">
          <div>
            <Reveal>
              <span className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-white/60 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-ink/70">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-leaf-deep"/>
                AI for Smarter Farming · KMIT Hyderabad
              </span>
            </Reveal>
            <Reveal delay={0.08}>
              <h1 className="mt-6 font-display text-[13.5vw] leading-[0.95] font-medium tracking-tight text-balance sm:text-[11vw] lg:text-[6.4rem]">
                The land speaks.
                <br />
                <span className="italic text-leaf-deep">We translate.</span>
              </h1>
            </Reveal>
            <Reveal delay={0.16}>
              <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-ink/65 md:text-base">
                From farm to future — Crop Recommendation, Soil & Fertiliser,
                Disease Detection, Weather Intelligence, Market Insights and
                Government Schemes. Multi-agent AI, Graph-RAG grounded, in the
                farmer’s own language.
              </p>
            </Reveal>
            <Reveal delay={0.24} className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/register" className="group inline-flex items-center gap-2.5 rounded-full bg-ink px-6 py-3.5 text-sm font-bold text-cream transition-all hover:bg-leaf-deep hover:shadow-[0_18px_40px_-12px_rgba(76,138,47,0.5)]">
                <Sprout className="h-4 w-4 text-leaf"/>
                Plan my season
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1"/>
              </Link>
              <a href="#agents" className="inline-flex items-center gap-2.5 rounded-full border-2 border-ink/15 px-6 py-3 text-sm font-bold text-ink transition-colors hover:border-ink/40">
                Meet the agents
              </a>
            </Reveal>
            <Reveal delay={0.3}>
              <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] font-medium text-ink/55">
                <span className="flex items-center gap-1.5">
                  <BadgeCheck className="h-3.5 w-3.5 text-leaf-deep"/>
                  Multi-Agent AI
                </span>
                <span className="flex items-center gap-1.5">
                  <CloudOff className="h-3.5 w-3.5 text-leaf-deep"/>
                  Graph-RAG grounded
                </span>
                <span className="flex items-center gap-1.5">
                  <MessagesSquare className="h-3.5 w-3.5 text-leaf-deep"/>
                  Voice-first
                </span>
              </div>
            </Reveal>
          </div>

          {/* floating advisory card */}
          <Reveal delay={0.3} className="hidden lg:block">
            <div className="animate-floaty relative ml-auto w-72 rounded-3xl border border-ink/10 bg-ink p-5 text-cream shadow-[0_30px_60px_-20px_rgba(11,16,10,0.45)]">
              <div className="flex items-center justify-between">
                <Chip tone="leaf">Crop Recommendation</Chip>
                <span className="text-[10px] tracking-widest text-mist uppercase">
                  live
                </span>
              </div>
              <p className="mt-4 font-display text-2xl leading-snug">
                Cotton — <span className="text-leaf">92%</span> match
              </p>
              <p className="mt-2 text-xs leading-relaxed text-mist">
                Black soil · pH 7.2 · Kharif · Rainfed
              </p>
              <div className="mt-4 space-y-2 border-t border-line pt-4 text-[11px] text-mist">
                <p className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-leaf"/> Thrives in Black soil
                </p>
                <p className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-leaf"/> Correct season — sown in Kharif
                </p>
                <p className="flex items-center gap-2">
                  <CloudSun className="h-3.5 w-3.5 text-marigold"/> Moderate water need — watch July
                </p>
              </div>
            </div>
          </Reveal>
        </div>

        {/* hero image with floaters */}
        <Reveal delay={0.2} className="relative mt-14 md:mt-20">
          <motion.div style={{ y: imgY }} className="relative h-[52vh] min-h-[340px] overflow-hidden rounded-[2rem] md:h-[68vh]">
            <img src={heroFieldImage} alt="Indian farmland at golden hour" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-ink/55 via-transparent to-transparent"/>
            <div className="absolute bottom-5 left-5 flex items-center gap-3 rounded-2xl border border-cream/20 bg-ink/70 px-4 py-3 backdrop-blur-md md:bottom-8 md:left-8">
              <MapPin className="h-4 w-4 text-leaf"/>
              <div>
                <p className="text-xs font-bold text-cream">
                  Armoor, Nizamabad — Telangana
                </p>
                <p className="text-[10px] tracking-wide text-mist">
                  31.4°C · light breeze · good spray window after 9 AM
                </p>
              </div>
            </div>
            <div className="animate-floaty absolute top-6 right-6 hidden rounded-2xl border border-cream/20 bg-ink/70 px-4 py-3 backdrop-blur-md md:block" style={{ animationDelay: "1.2s" }}>
              <p className="flex items-center gap-1.5 text-xs font-bold text-cream">
                Turmeric <TrendingUp className="h-3.5 w-3.5 text-leaf"/> ₹19,100/q
              </p>
              <p className="text-[10px] text-mist">Nizamabad APMC · +6.2% this week</p>
            </div>
          </motion.div>
        </Reveal>

        {/* stats */}
        <div className="mt-10 grid grid-cols-2 gap-y-8 border-t border-ink/10 pt-8 md:grid-cols-4 md:pt-10">
          {[
            { v: 95, s: "%", l: "disease model validation accuracy" },
            { v: 38, s: "", l: "plant disease classes covered" },
            { v: 6, s: "", l: "farming modules in one app" },
            { v: 3, s: "", l: "agents check every answer" },
        ].map((s, i) => (<Reveal key={s.l} delay={i * 0.06}>
              <p className="font-display text-4xl font-medium md:text-5xl">
                <CountUp to={s.v} suffix={s.s}/>
              </p>
              <p className="mt-1 text-xs tracking-wide text-ink/55">{s.l}</p>
            </Reveal>))}
        </div>
      </div>
    </section>);
}
/* ———————————————— Mandi marquee ———————————————— */
const TICKER = [
    { c: "Cotton", p: "₹7,121", d: 1 },
    { c: "Turmeric", p: "₹19,100", d: 1 },
    { c: "Paddy", p: "₹2,300", d: 1 },
    { c: "Soybean", p: "₹4,892", d: -1 },
    { c: "Tur", p: "₹7,550", d: 1 },
    { c: "Maize", p: "₹2,225", d: 0 },
    { c: "Onion", p: "₹1,850", d: -1 },
    { c: "Chana", p: "₹5,440", d: 1 },
    { c: "Wheat", p: "₹2,425", d: 1 },
    { c: "Groundnut", p: "₹6,783", d: 0 },
    { c: "Sunflower", p: "₹7,280", d: 1 },
    { c: "Tomato", p: "₹1,400", d: -1 },
];
function MandiTicker() {
    const items = [...TICKER, ...TICKER];
    return (<section id="mandi" className="relative overflow-hidden border-y border-line bg-ink py-4">
      <div className="flex w-max animate-marquee items-center gap-10 whitespace-nowrap px-5">
        {items.map((t, i) => (<span key={i} className="flex items-center gap-2.5 text-[13px] font-semibold tracking-wide">
            <Wheat className="h-3.5 w-3.5 text-leaf-dim"/>
            <span className="text-cream">{t.c}</span>
            <span className="text-mist">{t.p}/q</span>
            {t.d === 1 && <TrendingUp className="h-3.5 w-3.5 text-leaf"/>}
            {t.d === -1 && <TrendingDown className="h-3.5 w-3.5 text-clay"/>}
            {t.d === 0 && <span className="text-dim">—</span>}
          </span>))}
      </div>
      <div className="pointer-events-none absolute top-1/2 left-0 hidden -translate-y-1/2 items-center gap-2 border-r border-line bg-ink py-4 pl-5 pr-4 md:flex">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-leaf"/>
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-mist">
          Mandi pulse
        </span>
      </div>
    </section>);
}
/* ———————————————— Agents ———————————————— */
const AGENTS = [
    {
        n: "01",
        icon: Sprout,
        title: "Crop Recommendation",
        tag: "Best crop for this farm",
        desc: "Soil, water and budget in — a ranked crop plan out, chosen for this farm, not by habit or hearsay.",
        points: [
            "Soil type, N-P-K and pH aware",
            "Season and water source considered",
            "Fits the farm’s available budget",
        ],
        sample: "Cotton 92% · Paddy 87% · Tur 81%",
        href: "/agents/crop",
    },
    {
        n: "02",
        icon: FlaskConical,
        title: "Soil & Fertiliser",
        tag: "NPK and pH based guidance",
        desc: "Exact N–P–K dose for the crop and acreage, converted to Urea, DAP and MOP with a stage-wise schedule.",
        points: [
            "Per-acre and total field quantities",
            "Adjusted for soil type and pH",
            "Organic FYM and bio-fertiliser options",
        ],
        sample: "Urea 24 kg · DAP 12 kg · MOP 8 kg / acre",
        href: "/agents/fertilizer",
    },
    {
        n: "03",
        icon: Stethoscope,
        title: "Disease Detection",
        tag: "Snap a leaf, get a cure",
        desc: "Upload a leaf photo or describe symptoms. Top likely diseases, with chemical and organic treatment, before the problem spreads.",
        points: [
            "38 plant disease classes",
            "MobileNetV2 leaf-photo model",
            "Validation Agent checks the cure",
        ],
        sample: "Leaf blight 87% · Rust 62% · Wilt 41%",
        href: "/disease",
    },
    {
        n: "04",
        icon: CloudSun,
        title: "Weather Intelligence",
        tag: "When to sow, irrigate, spray",
        desc: "Local forecasts and alerts so sowing, irrigation and spray timing don’t depend on guesswork.",
        points: [
            "Sowing and spray windows",
            "Heat stress and rain chances",
            "Feeds the farm calendar",
        ],
        sample: "Spray after 9 AM · rain risk Thursday",
        href: "/weather",
    },
    {
        n: "05",
        icon: LineChart,
        title: "Market Insights",
        tag: "When and where to sell",
        desc: "Mandi prices so the farmer can choose the best time to sell — agronomy meets the market before seed is committed.",
        points: [
            "Live mandi price pulse",
            "Week-on-week movement",
            "Selling outlook with the crop plan",
        ],
        sample: "Turmeric ₹19,100/q · +6.2% this week",
        href: "/market",
    },
    {
        n: "06",
        icon: Landmark,
        title: "Government Schemes",
        tag: "Subsidies matched to the farm",
        desc: "PM-KISAN, PMFBY, KCC and state schemes surfaced with eligibility in plain words — so nothing the farm qualifies for is missed.",
        points: [
            "Matched to farm profile",
            "Eligibility in plain language",
            "Reminders on the farm calendar",
        ],
        sample: "PM-KISAN · PMFBY · Rythu Bandhu",
        href: "/schemes",
    },
];
function Agents() {
    return (<section id="agents" className="relative bg-ink py-24 md:py-32">
      <div className="glow-leaf pointer-events-none absolute top-0 left-1/4 h-96 w-96" aria-hidden/>
      <div className="relative mx-auto max-w-7xl px-5 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHead eyebrow="Six farming modules" title={<>
                One assistant, <span className="italic text-leaf">six modules.</span>
              </>} desc="From sowing to selling. Retrieval, Reasoning and Validation agents cross-check every answer before it is shown — Graph-RAG grounded, not a black box."/>
          <Reveal delay={0.15}>
            <span className="inline-flex items-center gap-2 rounded-full border border-leaf/30 bg-leaf/10 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-leaf">
              <Cpu className="h-3.5 w-3.5"/> Graph-RAG + Validation Agent
            </span>
          </Reveal>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {AGENTS.map((a, i) => (<Reveal key={a.n} delay={i * 0.07}>
              <Link to={a.href} className="group block h-full">
                <div className="relative flex h-full flex-col overflow-hidden rounded-3xl border border-line bg-gradient-to-b from-ink-2/90 to-ink-2/40 p-7 transition-all duration-300 group-hover:-translate-y-1.5 group-hover:border-leaf/40 group-hover:shadow-[0_30px_60px_-25px_rgba(163,230,53,0.25)] md:p-9">
                  <div className="flex items-start justify-between">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-leaf/25 bg-leaf/10 text-leaf">
                      <a.icon className="h-5.5 w-5.5"/>
                    </span>
                    <span className="font-display text-5xl font-medium text-cream/10 transition-colors group-hover:text-leaf/25">
                      {a.n}
                    </span>
                  </div>
                  <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.2em] text-mist">
                    {a.tag}
                  </p>
                  <h3 className="mt-1.5 font-display text-3xl font-medium text-cream">
                    {a.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-mist">{a.desc}</p>
                  <ul className="mt-5 space-y-2 border-t border-line/80 pt-5">
                    {a.points.map((p) => (<li key={p} className="flex items-center gap-2.5 text-[12.5px] text-cream/75">
                        <span className="h-1 w-4 rounded-full bg-leaf/60"/>
                        {p}
                      </li>))}
                  </ul>
                  <div className="mt-5 rounded-xl border border-line/70 bg-ink/60 px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-dim">
                      Sample output
                    </p>
                    <p className="mt-1 font-display text-sm text-leaf-soft">
                      {a.sample}
                    </p>
                  </div>
                  <span className="mt-6 inline-flex items-center gap-2 text-xs font-bold text-leaf">
                    Open agent
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1.5"/>
                  </span>
                </div>
              </Link>
            </Reveal>))}
        </div>
      </div>
    </section>);
}
/* ———————————————— Pipeline ———————————————— */
const STEPS = [
    {
        icon: Languages,
        t: "You ask in plain words",
        d: "Soil, season, symptoms or a sowing date — no jargon needed.",
    },
    {
        icon: Workflow,
        t: "Agents reason together",
        d: "Retrieval, Reasoning and Validation agents cross-check the answer.",
    },
    {
        icon: CalendarRange,
        t: "A season plan lands",
        d: "40+ dated activities, from ploughing to the harvest window.",
    },
    {
        icon: ShieldCheck,
        t: "You farm with proof",
        d: "Every recommendation carries its reasons. Tick off as you go.",
    },
];
function Pipeline() {
    return (<section id="pipeline" className="relative overflow-hidden bg-cream py-24 text-ink md:py-32">
      <div className="pointer-events-none absolute right-[-6rem] bottom-[-4rem] font-display text-[22vw] font-bold text-ink/[0.04] select-none">
        04
      </div>
      <div className="relative mx-auto max-w-7xl px-5 md:px-8">
        <div className="grid items-start gap-14 lg:grid-cols-2">
          <div>
            <SectionHead light eyebrow="The multi-agent pipeline" title={<>
                  From one question to a{" "}
                  <span className="italic text-leaf-deep">whole season</span>,
                  planned.
                </>} desc="Most tools answer one question at a time. KisanAI guides each farm from sowing to selling — Soil & Fertiliser, Disease Detection, Weather Intelligence, Market Insights and Government Schemes in one plan."/>
            <div className="mt-10 space-y-0">
              {STEPS.map((s, i) => (<Reveal key={s.t} delay={i * 0.08}>
                  <div className="group flex gap-5 border-l-2 border-ink/10 pb-9 pl-6 transition-colors last:pb-0 hover:border-leaf-deep">
                    <span className="-ml-[2.15rem] flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-ink/10 bg-white text-leaf-deep shadow-sm">
                      <s.icon className="h-4 w-4"/>
                    </span>
                    <div>
                      <p className="font-display text-xl font-medium">{s.t}</p>
                      <p className="mt-1 text-sm leading-relaxed text-ink/60">
                        {s.d}
                      </p>
                    </div>
                  </div>
                </Reveal>))}
            </div>
          </div>

          <Reveal delay={0.15} className="lg:sticky lg:top-28">
            <div className="relative overflow-hidden rounded-[2rem] shadow-[0_40px_80px_-30px_rgba(11,16,10,0.4)]">
              <img src={cottonImage} alt="Cotton bolls close up" width="900" height="1100" className="h-auto w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/10 to-transparent"/>
              <div className="absolute right-6 bottom-6 left-6">
                <p className="font-display text-2xl leading-snug text-cream md:text-[1.7rem]">
                  “The farm calendar told me exactly when to top-dress urea — and{" "}
                  <span className="italic text-leaf">why</span>. My cotton has
                  never looked better.”
                </p>
                <p className="mt-3 text-xs tracking-wide text-mist">
                  — Demo farmer persona, Armoor cluster · Kharif 2025
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>);
}
/* ———————————————— Scoring (explainable) ———————————————— */
const BREAKDOWN = [
    { label: "Soil fit", score: 35, max: 35, note: "Black soil — ideal for cotton" },
    { label: "Season fit", score: 30, max: 30, note: "Kharif — correct window" },
    { label: "pH fit", score: 14, max: 20, note: "pH 7.2 — slightly alkaline" },
    { label: "Water fit", score: 13, max: 15, note: "Rainfed — watch July" },
];
function Scoring() {
    return (<section className="relative overflow-hidden bg-ink py-24 md:py-32">
      <div className="glow-marigold pointer-events-none absolute bottom-0 right-0 h-96 w-96" aria-hidden/>
      <div className="relative mx-auto max-w-7xl px-5 md:px-8">
        <div className="grid items-center gap-14 lg:grid-cols-2">
          <div>
            <SectionHead eyebrow="Explainable by design" title={<>
                  Every score,{" "}
                  <span className="italic text-leaf">broken open.</span>
                </>} desc="Crop Recommendation never says “trust me”. A 92% match is the sum of visible judgements — soil, season, pH and water — checked by the Validation Agent before it is shown."/>
            <Reveal delay={0.15}>
              <div className="mt-8 flex flex-wrap gap-3">
                <Chip tone="leaf">No hidden weights</Chip>
                <Chip tone="marigold">Overrule anything</Chip>
                <Chip tone="cream">Runs offline</Chip>
              </div>
            </Reveal>
          </div>

          <Reveal delay={0.1}>
            <div className="rounded-3xl border border-line bg-ink-2/80 p-7 shadow-[0_30px_70px_-30px_rgba(0,0,0,0.6)] md:p-9">
              <div className="flex items-center justify-between">
                <Chip tone="leaf">Crop Recommendation</Chip>
                <span className="text-[10px] uppercase tracking-widest text-mist">
                  Kharif · Rainfed
                </span>
              </div>
              <p className="mt-5 font-display text-4xl font-medium text-cream">
                Cotton — <span className="text-leaf">92%</span>
              </p>
              <p className="mt-1 text-xs text-mist">
                Black soil · pH 7.2 · 4.5 acres
              </p>

              <div className="mt-7 space-y-5">
                {BREAKDOWN.map((b, i) => (<div key={b.label}>
                    <div className="flex items-baseline justify-between text-[12px]">
                      <span className="font-bold text-cream/85">
                        {b.label}
                        <span className="ml-2 font-medium text-dim">
                          {b.note}
                        </span>
                      </span>
                      <span className="font-display text-sm text-leaf">
                        {b.score}/{b.max}
                      </span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink">
                      <motion.div initial={{ width: 0 }} whileInView={{ width: `${(b.score / b.max) * 100}%` }} viewport={{ once: true, margin: "-60px" }} transition={{
                duration: 1.1,
                delay: 0.15 + i * 0.12,
                ease: [0.22, 1, 0.36, 1],
            }} className={cn("h-full rounded-full", b.score === b.max ? "bg-leaf" : "bg-marigold")}/>
                    </div>
                  </div>))}
              </div>

              <div className="mt-7 flex items-center justify-between border-t border-line pt-5 text-[11px] text-mist">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-leaf"/>
                  Verdict assembled from visible parts
                </span>
                <Link to="/register" className="font-bold text-leaf transition-colors hover:text-leaf-soft">
                  Try it →
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>);
}
/* ———————————————— Promise ———————————————— */
const PROMISES = [
    {
        icon: Cpu,
        t: "Explainable by design",
        d: "Every score breaks into visible reasons — soil fit, pH fit, season fit, water fit. Nothing hides inside a model.",
    },
    {
        icon: CloudSun,
        t: "Weather-smart nudges",
        d: "Spray windows, heat stress and rain chances folded into the advisory rhythm of your week.",
    },
    {
        icon: LineChart,
        t: "Mandi-aware choices",
        d: "Live 12-week price trends for 18 crops so agronomy meets the market before you commit seed.",
    },
    {
        icon: Landmark,
        t: "Schemes you qualify for",
        d: "PM-KISAN, PMFBY, KCC, Rythu Bandhu and more — surfaced with eligibility in plain words.",
    },
];
function Promise() {
    return (<section id="promise" className="border-t border-line bg-ink py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <SectionHead eyebrow="The promise" title={<>
              Built like an agronomist,{" "}
              <span className="italic text-leaf">priced like air.</span>
            </>} desc="A decision-support layer a smallholder can actually use — free, instant, and honest about its limits."/>
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PROMISES.map((p, i) => (<Reveal key={p.t} delay={i * 0.07}>
              <div className="h-full rounded-3xl border border-line bg-ink-2/50 p-6 transition-colors hover:border-leaf/35">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-leaf/25 bg-leaf/10 text-leaf">
                  <p.icon className="h-5 w-5"/>
                </span>
                <p className="mt-5 font-display text-xl font-medium text-cream">
                  {p.t}
                </p>
                <p className="mt-2 text-[13px] leading-relaxed text-mist">
                  {p.d}
                </p>
              </div>
            </Reveal>))}
        </div>
      </div>
    </section>);
}
/* ———————————————— Stories ———————————————— */
const STORIES = [
    {
        quote: "Pehle sirf anumaan thi. Ab Crop Recommendation ne bataya ki is season moong dal kyun behtar hai — aur Soil & Fertiliser ne bola kitna DAP. Sab samajh mein aa gaya.",
        name: "Ramesh Patil",
        role: "Wheat & Pulses Farmer · Madhya Pradesh",
        initials: "RP",
        bg: "bg-leaf-deep",
    },
    {
        quote: "Mere paddy mein disease thi. Disease Detection ko photo bheja, ilaaj mila — chemical aur organic dono options ke saath. Fasal bach gayi.",
        name: "Lakshmi Amma",
        role: "Rice Farmer · Kerala",
        initials: "LA",
        bg: "bg-marigold",
    },
    {
        quote: "Weather Intelligence aur farm calendar sab kuch bata dete hain — kab irrigation, kab spray, kab harvest. Ghar baithe poora plan ho jata hai.",
        name: "Sukhdev Singh",
        role: "Cotton Farmer · Punjab",
        initials: "SS",
        bg: "bg-clay",
    },
];
function Stories() {
    return (<section className="bg-cream py-24 text-ink md:py-32">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <SectionHead light eyebrow="Farmer stories" title={<>
              Trusted at 6 AM,{" "}
              <span className="italic text-leaf-deep">in the field.</span>
            </>} desc="KisanAI is built for the farmer who checks the phone before sunrise — and decides the day by what it says."/>
        <div className="mt-14 grid gap-5 lg:grid-cols-3">
          {STORIES.map((s, i) => (<Reveal key={s.name} delay={i * 0.08}>
              <figure className="flex h-full flex-col rounded-3xl border border-ink/10 bg-white p-7 shadow-[0_18px_50px_-25px_rgba(11,16,10,0.35)]">
                <Quote className="h-6 w-6 text-leaf-deep"/>
                <blockquote className="mt-4 flex-1 font-display text-[1.05rem] leading-relaxed text-ink/85">
                  {s.quote}
                </blockquote>
                <figcaption className="mt-6 flex items-center gap-3 border-t border-ink/10 pt-5">
                  <span className={cn("grid h-10 w-10 place-items-center rounded-full text-sm font-bold text-cream", s.bg)}>
                    {s.initials}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-ink">{s.name}</p>
                    <p className="text-xs text-ink/55">{s.role}</p>
                  </div>
                </figcaption>
              </figure>
            </Reveal>))}
        </div>
      </div>
    </section>);
}
/* ———————————————— CTA + Footer ———————————————— */
function Cta() {
    return (<section className="relative overflow-hidden border-t border-line bg-ink">
      <div className="glow-leaf pointer-events-none absolute top-1/2 left-1/2 h-[30rem] w-[46rem] -translate-x-1/2 -translate-y-1/2" aria-hidden/>
      <div className="relative mx-auto max-w-5xl px-5 py-24 text-center md:py-32">
        <Reveal>
          <Leaf className="mx-auto h-8 w-8 text-leaf"/>
          <h2 className="mt-6 font-display text-5xl leading-[1.02] font-medium tracking-tight text-balance text-cream md:text-7xl">
            The field is waiting.
            <br />
            <span className="italic text-leaf">Sow with certainty.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-lg text-sm leading-relaxed text-mist">
            Demo sign-in:{" "}
            <span className="font-bold text-cream">siddarth@kisan.com</span> ·{" "}
            <span className="font-bold text-cream">password123</span> — or
            create your own account in seconds.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link to="/register" className="group inline-flex items-center gap-2.5 rounded-full bg-leaf px-8 py-4 text-sm font-bold text-ink transition-all hover:scale-[1.03] hover:shadow-[0_20px_50px_-15px_rgba(163,230,53,0.55)]">
              Get started
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1"/>
            </Link>
            <Link to="/login" className="rounded-full border border-cream/25 px-8 py-4 text-sm font-bold text-cream transition-all hover:scale-[1.03] hover:border-cream/50">
              Sign in
            </Link>
          </div>
        </Reveal>
      </div>
    </section>);
}
function Footer() {
    return (<footer className="border-t border-line bg-ink-2/60">
      <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 px-5 py-10 md:flex-row md:items-center md:px-8">
        <div>
          <Wordmark />
          <p className="mt-3 max-w-sm text-xs leading-relaxed text-dim">
            AI for Smarter Farming — an explainable multi-agent assistant
            for Indian farmers. Advisory only; consult your local KVK for
            severe outbreaks.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 text-xs font-medium text-mist">
          <a href="#agents" className="transition-colors hover:text-leaf">
            Agents
          </a>
          <a href="#pipeline" className="transition-colors hover:text-leaf">
            Pipeline
          </a>
          <a href="#mandi" className="transition-colors hover:text-leaf">
            Mandi
          </a>
          <Link to="/login" className="transition-colors hover:text-leaf">
            Sign in
          </Link>
        </div>
      </div>
      <div className="border-t border-line/60 py-5 text-center text-[11px] tracking-wide text-dim">
        KisanAI · Keshav Memorial Institute of Technology, Hyderabad ·
        Multi-Agent AI + Graph-RAG + Voice-first
      </div>
    </footer>);
}
export default function Landing() {
    return (<main className="bg-ink">
      <Nav />
      <Hero />
      <MandiTicker />
      <Agents />
      <Pipeline />
      <Scoring />
      <Promise />
      <Stories />
      <Cta />
      <Footer />
    </main>);
}
