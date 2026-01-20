import { StageLogic } from './types'

export function getStorageKey(settingsId: number, stageId: number): string {
  return `pwrt_calc_logic:${settingsId}:${stageId}`
}

export function saveLogic(settingsId: number, stageId: number, logic: StageLogic): void {
  try {
    const key = getStorageKey(settingsId, stageId)
    localStorage.setItem(key, JSON.stringify(logic))
  } catch (error) {
    console.error('Failed to save logic to localStorage:', error)
    throw error
  }
}

export function loadLogic(settingsId: number, stageId: number): StageLogic | null {
  try {
    const key = getStorageKey(settingsId, stageId)
    const stored = localStorage.getItem(key)
    if (!stored) return null
    return JSON.parse(stored) as StageLogic
  } catch (error) {
    console.error('Failed to load logic from localStorage:', error)
    return null
  }
}
