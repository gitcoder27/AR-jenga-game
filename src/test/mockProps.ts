import type { ReactNode } from 'react'

/** Props of a stand-in component in a vi.mock() factory. */
export type MockProps = { children?: ReactNode; [prop: string]: unknown }

/** A store selector as seen by a vi.mock() factory's useGameStore. */
export type MockSelector = (state: Record<string, unknown>) => unknown
