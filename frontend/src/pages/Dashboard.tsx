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
import { motion, useInView } from "framer-motion";
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

// ── Framer Motion transition defaults ────────────────────────────────────

const fadeUpTransition = {
  duration: 0.6,
  ease: [0.33, 1, 0.68, 1] as const,
};

// ── Component ────────────────────────────────────────────────────────────

export const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: documentTypes } = useDocumentTypes();
  const containerRef = useRef<HTMLDivElement>(null);
  const hoverRef = useGsapHover();
  const spotlightRef = useCursorSpotlight();

  const bottomRef = useRef<HTMLDivElement>(null);
  const bottomInView = useInView(bottomRef, { once: true, margin: "-10% 0px" });

  const [actionSummary, setActionSummary] = useState<ActionSummaryResponse | null>(null);

  const firstName = user ? getFirstName(user.email) : null;

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
        <div className="text-center pt-6 pb-2 space-y-6">
          <div className="space-y-1.5">
            <TextReveal
              as="h1"
              className="text-[30px] font-extrabold tracking-[-0.03em] text-[var(--text-primary)]"
              stagger={0.05}
              duration={0.7}
            >
              {`${getGreeting()}${firstName ? `, ${firstName}` : ""}`}
            </TextReveal>
            <motion.p
              className="text-[15px] text-[var(--text-secondary)]"
              initial={{ y: 14, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ ...fadeUpTransition, delay: 0.25 }}
            >
              {!hasDocTypes
                ? "Richte deine erste Dokumentvorlage ein"
                : <>Wie kann ich dir heute <span className="text-[var(--nw-blue-700)] dark:text-[var(--nw-blue-300)] font-bold">helfen?</span></>
              }
            </motion.p>
          </div>

          {/* Glass Search Bar */}
          <motion.div
            initial={{ y: 16, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            transition={{ ...fadeUpTransition, delay: 0.35 }}
          >
            <CommandCenter />
          </motion.div>

          {/* Action Chips — top 3 document types as quick-start pills */}
          {hasDocTypes && documentTypes && (
            <motion.div
              className="action-chips"
              initial={{ y: 14, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ ...fadeUpTransition, delay: 0.25 }}
            >
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
            </motion.div>
          )}
        </div>

        {/* ── KPI Cards Row (Prototype stat-grid) ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              value: stats?.documents_this_month ?? 0,
              label: "Diesen Monat",
              icon: FileBarChart,
              iconBg: "bg-[var(--nw-blue-50)]",
              iconColor: "text-[var(--nw-blue)]",
            },
            {
              value: stats?.open_drafts ?? 0,
              label: "Offen",
              icon: FileStack,
              accent: true,
              onClick: () => navigate("/documents?status=draft"),
              iconBg: "bg-[var(--nw-amber-light)]",
              iconColor: "text-[var(--nw-amber)]",
            },
            {
              value: stats?.documents_total ?? 0,
              label: "Gesamt",
              icon: Files,
              onClick: () => navigate("/documents"),
              iconBg: "bg-[var(--nw-green-light)]",
              iconColor: "text-[var(--nw-green)]",
            },
          ].map((stat, index) => (
            <motion.div
              key={stat.label}
              data-hover="lift"
              data-spotlight
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{
                duration: 0.5,
                delay: 0.5 + index * 0.08,
                ease: [0.33, 1, 0.68, 1],
              }}
            >
              <StatWidget
                value={stat.value}
                label={stat.label}
                icon={stat.icon}
                loading={statsLoading}
                accent={stat.accent}
                onClick={stat.onClick}
                iconBg={stat.iconBg}
                iconColor={stat.iconColor}
              />
            </motion.div>
          ))}
        </div>

        {/* ── Action Stats — only non-zero values, tight to KPI row ── */}
        {actionSummary && ACTION_STATS.filter((a) => (actionSummary[a.key] ?? 0) > 0).length > 0 && (
          <div className="-mt-2 flex flex-wrap gap-3">
            {ACTION_STATS
              .filter((a) => (actionSummary[a.key] ?? 0) > 0)
              .map((a, index) => (
                <motion.div
                  key={a.key}
                  initial={{ y: 30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{
                    duration: 0.5,
                    delay: 0.5 + index * 0.08,
                    ease: [0.33, 1, 0.68, 1],
                  }}
                >
                  <ActionStatWidget
                    value={actionSummary[a.key]}
                    label={a.label}
                    icon={a.icon}
                    accentColor={a.accent}
                    onClick={() => navigate(`/documents?action=${a.key}`)}
                  />
                </motion.div>
              ))
            }
          </div>
        )}

        {/* ── Bottom Grid: Templates + Drafts ── */}
        <div ref={bottomRef} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={bottomInView ? { y: 0, opacity: 1 } : { y: 40, opacity: 0 }}
            transition={{ duration: 0.7, ease: [0.33, 1, 0.68, 1] }}
          >
            <QuickTemplatesGrid />
          </motion.div>
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={bottomInView ? { y: 0, opacity: 1 } : { y: 40, opacity: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.33, 1, 0.68, 1] }}
          >
            <RecentDrafts />
          </motion.div>
        </div>

      </div>
    </div>
  );
};
