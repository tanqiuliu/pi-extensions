import { describe, expect, test } from 'bun:test';
import { runQuestionnaireUI } from '../extensions/questionnaire/ui.js';
import type {
  NormalizedQuestion,
  QuestionnaireResult,
} from '../extensions/questionnaire/types.js';

const question: NormalizedQuestion = {
  id: 'scope',
  label: 'Scope',
  prompt: 'Pick a scope',
  selectionMode: 'multiple',
  options: [
    { value: 'small', label: 'Small' },
    { value: 'large', label: 'Large' },
  ],
  allowOther: true,
};

const plainTheme = {
  fg: (_color: string, text: string) => text,
  bg: (_color: string, text: string) => text,
  bold: (text: string) => text,
};

describe('questionnaire UI rendering', () => {
  test('renders the Other draft row as an editable field with an Enter hint', async () => {
    const lines = await runQuestionnaireUI(
      {
        ui: {
          custom: (callback) => {
            const component = callback(
              { requestRender: () => undefined },
              plainTheme,
              undefined,
              (_result: QuestionnaireResult) => undefined,
            );
            return component.render(80);
          },
        },
      },
      [question],
    );

    expect(lines).toContain('  [ ] Other: ');
    expect(lines).toContain('    Enter to add');
  });
});
