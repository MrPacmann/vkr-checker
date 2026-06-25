import type { ParsedDocument } from "../../types/document";
import type { RuleProfile } from "../../types/settings";
import { makeExecution, type RuleCheckResult } from "./ruleRunner";
import { runCaptionReferenceIssues } from "./captionReferenceHelpers";

export function runFigureChecks(document: ParsedDocument, profile: RuleProfile): RuleCheckResult[] {
  const schemeCaptionCount = document.captions.filter((caption) => caption.kind === "scheme").length;
  const referenceRequired = profile.figures?.referenceRequired !== false;
  const issues = runCaptionReferenceIssues(document, profile, {
    kind: "figure",
    label: "Рисунок",
    category: "figures",
    captionEnabled: profile.enabledChecks.figureCaptions,
    referenceEnabled: referenceRequired && (profile.enabledChecks.figureReferences || profile.enabledChecks.brokenReferences),
    objectCount: Math.max(0, document.images.length - schemeCaptionCount)
  });
  return [{ execution: makeExecution("FIGURE_CHECKS", "Рисунки, подписи и ссылки", "figures", issues), issues }];
}
