import { StringEnum } from '@earendil-works/pi-ai';
import { Type, type Static } from 'typebox';

export const QuestionTypeSchema = StringEnum(
  ['singleSelect', 'multiSelect', 'freeForm'] as const,
  {
    description:
      'Question type. singleSelect: one listed choice plus an always-available Other field. multiSelect: many listed choices plus reusable Other options. freeForm: a free-text answer with no listed options.',
    default: 'singleSelect',
  },
);

export const QuestionOptionSchema = Type.Object({
  value: Type.String({ description: 'Stable value returned when this option is selected.' }),
  label: Type.String({ description: 'User-facing label for this option.' }),
  description: Type.Optional(
    Type.String({ description: 'Optional helper text displayed under the label.' }),
  ),
});

export const QuestionSchema = Type.Object({
  id: Type.String({ description: 'Unique question identifier.' }),
  label: Type.Optional(
    Type.String({ description: 'Short label shown in tabs and summaries (defaults to id).' }),
  ),
  prompt: Type.String({ description: 'Full prompt shown for this question.' }),
  type: Type.Optional(QuestionTypeSchema),
  options: Type.Optional(
    Type.Array(QuestionOptionSchema, {
      description: 'Options for singleSelect/multiSelect questions. Omit for freeForm.',
    }),
  ),
  allowOther: Type.Optional(
    Type.Boolean({
      description:
        'For multiSelect: include reusable Other free-text options (default true). singleSelect always includes an Other field; ignored for freeForm.',
    }),
  ),
});

export const QuestionnaireParamsSchema = Type.Object({
  questions: Type.Array(QuestionSchema, {
    minItems: 1,
    maxItems: 5,
    description: 'Question list. Must contain between 1 and 5 questions.',
  }),
});

export type QuestionType = Static<typeof QuestionTypeSchema>;
export type QuestionOption = Static<typeof QuestionOptionSchema>;
export type QuestionInput = Static<typeof QuestionSchema>;
export type QuestionnaireParams = Static<typeof QuestionnaireParamsSchema>;
