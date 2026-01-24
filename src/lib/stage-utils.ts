/**
 * Stage utility functions for readiness checking and draft management
 */

/**
 * Interface for LOGIC_JSON property structure from Bitrix
 */
export interface BitrixPropertyValue {
  "~VALUE"?: string | { TEXT?: string }
  VALUE?: string | { TEXT?: string }
  [key: string]: any
}

/**
 * Extract LOGIC_JSON string from property value
 * Handles both string and object with TEXT field formats
 * 
 * @param logicJsonProp - The LOGIC_JSON property value from Bitrix
 * @returns The extracted JSON string or null if not found
 */
export function extractLogicJsonString(logicJsonProp: BitrixPropertyValue | null | undefined): string | null {
  if (!logicJsonProp) return null

  const rawValue = logicJsonProp["~VALUE"];
  
  // Variant 1: rawValue = { TEXT: "..." }
  if (typeof rawValue === 'object' && rawValue !== null && typeof rawValue.TEXT === 'string') {
    return rawValue.TEXT;
  }
  
  // Variant 2: rawValue = "..."
  if (typeof rawValue === 'string') {
    return rawValue;
  }
  
  // Variant 3: Check VALUE property
  const value = logicJsonProp.VALUE;
  if (typeof value === 'object' && value !== null && typeof value.TEXT === 'string') {
    return value.TEXT;
  }
  if (typeof value === 'string') {
    return value;
  }
  
  return null;
}

/**
 * Get draft key for localStorage
 * IMPORTANT: Uses both stageId and settingsId to ensure drafts are isolated per calculator+stage pair
 * This prevents logic leakage when switching calculators on the same stage
 */
export function getDraftKey(stageId: number, settingsId: number): string {
  return `calc_logic_draft:${stageId}:${settingsId}`
}

/**
 * Check if a stage has a draft in localStorage for a specific calculator
 */
export function hasDraftForStage(stageId: number, settingsId: number): boolean {
  const draftKey = getDraftKey(stageId, settingsId)
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
 * Calculate stage readiness based on outputs and draft status
 * @param outputsValue - The OUTPUTS.VALUE array from CALC_STAGES
 * @param hasDraft - Whether there's an unsaved draft
 * @returns Readiness status with reason if not ready
 */
export function calculateStageReadiness(
  outputsValue: string[] | null | undefined,
  hasDraft: boolean
): { ready: boolean; reason?: string } {
  // Есть несохранённые изменения
  if (hasDraft) {
    return { ready: false, reason: 'Есть несохранённые изменения' }
  }
  
  // Проверяем HL заполненность - все 6 обязательных полей должны быть в outputs
  const requiredKeys = ['width', 'length', 'height', 'weight', 'purchasingPrice', 'basePrice']
  
  if (!outputsValue || !Array.isArray(outputsValue)) {
    return { ready: false, reason: 'Логика не сохранена' }
  }
  
  // Проверяем что все обязательные ключи присутствуют
  for (const key of requiredKeys) {
    if (!outputsValue.includes(key)) {
      return { ready: false, reason: `HL поле ${key} не заполнено` }
    }
  }
  
  // Все проверки пройдены
  return { ready: true }
}
