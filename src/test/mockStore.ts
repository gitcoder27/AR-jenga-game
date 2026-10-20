import type { useGameStore, GameStore } from '../store/gameStore'

type Store = typeof useGameStore
type Selector = (state: GameStore) => unknown

/**
 * A stand-in for useGameStore that serves a partial state to selectors, for
 * vi.mocked(useGameStore).mockImplementation() or a vi.mock() factory.
 */
export function storeWith(state: Partial<GameStore>): Store {
  return ((selector?: Selector) => (selector ? selector(state as GameStore) : state)) as Store
}
