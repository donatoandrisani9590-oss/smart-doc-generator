/**
 * Notifications Page (15.5.6)
 *
 * Full page view for all notifications with:
 * - Filtering by type and read status
 * - Preference management
 * - Pagination
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TextReveal } from "@/components/ui/text-reveal";
import {
    useNotifications,
    useMarkAsRead,
    useMarkAllAsRead,
    useDismissNotification,
    useNotificationPreferences,
    useNotificationTypes,
    useUpdateNotificationPreference,
    type NotificationItem,
} from "@/hooks/useApi";
import {
    Bell,
    Check,
    CheckCheck,
    X,
    FileText,
    Users,
    Clock,
    AlertCircle,
    Package,
    Share2,
    Settings,
    Loader2,
} from "lucide-react";
import { Pagination } from "@/components/ui/pagination";
import { formatDistanceToNow } from "@/lib/dateUtils";

// Notification type icons
const typeIcons: Record<string, React.ElementType> = {
    document_created: FileText,
    document_corrected: FileText,
    document_shared: Share2,
    draft_reminder: Clock,
    bulk_completed: Package,
    approval_required: AlertCircle,
    retention_warning: AlertCircle,
    team_invite: Users,
    system: Settings,
};

// Priority colors
const priorityColors: Record<string, string> = {
    low: "border-l-warm-300",
    normal: "border-l-blue-400",
    high: "border-l-amber-400",
    urgent: "border-l-red-500",
};

export const NotificationsPage = () => {
    const [page, setPage] = useState(1);
    const [unreadOnly, setUnreadOnly] = useState(false);
    const [showSettings, setShowSettings] = useState(false);

    const { data: notifications, isLoading } = useNotifications(page, unreadOnly);
    const markAsRead = useMarkAsRead();
    const markAllAsRead = useMarkAllAsRead();
    const dismiss = useDismissNotification();

    const items = notifications?.notifications ?? [];
    const totalPages = Math.ceil((notifications?.total ?? 0) / 20);

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <TextReveal as="h1" className="text-[28px] font-extrabold tracking-[-0.03em] text-[var(--text-primary)]" stagger={0.04} duration={0.6}>Benachrichtigungen</TextReveal>
                    <p className="text-[14px] text-[var(--text-secondary)] mt-1">
                        {notifications?.unread_count ?? 0} ungelesene Benachrichtigungen
                    </p>
                </div>
                <div className="flex gap-2">
                    {notifications?.unread_count && notifications.unread_count > 0 && (
                        <Button
                            variant="outline"
                            onClick={() => markAllAsRead.mutate()}
                            disabled={markAllAsRead.isPending}
                        >
                            <CheckCheck className="w-4 h-4 mr-2" />
                            Alle als gelesen markieren
                        </Button>
                    )}
                    <Button
                        variant={showSettings ? "default" : "outline"}
                        onClick={() => setShowSettings(!showSettings)}
                    >
                        <Settings className="w-4 h-4 mr-2" />
                        Einstellungen
                    </Button>
                </div>
            </div>

            {/* Settings Panel */}
            {showSettings && <NotificationSettings />}

            {/* Filters */}
            <div className="filter-chips">
                <button
                    className={`filter-chip ${!unreadOnly ? 'active' : ''}`}
                    onClick={() => { setUnreadOnly(false); setPage(1); }}
                >
                    Alle
                </button>
                <button
                    className={`filter-chip ${unreadOnly ? 'active' : ''}`}
                    onClick={() => { setUnreadOnly(true); setPage(1); }}
                >
                    Nur ungelesen
                </button>
            </div>

            {/* Notification List */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">
                        {notifications?.total ?? 0} Benachrichtigungen
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : items.length === 0 ? (
                        <div className="empty-state py-12">
                            <div className="w-14 h-14 rounded-2xl bg-[var(--nw-warm-100)] flex items-center justify-center mb-4">
                                <Bell className="w-7 h-7 text-[var(--nw-warm-500)]" />
                            </div>
                            <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">Keine Benachrichtigungen</p>
                            <p className="text-[13px] text-[var(--text-secondary)] max-w-[280px] leading-relaxed">
                                {unreadOnly
                                    ? "Du hast alle Benachrichtigungen gelesen."
                                    : "Du hast noch keine Benachrichtigungen erhalten."}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {items.map((notification) => (
                                <NotificationCard
                                    key={notification.id}
                                    notification={notification}
                                    onMarkAsRead={() => markAsRead.mutate(notification.id)}
                                    onDismiss={() => dismiss.mutate(notification.id)}
                                />
                            ))}
                        </div>
                    )}

                    {/* Pagination */}
                    <Pagination
                        currentPage={page}
                        totalPages={totalPages}
                        onPageChange={setPage}
                        className="mt-6 pt-4 border-t"
                    />
                </CardContent>
            </Card>
        </div>
    );
};

// Individual notification card
const NotificationCard = ({
    notification,
    onMarkAsRead,
    onDismiss,
}: {
    notification: NotificationItem;
    onMarkAsRead: () => void;
    onDismiss: () => void;
}) => {
    const Icon = typeIcons[notification.notification_type] || Bell;
    const priorityClass = priorityColors[notification.priority] || priorityColors.normal;

    return (
        <div
            className={`p-4 rounded-lg border border-l-4 ${priorityClass} ${
                !notification.is_read ? "bg-primary/5" : "bg-background"
            }`}
        >
            <div className="flex gap-4">
                {/* Icon */}
                <div
                    className={`p-3 rounded-lg shrink-0 ${
                        !notification.is_read ? "bg-primary/10" : "bg-muted"
                    }`}
                >
                    <Icon
                        className={`w-5 h-5 ${
                            !notification.is_read ? "text-primary" : "text-muted-foreground"
                        }`}
                    />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h3
                                className={`font-medium ${
                                    !notification.is_read ? "" : "text-muted-foreground"
                                }`}
                            >
                                {notification.title}
                            </h3>
                            <p className="text-sm text-muted-foreground mt-1">
                                {notification.message}
                            </p>
                            <p className="text-xs text-muted-foreground mt-2">
                                {notification.created_at &&
                                    formatDistanceToNow(notification.created_at)}
                                {notification.created_at && " - "}
                                {notification.created_at &&
                                    new Date(notification.created_at).toLocaleString("de-DE")}
                            </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            {!notification.is_read && (
                                <Button variant="ghost" size="sm" onClick={onMarkAsRead}>
                                    <Check className="w-4 h-4 mr-1" />
                                    Gelesen
                                </Button>
                            )}
                            <Button variant="ghost" size="sm" onClick={onDismiss}>
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Notification settings component
const NotificationSettings = () => {
    const { data: types } = useNotificationTypes();
    const { data: preferences, isLoading } = useNotificationPreferences();
    const updatePreference = useUpdateNotificationPreference();

    const handleToggle = (notificationType: string, field: string, value: boolean) => {
        updatePreference.mutate({
            notificationType,
            data: { [field]: value },
        });
    };

    if (isLoading) {
        return (
            <Card>
                <CardContent className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    Benachrichtigungseinstellungen
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {preferences?.map((pref) => {
                        const typeInfo = types?.types.find((t) => t.type === pref.notification_type);
                        return (
                            <div
                                key={pref.notification_type}
                                className="flex items-center justify-between py-3 border-b last:border-0"
                            >
                                <div>
                                    <p className="font-medium">
                                        {typeInfo?.label || pref.notification_type}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        {typeInfo?.description}
                                    </p>
                                </div>
                                <div className="flex items-center gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={pref.in_app_enabled}
                                            onChange={(e) =>
                                                handleToggle(
                                                    pref.notification_type,
                                                    "in_app_enabled",
                                                    e.target.checked
                                                )
                                            }
                                            className="w-4 h-4 rounded border-warm-300"
                                        />
                                        <span className="text-sm">In-App</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={pref.email_enabled}
                                            onChange={(e) =>
                                                handleToggle(
                                                    pref.notification_type,
                                                    "email_enabled",
                                                    e.target.checked
                                                )
                                            }
                                            className="w-4 h-4 rounded border-warm-300"
                                        />
                                        <span className="text-sm">E-Mail</span>
                                    </label>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
};
