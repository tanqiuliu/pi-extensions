# @tanqiuliu/pi-questionnaire

Tool-first questionnaire extension for pi.

It adds:
- a `questionnaire` tool for collecting **1-5 structured answers** in one interaction
- a `/questionnaire` demo command powered by the same shared tabbed TUI flow

## Install

```bash
pi install git:github.com/tanqiuliu/pi-extensions
```

## What it provides

| Feature | Name | Notes |
|---|---|---|
| Tool | `questionnaire` | Collects structured user answers with single/multi select + reusable custom Other options |
| Command | `/questionnaire` | Demo flow using `Scope`, `Priority`, `Approach` |

## Input schema (summary)

```ts
{
  questions: Array<{
    id: string;
    label?: string;
    prompt: string;
    selectionMode?: 'single' | 'multiple';
    options: Array<{
      value: string;
      label: string;
      description?: string;
    }>;
    allowOther?: boolean; // defaults to true at runtime
  }> // min 1, max 5
}
```

Validation includes:
- 1-5 question limit
- non-empty option lists
- duplicate question id rejection
- duplicate option value rejection per question

## Normalized output schema (summary)

```ts
{
  questions: NormalizedQuestion[];
  answers: Array<{
    questionId: string;
    questionLabel: string;
    selectedOptions: Array<{ value: string; label: string }>;
    otherTexts: string[];
    otherText: string | null;
    wasOtherSelected: boolean;
  }>;
  cancelled: boolean;
}
```

`Other` answers are rendered explicitly, including multiple custom answers:

```text
Other: "GraphQL", Other: "REST"
```

## Keyboard model

- `← / →`: switch tabs (question tabs + Review tab)
- `↑ / ↓`: move option cursor (question tab) or row cursor (Review tab)
- `Space`:
  - question tab: select/toggle listed options and committed Other options
  - review tab: jump to selected question for editing
- Typing while the cursor is on `Other`: edit the inline Other draft
- `r`: jump to Review tab
- `Esc` hierarchy:
  1. from Review, go back to prior question tab
  2. from question tab outermost, cancel questionnaire
- `Enter`:
  - on the inline Other draft: add it as a selected custom option and show a new Other draft row
  - in Review: submit only when all required answers are valid

## Example tool call

```json
{
  "name": "questionnaire",
  "arguments": {
    "questions": [
      {
        "id": "scope",
        "label": "Scope",
        "prompt": "What is the project scope?",
        "selectionMode": "single",
        "options": [
          { "value": "low", "label": "Low" },
          { "value": "high", "label": "High" }
        ]
      },
      {
        "id": "priority",
        "label": "Priority",
        "prompt": "What priority should we assign?",
        "selectionMode": "single",
        "options": [
          { "value": "p0", "label": "P0" },
          { "value": "p1", "label": "P1" }
        ]
      }
    ]
  }
}
```

## Example result summaries

Completed (collapsed):

```text
✓ Scope: High • Priority: P1 • Approach: Other: "GraphQL", Other: "REST"
```

Cancelled:

```text
⚠ Cancelled
```

## Cancellation and non-interactive behavior

- User cancellation is **not treated as an error** (`cancelled: true` in details).
- Non-interactive mode (`!ctx.hasUI`) returns an immediate error result (`isError: true`).
