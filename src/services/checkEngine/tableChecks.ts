import type { ParsedDocument } from "../../types/document";
import type { RuleProfile } from "../../types/settings";
import { createIssue, makeExecution, type RuleCheckResult } from "./ruleRunner";
import { runCaptionReferenceIssues } from "./captionReferenceHelpers";

function isPmProfile(profile: RuleProfile): boolean {
  return profile.id === "pm-department-normcontrol" || profile.originalProfileId === "pm-department-normcontrol";
}

export function runTableChecks(document: ParsedDocument, profile: RuleProfile): RuleCheckResult[] {
  const issues = runCaptionReferenceIssues(document, profile, {
    kind: "table",
    label: "Таблица",
    category: "tables",
    captionEnabled: profile.enabledChecks.tableCaptions,
    referenceEnabled: profile.enabledChecks.tableReferences || profile.enabledChecks.brokenReferences
  });
  if (profile.enabledChecks.tableCaptions) {
    for (const table of document.tables.filter((item) => !item.caption)) {
      issues.push(
        createIssue(
          {
            level: "warning",
            confidence: "medium",
            code: isPmProfile(profile) ? "PM_TABLE_CAPTION_MISSING" : "TABLE_OBJECT_WITHOUT_CAPTION",
            category: "tables",
            message: `Таблица ${table.index + 1} не имеет найденной подписи рядом с объектом.`,
            paragraphIndex: table.paragraphIndex,
            excerpt: table.text.slice(0, 220),
            recommendation: "Добавьте подпись таблицы непосредственно перед таблицей или сразу после неё.",
            reason: "Подпись таблицы ищется в пределах двух абзацев до или после объекта DOCX."
          },
          document,
          profile
        )
      );
    }
  }
  return [{ execution: makeExecution("TABLE_CHECKS", "Таблицы, подписи и ссылки", "tables", issues), issues }];
}
