/**
 * Country Context - Manages the current country selection (DE/IT)
 *
 * Used for:
 * - Filtering clauses and document types by country
 * - Localizing date/currency formats
 * - Loading country-specific design settings
 */

import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";

export type CountryCode = "DE" | "IT";

interface CountryInfo {
    code: CountryCode;
    name: string;
    flag: string;
    locale: string;
}

// eslint-disable-next-line react-refresh/only-export-components
export const COUNTRIES: Record<CountryCode, CountryInfo> = {
    DE: {
        code: "DE",
        name: "Deutschland",
        flag: "🇩🇪",
        locale: "de-DE",
    },
    IT: {
        code: "IT",
        name: "Italia",
        flag: "🇮🇹",
        locale: "it-IT",
    },
};

interface CountryContextType {
    country: CountryCode;
    countryInfo: CountryInfo;
    setCountry: (country: CountryCode) => void;
}

const CountryContext = createContext<CountryContextType | undefined>(undefined);

const STORAGE_KEY = "niederwieser_country";

export const CountryProvider = ({ children }: { children: ReactNode }) => {
    const [country, setCountryState] = useState<CountryCode>(() => {
        // Load from localStorage on init
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored === "DE" || stored === "IT") {
            return stored;
        }
        return "DE"; // Default to Germany
    });

    const setCountry = (newCountry: CountryCode) => {
        setCountryState(newCountry);
        localStorage.setItem(STORAGE_KEY, newCountry);
    };

    // Sync to localStorage whenever country changes
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, country);
    }, [country]);

    const value: CountryContextType = {
        country,
        countryInfo: COUNTRIES[country],
        setCountry,
    };

    return (
        <CountryContext.Provider value={value}>
            {children}
        </CountryContext.Provider>
    );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useCountry = (): CountryContextType => {
    const context = useContext(CountryContext);
    if (!context) {
        throw new Error("useCountry must be used within a CountryProvider");
    }
    return context;
};
