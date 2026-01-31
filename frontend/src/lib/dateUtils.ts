/**
 * Date formatting utilities for German locale.
 */

/**
 * Formats a date string as a relative time in German.
 * Examples: "vor 5 Minuten", "vor 2 Stunden", "Gestern", "vor 3 Tagen"
 */
export function formatDistanceToNow(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) {
        return "Gerade eben";
    }

    if (diffMin < 60) {
        return `vor ${diffMin} Minute${diffMin !== 1 ? "n" : ""}`;
    }

    if (diffHour < 24) {
        return `vor ${diffHour} Stunde${diffHour !== 1 ? "n" : ""}`;
    }

    if (diffDay === 1) {
        return "Gestern";
    }

    if (diffDay < 7) {
        return `vor ${diffDay} Tagen`;
    }

    if (diffDay < 30) {
        const weeks = Math.floor(diffDay / 7);
        return `vor ${weeks} Woche${weeks !== 1 ? "n" : ""}`;
    }

    // Format as date for older items
    return formatDate(dateString);
}

/**
 * Formats a date string as DD.MM.YYYY (German format).
 */
export function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });
}

/**
 * Formats a date string as DD.MM.YYYY HH:mm (German format with time).
 */
export function formatDateTime(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}
