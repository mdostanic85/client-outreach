export type SerbiaPlace = {
  label: string;
  /** Infostud `cities[]` id. Absent when the place is not one of the three city filters. */
  infostudId?: string;
  /** Poslovi.rs `search_cities[]` id. */
  posloviId?: string;
};

const MAJOR_CITIES: Array<SerbiaPlace & { keys: string[] }> = [
  { label: "Beograd", keys: ["beograd", "belgrade"], infostudId: "35", posloviId: "10" },
  { label: "Novi Sad", keys: ["novi sad"], infostudId: "2", posloviId: "141" },
  { label: "Niš", keys: ["nis"], infostudId: "96", posloviId: "78" },
];

function fold(value: string): string {
  return value
    .toLowerCase()
    .replace(/đ/g, "dj")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/**
 * Where a Serbia search should run.
 * A named city stays that city. A country-level "Serbia" becomes Beograd,
 * Novi Sad and Niš, because a single national query hides the other two.
 */
export function serbiaSearchPlaces(locations: string[]): SerbiaPlace[] {
  const folded = locations
    .map((loc) => fold(loc.trim()))
    .filter((loc) => loc && loc !== "remote");
  const matched: SerbiaPlace[] = [];
  for (const loc of folded) {
    const city = MAJOR_CITIES.find((candidate) =>
      candidate.keys.some((key) => loc === key || loc.includes(key)),
    );
    if (city && !matched.some((place) => place.label === city.label)) {
      matched.push({
        label: city.label,
        infostudId: city.infostudId,
        posloviId: city.posloviId,
      });
    }
  }
  if (matched.length) return matched;
  const country =
    folded.length === 0 || folded.every((loc) => /\b(serbia|srbija)\b/.test(loc));
  if (country) {
    return MAJOR_CITIES.map(({ label, infostudId, posloviId }) => ({
      label,
      infostudId,
      posloviId,
    }));
  }
  const label = locations.find((loc) => !/^remote$/i.test(loc.trim()))?.trim() || "Serbia";
  return [{ label }];
}
