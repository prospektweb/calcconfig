/**
 * Stage utility functions for readiness checking and draft management
 */

/**
 * Get draft key for localStorage
 * IMPORTANT: Uses stageId to ensure drafts are scoped per stage, not per calculator
 */
export function getDraftKey(stageId: number): string {
  return `calc_logic_draft_stage:${stageId}`
}

/**
 * Check if a stage has a draft in localStorage
 */
export function hasDraftForStage(stageId: number): boolean {
  const draftKey = getDraftKey(stageId)
  return localStorage.getItem(draftKey) !== null
}

/**
 * Generate a slug from a title for use as a key
 * - Converts to lowercase
 * - Replaces non-alphanumeric characters (including Cyrillic) with underscores
 * - Collapses multiple underscores into one
 * - Trims leading/trailing underscores
 * 
 * Note: According to requirements, keys should be "латиница + цифры + underscore"
 * So we transliterate Cyrillic to Latin first
 */
export function slugify(title: string): string {
  // Simple Cyrillic to Latin transliteration map
  const translitMap: Record<string, string> = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e', 'ж': 'zh',
    'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
    'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'ts',
    'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
  }
  
  return title
    .toLowerCase()
    .split('')
    .map(char => translitMap[char] || char)
    .join('')
    .replace(/[^a-z0-9_]+/g, '_')  // Replace non-alphanumeric with underscore
    .replace(/_+/g, '_')           // Collapse multiple underscores
    .replace(/^_|_$/g, '')         // Trim leading/trailing underscores
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
