import type { ExtensionContext } from '@earendil-works/pi-coding-agent';
import { Key, matchesKey, truncateToWidth, wrapTextWithAnsi } from '@earendil-works/pi-tui';
import type { AskAnswer, AskOption } from './types.js';
import {
  buildSingleChoiceRows,
  collectAnswers,
  commitOtherDraft,
  createMultiSelectState,
  getMultiRows,
  otherRowIndex,
  removeLastCustom,
  selectionCount,
  toggleChoice,
  toggleCustom,
} from './selection.js';

type Ui = Pick<ExtensionContext, 'ui'>;

function isPrintableInput(data: string): boolean {
  const chars = Array.from(data);
  return (
    chars.length > 0 &&
    chars.every((char) => {
      const code = char.codePointAt(0) ?? 0;
      return code > 0x1f && code !== 0x7f;
    })
  );
}

function deleteLastChar(value: string): string {
  return Array.from(value).slice(0, -1).join('');
}

function addWrapped(lines: string[], text: string, width: number, indent = ''): void {
  const contentWidth = Math.max(1, width - indent.length);
  for (const line of wrapTextWithAnsi(text, contentWidth)) {
    lines.push(truncateToWidth(`${indent}${line}`, width));
  }
}

export async function askSingleChoice(
  ctx: Ui,
  question: string,
  context: string | undefined,
  options: AskOption[],
  otherLabel: string,
  signal: AbortSignal | undefined,
): Promise<AskAnswer | null> {
  const rows = buildSingleChoiceRows(options, otherLabel);

  return ctx.ui.custom<AskAnswer | null>((tui, theme, _kb, done) => {
    let optionIndex = 0;
    let editMode = false;
    let otherDraft = '';
    let cachedLines: string[] | undefined;

    // Resolve the prompt if the agent aborts while it is open, otherwise the tool hangs.
    const onAbort = () => done(null);
    signal?.addEventListener('abort', onAbort, { once: true });

    function refresh() {
      cachedLines = undefined;
      tui.requestRender();
    }

    function submitOther() {
      const trimmed = otherDraft.trim();
      if (!trimmed) return;
      done({ type: 'other', label: trimmed, value: trimmed });
    }

    function startOtherEdit(initialText?: string) {
      editMode = true;
      if (initialText !== undefined) otherDraft = initialText;
      refresh();
    }

    function handleInput(data: string) {
      if (editMode) {
        if (matchesKey(data, Key.up)) {
          editMode = false;
          optionIndex = Math.max(0, optionIndex - 1);
          refresh();
          return;
        }
        if (matchesKey(data, Key.down)) {
          editMode = false;
          optionIndex = Math.min(rows.length - 1, optionIndex + 1);
          refresh();
          return;
        }
        if (matchesKey(data, Key.escape)) {
          editMode = false;
          otherDraft = '';
          refresh();
          return;
        }
        if (matchesKey(data, Key.enter)) {
          submitOther();
          return;
        }
        if (matchesKey(data, Key.backspace) || data === '') {
          otherDraft = deleteLastChar(otherDraft);
          refresh();
          return;
        }
        if (isPrintableInput(data)) {
          otherDraft += data;
          refresh();
        }
        return;
      }

      if (matchesKey(data, Key.up)) {
        optionIndex = Math.max(0, optionIndex - 1);
        refresh();
        return;
      }
      if (matchesKey(data, Key.down)) {
        optionIndex = Math.min(rows.length - 1, optionIndex + 1);
        refresh();
        return;
      }
      if (matchesKey(data, Key.enter)) {
        const selected = rows[optionIndex];
        if (selected.isOther) {
          if (otherDraft.trim()) submitOther();
          else startOtherEdit();
          return;
        }
        done({
          type: 'option',
          label: selected.label,
          value: selected.value,
          index: selected.index!,
        });
        return;
      }
      if (matchesKey(data, Key.escape)) {
        done(null);
        return;
      }

      const selected = rows[optionIndex];
      if (selected.isOther && isPrintableInput(data)) {
        // Resume the existing draft rather than discarding it.
        startOtherEdit(otherDraft + data);
      }
    }

    function render(width: number): string[] {
      if (cachedLines) return cachedLines;

      const lines: string[] = [];
      const add = (text: string) => lines.push(truncateToWidth(text, width));

      add(theme.fg('accent', '─'.repeat(width)));
      addWrapped(lines, theme.fg('text', ` ${question}`), width);
      if (context) {
        lines.push('');
        addWrapped(lines, theme.fg('muted', ` ${context}`), width);
      }
      lines.push('');

      for (let i = 0; i < rows.length; i++) {
        const option = rows[i];
        const selected = i === optionIndex;
        const prefix = selected ? theme.fg('accent', '> ') : '  ';
        const label = option.isOther
          ? editMode && selected
            ? `${option.label}: ${otherDraft}${theme.fg('dim', '▏')}`
            : otherDraft
              ? `${option.label}: ${otherDraft}`
              : option.label
          : `${option.index}. ${option.label}`;
        const styled = selected ? theme.fg('accent', label) : theme.fg('text', label);
        add(`${prefix}${styled}`);
        if (option.description) {
          addWrapped(lines, theme.fg('muted', option.description), width, '     ');
        }
      }

      lines.push('');
      if (editMode) {
        add(theme.fg('dim', ' Type custom answer after Other: • Enter submit • Esc clear/go back'));
      } else {
        add(
          theme.fg(
            'dim',
            ' ↑↓ navigate • Enter select • Type on Other for custom answer • Esc cancel',
          ),
        );
      }

      add(theme.fg('accent', '─'.repeat(width)));
      cachedLines = lines;
      return lines;
    }

    return {
      render,
      handleInput,
      invalidate: () => {
        cachedLines = undefined;
      },
      dispose: () => signal?.removeEventListener('abort', onAbort),
    };
  });
}

export async function askMultiChoice(
  ctx: Ui,
  question: string,
  context: string | undefined,
  options: AskOption[],
  otherLabel: string,
  signal: AbortSignal | undefined,
): Promise<AskAnswer[] | null> {
  return ctx.ui.custom<AskAnswer[] | null>((tui, theme, _kb, done) => {
    const state = createMultiSelectState(options, otherLabel);
    let optionIndex = 0;
    let editMode = false;
    let cachedLines: string[] | undefined;

    // Resolve the prompt if the agent aborts while it is open, otherwise the tool hangs.
    const onAbort = () => done(null);
    signal?.addEventListener('abort', onAbort, { once: true });

    function clampOptionIndex() {
      optionIndex = Math.min(Math.max(0, optionIndex), getMultiRows(state).length - 1);
    }

    function refresh() {
      clampOptionIndex();
      cachedLines = undefined;
      tui.requestRender();
    }

    function move(delta: number) {
      optionIndex = Math.min(Math.max(0, optionIndex + delta), getMultiRows(state).length - 1);
      refresh();
    }

    function startOtherEdit(initialText?: string) {
      editMode = true;
      if (initialText !== undefined) state.otherDraft = initialText;
      refresh();
    }

    function saveOtherDraft() {
      if (!commitOtherDraft(state)) {
        refresh();
        return;
      }
      editMode = false;
      optionIndex = otherRowIndex(state); // Keep focus on Other after the new custom row.
      refresh();
    }

    function submitAnswers() {
      if (selectionCount(state) === 0) return;
      done(collectAnswers(state));
    }

    function handleInput(data: string) {
      if (editMode) {
        if (matchesKey(data, Key.up)) {
          editMode = false;
          move(-1);
          return;
        }
        if (matchesKey(data, Key.down)) {
          editMode = false;
          move(1);
          return;
        }
        if (matchesKey(data, Key.escape)) {
          editMode = false;
          state.otherDraft = '';
          refresh();
          return;
        }
        if (matchesKey(data, Key.enter)) {
          saveOtherDraft();
          return;
        }
        if (matchesKey(data, Key.backspace) || data === '') {
          state.otherDraft = deleteLastChar(state.otherDraft);
          refresh();
          return;
        }
        if (isPrintableInput(data)) {
          state.otherDraft += data;
          refresh();
        }
        return;
      }

      if (matchesKey(data, Key.up)) {
        move(-1);
        return;
      }
      if (matchesKey(data, Key.down)) {
        move(1);
        return;
      }

      const current = getMultiRows(state)[optionIndex];

      if (matchesKey(data, Key.space)) {
        switch (current.kind) {
          case 'submit':
            return;
          case 'other':
            startOtherEdit();
            return;
          case 'custom':
            toggleCustom(state, current.id);
            refresh();
            return;
          case 'choice':
            toggleChoice(state, current);
            refresh();
            return;
        }
      }

      if (matchesKey(data, Key.enter)) {
        switch (current.kind) {
          case 'submit':
            submitAnswers();
            return;
          case 'other':
            if (state.otherDraft.trim()) saveOtherDraft();
            else startOtherEdit();
            return;
          case 'custom':
            toggleCustom(state, current.id);
            refresh();
            return;
          case 'choice':
            toggleChoice(state, current);
            refresh();
            return;
        }
      }

      if ((matchesKey(data, Key.backspace) || data === '') && current.kind === 'other') {
        if (removeLastCustom(state)) {
          optionIndex = otherRowIndex(state);
          refresh();
        }
        return;
      }

      if (matchesKey(data, Key.escape)) {
        done(null);
        return;
      }

      if (current.kind === 'other' && isPrintableInput(data)) {
        // Resume the existing draft rather than discarding it.
        startOtherEdit(state.otherDraft + data);
      }
    }

    function render(width: number): string[] {
      if (cachedLines) return cachedLines;

      const lines: string[] = [];
      const add = (text: string) => lines.push(truncateToWidth(text, width));

      add(theme.fg('accent', '─'.repeat(width)));
      addWrapped(lines, theme.fg('text', ` ${question}`), width);
      if (context) {
        lines.push('');
        addWrapped(lines, theme.fg('muted', ` ${context}`), width);
      }
      lines.push('');

      const rows = getMultiRows(state);
      for (let i = 0; i < rows.length; i++) {
        const item = rows[i];
        const isFocused = i === optionIndex;
        const prefix = isFocused ? theme.fg('accent', '> ') : '  ';

        if (item.kind === 'submit') {
          const count = selectionCount(state);
          const label = count > 0 ? `✓ ${item.label} (${count} selected)` : `○ ${item.label}`;
          const styled = isFocused
            ? theme.fg('accent', label)
            : theme.fg(count > 0 ? 'success' : 'dim', label);
          add(`${prefix}${styled}`);
          continue;
        }

        if (item.kind === 'other') {
          const inlineDraft =
            editMode && isFocused
              ? `: ${state.otherDraft}${theme.fg('dim', '▏')}`
              : state.otherDraft
                ? `: ${state.otherDraft}`
                : '';
          const label = `[ ] ${item.label}${inlineDraft}`;
          const styled = isFocused ? theme.fg('accent', label) : theme.fg('text', label);
          add(`${prefix}${styled}`);
          continue;
        }

        if (item.kind === 'custom') {
          const marker = item.selected ? '[x]' : '[ ]';
          const label = `${marker} Other: ${item.label}`;
          const styled = isFocused
            ? theme.fg('accent', label)
            : theme.fg(item.selected ? 'success' : 'text', label);
          add(`${prefix}${styled}`);
          continue;
        }

        const checked = state.selected.has(item.id);
        const marker = checked ? '[x]' : '[ ]';
        const label = `${marker} ${item.index}. ${item.label}`;
        const styled = isFocused
          ? theme.fg('accent', label)
          : theme.fg(checked ? 'success' : 'text', label);
        add(`${prefix}${styled}`);
        if (item.description) {
          addWrapped(lines, theme.fg('muted', item.description), width, '     ');
        }
      }

      lines.push('');
      if (selectionCount(state) === 0) {
        add(theme.fg('warning', ' Select at least one answer before submitting.'));
      }
      if (editMode) {
        add(
          theme.fg(
            'dim',
            ' Type custom answer after Other: • Enter add • ↑↓ move away • Esc clear/go back',
          ),
        );
      } else {
        add(
          theme.fg(
            'dim',
            ' ↑↓ navigate • Space/Enter toggle • Type on Other to add custom • Backspace remove last custom • Esc cancel',
          ),
        );
      }

      add(theme.fg('accent', '─'.repeat(width)));
      cachedLines = lines;
      return lines;
    }

    return {
      render,
      handleInput,
      invalidate: () => {
        cachedLines = undefined;
      },
      dispose: () => signal?.removeEventListener('abort', onAbort),
    };
  });
}
