import type {
	CSSProperties,
	KeyboardEvent as ReactKeyboardEvent,
	MouseEvent as ReactMouseEvent,
	PointerEvent as ReactPointerEvent,
} from "react";
import { useEffect, useRef } from "react";
import {
	nodeTypeLabel,
	WORLD_HEIGHT,
	WORLD_WIDTH,
} from "../../features/editor/data";
import { getEdgeGeometry } from "../../features/editor/geometry";
import type {
	ConnectionState,
	DiagramEdge,
	DiagramNode,
} from "../../features/editor/types";
import { Icon } from "../Icon";

export function EdgeLayer({
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

export function NodeView({
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
							data-tooltip={node.collapsed ? "Expand group" : "Collapse group"}
							data-tooltip-placement="top"
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
							data-tooltip="Rotate node"
							data-tooltip-placement="top"
							onPointerDown={(event) => onBeginRotate(event, node)}
							type="button"
						>
							<Icon name="rotate" size={12} />
						</button>
					)}
					<button
						aria-label="Resize node"
						className="resize-handle"
						data-tooltip="Resize node"
						data-tooltip-placement="top"
						onPointerDown={(event) => onBeginResize(event, node)}
						type="button"
					/>
				</>
			) : null}
		</div>
	);
}

export function MiniMap({
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
