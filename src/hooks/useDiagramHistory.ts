import { useCallback, useEffect, useRef, useState } from "react";

import { INITIAL_EDGES, INITIAL_NODES } from "../features/editor/data";
import {
	hasOverlappingGroups,
	syncGroupSummaries,
} from "../features/editor/geometry";
import type {
	DiagramEdge,
	DiagramNode,
	HistoryEntry,
} from "../features/editor/types";

interface UseDiagramHistoryOptions {
	onInvalidSnapshot: () => void;
}

export function useDiagramHistory({
	onInvalidSnapshot,
}: UseDiagramHistoryOptions) {
	const [nodes, setNodes] = useState<DiagramNode[]>(INITIAL_NODES);
	const [edges, setEdges] = useState<DiagramEdge[]>(INITIAL_EDGES);
	const [saveState, setSaveState] = useState<"saved" | "saving">("saved");
	const [savePulse, setSavePulse] = useState(0);

	const nodesRef = useRef(nodes);
	const edgesRef = useRef(edges);
	const historyRef = useRef<HistoryEntry[]>([
		{ nodes: INITIAL_NODES, edges: INITIAL_EDGES },
	]);
	const historyIndexRef = useRef(0);
	const [, setHistoryIndex] = useState(0);

	const markSaving = useCallback(() => {
		setSaveState("saving");
		setSavePulse((pulse) => pulse + 1);
	}, []);

	const recordSnapshot = useCallback(
		(nextNodes = nodesRef.current, nextEdges = edgesRef.current) => {
			if (hasOverlappingGroups(nextNodes)) {
				onInvalidSnapshot();
				return false;
			}

			const normalizedNodes = syncGroupSummaries(nextNodes);
			nodesRef.current = normalizedNodes;
			edgesRef.current = nextEdges;
			setNodes(normalizedNodes);
			setEdges(nextEdges);

			const nextIndex = historyIndexRef.current + 1;
			historyRef.current = [
				...historyRef.current.slice(0, nextIndex),
				{ nodes: normalizedNodes, edges: nextEdges },
			];
			historyIndexRef.current = nextIndex;
			setHistoryIndex(nextIndex);
			markSaving();
			return true;
		},
		[markSaving, onInvalidSnapshot],
	);

	const updateNodesLive = useCallback(
		(updater: (current: DiagramNode[]) => DiagramNode[]) => {
			const nextNodes = updater(nodesRef.current);
			nodesRef.current = nextNodes;
			setNodes(nextNodes);
		},
		[],
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
		markSaving();
	}, [markSaving]);

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
		markSaving();
	}, [markSaving]);

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
					"flwchrt-diagram",
					JSON.stringify({ nodes: nodesRef.current, edges: edgesRef.current }),
				);
			} catch {
				// Local persistence is a convenience; a restricted browser should not block editing.
			}
		}, 750);
		return () => window.clearTimeout(timeout);
	}, [savePulse]);

	return {
		edges,
		edgesRef,
		nodes,
		nodesRef,
		recordSnapshot,
		redo,
		saveState,
		undo,
		updateNodesLive,
	};
}
