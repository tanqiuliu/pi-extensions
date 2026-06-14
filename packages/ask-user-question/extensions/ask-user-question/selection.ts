import { sortAnswers } from './answers.js';
import type { AskAnswer, AskOption, DisplayOption, OptionAnswer, OtherAnswer } from './types.js';

export const OTHER_VALUE = '__other__';
export const SUBMIT_VALUE = '__submit__';

// singleSelect: listed options followed by a single Other field. The typed text
// stays inline on that one row, so it never spawns a second Other row.
export function buildSingleChoiceRows(options: AskOption[], otherLabel: string): DisplayOption[] {
  return [
    ...options.map((option, index) => ({ ...option, id: `option:${index}`, index: index + 1 })),
    { id: 'other', label: otherLabel, value: OTHER_VALUE, isOther: true },
  ];
}

export interface CustomOtherItem extends OtherAnswer {
  id: string;
  selected: boolean;
}

// Discriminated rows so handlers can switch on `kind` without optional-flag guesswork.
export type MultiRow =
  | (DisplayOption & { kind: 'choice' })
  | (CustomOtherItem & { kind: 'custom' })
  | (DisplayOption & { kind: 'other' })
  | (DisplayOption & { kind: 'submit' });

export interface MultiSelectState {
  choices: DisplayOption[];
  otherLabel: string;
  selected: Map<string, OptionAnswer>;
  customItems: CustomOtherItem[];
  otherDraft: string;
  nextCustomId: number;
}

export function createMultiSelectState(options: AskOption[], otherLabel: string): MultiSelectState {
  return {
    choices: options.map((option, index) => ({
      ...option,
      id: `option:${index}`,
      index: index + 1,
    })),
    otherLabel,
    selected: new Map(),
    customItems: [],
    otherDraft: '',
    nextCustomId: 1,
  };
}

export function getMultiRows(state: MultiSelectState): MultiRow[] {
  return [
    ...state.choices.map((item) => ({ ...item, kind: 'choice' as const })),
    ...state.customItems.map((item) => ({ ...item, kind: 'custom' as const })),
    { id: 'other', label: state.otherLabel, value: OTHER_VALUE, kind: 'other' as const },
    { id: 'submit', label: 'Submit', value: SUBMIT_VALUE, kind: 'submit' as const },
  ];
}

// Index of the Other row, used to keep focus there after committing/removing a custom answer.
export function otherRowIndex(state: MultiSelectState): number {
  return state.choices.length + state.customItems.length;
}

export function selectionCount(state: MultiSelectState): number {
  return state.selected.size + state.customItems.filter((item) => item.selected).length;
}

export function toggleChoice(state: MultiSelectState, item: DisplayOption) {
  if (state.selected.has(item.id)) {
    state.selected.delete(item.id);
    return;
  }
  state.selected.set(item.id, {
    type: 'option',
    label: item.label,
    value: item.value,
    index: item.index!,
  });
}

export function toggleCustom(state: MultiSelectState, id: string) {
  const stored = state.customItems.find((item) => item.id === id);
  if (!stored) return;
  stored.selected = !stored.selected;
}

// Commit the current draft into a reusable, selected Other option and reopen an empty draft.
export function commitOtherDraft(state: MultiSelectState): boolean {
  const value = state.otherDraft.trim();
  state.otherDraft = '';
  if (!value) return false;
  state.customItems.push({
    type: 'other',
    id: `custom:${state.nextCustomId++}`,
    label: value,
    value,
    selected: true,
  });
  return true;
}

export function removeLastCustom(state: MultiSelectState): boolean {
  if (state.customItems.length === 0) return false;
  state.customItems.pop();
  return true;
}

export function collectAnswers(state: MultiSelectState): AskAnswer[] {
  const customAnswers: OtherAnswer[] = state.customItems
    .filter((item) => item.selected)
    .map((item) => ({ type: 'other', label: item.label, value: item.value }));
  return sortAnswers([...state.selected.values(), ...customAnswers]);
}
