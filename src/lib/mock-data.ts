export interface ProductVariant {
  id: number
  name: string
  tirage: number
  width: number
  length: number
}

export interface Material {
  id: number
  name: string
  width: number | null
  length: number | null
  height: number
  density?: number
  price: number
}

export interface Work {
  id: number
  name: string
  maxWidth: number | null
  maxLength: number | null
  equipmentIds: number[]
  price: number
}

export type Operation = Work

export interface Equipment {
  id: number
  name: string
  fields: string
  maxWidth: number | null
  maxLength: number | null
  startCost: number
}

export interface DetailVariant {
  id: number
  name: string
  width: number
  length: number
}

export interface CalculatorField {
  visible: boolean
  required: boolean
  quantityField?: boolean
  quantityUnit?: string
}

export interface CalculatorExtraOption {
  code: string
  label: string
  type: 'number' | 'checkbox' | 'text'
  default: number | boolean | string
  min?: number
  max?: number
}

export interface Calculator {
  code: string
  title: string
  group: string
  fields: {
    operation?: CalculatorField
    equipment?: CalculatorField
    material?: CalculatorField
  }
  extraOptions: CalculatorExtraOption[]
  canBeFirst: boolean
  requiresBefore?: string[]
  positionMessage?: string
}

export interface CalculatorGroup {
  id: string
  title: string
  order: number
}

export const mockProductVariants: ProductVariant[] = Array.from({ length: 100 }, (_, i) => ({
  id: 525 + i,
  name: `Календарь А3 ${100 * (i + 1)}шт`,
  tirage: 100 * (i + 1),
  width: 297,
  length: 420,
}))

export const mockMaterials: Material[] = [
  { id: 325, name: 'Мелованная матовая бумага 300 г/м²', width: 320, length: 450, height: 0.35, density: 300, price: 15.50 },
  { id: 326, name: 'Мелованная матовая бумага 200 г/м²', width: 320, length: 450, height: 0.28, density: 200, price: 12.00 },
  { id: 327, name: 'Мелованная матовая бумага 115 г/м²', width: 320, length: 450, height: 0.15, density: 115, price: 8.00 },
  { id: 328, name: 'Мелованная глянцевая бумага 300 г/м²', width: 320, length: 450, height: 0.35, density: 300, price: 16.00 },
  { id: 329, name: 'Мелованная глянцевая бумага 200 г/м²', width: 320, length: 450, height: 0.28, density: 200, price: 13.00 },
  { id: 330, name: 'Картон 400 г/м²', width: 320, length: 450, height: 0.50, density: 400, price: 22.00 },
  { id: 331, name: 'Картон 300 г/м²', width: 320, length: 450, height: 0.40, density: 300, price: 18.00 },
  { id: 454, name: 'Белая матовая плёнка 80 мкм', width: 330, length: 100000, height: 0.08, price: 2500.00 },
  { id: 455, name: 'Белая матовая плёнка 50 мкм', width: 330, length: 100000, height: 0.05, price: 1800.00 },
  { id: 456, name: 'Прозрачная глянцевая плёнка 80 мкм', width: 330, length: 100000, height: 0.08, price: 2800.00 },
  { id: 457, name: 'Белая глянцевая плёнка 80 мкм', width: 330, length: 100000, height: 0.08, price: 2700.00 },
  { id: 480, name: 'Пружина пластиковая 10мм', width: null, length: null, height: 10, price: 8.50 },
]

export const mockOperations: Operation[] = [
  { id: 338, name: 'Цифровая печать', maxWidth: 330, maxLength: 487, equipmentIds: [401, 402], price: 12.00 },
  { id: 339, name: 'Офсетная печать', maxWidth: 700, maxLength: 1000, equipmentIds: [403], price: 8.00 },
  { id: 340, name: 'УФ-печать', maxWidth: 250, maxLength: 500, equipmentIds: [404], price: 18.00 },
  { id: 341, name: 'Экосольветная печать', maxWidth: 1600, maxLength: 5000, equipmentIds: [405], price: 15.00 },
  { id: 350, name: 'Плоттерная резка', maxWidth: 600, maxLength: null, equipmentIds: [410], price: 8.00 },
  { id: 351, name: 'Гильотинная резка', maxWidth: null, maxLength: null, equipmentIds: [415], price: 5.00 },
  { id: 352, name: 'Ручная резка', maxWidth: null, maxLength: null, equipmentIds: [], price: 3.00 },
  { id: 357, name: 'Ламинирование матовое', maxWidth: 350, maxLength: null, equipmentIds: [410], price: 0.50 },
  { id: 358, name: 'Ламинирование глянцевое', maxWidth: 350, maxLength: null, equipmentIds: [410], price: 0.50 },
  { id: 360, name: 'Установка пружины', maxWidth: null, maxLength: null, equipmentIds: [420], price: 15.00 },
]

export const mockWorks = mockOperations

export const mockEquipment: Equipment[] = [
  { id: 401, name: 'Xerox Versant 180', fields: '5,5,5,5', maxWidth: 330, maxLength: 487, startCost: 500 },
  { id: 402, name: 'Konica Minolta C1100', fields: '4,4,4,4', maxWidth: 330, maxLength: 487, startCost: 450 },
  { id: 403, name: 'Офсетная машина Heidelberg', fields: '8,8,8,8', maxWidth: 700, maxLength: 1000, startCost: 2000 },
  { id: 404, name: 'УФ-принтер Mimaki', fields: '6,6,6,6', maxWidth: 250, maxLength: 500, startCost: 800 },
  { id: 405, name: 'Экосольвентный принтер Roland', fields: '10,10,10,10', maxWidth: 1600, maxLength: 5000, startCost: 1500 },
  { id: 410, name: 'Ламинатор GMP 350', fields: '10,10,0,0', maxWidth: 350, maxLength: null, startCost: 200 },
  { id: 415, name: 'Резак гильотинный', fields: '0,0,0,0', maxWidth: null, maxLength: null, startCost: 50 },
  { id: 420, name: 'Пружинонавивочный станок', fields: '0,0,0,0', maxWidth: null, maxLength: null, startCost: 100 },
]

export const mockDetails: DetailVariant[] = [
  { id: 501, name: 'Постер А3', width: 297, length: 420 },
  { id: 502, name: 'Подложка А3', width: 297, length: 420 },
  { id: 503, name: 'Обложка А4', width: 210, length: 297 },
  { id: 504, name: 'Блок А4', width: 210, length: 297 },
  { id: 505, name: 'Визитка 90x50', width: 90, length: 50 },
  { id: 506, name: 'Флаер А5', width: 148, length: 210 },
  { id: 507, name: 'Листовка А6', width: 105, length: 148 },
  { id: 508, name: 'Буклет евро', width: 210, length: 99 },
]

export const mockCalculatorGroups: CalculatorGroup[] = [
  { id: 'digital_print', title: 'Цифровая печать', order: 1 },
  { id: 'postpress', title: 'Постпечатные работы', order: 2 },
  { id: 'binding', title: 'Скрепление', order: 3 },
  { id: 'finish', title: 'Финишная обработка', order: 4 },
]

export const mockCalculators: Calculator[] = [
  {
    code: 'digital_sheet',
    title: 'Цифровая листовая печать',
    group: 'digital_print',
    fields: {
      operation: { visible: true, required: true, quantityField: true },
      equipment: { visible: true, required: true },
      material: { visible: true, required: true, quantityField: true, quantityUnit: 'л' },
    },
    extraOptions: [
      { code: 'FIELD_MM', label: 'Припуски', type: 'number', default: 2, min: 0 },
    ],
    canBeFirst: true,
  },
  {
    code: 'roll_lamination',
    title: 'Ламинирование рулонное',
    group: 'postpress',
    fields: {
      operation: { visible: true, required: true, quantityField: true },
      equipment: { visible: true, required: true },
      material: { visible: true, required: true, quantityField: false, quantityUnit: 'мм' },
    },
    extraOptions: [
      { code: 'DOUBLE_SIDED', label: 'Двухстороннее', type: 'checkbox', default: true },
      { code: 'WASTE_PERCENT', label: 'Отходы, %', type: 'number', default: 5, min: 0, max: 100 },
    ],
    canBeFirst: false,
    requiresBefore: ['digital_sheet'],
    positionMessage: 'Ламинирование требует предварительной печати',
  },
  {
    code: 'spring_binding',
    title: 'Скрепление на пружину',
    group: 'binding',
    fields: {
      operation: { visible: true, required: true, quantityField: true },
      equipment: { visible: true, required: true },
      material: { visible: true, required: true, quantityField: true, quantityUnit: 'шт' },
    },
    extraOptions: [],
    canBeFirst: true,
  },
  {
    code: 'trimming',
    title: 'Подрезка в размер',
    group: 'finish',
    fields: {
      operation: { visible: true, required: true, quantityField: true },
      equipment: { visible: true, required: true },
      material: { visible: false, required: false },
    },
    extraOptions: [],
    canBeFirst: false,
  },
]
