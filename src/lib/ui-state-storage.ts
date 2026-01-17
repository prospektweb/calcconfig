const STORAGE_KEY = 'calcconfig:ui:expanded:v1'

interface UIStateStorage {
  expandedById: Record<string, boolean>
}

export function loadExpandedById(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed: UIStateStorage = JSON.parse(raw)
    return parsed.expandedById || {}
  } catch {
    return {}
  }
}

export function getExpanded(id: string): boolean | undefined {
  const map = loadExpandedById()
  return map[id]
}

export function setExpanded(id: string, value: boolean): void {
  const map = loadExpandedById()
  map[id] = value
  const storage: UIStateStorage = { expandedById: map }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(storage))
}

// Cleanup old/stale entries
export function cleanupExpandedById(activeIds: Set<string>): void {
  const map = loadExpandedById()
  const cleaned: Record<string, boolean> = {}
  for (const id of Object.keys(map)) {
    if (activeIds.has(id)) {
      cleaned[id] = map[id]
    }
  }
  const storage: UIStateStorage = { expandedById: cleaned }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(storage))
}
