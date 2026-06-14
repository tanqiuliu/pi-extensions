import { describe, expect, test } from 'bun:test';
import {
  formatAnswerValue,
  isAnswerValid,
  normalizeAnswer,
} from '../extensions/questionnaire/format.js';
import {
  appendFreeFormText,
  commitOtherDraft,
  createEmptyQuestionState,
  getQuestionRenderOptions,
  selectSingleOther,
  toggleCustomOther,
  toggleListedOption,
  updateOtherDraft,
} from '../extensions/questionnaire/question-state.js';
import type { NormalizedQuestion } from '../extensions/questionnaire/types.js';

const singleQuestion: NormalizedQuestion = {
  id: 'scope',
  label: 'Scope',
  prompt: 'Pick a scope',
  type: 'singleSelect',
  options: [
    { value: 'small', label: 'Small' },
    { value: 'large', label: 'Large' },
  ],
  allowOther: true,
};

const multipleQuestion: NormalizedQuestion = {
  ...singleQuestion,
  type: 'multiSelect',
};

const freeFormQuestion: NormalizedQuestion = {
  id: 'notes',
  label: 'Notes',
  prompt: 'Add notes',
  type: 'freeForm',
  options: [],
  allowOther: true,
};

describe('singleSelect Other field', () => {
  test('always offers exactly one Other row and never spawns a second', () => {
    const state = createEmptyQuestionState();

    expect(getQuestionRenderOptions(singleQuestion, state).map((o) => o.label)).toEqual([
      'Small',
      'Large',
      'Other: ',
    ]);

    updateOtherDraft(state, 'GraphQL');
    selectSingleOther(state);

    expect(getQuestionRenderOptions(singleQuestion, state).map((o) => o.label)).toEqual([
      'Small',
      'Large',
      'Other: GraphQL',
    ]);
    expect(state.otherSelected).toBe(true);
  });

  test('selecting the Other field clears listed selection and vice versa', () => {
    const state = createEmptyQuestionState();

    toggleListedOption(singleQuestion, state, 'small');
    updateOtherDraft(state, 'GraphQL');
    selectSingleOther(state);
    expect(state.listedSelectedValues).toEqual([]);
    expect(state.otherSelected).toBe(true);

    toggleListedOption(singleQuestion, state, 'large');
    expect(state.listedSelectedValues).toEqual(['large']);
    expect(state.otherSelected).toBe(false);
  });

  test('Other counts as a valid answer only once text is selected', () => {
    const state = createEmptyQuestionState();
    expect(isAnswerValid(singleQuestion, state)).toBe(false);

    updateOtherDraft(state, 'GraphQL');
    selectSingleOther(state);
    expect(isAnswerValid(singleQuestion, state)).toBe(true);
    expect(normalizeAnswer(singleQuestion, state).otherTexts).toEqual(['GraphQL']);
  });
});

describe('multiSelect custom Other options', () => {
  test('commits a draft into a reusable selected option and reopens an empty draft', () => {
    const state = createEmptyQuestionState();

    updateOtherDraft(state, 'GraphQL');
    commitOtherDraft(multipleQuestion, state);

    expect(state.customOtherValues).toEqual(['GraphQL']);
    expect(state.selectedCustomOtherValues).toEqual(['GraphQL']);
    expect(state.otherDraft).toBe('');
    expect(getQuestionRenderOptions(multipleQuestion, state).map((o) => o.label)).toEqual([
      'Small',
      'Large',
      'Other: GraphQL',
      'Other: ',
    ]);
  });

  test('toggles committed custom options without deleting them', () => {
    const state = createEmptyQuestionState();
    updateOtherDraft(state, 'GraphQL');
    commitOtherDraft(multipleQuestion, state);

    toggleCustomOther(multipleQuestion, state, 'GraphQL');
    expect(state.selectedCustomOtherValues).toEqual([]);
    expect(state.customOtherValues).toEqual(['GraphQL']);

    toggleCustomOther(multipleQuestion, state, 'GraphQL');
    expect(state.selectedCustomOtherValues).toEqual(['GraphQL']);
  });

  test('keeps multiple custom options and formats them together', () => {
    const state = createEmptyQuestionState();

    updateOtherDraft(state, 'GraphQL');
    commitOtherDraft(multipleQuestion, state);
    updateOtherDraft(state, 'REST');
    commitOtherDraft(multipleQuestion, state);

    expect(normalizeAnswer(multipleQuestion, state).otherTexts).toEqual(['GraphQL', 'REST']);
    expect(formatAnswerValue(normalizeAnswer(multipleQuestion, state))).toBe(
      'Other: "GraphQL", Other: "REST"',
    );
  });
});

describe('freeForm answers', () => {
  test('renders a single free-form row and validates on non-empty text', () => {
    const state = createEmptyQuestionState();

    expect(getQuestionRenderOptions(freeFormQuestion, state).map((o) => o.kind)).toEqual([
      'freeForm',
    ]);
    expect(isAnswerValid(freeFormQuestion, state)).toBe(false);

    appendFreeFormText(state, 'Needs SSO');
    expect(isAnswerValid(freeFormQuestion, state)).toBe(true);
    expect(normalizeAnswer(freeFormQuestion, state).freeFormText).toBe('Needs SSO');
  });

  test('collapses newlines when formatting the answer value', () => {
    const state = createEmptyQuestionState();
    appendFreeFormText(state, 'Line one\nLine two');
    expect(formatAnswerValue(normalizeAnswer(freeFormQuestion, state))).toBe('Line one / Line two');
  });
});
