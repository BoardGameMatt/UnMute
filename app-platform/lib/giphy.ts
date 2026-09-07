export type GiphyGif = {
  id: string;
  url: string;
  previewUrl: string;
};

export type GiphyPage = {
  gifs: GiphyGif[];
  hasMore: boolean;
};

export const GIPHY_PAGE_SIZE = 12;

type GiphySearchResponse = {
  data?: Array<{
    id: string;
    images?: {
      fixed_height?: { url?: string };
      fixed_height_small?: { url?: string };
    };
  }>;
  pagination?: {
    total_count?: number;
    count?: number;
    offset?: number;
  };
};

/**
 * Search Giphy for GIFs. rating=g is always enforced.
 * Returns an empty page on failure or missing API key.
 */
export async function fetchGifs(
  query: string,
  limit: number = GIPHY_PAGE_SIZE,
  offset: number = 0
): Promise<GiphyPage> {
  const apiKey = process.env.NEXT_PUBLIC_GIPHY_API_KEY;
  if (!apiKey || !query.trim()) {
    return { gifs: [], hasMore: false };
  }

  try {
    const params = new URLSearchParams({
      api_key: apiKey,
      q: query.trim(),
      limit: String(limit),
      offset: String(offset),
      rating: "g",
    });

    const res = await fetch(`https://api.giphy.com/v1/gifs/search?${params.toString()}`);
    if (!res.ok) {
      return { gifs: [], hasMore: false };
    }

    const json = (await res.json()) as GiphySearchResponse;
    const data = json.data ?? [];
    const gifs = data
      .map((item) => {
        const url = item.images?.fixed_height?.url;
        const previewUrl = item.images?.fixed_height_small?.url;
        if (!url || !previewUrl) return null;
        return { id: item.id, url, previewUrl };
      })
      .filter((g): g is GiphyGif => g !== null);

    const total = json.pagination?.total_count ?? 0;
    const nextOffset = offset + data.length;
    const hasMore = data.length > 0 && nextOffset < total;

    return { gifs, hasMore };
  } catch {
    return { gifs: [], hasMore: false };
  }
}
