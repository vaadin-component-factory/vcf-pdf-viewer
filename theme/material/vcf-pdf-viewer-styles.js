
import { registerStyles, css } from '@vaadin/vaadin-themable-mixin/register-styles.js';

import '@vaadin/vaadin-material-styles/color.js';
import '@vaadin/vaadin-material-styles/typography.js';

import '@vaadin/text-field/theme/material/vaadin-text-field-styles.js';
import '@vaadin/select/theme/material/vaadin-select-styles.js';
import '@vaadin/list-box/theme/material/vaadin-list-box-styles.js';
import '@vaadin/item/theme/material/vaadin-item-styles.js';

registerStyles(
  'vcf-pdf-viewer',
  css`
      :host {
        font-family: var(--material-font-family);
        position: relative;
      }

      [part~="viewer-container"] {
        background-color: var(--material-secondary-background-color);
        border: 1px solid rgba(0, 0, 0, 0.12);
        outline: none;
      }

      [part~="viewer-container"][focus-ring] {
        box-shadow: 0 0 0 2px var(--material-primary-color);
      }

      [part~="toolbar"] {
        display: flex;
        flex-direction: row;
        align-items: center;
        padding: 0 8px;
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
        padding: 0 4px;
      }

      [part~="toolbar-total-pages"] {
        padding-right: 4px;
      }

      [part~="toolbar-title"] {
        line-height: 2.25rem;
        display: inline-block;
        padding: 4px 0;
        flex: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      [part~="toolbar-button"] {
        width: 32px;
        height: 32px;
        color: black;
        margin: 2px;
        background: transparent;
        border: none;
        opacity: 0.7;
      }

      [part~="toolbar-button"][disabled] {
        opacity: 0.4;
      }

      [part~="toolbar-button"]:hover {
        opacity: 1;
      }

      [part~="toolbar-button"][disabled]:hover {
        opacity: 0.4;
      }

      [part~="previous-page-button-icon"]::before {
        content: url('baseline-keyboard_arrow_up-24px.svg');
      }

      [part~="next-page-button-icon"]::before {
        content: url('baseline-keyboard_arrow_down-24px.svg');
      }

      .page {
        padding: 8px;
        padding-bottom: 0;
      }

      .page:last-child {
        padding-bottom: 8px;
      }

      [part~="toolbar"].small-size [part~="toolbar-pages"] {
        flex: none;
      }

      [part~="toolbar"].small-size [part~="toolbar-zoom"] {
        position: absolute;
        bottom: 8px;
        left: 50%;
        margin-left: -100px;
        background-color: white;
        border: 1px solid rgba(0, 0, 0, 0.12);
        padding: 0 4px;
        z-index: 99;
      }
      `,
  { moduleId: 'material-vcf-pdf-viewer' }
);
