import { useEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react'
import { LocateFixed, Minus, Plus } from 'lucide-react'
import type { Room, RoutePoint, Utility, UtilityKind } from '../types'
import { getUtilityTypeVisual } from '../config/utilityTypes'
import { UtilityRouteGraphic } from './UtilityVisuals'

interface RoomMapCanvasProps {
  room: Room
  utilities: Utility[]
  draftPoints: RoutePoint[]
  draftKind: UtilityKind
  selectedUtilityId?: string
  isPlacingPoints: boolean
  isEditing: boolean
  onAddPoint: (point: RoutePoint) => void
  onMovePoint: (index: number, point: RoutePoint) => void
  onInsertPoint: (index: number, point: RoutePoint) => void
  onDeletePoint: (index: number) => void
  onSelectUtility: (utility: Utility) => void
}

function niceStep(rough: number) {
  if (!Number.isFinite(rough) || rough <= 0) return 1
  const power = 10 ** Math.floor(Math.log10(rough))
  const fraction = rough / power
  return (fraction <= 1.5 ? 1 : fraction <= 2.25 ? 2 : fraction <= 3.75 ? 2.5 : fraction <= 7.5 ? 5 : 10) * power
}
function ticks(max: number, step: number) {
  return Array.from({ length: Math.floor(max / step + 1e-8) + 1 }, (_, index) => Number((index * step).toPrecision(9)))
}
function formatMeter(value: number) {
  return Number(value.toPrecision(6)).toLocaleString('ru-RU', { maximumFractionDigits: 3 })
}

export function RoomMapCanvas({ room, utilities, draftPoints, draftKind, selectedUtilityId, isPlacingPoints, isEditing, onAddPoint, onMovePoint, onInsertPoint, onDeletePoint, onSelectUtility }: RoomMapCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const gesture = useRef<{ pointerId: number; kind: 'pan' | 'point'; index?: number; x: number; y: number; moved: boolean } | null>(null)
  const skipNextClick = useRef(false)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: room.lengthM / 2, y: room.widthM / 2 })
  const [viewportSize, setViewportSize] = useState({ width: 1000, height: 620 })
  const [activePoint, setActivePoint] = useState<number | null>(null)

  useEffect(() => {
    const element = svgRef.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => setViewportSize({ width: entry.contentRect.width, height: entry.contentRect.height }))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    setZoom(1); setPan({ x: room.lengthM / 2, y: room.widthM / 2 }); setActivePoint(null)
  }, [room.id, room.lengthM, room.widthM])

  const dimensions = useMemo(() => {
    const visibleLength = room.lengthM / zoom
    const visibleWidth = room.widthM / zoom
    const marginX = Math.min(.35, Math.max(.08, visibleLength * .08))
    const marginY = Math.min(.35, Math.max(.08, visibleWidth * .08))
    const centerX = zoom === 1 ? room.lengthM / 2 : Math.max(visibleLength / 2, Math.min(room.lengthM - visibleLength / 2, pan.x))
    const centerY = zoom === 1 ? room.widthM / 2 : Math.max(visibleWidth / 2, Math.min(room.widthM - visibleWidth / 2, pan.y))
    const x = centerX - visibleLength / 2 - marginX
    const y = room.widthM - centerY - visibleWidth / 2 - marginY
    return { visibleLength, visibleWidth, marginX, marginY, centerX, centerY, x, y, viewWidth: visibleLength + marginX * 2, viewHeight: visibleWidth + marginY * 2 }
  }, [room.lengthM, room.widthM, zoom, pan])

  const pixelsPerMeter = Math.min(viewportSize.width / dimensions.viewWidth, viewportSize.height / dimensions.viewHeight)
  const visibleGridStep = niceStep(80 / pixelsPerMeter)
  const xTicks = ticks(room.lengthM, visibleGridStep).filter((value) => value >= dimensions.centerX - dimensions.visibleLength / 2 - 1e-8 && value <= dimensions.centerX + dimensions.visibleLength / 2 + 1e-8)
  const yTicks = ticks(room.widthM, visibleGridStep).filter((value) => value >= dimensions.centerY - dimensions.visibleWidth / 2 - 1e-8 && value <= dimensions.centerY + dimensions.visibleWidth / 2 + 1e-8)
  const labelSize = 11 / pixelsPerMeter
  const scaleLength = Math.min(niceStep(88 / pixelsPerMeter), Math.min(dimensions.visibleLength, dimensions.visibleWidth) / 2)
  const roomPath = room.outline?.length
    ? `${room.outline.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${room.widthM - point.y}`).join(' ')} Z`
    : `M 0 0 H ${room.lengthM} V ${room.widthM} H 0 Z`

  const toRoomPoint = (clientX: number, clientY: number): RoutePoint | null => {
    const svg = svgRef.current
    const matrix = svg?.getScreenCTM()
    if (!svg || !matrix) return null
    const point = svg.createSVGPoint()
    point.x = clientX; point.y = clientY
    const local = point.matrixTransform(matrix.inverse())
    const result = { x: local.x, y: room.widthM - local.y }
    if (!Number.isFinite(result.x) || !Number.isFinite(result.y) || result.x < 0 || result.y < 0 || result.x > room.lengthM || result.y > room.widthM) return null
    return result
  }
  const handleClick = (event: ReactMouseEvent<SVGSVGElement>) => {
    if (skipNextClick.current) { skipNextClick.current = false; return }
    if (!isPlacingPoints) return
    const point = toRoomPoint(event.clientX, event.clientY)
    if (point) onAddPoint(point)
  }
  const handleWheel = (event: ReactWheelEvent<SVGSVGElement>) => {
    if (!event.ctrlKey && !event.metaKey) return
    event.preventDefault()
    setZoom((current) => Math.max(1, Math.min(8, current * (event.deltaY < 0 ? 1.15 : 1 / 1.15))))
  }
  const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return
    const pointHandle = event.target instanceof Element ? event.target.closest<SVGCircleElement>('[data-route-point]') : null
    if (pointHandle && isEditing) {
      const index = Number(pointHandle.dataset.routePoint)
      gesture.current = { pointerId: event.pointerId, kind: 'point', index, x: event.clientX, y: event.clientY, moved: false }
      setActivePoint(index); event.preventDefault(); event.stopPropagation(); svgRef.current?.setPointerCapture(event.pointerId)
      return
    }
    if (zoom > 1) {
      gesture.current = { pointerId: event.pointerId, kind: 'pan', x: event.clientX, y: event.clientY, moved: false }
      if (!(event.target instanceof Element && event.target.closest('.saved-route'))) svgRef.current?.setPointerCapture(event.pointerId)
    }
  }
  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const current = gesture.current
    if (!current || current.pointerId !== event.pointerId) return
    const dx = event.clientX - current.x, dy = event.clientY - current.y
    if (Math.abs(dx) + Math.abs(dy) > 2) current.moved = true
    if (current.kind === 'point' && current.index !== undefined) {
      const point = toRoomPoint(event.clientX, event.clientY)
      if (point) onMovePoint(current.index, point)
    } else {
      const meterX = dx / pixelsPerMeter, meterY = dy / pixelsPerMeter
      setPan((value) => ({
        x: Math.max(dimensions.visibleLength / 2, Math.min(room.lengthM - dimensions.visibleLength / 2, value.x - meterX)),
        y: Math.max(dimensions.visibleWidth / 2, Math.min(room.widthM - dimensions.visibleWidth / 2, value.y + meterY)),
      }))
    }
    current.x = event.clientX; current.y = event.clientY
  }
  const handlePointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    const current = gesture.current
    if (!current || current.pointerId !== event.pointerId) return
    if (current.moved) skipNextClick.current = true
    gesture.current = null
    if (svgRef.current?.hasPointerCapture(event.pointerId)) svgRef.current.releasePointerCapture(event.pointerId)
  }
  const resetView = () => { setZoom(1); setPan({ x: room.lengthM / 2, y: room.widthM / 2 }) }
  const handleInsertPoint = (event: ReactMouseEvent<SVGPolylineElement>, index: number) => {
    event.stopPropagation()
    const point = toRoomPoint(event.clientX, event.clientY)
    if (point) { onInsertPoint(index, point); setActivePoint(index + 1) }
  }
  const getRouteTitle = (utility: Utility) => `${utility.name} · ${getUtilityTypeVisual(utility.kind).label} · ${utility.route.length} точек`

  return <div className={`room-map-shell ${isPlacingPoints ? 'is-placing' : ''} ${isEditing ? 'is-editing' : ''}`}>
    <div className="room-map-tools"><span className="coordinate-origin">0,0 · левый нижний угол</span><div className="zoom-controls" aria-label="Управление масштабом схемы">
      <button type="button" aria-label="Уменьшить масштаб" title="Уменьшить масштаб" disabled={zoom <= 1} onClick={() => setZoom((value) => Math.max(1, value / 1.25))}><Minus size={14}/></button><span>{Math.round(zoom * 100)}%</span><button type="button" aria-label="Увеличить масштаб" title="Увеличить масштаб" disabled={zoom >= 8} onClick={() => setZoom((value) => Math.min(8, value * 1.25))}><Plus size={14}/></button><button type="button" aria-label="Сбросить масштаб" title="Показать всё помещение" onClick={resetView}><LocateFixed size={14}/></button>
    </div></div>
    <div className="room-map-viewport"><svg ref={svgRef} className={`room-canvas ${zoom > 1 ? 'can-pan' : ''}`} viewBox={`${dimensions.x} ${dimensions.y} ${dimensions.viewWidth} ${dimensions.viewHeight}`} preserveAspectRatio="xMidYMid meet" onClick={handleClick} onDoubleClick={() => undefined} onWheel={handleWheel} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp} role="img" aria-label={`План ${room.name}, ${room.lengthM} на ${room.widthM} метров`}>
      <defs><clipPath id={`room-boundary-${room.id}`}><path d={roomPath}/></clipPath></defs>
      <rect x={dimensions.x} y={dimensions.y} width={dimensions.viewWidth} height={dimensions.viewHeight} fill="#fbfcfa"/><path d={roomPath} fill="#fff"/>
      <g className="room-coordinate-grid" clipPath={`url(#room-boundary-${room.id})`}>{xTicks.map((value) => <line key={`gx${value}`} x1={value} x2={value} y1="0" y2={room.widthM}/>)}{yTicks.map((value) => <line key={`gy${value}`} x1="0" x2={room.lengthM} y1={room.widthM - value} y2={room.widthM - value}/>)}</g>
      <path className="room-walls" d={roomPath}/>
      <g className="room-rulers">{xTicks.map((value) => <g key={`tx${value}`}><line x1={value} x2={value} y1={room.widthM} y2={room.widthM + dimensions.marginY * .17}/><text x={value} y={room.widthM + dimensions.marginY * .44} fontSize={labelSize} textAnchor="middle">{formatMeter(value)}</text></g>)}{yTicks.map((value) => <g key={`ty${value}`}><line x1={-dimensions.marginX * .12} x2="0" y1={room.widthM - value} y2={room.widthM - value}/><text x={-dimensions.marginX * .22} y={room.widthM - value} fontSize={labelSize} textAnchor="end" dominantBaseline="central">{formatMeter(value)}</text></g>)}</g>
      <g clipPath={`url(#room-boundary-${room.id})`}>
        {utilities.filter((utility) => !(isEditing && utility.id === selectedUtilityId)).map((utility) => <g key={utility.id} className={`saved-route ${selectedUtilityId === utility.id ? 'selected' : ''} ${selectedUtilityId && selectedUtilityId !== utility.id ? 'dimmed' : ''}`} onClick={(event) => { if (skipNextClick.current) { skipNextClick.current = false; event.stopPropagation(); return } event.stopPropagation(); onSelectUtility(utility) }}><title>{getRouteTitle(utility)}</title><UtilityRouteGraphic kind={utility.kind} selected={selectedUtilityId === utility.id} markerScale={1 / pixelsPerMeter} points={utility.route.map((point) => ({ x: point.x, y: room.widthM - point.y }))}/></g>)}
        {draftPoints.length > 0 && <g className="draft-route-editable"><UtilityRouteGraphic kind={draftKind} draft markerScale={1 / pixelsPerMeter} points={draftPoints.map((point) => ({ x: point.x, y: room.widthM - point.y }))}/>
          {isEditing && draftPoints.slice(0, -1).map((point, index) => { const next = draftPoints[index + 1]; return <polyline key={`insert-${index}`} className="route-insert-hit" points={`${point.x},${room.widthM - point.y} ${next.x},${room.widthM - next.y}`} onDoubleClick={(event) => handleInsertPoint(event, index)} aria-label={`Добавить точку после точки ${index + 1}`}/> })}
          {isEditing && draftPoints.map((point, index) => <circle key={`handle-${index}`} data-route-point={index} className={`route-point-handle ${activePoint === index ? 'active' : ''}`} cx={point.x} cy={room.widthM - point.y} r={7 / pixelsPerMeter} tabIndex={0} role="button" aria-label={`Точка ${index + 1}: X ${formatMeter(point.x)} м, Y ${formatMeter(point.y)} м. Перетащите для перемещения`} onClick={(event) => { event.stopPropagation(); setActivePoint(index) }} onKeyDown={(event) => { if ((event.key === 'Delete' || event.key === 'Backspace') && draftPoints.length > 2) { event.stopPropagation(); onDeletePoint(index); setActivePoint(null) } }} />)}
        </g>}
      </g>
      {isPlacingPoints && <text className="placement-hint" x={dimensions.centerX} y={dimensions.y + dimensions.marginY * .5} fontSize={labelSize} textAnchor="middle">Щёлкните внутри стен, чтобы поставить точку</text>}
    </svg><div className="room-map-scale-overlay" aria-live="polite" aria-label={`Шаг сетки ${formatMeter(visibleGridStep)} метров, масштабная линейка ${formatMeter(scaleLength)} метров`}><div className="room-grid-step"><span>Шаг сетки</span><strong>{formatMeter(visibleGridStep)} м</strong></div><div className="room-scale-indicator"><span style={{ width: `${Math.max(32, Math.min(112, scaleLength * pixelsPerMeter))}px` }}/><small>{formatMeter(scaleLength)} м</small></div></div></div>
    <div className="room-map-caption"><span>Размер помещения: {formatMeter(room.lengthM)} × {formatMeter(room.widthM)} м{room.ceilingHeightM ? ` · высота ${formatMeter(room.ceilingHeightM)} м` : ''}</span><span>Ctrl + колесо — масштаб · ЛКМ с перетаскиванием — перемещение</span></div>
  </div>
}
