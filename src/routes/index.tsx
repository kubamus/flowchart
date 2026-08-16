import { createFileRoute } from "@tanstack/react-router";
import type {
	ChangeEvent,
	CSSProperties,
	MouseEvent as ReactMouseEvent,
	PointerEvent as ReactPointerEvent,
} from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
	EdgeLayer,
	MiniMap,
	NodeView,
} from "../components/editor/DiagramCanvas";
import {
	CommandPalette,
	ContextMenu,
	LayersPanel,
	PropertiesPanel,
	ToolButton,
} from "../components/editor/EditorPanels";
import { Icon, type IconName } from "../components/Icon";
import {
	COLOR_META,
	GRID_SIZE,
	INITIAL_EDGES,
	INITIAL_NODES,
	nodeIcon,
	nodeTypeLabel,
	TOOL_ITEMS,
	WORLD_HEIGHT,
	WORLD_WIDTH,
} from "../features/editor/data";
import {
	containsRect,
	findContainingGroup,
	getBounds,
	getDescendantIds,
	getEdgeGeometry,
	getNodeCenter,
	getNodeRect,
	getVisibleNodes,
	getWorldPoint,
	hasOverlappingGroups,
	rectanglesOverlap,
	syncGroupMembership,
} from "../features/editor/geometry";
import {
	escapeXml,
	formatNumber,
	makeId,
	snap,
} from "../features/editor/helpers";
import type {
	ClipboardData,
	ConnectionState,
	ContextMenuState,
	DiagramEdge,
	DiagramNode,
	EdgeStyle,
	GuideState,
	InteractionState,
	NodeType,
	Point,
	SelectionBoxState,
	Theme,
	Tool,
} from "../features/editor/types";
import { isDiagramFile } from "../features/editor/validation";
import { useCanvasViewport } from "../hooks/useCanvasViewport";
import { useDiagramHistory } from "../hooks/useDiagramHistory";
import { useEditorHotkeys } from "../hooks/useEditorHotkeys";

export const Route = createFileRoute("/")({ component: FlwchrtEditor });

function FlwchrtEditor() {
	const [selectedIds, setSelectedIds] = useState<string[]>(["node-payment"]);
	const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
	const [tool, setTool] = useState<Tool>("select");
	const [spacePressed, setSpacePressed] = useState(false);
	const [edgeStyle, setEdgeStyle] = useState<EdgeStyle>("elbow");
	const [theme, setTheme] = useState<Theme>("light");
	const [showGrid, setShowGrid] = useState(true);
	const [snapToGrid, setSnapToGrid] = useState(true);
	const [selectionBox, setSelectionBox] = useState<SelectionBoxState | null>(
		null,
	);
	const [guides, setGuides] = useState<GuideState>({});
	const [connection, setConnection] = useState<ConnectionState | null>(null);
	const [noteCursor, setNoteCursor] = useState<Point | null>(null);
	const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
	const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
	const [commandOpen, setCommandOpen] = useState(false);
	const [commandQuery, setCommandQuery] = useState("");
	const [commandIndex, setCommandIndex] = useState(0);
	const [toast, setToast] = useState<string | null>(null);
	const [inspectorQuery, setInspectorQuery] = useState("");
	const [projectName, setProjectName] = useState("Flwchrt");
	const [exportOpen, setExportOpen] = useState(false);

	const fileInputRef = useRef<HTMLInputElement | null>(null);
	const interactionRef = useRef<InteractionState | null>(null);
	const clipboardRef = useRef<ClipboardData | null>(null);
	const originalTitleRef = useRef<string | null>(null);

	const showToast = useCallback((message: string) => {
		setToast(message);
		window.setTimeout(() => setToast(null), 2100);
	}, []);

	const {
		nodes,
		edges,
		nodesRef,
		edgesRef,
		recordSnapshot,
		updateNodesLive,
		undo,
		redo,
		saveState,
	} = useDiagramHistory({
		onInvalidSnapshot: () => showToast("Groups cannot overlap"),
	});
	const {
		canvasPosition,
		fitView,
		handleMinimapClick,
		minimapViewport,
		resetZoom,
		updateView,
		view,
		viewRef,
		viewportRef,
		zoomCanvas,
	} = useCanvasViewport({ nodes, onFit: showToast });

	const updateNodePatch = useCallback(
		(nodeId: string, patch: Partial<DiagramNode>) => {
			const nextNodes = nodesRef.current.map((node) =>
				node.id === nodeId ? { ...node, ...patch } : node,
			);
			recordSnapshot(nextNodes, edgesRef.current);
		},
		[recordSnapshot, nodesRef, edgesRef],
	);

	useEffect(() => {
		const handlePointerDown = () => {
			setContextMenu(null);
			setExportOpen(false);
		};
		document.addEventListener("pointerdown", handlePointerDown);
		return () => document.removeEventListener("pointerdown", handlePointerDown);
	}, []);

	useEffect(() => {
		if (tool !== "note" && tool !== "text") setNoteCursor(null);
	}, [tool]);

	useEffect(() => {
		if (commandOpen || commandQuery) setCommandIndex(0);
	}, [commandOpen, commandQuery]);

	const visibleNodes = useMemo(() => getVisibleNodes(nodes), [nodes]);
	const visibleNodeIds = useMemo(
		() => new Set(visibleNodes.map((node) => node.id)),
		[visibleNodes],
	);
	const nodeMap = useMemo(
		() => new Map(nodes.map((node) => [node.id, node])),
		[nodes],
	);
	const selectedNodes = useMemo(
		() => nodes.filter((node) => selectedIds.includes(node.id)),
		[nodes, selectedIds],
	);
	const selectedNode =
		selectedNodes.length === 1 ? selectedNodes[0] : undefined;
	const selectedEdge = selectedEdgeId
		? edges.find((edge) => edge.id === selectedEdgeId)
		: undefined;
	const filteredLayerNodes = useMemo(() => {
		const query = inspectorQuery.trim().toLowerCase();
		return nodes.filter(
			(node) =>
				!query ||
				node.title.toLowerCase().includes(query) ||
				nodeTypeLabel(node.type).toLowerCase().includes(query),
		);
	}, [inspectorQuery, nodes]);

	const setSelection = useCallback((ids: string[], additive = false) => {
		setSelectedEdgeId(null);
		setSelectedIds((current) => {
			if (!additive) return ids;
			const next = new Set(current);
			for (const id of ids) {
				if (next.has(id)) next.delete(id);
				else next.add(id);
			}
			return [...next];
		});
	}, []);

	const selectSingle = useCallback(
		(id: string, additive = false) => setSelection([id], additive),
		[setSelection],
	);

	const finishEditing = useCallback(
		(commit: boolean) => {
			if (!editingNodeId) return;
			if (!commit && originalTitleRef.current !== null) {
				const originalTitle = originalTitleRef.current;
				updateNodesLive((current) =>
					current.map((node) =>
						node.id === editingNodeId
							? { ...node, title: originalTitle }
							: node,
					),
				);
			} else if (commit) {
				recordSnapshot();
			}
			originalTitleRef.current = null;
			setEditingNodeId(null);
		},
		[editingNodeId, recordSnapshot, updateNodesLive],
	);

	const startEditing = useCallback((node: DiagramNode) => {
		if (node.locked || node.type === "group") return;
		originalTitleRef.current = node.title;
		setEditingNodeId(node.id);
	}, []);

	const handleNodeTitleChange = useCallback(
		(nodeId: string, title: string) => {
			updateNodesLive((current) =>
				current.map((node) => (node.id === nodeId ? { ...node, title } : node)),
			);
		},
		[updateNodesLive],
	);

	const handleNodeSubtitleChange = useCallback(
		(nodeId: string, subtitle: string) => {
			updateNodesLive((current) =>
				current.map((node) =>
					node.id === nodeId ? { ...node, subtitle } : node,
				),
			);
		},
		[updateNodesLive],
	);

	const focusNode = useCallback(
		(nodeId: string) => {
			const node = nodeMap.get(nodeId);
			const viewport = viewportRef.current;
			if (!node || !viewport) return;
			const center = getNodeCenter(node);
			updateView({
				x: viewport.clientWidth / 2 - center.x * viewRef.current.zoom,
				y: viewport.clientHeight / 2 - center.y * viewRef.current.zoom,
				zoom: viewRef.current.zoom,
			});
			selectSingle(nodeId);
			setCommandOpen(false);
			setCommandQuery("");
		},
		[nodeMap, selectSingle, updateView],
	);

	const beginPan = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
		interactionRef.current = {
			mode: "pan",
			pointerId: event.pointerId,
			startClient: { x: event.clientX, y: event.clientY },
			startPan: { x: viewRef.current.x, y: viewRef.current.y },
		};
		event.currentTarget.setPointerCapture(event.pointerId);
	}, []);

	const getSmartSnap = useCallback(
		(
			nodeId: string,
			proposedX: number,
			proposedY: number,
			movingIds: Set<string>,
		) => {
			const movingNode = nodesRef.current.find((node) => node.id === nodeId);
			if (!movingNode)
				return { x: proposedX, y: proposedY, guides: {} as GuideState };
			const otherNodes = nodesRef.current.filter(
				(node) => !movingIds.has(node.id) && node.type !== "group",
			);
			const xCandidates = otherNodes.flatMap((node) => [
				node.x,
				node.x + node.width / 2 - movingNode.width / 2,
				node.x + node.width - movingNode.width,
			]);
			const yCandidates = otherNodes.flatMap((node) => [
				node.y,
				node.y + node.height / 2 - movingNode.height / 2,
				node.y + node.height - movingNode.height,
			]);
			const nearestX = xCandidates.reduce<{
				value: number;
				distance: number;
			} | null>((closest, candidate) => {
				const distance = Math.abs(candidate - proposedX);
				return !closest || distance < closest.distance
					? { value: candidate, distance }
					: closest;
			}, null);
			const nearestY = yCandidates.reduce<{
				value: number;
				distance: number;
			} | null>((closest, candidate) => {
				const distance = Math.abs(candidate - proposedY);
				return !closest || distance < closest.distance
					? { value: candidate, distance }
					: closest;
			}, null);
			const useX = nearestX !== null && nearestX.distance < 7;
			const useY = nearestY !== null && nearestY.distance < 7;
			return {
				x: useX ? nearestX.value : proposedX,
				y: useY ? nearestY.value : proposedY,
				guides: {
					x: useX && nearestX ? nearestX.value : undefined,
					y: useY && nearestY ? nearestY.value : undefined,
				},
			};
		},
		[],
	);

	const handleNodePointerDown = useCallback(
		(event: ReactPointerEvent<HTMLDivElement>, nodeId: string) => {
			if (event.button !== 0) return;
			const node = nodesRef.current.find((item) => item.id === nodeId);
			if (!node) return;
			setContextMenu(null);
			if (spacePressed || tool === "hand") return;
			if (tool === "connector") {
				const start = getWorldPoint(
					event,
					viewportRef.current,
					viewRef.current,
				);
				setConnection({ sourceId: nodeId, start, current: start });
				event.currentTarget.setPointerCapture(event.pointerId);
				return;
			}
			if (tool !== "select") return;
			const alreadySelected = selectedIds.includes(nodeId);
			if (event.shiftKey && alreadySelected) {
				selectSingle(nodeId, true);
				interactionRef.current = null;
				return;
			}
			if (event.shiftKey) selectSingle(nodeId, true);
			else if (!alreadySelected) selectSingle(nodeId);
			setSelectedEdgeId(null);
			const ids = event.shiftKey
				? [...new Set([...selectedIds, nodeId])]
				: alreadySelected
					? selectedIds
					: [nodeId];
			const movingIds = new Set(ids);
			if (node.type === "group") {
				for (const descendantId of getDescendantIds(nodesRef.current, node.id))
					movingIds.add(descendantId);
			}
			const initial = new Map(
				nodesRef.current
					.filter((item) => movingIds.has(item.id) && !item.locked)
					.map((item) => [item.id, { x: item.x, y: item.y }]),
			);
			interactionRef.current = {
				mode: "move",
				pointerId: event.pointerId,
				startWorld: getWorldPoint(event, viewportRef.current, viewRef.current),
				initial,
				primaryId: nodeId,
			};
			event.currentTarget.setPointerCapture(event.pointerId);
		},
		[selectedIds, selectSingle, spacePressed, tool],
	);

	const beginResize = useCallback(
		(event: ReactPointerEvent<HTMLButtonElement>, node: DiagramNode) => {
			event.stopPropagation();
			if (node.locked) return;
			interactionRef.current = {
				mode: "resize",
				pointerId: event.pointerId,
				nodeId: node.id,
				startWorld: getWorldPoint(event, viewportRef.current, viewRef.current),
				initial: node,
			};
			event.currentTarget.setPointerCapture(event.pointerId);
		},
		[],
	);

	const beginRotate = useCallback(
		(event: ReactPointerEvent<HTMLButtonElement>, node: DiagramNode) => {
			event.stopPropagation();
			if (node.locked) return;
			const center = getNodeCenter(node);
			const point = getWorldPoint(event, viewportRef.current, viewRef.current);
			interactionRef.current = {
				mode: "rotate",
				pointerId: event.pointerId,
				nodeId: node.id,
				center,
				startAngle: Math.atan2(point.y - center.y, point.x - center.x),
				initialRotation: node.rotation,
			};
			event.currentTarget.setPointerCapture(event.pointerId);
		},
		[],
	);

	const handleCanvasPointerMove = useCallback(
		(event: ReactPointerEvent<HTMLDivElement>) => {
			const world = getWorldPoint(event, viewportRef.current, viewRef.current);
			if ((tool === "note" || tool === "text") && !spacePressed)
				setNoteCursor(world);
			else if (noteCursor) setNoteCursor(null);
			const interaction = interactionRef.current;
			if (!interaction || interaction.pointerId !== event.pointerId) {
				if (connection) {
					setConnection((current) =>
						current
							? {
									...current,
									current: world,
								}
							: current,
					);
				}
				return;
			}
			if (interaction.mode === "pan") {
				updateView({
					x: interaction.startPan.x + event.clientX - interaction.startClient.x,
					y: interaction.startPan.y + event.clientY - interaction.startClient.y,
					zoom: viewRef.current.zoom,
				});
				return;
			}
			if (interaction.mode === "box") {
				setSelectionBox((current) =>
					current ? { ...current, current: world } : current,
				);
				return;
			}
			if (interaction.mode === "resize") {
				const deltaX = world.x - interaction.startWorld.x;
				const deltaY = world.y - interaction.startWorld.y;
				const groupChildren =
					interaction.initial.type === "group"
						? nodesRef.current.filter(
								(node) =>
									node.parentId === interaction.initial.id &&
									node.type !== "group",
							)
						: [];
				const minimumWidth = Math.max(
					120,
					...groupChildren.map(
						(child) => child.x + child.width - interaction.initial.x + 28,
					),
				);
				const minimumHeight = Math.max(
					56,
					...groupChildren.map(
						(child) => child.y + child.height - interaction.initial.y + 86,
					),
				);
				const width = Math.max(
					minimumWidth,
					snap(interaction.initial.width + deltaX, snapToGrid),
				);
				const height = Math.max(
					minimumHeight,
					snap(interaction.initial.height + deltaY, snapToGrid),
				);
				const nextNodes = nodesRef.current.map((node) =>
					node.id === interaction.nodeId ? { ...node, width, height } : node,
				);
				if (
					interaction.initial.type === "group" &&
					hasOverlappingGroups(nextNodes)
				)
					return;
				updateNodesLive(() => nextNodes);
				return;
			}
			if (interaction.mode === "rotate") {
				const angle = Math.atan2(
					world.y - interaction.center.y,
					world.x - interaction.center.x,
				);
				const rotation =
					interaction.initialRotation +
					((angle - interaction.startAngle) * 180) / Math.PI;
				const nextRotation = event.shiftKey
					? Math.round(rotation / 15) * 15
					: Math.round(rotation);
				updateNodesLive((current) =>
					current.map((node) =>
						node.id === interaction.nodeId
							? { ...node, rotation: nextRotation }
							: node,
					),
				);
				return;
			}
			if (interaction.mode === "move") {
				const deltaX = world.x - interaction.startWorld.x;
				const deltaY = world.y - interaction.startWorld.y;
				const movingIds = new Set(interaction.initial.keys());
				const primary = interaction.initial.get(interaction.primaryId);
				if (!primary) return;
				const proposed = {
					x: snap(primary.x + deltaX, snapToGrid),
					y: snap(primary.y + deltaY, snapToGrid),
				};
				const snapped = snapToGrid
					? getSmartSnap(
							interaction.primaryId,
							proposed.x,
							proposed.y,
							movingIds,
						)
					: { x: proposed.x, y: proposed.y, guides: {} as GuideState };
				const adjustedDelta = {
					x: snapped.x - primary.x,
					y: snapped.y - primary.y,
				};
				setGuides(snapped.guides);
				const nextNodes = nodesRef.current.map((node) => {
					const initial = interaction.initial.get(node.id);
					return initial
						? {
								...node,
								x: snap(initial.x + adjustedDelta.x, snapToGrid),
								y: snap(initial.y + adjustedDelta.y, snapToGrid),
							}
						: node;
				});
				if (hasOverlappingGroups(nextNodes)) return;
				updateNodesLive(() => nextNodes);
			}
		},
		[
			connection,
			getSmartSnap,
			noteCursor,
			snapToGrid,
			spacePressed,
			tool,
			updateNodesLive,
			updateView,
		],
	);

	const handleCanvasPointerUp = useCallback(
		(event: ReactPointerEvent<HTMLDivElement>) => {
			if (connection) {
				const world = getWorldPoint(
					event,
					viewportRef.current,
					viewRef.current,
				);
				const targetFromEvent = (event.target as Element | null)
					?.closest("[data-node-id]")
					?.getAttribute("data-node-id");
				const targetFromPoint = nodesRef.current.find(
					(node) =>
						node.type !== "group" &&
						node.id !== connection.sourceId &&
						visibleNodeIds.has(node.id) &&
						world.x >= node.x &&
						world.x <= node.x + node.width &&
						world.y >= node.y &&
						world.y <= node.y + node.height,
				)?.id;
				const target =
					targetFromEvent && targetFromEvent !== connection.sourceId
						? targetFromEvent
						: targetFromPoint;
				if (target && target !== connection.sourceId && nodeMap.has(target)) {
					const nextEdge: DiagramEdge = {
						id: makeId("edge"),
						source: connection.sourceId,
						target,
						style: edgeStyle,
						label: "",
					};
					recordSnapshot(nodesRef.current, [...edgesRef.current, nextEdge]);
					setSelectedEdgeId(nextEdge.id);
					setSelectedIds([]);
					showToast("Connection added");
				}
				setConnection(null);
				return;
			}
			const interaction = interactionRef.current;
			if (!interaction || interaction.pointerId !== event.pointerId) return;
			if (interaction.mode === "box") {
				const box = selectionBox;
				if (box) {
					const minX = Math.min(box.start.x, box.current.x);
					const minY = Math.min(box.start.y, box.current.y);
					const maxX = Math.max(box.start.x, box.current.x);
					const maxY = Math.max(box.start.y, box.current.y);
					const hits = visibleNodes
						.filter(
							(node) =>
								node.type !== "group" &&
								node.x < maxX &&
								node.x + node.width > minX &&
								node.y < maxY &&
								node.y + node.height > minY,
						)
						.map((node) => node.id);
					setSelectionBox(null);
					setSelection(hits, box.additive);
				}
			} else if (
				interaction.mode === "move" ||
				interaction.mode === "resize" ||
				interaction.mode === "rotate"
			) {
				const nextNodes =
					interaction.mode === "move"
						? syncGroupMembership(nodesRef.current)
						: nodesRef.current;
				recordSnapshot(nextNodes, edgesRef.current);
				setGuides({});
			}
			interactionRef.current = null;
		},
		[
			connection,
			edgeStyle,
			nodeMap,
			recordSnapshot,
			selectionBox,
			setSelection,
			showToast,
			visibleNodes,
			visibleNodeIds,
		],
	);

	const handleCanvasPointerDown = useCallback(
		(event: ReactPointerEvent<HTMLDivElement>) => {
			if (event.button !== 0 && event.button !== 1) return;
			const activeElement = document.activeElement;
			if (
				activeElement instanceof HTMLInputElement ||
				activeElement instanceof HTMLTextAreaElement ||
				activeElement instanceof HTMLSelectElement
			)
				activeElement.blur();
			const isPanning = event.button === 1 || tool === "hand" || spacePressed;
			const element = event.target as Element;
			const isCreationTool = tool === "note" || tool === "text";
			if (
				!isPanning &&
				!isCreationTool &&
				(element.closest("[data-node-id]") || element.closest("[data-edge-id]"))
			)
				return;
			setContextMenu(null);
			if (isPanning) {
				beginPan(event);
				return;
			}
			const world = getWorldPoint(event, viewportRef.current, viewRef.current);
			if (tool === "note" || tool === "text") {
				const type: NodeType = tool === "note" ? "note" : "text";
				const newNode: DiagramNode = {
					id: makeId(type),
					type,
					x: snap(world.x - (type === "note" ? 96 : 84), snapToGrid),
					y: snap(world.y - (type === "note" ? 50 : 28), snapToGrid),
					width: type === "note" ? 192 : 168,
					height: type === "note" ? 100 : 56,
					title: type === "note" ? "New note" : "New text",
					subtitle: type === "note" ? "Add a thought" : "",
					color: type === "note" ? "yellow" : "slate",
					locked: false,
					rotation: 0,
				};
				const containingGroup = findContainingGroup(newNode, nodesRef.current);
				if (containingGroup) newNode.parentId = containingGroup.id;
				recordSnapshot([...nodesRef.current, newNode], edgesRef.current);
				setSelectedIds([newNode.id]);
				setSelectedEdgeId(null);
				startEditing(newNode);
				setTool("select");
				return;
			}
			if (tool !== "select") return;
			if (!event.shiftKey) {
				setSelectedIds([]);
				setSelectedEdgeId(null);
			}
			setSelectionBox({
				start: world,
				current: world,
				additive: event.shiftKey,
			});
			interactionRef.current = {
				mode: "box",
				pointerId: event.pointerId,
				additive: event.shiftKey,
			};
			event.currentTarget.setPointerCapture(event.pointerId);
		},
		[beginPan, recordSnapshot, snapToGrid, spacePressed, startEditing, tool],
	);

	const deleteSelected = useCallback(() => {
		const deletedIds = new Set(selectedIds);
		for (const node of nodesRef.current) {
			if (node.parentId && deletedIds.has(node.parentId))
				deletedIds.add(node.id);
		}
		if (selectedEdgeId) {
			recordSnapshot(
				nodesRef.current,
				edgesRef.current.filter((edge) => edge.id !== selectedEdgeId),
			);
			setSelectedEdgeId(null);
			showToast("Edge deleted");
			return;
		}
		if (!deletedIds.size) return;
		const nextNodes = nodesRef.current.filter(
			(node) => !deletedIds.has(node.id),
		);
		const nextEdges = edgesRef.current.filter(
			(edge) => !deletedIds.has(edge.source) && !deletedIds.has(edge.target),
		);
		recordSnapshot(nextNodes, nextEdges);
		setSelectedIds([]);
		showToast("Deleted selection");
	}, [recordSnapshot, selectedEdgeId, selectedIds, showToast]);

	const copySelected = useCallback(() => {
		const picked = new Set(selectedIds);
		if (!picked.size) return;
		const data: ClipboardData = {
			nodes: nodesRef.current.filter((node) => picked.has(node.id)),
			edges: edgesRef.current.filter(
				(edge) => picked.has(edge.source) && picked.has(edge.target),
			),
		};
		clipboardRef.current = data;
		try {
			void navigator.clipboard?.writeText(JSON.stringify(data));
		} catch {
			// The in-app clipboard remains available when browser clipboard permission is absent.
		}
		showToast(
			`${data.nodes.length} ${data.nodes.length === 1 ? "node" : "nodes"} copied`,
		);
	}, [selectedIds, showToast]);

	const pasteClipboard = useCallback(() => {
		const data = clipboardRef.current;
		if (!data) return;
		const idMap = new Map(
			data.nodes.map((node) => [node.id, makeId(node.type)]),
		);
		const createPastedNodes = (offset: number) =>
			data.nodes.map((node) => ({
				...node,
				id: idMap.get(node.id) ?? makeId(node.type),
				x: node.x + offset,
				y: node.y + offset,
				parentId:
					node.parentId && idMap.has(node.parentId)
						? idMap.get(node.parentId)
						: undefined,
			}));
		let offset = 32;
		let pastedNodes = createPastedNodes(offset);
		while (
			hasOverlappingGroups([...nodesRef.current, ...pastedNodes]) &&
			offset < 512
		) {
			offset += 32;
			pastedNodes = createPastedNodes(offset);
		}
		if (hasOverlappingGroups([...nodesRef.current, ...pastedNodes])) {
			showToast("Groups cannot overlap");
			return;
		}
		const pastedEdges = data.edges.map((edge) => ({
			...edge,
			id: makeId("edge"),
			source: idMap.get(edge.source) ?? edge.source,
			target: idMap.get(edge.target) ?? edge.target,
		}));
		const nextNodes = syncGroupMembership([
			...nodesRef.current,
			...pastedNodes,
		]);
		recordSnapshot(nextNodes, [...edgesRef.current, ...pastedEdges]);
		setSelectedIds(pastedNodes.map((node) => node.id));
		showToast("Pasted selection");
	}, [recordSnapshot, showToast]);

	const duplicateSelected = useCallback(() => {
		copySelected();
		pasteClipboard();
	}, [copySelected, pasteClipboard]);

	const groupSelection = useCallback(() => {
		const groupable = selectedNodes.filter((node) => node.type !== "group");
		if (groupable.length < 2) {
			showToast("Select two or more nodes to group");
			return;
		}
		const existingGroups = nodesRef.current.filter(
			(node) => node.type === "group",
		);
		const containingGroups = new Set(
			groupable
				.map((node) => findContainingGroup(node, existingGroups)?.id)
				.filter((id): id is string => Boolean(id)),
		);
		if (containingGroups.size === 1) {
			const containingGroupId = [...containingGroups][0];
			const group = existingGroups.find(
				(node) => node.id === containingGroupId,
			);
			if (
				group &&
				groupable.every((node) =>
					containsRect(getNodeRect(group), getNodeRect(node)),
				)
			) {
				const groupedIds = new Set(groupable.map((node) => node.id));
				const nextNodes = nodesRef.current.map((node) =>
					groupedIds.has(node.id) ? { ...node, parentId: group.id } : node,
				);
				if (groupable.some((node) => node.parentId !== group.id))
					recordSnapshot(nextNodes, edgesRef.current);
				setSelectedIds([group.id]);
				showToast("Selection added to group");
				return;
			}
		}
		const bounds = getBounds(groupable);
		const group: DiagramNode = {
			id: makeId("group"),
			type: "group",
			x: bounds.minX - 28,
			y: bounds.minY - 58,
			width: bounds.width + 56,
			height: bounds.height + 86,
			title: "New group",
			subtitle: `${groupable.length} nodes · press ⌘G to group again`,
			color: "blue",
			locked: false,
			rotation: 0,
		};
		if (
			existingGroups.some((existingGroup) =>
				rectanglesOverlap(getNodeRect(group), getNodeRect(existingGroup)),
			)
		) {
			showToast("Groups cannot overlap");
			return;
		}
		const groupedIds = new Set(groupable.map((node) => node.id));
		const nextNodes = nodesRef.current.map((node) =>
			groupedIds.has(node.id) ? { ...node, parentId: group.id } : node,
		);
		recordSnapshot([...nextNodes, group], edgesRef.current);
		setSelectedIds([group.id]);
		showToast("Group created");
	}, [recordSnapshot, selectedNodes, showToast]);

	const ungroupSelection = useCallback(() => {
		const groups = selectedNodes.filter((node) => node.type === "group");
		if (!groups.length) {
			showToast("Select a group to ungroup");
			return;
		}
		const groupIds = new Set(groups.map((group) => group.id));
		const nextNodes = nodesRef.current
			.filter((node) => !groupIds.has(node.id))
			.map((node) =>
				groupIds.has(node.parentId ?? "")
					? { ...node, parentId: undefined }
					: node,
			);
		recordSnapshot(nextNodes, edgesRef.current);
		setSelectedIds([]);
		showToast("Group removed");
	}, [recordSnapshot, selectedNodes, showToast]);

	const toggleLockSelection = useCallback(() => {
		if (!selectedIds.length) return;
		const shouldLock = selectedNodes.some((node) => !node.locked);
		const nextNodes = nodesRef.current.map((node) =>
			selectedIds.includes(node.id) ? { ...node, locked: shouldLock } : node,
		);
		recordSnapshot(nextNodes, edgesRef.current);
		showToast(shouldLock ? "Selection locked" : "Selection unlocked");
	}, [recordSnapshot, selectedIds, selectedNodes, showToast]);

	const autoArrange = useCallback(() => {
		const arrangeIds = [
			"node-start",
			"node-cart",
			"node-payment",
			"node-order",
			"node-complete",
		];
		const positions: Record<string, Point> = {
			"node-start": { x: 160, y: 188 },
			"node-cart": { x: 160, y: 328 },
			"node-payment": { x: 500, y: 328 },
			"node-order": { x: 850, y: 328 },
			"node-complete": { x: 850, y: 488 },
		};
		const nextNodes = nodesRef.current.map((node) => {
			const position = positions[node.id];
			return position && arrangeIds.includes(node.id)
				? { ...node, ...position }
				: node;
		});
		recordSnapshot(nextNodes, edgesRef.current);
		fitView();
		showToast("Diagram arranged");
	}, [fitView, recordSnapshot, showToast]);

	const applyCheckoutTemplate = useCallback(() => {
		recordSnapshot(INITIAL_NODES, INITIAL_EDGES);
		setSelectedIds(["node-payment"]);
		setSelectedEdgeId(null);
		setTool("select");
		showToast("Checkout template applied");
	}, [recordSnapshot, showToast]);

	const updateEdge = useCallback(
		(edgeId: string, patch: Partial<DiagramEdge>) => {
			const nextEdges = edgesRef.current.map((edge) =>
				edge.id === edgeId ? { ...edge, ...patch } : edge,
			);
			recordSnapshot(nodesRef.current, nextEdges);
		},
		[recordSnapshot],
	);

	const createSvg = useCallback(() => {
		const visible = getVisibleNodes(nodesRef.current);
		const visibleIds = new Set(visible.map((node) => node.id));
		const edgeMarkup = edgesRef.current
			.filter(
				(edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target),
			)
			.map((edge) => {
				const source = nodeMap.get(edge.source);
				const target = nodeMap.get(edge.target);
				if (!source || !target) return "";
				const geometry = getEdgeGeometry(source, target, edge.style);
				return `<path d="${geometry.path}" fill="none" marker-end="url(#arrow)" stroke="#8190a3" stroke-width="2.2"/>${edge.label ? `<text fill="#657286" font-family="system-ui" font-size="13" x="${geometry.labelPoint.x}" y="${geometry.labelPoint.y}" text-anchor="middle">${escapeXml(edge.label)}</text>` : ""}`;
			})
			.join("");
		const nodeMarkup = visible
			.filter((node) => node.type !== "group")
			.map((node) => {
				const color = COLOR_META[node.color];
				const radius =
					node.type === "start" || node.type === "end" ? node.height / 2 : 12;
				const shape =
					node.type === "decision"
						? `points="${node.x + node.width / 2},${node.y} ${node.x + node.width},${node.y + node.height / 2} ${node.x + node.width / 2},${node.y + node.height} ${node.x},${node.y + node.height / 2}"`
						: "";
				const visual =
					node.type === "decision"
						? `<polygon fill="${color.fill}" points="${shape.replace('points="', "").replace('"', "")}" stroke="${color.border}" stroke-width="2"/>`
						: `<rect fill="${color.fill}" height="${node.height}" rx="${radius}" width="${node.width}" x="${node.x}" y="${node.y}" stroke="${color.border}" stroke-width="2"/>`;
				return `${visual}<text fill="#1c2836" font-family="system-ui" font-size="15" font-weight="650" x="${node.x + 18}" y="${node.y + node.height / 2 - 2}">${escapeXml(node.title)}</text><text fill="#738094" font-family="system-ui" font-size="12" x="${node.x + 18}" y="${node.y + node.height / 2 + 18}">${escapeXml(node.subtitle)}</text>`;
			})
			.join("");
		return `<svg xmlns="http://www.w3.org/2000/svg" width="${WORLD_WIDTH}" height="${WORLD_HEIGHT}" viewBox="0 0 ${WORLD_WIDTH} ${WORLD_HEIGHT}"><defs><marker id="arrow" markerHeight="7" markerWidth="7" orient="auto-start-reverse" refX="6" refY="3.5" viewBox="0 0 7 7"><path d="M 0 0 L 7 3.5 L 0 7 z" fill="#8190a3"/></marker></defs><rect fill="#f8fafc" height="100%" width="100%"/>${edgeMarkup}${nodeMarkup}</svg>`;
	}, [nodeMap]);

	const downloadFile = useCallback(
		(name: string, contents: string, type: string) => {
			const blob = new Blob([contents], { type });
			const url = URL.createObjectURL(blob);
			const anchor = document.createElement("a");
			anchor.href = url;
			anchor.download = name;
			anchor.click();
			URL.revokeObjectURL(url);
			setExportOpen(false);
			showToast(`${name} downloaded`);
		},
		[showToast],
	);

	const exportJson = useCallback(() => {
		downloadFile(
			"flwchrt-diagram.flwchrt.json",
			JSON.stringify(
				{ version: 1, nodes: nodesRef.current, edges: edgesRef.current },
				null,
				2,
			),
			"application/json",
		);
	}, [downloadFile]);

	const exportSvg = useCallback(
		() => downloadFile("checkout-flow.svg", createSvg(), "image/svg+xml"),
		[createSvg, downloadFile],
	);

	const exportPng = useCallback(() => {
		const svgBlob = new Blob([createSvg()], { type: "image/svg+xml" });
		const url = URL.createObjectURL(svgBlob);
		const image = new Image();
		image.onload = () => {
			const canvas = document.createElement("canvas");
			canvas.width = WORLD_WIDTH * 2;
			canvas.height = WORLD_HEIGHT * 2;
			const context = canvas.getContext("2d");
			if (!context) return;
			context.scale(2, 2);
			context.drawImage(image, 0, 0);
			canvas.toBlob((blob) => {
				if (!blob) return;
				const downloadUrl = URL.createObjectURL(blob);
				const anchor = document.createElement("a");
				anchor.href = downloadUrl;
				anchor.download = "checkout-flow.png";
				anchor.click();
				URL.revokeObjectURL(downloadUrl);
				showToast("checkout-flow.png downloaded");
			}, "image/png");
			URL.revokeObjectURL(url);
		};
		image.src = url;
		setExportOpen(false);
	}, [createSvg, showToast]);

	const importJson = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			const file = event.target.files?.[0];
			if (!file) return;
			void file.text().then((contents) => {
				try {
					const parsed: unknown = JSON.parse(contents);
					if (!isDiagramFile(parsed)) throw new Error("Invalid diagram");
					if (hasOverlappingGroups(parsed.nodes))
						throw new Error("Overlapping groups");
					recordSnapshot(parsed.nodes, parsed.edges);
					setSelectedIds([]);
					showToast("Diagram imported");
				} catch {
					showToast("Could not import that file");
				}
			});
			event.target.value = "";
		},
		[recordSnapshot, showToast],
	);

	const commandItems = useMemo(() => {
		const base = [
			{
				label: "Select tool",
				detail: "V",
				icon: "cursor" as IconName,
				action: () => setTool("select"),
			},
			{
				label: "Pan canvas",
				detail: "H",
				icon: "hand" as IconName,
				action: () => setTool("hand"),
			},
			{
				label: "Add sticky note",
				detail: "N",
				icon: "note" as IconName,
				action: () => setTool("note"),
			},
			{
				label: "Auto arrange diagram",
				detail: "",
				icon: "move" as IconName,
				action: autoArrange,
			},
			{
				label: "Use checkout flow template",
				detail: "Template",
				icon: "folder" as IconName,
				action: applyCheckoutTemplate,
			},
			{
				label: "Fit diagram to view",
				detail: "",
				icon: "fit" as IconName,
				action: fitView,
			},
			{
				label: "Group selected nodes",
				detail: "⌘G",
				icon: "group" as IconName,
				action: groupSelection,
			},
			{
				label: "Lock selection",
				detail: "",
				icon: "lock" as IconName,
				action: toggleLockSelection,
			},
			{
				label: "Export editable JSON",
				detail: "",
				icon: "download" as IconName,
				action: exportJson,
			},
		];
		const query = commandQuery.trim().toLowerCase();
		const nodeResults = query
			? nodes
					.filter((node) => node.title.toLowerCase().includes(query))
					.slice(0, 6)
					.map((node) => ({
						label: `Go to ${node.title}`,
						detail: nodeTypeLabel(node.type),
						icon: nodeIcon(node.type),
						action: () => focusNode(node.id),
					}))
			: [];
		return [
			...nodeResults,
			...base.filter(
				(item) => !query || item.label.toLowerCase().includes(query),
			),
		];
	}, [
		applyCheckoutTemplate,
		autoArrange,
		commandQuery,
		exportJson,
		fitView,
		focusNode,
		groupSelection,
		nodes,
		toggleLockSelection,
	]);

	const moveCommandIndex = useCallback(
		(direction: 1 | -1) => {
			setCommandIndex((index) =>
				commandItems.length
					? (index + direction + commandItems.length) % commandItems.length
					: 0,
			);
		},
		[commandItems.length],
	);

	const executeCommand = useCallback(() => {
		const command = commandItems[commandIndex];
		if (!command) return;
		command.action();
		setCommandOpen(false);
		setCommandQuery("");
	}, [commandIndex, commandItems]);

	const nudgeSelection = useCallback(
		(delta: Point) => {
			if (!selectedIds.length) return;
			const nextNodes = nodesRef.current.map((node) =>
				selectedIds.includes(node.id) && !node.locked
					? { ...node, x: node.x + delta.x, y: node.y + delta.y }
					: node,
			);
			recordSnapshot(nextNodes, edgesRef.current);
		},
		[recordSnapshot, selectedIds],
	);

	useEditorHotkeys({
		commandOpen,
		contextMenu,
		editingNodeId,
		finishEditing,
		executeCommand,
		copySelected,
		deleteSelected,
		duplicateSelected,
		groupSelection,
		moveCommandIndex,
		nudgeSelection,
		pasteClipboard,
		redo,
		selectedCount: selectedIds.length,
		setCommandOpen,
		setCommandQuery,
		setContextMenu,
		setSpacePressed,
		setTool,
		undo,
		ungroupSelection,
	});

	const handleContextMenu = useCallback(
		(event: ReactMouseEvent<HTMLDivElement>) => {
			event.preventDefault();
			const nodeId =
				(event.target as Element | null)
					?.closest("[data-node-id]")
					?.getAttribute("data-node-id") ?? undefined;
			if (nodeId && !selectedIds.includes(nodeId)) selectSingle(nodeId);
			setContextMenu({ x: event.clientX, y: event.clientY, nodeId });
		},
		[selectSingle, selectedIds],
	);

	const stageStyle: CSSProperties = {
		transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.zoom})`,
	};
	const viewportStyle: CSSProperties = {
		backgroundPosition: `${view.x}px ${view.y}px`,
		backgroundSize: `${GRID_SIZE * view.zoom}px ${GRID_SIZE * view.zoom}px`,
	};

	return (
		<div className="editor-shell" data-theme={theme}>
			<header className="topbar">
				<div className="brand-lockup">
					<div className="brand-mark" aria-hidden="true">
						<span />
						<span />
						<span />
						<span />
					</div>
					<span className="brand-name">Flwchrt</span>
				</div>
				<div className="project-breadcrumb">
					<span>Projects</span>
					<Icon name="chevronRight" size={13} />
					<span>Flwchrt</span>
					<button
						aria-label="Rename project"
						className="project-name-button"
						onClick={() =>
							setProjectName(
								projectName === "Flwchrt" ? "Flwchrt" : projectName,
							)
						}
						type="button"
					>
						{projectName}
						<Icon name="chevronDown" size={13} />
					</button>
				</div>
				<div className="topbar-actions">
					<div className={`save-status ${saveState}`}>
						<span className="save-dot" />
						{saveState === "saving" ? "Saving" : "Saved just now"}
					</div>
					<button
						aria-label="Open command palette"
						className="topbar-search"
						onClick={() => setCommandOpen(true)}
						type="button"
					>
						<Icon name="search" size={15} />
						<span>Search</span>
						<kbd>⌘ K</kbd>
					</button>
					<button
						aria-label="Share diagram"
						className="button subtle-button"
						onClick={() => showToast("Share link copied")}
						type="button"
					>
						<Icon name="share" size={15} />
						Share
					</button>
					<div className="export-wrap">
						<button
							aria-expanded={exportOpen}
							className="button primary-button"
							onClick={(event) => {
								event.stopPropagation();
								setExportOpen((open) => !open);
							}}
							type="button"
						>
							<Icon name="download" size={15} />
							Export
							<Icon name="chevronDown" size={13} />
						</button>
						{exportOpen ? (
							<div className="export-menu">
								<button onClick={exportPng} type="button">
									<Icon name="download" size={14} />
									Export PNG<span>⌘⇧P</span>
								</button>
								<button onClick={exportSvg} type="button">
									<Icon name="link" size={14} />
									Export SVG<span>vector</span>
								</button>
								<button onClick={exportJson} type="button">
									<Icon name="copy" size={14} />
									Export editable JSON<span>Flwchrt</span>
								</button>
								<div className="menu-divider" />
								<button
									onClick={() => fileInputRef.current?.click()}
									type="button"
								>
									<Icon name="upload" size={14} />
									Import diagram<span>JSON</span>
								</button>
							</div>
						) : null}
					</div>
					<input
						accept="application/json,.json"
						className="visually-hidden"
						onChange={importJson}
						ref={fileInputRef}
						type="file"
					/>
					<button
						aria-label="Open account menu"
						className="avatar-button"
						data-tooltip="Account menu"
						data-tooltip-placement="bottom"
						onClick={() => showToast("Account menu coming soon")}
						type="button"
					>
						KM
					</button>
				</div>
			</header>

			<main className="editor-body">
				<aside className="left-rail" aria-label="Tools">
					<div className="rail-section">
						{TOOL_ITEMS.map((item) => (
							<ToolButton
								active={tool === item.id}
								icon={item.icon}
								key={item.id}
								label={item.label}
								onClick={() => setTool(item.id)}
								shortcut={item.shortcut}
							/>
						))}
					</div>
					<div className="rail-divider" />
					<div className="rail-section">
						<ToolButton
							active={false}
							icon="undo"
							label="Undo"
							onClick={undo}
						/>
						<ToolButton
							active={false}
							icon="redo"
							label="Redo"
							onClick={redo}
						/>
						<ToolButton
							active={false}
							icon="selectAll"
							label="Select all"
							onClick={() =>
								setSelectedIds(
									visibleNodes
										.filter((node) => node.type !== "group")
										.map((node) => node.id),
								)
							}
						/>
					</div>
					<div className="rail-spacer" />
					<div className="rail-section rail-bottom">
						<ToolButton
							active={false}
							icon={theme === "light" ? "moon" : "sun"}
							label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
							onClick={() =>
								setTheme((current) => (current === "light" ? "dark" : "light"))
							}
						/>
						<ToolButton
							active={false}
							icon="keyboard"
							label="Keyboard shortcuts"
							onClick={() => {
								setCommandOpen(true);
								setCommandQuery("shortcut");
							}}
						/>
						<div className="rail-avatar">KM</div>
					</div>
				</aside>

				<section className="workspace-column">
					<div className="canvas-topbar">
						<div className="canvas-actions">
							<button
								className="canvas-action"
								data-tooltip="Arrange diagram"
								data-tooltip-placement="top"
								onClick={autoArrange}
								type="button"
							>
								<Icon name="move" size={14} />
								Arrange
							</button>
							<button
								className="canvas-action"
								data-tooltip="Fit diagram to view"
								data-tooltip-placement="top"
								onClick={fitView}
								type="button"
							>
								<Icon name="fit" size={14} />
								Fit
							</button>
							<button
								aria-pressed={showGrid}
								className={`canvas-action${showGrid ? " is-on" : ""}`}
								data-tooltip="Show or hide grid"
								data-tooltip-placement="top"
								onClick={() => setShowGrid((value) => !value)}
								type="button"
							>
								<Icon name="grid" size={14} />
								Grid
							</button>
							<button
								aria-pressed={snapToGrid}
								className={`canvas-action${snapToGrid ? " is-on" : ""}`}
								data-tooltip="Toggle snap to grid"
								data-tooltip-placement="top"
								onClick={() => setSnapToGrid((value) => !value)}
								type="button"
							>
								<Icon name="selectAll" size={14} />
								Snap
							</button>
						</div>
					</div>
					<div
						aria-label="Infinite diagram canvas"
						className={`canvas-viewport${tool === "hand" ? " hand-mode" : ""}${tool === "note" ? " note-mode" : ""}${tool === "text" ? " text-mode" : ""}${spacePressed ? " space-mode" : ""}${showGrid ? " show-grid" : ""}`}
						onContextMenu={handleContextMenu}
						onPointerDown={handleCanvasPointerDown}
						onPointerMove={handleCanvasPointerMove}
						onPointerLeave={() => setNoteCursor(null)}
						onPointerUp={handleCanvasPointerUp}
						ref={viewportRef}
						role="application"
						style={viewportStyle}
					>
						<div className="diagram-stage" style={stageStyle}>
							<div className="stage-origin" aria-hidden="true">
								<span>0, 0</span>
							</div>
							{(tool === "note" || tool === "text") &&
							!spacePressed &&
							noteCursor ? (
								<div
									aria-hidden="true"
									className={`note-cursor-preview${tool === "text" ? " text-cursor-preview" : ""}`}
									style={{
										left: noteCursor.x - (tool === "text" ? 84 : 96),
										top: noteCursor.y - (tool === "text" ? 28 : 50),
									}}
								>
									<span className="note-cursor-icon">
										<Icon name={tool === "text" ? "text" : "note"} size={13} />
									</span>
									<strong>{tool === "text" ? "New text" : "New note"}</strong>
									<small>
										{tool === "text" ? "Click to type" : "Add a thought"}
									</small>
								</div>
							) : null}
							{guides.x !== undefined ? (
								<div
									className="alignment-guide vertical-guide"
									style={{ left: guides.x }}
								/>
							) : null}
							{guides.y !== undefined ? (
								<div
									className="alignment-guide horizontal-guide"
									style={{ top: guides.y }}
								/>
							) : null}
							<EdgeLayer
								connection={connection}
								edges={edges}
								nodeMap={nodeMap}
								onSelect={(edgeId) => {
									setSelectedEdgeId(edgeId);
									setSelectedIds([]);
								}}
								selectedEdgeId={selectedEdgeId}
								visibleNodeIds={visibleNodeIds}
							/>
							{[...visibleNodes]
								.sort((a, b) =>
									a.type === "group" ? -1 : b.type === "group" ? 1 : 0,
								)
								.map((node) => (
									<NodeView
										onBeginResize={beginResize}
										onBeginRotate={beginRotate}
										onCollapse={(id) => {
											const target = nodesRef.current.find(
												(item) => item.id === id,
											);
											if (target)
												updateNodePatch(id, { collapsed: !target.collapsed });
										}}
										onDoubleClick={startEditing}
										onPointerDown={handleNodePointerDown}
										onTitleCancel={() => finishEditing(false)}
										onTitleChange={handleNodeTitleChange}
										onTitleCommit={() => finishEditing(true)}
										editing={editingNodeId === node.id}
										key={node.id}
										node={node}
										selected={selectedIds.includes(node.id)}
										showHandles={
											selectedIds.length === 1 && selectedIds[0] === node.id
										}
									/>
								))}
							{selectionBox ? (
								<div
									className="selection-box"
									style={{
										left: Math.min(
											selectionBox.start.x,
											selectionBox.current.x,
										),
										top: Math.min(selectionBox.start.y, selectionBox.current.y),
										width: Math.abs(
											selectionBox.current.x - selectionBox.start.x,
										),
										height: Math.abs(
											selectionBox.current.y - selectionBox.start.y,
										),
									}}
								/>
							) : null}
						</div>
						<MiniMap
							nodes={visibleNodes}
							onClick={handleMinimapClick}
							viewport={minimapViewport}
						/>
						<div
							className="zoom-controls"
							onPointerDown={(event) => event.stopPropagation()}
						>
							<button
								aria-label="Zoom out"
								data-tooltip="Zoom out"
								data-tooltip-placement="top"
								onClick={() => zoomCanvas(0.86)}
								type="button"
							>
								<Icon name="minus" size={14} />
							</button>
							<button
								aria-label="Reset zoom to 100%"
								className="zoom-label"
								data-tooltip="Reset zoom to 100%"
								data-tooltip-placement="top"
								onClick={resetZoom}
								type="button"
							>
								{Math.round(view.zoom * 100)}%
							</button>
							<button
								aria-label="Zoom in"
								data-tooltip="Zoom in"
								data-tooltip-placement="top"
								onClick={() => zoomCanvas(1.16)}
								type="button"
							>
								<Icon name="plus" size={14} />
							</button>
						</div>
					</div>
					<div className="canvas-statusbar">
						<div>
							<span className="status-key">
								{selectedIds.length
									? `${selectedIds.length} selected`
									: "Canvas ready"}
							</span>
							<span className="status-separator" />x{" "}
							{formatNumber(canvasPosition.x)} · y{" "}
							{formatNumber(canvasPosition.y)}
						</div>
						<div className="status-hints">
							<span>
								<kbd>Space</kbd> pan
							</span>
							<span>
								<kbd>⌘</kbd> select multiple
							</span>
							<span>
								<kbd>?</kbd> shortcuts
							</span>
						</div>
					</div>
				</section>

				<aside className="inspector" aria-label="Inspector">
					<PropertiesPanel
						edge={selectedEdge}
						nodeCount={nodes.length}
						onToggleGrid={() => setShowGrid((value) => !value)}
						onToggleSnap={() => setSnapToGrid((value) => !value)}
						onChangeColor={(color) =>
							selectedNode && updateNodePatch(selectedNode.id, { color })
						}
						onChangeEdgeStyle={(style) => {
							setEdgeStyle(style);
							if (selectedEdge) updateEdge(selectedEdge.id, { style });
						}}
						onChangeTitle={(title) =>
							selectedNode && handleNodeTitleChange(selectedNode.id, title)
						}
						onChangeSubtitle={(subtitle) =>
							selectedNode &&
							handleNodeSubtitleChange(selectedNode.id, subtitle)
						}
						onCommitTitle={() => {
							if (selectedNode)
								recordSnapshot(nodesRef.current, edgesRef.current);
						}}
						onCommitSubtitle={() => {
							if (selectedNode)
								recordSnapshot(nodesRef.current, edgesRef.current);
						}}
						onDuplicate={duplicateSelected}
						onGroup={groupSelection}
						onLock={toggleLockSelection}
						onUngroup={ungroupSelection}
						node={selectedNode}
						onUpdateEdgeLabel={(label) =>
							selectedEdge && updateEdge(selectedEdge.id, { label })
						}
						onUpdateNode={(patch) =>
							selectedNode && updateNodePatch(selectedNode.id, patch)
						}
						showGrid={showGrid}
						snapToGrid={snapToGrid}
					/>
					<LayersPanel
						nodes={filteredLayerNodes}
						onSearch={setInspectorQuery}
						query={inspectorQuery}
						selectedIds={selectedIds}
						onSelect={(id, additive) => selectSingle(id, additive)}
						onToggleLock={(id) => {
							const target = nodesRef.current.find((node) => node.id === id);
							if (target) updateNodePatch(id, { locked: !target.locked });
						}}
						onToggleVisibility={(id) =>
							(() => {
								const target = nodesRef.current.find((node) => node.id === id);
								if (!target) return;
								updateNodePatch(id, { hidden: !target.hidden });
								showToast(target.hidden ? "Layer shown" : "Layer hidden");
							})()
						}
					/>
				</aside>
			</main>

			{contextMenu ? (
				<ContextMenu
					onClose={() => setContextMenu(null)}
					onDelete={deleteSelected}
					onDuplicate={duplicateSelected}
					onGroup={groupSelection}
					onLock={toggleLockSelection}
					onPaste={pasteClipboard}
					onUngroup={ungroupSelection}
					position={contextMenu}
				/>
			) : null}
			{commandOpen ? (
				<CommandPalette
					activeIndex={commandIndex}
					items={commandItems}
					onClose={() => {
						setCommandOpen(false);
						setCommandQuery("");
					}}
					query={commandQuery}
					setQuery={setCommandQuery}
				/>
			) : null}
			{toast ? (
				<div className="toast">
					<span className="toast-check">✓</span>
					{toast}
				</div>
			) : null}
		</div>
	);
}
