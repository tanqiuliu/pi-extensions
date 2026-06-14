# @tanqiuliu/pi-questionnaire

Tool-first questionnaire extension for pi.

It adds:
- a `questionnaire` tool for collecting **1-5 structured answers** in one interaction
- a `/questionnaire` demo command powered by the same shared tabbed TUI flow

## Features

- **Three question types** — `singleSelect`, `multiSelect`, and `freeForm`, each with its own input behavior (see [Question types](#question-types)).
- **Always-on `Other` for single-select** — a single inline free-text field that becomes the answer as you type and never spawns a duplicate row.
- **Reusable `Other` options for multi-select** — committed custom answers stay selectable; multiple can be active at once.
- **Per-question action button** — every question ends with a focusable `Next question` / `Review` / `Submit` button; advance with the button or `→`.
- **Adaptive layout** — a single-question flow is one page with a `Submit` button and no Review tab; multi-question flows get question tabs plus a Review tab that gates submission until every answer is valid.
- **Live validation** — tab/review markers and the Submit button reflect per-question validity in real time.
- **Structured, normalized output** — trimmed, de-duplicated answers with explicit `Other`/free-form fields, returned both as a human summary and machine-readable `details`.
- **Safe in non-interactive mode** — returns a clear error instead of hanging when no UI is available, and treats user cancellation as a non-error.


## What it provides

| Feature | Name | Notes |
|---|---|---|
| Tool | `questionnaire` | Collects structured user answers across single-select, multi-select, and free-form questions |
| Command | `/questionnaire` | Demo flow using `Scope` (single), `Approach` (multi), `Notes` (free-form) |

## Question types

- **`singleSelect`** — one listed choice. An `Other` field is **always** present; typing in it makes it the answer and clears the listed choice. Committing `Other` never spawns a second `Other` row.
- **`multiSelect`** — many listed choices plus reusable `Other` options. Typing on the `Other` draft and pressing `Enter` commits it as a selected option and opens a fresh draft row. Gated by `allowOther` (default `true`).
- **`freeForm`** — a free-text answer, no listed options. `Enter` inserts a newline; the answer is required (must be non-empty).

## Input schema (summary)

```ts
{
  questions: Array<{
    id: string;
    label?: string;
    prompt: string;
    type?: 'singleSelect' | 'multiSelect' | 'freeForm'; // defaults to singleSelect
    options?: Array<{
      value: string;
      label: string;
      description?: string;
    }>; // required for single/multi select; omit for freeForm
    allowOther?: boolean; // multiSelect only; defaults to true
  }> // min 1, max 5
}
```

Validation includes:
- 1-5 question limit
- non-empty option lists for single/multi-select questions
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
    freeFormText: string; // populated for freeForm questions
  }>;
  cancelled: boolean;
}
```

`Other` answers are rendered explicitly, including multiple custom answers:

```text
Other: "GraphQL", Other: "REST"
```

## Navigation model

Every question body ends with a button. With **one** question it is `Submit` and there is no Review tab — the whole flow is a single page. With **multiple** questions each button is `Next question`, except the last one which is `Review`.

- `← / →`: switch tabs (multi-question flows only)
- `↑ / ↓`: move the row cursor, including onto the button
- `Space`: toggle the focused listed/`Other` option (select-type questions). On free-text rows it types a space.
- Typing while the cursor is on `Other` or a free-form field: edit that text inline
- `Enter`:
  - on the bottom button: advance to the next question / Review, or submit
  - on a `multiSelect` `Other` draft: commit it as a selected option and open a new draft row
  - on a `freeForm` field: insert a newline
  - in Review: submit only when all answers are valid
- `r`: jump to the Review tab (multi-question flows)
- `Esc`: cancel the questionnaire


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
        "type": "singleSelect",
        "options": [
          { "value": "low", "label": "Low" },
          { "value": "high", "label": "High" }
        ]
      },
      {
        "id": "approach",
        "label": "Approach",
        "prompt": "Which implementation approaches are in scope?",
        "type": "multiSelect",
        "options": [
          { "value": "rest", "label": "REST API" },
          { "value": "serverless", "label": "Serverless" }
        ]
      },
      {
        "id": "notes",
        "label": "Notes",
        "prompt": "Any additional context or constraints?",
        "type": "freeForm"
      }
    ]
  }
}
```

## Example result summaries

Completed (collapsed):

```text
✓ Scope: High • Approach: REST API + Other: "GraphQL" • Notes: Needs SSO before launch
```

Cancelled:

```text
⚠ Cancelled
```

## Cancellation and non-interactive behavior

- User cancellation is **not treated as an error** (`cancelled: true` in details).
- Non-interactive mode (`!ctx.hasUI`) returns an immediate error result (`isError: true`).
