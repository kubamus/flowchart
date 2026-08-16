import type { Hotkey } from "@tanstack/react-hotkeys";
import { formatForDisplay } from "@tanstack/react-hotkeys";

export const makeId = (prefix: string) =>
	`${prefix}-${Math.random().toString(36).slice(2, 9)}`;

export const clamp = (value: number, min: number, max: number) =>
	Math.min(Math.max(value, min), max);

export const snap = (value: number, enabled: boolean) =>
	enabled ? Math.round(value / 8) * 8 : value;

export const escapeXml = (value: string) =>
	value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");

export const formatNumber = (value: number) => Math.round(value * 10) / 10;

export const formatShortcut = (hotkey: Hotkey) => formatForDisplay(hotkey);
