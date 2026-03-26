import { AnnotationEditorLayer, AnnotationLayer, DrawLayer, updateTextLayer, renderTextLayer, XfaLayer, version, AnnotationEditorUIManager } from './pdf.js';
import { PresentationModeState, removeNullCharacters, binarySearchFirstItem, RenderingStates, TextLayerMode, DEFAULT_SCALE, OutputScale, approximateFraction, roundToDivide, watchScroll, UNKNOWN_SCALE, isValidRotation, ScrollMode, SpreadMode, scrollIntoView, isPortraitOrientation, MAX_AUTO_SCALE, DEFAULT_SCALE_VALUE, getVisibleElements, isValidScrollMode, isValidSpreadMode, MAX_SCALE, DEFAULT_SCALE_DELTA, MIN_SCALE, docStyle, SCROLLBAR_PADDING, VERTICAL_PADDING } from './ui_utils.js';
import { GenericL10n } from './genericl10n.js';
import { SimpleLinkService } from './pdf_link_service.js';
import { G as normalizeUnicode, r as AnnotationMode, s as shadow, m as AbortException, A as AnnotationEditorType, J as PermissionFlag } from './util.js';
import { P as PixelsPerInch, s as setLayerDimensions, R as RenderingCancelledException } from './node_stream2.js';
import { PDFRenderingQueue } from './pdf_rendering_queue.js';
import './message_handler.js';

/* Copyright 2022 Mozilla Foundation
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

/**
 * @typedef {Object} AnnotationEditorLayerBuilderOptions
 * @property {AnnotationEditorUIManager} [uiManager]
 * @property {PDFPageProxy} pdfPage
 * @property {IL10n} [l10n]
 * @property {TextAccessibilityManager} [accessibilityManager]
 * @property {AnnotationLayer} [annotationLayer]
 * @property {TextLayer} [textLayer]
 * @property {DrawLayer} [drawLayer]
 * @property {function} [onAppend]
 */

class AnnotationEditorLayerBuilder {
  #annotationLayer = null;
  #drawLayer = null;
  #onAppend = null;
  #textLayer = null;
  #uiManager;

  /**
   * @param {AnnotationEditorLayerBuilderOptions} options
   */
  constructor(options) {
    this.pdfPage = options.pdfPage;
    this.accessibilityManager = options.accessibilityManager;
    this.l10n = options.l10n;
    if (typeof PDFJSDev === "undefined" || PDFJSDev.test("GENERIC")) {
      this.l10n || (this.l10n = new GenericL10n());
    }
    this.annotationEditorLayer = null;
    this.div = null;
    this._cancelled = false;
    this.#uiManager = options.uiManager;
    this.#annotationLayer = options.annotationLayer || null;
    this.#textLayer = options.textLayer || null;
    this.#drawLayer = options.drawLayer || null;
    this.#onAppend = options.onAppend || null;
  }

  /**
   * @param {PageViewport} viewport
   * @param {string} intent (default value is 'display')
   */
  async render(viewport, intent = "display") {
    var _this$onAppend;
    if (intent !== "display") {
      return;
    }
    if (this._cancelled) {
      return;
    }
    const clonedViewport = viewport.clone({
      dontFlip: true
    });
    if (this.div) {
      this.annotationEditorLayer.update({
        viewport: clonedViewport
      });
      this.show();
      return;
    }

    // Create an AnnotationEditor layer div
    const div = this.div = document.createElement("div");
    div.className = "annotationEditorLayer";
    div.hidden = true;
    div.dir = this.#uiManager.direction;
    (_this$onAppend = this.#onAppend) === null || _this$onAppend === void 0 ? void 0 : _this$onAppend.call(this, div);
    this.annotationEditorLayer = new AnnotationEditorLayer({
      uiManager: this.#uiManager,
      div,
      accessibilityManager: this.accessibilityManager,
      pageIndex: this.pdfPage.pageNumber - 1,
      l10n: this.l10n,
      viewport: clonedViewport,
      annotationLayer: this.#annotationLayer,
      textLayer: this.#textLayer,
      drawLayer: this.#drawLayer
    });
    const parameters = {
      viewport: clonedViewport,
      div,
      annotations: null,
      intent
    };
    this.annotationEditorLayer.render(parameters);
    this.show();
  }
  cancel() {
    this._cancelled = true;
    if (!this.div) {
      return;
    }
    this.annotationEditorLayer.destroy();
  }
  hide() {
    if (!this.div) {
      return;
    }
    this.div.hidden = true;
  }
  show() {
    if (!this.div || this.annotationEditorLayer.isInvisible) {
      return;
    }
    this.div.hidden = false;
  }
}

/* Copyright 2014 Mozilla Foundation
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

/**
 * @typedef {Object} AnnotationLayerBuilderOptions
 * @property {PDFPageProxy} pdfPage
 * @property {AnnotationStorage} [annotationStorage]
 * @property {string} [imageResourcesPath] - Path for image resources, mainly
 *   for annotation icons. Include trailing slash.
 * @property {boolean} renderForms
 * @property {IPDFLinkService} linkService
 * @property {IDownloadManager} [downloadManager]
 * @property {boolean} [enableScripting]
 * @property {Promise<boolean>} [hasJSActionsPromise]
 * @property {Promise<Object<string, Array<Object>> | null>}
 *   [fieldObjectsPromise]
 * @property {Map<string, HTMLCanvasElement>} [annotationCanvasMap]
 * @property {TextAccessibilityManager} [accessibilityManager]
 * @property {AnnotationEditorUIManager} [annotationEditorUIManager]
 * @property {function} [onAppend]
 */

class AnnotationLayerBuilder {
  #onAppend = null;
  #eventAbortController = null;

  /**
   * @param {AnnotationLayerBuilderOptions} options
   */
  constructor({
    pdfPage,
    linkService,
    downloadManager,
    annotationStorage = null,
    imageResourcesPath = "",
    renderForms = true,
    enableScripting = false,
    hasJSActionsPromise = null,
    fieldObjectsPromise = null,
    annotationCanvasMap = null,
    accessibilityManager = null,
    annotationEditorUIManager = null,
    onAppend = null
  }) {
    this.pdfPage = pdfPage;
    this.linkService = linkService;
    this.downloadManager = downloadManager;
    this.imageResourcesPath = imageResourcesPath;
    this.renderForms = renderForms;
    this.annotationStorage = annotationStorage;
    this.enableScripting = enableScripting;
    this._hasJSActionsPromise = hasJSActionsPromise || Promise.resolve(false);
    this._fieldObjectsPromise = fieldObjectsPromise || Promise.resolve(null);
    this._annotationCanvasMap = annotationCanvasMap;
    this._accessibilityManager = accessibilityManager;
    this._annotationEditorUIManager = annotationEditorUIManager;
    this.#onAppend = onAppend;
    this.annotationLayer = null;
    this.div = null;
    this._cancelled = false;
    this._eventBus = linkService.eventBus;
  }

  /**
   * @param {PageViewport} viewport
   * @param {string} intent (default value is 'display')
   * @returns {Promise<void>} A promise that is resolved when rendering of the
   *   annotations is complete.
   */
  async render(viewport, intent = "display") {
    var _this$onAppend;
    if (this.div) {
      if (this._cancelled || !this.annotationLayer) {
        return;
      }
      // If an annotationLayer already exists, refresh its children's
      // transformation matrices.
      this.annotationLayer.update({
        viewport: viewport.clone({
          dontFlip: true
        })
      });
      return;
    }
    const [annotations, hasJSActions, fieldObjects] = await Promise.all([this.pdfPage.getAnnotations({
      intent
    }), this._hasJSActionsPromise, this._fieldObjectsPromise]);
    if (this._cancelled) {
      return;
    }

    // Create an annotation layer div and render the annotations
    // if there is at least one annotation.
    const div = this.div = document.createElement("div");
    div.className = "annotationLayer";
    (_this$onAppend = this.#onAppend) === null || _this$onAppend === void 0 ? void 0 : _this$onAppend.call(this, div);
    if (annotations.length === 0) {
      this.hide();
      return;
    }
    this.annotationLayer = new AnnotationLayer({
      div,
      accessibilityManager: this._accessibilityManager,
      annotationCanvasMap: this._annotationCanvasMap,
      annotationEditorUIManager: this._annotationEditorUIManager,
      page: this.pdfPage,
      viewport: viewport.clone({
        dontFlip: true
      })
    });
    await this.annotationLayer.render({
      annotations,
      imageResourcesPath: this.imageResourcesPath,
      renderForms: this.renderForms,
      linkService: this.linkService,
      downloadManager: this.downloadManager,
      annotationStorage: this.annotationStorage,
      enableScripting: this.enableScripting,
      hasJSActions,
      fieldObjects
    });

    // Ensure that interactive form elements in the annotationLayer are
    // disabled while PresentationMode is active (see issue 12232).
    if (this.linkService.isInPresentationMode) {
      this.#updatePresentationModeState(PresentationModeState.FULLSCREEN);
    }
    if (!this.#eventAbortController) {
      var _this$_eventBus;
      this.#eventAbortController = new AbortController();
      (_this$_eventBus = this._eventBus) === null || _this$_eventBus === void 0 ? void 0 : _this$_eventBus._on("presentationmodechanged", evt => {
        this.#updatePresentationModeState(evt.state);
      }, {
        signal: this.#eventAbortController.signal
      });
    }
  }
  cancel() {
    var _this$eventAbortContr;
    this._cancelled = true;
    (_this$eventAbortContr = this.#eventAbortController) === null || _this$eventAbortContr === void 0 ? void 0 : _this$eventAbortContr.abort();
    this.#eventAbortController = null;
  }
  hide() {
    if (!this.div) {
      return;
    }
    this.div.hidden = true;
  }
  #updatePresentationModeState(state) {
    if (!this.div) {
      return;
    }
    let disableFormElements = false;
    switch (state) {
      case PresentationModeState.FULLSCREEN:
        disableFormElements = true;
        break;
      case PresentationModeState.NORMAL:
        break;
      default:
        return;
    }
    for (const section of this.div.childNodes) {
      if (section.hasAttribute("data-internal-link")) {
        continue;
      }
      section.inert = disableFormElements;
    }
  }
}

/* Copyright 2018 Mozilla Foundation
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

if (typeof PDFJSDev === "undefined" || PDFJSDev.test("GENERIC")) {
  // eslint-disable-next-line no-var
  var compatibilityParams = Object.create(null);
  if (typeof PDFJSDev !== "undefined" && PDFJSDev.test("LIB") && typeof navigator === "undefined") {
    globalThis.navigator = Object.create(null);
  }
  const userAgent = navigator.userAgent || "";
  const platform = navigator.platform || "";
  const maxTouchPoints = navigator.maxTouchPoints || 1;
  const isAndroid = /Android/.test(userAgent);
  const isIOS = /\b(iPad|iPhone|iPod)(?=;)/.test(userAgent) || platform === "MacIntel" && maxTouchPoints > 1;

  // Limit canvas size to 5 mega-pixels on mobile.
  // Support: Android, iOS
  (function checkCanvasSizeLimitation() {
    if (isIOS || isAndroid) {
      compatibilityParams.maxCanvasPixels = 5242880;
    }
  })();
}
const OptionKind = {
  BROWSER: 0x01,
  VIEWER: 0x02,
  API: 0x04,
  WORKER: 0x08,
  PREFERENCE: 0x80
};

/**
 * NOTE: These options are used to generate the `default_preferences.json` file,
 *       see `OptionKind.PREFERENCE`, hence the values below must use only
 *       primitive types and cannot rely on any imported types.
 */
const defaultOptions = {
  canvasMaxAreaInBytes: {
    /** @type {number} */
    value: -1,
    kind: OptionKind.BROWSER + OptionKind.API
  },
  isInAutomation: {
    /** @type {boolean} */
    value: false,
    kind: OptionKind.BROWSER
  },
  supportsCaretBrowsingMode: {
    /** @type {boolean} */
    value: false,
    kind: OptionKind.BROWSER
  },
  supportsDocumentFonts: {
    /** @type {boolean} */
    value: true,
    kind: OptionKind.BROWSER
  },
  supportsIntegratedFind: {
    /** @type {boolean} */
    value: false,
    kind: OptionKind.BROWSER
  },
  supportsMouseWheelZoomCtrlKey: {
    /** @type {boolean} */
    value: true,
    kind: OptionKind.BROWSER
  },
  supportsMouseWheelZoomMetaKey: {
    /** @type {boolean} */
    value: true,
    kind: OptionKind.BROWSER
  },
  supportsPinchToZoom: {
    /** @type {boolean} */
    value: true,
    kind: OptionKind.BROWSER
  },
  annotationEditorMode: {
    /** @type {number} */
    value: 0,
    kind: OptionKind.VIEWER + OptionKind.PREFERENCE
  },
  annotationMode: {
    /** @type {number} */
    value: 2,
    kind: OptionKind.VIEWER + OptionKind.PREFERENCE
  },
  cursorToolOnLoad: {
    /** @type {number} */
    value: 0,
    kind: OptionKind.VIEWER + OptionKind.PREFERENCE
  },
  debuggerSrc: {
    /** @type {string} */
    value: "./debugger.mjs",
    kind: OptionKind.VIEWER
  },
  defaultZoomDelay: {
    /** @type {number} */
    value: 400,
    kind: OptionKind.VIEWER + OptionKind.PREFERENCE
  },
  defaultZoomValue: {
    /** @type {string} */
    value: "",
    kind: OptionKind.VIEWER + OptionKind.PREFERENCE
  },
  disableHistory: {
    /** @type {boolean} */
    value: false,
    kind: OptionKind.VIEWER
  },
  disablePageLabels: {
    /** @type {boolean} */
    value: false,
    kind: OptionKind.VIEWER + OptionKind.PREFERENCE
  },
  enableHighlightEditor: {
    // We'll probably want to make some experiments before enabling this
    // in Firefox release, but it has to be temporary.
    // TODO: remove it when unnecessary.
    /** @type {boolean} */
    value: typeof PDFJSDev === "undefined" || PDFJSDev.test("TESTING"),
    kind: OptionKind.VIEWER + OptionKind.PREFERENCE
  },
  enableHighlightFloatingButton: {
    // We'll probably want to make some experiments before enabling this
    // in Firefox release, but it has to be temporary.
    // TODO: remove it when unnecessary.
    /** @type {boolean} */
    value: typeof PDFJSDev === "undefined" || PDFJSDev.test("TESTING"),
    kind: OptionKind.VIEWER + OptionKind.PREFERENCE
  },
  enableML: {
    /** @type {boolean} */
    value: false,
    kind: OptionKind.VIEWER + OptionKind.PREFERENCE
  },
  enablePermissions: {
    /** @type {boolean} */
    value: false,
    kind: OptionKind.VIEWER + OptionKind.PREFERENCE
  },
  enablePrintAutoRotate: {
    /** @type {boolean} */
    value: true,
    kind: OptionKind.VIEWER + OptionKind.PREFERENCE
  },
  enableScripting: {
    /** @type {boolean} */
    value: typeof PDFJSDev === "undefined" || !PDFJSDev.test("CHROME"),
    kind: OptionKind.VIEWER + OptionKind.PREFERENCE
  },
  enableStampEditor: {
    // We'll probably want to make some experiments before enabling this
    // in Firefox release, but it has to be temporary.
    // TODO: remove it when unnecessary.
    /** @type {boolean} */
    value: true,
    kind: OptionKind.VIEWER + OptionKind.PREFERENCE
  },
  externalLinkRel: {
    /** @type {string} */
    value: "noopener noreferrer nofollow",
    kind: OptionKind.VIEWER
  },
  externalLinkTarget: {
    /** @type {number} */
    value: 0,
    kind: OptionKind.VIEWER + OptionKind.PREFERENCE
  },
  highlightEditorColors: {
    /** @type {string} */
    value: "yellow=#FFFF98,green=#53FFBC,blue=#80EBFF,pink=#FFCBE6,red=#FF4F5F",
    kind: OptionKind.VIEWER + OptionKind.PREFERENCE
  },
  historyUpdateUrl: {
    /** @type {boolean} */
    value: false,
    kind: OptionKind.VIEWER + OptionKind.PREFERENCE
  },
  ignoreDestinationZoom: {
    /** @type {boolean} */
    value: false,
    kind: OptionKind.VIEWER + OptionKind.PREFERENCE
  },
  imageResourcesPath: {
    /** @type {string} */
    value: typeof PDFJSDev !== "undefined" && PDFJSDev.test("MOZCENTRAL") ? "resource://pdf.js/web/images/" : "./images/",
    kind: OptionKind.VIEWER
  },
  maxCanvasPixels: {
    /** @type {number} */
    value: 2 ** 25,
    kind: OptionKind.VIEWER
  },
  forcePageColors: {
    /** @type {boolean} */
    value: false,
    kind: OptionKind.VIEWER + OptionKind.PREFERENCE
  },
  pageColorsBackground: {
    /** @type {string} */
    value: "Canvas",
    kind: OptionKind.VIEWER + OptionKind.PREFERENCE
  },
  pageColorsForeground: {
    /** @type {string} */
    value: "CanvasText",
    kind: OptionKind.VIEWER + OptionKind.PREFERENCE
  },
  pdfBugEnabled: {
    /** @type {boolean} */
    value: typeof PDFJSDev === "undefined" || PDFJSDev.test("TESTING"),
    kind: OptionKind.VIEWER + OptionKind.PREFERENCE
  },
  printResolution: {
    /** @type {number} */
    value: 150,
    kind: OptionKind.VIEWER
  },
  sidebarViewOnLoad: {
    /** @type {number} */
    value: -1,
    kind: OptionKind.VIEWER + OptionKind.PREFERENCE
  },
  scrollModeOnLoad: {
    /** @type {number} */
    value: -1,
    kind: OptionKind.VIEWER + OptionKind.PREFERENCE
  },
  spreadModeOnLoad: {
    /** @type {number} */
    value: -1,
    kind: OptionKind.VIEWER + OptionKind.PREFERENCE
  },
  textLayerMode: {
    /** @type {number} */
    value: 1,
    kind: OptionKind.VIEWER + OptionKind.PREFERENCE
  },
  viewOnLoad: {
    /** @type {boolean} */
    value: 0,
    kind: OptionKind.VIEWER + OptionKind.PREFERENCE
  },
  cMapPacked: {
    /** @type {boolean} */
    value: true,
    kind: OptionKind.API
  },
  cMapUrl: {
    /** @type {string} */
    value:
    // eslint-disable-next-line no-nested-ternary
    typeof PDFJSDev === "undefined" ? "../external/bcmaps/" : PDFJSDev.test("MOZCENTRAL") ? "resource://pdf.js/web/cmaps/" : "../web/cmaps/",
    kind: OptionKind.API
  },
  disableAutoFetch: {
    /** @type {boolean} */
    value: false,
    kind: OptionKind.API + OptionKind.PREFERENCE
  },
  disableFontFace: {
    /** @type {boolean} */
    value: false,
    kind: OptionKind.API + OptionKind.PREFERENCE
  },
  disableRange: {
    /** @type {boolean} */
    value: false,
    kind: OptionKind.API + OptionKind.PREFERENCE
  },
  disableStream: {
    /** @type {boolean} */
    value: false,
    kind: OptionKind.API + OptionKind.PREFERENCE
  },
  docBaseUrl: {
    /** @type {string} */
    value: "",
    kind: OptionKind.API
  },
  enableXfa: {
    /** @type {boolean} */
    value: true,
    kind: OptionKind.API + OptionKind.PREFERENCE
  },
  fontExtraProperties: {
    /** @type {boolean} */
    value: false,
    kind: OptionKind.API
  },
  isEvalSupported: {
    /** @type {boolean} */
    value: true,
    kind: OptionKind.API
  },
  isOffscreenCanvasSupported: {
    /** @type {boolean} */
    value: true,
    kind: OptionKind.API
  },
  maxImageSize: {
    /** @type {number} */
    value: -1,
    kind: OptionKind.API
  },
  pdfBug: {
    /** @type {boolean} */
    value: false,
    kind: OptionKind.API
  },
  standardFontDataUrl: {
    /** @type {string} */
    value:
    // eslint-disable-next-line no-nested-ternary
    typeof PDFJSDev === "undefined" ? "../external/standard_fonts/" : PDFJSDev.test("MOZCENTRAL") ? "resource://pdf.js/web/standard_fonts/" : "../web/standard_fonts/",
    kind: OptionKind.API
  },
  verbosity: {
    /** @type {number} */
    value: 1,
    kind: OptionKind.API
  },
  workerPort: {
    /** @type {Object} */
    value: null,
    kind: OptionKind.WORKER
  },
  workerSrc: {
    /** @type {string} */
    value:
    // eslint-disable-next-line no-nested-ternary
    typeof PDFJSDev === "undefined" ? "../src/pdf.worker.js" : PDFJSDev.test("MOZCENTRAL") ? "resource://pdf.js/build/pdf.worker.mjs" : "../build/pdf.worker.mjs",
    kind: OptionKind.WORKER
  }
};
if (typeof PDFJSDev === "undefined" || !PDFJSDev.test("MOZCENTRAL")) {
  defaultOptions.defaultUrl = {
    /** @type {string} */
    value: typeof PDFJSDev !== "undefined" && PDFJSDev.test("CHROME") ? "" : "compressed.tracemonkey-pldi-09.pdf",
    kind: OptionKind.VIEWER
  };
  defaultOptions.sandboxBundleSrc = {
    /** @type {string} */
    value: typeof PDFJSDev === "undefined" ? "../build/dev-sandbox/pdf.sandbox.mjs" : "../build/pdf.sandbox.mjs",
    kind: OptionKind.VIEWER
  };
  defaultOptions.viewerCssTheme = {
    /** @type {number} */
    value: typeof PDFJSDev !== "undefined" && PDFJSDev.test("CHROME") ? 2 : 0,
    kind: OptionKind.VIEWER + OptionKind.PREFERENCE
  };
}
if (typeof PDFJSDev === "undefined" || PDFJSDev.test("GENERIC")) {
  defaultOptions.disablePreferences = {
    /** @type {boolean} */
    value: typeof PDFJSDev !== "undefined" && PDFJSDev.test("TESTING"),
    kind: OptionKind.VIEWER
  };
  defaultOptions.locale = {
    /** @type {string} */
    value: navigator.language || "en-US",
    kind: OptionKind.VIEWER
  };
} else if (PDFJSDev.test("CHROME")) {
  defaultOptions.disableTelemetry = {
    /** @type {boolean} */
    value: false,
    kind: OptionKind.VIEWER + OptionKind.PREFERENCE
  };
}
const userOptions = Object.create(null);
if (typeof PDFJSDev === "undefined" || PDFJSDev.test("GENERIC")) {
  // Apply any compatibility-values to the user-options,
  // see also `AppOptions.remove` below.
  for (const name in compatibilityParams) {
    userOptions[name] = compatibilityParams[name];
  }
}
if (typeof PDFJSDev === "undefined" || PDFJSDev.test("TESTING || LIB")) {
  // Ensure that the `defaultOptions` are correctly specified.
  for (const name in defaultOptions) {
    const {
      value,
      kind
    } = defaultOptions[name];
    if (kind & OptionKind.PREFERENCE) {
      if (kind === OptionKind.PREFERENCE) {
        throw new Error(`Cannot use only "PREFERENCE" kind: ${name}`);
      }
      if (kind & OptionKind.BROWSER) {
        throw new Error(`Cannot mix "PREFERENCE" and "BROWSER" kind: ${name}`);
      }
      if (typeof compatibilityParams === "object" && compatibilityParams[name] !== undefined) {
        throw new Error(`Should not have compatibility-value for "PREFERENCE" kind: ${name}`);
      }
      // Only "simple" preference-values are allowed.
      if (typeof value !== "boolean" && typeof value !== "string" && !Number.isInteger(value)) {
        throw new Error(`Invalid value for "PREFERENCE" kind: ${name}`);
      }
    }
  }
}
class AppOptions {
  constructor() {
    throw new Error("Cannot initialize AppOptions.");
  }
  static get(name) {
    var _ref, _userOptions$name, _defaultOptions$name;
    return (_ref = (_userOptions$name = userOptions[name]) !== null && _userOptions$name !== void 0 ? _userOptions$name : (_defaultOptions$name = defaultOptions[name]) === null || _defaultOptions$name === void 0 ? void 0 : _defaultOptions$name.value) !== null && _ref !== void 0 ? _ref : undefined;
  }
  static getAll(kind = null, defaultOnly = false) {
    const options = Object.create(null);
    for (const name in defaultOptions) {
      var _userOptions$name2;
      const defaultOption = defaultOptions[name];
      if (kind && !(kind & defaultOption.kind)) {
        continue;
      }
      options[name] = defaultOnly ? defaultOption.value : (_userOptions$name2 = userOptions[name]) !== null && _userOptions$name2 !== void 0 ? _userOptions$name2 : defaultOption.value;
    }
    return options;
  }
  static set(name, value) {
    userOptions[name] = value;
  }
  static setAll(options, init = false) {
    if ((typeof PDFJSDev === "undefined" || PDFJSDev.test("GENERIC")) && init) {
      if (this.get("disablePreferences")) {
        // Give custom implementations of the default viewer a simpler way to
        // opt-out of having the `Preferences` override existing `AppOptions`.
        return;
      }
      for (const name in userOptions) {
        // Ignore any compatibility-values in the user-options.
        if (compatibilityParams[name] !== undefined) {
          continue;
        }
        console.warn("setAll: The Preferences may override manually set AppOptions; " + 'please use the "disablePreferences"-option in order to prevent that.');
        break;
      }
    }
    for (const name in options) {
      userOptions[name] = options[name];
    }
  }
  static remove(name) {
    delete userOptions[name];
    if (typeof PDFJSDev === "undefined" || PDFJSDev.test("GENERIC")) {
      // Re-apply a compatibility-value, if it exists, to the user-options.
      const val = compatibilityParams[name];
      if (val !== undefined) {
        userOptions[name] = val;
      }
    }
  }
}

/* Copyright 2022 Mozilla Foundation
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

/**
 * @typedef {Object} DrawLayerBuilderOptions
 * @property {number} pageIndex
 */

class DrawLayerBuilder {
  #drawLayer = null;

  /**
   * @param {DrawLayerBuilderOptions} options
   */
  constructor(options) {
    this.pageIndex = options.pageIndex;
  }

  /**
   * @param {string} intent (default value is 'display')
   */
  async render(intent = "display") {
    if (intent !== "display" || this.#drawLayer || this._cancelled) {
      return;
    }
    this.#drawLayer = new DrawLayer({
      pageIndex: this.pageIndex
    });
  }
  cancel() {
    this._cancelled = true;
    if (!this.#drawLayer) {
      return;
    }
    this.#drawLayer.destroy();
    this.#drawLayer = null;
  }
  setParent(parent) {
    var _this$drawLayer;
    (_this$drawLayer = this.#drawLayer) === null || _this$drawLayer === void 0 ? void 0 : _this$drawLayer.setParent(parent);
  }
  getDrawLayer() {
    return this.#drawLayer;
  }
}

/* Copyright 2021 Mozilla Foundation
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
const PDF_ROLE_TO_HTML_ROLE = {
  // Document level structure types
  Document: null,
  // There's a "document" role, but it doesn't make sense here.
  DocumentFragment: null,
  // Grouping level structure types
  Part: "group",
  Sect: "group",
  // XXX: There's a "section" role, but it's abstract.
  Div: "group",
  Aside: "note",
  NonStruct: "none",
  // Block level structure types
  P: null,
  // H<n>,
  H: "heading",
  Title: null,
  FENote: "note",
  // Sub-block level structure type
  Sub: "group",
  // General inline level structure types
  Lbl: null,
  Span: null,
  Em: null,
  Strong: null,
  Link: "link",
  Annot: "note",
  Form: "form",
  // Ruby and Warichu structure types
  Ruby: null,
  RB: null,
  RT: null,
  RP: null,
  Warichu: null,
  WT: null,
  WP: null,
  // List standard structure types
  L: "list",
  LI: "listitem",
  LBody: null,
  // Table standard structure types
  Table: "table",
  TR: "row",
  TH: "columnheader",
  TD: "cell",
  THead: "columnheader",
  TBody: null,
  TFoot: null,
  // Standard structure type Caption
  Caption: null,
  // Standard structure type Figure
  Figure: "figure",
  // Standard structure type Formula
  Formula: null,
  // standard structure type Artifact
  Artifact: null
};
const HEADING_PATTERN = /^H(\d+)$/;
class StructTreeLayerBuilder {
  #treeDom = undefined;
  get renderingDone() {
    return this.#treeDom !== undefined;
  }
  render(structTree) {
    if (this.#treeDom !== undefined) {
      return this.#treeDom;
    }
    const treeDom = this.#walk(structTree);
    treeDom === null || treeDom === void 0 ? void 0 : treeDom.classList.add("structTree");
    return this.#treeDom = treeDom;
  }
  hide() {
    if (this.#treeDom && !this.#treeDom.hidden) {
      this.#treeDom.hidden = true;
    }
  }
  show() {
    var _this$treeDom;
    if ((_this$treeDom = this.#treeDom) !== null && _this$treeDom !== void 0 && _this$treeDom.hidden) {
      this.#treeDom.hidden = false;
    }
  }
  #setAttributes(structElement, htmlElement) {
    const {
      alt,
      id,
      lang
    } = structElement;
    if (alt !== undefined) {
      htmlElement.setAttribute("aria-label", removeNullCharacters(alt));
    }
    if (id !== undefined) {
      htmlElement.setAttribute("aria-owns", id);
    }
    if (lang !== undefined) {
      htmlElement.setAttribute("lang", removeNullCharacters(lang, /* replaceInvisible = */true));
    }
  }
  #walk(node) {
    if (!node) {
      return null;
    }
    const element = document.createElement("span");
    if ("role" in node) {
      const {
        role
      } = node;
      const match = role.match(HEADING_PATTERN);
      if (match) {
        element.setAttribute("role", "heading");
        element.setAttribute("aria-level", match[1]);
      } else if (PDF_ROLE_TO_HTML_ROLE[role]) {
        element.setAttribute("role", PDF_ROLE_TO_HTML_ROLE[role]);
      }
    }
    this.#setAttributes(node, element);
    if (node.children) {
      if (node.children.length === 1 && "id" in node.children[0]) {
        // Often there is only one content node so just set the values on the
        // parent node to avoid creating an extra span.
        this.#setAttributes(node.children[0], element);
      } else {
        for (const kid of node.children) {
          element.append(this.#walk(kid));
        }
      }
    }
    return element;
  }
}

/* Copyright 2022 Mozilla Foundation
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

/**
 * This class aims to provide some methods:
 *  - to reorder elements in the DOM with respect to the visual order;
 *  - to create a link, using aria-owns, between spans in the textLayer and
 *    annotations in the annotationLayer. The goal is to help to know
 *    where the annotations are in the text flow.
 */
class TextAccessibilityManager {
  #enabled = false;
  #textChildren = null;
  #textNodes = new Map();
  #waitingElements = new Map();
  setTextMapping(textDivs) {
    this.#textChildren = textDivs;
  }

  /**
   * Compare the positions of two elements, it must correspond to
   * the visual ordering.
   *
   * @param {HTMLElement} e1
   * @param {HTMLElement} e2
   * @returns {number}
   */
  static #compareElementPositions(e1, e2) {
    const rect1 = e1.getBoundingClientRect();
    const rect2 = e2.getBoundingClientRect();
    if (rect1.width === 0 && rect1.height === 0) {
      return +1;
    }
    if (rect2.width === 0 && rect2.height === 0) {
      return -1;
    }
    const top1 = rect1.y;
    const bot1 = rect1.y + rect1.height;
    const mid1 = rect1.y + rect1.height / 2;
    const top2 = rect2.y;
    const bot2 = rect2.y + rect2.height;
    const mid2 = rect2.y + rect2.height / 2;
    if (mid1 <= top2 && mid2 >= bot1) {
      return -1;
    }
    if (mid2 <= top1 && mid1 >= bot2) {
      return +1;
    }
    const centerX1 = rect1.x + rect1.width / 2;
    const centerX2 = rect2.x + rect2.width / 2;
    return centerX1 - centerX2;
  }

  /**
   * Function called when the text layer has finished rendering.
   */
  enable() {
    if (this.#enabled) {
      throw new Error("TextAccessibilityManager is already enabled.");
    }
    if (!this.#textChildren) {
      throw new Error("Text divs and strings have not been set.");
    }
    this.#enabled = true;
    this.#textChildren = this.#textChildren.slice();
    this.#textChildren.sort(TextAccessibilityManager.#compareElementPositions);
    if (this.#textNodes.size > 0) {
      // Some links have been made before this manager has been disabled, hence
      // we restore them.
      const textChildren = this.#textChildren;
      for (const [id, nodeIndex] of this.#textNodes) {
        const element = document.getElementById(id);
        if (!element) {
          // If the page was *fully* reset the element no longer exists, and it
          // will be re-inserted later (i.e. when the annotationLayer renders).
          this.#textNodes.delete(id);
          continue;
        }
        this.#addIdToAriaOwns(id, textChildren[nodeIndex]);
      }
    }
    for (const [element, isRemovable] of this.#waitingElements) {
      this.addPointerInTextLayer(element, isRemovable);
    }
    this.#waitingElements.clear();
  }
  disable() {
    if (!this.#enabled) {
      return;
    }

    // Don't clear this.#textNodes which is used to rebuild the aria-owns
    // in case it's re-enabled at some point.

    this.#waitingElements.clear();
    this.#textChildren = null;
    this.#enabled = false;
  }

  /**
   * Remove an aria-owns id from a node in the text layer.
   * @param {HTMLElement} element
   */
  removePointerInTextLayer(element) {
    var _owns;
    if (!this.#enabled) {
      this.#waitingElements.delete(element);
      return;
    }
    const children = this.#textChildren;
    if (!children || children.length === 0) {
      return;
    }
    const {
      id
    } = element;
    const nodeIndex = this.#textNodes.get(id);
    if (nodeIndex === undefined) {
      return;
    }
    const node = children[nodeIndex];
    this.#textNodes.delete(id);
    let owns = node.getAttribute("aria-owns");
    if ((_owns = owns) !== null && _owns !== void 0 && _owns.includes(id)) {
      owns = owns.split(" ").filter(x => x !== id).join(" ");
      if (owns) {
        node.setAttribute("aria-owns", owns);
      } else {
        node.removeAttribute("aria-owns");
        node.setAttribute("role", "presentation");
      }
    }
  }
  #addIdToAriaOwns(id, node) {
    const owns = node.getAttribute("aria-owns");
    if (!(owns !== null && owns !== void 0 && owns.includes(id))) {
      node.setAttribute("aria-owns", owns ? `${owns} ${id}` : id);
    }
    node.removeAttribute("role");
  }

  /**
   * Find the text node which is the nearest and add an aria-owns attribute
   * in order to correctly position this editor in the text flow.
   * @param {HTMLElement} element
   * @param {boolean} isRemovable
   * @returns {string|null} The id in the struct tree if any.
   */
  addPointerInTextLayer(element, isRemovable) {
    const {
      id
    } = element;
    if (!id) {
      return null;
    }
    if (!this.#enabled) {
      // The text layer needs to be there, so we postpone the association.
      this.#waitingElements.set(element, isRemovable);
      return null;
    }
    if (isRemovable) {
      this.removePointerInTextLayer(element);
    }
    const children = this.#textChildren;
    if (!children || children.length === 0) {
      return null;
    }
    const index = binarySearchFirstItem(children, node => TextAccessibilityManager.#compareElementPositions(element, node) < 0);
    const nodeIndex = Math.max(0, index - 1);
    const child = children[nodeIndex];
    this.#addIdToAriaOwns(id, child);
    this.#textNodes.set(id, nodeIndex);
    const parent = child.parentNode;
    return parent !== null && parent !== void 0 && parent.classList.contains("markedContent") ? parent.id : null;
  }

  /**
   * Move a div in the DOM in order to respect the visual order.
   * @param {HTMLDivElement} element
   * @returns {string|null} The id in the struct tree if any.
   */
  moveElementInDOM(container, element, contentElement, isRemovable) {
    const id = this.addPointerInTextLayer(contentElement, isRemovable);
    if (!container.hasChildNodes()) {
      container.append(element);
      return id;
    }
    const children = Array.from(container.childNodes).filter(node => node !== element);
    if (children.length === 0) {
      return id;
    }
    const elementToCompare = contentElement || element;
    const index = binarySearchFirstItem(children, node => TextAccessibilityManager.#compareElementPositions(elementToCompare, node) < 0);
    if (index === 0) {
      children[0].before(element);
    } else {
      children[index - 1].after(element);
    }
    return id;
  }
}

/* Copyright 2021 Mozilla Foundation
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

/** @typedef {import("./event_utils").EventBus} EventBus */
// eslint-disable-next-line max-len
/** @typedef {import("./pdf_find_controller").PDFFindController} PDFFindController */

/**
 * @typedef {Object} TextHighlighterOptions
 * @property {PDFFindController} findController
 * @property {EventBus} eventBus - The application event bus.
 * @property {number} pageIndex - The page index.
 */

/**
 * TextHighlighter handles highlighting matches from the FindController in
 * either the text layer or XFA layer depending on the type of document.
 */
class TextHighlighter {
  #eventAbortController = null;

  /**
   * @param {TextHighlighterOptions} options
   */
  constructor({
    findController,
    eventBus,
    pageIndex
  }) {
    this.findController = findController;
    this.matches = [];
    this.eventBus = eventBus;
    this.pageIdx = pageIndex;
    this.textDivs = null;
    this.textContentItemsStr = null;
    this.enabled = false;
  }

  /**
   * Store two arrays that will map DOM nodes to text they should contain.
   * The arrays should be of equal length and the array element at each index
   * should correspond to the other. e.g.
   * `items[0] = "<span>Item 0</span>" and texts[0] = "Item 0";
   *
   * @param {Array<Node>} divs
   * @param {Array<string>} texts
   */
  setTextMapping(divs, texts) {
    this.textDivs = divs;
    this.textContentItemsStr = texts;
  }

  /**
   * Start listening for events to update the highlighter and check if there are
   * any current matches that need be highlighted.
   */
  enable() {
    if (!this.textDivs || !this.textContentItemsStr) {
      throw new Error("Text divs and strings have not been set.");
    }
    if (this.enabled) {
      throw new Error("TextHighlighter is already enabled.");
    }
    this.enabled = true;
    if (!this.#eventAbortController) {
      this.#eventAbortController = new AbortController();
      this.eventBus._on("updatetextlayermatches", evt => {
        if (evt.pageIndex === this.pageIdx || evt.pageIndex === -1) {
          this._updateMatches();
        }
      }, {
        signal: this.#eventAbortController.signal
      });
    }
    this._updateMatches();
  }
  disable() {
    var _this$eventAbortContr;
    if (!this.enabled) {
      return;
    }
    this.enabled = false;
    (_this$eventAbortContr = this.#eventAbortController) === null || _this$eventAbortContr === void 0 ? void 0 : _this$eventAbortContr.abort();
    this.#eventAbortController = null;
    this._updateMatches(/* reset = */true);
  }
  _convertMatches(matches, matchesLength) {
    // Early exit if there is nothing to convert.
    if (!matches) {
      return [];
    }
    const {
      textContentItemsStr
    } = this;
    let i = 0,
      iIndex = 0;
    const end = textContentItemsStr.length - 1;
    const result = [];
    for (let m = 0, mm = matches.length; m < mm; m++) {
      // Calculate the start position.
      let matchIdx = matches[m];

      // Loop over the divIdxs.
      while (i !== end && matchIdx >= iIndex + textContentItemsStr[i].length) {
        iIndex += textContentItemsStr[i].length;
        i++;
      }
      if (i === textContentItemsStr.length) {
        console.error("Could not find a matching mapping");
      }
      const match = {
        begin: {
          divIdx: i,
          offset: matchIdx - iIndex
        }
      };

      // Calculate the end position.
      matchIdx += matchesLength[m];

      // Somewhat the same array as above, but use > instead of >= to get
      // the end position right.
      while (i !== end && matchIdx > iIndex + textContentItemsStr[i].length) {
        iIndex += textContentItemsStr[i].length;
        i++;
      }
      match.end = {
        divIdx: i,
        offset: matchIdx - iIndex
      };
      result.push(match);
    }
    return result;
  }
  _renderMatches(matches) {
    // Early exit if there is nothing to render.
    if (matches.length === 0) {
      return;
    }
    const {
      findController,
      pageIdx
    } = this;
    const {
      textContentItemsStr,
      textDivs
    } = this;
    const isSelectedPage = pageIdx === findController.selected.pageIdx;
    const selectedMatchIdx = findController.selected.matchIdx;
    const highlightAll = findController.state.highlightAll;
    let prevEnd = null;
    const infinity = {
      divIdx: -1,
      offset: undefined
    };
    function beginText(begin, className) {
      const divIdx = begin.divIdx;
      textDivs[divIdx].textContent = "";
      return appendTextToDiv(divIdx, 0, begin.offset, className);
    }
    function appendTextToDiv(divIdx, fromOffset, toOffset, className) {
      let div = textDivs[divIdx];
      if (div.nodeType === Node.TEXT_NODE) {
        const span = document.createElement("span");
        div.before(span);
        span.append(div);
        textDivs[divIdx] = span;
        div = span;
      }
      const content = textContentItemsStr[divIdx].substring(fromOffset, toOffset);
      const node = document.createTextNode(content);
      if (className) {
        const span = document.createElement("span");
        span.className = `${className} appended`;
        span.append(node);
        div.append(span);
        return className.includes("selected") ? span.offsetLeft : 0;
      }
      div.append(node);
      return 0;
    }
    let i0 = selectedMatchIdx,
      i1 = i0 + 1;
    if (highlightAll) {
      i0 = 0;
      i1 = matches.length;
    } else if (!isSelectedPage) {
      // Not highlighting all and this isn't the selected page, so do nothing.
      return;
    }
    let lastDivIdx = -1;
    let lastOffset = -1;
    for (let i = i0; i < i1; i++) {
      const match = matches[i];
      const begin = match.begin;
      if (begin.divIdx === lastDivIdx && begin.offset === lastOffset) {
        // It's possible to be in this situation if we searched for a 'f' and we
        // have a ligature 'ff' in the text. The 'ff' has to be highlighted two
        // times.
        continue;
      }
      lastDivIdx = begin.divIdx;
      lastOffset = begin.offset;
      const end = match.end;
      const isSelected = isSelectedPage && i === selectedMatchIdx;
      const highlightSuffix = isSelected ? " selected" : "";
      let selectedLeft = 0;

      // Match inside new div.
      if (!prevEnd || begin.divIdx !== prevEnd.divIdx) {
        // If there was a previous div, then add the text at the end.
        if (prevEnd !== null) {
          appendTextToDiv(prevEnd.divIdx, prevEnd.offset, infinity.offset);
        }
        // Clear the divs and set the content until the starting point.
        beginText(begin);
      } else {
        appendTextToDiv(prevEnd.divIdx, prevEnd.offset, begin.offset);
      }
      if (begin.divIdx === end.divIdx) {
        selectedLeft = appendTextToDiv(begin.divIdx, begin.offset, end.offset, "highlight" + highlightSuffix);
      } else {
        selectedLeft = appendTextToDiv(begin.divIdx, begin.offset, infinity.offset, "highlight begin" + highlightSuffix);
        for (let n0 = begin.divIdx + 1, n1 = end.divIdx; n0 < n1; n0++) {
          textDivs[n0].className = "highlight middle" + highlightSuffix;
        }
        beginText(end, "highlight end" + highlightSuffix);
      }
      prevEnd = end;
      if (isSelected) {
        // Attempt to scroll the selected match into view.
        findController.scrollMatchIntoView({
          element: textDivs[begin.divIdx],
          selectedLeft,
          pageIndex: pageIdx,
          matchIndex: selectedMatchIdx
        });
      }
    }
    if (prevEnd) {
      appendTextToDiv(prevEnd.divIdx, prevEnd.offset, infinity.offset);
    }
  }
  _updateMatches(reset = false) {
    if (!this.enabled && !reset) {
      return;
    }
    const {
      findController,
      matches,
      pageIdx
    } = this;
    const {
      textContentItemsStr,
      textDivs
    } = this;
    let clearedUntilDivIdx = -1;

    // Clear all current matches.
    for (const match of matches) {
      const begin = Math.max(clearedUntilDivIdx, match.begin.divIdx);
      for (let n = begin, end = match.end.divIdx; n <= end; n++) {
        const div = textDivs[n];
        div.textContent = textContentItemsStr[n];
        div.className = "";
      }
      clearedUntilDivIdx = match.end.divIdx + 1;
    }
    if (!(findController !== null && findController !== void 0 && findController.highlightMatches) || reset) {
      return;
    }
    // Convert the matches on the `findController` into the match format
    // used for the textLayer.
    const pageMatches = findController.pageMatches[pageIdx] || null;
    const pageMatchesLength = findController.pageMatchesLength[pageIdx] || null;
    this.matches = this._convertMatches(pageMatches, pageMatchesLength);
    this._renderMatches(this.matches);
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

/**
 * @typedef {Object} TextLayerBuilderOptions
 * @property {TextHighlighter} highlighter - Optional object that will handle
 *   highlighting text from the find controller.
 * @property {TextAccessibilityManager} [accessibilityManager]
 * @property {function} [onAppend]
 */

/**
 * The text layer builder provides text selection functionality for the PDF.
 * It does this by creating overlay divs over the PDF's text. These divs
 * contain text that matches the PDF text they are overlaying.
 */
class TextLayerBuilder {
  #enablePermissions = false;
  #onAppend = null;
  #rotation = 0;
  #scale = 0;
  #textContentSource = null;
  constructor({
    highlighter = null,
    accessibilityManager = null,
    enablePermissions = false,
    onAppend = null
  }) {
    this.textContentItemsStr = [];
    this.renderingDone = false;
    this.textDivs = [];
    this.textDivProperties = new WeakMap();
    this.textLayerRenderTask = null;
    this.highlighter = highlighter;
    this.accessibilityManager = accessibilityManager;
    this.#enablePermissions = enablePermissions === true;
    this.#onAppend = onAppend;
    this.div = document.createElement("div");
    this.div.tabIndex = 0;
    this.div.className = "textLayer";
  }
  #finishRendering() {
    this.renderingDone = true;
    const endOfContent = document.createElement("div");
    endOfContent.className = "endOfContent";
    this.div.append(endOfContent);
    this.#bindMouse();
  }
  get numTextDivs() {
    return this.textDivs.length;
  }

  /**
   * Renders the text layer.
   * @param {PageViewport} viewport
   */
  async render(viewport) {
    var _this$highlighter, _this$accessibilityMa, _this$onAppend, _this$highlighter2, _this$accessibilityMa2;
    if (!this.#textContentSource) {
      throw new Error('No "textContentSource" parameter specified.');
    }
    const scale = viewport.scale * (globalThis.devicePixelRatio || 1);
    const {
      rotation
    } = viewport;
    if (this.renderingDone) {
      const mustRotate = rotation !== this.#rotation;
      const mustRescale = scale !== this.#scale;
      if (mustRotate || mustRescale) {
        this.hide();
        updateTextLayer({
          container: this.div,
          viewport,
          textDivs: this.textDivs,
          textDivProperties: this.textDivProperties,
          mustRescale,
          mustRotate
        });
        this.#scale = scale;
        this.#rotation = rotation;
      }
      this.show();
      return;
    }
    this.cancel();
    (_this$highlighter = this.highlighter) === null || _this$highlighter === void 0 ? void 0 : _this$highlighter.setTextMapping(this.textDivs, this.textContentItemsStr);
    (_this$accessibilityMa = this.accessibilityManager) === null || _this$accessibilityMa === void 0 ? void 0 : _this$accessibilityMa.setTextMapping(this.textDivs);
    this.textLayerRenderTask = renderTextLayer({
      textContentSource: this.#textContentSource,
      container: this.div,
      viewport,
      textDivs: this.textDivs,
      textDivProperties: this.textDivProperties,
      textContentItemsStr: this.textContentItemsStr
    });
    await this.textLayerRenderTask.promise;
    this.#finishRendering();
    this.#scale = scale;
    this.#rotation = rotation;
    // Ensure that the textLayer is appended to the DOM *before* handling
    // e.g. a pending search operation.
    (_this$onAppend = this.#onAppend) === null || _this$onAppend === void 0 ? void 0 : _this$onAppend.call(this, this.div);
    (_this$highlighter2 = this.highlighter) === null || _this$highlighter2 === void 0 ? void 0 : _this$highlighter2.enable();
    (_this$accessibilityMa2 = this.accessibilityManager) === null || _this$accessibilityMa2 === void 0 ? void 0 : _this$accessibilityMa2.enable();
  }
  hide() {
    if (!this.div.hidden && this.renderingDone) {
      var _this$highlighter3;
      // We turn off the highlighter in order to avoid to scroll into view an
      // element of the text layer which could be hidden.
      (_this$highlighter3 = this.highlighter) === null || _this$highlighter3 === void 0 ? void 0 : _this$highlighter3.disable();
      this.div.hidden = true;
    }
  }
  show() {
    if (this.div.hidden && this.renderingDone) {
      var _this$highlighter4;
      this.div.hidden = false;
      (_this$highlighter4 = this.highlighter) === null || _this$highlighter4 === void 0 ? void 0 : _this$highlighter4.enable();
    }
  }

  /**
   * Cancel rendering of the text layer.
   */
  cancel() {
    var _this$highlighter5, _this$accessibilityMa3;
    if (this.textLayerRenderTask) {
      this.textLayerRenderTask.cancel();
      this.textLayerRenderTask = null;
    }
    (_this$highlighter5 = this.highlighter) === null || _this$highlighter5 === void 0 ? void 0 : _this$highlighter5.disable();
    (_this$accessibilityMa3 = this.accessibilityManager) === null || _this$accessibilityMa3 === void 0 ? void 0 : _this$accessibilityMa3.disable();
    this.textContentItemsStr.length = 0;
    this.textDivs.length = 0;
    this.textDivProperties = new WeakMap();
  }

  /**
   * @param {ReadableStream | TextContent} source
   */
  setTextContentSource(source) {
    this.cancel();
    this.#textContentSource = source;
  }

  /**
   * Improves text selection by adding an additional div where the mouse was
   * clicked. This reduces flickering of the content if the mouse is slowly
   * dragged up or down.
   */
  #bindMouse() {
    const {
      div
    } = this;
    div.addEventListener("mousedown", evt => {
      const end = div.querySelector(".endOfContent");
      if (!end) {
        return;
      }
      if (typeof PDFJSDev === "undefined" || !PDFJSDev.test("MOZCENTRAL")) {
        // On non-Firefox browsers, the selection will feel better if the height
        // of the `endOfContent` div is adjusted to start at mouse click
        // location. This avoids flickering when the selection moves up.
        // However it does not work when selection is started on empty space.
        let adjustTop = evt.target !== div;
        if (typeof PDFJSDev === "undefined" || PDFJSDev.test("GENERIC")) {
          adjustTop && (adjustTop = getComputedStyle(end).getPropertyValue("-moz-user-select") !== "none");
        }
        if (adjustTop) {
          const divBounds = div.getBoundingClientRect();
          const r = Math.max(0, (evt.pageY - divBounds.top) / divBounds.height);
          end.style.top = (r * 100).toFixed(2) + "%";
        }
      }
      end.classList.add("active");
    });
    div.addEventListener("mouseup", () => {
      const end = div.querySelector(".endOfContent");
      if (!end) {
        return;
      }
      if (typeof PDFJSDev === "undefined" || !PDFJSDev.test("MOZCENTRAL")) {
        end.style.top = "";
      }
      end.classList.remove("active");
    });
    div.addEventListener("copy", event => {
      if (!this.#enablePermissions) {
        const selection = document.getSelection();
        event.clipboardData.setData("text/plain", removeNullCharacters(normalizeUnicode(selection.toString())));
      }
      event.preventDefault();
      event.stopPropagation();
    });
  }
}

/* Copyright 2021 Mozilla Foundation
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

/**
 * @typedef {Object} XfaLayerBuilderOptions
 * @property {PDFPageProxy} pdfPage
 * @property {AnnotationStorage} [annotationStorage]
 * @property {IPDFLinkService} linkService
 * @property {Object} [xfaHtml]
 */

class XfaLayerBuilder {
  /**
   * @param {XfaLayerBuilderOptions} options
   */
  constructor({
    pdfPage,
    annotationStorage = null,
    linkService,
    xfaHtml = null
  }) {
    this.pdfPage = pdfPage;
    this.annotationStorage = annotationStorage;
    this.linkService = linkService;
    this.xfaHtml = xfaHtml;
    this.div = null;
    this._cancelled = false;
  }

  /**
   * @param {PageViewport} viewport
   * @param {string} intent (default value is 'display')
   * @returns {Promise<Object | void>} A promise that is resolved when rendering
   *   of the XFA layer is complete. The first rendering will return an object
   *   with a `textDivs` property that can be used with the TextHighlighter.
   */
  async render(viewport, intent = "display") {
    if (intent === "print") {
      const parameters = {
        viewport: viewport.clone({
          dontFlip: true
        }),
        div: this.div,
        xfaHtml: this.xfaHtml,
        annotationStorage: this.annotationStorage,
        linkService: this.linkService,
        intent
      };

      // Create an xfa layer div and render the form
      this.div = document.createElement("div");
      parameters.div = this.div;
      return XfaLayer.render(parameters);
    }

    // intent === "display"
    const xfaHtml = await this.pdfPage.getXfa();
    if (this._cancelled || !xfaHtml) {
      return {
        textDivs: []
      };
    }
    const parameters = {
      viewport: viewport.clone({
        dontFlip: true
      }),
      div: this.div,
      xfaHtml,
      annotationStorage: this.annotationStorage,
      linkService: this.linkService,
      intent
    };
    if (this.div) {
      return XfaLayer.update(parameters);
    }
    // Create an xfa layer div and render the form
    this.div = document.createElement("div");
    parameters.div = this.div;
    return XfaLayer.render(parameters);
  }
  cancel() {
    this._cancelled = true;
  }
  hide() {
    if (!this.div) {
      return;
    }
    this.div.hidden = true;
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

/**
 * @typedef {Object} PDFPageViewOptions
 * @property {HTMLDivElement} [container] - The viewer element.
 * @property {EventBus} eventBus - The application event bus.
 * @property {number} id - The page unique ID (normally its number).
 * @property {number} [scale] - The page scale display.
 * @property {PageViewport} defaultViewport - The page viewport.
 * @property {Promise<OptionalContentConfig>} [optionalContentConfigPromise] -
 *   A promise that is resolved with an {@link OptionalContentConfig} instance.
 *   The default value is `null`.
 * @property {PDFRenderingQueue} [renderingQueue] - The rendering queue object.
 * @property {number} [textLayerMode] - Controls if the text layer used for
 *   selection and searching is created. The constants from {TextLayerMode}
 *   should be used. The default value is `TextLayerMode.ENABLE`.
 * @property {number} [annotationMode] - Controls if the annotation layer is
 *   created, and if interactive form elements or `AnnotationStorage`-data are
 *   being rendered. The constants from {@link AnnotationMode} should be used;
 *   see also {@link RenderParameters} and {@link GetOperatorListParameters}.
 *   The default value is `AnnotationMode.ENABLE_FORMS`.
 * @property {string} [imageResourcesPath] - Path for image resources, mainly
 *   for annotation icons. Include trailing slash.
 * @property {number} [maxCanvasPixels] - The maximum supported canvas size in
 *   total pixels, i.e. width * height. Use `-1` for no limit, or `0` for
 *   CSS-only zooming. The default value is 4096 * 8192 (32 mega-pixels).
 * @property {Object} [pageColors] - Overwrites background and foreground colors
 *   with user defined ones in order to improve readability in high contrast
 *   mode.
 * @property {IL10n} [l10n] - Localization service.
 * @property {Object} [layerProperties] - The object that is used to lookup
 *   the necessary layer-properties.
 */

const DEFAULT_LAYER_PROPERTIES = typeof PDFJSDev === "undefined" || !PDFJSDev.test("COMPONENTS") ? null : {
  annotationEditorUIManager: null,
  annotationStorage: null,
  downloadManager: null,
  enableScripting: false,
  fieldObjectsPromise: null,
  findController: null,
  hasJSActionsPromise: null,
  get linkService() {
    return new SimpleLinkService();
  }
};
const LAYERS_ORDER = new Map([["canvasWrapper", 0], ["textLayer", 1], ["annotationLayer", 2], ["annotationEditorLayer", 3], ["xfaLayer", 3]]);

/**
 * @implements {IRenderableView}
 */
class PDFPageView {
  #annotationMode = AnnotationMode.ENABLE_FORMS;
  #hasRestrictedScaling = false;
  #layerProperties = null;
  #loadingId = null;
  #previousRotation = null;
  #renderError = null;
  #renderingState = RenderingStates.INITIAL;
  #textLayerMode = TextLayerMode.ENABLE;
  #useThumbnailCanvas = {
    directDrawing: true,
    initialOptionalContent: true,
    regularAnnotations: true
  };
  #viewportMap = new WeakMap();
  #layers = [null, null, null, null];

  /**
   * @param {PDFPageViewOptions} options
   */
  constructor(options) {
    var _options$textLayerMod, _options$annotationMo, _options$maxCanvasPix;
    const container = options.container;
    const defaultViewport = options.defaultViewport;
    this.id = options.id;
    this.renderingId = "page" + this.id;
    this.#layerProperties = options.layerProperties || DEFAULT_LAYER_PROPERTIES;
    this.pdfPage = null;
    this.pageLabel = null;
    this.rotation = 0;
    this.scale = options.scale || DEFAULT_SCALE;
    this.viewport = defaultViewport;
    this.pdfPageRotate = defaultViewport.rotation;
    this._optionalContentConfigPromise = options.optionalContentConfigPromise || null;
    this.#textLayerMode = (_options$textLayerMod = options.textLayerMode) !== null && _options$textLayerMod !== void 0 ? _options$textLayerMod : TextLayerMode.ENABLE;
    this.#annotationMode = (_options$annotationMo = options.annotationMode) !== null && _options$annotationMo !== void 0 ? _options$annotationMo : AnnotationMode.ENABLE_FORMS;
    this.imageResourcesPath = options.imageResourcesPath || "";
    this.maxCanvasPixels = (_options$maxCanvasPix = options.maxCanvasPixels) !== null && _options$maxCanvasPix !== void 0 ? _options$maxCanvasPix : AppOptions.get("maxCanvasPixels");
    this.pageColors = options.pageColors || null;
    this.eventBus = options.eventBus;
    this.renderingQueue = options.renderingQueue;
    this.l10n = options.l10n;
    if (typeof PDFJSDev === "undefined" || PDFJSDev.test("GENERIC")) {
      this.l10n || (this.l10n = new GenericL10n());
    }
    this.renderTask = null;
    this.resume = null;
    if (typeof PDFJSDev === "undefined" || PDFJSDev.test("GENERIC")) {
      var _this$renderingQueue;
      this._isStandalone = !((_this$renderingQueue = this.renderingQueue) !== null && _this$renderingQueue !== void 0 && _this$renderingQueue.hasViewer());
      this._container = container;
    }
    this._annotationCanvasMap = null;
    this.annotationLayer = null;
    this.annotationEditorLayer = null;
    this.textLayer = null;
    this.zoomLayer = null;
    this.xfaLayer = null;
    this.structTreeLayer = null;
    this.drawLayer = null;
    const div = document.createElement("div");
    div.className = "page";
    div.setAttribute("data-page-number", this.id);
    div.setAttribute("role", "region");
    div.setAttribute("data-l10n-id", "pdfjs-page-landmark");
    div.setAttribute("data-l10n-args", JSON.stringify({
      page: this.id
    }));
    this.div = div;
    this.#setDimensions();
    container === null || container === void 0 ? void 0 : container.append(div);
    if ((typeof PDFJSDev === "undefined" || PDFJSDev.test("GENERIC")) && this._isStandalone) {
      // Ensure that the various layers always get the correct initial size,
      // see issue 15795.
      container === null || container === void 0 ? void 0 : container.style.setProperty("--scale-factor", this.scale * PixelsPerInch.PDF_TO_CSS_UNITS);
      const {
        optionalContentConfigPromise
      } = options;
      if (optionalContentConfigPromise) {
        // Ensure that the thumbnails always display the *initial* document
        // state, for documents with optional content.
        optionalContentConfigPromise.then(optionalContentConfig => {
          if (optionalContentConfigPromise !== this._optionalContentConfigPromise) {
            return;
          }
          this.#useThumbnailCanvas.initialOptionalContent = optionalContentConfig.hasInitialVisibility;
        });
      }

      // Ensure that Fluent is connected in e.g. the COMPONENTS build.
      if (!options.l10n) {
        this.l10n.translate(this.div);
      }
    }
  }
  #addLayer(div, name) {
    const pos = LAYERS_ORDER.get(name);
    const oldDiv = this.#layers[pos];
    this.#layers[pos] = div;
    if (oldDiv) {
      oldDiv.replaceWith(div);
      return;
    }
    for (let i = pos - 1; i >= 0; i--) {
      const layer = this.#layers[i];
      if (layer) {
        layer.after(div);
        return;
      }
    }
    this.div.prepend(div);
  }
  get renderingState() {
    return this.#renderingState;
  }
  set renderingState(state) {
    if (state === this.#renderingState) {
      return;
    }
    this.#renderingState = state;
    if (this.#loadingId) {
      clearTimeout(this.#loadingId);
      this.#loadingId = null;
    }
    switch (state) {
      case RenderingStates.PAUSED:
        this.div.classList.remove("loading");
        break;
      case RenderingStates.RUNNING:
        this.div.classList.add("loadingIcon");
        this.#loadingId = setTimeout(() => {
          // Adding the loading class is slightly postponed in order to not have
          // it with loadingIcon.
          // If we don't do that the visibility of the background is changed but
          // the transition isn't triggered.
          this.div.classList.add("loading");
          this.#loadingId = null;
        }, 0);
        break;
      case RenderingStates.INITIAL:
      case RenderingStates.FINISHED:
        this.div.classList.remove("loadingIcon", "loading");
        break;
    }
  }
  #setDimensions() {
    const {
      viewport
    } = this;
    if (this.pdfPage) {
      if (this.#previousRotation === viewport.rotation) {
        return;
      }
      this.#previousRotation = viewport.rotation;
    }
    setLayerDimensions(this.div, viewport, /* mustFlip = */true, /* mustRotate = */false);
  }
  setPdfPage(pdfPage) {
    var _this$pageColors, _this$pageColors2;
    if ((typeof PDFJSDev === "undefined" || PDFJSDev.test("GENERIC")) && this._isStandalone && (((_this$pageColors = this.pageColors) === null || _this$pageColors === void 0 ? void 0 : _this$pageColors.foreground) === "CanvasText" || ((_this$pageColors2 = this.pageColors) === null || _this$pageColors2 === void 0 ? void 0 : _this$pageColors2.background) === "Canvas")) {
      var _this$_container, _this$_container2;
      (_this$_container = this._container) === null || _this$_container === void 0 ? void 0 : _this$_container.style.setProperty("--hcm-highlight-filter", pdfPage.filterFactory.addHighlightHCMFilter("highlight", "CanvasText", "Canvas", "HighlightText", "Highlight"));
      (_this$_container2 = this._container) === null || _this$_container2 === void 0 ? void 0 : _this$_container2.style.setProperty("--hcm-highlight-selected-filter", pdfPage.filterFactory.addHighlightHCMFilter("highlight_selected", "CanvasText", "Canvas", "HighlightText", "Highlight"));
    }
    this.pdfPage = pdfPage;
    this.pdfPageRotate = pdfPage.rotate;
    const totalRotation = (this.rotation + this.pdfPageRotate) % 360;
    this.viewport = pdfPage.getViewport({
      scale: this.scale * PixelsPerInch.PDF_TO_CSS_UNITS,
      rotation: totalRotation
    });
    this.#setDimensions();
    this.reset();
  }
  destroy() {
    var _this$pdfPage;
    this.reset();
    (_this$pdfPage = this.pdfPage) === null || _this$pdfPage === void 0 ? void 0 : _this$pdfPage.cleanup();
  }
  get _textHighlighter() {
    return shadow(this, "_textHighlighter", new TextHighlighter({
      pageIndex: this.id - 1,
      eventBus: this.eventBus,
      findController: this.#layerProperties.findController
    }));
  }
  async #renderAnnotationLayer() {
    let error = null;
    try {
      await this.annotationLayer.render(this.viewport, "display");
    } catch (ex) {
      console.error(`#renderAnnotationLayer: "${ex}".`);
      error = ex;
    } finally {
      this.eventBus.dispatch("annotationlayerrendered", {
        source: this,
        pageNumber: this.id,
        error
      });
    }
  }
  async #renderAnnotationEditorLayer() {
    let error = null;
    try {
      await this.annotationEditorLayer.render(this.viewport, "display");
    } catch (ex) {
      console.error(`#renderAnnotationEditorLayer: "${ex}".`);
      error = ex;
    } finally {
      this.eventBus.dispatch("annotationeditorlayerrendered", {
        source: this,
        pageNumber: this.id,
        error
      });
    }
  }
  async #renderDrawLayer() {
    try {
      await this.drawLayer.render("display");
    } catch (ex) {
      console.error(`#renderDrawLayer: "${ex}".`);
    }
  }
  async #renderXfaLayer() {
    let error = null;
    try {
      const result = await this.xfaLayer.render(this.viewport, "display");
      if (result !== null && result !== void 0 && result.textDivs && this._textHighlighter) {
        // Given that the following method fetches the text asynchronously we
        // can invoke it *before* appending the xfaLayer to the DOM (below),
        // since a pending search-highlight/scroll operation thus won't run
        // until after the xfaLayer is available in the viewer.
        this.#buildXfaTextContentItems(result.textDivs);
      }
    } catch (ex) {
      console.error(`#renderXfaLayer: "${ex}".`);
      error = ex;
    } finally {
      var _this$xfaLayer;
      if ((_this$xfaLayer = this.xfaLayer) !== null && _this$xfaLayer !== void 0 && _this$xfaLayer.div) {
        // Pause translation when inserting the xfaLayer in the DOM.
        this.l10n.pause();
        this.#addLayer(this.xfaLayer.div, "xfaLayer");
        this.l10n.resume();
      }
      this.eventBus.dispatch("xfalayerrendered", {
        source: this,
        pageNumber: this.id,
        error
      });
    }
  }
  async #renderTextLayer() {
    const {
      pdfPage,
      textLayer,
      viewport
    } = this;
    if (!textLayer) {
      return;
    }
    let error = null;
    try {
      if (!textLayer.renderingDone) {
        const readableStream = pdfPage.streamTextContent({
          includeMarkedContent: true,
          disableNormalization: true
        });
        textLayer.setTextContentSource(readableStream);
      }
      await textLayer.render(viewport);
    } catch (ex) {
      if (ex instanceof AbortException) {
        return;
      }
      console.error(`#renderTextLayer: "${ex}".`);
      error = ex;
    }
    this.eventBus.dispatch("textlayerrendered", {
      source: this,
      pageNumber: this.id,
      numTextDivs: textLayer.numTextDivs,
      error
    });
    this.#renderStructTreeLayer();
  }

  /**
   * The structure tree is currently only supported when the text layer is
   * enabled and a canvas is used for rendering.
   *
   * The structure tree must be generated after the text layer for the
   * aria-owns to work.
   */
  async #renderStructTreeLayer() {
    var _this$structTreeLayer, _this$structTreeLayer2;
    if (!this.textLayer) {
      return;
    }
    this.structTreeLayer || (this.structTreeLayer = new StructTreeLayerBuilder());
    const tree = await (!this.structTreeLayer.renderingDone ? this.pdfPage.getStructTree() : null);
    const treeDom = (_this$structTreeLayer = this.structTreeLayer) === null || _this$structTreeLayer === void 0 ? void 0 : _this$structTreeLayer.render(tree);
    if (treeDom) {
      var _this$canvas;
      // Pause translation when inserting the structTree in the DOM.
      this.l10n.pause();
      (_this$canvas = this.canvas) === null || _this$canvas === void 0 ? void 0 : _this$canvas.append(treeDom);
      this.l10n.resume();
    }
    (_this$structTreeLayer2 = this.structTreeLayer) === null || _this$structTreeLayer2 === void 0 ? void 0 : _this$structTreeLayer2.show();
  }
  async #buildXfaTextContentItems(textDivs) {
    const text = await this.pdfPage.getTextContent();
    const items = [];
    for (const item of text.items) {
      items.push(item.str);
    }
    this._textHighlighter.setTextMapping(textDivs, items);
    this._textHighlighter.enable();
  }

  /**
   * @private
   */
  _resetZoomLayer(removeFromDOM = false) {
    if (!this.zoomLayer) {
      return;
    }
    const zoomLayerCanvas = this.zoomLayer.firstChild;
    this.#viewportMap.delete(zoomLayerCanvas);
    // Zeroing the width and height causes Firefox to release graphics
    // resources immediately, which can greatly reduce memory consumption.
    zoomLayerCanvas.width = 0;
    zoomLayerCanvas.height = 0;
    if (removeFromDOM) {
      // Note: `ChildNode.remove` doesn't throw if the parent node is undefined.
      this.zoomLayer.remove();
    }
    this.zoomLayer = null;
  }
  reset({
    keepZoomLayer = false,
    keepAnnotationLayer = false,
    keepAnnotationEditorLayer = false,
    keepXfaLayer = false,
    keepTextLayer = false
  } = {}) {
    var _this$annotationLayer, _this$annotationEdito, _this$xfaLayer2, _this$textLayer, _this$structTreeLayer3;
    this.cancelRendering({
      keepAnnotationLayer,
      keepAnnotationEditorLayer,
      keepXfaLayer,
      keepTextLayer
    });
    this.renderingState = RenderingStates.INITIAL;
    const div = this.div;
    const childNodes = div.childNodes,
      zoomLayerNode = keepZoomLayer && this.zoomLayer || null,
      annotationLayerNode = keepAnnotationLayer && ((_this$annotationLayer = this.annotationLayer) === null || _this$annotationLayer === void 0 ? void 0 : _this$annotationLayer.div) || null,
      annotationEditorLayerNode = keepAnnotationEditorLayer && ((_this$annotationEdito = this.annotationEditorLayer) === null || _this$annotationEdito === void 0 ? void 0 : _this$annotationEdito.div) || null,
      xfaLayerNode = keepXfaLayer && ((_this$xfaLayer2 = this.xfaLayer) === null || _this$xfaLayer2 === void 0 ? void 0 : _this$xfaLayer2.div) || null,
      textLayerNode = keepTextLayer && ((_this$textLayer = this.textLayer) === null || _this$textLayer === void 0 ? void 0 : _this$textLayer.div) || null;
    for (let i = childNodes.length - 1; i >= 0; i--) {
      const node = childNodes[i];
      switch (node) {
        case zoomLayerNode:
        case annotationLayerNode:
        case annotationEditorLayerNode:
        case xfaLayerNode:
        case textLayerNode:
          continue;
      }
      node.remove();
      const layerIndex = this.#layers.indexOf(node);
      if (layerIndex >= 0) {
        this.#layers[layerIndex] = null;
      }
    }
    div.removeAttribute("data-loaded");
    if (annotationLayerNode) {
      // Hide the annotation layer until all elements are resized
      // so they are not displayed on the already resized page.
      this.annotationLayer.hide();
    }
    if (annotationEditorLayerNode) {
      this.annotationEditorLayer.hide();
    }
    if (xfaLayerNode) {
      // Hide the XFA layer until all elements are resized
      // so they are not displayed on the already resized page.
      this.xfaLayer.hide();
    }
    if (textLayerNode) {
      this.textLayer.hide();
    }
    (_this$structTreeLayer3 = this.structTreeLayer) === null || _this$structTreeLayer3 === void 0 ? void 0 : _this$structTreeLayer3.hide();
    if (!zoomLayerNode) {
      if (this.canvas) {
        this.#viewportMap.delete(this.canvas);
        // Zeroing the width and height causes Firefox to release graphics
        // resources immediately, which can greatly reduce memory consumption.
        this.canvas.width = 0;
        this.canvas.height = 0;
        delete this.canvas;
      }
      this._resetZoomLayer();
    }
  }

  /**
   * @typedef {Object} PDFPageViewUpdateParameters
   * @property {number} [scale] The new scale, if specified.
   * @property {number} [rotation] The new rotation, if specified.
   * @property {Promise<OptionalContentConfig>} [optionalContentConfigPromise]
   *   A promise that is resolved with an {@link OptionalContentConfig}
   *   instance. The default value is `null`.
   * @property {number} [drawingDelay]
   */

  /**
   * Update e.g. the scale and/or rotation of the page.
   * @param {PDFPageViewUpdateParameters} params
   */
  update({
    scale = 0,
    rotation = null,
    optionalContentConfigPromise = null,
    drawingDelay = -1
  }) {
    this.scale = scale || this.scale;
    if (typeof rotation === "number") {
      this.rotation = rotation; // The rotation may be zero.
    }
    if (optionalContentConfigPromise instanceof Promise) {
      this._optionalContentConfigPromise = optionalContentConfigPromise;

      // Ensure that the thumbnails always display the *initial* document state,
      // for documents with optional content.
      optionalContentConfigPromise.then(optionalContentConfig => {
        if (optionalContentConfigPromise !== this._optionalContentConfigPromise) {
          return;
        }
        this.#useThumbnailCanvas.initialOptionalContent = optionalContentConfig.hasInitialVisibility;
      });
    }
    this.#useThumbnailCanvas.directDrawing = true;
    const totalRotation = (this.rotation + this.pdfPageRotate) % 360;
    this.viewport = this.viewport.clone({
      scale: this.scale * PixelsPerInch.PDF_TO_CSS_UNITS,
      rotation: totalRotation
    });
    this.#setDimensions();
    if ((typeof PDFJSDev === "undefined" || PDFJSDev.test("GENERIC")) && this._isStandalone) {
      var _this$_container3;
      (_this$_container3 = this._container) === null || _this$_container3 === void 0 ? void 0 : _this$_container3.style.setProperty("--scale-factor", this.viewport.scale);
    }
    if (this.canvas) {
      let onlyCssZoom = false;
      if (this.#hasRestrictedScaling) {
        if ((typeof PDFJSDev === "undefined" || PDFJSDev.test("GENERIC")) && this.maxCanvasPixels === 0) {
          onlyCssZoom = true;
        } else if (this.maxCanvasPixels > 0) {
          const {
            width,
            height
          } = this.viewport;
          const {
            sx,
            sy
          } = this.outputScale;
          onlyCssZoom = (Math.floor(width) * sx | 0) * (Math.floor(height) * sy | 0) > this.maxCanvasPixels;
        }
      }
      const postponeDrawing = !onlyCssZoom && drawingDelay >= 0 && drawingDelay < 1000;
      if (postponeDrawing || onlyCssZoom) {
        if (postponeDrawing && this.renderingState !== RenderingStates.FINISHED) {
          this.cancelRendering({
            keepZoomLayer: true,
            keepAnnotationLayer: true,
            keepAnnotationEditorLayer: true,
            keepXfaLayer: true,
            keepTextLayer: true,
            cancelExtraDelay: drawingDelay
          });
          // It isn't really finished, but once we have finished
          // to postpone, we'll call this.reset(...) which will set
          // the rendering state to INITIAL, hence the next call to
          // PDFViewer.update() will trigger a redraw (if it's mandatory).
          this.renderingState = RenderingStates.FINISHED;
          // Ensure that the thumbnails won't become partially (or fully) blank,
          // if the sidebar is opened before the actual rendering is done.
          this.#useThumbnailCanvas.directDrawing = false;
        }
        this.cssTransform({
          target: this.canvas,
          redrawAnnotationLayer: true,
          redrawAnnotationEditorLayer: true,
          redrawXfaLayer: true,
          redrawTextLayer: !postponeDrawing,
          hideTextLayer: postponeDrawing
        });
        if (postponeDrawing) {
          // The "pagerendered"-event will be dispatched once the actual
          // rendering is done, hence don't dispatch it here as well.
          return;
        }
        this.eventBus.dispatch("pagerendered", {
          source: this,
          pageNumber: this.id,
          cssTransform: true,
          timestamp: performance.now(),
          error: this.#renderError
        });
        return;
      }
      if (!this.zoomLayer && !this.canvas.hidden) {
        this.zoomLayer = this.canvas.parentNode;
        this.zoomLayer.style.position = "absolute";
      }
    }
    if (this.zoomLayer) {
      this.cssTransform({
        target: this.zoomLayer.firstChild
      });
    }
    this.reset({
      keepZoomLayer: true,
      keepAnnotationLayer: true,
      keepAnnotationEditorLayer: true,
      keepXfaLayer: true,
      keepTextLayer: true
    });
  }

  /**
   * PLEASE NOTE: Most likely you want to use the `this.reset()` method,
   *              rather than calling this one directly.
   */
  cancelRendering({
    keepAnnotationLayer = false,
    keepAnnotationEditorLayer = false,
    keepXfaLayer = false,
    keepTextLayer = false,
    cancelExtraDelay = 0
  } = {}) {
    if (this.renderTask) {
      this.renderTask.cancel(cancelExtraDelay);
      this.renderTask = null;
    }
    this.resume = null;
    if (this.textLayer && (!keepTextLayer || !this.textLayer.div)) {
      this.textLayer.cancel();
      this.textLayer = null;
    }
    if (this.structTreeLayer && !this.textLayer) {
      this.structTreeLayer = null;
    }
    if (this.annotationLayer && (!keepAnnotationLayer || !this.annotationLayer.div)) {
      this.annotationLayer.cancel();
      this.annotationLayer = null;
      this._annotationCanvasMap = null;
    }
    if (this.annotationEditorLayer && (!keepAnnotationEditorLayer || !this.annotationEditorLayer.div)) {
      if (this.drawLayer) {
        this.drawLayer.cancel();
        this.drawLayer = null;
      }
      this.annotationEditorLayer.cancel();
      this.annotationEditorLayer = null;
    }
    if (this.xfaLayer && (!keepXfaLayer || !this.xfaLayer.div)) {
      var _this$_textHighlighte;
      this.xfaLayer.cancel();
      this.xfaLayer = null;
      (_this$_textHighlighte = this._textHighlighter) === null || _this$_textHighlighte === void 0 ? void 0 : _this$_textHighlighte.disable();
    }
  }
  cssTransform({
    target,
    redrawAnnotationLayer = false,
    redrawAnnotationEditorLayer = false,
    redrawXfaLayer = false,
    redrawTextLayer = false,
    hideTextLayer = false
  }) {
    // Scale target (canvas), its wrapper and page container.
    if ((typeof PDFJSDev === "undefined" || PDFJSDev.test("TESTING")) && !(target instanceof HTMLCanvasElement)) {
      throw new Error("Expected `target` to be a canvas.");
    }
    if (!target.hasAttribute("zooming")) {
      target.setAttribute("zooming", true);
      const {
        style
      } = target;
      style.width = style.height = "";
    }
    const originalViewport = this.#viewportMap.get(target);
    if (this.viewport !== originalViewport) {
      // The canvas may have been originally rotated; rotate relative to that.
      const relativeRotation = this.viewport.rotation - originalViewport.rotation;
      const absRotation = Math.abs(relativeRotation);
      let scaleX = 1,
        scaleY = 1;
      if (absRotation === 90 || absRotation === 270) {
        const {
          width,
          height
        } = this.viewport;
        // Scale x and y because of the rotation.
        scaleX = height / width;
        scaleY = width / height;
      }
      target.style.transform = `rotate(${relativeRotation}deg) scale(${scaleX}, ${scaleY})`;
    }
    if (redrawAnnotationLayer && this.annotationLayer) {
      this.#renderAnnotationLayer();
    }
    if (redrawAnnotationEditorLayer && this.annotationEditorLayer) {
      if (this.drawLayer) {
        this.#renderDrawLayer();
      }
      this.#renderAnnotationEditorLayer();
    }
    if (redrawXfaLayer && this.xfaLayer) {
      this.#renderXfaLayer();
    }
    if (this.textLayer) {
      if (hideTextLayer) {
        var _this$structTreeLayer4;
        this.textLayer.hide();
        (_this$structTreeLayer4 = this.structTreeLayer) === null || _this$structTreeLayer4 === void 0 ? void 0 : _this$structTreeLayer4.hide();
      } else if (redrawTextLayer) {
        this.#renderTextLayer();
      }
    }
  }
  get width() {
    return this.viewport.width;
  }
  get height() {
    return this.viewport.height;
  }
  getPagePoint(x, y) {
    return this.viewport.convertToPdfPoint(x, y);
  }
  async #finishRenderTask(renderTask, error = null) {
    // The renderTask may have been replaced by a new one, so only remove
    // the reference to the renderTask if it matches the one that is
    // triggering this callback.
    if (renderTask === this.renderTask) {
      this.renderTask = null;
    }
    if (error instanceof RenderingCancelledException) {
      this.#renderError = null;
      return;
    }
    this.#renderError = error;
    this.renderingState = RenderingStates.FINISHED;
    this._resetZoomLayer(/* removeFromDOM = */true);

    // Ensure that the thumbnails won't become partially (or fully) blank,
    // for documents that contain interactive form elements.
    this.#useThumbnailCanvas.regularAnnotations = !renderTask.separateAnnots;
    this.eventBus.dispatch("pagerendered", {
      source: this,
      pageNumber: this.id,
      cssTransform: false,
      timestamp: performance.now(),
      error: this.#renderError
    });
    if (error) {
      throw error;
    }
  }
  async draw() {
    if (this.renderingState !== RenderingStates.INITIAL) {
      console.error("Must be in new state before drawing");
      this.reset(); // Ensure that we reset all state to prevent issues.
    }
    const {
      div,
      l10n,
      pageColors,
      pdfPage,
      viewport
    } = this;
    if (!pdfPage) {
      this.renderingState = RenderingStates.FINISHED;
      throw new Error("pdfPage is not loaded");
    }
    this.renderingState = RenderingStates.RUNNING;

    // Wrap the canvas so that if it has a CSS transform for high DPI the
    // overflow will be hidden in Firefox.
    const canvasWrapper = document.createElement("div");
    canvasWrapper.classList.add("canvasWrapper");
    canvasWrapper.setAttribute("aria-hidden", true);
    this.#addLayer(canvasWrapper, "canvasWrapper");
    if (!this.textLayer && this.#textLayerMode !== TextLayerMode.DISABLE && !pdfPage.isPureXfa) {
      this._accessibilityManager || (this._accessibilityManager = new TextAccessibilityManager());
      this.textLayer = new TextLayerBuilder({
        highlighter: this._textHighlighter,
        accessibilityManager: this._accessibilityManager,
        enablePermissions: this.#textLayerMode === TextLayerMode.ENABLE_PERMISSIONS,
        onAppend: textLayerDiv => {
          // Pause translation when inserting the textLayer in the DOM.
          this.l10n.pause();
          this.#addLayer(textLayerDiv, "textLayer");
          this.l10n.resume();
        }
      });
    }
    if (!this.annotationLayer && this.#annotationMode !== AnnotationMode.DISABLE) {
      const {
        annotationStorage,
        annotationEditorUIManager,
        downloadManager,
        enableScripting,
        fieldObjectsPromise,
        hasJSActionsPromise,
        linkService
      } = this.#layerProperties;
      this._annotationCanvasMap || (this._annotationCanvasMap = new Map());
      this.annotationLayer = new AnnotationLayerBuilder({
        pdfPage,
        annotationStorage,
        imageResourcesPath: this.imageResourcesPath,
        renderForms: this.#annotationMode === AnnotationMode.ENABLE_FORMS,
        linkService,
        downloadManager,
        enableScripting,
        hasJSActionsPromise,
        fieldObjectsPromise,
        annotationCanvasMap: this._annotationCanvasMap,
        accessibilityManager: this._accessibilityManager,
        annotationEditorUIManager,
        onAppend: annotationLayerDiv => {
          this.#addLayer(annotationLayerDiv, "annotationLayer");
        }
      });
    }
    const renderContinueCallback = cont => {
      var _showCanvas;
      (_showCanvas = showCanvas) === null || _showCanvas === void 0 ? void 0 : _showCanvas(false);
      if (this.renderingQueue && !this.renderingQueue.isHighestPriority(this)) {
        this.renderingState = RenderingStates.PAUSED;
        this.resume = () => {
          this.renderingState = RenderingStates.RUNNING;
          cont();
        };
        return;
      }
      cont();
    };
    const {
      width,
      height
    } = viewport;
    const canvas = document.createElement("canvas");
    canvas.setAttribute("role", "presentation");

    // Keep the canvas hidden until the first draw callback, or until drawing
    // is complete when `!this.renderingQueue`, to prevent black flickering.
    canvas.hidden = true;
    const hasHCM = !!(pageColors !== null && pageColors !== void 0 && pageColors.background && pageColors !== null && pageColors !== void 0 && pageColors.foreground);
    let showCanvas = isLastShow => {
      // In HCM, a final filter is applied on the canvas which means that
      // before it's applied we've normal colors. Consequently, to avoid to have
      // a final flash we just display it once all the drawing is done.
      if (!hasHCM || isLastShow) {
        canvas.hidden = false;
        showCanvas = null; // Only invoke the function once.
      }
    };
    canvasWrapper.append(canvas);
    this.canvas = canvas;
    const ctx = canvas.getContext("2d", {
      alpha: false
    });
    const outputScale = this.outputScale = new OutputScale();
    if ((typeof PDFJSDev === "undefined" || PDFJSDev.test("GENERIC")) && this.maxCanvasPixels === 0) {
      const invScale = 1 / this.scale;
      // Use a scale that makes the canvas have the originally intended size
      // of the page.
      outputScale.sx *= invScale;
      outputScale.sy *= invScale;
      this.#hasRestrictedScaling = true;
    } else if (this.maxCanvasPixels > 0) {
      const pixelsInViewport = width * height;
      const maxScale = Math.sqrt(this.maxCanvasPixels / pixelsInViewport);
      if (outputScale.sx > maxScale || outputScale.sy > maxScale) {
        outputScale.sx = maxScale;
        outputScale.sy = maxScale;
        this.#hasRestrictedScaling = true;
      } else {
        this.#hasRestrictedScaling = false;
      }
    }
    const sfx = approximateFraction(outputScale.sx);
    const sfy = approximateFraction(outputScale.sy);
    canvas.width = roundToDivide(width * outputScale.sx, sfx[0]);
    canvas.height = roundToDivide(height * outputScale.sy, sfy[0]);
    const {
      style
    } = canvas;
    style.width = roundToDivide(width, sfx[1]) + "px";
    style.height = roundToDivide(height, sfy[1]) + "px";

    // Add the viewport so it's known what it was originally drawn with.
    this.#viewportMap.set(canvas, viewport);

    // Rendering area
    const transform = outputScale.scaled ? [outputScale.sx, 0, 0, outputScale.sy, 0, 0] : null;
    const renderContext = {
      canvasContext: ctx,
      transform,
      viewport,
      annotationMode: this.#annotationMode,
      optionalContentConfigPromise: this._optionalContentConfigPromise,
      annotationCanvasMap: this._annotationCanvasMap,
      pageColors
    };
    const renderTask = this.renderTask = this.pdfPage.render(renderContext);
    renderTask.onContinue = renderContinueCallback;
    const resultPromise = renderTask.promise.then(async () => {
      var _showCanvas2;
      (_showCanvas2 = showCanvas) === null || _showCanvas2 === void 0 ? void 0 : _showCanvas2(true);
      await this.#finishRenderTask(renderTask);
      this.#renderTextLayer();
      if (this.annotationLayer) {
        await this.#renderAnnotationLayer();
      }
      const {
        annotationEditorUIManager
      } = this.#layerProperties;
      if (!annotationEditorUIManager) {
        return;
      }
      this.drawLayer || (this.drawLayer = new DrawLayerBuilder({
        pageIndex: this.id
      }));
      await this.#renderDrawLayer();
      this.drawLayer.setParent(canvasWrapper);
      if (!this.annotationEditorLayer) {
        var _this$annotationLayer2;
        this.annotationEditorLayer = new AnnotationEditorLayerBuilder({
          uiManager: annotationEditorUIManager,
          pdfPage,
          l10n,
          accessibilityManager: this._accessibilityManager,
          annotationLayer: (_this$annotationLayer2 = this.annotationLayer) === null || _this$annotationLayer2 === void 0 ? void 0 : _this$annotationLayer2.annotationLayer,
          textLayer: this.textLayer,
          drawLayer: this.drawLayer.getDrawLayer(),
          onAppend: annotationEditorLayerDiv => {
            this.#addLayer(annotationEditorLayerDiv, "annotationEditorLayer");
          }
        });
      }
      this.#renderAnnotationEditorLayer();
    }, error => {
      // When zooming with a `drawingDelay` set, avoid temporarily showing
      // a black canvas if rendering was cancelled before the `onContinue`-
      // callback had been invoked at least once.
      if (!(error instanceof RenderingCancelledException)) {
        var _showCanvas3;
        (_showCanvas3 = showCanvas) === null || _showCanvas3 === void 0 ? void 0 : _showCanvas3(true);
      }
      return this.#finishRenderTask(renderTask, error);
    });
    if (pdfPage.isPureXfa) {
      if (!this.xfaLayer) {
        const {
          annotationStorage,
          linkService
        } = this.#layerProperties;
        this.xfaLayer = new XfaLayerBuilder({
          pdfPage,
          annotationStorage,
          linkService
        });
      }
      this.#renderXfaLayer();
    }
    div.setAttribute("data-loaded", true);
    this.eventBus.dispatch("pagerender", {
      source: this,
      pageNumber: this.id
    });
    return resultPromise;
  }

  /**
   * @param {string|null} label
   */
  setPageLabel(label) {
    var _this$pageLabel;
    this.pageLabel = typeof label === "string" ? label : null;
    this.div.setAttribute("data-l10n-args", JSON.stringify({
      page: (_this$pageLabel = this.pageLabel) !== null && _this$pageLabel !== void 0 ? _this$pageLabel : this.id
    }));
    if (this.pageLabel !== null) {
      this.div.setAttribute("data-page-label", this.pageLabel);
    } else {
      this.div.removeAttribute("data-page-label");
    }
  }

  /**
   * For use by the `PDFThumbnailView.setImage`-method.
   * @ignore
   */
  get thumbnailCanvas() {
    const {
      directDrawing,
      initialOptionalContent,
      regularAnnotations
    } = this.#useThumbnailCanvas;
    return directDrawing && initialOptionalContent && regularAnnotations ? this.canvas : null;
  }
}

/* Copyright 2014 Mozilla Foundation
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
const DEFAULT_CACHE_SIZE = 10;
const PagesCountLimit = {
  FORCE_SCROLL_MODE_PAGE: 15000,
  FORCE_LAZY_PAGE_INIT: 7500,
  PAUSE_EAGER_PAGE_INIT: 250
};
function isValidAnnotationEditorMode(mode) {
  return Object.values(AnnotationEditorType).includes(mode) && mode !== AnnotationEditorType.DISABLE;
}

/**
 * @typedef {Object} PDFViewerOptions
 * @property {HTMLDivElement} container - The container for the viewer element.
 * @property {HTMLDivElement} [viewer] - The viewer element.
 * @property {EventBus} eventBus - The application event bus.
 * @property {IPDFLinkService} [linkService] - The navigation/linking service.
 * @property {IDownloadManager} [downloadManager] - The download manager
 *   component.
 * @property {PDFFindController} [findController] - The find controller
 *   component.
 * @property {PDFScriptingManager} [scriptingManager] - The scripting manager
 *   component.
 * @property {PDFRenderingQueue} [renderingQueue] - The rendering queue object.
 * @property {boolean} [removePageBorders] - Removes the border shadow around
 *   the pages. The default value is `false`.
 * @property {number} [textLayerMode] - Controls if the text layer used for
 *   selection and searching is created. The constants from {TextLayerMode}
 *   should be used. The default value is `TextLayerMode.ENABLE`.
 * @property {number} [annotationMode] - Controls if the annotation layer is
 *   created, and if interactive form elements or `AnnotationStorage`-data are
 *   being rendered. The constants from {@link AnnotationMode} should be used;
 *   see also {@link RenderParameters} and {@link GetOperatorListParameters}.
 *   The default value is `AnnotationMode.ENABLE_FORMS`.
 * @property {number} [annotationEditorMode] - Enables the creation and editing
 *   of new Annotations. The constants from {@link AnnotationEditorType} should
 *   be used. The default value is `AnnotationEditorType.NONE`.
 * @property {string} [annotationEditorHighlightColors] - A comma separated list
 *   of colors to propose to highlight some text in the pdf.
 * @property {string} [imageResourcesPath] - Path for image resources, mainly
 *   mainly for annotation icons. Include trailing slash.
 * @property {boolean} [enablePrintAutoRotate] - Enables automatic rotation of
 *   landscape pages upon printing. The default is `false`.
 * @property {number} [maxCanvasPixels] - The maximum supported canvas size in
 *   total pixels, i.e. width * height. Use `-1` for no limit, or `0` for
 *   CSS-only zooming. The default value is 4096 * 8192 (32 mega-pixels).
 * @property {IL10n} [l10n] - Localization service.
 * @property {boolean} [enablePermissions] - Enables PDF document permissions,
 *   when they exist. The default value is `false`.
 * @property {Object} [pageColors] - Overwrites background and foreground colors
 *   with user defined ones in order to improve readability in high contrast
 *   mode.
 */

class PDFPageViewBuffer {
  // Here we rely on the fact that `Set`s preserve the insertion order.
  #buf = new Set();
  #size = 0;
  constructor(size) {
    this.#size = size;
  }
  push(view) {
    const buf = this.#buf;
    if (buf.has(view)) {
      buf.delete(view); // Move the view to the "end" of the buffer.
    }
    buf.add(view);
    if (buf.size > this.#size) {
      this.#destroyFirstView();
    }
  }

  /**
   * After calling resize, the size of the buffer will be `newSize`.
   * The optional parameter `idsToKeep` is, if present, a Set of page-ids to
   * push to the back of the buffer, delaying their destruction. The size of
   * `idsToKeep` has no impact on the final size of the buffer; if `idsToKeep`
   * is larger than `newSize`, some of those pages will be destroyed anyway.
   */
  resize(newSize, idsToKeep = null) {
    this.#size = newSize;
    const buf = this.#buf;
    if (idsToKeep) {
      const ii = buf.size;
      let i = 1;
      for (const view of buf) {
        if (idsToKeep.has(view.id)) {
          buf.delete(view); // Move the view to the "end" of the buffer.
          buf.add(view);
        }
        if (++i > ii) {
          break;
        }
      }
    }
    while (buf.size > this.#size) {
      this.#destroyFirstView();
    }
  }
  has(view) {
    return this.#buf.has(view);
  }
  [Symbol.iterator]() {
    return this.#buf.keys();
  }
  #destroyFirstView() {
    const firstView = this.#buf.keys().next().value;
    firstView === null || firstView === void 0 ? void 0 : firstView.destroy();
    this.#buf.delete(firstView);
  }
}

/**
 * Simple viewer control to display PDF content/pages.
 */
class PDFViewer {
  #buffer = null;
  #altTextManager = null;
  #annotationEditorHighlightColors = null;
  #annotationEditorMode = AnnotationEditorType.NONE;
  #annotationEditorUIManager = null;
  #annotationMode = AnnotationMode.ENABLE_FORMS;
  #containerTopLeft = null;
  #copyCallbackBound = null;
  #enableHighlightFloatingButton = false;
  #enablePermissions = false;
  #mlManager = null;
  #getAllTextInProgress = false;
  #hiddenCopyElement = null;
  #interruptCopyCondition = false;
  #previousContainerHeight = 0;
  #resizeObserver = new ResizeObserver(this.#resizeObserverCallback.bind(this));
  #scrollModePageState = null;
  #onVisibilityChange = null;
  #scaleTimeoutId = null;
  #textLayerMode = TextLayerMode.ENABLE;

  /**
   * @param {PDFViewerOptions} options
   */
  constructor(options) {
    var _options$textLayerMod, _options$annotationMo, _options$annotationEd;
    const viewerVersion = typeof PDFJSDev !== "undefined" ? PDFJSDev.eval("BUNDLE_VERSION") : null;
    if (version !== viewerVersion) {
      throw new Error(`The API version "${version}" does not match the Viewer version "${viewerVersion}".`);
    }
    this.container = options.container;
    this.viewer = options.viewer || options.container.firstElementChild;
    if (typeof PDFJSDev === "undefined" || PDFJSDev.test("GENERIC")) {
      var _this$container, _this$viewer;
      if (((_this$container = this.container) === null || _this$container === void 0 ? void 0 : _this$container.tagName) !== "DIV" || ((_this$viewer = this.viewer) === null || _this$viewer === void 0 ? void 0 : _this$viewer.tagName) !== "DIV") {
        throw new Error("Invalid `container` and/or `viewer` option.");
      }
      if (this.container.offsetParent && getComputedStyle(this.container).position !== "absolute") {
        throw new Error("The `container` must be absolutely positioned.");
      }
    }
    this.#resizeObserver.observe(this.container);
    this.eventBus = options.eventBus;
    this.linkService = options.linkService || new SimpleLinkService();
    this.downloadManager = options.downloadManager || null;
    this.findController = options.findController || null;
    this.#altTextManager = options.altTextManager || null;
    if (this.findController) {
      this.findController.onIsPageVisible = pageNumber => this._getVisiblePages().ids.has(pageNumber);
    }
    this._scriptingManager = options.scriptingManager || null;
    this.#textLayerMode = (_options$textLayerMod = options.textLayerMode) !== null && _options$textLayerMod !== void 0 ? _options$textLayerMod : TextLayerMode.ENABLE;
    this.#annotationMode = (_options$annotationMo = options.annotationMode) !== null && _options$annotationMo !== void 0 ? _options$annotationMo : AnnotationMode.ENABLE_FORMS;
    this.#annotationEditorMode = (_options$annotationEd = options.annotationEditorMode) !== null && _options$annotationEd !== void 0 ? _options$annotationEd : AnnotationEditorType.NONE;
    this.#annotationEditorHighlightColors = options.annotationEditorHighlightColors || null;
    this.#enableHighlightFloatingButton = options.enableHighlightFloatingButton === true;
    this.imageResourcesPath = options.imageResourcesPath || "";
    this.enablePrintAutoRotate = options.enablePrintAutoRotate || false;
    if (typeof PDFJSDev === "undefined" || PDFJSDev.test("GENERIC")) {
      this.removePageBorders = options.removePageBorders || false;
    }
    this.maxCanvasPixels = options.maxCanvasPixels;
    this.l10n = options.l10n;
    if (typeof PDFJSDev === "undefined" || PDFJSDev.test("GENERIC")) {
      this.l10n || (this.l10n = new GenericL10n());
    }
    this.#enablePermissions = options.enablePermissions || false;
    this.pageColors = options.pageColors || null;
    this.#mlManager = options.mlManager || null;
    this.defaultRenderingQueue = !options.renderingQueue;
    if ((typeof PDFJSDev === "undefined" || PDFJSDev.test("GENERIC")) && this.defaultRenderingQueue) {
      // Custom rendering queue is not specified, using default one
      this.renderingQueue = new PDFRenderingQueue();
      this.renderingQueue.setViewer(this);
    } else {
      this.renderingQueue = options.renderingQueue;
    }
    this.scroll = watchScroll(this.container, this._scrollUpdate.bind(this));
    this.presentationModeState = PresentationModeState.UNKNOWN;
    this._onBeforeDraw = this._onAfterDraw = null;
    this._resetView();
    if ((typeof PDFJSDev === "undefined" || PDFJSDev.test("GENERIC")) && this.removePageBorders) {
      this.viewer.classList.add("removePageBorders");
    }
    this.#updateContainerHeightCss();

    // Trigger API-cleanup, once thumbnail rendering has finished,
    // if the relevant pageView is *not* cached in the buffer.
    this.eventBus._on("thumbnailrendered", ({
      pageNumber,
      pdfPage
    }) => {
      const pageView = this._pages[pageNumber - 1];
      if (!this.#buffer.has(pageView)) {
        pdfPage === null || pdfPage === void 0 ? void 0 : pdfPage.cleanup();
      }
    });
    if ((typeof PDFJSDev === "undefined" || PDFJSDev.test("GENERIC")) && !options.l10n) {
      // Ensure that Fluent is connected in e.g. the COMPONENTS build.
      this.l10n.translate(this.container);
    }
  }
  get pagesCount() {
    return this._pages.length;
  }
  getPageView(index) {
    return this._pages[index];
  }
  getCachedPageViews() {
    return new Set(this.#buffer);
  }

  /**
   * @type {boolean} - True if all {PDFPageView} objects are initialized.
   */
  get pageViewsReady() {
    // Prevent printing errors when 'disableAutoFetch' is set, by ensuring
    // that *all* pages have in fact been completely loaded.
    return this._pages.every(pageView => pageView === null || pageView === void 0 ? void 0 : pageView.pdfPage);
  }

  /**
   * @type {boolean}
   */
  get renderForms() {
    return this.#annotationMode === AnnotationMode.ENABLE_FORMS;
  }

  /**
   * @type {boolean}
   */
  get enableScripting() {
    return !!this._scriptingManager;
  }

  /**
   * @type {number}
   */
  get currentPageNumber() {
    return this._currentPageNumber;
  }

  /**
   * @param {number} val - The page number.
   */
  set currentPageNumber(val) {
    if (!Number.isInteger(val)) {
      throw new Error("Invalid page number.");
    }
    if (!this.pdfDocument) {
      return;
    }
    // The intent can be to just reset a scroll position and/or scale.
    if (!this._setCurrentPageNumber(val, /* resetCurrentPageView = */true)) {
      console.error(`currentPageNumber: "${val}" is not a valid page.`);
    }
  }

  /**
   * @returns {boolean} Whether the pageNumber is valid (within bounds).
   * @private
   */
  _setCurrentPageNumber(val, resetCurrentPageView = false) {
    var _this$_pageLabels, _this$_pageLabels2;
    if (this._currentPageNumber === val) {
      if (resetCurrentPageView) {
        this.#resetCurrentPageView();
      }
      return true;
    }
    if (!(0 < val && val <= this.pagesCount)) {
      return false;
    }
    const previous = this._currentPageNumber;
    this._currentPageNumber = val;
    this.eventBus.dispatch("pagechanging", {
      source: this,
      pageNumber: val,
      pageLabel: (_this$_pageLabels = (_this$_pageLabels2 = this._pageLabels) === null || _this$_pageLabels2 === void 0 ? void 0 : _this$_pageLabels2[val - 1]) !== null && _this$_pageLabels !== void 0 ? _this$_pageLabels : null,
      previous
    });
    if (resetCurrentPageView) {
      this.#resetCurrentPageView();
    }
    return true;
  }

  /**
   * @type {string|null} Returns the current page label, or `null` if no page
   *   labels exist.
   */
  get currentPageLabel() {
    var _this$_pageLabels3, _this$_pageLabels4;
    return (_this$_pageLabels3 = (_this$_pageLabels4 = this._pageLabels) === null || _this$_pageLabels4 === void 0 ? void 0 : _this$_pageLabels4[this._currentPageNumber - 1]) !== null && _this$_pageLabels3 !== void 0 ? _this$_pageLabels3 : null;
  }

  /**
   * @param {string} val - The page label.
   */
  set currentPageLabel(val) {
    if (!this.pdfDocument) {
      return;
    }
    let page = val | 0; // Fallback page number.
    if (this._pageLabels) {
      const i = this._pageLabels.indexOf(val);
      if (i >= 0) {
        page = i + 1;
      }
    }
    // The intent can be to just reset a scroll position and/or scale.
    if (!this._setCurrentPageNumber(page, /* resetCurrentPageView = */true)) {
      console.error(`currentPageLabel: "${val}" is not a valid page.`);
    }
  }

  /**
   * @type {number}
   */
  get currentScale() {
    return this._currentScale !== UNKNOWN_SCALE ? this._currentScale : DEFAULT_SCALE;
  }

  /**
   * @param {number} val - Scale of the pages in percents.
   */
  set currentScale(val) {
    if (isNaN(val)) {
      throw new Error("Invalid numeric scale.");
    }
    if (!this.pdfDocument) {
      return;
    }
    this.#setScale(val, {
      noScroll: false
    });
  }

  /**
   * @type {string}
   */
  get currentScaleValue() {
    return this._currentScaleValue;
  }

  /**
   * @param val - The scale of the pages (in percent or predefined value).
   */
  set currentScaleValue(val) {
    if (!this.pdfDocument) {
      return;
    }
    this.#setScale(val, {
      noScroll: false
    });
  }

  /**
   * @type {number}
   */
  get pagesRotation() {
    return this._pagesRotation;
  }

  /**
   * @param {number} rotation - The rotation of the pages (0, 90, 180, 270).
   */
  set pagesRotation(rotation) {
    if (!isValidRotation(rotation)) {
      throw new Error("Invalid pages rotation angle.");
    }
    if (!this.pdfDocument) {
      return;
    }
    // Normalize the rotation, by clamping it to the [0, 360) range.
    rotation %= 360;
    if (rotation < 0) {
      rotation += 360;
    }
    if (this._pagesRotation === rotation) {
      return; // The rotation didn't change.
    }
    this._pagesRotation = rotation;
    const pageNumber = this._currentPageNumber;
    this.refresh(true, {
      rotation
    });

    // Prevent errors in case the rotation changes *before* the scale has been
    // set to a non-default value.
    if (this._currentScaleValue) {
      this.#setScale(this._currentScaleValue, {
        noScroll: true
      });
    }
    this.eventBus.dispatch("rotationchanging", {
      source: this,
      pagesRotation: rotation,
      pageNumber
    });
    if (this.defaultRenderingQueue) {
      this.update();
    }
  }
  get firstPagePromise() {
    return this.pdfDocument ? this._firstPageCapability.promise : null;
  }
  get onePageRendered() {
    return this.pdfDocument ? this._onePageRenderedCapability.promise : null;
  }
  get pagesPromise() {
    return this.pdfDocument ? this._pagesCapability.promise : null;
  }
  get _layerProperties() {
    const self = this;
    return shadow(this, "_layerProperties", {
      get annotationEditorUIManager() {
        return self.#annotationEditorUIManager;
      },
      get annotationStorage() {
        var _self$pdfDocument;
        return (_self$pdfDocument = self.pdfDocument) === null || _self$pdfDocument === void 0 ? void 0 : _self$pdfDocument.annotationStorage;
      },
      get downloadManager() {
        return self.downloadManager;
      },
      get enableScripting() {
        return !!self._scriptingManager;
      },
      get fieldObjectsPromise() {
        var _self$pdfDocument2;
        return (_self$pdfDocument2 = self.pdfDocument) === null || _self$pdfDocument2 === void 0 ? void 0 : _self$pdfDocument2.getFieldObjects();
      },
      get findController() {
        return self.findController;
      },
      get hasJSActionsPromise() {
        var _self$pdfDocument3;
        return (_self$pdfDocument3 = self.pdfDocument) === null || _self$pdfDocument3 === void 0 ? void 0 : _self$pdfDocument3.hasJSActions();
      },
      get linkService() {
        return self.linkService;
      }
    });
  }

  /**
   * Currently only *some* permissions are supported.
   * @returns {Object}
   */
  #initializePermissions(permissions) {
    const params = {
      annotationEditorMode: this.#annotationEditorMode,
      annotationMode: this.#annotationMode,
      textLayerMode: this.#textLayerMode
    };
    if (!permissions) {
      return params;
    }
    if (!permissions.includes(PermissionFlag.COPY) && this.#textLayerMode === TextLayerMode.ENABLE) {
      params.textLayerMode = TextLayerMode.ENABLE_PERMISSIONS;
    }
    if (!permissions.includes(PermissionFlag.MODIFY_CONTENTS)) {
      params.annotationEditorMode = AnnotationEditorType.DISABLE;
    }
    if (!permissions.includes(PermissionFlag.MODIFY_ANNOTATIONS) && !permissions.includes(PermissionFlag.FILL_INTERACTIVE_FORMS) && this.#annotationMode === AnnotationMode.ENABLE_FORMS) {
      params.annotationMode = AnnotationMode.ENABLE;
    }
    return params;
  }
  async #onePageRenderedOrForceFetch() {
    // Unless the viewer *and* its pages are visible, rendering won't start and
    // `this._onePageRenderedCapability` thus won't be resolved.
    // To ensure that automatic printing, on document load, still works even in
    // those cases we force-allow fetching of all pages when:
    //  - The current window/tab is inactive, which will prevent rendering since
    //    `requestAnimationFrame` is being used; fixes bug 1746213.
    //  - The viewer is hidden in the DOM, e.g. in a `display: none` <iframe>
    //    element; fixes bug 1618621.
    //  - The viewer is visible, but none of the pages are (e.g. if the
    //    viewer is very small); fixes bug 1618955.
    if (document.visibilityState === "hidden" || !this.container.offsetParent || this._getVisiblePages().views.length === 0) {
      return;
    }

    // Handle the window/tab becoming inactive *after* rendering has started;
    // fixes (another part of) bug 1746213.
    const visibilityChangePromise = new Promise(resolve => {
      this.#onVisibilityChange = () => {
        if (document.visibilityState !== "hidden") {
          return;
        }
        resolve();
      };
      document.addEventListener("visibilitychange", this.#onVisibilityChange);
    });
    await Promise.race([this._onePageRenderedCapability.promise, visibilityChangePromise]);
    // Ensure that the "visibilitychange" listener is always removed.
    document.removeEventListener("visibilitychange", this.#onVisibilityChange);
    this.#onVisibilityChange = null;
  }
  async getAllText() {
    const texts = [];
    const buffer = [];
    for (let pageNum = 1, pagesCount = this.pdfDocument.numPages; pageNum <= pagesCount; ++pageNum) {
      if (this.#interruptCopyCondition) {
        return null;
      }
      buffer.length = 0;
      const page = await this.pdfDocument.getPage(pageNum);
      // By default getTextContent pass disableNormalization equals to false
      // which is fine because we want a normalized string.
      const {
        items
      } = await page.getTextContent();
      for (const item of items) {
        if (item.str) {
          buffer.push(item.str);
        }
        if (item.hasEOL) {
          buffer.push("\n");
        }
      }
      texts.push(removeNullCharacters(buffer.join("")));
    }
    return texts.join("\n");
  }
  #copyCallback(textLayerMode, event) {
    const selection = document.getSelection();
    const {
      focusNode,
      anchorNode
    } = selection;
    if (anchorNode && focusNode && selection.containsNode(this.#hiddenCopyElement)) {
      // About the condition above:
      //  - having non-null anchorNode and focusNode are here to guaranty that
      //    we have at least a kind of selection.
      //  - this.#hiddenCopyElement is an invisible element which is impossible
      //    to select manually (its display is none) but ctrl+A will select all
      //    including this element so having it in the selection means that all
      //    has been selected.

      if (this.#getAllTextInProgress || textLayerMode === TextLayerMode.ENABLE_PERMISSIONS) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      this.#getAllTextInProgress = true;

      // TODO: if all the pages are rendered we don't need to wait for
      // getAllText and we could just get text from the Selection object.

      // Select all the document.
      const savedCursor = this.container.style.cursor;
      this.container.style.cursor = "wait";
      const interruptCopy = ev => this.#interruptCopyCondition = ev.key === "Escape";
      window.addEventListener("keydown", interruptCopy);
      this.getAllText().then(async text => {
        if (text !== null) {
          await navigator.clipboard.writeText(text);
        }
      }).catch(reason => {
        console.warn(`Something goes wrong when extracting the text: ${reason.message}`);
      }).finally(() => {
        this.#getAllTextInProgress = false;
        this.#interruptCopyCondition = false;
        window.removeEventListener("keydown", interruptCopy);
        this.container.style.cursor = savedCursor;
      });
      event.preventDefault();
      event.stopPropagation();
    }
  }

  /**
   * @param {PDFDocumentProxy} pdfDocument
   */
  setDocument(pdfDocument) {
    if (this.pdfDocument) {
      var _this$findController, _this$_scriptingManag;
      this.eventBus.dispatch("pagesdestroy", {
        source: this
      });
      this._cancelRendering();
      this._resetView();
      (_this$findController = this.findController) === null || _this$findController === void 0 ? void 0 : _this$findController.setDocument(null);
      (_this$_scriptingManag = this._scriptingManager) === null || _this$_scriptingManag === void 0 ? void 0 : _this$_scriptingManag.setDocument(null);
      if (this.#annotationEditorUIManager) {
        this.#annotationEditorUIManager.destroy();
        this.#annotationEditorUIManager = null;
      }
    }
    this.pdfDocument = pdfDocument;
    if (!pdfDocument) {
      return;
    }
    const pagesCount = pdfDocument.numPages;
    const firstPagePromise = pdfDocument.getPage(1);
    // Rendering (potentially) depends on this, hence fetching it immediately.
    const optionalContentConfigPromise = pdfDocument.getOptionalContentConfig({
      intent: "display"
    });
    const permissionsPromise = this.#enablePermissions ? pdfDocument.getPermissions() : Promise.resolve();

    // Given that browsers don't handle huge amounts of DOM-elements very well,
    // enforce usage of PAGE-scrolling when loading *very* long/large documents.
    if (pagesCount > PagesCountLimit.FORCE_SCROLL_MODE_PAGE) {
      console.warn("Forcing PAGE-scrolling for performance reasons, given the length of the document.");
      const mode = this._scrollMode = ScrollMode.PAGE;
      this.eventBus.dispatch("scrollmodechanged", {
        source: this,
        mode
      });
    }
    this._pagesCapability.promise.then(() => {
      this.eventBus.dispatch("pagesloaded", {
        source: this,
        pagesCount
      });
    }, () => {
      /* Prevent "Uncaught (in promise)"-messages in the console. */
    });
    this._onBeforeDraw = evt => {
      const pageView = this._pages[evt.pageNumber - 1];
      if (!pageView) {
        return;
      }
      // Add the page to the buffer at the start of drawing. That way it can be
      // evicted from the buffer and destroyed even if we pause its rendering.
      this.#buffer.push(pageView);
    };
    this.eventBus._on("pagerender", this._onBeforeDraw);
    this._onAfterDraw = evt => {
      if (evt.cssTransform) {
        return;
      }
      this._onePageRenderedCapability.resolve({
        timestamp: evt.timestamp
      });
      this.eventBus._off("pagerendered", this._onAfterDraw);
      this._onAfterDraw = null;
    };
    this.eventBus._on("pagerendered", this._onAfterDraw);

    // Fetch a single page so we can get a viewport that will be the default
    // viewport for all pages
    Promise.all([firstPagePromise, permissionsPromise]).then(([firstPdfPage, permissions]) => {
      var _this$pageColors, _this$pageColors2, _this$_pages$;
      if (pdfDocument !== this.pdfDocument) {
        return; // The document was closed while the first page resolved.
      }
      this._firstPageCapability.resolve(firstPdfPage);
      this._optionalContentConfigPromise = optionalContentConfigPromise;
      const {
        annotationEditorMode,
        annotationMode,
        textLayerMode
      } = this.#initializePermissions(permissions);
      if (textLayerMode !== TextLayerMode.DISABLE) {
        const element = this.#hiddenCopyElement = document.createElement("div");
        element.id = "hiddenCopyElement";
        this.viewer.before(element);
      }
      if (annotationEditorMode !== AnnotationEditorType.DISABLE) {
        const mode = annotationEditorMode;
        if (pdfDocument.isPureXfa) {
          console.warn("Warning: XFA-editing is not implemented.");
        } else if (isValidAnnotationEditorMode(mode)) {
          this.#annotationEditorUIManager = new AnnotationEditorUIManager(this.container, this.viewer, this.#altTextManager, this.eventBus, pdfDocument, this.pageColors, this.#annotationEditorHighlightColors, this.#enableHighlightFloatingButton, this.#mlManager);
          this.eventBus.dispatch("annotationeditoruimanager", {
            source: this,
            uiManager: this.#annotationEditorUIManager
          });
          if (mode !== AnnotationEditorType.NONE) {
            this.#annotationEditorUIManager.updateMode(mode);
          }
        } else {
          console.error(`Invalid AnnotationEditor mode: ${mode}`);
        }
      }
      const viewerElement = this._scrollMode === ScrollMode.PAGE ? null : this.viewer;
      const scale = this.currentScale;
      const viewport = firstPdfPage.getViewport({
        scale: scale * PixelsPerInch.PDF_TO_CSS_UNITS
      });
      // Ensure that the various layers always get the correct initial size,
      // see issue 15795.
      this.viewer.style.setProperty("--scale-factor", viewport.scale);
      if (((_this$pageColors = this.pageColors) === null || _this$pageColors === void 0 ? void 0 : _this$pageColors.foreground) === "CanvasText" || ((_this$pageColors2 = this.pageColors) === null || _this$pageColors2 === void 0 ? void 0 : _this$pageColors2.background) === "Canvas") {
        this.viewer.style.setProperty("--hcm-highlight-filter", pdfDocument.filterFactory.addHighlightHCMFilter("highlight", "CanvasText", "Canvas", "HighlightText", "Highlight"));
        this.viewer.style.setProperty("--hcm-highlight-selected-filter", pdfDocument.filterFactory.addHighlightHCMFilter("highlight_selected", "CanvasText", "Canvas", "HighlightText", "ButtonText"));
      }
      for (let pageNum = 1; pageNum <= pagesCount; ++pageNum) {
        const pageView = new PDFPageView({
          container: viewerElement,
          eventBus: this.eventBus,
          id: pageNum,
          scale,
          defaultViewport: viewport.clone(),
          optionalContentConfigPromise,
          renderingQueue: this.renderingQueue,
          textLayerMode,
          annotationMode,
          imageResourcesPath: this.imageResourcesPath,
          maxCanvasPixels: this.maxCanvasPixels,
          pageColors: this.pageColors,
          l10n: this.l10n,
          layerProperties: this._layerProperties
        });
        this._pages.push(pageView);
      }
      // Set the first `pdfPage` immediately, since it's already loaded,
      // rather than having to repeat the `PDFDocumentProxy.getPage` call in
      // the `this.#ensurePdfPageLoaded` method before rendering can start.
      (_this$_pages$ = this._pages[0]) === null || _this$_pages$ === void 0 ? void 0 : _this$_pages$.setPdfPage(firstPdfPage);
      if (this._scrollMode === ScrollMode.PAGE) {
        // Ensure that the current page becomes visible on document load.
        this.#ensurePageViewVisible();
      } else if (this._spreadMode !== SpreadMode.NONE) {
        this._updateSpreadMode();
      }

      // Fetch all the pages since the viewport is needed before printing
      // starts to create the correct size canvas. Wait until one page is
      // rendered so we don't tie up too many resources early on.
      this.#onePageRenderedOrForceFetch().then(async () => {
        var _this$findController2, _this$_scriptingManag2;
        (_this$findController2 = this.findController) === null || _this$findController2 === void 0 ? void 0 : _this$findController2.setDocument(pdfDocument); // Enable searching.
        (_this$_scriptingManag2 = this._scriptingManager) === null || _this$_scriptingManag2 === void 0 ? void 0 : _this$_scriptingManag2.setDocument(pdfDocument); // Enable scripting.

        if (this.#hiddenCopyElement) {
          this.#copyCallbackBound = this.#copyCallback.bind(this, textLayerMode);
          document.addEventListener("copy", this.#copyCallbackBound);
        }
        if (this.#annotationEditorUIManager) {
          // Ensure that the Editor buttons, in the toolbar, are updated.
          this.eventBus.dispatch("annotationeditormodechanged", {
            source: this,
            mode: this.#annotationEditorMode
          });
        }

        // In addition to 'disableAutoFetch' being set, also attempt to reduce
        // resource usage when loading *very* long/large documents.
        if (pdfDocument.loadingParams.disableAutoFetch || pagesCount > PagesCountLimit.FORCE_LAZY_PAGE_INIT) {
          // XXX: Printing is semi-broken with auto fetch disabled.
          this._pagesCapability.resolve();
          return;
        }
        let getPagesLeft = pagesCount - 1; // The first page was already loaded.

        if (getPagesLeft <= 0) {
          this._pagesCapability.resolve();
          return;
        }
        for (let pageNum = 2; pageNum <= pagesCount; ++pageNum) {
          const promise = pdfDocument.getPage(pageNum).then(pdfPage => {
            const pageView = this._pages[pageNum - 1];
            if (!pageView.pdfPage) {
              pageView.setPdfPage(pdfPage);
            }
            if (--getPagesLeft === 0) {
              this._pagesCapability.resolve();
            }
          }, reason => {
            console.error(`Unable to get page ${pageNum} to initialize viewer`, reason);
            if (--getPagesLeft === 0) {
              this._pagesCapability.resolve();
            }
          });
          if (pageNum % PagesCountLimit.PAUSE_EAGER_PAGE_INIT === 0) {
            await promise;
          }
        }
      });
      this.eventBus.dispatch("pagesinit", {
        source: this
      });
      pdfDocument.getMetadata().then(({
        info
      }) => {
        if (pdfDocument !== this.pdfDocument) {
          return; // The document was closed while the metadata resolved.
        }
        if (info.Language) {
          this.viewer.lang = info.Language;
        }
      });
      if (this.defaultRenderingQueue) {
        this.update();
      }
    }).catch(reason => {
      console.error("Unable to initialize viewer", reason);
      this._pagesCapability.reject(reason);
    });
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
      console.error(`setPageLabels: Invalid page labels.`);
    } else {
      this._pageLabels = labels;
    }
    // Update all the `PDFPageView` instances.
    for (let i = 0, ii = this._pages.length; i < ii; i++) {
      var _this$_pageLabels$i, _this$_pageLabels5;
      this._pages[i].setPageLabel((_this$_pageLabels$i = (_this$_pageLabels5 = this._pageLabels) === null || _this$_pageLabels5 === void 0 ? void 0 : _this$_pageLabels5[i]) !== null && _this$_pageLabels$i !== void 0 ? _this$_pageLabels$i : null);
    }
  }
  _resetView() {
    this._pages = [];
    this._currentPageNumber = 1;
    this._currentScale = UNKNOWN_SCALE;
    this._currentScaleValue = null;
    this._pageLabels = null;
    this.#buffer = new PDFPageViewBuffer(DEFAULT_CACHE_SIZE);
    this._location = null;
    this._pagesRotation = 0;
    this._optionalContentConfigPromise = null;
    this._firstPageCapability = Promise.withResolvers();
    this._onePageRenderedCapability = Promise.withResolvers();
    this._pagesCapability = Promise.withResolvers();
    this._scrollMode = ScrollMode.VERTICAL;
    this._previousScrollMode = ScrollMode.UNKNOWN;
    this._spreadMode = SpreadMode.NONE;
    this.#scrollModePageState = {
      previousPageNumber: 1,
      scrollDown: true,
      pages: []
    };
    if (this._onBeforeDraw) {
      this.eventBus._off("pagerender", this._onBeforeDraw);
      this._onBeforeDraw = null;
    }
    if (this._onAfterDraw) {
      this.eventBus._off("pagerendered", this._onAfterDraw);
      this._onAfterDraw = null;
    }
    if (this.#onVisibilityChange) {
      document.removeEventListener("visibilitychange", this.#onVisibilityChange);
      this.#onVisibilityChange = null;
    }
    // Remove the pages from the DOM...
    this.viewer.textContent = "";
    // ... and reset the Scroll mode CSS class(es) afterwards.
    this._updateScrollMode();
    this.viewer.removeAttribute("lang");
    if (this.#hiddenCopyElement) {
      document.removeEventListener("copy", this.#copyCallbackBound);
      this.#copyCallbackBound = null;
      this.#hiddenCopyElement.remove();
      this.#hiddenCopyElement = null;
    }
  }
  #ensurePageViewVisible() {
    if (this._scrollMode !== ScrollMode.PAGE) {
      throw new Error("#ensurePageViewVisible: Invalid scrollMode value.");
    }
    const pageNumber = this._currentPageNumber,
      state = this.#scrollModePageState,
      viewer = this.viewer;

    // Temporarily remove all the pages from the DOM...
    viewer.textContent = "";
    // ... and clear out the active ones.
    state.pages.length = 0;
    if (this._spreadMode === SpreadMode.NONE && !this.isInPresentationMode) {
      // Finally, append the new page to the viewer.
      const pageView = this._pages[pageNumber - 1];
      viewer.append(pageView.div);
      state.pages.push(pageView);
    } else {
      const pageIndexSet = new Set(),
        parity = this._spreadMode - 1;

      // Determine the pageIndices in the new spread.
      if (parity === -1) {
        // PresentationMode is active, with `SpreadMode.NONE` set.
        pageIndexSet.add(pageNumber - 1);
      } else if (pageNumber % 2 !== parity) {
        // Left-hand side page.
        pageIndexSet.add(pageNumber - 1);
        pageIndexSet.add(pageNumber);
      } else {
        // Right-hand side page.
        pageIndexSet.add(pageNumber - 2);
        pageIndexSet.add(pageNumber - 1);
      }

      // Finally, append the new pages to the viewer and apply the spreadMode.
      const spread = document.createElement("div");
      spread.className = "spread";
      if (this.isInPresentationMode) {
        const dummyPage = document.createElement("div");
        dummyPage.className = "dummyPage";
        spread.append(dummyPage);
      }
      for (const i of pageIndexSet) {
        const pageView = this._pages[i];
        if (!pageView) {
          continue;
        }
        spread.append(pageView.div);
        state.pages.push(pageView);
      }
      viewer.append(spread);
    }
    state.scrollDown = pageNumber >= state.previousPageNumber;
    state.previousPageNumber = pageNumber;
  }
  _scrollUpdate() {
    if (this.pagesCount === 0) {
      return;
    }
    this.update();
  }
  #scrollIntoView(pageView, pageSpot = null) {
    const {
      div,
      id
    } = pageView;

    // Ensure that `this._currentPageNumber` is correct, when `#scrollIntoView`
    // is called directly (and not from `#resetCurrentPageView`).
    if (this._currentPageNumber !== id) {
      this._setCurrentPageNumber(id);
    }
    if (this._scrollMode === ScrollMode.PAGE) {
      this.#ensurePageViewVisible();
      // Ensure that rendering always occurs, to avoid showing a blank page,
      // even if the current position doesn't change when the page is scrolled.
      this.update();
    }
    if (!pageSpot && !this.isInPresentationMode) {
      const left = div.offsetLeft + div.clientLeft,
        right = left + div.clientWidth;
      const {
        scrollLeft,
        clientWidth
      } = this.container;
      if (this._scrollMode === ScrollMode.HORIZONTAL || left < scrollLeft || right > scrollLeft + clientWidth) {
        pageSpot = {
          left: 0,
          top: 0
        };
      }
    }
    scrollIntoView(div, pageSpot);

    // Ensure that the correct *initial* document position is set, when any
    // OpenParameters are used, for documents with non-default Scroll/Spread
    // modes (fixes issue 15695). This is necessary since the scroll-handler
    // invokes the `update`-method asynchronously, and `this._location` could
    // thus be wrong when the initial zooming occurs in the default viewer.
    if (!this._currentScaleValue && this._location) {
      this._location = null;
    }
  }

  /**
   * Prevent unnecessary re-rendering of all pages when the scale changes
   * only because of limited numerical precision.
   */
  #isSameScale(newScale) {
    return newScale === this._currentScale || Math.abs(newScale - this._currentScale) < 1e-15;
  }
  #setScaleUpdatePages(newScale, newValue, {
    noScroll = false,
    preset = false,
    drawingDelay = -1
  }) {
    this._currentScaleValue = newValue.toString();
    if (this.#isSameScale(newScale)) {
      if (preset) {
        this.eventBus.dispatch("scalechanging", {
          source: this,
          scale: newScale,
          presetValue: newValue
        });
      }
      return;
    }
    this.viewer.style.setProperty("--scale-factor", newScale * PixelsPerInch.PDF_TO_CSS_UNITS);
    const postponeDrawing = drawingDelay >= 0 && drawingDelay < 1000;
    this.refresh(true, {
      scale: newScale,
      drawingDelay: postponeDrawing ? drawingDelay : -1
    });
    if (postponeDrawing) {
      this.#scaleTimeoutId = setTimeout(() => {
        this.#scaleTimeoutId = null;
        this.refresh();
      }, drawingDelay);
    }
    this._currentScale = newScale;
    if (!noScroll) {
      let page = this._currentPageNumber,
        dest;
      if (this._location && !(this.isInPresentationMode || this.isChangingPresentationMode)) {
        page = this._location.pageNumber;
        dest = [null, {
          name: "XYZ"
        }, this._location.left, this._location.top, null];
      }
      this.scrollPageIntoView({
        pageNumber: page,
        destArray: dest,
        allowNegativeOffset: true
      });
    }
    this.eventBus.dispatch("scalechanging", {
      source: this,
      scale: newScale,
      presetValue: preset ? newValue : undefined
    });
    if (this.defaultRenderingQueue) {
      this.update();
    }
  }
  get #pageWidthScaleFactor() {
    if (this._spreadMode !== SpreadMode.NONE && this._scrollMode !== ScrollMode.HORIZONTAL) {
      return 2;
    }
    return 1;
  }
  #setScale(value, options) {
    let scale = parseFloat(value);
    if (scale > 0) {
      options.preset = false;
      this.#setScaleUpdatePages(scale, value, options);
    } else {
      const currentPage = this._pages[this._currentPageNumber - 1];
      if (!currentPage) {
        return;
      }
      let hPadding = SCROLLBAR_PADDING,
        vPadding = VERTICAL_PADDING;
      if (this.isInPresentationMode) {
        // Pages have a 2px (transparent) border in PresentationMode, see
        // the `web/pdf_viewer.css` file.
        hPadding = vPadding = 4; // 2 * 2px
        if (this._spreadMode !== SpreadMode.NONE) {
          // Account for two pages being visible in PresentationMode, thus
          // "doubling" the total border width.
          hPadding *= 2;
        }
      } else if ((typeof PDFJSDev === "undefined" || PDFJSDev.test("GENERIC")) && this.removePageBorders) {
        hPadding = vPadding = 0;
      } else if (this._scrollMode === ScrollMode.HORIZONTAL) {
        [hPadding, vPadding] = [vPadding, hPadding]; // Swap the padding values.
      }
      const pageWidthScale = (this.container.clientWidth - hPadding) / currentPage.width * currentPage.scale / this.#pageWidthScaleFactor;
      const pageHeightScale = (this.container.clientHeight - vPadding) / currentPage.height * currentPage.scale;
      switch (value) {
        case "page-actual":
          scale = 1;
          break;
        case "page-width":
          scale = pageWidthScale;
          break;
        case "page-height":
          scale = pageHeightScale;
          break;
        case "page-fit":
          scale = Math.min(pageWidthScale, pageHeightScale);
          break;
        case "auto":
          // For pages in landscape mode, fit the page height to the viewer
          // *unless* the page would thus become too wide to fit horizontally.
          const horizontalScale = isPortraitOrientation(currentPage) ? pageWidthScale : Math.min(pageHeightScale, pageWidthScale);
          scale = Math.min(MAX_AUTO_SCALE, horizontalScale);
          break;
        default:
          console.error(`#setScale: "${value}" is an unknown zoom value.`);
          return;
      }
      options.preset = true;
      this.#setScaleUpdatePages(scale, value, options);
    }
  }

  /**
   * Refreshes page view: scrolls to the current page and updates the scale.
   */
  #resetCurrentPageView() {
    const pageView = this._pages[this._currentPageNumber - 1];
    if (this.isInPresentationMode) {
      // Fixes the case when PDF has different page sizes.
      this.#setScale(this._currentScaleValue, {
        noScroll: true
      });
    }
    this.#scrollIntoView(pageView);
  }

  /**
   * @param {string} label - The page label.
   * @returns {number|null} The page number corresponding to the page label,
   *   or `null` when no page labels exist and/or the input is invalid.
   */
  pageLabelToPageNumber(label) {
    if (!this._pageLabels) {
      return null;
    }
    const i = this._pageLabels.indexOf(label);
    if (i < 0) {
      return null;
    }
    return i + 1;
  }

  /**
   * @typedef {Object} ScrollPageIntoViewParameters
   * @property {number} pageNumber - The page number.
   * @property {Array} [destArray] - The original PDF destination array, in the
   *   format: <page-ref> </XYZ|/FitXXX> <args..>
   * @property {boolean} [allowNegativeOffset] - Allow negative page offsets.
   *   The default value is `false`.
   * @property {boolean} [ignoreDestinationZoom] - Ignore the zoom argument in
   *   the destination array. The default value is `false`.
   */

  /**
   * Scrolls page into view.
   * @param {ScrollPageIntoViewParameters} params
   */
  scrollPageIntoView({
    pageNumber,
    destArray = null,
    allowNegativeOffset = false,
    ignoreDestinationZoom = false
  }) {
    if (!this.pdfDocument) {
      return;
    }
    const pageView = Number.isInteger(pageNumber) && this._pages[pageNumber - 1];
    if (!pageView) {
      console.error(`scrollPageIntoView: "${pageNumber}" is not a valid pageNumber parameter.`);
      return;
    }
    if (this.isInPresentationMode || !destArray) {
      this._setCurrentPageNumber(pageNumber, /* resetCurrentPageView = */true);
      return;
    }
    let x = 0,
      y = 0;
    let width = 0,
      height = 0,
      widthScale,
      heightScale;
    const changeOrientation = pageView.rotation % 180 !== 0;
    const pageWidth = (changeOrientation ? pageView.height : pageView.width) / pageView.scale / PixelsPerInch.PDF_TO_CSS_UNITS;
    const pageHeight = (changeOrientation ? pageView.width : pageView.height) / pageView.scale / PixelsPerInch.PDF_TO_CSS_UNITS;
    let scale = 0;
    switch (destArray[1].name) {
      case "XYZ":
        x = destArray[2];
        y = destArray[3];
        scale = destArray[4];
        // If x and/or y coordinates are not supplied, default to
        // _top_ left of the page (not the obvious bottom left,
        // since aligning the bottom of the intended page with the
        // top of the window is rarely helpful).
        x = x !== null ? x : 0;
        y = y !== null ? y : pageHeight;
        break;
      case "Fit":
      case "FitB":
        scale = "page-fit";
        break;
      case "FitH":
      case "FitBH":
        y = destArray[2];
        scale = "page-width";
        // According to the PDF spec, section 12.3.2.2, a `null` value in the
        // parameter should maintain the position relative to the new page.
        if (y === null && this._location) {
          x = this._location.left;
          y = this._location.top;
        } else if (typeof y !== "number" || y < 0) {
          // The "top" value isn't optional, according to the spec, however some
          // bad PDF generators will pretend that it is (fixes bug 1663390).
          y = pageHeight;
        }
        break;
      case "FitV":
      case "FitBV":
        x = destArray[2];
        width = pageWidth;
        height = pageHeight;
        scale = "page-height";
        break;
      case "FitR":
        x = destArray[2];
        y = destArray[3];
        width = destArray[4] - x;
        height = destArray[5] - y;
        let hPadding = SCROLLBAR_PADDING,
          vPadding = VERTICAL_PADDING;
        if ((typeof PDFJSDev === "undefined" || PDFJSDev.test("GENERIC")) && this.removePageBorders) {
          hPadding = vPadding = 0;
        }
        widthScale = (this.container.clientWidth - hPadding) / width / PixelsPerInch.PDF_TO_CSS_UNITS;
        heightScale = (this.container.clientHeight - vPadding) / height / PixelsPerInch.PDF_TO_CSS_UNITS;
        scale = Math.min(Math.abs(widthScale), Math.abs(heightScale));
        break;
      default:
        console.error(`scrollPageIntoView: "${destArray[1].name}" is not a valid destination type.`);
        return;
    }
    if (!ignoreDestinationZoom) {
      if (scale && scale !== this._currentScale) {
        this.currentScaleValue = scale;
      } else if (this._currentScale === UNKNOWN_SCALE) {
        this.currentScaleValue = DEFAULT_SCALE_VALUE;
      }
    }
    if (scale === "page-fit" && !destArray[4]) {
      this.#scrollIntoView(pageView);
      return;
    }
    const boundingRect = [pageView.viewport.convertToViewportPoint(x, y), pageView.viewport.convertToViewportPoint(x + width, y + height)];
    let left = Math.min(boundingRect[0][0], boundingRect[1][0]);
    let top = Math.min(boundingRect[0][1], boundingRect[1][1]);
    if (!allowNegativeOffset) {
      // Some bad PDF generators will create destinations with e.g. top values
      // that exceeds the page height. Ensure that offsets are not negative,
      // to prevent a previous page from becoming visible (fixes bug 874482).
      left = Math.max(left, 0);
      top = Math.max(top, 0);
    }
    this.#scrollIntoView(pageView, /* pageSpot = */{
      left,
      top
    });
  }
  _updateLocation(firstPage) {
    const currentScale = this._currentScale;
    const currentScaleValue = this._currentScaleValue;
    const normalizedScaleValue = parseFloat(currentScaleValue) === currentScale ? Math.round(currentScale * 10000) / 100 : currentScaleValue;
    const pageNumber = firstPage.id;
    const currentPageView = this._pages[pageNumber - 1];
    const container = this.container;
    const topLeft = currentPageView.getPagePoint(container.scrollLeft - firstPage.x, container.scrollTop - firstPage.y);
    const intLeft = Math.round(topLeft[0]);
    const intTop = Math.round(topLeft[1]);
    let pdfOpenParams = `#page=${pageNumber}`;
    if (!this.isInPresentationMode) {
      pdfOpenParams += `&zoom=${normalizedScaleValue},${intLeft},${intTop}`;
    }
    this._location = {
      pageNumber,
      scale: normalizedScaleValue,
      top: intTop,
      left: intLeft,
      rotation: this._pagesRotation,
      pdfOpenParams
    };
  }
  update() {
    const visible = this._getVisiblePages();
    const visiblePages = visible.views,
      numVisiblePages = visiblePages.length;
    if (numVisiblePages === 0) {
      return;
    }
    const newCacheSize = Math.max(DEFAULT_CACHE_SIZE, 2 * numVisiblePages + 1);
    this.#buffer.resize(newCacheSize, visible.ids);
    this.renderingQueue.renderHighestPriority(visible);
    const isSimpleLayout = this._spreadMode === SpreadMode.NONE && (this._scrollMode === ScrollMode.PAGE || this._scrollMode === ScrollMode.VERTICAL);
    const currentId = this._currentPageNumber;
    let stillFullyVisible = false;
    for (const page of visiblePages) {
      if (page.percent < 100) {
        break;
      }
      if (page.id === currentId && isSimpleLayout) {
        stillFullyVisible = true;
        break;
      }
    }
    this._setCurrentPageNumber(stillFullyVisible ? currentId : visiblePages[0].id);
    this._updateLocation(visible.first);
    this.eventBus.dispatch("updateviewarea", {
      source: this,
      location: this._location
    });
  }
  containsElement(element) {
    return this.container.contains(element);
  }
  focus() {
    this.container.focus();
  }
  get _isContainerRtl() {
    return getComputedStyle(this.container).direction === "rtl";
  }
  get isInPresentationMode() {
    return this.presentationModeState === PresentationModeState.FULLSCREEN;
  }
  get isChangingPresentationMode() {
    return this.presentationModeState === PresentationModeState.CHANGING;
  }
  get isHorizontalScrollbarEnabled() {
    return this.isInPresentationMode ? false : this.container.scrollWidth > this.container.clientWidth;
  }
  get isVerticalScrollbarEnabled() {
    return this.isInPresentationMode ? false : this.container.scrollHeight > this.container.clientHeight;
  }
  _getVisiblePages() {
    const views = this._scrollMode === ScrollMode.PAGE ? this.#scrollModePageState.pages : this._pages,
      horizontal = this._scrollMode === ScrollMode.HORIZONTAL,
      rtl = horizontal && this._isContainerRtl;
    return getVisibleElements({
      scrollEl: this.container,
      views,
      sortByVisibility: true,
      horizontal,
      rtl
    });
  }
  cleanup() {
    for (const pageView of this._pages) {
      if (pageView.renderingState !== RenderingStates.FINISHED) {
        pageView.reset();
      }
    }
  }

  /**
   * @private
   */
  _cancelRendering() {
    for (const pageView of this._pages) {
      pageView.cancelRendering();
    }
  }

  /**
   * @param {PDFPageView} pageView
   * @returns {Promise<PDFPageProxy | null>}
   */
  async #ensurePdfPageLoaded(pageView) {
    if (pageView.pdfPage) {
      return pageView.pdfPage;
    }
    try {
      const pdfPage = await this.pdfDocument.getPage(pageView.id);
      if (!pageView.pdfPage) {
        pageView.setPdfPage(pdfPage);
      }
      return pdfPage;
    } catch (reason) {
      console.error("Unable to get page for page view", reason);
      return null; // Page error -- there is nothing that can be done.
    }
  }
  #getScrollAhead(visible) {
    var _visible$first, _visible$last;
    if (((_visible$first = visible.first) === null || _visible$first === void 0 ? void 0 : _visible$first.id) === 1) {
      return true;
    } else if (((_visible$last = visible.last) === null || _visible$last === void 0 ? void 0 : _visible$last.id) === this.pagesCount) {
      return false;
    }
    switch (this._scrollMode) {
      case ScrollMode.PAGE:
        return this.#scrollModePageState.scrollDown;
      case ScrollMode.HORIZONTAL:
        return this.scroll.right;
    }
    return this.scroll.down;
  }
  forceRendering(currentlyVisiblePages) {
    const visiblePages = currentlyVisiblePages || this._getVisiblePages();
    const scrollAhead = this.#getScrollAhead(visiblePages);
    const preRenderExtra = this._spreadMode !== SpreadMode.NONE && this._scrollMode !== ScrollMode.HORIZONTAL;
    const pageView = this.renderingQueue.getHighestPriority(visiblePages, this._pages, scrollAhead, preRenderExtra);
    if (pageView) {
      this.#ensurePdfPageLoaded(pageView).then(() => {
        this.renderingQueue.renderView(pageView);
      });
      return true;
    }
    return false;
  }

  /**
   * @type {boolean} Whether all pages of the PDF document have identical
   *   widths and heights.
   */
  get hasEqualPageSizes() {
    const firstPageView = this._pages[0];
    for (let i = 1, ii = this._pages.length; i < ii; ++i) {
      const pageView = this._pages[i];
      if (pageView.width !== firstPageView.width || pageView.height !== firstPageView.height) {
        return false;
      }
    }
    return true;
  }

  /**
   * Returns sizes of the pages.
   * @returns {Array} Array of objects with width/height/rotation fields.
   */
  getPagesOverview() {
    let initialOrientation;
    return this._pages.map(pageView => {
      const viewport = pageView.pdfPage.getViewport({
        scale: 1
      });
      const orientation = isPortraitOrientation(viewport);
      if (initialOrientation === undefined) {
        initialOrientation = orientation;
      } else if (this.enablePrintAutoRotate && orientation !== initialOrientation) {
        // Rotate to fit the initial orientation.
        return {
          width: viewport.height,
          height: viewport.width,
          rotation: (viewport.rotation - 90) % 360
        };
      }
      return {
        width: viewport.width,
        height: viewport.height,
        rotation: viewport.rotation
      };
    });
  }

  /**
   * @type {Promise<OptionalContentConfig | null>}
   */
  get optionalContentConfigPromise() {
    if (!this.pdfDocument) {
      return Promise.resolve(null);
    }
    if (!this._optionalContentConfigPromise) {
      console.error("optionalContentConfigPromise: Not initialized yet.");
      // Prevent issues if the getter is accessed *before* the `onePageRendered`
      // promise has resolved; won't (normally) happen in the default viewer.
      return this.pdfDocument.getOptionalContentConfig({
        intent: "display"
      });
    }
    return this._optionalContentConfigPromise;
  }

  /**
   * @param {Promise<OptionalContentConfig>} promise - A promise that is
   *   resolved with an {@link OptionalContentConfig} instance.
   */
  set optionalContentConfigPromise(promise) {
    if (!(promise instanceof Promise)) {
      throw new Error(`Invalid optionalContentConfigPromise: ${promise}`);
    }
    if (!this.pdfDocument) {
      return;
    }
    if (!this._optionalContentConfigPromise) {
      // Ignore the setter *before* the `onePageRendered` promise has resolved,
      // since it'll be overwritten anyway; won't happen in the default viewer.
      return;
    }
    this._optionalContentConfigPromise = promise;
    this.refresh(false, {
      optionalContentConfigPromise: promise
    });
    this.eventBus.dispatch("optionalcontentconfigchanged", {
      source: this,
      promise
    });
  }

  /**
   * @type {number} One of the values in {ScrollMode}.
   */
  get scrollMode() {
    return this._scrollMode;
  }

  /**
   * @param {number} mode - The direction in which the document pages should be
   *   laid out within the scrolling container.
   *   The constants from {ScrollMode} should be used.
   */
  set scrollMode(mode) {
    if (typeof PDFJSDev === "undefined" ? window.isGECKOVIEW : PDFJSDev.test("GECKOVIEW")) {
      // NOTE: Always ignore the pageLayout in GeckoView since there's
      // no UI available to change Scroll/Spread modes for the user.
      return;
    }
    if (this._scrollMode === mode) {
      return; // The Scroll mode didn't change.
    }
    if (!isValidScrollMode(mode)) {
      throw new Error(`Invalid scroll mode: ${mode}`);
    }
    if (this.pagesCount > PagesCountLimit.FORCE_SCROLL_MODE_PAGE) {
      return; // Disabled for performance reasons.
    }
    this._previousScrollMode = this._scrollMode;
    this._scrollMode = mode;
    this.eventBus.dispatch("scrollmodechanged", {
      source: this,
      mode
    });
    this._updateScrollMode(/* pageNumber = */this._currentPageNumber);
  }
  _updateScrollMode(pageNumber = null) {
    const scrollMode = this._scrollMode,
      viewer = this.viewer;
    viewer.classList.toggle("scrollHorizontal", scrollMode === ScrollMode.HORIZONTAL);
    viewer.classList.toggle("scrollWrapped", scrollMode === ScrollMode.WRAPPED);
    if (!this.pdfDocument || !pageNumber) {
      return;
    }
    if (scrollMode === ScrollMode.PAGE) {
      this.#ensurePageViewVisible();
    } else if (this._previousScrollMode === ScrollMode.PAGE) {
      // Ensure that the current spreadMode is still applied correctly when
      // the *previous* scrollMode was `ScrollMode.PAGE`.
      this._updateSpreadMode();
    }
    // Non-numeric scale values can be sensitive to the scroll orientation.
    // Call this before re-scrolling to the current page, to ensure that any
    // changes in scale don't move the current page.
    if (this._currentScaleValue && isNaN(this._currentScaleValue)) {
      this.#setScale(this._currentScaleValue, {
        noScroll: true
      });
    }
    this._setCurrentPageNumber(pageNumber, /* resetCurrentPageView = */true);
    this.update();
  }

  /**
   * @type {number} One of the values in {SpreadMode}.
   */
  get spreadMode() {
    return this._spreadMode;
  }

  /**
   * @param {number} mode - Group the pages in spreads, starting with odd- or
   *   even-number pages (unless `SpreadMode.NONE` is used).
   *   The constants from {SpreadMode} should be used.
   */
  set spreadMode(mode) {
    if (typeof PDFJSDev === "undefined" ? window.isGECKOVIEW : PDFJSDev.test("GECKOVIEW")) {
      // NOTE: Always ignore the pageLayout in GeckoView since there's
      // no UI available to change Scroll/Spread modes for the user.
      return;
    }
    if (this._spreadMode === mode) {
      return; // The Spread mode didn't change.
    }
    if (!isValidSpreadMode(mode)) {
      throw new Error(`Invalid spread mode: ${mode}`);
    }
    this._spreadMode = mode;
    this.eventBus.dispatch("spreadmodechanged", {
      source: this,
      mode
    });
    this._updateSpreadMode(/* pageNumber = */this._currentPageNumber);
  }
  _updateSpreadMode(pageNumber = null) {
    if (!this.pdfDocument) {
      return;
    }
    const viewer = this.viewer,
      pages = this._pages;
    if (this._scrollMode === ScrollMode.PAGE) {
      this.#ensurePageViewVisible();
    } else {
      // Temporarily remove all the pages from the DOM.
      viewer.textContent = "";
      if (this._spreadMode === SpreadMode.NONE) {
        for (const pageView of this._pages) {
          viewer.append(pageView.div);
        }
      } else {
        const parity = this._spreadMode - 1;
        let spread = null;
        for (let i = 0, ii = pages.length; i < ii; ++i) {
          if (spread === null) {
            spread = document.createElement("div");
            spread.className = "spread";
            viewer.append(spread);
          } else if (i % 2 === parity) {
            spread = spread.cloneNode(false);
            viewer.append(spread);
          }
          spread.append(pages[i].div);
        }
      }
    }
    if (!pageNumber) {
      return;
    }
    // Non-numeric scale values can be sensitive to the scroll orientation.
    // Call this before re-scrolling to the current page, to ensure that any
    // changes in scale don't move the current page.
    if (this._currentScaleValue && isNaN(this._currentScaleValue)) {
      this.#setScale(this._currentScaleValue, {
        noScroll: true
      });
    }
    this._setCurrentPageNumber(pageNumber, /* resetCurrentPageView = */true);
    this.update();
  }

  /**
   * @private
   */
  _getPageAdvance(currentPageNumber, previous = false) {
    switch (this._scrollMode) {
      case ScrollMode.WRAPPED:
        {
          const {
              views
            } = this._getVisiblePages(),
            pageLayout = new Map();

          // Determine the current (visible) page layout.
          for (const {
            id,
            y,
            percent,
            widthPercent
          } of views) {
            if (percent === 0 || widthPercent < 100) {
              continue;
            }
            let yArray = pageLayout.get(y);
            if (!yArray) {
              pageLayout.set(y, yArray || (yArray = []));
            }
            yArray.push(id);
          }
          // Find the row of the current page.
          for (const yArray of pageLayout.values()) {
            const currentIndex = yArray.indexOf(currentPageNumber);
            if (currentIndex === -1) {
              continue;
            }
            const numPages = yArray.length;
            if (numPages === 1) {
              break;
            }
            // Handle documents with varying page sizes.
            if (previous) {
              for (let i = currentIndex - 1, ii = 0; i >= ii; i--) {
                const currentId = yArray[i],
                  expectedId = yArray[i + 1] - 1;
                if (currentId < expectedId) {
                  return currentPageNumber - expectedId;
                }
              }
            } else {
              for (let i = currentIndex + 1, ii = numPages; i < ii; i++) {
                const currentId = yArray[i],
                  expectedId = yArray[i - 1] + 1;
                if (currentId > expectedId) {
                  return expectedId - currentPageNumber;
                }
              }
            }
            // The current row is "complete", advance to the previous/next one.
            if (previous) {
              const firstId = yArray[0];
              if (firstId < currentPageNumber) {
                return currentPageNumber - firstId + 1;
              }
            } else {
              const lastId = yArray[numPages - 1];
              if (lastId > currentPageNumber) {
                return lastId - currentPageNumber + 1;
              }
            }
            break;
          }
          break;
        }
      case ScrollMode.HORIZONTAL:
        {
          break;
        }
      case ScrollMode.PAGE:
      case ScrollMode.VERTICAL:
        {
          if (this._spreadMode === SpreadMode.NONE) {
            break; // Normal vertical scrolling.
          }
          const parity = this._spreadMode - 1;
          if (previous && currentPageNumber % 2 !== parity) {
            break; // Left-hand side page.
          } else if (!previous && currentPageNumber % 2 === parity) {
            break; // Right-hand side page.
          }
          const {
              views
            } = this._getVisiblePages(),
            expectedId = previous ? currentPageNumber - 1 : currentPageNumber + 1;
          for (const {
            id,
            percent,
            widthPercent
          } of views) {
            if (id !== expectedId) {
              continue;
            }
            if (percent > 0 && widthPercent === 100) {
              return 2;
            }
            break;
          }
          break;
        }
    }
    return 1;
  }

  /**
   * Go to the next page, taking scroll/spread-modes into account.
   * @returns {boolean} Whether navigation occurred.
   */
  nextPage() {
    const currentPageNumber = this._currentPageNumber,
      pagesCount = this.pagesCount;
    if (currentPageNumber >= pagesCount) {
      return false;
    }
    const advance = this._getPageAdvance(currentPageNumber, /* previous = */false) || 1;
    this.currentPageNumber = Math.min(currentPageNumber + advance, pagesCount);
    return true;
  }

  /**
   * Go to the previous page, taking scroll/spread-modes into account.
   * @returns {boolean} Whether navigation occurred.
   */
  previousPage() {
    const currentPageNumber = this._currentPageNumber;
    if (currentPageNumber <= 1) {
      return false;
    }
    const advance = this._getPageAdvance(currentPageNumber, /* previous = */true) || 1;
    this.currentPageNumber = Math.max(currentPageNumber - advance, 1);
    return true;
  }

  /**
   * @typedef {Object} ChangeScaleOptions
   * @property {number} [drawingDelay]
   * @property {number} [scaleFactor]
   * @property {number} [steps]
   */

  /**
   * Increase the current zoom level one, or more, times.
   * @param {ChangeScaleOptions} [options]
   */
  increaseScale({
    drawingDelay,
    scaleFactor,
    steps
  } = {}) {
    if (!this.pdfDocument) {
      return;
    }
    let newScale = this._currentScale;
    if (scaleFactor > 1) {
      newScale = Math.round(newScale * scaleFactor * 100) / 100;
    } else {
      var _steps;
      (_steps = steps) !== null && _steps !== void 0 ? _steps : steps = 1;
      do {
        newScale = Math.ceil((newScale * DEFAULT_SCALE_DELTA).toFixed(2) * 10) / 10;
      } while (--steps > 0 && newScale < MAX_SCALE);
    }
    this.#setScale(Math.min(MAX_SCALE, newScale), {
      noScroll: false,
      drawingDelay
    });
  }

  /**
   * Decrease the current zoom level one, or more, times.
   * @param {ChangeScaleOptions} [options]
   */
  decreaseScale({
    drawingDelay,
    scaleFactor,
    steps
  } = {}) {
    if (!this.pdfDocument) {
      return;
    }
    let newScale = this._currentScale;
    if (scaleFactor > 0 && scaleFactor < 1) {
      newScale = Math.round(newScale * scaleFactor * 100) / 100;
    } else {
      var _steps2;
      (_steps2 = steps) !== null && _steps2 !== void 0 ? _steps2 : steps = 1;
      do {
        newScale = Math.floor((newScale / DEFAULT_SCALE_DELTA).toFixed(2) * 10) / 10;
      } while (--steps > 0 && newScale > MIN_SCALE);
    }
    this.#setScale(Math.max(MIN_SCALE, newScale), {
      noScroll: false,
      drawingDelay
    });
  }
  #updateContainerHeightCss(height = this.container.clientHeight) {
    if (height !== this.#previousContainerHeight) {
      this.#previousContainerHeight = height;
      docStyle.setProperty("--viewer-container-height", `${height}px`);
    }
  }
  #resizeObserverCallback(entries) {
    for (const entry of entries) {
      if (entry.target === this.container) {
        this.#updateContainerHeightCss(Math.floor(entry.borderBoxSize[0].blockSize));
        this.#containerTopLeft = null;
        break;
      }
    }
  }
  get containerTopLeft() {
    return this.#containerTopLeft || (this.#containerTopLeft = [this.container.offsetTop, this.container.offsetLeft]);
  }
  get annotationEditorMode() {
    return this.#annotationEditorUIManager ? this.#annotationEditorMode : AnnotationEditorType.DISABLE;
  }

  /**
   * @typedef {Object} AnnotationEditorModeOptions
   * @property {number} mode - The editor mode (none, FreeText, ink, ...).
   * @property {string|null} [editId] - ID of the existing annotation to edit.
   * @property {boolean} [isFromKeyboard] - True if the mode change is due to a
   *   keyboard action.
   */

  /**
   * @param {AnnotationEditorModeOptions} options
   */
  set annotationEditorMode({
    mode,
    editId = null,
    isFromKeyboard = false
  }) {
    if (!this.#annotationEditorUIManager) {
      throw new Error(`The AnnotationEditor is not enabled.`);
    }
    if (this.#annotationEditorMode === mode) {
      return; // The AnnotationEditor mode didn't change.
    }
    if (!isValidAnnotationEditorMode(mode)) {
      throw new Error(`Invalid AnnotationEditor mode: ${mode}`);
    }
    if (!this.pdfDocument) {
      return;
    }
    this.#annotationEditorMode = mode;
    this.eventBus.dispatch("annotationeditormodechanged", {
      source: this,
      mode
    });
    this.#annotationEditorUIManager.updateMode(mode, editId, isFromKeyboard);
  }

  // eslint-disable-next-line accessor-pairs
  set annotationEditorParams({
    type,
    value
  }) {
    if (!this.#annotationEditorUIManager) {
      throw new Error(`The AnnotationEditor is not enabled.`);
    }
    this.#annotationEditorUIManager.updateParams(type, value);
  }
  refresh(noUpdate = false, updateArgs = Object.create(null)) {
    if (!this.pdfDocument) {
      return;
    }
    for (const pageView of this._pages) {
      pageView.update(updateArgs);
    }
    if (this.#scaleTimeoutId !== null) {
      clearTimeout(this.#scaleTimeoutId);
      this.#scaleTimeoutId = null;
    }
    if (!noUpdate) {
      this.update();
    }
  }
}

export { PDFPageViewBuffer, PDFViewer, PagesCountLimit };
