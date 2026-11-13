# Changelog

## 0.4.0 (2026-11-12)

- Rename to **Word Count HotCRP** (`word-count-HotCRP`).
- Add a `hotcrp` counting mode, now the default: a port of HotCRP's `count_words()` (`lib/base.php`), the
  rule HotCRP applies to abstract, review and comment word limits. A word is a run of non-whitespace text
  whose first character is not one of `- . , ; : < > ! ? * _ ~ ` # |`; a run of CJK text with no spaces is
  one word. Verified against the original PCRE pattern on hand-picked and random strings.
- `markdown`, `online` and `whitespace` modes are unchanged. Settings keys stay `wordcount.*`, so existing
  settings keep working.

## 0.3.0 (2026-11-09)

- Add `wordcount.countMode` to choose how words are counted:
  - `markdown` (default, unchanged): skip tokens with no letter or digit, such as Markdown markers.
  - `online`: match online word counters that are given the raw text. Symbols such as `©` and emoji count
    as words, and a URL is a word of its own, so `[label](https://…)` is two words.
  - `whitespace`: count every run of non-space characters, as the original `ms-vscode.wordcount` did.

## 0.2.0 (2026-11-09)

Local fork of `ms-vscode.wordcount` 0.1.0.

- Count the words in the current selection(s) live: `12 of 340 Words`. Multi-cursor selections are added up.
- Add a character counter, off by default. Turn it on or off with **Word Count: Toggle Character Count**,
  by clicking the status bar item, or with the `wordcount.showCharacterCount` setting.
- Add `wordcount.languages` to choose which file types show the count (default: Markdown only, as before).
- Update on edits that don't move the cursor, on settings changes, and on language-mode changes.
- Skip Markdown markers (`#`, `-`, `>`) when counting words. Count each CJK character as one word.
- Re-count the whole document only after it changes, not on every cursor move.
