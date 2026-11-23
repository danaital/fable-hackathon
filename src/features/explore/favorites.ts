"use client";

import { useCallback, useMemo } from "react";
import { z } from "zod";
import { createLocalStore } from "@/lib/store";

const EMPTY: string[] = [];
const favoritesStore = createLocalStore("bahir_favorites", z.array(z.string()), EMPTY);

export function useFavorites(): { favorites: ReadonlySet<string>; toggleFavorite: (id: string) => void } {
  const ids = favoritesStore.useValue();
  const favorites = useMemo(() => new Set(ids), [ids]);

  const toggleFavorite = useCallback((id: string) => {
    const next = new Set(favoritesStore.read());
    if (!next.delete(id)) next.add(id);
    favoritesStore.write([...next]);
  }, []);

  return { favorites, toggleFavorite };
}
