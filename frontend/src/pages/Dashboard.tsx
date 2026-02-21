/**
 * Dashboard — Ive-Inspired Widget Grid
 *
 * Breathing light-gray canvas (#F5F5F7) with floating white widget cards.
 * No hero banner. Pure typography greeting. Conditional action stats.
 * Grid: 1 col mobile → 3 col tablet → 4 col desktop.
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileBarChart,
  FileStack,
  Files,
  MailX,
  RotateCcw,
  CalendarClock,
  ShieldCheck,
  Timer,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardStats, useDocumentTypes } from "@/hooks/useApi";
import { api } from "@/lib/api-client";
import { CommandCenter } from "@/components/dashboard/CommandCenter";
import { StatWidget } from "@/components/dashboard/StatWidget";
import { ActionStatWidget } from "@/components/dashboard/ActionStatWidget";
import { QuickTemplatesGrid } from "@/components/dashboard/QuickTemplatesGrid";
import { RecentDrafts } from "@/components/dashboard/RecentDrafts";

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

  const [actionSummary, setActionSummary] = useState<ActionSummaryResponse | null>(null);

  const firstName = user ? getFirstName(user.email) : null;

  // Fetch action summary for conditional stat cards
  useEffect(() => {
    api.get<ActionSummaryResponse>("/api/v1/repository/action-summary")
      .then(({ data }) => setActionSummary(data))
      .catch(() => {});
  }, []);

  const hasDocTypes = (documentTypes?.length ?? 0) > 0;

  // Compute greeting subtitle
  const openDrafts = stats?.open_drafts ?? 0;
  const subtitle = !hasDocTypes
    ? "Richte deine erste Dokumentvorlage ein"
    : openDrafts > 0
      ? `Du hast ${openDrafts} offene ${openDrafts === 1 ? "Entwurf" : "Entwürfe"}`
      : "Alles erledigt — Zeit für neue Projekte!";

  return (
    <div className="animate-enter">
      {/* ── Canvas Container ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-8 space-y-8">

        {/* ── Greeting (no card, pure typography) ── */}
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            {getGreeting()}{firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="text-base text-muted-foreground mt-1">
            {subtitle}
          </p>
        </div>

        {/* ── Widget Grid ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-5">

          {/* Command Center — full width */}
          <div className="col-span-1 md:col-span-3 lg:col-span-4">
            <CommandCenter />
          </div>

          {/* Base Stats — always visible */}
          <StatWidget
            value={stats?.documents_this_month ?? 0}
            label="Diesen Monat"
            icon={FileBarChart}
            loading={statsLoading}
          />
          <StatWidget
            value={stats?.open_drafts ?? 0}
            label="Offen"
            icon={FileStack}
            loading={statsLoading}
            onClick={() => navigate("/documents?status=draft")}
          />
          <StatWidget
            value={stats?.documents_total ?? 0}
            label="Gesamt"
            icon={Files}
            loading={statsLoading}
            onClick={() => navigate("/documents")}
          />

          {/* Action stats — only non-zero values render */}
          {actionSummary && ACTION_STATS
            .filter((a) => (actionSummary[a.key] ?? 0) > 0)
            .map((a) => (
              <ActionStatWidget
                key={a.key}
                value={actionSummary[a.key]}
                label={a.label}
                icon={a.icon}
                accentColor={a.accent}
                onClick={() => navigate(`/documents?action=${a.key}`)}
              />
            ))
          }

          {/* Quick Templates — 2 cols */}
          {hasDocTypes && (
            <div className="col-span-1 md:col-span-2 lg:col-span-2">
              <QuickTemplatesGrid />
            </div>
          )}

          {/* Recent Drafts — 2 cols */}
          <div className="col-span-1 md:col-span-1 lg:col-span-2">
            <RecentDrafts />
          </div>
        </div>

      </div>
    </div>
  );
};
