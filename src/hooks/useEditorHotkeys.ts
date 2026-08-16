import type { UseHotkeyDefinition } from "@tanstack/react-hotkeys";
import { useHotkey, useHotkeys } from "@tanstack/react-hotkeys";
import { useEffect, useMemo } from "react";

import { TOOL_ITEMS } from "../features/editor/data";
import type { ContextMenuState, Point, Tool } from "../features/editor/types";

interface UseEditorHotkeysOptions {
	commandOpen: boolean;
	contextMenu: ContextMenuState | null;
	editingNodeId: string | null;
	finishEditing: (commit: boolean) => void;
	executeCommand: () => void;
	copySelected: () => void;
	deleteSelected: () => void;
	duplicateSelected: () => void;
	groupSelection: () => void;
	moveCommandIndex: (direction: 1 | -1) => void;
	nudgeSelection: (delta: Point) => void;
	pasteClipboard: () => void;
	redo: () => void;
	selectedCount: number;
	setCommandOpen: (open: boolean) => void;
	setCommandQuery: (query: string) => void;
	setContextMenu: (menu: ContextMenuState | null) => void;
	setSpacePressed: (pressed: boolean) => void;
	setTool: (tool: Tool) => void;
	undo: () => void;
	ungroupSelection: () => void;
}

export function useEditorHotkeys({
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
	selectedCount,
	setCommandOpen,
	setCommandQuery,
	setContextMenu,
	setSpacePressed,
	setTool,
	undo,
	ungroupSelection,
}: UseEditorHotkeysOptions) {
	const editorHotkeys = useMemo<Array<UseHotkeyDefinition>>(
		() => [
			{
				hotkey: "Escape",
				callback: () => {
					if (editingNodeId) finishEditing(false);
					else if (commandOpen) {
						setCommandOpen(false);
						setCommandQuery("");
					} else if (contextMenu) setContextMenu(null);
				},
				options: {
					enabled: Boolean(editingNodeId || commandOpen || contextMenu),
					ignoreInputs: false,
					meta: {
						name: "Close active panel",
						description: "Exit editing or dismiss an open menu",
					},
				},
			},
			{
				hotkey: "ArrowDown",
				callback: () => moveCommandIndex(1),
				options: {
					enabled: commandOpen,
					ignoreInputs: false,
					meta: {
						name: "Next command",
						description: "Move down in the command palette",
					},
				},
			},
			{
				hotkey: "ArrowUp",
				callback: () => moveCommandIndex(-1),
				options: {
					enabled: commandOpen,
					ignoreInputs: false,
					meta: {
						name: "Previous command",
						description: "Move up in the command palette",
					},
				},
			},
			{
				hotkey: "Enter",
				callback: executeCommand,
				options: {
					enabled: commandOpen,
					ignoreInputs: false,
					meta: {
						name: "Run command",
						description: "Run the selected command",
					},
				},
			},
			{
				hotkey: "Mod+Shift+Z",
				callback: redo,
				options: {
					meta: { name: "Redo", description: "Redo the last change" },
				},
			},
			{
				hotkey: "Mod+Z",
				callback: undo,
				options: {
					meta: { name: "Undo", description: "Undo the last change" },
				},
			},
			{
				hotkey: "Mod+Y",
				callback: redo,
				options: {
					meta: { name: "Redo", description: "Redo the last change" },
				},
			},
			{
				hotkey: "Mod+K",
				callback: () => setCommandOpen(true),
				options: {
					meta: {
						name: "Command palette",
						description: "Open commands and search",
					},
				},
			},
			{
				hotkey: "Mod+C",
				callback: copySelected,
				options: {
					meta: {
						name: "Copy selection",
						description: "Copy selected elements",
					},
				},
			},
			{
				hotkey: "Mod+V",
				callback: pasteClipboard,
				options: {
					meta: { name: "Paste", description: "Paste copied elements" },
				},
			},
			{
				hotkey: "Mod+D",
				callback: duplicateSelected,
				options: {
					meta: { name: "Duplicate", description: "Duplicate the selection" },
				},
			},
			{
				hotkey: "Mod+Shift+G",
				callback: ungroupSelection,
				options: {
					meta: { name: "Ungroup", description: "Ungroup the selection" },
				},
			},
			{
				hotkey: "Mod+G",
				callback: groupSelection,
				options: {
					meta: { name: "Group", description: "Group the selection" },
				},
			},
			{
				hotkey: "Delete",
				callback: deleteSelected,
				options: {
					meta: { name: "Delete", description: "Delete the selection" },
				},
			},
			{
				hotkey: "Backspace",
				callback: deleteSelected,
				options: {
					meta: { name: "Delete", description: "Delete the selection" },
				},
			},
			{
				hotkey: { key: "/", shift: true },
				callback: () => {
					setCommandOpen(true);
					setCommandQuery("shortcut");
				},
				options: {
					meta: {
						name: "Keyboard shortcuts",
						description: "Open the shortcut reference",
					},
				},
			},
			...TOOL_ITEMS.map((item) => ({
				hotkey: item.shortcut,
				callback: () => setTool(item.id),
				options: {
					meta: {
						name: `${item.label} tool`,
						description: `Activate the ${item.label.toLowerCase()} tool`,
					},
				},
			})),
			{
				hotkey: "ArrowLeft",
				callback: () => nudgeSelection({ x: -1, y: 0 }),
				options: {
					enabled: !commandOpen && selectedCount > 0,
					meta: {
						name: "Nudge left",
						description: "Move selection one pixel left",
					},
				},
			},
			{
				hotkey: "Shift+ArrowLeft",
				callback: () => nudgeSelection({ x: -8, y: 0 }),
				options: {
					enabled: !commandOpen && selectedCount > 0,
					meta: {
						name: "Nudge left",
						description: "Move selection eight pixels left",
					},
				},
			},
			{
				hotkey: "ArrowRight",
				callback: () => nudgeSelection({ x: 1, y: 0 }),
				options: {
					enabled: !commandOpen && selectedCount > 0,
					meta: {
						name: "Nudge right",
						description: "Move selection one pixel right",
					},
				},
			},
			{
				hotkey: "Shift+ArrowRight",
				callback: () => nudgeSelection({ x: 8, y: 0 }),
				options: {
					enabled: !commandOpen && selectedCount > 0,
					meta: {
						name: "Nudge right",
						description: "Move selection eight pixels right",
					},
				},
			},
			{
				hotkey: "ArrowUp",
				callback: () => nudgeSelection({ x: 0, y: -1 }),
				options: {
					enabled: !commandOpen && selectedCount > 0,
					meta: {
						name: "Nudge up",
						description: "Move selection one pixel up",
					},
				},
			},
			{
				hotkey: "Shift+ArrowUp",
				callback: () => nudgeSelection({ x: 0, y: -8 }),
				options: {
					enabled: !commandOpen && selectedCount > 0,
					meta: {
						name: "Nudge up",
						description: "Move selection eight pixels up",
					},
				},
			},
			{
				hotkey: "ArrowDown",
				callback: () => nudgeSelection({ x: 0, y: 1 }),
				options: {
					enabled: !commandOpen && selectedCount > 0,
					meta: {
						name: "Nudge down",
						description: "Move selection one pixel down",
					},
				},
			},
			{
				hotkey: "Shift+ArrowDown",
				callback: () => nudgeSelection({ x: 0, y: 8 }),
				options: {
					enabled: !commandOpen && selectedCount > 0,
					meta: {
						name: "Nudge down",
						description: "Move selection eight pixels down",
					},
				},
			},
		],
		[
			commandOpen,
			contextMenu,
			copySelected,
			deleteSelected,
			duplicateSelected,
			editingNodeId,
			executeCommand,
			finishEditing,
			groupSelection,
			moveCommandIndex,
			nudgeSelection,
			pasteClipboard,
			redo,
			selectedCount,
			setCommandOpen,
			setCommandQuery,
			setContextMenu,
			setTool,
			undo,
			ungroupSelection,
		],
	);

	useHotkeys(editorHotkeys, {
		conflictBehavior: "allow",
		ignoreInputs: true,
	});
	useHotkey("Space", () => setSpacePressed(true), {
		conflictBehavior: "allow",
		ignoreInputs: true,
		meta: {
			name: "Pan canvas",
			description: "Hold Space while dragging to pan",
		},
		requireReset: true,
	});
	useHotkey("Space", () => setSpacePressed(false), {
		conflictBehavior: "allow",
		eventType: "keyup",
		ignoreInputs: true,
	});

	useEffect(() => {
		const handleWindowBlur = () => setSpacePressed(false);
		window.addEventListener("blur", handleWindowBlur);
		return () => {
			window.removeEventListener("blur", handleWindowBlur);
		};
	}, [setSpacePressed]);
}
