import { Type, type Static } from 'typebox';

export const OptionSchema = Type.Object({
  label: Type.String({
    description:
      'Display label for the option. If you recommend an option, place it first and append "(Recommended)" to the label.',
  }),
  value: Type.Optional(
    Type.String({
      description:
        'Optional machine-readable value returned for the option. Defaults to the label.',
    }),
  ),
  description: Type.Optional(
    Type.String({ description: 'Optional extra detail shown below the option.' }),
  ),
});

export const AskUserQuestionParamsSchema = Type.Object({
  question: Type.String({
    description: 'The single question to ask the user. Ask exactly one question per tool call.',
  }),
  details: Type.Optional(
    Type.String({
      description: 'Optional extra context or instructions shown under the question.',
    }),
  ),
  options: Type.Optional(
    Type.Array(OptionSchema, {
      description:
        'Optional multiple-choice options. Omit or pass an empty array for free-form text input. Users will always be able to choose Other and type a custom answer when options are provided.',
    }),
  ),
  multiSelect: Type.Optional(
    Type.Boolean({
      description: 'Set to true to allow multiple answers to be selected for a question.',
    }),
  ),
});

export type AskOptionInput = Static<typeof OptionSchema>;
export type AskUserQuestionParams = Static<typeof AskUserQuestionParamsSchema>;
