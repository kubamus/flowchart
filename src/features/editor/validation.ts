import type {
	DiagramEdge,
	DiagramNode,
	EdgeStyle,
	NodeColor,
	NodeType,
} from "./types";

export const isDiagramFile = (
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
