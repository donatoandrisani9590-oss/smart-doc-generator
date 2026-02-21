/**
 * Dashboard — Design System v2.1 Hero Layout
 *
 * Centered hero greeting with glass search bar and action chips.
 * KPI stat cards in a 3-column row with accent stripe on primary KPI.
 * Conditional action stats shown only when non-zero.
 * Bottom: Quick templates + Recent drafts in 2-col grid.
 */

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import {
  FileBarChart,
  FileStack,
  Files,
  MailX,
  RotateCcw,
  CalendarClock,
  ShieldCheck,
  Timer,
  FileText,
  Briefcase,
  FileSignature,
  UserMinus,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardStats, useDocumentTypes } from "@/hooks/useApi";
import { api } from "@/lib/api-client";
import { CommandCenter } from "@/components/dashboard/CommandCenter";
import { StatWidget } from "@/components/dashboard/StatWidget";
import { ActionStatWidget } from "@/components/dashboard/ActionStatWidget";
import { QuickTemplatesGrid } from "@/components/dashboard/QuickTemplatesGrid";
import { RecentDrafts } from "@/components/dashboard/RecentDrafts";
import { TextReveal } from "@/components/ui/text-reveal";
import { useGsapHover } from "@/hooks/useGsapHover";
import { useCursorSpotlight } from "@/hooks/useCursorSpotlight";

gsap.registerPlugin(ScrollTrigger);

// ── Helpers (unchanged from original) ────────────────────────────────────

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Guten Morgen";
  if (hour < 18) return "Guten Tag";
  return "Guten Abend";
};

const getFirstName = (email: string): string | null => {
  const name = email.split("@")[0];
  const parts = name.split(/[._-]/);
  if (parts.length > 0 && parts[0].length > 1) {
    return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  }
  return null;
};

// ── Action Chip icon helper ──────────────────────────────────────────────

const getChipIcon = (name: string) => {
  const n = name.toLowerCase();
  if (n.includes("arbeitsvertrag") || n.includes("anstellung")) return Briefcase;
  if (n.includes("nachtrag") || n.includes("änderung")) return FileSignature;
  if (n.includes("kündigung") || n.includes("aufhebung")) return UserMinus;
  return FileText;
};

// ── Action Summary Types ─────────────────────────────────────────────────

interface ActionSummaryResponse {
  ohne_versand: number;
  ruecksendung_ausstehend: number;
  wiedervorlage_faellig: number;
  freigabe_offen: number;
  entwuerfe_ablaufend: number;
}

const ACTION_STATS = [
  { key: "ohne_versand" as const, label: "Ohne Versand", icon: MailX, accent: "bg-amber-500" },
  { key: "ruecksendung_ausstehend" as const, label: "Rücksendung ausstehend", icon: RotateCcw, accent: "bg-blue-500" },
  { key: "wiedervorlage_faellig" as const, label: "Wiedervorlage fällig", icon: CalendarClock, accent: "bg-red-500" },
  { key: "freigabe_offen" as const, label: "Freigabe offen", icon: ShieldCheck, accent: "bg-purple-500" },
  { key: "entwuerfe_ablaufend" as const, label: "Entwürfe ablaufend", icon: Timer, accent: "bg-warm-400" },
];

// ── Component ────────────────────────────────────────────────────────────

export const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: documentTypes } = useDocumentTypes();
  const containerRef = useRef<HTMLDivElement>(null);
  const hoverRef = useGsapHover();
  const spotlightRef = useCursorSpotlight();

  const [actionSummary, setActionSummary] = useState<ActionSummaryResponse | null>(null);

  const firstName = user ? getFirstName(user.email) : null;

  // GSAP entrance + scroll-reveal animations
  useGSAP(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    // Hero subtitle: fade-up (TextReveal handles the h1 word-split)
    gsap.from("[data-gsap='subtitle']", {
      y: 14,
      opacity: 0,
      duration: 0.6,
      delay: 0.25,
      ease: "power2.out",
    });

    // Command Center: scale-in with slight delay
    gsap.from("[data-gsap='command']", {
      y: 16,
      opacity: 0,
      scale: 0.98,
      duration: 0.6,
      delay: 0.35,
      ease: "power2.out",
    });

    // Stat widgets: staggered reveal
    gsap.from("[data-gsap='stat']", {
      y: 30,
      opacity: 0,
      duration: 0.5,
      stagger: 0.08,
      delay: 0.5,
      ease: "power2.out",
    });

    // Parallax: hero greeting moves slower than content on scroll
    gsap.to("[data-gsap='greeting']", {
      y: -40,
      ease: "none",
      scrollTrigger: {
        trigger: "[data-gsap='greeting']",
        start: "top top+=100",
        end: "bottom top",
        scrub: 0.8,
      },
    });

    // Bottom grid sections: scroll-triggered reveal
    gsap.utils.toArray<HTMLElement>("[data-gsap='section']").forEach((el) => {
      gsap.from(el, {
        y: 40,
        opacity: 0,
        duration: 0.7,
        ease: "power2.out",
        scrollTrigger: {
          trigger: el,
          start: "top 90%",
          once: true,
        },
      });
    });
  }, { scope: containerRef });

  // Fetch action summary for conditional stat cards
  useEffect(() => {
    api.get<ActionSummaryResponse>("/api/v1/repository/action-summary")
      .then(({ data }) => setActionSummary(data))
      .catch(() => {});
  }, []);

  const hasDocTypes = (documentTypes?.length ?? 0) > 0;

  return (
    <div ref={(el) => {
      (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
      (hoverRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
      (spotlightRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
    }}>
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ── Hero Section: Greeting + Search (Prototype ai-hero) ── */}
        <div className="text-center pt-6 pb-2 space-y-6" data-gsap="greeting">
          <div className="space-y-1.5">
            <TextReveal
              as="h1"
              className="text-[30px] font-extrabold tracking-[-0.03em] text-[var(--text-primary)]"
              stagger={0.05}
              duration={0.7}
            >
              {`${getGreeting()}${firstName ? `, ${firstName}` : ""}`}
            </TextReveal>
            <p className="text-[15px] text-[var(--text-secondary)]" data-gsap="subtitle">
              {!hasDocTypes
                ? "Richte deine erste Dokumentvorlage ein"
                : <>Wie kann ich dir heute <span className="text-[var(--nw-blue-700)] dark:text-[var(--nw-blue-300)] font-medium">helfen?</span></>
              }
            </p>
          </div>

          {/* Glass Search Bar */}
          <div data-gsap="command">
            <CommandCenter />
          </div>

          {/* Action Chips — top 3 document types as quick-start pills */}
          {hasDocTypes && documentTypes && (
            <div className="action-chips" data-gsap="subtitle">
              {documentTypes.filter((t: { is_active: boolean }) => t.is_active).slice(0, 3).map((type: { id: number; name: string }) => {
                const Icon = getChipIcon(type.name);
                return (
                  <button
                    key={type.id}
                    className="action-chip"
                    onClick={() => navigate(`/generate?type=${type.id}`)}
                  >
                    <Icon className="icon" />
                    {type.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── KPI Cards Row (Prototype stat-grid) ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div data-gsap="stat" data-hover="lift" data-spotlight>
            <StatWidget
              value={stats?.documents_this_month ?? 0}
              label="Diesen Monat"
              icon={FileBarChart}
              loading={statsLoading}
              iconBg="bg-[var(--nw-blue-50)]"
              iconColor="text-[var(--nw-blue)]"
            />
          </div>
          <div data-gsap="stat" data-hover="lift" data-spotlight>
            <StatWidget
              value={stats?.open_drafts ?? 0}
              label="Offen"
              icon={FileStack}
              loading={statsLoading}
              accent
              onClick={() => navigate("/documents?status=draft")}
              iconBg="bg-[var(--nw-amber-light)]"
              iconColor="text-[var(--nw-amber)]"
            />
          </div>
          <div data-gsap="stat" data-hover="lift" data-spotlight>
            <StatWidget
              value={stats?.documents_total ?? 0}
              label="Gesamt"
              icon={Files}
              loading={statsLoading}
              onClick={() => navigate("/documents")}
              iconBg="bg-[var(--nw-green-light)]"
              iconColor="text-[var(--nw-green)]"
            />
          </div>
        </div>

        {/* ── Action Stats — only non-zero values, tight to KPI row ── */}
        {actionSummary && ACTION_STATS.filter((a) => (actionSummary[a.key] ?? 0) > 0).length > 0 && (
          <div className="-mt-2 flex flex-wrap gap-3">
            {ACTION_STATS
              .filter((a) => (actionSummary[a.key] ?? 0) > 0)
              .map((a) => (
                <div key={a.key} data-gsap="stat">
                  <ActionStatWidget
                    value={actionSummary[a.key]}
                    label={a.label}
                    icon={a.icon}
                    accentColor={a.accent}
                    onClick={() => navigate(`/documents?action=${a.key}`)}
                  />
                </div>
              ))
            }
          </div>
        )}

        {/* ── Bottom Grid: Templates + Drafts ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {hasDocTypes && (
            <div data-gsap="section">
              <QuickTemplatesGrid />
            </div>
          )}
          <div data-gsap="section">
            <RecentDrafts />
          </div>
        </div>

      </div>
    </div>
  );
};
