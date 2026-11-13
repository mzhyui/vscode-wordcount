import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { formatStatus } from '../src/format';

const doc = (words: number, all?: number, excludingWhitespace?: number) =>
	all === undefined ? { words } : { words, characters: { all, excludingWhitespace: excludingWhitespace ?? all } };

test('no selection, character counter off: document word count only', () => {
	const { text, tooltip } = formatStatus({ document: doc(340), showCharacters: false });
	assert.equal(text, '$(pencil) 340 Words');
	assert.equal(tooltip, 'Document: 340 words\nClick to show the character count');
});

test('singular word and character', () => {
	assert.equal(formatStatus({ document: doc(1), showCharacters: false }).text, '$(pencil) 1 Word');
	assert.equal(formatStatus({ document: doc(0), showCharacters: false }).text, '$(pencil) 0 Words');
	assert.equal(formatStatus({ document: doc(1, 1), showCharacters: true }).text, '$(pencil) 1 Word, 1 Char');
});

test('no selection, character counter on: words and characters with thousands separators', () => {
	const { text, tooltip } = formatStatus({ document: doc(1234, 56789, 45678), showCharacters: true });
	assert.equal(text, '$(pencil) 1,234 Words, 56,789 Chars');
	assert.equal(
		tooltip,
		'Document: 1,234 words, 56,789 characters (45,678 excluding whitespace)\nClick to hide the character count',
	);
});

test('selection, character counter off: "N of M Words"', () => {
	const { text, tooltip } = formatStatus({
		document: doc(340),
		selection: { ...doc(12), ranges: 1 },
		showCharacters: false,
	});
	assert.equal(text, '$(pencil) 12 of 340 Words');
	assert.equal(tooltip, 'Selection: 12 words\nDocument: 340 words\nClick to show the character count');
});

test('selection, character counter on: words and characters for both', () => {
	const { text, tooltip } = formatStatus({
		document: doc(340, 1920, 1600),
		selection: { ...doc(12, 58, 49), ranges: 3 },
		showCharacters: true,
	});
	assert.equal(text, '$(pencil) 12 of 340 Words, 58 of 1,920 Chars');
	assert.equal(
		tooltip,
		[
			'Selection (3 ranges): 12 words, 58 characters (49 excluding whitespace)',
			'Document: 340 words, 1,920 characters (1,600 excluding whitespace)',
			'Click to hide the character count',
		].join('\n'),
	);
});

test('character counter on but counts missing: falls back to words only', () => {
	assert.equal(formatStatus({ document: doc(5), showCharacters: true }).text, '$(pencil) 5 Words');
});
