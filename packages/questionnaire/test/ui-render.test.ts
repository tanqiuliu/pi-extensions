import { describe, expect, test } from 'bun:test';
import { runQuestionnaireUI } from '../extensions/questionnaire/ui.js';
import type {
  NormalizedQuestion,
  QuestionnaireResult,
} from '../extensions/questionnaire/types.js';

const plainTheme = {
  fg: (_color: string, text: string) => text,
  bg: (_color: string, text: string) => text,
  bold: (text: string) => text,
};

function renderFirstFrame(questions: NormalizedQuestion[], width = 80): Promise<string[]> {
  return runQuestionnaireUI(
    {
      ui: {
        custom: (callback) => {
          const component = callback(
            { requestRender: () => undefined },
            plainTheme,
            undefined,
            (_result: QuestionnaireResult) => undefined,
          );
          return component.render(width);
        },
      },
    },
    questions,
  ) as unknown as Promise<string[]>;
}

const multiQuestion: NormalizedQuestion = {
  id: 'scope',
  label: 'Scope',
  prompt: 'Pick a scope',
  type: 'multiSelect',
  options: [
    { value: 'small', label: 'Small' },
    { value: 'large', label: 'Large' },
  ],
  allowOther: true,
};

const freeFormQuestion: NormalizedQuestion = {
  id: 'notes',
  label: 'Notes',
  prompt: 'Add notes',
  type: 'freeForm',
  options: [],
  allowOther: true,
};

describe('questionnaire UI rendering', () => {
  test('renders the multiSelect Other draft row with an Enter hint', async () => {
    const lines = await renderFirstFrame([multiQuestion]);

    expect(lines).toContain('  [ ] Other: ');
    expect(lines).toContain('    Enter to add');
  });

  test('a single-question flow shows a Submit button and no Review tab', async () => {
    const lines = await renderFirstFrame([multiQuestion]);

    expect(lines.some((line) => line.includes('[ Submit ]'))).toBe(true);
    expect(lines.some((line) => line.includes('Review'))).toBe(false);
  });

  test('a multi-question flow shows a Next question button and Review tab', async () => {
    const lines = await renderFirstFrame([multiQuestion, freeFormQuestion]);

    expect(lines.some((line) => line.includes('[ Next question ]'))).toBe(true);
    expect(lines.some((line) => line.includes('Review'))).toBe(true);
  });

  test('renders a free-form question with its prompt, an empty input row, and a Submit button', async () => {
    const lines = await renderFirstFrame([freeFormQuestion]);

    expect(lines.some((line) => line.includes('Add notes'))).toBe(true);
    expect(lines.some((line) => line.includes('Type your answer'))).toBe(false);
    expect(lines.some((line) => line.includes('Enter for newline'))).toBe(false);
    expect(lines.some((line) => line.includes('[ Submit ]'))).toBe(true);
  });
});
