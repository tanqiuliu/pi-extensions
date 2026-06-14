import { describe, expect, test } from 'bun:test';
import {
  buildSingleChoiceRows,
  collectAnswers,
  commitOtherDraft,
  createMultiSelectState,
  getMultiRows,
  removeLastCustom,
  selectionCount,
  toggleChoice,
  toggleCustom,
} from '../extensions/ask-user-question/selection.js';
import type { AskOption } from '../extensions/ask-user-question/types.js';

const options: AskOption[] = [
  { label: 'Small', value: 'small' },
  { label: 'Large', value: 'large' },
];

describe('single-select rows', () => {
  test('lists numbered options followed by a single Other row', () => {
    const rows = buildSingleChoiceRows(options, 'Other');
    expect(rows.map((r) => r.label)).toEqual(['Small', 'Large', 'Other']);
    expect(rows.map((r) => r.index)).toEqual([1, 2, undefined]);
    expect(rows.at(-1)?.isOther).toBe(true);
  });
});

describe('multi-select state', () => {
  test('rows are choices, then customs, then Other, then Submit', () => {
    const state = createMultiSelectState(options, 'Other');
    expect(getMultiRows(state).map((r) => r.kind)).toEqual(['choice', 'choice', 'other', 'submit']);
  });

  test('toggleChoice adds and removes listed selections', () => {
    const state = createMultiSelectState(options, 'Other');
    const [small] = getMultiRows(state);

    toggleChoice(state, small);
    expect(selectionCount(state)).toBe(1);
    toggleChoice(state, small);
    expect(selectionCount(state)).toBe(0);
  });

  test('commitOtherDraft turns the draft into a reusable selected option', () => {
    const state = createMultiSelectState(options, 'Other');
    state.otherDraft = '  GraphQL  ';

    expect(commitOtherDraft(state)).toBe(true);
    expect(state.otherDraft).toBe('');
    expect(getMultiRows(state).map((r) => r.kind)).toEqual([
      'choice',
      'choice',
      'custom',
      'other',
      'submit',
    ]);
    expect(selectionCount(state)).toBe(1);
  });

  test('blank drafts do not commit', () => {
    const state = createMultiSelectState(options, 'Other');
    state.otherDraft = '   ';
    expect(commitOtherDraft(state)).toBe(false);
    expect(state.customItems).toHaveLength(0);
  });

  test('toggleCustom flips selection without removing the option', () => {
    const state = createMultiSelectState(options, 'Other');
    state.otherDraft = 'GraphQL';
    commitOtherDraft(state);
    const id = state.customItems[0].id;

    toggleCustom(state, id);
    expect(selectionCount(state)).toBe(0);
    expect(state.customItems).toHaveLength(1);
    toggleCustom(state, id);
    expect(selectionCount(state)).toBe(1);
  });

  test('removeLastCustom drops the most recent custom answer', () => {
    const state = createMultiSelectState(options, 'Other');
    state.otherDraft = 'GraphQL';
    commitOtherDraft(state);
    expect(removeLastCustom(state)).toBe(true);
    expect(state.customItems).toHaveLength(0);
    expect(removeLastCustom(state)).toBe(false);
  });

  test('collectAnswers returns selected options then customs, sorted', () => {
    const state = createMultiSelectState(options, 'Other');
    const rows = getMultiRows(state);
    toggleChoice(state, rows[1]); // Large (index 2)
    toggleChoice(state, rows[0]); // Small (index 1)
    state.otherDraft = 'GraphQL';
    commitOtherDraft(state);

    expect(collectAnswers(state)).toEqual([
      { type: 'option', label: 'Small', value: 'small', index: 1 },
      { type: 'option', label: 'Large', value: 'large', index: 2 },
      { type: 'other', label: 'GraphQL', value: 'GraphQL' },
    ]);
  });
});
