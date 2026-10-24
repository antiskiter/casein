import type { RoutePoint, UtilityKind } from '../types'
import { getUtilityTypeVisual, UTILITY_TYPE_OPTIONS } from '../config/utilityTypes'

interface RouteGraphicProps {
  kind: UtilityKind
  points: RoutePoint[]
  selected?: boolean
  draft?: boolean
  showPointNumbers?: boolean
  /** Converts screen-sized node symbols into the route's coordinate space. */
  markerScale?: number
}

function isKeyRouteNode(points: RoutePoint[], index: number) {
  if (index === 0 || index === points.length - 1) return true
  const previous = points[index - 1]
  const current = points[index]
  const next = points[index + 1]
  const incomingX = current.x - previous.x
  const incomingY = current.y - previous.y
  const outgoingX = next.x - current.x
  const outgoingY = next.y - current.y
  const cross = incomingX * outgoingY - incomingY * outgoingX
  const magnitude = Math.hypot(incomingX, incomingY) * Math.hypot(outgoingX, outgoingY)
  return magnitude > 0 && Math.abs(cross) / magnitude > 0.015
}

function NodeMarker({ kind, x, y, number, showNumber, size, markerScale }: { kind: UtilityKind; x: number; y: number; number?: number; showNumber: boolean; size: number; markerScale: number }) {
  const visual = getUtilityTypeVisual(kind)
  const color = visual.color
  const r = size / 2
  const common = { fill: '#fff', stroke: color, strokeWidth: 2.5, vectorEffect: 'non-scaling-stroke' as const }
  return <g className="utility-node" transform={`translate(${x} ${y})`}>
    {visual.marker === 'circle' && <circle r={r} {...common}/>}
    {visual.marker === 'diamond' && <polygon points={`0,${-r} ${r},0 0,${r} ${-r},0`} {...common}/>}
    {visual.marker === 'square' && <rect x={-r} y={-r} width={size} height={size} rx="1" {...common}/>}
    {visual.marker === 'triangle' && <polygon points={`0,${-r} ${r},${r * .82} ${-r},${r * .82}`} {...common}/>}
    {visual.marker === 'cross' && <g><circle r={r} {...common}/><path d={`M ${-r * .55} 0 H ${r * .55} M 0 ${-r * .55} V ${r * .55}`} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke"/></g>}
    {visual.marker === 'hexagon' && <polygon points={`${-r * .7},${-r} ${r * .7},${-r} ${r},0 ${r * .7},${r} ${-r * .7},${r} ${-r},0`} {...common}/>}
    {showNumber && number !== undefined && <text x="0" y="0" fontSize={7 * markerScale} fontWeight="700" fontFamily="'DM Sans', sans-serif" textAnchor="middle" dominantBaseline="central" fill={color}>{number}</text>}
  </g>
}

/** Shared route rendering used by the plan and the legend, with appearance owned by the config. */
export function UtilityRouteGraphic({ kind, points, selected = false, draft = false, showPointNumbers = true, markerScale = 1 }: RouteGraphicProps) {
  const visual = getUtilityTypeVisual(kind)
  if (points.length === 0) return null
  const encodedPoints = points.map((point) => `${point.x},${point.y}`).join(' ')
  const dashArray = points.length < 2 && draft ? '3 5' : visual.dashArray
  return <g className={`utility-route-graphic ${draft ? 'is-draft' : ''}`}>
    {visual.lineStyle === 'combined' && <polyline points={encodedPoints} fill="none" stroke={visual.color} strokeWidth={visual.lineWidth + (selected ? 2 : 0)} strokeLinecap="round" strokeLinejoin="round" opacity={draft ? '.72' : '.95'} vectorEffect="non-scaling-stroke"/>}
    <polyline points={encodedPoints} fill="none" stroke={visual.lineStyle === 'combined' ? '#fff' : visual.color} strokeWidth={visual.lineStyle === 'combined' ? 1.4 : visual.lineWidth + (selected ? 2 : 0)} strokeDasharray={visual.lineStyle === 'solid' ? undefined : dashArray} strokeLinecap={visual.lineStyle === 'dotted' ? 'round' : 'butt'} strokeLinejoin="round" opacity={draft ? '.78' : '.98'} vectorEffect="non-scaling-stroke"/>
    {points.map((point, index) => isKeyRouteNode(points, index) ? <NodeMarker key={index} kind={kind} x={point.x} y={point.y} number={index + 1} showNumber={showPointNumbers} size={(visual.markerSize + (selected ? 2 : 0)) * markerScale} markerScale={markerScale}/> : null)}
  </g>
}

/** Complete key for the eight canonical utility types; labels and line samples share the same config. */
export function UtilityTypeLegend() {
  return <div className="utility-type-legend" aria-label="Условные обозначения коммуникаций">
    {UTILITY_TYPE_OPTIONS.map((visual) => <div className="utility-type-legend-item" key={visual.kind} title={visual.legendLabel}>
      <svg className="utility-type-sample" viewBox="0 0 58 20" aria-hidden="true"><UtilityRouteGraphic kind={visual.kind} points={[{ x: 3, y: 10 }, { x: 55, y: 10 }]} showPointNumbers={false}/></svg>
      <span className="utility-type-label"><strong>{visual.shortLabel}</strong><span>{visual.label}</span></span>
    </div>)}
  </div>
}
