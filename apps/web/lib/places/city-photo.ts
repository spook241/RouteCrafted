// Fetch a representative cover photo for a city/destination.
// Strategy:
//   1. Wikipedia geosearch by coordinates → physically nearest article (always the city)
//   2. Wikipedia text search → fallback for when coords are unavailable
//   3. Pexels → stock photo last resort
// Never throws — any error returns null.

import { searchWikimediaByCoords, searchWikimedia } from "./wikimedia";
import { searchPexels } from "./pexels";

export interface CityPhotoResult {
  imageUrl: string;
  attribution?: string;
}

/**
 * Return a cover photo URL for a destination city.
 * Pass lat/lon when available — geosearch is far more reliable than text search.
 */
export async function fetchCityPhoto(
  destination: string,
  country: string,
  lat?: string | null,
  lon?: string | null,
): Promise<CityPhotoResult | null> {
  try {
    // 1. Pexels — scenic travel photos with city + country query (best for cover images)
    const pex = await searchPexels(destination, country, "city");
    if (pex?.imageUrl) {
      return { imageUrl: pex.imageUrl };
    }

    // 2. Wikipedia coordinate geosearch — finds nearest article, but may show civic buildings
    if (lat && lon) {
      const geo = await searchWikimediaByCoords(lat, lon);
      if (geo?.imageUrl) {
        return { imageUrl: geo.imageUrl, attribution: geo.imageAttribution ?? undefined };
      }
    }

    // 3. Wikipedia text search — last resort
    const wiki = await searchWikimedia(destination, country, "landmark");
    if (wiki?.imageUrl) {
      return { imageUrl: wiki.imageUrl, attribution: wiki.imageAttribution ?? undefined };
    }

    return null;
  } catch {
    return null;
  }
}
