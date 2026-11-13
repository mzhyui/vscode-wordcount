import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
	countCharacters,
	countCharactersExcludingWhitespace,
	countText,
	countWords,
	isCountMode,
	sumCounts,
} from '../src/counter';

test('countWords: empty and whitespace-only text has no words', () => {
	assert.equal(countWords(''), 0);
	assert.equal(countWords('   \n\t\r\n  '), 0);
});

test('countWords: words are separated by any whitespace', () => {
	assert.equal(countWords('one'), 1);
	assert.equal(countWords('  one two\tthree\nfour\r\nfive  '), 5);
	assert.equal(countWords("don't stop-believing, e.g. 3.14"), 4);
});

test('countWords: Markdown markers and lone punctuation are not words in markdown mode', () => {
	assert.equal(countWords('# Title\n\n- item one\n- item two\n\n---\n\n> quote', 'markdown'), 6);
	assert.equal(countWords('a — b & c', 'markdown'), 3);
	assert.equal(countWords('1. first', 'markdown'), 2);
});

test('countWords: each CJK character is a word in markdown mode, punctuation is not', () => {
	assert.equal(countWords('你好，世界。', 'markdown'), 4);
	assert.equal(countWords('こんにちは', 'markdown'), 5);
	assert.equal(countWords('使用VS Code写作', 'markdown'), 6); // 使 用 VS Code 写 作
});

test('countWords: Hangul is space-separated, so it counts by word', () => {
	assert.equal(countWords('안녕하세요 세계'), 2);
});

test('countWords: hotcrp is the default mode', () => {
	const text = '## Hi © [docs](https://x.io) - ok';
	assert.equal(countWords(text), countWords(text, 'hotcrp'));
	assert.equal(countWords(text, 'hotcrp'), 4); // Hi © [docs](https://x.io) ok
	assert.equal(countWords(text, 'markdown'), 3); // Hi [docs](https://x.io) ok
});

test('countWords: online mode counts symbols such as © and emoji, but not punctuation', () => {
	assert.equal(countWords('© 2026 Acme™', 'online'), 3);
	assert.equal(countWords('nice 👍 work', 'online'), 3);
	assert.equal(countWords('# Title\n\n- a | b > c --- d', 'online'), 5); // Title a b c d
	assert.equal(countWords('a — b & c', 'online'), 3);
	assert.equal(countWords('## Hi © [docs](https://x.io) - ok', 'online'), 5); // Hi © [docs]( https://x.io) ok
});

test('countWords: online mode counts a URL as a word of its own', () => {
	assert.equal(countWords('[docs](https://example.com/a)', 'online'), 2);
	assert.equal(countWords('[docs](HTTP://example.com)', 'online'), 2);
	assert.equal(countWords('see https://example.com now', 'online'), 3);
	assert.equal(countWords('<https://example.com>', 'online'), 1);
	assert.equal(countWords('https://a.io,https://b.io', 'online'), 2);
	assert.equal(countWords('[docs](https://example.com/a)', 'markdown'), 1);
});

test('countWords: online mode still counts each CJK character as a word', () => {
	assert.equal(countWords('使用VS Code写作', 'online'), 6);
	assert.equal(countWords('见https://example.com说明', 'online'), 4); // 见 https://example.com 说 明
});

test('countWords: whitespace mode counts every run of non-space characters', () => {
	assert.equal(countWords('', 'whitespace'), 0);
	assert.equal(countWords('  \n\t ', 'whitespace'), 0);
	assert.equal(countWords('# Title\n\n- item one\n\n---', 'whitespace'), 6);
	assert.equal(countWords('## Hi © [docs](https://x.io) - ok', 'whitespace'), 6);
	assert.equal(countWords('你好，世界。', 'whitespace'), 1);
});

test('countWords: hotcrp mode skips leading marker punctuation but keeps the rest of the token', () => {
	assert.equal(countWords('# Title\n\n- item one\n- item two\n\n---\n\n> quote', 'hotcrp'), 6);
	assert.equal(countWords('--word word-- ... *** ??? ~~ # |', 'hotcrp'), 2); // --word word--
	assert.equal(countWords('1. first', 'hotcrp'), 2);
	assert.equal(countWords("don't stop-believing, e.g. 3.14", 'hotcrp'), 4);
});

test('countWords: hotcrp mode counts symbols, parentheses and quotes that markdown mode skips', () => {
	assert.equal(countWords('a — b & c', 'hotcrp'), 5); // the em dash and & are words too
	assert.equal(countWords('© 2026 Acme™', 'hotcrp'), 3);
	assert.equal(countWords('nice 👍 work', 'hotcrp'), 3);
	assert.equal(countWords('() "" []', 'hotcrp'), 3);
});

test('countWords: hotcrp mode counts a link or URL as one word', () => {
	assert.equal(countWords('[docs](https://example.com/a)', 'hotcrp'), 1);
	assert.equal(countWords('see https://example.com now', 'hotcrp'), 3);
	assert.equal(countWords('https://a.io,https://b.io', 'hotcrp'), 1);
});

test('countWords: hotcrp mode counts a run of CJK text with no spaces as one word', () => {
	assert.equal(countWords('你好，世界。', 'hotcrp'), 1);
	assert.equal(countWords('こんにちは', 'hotcrp'), 1);
	assert.equal(countWords('使用VS Code写作', 'hotcrp'), 2);
	assert.equal(countWords('안녕하세요 세계', 'hotcrp'), 2);
});

/**
 * Independent reading of HotCRP's `count_words()` regex: the first character class cannot match inside a
 * whitespace run, and `\S*+` then holds the rest of the run, so there is exactly one match per
 * whitespace-delimited chunk holding a character outside `[-\s.,;:<>!?*_~`#|]`.
 */
function hotcrpByChunks(text: string): number {
	const excluded = /[-\s.,;:<>!?*_~`#|]/u;
	let words = 0;
	for (const chunk of text.split(/\s+/u)) {
		if (Array.from(chunk).some((character) => !excluded.test(character))) {
			words++;
		}
	}
	return words;
}

test('countWords: hotcrp mode agrees with a chunk-by-chunk reading of the HotCRP regex', () => {
	const corpus = [
		'',
		'   \n\t\r\n  ',
		'## Hi © [docs](https://x.io) - ok',
		'# Title\n\n- item one\n- item two\n\n---\n\n> quote',
		'--word word-- ... *** ??? ~~ # |',
		'a — b & c',
		'() "" []',
		'你好，世界。',
		'使用VS Code写作',
		'[docs](https://example.com/a)',
		'https://a.io,https://b.io',
		"don't stop-believing, e.g. 3.14",
	];
	// Seeded pseudo-random strings over an alphabet of word characters, marker punctuation and whitespace.
	let seed = 20261112;
	const random = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
	const alphabet = Array.from('ab \t\n-.,;:<>!?*_~`#|()[]{}"\'©👍你好—&/+=%$@^0123456789');
	for (let i = 0; i < 500; i++) {
		let text = '';
		const length = Math.floor(random() * 40);
		for (let j = 0; j < length; j++) {
			text += alphabet[Math.floor(random() * alphabet.length)];
		}
		corpus.push(text);
	}
	for (const text of corpus) {
		assert.equal(countWords(text, 'hotcrp'), hotcrpByChunks(text), JSON.stringify(text));
	}
});

test('README 0.2.0: each mode gives the number the counter it targets gave', () => {
	const readme = fs.readFileSync(path.join(__dirname, '../../test/fixtures/readme-0.2.0.md'), 'utf8');
	const toLine42 = readme.split('\n').slice(0, 42).join('\n');
	// This extension's own count, before modes existed.
	assert.equal(countWords(readme, 'markdown'), 377);
	assert.equal(countWords(toLine42, 'markdown'), 313);
	// The online counter `online` targets showed 321 and 386 words left of a 700-word limit. It differs on
	// line 3 (a link counted as label + URL) and line 58 (`©` counted as a word).
	assert.equal(countWords(readme, 'online'), 700 - 321);
	assert.equal(countWords(toLine42, 'online'), 700 - 386);
	// Splitting on whitespace, as the original ms-vscode.wordcount did.
	assert.equal(countWords(readme, 'whitespace'), 434);
});

test('isCountMode: accepts only the known modes', () => {
	assert.equal(isCountMode('hotcrp'), true);
	assert.equal(isCountMode('markdown'), true);
	assert.equal(isCountMode('online'), true);
	assert.equal(isCountMode('whitespace'), true);
	assert.equal(isCountMode('Online'), false);
	assert.equal(isCountMode(undefined), false);
	assert.equal(isCountMode(1), false);
});

test('countCharacters: counts every character including spaces', () => {
	assert.equal(countCharacters(''), 0);
	assert.equal(countCharacters('hello world'), 11);
});

test('countCharacters: a line break is one character for LF and CRLF alike', () => {
	assert.equal(countCharacters('a\nb'), 3);
	assert.equal(countCharacters('a\r\nb'), 3);
	assert.equal(countCharacters('é\r\nb'), 3); // non-ASCII path agrees with the ASCII fast path
});

test('countCharacters: counts what a reader sees as one character', () => {
	assert.equal(countCharacters('👍'), 1);
	assert.equal(countCharacters('👍🏽'), 1); // emoji + skin tone
	assert.equal(countCharacters('👨‍👩‍👧'), 1); // ZWJ family
	assert.equal(countCharacters('é'), 1); // e + combining acute
	assert.equal(countCharacters('你好'), 2);
});

test('countCharactersExcludingWhitespace: drops spaces, tabs and line breaks', () => {
	assert.equal(countCharactersExcludingWhitespace(' a b\tc\r\nd '), 4);
	assert.equal(countCharactersExcludingWhitespace('你 好'), 2);
});

test('countText: character counts are only computed when asked for', () => {
	assert.deepEqual(countText('hi there', false), { words: 2 });
	assert.deepEqual(countText('hi there', true), { words: 2, characters: { all: 8, excludingWhitespace: 7 } });
});

test('countText: the mode changes the word count only', () => {
	assert.deepEqual(countText('# hi', true, 'markdown'), { words: 1, characters: { all: 4, excludingWhitespace: 3 } });
	assert.deepEqual(countText('# hi', true, 'whitespace'), { words: 2, characters: { all: 4, excludingWhitespace: 3 } });
});

test('sumCounts: adds words and characters across selections', () => {
	const parts = [countText('one two', true), countText('three', true)];
	assert.deepEqual(sumCounts(parts, true), { words: 3, characters: { all: 12, excludingWhitespace: 11 } });
	assert.deepEqual(sumCounts(parts, false), { words: 3 });
	assert.deepEqual(sumCounts([], true), { words: 0, characters: { all: 0, excludingWhitespace: 0 } });
});
