/** Stable identifiers are UUIDs so records can be safely referenced across rooms and photos. */
export type EntityId = string

/** Supported engineering utility categories. `other` allows project-specific networks. */
export type UtilityKind = 'cold_water' | 'hot_water' | 'heating' | 'sewage' | 'electrical' | 'low_voltage' | 'ventilation' | 'other' | 'water' | 'gas'

/** How the route location was determined. */
export type InformationMethod = 'unspecified' | 'measured' | 'as_built' | 'photo_estimate' | 'detector' | 'design_document' | 'other'

/** Confidence in the recorded position. Lower scores mean verify before work. */
export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'unknown'

/** User-facing evidence status; unknown is explicit and never inferred from missing measurements. */
export type UtilityStatus = 'measured' | 'documented' | 'approximate' | 'unknown'

/** Coordinate in meters from the room plan's origin (lower-left corner). */
export interface RoutePoint {
  x: number
  y: number
}

/** Optional technical values shared by pipes and cables. */
export interface UtilityParameters {
  material?: string
  /** Pipe outer diameter or cable bundle diameter, in millimeters. */
  diameterMm?: number
  /** Cable cross-section, in square millimeters. */
  crossSectionMm2?: number
  /** Number of conductors for cable, or number of pipes in a bundle. */
  conductorCount?: number
  /** Optional manufacturer/model or free-form technical detail. */
  specification?: string
}

export interface UtilityPhotoReference {
  photoId: EntityId
  caption?: string
}

/** One registered pipe, cable, or other engineering route. */
export interface Utility {
  id: EntityId
  name: string
  kind: UtilityKind
  roomId: EntityId
  /** Ordered route points in meters, relative to the room origin. */
  route: RoutePoint[]
  /** Height above floor or depth below the stated reference surface, in meters. */
  elevationM?: number
  /** Clarifies whether elevationM is above the floor or below a reference surface. */
  elevationType?: 'height_above_floor' | 'depth_below_surface'
  parameters: UtilityParameters
  status: UtilityStatus
  recordedAt: string
  informationMethod: InformationMethod
  comment?: string
  photos: UtilityPhotoReference[]
  confidence: ConfidenceLevel
  updatedAt: string
}

/** A measured room containing its engineering routes. Dimensions are in meters. */
export interface Room {
  id: EntityId
  name: string
  lengthM: number
  widthM: number
  /** Optional clear height from floor to ceiling, in meters. */
  ceilingHeightM?: number
  /** Optional measured room outline; omitted means a rectangular room. */
  outline?: RoutePoint[]
  utilities: Utility[]
}

/** Building, apartment, or other project object with a list of rooms. */
export interface BuildingObject {
  id: EntityId
  name: string
  address?: string
  rooms: Room[]
  createdAt: string
  updatedAt: string
}

/** Binary image stored locally in IndexedDB; Utility stores references by photoId. */
export interface StoredPhoto {
  id: EntityId
  name: string
  mimeType: string
  blob: Blob
  createdAt: string
}

/** Legacy v1 records, retained for reading/migration of earlier prototypes. */
export interface Point { x: number; y: number }
export interface UtilityRoute {
  id: string
  name: string
  kind: UtilityKind
  points: Point[]
  depthCm?: number
  diameterMm?: number
  material?: string
  notes?: string
  photoIds: string[]
  createdAt: string
  updatedAt: string
}
export interface RoomPlan {
  id: string
  name: string
  widthM: number
  heightM: number
  routes: UtilityRoute[]
  createdAt: string
  updatedAt: string
}

/** Create a collision-resistant record ID in modern browsers. */
export function createId(): EntityId {
  return crypto.randomUUID()
}
