/**
 * UserDropdown Component
 *
 * Benutzer-Dropdown in der Sidebar mit:
 * - Benutzerinfo (Name, E-Mail, Rolle)
 * - Profil-Link
 * - Logout-Funktion
 */

import * as React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
    User,
    Settings,
    LogOut,
    Shield,
    ChevronUp,
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

interface UserDropdownProps {
    /** Zusätzliche CSS-Klassen */
    className?: string;
}

const sidebarTransition = {
    type: "spring",
    stiffness: 400,
    damping: 20,
};

const roleLabels: Record<string, string> = {
    admin: "Administrator",
    manager: "HR Manager",
    user: "HR Mitarbeiter",
};

const roleBadgeVariants: Record<string, "default" | "secondary" | "outline"> = {
    admin: "default",
    manager: "secondary",
    user: "outline",
};

/**
 * Get initials from email address
 */
const getInitials = (email: string): string => {
    const name = email.split("@")[0];
    const parts = name.split(/[._-]/);
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
};

/**
 * Get display name from email address
 */
const getDisplayName = (email: string): string => {
    const name = email.split("@")[0];
    const parts = name.split(/[._-]/);
    return parts
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
};

export const UserDropdown = ({ className }: UserDropdownProps) => {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const [open, setOpen] = React.useState(false);

    // Fallback for when user is not loaded yet
    const displayUser = user
        ? {
              name: getDisplayName(user.email),
              email: user.email,
              role: user.role as "admin" | "user" | "manager",
              initials: getInitials(user.email),
          }
        : {
              name: "Laden...",
              email: "",
              role: "user" as const,
              initials: "...",
          };

    const handleLogout = () => {
        setOpen(false);
        logout();
        navigate("/login");
    };

    const handleProfileClick = () => {
        setOpen(false);
        navigate("/settings?tab=account");
    };

    const handleSettingsClick = () => {
        setOpen(false);
        navigate("/settings");
    };

    return (
        <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger asChild>
                <motion.button
                    className={cn(
                        "w-full flex items-center gap-3 p-2 rounded-lg cursor-pointer",
                        "hover:bg-primary/5 transition-colors",
                        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                        className
                    )}
                    whileHover={{ backgroundColor: "hsl(var(--primary) / 0.05)" }}
                    whileTap={{ scale: 0.98 }}
                    transition={sidebarTransition}
                    aria-label="Benutzermenü öffnen"
                >
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold text-sm shrink-0">
                        {displayUser.initials}
                    </div>

                    {/* User Info */}
                    <div className="flex-1 text-left min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                            {displayUser.name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                            {roleLabels[displayUser.role] || displayUser.role}
                        </p>
                    </div>

                    {/* Chevron */}
                    <ChevronUp
                        className={cn(
                            "w-4 h-4 text-muted-foreground transition-transform",
                            open && "rotate-180"
                        )}
                        aria-hidden="true"
                    />
                </motion.button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
                align="start"
                side="top"
                className="w-56"
                sideOffset={8}
            >
                {/* User Header */}
                <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-2">
                        <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{displayUser.name}</p>
                            <Badge
                                variant={roleBadgeVariants[displayUser.role] || "outline"}
                                className="text-[10px] px-1.5 py-0"
                            >
                                {roleLabels[displayUser.role] || displayUser.role}
                            </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                            {displayUser.email}
                        </p>
                    </div>
                </DropdownMenuLabel>

                <DropdownMenuSeparator />

                {/* Menu Items */}
                <DropdownMenuItem
                    onClick={handleProfileClick}
                    className="gap-2 cursor-pointer"
                >
                    <User className="w-4 h-4" aria-hidden="true" />
                    Mein Profil
                </DropdownMenuItem>

                <DropdownMenuItem
                    onClick={handleSettingsClick}
                    className="gap-2 cursor-pointer"
                >
                    <Settings className="w-4 h-4" aria-hidden="true" />
                    Einstellungen
                </DropdownMenuItem>

                {displayUser.role === "admin" && (
                    <DropdownMenuItem
                        onClick={() => {
                            setOpen(false);
                            navigate("/settings?tab=advanced&section=audit");
                        }}
                        className="gap-2 cursor-pointer"
                    >
                        <Shield className="w-4 h-4" aria-hidden="true" />
                        Audit-Log
                    </DropdownMenuItem>
                )}

                <DropdownMenuSeparator />

                {/* Logout */}
                <DropdownMenuItem
                    onClick={handleLogout}
                    className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                >
                    <LogOut className="w-4 h-4" aria-hidden="true" />
                    Abmelden
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

export default UserDropdown;
