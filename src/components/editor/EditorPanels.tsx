import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	COLOR_META,
	EDITABLE_NODE_TYPES,
	nodeIcon,
	nodeTypeLabel,
} from "../../features/editor/data";
import { clamp, formatShortcut } from "../../features/editor/helpers";
import type {
	ContextMenuState,
	DiagramEdge,
	DiagramNode,
	EdgeStyle,
	NodeColor,
	NodeType,
} from "../../features/editor/types";
import { Icon, type IconName } from "../Icon";

export function ToolButton({
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
			data-tooltip={`${label}${shortcut ? ` · ${shortcut}` : ""}`}
			data-tooltip-placement="right"
			onClick={onClick}
			type="button"
		>
			<Icon name={icon} />
			{shortcut ? <span className="tool-shortcut">{shortcut}</span> : null}
		</button>
	);
}

export function InspectorNumberField({
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

export function PropertiesPanel({
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
					data-tooltip="Inspector settings"
					data-tooltip-placement="left"
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
						<textarea
							id="node-subtitle"
							onBlur={onCommitSubtitle}
							onChange={(event) => onChangeSubtitle(event.target.value)}
							placeholder="Add a thought"
							rows={3}
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

export function LayersPanel({
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
					data-tooltip="Layer options"
					data-tooltip-placement="left"
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
				<kbd>{formatShortcut("Mod+F")}</kbd>
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

export function LayerRow({
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
				data-tooltip={node.hidden ? "Show layer" : "Hide layer"}
				data-tooltip-placement="left"
				onClick={() => onToggleVisibility(node.id)}
				type="button"
			>
				<Icon name="eye" size={13} />
			</button>
			<button
				aria-label={`${node.title} lock`}
				className={`layer-icon-button${node.locked ? " active" : ""}`}
				data-tooltip={node.locked ? "Unlock layer" : "Lock layer"}
				data-tooltip-placement="left"
				onClick={() => onToggleLock(node.id)}
				type="button"
			>
				<Icon name={node.locked ? "lock" : "dots"} size={13} />
			</button>
		</div>
	);
}

export function ContextMenu({
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
				<kbd>{formatShortcut("Mod+D")}</kbd>
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
				<kbd>{formatShortcut("Mod+V")}</kbd>
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
				<kbd>{formatShortcut("Mod+G")}</kbd>
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
				<kbd>{formatShortcut("Mod+Shift+G")}</kbd>
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

export function CommandPalette({
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
