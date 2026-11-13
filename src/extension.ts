import * as vscode from 'vscode';
import { CountMode, Counts, DEFAULT_COUNT_MODE, countText, isCountMode, sumCounts } from './counter';
import { formatStatus } from './format';

export const SECTION = 'wordcount';
export const SHOW_CHARACTERS = 'showCharacterCount';
export const LANGUAGES = 'languages';
export const COUNT_MODE = 'countMode';
export const TOGGLE_COMMAND = 'wordcount.toggleCharacterCount';

export function activate(context: vscode.ExtensionContext): void {
	const counter = new WordCounter();

	context.subscriptions.push(
		counter,
		vscode.commands.registerCommand(TOGGLE_COMMAND, toggleCharacterCount),
		// Moving the cursor or changing the selection: recount the selection (the document total is cached).
		vscode.window.onDidChangeTextEditorSelection((event) => {
			if (event.textEditor === vscode.window.activeTextEditor) {
				counter.update();
			}
		}),
		vscode.window.onDidChangeActiveTextEditor(() => counter.update()),
		// Edits that do not move the selection (undo in another editor, formatters, external changes).
		vscode.workspace.onDidChangeTextDocument((event) => {
			if (event.document === vscode.window.activeTextEditor?.document) {
				counter.update();
			}
		}),
		vscode.workspace.onDidOpenTextDocument(() => counter.update()), // language mode changes reopen the document
		vscode.workspace.onDidChangeConfiguration((event) => {
			if (event.affectsConfiguration(SECTION)) {
				counter.update();
			}
		}),
	);

	counter.update();
}

export function deactivate(): void {
	// Everything is disposed through context.subscriptions.
}

/** Flips `wordcount.showCharacterCount`, writing to the scope where it is currently set so the change takes effect. */
export async function toggleCharacterCount(): Promise<void> {
	const config = vscode.workspace.getConfiguration(SECTION);
	const next = !config.get<boolean>(SHOW_CHARACTERS, false);
	const inspected = config.inspect<boolean>(SHOW_CHARACTERS);
	const target =
		inspected?.workspaceValue !== undefined ? vscode.ConfigurationTarget.Workspace : vscode.ConfigurationTarget.Global;
	await config.update(SHOW_CHARACTERS, next, target);
}

interface DocumentCache {
	uri: string;
	version: number;
	mode: CountMode;
	counts: Counts;
}

/** Owns the status bar item and keeps it in sync with the active editor. */
export class WordCounter implements vscode.Disposable {
	private readonly item: vscode.StatusBarItem;
	private cache: DocumentCache | undefined;

	constructor() {
		this.item = vscode.window.createStatusBarItem('wordcount.status', vscode.StatusBarAlignment.Left);
		this.item.name = 'Word Count HotCRP';
		this.item.command = TOGGLE_COMMAND;
	}

	update(): void {
		const editor = vscode.window.activeTextEditor;
		const config = vscode.workspace.getConfiguration(SECTION);
		if (!editor || !isEnabledFor(editor.document.languageId, config.get<string[]>(LANGUAGES, ['markdown']))) {
			this.item.hide();
			return;
		}

		const showCharacters = config.get<boolean>(SHOW_CHARACTERS, false);
		const mode = countModeOf(config.get<unknown>(COUNT_MODE));
		const document = this.documentCounts(editor.document, showCharacters, mode);

		const ranges = editor.selections.filter((selection) => !selection.isEmpty);
		const selection =
			ranges.length > 0
				? {
						...sumCounts(
							ranges.map((range) => countText(editor.document.getText(range), showCharacters, mode)),
							showCharacters,
						),
						ranges: ranges.length,
					}
				: undefined;

		const { text, tooltip } = formatStatus({ document, selection, showCharacters });
		this.item.text = text;
		this.item.tooltip = tooltip;
		this.item.show();
	}

	/**
	 * Whole-document counts, recomputed only when the document or the counting mode changes, or character
	 * counts are first needed.
	 */
	private documentCounts(document: vscode.TextDocument, showCharacters: boolean, mode: CountMode): Counts {
		const uri = document.uri.toString();
		const cached = this.cache;
		if (
			cached &&
			cached.uri === uri &&
			cached.version === document.version &&
			cached.mode === mode &&
			(!showCharacters || cached.counts.characters)
		) {
			return showCharacters ? cached.counts : { words: cached.counts.words };
		}
		const counts = countText(document.getText(), showCharacters, mode);
		this.cache = { uri, version: document.version, mode, counts };
		return counts;
	}

	dispose(): void {
		this.item.dispose();
	}
}

export function isEnabledFor(languageId: string, languages: readonly string[]): boolean {
	return languages.includes('*') || languages.includes(languageId);
}

/** The `wordcount.countMode` setting, falling back to the default for a missing or misspelled value. */
export function countModeOf(value: unknown): CountMode {
	return isCountMode(value) ? value : DEFAULT_COUNT_MODE;
}
