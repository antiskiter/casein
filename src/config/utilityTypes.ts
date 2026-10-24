import type { UtilityKind } from '../types'

export type UtilityLineStyle = 'solid' | 'dashed' | 'dotted' | 'combined'
export type UtilityNodeMarker = 'circle' | 'diamond' | 'square' | 'triangle' | 'cross' | 'hexagon'

export interface UtilityTypeVisual {
  kind: UtilityKind
  label: string
  shortLabel: string
  color: string
  lineWidth: number
  lineStyle: UtilityLineStyle
  dashArray?: string
  marker: UtilityNodeMarker
  markerSize: number
  legendLabel: string
  /** True only for kinds kept to render old saved records. */
  legacy?: boolean
}

/**
 * The visual language used by route drawings, forms, registries, and legends.
 * These are application conventions; they do not claim compliance with a GOST.
 */
export const UTILITY_TYPE_CONFIG: Record<UtilityKind, UtilityTypeVisual> = {
  cold_water: {
    kind: 'cold_water', label: 'Холодное водоснабжение', shortLabel: 'ХВС', color: '#2787c7',
    lineWidth: 4, lineStyle: 'solid', marker: 'circle', markerSize: 8,
    legendLabel: 'ХВС · холодное водоснабжение',
  },
  hot_water: {
    kind: 'hot_water', label: 'Горячее водоснабжение', shortLabel: 'ГВС', color: '#dc5c4e',
    lineWidth: 4, lineStyle: 'dashed', dashArray: '11 7', marker: 'diamond', markerSize: 9,
    legendLabel: 'ГВС · горячее водоснабжение',
  },
  heating: {
    kind: 'heating', label: 'Отопление', shortLabel: 'ОТ', color: '#e89131',
    lineWidth: 5, lineStyle: 'combined', dashArray: '12 6', marker: 'square', markerSize: 9,
    legendLabel: 'ОТ · отопление',
  },
  sewage: {
    kind: 'sewage', label: 'Канализация', shortLabel: 'КАН', color: '#82634d',
    lineWidth: 4, lineStyle: 'dotted', dashArray: '1 8', marker: 'triangle', markerSize: 10,
    legendLabel: 'КАН · канализация',
  },
  electrical: {
    kind: 'electrical', label: 'Электроснабжение', shortLabel: 'ЭЛ', color: '#c69c16',
    lineWidth: 3, lineStyle: 'dashed', dashArray: '7 5', marker: 'cross', markerSize: 9,
    legendLabel: 'ЭЛ · электроснабжение',
  },
  low_voltage: {
    kind: 'low_voltage', label: 'Слаботочные сети', shortLabel: 'СЛ', color: '#8065bd',
    lineWidth: 3, lineStyle: 'dotted', dashArray: '1 6', marker: 'diamond', markerSize: 8,
    legendLabel: 'СЛ · слаботочные сети',
  },
  ventilation: {
    kind: 'ventilation', label: 'Вентиляция', shortLabel: 'ВЕНТ', color: '#319b82',
    lineWidth: 5, lineStyle: 'combined', dashArray: '15 6 3 6', marker: 'hexagon', markerSize: 9,
    legendLabel: 'ВЕНТ · вентиляция',
  },
  other: {
    kind: 'other', label: 'Прочее', shortLabel: 'ПР', color: '#738078',
    lineWidth: 3, lineStyle: 'solid', marker: 'circle', markerSize: 8,
    legendLabel: 'ПР · прочее',
  },
  // v2 compatibility: older records used one generic water type and a gas type.
  water: {
    kind: 'water', label: 'Водоснабжение (старая запись)', shortLabel: 'ВОДА', color: '#2787c7',
    lineWidth: 4, lineStyle: 'solid', marker: 'circle', markerSize: 8,
    legendLabel: 'Водоснабжение · старая запись', legacy: true,
  },
  gas: {
    kind: 'gas', label: 'Газ (старая запись)', shortLabel: 'ГАЗ', color: '#bb584d',
    lineWidth: 4, lineStyle: 'dashed', dashArray: '9 6', marker: 'hexagon', markerSize: 9,
    legendLabel: 'Газ · старая запись', legacy: true,
  },
}

/** Canonical kinds offered for new utility records, in legend order. */
export const UTILITY_TYPE_OPTIONS: UtilityTypeVisual[] = [
  UTILITY_TYPE_CONFIG.cold_water,
  UTILITY_TYPE_CONFIG.hot_water,
  UTILITY_TYPE_CONFIG.heating,
  UTILITY_TYPE_CONFIG.sewage,
  UTILITY_TYPE_CONFIG.electrical,
  UTILITY_TYPE_CONFIG.low_voltage,
  UTILITY_TYPE_CONFIG.ventilation,
  UTILITY_TYPE_CONFIG.other,
]

export function getUtilityTypeVisual(kind: UtilityKind): UtilityTypeVisual {
  return UTILITY_TYPE_CONFIG[kind] ?? UTILITY_TYPE_CONFIG.other
}
