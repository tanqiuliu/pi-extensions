import { describe, expect, test } from 'bun:test';
import { askMultiChoice, askSingleChoice } from '../extensions/ask-user-question/ui.js';
import type { AskAnswer, AskOption } from '../extensions/ask-user-question/types.js';

const plainTheme = {
  fg: (_color: string, text: string) => text,
  bg: (_color: string, text: string) => text,
  bold: (text: string) => text,
};

const options: AskOption[] = [
  { label: 'Small', value: 'small' },
  { label: 'Large', value: 'large' },
];

type RenderRunner = (
  ctx: { ui: { custom: (cb: (...args: never[]) => unknown) => unknown } },
  question: string,
  context: string | undefined,
  options: AskOption[],
  otherLabel: string,
  signal: AbortSignal | undefined,
) => unknown;

function renderFirstFrame(
  runner: RenderRunner,
  question: string,
  width = 80,
): string[] {
  let lines: string[] = [];
  const ctx = {
    ui: {
      custom: (callback: (...args: never[]) => unknown) => {
        const component = (callback as unknown as (
          tui: unknown,
          theme: unknown,
          kb: unknown,
          done: (result: AskAnswer | AskAnswer[] | null) => void,
        ) => { render: (width: number) => string[] })(
          { requestRender: () => undefined },
          plainTheme,
          undefined,
          () => undefined,
        );
        lines = component.render(width);
        return Promise.resolve(null);
      },
    },
  };
  runner(ctx as never, question, undefined, options, 'Other', undefined);
  return lines;
}

describe('single-select rendering', () => {
  test('renders the question, numbered options, an Other row, and a hint', () => {
    const lines = renderFirstFrame(askSingleChoice as never, 'Pick a size');

    expect(lines.some((line) => line.includes('Pick a size'))).toBe(true);
    expect(lines.some((line) => line.includes('1. Small'))).toBe(true);
    expect(lines.some((line) => line.includes('2. Large'))).toBe(true);
    expect(lines.some((line) => line.includes('Other'))).toBe(true);
    expect(lines.some((line) => line.includes('Enter select'))).toBe(true);
  });
});

describe('multi-select rendering', () => {
  test('renders checkboxes, an Other draft row, a Submit row, and a warning', () => {
    const lines = renderFirstFrame(askMultiChoice as never, 'Pick sizes');

    expect(lines.some((line) => line.includes('[ ] 1. Small'))).toBe(true);
    expect(lines.some((line) => line.includes('[ ] Other'))).toBe(true);
    expect(lines.some((line) => line.includes('Submit'))).toBe(true);
    expect(lines.some((line) => line.includes('Select at least one answer'))).toBe(true);
  });
});
