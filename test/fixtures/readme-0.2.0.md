# Word Count (Local)

A local fork of Microsoft's [`ms-vscode.wordcount`](https://github.com/Microsoft/vscode-wordcount) sample
extension. Like the original, it puts a live word count in the status bar. It adds:

1. **Selection word count, live.** Select text and the status bar shows how many words are in the
   selection out of the whole document, updating as you drag, extend with Shift, or type. Multi-cursor
   selections are added up.
2. **A character counter you can turn on and off.** Click the status bar item, or run
   **Word Count: Toggle Character Count** from the Command Palette. The choice is saved in the
   `wordcount.showCharacterCount` setting.

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

If `wordcount.showCharacterCount` is set in the workspace's `.vscode/settings.json`, the toggle changes it
there. Otherwise it changes your user settings.

## How things are counted

- **Words** are runs of non-whitespace text that contain at least one letter or digit, so Markdown markers
  such as `#`, `-`, `>` and `---` are not counted. Chinese and Japanese text has no spaces between words,
  so each Han, Hiragana or Katakana character counts as one word, as in Microsoft Word.
- **Characters** are what a reader sees as one character: an emoji with a skin tone or an accented letter
  counts once. A line break counts once, whether the file uses LF or CRLF line endings.

The original counted words by splitting on whitespace, so its numbers can differ slightly. For example, it
counted `#` and `-` as words.

## Build, test, install

```bash
npm install
npm test                      # compile, then run the unit and extension tests with node --test
npm run package               # builds wordcount-<version>.vsix
code --install-extension wordcount-0.2.0.vsix
```

The original `ms-vscode.wordcount` also adds a word count to the status bar. Disable or uninstall it so
the two items don't sit side by side.

## License

MIT; see the `LICENSE` file. Based on `ms-vscode.wordcount` 0.1.0, © Microsoft Corporation.
