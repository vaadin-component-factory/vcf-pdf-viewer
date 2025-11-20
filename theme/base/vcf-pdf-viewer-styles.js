import {
  registerStyles,
  css,
} from "@vaadin/vaadin-themable-mixin/register-styles.js";

registerStyles(
  "vcf-pdf-viewer",
  css`
    :host {
      --pdf-viewer-background-color: var(--vaadin-background-color);
      --pdf-viewer-container-background-color: var(--vaadin-background-container);
      --pdf-viewer-border-color: var(--vaadin-border-color);
      --pdf-viewer-border-radius: var(--vaadin-radius-m);
      --pdf-viewer-box-shadow-color: var(--vaadin-focus-ring-color);
      
      --pdf-viewer-previous-page-button-icon: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4.5 15.75L12 8.25L19.5 15.75" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>');
      --pdf-viewer-next-page-button-icon: var(--_vaadin-icon-chevron-down);
      --pdf-viewer-toggle-button-icon-closed: var(--_vaadin-icon-menu);
      --pdf-viewer-toggle-button-icon-open: var(--_vaadin-icon-menu);

      --vaadin-focus-ring-width: 2px;
      background-color: var(--pdf-viewer-background-color);
      border: 1px solid var(--pdf-viewer-border-color);
      border-radius: var(--pdf-viewer-border-radius);
      position: relative;
    }

    :host([data-application-theme="lumo"]) {
      --pdf-viewer-background-color: var(--lumo-base-color);
      --pdf-viewer-container-background-color: var(--lumo-contrast-5pct);
      --pdf-viewer-border-color: var(--lumo-contrast-10pct);
      --pdf-viewer-border-radius: var(--lumo-border-radius-m);
      --pdf-viewer-font-family: var(--lumo-font-family);
      --pdf-viewer-box-shadow-color: var(--lumo-primary-color-50pct);

      --pdf-viewer-icon-font-family: "lumo-icons";
      --pdf-viewer-previous-page-button-icon: var(--lumo-icons-angle-up);
      --pdf-viewer-next-page-button-icon: var(--lumo-icons-angle-down);
      --pdf-viewer-toggle-button-icon-closed: var(--lumo-icons-chevron-right);
      --pdf-viewer-toggle-button-icon-open: var(--lumo-icons-chevron-left);
    }

    [part~="viewer-container"] {
      background-color: var(--pdf-viewer-container-background-color);
      outline: none;
    }

    [part~="viewer-container"][focus-ring] {
      box-shadow: 0 0 0 var(--vaadin-focus-ring-width) var(--pdf-viewer-box-shadow-color);
    }

    [part~="toolbar"] {
      display: flex;
      flex-direction: row;
      align-items: center;
      border-bottom: 1px solid var(--pdf-viewer-border-color);
      padding-left: var(--vaadin-padding-xs);
      padding-right: var(--vaadin-padding-m);
      gap: var(--vaadin-gap-s);
      z-index: 2;
    }

    [part~="toolbar-pages"] {
      display: flex;
      flex-direction: row;
      flex: 1;
      align-items: center;
      justify-content: flex-end;
    }

    ::slotted(.toolbar-current-page) {
      width: 3.25em;
    }

    [part~="toolbar-page-separator"] {
      padding: 0 var(--vaadin-padding-xs);
    }

    [part~="toolbar-total-pages"] {
      padding-right: var(--vaadin-padding-m);
    }

    [part~="toolbar-title"] {
      line-height: 2.25rem;
      display: inline-block;
      color: var(--lumo-header-title-color, var(--vaadin-text-color));
      padding: var(--vaadin-padding-xs) 0;
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .page {
      padding: var(--vaadin-padding-m);
      padding-bottom: 0;
    }

    .page:last-child {
      padding-bottom: var(--vaadin-padding-m);
    }

    .textLayer {
      top: var(--vaadin-padding-m);
      right: var(--vaadin-padding-m);
      bottom: var(--vaadin-padding-m);
      left: var(--vaadin-padding-m);
      opacity: 0.2;
    }

    .textLayer ::-moz-selection {
      background: rgb(0, 0, 255);
    }

    .textLayer ::selection {
      background: rgb(0, 0, 255);
    }

    .textLayer .highlight {
      background-color: rgb(180, 0, 170);
      border-radius: 4px;
    }

    .textLayer .highlight.selected {
      background-color: rgb(0, 100, 0);
    }

    [part~="toolbar"].small-size [part~="toolbar-pages"] {
      flex: none;
    }

    [part~="toolbar"].small-size ::slotted(.toolbar-zoom) {
      position: absolute;
      bottom: var(--vaadin-padding-s);
      left: 50%;
      margin-left: -100px;
      background-color: white;
      box-shadow: var(--lumo-box-shadow-m);
      padding: var(--vaadin-padding-xs);
      z-index: 99;
    }
  `,
  { moduleId: "lumo-vcf-pdf-viewer" },
);
