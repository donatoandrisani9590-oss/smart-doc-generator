/**
 * ActivityFeedWidget - Recent activity stream
 *
 * ContractHero-inspired: Shows recent document activities.
 *
 * Features:
 * - Timeline of recent activities
 * - Activity types: created, edited, exported, approved
 * - User avatars and timestamps
 * - Quick links to documents
 *
 * Respektiert Feature-Toggle: show_activity_feed
 */

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  FileText,
  FileCheck,
  Download,
  Edit3,
  CheckCircle,
  XCircle,
  Clock,
  User,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { api } from "@/lib/api-client";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { useFeatureEnabled } from "@/hooks/useFeatureSettings";

// Types
interface ActivityItem {
  id: number;
  activity_type: string;
  entity_type: string;
  entity_id: number;
  entity_name: string;
  user_email: string;
  user_id: number;
  details: Record<string, unknown>;
  created_at: string;
}

interface ActivityResponse {
  activities: ActivityItem[];
  total: number;
}

// Activity type configurations
const ACTIVITY_CONFIGS: Record<
  string,
  {
    icon: React.ElementType;
    color: string;
    label: string;
  }
> = {
  document_created: {
    icon: FileText,
    color: "text-blue-600 bg-blue-50",
    label: "erstellt",
  },
  document_exported: {
    icon: Download,
    color: "text-green-600 bg-green-50",
    label: "exportiert",
  },
  document_edited: {
    icon: Edit3,
    color: "text-amber-600 bg-amber-50",
    label: "bearbeitet",
  },
  document_approved: {
    icon: CheckCircle,
    color: "text-emerald-600 bg-emerald-50",
    label: "genehmigt",
  },
  document_rejected: {
    icon: XCircle,
    color: "text-red-600 bg-red-50",
    label: "abgelehnt",
  },
  clause_created: {
    icon: FileCheck,
    color: "text-purple-600 bg-purple-50",
    label: "erstellt",
  },
  clause_approved: {
    icon: CheckCircle,
    color: "text-emerald-600 bg-emerald-50",
    label: "freigegeben",
  },
  draft_saved: {
    icon: Clock,
    color: "text-gray-600 bg-gray-50",
    label: "gespeichert",
  },
};

// Get user initials
const getInitials = (email: string) => {
  const parts = email.split("@")[0].split(".");
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return email.substring(0, 2).toUpperCase();
};

interface ActivityFeedWidgetProps {
  /** Maximum number of activities to show */
  limit?: number;
  /** Show header */
  showHeader?: boolean;
  /** Custom class name */
  className?: string;
}

export function ActivityFeedWidget({
  limit = 5,
  showHeader = true,
  className,
}: ActivityFeedWidgetProps) {
  const navigate = useNavigate();
  const isEnabled = useFeatureEnabled("show_activity_feed");

  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch activities
  const fetchActivities = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.get<ActivityResponse>(
        `/api/v1/audit?limit=${limit}&action_type=document`
      );
      setActivities(response.data.activities || []);
    } catch (err) {
      console.error("Failed to load activities:", err);
      // Fallback to mock data if endpoint doesn't exist
      setActivities([]);
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    if (isEnabled) {
      fetchActivities();
    }
  }, [fetchActivities, isEnabled]);

  // Navigate to entity
  const handleClick = (activity: ActivityItem) => {
    if (activity.entity_type === "document") {
      navigate(`/documents/${activity.entity_id}`);
    } else if (activity.entity_type === "clause") {
      navigate(`/settings?tab=clauses&id=${activity.entity_id}`);
    } else if (activity.entity_type === "draft") {
      navigate(`/generate?draft=${activity.entity_id}`);
    }
  };

  // Don't render if feature is disabled
  if (!isEnabled) {
    return null;
  }

  // Loading state
  if (isLoading) {
    return (
      <Card className={className}>
        {showHeader && (
          <CardHeader className="pb-3">
            <Skeleton className="h-5 w-32" />
          </CardHeader>
        )}
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton className="w-8 h-8 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (activities.length === 0) {
    return (
      <Card className={className}>
        {showHeader && (
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-muted-foreground" />
              Aktivitäten
            </CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className="text-center py-6">
            <Activity className="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">
              Noch keine Aktivitäten
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      {showHeader && (
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-muted-foreground" />
              Aktivitäten
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-xs"
              onClick={() => navigate("/settings?tab=advanced&section=audit")}
            >
              Alle anzeigen
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
      )}

      <CardContent>
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-4 top-2 bottom-2 w-px bg-border" />

          {/* Activities */}
          <div className="space-y-4">
            {activities.map((activity, index) => {
              const config =
                ACTIVITY_CONFIGS[activity.activity_type] ||
                ACTIVITY_CONFIGS.document_created;
              const Icon = config.icon;

              return (
                <div
                  key={activity.id || index}
                  className="relative flex items-start gap-3 pl-2 cursor-pointer group"
                  onClick={() => handleClick(activity)}
                >
                  {/* Icon */}
                  <div
                    className={`relative z-10 p-1.5 rounded-full ${config.color} transition-transform group-hover:scale-110`}
                  >
                    <Icon className="w-3 h-3" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pt-0.5">
                    <p className="text-sm">
                      <span className="font-medium">
                        {activity.entity_name || `Dokument #${activity.entity_id}`}
                      </span>{" "}
                      <span className="text-muted-foreground">
                        {config.label}
                      </span>
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <Avatar className="w-4 h-4">
                        <AvatarFallback className="text-[8px]">
                          {getInitials(activity.user_email)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate">{activity.user_email}</span>
                      <span>•</span>
                      <span>
                        {formatDistanceToNow(new Date(activity.created_at), {
                          locale: de,
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default ActivityFeedWidget;
