/**
 * ask-user-question pi extension.
 *
 * Registers the `ask_user_question` tool for asking one clarifying question at a
 * time. Supports free-form text answers, single-select option questions, and
 * multi-select option questions — each with an always-available `Other` custom
 * answer. Returns structured result details with status, question, mode,
 * context, and selected answers.
 */
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Text } from '@earendil-works/pi-tui';
import {
  answeredResult,
  cancelledResult,
  getOtherLabel,
  normalizeOptions,
  resolveMode,
  unavailableResult,
} from './answers.js';
import { AskUserQuestionParamsSchema } from './schema.js';
import type { AskOptionInput, AskUserQuestionResultDetails } from './types.js';
import { askMultiChoice, askSingleChoice } from './ui.js';

// Serialize concurrent UI interactions: ctx.ui.custom can only host one active
// component at a time, so overlapping questions must queue.
let uiLock: Promise<void> = Promise.resolve();

function withUILock<T>(fn: () => Promise<T>): Promise<T> {
  const prev = uiLock;
  let release: () => void = () => {};
  uiLock = new Promise<void>((resolve) => {
    release = resolve;
  });
  return prev.then(fn).finally(() => release());
}

export default function askUserQuestion(pi: ExtensionAPI) {
  pi.registerTool({
    name: 'ask_user_question',
    label: 'ask_user_question',
    description:
      'Ask the user a single question and pause execution until they answer. Use this when requirements are ambiguous, user preferences are needed, a decision would materially affect implementation, or you need confirmation before proceeding. Ask exactly one question per tool call, and prefer multiple separate tool calls over bundling unrelated questions together.',
    promptSnippet:
      'Use this tool to ask exactly one clarifying question, missing-requirement question, preference question, or decision question before continuing.',
    promptGuidelines: [
      'Ask exactly one question per tool call.',
      'If you need answers to multiple questions, make multiple separate ask_user_question tool calls instead of combining them into one prompt.',
      'Users will always be able to select "Other" to provide custom text input when options are provided.',
      'Use multiSelect: true only when you need multiple answers to the same question.',
      'If you recommend a specific option, make it the first option in the list and add "(Recommended)" at the end of the label.',
      'Prefer this tool over guessing when requirements, preferences, or implementation choices are unclear.',
      'Use this tool when multiple valid implementation paths exist and the preferred path depends on user choice.',
    ],
    parameters: AskUserQuestionParamsSchema,

    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const question = params.question.trim();
      const options = normalizeOptions(params.options);
      const context = params.details?.trim() || undefined;
      const mode = resolveMode(options, params.multiSelect);

      if (!question) {
        return unavailableResult(
          params.question,
          mode,
          'ask_user_question requires a non-empty question',
          context,
        );
      }
      if (signal?.aborted) {
        return cancelledResult(question, mode, context);
      }
      if (!ctx.hasUI) {
        return unavailableResult(
          question,
          mode,
          'ask_user_question requires interactive mode UI',
          context,
        );
      }

      return withUILock(async () => {
        if (signal?.aborted) {
          return cancelledResult(question, mode, context);
        }

        if (mode === 'text') {
          const editorTitle = context ? `${question}\n\n${context}` : question;
          const answer = await ctx.ui.editor(editorTitle);
          if (answer === undefined) {
            return cancelledResult(question, mode, context);
          }
          return answeredResult(
            question,
            mode,
            [{ type: 'text', label: answer.trim(), value: answer.trim() }],
            context,
          );
        }

        const otherLabel = getOtherLabel(options);

        if (mode === 'single-select') {
          const answer = await askSingleChoice(ctx, question, context, options, otherLabel, signal);
          if (!answer) {
            return cancelledResult(question, mode, context);
          }
          return answeredResult(question, mode, [answer], context);
        }

        const answers = await askMultiChoice(ctx, question, context, options, otherLabel, signal);
        if (!answers) {
          return cancelledResult(question, mode, context);
        }
        return answeredResult(question, mode, answers, context);
      });
    },

    renderCall(args, theme) {
      const options = normalizeOptions(args.options as AskOptionInput[] | undefined);
      let text =
        theme.fg('toolTitle', theme.bold('ask_user_question ')) + theme.fg('muted', args.question);
      if (args.multiSelect) {
        text += theme.fg('dim', ' [multi-select]');
      }
      if (options.length > 0) {
        const labels = [...options.map((option) => option.label), getOtherLabel(options)].join(
          ', ',
        );
        text += `\n${theme.fg('dim', `  Options: ${labels}`)}`;
      }
      return new Text(text, 0, 0);
    },

    renderResult(result, _options, theme) {
      const details = result.details as AskUserQuestionResultDetails | undefined;
      if (!details) {
        const first = result.content[0];
        return new Text(first?.type === 'text' ? first.text : '', 0, 0);
      }

      if (details.status === 'cancelled') {
        return new Text(theme.fg('warning', details.message || 'Cancelled'), 0, 0);
      }
      if (details.status === 'unavailable') {
        return new Text(
          theme.fg('warning', details.message || 'ask_user_question unavailable'),
          0,
          0,
        );
      }

      const lines = details.answers.map((answer) => {
        switch (answer.type) {
          case 'text':
            return `${theme.fg('success', '✓ ')}${theme.fg('accent', answer.label || '(empty response)')}`;
          case 'other':
            return `${theme.fg('success', '✓ ')}${theme.fg('muted', 'Other: ')}${theme.fg('accent', answer.label)}`;
          case 'option':
            return `${theme.fg('success', '✓ ')}${theme.fg('accent', `${answer.index}. ${answer.label}`)}`;
        }
      });
      return new Text(lines.join('\n'), 0, 0);
    },
  });
}
