import { StringEnum } from '@earendil-works/pi-ai';
import { Type, type Static } from 'typebox';
import {
  type QuestionInput as QuestionInputSchema,
  type QuestionOption as QuestionOptionSchema,
  type QuestionType as QuestionTypeSchema,
} from './schema.js';

export type QuestionOption = QuestionOptionSchema;
export type QuestionInput = QuestionInputSchema;
export type QuestionType = QuestionTypeSchema;

export interface NormalizedQuestion {
  id: string;
  label: string;
  prompt: string;
  type: QuestionType;
  options: QuestionOption[];
  allowOther: boolean;
}

export const SelectedOptionSchema = Type.Object({
  value: Type.String(),
  label: Type.String(),
});

export type SelectedOption = Static<typeof SelectedOptionSchema>;

export interface NormalizedAnswer {
  questionId: string;
  questionLabel: string;
  selectedOptions: SelectedOption[];
  otherTexts: string[];
  otherText: string | null;
  wasOtherSelected: boolean;
  freeFormText: string;
}

export interface QuestionnaireResult {
  questions: NormalizedQuestion[];
  answers: NormalizedAnswer[];
  cancelled: boolean;
  error?: string;
}

export interface QuestionSelectionState {
  listedSelectedValues: string[];
  customOtherValues: string[];
  selectedCustomOtherValues: string[];
  otherDraft: string;
  otherSelected: boolean;
  freeFormText: string;
}

export const QuestionnaireInputModeSchema = StringEnum(['navigate'] as const, {
  description: 'Current input mode for questionnaire UI state.',
  default: 'navigate',
});

export type QuestionnaireInputMode = Static<typeof QuestionnaireInputModeSchema>;

export interface QuestionnaireUIState {
  activeTabIndex: number;
  lastQuestionTabIndex: number;
  questionOptionCursorById: Record<string, number>;
  reviewCursor: number;
  inputMode: QuestionnaireInputMode;
  returnToReview: boolean;
  returnReviewCursor: number;
  questionStateById: Record<string, QuestionSelectionState>;
}

export interface RenderOption {
  kind: 'listed' | 'customOther' | 'otherDraft' | 'freeForm';
  value: string;
  label: string;
  description?: string;
}
