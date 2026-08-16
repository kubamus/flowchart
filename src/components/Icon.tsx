import type { ReactNode } from "react";

export const Icon = ({
	name,
	size = 16,
}: {
	name: IconName;
	size?: number;
}) => {
	const common = {
		fill: "none",
		stroke: "currentColor",
		strokeLinecap: "round" as const,
		strokeLinejoin: "round" as const,
		strokeWidth: 1.8,
	};

	const paths: Record<IconName, ReactNode> = {
		arrowDown: <path {...common} d="m5 8 3 3 3-3M8 3v8" />,
		arrowRight: <path {...common} d="M3 8h9m-3-3 3 3-3 3" />,
		chevronDown: <path {...common} d="m4 6 4 4 4-4" />,
		chevronLeft: <path {...common} d="m9 4-4 4 4 4" />,
		chevronRight: <path {...common} d="m7 4 4 4-4 4" />,
		chevronUp: <path {...common} d="m4 10 4-4 4 4" />,
		close: <path {...common} d="m4 4 8 8M12 4l-8 8" />,
		command: (
			<path
				{...common}
				d="M5 3a2 2 0 1 0 0 4h6a2 2 0 1 0 0-4M5 9a2 2 0 1 0 0 4 2 2 0 1 0 0-4h6a2 2 0 1 0 0 4"
			/>
		),
		connector: (
			<path
				{...common}
				d="M4 4v3a2 2 0 0 0 2 2h4a2 2 0 0 1 2 2v1M4 4h2M4 4v2"
			/>
		),
		copy: <path {...common} d="M5 5V3h6v2M7 7h5v6H5V7h2Z" />,
		cursor: <path {...common} d="m4 3 7 5-3 .7 1.7 3-1.4.7-1.7-3L4 11V3Z" />,
		database: (
			<path
				{...common}
				d="M3 4c0-1 2.2-1.8 5-1.8S13 3 13 4v8c0 1-2.2 1.8-5 1.8S3 13 3 12V4Zm0 0c0 1 2.2 1.8 5 1.8S13 5 13 4M3 8c0 1 2.2 1.8 5 1.8S13 9 13 8"
			/>
		),
		diamond: <path {...common} d="m8 2 6 6-6 6-6-6 6-6Z" />,
		dots: (
			<path
				fill="currentColor"
				d="M3.5 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM8.5 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM13.5 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
			/>
		),
		download: <path {...common} d="M8 2v7m0 0 3-3m-3 3L5 6M3 11v2h10v-2" />,
		duplicate: (
			<path {...common} d="M5 5h6v6H5zM3 3h6v2H5v4H3V3Zm4 8h4v2H7v-2Z" />
		),
		eye: (
			<path
				{...common}
				d="M2.5 8s2-3.5 5.5-3.5S13.5 8 13.5 8 11 11.5 8 11.5 2.5 8 2.5 8Z"
			/>
		),
		fit: <path {...common} d="M3 6V3h3M10 3h3v3M13 10v3h-3M6 13H3v-3" />,
		folder: <path {...common} d="M2.5 4.5h4l1.3 1.3h4.7v5.7h-10V4.5Z" />,
		grid: <path {...common} d="M3 3h10v10H3zM3 7h10M7 3v10" />,
		group: <path {...common} d="M3 4h4v4H3zM9 6h4v4H9zM5 8v3h4" />,
		hand: (
			<path
				{...common}
				d="M5 8V4a1 1 0 0 1 2 0v3-4a1 1 0 0 1 2 0v4-3a1 1 0 0 1 2 0v4-2a1 1 0 0 1 2 0v4c0 2.3-1.3 4-3.5 4H8c-1.7 0-2.6-.8-3.4-2L3 9.5A1 1 0 0 1 5 8Z"
			/>
		),
		keyboard: (
			<path
				{...common}
				d="M2.5 4.5h11v7h-11zM4.5 7h.1M6.6 7h.1M8.7 7h.1M10.8 7h.1M5 9.5h6"
			/>
		),
		layers: (
			<path
				{...common}
				d="m8 2.5 5 2.7-5 2.7-5-2.7 5-2.7Zm-5 5.5 5 2.7 5-2.7M3 11l5 2.7 5-2.7"
			/>
		),
		link: (
			<path
				{...common}
				d="M6 9 4.8 10.2a2.2 2.2 0 0 1-3-3l2-2a2.2 2.2 0 0 1 3 0M10 7l1.2-1.2a2.2 2.2 0 0 1 3 3l-2 2a2.2 2.2 0 0 1-3 0M5 8h6"
			/>
		),
		lock: <path {...common} d="M4 6h8v7H4zM5.5 6V4.8a2.5 2.5 0 0 1 5 0V6" />,
		minus: <path {...common} d="M3.5 8h9" />,
		more: <path {...common} d="M4 8h.1M8 8h.1M12 8h.1" />,
		moon: (
			<path
				{...common}
				d="M11.8 10.8A5.5 5.5 0 0 1 5.2 4.2 5.5 5.5 0 1 0 11.8 10.8Z"
			/>
		),
		move: (
			<path
				{...common}
				d="M8 2v12M2 8h12M8 2l-2 2m2-2 2 2M8 14l-2-2m2 2 2-2M2 8l2-2m-2 2 2 2M14 8l-2-2m2 2-2 2"
			/>
		),
		note: (
			<path {...common} d="M3 2.8h7l2 2V13H3V2.8Zm7 0v2h2M5 8h5M5 10.5h3" />
		),
		plus: <path {...common} d="M8 3v10M3 8h10" />,
		redo: <path {...common} d="M10 4.5h2.5v2.5M12.5 7a5 5 0 0 0-9 1" />,
		redoAll: (
			<path {...common} d="M10 4.5h2.5v2.5M12.5 7a5 5 0 0 0-9 1M6 11.5H3.5V9" />
		),
		rotate: <path {...common} d="M11 4.5A4.8 4.8 0 1 0 12.5 9M11 2.5v2h2" />,
		search: (
			<path
				{...common}
				d="m10.5 10.5 3 3M6.8 11.5a4.7 4.7 0 1 0 0-9.4 4.7 4.7 0 0 0 0 9.4Z"
			/>
		),
		selectAll: (
			<path
				{...common}
				d="M3 5V3h2M11 3h2v2M13 11v2h-2M5 13H3v-2M6 8h4M8 6v4"
			/>
		),
		settings: (
			<path
				{...common}
				d="M8 2.8v1.5M8 11.7v1.5M2.8 8h1.5M11.7 8h1.5M4.3 4.3l1 1M10.7 10.7l1 1M11.7 4.3l-1 1M5.3 10.7l-1 1M10.5 8A2.5 2.5 0 1 1 5.5 8a2.5 2.5 0 0 1 5 0Z"
			/>
		),
		share: <path {...common} d="M11 5.5 8 8l3 2.5M8 8h5M3 3.5h3v9H3z" />,
		star: (
			<path
				{...common}
				d="m8 2.5 1.7 3.4 3.8.5-2.8 2.7.7 3.8-3.4-1.8-3.4 1.8.7-3.8-2.8-2.7 3.8-.5L8 2.5Z"
			/>
		),
		sun: (
			<path
				{...common}
				d="M8 3V2M8 14v-1M3 8H2M14 8h-1M4.5 4.5l-.7-.7M12.2 12.2l-.7-.7M11.5 4.5l.7-.7M4.5 11.5l-.7.7M10.5 8A2.5 2.5 0 1 1 5.5 8a2.5 2.5 0 0 1 5 0Z"
			/>
		),
		text: <path {...common} d="M3 4V3h10v1M8 3v10M6 13h4" />,
		trash: (
			<path
				{...common}
				d="M3.5 4.5h9M6 4.5V3h4v1.5M5 6v6.5h6V6M7 7.5v3M9 7.5v3"
			/>
		),
		undo: <path {...common} d="M6 4.5H3.5V7M3.5 7a5 5 0 0 1 9 1" />,
		upload: <path {...common} d="M8 12V5m0 0L5 8m3-3 3 3M3 3h10" />,
		zoomIn: (
			<path
				{...common}
				d="m10.5 10.5 3 3M6.8 11.5a4.7 4.7 0 1 0 0-9.4 4.7 4.7 0 0 0 0 9.4ZM6.8 5.5v3M5.3 7h3"
			/>
		),
		zoomOut: (
			<path
				{...common}
				d="m10.5 10.5 3 3M6.8 11.5a4.7 4.7 0 1 0 0-9.4 4.7 4.7 0 0 0 0 9.4ZM5.3 7h3"
			/>
		),
	};

	return (
		<svg aria-hidden="true" height={size} viewBox="0 0 16 16" width={size}>
			{paths[name]}
		</svg>
	);
};

export type IconName =
	| "arrowDown"
	| "arrowRight"
	| "chevronDown"
	| "chevronLeft"
	| "chevronRight"
	| "chevronUp"
	| "close"
	| "command"
	| "connector"
	| "copy"
	| "cursor"
	| "database"
	| "diamond"
	| "dots"
	| "download"
	| "duplicate"
	| "eye"
	| "fit"
	| "folder"
	| "grid"
	| "group"
	| "hand"
	| "keyboard"
	| "layers"
	| "link"
	| "lock"
	| "minus"
	| "more"
	| "moon"
	| "move"
	| "note"
	| "plus"
	| "redo"
	| "redoAll"
	| "rotate"
	| "search"
	| "selectAll"
	| "settings"
	| "share"
	| "star"
	| "sun"
	| "text"
	| "trash"
	| "undo"
	| "upload"
	| "zoomIn"
	| "zoomOut";
