/**
 * QuickTemplatesGrid — DS v2.1 quick-access document type cards.
 * Glass card container with hover lift. "KI" badge for SmartMode.
 */

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger);
import {
  FileText, Briefcase, FileSignature, UserMinus, Wand2, Award,
  AlertTriangle, Home, GraduationCap, Car, FileCheck, Clock,
  Gift, ScrollText, Shield,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { SmartModeDialog } from "@/components/generator/SmartModeDialog";
import { api } from "@/lib/api-client";
import { logError } from "@/lib/logger";
import { cn } from "@/lib/utils";

interface DocumentType {
  id: number;
  name: string;
  description?: string;
  country_code: string;
  is_active: boolean;
}

const getIconForType = (name: string) => {
  const n = name.toLowerCase();
  if (n.includes("arbeitsvertrag") || n.includes("anstellung")) return Briefcase;
  if (n.includes("einstellungszusage") || n.includes("zusage")) return FileCheck;
  if (n.includes("geheimhaltung") || n.includes("nda")) return Shield;
  if (n.includes("nachtrag") || n.includes("änderung")) return FileSignature;
  if (n.includes("gehaltserh") || n.includes("beförderung")) return Award;
  if (n.includes("abmahnung")) return AlertTriangle;
  if (n.includes("homeoffice") || n.includes("remote")) return Home;
  if (n.includes("fortbildung") || n.includes("weiterbildung")) return GraduationCap;
  if (n.includes("firmenwagen")) return Car;
  if (n.includes("bonus") || n.includes("prämie")) return Gift;
  if (n.includes("überstunden") || n.includes("arbeitszeit")) return Clock;
  if (n.includes("kündigung") || n.includes("aufhebung")) return UserMinus;
  if (n.includes("zeugnis")) return ScrollText;
  if (n.includes("freistellung")) return FileCheck;
  return FileText;
};

const ICON_COLORS = [
  "text-[var(--nw-blue-600)]",
  "text-[var(--nw-green-600)]",
  "text-[var(--nw-warm-600)]",
];

interface QuickTemplatesGridProps {
  className?: string;
}

export function QuickTemplatesGrid({ className }: QuickTemplatesGridProps) {
  const navigate = useNavigate();
  const [types, setTypes] = useState<DocumentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [smartModeOpen, setSmartModeOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<DocumentType | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Stagger-reveal items when they scroll into view
  useGSAP(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced || !gridRef.current || loading) return;

    const items = gridRef.current.querySelectorAll("[data-template-item]");
    if (items.length === 0) return;

    gsap.from(items, {
      y: 16,
      opacity: 0,
      duration: 0.4,
      stagger: 0.08,
      ease: "power2.out",
      scrollTrigger: {
        trigger: gridRef.current,
        start: "top 92%",
        once: true,
      },
    });
  }, { scope: gridRef, dependencies: [loading, types] });

  useEffect(() => {
    api.get<DocumentType[]>("/api/v1/document-types")
      .then(({ data }) => setTypes(data.filter((t) => t.is_active).slice(0, 3)))
      .catch((err) => logError("Failed to load quick templates", { error: err }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className={cn("glass-card", className)}>
        <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-4">Schnellstart</p>
        <div className="grid grid-cols-1 gap-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (types.length === 0) return null;

  return (
    <div ref={gridRef} className={cn("glass-card", className)}>
      <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-4">
        Schnellstart
      </p>
      <div className="grid grid-cols-1 gap-2">
        {types.map((type, index) => {
          const Icon = getIconForType(type.name);
          const iconColor = ICON_COLORS[index % ICON_COLORS.length];

          return (
            <div
              key={type.id}
              data-template-item
              className="flex items-center gap-3 p-3 rounded-[var(--radius-md-ds)] transition-all duration-200 hover:bg-[var(--bg-hover)] hover:-translate-y-px group"
            >
              <button
                onClick={() => navigate(`/generate?type=${type.id}`)}
                className="flex items-center gap-3 flex-1 min-w-0 text-left"
              >
                <Icon className={cn("w-5 h-5 shrink-0", iconColor)} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                    {type.name}
                  </p>
                  {type.description && (
                    <p className="text-xs text-[var(--text-secondary)] truncate">
                      {type.description}
                    </p>
                  )}
                </div>
              </button>
              <button
                onClick={() => {
                  setSelectedType(type);
                  setSmartModeOpen(true);
                }}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[var(--nw-blue-50)] text-[var(--nw-blue-700)] text-xs font-medium hover:bg-[var(--nw-blue-100)] transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                title="Mit KI erstellen"
              >
                <Wand2 className="w-3 h-3" />
                KI
              </button>
            </div>
          );
        })}
      </div>

      {selectedType && (
        <SmartModeDialog
          open={smartModeOpen}
          onOpenChange={setSmartModeOpen}
          documentTypeId={selectedType.id}
          documentTypeName={selectedType.name}
          onComplete={(formData, title) => {
            const params = new URLSearchParams();
            params.set("type", String(selectedType.id));
            params.set("data", JSON.stringify(formData));
            params.set("title", title);
            navigate(`/generate?${params.toString()}`);
          }}
        />
      )}
    </div>
  );
}
