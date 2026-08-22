/**
 * Public type declarations for `<vcf-pdf-viewer>`.
 *
 * These are hand-written because the component is authored in plain
 * JavaScript, so there is no `tsc` pass that could emit them. They sit next to
 * the `.js` they describe, and both files are listed in `files` and in the
 * `exports` map of `package.json`, so `import { PdfViewerElement } from
 * '@vaadin-component-factory/vcf-pdf-viewer'` resolves under `strict`.
 *
 * Only the documented public surface is declared. The `_` and `__` prefixed
 * members are internal and deliberately left out, apart from `_getPage()`,
 * which is declared as protected because it is the read counterpart of
 * `setCurrentPage()`.
 *
 * The base is `HTMLElement`, not `LitElement`, on purpose: `lit` is not a
 * direct dependency of this package, so referencing it here would leak an
 * unresolvable type onto consumers. The one Lit member that is part of the
 * public contract, `updateComplete`, is declared explicitly.
 */
import { ElementMixin } from '@vaadin/component-base/src/element-mixin.js';
import { ResizeMixin } from '@vaadin/component-base/src/resize-mixin.js';
import { SlotStylesMixin } from '@vaadin/component-base/src/slot-styles-mixin.js';
import { ThemeDetectionMixin } from '@vaadin/vaadin-themable-mixin/vaadin-theme-detection-mixin.js';
import { ThemableMixin } from '@vaadin/vaadin-themable-mixin/vaadin-themable-mixin.js';

/**
 * The pdf.js `PDFDocumentProxy` handed out by `document-loaded`, narrowed to
 * the members that are usable without the pdf.js typings — the `pdfjs/dist`
 * bundle shipped by this package has none.
 */
export interface PdfDocumentProxy {
  /** Total number of pages of the loaded document. */
  readonly numPages: number;

  /** Fingerprints of the document, as computed by pdf.js. */
  readonly fingerprints: ReadonlyArray<string | null>;

  /** The document's `info` dictionary and its XMP metadata. */
  getMetadata(): Promise<{ info: Record<string, unknown>; metadata: unknown }>;
}

export interface PdfViewerDocumentLoadedEventDetail {
  /** The document that finished loading. */
  document: PdfDocumentProxy;
}

export interface PdfViewerThumbnailClickedEventDetail {
  /** The viewer whose sidebar thumbnail was clicked. */
  source: PdfViewerElement;

  /** One-based number of the page the thumbnail stands for. */
  pageNumber: number;
}

/**
 * Fired after `currentPage` has been updated by the element itself, i.e. when
 * scrolling or the toolbar changed the page. Carries no detail; read
 * `currentPage` off the target.
 */
export type PdfViewerCurrentPageChangedEvent = CustomEvent<null>;

/** Fired once the document behind `src` has loaded and its title is resolved. */
export type PdfViewerDocumentLoadedEvent = CustomEvent<PdfViewerDocumentLoadedEventDetail>;

/** Fired when a thumbnail in the sidebar is clicked, after navigating to its page. */
export type PdfViewerThumbnailClickedEvent = CustomEvent<PdfViewerThumbnailClickedEventDetail>;

export interface PdfViewerElementCustomEventMap {
  'currentPage-changed': PdfViewerCurrentPageChangedEvent;
  'document-loaded': PdfViewerDocumentLoadedEvent;
  'thumbnail-clicked': PdfViewerThumbnailClickedEvent;
}

export interface PdfViewerElementEventMap extends HTMLElementEventMap, PdfViewerElementCustomEventMap {}

/**
 * `<vcf-pdf-viewer>` is a Web Component for rendering PDF files without the
 * need of plugins. You can provide a pdf file to it through the `src`
 * attribute.
 *
 * ```html
 * <vcf-pdf-viewer src="myfile.pdf"></vcf-pdf-viewer>
 * ```
 *
 * ### Styling
 *
 * The following shadow DOM parts are available for styling:
 *
 * Part name           | Description
 * --------------------|------------
 * `toolbar`           | The bar above the document, holding the title and the controls.
 * `outer-container`   | The element wrapping both the sidebar and the document.
 * `main-container`    | The element wrapping the document.
 * `viewer-container`  | The scrolling container of the rendered pages.
 * `sidebar-container` | The collapsible sidebar.
 * `sidebar-content`   | The content of the sidebar.
 * `thumbnail-view`    | The list of page thumbnails inside the sidebar.
 *
 * @mixes ElementMixin
 * @mixes ResizeMixin
 * @mixes SlotStylesMixin
 * @mixes ThemableMixin
 * @mixes ThemeDetectionMixin
 */
declare class PdfViewerElement extends ResizeMixin(
  SlotStylesMixin(ThemeDetectionMixin(ThemableMixin(ElementMixin(HTMLElement))))
) {
  static readonly is: 'vcf-pdf-viewer';

  static readonly version: string;

  /**
   * The pdf file to render, resolved against `document.baseURI`. Note that
   * regular cross site scripting (XSS) rules apply: the file should be on the
   * same server as where the component is run, or that server should be
   * configured to allow loading files from other sites.
   *
   * @attr {string} src
   */
  src: string;

  /**
   * The level of zoom on the document. Allowed values are
   * - a number, as a string, for a zoom factor — e.g. `'1.5'` means 150% zoom
   * - `'auto'`, the default
   * - `'page-fit'`, to fit a full page into the component
   *
   * @attr {string} zoom
   */
  zoom: string;

  /**
   * The page currently in view, one-based and as a string. The element writes
   * to it as well, and fires `currentPage-changed` when it does. Assigning to
   * it does not scroll; call `setCurrentPage()` for that.
   *
   * @attr {string} currentpage
   */
  currentPage: string;

  /**
   * When true, the toolbar shows only the filename as the title, instead of
   * combining it with the title from the PDF metadata.
   *
   * @attr {boolean} toolbaronlyfilename
   */
  toolbarOnlyFilename: boolean;

  /**
   * Label of the automatic zoom entry of the zoom dropdown.
   *
   * @attr {string} autozoomoptionlabel
   */
  autoZoomOptionLabel: string;

  /**
   * Label of the page fit entry of the zoom dropdown.
   *
   * @attr {string} fitzoomoptionlabel
   */
  fitZoomOptionLabel: string;

  /**
   * A custom title for the viewer. When set, it replaces the title the
   * component derives from the filename and the PDF metadata.
   *
   * @attr {string} customtitle
   */
  customTitle: string;

  /**
   * When true, form elements are rendered as interactive HTML in the
   * annotation layer; when false, their values are painted directly onto the
   * canvas.
   *
   * @attr {boolean} renderinteractiveforms
   */
  renderInteractiveForms: boolean;

  /**
   * When true, the zoom dropdown is hidden. By default it is always shown.
   *
   * @attr {boolean} hidezoom
   */
  hideZoom: boolean;

  /**
   * A custom tooltip for the sidebar toggle button.
   *
   * @attr {string} sidebartoggletooltip
   */
  sidebarToggleTooltip: string;

  /**
   * A custom tooltip for the previous page button.
   *
   * @attr {string} previouspagetooltip
   */
  previousPageTooltip: string;

  /**
   * A custom tooltip for the next page button.
   *
   * @attr {string} nextpagetooltip
   */
  nextPageTooltip: string;

  /** Resolves when the element has finished its pending update. */
  readonly updateComplete: Promise<boolean>;

  /**
   * Scrolls to `value`, clamped to the document, or re-applies the current
   * value of `currentPage` when called without an argument.
   */
  setCurrentPage(value?: number | string): void;

  /** Rotates the document 90° clockwise. Requires a loaded document. */
  rotateCw(): void;

  /** Rotates the document 90° counterclockwise. Requires a loaded document. */
  rotateCcw(): void;

  /** The one-based number of the page in view, as reported by the pdf.js viewer. */
  protected _getPage(): number;
}

declare interface PdfViewerElement {
  addEventListener<K extends keyof PdfViewerElementEventMap>(
    type: K,
    listener: (this: PdfViewerElement, ev: PdfViewerElementEventMap[K]) => void,
    options?: AddEventListenerOptions | boolean
  ): void;

  removeEventListener<K extends keyof PdfViewerElementEventMap>(
    type: K,
    listener: (this: PdfViewerElement, ev: PdfViewerElementEventMap[K]) => void,
    options?: EventListenerOptions | boolean
  ): void;
}

declare global {
  interface HTMLElementTagNameMap {
    'vcf-pdf-viewer': PdfViewerElement;
  }
}

export { PdfViewerElement };
