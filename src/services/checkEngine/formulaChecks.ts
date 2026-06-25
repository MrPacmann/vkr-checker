import type { ParsedDocument } from "../../types/document";
import type { RuleProfile } from "../../types/settings";
import { createIssue, makeExecution, type RuleCheckResult } from "./ruleRunner";
import { runCaptionReferenceIssues } from "./captionReferenceHelpers";

export function runFormulaChecks(document: ParsedDocument, profile: RuleProfile): RuleCheckResult[] {
  const issues = runCaptionReferenceIssues(document, profile, {
    kind: "formula",
    label: "Формула",
    category: "formulas",
    captionEnabled: profile.enabledChecks.formulaCaptions,
    referenceEnabled: profile.enabledChecks.formulaReferences || profile.enabledChecks.brokenReferences
  });

  const formulaCaptionCount = document.captions.filter((caption) => caption.kind === "formula").length;
  if (document.stats.formulas > formulaCaptionCount) {
    issues.push(
      createIssue(
        {
          level: "info",
          confidence: "medium",
          code: "FORMULA_WITHOUT_NUMBER",
          category: "formulas",
          message: "В DOCX найдены Office Math-формулы без явного номера в конце абзаца.",
          recommendation: "Проверьте, что значимые формулы имеют номер формата (1), (1.1) или (2.3).",
          reason: `Office Math объектов: ${document.stats.formulas}, подписей/номеров формул: ${formulaCaptionCount}.`
        },
        document,
        profile
      )
    );
  }

  return [{ execution: makeExecution("FORMULA_CHECKS", "Формулы, номера и ссылки", "formulas", issues), issues }];
}
