import type { ParsedDocument } from "../../types/document";
import type { CheckIssue } from "../../types/report";
import type { VisualLayerResult } from "../../types/visualLayer";
import { normalizeSpaces } from "../../utils/text";
import { estimatedPageForIssue } from "../documentParser/documentModelBuilder";

export function attachPagesToIssues(issues: CheckIssue[], document: ParsedDocument, visualLayer: VisualLayerResult): CheckIssue[] {
  return issues.map((issue) => {
    const estimatedPage = issue.location.estimatedPage ?? estimatedPageForIssue(issue.location.paragraphIndex, document);
    let exactPage = issue.location.page ?? null;
    if (!exactPage && visualLayer.pages.length > 0) {
      const needle = normalizeSpaces(issue.excerpt ?? "");
      if (needle.length > 12) {
        const fragment = needle.slice(0, 48).trim();
        const found = visualLayer.pages.find((page) => normalizeSpaces(page.text ?? "").includes(fragment));
        exactPage = found?.pageNumber ?? null;
      }
    }
    return {
      ...issue,
      location: {
        ...issue.location,
        estimatedPage,
        page: exactPage
      }
    };
  });
}
