import { u as unreachable, G as CMapCompressionType, q as stringToBytes, U as Util, w as warn, F as FeatureTest, s as shadow, K as BaseException, e as assert, M as MissingPDFException, x as UnexpectedResponseException, i as isNodeJS, a as AbortException } from './util.js';

/* Copyright 2015 Mozilla Foundation
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

class BaseFilterFactory {
  constructor() {
    if (this.constructor === BaseFilterFactory) {
      unreachable("Cannot initialize BaseFilterFactory.");
    }
  }
  addFilter(maps) {
    return "none";
  }
  addHCMFilter(fgColor, bgColor) {
    return "none";
  }
  addHighlightHCMFilter(filterName, fgColor, bgColor, newFgColor, newBgColor) {
    return "none";
  }
  destroy(keepHCM = false) {}
}
class BaseCanvasFactory {
  constructor() {
    if (this.constructor === BaseCanvasFactory) {
      unreachable("Cannot initialize BaseCanvasFactory.");
    }
  }
  create(width, height) {
    if (width <= 0 || height <= 0) {
      throw new Error("Invalid canvas size");
    }
    const canvas = this._createCanvas(width, height);
    return {
      canvas,
      context: canvas.getContext("2d")
    };
  }
  reset(canvasAndContext, width, height) {
    if (!canvasAndContext.canvas) {
      throw new Error("Canvas is not specified");
    }
    if (width <= 0 || height <= 0) {
      throw new Error("Invalid canvas size");
    }
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  }
  destroy(canvasAndContext) {
    if (!canvasAndContext.canvas) {
      throw new Error("Canvas is not specified");
    }
    // Zeroing the width and height cause Firefox to release graphics
    // resources immediately, which can greatly reduce memory consumption.
    canvasAndContext.canvas.width = 0;
    canvasAndContext.canvas.height = 0;
    canvasAndContext.canvas = null;
    canvasAndContext.context = null;
  }

  /**
   * @ignore
   */
  _createCanvas(width, height) {
    unreachable("Abstract method `_createCanvas` called.");
  }
}
class BaseCMapReaderFactory {
  constructor({
    baseUrl = null,
    isCompressed = true
  }) {
    if (this.constructor === BaseCMapReaderFactory) {
      unreachable("Cannot initialize BaseCMapReaderFactory.");
    }
    this.baseUrl = baseUrl;
    this.isCompressed = isCompressed;
  }
  async fetch({
    name
  }) {
    if (!this.baseUrl) {
      throw new Error('The CMap "baseUrl" parameter must be specified, ensure that ' + 'the "cMapUrl" and "cMapPacked" API parameters are provided.');
    }
    if (!name) {
      throw new Error("CMap name must be specified.");
    }
    const url = this.baseUrl + name + (this.isCompressed ? ".bcmap" : "");
    const compressionType = this.isCompressed ? CMapCompressionType.BINARY : CMapCompressionType.NONE;
    return this._fetchData(url, compressionType).catch(reason => {
      throw new Error(`Unable to load ${this.isCompressed ? "binary " : ""}CMap at: ${url}`);
    });
  }

  /**
   * @ignore
   */
  _fetchData(url, compressionType) {
    unreachable("Abstract method `_fetchData` called.");
  }
}
class BaseStandardFontDataFactory {
  constructor({
    baseUrl = null
  }) {
    if (this.constructor === BaseStandardFontDataFactory) {
      unreachable("Cannot initialize BaseStandardFontDataFactory.");
    }
    this.baseUrl = baseUrl;
  }
  async fetch({
    filename
  }) {
    if (!this.baseUrl) {
      throw new Error('The standard font "baseUrl" parameter must be specified, ensure that ' + 'the "standardFontDataUrl" API parameter is provided.');
    }
    if (!filename) {
      throw new Error("Font filename must be specified.");
    }
    const url = `${this.baseUrl}${filename}`;
    return this._fetchData(url).catch(reason => {
      throw new Error(`Unable to load font data at: ${url}`);
    });
  }

  /**
   * @ignore
   */
  _fetchData(url) {
    unreachable("Abstract method `_fetchData` called.");
  }
}
class BaseSVGFactory {
  constructor() {
    if (this.constructor === BaseSVGFactory) {
      unreachable("Cannot initialize BaseSVGFactory.");
    }
  }
  create(width, height, skipDimensions = false) {
    if (width <= 0 || height <= 0) {
      throw new Error("Invalid SVG dimensions");
    }
    const svg = this._createSVG("svg:svg");
    svg.setAttribute("version", "1.1");
    if (!skipDimensions) {
      svg.setAttribute("width", `${width}px`);
      svg.setAttribute("height", `${height}px`);
    }
    svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    return svg;
  }
  createElement(type) {
    if (typeof type !== "string") {
      throw new Error("Invalid SVG element type");
    }
    return this._createSVG(type);
  }

  /**
   * @ignore
   */
  _createSVG(type) {
    unreachable("Abstract method `_createSVG` called.");
  }
}

/* Copyright 2015 Mozilla Foundation
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

const SVG_NS = "http://www.w3.org/2000/svg";
class PixelsPerInch {
  static CSS = 96.0;
  static PDF = 72.0;
  static PDF_TO_CSS_UNITS = this.CSS / this.PDF;
}

/**
 * FilterFactory aims to create some SVG filters we can use when drawing an
 * image (or whatever) on a canvas.
 * Filters aren't applied with ctx.putImageData because it just overwrites the
 * underlying pixels.
 * With these filters, it's possible for example to apply some transfer maps on
 * an image without the need to apply them on the pixel arrays: the renderer
 * does the magic for us.
 */
class DOMFilterFactory extends BaseFilterFactory {
  #_cache;
  #_defs;
  #docId;
  #document;
  #_hcmCache;
  #id = 0;
  constructor({
    docId,
    ownerDocument = globalThis.document
  } = {}) {
    super();
    this.#docId = docId;
    this.#document = ownerDocument;
  }
  get #cache() {
    return this.#_cache || (this.#_cache = new Map());
  }
  get #hcmCache() {
    return this.#_hcmCache || (this.#_hcmCache = new Map());
  }
  get #defs() {
    if (!this.#_defs) {
      const div = this.#document.createElement("div");
      const {
        style
      } = div;
      style.visibility = "hidden";
      style.contain = "strict";
      style.width = style.height = 0;
      style.position = "absolute";
      style.top = style.left = 0;
      style.zIndex = -1;
      const svg = this.#document.createElementNS(SVG_NS, "svg");
      svg.setAttribute("width", 0);
      svg.setAttribute("height", 0);
      this.#_defs = this.#document.createElementNS(SVG_NS, "defs");
      div.append(svg);
      svg.append(this.#_defs);
      this.#document.body.append(div);
    }
    return this.#_defs;
  }
  addFilter(maps) {
    if (!maps) {
      return "none";
    }

    // When a page is zoomed the page is re-drawn but the maps are likely
    // the same.
    let value = this.#cache.get(maps);
    if (value) {
      return value;
    }
    let tableR, tableG, tableB, key;
    if (maps.length === 1) {
      const mapR = maps[0];
      const buffer = new Array(256);
      for (let i = 0; i < 256; i++) {
        buffer[i] = mapR[i] / 255;
      }
      key = tableR = tableG = tableB = buffer.join(",");
    } else {
      const [mapR, mapG, mapB] = maps;
      const bufferR = new Array(256);
      const bufferG = new Array(256);
      const bufferB = new Array(256);
      for (let i = 0; i < 256; i++) {
        bufferR[i] = mapR[i] / 255;
        bufferG[i] = mapG[i] / 255;
        bufferB[i] = mapB[i] / 255;
      }
      tableR = bufferR.join(",");
      tableG = bufferG.join(",");
      tableB = bufferB.join(",");
      key = `${tableR}${tableG}${tableB}`;
    }
    value = this.#cache.get(key);
    if (value) {
      this.#cache.set(maps, value);
      return value;
    }

    // We create a SVG filter: feComponentTransferElement
    //  https://www.w3.org/TR/SVG11/filters.html#feComponentTransferElement

    const id = `g_${this.#docId}_transfer_map_${this.#id++}`;
    const url = `url(#${id})`;
    this.#cache.set(maps, url);
    this.#cache.set(key, url);
    const filter = this.#createFilter(id);
    this.#addTransferMapConversion(tableR, tableG, tableB, filter);
    return url;
  }
  addHCMFilter(fgColor, bgColor) {
    var _info;
    const key = `${fgColor}-${bgColor}`;
    const filterName = "base";
    let info = this.#hcmCache.get(filterName);
    if (((_info = info) === null || _info === void 0 ? void 0 : _info.key) === key) {
      return info.url;
    }
    if (info) {
      var _info$filter;
      (_info$filter = info.filter) === null || _info$filter === void 0 ? void 0 : _info$filter.remove();
      info.key = key;
      info.url = "none";
      info.filter = null;
    } else {
      info = {
        key,
        url: "none",
        filter: null
      };
      this.#hcmCache.set(filterName, info);
    }
    if (!fgColor || !bgColor) {
      return info.url;
    }
    const fgRGB = this.#getRGB(fgColor);
    fgColor = Util.makeHexColor(...fgRGB);
    const bgRGB = this.#getRGB(bgColor);
    bgColor = Util.makeHexColor(...bgRGB);
    this.#defs.style.color = "";
    if (fgColor === "#000000" && bgColor === "#ffffff" || fgColor === bgColor) {
      return info.url;
    }

    // https://developer.mozilla.org/en-US/docs/Web/Accessibility/Understanding_Colors_and_Luminance
    //
    // Relative luminance:
    // https://www.w3.org/TR/WCAG20/#relativeluminancedef
    //
    // We compute the rounded luminance of the default background color.
    // Then for every color in the pdf, if its rounded luminance is the
    // same as the background one then it's replaced by the new
    // background color else by the foreground one.
    const map = new Array(256);
    for (let i = 0; i <= 255; i++) {
      const x = i / 255;
      map[i] = x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    }
    const table = map.join(",");
    const id = `g_${this.#docId}_hcm_filter`;
    const filter = info.filter = this.#createFilter(id);
    this.#addTransferMapConversion(table, table, table, filter);
    this.#addGrayConversion(filter);
    const getSteps = (c, n) => {
      const start = fgRGB[c] / 255;
      const end = bgRGB[c] / 255;
      const arr = new Array(n + 1);
      for (let i = 0; i <= n; i++) {
        arr[i] = start + i / n * (end - start);
      }
      return arr.join(",");
    };
    this.#addTransferMapConversion(getSteps(0, 5), getSteps(1, 5), getSteps(2, 5), filter);
    info.url = `url(#${id})`;
    return info.url;
  }
  addHighlightHCMFilter(filterName, fgColor, bgColor, newFgColor, newBgColor) {
    var _info2;
    const key = `${fgColor}-${bgColor}-${newFgColor}-${newBgColor}`;
    let info = this.#hcmCache.get(filterName);
    if (((_info2 = info) === null || _info2 === void 0 ? void 0 : _info2.key) === key) {
      return info.url;
    }
    if (info) {
      var _info$filter2;
      (_info$filter2 = info.filter) === null || _info$filter2 === void 0 ? void 0 : _info$filter2.remove();
      info.key = key;
      info.url = "none";
      info.filter = null;
    } else {
      info = {
        key,
        url: "none",
        filter: null
      };
      this.#hcmCache.set(filterName, info);
    }
    if (!fgColor || !bgColor) {
      return info.url;
    }
    const [fgRGB, bgRGB] = [fgColor, bgColor].map(this.#getRGB.bind(this));
    let fgGray = Math.round(0.2126 * fgRGB[0] + 0.7152 * fgRGB[1] + 0.0722 * fgRGB[2]);
    let bgGray = Math.round(0.2126 * bgRGB[0] + 0.7152 * bgRGB[1] + 0.0722 * bgRGB[2]);
    let [newFgRGB, newBgRGB] = [newFgColor, newBgColor].map(this.#getRGB.bind(this));
    if (bgGray < fgGray) {
      [fgGray, bgGray, newFgRGB, newBgRGB] = [bgGray, fgGray, newBgRGB, newFgRGB];
    }
    this.#defs.style.color = "";

    // Now we can create the filters to highlight some canvas parts.
    // The colors in the pdf will almost be Canvas and CanvasText, hence we
    // want to filter them to finally get Highlight and HighlightText.
    // Since we're in HCM the background color and the foreground color should
    // be really different when converted to grayscale (if they're not then it
    // means that we've a poor contrast). Once the canvas colors are converted
    // to grayscale we can easily map them on their new colors.
    // The grayscale step is important because if we've something like:
    //   fgColor = #FF....
    //   bgColor = #FF....
    //   then we are enable to map the red component on the new red components
    //   which can be different.

    const getSteps = (fg, bg, n) => {
      const arr = new Array(256);
      const step = (bgGray - fgGray) / n;
      const newStart = fg / 255;
      const newStep = (bg - fg) / (255 * n);
      let prev = 0;
      for (let i = 0; i <= n; i++) {
        const k = Math.round(fgGray + i * step);
        const value = newStart + i * newStep;
        for (let j = prev; j <= k; j++) {
          arr[j] = value;
        }
        prev = k + 1;
      }
      for (let i = prev; i < 256; i++) {
        arr[i] = arr[prev - 1];
      }
      return arr.join(",");
    };
    const id = `g_${this.#docId}_hcm_${filterName}_filter`;
    const filter = info.filter = this.#createFilter(id);
    this.#addGrayConversion(filter);
    this.#addTransferMapConversion(getSteps(newFgRGB[0], newBgRGB[0], 5), getSteps(newFgRGB[1], newBgRGB[1], 5), getSteps(newFgRGB[2], newBgRGB[2], 5), filter);
    info.url = `url(#${id})`;
    return info.url;
  }
  destroy(keepHCM = false) {
    if (keepHCM && this.#hcmCache.size !== 0) {
      return;
    }
    if (this.#_defs) {
      this.#_defs.parentNode.parentNode.remove();
      this.#_defs = null;
    }
    if (this.#_cache) {
      this.#_cache.clear();
      this.#_cache = null;
    }
    this.#id = 0;
  }
  #addGrayConversion(filter) {
    const feColorMatrix = this.#document.createElementNS(SVG_NS, "feColorMatrix");
    feColorMatrix.setAttribute("type", "matrix");
    feColorMatrix.setAttribute("values", "0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0 0 0 1 0");
    filter.append(feColorMatrix);
  }
  #createFilter(id) {
    const filter = this.#document.createElementNS(SVG_NS, "filter");
    filter.setAttribute("color-interpolation-filters", "sRGB");
    filter.setAttribute("id", id);
    this.#defs.append(filter);
    return filter;
  }
  #appendFeFunc(feComponentTransfer, func, table) {
    const feFunc = this.#document.createElementNS(SVG_NS, func);
    feFunc.setAttribute("type", "discrete");
    feFunc.setAttribute("tableValues", table);
    feComponentTransfer.append(feFunc);
  }
  #addTransferMapConversion(rTable, gTable, bTable, filter) {
    const feComponentTransfer = this.#document.createElementNS(SVG_NS, "feComponentTransfer");
    filter.append(feComponentTransfer);
    this.#appendFeFunc(feComponentTransfer, "feFuncR", rTable);
    this.#appendFeFunc(feComponentTransfer, "feFuncG", gTable);
    this.#appendFeFunc(feComponentTransfer, "feFuncB", bTable);
  }
  #getRGB(color) {
    this.#defs.style.color = color;
    return getRGB(getComputedStyle(this.#defs).getPropertyValue("color"));
  }
}
class DOMCanvasFactory extends BaseCanvasFactory {
  constructor({
    ownerDocument = globalThis.document
  } = {}) {
    super();
    this._document = ownerDocument;
  }

  /**
   * @ignore
   */
  _createCanvas(width, height) {
    const canvas = this._document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
}
async function fetchData(url, type = "text") {
  if (typeof PDFJSDev !== "undefined" && PDFJSDev.test("MOZCENTRAL") || isValidFetchUrl(url, document.baseURI)) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(response.statusText);
    }
    switch (type) {
      case "arraybuffer":
        return response.arrayBuffer();
      case "blob":
        return response.blob();
      case "json":
        return response.json();
    }
    return response.text();
  }

  // The Fetch API is not supported.
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("GET", url, /* async = */true);
    request.responseType = type;
    request.onreadystatechange = () => {
      if (request.readyState !== XMLHttpRequest.DONE) {
        return;
      }
      if (request.status === 200 || request.status === 0) {
        switch (type) {
          case "arraybuffer":
          case "blob":
          case "json":
            resolve(request.response);
            return;
        }
        resolve(request.responseText);
        return;
      }
      reject(new Error(request.statusText));
    };
    request.send(null);
  });
}
class DOMCMapReaderFactory extends BaseCMapReaderFactory {
  /**
   * @ignore
   */
  _fetchData(url, compressionType) {
    return fetchData(url, /* type = */this.isCompressed ? "arraybuffer" : "text").then(data => ({
      cMapData: data instanceof ArrayBuffer ? new Uint8Array(data) : stringToBytes(data),
      compressionType
    }));
  }
}
class DOMStandardFontDataFactory extends BaseStandardFontDataFactory {
  /**
   * @ignore
   */
  _fetchData(url) {
    return fetchData(url, /* type = */"arraybuffer").then(data => new Uint8Array(data));
  }
}
class DOMSVGFactory extends BaseSVGFactory {
  /**
   * @ignore
   */
  _createSVG(type) {
    return document.createElementNS(SVG_NS, type);
  }
}

/**
 * @typedef {Object} PageViewportParameters
 * @property {Array<number>} viewBox - The xMin, yMin, xMax and
 *   yMax coordinates.
 * @property {number} scale - The scale of the viewport.
 * @property {number} rotation - The rotation, in degrees, of the viewport.
 * @property {number} [offsetX] - The horizontal, i.e. x-axis, offset. The
 *   default value is `0`.
 * @property {number} [offsetY] - The vertical, i.e. y-axis, offset. The
 *   default value is `0`.
 * @property {boolean} [dontFlip] - If true, the y-axis will not be flipped.
 *   The default value is `false`.
 */

/**
 * @typedef {Object} PageViewportCloneParameters
 * @property {number} [scale] - The scale, overriding the one in the cloned
 *   viewport. The default value is `this.scale`.
 * @property {number} [rotation] - The rotation, in degrees, overriding the one
 *   in the cloned viewport. The default value is `this.rotation`.
 * @property {number} [offsetX] - The horizontal, i.e. x-axis, offset.
 *   The default value is `this.offsetX`.
 * @property {number} [offsetY] - The vertical, i.e. y-axis, offset.
 *   The default value is `this.offsetY`.
 * @property {boolean} [dontFlip] - If true, the x-axis will not be flipped.
 *   The default value is `false`.
 */

/**
 * PDF page viewport created based on scale, rotation and offset.
 */
class PageViewport {
  /**
   * @param {PageViewportParameters}
   */
  constructor({
    viewBox,
    scale,
    rotation,
    offsetX = 0,
    offsetY = 0,
    dontFlip = false
  }) {
    this.viewBox = viewBox;
    this.scale = scale;
    this.rotation = rotation;
    this.offsetX = offsetX;
    this.offsetY = offsetY;

    // creating transform to convert pdf coordinate system to the normal
    // canvas like coordinates taking in account scale and rotation
    const centerX = (viewBox[2] + viewBox[0]) / 2;
    const centerY = (viewBox[3] + viewBox[1]) / 2;
    let rotateA, rotateB, rotateC, rotateD;
    // Normalize the rotation, by clamping it to the [0, 360) range.
    rotation %= 360;
    if (rotation < 0) {
      rotation += 360;
    }
    switch (rotation) {
      case 180:
        rotateA = -1;
        rotateB = 0;
        rotateC = 0;
        rotateD = 1;
        break;
      case 90:
        rotateA = 0;
        rotateB = 1;
        rotateC = 1;
        rotateD = 0;
        break;
      case 270:
        rotateA = 0;
        rotateB = -1;
        rotateC = -1;
        rotateD = 0;
        break;
      case 0:
        rotateA = 1;
        rotateB = 0;
        rotateC = 0;
        rotateD = -1;
        break;
      default:
        throw new Error("PageViewport: Invalid rotation, must be a multiple of 90 degrees.");
    }
    if (dontFlip) {
      rotateC = -rotateC;
      rotateD = -rotateD;
    }
    let offsetCanvasX, offsetCanvasY;
    let width, height;
    if (rotateA === 0) {
      offsetCanvasX = Math.abs(centerY - viewBox[1]) * scale + offsetX;
      offsetCanvasY = Math.abs(centerX - viewBox[0]) * scale + offsetY;
      width = (viewBox[3] - viewBox[1]) * scale;
      height = (viewBox[2] - viewBox[0]) * scale;
    } else {
      offsetCanvasX = Math.abs(centerX - viewBox[0]) * scale + offsetX;
      offsetCanvasY = Math.abs(centerY - viewBox[1]) * scale + offsetY;
      width = (viewBox[2] - viewBox[0]) * scale;
      height = (viewBox[3] - viewBox[1]) * scale;
    }
    // creating transform for the following operations:
    // translate(-centerX, -centerY), rotate and flip vertically,
    // scale, and translate(offsetCanvasX, offsetCanvasY)
    this.transform = [rotateA * scale, rotateB * scale, rotateC * scale, rotateD * scale, offsetCanvasX - rotateA * scale * centerX - rotateC * scale * centerY, offsetCanvasY - rotateB * scale * centerX - rotateD * scale * centerY];
    this.width = width;
    this.height = height;
  }

  /**
   * The original, un-scaled, viewport dimensions.
   * @type {Object}
   */
  get rawDims() {
    const {
      viewBox
    } = this;
    return shadow(this, "rawDims", {
      pageWidth: viewBox[2] - viewBox[0],
      pageHeight: viewBox[3] - viewBox[1],
      pageX: viewBox[0],
      pageY: viewBox[1]
    });
  }

  /**
   * Clones viewport, with optional additional properties.
   * @param {PageViewportCloneParameters} [params]
   * @returns {PageViewport} Cloned viewport.
   */
  clone({
    scale = this.scale,
    rotation = this.rotation,
    offsetX = this.offsetX,
    offsetY = this.offsetY,
    dontFlip = false
  } = {}) {
    return new PageViewport({
      viewBox: this.viewBox.slice(),
      scale,
      rotation,
      offsetX,
      offsetY,
      dontFlip
    });
  }

  /**
   * Converts PDF point to the viewport coordinates. For examples, useful for
   * converting PDF location into canvas pixel coordinates.
   * @param {number} x - The x-coordinate.
   * @param {number} y - The y-coordinate.
   * @returns {Array} Array containing `x`- and `y`-coordinates of the
   *   point in the viewport coordinate space.
   * @see {@link convertToPdfPoint}
   * @see {@link convertToViewportRectangle}
   */
  convertToViewportPoint(x, y) {
    return Util.applyTransform([x, y], this.transform);
  }

  /**
   * Converts PDF rectangle to the viewport coordinates.
   * @param {Array} rect - The xMin, yMin, xMax and yMax coordinates.
   * @returns {Array} Array containing corresponding coordinates of the
   *   rectangle in the viewport coordinate space.
   * @see {@link convertToViewportPoint}
   */
  convertToViewportRectangle(rect) {
    const topLeft = Util.applyTransform([rect[0], rect[1]], this.transform);
    const bottomRight = Util.applyTransform([rect[2], rect[3]], this.transform);
    return [topLeft[0], topLeft[1], bottomRight[0], bottomRight[1]];
  }

  /**
   * Converts viewport coordinates to the PDF location. For examples, useful
   * for converting canvas pixel location into PDF one.
   * @param {number} x - The x-coordinate.
   * @param {number} y - The y-coordinate.
   * @returns {Array} Array containing `x`- and `y`-coordinates of the
   *   point in the PDF coordinate space.
   * @see {@link convertToViewportPoint}
   */
  convertToPdfPoint(x, y) {
    return Util.applyInverseTransform([x, y], this.transform);
  }
}
class RenderingCancelledException extends BaseException {
  constructor(msg, extraDelay = 0) {
    super(msg, "RenderingCancelledException");
    this.extraDelay = extraDelay;
  }
}
function isDataScheme(url) {
  const ii = url.length;
  let i = 0;
  while (i < ii && url[i].trim() === "") {
    i++;
  }
  return url.substring(i, i + 5).toLowerCase() === "data:";
}
function isPdfFile(filename) {
  return typeof filename === "string" && /\.pdf$/i.test(filename);
}

/**
 * Gets the filename from a given URL.
 * @param {string} url
 * @param {boolean} [onlyStripPath]
 * @returns {string}
 */
function getFilenameFromUrl(url, onlyStripPath = false) {
  if (!onlyStripPath) {
    [url] = url.split(/[#?]/, 1);
  }
  return url.substring(url.lastIndexOf("/") + 1);
}

/**
 * Returns the filename or guessed filename from the url (see issue 3455).
 * @param {string} url - The original PDF location.
 * @param {string} defaultFilename - The value returned if the filename is
 *   unknown, or the protocol is unsupported.
 * @returns {string} Guessed PDF filename.
 */
function getPdfFilenameFromUrl(url, defaultFilename = "document.pdf") {
  if (typeof url !== "string") {
    return defaultFilename;
  }
  if (isDataScheme(url)) {
    warn('getPdfFilenameFromUrl: ignore "data:"-URL for performance reasons.');
    return defaultFilename;
  }
  const reURI = /^(?:(?:[^:]+:)?\/\/[^/]+)?([^?#]*)(\?[^#]*)?(#.*)?$/;
  //              SCHEME        HOST        1.PATH  2.QUERY   3.REF
  // Pattern to get last matching NAME.pdf
  const reFilename = /[^/?#=]+\.pdf\b(?!.*\.pdf\b)/i;
  const splitURI = reURI.exec(url);
  let suggestedFilename = reFilename.exec(splitURI[1]) || reFilename.exec(splitURI[2]) || reFilename.exec(splitURI[3]);
  if (suggestedFilename) {
    suggestedFilename = suggestedFilename[0];
    if (suggestedFilename.includes("%")) {
      // URL-encoded %2Fpath%2Fto%2Ffile.pdf should be file.pdf
      try {
        suggestedFilename = reFilename.exec(decodeURIComponent(suggestedFilename))[0];
      } catch {
        // Possible (extremely rare) errors:
        // URIError "Malformed URI", e.g. for "%AA.pdf"
        // TypeError "null has no properties", e.g. for "%2F.pdf"
      }
    }
  }
  return suggestedFilename || defaultFilename;
}
class StatTimer {
  started = Object.create(null);
  times = [];
  time(name) {
    if (name in this.started) {
      warn(`Timer is already running for ${name}`);
    }
    this.started[name] = Date.now();
  }
  timeEnd(name) {
    if (!(name in this.started)) {
      warn(`Timer has not been started for ${name}`);
    }
    this.times.push({
      name,
      start: this.started[name],
      end: Date.now()
    });
    // Remove timer from started so it can be called again.
    delete this.started[name];
  }
  toString() {
    // Find the longest name for padding purposes.
    const outBuf = [];
    let longest = 0;
    for (const {
      name
    } of this.times) {
      longest = Math.max(name.length, longest);
    }
    for (const {
      name,
      start,
      end
    } of this.times) {
      outBuf.push(`${name.padEnd(longest)} ${end - start}ms\n`);
    }
    return outBuf.join("");
  }
}
function isValidFetchUrl(url, baseUrl) {
  if (typeof PDFJSDev !== "undefined" && PDFJSDev.test("MOZCENTRAL")) {
    throw new Error("Not implemented: isValidFetchUrl");
  }
  try {
    const {
      protocol
    } = baseUrl ? new URL(url, baseUrl) : new URL(url);
    // The Fetch API only supports the http/https protocols, and not file/ftp.
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false; // `new URL()` will throw on incorrect data.
  }
}

/**
 * Event handler to suppress context menu.
 */
function noContextMenu(e) {
  e.preventDefault();
}
let pdfDateStringRegex;
class PDFDateString {
  /**
   * Convert a PDF date string to a JavaScript `Date` object.
   *
   * The PDF date string format is described in section 7.9.4 of the official
   * PDF 32000-1:2008 specification. However, in the PDF 1.7 reference (sixth
   * edition) Adobe describes the same format including a trailing apostrophe.
   * This syntax in incorrect, but Adobe Acrobat creates PDF files that contain
   * them. We ignore all apostrophes as they are not necessary for date parsing.
   *
   * Moreover, Adobe Acrobat doesn't handle changing the date to universal time
   * and doesn't use the user's time zone (effectively ignoring the HH' and mm'
   * parts of the date string).
   *
   * @param {string} input
   * @returns {Date|null}
   */
  static toDateObject(input) {
    if (!input || typeof input !== "string") {
      return null;
    }

    // Lazily initialize the regular expression.
    pdfDateStringRegex || (pdfDateStringRegex = new RegExp("^D:" +
    // Prefix (required)
    "(\\d{4})" +
    // Year (required)
    "(\\d{2})?" +
    // Month (optional)
    "(\\d{2})?" +
    // Day (optional)
    "(\\d{2})?" +
    // Hour (optional)
    "(\\d{2})?" +
    // Minute (optional)
    "(\\d{2})?" +
    // Second (optional)
    "([Z|+|-])?" +
    // Universal time relation (optional)
    "(\\d{2})?" +
    // Offset hour (optional)
    "'?" +
    // Splitting apostrophe (optional)
    "(\\d{2})?" +
    // Offset minute (optional)
    "'?" // Trailing apostrophe (optional)
    ));

    // Optional fields that don't satisfy the requirements from the regular
    // expression (such as incorrect digit counts or numbers that are out of
    // range) will fall back the defaults from the specification.
    const matches = pdfDateStringRegex.exec(input);
    if (!matches) {
      return null;
    }

    // JavaScript's `Date` object expects the month to be between 0 and 11
    // instead of 1 and 12, so we have to correct for that.
    const year = parseInt(matches[1], 10);
    let month = parseInt(matches[2], 10);
    month = month >= 1 && month <= 12 ? month - 1 : 0;
    let day = parseInt(matches[3], 10);
    day = day >= 1 && day <= 31 ? day : 1;
    let hour = parseInt(matches[4], 10);
    hour = hour >= 0 && hour <= 23 ? hour : 0;
    let minute = parseInt(matches[5], 10);
    minute = minute >= 0 && minute <= 59 ? minute : 0;
    let second = parseInt(matches[6], 10);
    second = second >= 0 && second <= 59 ? second : 0;
    const universalTimeRelation = matches[7] || "Z";
    let offsetHour = parseInt(matches[8], 10);
    offsetHour = offsetHour >= 0 && offsetHour <= 23 ? offsetHour : 0;
    let offsetMinute = parseInt(matches[9], 10) || 0;
    offsetMinute = offsetMinute >= 0 && offsetMinute <= 59 ? offsetMinute : 0;

    // Universal time relation 'Z' means that the local time is equal to the
    // universal time, whereas the relations '+'/'-' indicate that the local
    // time is later respectively earlier than the universal time. Every date
    // is normalized to universal time.
    if (universalTimeRelation === "-") {
      hour += offsetHour;
      minute += offsetMinute;
    } else if (universalTimeRelation === "+") {
      hour -= offsetHour;
      minute -= offsetMinute;
    }
    return new Date(Date.UTC(year, month, day, hour, minute, second));
  }
}

/**
 * NOTE: This is (mostly) intended to support printing of XFA forms.
 */
function getXfaPageViewport(xfaPage, {
  scale = 1,
  rotation = 0
}) {
  const {
    width,
    height
  } = xfaPage.attributes.style;
  const viewBox = [0, 0, parseInt(width), parseInt(height)];
  return new PageViewport({
    viewBox,
    scale,
    rotation
  });
}
function getRGB(color) {
  if (color.startsWith("#")) {
    const colorRGB = parseInt(color.slice(1), 16);
    return [(colorRGB & 0xff0000) >> 16, (colorRGB & 0x00ff00) >> 8, colorRGB & 0x0000ff];
  }
  if (color.startsWith("rgb(")) {
    // getComputedStyle(...).color returns a `rgb(R, G, B)` color.
    return color.slice(/* "rgb(".length */4, -1) // Strip out "rgb(" and ")".
    .split(",").map(x => parseInt(x));
  }
  if (color.startsWith("rgba(")) {
    return color.slice(/* "rgba(".length */5, -1) // Strip out "rgba(" and ")".
    .split(",").map(x => parseInt(x)).slice(0, 3);
  }
  warn(`Not a valid color format: "${color}"`);
  return [0, 0, 0];
}
function getColorValues(colors) {
  const span = document.createElement("span");
  span.style.visibility = "hidden";
  document.body.append(span);
  for (const name of colors.keys()) {
    span.style.color = name;
    const computedColor = window.getComputedStyle(span).color;
    colors.set(name, getRGB(computedColor));
  }
  span.remove();
}
function getCurrentTransform(ctx) {
  const {
    a,
    b,
    c,
    d,
    e,
    f
  } = ctx.getTransform();
  return [a, b, c, d, e, f];
}
function getCurrentTransformInverse(ctx) {
  const {
    a,
    b,
    c,
    d,
    e,
    f
  } = ctx.getTransform().invertSelf();
  return [a, b, c, d, e, f];
}

/**
 * @param {HTMLDivElement} div
 * @param {PageViewport} viewport
 * @param {boolean} mustFlip
 * @param {boolean} mustRotate
 */
function setLayerDimensions(div, viewport, mustFlip = false, mustRotate = true) {
  if (viewport instanceof PageViewport) {
    const {
      pageWidth,
      pageHeight
    } = viewport.rawDims;
    const {
      style
    } = div;
    const useRound = FeatureTest.isCSSRoundSupported;
    const w = `var(--scale-factor) * ${pageWidth}px`,
      h = `var(--scale-factor) * ${pageHeight}px`;
    const widthStr = useRound ? `round(${w}, 1px)` : `calc(${w})`,
      heightStr = useRound ? `round(${h}, 1px)` : `calc(${h})`;
    if (!mustFlip || viewport.rotation % 180 === 0) {
      style.width = widthStr;
      style.height = heightStr;
    } else {
      style.width = heightStr;
      style.height = widthStr;
    }
  }
  if (mustRotate) {
    div.setAttribute("data-main-rotation", viewport.rotation);
  }
}

/* Copyright 2017 Mozilla Foundation
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


// This getFilenameFromContentDispositionHeader function is adapted from
// https://github.com/Rob--W/open-in-browser/blob/7e2e35a38b8b4e981b11da7b2f01df0149049e92/extension/content-disposition.js
// with the following changes:
// - Modified to conform to PDF.js's coding style.
// - Move return to the end of the function to prevent Babel from dropping the
//   function declarations.

/**
 * Extract file name from the Content-Disposition HTTP response header.
 *
 * @param {string} contentDisposition
 * @returns {string} Filename, if found in the Content-Disposition header.
 */
function getFilenameFromContentDispositionHeader(contentDisposition) {
  let needsEncodingFixup = true;

  // filename*=ext-value ("ext-value" from RFC 5987, referenced by RFC 6266).
  let tmp = toParamRegExp("filename\\*", "i").exec(contentDisposition);
  if (tmp) {
    tmp = tmp[1];
    let filename = rfc2616unquote(tmp);
    filename = unescape(filename);
    filename = rfc5987decode(filename);
    filename = rfc2047decode(filename);
    return fixupEncoding(filename);
  }

  // Continuations (RFC 2231 section 3, referenced by RFC 5987 section 3.1).
  // filename*n*=part
  // filename*n=part
  tmp = rfc2231getparam(contentDisposition);
  if (tmp) {
    // RFC 2047, section
    const filename = rfc2047decode(tmp);
    return fixupEncoding(filename);
  }

  // filename=value (RFC 5987, section 4.1).
  tmp = toParamRegExp("filename", "i").exec(contentDisposition);
  if (tmp) {
    tmp = tmp[1];
    let filename = rfc2616unquote(tmp);
    filename = rfc2047decode(filename);
    return fixupEncoding(filename);
  }

  // After this line there are only function declarations. We cannot put
  // "return" here for readability because babel would then drop the function
  // declarations...
  function toParamRegExp(attributePattern, flags) {
    return new RegExp("(?:^|;)\\s*" + attributePattern + "\\s*=\\s*" +
    // Captures: value = token | quoted-string
    // (RFC 2616, section 3.6 and referenced by RFC 6266 4.1)
    "(" + '[^";\\s][^;\\s]*' + "|" + '"(?:[^"\\\\]|\\\\"?)+"?' + ")", flags);
  }
  function textdecode(encoding, value) {
    if (encoding) {
      if (!/^[\x00-\xFF]+$/.test(value)) {
        return value;
      }
      try {
        const decoder = new TextDecoder(encoding, {
          fatal: true
        });
        const buffer = stringToBytes(value);
        value = decoder.decode(buffer);
        needsEncodingFixup = false;
      } catch {
        // TextDecoder constructor threw - unrecognized encoding.
      }
    }
    return value;
  }
  function fixupEncoding(value) {
    if (needsEncodingFixup && /[\x80-\xff]/.test(value)) {
      // Maybe multi-byte UTF-8.
      value = textdecode("utf-8", value);
      if (needsEncodingFixup) {
        // Try iso-8859-1 encoding.
        value = textdecode("iso-8859-1", value);
      }
    }
    return value;
  }
  function rfc2231getparam(contentDispositionStr) {
    const matches = [];
    let match;
    // Iterate over all filename*n= and filename*n*= with n being an integer
    // of at least zero. Any non-zero number must not start with '0'.
    const iter = toParamRegExp("filename\\*((?!0\\d)\\d+)(\\*?)", "ig");
    while ((match = iter.exec(contentDispositionStr)) !== null) {
      let [, n, quot, part] = match; // eslint-disable-line prefer-const
      n = parseInt(n, 10);
      if (n in matches) {
        // Ignore anything after the invalid second filename*0.
        if (n === 0) {
          break;
        }
        continue;
      }
      matches[n] = [quot, part];
    }
    const parts = [];
    for (let n = 0; n < matches.length; ++n) {
      if (!(n in matches)) {
        // Numbers must be consecutive. Truncate when there is a hole.
        break;
      }
      let [quot, part] = matches[n]; // eslint-disable-line prefer-const
      part = rfc2616unquote(part);
      if (quot) {
        part = unescape(part);
        if (n === 0) {
          part = rfc5987decode(part);
        }
      }
      parts.push(part);
    }
    return parts.join("");
  }
  function rfc2616unquote(value) {
    if (value.startsWith('"')) {
      const parts = value.slice(1).split('\\"');
      // Find the first unescaped " and terminate there.
      for (let i = 0; i < parts.length; ++i) {
        const quotindex = parts[i].indexOf('"');
        if (quotindex !== -1) {
          parts[i] = parts[i].slice(0, quotindex);
          parts.length = i + 1; // Truncates and stop the iteration.
        }
        parts[i] = parts[i].replaceAll(/\\(.)/g, "$1");
      }
      value = parts.join('"');
    }
    return value;
  }
  function rfc5987decode(extvalue) {
    // Decodes "ext-value" from RFC 5987.
    const encodingend = extvalue.indexOf("'");
    if (encodingend === -1) {
      // Some servers send "filename*=" without encoding 'language' prefix,
      // e.g. in https://github.com/Rob--W/open-in-browser/issues/26
      // Let's accept the value like Firefox (57) (Chrome 62 rejects it).
      return extvalue;
    }
    const encoding = extvalue.slice(0, encodingend);
    const langvalue = extvalue.slice(encodingend + 1);
    // Ignore language (RFC 5987 section 3.2.1, and RFC 6266 section 4.1 ).
    const value = langvalue.replace(/^[^']*'/, "");
    return textdecode(encoding, value);
  }
  function rfc2047decode(value) {
    // RFC 2047-decode the result. Firefox tried to drop support for it, but
    // backed out because some servers use it - https://bugzil.la/875615
    // Firefox's condition for decoding is here: https://searchfox.org/mozilla-central/rev/4a590a5a15e35d88a3b23dd6ac3c471cf85b04a8/netwerk/mime/nsMIMEHeaderParamImpl.cpp#742-748

    // We are more strict and only recognize RFC 2047-encoding if the value
    // starts with "=?", since then it is likely that the full value is
    // RFC 2047-encoded.

    // Firefox also decodes words even where RFC 2047 section 5 states:
    // "An 'encoded-word' MUST NOT appear within a 'quoted-string'."
    if (!value.startsWith("=?") || /[\x00-\x19\x80-\xff]/.test(value)) {
      return value;
    }
    // RFC 2047, section 2.4
    // encoded-word = "=?" charset "?" encoding "?" encoded-text "?="
    // charset = token (but let's restrict to characters that denote a
    //       possibly valid encoding).
    // encoding = q or b
    // encoded-text = any printable ASCII character other than ? or space.
    //        ... but Firefox permits ? and space.
    return value.replaceAll(/=\?([\w-]*)\?([QqBb])\?((?:[^?]|\?(?!=))*)\?=/g, function (matches, charset, encoding, text) {
      if (encoding === "q" || encoding === "Q") {
        // RFC 2047 section 4.2.
        text = text.replaceAll("_", " ");
        text = text.replaceAll(/=([0-9a-fA-F]{2})/g, function (match, hex) {
          return String.fromCharCode(parseInt(hex, 16));
        });
        return textdecode(charset, text);
      } // else encoding is b or B - base64 (RFC 2047 section 4.1)
      try {
        text = atob(text);
      } catch {}
      return textdecode(charset, text);
    });
  }
  return "";
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

function validateRangeRequestCapabilities({
  getResponseHeader,
  isHttp,
  rangeChunkSize,
  disableRange
}) {
  if (typeof PDFJSDev === "undefined" || PDFJSDev.test("TESTING")) {
    assert(Number.isInteger(rangeChunkSize) && rangeChunkSize > 0, "rangeChunkSize must be an integer larger than zero.");
  }
  const returnValues = {
    allowRangeRequests: false,
    suggestedLength: undefined
  };
  const length = parseInt(getResponseHeader("Content-Length"), 10);
  if (!Number.isInteger(length)) {
    return returnValues;
  }
  returnValues.suggestedLength = length;
  if (length <= 2 * rangeChunkSize) {
    // The file size is smaller than the size of two chunks, so it does not
    // make any sense to abort the request and retry with a range request.
    return returnValues;
  }
  if (disableRange || !isHttp) {
    return returnValues;
  }
  if (getResponseHeader("Accept-Ranges") !== "bytes") {
    return returnValues;
  }
  const contentEncoding = getResponseHeader("Content-Encoding") || "identity";
  if (contentEncoding !== "identity") {
    return returnValues;
  }
  returnValues.allowRangeRequests = true;
  return returnValues;
}
function extractFilenameFromHeader(getResponseHeader) {
  const contentDisposition = getResponseHeader("Content-Disposition");
  if (contentDisposition) {
    let filename = getFilenameFromContentDispositionHeader(contentDisposition);
    if (filename.includes("%")) {
      try {
        filename = decodeURIComponent(filename);
      } catch {}
    }
    if (isPdfFile(filename)) {
      return filename;
    }
  }
  return null;
}
function createResponseStatusError(status, url) {
  if (status === 404 || status === 0 && url.startsWith("file:")) {
    return new MissingPDFException('Missing PDF "' + url + '".');
  }
  return new UnexpectedResponseException(`Unexpected server response (${status}) while retrieving PDF "${url}".`, status);
}
function validateResponseStatus(status) {
  return status === 200 || status === 206;
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

if (typeof PDFJSDev !== "undefined" && PDFJSDev.test("MOZCENTRAL")) {
  throw new Error('Module "./node_stream.js" shall not be used with MOZCENTRAL builds.');
}
let fs, http, https, url;
if (isNodeJS) {
  // Native packages.
  fs = await __non_webpack_import__("fs");
  http = await __non_webpack_import__("http");
  https = await __non_webpack_import__("https");
  url = await __non_webpack_import__("url");
}
const fileUriRegex = /^file:\/\/\/[a-zA-Z]:\//;
function parseUrl(sourceUrl) {
  const parsedUrl = url.parse(sourceUrl);
  if (parsedUrl.protocol === "file:" || parsedUrl.host) {
    return parsedUrl;
  }
  // Prepending 'file:///' to Windows absolute path.
  if (/^[a-z]:[/\\]/i.test(sourceUrl)) {
    return url.parse(`file:///${sourceUrl}`);
  }
  // Changes protocol to 'file:' if url refers to filesystem.
  if (!parsedUrl.host) {
    parsedUrl.protocol = "file:";
  }
  return parsedUrl;
}
class PDFNodeStream {
  constructor(source) {
    this.source = source;
    this.url = parseUrl(source.url);
    this.isHttp = this.url.protocol === "http:" || this.url.protocol === "https:";
    // Check if url refers to filesystem.
    this.isFsUrl = this.url.protocol === "file:";
    this.httpHeaders = this.isHttp && source.httpHeaders || {};
    this._fullRequestReader = null;
    this._rangeRequestReaders = [];
  }
  get _progressiveDataLength() {
    var _this$_fullRequestRea, _this$_fullRequestRea2;
    return (_this$_fullRequestRea = (_this$_fullRequestRea2 = this._fullRequestReader) === null || _this$_fullRequestRea2 === void 0 ? void 0 : _this$_fullRequestRea2._loaded) !== null && _this$_fullRequestRea !== void 0 ? _this$_fullRequestRea : 0;
  }
  getFullReader() {
    assert(!this._fullRequestReader, "PDFNodeStream.getFullReader can only be called once.");
    this._fullRequestReader = this.isFsUrl ? new PDFNodeStreamFsFullReader(this) : new PDFNodeStreamFullReader(this);
    return this._fullRequestReader;
  }
  getRangeReader(start, end) {
    if (end <= this._progressiveDataLength) {
      return null;
    }
    const rangeReader = this.isFsUrl ? new PDFNodeStreamFsRangeReader(this, start, end) : new PDFNodeStreamRangeReader(this, start, end);
    this._rangeRequestReaders.push(rangeReader);
    return rangeReader;
  }
  cancelAllRequests(reason) {
    var _this$_fullRequestRea3;
    (_this$_fullRequestRea3 = this._fullRequestReader) === null || _this$_fullRequestRea3 === void 0 ? void 0 : _this$_fullRequestRea3.cancel(reason);
    for (const reader of this._rangeRequestReaders.slice(0)) {
      reader.cancel(reason);
    }
  }
}
class BaseFullReader {
  constructor(stream) {
    this._url = stream.url;
    this._done = false;
    this._storedError = null;
    this.onProgress = null;
    const source = stream.source;
    this._contentLength = source.length; // optional
    this._loaded = 0;
    this._filename = null;
    this._disableRange = source.disableRange || false;
    this._rangeChunkSize = source.rangeChunkSize;
    if (!this._rangeChunkSize && !this._disableRange) {
      this._disableRange = true;
    }
    this._isStreamingSupported = !source.disableStream;
    this._isRangeSupported = !source.disableRange;
    this._readableStream = null;
    this._readCapability = Promise.withResolvers();
    this._headersCapability = Promise.withResolvers();
  }
  get headersReady() {
    return this._headersCapability.promise;
  }
  get filename() {
    return this._filename;
  }
  get contentLength() {
    return this._contentLength;
  }
  get isRangeSupported() {
    return this._isRangeSupported;
  }
  get isStreamingSupported() {
    return this._isStreamingSupported;
  }
  async read() {
    var _this$onProgress;
    await this._readCapability.promise;
    if (this._done) {
      return {
        value: undefined,
        done: true
      };
    }
    if (this._storedError) {
      throw this._storedError;
    }
    const chunk = this._readableStream.read();
    if (chunk === null) {
      this._readCapability = Promise.withResolvers();
      return this.read();
    }
    this._loaded += chunk.length;
    (_this$onProgress = this.onProgress) === null || _this$onProgress === void 0 ? void 0 : _this$onProgress.call(this, {
      loaded: this._loaded,
      total: this._contentLength
    });

    // Ensure that `read()` method returns ArrayBuffer.
    const buffer = new Uint8Array(chunk).buffer;
    return {
      value: buffer,
      done: false
    };
  }
  cancel(reason) {
    // Call `this._error()` method when cancel is called
    // before _readableStream is set.
    if (!this._readableStream) {
      this._error(reason);
      return;
    }
    this._readableStream.destroy(reason);
  }
  _error(reason) {
    this._storedError = reason;
    this._readCapability.resolve();
  }
  _setReadableStream(readableStream) {
    this._readableStream = readableStream;
    readableStream.on("readable", () => {
      this._readCapability.resolve();
    });
    readableStream.on("end", () => {
      // Destroy readable to minimize resource usage.
      readableStream.destroy();
      this._done = true;
      this._readCapability.resolve();
    });
    readableStream.on("error", reason => {
      this._error(reason);
    });

    // We need to stop reading when range is supported and streaming is
    // disabled.
    if (!this._isStreamingSupported && this._isRangeSupported) {
      this._error(new AbortException("streaming is disabled"));
    }

    // Destroy ReadableStream if already in errored state.
    if (this._storedError) {
      this._readableStream.destroy(this._storedError);
    }
  }
}
class BaseRangeReader {
  constructor(stream) {
    this._url = stream.url;
    this._done = false;
    this._storedError = null;
    this.onProgress = null;
    this._loaded = 0;
    this._readableStream = null;
    this._readCapability = Promise.withResolvers();
    const source = stream.source;
    this._isStreamingSupported = !source.disableStream;
  }
  get isStreamingSupported() {
    return this._isStreamingSupported;
  }
  async read() {
    var _this$onProgress2;
    await this._readCapability.promise;
    if (this._done) {
      return {
        value: undefined,
        done: true
      };
    }
    if (this._storedError) {
      throw this._storedError;
    }
    const chunk = this._readableStream.read();
    if (chunk === null) {
      this._readCapability = Promise.withResolvers();
      return this.read();
    }
    this._loaded += chunk.length;
    (_this$onProgress2 = this.onProgress) === null || _this$onProgress2 === void 0 ? void 0 : _this$onProgress2.call(this, {
      loaded: this._loaded
    });

    // Ensure that `read()` method returns ArrayBuffer.
    const buffer = new Uint8Array(chunk).buffer;
    return {
      value: buffer,
      done: false
    };
  }
  cancel(reason) {
    // Call `this._error()` method when cancel is called
    // before _readableStream is set.
    if (!this._readableStream) {
      this._error(reason);
      return;
    }
    this._readableStream.destroy(reason);
  }
  _error(reason) {
    this._storedError = reason;
    this._readCapability.resolve();
  }
  _setReadableStream(readableStream) {
    this._readableStream = readableStream;
    readableStream.on("readable", () => {
      this._readCapability.resolve();
    });
    readableStream.on("end", () => {
      // Destroy readableStream to minimize resource usage.
      readableStream.destroy();
      this._done = true;
      this._readCapability.resolve();
    });
    readableStream.on("error", reason => {
      this._error(reason);
    });

    // Destroy readableStream if already in errored state.
    if (this._storedError) {
      this._readableStream.destroy(this._storedError);
    }
  }
}
function createRequestOptions(parsedUrl, headers) {
  return {
    protocol: parsedUrl.protocol,
    auth: parsedUrl.auth,
    host: parsedUrl.hostname,
    port: parsedUrl.port,
    path: parsedUrl.path,
    method: "GET",
    headers
  };
}
class PDFNodeStreamFullReader extends BaseFullReader {
  constructor(stream) {
    super(stream);
    const handleResponse = response => {
      if (response.statusCode === 404) {
        const error = new MissingPDFException(`Missing PDF "${this._url}".`);
        this._storedError = error;
        this._headersCapability.reject(error);
        return;
      }
      this._headersCapability.resolve();
      this._setReadableStream(response);

      // Make sure that headers name are in lower case, as mentioned
      // here: https://nodejs.org/api/http.html#http_message_headers.
      const getResponseHeader = name => this._readableStream.headers[name.toLowerCase()];
      const {
        allowRangeRequests,
        suggestedLength
      } = validateRangeRequestCapabilities({
        getResponseHeader,
        isHttp: stream.isHttp,
        rangeChunkSize: this._rangeChunkSize,
        disableRange: this._disableRange
      });
      this._isRangeSupported = allowRangeRequests;
      // Setting right content length.
      this._contentLength = suggestedLength || this._contentLength;
      this._filename = extractFilenameFromHeader(getResponseHeader);
    };
    this._request = null;
    if (this._url.protocol === "http:") {
      this._request = http.request(createRequestOptions(this._url, stream.httpHeaders), handleResponse);
    } else {
      this._request = https.request(createRequestOptions(this._url, stream.httpHeaders), handleResponse);
    }
    this._request.on("error", reason => {
      this._storedError = reason;
      this._headersCapability.reject(reason);
    });
    // Note: `request.end(data)` is used to write `data` to request body
    // and notify end of request. But one should always call `request.end()`
    // even if there is no data to write -- (to notify the end of request).
    this._request.end();
  }
}
class PDFNodeStreamRangeReader extends BaseRangeReader {
  constructor(stream, start, end) {
    super(stream);
    this._httpHeaders = {};
    for (const property in stream.httpHeaders) {
      const value = stream.httpHeaders[property];
      if (value === undefined) {
        continue;
      }
      this._httpHeaders[property] = value;
    }
    this._httpHeaders.Range = `bytes=${start}-${end - 1}`;
    const handleResponse = response => {
      if (response.statusCode === 404) {
        const error = new MissingPDFException(`Missing PDF "${this._url}".`);
        this._storedError = error;
        return;
      }
      this._setReadableStream(response);
    };
    this._request = null;
    if (this._url.protocol === "http:") {
      this._request = http.request(createRequestOptions(this._url, this._httpHeaders), handleResponse);
    } else {
      this._request = https.request(createRequestOptions(this._url, this._httpHeaders), handleResponse);
    }
    this._request.on("error", reason => {
      this._storedError = reason;
    });
    this._request.end();
  }
}
class PDFNodeStreamFsFullReader extends BaseFullReader {
  constructor(stream) {
    super(stream);
    let path = decodeURIComponent(this._url.path);

    // Remove the extra slash to get right path from url like `file:///C:/`
    if (fileUriRegex.test(this._url.href)) {
      path = path.replace(/^\//, "");
    }
    fs.promises.lstat(path).then(stat => {
      // Setting right content length.
      this._contentLength = stat.size;
      this._setReadableStream(fs.createReadStream(path));
      this._headersCapability.resolve();
    }, error => {
      if (error.code === "ENOENT") {
        error = new MissingPDFException(`Missing PDF "${path}".`);
      }
      this._storedError = error;
      this._headersCapability.reject(error);
    });
  }
}
class PDFNodeStreamFsRangeReader extends BaseRangeReader {
  constructor(stream, start, end) {
    super(stream);
    let path = decodeURIComponent(this._url.path);

    // Remove the extra slash to get right path from url like `file:///C:/`
    if (fileUriRegex.test(this._url.href)) {
      path = path.replace(/^\//, "");
    }
    this._setReadableStream(fs.createReadStream(path, {
      start,
      end: end - 1
    }));
  }
}

export { getXfaPageViewport as A, BaseCanvasFactory as B, DOMCanvasFactory as D, PixelsPerInch as P, RenderingCancelledException as R, StatTimer as S, getRGB as a, BaseCMapReaderFactory as b, BaseFilterFactory as c, BaseStandardFontDataFactory as d, getCurrentTransform as e, fetchData as f, getColorValues as g, getCurrentTransformInverse as h, isPdfFile as i, createResponseStatusError as j, validateRangeRequestCapabilities as k, extractFilenameFromHeader as l, DOMCMapReaderFactory as m, noContextMenu as n, DOMFilterFactory as o, DOMStandardFontDataFactory as p, isDataScheme as q, isValidFetchUrl as r, setLayerDimensions as s, PDFNodeStream as t, PageViewport as u, validateResponseStatus as v, PDFDateString as w, DOMSVGFactory as x, getFilenameFromUrl as y, getPdfFilenameFromUrl as z };
