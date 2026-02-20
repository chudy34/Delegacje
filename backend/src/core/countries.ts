/**
 * countries.ts
 * Official diet rates from MRiPS regulation (Rozporządzenie MRiPS 2022)
 * Rozporządzenie Ministra Rodziny i Polityki Społecznej z dnia 25 października 2022
 */

export interface CountryDiet {
  code: string;         // ISO 3166-1 alpha-2
  name: string;         // Polish name
  nameEn: string;       // English name
  currency: string;     // ISO 4217
  dailyRate: number;    // dieta dzienna
  accommodation: number; // limit na nocleg
}

export const COUNTRIES: CountryDiet[] = [
  { code: 'PL', name: 'Polska', nameEn: 'Poland', currency: 'PLN', dailyRate: 45, accommodation: 270 },
  { code: 'AT', name: 'Austria', nameEn: 'Austria', currency: 'EUR', dailyRate: 52, accommodation: 170 },
  { code: 'BE', name: 'Belgia', nameEn: 'Belgium', currency: 'EUR', dailyRate: 50, accommodation: 170 },
  { code: 'BG', name: 'Bułgaria', nameEn: 'Bulgaria', currency: 'EUR', dailyRate: 40, accommodation: 100 },
  { code: 'HR', name: 'Chorwacja', nameEn: 'Croatia', currency: 'EUR', dailyRate: 45, accommodation: 130 },
  { code: 'CY', name: 'Cypr', nameEn: 'Cyprus', currency: 'EUR', dailyRate: 43, accommodation: 160 },
  { code: 'CZ', name: 'Czechy', nameEn: 'Czech Republic', currency: 'EUR', dailyRate: 41, accommodation: 130 },
  { code: 'DK', name: 'Dania', nameEn: 'Denmark', currency: 'DKK', dailyRate: 406, accommodation: 1400 },
  { code: 'EE', name: 'Estonia', nameEn: 'Estonia', currency: 'EUR', dailyRate: 45, accommodation: 130 },
  { code: 'FI', name: 'Finlandia', nameEn: 'Finland', currency: 'EUR', dailyRate: 56, accommodation: 170 },
  { code: 'FR', name: 'Francja', nameEn: 'France', currency: 'EUR', dailyRate: 50, accommodation: 180 },
  { code: 'GR', name: 'Grecja', nameEn: 'Greece', currency: 'EUR', dailyRate: 48, accommodation: 130 },
  { code: 'ES', name: 'Hiszpania', nameEn: 'Spain', currency: 'EUR', dailyRate: 50, accommodation: 160 },
  { code: 'NL', name: 'Holandia', nameEn: 'Netherlands', currency: 'EUR', dailyRate: 50, accommodation: 170 },
  { code: 'IE', name: 'Irlandia', nameEn: 'Ireland', currency: 'EUR', dailyRate: 53, accommodation: 200 },
  { code: 'IS', name: 'Islandia', nameEn: 'Iceland', currency: 'EUR', dailyRate: 57, accommodation: 250 },
  { code: 'LT', name: 'Litwa', nameEn: 'Lithuania', currency: 'EUR', dailyRate: 45, accommodation: 120 },
  { code: 'LU', name: 'Luksemburg', nameEn: 'Luxembourg', currency: 'EUR', dailyRate: 50, accommodation: 180 },
  { code: 'LV', name: 'Łotwa', nameEn: 'Latvia', currency: 'EUR', dailyRate: 45, accommodation: 130 },
  { code: 'MT', name: 'Malta', nameEn: 'Malta', currency: 'EUR', dailyRate: 43, accommodation: 130 },
  { code: 'DE', name: 'Niemcy', nameEn: 'Germany', currency: 'EUR', dailyRate: 49, accommodation: 170 },
  { code: 'NO', name: 'Norwegia', nameEn: 'Norway', currency: 'NOK', dailyRate: 500, accommodation: 1700 },
  { code: 'PT', name: 'Portugalia', nameEn: 'Portugal', currency: 'EUR', dailyRate: 46, accommodation: 130 },
  { code: 'RO', name: 'Rumunia', nameEn: 'Romania', currency: 'EUR', dailyRate: 40, accommodation: 120 },
  { code: 'SK', name: 'Słowacja', nameEn: 'Slovakia', currency: 'EUR', dailyRate: 43, accommodation: 130 },
  { code: 'SI', name: 'Słowenia', nameEn: 'Slovenia', currency: 'EUR', dailyRate: 43, accommodation: 130 },
  { code: 'SE', name: 'Szwecja', nameEn: 'Sweden', currency: 'SEK', dailyRate: 500, accommodation: 1700 },
  { code: 'CH', name: 'Szwajcaria', nameEn: 'Switzerland', currency: 'CHF', dailyRate: 88, accommodation: 280 },
  { code: 'HU', name: 'Węgry', nameEn: 'Hungary', currency: 'EUR', dailyRate: 40, accommodation: 120 },
  { code: 'IT', name: 'Włochy', nameEn: 'Italy', currency: 'EUR', dailyRate: 48, accommodation: 160 },
  { code: 'GB', name: 'Wielka Brytania', nameEn: 'United Kingdom', currency: 'GBP', dailyRate: 45, accommodation: 220 },
  // Non-EU Europe
  { code: 'AL', name: 'Albania', nameEn: 'Albania', currency: 'EUR', dailyRate: 40, accommodation: 100 },
  { code: 'BA', name: 'Bośnia i Hercegowina', nameEn: 'Bosnia and Herzegovina', currency: 'EUR', dailyRate: 40, accommodation: 100 },
  { code: 'BY', name: 'Białoruś', nameEn: 'Belarus', currency: 'EUR', dailyRate: 40, accommodation: 100 },
  { code: 'RS', name: 'Serbia', nameEn: 'Serbia', currency: 'EUR', dailyRate: 40, accommodation: 100 },
  { code: 'UA', name: 'Ukraina', nameEn: 'Ukraine', currency: 'EUR', dailyRate: 43, accommodation: 130 },
  { code: 'TR', name: 'Turcja', nameEn: 'Turkey', currency: 'USD', dailyRate: 45, accommodation: 140 },
  // Americas
  { code: 'US', name: 'USA', nameEn: 'United States', currency: 'USD', dailyRate: 59, accommodation: 200 },
  { code: 'CA', name: 'Kanada', nameEn: 'Canada', currency: 'USD', dailyRate: 55, accommodation: 180 },
  { code: 'MX', name: 'Meksyk', nameEn: 'Mexico', currency: 'USD', dailyRate: 48, accommodation: 150 },
  { code: 'BR', name: 'Brazylia', nameEn: 'Brazil', currency: 'USD', dailyRate: 48, accommodation: 150 },
  { code: 'AR', name: 'Argentyna', nameEn: 'Argentina', currency: 'USD', dailyRate: 46, accommodation: 140 },
  // Asia
  { code: 'CN', name: 'Chiny', nameEn: 'China', currency: 'USD', dailyRate: 50, accommodation: 140 },
  { code: 'JP', name: 'Japonia', nameEn: 'Japan', currency: 'USD', dailyRate: 61, accommodation: 220 },
  { code: 'KR', name: 'Korea Południowa', nameEn: 'South Korea', currency: 'USD', dailyRate: 52, accommodation: 170 },
  { code: 'IN', name: 'Indie', nameEn: 'India', currency: 'USD', dailyRate: 45, accommodation: 130 },
  { code: 'SG', name: 'Singapur', nameEn: 'Singapore', currency: 'USD', dailyRate: 64, accommodation: 230 },
  { code: 'AE', name: 'Zjednoczone Emiraty Arabskie', nameEn: 'United Arab Emirates', currency: 'USD', dailyRate: 56, accommodation: 200 },
  { code: 'IL', name: 'Izrael', nameEn: 'Israel', currency: 'USD', dailyRate: 56, accommodation: 200 },
  { code: 'TH', name: 'Tajlandia', nameEn: 'Thailand', currency: 'USD', dailyRate: 48, accommodation: 130 },
  { code: 'VN', name: 'Wietnam', nameEn: 'Vietnam', currency: 'USD', dailyRate: 45, accommodation: 120 },
  { code: 'PH', name: 'Filipiny', nameEn: 'Philippines', currency: 'USD', dailyRate: 45, accommodation: 120 },
  { code: 'MY', name: 'Malezja', nameEn: 'Malaysia', currency: 'USD', dailyRate: 47, accommodation: 130 },
  { code: 'ID', name: 'Indonezja', nameEn: 'Indonesia', currency: 'USD', dailyRate: 45, accommodation: 120 },
  { code: 'SA', name: 'Arabia Saudyjska', nameEn: 'Saudi Arabia', currency: 'USD', dailyRate: 56, accommodation: 200 },
  // Africa
  { code: 'ZA', name: 'Republika Południowej Afryki', nameEn: 'South Africa', currency: 'USD', dailyRate: 45, accommodation: 130 },
  { code: 'EG', name: 'Egipt', nameEn: 'Egypt', currency: 'USD', dailyRate: 43, accommodation: 120 },
  { code: 'MA', name: 'Maroko', nameEn: 'Morocco', currency: 'USD', dailyRate: 43, accommodation: 120 },
  { code: 'NG', name: 'Nigeria', nameEn: 'Nigeria', currency: 'USD', dailyRate: 45, accommodation: 130 },
  { code: 'KE', name: 'Kenia', nameEn: 'Kenya', currency: 'USD', dailyRate: 43, accommodation: 120 },
  // Oceania
  { code: 'AU', name: 'Australia', nameEn: 'Australia', currency: 'AUD', dailyRate: 88, accommodation: 280 },
  { code: 'NZ', name: 'Nowa Zelandia', nameEn: 'New Zealand', currency: 'NZD', dailyRate: 83, accommodation: 250 },
  // Other
  { code: 'RU', name: 'Rosja', nameEn: 'Russia', currency: 'EUR', dailyRate: 47, accommodation: 140 },
  { code: 'KZ', name: 'Kazachstan', nameEn: 'Kazakhstan', currency: 'USD', dailyRate: 45, accommodation: 130 },
];

// Create lookup maps for fast access
export const COUNTRIES_BY_CODE: Map<string, CountryDiet> = new Map(
  COUNTRIES.map((c) => [c.code, c])
);

export const COUNTRIES_BY_NAME: Map<string, CountryDiet> = new Map(
  COUNTRIES.map((c) => [c.name.toLowerCase(), c])
);

export function getCountryByCode(code: string): CountryDiet | undefined {
  return COUNTRIES_BY_CODE.get(code.toUpperCase());
}

export function searchCountries(query: string): CountryDiet[] {
  const q = query.toLowerCase();
  return COUNTRIES.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.nameEn.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q)
  );
}
