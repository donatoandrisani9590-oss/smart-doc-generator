/**
 * UserMenu - Consolidated user dropdown for the header
 *
 * Contains: User info, Theme toggle, Country selector, Settings, Logout
 * Replaces separate ThemeToggle + CountrySelector + UserDropdown in header
 */

import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
    User,
    Settings,
    LogOut,
    Shield,
    Sun,
    Moon,
    Monitor,
    Keyboard,
    Check,
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    DropdownMenuLabel,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import { useCountry, COUNTRIES, type CountryCode } from "@/hooks/useCountry";

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

const getInitials = (email: string): string => {
    const name = email.split("@")[0];
    const parts = name.split(/[._-]/);
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
};

const getDisplayName = (email: string): string => {
    const name = email.split("@")[0];
    const parts = name.split(/[._-]/);
    return parts
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
};

const themeOptions: { value: Theme; label: string; icon: typeof Sun }[] = [
    { value: "light", label: "Hell", icon: Sun },
    { value: "dark", label: "Dunkel", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
];

interface UserMenuProps {
    onShowShortcuts?: () => void;
}

export const UserMenu = ({ onShowShortcuts }: UserMenuProps) => {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const { theme, setTheme } = useTheme();
    const { country, setCountry } = useCountry();
    const [open, setOpen] = React.useState(false);

    const countryCount = Object.keys(COUNTRIES).length;

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

    return (
        <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger asChild>
                <button
                    className={cn(
                        "flex items-center justify-center rounded-full cursor-pointer",
                        "w-9 h-9 bg-primary text-primary-foreground text-sm font-semibold",
                        "hover:opacity-90 transition-opacity",
                        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    )}
                    aria-label="Benutzermenü öffnen"
                >
                    {displayUser.initials}
                </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-64" sideOffset={8}>
                {/* User Header */}
                <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1.5">
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

                {/* Theme Submenu */}
                <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="gap-2 cursor-pointer">
                        {theme === "dark" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                        Erscheinungsbild
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-36">
                        {themeOptions.map(({ value, label, icon: Icon }) => (
                            <DropdownMenuItem
                                key={value}
                                onClick={() => setTheme(value)}
                                className={cn(
                                    "gap-2 cursor-pointer",
                                    theme === value && "bg-accent font-medium"
                                )}
                            >
                                <Icon className="h-4 w-4" aria-hidden="true" />
                                {label}
                                {theme === value && <Check className="w-3 h-3 ml-auto" />}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuSubContent>
                </DropdownMenuSub>

                {/* Country Submenu - only if multiple countries */}
                {countryCount > 1 && (
                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger className="gap-2 cursor-pointer">
                            <span className="text-base leading-none">{COUNTRIES[country]?.flag}</span>
                            Land ({country})
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="w-48">
                            {Object.values(COUNTRIES).map((c) => (
                                <DropdownMenuItem
                                    key={c.code}
                                    onClick={() => setCountry(c.code)}
                                    className={cn(
                                        "gap-2 cursor-pointer",
                                        country === c.code && "bg-accent font-medium"
                                    )}
                                >
                                    <span className="text-base">{c.flag}</span>
                                    {c.name}
                                    {country === c.code && <Check className="w-3 h-3 ml-auto" />}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuSubContent>
                    </DropdownMenuSub>
                )}

                <DropdownMenuSeparator />

                <DropdownMenuItem
                    onClick={() => { setOpen(false); navigate("/settings?tab=general"); }}
                    className="gap-2 cursor-pointer"
                >
                    <User className="w-4 h-4" />
                    Mein Profil
                </DropdownMenuItem>

                <DropdownMenuItem
                    onClick={() => { setOpen(false); navigate("/settings"); }}
                    className="gap-2 cursor-pointer"
                >
                    <Settings className="w-4 h-4" />
                    Einstellungen
                </DropdownMenuItem>

                {onShowShortcuts && (
                    <DropdownMenuItem
                        onClick={() => { setOpen(false); onShowShortcuts(); }}
                        className="gap-2 cursor-pointer"
                    >
                        <Keyboard className="w-4 h-4" />
                        Tastenkürzel
                        <kbd className="ml-auto px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono border border-border">?</kbd>
                    </DropdownMenuItem>
                )}

                {displayUser.role === "admin" && (
                    <DropdownMenuItem
                        onClick={() => { setOpen(false); navigate("/settings?tab=advanced&section=audit"); }}
                        className="gap-2 cursor-pointer"
                    >
                        <Shield className="w-4 h-4" />
                        Audit-Log
                    </DropdownMenuItem>
                )}

                <DropdownMenuSeparator />

                <DropdownMenuItem
                    onClick={handleLogout}
                    className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                >
                    <LogOut className="w-4 h-4" />
                    Abmelden
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};
