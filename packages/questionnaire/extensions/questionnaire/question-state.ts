import type { NormalizedQuestion, QuestionSelectionState, RenderOption } from './types.js';

export function createEmptyQuestionState(): QuestionSelectionState {
  return {
    listedSelectedValues: [],
    customOtherValues: [],
    selectedCustomOtherValues: [],
    otherDraft: '',
  };
}

export function getQuestionRenderOptions(
  question: NormalizedQuestion,
  state: QuestionSelectionState,
): RenderOption[] {
  const listed: RenderOption[] = question.options.map((option) => ({
    kind: 'listed',
    value: option.value,
    label: option.label,
    description: option.description,
  }));

  if (!question.allowOther) return listed;

  const custom: RenderOption[] = state.customOtherValues.map((value) => ({
    kind: 'customOther',
    value,
    label: `Other: ${value}`,
  }));

  return listed.concat(custom, {
    kind: 'otherDraft',
    value: '__other_draft__',
    label: `Other: ${state.otherDraft}`,
  });
}

export function updateOtherDraft(state: QuestionSelectionState, value: string) {
  state.otherDraft = value;
}

export function appendOtherDraftText(state: QuestionSelectionState, text: string) {
  state.otherDraft += text;
}

export function deleteOtherDraftText(state: QuestionSelectionState) {
  state.otherDraft = state.otherDraft.slice(0, -1);
}

export function commitOtherDraft(
  question: NormalizedQuestion,
  state: QuestionSelectionState,
): boolean {
  const value = state.otherDraft.trim();
  if (!value) {
    state.otherDraft = '';
    return false;
  }

  if (question.selectionMode === 'single') {
    state.customOtherValues = [value];
  } else if (!state.customOtherValues.includes(value)) {
    state.customOtherValues.push(value);
  }

  selectCustomOther(question, state, value);
  state.otherDraft = '';
  return true;
}

export function toggleListedOption(
  question: NormalizedQuestion,
  state: QuestionSelectionState,
  value: string,
) {
  if (question.selectionMode === 'single') {
    state.listedSelectedValues = [value];
    state.selectedCustomOtherValues = [];
    return;
  }

  const existing = new Set(state.listedSelectedValues);
  if (existing.has(value)) existing.delete(value);
  else existing.add(value);
  state.listedSelectedValues = question.options
    .map((item) => item.value)
    .filter((optionValue) => existing.has(optionValue));
}

export function toggleCustomOther(
  question: NormalizedQuestion,
  state: QuestionSelectionState,
  value: string,
) {
  if (state.selectedCustomOtherValues.includes(value)) {
    state.selectedCustomOtherValues = state.selectedCustomOtherValues.filter(
      (item) => item !== value,
    );
    return;
  }

  selectCustomOther(question, state, value);
}

function selectCustomOther(
  question: NormalizedQuestion,
  state: QuestionSelectionState,
  value: string,
) {
  if (question.selectionMode === 'single') {
    state.listedSelectedValues = [];
    state.selectedCustomOtherValues = [value];
    return;
  }

  if (!state.selectedCustomOtherValues.includes(value)) {
    state.selectedCustomOtherValues.push(value);
  }
}
