/**
 * A minimal in-memory stand-in for the `vscode` module, covering only the API the extension uses.
 * Importing this file installs it, so `require('vscode')` in the extension returns the fake.
 */
import Module = require('module');

type Listener<T> = (event: T) => unknown;

export class Emitter<T> {
	private listeners: Listener<T>[] = [];

	readonly event = (listener: Listener<T>, thisArg?: unknown, disposables?: { dispose(): void }[]) => {
		const bound: Listener<T> = thisArg ? listener.bind(thisArg) : listener;
		this.listeners.push(bound);
		const disposable = { dispose: () => (this.listeners = this.listeners.filter((l) => l !== bound)) };
		disposables?.push(disposable);
		return disposable;
	};

	fire(event: T): void {
		for (const listener of [...this.listeners]) {
			listener(event);
		}
	}

	get listenerCount(): number {
		return this.listeners.length;
	}
}

/** Selections are plain character offsets here; the extension only passes them back to `getText`. */
export class FakeSelection {
	constructor(
		readonly start: number,
		readonly end: number,
	) {}

	get isEmpty(): boolean {
		return this.start === this.end;
	}
}

export class FakeDocument {
	version = 1;
	readonly uri: { toString(): string };
	getTextCalls = 0;

	constructor(
		public text: string,
		public languageId = 'markdown',
		uri = 'file:///notes.md',
	) {
		this.uri = { toString: () => uri };
	}

	getText(range?: FakeSelection): string {
		if (!range) {
			this.getTextCalls++;
			return this.text;
		}
		return this.text.slice(range.start, range.end);
	}

	/** Replaces the whole text, as an edit would, and bumps the version. */
	setText(text: string): void {
		this.text = text;
		this.version++;
	}
}

export class FakeEditor {
	constructor(
		public document: FakeDocument,
		public selections: FakeSelection[] = [new FakeSelection(0, 0)],
	) {}
}

export class FakeStatusBarItem {
	text = '';
	tooltip: string | undefined;
	command: string | undefined;
	name: string | undefined;
	visible = false;
	disposed = false;

	constructor(
		readonly id: string,
		readonly alignment: number,
	) {}

	show(): void {
		this.visible = true;
	}

	hide(): void {
		this.visible = false;
	}

	dispose(): void {
		this.disposed = true;
		this.visible = false;
	}
}

export const ConfigurationTarget = { Global: 1, Workspace: 2, WorkspaceFolder: 3 } as const;
export const StatusBarAlignment = { Left: 1, Right: 2 } as const;

/** Settings as VS Code layers them: workspace value over global value over the contributed default. */
export class FakeSettings {
	readonly defaults = new Map<string, unknown>();
	readonly global = new Map<string, unknown>();
	readonly workspace = new Map<string, unknown>();
	readonly writes: { key: string; value: unknown; target: number }[] = [];

	constructor(defaults: Record<string, unknown>) {
		for (const [key, value] of Object.entries(defaults)) {
			this.defaults.set(key, value);
		}
	}

	value(key: string): unknown {
		for (const layer of [this.workspace, this.global, this.defaults]) {
			if (layer.has(key)) {
				return layer.get(key);
			}
		}
		return undefined;
	}

	reset(): void {
		this.global.clear();
		this.workspace.clear();
		this.writes.length = 0;
	}
}

/** Reads the contributed defaults from package.json so the fake cannot drift from the manifest. */
function contributedDefaults(): Record<string, unknown> {
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const manifest = require('../../package.json');
	const properties: Record<string, { default: unknown }> = manifest.contributes.configuration.properties;
	return Object.fromEntries(Object.entries(properties).map(([key, schema]) => [key, schema.default]));
}

export const settings = new FakeSettings(contributedDefaults());

const selectionChange = new Emitter<{ textEditor: FakeEditor; selections: FakeSelection[] }>();
const activeEditorChange = new Emitter<FakeEditor | undefined>();
const documentChange = new Emitter<{ document: FakeDocument }>();
const documentOpen = new Emitter<FakeDocument>();
const configurationChange = new Emitter<{ affectsConfiguration(section: string): boolean }>();

const commandRegistry = new Map<string, (...args: unknown[]) => unknown>();
export const statusBarItems: FakeStatusBarItem[] = [];

export const window = {
	activeTextEditor: undefined as FakeEditor | undefined,
	createStatusBarItem(id: string, alignment: number): FakeStatusBarItem {
		const item = new FakeStatusBarItem(id, alignment);
		statusBarItems.push(item);
		return item;
	},
	onDidChangeTextEditorSelection: selectionChange.event,
	onDidChangeActiveTextEditor: activeEditorChange.event,
};

export const workspace = {
	getConfiguration(section: string) {
		const full = (key: string) => `${section}.${key}`;
		return {
			get<T>(key: string, fallback?: T): T {
				const value = settings.value(full(key));
				return (value === undefined ? fallback : value) as T;
			},
			inspect<T>(key: string) {
				return {
					key: full(key),
					defaultValue: settings.defaults.get(full(key)) as T | undefined,
					globalValue: settings.global.get(full(key)) as T | undefined,
					workspaceValue: settings.workspace.get(full(key)) as T | undefined,
				};
			},
			async update(key: string, value: unknown, target: number): Promise<void> {
				const layer = target === ConfigurationTarget.Global ? settings.global : settings.workspace;
				layer.set(full(key), value);
				settings.writes.push({ key: full(key), value, target });
				fireConfigurationChange(full(key));
			},
		};
	},
	onDidChangeTextDocument: documentChange.event,
	onDidOpenTextDocument: documentOpen.event,
	onDidChangeConfiguration: configurationChange.event,
};

export const commands = {
	registerCommand(id: string, handler: (...args: unknown[]) => unknown) {
		if (commandRegistry.has(id)) {
			throw new Error(`command '${id}' already exists`);
		}
		commandRegistry.set(id, handler);
		return { dispose: () => commandRegistry.delete(id) };
	},
	async executeCommand(id: string, ...args: unknown[]): Promise<unknown> {
		const handler = commandRegistry.get(id);
		if (!handler) {
			throw new Error(`command '${id}' not found`);
		}
		return handler(...args);
	},
};

export function fireConfigurationChange(changedKey: string): void {
	configurationChange.fire({
		affectsConfiguration: (section) => changedKey === section || changedKey.startsWith(`${section}.`),
	});
}

/** Test helpers that play the part of the user. */
export const user = {
	focus(editor: FakeEditor | undefined): void {
		window.activeTextEditor = editor;
		activeEditorChange.fire(editor);
	},
	select(editor: FakeEditor, ...selections: FakeSelection[]): void {
		editor.selections = selections;
		selectionChange.fire({ textEditor: editor, selections });
	},
	/** Typing: the document changes first, then the cursor moves, as in VS Code. */
	type(editor: FakeEditor, text: string): void {
		const caret = editor.selections[0]?.end ?? editor.document.text.length;
		const before = editor.document.text.slice(0, caret);
		const after = editor.document.text.slice(caret);
		editor.document.setText(before + text + after);
		documentChange.fire({ document: editor.document });
		const position = caret + text.length;
		user.select(editor, new FakeSelection(position, position));
	},
	changeLanguage(editor: FakeEditor, languageId: string): void {
		editor.document.languageId = languageId;
		documentOpen.fire(editor.document);
	},
};

export const listenerCounts = () => ({
	selection: selectionChange.listenerCount,
	activeEditor: activeEditorChange.listenerCount,
	document: documentChange.listenerCount,
	open: documentOpen.listenerCount,
	configuration: configurationChange.listenerCount,
});

export function hasCommand(id: string): boolean {
	return commandRegistry.has(id);
}

const fakeModule = { window, workspace, commands, ConfigurationTarget, StatusBarAlignment };

type Loader = (request: string, parent: unknown, isMain: boolean) => unknown;
const moduleWithLoad = Module as unknown as { _load: Loader };
const originalLoad = moduleWithLoad._load;
moduleWithLoad._load = function (request: string, parent: unknown, isMain: boolean) {
	if (request === 'vscode') {
		return fakeModule;
	}
	return originalLoad.call(this, request, parent, isMain);
};
