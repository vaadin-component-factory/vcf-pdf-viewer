import { getOutputScale, watchScroll, getVisibleElements, scrollIntoView, isValidRotation } from './ui_utils.js';
import './pdf.js';
import { RenderingStates } from './pdf_rendering_queue.js';
import { R as RenderingCancelledException } from './display_utils.js';
import './util.js';
import './message_handler.js';

/* Copyright 2012 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const DRAW_UPSCALE_FACTOR = 2; // See comment in `PDFThumbnailView.draw` below.

const MAX_NUM_SCALING_STEPS = 3;
const THUMBNAIL_CANVAS_BORDER_WIDTH = 1; // px

const THUMBNAIL_WIDTH = 98; // px

/**
 * @typedef {Object} PDFThumbnailViewOptions
 * @property {HTMLDivElement} container - The viewer element.
 * @property {number} id - The thumbnail's unique ID (normally its number).
 * @property {PageViewport} defaultViewport - The page viewport.
 * @property {Promise<OptionalContentConfig>} [optionalContentConfigPromise] -
 *   A promise that is resolved with an {@link OptionalContentConfig} instance.
 *   The default value is `null`.
 * @property {IPDFLinkService} linkService - The navigation/linking service.
 * @property {PDFRenderingQueue} renderingQueue - The rendering queue object.
 * @property {function} checkSetImageDisabled
 * @property {IL10n} l10n - Localization service.
 */

const TempImageFactory = function TempImageFactoryClosure() {
  let tempCanvasCache = null;
  return {
    getCanvas(width, height) {
      let tempCanvas = tempCanvasCache;

      if (!tempCanvas) {
        tempCanvas = document.createElement("canvas");
        tempCanvasCache = tempCanvas;
      }

      tempCanvas.width = width;
      tempCanvas.height = height; // Since this is a temporary canvas, we need to fill it with a white
      // background ourselves. `_getPageDrawContext` uses CSS rules for this.

      if (typeof PDFJSDev === "undefined" || PDFJSDev.test("MOZCENTRAL || GENERIC")) {
        tempCanvas.mozOpaque = true;
      }

      const ctx = tempCanvas.getContext("2d", {
        alpha: false
      });
      ctx.save();
      ctx.fillStyle = "rgb(255, 255, 255)";
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
      return [tempCanvas, tempCanvas.getContext("2d")];
    },

    destroyCanvas() {
      const tempCanvas = tempCanvasCache;

      if (tempCanvas) {
        // Zeroing the width and height causes Firefox to release graphics
        // resources immediately, which can greatly reduce memory consumption.
        tempCanvas.width = 0;
        tempCanvas.height = 0;
      }

      tempCanvasCache = null;
    }

  };
}();
/**
 * @implements {IRenderableView}
 */


class PDFThumbnailView {
  /**
   * @param {PDFThumbnailViewOptions} options
   */
  constructor({
    container,
    id,
    defaultViewport,
    optionalContentConfigPromise,
    linkService,
    renderingQueue,
    checkSetImageDisabled,
    l10n
  }) {
    this.id = id;
    this.renderingId = "thumbnail" + id;
    this.pageLabel = null;
    this.pdfPage = null;
    this.rotation = 0;
    this.viewport = defaultViewport;
    this.pdfPageRotate = defaultViewport.rotation;
    this._optionalContentConfigPromise = optionalContentConfigPromise || null;
    this.linkService = linkService;
    this.renderingQueue = renderingQueue;
    this.renderTask = null;
    this.renderingState = RenderingStates.INITIAL;
    this.resume = null;

    this._checkSetImageDisabled = checkSetImageDisabled || function () {
      return false;
    };

    const pageWidth = this.viewport.width,
          pageHeight = this.viewport.height,
          pageRatio = pageWidth / pageHeight;
    this.canvasWidth = THUMBNAIL_WIDTH;
    this.canvasHeight = this.canvasWidth / pageRatio | 0;
    this.scale = this.canvasWidth / pageWidth;
    this.l10n = l10n;
    const anchor = document.createElement("a");
    anchor.href = linkService.getAnchorUrl("#page=" + id);

    this._thumbPageTitle.then(msg => {
      anchor.title = msg;
    });

    anchor.onclick = function () {
      linkService.goToPage(id);
      return false;
    };

    this.anchor = anchor;
    const div = document.createElement("div");
    div.className = "thumbnail";
    div.setAttribute("data-page-number", this.id);
    this.div = div;
    const ring = document.createElement("div");
    ring.className = "thumbnailSelectionRing";
    const borderAdjustment = 2 * THUMBNAIL_CANVAS_BORDER_WIDTH;
    ring.style.width = this.canvasWidth + borderAdjustment + "px";
    ring.style.height = this.canvasHeight + borderAdjustment + "px";
    this.ring = ring;
    div.appendChild(ring);
    anchor.appendChild(div);
    container.appendChild(anchor);
  }

  setPdfPage(pdfPage) {
    this.pdfPage = pdfPage;
    this.pdfPageRotate = pdfPage.rotate;
    const totalRotation = (this.rotation + this.pdfPageRotate) % 360;
    this.viewport = pdfPage.getViewport({
      scale: 1,
      rotation: totalRotation
    });
    this.reset();
  }

  reset() {
    this.cancelRendering();
    this.renderingState = RenderingStates.INITIAL;
    const pageWidth = this.viewport.width,
          pageHeight = this.viewport.height,
          pageRatio = pageWidth / pageHeight;
    this.canvasHeight = this.canvasWidth / pageRatio | 0;
    this.scale = this.canvasWidth / pageWidth;
    this.div.removeAttribute("data-loaded");
    const ring = this.ring;
    ring.textContent = ""; // Remove the thumbnail from the DOM.

    const borderAdjustment = 2 * THUMBNAIL_CANVAS_BORDER_WIDTH;
    ring.style.width = this.canvasWidth + borderAdjustment + "px";
    ring.style.height = this.canvasHeight + borderAdjustment + "px";

    if (this.canvas) {
      // Zeroing the width and height causes Firefox to release graphics
      // resources immediately, which can greatly reduce memory consumption.
      this.canvas.width = 0;
      this.canvas.height = 0;
      delete this.canvas;
    }

    if (this.image) {
      this.image.removeAttribute("src");
      delete this.image;
    }
  }

  update(rotation) {
    if (typeof rotation !== "undefined") {
      this.rotation = rotation;
    }

    const totalRotation = (this.rotation + this.pdfPageRotate) % 360;
    this.viewport = this.viewport.clone({
      scale: 1,
      rotation: totalRotation
    });
    this.reset();
  }
  /**
   * PLEASE NOTE: Most likely you want to use the `this.reset()` method,
   *              rather than calling this one directly.
   */


  cancelRendering() {
    if (this.renderTask) {
      this.renderTask.cancel();
      this.renderTask = null;
    }

    this.resume = null;
  }
  /**
   * @private
   */


  _getPageDrawContext(upscaleFactor = 1) {
    // Keep the no-thumbnail outline visible, i.e. `data-loaded === false`,
    // until rendering/image conversion is complete, to avoid display issues.
    const canvas = document.createElement("canvas");

    if (typeof PDFJSDev === "undefined" || PDFJSDev.test("MOZCENTRAL || GENERIC")) {
      canvas.mozOpaque = true;
    }

    const ctx = canvas.getContext("2d", {
      alpha: false
    });
    const outputScale = getOutputScale(ctx);
    canvas.width = upscaleFactor * this.canvasWidth * outputScale.sx | 0;
    canvas.height = upscaleFactor * this.canvasHeight * outputScale.sy | 0;
    const transform = outputScale.scaled ? [outputScale.sx, 0, 0, outputScale.sy, 0, 0] : null;
    return {
      ctx,
      canvas,
      transform
    };
  }
  /**
   * @private
   */


  _convertCanvasToImage(canvas) {
    if (this.renderingState !== RenderingStates.FINISHED) {
      throw new Error("_convertCanvasToImage: Rendering has not finished.");
    }

    const reducedCanvas = this._reduceImage(canvas);

    const image = document.createElement("img");
    image.className = "thumbnailImage";

    this._thumbPageCanvas.then(msg => {
      image.setAttribute("aria-label", msg);
    });

    image.style.width = this.canvasWidth + "px";
    image.style.height = this.canvasHeight + "px";
    image.src = reducedCanvas.toDataURL();
    this.image = image;
    this.div.setAttribute("data-loaded", true);
    this.ring.appendChild(image); // Zeroing the width and height causes Firefox to release graphics
    // resources immediately, which can greatly reduce memory consumption.

    reducedCanvas.width = 0;
    reducedCanvas.height = 0;
  }

  draw() {
    if (this.renderingState !== RenderingStates.INITIAL) {
      console.error("Must be in new state before drawing");
      return Promise.resolve(undefined);
    }

    const {
      pdfPage
    } = this;

    if (!pdfPage) {
      this.renderingState = RenderingStates.FINISHED;
      return Promise.reject(new Error("pdfPage is not loaded"));
    }

    this.renderingState = RenderingStates.RUNNING;

    const finishRenderTask = async (error = null) => {
      // The renderTask may have been replaced by a new one, so only remove
      // the reference to the renderTask if it matches the one that is
      // triggering this callback.
      if (renderTask === this.renderTask) {
        this.renderTask = null;
      }

      if (error instanceof RenderingCancelledException) {
        return;
      }

      this.renderingState = RenderingStates.FINISHED;

      this._convertCanvasToImage(canvas);

      if (error) {
        throw error;
      }
    }; // Render the thumbnail at a larger size and downsize the canvas (similar
    // to `setImage`), to improve consistency between thumbnails created by
    // the `draw` and `setImage` methods (fixes issue 8233).
    // NOTE: To primarily avoid increasing memory usage too much, but also to
    //   reduce downsizing overhead, we purposely limit the up-scaling factor.


    const {
      ctx,
      canvas,
      transform
    } = this._getPageDrawContext(DRAW_UPSCALE_FACTOR);

    const drawViewport = this.viewport.clone({
      scale: DRAW_UPSCALE_FACTOR * this.scale
    });

    const renderContinueCallback = cont => {
      if (!this.renderingQueue.isHighestPriority(this)) {
        this.renderingState = RenderingStates.PAUSED;

        this.resume = () => {
          this.renderingState = RenderingStates.RUNNING;
          cont();
        };

        return;
      }

      cont();
    };

    const renderContext = {
      canvasContext: ctx,
      transform,
      viewport: drawViewport,
      optionalContentConfigPromise: this._optionalContentConfigPromise
    };
    const renderTask = this.renderTask = pdfPage.render(renderContext);
    renderTask.onContinue = renderContinueCallback;
    const resultPromise = renderTask.promise.then(function () {
      return finishRenderTask(null);
    }, function (error) {
      return finishRenderTask(error);
    });
    resultPromise.finally(() => {
      // Zeroing the width and height causes Firefox to release graphics
      // resources immediately, which can greatly reduce memory consumption.
      canvas.width = 0;
      canvas.height = 0; // Only trigger cleanup, once rendering has finished, when the current
      // pageView is *not* cached on the `BaseViewer`-instance.

      const pageCached = this.linkService.isPageCached(this.id);

      if (!pageCached) {
        var _this$pdfPage;

        (_this$pdfPage = this.pdfPage) === null || _this$pdfPage === void 0 ? void 0 : _this$pdfPage.cleanup();
      }
    });
    return resultPromise;
  }

  setImage(pageView) {
    if (this._checkSetImageDisabled()) {
      return;
    }

    if (this.renderingState !== RenderingStates.INITIAL) {
      return;
    }

    const {
      canvas,
      pdfPage
    } = pageView;

    if (!canvas) {
      return;
    }

    if (!this.pdfPage) {
      this.setPdfPage(pdfPage);
    }

    this.renderingState = RenderingStates.FINISHED;

    this._convertCanvasToImage(canvas);
  }
  /**
   * @private
   */


  _reduceImage(img) {
    const {
      ctx,
      canvas
    } = this._getPageDrawContext();

    if (img.width <= 2 * canvas.width) {
      ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, canvas.width, canvas.height);
      return canvas;
    } // drawImage does an awful job of rescaling the image, doing it gradually.


    let reducedWidth = canvas.width << MAX_NUM_SCALING_STEPS;
    let reducedHeight = canvas.height << MAX_NUM_SCALING_STEPS;
    const [reducedImage, reducedImageCtx] = TempImageFactory.getCanvas(reducedWidth, reducedHeight);

    while (reducedWidth > img.width || reducedHeight > img.height) {
      reducedWidth >>= 1;
      reducedHeight >>= 1;
    }

    reducedImageCtx.drawImage(img, 0, 0, img.width, img.height, 0, 0, reducedWidth, reducedHeight);

    while (reducedWidth > 2 * canvas.width) {
      reducedImageCtx.drawImage(reducedImage, 0, 0, reducedWidth, reducedHeight, 0, 0, reducedWidth >> 1, reducedHeight >> 1);
      reducedWidth >>= 1;
      reducedHeight >>= 1;
    }

    ctx.drawImage(reducedImage, 0, 0, reducedWidth, reducedHeight, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  get _thumbPageTitle() {
    var _this$pageLabel;

    return this.l10n.get("thumb_page_title", {
      page: (_this$pageLabel = this.pageLabel) !== null && _this$pageLabel !== void 0 ? _this$pageLabel : this.id
    });
  }

  get _thumbPageCanvas() {
    var _this$pageLabel2;

    return this.l10n.get("thumb_page_canvas", {
      page: (_this$pageLabel2 = this.pageLabel) !== null && _this$pageLabel2 !== void 0 ? _this$pageLabel2 : this.id
    });
  }
  /**
   * @param {string|null} label
   */


  setPageLabel(label) {
    this.pageLabel = typeof label === "string" ? label : null;

    this._thumbPageTitle.then(msg => {
      this.anchor.title = msg;
    });

    if (this.renderingState !== RenderingStates.FINISHED) {
      return;
    }

    this._thumbPageCanvas.then(msg => {
      var _this$image;

      (_this$image = this.image) === null || _this$image === void 0 ? void 0 : _this$image.setAttribute("aria-label", msg);
    });
  }

}

/* Copyright 2012 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const THUMBNAIL_SCROLL_MARGIN = -19;
const THUMBNAIL_SELECTED_CLASS = "selected";
/**
 * @typedef {Object} PDFThumbnailViewerOptions
 * @property {HTMLDivElement} container - The container for the thumbnail
 *   elements.
 * @property {EventBus} eventBus - The application event bus.
 * @property {IPDFLinkService} linkService - The navigation/linking service.
 * @property {PDFRenderingQueue} renderingQueue - The rendering queue object.
 * @property {IL10n} l10n - Localization service.
 */

/**
 * Viewer control to display thumbnails for pages in a PDF document.
 *
 * @implements {IRenderableView}
 */

class PDFThumbnailViewer {
  /**
   * @param {PDFThumbnailViewerOptions} options
   */
  constructor({
    container,
    eventBus,
    linkService,
    renderingQueue,
    l10n
  }) {
    this.container = container;
    this.linkService = linkService;
    this.renderingQueue = renderingQueue;
    this.l10n = l10n;
    this.scroll = watchScroll(this.container, this._scrollUpdated.bind(this));

    this._resetView();

    eventBus._on("optionalcontentconfigchanged", () => {
      // Ensure that the thumbnails always render with the *default* optional
      // content configuration.
      this._setImageDisabled = true;
    });
  }
  /**
   * @private
   */


  _scrollUpdated() {
    this.renderingQueue.renderHighestPriority();
  }

  getThumbnail(index) {
    return this._thumbnails[index];
  }
  /**
   * @private
   */


  _getVisibleThumbs() {
    return getVisibleElements({
      scrollEl: this.container,
      views: this._thumbnails
    });
  }

  scrollThumbnailIntoView(pageNumber) {
    if (!this.pdfDocument) {
      return;
    }

    const thumbnailView = this._thumbnails[pageNumber - 1];

    if (!thumbnailView) {
      console.error('scrollThumbnailIntoView: Invalid "pageNumber" parameter.');
      return;
    }

    if (pageNumber !== this._currentPageNumber) {
      const prevThumbnailView = this._thumbnails[this._currentPageNumber - 1]; // Remove the highlight from the previous thumbnail...

      prevThumbnailView.div.classList.remove(THUMBNAIL_SELECTED_CLASS); // ... and add the highlight to the new thumbnail.

      thumbnailView.div.classList.add(THUMBNAIL_SELECTED_CLASS);
    }

    const visibleThumbs = this._getVisibleThumbs();

    const numVisibleThumbs = visibleThumbs.views.length; // If the thumbnail isn't currently visible, scroll it into view.

    if (numVisibleThumbs > 0) {
      const first = visibleThumbs.first.id; // Account for only one thumbnail being visible.

      const last = numVisibleThumbs > 1 ? visibleThumbs.last.id : first;
      let shouldScroll = false;

      if (pageNumber <= first || pageNumber >= last) {
        shouldScroll = true;
      } else {
        visibleThumbs.views.some(function (view) {
          if (view.id !== pageNumber) {
            return false;
          }

          shouldScroll = view.percent < 100;
          return true;
        });
      }

      if (shouldScroll) {
        scrollIntoView(thumbnailView.div, {
          top: THUMBNAIL_SCROLL_MARGIN
        });
      }
    }

    this._currentPageNumber = pageNumber;
  }

  get pagesRotation() {
    return this._pagesRotation;
  }

  set pagesRotation(rotation) {
    if (!isValidRotation(rotation)) {
      throw new Error("Invalid thumbnails rotation angle.");
    }

    if (!this.pdfDocument) {
      return;
    }

    if (this._pagesRotation === rotation) {
      return; // The rotation didn't change.
    }

    this._pagesRotation = rotation;

    for (let i = 0, ii = this._thumbnails.length; i < ii; i++) {
      this._thumbnails[i].update(rotation);
    }
  }

  cleanup() {
    for (let i = 0, ii = this._thumbnails.length; i < ii; i++) {
      if (this._thumbnails[i] && this._thumbnails[i].renderingState !== RenderingStates.FINISHED) {
        this._thumbnails[i].reset();
      }
    }

    TempImageFactory.destroyCanvas();
  }
  /**
   * @private
   */


  _resetView() {
    this._thumbnails = [];
    this._currentPageNumber = 1;
    this._pageLabels = null;
    this._pagesRotation = 0;
    this._optionalContentConfigPromise = null;
    this._pagesRequests = new WeakMap();
    this._setImageDisabled = false; // Remove the thumbnails from the DOM.

    this.container.textContent = "";
  }

  setDocument(pdfDocument) {
    if (this.pdfDocument) {
      this._cancelRendering();

      this._resetView();
    }

    this.pdfDocument = pdfDocument;

    if (!pdfDocument) {
      return;
    }

    const firstPagePromise = pdfDocument.getPage(1);
    const optionalContentConfigPromise = pdfDocument.getOptionalContentConfig();
    firstPagePromise.then(firstPdfPage => {
      this._optionalContentConfigPromise = optionalContentConfigPromise;
      const pagesCount = pdfDocument.numPages;
      const viewport = firstPdfPage.getViewport({
        scale: 1
      });

      const checkSetImageDisabled = () => {
        return this._setImageDisabled;
      };

      for (let pageNum = 1; pageNum <= pagesCount; ++pageNum) {
        const thumbnail = new PDFThumbnailView({
          container: this.container,
          id: pageNum,
          defaultViewport: viewport.clone(),
          optionalContentConfigPromise,
          linkService: this.linkService,
          renderingQueue: this.renderingQueue,
          checkSetImageDisabled,
          l10n: this.l10n
        });

        this._thumbnails.push(thumbnail);
      } // Set the first `pdfPage` immediately, since it's already loaded,
      // rather than having to repeat the `PDFDocumentProxy.getPage` call in
      // the `this._ensurePdfPageLoaded` method before rendering can start.


      const firstThumbnailView = this._thumbnails[0];

      if (firstThumbnailView) {
        firstThumbnailView.setPdfPage(firstPdfPage);
      } // Ensure that the current thumbnail is always highlighted on load.


      const thumbnailView = this._thumbnails[this._currentPageNumber - 1];
      thumbnailView.div.classList.add(THUMBNAIL_SELECTED_CLASS);
    }).catch(reason => {
      console.error("Unable to initialize thumbnail viewer", reason);
    });
  }
  /**
   * @private
   */


  _cancelRendering() {
    for (let i = 0, ii = this._thumbnails.length; i < ii; i++) {
      if (this._thumbnails[i]) {
        this._thumbnails[i].cancelRendering();
      }
    }
  }
  /**
   * @param {Array|null} labels
   */


  setPageLabels(labels) {
    if (!this.pdfDocument) {
      return;
    }

    if (!labels) {
      this._pageLabels = null;
    } else if (!(Array.isArray(labels) && this.pdfDocument.numPages === labels.length)) {
      this._pageLabels = null;
      console.error("PDFThumbnailViewer_setPageLabels: Invalid page labels.");
    } else {
      this._pageLabels = labels;
    } // Update all the `PDFThumbnailView` instances.


    for (let i = 0, ii = this._thumbnails.length; i < ii; i++) {
      var _this$_pageLabels$i, _this$_pageLabels;

      this._thumbnails[i].setPageLabel((_this$_pageLabels$i = (_this$_pageLabels = this._pageLabels) === null || _this$_pageLabels === void 0 ? void 0 : _this$_pageLabels[i]) !== null && _this$_pageLabels$i !== void 0 ? _this$_pageLabels$i : null);
    }
  }
  /**
   * @param {PDFThumbnailView} thumbView
   * @returns {PDFPage}
   * @private
   */


  _ensurePdfPageLoaded(thumbView) {
    if (thumbView.pdfPage) {
      return Promise.resolve(thumbView.pdfPage);
    }

    if (this._pagesRequests.has(thumbView)) {
      return this._pagesRequests.get(thumbView);
    }

    const promise = this.pdfDocument.getPage(thumbView.id).then(pdfPage => {
      if (!thumbView.pdfPage) {
        thumbView.setPdfPage(pdfPage);
      }

      this._pagesRequests.delete(thumbView);

      return pdfPage;
    }).catch(reason => {
      console.error("Unable to get page for thumb view", reason); // Page error -- there is nothing that can be done.

      this._pagesRequests.delete(thumbView);
    });

    this._pagesRequests.set(thumbView, promise);

    return promise;
  }

  forceRendering() {
    const visibleThumbs = this._getVisibleThumbs();

    const thumbView = this.renderingQueue.getHighestPriority(visibleThumbs, this._thumbnails, this.scroll.down);

    if (thumbView) {
      this._ensurePdfPageLoaded(thumbView).then(() => {
        this.renderingQueue.renderView(thumbView);
      });

      return true;
    }

    return false;
  }

}

export { PDFThumbnailViewer };
