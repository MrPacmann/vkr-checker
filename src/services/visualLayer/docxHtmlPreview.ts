import { renderAsync } from "docx-preview";

export async function renderDocxHtmlPreview(file: File): Promise<HTMLElement> {
  const container = document.createElement("div");
  container.className = "docx-preview-root";
  const arrayBuffer = await file.arrayBuffer();
  await renderAsync(arrayBuffer, container, undefined, {
    className: "docx-preview",
    inWrapper: true,
    ignoreWidth: false,
    ignoreHeight: false,
    ignoreFonts: false,
    breakPages: true,
    experimental: true,
    renderHeaders: true,
    renderFooters: true,
    renderFootnotes: true
  });
  return container;
}
