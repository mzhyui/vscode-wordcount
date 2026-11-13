/**
 * Pure text-counting helpers. Nothing here imports `vscode`, so it can be unit-tested in plain Node.
 */

/**
 * How words are counted (the `wordcount.countMode` setting):
 * - `hotcrp`: the rule HotCRP applies to submission word limits — a run of non-space text whose first
 *   character is not one of `- . , ; : < > ! ? * _ ~ ` # |`. Ported from `count_words()` in HotCRP's
 *   `lib/base.php`.
 * - `markdown`: runs of non-space text holding a letter or digit, so Markdown markers are skipped; each CJK
 *   character is a word.
 * - `online`: as `markdown`, but symbols such as ©, ™ and emoji are words too, and a web address is always a
 *   word of its own, so `[label](https://…)` is two words. This matches web counters fed the raw text.
 * - `whitespace`: every run of non-space characters, as in the original `ms-vscode.wordcount` and `wc -w`.
 */
export type CountMode = 'hotcrp' | 'markdown' | 'online' | 'whitespace';

export const COUNT_MODES: readonly CountMode[] = ['hotcrp', 'markdown', 'online', 'whitespace'];
export const DEFAULT_COUNT_MODE: CountMode = 'hotcrp';

export function isCountMode(value: unknown): value is CountMode {
	return typeof value === 'string' && (COUNT_MODES as readonly string[]).includes(value);
}

/** Scripts written without spaces between words: each character counts as one word (Microsoft Word's rule). */
const CJK = '\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}';

/** A single CJK character, or a run of non-space, non-CJK characters. */
const TOKEN = new RegExp(`[${CJK}]|[^\\s${CJK}]+`, 'gu');

/** As `TOKEN`, except that `http://` or `https://` always starts a new token, even with no space before it. */
const URL_START = 'https?://';
const NOT_URL_START = `(?:(?!${URL_START})[^\\s${CJK}])`;
const ONLINE_TOKEN = new RegExp(`[${CJK}]|${URL_START}${NOT_URL_START}*|${NOT_URL_START}+`, 'giu');

/**
 * HotCRP's word rule, ported from `count_words()` in kohler/hotcrp `lib/base.php`:
 * `preg_match_all('/[^-\s.,;:<>!?*_~`#|]\S*+/us', $text)`. A word starts at the first character of a
 * non-space run that is not one of `- . , ; : < > ! ? * _ ~ ` # |`, and holds the rest of the run. So `#`,
 * `---` and `...` are not words, `--word` is one, and `(parentheses)`, `©`, emoji and whole URLs count.
 * A run of CJK text with no spaces is one word, as in `whitespace` mode.
 */
const HOTCRP_TOKEN = /[^-\s.,;:<>!?*_~`#|]\S*/gu;

const NON_SPACE = /\S+/g;

/** A token is a word only if it holds a letter or a digit, so Markdown markers like `#`, `-`, `>` or `---` are skipped. */
const HAS_WORD_CHAR = /[\p{L}\p{N}]/u;

/** `online` mode also counts tokens holding a symbol such as ©, ™ or an emoji. ASCII symbols like `|` and `>` still don't count. */
const HAS_WORD_CHAR_OR_SYMBOL = /[\p{L}\p{N}\p{So}]/u;

const ASCII_ONLY = /^[\x00-\x7f]*$/;
const WHITESPACE = /\s+/g;

const graphemes: Intl.Segmenter | undefined =
	typeof Intl.Segmenter === 'function' ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : undefined;

/** Counts the words in `text` by the rules of `mode` (see `CountMode`). */
export function countWords(text: string, mode: CountMode = DEFAULT_COUNT_MODE): number {
	switch (mode) {
		case 'hotcrp':
			return countTokens(text, HOTCRP_TOKEN);
		case 'online':
			return countTokens(text, ONLINE_TOKEN, HAS_WORD_CHAR_OR_SYMBOL);
		case 'whitespace':
			return countTokens(text, NON_SPACE);
		default:
			return countTokens(text, TOKEN, HAS_WORD_CHAR);
	}
}

/** Counts the matches of the global regex `token`, keeping only those that match `isWord` when it is given. */
function countTokens(text: string, token: RegExp, isWord?: RegExp): number {
	let words = 0;
	for (const match of text.matchAll(token)) {
		if (!isWord || isWord.test(match[0])) {
			words++;
		}
	}
	return words;
}

/**
 * Counts user-perceived characters (grapheme clusters): an emoji or an accented letter is one character,
 * and a line break is one character whether the file uses LF or CRLF.
 */
export function countCharacters(text: string): number {
	if (ASCII_ONLY.test(text)) {
		return text.length - countCrlf(text);
	}
	if (graphemes) {
		let characters = 0;
		for (const _segment of graphemes.segment(text)) {
			characters++;
		}
		return characters;
	}
	return Array.from(text).length - countCrlf(text);
}

/** Counts characters, ignoring spaces, tabs and line breaks. */
export function countCharactersExcludingWhitespace(text: string): number {
	return countCharacters(text.replace(WHITESPACE, ''));
}

function countCrlf(text: string): number {
	let pairs = 0;
	for (let i = text.indexOf('\r\n'); i !== -1; i = text.indexOf('\r\n', i + 2)) {
		pairs++;
	}
	return pairs;
}

/** Word and (optionally) character totals for one piece of text. */
export interface Counts {
	words: number;
	/** Present only when the character counter is on, so the extra work is skipped when it is off. */
	characters?: CharacterCounts;
}

export interface CharacterCounts {
	all: number;
	excludingWhitespace: number;
}

/** Counts the words in `text` by the rules of `mode`, and its characters too when `withCharacters` is set. */
export function countText(text: string, withCharacters: boolean, mode: CountMode = DEFAULT_COUNT_MODE): Counts {
	const counts: Counts = { words: countWords(text, mode) };
	if (withCharacters) {
		counts.characters = {
			all: countCharacters(text),
			excludingWhitespace: countCharactersExcludingWhitespace(text),
		};
	}
	return counts;
}

/** Adds up several counts, e.g. one per selection of a multi-cursor selection. */
export function sumCounts(parts: readonly Counts[], withCharacters: boolean): Counts {
	const total: Counts = { words: 0 };
	if (withCharacters) {
		total.characters = { all: 0, excludingWhitespace: 0 };
	}
	for (const part of parts) {
		total.words += part.words;
		if (total.characters && part.characters) {
			total.characters.all += part.characters.all;
			total.characters.excludingWhitespace += part.characters.excludingWhitespace;
		}
	}
	return total;
}
