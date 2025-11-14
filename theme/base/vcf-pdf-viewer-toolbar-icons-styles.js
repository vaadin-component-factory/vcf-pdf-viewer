import {
  registerStyles,
  css,
} from "@vaadin/vaadin-themable-mixin/register-styles.js";

registerStyles(
  "vaadin-icon",
  css`
    :host::before {
      font-size: var(--vaadin-icon-size);
      font-family: var(--pdf-viewer-icon-font-family);
      line-height: 1;
    }

    :host(.previous-page-button-icon) svg,
    :host(.next-page-button-icon) svg,
    :host(.toggle-button-icon) svg,
    :host(.sidebarOpen.toggle-button-icon) svg {
      display: none;
    }

    :host(.previous-page-button-icon)::before {
      content: var(--pdf-viewer-previous-page-button-icon);
    }

    :host(.next-page-button-icon)::before {
      content: var(--pdf-viewer-next-page-button-icon);
    }

    :host(.toggle-button-icon)::before {
      content: var(--pdf-viewer-toggle-button-icon-closed);
    }

    :host(.sidebarOpen.toggle-button-icon)::before {
      content: var(--pdf-viewer-toggle-button-icon-open);
    }
  `,
  { moduleId: "base-vcf-pdf-viewer-toolbar-icons" },
);
