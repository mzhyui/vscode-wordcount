# Word Count HotCRP

A live word counter for [HotCRP](https://hotcrp.com) submissions. It keeps a word count in the status bar
that is measured the same way HotCRP measures text, so the number you see while writing is the number the
submission form checks against its word limits — for abstracts, reviews and comments alike.

The default counting rule is a direct port of HotCRP's `count_words()`
([`lib/base.php`](https://github.com/kohler/hotcrp/blob/master/lib/base.php)): a word is a run of
non-whitespace text whose first character is not one of `- . , ; : < > ! ? * _ ~ ` # |`. Markdown markers
such as `#`, `-`, `>` and `---` are skipped, while symbols such as `©`, emoji, parentheses and URLs count.
A link `[label](https://…)` is one word, and a run of Chinese or Japanese text with no spaces is one word.

A local fork of Microsoft's [`ms-vscode.wordcount`](https://github.com/Microsoft/vscode-wordcount) sample
extension. Like the original, it puts a live word count in the status bar. It adds:

1. **HotCRP's measurement, by default.** The `hotcrp` counting rule above, so you can write to a word
   limit without pasting text into the submission form to check it.
2. **Selection word count, live.** Select text and the status bar shows how many words are in the
   selection out of the whole document, updating as you drag, extend with Shift, or type. Multi-cursor
   selections are added up.
3. **A character counter you can turn on and off.** Click the status bar item, or run
   **Word Count HotCRP: Toggle Character Count** from the Command Palette. The choice is saved in the
   `wordcount.showCharacterCount` setting.
4. **A choice of counting rules.** `wordcount.countMode` also offers Markdown-aware counting, the rules
   online word counters use, and plain whitespace splitting, for when you are writing for something other
   than HotCRP.

## What the status bar shows

| State | Character counter off | Character counter on |
| --- | --- | --- |
| No selection | `340 Words` | `340 Words, 1,920 Chars` |
| Text selected | `12 of 340 Words` | `12 of 340 Words, 58 of 1,920 Chars` |

Hover over the item for detail: the number of selected ranges, and, when the character counter is on, the
character count without whitespace.

## Settings

| Setting | Default | Meaning |
| --- | --- | --- |
| `wordcount.showCharacterCount` | `false` | Show the character count. The toggle command flips this. |
| `wordcount.languages` | `["markdown"]` | Language IDs the count is shown for, e.g. `["markdown", "latex", "plaintext"]`. Use `["*"]` for every file. |
| `wordcount.countMode` | `"hotcrp"` | How words are counted: `"hotcrp"`, `"markdown"`, `"online"` or `"whitespace"`. See below. |

If `wordcount.showCharacterCount` is set in the workspace's `.vscode/settings.json`, the toggle changes it
there. Otherwise it changes your user settings.

## How things are counted

**Words** follow the rules of `wordcount.countMode`:

| Mode | A word is | `## Hi © [docs](https://x.io) - ok` |
| --- | --- | --- |
| `hotcrp` (default) | A run of non-whitespace text whose first character is not one of `- . , ; : < > ! ? * _ ~ ` # \|` — HotCRP's `count_words()` rule. Leading markers are skipped, so `--word` counts but `---` does not; `©`, emoji, `()` and whole URLs count. | 4 |
| `markdown` | A run of non-whitespace text with at least one letter or digit, so Markdown markers such as `#`, `-`, `>` and `---` are not counted. | 3 |
| `online` | As `markdown`, but symbols such as `©`, `™` and emoji count as words, and a URL is a word of its own, so a link `[label](https://…)` counts as two words. Use it to match online word counters that you paste the raw text into. | 5 |
| `whitespace` | Any run of non-whitespace characters, `#` and `-` included. The original `ms-vscode.wordcount` and `wc -w` count this way. | 6 |

Chinese and Japanese text has no spaces between words. In `markdown` and `online` modes each Han,
Hiragana or Katakana character counts as one word, as in Microsoft Word. HotCRP does not split them: in
`hotcrp` mode, as in `whitespace` mode, a run of them with no spaces counts as one word.

**Characters** are what a reader sees as one character: an emoji with a skin tone or an accented letter
counts once. A line break counts once, whether the file uses LF or CRLF line endings. The counting mode
does not change the character count.

## Build, test, install

```bash
npm install
npm test                      # compile, then run the unit and extension tests with node --test
npm run package               # builds word-count-HotCRP-<version>.vsix
code --install-extension word-count-HotCRP-0.4.0.vsix
```

The original `ms-vscode.wordcount` also adds a word count to the status bar. Disable or uninstall it so
the two items don't sit side by side.

## License

MIT; see the `LICENSE` file. Based on `ms-vscode.wordcount` 0.1.0, © Microsoft Corporation.
