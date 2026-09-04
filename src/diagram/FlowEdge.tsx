import { BaseEdge, EdgeLabelRenderer, getBezierPath, getSmoothStepPath, getStraightPath, useReactFlow, type EdgeProps } from '@xyflow/react'
import { useState } from 'react'
import { useStore } from '../state'

type Point = { x: number; y: number }
type EdgeData = { waypoints: Point[]; routing?: 'smoothstep' | 'straight' | 'bezier'; label: string }
const waypointPointerDowns = new Map<string, number>()

function routed(all: Point[], mode: EdgeData['routing']) {
  if (mode === 'bezier') {
    let path = `M ${all[0].x} ${all[0].y}`
    for (let i = 1; i < all.length - 1; i++) {
      const next = all[i + 1], mid = { x: (all[i].x + next.x) / 2, y: (all[i].y + next.y) / 2 }
      path += ` Q ${all[i].x} ${all[i].y} ${mid.x} ${mid.y}`
    }
    const last = all.at(-1)!
    return `${path} L ${last.x} ${last.y}`
  }
  if (mode === 'smoothstep') {
    let path = `M ${all[0].x} ${all[0].y}`
    for (let i = 1; i < all.length; i++) {
      const a = all[i - 1], b = all[i], mid = (a.x + b.x) / 2
      path += ` L ${mid} ${a.y} L ${mid} ${b.y} L ${b.x} ${b.y}`
    }
    return path
  }
  return all.map((v, i) => `${i ? 'L' : 'M'} ${v.x} ${v.y}`).join(' ')
}

export function FlowEdge(p: EdgeProps) {
  const d = p.data as unknown as EdgeData, points = d.waypoints || [], rf = useReactFlow()
  const [routingMenu, setRoutingMenu] = useState<number | null>(null)
  const all = [{ x: p.sourceX, y: p.sourceY }, ...points, { x: p.targetX, y: p.targetY }]
  let path: string, labelX: number, labelY: number
  if (points.length) {
    path = routed(all, d.routing || 'smoothstep')
    const mid = all[Math.floor(all.length / 2)]; labelX = mid.x; labelY = mid.y
  } else {
    const fn = d.routing === 'straight' ? getStraightPath : d.routing === 'bezier' ? getBezierPath : getSmoothStepPath
    ;[path, labelX, labelY] = fn({ sourceX: p.sourceX, sourceY: p.sourceY, targetX: p.targetX, targetY: p.targetY, sourcePosition: p.sourcePosition, targetPosition: p.targetPosition })
  }
  const update = (fn: (edge: any) => void, history = false) => useStore.getState().mutate(m => {
    const edge = m.edges.find(x => x.id === p.id); if (edge) fn(edge)
  }, history)

  const startDrag = (event: React.PointerEvent<SVGCircleElement>, index: number) => {
    if (event.button !== 0) return
    event.stopPropagation()
    const now = performance.now(), key = `${p.id}:${index}`, previous = waypointPointerDowns.get(key)
    waypointPointerDowns.set(key, now)
    if (previous && now - previous < 500) {
      event.preventDefault()
      removeWaypoint(index)
      waypointPointerDowns.delete(key)
      return
    }
    const handle = event.currentTarget
    const origin = { x: event.clientX, y: event.clientY }
    let next: Point | null = null
    const move = (pointerEvent: PointerEvent) => {
      pointerEvent.preventDefault(); pointerEvent.stopPropagation()
      if (Math.hypot(pointerEvent.clientX - origin.x, pointerEvent.clientY - origin.y) < 3) return
      next = rf.screenToFlowPosition({ x: pointerEvent.clientX, y: pointerEvent.clientY })
      handle.setAttribute('cx', String(next.x)); handle.setAttribute('cy', String(next.y))
    }
    const finish = (pointerEvent: PointerEvent) => {
      if (next) { pointerEvent.preventDefault(); pointerEvent.stopPropagation() }
      window.removeEventListener('pointermove', move, true)
      window.removeEventListener('pointerup', finish, true)
      window.removeEventListener('pointercancel', finish, true)
      if (next) {
        update(edge => { if (edge.waypoints[index]) edge.waypoints[index] = next }, true)
        useStore.getState().select({ kind: 'edge', id: p.id })
      }
    }
    window.addEventListener('pointermove', move, true)
    window.addEventListener('pointerup', finish, true)
    window.addEventListener('pointercancel', finish, true)
  }

  const removeWaypoint = (index: number) => {
    update(edge => edge.waypoints.splice(index, 1), true)
    setRoutingMenu(null)
  }

  return <>
    <BaseEdge id={p.id} path={path} markerEnd={p.markerEnd} style={p.style} interactionWidth={22} />
    <path d={path} className={`waypoint-hitarea${points.length ? ' has-waypoints' : ''}`} />
    {points.map((point, i) => <circle key={i} role="button" tabIndex={0} aria-label={`Move waypoint ${i + 1}`} className={`waypoint-svg-handle nodrag nopan${p.selected ? ' selected' : ''}`} cx={point.x} cy={point.y} r={7}
      onDoubleClick={event => { event.preventDefault(); event.stopPropagation(); removeWaypoint(i) }}
      onContextMenu={event => { event.preventDefault(); event.stopPropagation(); setRoutingMenu(i) }}
      onPointerDown={event => startDrag(event, i)} />)}
    <EdgeLabelRenderer>
      <div data-edge-id={p.id} className={`flow-label nodrag nopan${points.length ? ' has-waypoints' : ''}`} style={{ transform: `translate(-50%,-50%) translate(${labelX}px,${labelY}px)`, color: p.labelStyle?.fill as string }}>{d.label}</div>
      {routingMenu !== null && points[routingMenu] && <div className="waypoint-menu nodrag nopan" style={{ transform: `translate(10px,10px) translate(${points[routingMenu].x}px,${points[routingMenu].y}px)` }}>
        {([['smoothstep', 'Orthogonal'], ['bezier', 'Smooth'], ['straight', 'Straight']] as const).map(([mode, name]) => <button key={mode} className={d.routing === mode ? 'active' : ''} onClick={() => { update(edge => edge.routing = mode, true); setRoutingMenu(null) }}>{name}</button>)}
        <button className="danger" onClick={() => removeWaypoint(routingMenu)}>Delete waypoint</button>
      </div>}
    </EdgeLabelRenderer>
  </>
}
