import type {
  NormalizedAnswer,
  NormalizedQuestion,
  QuestionInput,
  QuestionSelectionState,
  QuestionnaireResult,
  SelectedOption,
} from './types.js';
import { createEmptyQuestionState } from './question-state.js';

export function validateQuestions(
  questions: QuestionInput[],
): { valid: true } | { valid: false; error: string } {
  if (questions.length === 0) {
    return { valid: false, error: 'Questionnaire must include at least 1 question.' };
  }

  if (questions.length > 5) {
    return { valid: false, error: 'Questionnaire supports at most 5 questions.' };
  }

  const idSet = new Set<string>();

  for (const [index, question] of questions.entries()) {
    const questionNumber = index + 1;
    const questionId = question.id.trim();

    if (!questionId) {
      return { valid: false, error: `Question ${questionNumber} has an empty id.` };
    }

    if (idSet.has(questionId)) {
      return { valid: false, error: `Duplicate question id: "${questionId}".` };
    }
    idSet.add(questionId);

    // freeForm questions take a free-text answer and need no listed options.
    if ((question.type ?? 'singleSelect') === 'freeForm') {
      continue;
    }

    const options = question.options ?? [];
    if (!options.length) {
      return {
        valid: false,
        error: `Question "${questionId}" must include at least one listed option.`,
      };
    }

    const valueSet = new Set<string>();
    for (const option of options) {
      const optionValue = option.value.trim();
      if (!optionValue) {
        return {
          valid: false,
          error: `Question "${questionId}" has an option with an empty value.`,
        };
      }
      if (valueSet.has(optionValue)) {
        return {
          valid: false,
          error: `Question "${questionId}" has duplicate option value "${optionValue}".`,
        };
      }
      valueSet.add(optionValue);
    }
  }

  return { valid: true };
}

export function normalizeQuestions(questions: QuestionInput[]): NormalizedQuestion[] {
  return questions.map((question, index) => {
    const type = question.type ?? 'singleSelect';
    return {
      id: question.id.trim(),
      label: question.label?.trim() || question.id.trim() || `Q${index + 1}`,
      prompt: question.prompt.trim(),
      type,
      options:
        type === 'freeForm'
          ? []
          : (question.options ?? []).map((option) => ({
              value: option.value.trim(),
              label: option.label,
              description: option.description,
            })),
      allowOther: question.allowOther !== false,
    };
  });
}

export function createInitialQuestionStateById(
  questions: NormalizedQuestion[],
): Record<string, QuestionSelectionState> {
  return Object.fromEntries(questions.map((question) => [question.id, createEmptyQuestionState()]));
}

export function isAnswerValid(
  question: NormalizedQuestion,
  state: QuestionSelectionState,
): boolean {
  if (question.type === 'freeForm') {
    return state.freeFormText.trim().length > 0;
  }

  const selectedListedCount = state.listedSelectedValues.length;

  if (question.type === 'singleSelect') {
    const hasSingleListed = selectedListedCount === 1 && !state.otherSelected;
    const hasSingleOther =
      selectedListedCount === 0 && state.otherSelected && state.otherDraft.trim().length > 0;
    return hasSingleListed || hasSingleOther;
  }

  const hasOtherText = state.selectedCustomOtherValues.some((value) => value.trim().length > 0);
  return selectedListedCount > 0 || hasOtherText;
}

export function areAllAnswersValid(
  questions: NormalizedQuestion[],
  stateById: Record<string, QuestionSelectionState>,
): boolean {
  return questions.every((question) => {
    const state = stateById[question.id];
    if (!state) return false;
    return isAnswerValid(question, state);
  });
}

export function normalizeAnswer(
  question: NormalizedQuestion,
  state: QuestionSelectionState,
): NormalizedAnswer {
  if (question.type === 'freeForm') {
    return {
      questionId: question.id,
      questionLabel: question.label,
      selectedOptions: [],
      otherTexts: [],
      otherText: null,
      wasOtherSelected: false,
      freeFormText: state.freeFormText.trim(),
    };
  }

  const selectedSet = new Set(state.listedSelectedValues);
  const selectedOptions: SelectedOption[] = question.options
    .filter((option) => selectedSet.has(option.value))
    .map((option) => ({ value: option.value, label: option.label }));

  const otherTexts =
    question.type === 'singleSelect'
      ? state.otherSelected && state.otherDraft.trim()
        ? [state.otherDraft.trim()]
        : []
      : state.selectedCustomOtherValues.map((value) => value.trim()).filter((v) => v.length > 0);

  return {
    questionId: question.id,
    questionLabel: question.label,
    selectedOptions,
    otherTexts,
    otherText: otherTexts[0] ?? null,
    wasOtherSelected: otherTexts.length > 0,
    freeFormText: '',
  };
}

export function normalizeAnswers(
  questions: NormalizedQuestion[],
  stateById: Record<string, QuestionSelectionState>,
): NormalizedAnswer[] {
  return questions.map((question) =>
    normalizeAnswer(question, stateById[question.id] ?? createEmptyQuestionState()),
  );
}

export function formatAnswerValue(answer: NormalizedAnswer): string {
  if (answer.freeFormText) {
    return answer.freeFormText.replace(/\s*\n\s*/g, ' / ');
  }

  const listed = answer.selectedOptions.map((option) => option.label).join(', ');
  const other = answer.otherTexts.map((text) => `Other: "${text}"`).join(', ');

  if (listed && other) return `${listed} + ${other}`;
  if (listed) return listed;
  if (other) return other;
  return '—';
}

export function formatCompletedSummary(result: QuestionnaireResult): string {
  const parts = result.answers.map(
    (answer) => `${answer.questionLabel}: ${formatAnswerValue(answer)}`,
  );
  return `✓ ${parts.join(' • ')}`;
}

export function formatCancelledSummary(): string {
  return '⚠ Cancelled';
}

export function formatExpandedAnswerLines(result: QuestionnaireResult): string[] {
  return result.answers.map((answer) => `${answer.questionLabel}: ${formatAnswerValue(answer)}`);
}

export function formatToolContentSummary(result: QuestionnaireResult): string {
  if (result.cancelled) {
    return formatCancelledSummary();
  }
  return formatExpandedAnswerLines(result).join('\n');
}
