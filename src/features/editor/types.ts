export type Tool = "select" | "hand" | "connector" | "note" | "text";
export type NodeType =
	| "group"
	| "start"
	| "process"
	| "decision"
	| "database"
	| "end"
	| "note"
	| "text";
export type NodeColor =
	| "blue"
	| "violet"
	| "mint"
	| "coral"
	| "yellow"
	| "slate";
export type EdgeStyle = "elbow" | "straight" | "curved";
export type Theme = "light" | "dark";

export interface Point {
	x: number;
	y: number;
}

export interface DiagramNode {
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

export interface DiagramEdge {
	id: string;
	source: string;
	target: string;
	style: EdgeStyle;
	label: string;
}

export interface HistoryEntry {
	nodes: DiagramNode[];
	edges: DiagramEdge[];
}

export interface ClipboardData {
	nodes: DiagramNode[];
	edges: DiagramEdge[];
}

export interface GuideState {
	x?: number;
	y?: number;
}

export interface SelectionBoxState {
	start: Point;
	current: Point;
	additive: boolean;
}

export type InteractionState =
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

export interface ConnectionState {
	sourceId: string;
	start: Point;
	current: Point;
}

export interface ContextMenuState {
	x: number;
	y: number;
	nodeId?: string;
}
