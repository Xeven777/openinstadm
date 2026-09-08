export type CurrencyCode = "USD" | "GBP" | "INR";

export type CountryGroup = "IN" | "EU_GB" | "US_OTHER";

export type PricingInfo = {
  currency: CurrencyCode;
  symbol: string;
  amount: string;
  display: string;
  countryGroup: CountryGroup;
  locale: string;
};

// --- Country sets ---

// India
const IN_COUNTRIES = new Set(["IN"]);

// UK + Crown dependencies
const GB_COUNTRIES = new Set(["GB", "GG", "IM", "JE"]);

// EU + EFTA + UK-neighbouring markets that should see £
// User said "in eur show pund" — so every Eurozone/EU country maps to GBP.
// Includes EU 27 + UK-adjacent European markets.
const EU_COUNTRIES = new Set([
  "AT", // Austria
  "BE", // Belgium
  "BG", // Bulgaria
  "HR", // Croatia
  "CY", // Cyprus
  "CZ", // Czech Republic
  "DK", // Denmark
  "EE", // Estonia
  "FI", // Finland
  "FR", // France
  "DE", // Germany
  "GR", // Greece
  "HU", // Hungary
  "IE", // Ireland (uses €)
  "IT", // Italy
  "LV", // Latvia
  "LT", // Lithuania
  "LU", // Luxembourg
  "MT", // Malta
  "NL", // Netherlands
  "PL", // Poland
  "PT", // Portugal
  "RO", // Romania
  "SK", // Slovakia
  "SI", // Slovenia
  "ES", // Spain
  "SE", // Sweden
  // EFTA / non-EU Europe that also use European pricing expectations
  "CH", // Switzerland
  "NO", // Norway
  "IS", // Iceland
  "LI", // Liechtenstein
]);

export const PRICING_BY_GROUP: Record<CountryGroup, PricingInfo> = {
  IN: {
    currency: "INR",
    symbol: "₹",
    amount: "999",
    display: "₹999",
    countryGroup: "IN",
    locale: "en-IN",
  },
  EU_GB: {
    currency: "GBP",
    symbol: "£",
    amount: "20",
    display: "£20",
    countryGroup: "EU_GB",
    locale: "en-GB",
  },
  US_OTHER: {
    currency: "USD",
    symbol: "$",
    amount: "20",
    display: "$20",
    countryGroup: "US_OTHER",
    locale: "en-US",
  },
};

export function getCountryGroup(
  countryCode: string | null | undefined,
): CountryGroup {
  const code = countryCode?.toUpperCase().trim() ?? "";
  if (!code) return "US_OTHER";
  if (IN_COUNTRIES.has(code)) return "IN";
  if (GB_COUNTRIES.has(code) || EU_COUNTRIES.has(code)) return "EU_GB";
  return "US_OTHER";
}

export function getPricingForCountry(
  countryCode: string | null | undefined,
): PricingInfo {
  return PRICING_BY_GROUP[getCountryGroup(countryCode)];
}

export function getPricingForGroup(group: CountryGroup): PricingInfo {
  return PRICING_BY_GROUP[group];
}

/** Extract country code from request headers (Vercel / Cloudflare / generic). */
export function getCountryFromHeaders(headers: Headers): string | null {
  const candidates = [
    headers.get("x-vercel-ip-country"),
    headers.get("cf-ipcountry"),
    headers.get("x-country-code"),
    headers.get("x-geo-country"),
    headers.get("x-location-country"),
  ];
  for (const c of candidates) {
    if (
      c &&
      c.trim() &&
      c.trim().toUpperCase() !== "XX" &&
      c.trim().length === 2
    ) {
      return c.trim().toUpperCase();
    }
  }
  return null;
}

/** Client-side fallback: infer country from navigator.language (e.g. "en-IN" -> "IN"). */
export function getCountryFromLanguage(
  lang: string | null | undefined,
): string | null {
  if (!lang) return null;
  const parts = lang.split("-");
  if (parts.length >= 2) {
    const region = parts[parts.length - 1]?.toUpperCase();
    if (region && region.length === 2) return region;
  }
  return null;
}

/** Client-side: try timezone as weak signal — e.g. Asia/Kolkata -> IN, Europe/* -> EU_GB */
export function getCountryFromTimezone(): string | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz) return null;
    if (tz === "Asia/Kolkata" || tz === "Asia/Calcutta") return "IN";
    if (tz.startsWith("Europe/")) {
      // Map European timezones to a generic EU code so they get £ pricing.
      // Use GB as representative — getCountryGroup will map any EU code to EU_GB.
      return "DE";
    }
    if (tz.startsWith("Asia/")) {
      // Other Asian timezones should not get IN pricing; default to US_OTHER
      return null;
    }
    return null;
  } catch {
    return null;
  }
}

/** Full client-side detection (language + timezone). */
export function detectCountryClientSide(): string | null {
  if (typeof navigator !== "undefined") {
    const fromLang = getCountryFromLanguage(navigator.language);
    if (fromLang) return fromLang;
    // navigator.languages fallback
    const langs = (navigator as { languages?: readonly string[] }).languages;
    if (langs) {
      for (const l of langs) {
        const c = getCountryFromLanguage(l);
        if (c) return c;
      }
    }
  }
  const fromTz = getCountryFromTimezone();
  if (fromTz) return fromTz;
  return null;
}
