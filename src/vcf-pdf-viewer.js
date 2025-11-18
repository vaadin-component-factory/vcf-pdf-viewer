import { LitElement, html, css } from "lit";
import { ElementMixin } from "@vaadin/component-base/src/element-mixin";
import { ThemeDetectionMixin } from "@vaadin/vaadin-themable-mixin/vaadin-theme-detection-mixin";
import { ResizeMixin, SlotStylesMixin } from "@vaadin/component-base/";
import { ThemableMixin } from "@vaadin/vaadin-themable-mixin";

import "@vaadin/text-field";
import "@vaadin/select";
import "@vaadin/item";
import "@vaadin/button";
import "@vaadin/icon";
import "@vaadin/icons";
import "@vaadin/tooltip";

import * as pdfjsLib from "../pdfjs/dist/pdf";
import * as pdfjsViewer from "../pdfjs/dist/pdf_viewer";
import * as pdfUtils from "../pdfjs/dist/ui_utils";
import * as pdfjsLinkService from "../pdfjs/dist/pdf_link_service";
import * as pdfjsThumbnailViewer from "../pdfjs/dist/pdf_thumbnail_viewer";
import * as pdfjsRenderingQueue from "../pdfjs/dist/pdf_rendering_queue";
import { NullL10n } from "../pdfjs/dist/l10n_utils";
import * as pdfjsWorker from "../pdfjs/dist/worker";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

/**
 * `<vcf-pdf-viewer>` is a Web Component for rendering PDF files without
 * the need of plugins. You can provide a pdf file to it through the src
 * attribute.
 *
 * ```
 * <vcf-pdf-viewer src="myfile.pdf"></vcf-pdf-viewer>
 * ```
 *
 * @memberof Vaadin
 * @mixes Vaadin.ElementMixin
 * @mixes Vaadin.ThemableMixin
 * @demo demo/index.html
 */
export class PdfViewerElement extends ResizeMixin(
  SlotStylesMixin(ThemeDetectionMixin(ThemableMixin(ElementMixin(LitElement)))),
) {
  static get styles() {
    return css`
      :host {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 500px;
      }

      :host([hidden]) {
        display: none !important;
      }

      [part~="toolbar"] #currentPage,
      [part~="toolbar"] #pageSeparator,
      [part~="toolbar"] #totalPages,
      [part~="toolbar"] #previousPage,
      [part~="toolbar"] #nextPage,
      [part~="toolbar"] #zoom,
      [part~="toolbar"] #sidebarToggle {
        display: none;
      }

      [part~="toolbar"].ready #currentPage,
      [part~="toolbar"].ready #pageSeparator,
      [part~="toolbar"].ready #totalPages,
      [part~="toolbar"].ready #previousPage,
      [part~="toolbar"].ready #nextPage,
      [part~="toolbar"].ready #zoom,
      [part~="toolbar"].ready #sidebarToggle {
        display: inherit;
      }

      [part~="outer-container"] {
        width: 100%;
        height: 100%;
      }

      [part~="main-container"] {
        position: absolute;
        top: 0;
        right: 0;
        bottom: 0;
        left: 0;
        min-width: 320px;
      }

      [part~="viewer-container"] {
        position: absolute;
        flex: 1;
        overflow: auto;
        width: 100%;
        height: -moz-calc(100% - 45px); /* Firefox */
        height: -webkit-calc(100% - 45px); /* Chrome, Safari */
        height: calc(100% - 45px); /*all other browsers */
      }

      [part~="sidebar-container"] {
        position: absolute;
        width: 200px;
        top: 45px;
        bottom: 0;
        visibility: hidden;
        height: -moz-calc(100% - 45px); /* Firefox */
        height: -webkit-calc(100% - 45px); /* Chrome, Safari */
        height: calc(100% - 45px); /*all other browsers */
        z-index: 100;
      }

      [part~="sidebar-content"] {
        position: absolute;
        top: 0;
        bottom: 0;
        overflow: auto;
        width: 100%;
        background-color: rgba(0, 0, 0, 0.1);
      }

      [part~="thumbnail-view"] {
        position: absolute;
        width: calc(100% - 60px);
        top: 0;
        bottom: 0;
        padding: 10px 30px 0;
        overflow: auto;
      }

      [part~="toolbar"] {
        height: 44px;
      }

      .page {
        position: relative;
        margin: 0 auto;
      }

      .textLayer {
        position: absolute;
        left: 0;
        top: 0;
        right: 0;
        bottom: 0;
        overflow: hidden;
        line-height: 1;
      }

      .textLayer > span {
        color: transparent;
        position: absolute;
        white-space: pre;
        cursor: text;
        -webkit-transform-origin: 0% 0%;
        transform-origin: 0% 0%;
      }

      .textLayer .highlight {
        margin: -1px;
        padding: 1px;
      }

      .textLayer .highlight.begin {
        border-radius: 4px 0 0 4px;
      }

      .textLayer .highlight.end {
        border-radius: 0 4px 4px 0;
      }

      .textLayer .highlight.middle {
        border-radius: 0;
      }

      .textLayer .endOfContent {
        display: block;
        position: absolute;
        left: 0;
        top: 100%;
        right: 0;
        bottom: 0;
        z-index: -1;
        cursor: default;
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        user-select: none;
      }

      .textLayer .endOfContent.active {
        top: 0;
      }

      #header {
        display: flex;
        flex-direction: row;
        align-items: baseline;
      }

      ::slotted(#currentPage) {
        align-self: baseline;
      }

      #outerContainer.sidebarOpen #viewerContainer {
        transition-property: left;
        left: 200px;
        width: -moz-calc(100% - 200px); /* Firefox */
        width: -webkit-calc(100% - 200px); /* Chrome, Safari */
        width: calc(100% - 200px); /*all other browsers */
      }

      #outerContainer.sidebarOpen #sidebarContainer {
        visibility: visible;
      }

      .thumbnail {
        margin: 0 10px 5px;
      }

      .thumbnailImage {
        border: 1px solid rgba(0, 0, 0, 0);
        box-shadow:
          0 0 0 1px rgba(0, 0, 0, 0.5),
          0 2px 8px rgba(0, 0, 0, 0.3);
        opacity: 1;
        z-index: 99;
        background-color: rgba(255, 255, 255, 1);
        background-clip: content-box;
      }

      .thumbnailSelectionRing {
        border-radius: 2px;
        padding: 7px;
      }

      .thumbnail.selected > .thumbnailSelectionRing {
        background-color: rgba(0, 0, 0, 0.15);
      }

      [part~="toolbar"].ready ::slotted(.toolbar-zoom.hide-zoom) {
        display: none;
      }
    `;
  }

  get slotStyles() {
    const tag = "vcf-pdf-viewer";
    const lumo = '[data-application-theme="lumo"]';

    /**
     * These rules target a <vaadin-text-field> element with a child element
     * having the 'toggle-button' class name. We can't use `::slotted()` as
     * the toggle button is not a direct child of the month picker element.
     * Also for `vaadin-popover` we can't use `::part()` after `::slotted()`.
     */
    return [
      `   
        ${tag}:not(${lumo}) vaadin-button.toolbar-button vaadin-icon {
          display: none;
        }
        
        ${tag}:not(${lumo}) vaadin-button.toolbar-button {
          flex: none;
          line-height: 1;
          text-align: center;
          background: var(--vaadin-input-field-button-text-color, var(--vaadin-text-color-secondary));
          cursor: var(--vaadin-clickable-cursor);
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
          -webkit-user-select: none;
          user-select: none;
          height: var(--vaadin-icon-size, 1.5lh);
          width: var(--vaadin-icon-size, 1.5lh);
          padding: 0;
          mask-size: var(--vaadin-icon-visual-size, 100%);
          mask-position: 50%;
          mask-repeat: no-repeat;
        }
        
        ${tag}:not(${lumo}) vaadin-button.toolbar-button#sidebarToggle {
          mask-image: var(--pdf-viewer-toggle-button-icon-closed);
        }
        
        ${tag}:not(${lumo}) vaadin-button.toolbar-button#sidebarToggle:has(vaadin-icon.sidebarOpen) {
          mask-image: var(--pdf-viewer-toggle-button-icon-open);
        }
        
        ${tag}:not(${lumo}) vaadin-button.toolbar-button#previousPage {
          mask-image: var(--pdf-viewer-previous-page-button-icon);
        }
        
        ${tag}:not(${lumo}) vaadin-button.toolbar-button#nextPage {
          mask-image: var(--pdf-viewer-next-page-button-icon);
        }
        
        ${tag}${lumo} vaadin-button[theme~="icon"] {
          padding-left: 6px;
          padding-right: 6px;
        }
        
        ${tag}${lumo} vaadin-button.toolbar-button#sidebarToggle {
          border: 2px solid;
          border-color: rgba(0, 0, 0, 0.5);
        }      
      `,
    ];
  }

  render() {
    return html`
      <div id="outerContainer" part="outer-container">
        <div id="sidebarContainer" part="sidebar-container">
          <div id="sidebarContent" part="sidebar-content">
            <div id="thumbnailView" part="thumbnail-view"></div>
          </div>
        </div>
        <div id="mainContainer" part="main-container">
          <div id="toolbar" part="toolbar">
            <slot name="sidebar-toggle-button-slot"></slot>
            <span id="title" part="toolbar-text toolbar-title"
              >${this.__title}</span
            >
            <slot name="toolbar-zoom-slot"></slot>
            <div part="toolbar-pages">
              <slot name="toolbar-current-page-slot"></slot>
              <span
                id="pageSeparator"
                part="toolbar-text toolbar-page-separator"
                >/</span
              >
              <span id="totalPages" part="toolbar-text toolbar-total-pages"
                >${this.__totalPages}</span
              >
              <slot name="previous-page-button-slot"></slot>
              <slot name="next-page-button-slot"></slot>
            </div>
            <slot></slot>
          </div>

          <div id="viewerContainer" part="viewer-container" tabindex="0">
            <div id="viewer" part="viewer"></div>
          </div>
        </div>
      </div>
    `;
  }

  static get is() {
    return "vcf-pdf-viewer";
  }

  static get version() {
    return "4.0.0";
  }

  static get properties() {
    return {
      /**
       * You can set a pdf file that you want to render with src. Note that regular cross
       * site scripting (XSS) rules apply. This means that the file should be on the same
       * server as where the component is run, or that the server where the file is on should
       * be configured to allow loading files from other sites.
       */
      src: { type: String },

      /**
       * The viewer, which takes care of rendering content into a DOM element.
       */
      __viewer: Object,

      /**
       * The viewer for thumbnails.
       */
      __thumbnailViewer: Object,

      /**
       * The link service.
       */
      __linkService: Object,

      /**
       * A represenentation of a document that has been read in.
       */
      __document: Object,
      /**
       * The title for the PDF shown in the toolbar of component. It uses both the file name and
       * the title in the PDF metadata if available.
       */
      __title: { type: String },
      /**
       * Relative filename
       */
      __filename: String,
      /**
       * The pdf metadata title
       */
      __pdfTitle: String,
      /**
       * The level of zoom on the document.
       * Allowed values are
       *  - Number, for zoom percentage. Eg. 1.5 means 150% zoom
       *  - 'auto', default value
       *  - 'page-fit', fit a full page into component
       */
      zoom: { type: String },
      /**
       * The current page visible viewed right now
       */
      currentPage: { type: String },
      /**
       * Total amount of pages in an opened document
       */
      __totalPages: Number,

      /**
       *  Loading state
       */
      __loading: { type: Boolean },

      /**
       * Whether sidebar is open after loading or not
       */
      __sidebarOpen: { type: Boolean },

      /**
       * Flag to indicate if toolbar should only show filename as title
       */
      toolbarOnlyFilename: { type: Boolean },

      /**
       * Property to define auto zoom label
       */
      autoZoomOptionLabel: { type: String },

      /**
       * Property to define page fit zoom label
       */
      fitZoomOptionLabel: { type: String },

      /**
       * Property to define a custom title for the viewer
       */
      customTitle: { type: String },

      /**
       * Renders interactive form elements in the annotation layer (html) if true,
       * renders values of form elements directly onto the canvas if false
       */
      renderInteractiveForms: { type: Boolean },

      /**
       * Allows to hide the zoom dropdown. By default it's always shown.
       */
      hideZoom: { type: Boolean },

      /**
       * Property to define a custom tooltip for the sidebar toggle button
       */
      sidebarToggleTooltip: { type: String },

      /**
       * Property to define a custom tooltip for the previous page button
       */
      previousPageTooltip: { type: String },

      /**
       * Property to define a custom tooltip for the next page button
       */
      nextPageTooltip: { type: String },
    };
  }

  get __zoomItems() {
    return this.__computeZoomItems(
      this.autoZoomOptionLabel,
      this.fitZoomOptionLabel,
    );
  }

  constructor() {
    super();
    this.__title = "PDF";
    this.zoom = "auto";
    this.currentPage = "1";
    this.__loading = true;
    this.__sidebarOpen = false;
    this.toolbarOnlyFilename = false;
    this.autoZoomOptionLabel = "Automatic zoom";
    this.fitZoomOptionLabel = "Page fit";
    this.customTitle = "";
    this.renderInteractiveForms = true;
    this.hideZoom = false;
    this.sidebarToggleTooltip = "";
    this.previousPageTooltip = "";
    this.nextPageTooltip = "";
  }

  updated(changedProperties) {
    super.updated(changedProperties);
    if (changedProperties.has("src")) {
      this.__srcChanged(this.src);
    }
    if (
      changedProperties.has("__pdfTitle") ||
      changedProperties.has("__filename")
    ) {
      this.__setTitle(this.__pdfTitle, this.__filename);
    }
  }

  __createToolbarButton() {
    const icon = document.createElement("vaadin-icon");
    icon.setAttribute("slot", "prefix");

    const tooltip = document.createElement("vaadin-tooltip");
    tooltip.setAttribute("slot", "tooltip");

    const button = document.createElement("vaadin-button");
    button.classList.add("toolbar-button");
    button.setAttribute("theme", "icon tertiary contrast");

    button.appendChild(icon);
    button.appendChild(tooltip);
    return button;
  }

  /**
   * Adds toggle button to the toolbar slot named "sidebar-toggle-button-slot".
   */
  _createSideBarToggleButton() {
    const button = this.__createToolbarButton();
    const icon = button.querySelector("vaadin-icon");
    icon.classList.add("toggle-button-icon");
    button
      .querySelector("vaadin-tooltip")
      .setAttribute("text", this.sidebarToggleTooltip);
    button.setAttribute("slot", "sidebar-toggle-button-slot");
    button.setAttribute("id", "sidebarToggle");
    button.setAttribute("aria-label", "Sidebar toggle");
    button.addEventListener("click", () => {
      this.__toogleSidebar();
      if (this._outerContainer.classList.contains("sidebarOpen")) {
        icon.classList.add("sidebarOpen");
      } else {
        icon.classList.remove("sidebarOpen");
      }
    });
    this.appendChild(button);
  }

  /**
   * Adds previous page button to the toolbar slot named "previous-page-button-slot".
   */
  _createPreviousPageButton() {
    const button = this.__createToolbarButton();
    button
      .querySelector("vaadin-icon")
      .classList.add("previous-page-button-icon");
    button
      .querySelector("vaadin-tooltip")
      .setAttribute("text", this.previousPageTooltip);
    button.setAttribute("slot", "previous-page-button-slot");
    button.setAttribute("id", "previousPage");
    button.setAttribute("aria-label", "Previous page");
    button.addEventListener("click", () => this.__previousPage());
    this.appendChild(button);
  }

  /**
   * Adds next page button to the toolbar slot named "next-page-button-slot".
   */
  _createNextPageButton() {
    const button = this.__createToolbarButton();
    button.querySelector("vaadin-icon").classList.add("next-page-button-icon");
    button
      .querySelector("vaadin-tooltip")
      .setAttribute("text", this.nextPageTooltip);
    button.setAttribute("slot", "next-page-button-slot");
    button.setAttribute("id", "nextPage");
    button.setAttribute("aria-label", "Next page");
    button.addEventListener("click", () => this.__nextPage());
    this.appendChild(button);
  }

  /**
   * Adds current page text field to the toolbar slot named "toolbar-current-page-slot".
   */
  _createCurrentPageTextField() {
    const textField = document.createElement("vaadin-text-field");
    textField.setAttribute("slot", "toolbar-current-page-slot");
    textField.setAttribute("id", "currentPage");
    textField.classList.add("toolbar-current-page");
    textField.setAttribute("value", this.currentPage);
    textField.addEventListener("change", () => this.__pageChange());
    this.appendChild(textField);
  }

  /**
   * Adds zoom select to the toolbar slot named "toolbar-zoom-slot".
   */
  _createZoomSelect() {
    const select = document.createElement("vaadin-select");
    select.setAttribute("slot", "toolbar-zoom-slot");
    select.setAttribute("id", "zoom");
    select.classList.add("toolbar-zoom");
    select.setAttribute("value", this.zoom);
    select.items = this.__zoomItems;
    select.addEventListener("value-changed", (e) =>
      this.__zoomChanged(e.detail.value),
    );
    if (this.hideZoom) {
      select.classList.add("hide-zoom");
    } else {
      select.classList.remove("hide-zoom");
    }
    this.appendChild(select);
  }

  __computeZoomItems(autoZoomOptionLabel, fitZoomOptionLabel) {
    return [
      { label: autoZoomOptionLabel, value: "auto" },
      { label: fitZoomOptionLabel, value: "page-fit" },
      { label: "50%", value: "0.5" },
      { label: "75%", value: "0.75" },
      { label: "100%", value: "1.0" },
      { label: "125%", value: "1.25" },
      { label: "150%", value: "1.5" },
      { label: "200%", value: "2.0" },
      { label: "300%", value: "3.0" },
      { label: "400%", value: "4.0" },
    ];
  }

  __setTitle(pdfTitle, filename) {
    if (this.customTitle) {
      this.__title = this.customTitle;
    } else if (this.__viewer && this.toolbarOnlyFilename && filename) {
      this.__title = filename;
    } else if (pdfTitle && filename) {
      this.__title = pdfTitle + " - " + filename;
    } else if (pdfTitle) {
      this.__title = pdfTitle;
    } else if (filename) {
      this.__title = filename;
    } else {
      this.__title = "PDF";
    }
  }

  _addToolbarButtons() {
    this._createSideBarToggleButton();
    this._createZoomSelect();
    this._createCurrentPageTextField();
    this._createPreviousPageButton();
    this._createNextPageButton();
  }

  firstUpdated() {
    this._toolbar = this.shadowRoot.querySelector("#toolbar");
    this._viewerContainer = this.shadowRoot.querySelector("#viewerContainer");
    this._outerContainer = this.shadowRoot.querySelector("#outerContainer");
    this._viewer = this.shadowRoot.querySelector("#viewer");
    this._thumbnailView = this.shadowRoot.querySelector("#thumbnailView");

    this._addToolbarButtons();

    this._viewerContainer.addEventListener(
      "focus",
      (e) => this.__setFocused(true),
      true,
    );
    this._viewerContainer.addEventListener(
      "blur",
      (e) => this.__setFocused(false),
      true,
    );
    this._viewerContainer.addEventListener("mousedown", (e) => {
      this._mousedown = true;
      const mouseUpListener = () => {
        this._mousedown = false;
        document.removeEventListener("mouseup", mouseUpListener);
      };
      document.addEventListener("mouseup", mouseUpListener);
    });

    // options
    const eventBus = new pdfUtils.EventBus();
    this.__linkService = new pdfjsLinkService.PDFLinkService({
      eventBus,
    });
    var pdfRenderingQueue = new pdfjsRenderingQueue.PDFRenderingQueue();
    var l10n = NullL10n;

    // pdfViewer
    this.__viewer = new pdfjsViewer.PDFViewer({
      container: this._viewerContainer,
      textLayerMode: 2,
      viewer: this._viewer,
      eventBus: eventBus,
      linkService: this.__linkService,
      renderingQueue: pdfRenderingQueue,
      l10n: l10n,
      renderInteractiveForms: this.renderInteractiveForms,
    });

    this.__linkService.setViewer(this.__viewer);
    pdfRenderingQueue.setViewer(this.__viewer);

    // thumbnailViewer
    this.__thumbnailViewer = new pdfjsThumbnailViewer.PDFThumbnailViewer({
      container: this._thumbnailView,
      eventBus: eventBus,
      linkService: this.__linkService,
      renderingQueue: pdfRenderingQueue,
      l10n: l10n,
    });

    pdfRenderingQueue.setThumbnailViewer(this.__thumbnailViewer);

    // listeners
    eventBus.on("pagesinit", () => {
      this.__viewer.currentScaleValue = this.zoom;
      this.__loading = false;
      this.__updateThumbnailViewer();
      if (this.__sidebarOpen) {
        this.__openSidebar();
      } else {
        this.__closeSidebar();
      }
      this.__viewer.currentPage = this.setCurrentPage();
    });
    eventBus.on("pagechanging", (event) => {
      this.__updateCurrentPageValue(event.pageNumber);
      this.__updatePageNumberStates();
      if (
        this.__thumbnailViewer &&
        this.__thumbnailViewer.renderingQueue.isThumbnailViewEnabled
      ) {
        this.__thumbnailViewer.scrollThumbnailIntoView(this.currentPage);
      }
      this.querySelector("#currentPage").value = this.currentPage;
    });
  }

  __updateCurrentPageValue(pageNumber) {
    this.currentPage = "" + pageNumber;
    this.dispatchEvent(new CustomEvent("currentPage-changed"));
  }

  __setFocused(focused) {
    if (focused) {
      this._viewerContainer.setAttribute("focused", "");
      if (!this._mousedown) {
        this._viewerContainer.setAttribute("focus-ring", "");
      }
    } else {
      this._viewerContainer.removeAttribute("focused");
      this._viewerContainer.removeAttribute("focus-ring");
    }
  }

  __open(src) {
    // Is there already a document loaded?
    if (this.__document) {
      // We need to close the current document
      return this.__close().then(() => {
        // and start over with opening the new one
        return this.__open(src);
      });
    }
    if (!src) {
      // No file given, show nothing.
      return;
    }
    this.__setFilename(src);
    this.__document = pdfjsLib.getDocument(new URL(src, document.baseURI).href);
    return this.__document.promise.then(
      (pdfDocument) => {
        // Document loaded, specifying document for the viewer.
        this.__thumbnailViewer.setDocument(pdfDocument);
        this.__viewer.setDocument(pdfDocument);
        this.__linkService.setDocument(pdfDocument);

        this._toolbar.classList.add("ready");
        this.__totalPages = pdfDocument.numPages;
        this.__updatePageNumberStates();
        this.__setPdfTitleFromMetadata(pdfDocument).then(() => {
          this.dispatchEvent(
            new CustomEvent("document-loaded", {
              detail: {
                document: pdfDocument,
              },
            }),
          );
        });
      },
      function (exception) {
        console.error(exception && exception.message);
      },
    );
  }

  __srcChanged(newSrc) {
    this.__open(newSrc);
  }

  /**
   * Closes opened PDF document.
   * @returns {Promise} - Returns the promise, which is resolved when all
   *                      destruction is completed.
   */
  __close() {
    this._toolbar.classList.remove("ready");
    this.__filename = "PDF";
    if (!this.__document) {
      return Promise.resolve();
    }

    var promise = this.__document.destroy();
    if (this.__document) {
      this.__document = null;
      this.__viewer.setDocument(null);
      this.__thumbnailViewer.setDocument(null);
      this.__linkService.setDocument(null);
    }
    return promise;
  }

  __setFilename(src) {
    let filename = pdfjsLib.getFilenameFromUrl(src) || src;
    try {
      filename = decodeURIComponent(filename);
    } catch (e) {
      // decodeURIComponent may throw URIError,
      // fall back to using the unprocessed url in that case
    }
    this.__filename = filename;
  }

  __setPdfTitleFromMetadata(pdfDocument) {
    return pdfDocument.getMetadata().then((data) => {
      let pdfTitle;
      const metadata = data.metadata;
      if (metadata && metadata.has("dc:title")) {
        const title = metadata.get("dc:title");
        // Ghostscript sometimes returns 'Untitled', so prevent setting the
        // title to 'Untitled'.
        if (title !== "Untitled") {
          pdfTitle = title;
        }
      }

      const info = data.info;
      if (!pdfTitle && info && info["Title"]) {
        pdfTitle = info["Title"];
      }
      this.__pdfTitle = pdfTitle;
    });
  }

  __updatePageNumberStates() {
    this.querySelector("#previousPage").disabled = this.currentPage === "1";
    this.querySelector("#nextPage").disabled =
      this.currentPage === "" + this.__totalPages;
  }

  __zoomChanged(value) {
    if (!this.__viewer || this.__loading) {
      return;
    }
    // This logs error 'TextLayerBuilder._bindEvents: `this.cancel()` should have
    // been called when the page was reset, or rendering cancelled.'
    //
    // There is a problem deep inside pdfjs viewer that causes an console.error()
    // to be logged, but the component still works. It seems to be due to
    // webcomponents/shadow dom messing with
    // TODO: Fix the issue so that we get rid of the error in log
    this.__viewer.currentScaleValue = value;
    this.__viewer.forceRendering();
  }

  __pageChange(event) {
    const currentPageValue = this.querySelector("#currentPage").value;
    let pageNumber = parseInt(currentPageValue, 10);
    if (isNaN(pageNumber)) {
      pageNumber = this.__viewer.currentPageNumber;
      this.querySelector("#currentPage").value = "" + pageNumber;
    }
    if (pageNumber < 1) {
      pageNumber = 1;
    }
    if (pageNumber > this.__totalPages) {
      pageNumber = this.__totalPages;
    }
    this.__viewer.currentPageNumber = pageNumber;
  }

  setCurrentPage(value) {
    if (value != undefined) {
      this.querySelector("#currentPage").value = "" + value;
    }
    this.__pageChange();
  }

  _getPage() {
    return this.__viewer.currentPageNumber;
  }

  __previousPage() {
    this.__viewer.currentPageNumber--;
  }

  __nextPage() {
    this.__viewer.currentPageNumber++;
  }

  __toogleSidebar() {
    if (this._outerContainer.classList.length == 0) {
      this.__openSidebar();
    } else {
      this.__closeSidebar();
    }
  }

  __openSidebar() {
    if (!this.__thumbnailViewer || this.__loading) {
      this.__sidebarOpen = true;
    } else {
      this.__thumbnailViewer.renderingQueue.isThumbnailViewEnabled = true;
      this.__updateThumbnailViewer();
      this._outerContainer.classList.add("sidebarOpen");
    }
  }

  __closeSidebar() {
    if (!this.__thumbnailViewer || this.__loading) {
      this.__sidebarOpen = false;
    } else {
      this.__thumbnailViewer.renderingQueue.isThumbnailViewEnabled = false;
      this._outerContainer.classList.remove("sidebarOpen");
    }
  }

  __updateThumbnailViewer() {
    const pagesCount = this.__totalPages;
    for (let i = 0; i < pagesCount; i++) {
      const pageView = this.__viewer.getPageView(i);
      if (
        pageView.renderingState === pdfjsRenderingQueue.RenderingStates.FINISHED
      ) {
        const thumbnailView = this.__thumbnailViewer.getThumbnail(i);
        thumbnailView.setImage(pageView);
      } else {
        this.__thumbnailViewer.renderingQueue.renderHighestPriority();
      }
    }
    var component = this;
    for (let i = 0; i < this.__thumbnailViewer._thumbnails.length; i++) {
      const thumbnailView = this.__thumbnailViewer.getThumbnail(i);
      thumbnailView.anchor.onclick = function () {
        const id = thumbnailView.id;
        thumbnailView.linkService.goToPage(id);
        component.dispatchEvent(
          new CustomEvent("thumbnail-clicked", {
            detail: {
              source: component,
              pageNumber: id,
            },
          }),
        );
        return false;
      };
    }
    if (
      this.__thumbnailViewer &&
      this.__thumbnailViewer.renderingQueue.isThumbnailViewEnabled
    ) {
      this.__thumbnailViewer.scrollThumbnailIntoView(this.currentPage);
    }
  }

  _onResize() {
    if (this.offsetWidth < 600) {
      this.classList.add("small-size");
      this._toolbar.classList.add("small-size");
    } else {
      this.classList.remove("small-size");
      this._toolbar.classList.remove("small-size");
    }
  }

  /**
   * Rotates document clockwise.
   */
  rotateCw() {
    let delta = 90;
    this.__viewer.pagesRotation += delta;
    this.__viewer.forceRendering();
  }

  /**
   * Rotates document counterclockwise.
   */
  rotateCcw() {
    let delta = -90;
    this.__viewer.pagesRotation += delta;
    this.__viewer.forceRendering();
  }
}

customElements.define(PdfViewerElement.is, PdfViewerElement);

/**
 * @namespace Vaadin
 */
window.Vaadin.PdfViewerElement = PdfViewerElement;
