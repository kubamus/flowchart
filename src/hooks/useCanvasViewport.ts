import type { MouseEvent as ReactMouseEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { WORLD_WIDTH } from "../features/editor/data";
import { getBounds } from "../features/editor/geometry";
import { clamp } from "../features/editor/helpers";
import type { DiagramNode, Point } from "../features/editor/types";

interface UseCanvasViewportOptions {
	nodes: DiagramNode[];
	onFit: (message: string) => void;
}

interface ViewState extends Point {
	zoom: number;
}

const MINIMAP_WIDTH = 174;

export function useCanvasViewport({ nodes, onFit }: UseCanvasViewportOptions) {
	const [view, setViewState] = useState<ViewState>({
		x: -16,
		y: -34,
		zoom: 0.84,
	});
	const [viewportSize, setViewportSize] = useState({
		width: 900,
		height: 700,
	});

	const viewportRef = useRef<HTMLDivElement | null>(null);
	const viewRef = useRef(view);

	const updateView = useCallback((next: ViewState) => {
		viewRef.current = next;
		setViewState(next);
	}, []);

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
		onFit("Fit to selection");
	}, [nodes, onFit, updateView]);

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

	const minimapScale = MINIMAP_WIDTH / WORLD_WIDTH;
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

	return {
		canvasPosition,
		fitView,
		handleMinimapClick,
		minimapViewport,
		resetZoom,
		updateView,
		view,
		viewRef,
		viewportRef,
		viewportSize,
		zoomCanvas,
	};
}
