import { PolymerElement, html } from '@polymer/polymer/polymer-element';
import { ThemableMixin } from '@vaadin/vaadin-themable-mixin';
import { ElementMixin } from '@vaadin/component-base/src/element-mixin.js';
import '@vaadin/polymer-legacy-adapter/template-renderer.js';
import '@vaadin/text-field';
import '@vaadin/select';
import '@vaadin/item';
import '@vaadin/button';
import '@vaadin/icon';

import * as pdfjsLib from '../pdfjs/dist/pdf';
import * as pdfjsViewer from '../pdfjs/dist/pdf_viewer';
import * as pdfUtils from '../pdfjs/dist/ui_utils'
import * as pdfjsLinkService from '../pdfjs/dist/pdf_link_service';
import * as pdfjsThumbnailViewer from '../pdfjs/dist/pdf_thumbnail_viewer';
import * as pdfjsRenderingQueue from '../pdfjs/dist/pdf_rendering_queue';
import { NullL10n } from '../pdfjs/dist/l10n_utils';
import * as pdfjsWorker from '../pdfjs/dist/worker';
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
class PdfViewerElement extends
    ElementMixin(
        ThemableMixin(PolymerElement)) {

    static get template() {
        return html`
        <style>
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
            [part~="toolbar"] [part~="toolbar-zoom"],
            [part~="toolbar"] [part~="toolbar-button-toogle-sidebar"] {
                display: none;
            }

            [part~="toolbar"].ready #currentPage,
            [part~="toolbar"].ready #pageSeparator,
            [part~="toolbar"].ready #totalPages,
            [part~="toolbar"].ready #previousPage,
            [part~="toolbar"].ready #nextPage,
            [part~="toolbar"].ready [part~="toolbar-zoom"],
            [part~="toolbar"].ready [part~="toolbar-button-toogle-sidebar"] {
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

            #currentPage {
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
                box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.5), 0 2px 8px rgba(0, 0, 0, 0.3);
                opacity: 1.0;
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

            #sidebarToggle {
                margin-left: -10px;
                margin-right: 15px;
                border: 2px solid;
                border-color: rgba(0, 0, 0, 0.5);
                width: 40px;
            }

            #nextPage, #previousPage {
                width: 30px;
                margin: 0;
            }

            [part~="toolbar"].ready [part~="toolbar-zoom"].hide-zoom {
                display: none;
            }

        </style>

    <div id="outerContainer" part="outer-container" >
        <div id="sidebarContainer" part="sidebar-container">
            <div id="sidebarContent" part="sidebar-content">
                <div id="thumbnailView" part="thumbnail-view"></div>
            </div>            
        </div>   
        <div id="mainContainer" part="main-container">
            <div id="toolbar" part="toolbar">
                <vaadin-button id="sidebarToggle" part="toolbar-button toolbar-button-toogle-sidebar" theme="icon" on-click="__toogleSidebar" aria-label="Sidebar toggle">
                    <vaadin-icon part="toggle-button-icon" slot="prefix"></vaadin-icon>
                </vaadin-button>
                <span id="title" part="toolbar-text toolbar-title">{{__title}}</span>
                <vaadin-select id="zoom" part="toolbar-zoom" value="{{zoom}}" items="[[__zoomItems]]">
                </vaadin-select>
                <div part="toolbar-pages">
                    <vaadin-text-field id="currentPage" part="toolbar-current-page" value="{{currentPage}}" on-change="__pageChange"></vaadin-text-field>
                    <span id="pageSeparator" part="toolbar-text toolbar-page-separator">/</span>
                    <span id="totalPages" part="toolbar-text toolbar-total-pages">{{__totalPages}}</span>
                    <vaadin-button id="previousPage" part="toolbar-button toolbar-button-previous-page" theme="icon" on-click="__previousPage" aria-label="Previous page">
                        <vaadin-icon part="previous-page-button-icon" slot="prefix"></vaadin-icon>
                    </vaadin-button>
                    <vaadin-button id="nextPage" part="toolbar-button toolbar-button-next-page" theme="icon" on-click="__nextPage" aria-label="Next page">
                        <vaadin-icon part="next-page-button-icon" slot="prefix"></vaadin-icon>
                    </vaadin-button>
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
        return 'vcf-pdf-viewer';
    }

    static get version() {
        return '1.4.1';
    }

    static get properties() {
        return {
            /**
             * You can set a pdf file that you want to render with src. Note that regular cross
             * site scripting (XSS) rules apply. This means that the file should be on the same
             * server as where the component is run, or that the server where the file is on should
             * be configured to allow loading files from other sites.
             */
            src: {
                type: String,
                observer: '__srcChanged'
            },

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
            __title: {
                type: String,
                value: 'PDF'
            },
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
            zoom: {
                type: String,
                value: 'auto',
                observer: '__zoomChanged'
            },
            /**
             * The current page visible viewed right now
             */
            currentPage: {
                type: String,
                value: "1"
            },
            /**
             * Total amount of pages in an opened document
             */
            __totalPages: Number,

            /**
             *  Loading state
             */
            __loading: {
                type: Boolean,
                value: true
            },

            /**
             * Whether sidebar is open after loading or not
             */
             __sidebarOpen: {
                type: Boolean,
                value: false
            },

            /**
             * Flag to indicate if toolbar should only show filename as title
             */
            toolbarOnlyFilename: {
                type: Boolean,
                value: false
            },

            /**
             * Property to define auto zoom label
             */
             autoZoomOptionLabel: {
                type: String,
                value: "Automatic zoom"
            },

            /**
             * Property to define page fit zoom label
             */
            fitZoomOptionLabel: {
                type: String,
                value: "Page fit"
            },

            /**
             * Property to define a custom title for the viewer
             */
             customTitle: {
                type: String,
                value: ""
            },

            /**
             * Renders interactive form elements in the annotation layer (html) if true,
             * renders values of form elements directly onto the canvas if false
             */
            renderInteractiveForms: {
                type: Boolean,
                value: true
            },

            /**
             * Allows to hide the zoom dropdown. By default it's always shown.
             */
            hideZoom: {
                type: Boolean,
                value: false
            },
            __zoomItems: {
                computed: '__computeZoomItems(autoZoomOptionLabel, fitZoomOptionLabel)'
            }
        };
    }

    __computeZoomItems(autoZoomOptionLabel, fitZoomOptionLabel) {
        return [
            { label: autoZoomOptionLabel, value:'auto' },
            { label: fitZoomOptionLabel, value:'page-fit' },
            { label: '50%', value:'0.5' },
            { label: '75%', value:'0.75' },
            { label: '100%', value:'1.0' },
            { label: '125%', value:'1.25' },
            { label: '150%', value:'1.5' },
            { label: '200%', value:'2.0' },
            { label: '300%', value:'3.0' },
            { label: '400%', value:'4.0' }
        ]
    }

    static get observers() {
        return [
            '__setTitle(__pdfTitle, __filename)',
            '__updateZoomVisibility()'
        ];
    }

    __setTitle(pdfTitle, filename) {
        if(this.customTitle){
            this.__title = this.customTitle;
        } else if(this.__viewer && this.toolbarOnlyFilename && filename) {
            this.__title = filename;
        } else if (pdfTitle && filename) {
            this.__title = pdfTitle + ' - ' + filename;
        } else if (pdfTitle) {
            this.__title = pdfTitle;
        } else if (filename) {
            this.__title = filename;
        } else {
            this.__title = 'PDF';
        }
   }

   __updateZoomVisibility() {
        if(this.hideZoom) {
            this.$.zoom.classList.add('hide-zoom');
        } else {
            this.$.zoom.classList.remove('hide-zoom');
        }
    }

    ready() {
        super.ready();
        this.$.viewerContainer.addEventListener('focus', e => this.__setFocused(true), true);
        this.$.viewerContainer.addEventListener('blur', e => this.__setFocused(false), true);
        this.$.viewerContainer.addEventListener('mousedown', e => {
            this._mousedown = true;
            const mouseUpListener = () => {
                this._mousedown = false;
                document.removeEventListener('mouseup', mouseUpListener);
            };
            document.addEventListener('mouseup', mouseUpListener);
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
            container: this.$.viewerContainer,
            textLayerMode: 2,
            viewer: this.$.viewer,
            eventBus: eventBus,
            linkService: this.__linkService,
            renderingQueue: pdfRenderingQueue,
            l10n: l10n,
            renderInteractiveForms: this.renderInteractiveForms
        });

        this.__linkService.setViewer(this.__viewer);
        pdfRenderingQueue.setViewer(this.__viewer);

        // thumbnailViewer
        this.__thumbnailViewer = new pdfjsThumbnailViewer.PDFThumbnailViewer({
            container: this.$.thumbnailView,
            eventBus: eventBus,
            linkService: this.__linkService,
            renderingQueue: pdfRenderingQueue,
            l10n: l10n
        })

        pdfRenderingQueue.setThumbnailViewer(this.__thumbnailViewer);

        // listeners
        eventBus.on('pagesinit', () => {
            this.__viewer.currentScaleValue = this.zoom;
            this.__loading = false;
            this.__updateThumbnailViewer();
            if(this.__sidebarOpen){
                this.__openSidebar();
            } else {
                this.__closeSidebar();
            }
            this.__viewer.currentPage = this.setCurrentPage();
        });
        eventBus.on('pagechanging', (event) => {
            this.__updateCurrentPageValue(event.pageNumber);
            this.__updatePageNumberStates();
            if(this.__thumbnailViewer && this.__thumbnailViewer.renderingQueue.isThumbnailViewEnabled){
                this.__thumbnailViewer.scrollThumbnailIntoView(this.currentPage);
            }
        });

        this.__resizeObserver = new ResizeObserver(() => {
            requestAnimationFrame(() => this.__recalculateSizes());
        });

        this.__resizeObserver.observe(this);
    }

    connectedCallback() {
        super.connectedCallback();
        this.__recalculateSizes();
    }

    __updateCurrentPageValue(pageNumber){
        this.currentPage = "" + pageNumber;
        this.dispatchEvent(new CustomEvent('currentPage-changed'));
    }

    __recalculateSizes() {
        if (this.offsetWidth < 600) {
            this.classList.add('small-size');
            this.$.toolbar.classList.add('small-size');
        } else {
            this.classList.remove('small-size');
            this.$.toolbar.classList.remove('small-size');
        }
    }
    __setFocused(focused) {
        if (focused) {
            this.$.viewerContainer.setAttribute('focused', '');
            if (!this._mousedown) {
                this.$.viewerContainer.setAttribute('focus-ring', '');
            }
        } else {
            this.$.viewerContainer.removeAttribute('focused');
            this.$.viewerContainer.removeAttribute('focus-ring');
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
        return this.__document.promise.then((pdfDocument) => {
            // Document loaded, specifying document for the viewer.
            this.__thumbnailViewer.setDocument(pdfDocument);
            this.__viewer.setDocument(pdfDocument);
            this.__linkService.setDocument(pdfDocument);

            this.$.toolbar.classList.add('ready');
            this.__totalPages = pdfDocument.numPages;
            this.__updatePageNumberStates();
            this.__setPdfTitleFromMetadata(pdfDocument).then(() => {
                this.dispatchEvent(new CustomEvent('document-loaded', {
                    detail: {
                        document: pdfDocument
                    }
                }));
            });
        }, function (exception) {
            console.error(exception && exception.message);
        });
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
        this.$.toolbar.classList.remove('ready');
        this.__filename = 'PDF';
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
            if (metadata && metadata.has('dc:title')) {
                const title = metadata.get('dc:title');
                // Ghostscript sometimes returns 'Untitled', so prevent setting the
                // title to 'Untitled'.
                if (title !== 'Untitled') {
                    pdfTitle = title;
                }
            }

            const info = data.info;
            if (!pdfTitle && info && info['Title']) {
                pdfTitle = info['Title'];
            }
            this.__pdfTitle = pdfTitle;
        });
    }

    __updatePageNumberStates() {
        this.$.previousPage.disabled = (this.currentPage === "1");
        this.$.nextPage.disabled = (this.currentPage === "" + this.__totalPages);
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
    }

    __pageChange(event) {
        let pageNumber = parseInt(this.$.currentPage.value, 10);
        if (isNaN(pageNumber)) {
            pageNumber = this.__viewer.currentPageNumber;
            this.$.currentPage.value = "" + pageNumber;
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
            this.$.currentPage.value = "" + value;
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
        if (this.$.outerContainer.classList.length == 0) {
            this.__openSidebar();
        } else {
            this.__closeSidebar();
        }
    }

    __openSidebar() {
        if(!this.__thumbnailViewer ||this.__loading){
            this.__sidebarOpen = true;
        } else {
            this.__thumbnailViewer.renderingQueue.isThumbnailViewEnabled = true;
            this.__updateThumbnailViewer();
            this.$.outerContainer.classList.add('sidebarOpen');
        }
    }

    __closeSidebar() {
        if(!this.__thumbnailViewer || this.__loading){
            this.__sidebarOpen = false;
        } else {
            this.__thumbnailViewer.renderingQueue.isThumbnailViewEnabled = false;
            this.$.outerContainer.classList.remove('sidebarOpen');
        }
    }

    __updateThumbnailViewer() {
        const pagesCount = this.__totalPages;
        for (let i = 0; i < pagesCount; i++) {
            const pageView = this.__viewer.getPageView(i);
            if (pageView.renderingState === pdfjsRenderingQueue.RenderingStates.FINISHED) {
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
                component.dispatchEvent(new CustomEvent('thumbnail-clicked', {
                    detail: {
                        source: component,
                        pageNumber: id
                    }
                }));
                return false;
              };
        }
        if(this.__thumbnailViewer && this.__thumbnailViewer.renderingQueue.isThumbnailViewEnabled){
            this.__thumbnailViewer.scrollThumbnailIntoView(this.currentPage);
        }
    }
}

customElements.define(PdfViewerElement.is, PdfViewerElement);

/**
 * @namespace Vaadin
 */
window.Vaadin.PdfViewerElement = PdfViewerElement;



