import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  ArrowRight, Box, Cable, Check, ChevronDown,
  ClipboardList, FolderKanban, House, Map, Plus, ShieldCheck, Trash2,
  X, Undo2,
} from 'lucide-react'
import { objectStorage } from './storage/db'
import { createId } from './types'
import type { BuildingObject, ConfidenceLevel, InformationMethod, Room, RoutePoint, Utility, UtilityKind, UtilityStatus } from './types'
import { getUtilityTypeVisual, UTILITY_TYPE_OPTIONS } from './config/utilityTypes'
import { UtilityRouteGraphic, UtilityTypeLegend } from './components/UtilityVisuals'
import { RoomMapCanvas } from './components/RoomMapCanvas'
import { isPointInRoom, parseRoomOutline } from './geometry/room'

type Section = 'overview' | 'rooms' | 'map' | 'registry'
type Modal = 'object' | 'room' | null
const nav: { id: Section; label: string; icon: typeof House }[] = [
  { id: 'overview', label: 'Обзор объектов', icon: FolderKanban },
  { id: 'rooms', label: 'Помещения', icon: House },
  { id: 'map', label: 'Схема коммуникаций', icon: Map },
  { id: 'registry', label: 'Реестр коммуникаций', icon: ClipboardList },
]
const statusLabels: Record<UtilityStatus, string> = { measured: 'Измерено', documented: 'По документации', approximate: 'Приблизительно', unknown: 'Неизвестно' }
const sectionTitles: Record<Section, string> = { overview: 'Обзор объектов', rooms: 'Помещения', map: 'Схема коммуникаций', registry: 'Реестр коммуникаций' }
const now = () => new Date().toISOString()

function App() {
  const [objects, setObjects] = useState<BuildingObject[]>([])
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState<Section>('overview')
  const [selectedObjectId, setSelectedObjectId] = useState('')
  const [selectedRoomId, setSelectedRoomId] = useState('')
  const [modal, setModal] = useState<Modal>(null)
  const [objectName, setObjectName] = useState('')
  const [objectAddress, setObjectAddress] = useState('')
  const [roomName, setRoomName] = useState('')
  const [roomLength, setRoomLength] = useState('5')
  const [roomWidth, setRoomWidth] = useState('4')
  const [roomCeilingHeight, setRoomCeilingHeight] = useState('')
  const [roomOutlineText, setRoomOutlineText] = useState('')
  const [editing, setEditing] = useState<Utility | null>(null)
  const [selectedRouteId, setSelectedRouteId] = useState<string | undefined>()
  const [utilitySearch, setUtilitySearch] = useState('')
  const [utilityFilter, setUtilityFilter] = useState<UtilityKind | 'all'>('all')
  const [routeDrafting, setRouteDrafting] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [draftKind, setDraftKind] = useState<UtilityKind>('cold_water')
  const [draftElevation, setDraftElevation] = useState('')
  const [draftElevationType, setDraftElevationType] = useState<'height_above_floor' | 'depth_below_surface'>('height_above_floor')
  const [draftStatus, setDraftStatus] = useState<UtilityStatus>('unknown')
  const [draftMethod, setDraftMethod] = useState<InformationMethod>('unspecified')
  const [draftConfidence, setDraftConfidence] = useState<ConfidenceLevel>('unknown')
  const [draftMaterial, setDraftMaterial] = useState('')
  const [draftDiameter, setDraftDiameter] = useState('')
  const [draftComment, setDraftComment] = useState('')
  const [draftPoints, setDraftPoints] = useState<RoutePoint[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    objectStorage.getAll().then((saved) => {
      setObjects(saved)
      setSelectedObjectId(saved[0]?.id ?? '')
      setSelectedRoomId(saved[0]?.rooms[0]?.id ?? '')
    }).catch(() => setError('Не удалось открыть локальную базу данных. Проверьте, что браузер разрешает хранение данных.')).finally(() => setLoading(false))
  }, [])

  const selectedObject = objects.find((item) => item.id === selectedObjectId)
  const rooms = selectedObject?.rooms ?? []
  const selectedRoom = rooms.find((item) => item.id === selectedRoomId) ?? rooms[0]
  const allUtilities = useMemo(() => objects.flatMap((object) => object.rooms.flatMap((room) => room.utilities.map((utility) => ({ ...utility, objectId: object.id, objectName: object.name, roomName: room.name })))), [objects])
  const filteredRoomUtilities = selectedRoom?.utilities.filter((utility) =>
    (utilityFilter === 'all' || utility.kind === utilityFilter) && utility.name.toLocaleLowerCase('ru').includes(utilitySearch.toLocaleLowerCase('ru')),
  ) ?? []

  const persist = async (updated: BuildingObject) => {
    await objectStorage.put(updated)
    setObjects((current) => current.some((item) => item.id === updated.id) ? current.map((item) => item.id === updated.id ? updated : item) : [...current, updated])
  }
  const updateSelected = async (roomsNext: Room[]) => {
    if (!selectedObject) return
    const updated = { ...selectedObject, rooms: roomsNext, updatedAt: now() }
    await persist(updated)
  }

  const createObject = async (event: FormEvent) => {
    event.preventDefault()
    if (!objectName.trim()) { setError('Введите название объекта.'); return }
    const timestamp = now()
    const object: BuildingObject = { id: createId(), name: objectName.trim(), address: objectAddress.trim() || undefined, rooms: [], createdAt: timestamp, updatedAt: timestamp }
    try { await persist(object); setSelectedObjectId(object.id); setSelectedRoomId(''); setActive('rooms'); setModal(null); setObjectName(''); setObjectAddress(''); setError('') }
    catch { setError('Не удалось сохранить объект. Проверьте доступное место в браузере.') }
  }

  const createRoom = async (event: FormEvent) => {
    event.preventDefault()
    const lengthM = Number(roomLength), widthM = Number(roomWidth)
    if (!selectedObject) { setError('Сначала выберите или создайте объект.'); return }
    if (!roomName.trim()) { setError('Введите название помещения.'); return }
    if (!Number.isFinite(lengthM) || !Number.isFinite(widthM) || lengthM <= 0 || widthM <= 0 || lengthM > 100 || widthM > 100) {
      setError('Длина и ширина должны быть больше 0 и не превышать 100 м.'); return
    }
    const ceilingHeightM = roomCeilingHeight.trim() ? Number(roomCeilingHeight) : undefined
    if (ceilingHeightM !== undefined && (!Number.isFinite(ceilingHeightM) || ceilingHeightM <= 0 || ceilingHeightM > 20)) {
      setError('Высота потолка должна быть больше 0 и не превышать 20 м.'); return
    }
    let outline: RoutePoint[] | undefined
    try { outline = parseRoomOutline(roomOutlineText, lengthM, widthM) }
    catch (outlineError) { setError(outlineError instanceof Error ? outlineError.message : 'Проверьте контур комнаты.'); return }
    const room: Room = { id: createId(), name: roomName.trim(), lengthM, widthM, ceilingHeightM, outline, utilities: [] }
    try { await updateSelected([...selectedObject.rooms, room]); setSelectedRoomId(room.id); setActive('map'); setModal(null); setRoomName(''); setRoomCeilingHeight(''); setRoomOutlineText(''); setError('') }
    catch { setError('Не удалось сохранить помещение.') }
  }

  const startNewUtility = () => {
    setRouteDrafting(true)
    setEditing(null); setDraftName(''); setDraftKind('cold_water'); setDraftElevation(''); setDraftElevationType('height_above_floor'); setDraftStatus('unknown'); setDraftMaterial(''); setDraftDiameter(''); setDraftComment('')
    setDraftMethod('unspecified'); setDraftConfidence('unknown'); setDraftPoints([]); setSelectedRouteId(undefined); setActive('map')
  }
  const editUtility = (utility: Utility) => {
    setRouteDrafting(false)
    setEditing(utility); setDraftName(utility.name); setDraftKind(utility.kind); setDraftElevation(utility.elevationM?.toString() ?? ''); setDraftElevationType(utility.elevationType ?? 'height_above_floor'); setDraftStatus(utility.status ?? 'unknown')
    setDraftMaterial(utility.parameters.material ?? ''); setDraftDiameter(utility.parameters.diameterMm?.toString() ?? '')
    setDraftComment(utility.comment ?? ''); setDraftMethod(utility.informationMethod); setDraftConfidence(utility.confidence); setDraftPoints(utility.route.map((point) => ({ ...point }))); setSelectedRouteId(utility.id); setActive('map')
  }
  const addPoint = (coordinate: RoutePoint) => {
    if (!selectedRoom) return
    if (!isPointInRoom(coordinate, selectedRoom)) { setError('Точка должна находиться внутри контура комнаты.'); return }
    const point = { x: Math.min(selectedRoom.lengthM, Math.max(0, coordinate.x)), y: Math.min(selectedRoom.widthM, Math.max(0, coordinate.y)) }
    const previous = draftPoints.at(-1)
    if (previous && Math.hypot(previous.x - point.x, previous.y - point.y) < 0.01) {
      setError('Поставьте следующую точку в другом месте плана.')
      return
    }
    setError('')
    setDraftPoints((points) => [...points, point])
  }
  const changeDraftPoint = (index: number, axis: 'x' | 'y', value: number) => {
    if (!selectedRoom || !Number.isFinite(value)) return
    const maximum = axis === 'x' ? selectedRoom.lengthM : selectedRoom.widthM
    if (value < 0 || value > maximum) { setError(`Координата ${axis.toUpperCase()} должна быть от 0 до ${maximum} м.`); return }
    const current = draftPoints[index]
    if (current && !isPointInRoom({ ...current, [axis]: value }, selectedRoom)) { setError('Точка должна оставаться внутри контура комнаты.'); return }
    setError('')
    setDraftPoints((points) => points.map((point, pointIndex) => pointIndex === index ? { ...point, [axis]: value } : point))
  }
  const moveDraftPoint = (index: number, point: RoutePoint) => {
    if (!selectedRoom || !isPointInRoom(point, selectedRoom)) return
    setDraftPoints((points) => points.map((current, pointIndex) => pointIndex === index ? point : current))
  }
  const insertDraftPoint = (index: number, point: RoutePoint) => {
    if (!selectedRoom || !isPointInRoom(point, selectedRoom)) return
    setDraftPoints((points) => [...points.slice(0, index + 1), point, ...points.slice(index + 1)])
  }
  const removeDraftPoint = (index: number) => {
    if (draftPoints.length <= 2) { setError('Маршрут должен содержать минимум две точки.'); return }
    setDraftPoints((points) => points.filter((_, pointIndex) => pointIndex !== index))
    setError('')
  }
  const saveUtility = async (event: FormEvent) => {
    event.preventDefault()
    if (!selectedObject || !selectedRoom) { setError('Выберите объект и помещение для коммуникации.'); return }
    if (!draftName.trim()) { setError('Введите название коммуникации.'); return }
    if (draftPoints.length < 2) { setError('Отметьте на плане минимум две точки маршрута.'); return }
    if (draftPoints.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y) || !isPointInRoom(point, selectedRoom))) {
      setError('Точки маршрута должны находиться в пределах помещения.'); return
    }
    const elevationM = draftElevation === '' ? undefined : Number(draftElevation)
    const diameterMm = draftDiameter === '' ? undefined : Number(draftDiameter)
    if (elevationM !== undefined && (!Number.isFinite(elevationM) || elevationM < 0 || elevationM > 100)) { setError('Высота или глубина должна быть числом от 0 до 100 м.'); return }
    if (elevationM !== undefined && draftElevationType === 'height_above_floor' && selectedRoom.ceilingHeightM !== undefined && elevationM > selectedRoom.ceilingHeightM) { setError(`Высота прокладки не может превышать высоту потолка (${selectedRoom.ceilingHeightM} м).`); return }
    if (diameterMm !== undefined && (!Number.isFinite(diameterMm) || diameterMm <= 0 || diameterMm > 10000)) { setError('Диаметр должен быть числом больше 0 и не превышать 10 000 мм.'); return }
    const timestamp = now()
    const utility: Utility = {
      id: editing?.id ?? createId(), name: draftName.trim(), kind: draftKind, roomId: selectedRoom.id,
      route: draftPoints, elevationM,
      elevationType: elevationM !== undefined ? draftElevationType : undefined,
      parameters: { material: draftMaterial.trim() || undefined, diameterMm },
      status: draftStatus,
      recordedAt: editing?.recordedAt ?? timestamp, informationMethod: draftMethod, comment: draftComment.trim() || undefined,
      photos: editing?.photos ?? [], confidence: draftConfidence, updatedAt: timestamp,
    }
    const utilities = editing ? selectedRoom.utilities.map((item) => item.id === editing.id ? utility : item) : [...selectedRoom.utilities, utility]
    try {
      await updateSelected(selectedObject.rooms.map((room) => room.id === selectedRoom.id ? { ...room, utilities } : room))
      setEditing(null); setDraftingAndClear(); setError('')
    } catch { setError('Не удалось сохранить коммуникацию.') }
  }
  const setDraftingAndClear = () => { setRouteDrafting(false); setDraftPoints([]); setSelectedRouteId(undefined) }
  const deleteUtility = async (utility: Utility) => {
    if (!selectedObject) return
    if (!window.confirm(`Удалить коммуникацию «${utility.name}»?`)) return
    try {
      await updateSelected(selectedObject.rooms.map((room) => room.id === utility.roomId ? { ...room, utilities: room.utilities.filter((item) => item.id !== utility.id) } : room))
      if (editing?.id === utility.id) { setEditing(null); setDraftingAndClear() }
      setError('')
    } catch { setError('Не удалось удалить коммуникацию.') }
  }

  const pageSubtitle: Record<Section, string> = {
    overview: 'Цифровые паспорта инженерных систем в одном месте.',
    rooms: 'Планы комнат и привязанные к ним инженерные сети.',
    map: 'Отмечайте инженерные трассы прямо на плане помещения.',
    registry: 'Все зарегистрированные коммуникации и их параметры.',
  }
  const makeScreen = () => {
    if (loading) return <div className="empty-state loading-state" role="status" aria-live="polite"><div className="empty-icon"><Box size={23} /></div><h2>Загружаем локальные данные…</h2><p>Читаем объекты и планы этого устройства.</p></div>
    if (active === 'overview') return <>
      <section className="welcome-panel"><div className="welcome-copy"><div className="welcome-tag">CASE-IN · ИНЖЕНЕРНЫЙ ПАСПОРТ</div><h2>Знайте, что скрыто<br />за каждой стеной.</h2><p>Запишите положение труб и кабелей по замерам или документации. Перед сверлением сверьте точку с зарегистрированными маршрутами: приложение само не обнаруживает скрытые коммуникации.</p><button className="button button-light" onClick={() => { setModal('object'); setError('') }}><Plus size={17} />Создать объект <ArrowRight size={16} /></button><div className="welcome-footnote"><ShieldCheck size={15} />Данные сохраняются только на этом устройстве</div></div><div className="welcome-art"><div className="art-grid"/><svg viewBox="0 0 440 310" className="plan-drawing" aria-hidden="true"><path d="M65 42h300v220H65zM65 154h135M200 42v112m0 0v108m0-108h165" fill="none" stroke="currentColor" strokeWidth="2"/><path d="M95 42v48h105v42h80v22h40v72H200v-30h-55v-42H65" fill="none" stroke="#a5ed9d" strokeWidth="3" strokeLinejoin="round"/><path d="M365 217h-48v-63h-53v-49h-64V58h-55V42" fill="none" stroke="#78c8ee" strokeWidth="3" strokeLinejoin="round"/></svg><div className="art-note">СХЕМА ИНЖЕНЕРНЫХ СЕТЕЙ</div></div></section>
      {objects.length ? <><div className="section-heading"><div><h2>Ваши объекты</h2><p>{objects.length} {objects.length === 1 ? 'объект' : 'объектов'}</p></div><button className="button button-secondary" onClick={() => setModal('object')}><Plus size={16}/>Добавить</button></div><div className="object-grid">{objects.map((object) => <button key={object.id} className={`object-card ${object.id === selectedObjectId ? 'selected' : ''}`} onClick={() => { setSelectedObjectId(object.id); setSelectedRoomId(object.rooms[0]?.id ?? ''); setActive('rooms') }}><span className="overview-icon icon-green"><Box size={18}/></span><span className="object-copy"><strong>{object.name}</strong><small>{object.address || 'Адрес не указан'}</small></span><span className="object-meta">{object.rooms.length} пом.</span><ArrowRight size={16}/></button>)}</div></> : <div className="empty-state"><div className="empty-icon"><FolderKanban size={23}/></div><h2>Здесь пока нет объектов</h2><p>Создайте объект, чтобы добавить помещения и нанести на схему инженерные коммуникации.</p><button className="button button-primary" onClick={() => setModal('object')}><Plus size={16}/>Создать первый объект</button></div>}
    </>
    if (active === 'rooms') return <>
      {!objects.length ? <EmptyPrompt title="Сначала создайте объект" description="Помещения относятся к объектам. Создайте объект, чтобы продолжить." button="Создать объект" onClick={() => setModal('object')}/> : <>
        <div className="toolbar"><label className="field-inline">Объект<select value={selectedObjectId} onChange={(event) => { setSelectedObjectId(event.target.value); const object = objects.find((item) => item.id === event.target.value); setSelectedRoomId(object?.rooms[0]?.id ?? '') }}>{objects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><button className="button button-primary" onClick={() => setModal('room')}><Plus size={16}/>Добавить помещение</button></div>
        {rooms.length ? <div className="room-grid">{rooms.map((room) => <button key={room.id} className="room-card" onClick={() => { setSelectedRoomId(room.id); setActive('map') }}><span className="overview-icon icon-sand"><House size={18}/></span><span className="object-copy"><strong>{room.name}</strong><small>{room.lengthM} × {room.widthM} м · {room.lengthM * room.widthM} м²</small></span><span className="object-meta">{room.utilities.length} сет.</span><ArrowRight size={16}/></button>)}</div> : <div className="empty-state compact"><div className="empty-icon"><House size={23}/></div><h2>Добавьте первое помещение</h2><p>Укажите название, длину и ширину — приложение подготовит масштабируемый план.</p><button className="button button-primary" onClick={() => setModal('room')}><Plus size={16}/>Создать помещение</button></div>}
      </>}
    </>
    if (active === 'registry') return allUtilities.length ? <><div className="toolbar"><label className="field-inline">Объект<select value={selectedObjectId} onChange={(event) => setSelectedObjectId(event.target.value)}>{objects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><span className="record-count">{allUtilities.length} записей</span></div><div className="registry-list">{allUtilities.filter((utility) => !selectedObject || utility.objectId === selectedObject.id).map((utility) => <button className="registry-row" key={utility.id} onClick={() => { setSelectedObjectId(utility.objectId); setSelectedRoomId(utility.roomId); editUtility(utility) }}><i className="route-swatch" style={{ background: getUtilityTypeVisual(utility.kind).color }}/><span className="registry-main"><strong>{utility.name}</strong><small>{utility.objectName} / {utility.roomName}</small></span><span className="registry-kind">{getUtilityTypeVisual(utility.kind).label} · {statusLabels[utility.status ?? 'unknown']}</span><span className="registry-points">{utility.route.length} точки</span><ArrowRight size={16}/></button>)}</div></> : <EmptyPrompt title="Реестр пока пуст" description="Добавленные на план маршруты появятся здесь вместе со своими параметрами." button={rooms.length ? 'Открыть схему' : 'Сначала добавьте помещение'} onClick={() => setActive(rooms.length ? 'map' : 'rooms')}/> 
    if (!objects.length) return <EmptyPrompt title="Создайте объект для начала работы" description="Объект объединяет помещения и все нанесённые в них коммуникации." button="Создать объект" onClick={() => setModal('object')}/>
    return <>
      <div className="toolbar map-toolbar"><label className="field-inline">Объект<select value={selectedObjectId} onChange={(event) => { const object = objects.find((item) => item.id === event.target.value); setSelectedObjectId(event.target.value); setSelectedRoomId(object?.rooms[0]?.id ?? ''); setEditing(null); setDraftingAndClear() }}>{objects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="field-inline">Помещение<select value={selectedRoom?.id ?? ''} onChange={(event) => { setSelectedRoomId(event.target.value); setEditing(null); setDraftingAndClear() }}>{rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}</select></label>{selectedRoom && <button className="button button-primary" onClick={startNewUtility}><Plus size={16}/>Новая коммуникация</button>}</div>
      {!selectedRoom ? <div className="empty-state compact"><div className="empty-icon"><House size={23}/></div><h2>В этом объекте нет помещений</h2><p>Создайте помещение, чтобы открыть его план и отметить трассы.</p><button className="button button-primary" onClick={() => setModal('room')}><Plus size={16}/>Создать помещение</button></div> : <div className={`map-layout ${editing || routeDrafting ? 'has-editor' : ''}`}>
        <section className="map-card"><div className="map-card-head"><div><h2>{selectedRoom.name}</h2><p>{selectedRoom.lengthM} × {selectedRoom.widthM} м{selectedRoom.ceilingHeightM ? ` · потолок ${selectedRoom.ceilingHeightM} м` : ''} · начало координат в левом нижнем углу</p></div><span className="scale-chip">{routeDrafting ? 'Щёлкайте внутри стен, чтобы поставить узлы' : editing ? 'Перетаскивайте узлы или вводите координаты' : 'Выберите маршрут или включите редактирование'}</span></div>{selectedRoom.utilities.length === 0 && !routeDrafting && <div className="map-empty-note">Коммуникации не зарегистрированы. Схема показывает только данные, внесённые пользователем.</div>}<div className="map-filterbar"><label>Поиск маршрута<input type="search" value={utilitySearch} onChange={(event) => setUtilitySearch(event.target.value)} placeholder="Название…"/></label><label>Тип<select value={utilityFilter} onChange={(event) => setUtilityFilter(event.target.value as UtilityKind | 'all')}><option value="all">Все типы</option>{UTILITY_TYPE_OPTIONS.map((kind) => <option key={kind.kind} value={kind.kind}>{kind.label}</option>)}</select></label><div className="map-modes" aria-label="Режим редактора"><button className={!editing && !routeDrafting ? 'active' : ''} onClick={() => { setEditing(null); setRouteDrafting(false); setDraftPoints([]) }}>Выбрать</button><button className={routeDrafting ? 'active' : ''} onClick={startNewUtility}>Добавить маршрут</button><button className={editing ? 'active' : ''} disabled={!selectedRouteId} onClick={() => { const selected = selectedRoom.utilities.find((utility) => utility.id === selectedRouteId); if (selected) editUtility(selected) }}>Редактировать</button></div></div>{selectedRoom.utilities.length > 0 && filteredRoomUtilities.length === 0 && <div className="map-filter-empty">По заданным условиям маршруты не найдены.</div>}<RoomMapCanvas room={selectedRoom} utilities={filteredRoomUtilities} draftPoints={draftPoints} draftKind={draftKind} selectedUtilityId={selectedRouteId} isPlacingPoints={routeDrafting} isEditing={Boolean(editing || routeDrafting)} onAddPoint={addPoint} onMovePoint={moveDraftPoint} onInsertPoint={insertDraftPoint} onDeletePoint={removeDraftPoint} onSelectUtility={(utility) => { if (editing || routeDrafting) editUtility(utility); else setSelectedRouteId(utility.id) }}/><UtilityTypeLegend/><div className="map-legend">{filteredRoomUtilities.map((utility) => { const visual = getUtilityTypeVisual(utility.kind); return <button className={`route-legend-item ${selectedRouteId === utility.id ? 'active' : ''}`} key={utility.id} onClick={() => { if (editing || routeDrafting) editUtility(utility); else setSelectedRouteId(utility.id) }} title={`${utility.name} · ${visual.label}`}><svg className="route-legend-sample" viewBox="0 0 58 20" aria-hidden="true"><UtilityRouteGraphic kind={utility.kind} points={[{ x: 3, y: 10 }, { x: 55, y: 10 }]} showPointNumbers={false}/></svg><span className="route-legend-copy"><strong>{utility.name}</strong><small>{visual.shortLabel} · {visual.label}</small></span></button>})}{draftPoints.length > 0 && <span className="point-readout">{draftPoints.length} узлов · последняя точка {draftPoints.at(-1)?.x.toFixed(2)} м, {draftPoints.at(-1)?.y.toFixed(2)} м</span>}</div>{selectedRouteId && !editing && !routeDrafting && (() => { const route = selectedRoom.utilities.find((utility) => utility.id === selectedRouteId); if (!route) return null; const visual = getUtilityTypeVisual(route.kind); return <div className="selected-route-card"><div><strong>{route.name}</strong><span>{visual.label} · {statusLabels[route.status ?? 'unknown']} · {route.route.length} точки</span></div><button className="button button-secondary" onClick={() => editUtility(route)}>Редактировать маршрут</button></div>})()}</section>
        {(editing || routeDrafting) && <section className="utility-editor"><div className="editor-head"><div><span className="card-kicker">{editing ? 'РЕДАКТИРОВАНИЕ' : 'НОВАЯ ЗАПИСЬ'}</span><h2>{editing ? 'Карточка коммуникации' : 'Новая коммуникация'}</h2></div><button className="icon-button" onClick={() => { setEditing(null); setDraftingAndClear() }} aria-label="Отменить и закрыть"><X size={17}/></button></div><form onSubmit={saveUtility}><label>Название<input value={draftName} onChange={(event) => setDraftName(event.target.value)} placeholder="Например, ХВС к кухне" required/></label><label>Тип<select value={draftKind} onChange={(event) => setDraftKind(event.target.value as UtilityKind)}>{UTILITY_TYPE_OPTIONS.map((kind) => <option key={kind.kind} value={kind.kind}>{kind.label}</option>)}</select></label><div className="route-points-editor"><div className="route-points-heading"><strong>Узлы маршрута</strong><span>координаты в метрах</span></div>{draftPoints.map((point, index) => <div className="route-point-row" key={`p-${index}`}><b>{index + 1}</b><label>X<input aria-label={`Точка ${index + 1}, X, метров`} type="number" min="0" max={selectedRoom.lengthM} step="any" value={point.x}  onChange={(event) => changeDraftPoint(index, 'x', event.target.value === '' ? NaN : Number(event.target.value))}/></label><label>Y<input aria-label={`Точка ${index + 1}, Y, метров`} type="number" min="0" max={selectedRoom.widthM} step="any" value={point.y}  onChange={(event) => changeDraftPoint(index, 'y', event.target.value === '' ? NaN : Number(event.target.value))}/></label>{index < draftPoints.length - 1 && <button type="button" title="Добавить узел посередине сегмента" aria-label={`Добавить точку после ${index + 1}`} onClick={() => { const next = draftPoints[index + 1]; insertDraftPoint(index, { x: (point.x + next.x) / 2, y: (point.y + next.y) / 2 }) }}>+</button>}<button type="button" title={draftPoints.length <= 2 ? 'Нужно минимум две точки' : 'Удалить точку'} aria-label={`Удалить точку ${index + 1}`} disabled={draftPoints.length <= 2} onClick={() => removeDraftPoint(index)}>×</button></div>)}</div><div className="form-two"><label>Тип отметки<select value={draftElevationType} onChange={(event) => setDraftElevationType(event.target.value as 'height_above_floor' | 'depth_below_surface')}><option value="height_above_floor">Высота от пола</option><option value="depth_below_surface">Глубина от поверхности</option></select></label><label>{draftElevationType === 'height_above_floor' ? `Высота от пола, м${selectedRoom.ceilingHeightM ? ` · потолок ${selectedRoom.ceilingHeightM} м` : ''}` : 'Глубина от поверхности, м'}<input type="number" min="0" max={draftElevationType === 'height_above_floor' ? selectedRoom.ceilingHeightM ?? 100 : 100} step="0.01" value={draftElevation} onChange={(event) => setDraftElevation(event.target.value)} placeholder="Неизвестно"/></label><label>Диаметр, мм<input type="number" min="0.1" max="10000" step="0.1" value={draftDiameter} onChange={(event) => setDraftDiameter(event.target.value)} placeholder="Необязательно"/></label></div><label>Материал<input value={draftMaterial} onChange={(event) => setDraftMaterial(event.target.value)} placeholder="Например, PEX / медь"/></label><label>Статус достоверности<select value={draftStatus} onChange={(event) => setDraftStatus(event.target.value as UtilityStatus)}><option value="measured">Измерено</option><option value="documented">По документации</option><option value="approximate">Приблизительно</option><option value="unknown">Неизвестно</option></select></label><div className="form-two"><label>Метод фиксации<select value={draftMethod} onChange={(event) => setDraftMethod(event.target.value as InformationMethod)}><option value="unspecified">Не указан</option><option value="measured">Измерение на месте</option><option value="as_built">Исполнительная схема</option><option value="photo_estimate">Оценка по фото</option><option value="detector">Детектор</option><option value="design_document">Проектная документация</option><option value="other">Другое</option></select></label><label>Достоверность<select value={draftConfidence} onChange={(event) => setDraftConfidence(event.target.value as ConfidenceLevel)}><option value="high">Высокая</option><option value="medium">Средняя</option><option value="low">Низкая</option><option value="unknown">Неизвестна</option></select></label></div><label>Комментарий<textarea rows={2} value={draftComment} onChange={(event) => setDraftComment(event.target.value)} placeholder="Дополнительные сведения"/></label><div className="points-status"><span>{draftPoints.length >= 2 ? <Check size={15}/> : <Map size={15}/>}</span>{draftPoints.length < 2 ? `На схеме нужно отметить ещё ${2 - draftPoints.length} ${draftPoints.length === 1 ? 'точку' : 'точки'}` : `Маршрут из ${draftPoints.length} точек · ${draftPoints.at(-1)?.x.toFixed(2)} × ${draftPoints.at(-1)?.y.toFixed(2)} м`}</div><div className="editor-actions"><button type="button" className="button button-quiet" disabled={!draftPoints.length} onClick={() => setDraftPoints((points) => points.slice(0, -1))}><Undo2 size={15}/>Отменить точку</button><button className="button button-primary" disabled={!draftName.trim() || draftPoints.length < 2}><Check size={15}/>{editing ? 'Сохранить изменения' : 'Сохранить маршрут'}</button></div>{editing && <button type="button" className="delete-link" onClick={() => deleteUtility(editing)}><Trash2 size={14}/>Удалить коммуникацию</button>}</form></section>}
      </div>}
    </>
  }

  return <div className="app-frame"><aside className="sidebar"><div className="brand-lockup"><div className="brand-mark"><Cable size={21}/></div><div className="brand-name">цифровой<span>след</span><small>ИНЖЕНЕРНЫЙ ПАСПОРТ</small></div></div><div className="workspace-switcher"><div className="workspace-avatar">К</div><div className="workspace-copy"><span>Рабочее пространство</span><strong>{selectedObject?.name ?? 'Мой проект'}</strong></div><ChevronDown size={15}/></div><div className="nav-caption">РАБОЧАЯ ОБЛАСТЬ</div><nav className="primary-nav">{nav.map(({ id, label, icon: Icon }) => <button className={`nav-item ${active === id ? 'active' : ''}`} key={id} onClick={() => setActive(id)}><Icon size={17}/><span>{label}</span></button>)}</nav><div className="sidebar-divider"/><div className="nav-caption">ТЕКУЩИЙ ОБЪЕКТ</div>{selectedObject ? <div className="sidebar-object"><Box size={15}/><span>{selectedObject.name}</span></div> : <div className="sidebar-hint">Создайте объект, чтобы начать</div>}<div className="sidebar-bottom"><div className="local-status"><span className="status-dot"/>Данные хранятся на этом устройстве</div><div className="profile-row"><div className="profile-avatar">И</div><div><strong>Инженер</strong><span>Локальный профиль</span></div></div></div></aside>
    <main className="main-area"><header className="topbar"><div className="breadcrumbs"><span>Рабочая область</span><span className="crumb-separator">/</span><strong>{sectionTitles[active]}</strong></div><div className="topbar-actions"><div className="local-pill"><span className="status-dot"/>Локальный режим</div><div className="top-avatar">И</div></div></header><div className="content-wrap"><div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-mark"/>CASE-IN · ЦИФРОВОЙ СЛЕД</div><h1>{sectionTitles[active]}</h1><p>{pageSubtitle[active]}</p></div>{active !== 'map' && <button className="button button-primary" onClick={() => active === 'rooms' && selectedObject ? setModal('room') : setModal('object')}><Plus size={17}/>{active === 'rooms' && selectedObject ? 'Добавить помещение' : 'Создать объект'}</button>}</div>{error && <div className="error-banner">{error}<button onClick={() => setError('')} aria-label="Закрыть"><X size={15}/></button></div>}{makeScreen()}<footer className="page-footer"><span>ЦИФРОВОЙ СЛЕД <b>·</b> CASE-IN</span><span>Автосохранение в IndexedDB</span></footer></div></main>
    {modal && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(null) }}><section className="modal" role="dialog" aria-modal="true"><button className="modal-close" onClick={() => setModal(null)} aria-label="Закрыть"><X size={18}/></button><div className="modal-icon">{modal === 'object' ? <Box size={21}/> : <House size={21}/>}</div><span className="card-kicker">{modal === 'object' ? 'НОВЫЙ ПАСПОРТ' : 'НОВОЕ ПОМЕЩЕНИЕ'}</span><h2>{modal === 'object' ? 'Создать объект' : 'Добавить помещение'}</h2><p>{modal === 'object' ? 'Создайте паспорт здания, квартиры или офиса.' : `Помещение будет добавлено в объект «${selectedObject?.name ?? ''}».`}</p><form onSubmit={modal === 'object' ? createObject : createRoom}>{error && <div className="modal-error">{error}</div>}<label>{modal === 'object' ? 'Название объекта' : 'Название помещения'}<input autoFocus value={modal === 'object' ? objectName : roomName} onChange={(event) => modal === 'object' ? setObjectName(event.target.value) : setRoomName(event.target.value)} placeholder={modal === 'object' ? 'Например, Квартира на Лесной' : 'Например, Кухня'} required/></label>{modal === 'object' ? <label>Адрес <span className="optional">необязательно</span><input value={objectAddress} onChange={(event) => setObjectAddress(event.target.value)} placeholder="Город, улица, дом"/></label> : <><div className="form-two"><label>Длина, м<input type="number" min="0.1" max="100" step="0.01" value={roomLength} onChange={(event) => setRoomLength(event.target.value)} required/></label><label>Ширина, м<input type="number" min="0.1" max="100" step="0.01" value={roomWidth} onChange={(event) => setRoomWidth(event.target.value)} required/></label></div><label>Высота потолка, м <span className="optional">необязательно, максимум 20 м</span><input type="number" min="0.1" max="20" step="0.01" value={roomCeilingHeight} onChange={(event) => setRoomCeilingHeight(event.target.value)} placeholder="Неизвестна"/></label><label>Контур стен <span className="optional">необязательно, вершины по порядку</span><textarea rows={2} value={roomOutlineText} onChange={(event) => setRoomOutlineText(event.target.value)} placeholder="0,0; 5,0; 5,3; 4,4; 0,4"/><small className="outline-help">X,Y в метрах от левого нижнего угла. Пустое поле — прямоугольная комната.</small></label></>}<div className="modal-actions"><button type="button" className="button button-quiet" onClick={() => setModal(null)}>Отмена</button><button type="submit" className="button button-primary"><Plus size={16}/>{modal === 'object' ? 'Создать объект' : 'Создать помещение'}</button></div></form></section></div>}
  </div>
}

function EmptyPrompt({ title, description, button, onClick }: { title: string; description: string; button: string; onClick: () => void }) {
  return <div className="empty-state"><div className="empty-icon"><Box size={23}/></div><h2>{title}</h2><p>{description}</p><button className="button button-primary" onClick={onClick}><Plus size={16}/>{button}</button></div>
}

export default App
