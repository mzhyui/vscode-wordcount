import { afterEach, beforeEach, test } from 'node:test';
import * as assert from 'node:assert/strict';
// The fake must be imported before the extension so `require('vscode')` resolves to it.
import * as fake from './fakeVscode';
import * as extension from '../src/extension';
import { COUNT_MODES, DEFAULT_COUNT_MODE } from '../src/counter';

const { FakeDocument, FakeEditor, FakeSelection, user, settings, window, commands } = fake;

const TEXT = '# Notes\n\nThe quick brown fox jumps over the lazy dog.\n'; // 10 words ("#" is not a word)
const at = (needle: string, text = TEXT) => {
	const start = text.indexOf(needle);
	assert.notEqual(start, -1, `"${needle}" not in text`);
	return new FakeSelection(start, start + needle.length);
};

let context: { subscriptions: { dispose(): unknown }[] };
let editor: InstanceType<typeof FakeEditor>;

function item() {
	const items = fake.statusBarItems.filter((i) => !i.disposed);
	assert.equal(items.length, 1, 'exactly one live status bar item');
	return items[0];
}

beforeEach(() => {
	settings.reset();
	editor = new FakeEditor(new FakeDocument(TEXT));
	window.activeTextEditor = editor;
	context = { subscriptions: [] };
	extension.activate(context as never);
});

afterEach(() => {
	for (const disposable of context.subscriptions) {
		disposable.dispose();
	}
	window.activeTextEditor = undefined;
});

test('activation shows the document word count in the status bar', () => {
	assert.equal(item().visible, true);
	assert.equal(item().text, '$(pencil) 10 Words');
	assert.equal(item().command, extension.TOGGLE_COMMAND);
	assert.equal(item().name, 'Word Count HotCRP');
});

test('selecting text shows the selection count live, and clearing it reverts', () => {
	user.select(editor, at('quick brown'));
	assert.equal(item().text, '$(pencil) 2 of 10 Words');
	assert.match(String(item().tooltip), /^Selection: 2 words\nDocument: 10 words\n/);

	// Extending the selection updates immediately.
	user.select(editor, at('quick brown fox jumps'));
	assert.equal(item().text, '$(pencil) 4 of 10 Words');

	// A collapsed cursor is not a selection.
	user.select(editor, new FakeSelection(12, 12));
	assert.equal(item().text, '$(pencil) 10 Words');
});

test('multi-cursor selections are added up', () => {
	user.select(editor, at('quick brown'), new FakeSelection(30, 30), at('lazy dog.'));
	assert.equal(item().text, '$(pencil) 4 of 10 Words');
	assert.match(String(item().tooltip), /^Selection \(2 ranges\): 4 words\n/);
});

test('a whitespace-only selection counts zero words', () => {
	user.select(editor, new FakeSelection(7, 9)); // the blank line
	assert.equal(item().text, '$(pencil) 0 of 10 Words');
});

test('typing updates the count live', () => {
	user.select(editor, new FakeSelection(TEXT.length, TEXT.length));
	user.type(editor, 'More words here');
	assert.equal(item().text, '$(pencil) 13 Words');
});

test('the toggle command turns the character counter on and off', async () => {
	assert.equal(fake.hasCommand(extension.TOGGLE_COMMAND), true);

	await commands.executeCommand(extension.TOGGLE_COMMAND);
	assert.equal(settings.value('wordcount.showCharacterCount'), true);
	assert.equal(item().text, '$(pencil) 10 Words, 54 Chars');
	assert.match(String(item().tooltip), /54 characters \(42 excluding whitespace\)\nClick to hide the character count$/);

	user.select(editor, at('quick brown'));
	assert.equal(item().text, '$(pencil) 2 of 10 Words, 11 of 54 Chars');

	await commands.executeCommand(extension.TOGGLE_COMMAND);
	assert.equal(settings.value('wordcount.showCharacterCount'), false);
	assert.equal(item().text, '$(pencil) 2 of 10 Words');
	assert.doesNotMatch(String(item().tooltip), /\d characters/);
	assert.match(String(item().tooltip), /Click to show the character count$/);
});

test('the toggle writes to user settings by default', async () => {
	await commands.executeCommand(extension.TOGGLE_COMMAND);
	assert.deepEqual(settings.writes, [
		{ key: 'wordcount.showCharacterCount', value: true, target: fake.ConfigurationTarget.Global },
	]);
});

test('the toggle writes to workspace settings when the workspace sets the value', async () => {
	settings.workspace.set('wordcount.showCharacterCount', true);
	settings.global.set('wordcount.showCharacterCount', false);
	await commands.executeCommand(extension.TOGGLE_COMMAND);
	assert.deepEqual(settings.writes, [
		{ key: 'wordcount.showCharacterCount', value: false, target: fake.ConfigurationTarget.Workspace },
	]);
	assert.equal(item().text, '$(pencil) 10 Words');
});

test('editing settings.json directly is picked up too', () => {
	settings.global.set('wordcount.showCharacterCount', true);
	fake.fireConfigurationChange('wordcount.showCharacterCount');
	assert.equal(item().text, '$(pencil) 10 Words, 54 Chars');
});

test('character counts handle CRLF, CJK and emoji', async () => {
	await commands.executeCommand(extension.TOGGLE_COMMAND);
	const text = '你好，世界。\r\nHi 👍🏽\r\n';
	const cjk = new FakeEditor(new FakeDocument(text, 'markdown', 'file:///cjk.md'));
	user.focus(cjk);
	// Words (hotcrp): 你好，世界。 Hi 👍🏽 — the CJK run is one word. Characters: 6 + 1 (CRLF) + 4 + 1 (CRLF).
	assert.equal(item().text, '$(pencil) 3 Words, 12 Chars');
	user.select(cjk, at('世界', text));
	assert.equal(item().text, '$(pencil) 1 of 3 Words, 2 of 12 Chars');
});

test('only Markdown by default; other languages hide the item', () => {
	user.focus(new FakeEditor(new FakeDocument('x = 1', 'python', 'file:///a.py')));
	assert.equal(item().visible, false);
	user.focus(editor);
	assert.equal(item().visible, true);
});

test('wordcount.languages controls where the count is shown', () => {
	const tex = new FakeEditor(new FakeDocument('Some LaTeX prose', 'latex', 'file:///paper.tex'));
	user.focus(tex);
	assert.equal(item().visible, false);

	settings.global.set('wordcount.languages', ['markdown', 'latex']);
	fake.fireConfigurationChange('wordcount.languages');
	assert.equal(item().visible, true);
	assert.equal(item().text, '$(pencil) 3 Words');

	settings.global.set('wordcount.languages', ['*']);
	fake.fireConfigurationChange('wordcount.languages');
	user.focus(new FakeEditor(new FakeDocument('x = 1', 'python', 'file:///a.py')));
	assert.equal(item().visible, true);
});

test('wordcount.countMode switches the counting rules live', () => {
	assert.equal(settings.value('wordcount.countMode'), 'hotcrp');
	assert.equal(item().text, '$(pencil) 10 Words');

	settings.global.set('wordcount.countMode', 'whitespace');
	fake.fireConfigurationChange('wordcount.countMode');
	assert.equal(item().text, '$(pencil) 11 Words'); // "#" counts too

	user.select(editor, at('# Notes'));
	assert.equal(item().text, '$(pencil) 2 of 11 Words');

	settings.global.set('wordcount.countMode', 'markdown');
	fake.fireConfigurationChange('wordcount.countMode');
	assert.equal(item().text, '$(pencil) 1 of 10 Words');
});

test('online mode counts a link as label + URL, and © as a word', () => {
	const text = 'Read [the docs](https://example.com) © 2026\n';
	user.focus(new FakeEditor(new FakeDocument(text, 'markdown', 'file:///link.md')));
	assert.equal(item().text, '$(pencil) 5 Words'); // hotcrp: Read [the docs](https://example.com) © 2026

	settings.global.set('wordcount.countMode', 'online');
	fake.fireConfigurationChange('wordcount.countMode');
	assert.equal(item().text, '$(pencil) 6 Words'); // Read [the docs]( https://example.com) © 2026
});

test('an unknown wordcount.countMode falls back to hotcrp', () => {
	settings.global.set('wordcount.countMode', 'bogus');
	fake.fireConfigurationChange('wordcount.countMode');
	assert.equal(item().text, '$(pencil) 10 Words');
});

test('the manifest offers exactly the modes the counter knows', () => {
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const manifest = require('../../package.json');
	const schema = manifest.contributes.configuration.properties['wordcount.countMode'];
	assert.deepEqual(schema.enum, COUNT_MODES);
	assert.equal(schema.default, DEFAULT_COUNT_MODE);
	assert.equal(schema.enumDescriptions.length, COUNT_MODES.length);
});

test('changing the language mode of the open file updates visibility', () => {
	user.changeLanguage(editor, 'plaintext');
	assert.equal(item().visible, false);
	user.changeLanguage(editor, 'markdown');
	assert.equal(item().visible, true);
});

test('no editor hides the item', () => {
	user.focus(undefined);
	assert.equal(item().visible, false);
});

test('selection changes in a non-active editor are ignored', () => {
	const other = new FakeEditor(new FakeDocument('alpha beta gamma', 'markdown', 'file:///other.md'));
	user.select(other, new FakeSelection(0, 5));
	assert.equal(item().text, '$(pencil) 10 Words');
});

test('moving the cursor does not re-read the whole document', () => {
	const before = editor.document.getTextCalls;
	user.select(editor, at('quick'));
	user.select(editor, at('brown'));
	user.select(editor, new FakeSelection(3, 3));
	assert.equal(editor.document.getTextCalls, before);
	user.type(editor, 'x');
	assert.equal(editor.document.getTextCalls, before + 1);
});

test('deactivation disposes the item, the command and every listener', () => {
	for (const disposable of context.subscriptions) {
		disposable.dispose();
	}
	context.subscriptions = [];
	assert.equal(fake.statusBarItems.at(-1)?.disposed, true);
	assert.equal(fake.hasCommand(extension.TOGGLE_COMMAND), false);
	assert.deepEqual(fake.listenerCounts(), { selection: 0, activeEditor: 0, document: 0, open: 0, configuration: 0 });
});
