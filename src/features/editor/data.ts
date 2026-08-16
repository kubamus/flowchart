import type { Hotkey } from "@tanstack/react-hotkeys";
import type { IconName } from "../../components/Icon";
import type {
	DiagramEdge,
	DiagramNode,
	NodeColor,
	NodeType,
	Tool,
} from "./types";

export const WORLD_WIDTH = 1600;
export const WORLD_HEIGHT = 1100;
export const GRID_SIZE = 24;
export const MINIMAP_WIDTH = 174;
export const MINIMAP_HEIGHT = 110;

export const COLOR_META: Record<
	NodeColor,
	{ label: string; fill: string; border: string; text: string }
> = {
	blue: { label: "Blue", fill: "#eaf2ff", border: "#abc7f2", text: "#2e63b4" },
	violet: {
		label: "Violet",
		fill: "#f2edff",
		border: "#c9b9ee",
		text: "#6244ab",
	},
	mint: { label: "Mint", fill: "#eaf8f2", border: "#acd9c3", text: "#28775b" },
	coral: {
		label: "Coral",
		fill: "#fff1ed",
		border: "#efb9aa",
		text: "#a14e3a",
	},
	yellow: {
		label: "Yellow",
		fill: "#fff8e1",
		border: "#e8ce83",
		text: "#856516",
	},
	slate: {
		label: "Slate",
		fill: "#eff2f5",
		border: "#c9d1db",
		text: "#526171",
	},
};

export const INITIAL_NODES: DiagramNode[] = [
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

export const INITIAL_EDGES: DiagramEdge[] = [
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

export const TOOL_ITEMS: Array<{
	id: Tool;
	label: string;
	shortcut: Hotkey;
	icon: IconName;
}> = [
	{ id: "select", label: "Select", shortcut: "V", icon: "cursor" },
	{ id: "hand", label: "Pan canvas", shortcut: "H", icon: "hand" },
	{ id: "connector", label: "Connect nodes", shortcut: "C", icon: "connector" },
	{ id: "note", label: "Sticky note", shortcut: "N", icon: "note" },
	{ id: "text", label: "Text", shortcut: "T", icon: "text" },
];

export const NODE_TYPE_LABELS: Record<NodeType, string> = {
	group: "Group",
	start: "Start",
	process: "Process",
	decision: "Decision",
	database: "Database",
	end: "End",
	note: "Note",
	text: "Text",
};

export const EDITABLE_NODE_TYPES: NodeType[] = [
	"start",
	"process",
	"decision",
	"database",
	"end",
	"note",
	"text",
];

export const nodeIcon = (type: NodeType): IconName => {
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

export const nodeTypeLabel = (type: NodeType) => NODE_TYPE_LABELS[type];
