/**
 * Stage utility functions for readiness checking and draft management
 */

/**
 * Get draft key for localStorage
 */
export function getDraftKey(settingsId: number, stageId: number): string {
  return `calcconfig.logic.draft:${settingsId}:${stageId}`
}

/**
 * Check if a stage has a draft in localStorage
 */
export function hasDraftForStage(settingsId: number, stageId: number): boolean {
  const draftKey = getDraftKey(settingsId, stageId)
  return localStorage.getItem(draftKey) !== null
}

/**
 * Calculate stage readiness based on saved JSON and draft status
 * @param savedJson - The saved LOGIC_JSON value from Bitrix (~VALUE)
 * @param hasDraft - Whether there's an unsaved draft
 * @returns Readiness status with reason if not ready
 */
export function calculateStageReadiness(
  savedJson: string | null,
  hasDraft: boolean
): { ready: boolean; reason?: string } {
  // Нет сохранённой логики
  if (!savedJson) {
    return { ready: false, reason: 'Логика не сохранена' }
  }
  
  // Есть несохранённые изменения
  if (hasDraft) {
    return { ready: false, reason: 'Есть несохранённые изменения' }
  }
  
  try {
    const logic = JSON.parse(savedJson)
    
    // Проверяем HL заполненность
    const hlFields: Array<keyof typeof logic.resultsHL> = [
      'width',
      'length',
      'height',
      'weight',
      'purchasingPrice',
      'basePrice'
    ]
    
    for (const field of hlFields) {
      const mapping = logic.resultsHL?.[field]
      if (!mapping?.sourceRef) {
        return { ready: false, reason: `HL поле ${field} не заполнено` }
      }
    }
    
    // Все проверки пройдены
    return { ready: true }
  } catch (e) {
    return { ready: false, reason: 'Ошибка парсинга логики' }
  }
}
