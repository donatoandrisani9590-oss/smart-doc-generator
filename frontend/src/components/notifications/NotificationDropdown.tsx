/**
 * NotificationDropdown Component (15.5.6)
 *
 * Dropdown menu showing user notifications with:
 * - Unread count badge
 * - Quick mark as read
 * - Link to full notification center
 */

import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
    useNotifications,
    useUnreadCount,
    useMarkAsRead,
    useMarkAllAsRead,
    useDismissNotification,
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
    ChevronRight,
} from "lucide-react";
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

export const NotificationDropdown = () => {
    const [isOpen, setIsOpen] = useState(false);

    const { data: countData } = useUnreadCount();
    const { data: notifications, isLoading } = useNotifications(1, false);
    const markAsRead = useMarkAsRead();
    const markAllAsRead = useMarkAllAsRead();
    const dismiss = useDismissNotification();

    const unreadCount = countData?.unread_count ?? 0;
    const items = notifications?.notifications ?? [];

    const handleMarkAsRead = (notificationId: number, e: React.MouseEvent) => {
        e.stopPropagation();
        markAsRead.mutate(notificationId);
    };

    const handleDismiss = (notificationId: number, e: React.MouseEvent) => {
        e.stopPropagation();
        dismiss.mutate(notificationId);
    };

    const handleMarkAllAsRead = () => {
        markAllAsRead.mutate();
    };

    return (
        <div className="relative">
            {/* Trigger Button */}
            <Button
                variant="ghost"
                size="sm"
                className="relative"
                onClick={() => setIsOpen(!isOpen)}
            >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                        {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                )}
            </Button>

            {/* Dropdown */}
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Dropdown Content */}
                    <div className="absolute right-0 top-full mt-2 w-96 bg-background border rounded-lg shadow-xl z-50 overflow-hidden">
                        {/* Header */}
                        <div className="p-4 border-b flex items-center justify-between bg-muted/30">
                            <div className="flex items-center gap-2">
                                <Bell className="w-5 h-5" />
                                <h3 className="font-semibold">Benachrichtigungen</h3>
                                {unreadCount > 0 && (
                                    <span className="px-2 py-0.5 bg-primary text-primary-foreground text-xs rounded-full">
                                        {unreadCount} neu
                                    </span>
                                )}
                            </div>
                            {unreadCount > 0 && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleMarkAllAsRead}
                                    className="text-xs"
                                >
                                    <CheckCheck className="w-4 h-4 mr-1" />
                                    Alle lesen
                                </Button>
                            )}
                        </div>

                        {/* Notification List */}
                        <div className="max-h-96 overflow-y-auto">
                            {isLoading ? (
                                <div className="flex justify-center py-8">
                                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                                </div>
                            ) : items.length === 0 ? (
                                <div className="py-8 text-center text-muted-foreground">
                                    <Bell className="w-12 h-12 mx-auto mb-4 opacity-30" />
                                    <p>Keine Benachrichtigungen</p>
                                </div>
                            ) : (
                                <div className="divide-y">
                                    {items.slice(0, 5).map((notification) => (
                                        <NotificationItemRow
                                            key={notification.id}
                                            notification={notification}
                                            onMarkAsRead={handleMarkAsRead}
                                            onDismiss={handleDismiss}
                                            onClick={() => setIsOpen(false)}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-3 border-t bg-muted/30">
                            <Link
                                to="/notifications"
                                className="flex items-center justify-center gap-1 text-sm text-primary hover:underline"
                                onClick={() => setIsOpen(false)}
                            >
                                Alle Benachrichtigungen anzeigen
                                <ChevronRight className="w-4 h-4" />
                            </Link>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

// Individual notification row
const NotificationItemRow = ({
    notification,
    onMarkAsRead,
    onDismiss,
    onClick,
}: {
    notification: NotificationItem;
    onMarkAsRead: (id: number, e: React.MouseEvent) => void;
    onDismiss: (id: number, e: React.MouseEvent) => void;
    onClick: () => void;
}) => {
    const Icon = typeIcons[notification.notification_type] || Bell;
    const priorityClass = priorityColors[notification.priority] || priorityColors.normal;

    const content = (
        <div
            className={`p-4 hover:bg-muted/50 transition-colors border-l-4 ${priorityClass} ${
                !notification.is_read ? "bg-primary/5" : ""
            }`}
        >
            <div className="flex gap-3">
                {/* Icon */}
                <div
                    className={`p-2 rounded-lg ${
                        !notification.is_read ? "bg-primary/10" : "bg-muted"
                    }`}
                >
                    <Icon
                        className={`w-4 h-4 ${
                            !notification.is_read ? "text-primary" : "text-muted-foreground"
                        }`}
                    />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                        <p
                            className={`text-sm font-medium truncate ${
                                !notification.is_read ? "" : "text-muted-foreground"
                            }`}
                        >
                            {notification.title}
                        </p>
                        <div className="flex items-center gap-1 shrink-0">
                            {!notification.is_read && (
                                <button
                                    onClick={(e) => onMarkAsRead(notification.id, e)}
                                    className="p-1 hover:bg-muted rounded"
                                    title="Als gelesen markieren"
                                >
                                    <Check className="w-3 h-3 text-muted-foreground" />
                                </button>
                            )}
                            <button
                                onClick={(e) => onDismiss(notification.id, e)}
                                className="p-1 hover:bg-muted rounded"
                                title="Ausblenden"
                            >
                                <X className="w-3 h-3 text-muted-foreground" />
                            </button>
                        </div>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {notification.message}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                        {notification.created_at && formatDistanceToNow(notification.created_at)}
                    </p>
                </div>
            </div>
        </div>
    );

    if (notification.action_url) {
        return (
            <Link to={notification.action_url} onClick={onClick}>
                {content}
            </Link>
        );
    }

    return content;
};
