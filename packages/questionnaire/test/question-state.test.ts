import { describe, expect, test } from 'bun:test';
import {
  formatAnswerValue,
  normalizeAnswer,
} from '../extensions/questionnaire/format.js';
import {
  commitOtherDraft,
  createEmptyQuestionState,
  getQuestionRenderOptions,
  updateOtherDraft,
  toggleCustomOther,
  toggleListedOption,
} from '../extensions/questionnaire/question-state.js';
import type { NormalizedQuestion } from '../extensions/questionnaire/types.js';

const singleQuestion: NormalizedQuestion = {
  id: 'scope',
  label: 'Scope',
  prompt: 'Pick a scope',
  selectionMode: 'single',
  options: [
    { value: 'small', label: 'Small' },
    { value: 'large', label: 'Large' },
  ],
  allowOther: true,
};

const multipleQuestion: NormalizedQuestion = {
  ...singleQuestion,
  selectionMode: 'multiple',
};

describe('question state custom Other options', () => {
  test('commits typed Other draft as a selected custom option and creates a new draft row', () => {
    const state = createEmptyQuestionState();

    updateOtherDraft(state, 'GraphQL');
    commitOtherDraft(multipleQuestion, state);

    expect(state.customOtherValues).toEqual(['GraphQL']);
    expect(state.selectedCustomOtherValues).toEqual(['GraphQL']);
    expect(state.otherDraft).toBe('');
    expect(getQuestionRenderOptions(multipleQuestion, state).map((option) => option.label)).toEqual([
      'Small',
      'Large',
      'Other: GraphQL',
      'Other: ',
    ]);
  });

  test('toggles committed custom Other options without deleting them', () => {
    const state = createEmptyQuestionState();
    updateOtherDraft(state, 'GraphQL');
    commitOtherDraft(multipleQuestion, state);

    toggleCustomOther(multipleQuestion, state, 'GraphQL');
    expect(state.customOtherValues).toEqual(['GraphQL']);
    expect(state.selectedCustomOtherValues).toEqual([]);

    toggleCustomOther(multipleQuestion, state, 'GraphQL');
    expect(state.selectedCustomOtherValues).toEqual(['GraphQL']);
  });

  test('keeps multiple custom Other options selectable for multi-select questions', () => {
    const state = createEmptyQuestionState();

    updateOtherDraft(state, 'GraphQL');
    commitOtherDraft(multipleQuestion, state);
    updateOtherDraft(state, 'REST');
    commitOtherDraft(multipleQuestion, state);

    expect(state.customOtherValues).toEqual(['GraphQL', 'REST']);
    expect(state.selectedCustomOtherValues).toEqual(['GraphQL', 'REST']);
    expect(normalizeAnswer(multipleQuestion, state).otherTexts).toEqual(['GraphQL', 'REST']);
    expect(formatAnswerValue(normalizeAnswer(multipleQuestion, state))).toBe(
      'Other: "GraphQL", Other: "REST"',
    );
  });

  test('single-select custom Other choices replace listed selections', () => {
    const state = createEmptyQuestionState();

    toggleListedOption(singleQuestion, state, 'small');
    updateOtherDraft(state, 'GraphQL');
    commitOtherDraft(singleQuestion, state);

    expect(state.listedSelectedValues).toEqual([]);
    expect(state.selectedCustomOtherValues).toEqual(['GraphQL']);
  });

  test('single-select keeps only the latest custom Other option', () => {
    const state = createEmptyQuestionState();

    updateOtherDraft(state, 'GraphQL');
    commitOtherDraft(singleQuestion, state);
    updateOtherDraft(state, 'REST');
    commitOtherDraft(singleQuestion, state);

    expect(state.customOtherValues).toEqual(['REST']);
    expect(state.selectedCustomOtherValues).toEqual(['REST']);
    expect(getQuestionRenderOptions(singleQuestion, state).map((option) => option.label)).toEqual([
      'Small',
      'Large',
      'Other: REST',
      'Other: ',
    ]);
  });

  test('custom Other rows use the same unquoted display style as the draft row', () => {
    const state = createEmptyQuestionState();

    updateOtherDraft(state, 'GraphQL');
    commitOtherDraft(multipleQuestion, state);
    updateOtherDraft(state, 'REST');

    expect(getQuestionRenderOptions(multipleQuestion, state).map((option) => option.label)).toEqual([
      'Small',
      'Large',
      'Other: GraphQL',
      'Other: REST',
    ]);
  });
});
