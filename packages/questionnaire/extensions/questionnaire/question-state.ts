import type { NormalizedQuestion, QuestionSelectionState, RenderOption } from './types.js';

export const OTHER_DRAFT_VALUE = '__other_draft__';
export const FREE_FORM_VALUE = '__free_form__';

export function createEmptyQuestionState(): QuestionSelectionState {
  return {
    listedSelectedValues: [],
    customOtherValues: [],
    selectedCustomOtherValues: [],
    otherDraft: '',
    otherSelected: false,
    freeFormText: '',
  };
}

export function getQuestionRenderOptions(
  question: NormalizedQuestion,
  state: QuestionSelectionState,
): RenderOption[] {
  if (question.type === 'freeForm') {
    return [{ kind: 'freeForm', value: FREE_FORM_VALUE, label: state.freeFormText }];
  }

  const listed: RenderOption[] = question.options.map((option) => ({
    kind: 'listed',
    value: option.value,
    label: option.label,
    description: option.description,
  }));

  const draft: RenderOption = {
    kind: 'otherDraft',
    value: OTHER_DRAFT_VALUE,
    label: `Other: ${state.otherDraft}`,
  };

  // singleSelect always offers a single Other field; the draft never spawns a
  // second row because the typed text stays inline on that one row.
  if (question.type === 'singleSelect') {
    return listed.concat(draft);
  }

  // multiSelect: reusable committed Other options followed by a fresh draft row.
  if (!question.allowOther) return listed;

  const custom: RenderOption[] = state.customOtherValues.map((value) => ({
    kind: 'customOther',
    value,
    label: `Other: ${value}`,
  }));

  return listed.concat(custom, draft);
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

export function appendFreeFormText(state: QuestionSelectionState, text: string) {
  state.freeFormText += text;
}

export function deleteFreeFormText(state: QuestionSelectionState) {
  state.freeFormText = state.freeFormText.slice(0, -1);
}

// singleSelect: choosing the Other field makes its draft text the answer and
// clears any listed selection.
export function selectSingleOther(state: QuestionSelectionState) {
  state.listedSelectedValues = [];
  state.otherSelected = state.otherDraft.trim().length > 0;
}

// multiSelect: commit the current draft into a reusable, selected Other option.
export function commitOtherDraft(
  question: NormalizedQuestion,
  state: QuestionSelectionState,
): boolean {
  if (question.type !== 'multiSelect') return false;

  const value = state.otherDraft.trim();
  if (!value) {
    state.otherDraft = '';
    return false;
  }

  if (!state.customOtherValues.includes(value)) {
    state.customOtherValues.push(value);
  }
  if (!state.selectedCustomOtherValues.includes(value)) {
    state.selectedCustomOtherValues.push(value);
  }
  state.otherDraft = '';
  return true;
}

export function toggleListedOption(
  question: NormalizedQuestion,
  state: QuestionSelectionState,
  value: string,
) {
  if (question.type === 'singleSelect') {
    state.listedSelectedValues = [value];
    state.otherSelected = false;
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
  _question: NormalizedQuestion,
  state: QuestionSelectionState,
  value: string,
) {
  if (state.selectedCustomOtherValues.includes(value)) {
    state.selectedCustomOtherValues = state.selectedCustomOtherValues.filter(
      (item) => item !== value,
    );
    return;
  }

  state.selectedCustomOtherValues.push(value);
}
