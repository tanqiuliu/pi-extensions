import type { ExtensionContext } from '@earendil-works/pi-coding-agent';
import {
  Key,
  matchesKey,
  truncateToWidth,
  visibleWidth,
  wrapTextWithAnsi,
} from '@earendil-works/pi-tui';
import {
  areAllAnswersValid,
  createInitialQuestionStateById,
  formatAnswerValue,
  isAnswerValid,
  normalizeAnswers,
} from './format.js';
import {
  appendFreeFormText,
  appendOtherDraftText,
  commitOtherDraft,
  createEmptyQuestionState,
  deleteFreeFormText,
  deleteOtherDraftText,
  getQuestionRenderOptions,
  selectSingleOther,
  toggleCustomOther,
  toggleListedOption,
} from './question-state.js';
import type {
  NormalizedQuestion,
  QuestionSelectionState,
  QuestionnaireResult,
  QuestionnaireUIState,
  RenderOption,
} from './types.js';

const REVIEW_LABEL_READY = ' ✓ Review ';
const REVIEW_LABEL_PENDING = ' □ Review ';
const ACTION_VALUE = '__action__';

type ActionRow = { kind: 'action'; value: string; label: string };
type NavRow = RenderOption | ActionRow;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isSpaceKey(data: string): boolean {
  return data === ' ' || matchesKey(data, Key.space);
}

function isRKey(data: string): boolean {
  return data === 'r' || data === 'R' || matchesKey(data, 'r');
}

function pushWrappedText(lines: string[], text: string, width: number) {
  lines.push(...wrapTextWithAnsi(text, Math.max(1, width)));
}

function pushWrappedWithPrefix(
  lines: string[],
  prefix: string,
  text: string,
  width: number,
  continuationPrefix = ' '.repeat(visibleWidth(prefix)),
) {
  const availableWidth = Math.max(1, width - visibleWidth(prefix));
  const wrapped = wrapTextWithAnsi(text, availableWidth);

  if (wrapped.length === 0) {
    lines.push(truncateToWidth(prefix, width));
    return;
  }

  lines.push(truncateToWidth(`${prefix}${wrapped[0]}`, width));

  for (const line of wrapped.slice(1)) {
    const continuationWidth = Math.max(1, width - visibleWidth(continuationPrefix));
    for (const continuationLine of wrapTextWithAnsi(line, continuationWidth)) {
      lines.push(truncateToWidth(`${continuationPrefix}${continuationLine}`, width));
    }
  }
}

function ensureQuestionState(
  stateById: Record<string, QuestionSelectionState>,
  questionId: string,
): QuestionSelectionState {
  stateById[questionId] ??= createEmptyQuestionState();
  return stateById[questionId];
}

function isPrintableInput(data: string): boolean {
  return data.length === 1 && data >= ' ' && data !== '\u007f';
}

export async function runQuestionnaireUI(
  ctx: Pick<ExtensionContext, 'ui'>,
  questions: NormalizedQuestion[],
): Promise<QuestionnaireResult> {
  const hasReview = questions.length > 1;
  const reviewTabIndex = hasReview ? questions.length : -1;
  const lastQuestionIndex = questions.length - 1;

  return ctx.ui.custom<QuestionnaireResult>((tui, theme, _kb, done) => {
    const uiState: QuestionnaireUIState = {
      activeTabIndex: 0,
      lastQuestionTabIndex: 0,
      questionOptionCursorById: Object.fromEntries(questions.map((question) => [question.id, 0])),
      reviewCursor: 0,
      inputMode: 'navigate',
      returnToReview: false,
      returnReviewCursor: 0,
      questionStateById: createInitialQuestionStateById(questions),
    };

    let cachedWidth: number | undefined;
    let cachedLines: string[] | undefined;

    function invalidate() {
      cachedWidth = undefined;
      cachedLines = undefined;
      tui.requestRender();
    }

    function finalize(cancelled: boolean) {
      done({
        questions,
        answers: normalizeAnswers(questions, uiState.questionStateById),
        cancelled,
      });
    }

    function getActiveQuestion(): NormalizedQuestion | undefined {
      if (uiState.activeTabIndex >= questions.length) return undefined;
      return questions[uiState.activeTabIndex];
    }

    function actionLabelFor(index: number): string {
      if (!hasReview) return 'Submit';
      if (index === lastQuestionIndex) return 'Review';
      return 'Next question';
    }

    function getNavRows(question: NormalizedQuestion, state: QuestionSelectionState): NavRow[] {
      const options = getQuestionRenderOptions(question, state);
      const action: ActionRow = {
        kind: 'action',
        value: ACTION_VALUE,
        label: actionLabelFor(uiState.activeTabIndex),
      };
      return [...options, action];
    }

    function switchTabs(delta: number) {
      const totalTabs = hasReview ? questions.length + 1 : questions.length;
      if (totalTabs <= 1) return;
      const nextTab = (uiState.activeTabIndex + delta + totalTabs) % totalTabs;

      if (uiState.activeTabIndex < questions.length) {
        uiState.lastQuestionTabIndex = uiState.activeTabIndex;
      }
      if (nextTab < questions.length) {
        uiState.lastQuestionTabIndex = nextTab;
      }

      uiState.activeTabIndex = nextTab;
      invalidate();
    }

    function jumpToReview() {
      if (!hasReview) return;
      if (uiState.activeTabIndex < questions.length) {
        uiState.lastQuestionTabIndex = uiState.activeTabIndex;
      }

      if (uiState.returnToReview) {
        uiState.reviewCursor = clamp(uiState.returnReviewCursor, 0, lastQuestionIndex);
      }

      uiState.returnToReview = false;
      uiState.activeTabIndex = reviewTabIndex;
      invalidate();
    }

    function jumpFromReviewToQuestion() {
      const targetIndex = clamp(uiState.reviewCursor, 0, lastQuestionIndex);
      uiState.returnReviewCursor = targetIndex;
      uiState.returnToReview = true;
      uiState.activeTabIndex = targetIndex;
      uiState.lastQuestionTabIndex = targetIndex;
      invalidate();
    }

    function activateAction() {
      const question = getActiveQuestion();
      if (!question) return;

      if (!hasReview) {
        if (areAllAnswersValid(questions, uiState.questionStateById)) finalize(false);
        return;
      }

      if (uiState.activeTabIndex === lastQuestionIndex) {
        jumpToReview();
        return;
      }

      switchTabs(1);
    }

    function moveQuestionCursor(delta: number) {
      const question = getActiveQuestion();
      if (!question) return;
      const selection = ensureQuestionState(uiState.questionStateById, question.id);
      const rows = getNavRows(question, selection);
      if (rows.length === 0) return;
      const currentCursor = uiState.questionOptionCursorById[question.id] ?? 0;
      uiState.questionOptionCursorById[question.id] = clamp(currentCursor + delta, 0, rows.length - 1);
      invalidate();
    }

    function getActiveRow():
      | { question: NormalizedQuestion; selection: QuestionSelectionState; row: NavRow }
      | undefined {
      const question = getActiveQuestion();
      if (!question) return undefined;
      const selection = ensureQuestionState(uiState.questionStateById, question.id);
      const rows = getNavRows(question, selection);
      const cursor = clamp(uiState.questionOptionCursorById[question.id] ?? 0, 0, rows.length - 1);
      const row = rows[cursor];
      if (!row) return undefined;
      return { question, selection, row };
    }

    function handleSelectionToggle(
      question: NormalizedQuestion,
      selection: QuestionSelectionState,
      row: NavRow,
    ) {
      if (row.kind === 'customOther') {
        toggleCustomOther(question, selection, row.value);
        invalidate();
        return;
      }
      if (row.kind === 'listed') {
        toggleListedOption(question, selection, row.value);
        invalidate();
      }
    }

    function handleReviewInput(data: string) {
      if (matchesKey(data, Key.up)) {
        uiState.reviewCursor = clamp(uiState.reviewCursor - 1, 0, lastQuestionIndex);
        invalidate();
        return;
      }

      if (matchesKey(data, Key.down)) {
        uiState.reviewCursor = clamp(uiState.reviewCursor + 1, 0, lastQuestionIndex);
        invalidate();
        return;
      }

      if (isSpaceKey(data)) {
        jumpFromReviewToQuestion();
        return;
      }

      if (matchesKey(data, Key.enter)) {
        if (areAllAnswersValid(questions, uiState.questionStateById)) finalize(false);
        return;
      }

      if (matchesKey(data, Key.escape)) {
        uiState.activeTabIndex = clamp(uiState.lastQuestionTabIndex, 0, lastQuestionIndex);
        uiState.returnToReview = false;
        invalidate();
      }
    }

    function handleInput(data: string) {
      if (matchesKey(data, Key.left)) {
        switchTabs(-1);
        return;
      }

      if (matchesKey(data, Key.right)) {
        switchTabs(1);
        return;
      }

      if (hasReview && uiState.activeTabIndex === reviewTabIndex) {
        handleReviewInput(data);
        return;
      }

      const active = getActiveRow();
      if (!active) return;
      const { question, selection, row } = active;

      if (matchesKey(data, Key.up)) {
        moveQuestionCursor(-1);
        return;
      }

      if (matchesKey(data, Key.down)) {
        moveQuestionCursor(1);
        return;
      }

      // Free-text rows capture printable characters (including Space and 'r')
      // before any global shortcut so typing is never swallowed.
      if (row.kind === 'freeForm') {
        if (matchesKey(data, Key.enter)) {
          appendFreeFormText(selection, '\n');
          invalidate();
          return;
        }
        if (matchesKey(data, Key.backspace) || data === '\u007f') {
          deleteFreeFormText(selection);
          invalidate();
          return;
        }
        if (isPrintableInput(data)) {
          appendFreeFormText(selection, data);
          invalidate();
          return;
        }
        if (matchesKey(data, Key.escape)) finalize(true);
        return;
      }

      if (row.kind === 'otherDraft') {
        if (question.type === 'singleSelect') {
          if (matchesKey(data, Key.backspace) || data === '\u007f') {
            deleteOtherDraftText(selection);
            selectSingleOther(selection);
            invalidate();
            return;
          }
          if (isPrintableInput(data)) {
            appendOtherDraftText(selection, data);
            selectSingleOther(selection);
            invalidate();
            return;
          }
          if (matchesKey(data, Key.escape)) finalize(true);
          return;
        }

        // multiSelect draft row: Enter commits a reusable Other option.
        if (matchesKey(data, Key.enter)) {
          commitOtherDraft(question, selection);
          invalidate();
          return;
        }
        if (matchesKey(data, Key.backspace) || data === '\u007f') {
          deleteOtherDraftText(selection);
          invalidate();
          return;
        }
        if (isPrintableInput(data)) {
          appendOtherDraftText(selection, data);
          invalidate();
          return;
        }
        if (matchesKey(data, Key.escape)) finalize(true);
        return;
      }

      if (isRKey(data) && hasReview) {
        jumpToReview();
        return;
      }

      if (row.kind === 'action') {
        if (matchesKey(data, Key.enter) || isSpaceKey(data)) {
          activateAction();
          return;
        }
        if (matchesKey(data, Key.escape)) finalize(true);
        return;
      }

      if (isSpaceKey(data)) {
        handleSelectionToggle(question, selection, row);
        return;
      }

      if (matchesKey(data, Key.enter)) {
        activateAction();
        return;
      }

      if (matchesKey(data, Key.escape)) finalize(true);
    }

    function renderTabs(width: number, lines: string[]) {
      const allValid = areAllAnswersValid(questions, uiState.questionStateById);
      const renderedTabs = questions.map((question, index) => {
        const state = ensureQuestionState(uiState.questionStateById, question.id);
        const answered = isAnswerValid(question, state);
        const marker = answered ? '■' : '□';
        const text = ` ${marker} ${question.label} `;
        if (uiState.activeTabIndex === index) {
          return theme.bg('selectedBg', theme.fg('text', text));
        }
        return theme.fg(answered ? 'success' : 'muted', text);
      });

      const reviewText = allValid ? REVIEW_LABEL_READY : REVIEW_LABEL_PENDING;
      const reviewStyled =
        uiState.activeTabIndex === reviewTabIndex
          ? theme.bg('selectedBg', theme.fg('text', reviewText))
          : theme.fg(allValid ? 'success' : 'muted', reviewText);

      const tabLine = renderedTabs.concat(reviewStyled).join(' ');
      lines.push(truncateToWidth(tabLine, width));
      lines.push('');
    }

    function renderFreeFormRow(
      width: number,
      lines: string[],
      selection: QuestionSelectionState,
      isCursor: boolean,
    ) {
      const prefix = isCursor ? theme.fg('accent', '> ') : '  ';
      const caret = isCursor ? '▌' : '';

      const textLines = selection.freeFormText.split('\n');
      textLines.forEach((line, index) => {
        const linePrefix = index === 0 ? prefix : '  ';
        const isLast = index === textLines.length - 1;
        const display = `${line}${isLast ? caret : ''}` || ' ';
        pushWrappedWithPrefix(lines, linePrefix, theme.fg('text', display), width);
      });
    }

    function renderActionRow(
      width: number,
      lines: string[],
      row: ActionRow,
      isCursor: boolean,
      prefix: string,
    ) {
      const ready = areAllAnswersValid(questions, uiState.questionStateById);
      const canActivate = hasReview || ready;
      const label = `[ ${row.label} ]`;
      const styled = isCursor
        ? theme.bg('selectedBg', theme.fg(canActivate ? 'text' : 'muted', label))
        : theme.fg(canActivate ? 'accent' : 'muted', label);

      lines.push('');
      pushWrappedWithPrefix(lines, prefix, styled, width);

      if (!hasReview && !ready) {
        pushWrappedWithPrefix(
          lines,
          '    ',
          theme.fg('warning', 'Complete this question to submit.'),
          width,
        );
      }
    }

    function renderQuestionBody(width: number, lines: string[], question: NormalizedQuestion) {
      const selection = ensureQuestionState(uiState.questionStateById, question.id);
      const rows = getNavRows(question, selection);
      const cursor = clamp(uiState.questionOptionCursorById[question.id] ?? 0, 0, rows.length - 1);

      pushWrappedText(lines, theme.fg('text', question.prompt), width);
      lines.push('');

      rows.forEach((row, index) => {
        const isCursor = cursor === index;
        const prefix = isCursor ? theme.fg('accent', '> ') : '  ';

        if (row.kind === 'freeForm') {
          renderFreeFormRow(width, lines, selection, isCursor);
          return;
        }

        if (row.kind === 'action') {
          renderActionRow(width, lines, row, isCursor, prefix);
          return;
        }

        if (row.kind === 'customOther') {
          const selected = selection.selectedCustomOtherValues.includes(row.value);
          const marker = selected ? '[x]' : '[ ]';
          const color = selected ? 'accent' : 'text';
          pushWrappedWithPrefix(lines, prefix, theme.fg(color, `${marker} ${row.label}`), width);
          return;
        }

        if (row.kind === 'otherDraft') {
          const selected = question.type === 'singleSelect' && selection.otherSelected;
          const marker = selected ? '[x]' : '[ ]';
          const color = selected || isCursor ? 'accent' : 'text';
          pushWrappedWithPrefix(lines, prefix, theme.fg(color, `${marker} ${row.label}`), width);
          const hint = question.type === 'multiSelect' ? 'Enter to add' : 'Type a custom answer';
          pushWrappedWithPrefix(lines, '    ', theme.fg('muted', hint), width);
          return;
        }

        const selected = selection.listedSelectedValues.includes(row.value);
        const marker = selected ? '[x]' : '[ ]';
        const color = selected ? 'accent' : 'text';
        pushWrappedWithPrefix(lines, prefix, theme.fg(color, `${marker} ${row.label}`), width);

        if (row.description) {
          pushWrappedWithPrefix(lines, '    ', theme.fg('muted', row.description), width);
        }
      });
    }

    function renderReviewBody(width: number, lines: string[]) {
      const ready = areAllAnswersValid(questions, uiState.questionStateById);
      const normalizedAnswers = normalizeAnswers(questions, uiState.questionStateById);

      pushWrappedText(lines, theme.fg('accent', theme.bold('Review answers')), width);
      lines.push('');

      for (const [index, question] of questions.entries()) {
        const answer = normalizedAnswers[index];
        const valid = isAnswerValid(
          question,
          ensureQuestionState(uiState.questionStateById, question.id),
        );
        const cursor = uiState.reviewCursor === index ? theme.fg('accent', '> ') : '  ';
        const marker = valid ? theme.fg('success', '■') : theme.fg('warning', '□');
        const value = formatAnswerValue(answer);
        const color = valid ? 'text' : 'muted';
        pushWrappedWithPrefix(
          lines,
          cursor,
          `${marker} ${theme.fg('accent', `${question.label}:`)} ${theme.fg(color, value)}`,
          width,
        );
      }

      lines.push('');
      pushWrappedText(
        lines,
        ready
          ? theme.fg('success', 'Press Enter to submit')
          : theme.fg('warning', 'Complete all questions before submitting.'),
        width,
      );
    }

    function renderHint(width: number, lines: string[]) {
      let hint = '';

      if (hasReview && uiState.activeTabIndex === reviewTabIndex) {
        hint = '←→ tabs • ↑↓ review row • Space edit • Enter submit • Esc back';
      } else {
        const question = getActiveQuestion();
        const parts: string[] = [];
        if (hasReview) parts.push('←→ tabs');
        parts.push('↑↓ move');
        if (question?.type === 'freeForm') parts.push('type to answer', 'Enter newline');
        else parts.push('Space select');
        if (hasReview) parts.push('r review');
        parts.push('Enter button', 'Esc cancel');
        hint = parts.join(' • ');
      }

      lines.push('');
      pushWrappedText(lines, theme.fg('dim', hint), width);
    }

    function render(width: number): string[] {
      if (cachedLines && cachedWidth === width) {
        return cachedLines;
      }

      const lines: string[] = [];

      if (hasReview) renderTabs(width, lines);

      const activeQuestion = getActiveQuestion();
      if (activeQuestion) {
        renderQuestionBody(width, lines, activeQuestion);
      } else {
        renderReviewBody(width, lines);
      }

      renderHint(width, lines);

      cachedWidth = width;
      cachedLines = lines;
      return lines;
    }

    return {
      render,
      handleInput,
      invalidate: () => {
        cachedWidth = undefined;
        cachedLines = undefined;
      },
    };
  });
}
