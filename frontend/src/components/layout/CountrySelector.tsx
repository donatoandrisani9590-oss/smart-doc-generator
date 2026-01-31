/**
 * Country Selector Component
 *
 * Dropdown to switch between Germany (DE) and Italy (IT)
 * Used in the Layout header for country context switching
 */

import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";
import { useCountry, COUNTRIES, type CountryCode } from "@/hooks/useCountry";
import { cn } from "@/lib/utils";

export const CountrySelector = () => {
    const { country, countryInfo, setCountry } = useCountry();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSelect = (code: CountryCode) => {
        setCountry(code);
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <motion.button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors",
                    "hover:bg-primary/5 border-border/50",
                    isOpen && "bg-primary/5 border-primary/30"
                )}
                whileTap={{ scale: 0.98 }}
            >
                <span className="text-xl">{countryInfo.flag}</span>
                <span className="text-sm font-medium text-foreground">
                    {countryInfo.code}
                </span>
                <motion.div
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                >
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </motion.div>
            </motion.button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg border border-border/50 overflow-hidden z-50"
                    >
                        <div className="py-1">
                            {Object.values(COUNTRIES).map((c) => (
                                <motion.button
                                    key={c.code}
                                    onClick={() => handleSelect(c.code)}
                                    className={cn(
                                        "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors",
                                        country === c.code
                                            ? "bg-primary/10 text-primary"
                                            : "hover:bg-background text-foreground"
                                    )}
                                    whileHover={{ x: 2 }}
                                >
                                    <span className="text-xl">{c.flag}</span>
                                    <div className="flex-1">
                                        <p className="text-sm font-medium">{c.name}</p>
                                        <p className="text-xs text-muted-foreground">{c.locale}</p>
                                    </div>
                                    {country === c.code && (
                                        <Check className="w-4 h-4 text-primary" />
                                    )}
                                </motion.button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
