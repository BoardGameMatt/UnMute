export type GiphyGif = {
  id: string;
  url: string;
  previewUrl: string;
};

type GiphySearchResponse = {
  data?: Array<{
    id: string;
    images?: {
      fixed_height?: { url?: string };
      fixed_height_small?: { url?: string };
    };
  }>;
};

/**
 * Search Giphy for GIFs. rating=g is always enforced.
 * Returns empty array on failure or missing API key.
 */
export async function fetchGifs(
  query: string,
  limit: number = 9
): Promise<GiphyGif[]> {
  const apiKey = process.env.NEXT_PUBLIC_GIPHY_API_KEY;
  if (!apiKey || !query.trim()) {
    return [];
  }

  try {
    const params = new URLSearchParams({
      api_key: apiKey,
      q: query.trim(),
      limit: String(limit),
      rating: "g",
    });

    const res = await fetch(
      `https://api.giphy.com/v1/gifs/search?${params.toString()}`
    );

    if (!res.ok) {
      return [];
    }

    const json = (await res.json()) as GiphySearchResponse;
    const data = json.data ?? [];

    return data
      .map((item) => {
        const url = item.images?.fixed_height?.url;
        const previewUrl = item.images?.fixed_height_small?.url;
        if (!url || !previewUrl) return null;
        return { id: item.id, url, previewUrl };
      })
      .filter((g): g is GiphyGif => g !== null);
  } catch {
    return [];
  }
}
