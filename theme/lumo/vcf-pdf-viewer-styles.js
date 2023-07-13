import { registerStyles, css } from '@vaadin/vaadin-themable-mixin/register-styles.js';

import '@vaadin/vaadin-lumo-styles/color.js';
import '@vaadin/vaadin-lumo-styles/sizing.js';
import '@vaadin/vaadin-lumo-styles/spacing.js';
import '@vaadin/vaadin-lumo-styles/typography.js';
import '@vaadin/vaadin-lumo-styles/font-icons.js';

import '@vaadin/select/theme/lumo/vaadin-select-styles.js';
import '@vaadin/list-box/theme/lumo/vaadin-list-box-styles.js';
import '@vaadin/item/theme/lumo/vaadin-item-styles.js';

registerStyles(
    'vcf-pdf-viewer',
    css`
        :host {
        background-color: var(--lumo-base-color);
        border: 1px solid var(--lumo-contrast-10pct);
        border-radius: var(--lumo-border-radius, var(--lumo-border-radius-m));
        font-family: var(--lumo-font-family);
        position: relative;
      }

      [part~="viewer-container"] {
        background-color: var(--lumo-contrast-5pct);
        outline: none;
      }

      [part~="viewer-container"][focus-ring] {
        box-shadow: 0 0 0 2px var(--lumo-primary-color-50pct);
      }

      [part~="toolbar"] {
        display: flex;
        flex-direction: row;
        align-items: center;
        border-bottom: 1px solid var(--lumo-contrast-10pct);
        padding: 0 var(--lumo-space-m);
        z-index: 2;
      }

      [part~="toolbar-pages"] {
        display: flex;
        flex-direction: row;
        flex: 1;
        align-items: center;
        justify-content: flex-end;
      }

      [part~="toolbar-current-page"] {
        width: 3.25em;
      }

      [part~="toolbar-page-separator"] {
        padding: 0 var(--lumo-space-xs);
      }

      [part~="toolbar-total-pages"] {
        padding-right: var(--lumo-space-m);
      }

      [part~="toolbar-title"] {
        line-height: 2.25rem;
        display: inline-block;
        color: var(--lumo-contrast-80pct);
        padding: var(--lumo-space-xs) 0;
        flex: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      [part~="toolbar-button"] {
        height: var(--lumo-size-m);
        border-radius: var(--lumo-border-radius, var(--lumo-border-radius-m));
        color: var(--lumo-contrast-80pct);
        transition: background-color 100ms, color 100ms;
        margin: var(--lumo-space-xs);
        background: transparent;
        border: none;
        padding-top: 0.2em;
      }

      [part~="toolbar-button"][disabled] {
        color: var(--lumo-contrast-40pct);
      }

      [part~="toolbar-button"]:hover {
        background-color: var(--lumo-contrast-5pct);
        color: var(--lumo-contrast-80pct);
      }

      [part~="toolbar-button"][disabled]:hover {
        background-color: transparent;
        color: var(--lumo-contrast-40pct);
      }

      [part~="toolbar-button"]:focus {
        outline: none;
        box-shadow: 0 0 0 2px var(--lumo-primary-color-50pct);
      }

      [part~="toolbar-button"] {
        font-family: 'lumo-icons';
        font-size: var(--lumo-icon-size-m);
      }

      [part~="previous-page-button-icon"]::before {
        content: var(--lumo-icons-angle-up);
      }

      [part~="next-page-button-icon"]::before {
        content: var(--lumo-icons-angle-down);
      }

      [part~="toggle-button-icon"]::before {
        content: var(--lumo-icons-chevron-right);
      }

      #outerContainer.sidebarOpen [part~="toggle-button-icon"]::before {
        content: var(--lumo-icons-chevron-left);
      }

      .page {
        padding: var(--lumo-space-m);
        padding-bottom: 0;
      }

      .page:last-child {
        padding-bottom: var(--lumo-space-m);
      }

      .textLayer {
        top: var(--lumo-space-m);
        right: var(--lumo-space-m);
        bottom: var(--lumo-space-m);
        left: var(--lumo-space-m);
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

      [part~="toolbar"].small-size [part~="toolbar-zoom"] {
        position: absolute;
        bottom: var(--lumo-space-s);
        left: 50%;
        margin-left: -100px;
        background-color: white;
        box-shadow: var(--lumo-box-shadow-m);
        padding: var(--lumo-space-xs);
        z-index: 99;
      }
     `,
    { moduleId: 'lumo-vcf-pdf-viewer' }
  );
  