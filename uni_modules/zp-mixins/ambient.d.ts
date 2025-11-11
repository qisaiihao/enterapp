// Ambient module declarations for zp-mixins JS modules to satisfy TS7016
// Keep simple, non-strict typings to unblock builds.

declare module './lifecycle/pageLifetimes' {
	export const pageLifetimes: any;
}

declare module './methods/clone' {
	export function clone(target: any): any;
}

declare module './methods/dataset' {
	export function handleDataset(event?: any, dataSet?: Record<string, any>): void;
}

declare module './methods/escape' {
	export function escape2Html(str: string): string;
	export function html2Escape(str: string): string;
}

declare module './methods/event' {
	export function parseEventDynamicCode(e: any, exp: string): void;
}

declare module './methods/getTabBar' {
	export function getTabBar(): {
		setData(obj: Record<string, any>): void;
	};
}

declare module './methods/relation' {
	export function getRelationNodes(name: string): any;
}

declare module './methods/selectComponent' {
	export function selectComponent(selector: string): any;
	export function selectAllComponents(selector: string): any[];
}

declare module './methods/setData' {
	export function setData(obj: Record<string, any>, callback?: () => void): void;
}


