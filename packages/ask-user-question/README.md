# @tanqiuliu/pi-ask-user-question

A pi extension that lets the agent ask the user **one clarifying question at a time** and pause execution until it is answered.

It adds a single tool: `ask_user_question`. Use it when requirements are ambiguous, a preference is needed, a decision would materially change the implementation, or confirmation is required before proceeding.

## Features

- **Free-form text** answers when no options are provided (opens a multi-line editor).
- **Single-select** option questions with an always-available `Other` custom answer.
- **Multi-select** option questions with built-in choices plus multiple reusable custom `Other` answers.
- Type directly on the `Other` row; `Enter` submits/adds the custom answer.
- Move away from an in-progress `Other` draft with ↑/↓ without losing it.
- Concurrent prompts are serialized so only one interactive question is active at a time.
- Resolves cleanly when the agent aborts, instead of hanging the tool call.
- Returns structured `details` (status, question, mode, context, selected answers).

## Tool: `ask_user_question`

| Parameter | Type | Description |
|---|---|---|
| `question` | string (required) | The single question to ask. Ask exactly one question per tool call. |
| `details` | string | Optional extra context shown under the question. |
| `options` | array | Optional multiple-choice options (`{ label, value?, description? }`). Omit or pass `[]` for free-form text. |
| `multiSelect` | boolean | Set to `true` to allow multiple answers to the same question. |

Mode is inferred: no `options` → `text`; `options` + `multiSelect: true` → `multi-select`; otherwise `single-select`. An `Other` row is always available when options are provided.

## Navigation

- **text**: type your answer in the editor; submit to answer, cancel to abort.
- **single-select**: `↑/↓` navigate, `Enter` select. Type while focused on `Other` (or press `Enter` on it) to enter a custom answer; `Esc` cancels.
- **multi-select**: `↑/↓` navigate, `Space`/`Enter` toggle. Type on the `Other` row and `Enter` to add a reusable custom answer; `Backspace` on `Other` removes the last custom answer; `Enter` on `Submit` finishes. `Esc` cancels.

## Result `details`

```ts
{
  status: 'answered' | 'cancelled' | 'unavailable';
  question: string;
  context?: string;
  mode: 'text' | 'single-select' | 'multi-select';
  answers: Array<
    | { type: 'text'; label: string; value: string }
    | { type: 'option'; label: string; value: string; index: number }
    | { type: 'other'; label: string; value: string }
  >;
  message?: string;
}
```

## Non-interactive behavior

When no UI is available (`!ctx.hasUI`) or the question is empty, the tool returns an `unavailable` result instead of hanging. User cancellation returns a `cancelled` result and is not treated as an error.
