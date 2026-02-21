/**
 * Country Selector Component
 *
 * Popover to switch between Germany (DE) and Italy (IT)
 * Used in the Layout header for country context switching
 */

import { motion } from "framer-motion";
import { ChevronDown, Check } from "lucide-react";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { useCountry, COUNTRIES, type CountryCode } from "@/hooks/useCountry";
import { cn } from "@/lib/utils";

export const CountrySelector = () => {
    const { country, countryInfo, setCountry } = useCountry();

    // Hide selector when only one country is available
    const countryCount = Object.keys(COUNTRIES).length;
    if (countryCount <= 1) return null;

    const handleSelect = (code: CountryCode) => {
        setCountry(code);
    };

    return (
        <Popover>
            <PopoverTrigger asChild>
                <motion.button
                    className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors",
                        "hover:bg-primary/5 border-border/50"
                    )}
                    whileTap={{ scale: 0.98 }}
                >
                    <span className="text-xl">{countryInfo.flag}</span>
                    <span className="text-sm font-medium text-foreground">
                        {countryInfo.code}
                    </span>
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </motion.button>
            </PopoverTrigger>

            <PopoverContent align="end" className="w-48 p-1">
                {Object.values(COUNTRIES).map((c) => (
                    <button
                        key={c.code}
                        onClick={() => handleSelect(c.code)}
                        className={cn(
                            "w-full flex items-center gap-3 px-4 py-3 text-left rounded-md transition-colors",
                            country === c.code
                                ? "bg-primary/10 text-primary"
                                : "hover:bg-muted text-foreground"
                        )}
                    >
                        <span className="text-xl">{c.flag}</span>
                        <div className="flex-1">
                            <p className="text-sm font-medium">{c.name}</p>
                            <p className="text-xs text-muted-foreground">{c.locale}</p>
                        </div>
                        {country === c.code && (
                            <Check className="w-4 h-4 text-primary" />
                        )}
                    </button>
                ))}
            </PopoverContent>
        </Popover>
    );
};
