import { loadDataSource, sourceMode } from '../data';
import { useUiStore, type HomeUiState } from '../store/uiStore';

/**
 * "What's on your mind?" in the original website: tapping a category does not
 * leave Home, it swaps the restaurant list for the restaurants that sell a dish
 * matching the category, and tapping the same category again restores the list.
 *
 * Model: `GET /restaurants/search?q=<category>&scope=home` returns menu items
 * carrying their restaurant, so the mode is the set of restaurant ids that sold
 * a match. That is the same request the original makes (`home.js`
 * `searchCategory`), and the demo source answers it from the demo menu.
 */

/** The original bails out below two characters (`searchCategory`). */
const MIN_QUERY_LENGTH = 2;

/** Same contract as the original's `categoryMode`: the restaurant ids only. */
let attempt = 0;

const patch = (next: Partial<HomeUiState>): void => useUiStore.getState().patchHome(next);

const load = async (name: string, query: string): Promise<void> => {
  attempt += 1;
  const token = attempt;
  patch({ activeCategory: name, categoryQuery: query, categoryIds: [], categoryError: null, categoryStatus: 'loading' });
  try {
    const source = await loadDataSource(sourceMode());
    const results = await source.search(query);
    if (token !== attempt) return;
    const ids = Array.from(new Set(results.map((result) => result.restaurantId).filter((id) => id > 0)));
    patch({ categoryIds: ids, categoryStatus: ids.length ? 'ready' : 'empty' });
  } catch (error) {
    // The original clears the category and hands the failure to the feed's
    // error block ("Couldn't load restaurants" + Try Again).
    if (token !== attempt) return;
    patch({
      activeCategory: null,
      categoryQuery: null,
      categoryIds: [],
      categoryStatus: 'error',
      categoryError: error instanceof Error ? error.message : 'Could not load dishes for this category.',
    });
  }
};

/** Tap on a category tile: select it, or restore the feed if it is already on. */
export const selectCategory = async (name: string, query: string): Promise<void> => {
  const current = useUiStore.getState().home.activeCategory;
  if (current && current.toLowerCase() === name.toLowerCase()) {
    clearCategory();
    return;
  }
  const term = (query || name).trim();
  if (term.length < MIN_QUERY_LENGTH) return;
  await load(name, term);
};

/** Re-run the search behind the current selection (the empty state's Refresh). */
export const retryCategory = async (): Promise<void> => {
  const home = useUiStore.getState().home;
  if (!home.activeCategory) return;
  await load(home.activeCategory, home.categoryQuery ?? home.activeCategory);
};

/** Back to the unfiltered feed; the filter pills are left alone, as upstream. */
export function clearCategory(): void {
  attempt += 1;
  patch({ activeCategory: null, categoryQuery: null, categoryIds: [], categoryError: null, categoryStatus: 'idle' });
}
