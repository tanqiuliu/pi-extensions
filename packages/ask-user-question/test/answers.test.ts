import { describe, expect, test } from 'bun:test';
import {
  answeredResult,
  cancelledResult,
  formatAnswerForModel,
  getOtherLabel,
  normalizeOptions,
  resolveMode,
  sortAnswers,
  unavailableResult,
} from '../extensions/ask-user-question/answers.js';
import type { AskAnswer } from '../extensions/ask-user-question/types.js';

describe('normalizeOptions', () => {
  test('trims labels, defaults value to label, drops empty labels', () => {
    expect(
      normalizeOptions([
        { label: '  Small  ' },
        { label: 'Large', value: '  lg  ', description: '  big  ' },
        { label: '   ' },
      ]),
    ).toEqual([
      { label: 'Small', value: 'Small', description: undefined },
      { label: 'Large', value: 'lg', description: 'big' },
    ]);
  });

  test('returns an empty array for undefined options', () => {
    expect(normalizeOptions(undefined)).toEqual([]);
  });
});

describe('getOtherLabel', () => {
  test('uses "Other" unless a listed option already collides', () => {
    expect(getOtherLabel([{ label: 'Small', value: 'small' }])).toBe('Other');
    expect(getOtherLabel([{ label: 'other', value: 'x' }])).toBe('Other (custom)');
  });
});

describe('resolveMode', () => {
  test('infers mode from options and multiSelect flag', () => {
    expect(resolveMode([])).toBe('text');
    expect(resolveMode([{ label: 'A', value: 'a' }])).toBe('single-select');
    expect(resolveMode([{ label: 'A', value: 'a' }], true)).toBe('multi-select');
  });
});

describe('answer formatting', () => {
  test('formats each answer kind for the model', () => {
    expect(formatAnswerForModel({ type: 'text', label: 'hi', value: 'hi' })).toBe('hi');
    expect(formatAnswerForModel({ type: 'other', label: 'GraphQL', value: 'GraphQL' })).toBe('Other: GraphQL');
    expect(formatAnswerForModel({ type: 'option', label: 'Small', value: 'small', index: 2 })).toBe('2. Small');
  });

  test('sorts options by index, then Other, then text', () => {
    const answers: AskAnswer[] = [
      { type: 'other', label: 'GraphQL', value: 'GraphQL' },
      { type: 'option', label: 'B', value: 'b', index: 2 },
      { type: 'option', label: 'A', value: 'a', index: 1 },
    ];
    expect(sortAnswers(answers).map((a) => a.label)).toEqual(['A', 'B', 'GraphQL']);
  });
});

describe('result builders', () => {
  test('answeredResult builds content and details per mode', () => {
    const single = answeredResult('Pick', 'single-select', [
      { type: 'option', label: 'Small', value: 'small', index: 1 },
    ]);
    expect(single.content[0].text).toBe('User selected: 1. Small');
    expect(single.details.status).toBe('answered');

    const multi = answeredResult('Pick', 'multi-select', [
      { type: 'option', label: 'Small', value: 'small', index: 1 },
      { type: 'other', label: 'GraphQL', value: 'GraphQL' },
    ]);
    expect(multi.content[0].text).toBe('User selected:\n- 1. Small\n- Other: GraphQL');
  });

  test('cancelled and unavailable results carry a message', () => {
    expect(cancelledResult('Q', 'text').details.status).toBe('cancelled');
    expect(unavailableResult('Q', 'text', 'no UI').content[0].text).toBe('no UI');
  });
});
