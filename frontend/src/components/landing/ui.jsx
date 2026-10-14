import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Sprout } from "lucide-react";
import { cn } from "@/lib/utils";

/* ————————— Wordmark ————————— */
export function Wordmark({ dark = true }) {
    return (<span className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-leaf text-ink shadow-[0_8px_20px_rgba(163,230,53,0.3)]">
        <Sprout className="h-5 w-5" strokeWidth={2.2}/>
      </span>
      <span className="leading-tight">
        <span className={cn("block font-display text-lg font-semibold tracking-tight", dark ? "text-cream" : "text-ink")}>
          KisanAI
        </span>
        <span className={cn("block text-[9px] font-bold uppercase tracking-[0.2em]", dark ? "text-mist" : "text-ink/50")}>
          AI for Smarter Farming
        </span>
      </span>
    </span>);
}

const chipTones = {
    leaf: "border-leaf/30 bg-leaf/10 text-leaf",
    marigold: "border-marigold/30 bg-marigold/10 text-marigold",
    cream: "border-cream/25 bg-cream/10 text-cream",
};

export function Chip({ tone = "leaf", children, className, }) {
    return (<span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em]", chipTones[tone], className)}>
      {children}
    </span>);
}

/* ————————— Reveal (framer-motion, lightweight) ————————— */
export function Reveal({ children, delay = 0, className, }) {
    return (<motion.div initial={{ opacity: 0, y: 26 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-70px" }} transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }} className={className}>
      {children}
    </motion.div>);
}

/* ————————— CountUp ————————— */
export function CountUp({ to, suffix = "", className, }) {
    const ref = useRef(null);
    const [val, setVal] = useState(0);
    const started = useRef(false);
    useEffect(() => {
        const el = ref.current;
        if (!el)
            return;
        const obs = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting && !started.current) {
                started.current = true;
                const t0 = performance.now();
                const dur = 1500;
                const tick = (t) => {
                    const p = Math.min(1, (t - t0) / dur);
                    const eased = 1 - Math.pow(1 - p, 3);
                    setVal(Math.round(to * eased));
                    if (p < 1)
                        requestAnimationFrame(tick);
                };
                requestAnimationFrame(tick);
                obs.disconnect();
            }
        }, { threshold: 0.4 });
        obs.observe(el);
        return () => obs.disconnect();
    }, [to]);
    return (<span ref={ref} className={className}>
      {val}
      {suffix}
    </span>);
}

/* ————————— SectionHead ————————— */
export function SectionHead({ eyebrow, title, desc, light = false, }) {
    return (<div className="max-w-2xl">
      <p className={cn("text-[11px] font-bold uppercase tracking-[0.22em]", light ? "text-leaf-deep" : "text-leaf")}>
        {eyebrow}
      </p>
      <h2 className={cn("mt-4 font-display text-4xl font-medium tracking-tight text-balance md:text-5xl", light ? "text-ink" : "text-cream")}>
        {title}
      </h2>
      {desc && (<p className={cn("mt-4 text-[15px] leading-relaxed", light ? "text-ink/60" : "text-mist")}>
          {desc}
        </p>)}
    </div>);
}