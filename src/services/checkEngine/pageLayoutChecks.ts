import type { ParsedDocument, SectionLayout } from "../../types/document";
import type { CheckIssue } from "../../types/report";
import type { RuleProfile } from "../../types/settings";
import { createIssue, makeExecution, type RuleCheckResult } from "./ruleRunner";

function closeEnough(actual: number | undefined, expected: number, tolerance = 0.5): boolean {
  return actual !== undefined && Math.abs(actual - expected) <= tolerance;
}

interface ExpectedLayout {
  leftMarginMm: number;
  rightMarginMm: number;
  topMarginMm: number;
  bottomMarginMm: number;
  useAllowedRightMargin: boolean;
  label: string;
}

function expectedLayout(layout: SectionLayout, profile: RuleProfile): ExpectedLayout {
  if (layout.orientation === "landscape" && profile.pageLayout.allowLandscapePages && profile.pageLayout.landscapeMargins) {
    return {
      leftMarginMm: profile.pageLayout.landscapeMargins.leftMm,
      rightMarginMm: profile.pageLayout.landscapeMargins.rightMm,
      topMarginMm: profile.pageLayout.landscapeMargins.topMm,
      bottomMarginMm: profile.pageLayout.landscapeMargins.bottomMm,
      useAllowedRightMargin: false,
      label: "альбомной секции"
    };
  }
  return {
    leftMarginMm: profile.pageLayout.leftMarginMm,
    rightMarginMm: profile.pageLayout.rightMarginMm,
    topMarginMm: profile.pageLayout.topMarginMm,
    bottomMarginMm: profile.pageLayout.bottomMarginMm,
    useAllowedRightMargin: true,
    label: "книжной секции"
  };
}

function describeMargins(layout: SectionLayout, expected: ExpectedLayout): string {
  const margins = layout.margins ?? {};
  return [
    `левое: ${margins.leftMm ?? "?"} / ${expected.leftMarginMm} мм`,
    `правое: ${margins.rightMm ?? "?"} / ${expected.rightMarginMm} мм`,
    `верхнее: ${margins.topMm ?? "?"} / ${expected.topMarginMm} мм`,
    `нижнее: ${margins.bottomMm ?? "?"} / ${expected.bottomMarginMm} мм`
  ].join("; ");
}

function marginMatches(side: string, actual: number | undefined, expected: number, profile: RuleProfile, useAllowedRightMargin: boolean): boolean {
  const tolerance = profile.pageLayout.marginToleranceMm ?? 0.5;
  if (useAllowedRightMargin && side === "правое" && profile.pageLayout.allowedRightMarginMm?.some((allowed) => closeEnough(actual, allowed, tolerance))) return true;
  return closeEnough(actual, expected, tolerance);
}

function isPmProfile(profile: RuleProfile): boolean {
  return profile.id === "pm-department-normcontrol" || profile.originalProfileId === "pm-department-normcontrol";
}

export function runPageLayoutChecks(document: ParsedDocument, profile: RuleProfile): RuleCheckResult[] {
  if (!profile.enabledChecks.pageLayout) return [];
  const issues: CheckIssue[] = [];
  const fallbackLayouts = [document.paragraphs.find((paragraph) => paragraph.sectionLayout)?.sectionLayout].filter((layout): layout is SectionLayout => Boolean(layout));
  const layouts: SectionLayout[] = document.sectionLayouts.length ? document.sectionLayouts : fallbackLayouts;

  if (layouts.length === 0) {
    issues.push(
      createIssue(
        {
          level: "info",
          confidence: "unknown",
          code: "PAGE_LAYOUT_UNAVAILABLE",
          category: "pageLayout",
          message: "Параметры страницы не удалось проверить автоматически с достаточной точностью.",
          recommendation: "Откройте параметры страницы в Word и проверьте формат A4, ориентацию и поля вручную.",
          source: "system"
        },
        document,
        profile
      )
    );
    return [{ execution: makeExecution("PAGE_LAYOUT", "Параметры страницы", "pageLayout", issues, "partial"), issues }];
  }

  layouts.forEach((layout, index) => {
    const expected = expectedLayout(layout, profile);
    const customLandscapeAllowed = layout.pageSize === "custom" && layout.orientation === "landscape" && profile.pageLayout.allowLandscapePages;
    if (layout.pageSize !== "A4" && !customLandscapeAllowed) {
      issues.push(
        createIssue(
          {
            level: "error",
            confidence: "high",
            code: isPmProfile(profile) ? "PM_PAGE_A4_REQUIRED" : "PAGE_SIZE_NOT_A4",
            category: "pageLayout",
            message: `Секция ${index + 1}: формат страницы отличается от A4.`,
            recommendation: "Установите формат страницы A4 для всей работы.",
            reason: `Размер страницы: ${layout.pageWidthMm ?? "?"} x ${layout.pageHeightMm ?? "?"} мм.`
          },
          document,
          profile
        )
      );
    }
    if (layout.orientation && layout.orientation !== profile.pageLayout.orientation && !(layout.orientation === "landscape" && profile.pageLayout.allowLandscapePages)) {
      issues.push(
        createIssue(
          {
            level: "warning",
            confidence: "high",
            code: isPmProfile(profile) ? "PM_PAGE_LANDSCAPE_TEXT_FORBIDDEN" : "PAGE_ORIENTATION_MISMATCH",
            category: "pageLayout",
            message: `Секция ${index + 1}: ориентация страницы отличается от профиля.`,
            recommendation: `Установите ориентацию ${profile.pageLayout.orientation === "portrait" ? "книжную" : "альбомную"} либо проверьте, допустимо ли исключение.`
          },
          document,
          profile
        )
      );
    }
    const margins = layout.margins ?? {};
    const mismatchedMargins = [
      ["левое", margins.leftMm, expected.leftMarginMm],
      ["правое", margins.rightMm, expected.rightMarginMm],
      ["верхнее", margins.topMm, expected.topMarginMm],
      ["нижнее", margins.bottomMm, expected.bottomMarginMm]
    ].filter(([side, actual, expectedValue]) => !marginMatches(side as string, actual as number | undefined, expectedValue as number, profile, expected.useAllowedRightMargin));
    if (mismatchedMargins.length > 0) {
      const details = mismatchedMargins
        .map(([side, actual, expected]) => `${side} поле ${actual ?? "?"} мм, ожидается ${expected} мм`)
        .join("; ");
      const firstMismatch = mismatchedMargins[0];
      issues.push(
        createIssue(
          {
            level: "error",
            confidence: "high",
            code: isPmProfile(profile) ? "PM_PAGE_MARGINS_MISMATCH" : "PAGE_MARGINS_MISMATCH",
            category: "pageLayout",
            message: isPmProfile(profile) ? `Секция ${index + 1}: ${details} по профилю кафедры ПМ для ${expected.label}.` : `Секция ${index + 1}: ${details}.`,
            recommendation: `Установите поля: левое ${expected.leftMarginMm} мм, правое ${expected.rightMarginMm} мм, верхнее ${expected.topMarginMm} мм, нижнее ${expected.bottomMarginMm} мм.`,
            reason: describeMargins(layout, expected),
            expected: `${firstMismatch?.[2] ?? "?"} мм`,
            actual: `${firstMismatch?.[1] ?? "?"} мм`
          },
          document,
          profile
        )
      );
    }
  });

  return [{ execution: makeExecution("PAGE_LAYOUT", "Параметры страницы", "pageLayout", issues), issues }];
}
