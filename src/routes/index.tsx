import { createFileRoute } from "@tanstack/react-router";
import type {
	ChangeEvent,
	CSSProperties,
	KeyboardEvent as ReactKeyboardEvent,
	MouseEvent as ReactMouseEvent,
	ReactNode,
	PointerEvent as ReactPointerEvent,
} from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export const Route = createFileRoute("/")({ component: FlowcraftEditor });

type Tool = "select" | "hand" | "connector" | "note" | "text";
type NodeType =
	| "group"
	| "start"
	| "process"
	| "decision"
	| "database"
	| "end"
	| "note"
	| "text";
type NodeColor = "blue" | "violet" | "mint" | "coral" | "yellow" | "slate";
type EdgeStyle = "elbow" | "straight" | "curved";
type Theme = "light" | "dark";

interface Point {
	x: number;
	y: number;
}

interface DiagramNode {
	id: string;
	type: NodeType;
	x: number;
	y: number;
	width: number;
	height: number;
	title: string;
	subtitle: string;
	color: NodeColor;
	locked: boolean;
	rotation: number;
	parentId?: string;
	collapsed?: boolean;
	hidden?: boolean;
}

interface DiagramEdge {
	id: string;
	source: string;
	target: string;
	style: EdgeStyle;
	label: string;
}

interface HistoryEntry {
	nodes: DiagramNode[];
	edges: DiagramEdge[];
}

interface ClipboardData {
	nodes: DiagramNode[];
	edges: DiagramEdge[];
}

interface GuideState {
	x?: number;
	y?: number;
}

interface SelectionBoxState {
	start: Point;
	current: Point;
	additive: boolean;
}

type InteractionState =
	| {
			mode: "pan";
			pointerId: number;
			startClient: Point;
			startPan: Point;
	  }
	| {
			mode: "move";
			pointerId: number;
			startWorld: Point;
			initial: Map<string, Point>;
			primaryId: string;
	  }
	| {
			mode: "resize";
			pointerId: number;
			nodeId: string;
			startWorld: Point;
			initial: DiagramNode;
	  }
	| {
			mode: "rotate";
			pointerId: number;
			nodeId: string;
			center: Point;
			startAngle: number;
			initialRotation: number;
	  }
	| {
			mode: "box";
			pointerId: number;
			additive: boolean;
	  };

interface ConnectionState {
	sourceId: string;
	start: Point;
	current: Point;
}

interface ContextMenuState {
	x: number;
	y: number;
	nodeId?: string;
}

const WORLD_WIDTH = 1600;
const WORLD_HEIGHT = 1100;
const GRID_SIZE = 24;

const COLOR_META: Record<
	NodeColor,
	{ label: string; fill: string; border: string; text: string }
> = {
	blue: { label: "Blue", fill: "#e8f2ff", border: "#a7c9ff", text: "#1f5fbb" },
	violet: {
		label: "Violet",
		fill: "#f1ecff",
		border: "#c8b8ff",
		text: "#6541bb",
	},
	mint: { label: "Mint", fill: "#e9f8f2", border: "#a9dfc7", text: "#267b5c" },
	coral: {
		label: "Coral",
		fill: "#fff0eb",
		border: "#f5b9a9",
		text: "#a64a35",
	},
	yellow: {
		label: "Yellow",
		fill: "#fff8de",
		border: "#eed488",
		text: "#8a6715",
	},
	slate: {
		label: "Slate",
		fill: "#eef1f4",
		border: "#c8d0da",
		text: "#53616f",
	},
};

const INITIAL_NODES: DiagramNode[] = [
	{
		id: "group-checkout",
		type: "group",
		x: 92,
		y: 86,
		width: 1070,
		height: 592,
		title: "Checkout workflow",
		subtitle: "Order processing · 5 steps",
		color: "blue",
		locked: false,
		rotation: 0,
	},
	{
		id: "node-start",
		type: "start",
		x: 160,
		y: 210,
		width: 180,
		height: 68,
		title: "Start checkout",
		subtitle: "Customer begins",
		color: "mint",
		locked: false,
		rotation: 0,
		parentId: "group-checkout",
	},
	{
		id: "node-cart",
		type: "process",
		x: 160,
		y: 350,
		width: 196,
		height: 88,
		title: "Create cart",
		subtitle: "Reserve inventory",
		color: "blue",
		locked: false,
		rotation: 0,
		parentId: "group-checkout",
	},
	{
		id: "node-payment",
		type: "decision",
		x: 500,
		y: 335,
		width: 210,
		height: 112,
		title: "Payment valid?",
		subtitle: "Authorize card",
		color: "violet",
		locked: false,
		rotation: 0,
		parentId: "group-checkout",
	},
	{
		id: "node-order",
		type: "process",
		x: 850,
		y: 350,
		width: 205,
		height: 88,
		title: "Confirm order",
		subtitle: "Create fulfillment",
		color: "coral",
		locked: false,
		rotation: 0,
		parentId: "group-checkout",
	},
	{
		id: "node-complete",
		type: "end",
		x: 872,
		y: 510,
		width: 182,
		height: 68,
		title: "Order complete",
		subtitle: "Send confirmation",
		color: "mint",
		locked: false,
		rotation: 0,
		parentId: "group-checkout",
	},
	{
		id: "node-retry",
		type: "note",
		x: 494,
		y: 520,
		width: 222,
		height: 90,
		title: "Retry payment",
		subtitle: "Customer can try another method",
		color: "yellow",
		locked: false,
		rotation: -2,
	},
	{
		id: "node-storage",
		type: "database",
		x: 1160,
		y: 340,
		width: 190,
		height: 94,
		title: "Orders DB",
		subtitle: "Write + index",
		color: "slate",
		locked: true,
		rotation: 0,
	},
];

const INITIAL_EDGES: DiagramEdge[] = [
	{
		id: "edge-start-cart",
		source: "node-start",
		target: "node-cart",
		style: "elbow",
		label: "",
	},
	{
		id: "edge-cart-payment",
		source: "node-cart",
		target: "node-payment",
		style: "curved",
		label: "cart ready",
	},
	{
		id: "edge-payment-order",
		source: "node-payment",
		target: "node-order",
		style: "elbow",
		label: "yes",
	},
	{
		id: "edge-payment-retry",
		source: "node-payment",
		target: "node-retry",
		style: "straight",
		label: "no",
	},
	{
		id: "edge-order-complete",
		source: "node-order",
		target: "node-complete",
		style: "elbow",
		label: "",
	},
	{
		id: "edge-order-storage",
		source: "node-order",
		target: "node-storage",
		style: "straight",
		label: "persist",
	},
];

const TOOL_ITEMS: Array<{
	id: Tool;
	label: string;
	shortcut: string;
	icon: IconName;
}> = [
	{ id: "select", label: "Select", shortcut: "V", icon: "cursor" },
	{ id: "hand", label: "Pan canvas", shortcut: "H", icon: "hand" },
	{ id: "connector", label: "Connect nodes", shortcut: "C", icon: "connector" },
	{ id: "note", label: "Sticky note", shortcut: "N", icon: "note" },
	{ id: "text", label: "Text", shortcut: "T", icon: "text" },
];

const NODE_TYPE_LABELS: Record<NodeType, string> = {
	group: "Group",
	start: "Start",
	process: "Process",
	decision: "Decision",
	database: "Database",
	end: "End",
	note: "Note",
	text: "Text",
};

const EDITABLE_NODE_TYPES: NodeType[] = [
	"start",
	"process",
	"decision",
	"database",
	"end",
	"note",
	"text",
];

const makeId = (prefix: string) =>
	`${prefix}-${Math.random().toString(36).slice(2, 9)}`;

const clamp = (value: number, min: number, max: number) =>
	Math.min(Math.max(value, min), max);

const snap = (value: number, enabled: boolean) =>
	enabled ? Math.round(value / 8) * 8 : value;

const escapeXml = (value: string) =>
	value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");

const formatNumber = (value: number) => Math.round(value * 10) / 10;

const Icon = ({ name, size = 16 }: { name: IconName; size?: number }) => {
	const common = {
		fill: "none",
		stroke: "currentColor",
		strokeLinecap: "round" as const,
		strokeLinejoin: "round" as const,
		strokeWidth: 1.8,
	};

	const paths: Record<IconName, ReactNode> = {
		arrowDown: <path {...common} d="m5 8 3 3 3-3M8 3v8" />,
		arrowRight: <path {...common} d="M3 8h9m-3-3 3 3-3 3" />,
		chevronDown: <path {...common} d="m4 6 4 4 4-4" />,
		chevronLeft: <path {...common} d="m9 4-4 4 4 4" />,
		chevronRight: <path {...common} d="m7 4 4 4-4 4" />,
		chevronUp: <path {...common} d="m4 10 4-4 4 4" />,
		close: <path {...common} d="m4 4 8 8M12 4l-8 8" />,
		command: (
			<path
				{...common}
				d="M5 3a2 2 0 1 0 0 4h6a2 2 0 1 0 0-4M5 9a2 2 0 1 0 0 4 2 2 0 1 0 0-4h6a2 2 0 1 0 0 4"
			/>
		),
		connector: (
			<path
				{...common}
				d="M4 4v3a2 2 0 0 0 2 2h4a2 2 0 0 1 2 2v1M4 4h2M4 4v2"
			/>
		),
		copy: <path {...common} d="M5 5V3h6v2M7 7h5v6H5V7h2Z" />,
		cursor: <path {...common} d="m4 3 7 5-3 .7 1.7 3-1.4.7-1.7-3L4 11V3Z" />,
		database: (
			<path
				{...common}
				d="M3 4c0-1 2.2-1.8 5-1.8S13 3 13 4v8c0 1-2.2 1.8-5 1.8S3 13 3 12V4Zm0 0c0 1 2.2 1.8 5 1.8S13 5 13 4M3 8c0 1 2.2 1.8 5 1.8S13 9 13 8"
			/>
		),
		diamond: <path {...common} d="m8 2 6 6-6 6-6-6 6-6Z" />,
		dots: (
			<path
				fill="currentColor"
				d="M3.5 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM8.5 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM13.5 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
			/>
		),
		download: <path {...common} d="M8 2v7m0 0 3-3m-3 3L5 6M3 11v2h10v-2" />,
		duplicate: (
			<path {...common} d="M5 5h6v6H5zM3 3h6v2H5v4H3V3Zm4 8h4v2H7v-2Z" />
		),
		eye: (
			<path
				{...common}
				d="M2.5 8s2-3.5 5.5-3.5S13.5 8 13.5 8 11 11.5 8 11.5 2.5 8 2.5 8Z"
			/>
		),
		fit: <path {...common} d="M3 6V3h3M10 3h3v3M13 10v3h-3M6 13H3v-3" />,
		folder: <path {...common} d="M2.5 4.5h4l1.3 1.3h4.7v5.7h-10V4.5Z" />,
		grid: <path {...common} d="M3 3h10v10H3zM3 7h10M7 3v10" />,
		group: <path {...common} d="M3 4h4v4H3zM9 6h4v4H9zM5 8v3h4" />,
		hand: (
			<path
				{...common}
				d="M5 8V4a1 1 0 0 1 2 0v3-4a1 1 0 0 1 2 0v4-3a1 1 0 0 1 2 0v4-2a1 1 0 0 1 2 0v4c0 2.3-1.3 4-3.5 4H8c-1.7 0-2.6-.8-3.4-2L3 9.5A1 1 0 0 1 5 8Z"
			/>
		),
		keyboard: (
			<path
				{...common}
				d="M2.5 4.5h11v7h-11zM4.5 7h.1M6.6 7h.1M8.7 7h.1M10.8 7h.1M5 9.5h6"
			/>
		),
		layers: (
			<path
				{...common}
				d="m8 2.5 5 2.7-5 2.7-5-2.7 5-2.7Zm-5 5.5 5 2.7 5-2.7M3 11l5 2.7 5-2.7"
			/>
		),
		link: (
			<path
				{...common}
				d="M6 9 4.8 10.2a2.2 2.2 0 0 1-3-3l2-2a2.2 2.2 0 0 1 3 0M10 7l1.2-1.2a2.2 2.2 0 0 1 3 3l-2 2a2.2 2.2 0 0 1-3 0M5 8h6"
			/>
		),
		lock: <path {...common} d="M4 6h8v7H4zM5.5 6V4.8a2.5 2.5 0 0 1 5 0V6" />,
		minus: <path {...common} d="M3.5 8h9" />,
		more: <path {...common} d="M4 8h.1M8 8h.1M12 8h.1" />,
		moon: (
			<path
				{...common}
				d="M11.8 10.8A5.5 5.5 0 0 1 5.2 4.2 5.5 5.5 0 1 0 11.8 10.8Z"
			/>
		),
		move: (
			<path
				{...common}
				d="M8 2v12M2 8h12M8 2l-2 2m2-2 2 2M8 14l-2-2m2 2 2-2M2 8l2-2m-2 2 2 2M14 8l-2-2m2 2-2 2"
			/>
		),
		note: (
			<path {...common} d="M3 2.8h7l2 2V13H3V2.8Zm7 0v2h2M5 8h5M5 10.5h3" />
		),
		plus: <path {...common} d="M8 3v10M3 8h10" />,
		redo: <path {...common} d="M10 4.5h2.5v2.5M12.5 7a5 5 0 0 0-9 1" />,
		redoAll: (
			<path {...common} d="M10 4.5h2.5v2.5M12.5 7a5 5 0 0 0-9 1M6 11.5H3.5V9" />
		),
		rotate: <path {...common} d="M11 4.5A4.8 4.8 0 1 0 12.5 9M11 2.5v2h2" />,
		search: (
			<path
				{...common}
				d="m10.5 10.5 3 3M6.8 11.5a4.7 4.7 0 1 0 0-9.4 4.7 4.7 0 0 0 0 9.4Z"
			/>
		),
		selectAll: (
			<path
				{...common}
				d="M3 5V3h2M11 3h2v2M13 11v2h-2M5 13H3v-2M6 8h4M8 6v4"
			/>
		),
		settings: (
			<path
				{...common}
				d="M8 2.8v1.5M8 11.7v1.5M2.8 8h1.5M11.7 8h1.5M4.3 4.3l1 1M10.7 10.7l1 1M11.7 4.3l-1 1M5.3 10.7l-1 1M10.5 8A2.5 2.5 0 1 1 5.5 8a2.5 2.5 0 0 1 5 0Z"
			/>
		),
		share: <path {...common} d="M11 5.5 8 8l3 2.5M8 8h5M3 3.5h3v9H3z" />,
		star: (
			<path
				{...common}
				d="m8 2.5 1.7 3.4 3.8.5-2.8 2.7.7 3.8-3.4-1.8-3.4 1.8.7-3.8-2.8-2.7 3.8-.5L8 2.5Z"
			/>
		),
		sun: (
			<path
				{...common}
				d="M8 3V2M8 14v-1M3 8H2M14 8h-1M4.5 4.5l-.7-.7M12.2 12.2l-.7-.7M11.5 4.5l.7-.7M4.5 11.5l-.7.7M10.5 8A2.5 2.5 0 1 1 5.5 8a2.5 2.5 0 0 1 5 0Z"
			/>
		),
		text: <path {...common} d="M3 4V3h10v1M8 3v10M6 13h4" />,
		trash: (
			<path
				{...common}
				d="M3.5 4.5h9M6 4.5V3h4v1.5M5 6v6.5h6V6M7 7.5v3M9 7.5v3"
			/>
		),
		undo: <path {...common} d="M6 4.5H3.5V7M3.5 7a5 5 0 0 1 9 1" />,
		upload: <path {...common} d="M8 12V5m0 0L5 8m3-3 3 3M3 3h10" />,
		zoomIn: (
			<path
				{...common}
				d="m10.5 10.5 3 3M6.8 11.5a4.7 4.7 0 1 0 0-9.4 4.7 4.7 0 0 0 0 9.4ZM6.8 5.5v3M5.3 7h3"
			/>
		),
		zoomOut: (
			<path
				{...common}
				d="m10.5 10.5 3 3M6.8 11.5a4.7 4.7 0 1 0 0-9.4 4.7 4.7 0 0 0 0 9.4ZM5.3 7h3"
			/>
		),
	};

	return (
		<svg aria-hidden="true" height={size} viewBox="0 0 16 16" width={size}>
			{paths[name]}
		</svg>
	);
};

type IconName =
	| "arrowDown"
	| "arrowRight"
	| "chevronDown"
	| "chevronLeft"
	| "chevronRight"
	| "chevronUp"
	| "close"
	| "command"
	| "connector"
	| "copy"
	| "cursor"
	| "database"
	| "diamond"
	| "dots"
	| "download"
	| "duplicate"
	| "eye"
	| "fit"
	| "folder"
	| "grid"
	| "group"
	| "hand"
	| "keyboard"
	| "layers"
	| "link"
	| "lock"
	| "minus"
	| "more"
	| "moon"
	| "move"
	| "note"
	| "plus"
	| "redo"
	| "redoAll"
	| "rotate"
	| "search"
	| "selectAll"
	| "settings"
	| "share"
	| "star"
	| "sun"
	| "text"
	| "trash"
	| "undo"
	| "upload"
	| "zoomIn"
	| "zoomOut";

const nodeIcon = (type: NodeType): IconName => {
	switch (type) {
		case "database":
			return "database";
		case "decision":
			return "diamond";
		case "group":
			return "group";
		case "note":
			return "note";
		case "text":
			return "text";
		default:
			return "arrowRight";
	}
};

const nodeTypeLabel = (type: NodeType) => NODE_TYPE_LABELS[type];

const getWorldPoint = (
	event: { clientX: number; clientY: number },
	viewport: HTMLDivElement | null,
	view: Point & { zoom: number },
): Point => {
	if (!viewport) return { x: 0, y: 0 };
	const rect = viewport.getBoundingClientRect();
	return {
		x: (event.clientX - rect.left - view.x) / view.zoom,
		y: (event.clientY - rect.top - view.y) / view.zoom,
	};
};

const getNodeCenter = (node: DiagramNode): Point => ({
	x: node.x + node.width / 2,
	y: node.y + node.height / 2,
});

const rotateVector = (vector: Point, degrees: number): Point => {
	const radians = (degrees * Math.PI) / 180;
	const cosine = Math.cos(radians);
	const sine = Math.sin(radians);
	return {
		x: vector.x * cosine - vector.y * sine,
		y: vector.x * sine + vector.y * cosine,
	};
};

const getConnectionPoint = (
	source: DiagramNode,
	target: DiagramNode,
): Point => {
	const sourceCenter = getNodeCenter(source);
	const targetCenter = getNodeCenter(target);
	const direction = rotateVector(
		{
			x: targetCenter.x - sourceCenter.x,
			y: targetCenter.y - sourceCenter.y,
		},
		-source.rotation,
	);
	const safeDirection =
		Math.abs(direction.x) + Math.abs(direction.y) > 0
			? direction
			: { x: 0, y: -1 };
	const halfWidth = source.width / 2;
	const halfHeight = source.height / 2;
	const boundaryRatio =
		source.type === "decision"
			? Math.abs(safeDirection.x) / halfWidth +
				Math.abs(safeDirection.y) / halfHeight
			: Math.max(
					Math.abs(safeDirection.x) / halfWidth,
					Math.abs(safeDirection.y) / halfHeight,
				);
	const scale = boundaryRatio > 0 ? 1 / boundaryRatio : 0;
	const localPoint = {
		x: safeDirection.x * scale,
		y: safeDirection.y * scale,
	};
	const rotatedPoint = rotateVector(localPoint, source.rotation);
	return {
		x: sourceCenter.x + rotatedPoint.x,
		y: sourceCenter.y + rotatedPoint.y,
	};
};

const getEdgeGeometry = (
	source: DiagramNode,
	target: DiagramNode,
	style: EdgeStyle,
) => {
	const start = getConnectionPoint(source, target);
	const end = getConnectionPoint(target, source);
	const midpointX = (start.x + end.x) / 2;
	const midpointY = (start.y + end.y) / 2;

	if (style === "straight") {
		return {
			path: `M ${start.x} ${start.y} L ${end.x} ${end.y}`,
			labelPoint: { x: midpointX, y: midpointY },
		};
	}

	if (style === "curved") {
		const curveOffset = Math.max(70, Math.abs(end.x - start.x) * 0.42);
		return {
			path: `M ${start.x} ${start.y} C ${start.x + curveOffset} ${start.y}, ${end.x - curveOffset} ${end.y}, ${end.x} ${end.y}`,
			labelPoint: { x: midpointX, y: midpointY - 14 },
		};
	}

	return {
		path: `M ${start.x} ${start.y} L ${midpointX} ${start.y} L ${midpointX} ${end.y} L ${end.x} ${end.y}`,
		labelPoint: { x: midpointX, y: midpointY - 12 },
	};
};

const getVisibleNodes = (nodes: DiagramNode[]) => {
	const nodeMap = new Map(nodes.map((node) => [node.id, node]));
	return nodes.filter((node) => {
		if (node.hidden) return false;
		let parentId = node.parentId;
		const visitedParents = new Set<string>();
		while (parentId) {
			if (visitedParents.has(parentId)) return false;
			visitedParents.add(parentId);
			const parent = nodeMap.get(parentId);
			if (!parent) break;
			if (parent.hidden || parent.collapsed) return false;
			parentId = parent.parentId;
		}
		return true;
	});
};

interface Rect {
	x: number;
	y: number;
	width: number;
	height: number;
}

const getNodeRect = (node: DiagramNode): Rect => ({
	x: node.x,
	y: node.y,
	width: node.width,
	height: node.height,
});

const containsRect = (outer: Rect, inner: Rect) =>
	inner.x >= outer.x &&
	inner.y >= outer.y &&
	inner.x + inner.width <= outer.x + outer.width &&
	inner.y + inner.height <= outer.y + outer.height;

const rectanglesOverlap = (first: Rect, second: Rect) =>
	first.x < second.x + second.width &&
	first.x + first.width > second.x &&
	first.y < second.y + second.height &&
	first.y + first.height > second.y;

const hasOverlappingGroups = (nodes: DiagramNode[]) => {
	const groups = nodes.filter((node) => node.type === "group");
	return groups.some((group, index) =>
		groups
			.slice(index + 1)
			.some((other) =>
				rectanglesOverlap(getNodeRect(group), getNodeRect(other)),
			),
	);
};

const findContainingGroup = (
	node: DiagramNode,
	nodes: DiagramNode[],
): DiagramNode | undefined => {
	const nodeRect = getNodeRect(node);
	return nodes
		.filter(
			(group) =>
				group.type === "group" &&
				group.id !== node.id &&
				containsRect(getNodeRect(group), nodeRect),
		)
		.sort(
			(first, second) =>
				first.width * first.height - second.width * second.height,
		)[0];
};

const syncGroupMembership = (nodes: DiagramNode[]) => {
	const groups = nodes.filter((node) => node.type === "group");
	let changed = false;
	const nextNodes = nodes.map((node) => {
		if (node.type === "group") return node;
		const currentParent = groups.find((group) => group.id === node.parentId);
		const currentParentContains = currentParent
			? containsRect(getNodeRect(currentParent), getNodeRect(node))
			: false;
		const containingGroup = currentParentContains
			? currentParent
			: findContainingGroup(node, groups);
		const nextParentId = containingGroup?.id;
		if (node.parentId === nextParentId) return node;
		changed = true;
		const nextNode = { ...node };
		if (nextParentId) nextNode.parentId = nextParentId;
		else delete nextNode.parentId;
		return nextNode;
	});
	return changed ? nextNodes : nodes;
};

const getDescendantIds = (nodes: DiagramNode[], parentId: string) => {
	const descendants = new Set<string>();
	let changed = true;
	while (changed) {
		changed = false;
		for (const node of nodes) {
			if (
				node.parentId &&
				(node.parentId === parentId || descendants.has(node.parentId)) &&
				!descendants.has(node.id)
			) {
				descendants.add(node.id);
				changed = true;
			}
		}
	}
	return descendants;
};

const getBounds = (nodes: DiagramNode[]) => {
	if (nodes.length === 0)
		return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
	const minX = Math.min(...nodes.map((node) => node.x));
	const minY = Math.min(...nodes.map((node) => node.y));
	const maxX = Math.max(...nodes.map((node) => node.x + node.width));
	const maxY = Math.max(...nodes.map((node) => node.y + node.height));
	return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
};

function ToolButton({
	active,
	icon,
	label,
	shortcut,
	onClick,
}: {
	active: boolean;
	icon: IconName;
	label: string;
	shortcut?: string;
	onClick: () => void;
}) {
	return (
		<button
			aria-label={label}
			className={`tool-button${active ? " active" : ""}`}
			onClick={onClick}
			title={`${label}${shortcut ? ` · ${shortcut}` : ""}`}
			type="button"
		>
			<Icon name={icon} />
			{shortcut ? <span className="tool-shortcut">{shortcut}</span> : null}
		</button>
	);
}

function FlowcraftEditor() {
	const [nodes, setNodes] = useState<DiagramNode[]>(INITIAL_NODES);
	const [edges, setEdges] = useState<DiagramEdge[]>(INITIAL_EDGES);
	const [selectedIds, setSelectedIds] = useState<string[]>(["node-payment"]);
	const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
	const [tool, setTool] = useState<Tool>("select");
	const [spacePressed, setSpacePressed] = useState(false);
	const [edgeStyle, setEdgeStyle] = useState<EdgeStyle>("elbow");
	const [theme, setTheme] = useState<Theme>("light");
	const [showGrid, setShowGrid] = useState(true);
	const [snapToGrid, setSnapToGrid] = useState(true);
	const [view, setViewState] = useState({ x: -16, y: -34, zoom: 0.84 });
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
	const [saveState, setSaveState] = useState<"saved" | "saving">("saved");
	const [savePulse, setSavePulse] = useState(0);
	const [toast, setToast] = useState<string | null>(null);
	const [inspectorQuery, setInspectorQuery] = useState("");
	const [projectName, setProjectName] = useState("Checkout flow");
	const [viewportSize, setViewportSize] = useState({ width: 900, height: 700 });
	const [exportOpen, setExportOpen] = useState(false);

	const viewportRef = useRef<HTMLDivElement | null>(null);
	const fileInputRef = useRef<HTMLInputElement | null>(null);
	const interactionRef = useRef<InteractionState | null>(null);
	const viewRef = useRef(view);
	const nodesRef = useRef(nodes);
	const edgesRef = useRef(edges);
	const clipboardRef = useRef<ClipboardData | null>(null);
	const historyRef = useRef<HistoryEntry[]>([
		{ nodes: INITIAL_NODES, edges: INITIAL_EDGES },
	]);
	const historyIndexRef = useRef(0);
	const [, setHistoryIndex] = useState(0);
	const originalTitleRef = useRef<string | null>(null);

	const updateView = useCallback(
		(next: { x: number; y: number; zoom: number }) => {
			viewRef.current = next;
			setViewState(next);
		},
		[],
	);

	const showToast = useCallback((message: string) => {
		setToast(message);
		window.setTimeout(() => setToast(null), 2100);
	}, []);

	const markSaving = useCallback(() => {
		setSaveState("saving");
		setSavePulse((pulse) => pulse + 1);
	}, []);

	const recordSnapshot = useCallback(
		(nextNodes = nodesRef.current, nextEdges = edgesRef.current) => {
			if (hasOverlappingGroups(nextNodes)) {
				showToast("Groups cannot overlap");
				return false;
			}
			nodesRef.current = nextNodes;
			edgesRef.current = nextEdges;
			setNodes(nextNodes);
			setEdges(nextEdges);
			const nextIndex = historyIndexRef.current + 1;
			const nextHistory = [
				...historyRef.current.slice(0, nextIndex),
				{ nodes: nextNodes, edges: nextEdges },
			];
			historyRef.current = nextHistory;
			historyIndexRef.current = nextIndex;
			setHistoryIndex(nextIndex);
			markSaving();
			return true;
		},
		[markSaving, showToast],
	);

	const updateNodesLive = useCallback(
		(updater: (current: DiagramNode[]) => DiagramNode[]) => {
			const nextNodes = updater(nodesRef.current);
			nodesRef.current = nextNodes;
			setNodes(nextNodes);
		},
		[],
	);

	const updateNodePatch = useCallback(
		(nodeId: string, patch: Partial<DiagramNode>) => {
			const nextNodes = nodesRef.current.map((node) =>
				node.id === nodeId ? { ...node, ...patch } : node,
			);
			recordSnapshot(nextNodes, edgesRef.current);
		},
		[recordSnapshot],
	);

	const undo = useCallback(() => {
		const nextIndex = Math.max(historyIndexRef.current - 1, 0);
		if (nextIndex === historyIndexRef.current) return;
		const entry = historyRef.current[nextIndex];
		if (!entry) return;
		historyIndexRef.current = nextIndex;
		setHistoryIndex(nextIndex);
		nodesRef.current = entry.nodes;
		edgesRef.current = entry.edges;
		setNodes(entry.nodes);
		setEdges(entry.edges);
		setSaveState("saving");
	}, []);

	const redo = useCallback(() => {
		const nextIndex = Math.min(
			historyIndexRef.current + 1,
			historyRef.current.length - 1,
		);
		if (nextIndex === historyIndexRef.current) return;
		const entry = historyRef.current[nextIndex];
		if (!entry) return;
		historyIndexRef.current = nextIndex;
		setHistoryIndex(nextIndex);
		nodesRef.current = entry.nodes;
		edgesRef.current = entry.edges;
		setNodes(entry.nodes);
		setEdges(entry.edges);
		setSaveState("saving");
	}, []);

	useEffect(() => {
		nodesRef.current = nodes;
	}, [nodes]);

	useEffect(() => {
		edgesRef.current = edges;
	}, [edges]);

	useEffect(() => {
		if (!savePulse) return;
		const timeout = window.setTimeout(() => {
			setSaveState("saved");
			try {
				window.localStorage.setItem(
					"flowcraft-diagram",
					JSON.stringify({ nodes: nodesRef.current, edges: edgesRef.current }),
				);
			} catch {
				// Local persistence is a convenience; a restricted browser should not block editing.
			}
		}, 750);
		return () => window.clearTimeout(timeout);
	}, [savePulse]);

	useEffect(() => {
		const viewport = viewportRef.current;
		if (!viewport) return;
		const resizeObserver = new ResizeObserver((entries) => {
			const entry = entries[0];
			if (!entry) return;
			setViewportSize({
				width: entry.contentRect.width,
				height: entry.contentRect.height,
			});
		});
		resizeObserver.observe(viewport);
		return () => resizeObserver.disconnect();
	}, []);

	useEffect(() => {
		const handlePointerDown = () => {
			setContextMenu(null);
			setExportOpen(false);
		};
		document.addEventListener("pointerdown", handlePointerDown);
		return () => document.removeEventListener("pointerdown", handlePointerDown);
	}, []);

	useEffect(() => {
		if (tool !== "note") setNoteCursor(null);
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
				recordSnapshot(nodesRef.current, edgesRef.current);
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

	const fitView = useCallback(() => {
		const viewport = viewportRef.current;
		if (!viewport) return;
		const fitNodes = nodes.filter((node) => node.type !== "group");
		const bounds = getBounds(fitNodes);
		const padding = 120;
		const zoom = clamp(
			Math.min(
				(viewport.clientWidth - padding) / (bounds.width || 1),
				(viewport.clientHeight - padding) / (bounds.height || 1),
			),
			0.35,
			1.2,
		);
		updateView({
			x: viewport.clientWidth / 2 - (bounds.minX + bounds.width / 2) * zoom,
			y: viewport.clientHeight / 2 - (bounds.minY + bounds.height / 2) * zoom,
			zoom,
		});
		showToast("Fit to selection");
	}, [nodes, showToast, updateView]);

	const zoomAt = useCallback(
		(clientX: number, clientY: number, factor: number) => {
			const viewport = viewportRef.current;
			if (!viewport) return;
			const currentView = viewRef.current;
			const rect = viewport.getBoundingClientRect();
			const localX = clientX - rect.left;
			const localY = clientY - rect.top;
			const worldX = (localX - currentView.x) / currentView.zoom;
			const worldY = (localY - currentView.y) / currentView.zoom;
			const zoom = clamp(currentView.zoom * factor, 0.35, 2.2);
			updateView({
				x: localX - worldX * zoom,
				y: localY - worldY * zoom,
				zoom,
			});
		},
		[updateView],
	);

	const zoomCanvas = useCallback(
		(factor: number) => {
			const viewport = viewportRef.current;
			if (!viewport) return;
			const rect = viewport.getBoundingClientRect();
			zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor);
		},
		[zoomAt],
	);

	const resetZoom = useCallback(() => {
		const currentZoom = viewRef.current.zoom;
		if (currentZoom === 1) return;
		zoomCanvas(1 / currentZoom);
	}, [zoomCanvas]);

	useEffect(() => {
		const viewport = viewportRef.current;
		if (!viewport) return;
		const handleWheel = (event: WheelEvent) => {
			event.preventDefault();
			if (event.ctrlKey || event.metaKey) {
				if (event.deltaY === 0) return;
				const factor = event.deltaY > 0 ? 0.96 : 1.04;
				zoomAt(event.clientX, event.clientY, factor);
				return;
			}
			updateView({
				x: viewRef.current.x - event.deltaX,
				y: viewRef.current.y - event.deltaY,
				zoom: viewRef.current.zoom,
			});
		};
		viewport.addEventListener("wheel", handleWheel, { passive: false });
		return () => viewport.removeEventListener("wheel", handleWheel);
	}, [updateView, zoomAt]);

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
			if (tool === "note" && !spacePressed) setNoteCursor(world);
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
			if (activeElement instanceof HTMLInputElement) activeElement.blur();
			const isPanning = event.button === 1 || tool === "hand" || spacePressed;
			const element = event.target as Element;
			if (
				!isPanning &&
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
					x: snap(world.x - 96, snapToGrid),
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
			"checkout-flow.flowcraft.json",
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

	const handleKeyDown = useCallback(
		(event: KeyboardEvent) => {
			const target = event.target as HTMLElement;
			const isTyping =
				target.tagName === "INPUT" ||
				target.tagName === "TEXTAREA" ||
				target.tagName === "SELECT" ||
				target.isContentEditable;
			if (event.key === "Escape") {
				if (editingNodeId) finishEditing(false);
				else if (commandOpen) {
					setCommandOpen(false);
					setCommandQuery("");
				} else if (contextMenu) setContextMenu(null);
				return;
			}
			if (commandOpen && isTyping) {
				if (event.key === "ArrowDown") {
					event.preventDefault();
					setCommandIndex((index) =>
						commandItems.length ? (index + 1) % commandItems.length : 0,
					);
					return;
				}
				if (event.key === "ArrowUp") {
					event.preventDefault();
					setCommandIndex((index) =>
						commandItems.length
							? (index - 1 + commandItems.length) % commandItems.length
							: 0,
					);
					return;
				}
				if (event.key === "Enter") {
					event.preventDefault();
					const command = commandItems[commandIndex];
					if (command) {
						command.action();
						setCommandOpen(false);
						setCommandQuery("");
					}
					return;
				}
			}
			if (event.code === "Space" && !isTyping) {
				event.preventDefault();
				setSpacePressed(true);
				return;
			}
			if (isTyping) return;
			const modifier = event.metaKey || event.ctrlKey;
			if (modifier && event.key.toLowerCase() === "z") {
				event.preventDefault();
				if (event.shiftKey) redo();
				else undo();
				return;
			}
			if (modifier && event.key.toLowerCase() === "y") {
				event.preventDefault();
				redo();
				return;
			}
			if (modifier && event.key.toLowerCase() === "k") {
				event.preventDefault();
				setCommandOpen(true);
				return;
			}
			if (modifier && event.key.toLowerCase() === "c") {
				event.preventDefault();
				copySelected();
				return;
			}
			if (modifier && event.key.toLowerCase() === "v") {
				event.preventDefault();
				pasteClipboard();
				return;
			}
			if (modifier && event.key.toLowerCase() === "d") {
				event.preventDefault();
				duplicateSelected();
				return;
			}
			if (modifier && event.key.toLowerCase() === "g") {
				event.preventDefault();
				if (event.shiftKey) ungroupSelection();
				else groupSelection();
				return;
			}
			if (event.key === "Delete" || event.key === "Backspace") {
				event.preventDefault();
				deleteSelected();
				return;
			}
			if (event.key === "?") {
				setCommandOpen(true);
				setCommandQuery("shortcut");
				return;
			}
			const key = event.key.toLowerCase();
			const shortcutTool = TOOL_ITEMS.find(
				(item) => item.shortcut.toLowerCase() === key,
			);
			if (shortcutTool) {
				setTool(shortcutTool.id);
				return;
			}
			if (
				selectedIds.length &&
				["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
			) {
				event.preventDefault();
				const amount = event.shiftKey ? 8 : 1;
				const delta: Point =
					event.key === "ArrowLeft"
						? { x: -amount, y: 0 }
						: event.key === "ArrowRight"
							? { x: amount, y: 0 }
							: event.key === "ArrowUp"
								? { x: 0, y: -amount }
								: { x: 0, y: amount };
				const nextNodes = nodesRef.current.map((node) =>
					selectedIds.includes(node.id) && !node.locked
						? { ...node, x: node.x + delta.x, y: node.y + delta.y }
						: node,
				);
				recordSnapshot(nextNodes, edgesRef.current);
			}
		},
		[
			commandIndex,
			commandItems,
			commandOpen,
			contextMenu,
			copySelected,
			deleteSelected,
			duplicateSelected,
			editingNodeId,
			finishEditing,
			groupSelection,
			pasteClipboard,
			redo,
			recordSnapshot,
			selectedIds,
			undo,
			ungroupSelection,
		],
	);

	useEffect(() => {
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [handleKeyDown]);

	useEffect(() => {
		const handleKeyUp = (event: KeyboardEvent) => {
			if (event.code === "Space") setSpacePressed(false);
		};
		const handleWindowBlur = () => setSpacePressed(false);
		window.addEventListener("keyup", handleKeyUp);
		window.addEventListener("blur", handleWindowBlur);
		return () => {
			window.removeEventListener("keyup", handleKeyUp);
			window.removeEventListener("blur", handleWindowBlur);
		};
	}, []);

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

	const minimapScale = 174 / WORLD_WIDTH;
	const minimapViewport = {
		x: (-view.x / view.zoom) * minimapScale,
		y: (-view.y / view.zoom) * minimapScale,
		width: (viewportSize.width / view.zoom) * minimapScale,
		height: (viewportSize.height / view.zoom) * minimapScale,
	};
	const canvasPosition = {
		x: -view.x / view.zoom,
		y: -view.y / view.zoom,
	};

	const handleMinimapClick = useCallback(
		(event: ReactMouseEvent<HTMLButtonElement>) => {
			const rect = event.currentTarget.getBoundingClientRect();
			const worldPoint = {
				x: (event.clientX - rect.left) / minimapScale,
				y: (event.clientY - rect.top) / minimapScale,
			};
			updateView({
				x: viewportSize.width / 2 - worldPoint.x * viewRef.current.zoom,
				y: viewportSize.height / 2 - worldPoint.y * viewRef.current.zoom,
				zoom: viewRef.current.zoom,
			});
		},
		[minimapScale, updateView, viewportSize],
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
					<span className="brand-name">flowcraft</span>
				</div>
				<div className="project-breadcrumb">
					<span>Projects</span>
					<Icon name="chevronRight" size={13} />
					<span>Checkout flow</span>
					<button
						aria-label="Rename project"
						className="project-name-button"
						onClick={() =>
							setProjectName(
								projectName === "Checkout flow" ? "Checkout flow" : projectName,
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
									Export editable JSON<span>flowcraft</span>
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
								onClick={autoArrange}
								type="button"
							>
								<Icon name="move" size={14} />
								Arrange
							</button>
							<button className="canvas-action" onClick={fitView} type="button">
								<Icon name="fit" size={14} />
								Fit
							</button>
							<button
								aria-pressed={showGrid}
								className={`canvas-action${showGrid ? " is-on" : ""}`}
								onClick={() => setShowGrid((value) => !value)}
								type="button"
							>
								<Icon name="grid" size={14} />
								Grid
							</button>
							<button
								aria-pressed={snapToGrid}
								className={`canvas-action${snapToGrid ? " is-on" : ""}`}
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
						className={`canvas-viewport${tool === "hand" ? " hand-mode" : ""}${tool === "note" ? " note-mode" : ""}${spacePressed ? " space-mode" : ""}${showGrid ? " show-grid" : ""}`}
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
							{tool === "note" && !spacePressed && noteCursor ? (
								<div
									aria-hidden="true"
									className="note-cursor-preview"
									style={{
										left: noteCursor.x - 96,
										top: noteCursor.y - 50,
									}}
								>
									<span className="note-cursor-icon">
										<Icon name="note" size={13} />
									</span>
									<strong>New note</strong>
									<small>Add a thought</small>
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
								onClick={() => zoomCanvas(0.86)}
								type="button"
							>
								<Icon name="minus" size={14} />
							</button>
							<button
								aria-label="Reset zoom to 100%"
								className="zoom-label"
								onClick={resetZoom}
								type="button"
							>
								{Math.round(view.zoom * 100)}%
							</button>
							<button
								aria-label="Zoom in"
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

function EdgeLayer({
	edges,
	nodeMap,
	visibleNodeIds,
	selectedEdgeId,
	connection,
	onSelect,
}: {
	edges: DiagramEdge[];
	nodeMap: Map<string, DiagramNode>;
	visibleNodeIds: Set<string>;
	selectedEdgeId: string | null;
	connection: ConnectionState | null;
	onSelect: (edgeId: string) => void;
}) {
	return (
		<svg
			aria-label="Connections"
			className="diagram-edges"
			height={WORLD_HEIGHT}
			viewBox={`0 0 ${WORLD_WIDTH} ${WORLD_HEIGHT}`}
			width={WORLD_WIDTH}
		>
			<defs>
				<marker
					id="edge-arrow"
					markerHeight="7"
					markerWidth="7"
					orient="auto-start-reverse"
					refX="6"
					refY="3.5"
					viewBox="0 0 7 7"
				>
					<path d="M 0 0 L 7 3.5 L 0 7 z" fill="currentColor" />
				</marker>
			</defs>
			{edges
				.filter(
					(edge) =>
						visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target),
				)
				.map((edge) => {
					const source = nodeMap.get(edge.source);
					const target = nodeMap.get(edge.target);
					if (!source || !target) return null;
					const geometry = getEdgeGeometry(source, target, edge.style);
					return (
						<g
							className={`edge-group${selectedEdgeId === edge.id ? " selected" : ""}`}
							data-edge-id={edge.id}
							key={edge.id}
							onPointerDown={(event) => {
								event.stopPropagation();
								onSelect(edge.id);
							}}
						>
							<path className="edge-hit-area" d={geometry.path} />
							<path
								className="edge-path"
								d={geometry.path}
								markerEnd="url(#edge-arrow)"
							/>
							{edge.label ? (
								<foreignObject
									className="edge-label-foreign"
									height="30"
									width="130"
									x={geometry.labelPoint.x - 65}
									y={geometry.labelPoint.y - 15}
								>
									<div className="edge-label">{edge.label}</div>
								</foreignObject>
							) : null}
						</g>
					);
				})}
			{connection ? (
				<path
					className="connection-preview"
					d={`M ${connection.start.x} ${connection.start.y} C ${connection.start.x + 80} ${connection.start.y}, ${connection.current.x - 80} ${connection.current.y}, ${connection.current.x} ${connection.current.y}`}
				/>
			) : null}
		</svg>
	);
}

function NodeView({
	node,
	selected,
	showHandles,
	editing,
	onPointerDown,
	onDoubleClick,
	onBeginResize,
	onBeginRotate,
	onCollapse,
	onTitleChange,
	onTitleCommit,
	onTitleCancel,
}: {
	node: DiagramNode;
	selected: boolean;
	showHandles: boolean;
	editing: boolean;
	onPointerDown: (
		event: ReactPointerEvent<HTMLDivElement>,
		nodeId: string,
	) => void;
	onDoubleClick: (node: DiagramNode) => void;
	onBeginResize: (
		event: ReactPointerEvent<HTMLButtonElement>,
		node: DiagramNode,
	) => void;
	onBeginRotate: (
		event: ReactPointerEvent<HTMLButtonElement>,
		node: DiagramNode,
	) => void;
	onCollapse: (nodeId: string) => void;
	onTitleChange: (nodeId: string, title: string) => void;
	onTitleCommit: () => void;
	onTitleCancel: () => void;
}) {
	const isGroup = node.type === "group";
	const titleInputRef = useRef<HTMLInputElement | null>(null);
	useEffect(() => {
		if (!editing) return;
		const frame = window.requestAnimationFrame(() => {
			titleInputRef.current?.focus({ preventScroll: true });
			titleInputRef.current?.select();
		});
		return () => window.cancelAnimationFrame(frame);
	}, [editing]);
	const nodeStyle: CSSProperties = {
		left: node.x,
		top: node.y,
		width: node.width,
		height: node.height,
		transform: `rotate(${node.rotation}deg)`,
	};
	return (
		<div
			aria-label={`${node.title}, ${nodeTypeLabel(node.type)}${node.locked ? ", locked" : ""}`}
			className={`diagram-node node-${node.type} color-${node.color}${selected ? " selected" : ""}${node.locked ? " locked" : ""}${node.collapsed ? " collapsed" : ""}`}
			data-node-id={node.id}
			onDoubleClick={(event) => {
				event.stopPropagation();
				onDoubleClick(node);
			}}
			onPointerDown={(event) => onPointerDown(event, node.id)}
			aria-selected={selected}
			role="treeitem"
			tabIndex={selected ? 0 : -1}
			style={nodeStyle}
		>
			{isGroup ? (
				<>
					<div className="group-header">
						<span className="group-icon">
							<Icon name="group" size={14} />
						</span>
						<div>
							<strong>{node.title}</strong>
							<small>{node.subtitle}</small>
						</div>
						<button
							aria-label={node.collapsed ? "Expand group" : "Collapse group"}
							className="group-collapse"
							onClick={(event) => {
								event.stopPropagation();
								onCollapse(node.id);
							}}
							type="button"
						>
							<Icon
								name={node.collapsed ? "chevronRight" : "chevronDown"}
								size={14}
							/>
						</button>
					</div>
					<div className="group-body" />
				</>
			) : (
				<>
					<div className="node-accent" />
					{node.locked ? (
						<span className="node-lock-badge" aria-hidden="true">
							<Icon name="lock" size={11} />
						</span>
					) : null}
					<div className="node-content">
						{editing ? (
							<input
								aria-label={`Edit ${node.title}`}
								className="node-title-input"
								onBlur={onTitleCommit}
								onChange={(event) => onTitleChange(node.id, event.target.value)}
								onKeyDown={(event: ReactKeyboardEvent<HTMLInputElement>) => {
									event.stopPropagation();
									if (event.key === "Enter") event.currentTarget.blur();
									if (event.key === "Escape") onTitleCancel();
								}}
								onPointerDown={(event) => event.stopPropagation()}
								ref={titleInputRef}
								value={node.title}
							/>
						) : (
							<div className="node-title">{node.title}</div>
						)}
						{node.subtitle ? (
							<div className="node-subtitle">{node.subtitle}</div>
						) : null}
					</div>
				</>
			)}
			{showHandles && !node.locked ? (
				<>
					{isGroup ? null : (
						<div className="connection-points" aria-hidden="true">
							<span className="connection-point point-top" />
							<span className="connection-point point-right" />
							<span className="connection-point point-bottom" />
							<span className="connection-point point-left" />
						</div>
					)}
					{isGroup ? null : (
						<button
							aria-label="Rotate node"
							className="rotate-handle"
							onPointerDown={(event) => onBeginRotate(event, node)}
							type="button"
						>
							<Icon name="rotate" size={12} />
						</button>
					)}
					<button
						aria-label="Resize node"
						className="resize-handle"
						onPointerDown={(event) => onBeginResize(event, node)}
						type="button"
					/>
				</>
			) : null}
		</div>
	);
}

function MiniMap({
	nodes,
	viewport,
	onClick,
}: {
	nodes: DiagramNode[];
	viewport: { x: number; y: number; width: number; height: number };
	onClick: (event: ReactMouseEvent<HTMLButtonElement>) => void;
}) {
	const scale = 174 / WORLD_WIDTH;
	return (
		<button
			aria-label="Diagram minimap"
			className="minimap"
			onClick={onClick}
			type="button"
		>
			<div className="minimap-canvas">
				{nodes
					.filter((node) => node.type !== "group")
					.map((node) => (
						<span
							className={`minimap-node minimap-${node.color}`}
							key={node.id}
							style={{
								left: node.x * scale,
								top: node.y * scale,
								width: node.width * scale,
								height: node.height * scale,
							}}
						/>
					))}
				<span
					className="minimap-viewport"
					style={{
						left: viewport.x,
						top: viewport.y,
						width: viewport.width,
						height: viewport.height,
					}}
				/>
			</div>
			<div className="minimap-label">
				<Icon name="move" size={12} />
				Overview
			</div>
		</button>
	);
}

function InspectorNumberField({
	id,
	value,
	min,
	max,
	suffix,
	icon,
	onCommit,
}: {
	id: string;
	value: number;
	min?: number;
	max?: number;
	suffix: string;
	icon?: IconName;
	onCommit: (value: number) => void;
}) {
	const inputRef = useRef<HTMLInputElement | null>(null);
	const cancelCommitRef = useRef(false);
	const [draft, setDraft] = useState(() => String(Math.round(value)));
	const displayValue = String(Math.round(value));

	useEffect(() => {
		if (document.activeElement !== inputRef.current) setDraft(displayValue);
	}, [displayValue]);

	const commitValue = useCallback(
		(parsed: number) => {
			if (!Number.isFinite(parsed)) {
				setDraft(displayValue);
				return;
			}
			const nextValue = clamp(parsed, min ?? -Infinity, max ?? Infinity);
			setDraft(String(Math.round(nextValue)));
			if (nextValue !== value) onCommit(nextValue);
		},
		[displayValue, max, min, onCommit, value],
	);

	const commit = useCallback(() => {
		const rawValue = inputRef.current?.value ?? draft;
		if (rawValue.trim() === "") {
			setDraft(displayValue);
			return;
		}
		commitValue(Number(rawValue));
	}, [commitValue, displayValue, draft]);

	const stepValue = useCallback(
		(direction: 1 | -1) => {
			const rawValue = inputRef.current?.value ?? draft;
			const currentValue = Number(rawValue);
			const baseValue = Number.isFinite(currentValue) ? currentValue : value;
			commitValue(baseValue + direction);
			inputRef.current?.focus({ preventScroll: true });
		},
		[commitValue, draft, value],
	);

	const handleStepKeyDown = useCallback(
		(event: ReactKeyboardEvent<HTMLButtonElement>, direction: 1 | -1) => {
			if (event.key !== "Enter" && event.key !== " ") return;
			event.preventDefault();
			stepValue(direction);
		},
		[stepValue],
	);

	return (
		<div className="input-with-suffix">
			{icon ? <Icon name={icon} size={13} /> : null}
			<input
				id={id}
				inputMode="numeric"
				max={max}
				min={min}
				onBlur={() => {
					if (cancelCommitRef.current) {
						cancelCommitRef.current = false;
						return;
					}
					commit();
				}}
				onKeyDown={(event) => {
					if (event.key === "Enter") {
						event.preventDefault();
						event.currentTarget.blur();
					}
					if (event.key === "Escape") {
						event.preventDefault();
						cancelCommitRef.current = true;
						setDraft(String(Math.round(value)));
						event.currentTarget.blur();
					}
				}}
				ref={inputRef}
				step="1"
				type="number"
				value={draft}
				onInput={(event) => setDraft(event.currentTarget.value)}
				onChange={(event) => setDraft(event.currentTarget.value)}
			/>
			<div className="number-stepper">
				<button
					aria-label={`Increase ${id}`}
					onClick={() => stepValue(1)}
					onKeyDown={(event) => handleStepKeyDown(event, 1)}
					type="button"
				>
					<Icon name="chevronUp" size={10} />
				</button>
				<button
					aria-label={`Decrease ${id}`}
					onClick={() => stepValue(-1)}
					onKeyDown={(event) => handleStepKeyDown(event, -1)}
					type="button"
				>
					<Icon name="chevronDown" size={10} />
				</button>
			</div>
			<span>{suffix}</span>
		</div>
	);
}

function PropertiesPanel({
	node,
	edge,
	nodeCount,
	showGrid,
	snapToGrid,
	onChangeColor,
	onChangeEdgeStyle,
	onChangeTitle,
	onChangeSubtitle,
	onCommitTitle,
	onCommitSubtitle,
	onUpdateNode,
	onUpdateEdgeLabel,
	onDuplicate,
	onGroup,
	onUngroup,
	onLock,
	onToggleGrid,
	onToggleSnap,
}: {
	node?: DiagramNode;
	edge?: DiagramEdge;
	nodeCount: number;
	showGrid: boolean;
	snapToGrid: boolean;
	onChangeColor: (color: NodeColor) => void;
	onChangeEdgeStyle: (style: EdgeStyle) => void;
	onChangeTitle: (title: string) => void;
	onChangeSubtitle: (subtitle: string) => void;
	onCommitTitle: () => void;
	onCommitSubtitle: () => void;
	onUpdateNode: (patch: Partial<DiagramNode>) => void;
	onUpdateEdgeLabel: (label: string) => void;
	onDuplicate: () => void;
	onGroup: () => void;
	onUngroup: () => void;
	onLock: () => void;
	onToggleGrid: () => void;
	onToggleSnap: () => void;
}) {
	return (
		<section className="properties-panel">
			<div className="inspector-heading">
				<div>
					<span className="eyebrow">Inspector</span>
					<h2>
						{node ? nodeTypeLabel(node.type) : edge ? "Connection" : "Canvas"}
					</h2>
				</div>
				<button
					aria-label="Inspector settings"
					className="icon-button"
					onClick={() => undefined}
					type="button"
				>
					<Icon name="settings" size={15} />
				</button>
			</div>
			{node ? (
				<>
					<div className="inspector-section title-section">
						<label htmlFor="node-title">Name</label>
						<input
							id="node-title"
							onBlur={onCommitTitle}
							onChange={(event) => onChangeTitle(event.target.value)}
							value={node.title}
						/>
					</div>
					<div className="inspector-section title-section">
						<label htmlFor="node-subtitle">Description</label>
						<input
							id="node-subtitle"
							onBlur={onCommitSubtitle}
							onChange={(event) => onChangeSubtitle(event.target.value)}
							placeholder="Add a thought"
							value={node.subtitle}
						/>
					</div>
					<div className="inspector-section">
						<span className="section-label">Type</span>
						<div
							className="type-pill"
							onPointerDown={(event) => {
								if (event.target instanceof HTMLSelectElement) return;
								const select = event.currentTarget.querySelector("select");
								if (!(select instanceof HTMLSelectElement)) return;
								event.preventDefault();
								select.focus({ preventScroll: true });
								try {
									const picker = select as HTMLSelectElement & {
										showPicker?: () => void;
									};
									picker.showPicker?.();
								} catch {
									select.click();
								}
							}}
						>
							<span className={`mini-shape mini-${node.type}`}>
								<Icon name={nodeIcon(node.type)} size={13} />
							</span>
							<select
								aria-label="Node type"
								onChange={(event) => {
									onUpdateNode({ type: event.target.value as NodeType });
									event.currentTarget.blur();
								}}
								value={node.type}
							>
								{(node.type === "group"
									? [node.type, ...EDITABLE_NODE_TYPES]
									: EDITABLE_NODE_TYPES
								).map((type) => (
									<option key={type} value={type}>
										{nodeTypeLabel(type)}
									</option>
								))}
							</select>
							<Icon name="chevronDown" size={13} />
						</div>
					</div>
					<div className="inspector-section">
						<span className="section-label">Fill</span>
						<div className="color-swatches">
							{(Object.keys(COLOR_META) as NodeColor[]).map((color) => (
								<button
									aria-label={COLOR_META[color].label}
									className={`color-swatch swatch-${color}${node.color === color ? " selected" : ""}`}
									key={color}
									onClick={() => onChangeColor(color)}
									type="button"
								>
									<span />
								</button>
							))}
						</div>
					</div>
					<div className="inspector-section dimension-grid">
						<div>
							<label htmlFor="node-width">Width</label>
							<InspectorNumberField
								id="node-width"
								min={120}
								onCommit={(width) => onUpdateNode({ width })}
								suffix="px"
								value={node.width}
							/>
						</div>
						<div>
							<label htmlFor="node-height">Height</label>
							<InspectorNumberField
								id="node-height"
								min={56}
								onCommit={(height) => onUpdateNode({ height })}
								suffix="px"
								value={node.height}
							/>
						</div>
					</div>
					<div className="inspector-section dimension-grid">
						<div>
							<label htmlFor="node-x">X position</label>
							<InspectorNumberField
								id="node-x"
								onCommit={(x) => onUpdateNode({ x })}
								suffix="px"
								value={node.x}
							/>
						</div>
						<div>
							<label htmlFor="node-y">Y position</label>
							<InspectorNumberField
								id="node-y"
								onCommit={(y) => onUpdateNode({ y })}
								suffix="px"
								value={node.y}
							/>
						</div>
					</div>
					<div className="inspector-section rotation-row">
						<label htmlFor="node-rotation">Rotation</label>
						<InspectorNumberField
							icon="rotate"
							id="node-rotation"
							onCommit={(rotation) => onUpdateNode({ rotation })}
							suffix="°"
							value={node.rotation}
						/>
					</div>
					<div className="inspector-actions">
						<button className="action-tile" onClick={onDuplicate} type="button">
							<Icon name="duplicate" size={14} />
							<span>Duplicate</span>
						</button>
						<button className="action-tile" onClick={onLock} type="button">
							<Icon name="lock" size={14} />
							<span>{node.locked ? "Unlock" : "Lock"}</span>
						</button>
					</div>
					<div className="inspector-actions secondary-actions">
						<button className="text-action" onClick={onGroup} type="button">
							<Icon name="group" size={14} />
							Group
						</button>
						<button className="text-action" onClick={onUngroup} type="button">
							<Icon name="layers" size={14} />
							Ungroup
						</button>
					</div>
				</>
			) : edge ? (
				<>
					<div className="inspector-section">
						<span className="section-label">Line style</span>
						<div className="style-segmented">
							{(["elbow", "straight", "curved"] as EdgeStyle[]).map((style) => (
								<button
									className={edge.style === style ? "active" : ""}
									key={style}
									onClick={() => onChangeEdgeStyle(style)}
									type="button"
								>
									<span className={`line-preview line-${style}`} />
									{style}
								</button>
							))}
						</div>
					</div>
					<div className="inspector-section title-section">
						<label htmlFor="edge-label">Label</label>
						<input
							id="edge-label"
							onChange={(event) => onUpdateEdgeLabel(event.target.value)}
							placeholder="Add a label"
							value={edge.label}
						/>
					</div>
					<div className="edge-meta">
						<span className="meta-icon">
							<Icon name="link" size={14} />
						</span>
						<div>
							<strong>Connected nodes</strong>
							<small>Labels stay attached to the line</small>
						</div>
					</div>
				</>
			) : (
				<>
					<div className="empty-inspector">
						<div className="empty-inspector-icon">
							<Icon name="cursor" size={18} />
						</div>
						<strong>Select something to inspect</strong>
						<span>
							Click a node, edge, or drag a box around multiple elements.
						</span>
					</div>
					<div className="inspector-section canvas-settings">
						<div className="section-label-row">
							<span className="section-label">Canvas</span>
							<span className="muted-label">Infinite</span>
						</div>
						<div className="canvas-setting">
							<span>
								<Icon name="grid" size={14} />
								Grid
							</span>
							<button
								aria-pressed={showGrid}
								className={`setting-toggle${showGrid ? " is-on" : ""}`}
								onClick={onToggleGrid}
								type="button"
							>
								{showGrid ? "On" : "Off"}
							</button>
						</div>
						<div className="canvas-setting">
							<span>
								<Icon name="selectAll" size={14} />
								Snap
							</span>
							<button
								aria-pressed={snapToGrid}
								className={`setting-toggle${snapToGrid ? " is-on" : ""}`}
								onClick={onToggleSnap}
								type="button"
							>
								{snapToGrid ? "On" : "Off"}
							</button>
						</div>
						<div className="canvas-setting">
							<span>
								<Icon name="layers" size={14} />
								Layers
							</span>
							<span className="setting-status">{nodeCount}</span>
						</div>
					</div>
				</>
			)}
		</section>
	);
}

function LayersPanel({
	nodes,
	query,
	selectedIds,
	onSearch,
	onSelect,
	onToggleLock,
	onToggleVisibility,
}: {
	nodes: DiagramNode[];
	query: string;
	selectedIds: string[];
	onSearch: (query: string) => void;
	onSelect: (id: string, additive: boolean) => void;
	onToggleLock: (id: string) => void;
	onToggleVisibility: (id: string) => void;
}) {
	const groups = nodes.filter((node) => node.type === "group");
	const childrenByGroup = new Map<string, DiagramNode[]>();
	for (const node of nodes) {
		if (node.parentId)
			childrenByGroup.set(node.parentId, [
				...(childrenByGroup.get(node.parentId) ?? []),
				node,
			]);
	}
	const loose = nodes.filter((node) => node.type !== "group" && !node.parentId);
	return (
		<section className="layers-panel">
			<div className="layers-heading">
				<div>
					<span className="eyebrow">Structure</span>
					<h2>
						Layers <span>{nodes.length}</span>
					</h2>
				</div>
				<button
					aria-label="Layer options"
					className="icon-button"
					onClick={() => undefined}
					type="button"
				>
					<Icon name="more" size={15} />
				</button>
			</div>
			<div className="layer-search">
				<Icon name="search" size={14} />
				<input
					aria-label="Search layers"
					onChange={(event) => onSearch(event.target.value)}
					placeholder="Search layers"
					value={query}
				/>
				<kbd>⌘ F</kbd>
			</div>
			<div className="layers-list">
				{groups.map((group) => (
					<div key={group.id}>
						<LayerRow
							node={group}
							onSelect={onSelect}
							onToggleLock={onToggleLock}
							onToggleVisibility={onToggleVisibility}
							selected={selectedIds.includes(group.id)}
						/>
						{!group.collapsed ? (
							<div className="nested-layers">
								{(childrenByGroup.get(group.id) ?? []).map((node) => (
									<LayerRow
										key={node.id}
										node={node}
										onSelect={onSelect}
										onToggleLock={onToggleLock}
										onToggleVisibility={onToggleVisibility}
										selected={selectedIds.includes(node.id)}
									/>
								))}
							</div>
						) : null}
					</div>
				))}
				{loose.map((node) => (
					<LayerRow
						key={node.id}
						node={node}
						onSelect={onSelect}
						onToggleLock={onToggleLock}
						onToggleVisibility={onToggleVisibility}
						selected={selectedIds.includes(node.id)}
					/>
				))}
			</div>
		</section>
	);
}

function LayerRow({
	node,
	selected,
	onSelect,
	onToggleLock,
	onToggleVisibility,
}: {
	node: DiagramNode;
	selected: boolean;
	onSelect: (id: string, additive: boolean) => void;
	onToggleLock: (id: string) => void;
	onToggleVisibility: (id: string) => void;
}) {
	return (
		<div
			className={`layer-row${selected ? " selected" : ""}${node.hidden ? " hidden" : ""}`}
		>
			<button
				className="layer-main"
				onClick={(event) => onSelect(node.id, event.shiftKey)}
				type="button"
			>
				<span className={`layer-icon layer-${node.color}`}>
					<Icon name={nodeIcon(node.type)} size={13} />
				</span>
				<span className="layer-copy">
					<strong>{node.title}</strong>
					<small>{nodeTypeLabel(node.type)}</small>
				</span>
			</button>
			<button
				aria-label={`${node.title} visibility`}
				aria-pressed={!node.hidden}
				className={`layer-icon-button${node.hidden ? " active" : ""}`}
				onClick={() => onToggleVisibility(node.id)}
				type="button"
			>
				<Icon name="eye" size={13} />
			</button>
			<button
				aria-label={`${node.title} lock`}
				className={`layer-icon-button${node.locked ? " active" : ""}`}
				onClick={() => onToggleLock(node.id)}
				type="button"
			>
				<Icon name={node.locked ? "lock" : "dots"} size={13} />
			</button>
		</div>
	);
}

function ContextMenu({
	position,
	onClose,
	onDuplicate,
	onPaste,
	onGroup,
	onUngroup,
	onLock,
	onDelete,
}: {
	position: ContextMenuState;
	onClose: () => void;
	onDuplicate: () => void;
	onPaste: () => void;
	onGroup: () => void;
	onUngroup: () => void;
	onLock: () => void;
	onDelete: () => void;
}) {
	return (
		<div
			className="context-menu"
			onPointerDown={(event) => event.stopPropagation()}
			style={{ left: position.x, top: position.y }}
		>
			<div className="context-heading">
				{position.nodeId ? "Selection" : "Canvas"}
			</div>
			<button
				onClick={() => {
					onDuplicate();
					onClose();
				}}
				type="button"
			>
				<Icon name="duplicate" size={14} />
				<span>Duplicate</span>
				<kbd>⌘ D</kbd>
			</button>
			<button
				onClick={() => {
					onPaste();
					onClose();
				}}
				type="button"
			>
				<Icon name="copy" size={14} />
				<span>Paste here</span>
				<kbd>⌘ V</kbd>
			</button>
			<div className="menu-divider" />
			<button
				onClick={() => {
					onGroup();
					onClose();
				}}
				type="button"
			>
				<Icon name="group" size={14} />
				<span>Group selection</span>
				<kbd>⌘ G</kbd>
			</button>
			<button
				onClick={() => {
					onUngroup();
					onClose();
				}}
				type="button"
			>
				<Icon name="layers" size={14} />
				<span>Ungroup</span>
				<kbd>⇧⌘ G</kbd>
			</button>
			<button
				onClick={() => {
					onLock();
					onClose();
				}}
				type="button"
			>
				<Icon name="lock" size={14} />
				<span>Lock / unlock</span>
			</button>
			<div className="menu-divider" />
			<button
				className="danger-action"
				onClick={() => {
					onDelete();
					onClose();
				}}
				type="button"
			>
				<Icon name="trash" size={14} />
				<span>Delete</span>
				<kbd>⌫</kbd>
			</button>
		</div>
	);
}

function CommandPalette({
	items,
	activeIndex,
	query,
	setQuery,
	onClose,
}: {
	items: Array<{
		label: string;
		detail: string;
		icon: IconName;
		action: () => void;
	}>;
	activeIndex: number;
	query: string;
	setQuery: (query: string) => void;
	onClose: () => void;
}) {
	const inputRef = useRef<HTMLInputElement | null>(null);
	useEffect(() => {
		inputRef.current?.focus({ preventScroll: true });
	}, []);
	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: the backdrop intentionally dismisses the non-modal canvas palette.
		<div className="palette-backdrop" onMouseDown={onClose} role="presentation">
			<div
				aria-label="Command palette"
				aria-modal="true"
				className="command-palette"
				onMouseDown={(event) => event.stopPropagation()}
				role="dialog"
			>
				<div className="palette-search">
					<Icon name="search" size={17} />
					<input
						onChange={(event) => setQuery(event.target.value)}
						placeholder="Search commands or layers..."
						ref={inputRef}
						value={query}
					/>
					<kbd>esc</kbd>
				</div>
				<div className="palette-list">
					{items.length ? (
						items.map((item, index) => (
							<button
								className={index === activeIndex ? "active" : ""}
								key={item.label}
								onClick={() => {
									item.action();
									onClose();
								}}
								type="button"
							>
								<span className="palette-icon">
									<Icon name={item.icon} size={15} />
								</span>
								<span>{item.label}</span>
								<small>{item.detail}</small>
								<Icon name="chevronRight" size={14} />
							</button>
						))
					) : (
						<div className="palette-empty">No matching commands</div>
					)}
				</div>
				<div className="palette-footer">
					<span>
						<kbd>↑</kbd>
						<kbd>↓</kbd> navigate
					</span>
					<span>
						<kbd>↵</kbd> run
					</span>
					<span>
						<kbd>esc</kbd> close
					</span>
				</div>
			</div>
		</div>
	);
}

const isDiagramFile = (
	value: unknown,
): value is { nodes: DiagramNode[]; edges: DiagramEdge[] } => {
	if (!value || typeof value !== "object") return false;
	const candidate = value as { nodes?: unknown; edges?: unknown };
	return (
		Array.isArray(candidate.nodes) &&
		Array.isArray(candidate.edges) &&
		candidate.nodes.every(isDiagramNode) &&
		candidate.edges.every(isDiagramEdge)
	);
};

const NODE_TYPE_VALUES = [
	"group",
	"start",
	"process",
	"decision",
	"database",
	"end",
	"note",
	"text",
] as const;
const NODE_COLOR_VALUES = [
	"blue",
	"violet",
	"mint",
	"coral",
	"yellow",
	"slate",
] as const;
const EDGE_STYLE_VALUES = ["elbow", "straight", "curved"] as const;

const isNodeType = (value: unknown): value is NodeType =>
	typeof value === "string" &&
	(NODE_TYPE_VALUES as readonly string[]).includes(value);
const isNodeColor = (value: unknown): value is NodeColor =>
	typeof value === "string" &&
	(NODE_COLOR_VALUES as readonly string[]).includes(value);
const isEdgeStyle = (value: unknown): value is EdgeStyle =>
	typeof value === "string" &&
	(EDGE_STYLE_VALUES as readonly string[]).includes(value);

const isDiagramNode = (value: unknown): value is DiagramNode => {
	if (!value || typeof value !== "object") return false;
	const node = value as Partial<DiagramNode>;
	return (
		typeof node.id === "string" &&
		isNodeType(node.type) &&
		typeof node.x === "number" &&
		typeof node.y === "number" &&
		typeof node.width === "number" &&
		typeof node.height === "number" &&
		typeof node.title === "string" &&
		typeof node.subtitle === "string" &&
		isNodeColor(node.color) &&
		typeof node.locked === "boolean" &&
		typeof node.rotation === "number" &&
		(node.hidden === undefined || typeof node.hidden === "boolean")
	);
};

const isDiagramEdge = (value: unknown): value is DiagramEdge => {
	if (!value || typeof value !== "object") return false;
	const edge = value as Partial<DiagramEdge>;
	return (
		typeof edge.id === "string" &&
		typeof edge.source === "string" &&
		typeof edge.target === "string" &&
		isEdgeStyle(edge.style) &&
		typeof edge.label === "string"
	);
};
