import type { ParsedDocument } from "../../types/document";
import type { RuleProfile } from "../../types/settings";
import { makeExecution, type RuleCheckResult } from "./ruleRunner";
import { runCaptionReferenceIssues } from "./captionReferenceHelpers";

export function runListingChecks(document: ParsedDocument, profile: RuleProfile): RuleCheckResult[] {
  const issues = runCaptionReferenceIssues(document, profile, {
    kind: "listing",
    label: "Листинг",
    category: "listings",
    captionEnabled: profile.enabledChecks.listingCaptions,
    referenceEnabled: profile.enabledChecks.listingReferences || profile.enabledChecks.brokenReferences
  });
  return [{ execution: makeExecution("LISTING_CHECKS", "Листинги, подписи и ссылки", "listings", issues), issues }];
}
