import { registerStyles, css } from '@vaadin/vaadin-themable-mixin/register-styles.js';

registerStyles(
    'vaadin-icon',
    css`
      :host::before {
        font-size: var(--vaadin-icon-size);
        font-family: var(--pdf-viewer-font-family);
        line-height: 1;

        --pdf-viewer-previous-page-button-icon: '\ea07';
        --pdf-viewer-next-page-button-icon: '\ea08';
        --pdf-viewer-toggle-button-icon-closed: '\ea12';
        --pdf-viewer-toggle-button-icon-open: '\ea11';
      }

      :host([data-application-theme='lumo'])::before {
          font-family: "lumo-icons";
          --pdf-viewer-previous-page-button-icon: var(--lumo-icons-angle-up);
          --pdf-viewer-next-page-button-icon: var(--lumo-icons-angle-down);
          --pdf-viewer-toggle-button-icon-closed: var(--lumo-icons-chevron-right);
          --pdf-viewer-toggle-button-icon-open: var(--lumo-icons-chevron-left);
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
        content:var(--pdf-viewer-toggle-button-icon-open);
      } 
   
     `,
    { moduleId: 'base-vcf-pdf-viewer-toolbar-icons' }
  );
  