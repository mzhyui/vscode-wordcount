/**
 * Builds the status bar text and tooltip from counts. Pure, so it is unit-tested without VS Code.
 */
import type { Counts } from './counter';

export interface StatusInput {
	/** Counts for the whole document. */
	document: Counts;
	/** Counts for the non-empty selections, when there are any. */
	selection?: Counts & { ranges: number };
	/** Whether the character counter is on. */
	showCharacters: boolean;
}

export interface StatusOutput {
	text: string;
	tooltip: string;
}

const numberFormat = new Intl.NumberFormat('en-US');

function n(value: number): string {
	return numberFormat.format(value);
}

/** "1 Word" / "12 Words" / "12 of 340 Words": the noun agrees with the last number shown. */
function part(selected: number | undefined, total: number, singular: string, plural: string): string {
	const noun = total === 1 ? singular : plural;
	return selected === undefined ? `${n(total)} ${noun}` : `${n(selected)} of ${n(total)} ${noun}`;
}

function describe(label: string, counts: Counts): string {
	const words = `${n(counts.words)} ${counts.words === 1 ? 'word' : 'words'}`;
	if (!counts.characters) {
		return `${label}: ${words}`;
	}
	const { all, excludingWhitespace } = counts.characters;
	const characters = `${n(all)} ${all === 1 ? 'character' : 'characters'}`;
	return `${label}: ${words}, ${characters} (${n(excludingWhitespace)} excluding whitespace)`;
}

export function formatStatus(input: StatusInput): StatusOutput {
	const { document, selection, showCharacters } = input;

	const pieces = [part(selection?.words, document.words, 'Word', 'Words')];
	if (showCharacters && document.characters) {
		pieces.push(part(selection?.characters?.all, document.characters.all, 'Char', 'Chars'));
	}

	const lines: string[] = [];
	if (selection) {
		const label = selection.ranges === 1 ? 'Selection' : `Selection (${selection.ranges} ranges)`;
		lines.push(describe(label, selection));
	}
	lines.push(describe('Document', document));
	lines.push(showCharacters ? 'Click to hide the character count' : 'Click to show the character count');

	return { text: `$(pencil) ${pieces.join(', ')}`, tooltip: lines.join('\n') };
}
