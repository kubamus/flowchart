import type { DiagramNode, EdgeStyle, Point } from "./types";

export const getWorldPoint = (
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

export const getNodeCenter = (node: DiagramNode): Point => ({
	x: node.x + node.width / 2,
	y: node.y + node.height / 2,
});

export const rotateVector = (vector: Point, degrees: number): Point => {
	const radians = (degrees * Math.PI) / 180;
	const cosine = Math.cos(radians);
	const sine = Math.sin(radians);
	return {
		x: vector.x * cosine - vector.y * sine,
		y: vector.x * sine + vector.y * cosine,
	};
};

export const getConnectionPoint = (
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

export const getEdgeGeometry = (
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

export const getVisibleNodes = (nodes: DiagramNode[]) => {
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

export interface Rect {
	x: number;
	y: number;
	width: number;
	height: number;
}

export const getNodeRect = (node: DiagramNode): Rect => ({
	x: node.x,
	y: node.y,
	width: node.width,
	height: node.height,
});

export const containsRect = (outer: Rect, inner: Rect) =>
	inner.x >= outer.x &&
	inner.y >= outer.y &&
	inner.x + inner.width <= outer.x + outer.width &&
	inner.y + inner.height <= outer.y + outer.height;

export const rectanglesOverlap = (first: Rect, second: Rect) =>
	first.x < second.x + second.width &&
	first.x + first.width > second.x &&
	first.y < second.y + second.height &&
	first.y + first.height > second.y;

export const hasOverlappingGroups = (nodes: DiagramNode[]) => {
	const groups = nodes.filter((node) => node.type === "group");
	return groups.some((group, index) =>
		groups
			.slice(index + 1)
			.some((other) =>
				rectanglesOverlap(getNodeRect(group), getNodeRect(other)),
			),
	);
};

export const findContainingGroup = (
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

export const syncGroupMembership = (nodes: DiagramNode[]) => {
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

export const getDescendantIds = (nodes: DiagramNode[], parentId: string) => {
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

export const getBounds = (nodes: DiagramNode[]) => {
	if (nodes.length === 0)
		return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
	const minX = Math.min(...nodes.map((node) => node.x));
	const minY = Math.min(...nodes.map((node) => node.y));
	const maxX = Math.max(...nodes.map((node) => node.x + node.width));
	const maxY = Math.max(...nodes.map((node) => node.y + node.height));
	return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
};
