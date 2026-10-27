import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, ArrowUpRight, BadgeCheck, CalendarRange, CloudSun, Cpu, FlaskConical, Leaf, LineChart, MapPin, MessagesSquare, Sprout, Stethoscope, TrendingDown, TrendingUp, Wheat, Landmark, ShieldCheck, Languages, Workflow, CheckCircle2, CloudOff, } from "lucide-react";
import { Chip, Reveal, SectionHead, Wordmark } from "@/components/landing/ui";
import { cn } from "@/lib/utils";
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
                Farm profiles, experimental crop and soil models, weather
                context, draft crop calendars, market demonstrations, and links
                to official schemes and advisories — with feature limits shown.
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
                  Document retrieval (source coverage needs review)
                </span>
                <span className="flex items-center gap-1.5">
                  <MessagesSquare className="h-3.5 w-3.5 text-leaf-deep"/>
                  Voice and local languages: in development
                </span>
              </div>
            </Reveal>
          </div>

          {/* floating advisory card */}
          <Reveal delay={0.3} className="hidden lg:block">
            <div className="animate-floaty relative ml-auto w-72 rounded-3xl border border-ink/10 bg-ink p-5 text-cream shadow-[0_30px_60px_-20px_rgba(11,16,10,0.45)]">
              <div className="flex items-center justify-between">
                <Chip tone="leaf">Crop Recommendation</Chip>
                <span className="text-[10px] tracking-widest text-mist uppercase">illustrative</span>
              </div>
              <p className="mt-4 font-display text-2xl leading-snug">
                Crop model shortlist
              </p>
              <p className="mt-2 text-xs leading-relaxed text-mist">
                Example only · not a farm-specific result
              </p>
              <div className="mt-4 space-y-2 border-t border-line pt-4 text-[11px] text-mist">
                <p className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-leaf"/> Model uses N, P, K, temperature, humidity, pH and rainfall
                </p>
                <p className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-leaf"/> Farm season and water are not classifier inputs
                </p>
                <p className="flex items-center gap-2">
                  <CloudSun className="h-3.5 w-3.5 text-marigold"/> Scores are not calibrated success probabilities
                </p>
              </div>
            </div>
          </Reveal>
        </div>

        {/* hero image with floaters */}
        <Reveal delay={0.2} className="relative mt-14 md:mt-20">
          <motion.div style={{ y: imgY }} className="relative h-[52vh] min-h-[340px] overflow-hidden rounded-[2rem] md:h-[68vh]">
            <img src="/images/hero-field.jpg" alt="Indian farmland at golden hour" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-ink/55 via-transparent to-transparent"/>
            <div className="absolute bottom-5 left-5 flex items-center gap-3 rounded-2xl border border-cream/20 bg-ink/70 px-4 py-3 backdrop-blur-md md:bottom-8 md:left-8">
              <MapPin className="h-4 w-4 text-leaf"/>
              <div>
                <p className="text-xs font-bold text-cream">
                  Armoor, Nizamabad — Telangana
                </p>
                <p className="text-[10px] tracking-wide text-mist">
                  Illustrative weather card · check your farm forecast
                </p>
              </div>
            </div>
            <div className="animate-floaty absolute top-6 right-6 hidden rounded-2xl border border-cream/20 bg-ink/70 px-4 py-3 backdrop-blur-md md:block" style={{ animationDelay: "1.2s" }}>
              <p className="flex items-center gap-1.5 text-xs font-bold text-cream">Market module</p>
              <p className="text-[10px] text-mist">Demonstration data · not a live mandi quote</p>
            </div>
          </motion.div>
        </Reveal>

        {/* stats */}
        <div className="mt-10 grid grid-cols-2 gap-y-8 border-t border-ink/10 pt-8 md:grid-cols-4 md:pt-10">
          {[
            { title: "Crop model", detail: "Experimental shortlist; local suitability not established" },
            { title: "Soil model", detail: "Nutrient ratings; does not calculate fertilizer doses" },
            { title: "Disease model", detail: "38-class leaf-photo screening · preliminary result" },
            { title: "Market model", detail: "Demonstration inputs; not current market prices" },
        ].map((s, i) => (<Reveal key={s.title} delay={i * 0.06}>
              <p className="font-display text-xl font-medium md:text-2xl">{s.title}</p>
              <p className="mt-1 text-xs leading-relaxed tracking-wide text-ink/55">{s.detail}</p>
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
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 border-t border-line bg-ink/95 py-2 px-3 md:inset-x-auto md:top-1/2 md:bottom-auto md:left-0 md:-translate-y-1/2 md:justify-start md:border-y md:border-r md:border-t-0 md:py-4 md:pl-5 md:pr-4">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-leaf"/>
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-mist">
          Illustrative market values · not live
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
        tag: "Experimental model shortlist",
        desc: "A trained classifier returns crop labels from soil and weather numbers. Its scores are not calibrated success probabilities, and saved season, water, and previous crop do not affect its ranking.",
        points: [
            "Inputs: N, P, K, temperature, humidity, pH and rainfall",
            "Farm context is shown separately for review",
            "Confirm the shortlist with local agricultural guidance",
        ],
        sample: "Classifier scores are not success probabilities",
        href: "/agents/crop",
    },
    {
        n: "02",
        icon: FlaskConical,
        title: "Soil & Fertiliser",
        tag: "Soil nutrient ratings",
        desc: "The trained model classifies nutrient ratings from soil-test measurements. It does not calculate fertilizer products, application rates, or a field schedule.",
        points: [
            "Review soil-test values and units",
            "Regional references are general, not field-specific",
            "Use your Soil Health Card or a qualified agronomist for doses",
        ],
        sample: "Ratings only · no fertilizer dose",
        href: "/agents/fertilizer",
    },
    {
        n: "03",
        icon: Stethoscope,
        title: "Disease Detection",
        tag: "Preliminary model screening",
        desc: "A 38-class leaf-image model can return a preliminary screening label. It has not been validated on local field images and is not a confirmed diagnosis.",
        points: [
            "Upload a clear JPG or PNG leaf photo",
            "Scores are not calibrated confidence",
            "Confirm with a local KVK or qualified plant-health expert",
        ],
        sample: "Experimental screening · confirm locally",
        href: "/disease",
    },
    {
        n: "04",
        icon: CloudSun,
        title: "Weather Intelligence",
        tag: "Location-based weather context",
        desc: "View a farm forecast as context. KisanAI does not turn it into pesticide timing or automatically change calendar tasks.",
        points: [
            "Forecast shown with its weather source",
            "Check current conditions before field operations",
            "Not a government agromet advisory",
        ],
        sample: "Weather context · not an operation instruction",
        href: "/weather",
    },
    {
        n: "05",
        icon: LineChart,
        title: "Market Insights",
        tag: "Demonstration model estimates",
        desc: "The current market model uses sample historical inputs. Its output is not a live mandi quote or a verified selling recommendation.",
        points: [
            "Sample inputs are labeled in the market screen",
            "Price units and forecast horizon need verification",
            "Confirm current rates with a local mandi or buyer",
        ],
        sample: "Sample data · not live prices",
        href: "/market",
    },
    {
        n: "06",
        icon: Landmark,
        title: "Government Schemes",
        tag: "General scheme directory",
        desc: "Review general scheme summaries and open official portals. KisanAI does not check eligibility, benefits, or application windows.",
        points: [
            "No farm-specific eligibility decision",
            "Verify current rules and dates on official portals",
            "State and district implementation can differ",
        ],
        sample: "Official links · verify current details",
        href: "/schemes",
    },
];
function Agents() {
    return (<section id="agents" className="relative bg-ink py-24 md:py-32">
      <div className="glow-leaf pointer-events-none absolute top-0 left-1/4 h-96 w-96" aria-hidden/>
      <div className="relative mx-auto max-w-7xl px-5 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHead eyebrow="Six available modules" title={<>
                Farm tools with different readiness levels.
              </>} desc="KisanAI connects several tools, but readiness varies by module. Model outputs, source links, draft calendars, and unavailable features are labeled in the app."/>
          <Reveal delay={0.15}>
            <span className="inline-flex items-center gap-2 rounded-full border border-leaf/30 bg-leaf/10 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-leaf">
              <Cpu className="h-3.5 w-3.5"/> Orchestrator + validation checks
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
        d: "Use the farm profile and available agent forms; voice input is not available yet.",
    },
    {
        icon: Workflow,
        t: "Agents reason together",
        d: "The orchestrator calls selected agents and validation checks; not every answer uses every agent.",
    },
    {
        icon: CalendarRange,
        t: "A season plan lands",
        d: "A draft crop timeline with preparation, check-ins, and an estimated harvest window.",
    },
    {
        icon: ShieldCheck,
        t: "You farm with proof",
        d: "Review model inputs, limitations, and sources; mark or reschedule calendar tasks.",
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
                </>} desc="KisanAI brings farm records, available model tools, forecast context, draft calendars, and official reference links together. Some capabilities remain experimental or unavailable."/>
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
              <img src="/images/cotton-close.jpg" alt="Cotton bolls close up" width="900" height="1100" className="h-auto w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/10 to-transparent"/>
              <div className="absolute right-6 bottom-6 left-6">
                <p className="font-display text-2xl leading-snug text-cream md:text-[1.7rem]">
                  Field imagery for the KisanAI farm-planning experience.
                </p>
                <p className="mt-3 text-xs tracking-wide text-mist">
                  Illustrative image · not a farmer testimonial
                </p>
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
        d: "Crop inputs and model limitations are shown. Current scores do not explain local season, water, or soil-type fit.",
    },
    {
        icon: CloudSun,
        t: "Weather-smart nudges",
        d: "Location-based forecast context is available; it does not prescribe spray timing or update calendar tasks.",
    },
    {
        icon: LineChart,
        t: "Market model demonstration",
        d: "Current estimates use sample historical inputs and are not live mandi prices.",
    },
    {
        icon: Landmark,
        t: "Official scheme links",
        d: "Review general summaries and verify eligibility, terms, and application windows with the official portal.",
    },
];
function Promise() {
    return (<section id="promise" className="border-t border-line bg-ink py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <SectionHead eyebrow="Current capabilities" title={<>
              Useful tools, with their{" "}
              <span className="italic text-leaf">limits in view.</span>
            </>} desc="This project is under development and is not yet a validated or production-ready farming adviser."/>
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
/* ———————————————— CTA + Footer ———————————————— */
function Cta() {
    return (<section className="relative overflow-hidden border-t border-line bg-ink">
      <div className="glow-leaf pointer-events-none absolute top-1/2 left-1/2 h-[30rem] w-[46rem] -translate-x-1/2 -translate-y-1/2" aria-hidden/>
      <div className="relative mx-auto max-w-5xl px-5 py-24 text-center md:py-32">
        <Reveal>
          <Leaf className="mx-auto h-8 w-8 text-leaf"/>
          <h2 className="mt-6 font-display text-5xl leading-[1.02] font-medium tracking-tight text-balance text-cream md:text-7xl">
            Plan your next season.
            <br />
            <span className="italic text-leaf">Review every suggestion.</span>
          </h2>
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
            Farm planning tools under development. Model outputs are
            experimental; verify decisions with local agricultural experts.
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
        Crop and soil models · draft planning · official source links
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
      <Promise />
      <Cta />
      <Footer />
    </main>);
}
