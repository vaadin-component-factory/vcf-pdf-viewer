import { registerStyles, css } from '@vaadin/vaadin-themable-mixin/register-styles.js';

import '@vaadin/icon/theme/lumo/vaadin-icon-styles.js';

import '@vaadin/vaadin-lumo-styles/font-icons.js';

registerStyles(
    'vaadin-icon',
    css`
      :host::before {
        font-size: var(--lumo-icon-size-m);
        font-family: 'lumo-icons';
        line-height: 1;        
      }

      :host(.previous-page-button-icon)::before {
        content: var(--pdf-viewer-previous-page-button-icon, var(--lumo-icons-angle-up));
      }

      :host(.next-page-button-icon)::before {
        content: var(--pdf-viewer-next-page-button-icon, var(--lumo-icons-angle-down));
      }

      :host(.toggle-button-icon)::before {
        content: var(--pdf-viewer-toggle-button-icon, var(--lumo-icons-chevron-right));
      }
   
      :host(.sidebarOpen.toggle-button-icon)::before {
        content:var(--pdf-viewer-toggle-button-icon, var(--lumo-icons-chevron-left));
      } 
   
     `,
    { moduleId: 'lumo-vcf-pdf-viewer-toolbar-icons' }
  );
  