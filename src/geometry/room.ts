import type { Room, RoutePoint } from '../types'

export function isPointInRoom(point: RoutePoint, room: Pick<Room, 'lengthM' | 'widthM' | 'outline'>) {
  if (point.x < 0 || point.y < 0 || point.x > room.lengthM || point.y > room.widthM) return false
  const polygon = room.outline
  if (!polygon || polygon.length < 3) return true
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[j], b = polygon[i]
    const cross = (point.x - a.x) * (b.y - a.y) - (point.y - a.y) * (b.x - a.x)
    const onSegment = Math.abs(cross) < 1e-9 && point.x >= Math.min(a.x, b.x) - 1e-9 && point.x <= Math.max(a.x, b.x) + 1e-9 && point.y >= Math.min(a.y, b.y) - 1e-9 && point.y <= Math.max(a.y, b.y) + 1e-9
    if (onSegment) return true
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

export function parseRoomOutline(value: string, lengthM: number, widthM: number): RoutePoint[] | undefined {
  if (!value.trim()) return undefined
  const points = value.split(';').map((pair) => {
    const parts = pair.trim().split(',').map((part) => Number(part.trim()))
    if (parts.length !== 2 || !parts.every(Number.isFinite)) throw new Error('Введите вершины контура в формате X,Y; X,Y; …')
    return { x: parts[0], y: parts[1] }
  })
  if (points.length < 3) throw new Error('Контур должен содержать минимум три вершины.')
  if (points.some((point) => point.x < 0 || point.y < 0 || point.x > lengthM || point.y > widthM)) throw new Error('Вершины контура должны лежать внутри заданных длины и ширины комнаты.')
  const unique = new Set(points.map(({ x, y }) => `${x}:${y}`))
  if (unique.size !== points.length) throw new Error('В контуре есть повторяющиеся вершины.')
  const area = points.reduce((total, point, index) => {
    const next = points[(index + 1) % points.length]
    return total + point.x * next.y - next.x * point.y
  }, 0)
  if (Math.abs(area) < 1e-8) throw new Error('Площадь контура должна быть больше нуля.')
  const intersects = (a: RoutePoint, b: RoutePoint, c: RoutePoint, d: RoutePoint) => {
    const orient = (p: RoutePoint, q: RoutePoint, r: RoutePoint) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x))
    return orient(a, b, c) !== orient(a, b, d) && orient(c, d, a) !== orient(c, d, b)
  }
  for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
    if (j === i || j === (i + 1) % points.length || i === (j + 1) % points.length) continue
    if (intersects(points[i], points[(i + 1) % points.length], points[j], points[(j + 1) % points.length])) throw new Error('Сегменты контура пересекаются. Укажите вершины по порядку вдоль стены.')
  }
  return points
}
