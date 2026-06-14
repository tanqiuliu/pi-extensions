import type {
  AskAnswer,
  AskOption,
  AskOptionInput,
  AskUserQuestionMode,
  AskUserQuestionResultDetails,
  AskUserQuestionStatus,
  ToolResult,
} from './types.js';

export function normalizeOptions(options: AskOptionInput[] | undefined): AskOption[] {
  return (options ?? [])
    .map((option) => ({
      label: option.label.trim(),
      value: option.value?.trim() || option.label.trim(),
      description: option.description?.trim() || undefined,
    }))
    .filter((option) => option.label.length > 0);
}

// Avoid a literal "Other" collision when a listed option is itself labelled "Other".
export function getOtherLabel(options: AskOption[]): string {
  return options.some((option) => option.label.toLowerCase() === 'other')
    ? 'Other (custom)'
    : 'Other';
}

export function resolveMode(options: AskOption[], multiSelect?: boolean): AskUserQuestionMode {
  if (options.length === 0) return 'text';
  return multiSelect ? 'multi-select' : 'single-select';
}

export function formatAnswerForModel(answer: AskAnswer): string {
  switch (answer.type) {
    case 'text':
      return answer.label;
    case 'other':
      return `Other: ${answer.label}`;
    case 'option':
      return `${answer.index}. ${answer.label}`;
  }
}

function answerSortRank(answer: AskAnswer): number {
  switch (answer.type) {
    case 'option':
      return answer.index;
    case 'other':
      return Number.MAX_SAFE_INTEGER - 1;
    case 'text':
      return Number.MAX_SAFE_INTEGER;
  }
}

export function sortAnswers(answers: AskAnswer[]): AskAnswer[] {
  return [...answers].sort((a, b) => answerSortRank(a) - answerSortRank(b));
}

function buildStructuredResult(
  status: AskUserQuestionStatus,
  question: string,
  mode: AskUserQuestionMode,
  answers: AskAnswer[],
  context?: string,
  message?: string,
): AskUserQuestionResultDetails {
  return { status, question, context, mode, answers, message };
}

function textResult(text: string, details: AskUserQuestionResultDetails): ToolResult {
  return { content: [{ type: 'text', text }], details };
}

export function answerContentText(mode: AskUserQuestionMode, answers: AskAnswer[]): string {
  if (mode === 'text') {
    const answer = answers[0];
    return answer.label.trim().length > 0
      ? `User answered: ${answer.label}`
      : 'User submitted an empty response';
  }
  if (mode === 'single-select') {
    return `User selected: ${formatAnswerForModel(answers[0])}`;
  }
  return `User selected:\n${answers.map((answer) => `- ${formatAnswerForModel(answer)}`).join('\n')}`;
}

export function answeredResult(
  question: string,
  mode: AskUserQuestionMode,
  answers: AskAnswer[],
  context?: string,
): ToolResult {
  return textResult(
    answerContentText(mode, answers),
    buildStructuredResult('answered', question, mode, answers, context),
  );
}

export function cancelledResult(
  question: string,
  mode: AskUserQuestionMode,
  context?: string,
): ToolResult {
  const message = 'User cancelled the question';
  return textResult(
    message,
    buildStructuredResult('cancelled', question, mode, [], context, message),
  );
}

export function unavailableResult(
  question: string,
  mode: AskUserQuestionMode,
  message: string,
  context?: string,
): ToolResult {
  return textResult(
    message,
    buildStructuredResult('unavailable', question, mode, [], context, message),
  );
}
