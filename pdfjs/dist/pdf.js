import { B as BaseCanvasFactory, a as BaseCMapReaderFactory, b as BaseStandardFontDataFactory, i as isPdfFile, D as DOMCanvasFactory, c as DOMCMapReaderFactory, d as DOMStandardFontDataFactory, e as isDataScheme, f as deprecated, S as StatTimer, P as PageViewport, R as RenderingCancelledException, l as loadScript, g as DOMSVGFactory, h as addLinkAttributes, L as LinkTarget, j as PDFDateString, k as getFilenameFromUrl, m as isValidFetchUrl } from './display_utils.js';
export { L as LinkTarget, j as PDFDateString, R as RenderingCancelledException, h as addLinkAttributes, k as getFilenameFromUrl, n as getPdfFilenameFromUrl, o as getXfaPageViewport, i as isPdfFile, l as loadScript } from './display_utils.js';
import { s as shadow, a as string32, b as bytesToString, U as UNSUPPORTED_FEATURES, w as warn, I as IsEvalSupportedCached, u as unreachable, c as assert, i as isNodeJS, o as objectFromMap, d as info, e as Util, F as FormatError, O as OPS, f as IDENTITY_MATRIX, g as FONT_IDENTITY_MATRIX, T as TextRenderingMode, h as isNum, j as ImageKind, k as IsLittleEndianCached, l as createPromiseCapability, m as isArrayBuffer, n as stringToBytes, p as setVerbosityLevel, q as getVerbosityLevel, r as isSameOrigin, A as AbortException, t as UnknownErrorException, v as UnexpectedResponseException, M as MissingPDFException, x as InvalidPDFException, P as PasswordException, y as AnnotationType, z as AnnotationBorderStyleType, B as stringToPDFString, C as createObjectURL } from './util.js';
export { D as CMapCompressionType, x as InvalidPDFException, M as MissingPDFException, O as OPS, G as PasswordResponses, H as PermissionFlag, U as UNSUPPORTED_FEATURES, v as UnexpectedResponseException, e as Util, V as VerbosityLevel, C as createObjectURL, l as createPromiseCapability, E as createValidAbsoluteUrl, J as removeNullCharacters, s as shadow } from './util.js';
import { M as MessageHandler } from './message_handler.js';

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

class BaseFontLoader {
  constructor({
    docId,
    onUnsupportedFeature,
    ownerDocument = globalThis.document,
    // For testing only.
    styleElement = null
  }) {
    if (this.constructor === BaseFontLoader) {
      unreachable("Cannot initialize BaseFontLoader.");
    }

    this.docId = docId;
    this._onUnsupportedFeature = onUnsupportedFeature;
    this._document = ownerDocument;
    this.nativeFontFaces = [];
    this.styleElement = typeof PDFJSDev === "undefined" || PDFJSDev.test("!PRODUCTION || TESTING") ? styleElement : null;
  }

  addNativeFontFace(nativeFontFace) {
    this.nativeFontFaces.push(nativeFontFace);

    this._document.fonts.add(nativeFontFace);
  }

  insertRule(rule) {
    let styleElement = this.styleElement;

    if (!styleElement) {
      styleElement = this.styleElement = this._document.createElement("style");
      styleElement.id = `PDFJS_FONT_STYLE_TAG_${this.docId}`;

      this._document.documentElement.getElementsByTagName("head")[0].appendChild(styleElement);
    }

    const styleSheet = styleElement.sheet;
    styleSheet.insertRule(rule, styleSheet.cssRules.length);
  }

  clear() {
    for (const nativeFontFace of this.nativeFontFaces) {
      this._document.fonts.delete(nativeFontFace);
    }

    this.nativeFontFaces.length = 0;

    if (this.styleElement) {
      // Note: ChildNode.remove doesn't throw if the parentNode is undefined.
      this.styleElement.remove();
      this.styleElement = null;
    }
  }

  async bind(font) {
    // Add the font to the DOM only once; skip if the font is already loaded.
    if (font.attached || font.missingFile) {
      return;
    }

    font.attached = true;

    if (this.isFontLoadingAPISupported) {
      const nativeFontFace = font.createNativeFontFace();

      if (nativeFontFace) {
        this.addNativeFontFace(nativeFontFace);

        try {
          await nativeFontFace.loaded;
        } catch (ex) {
          this._onUnsupportedFeature({
            featureId: UNSUPPORTED_FEATURES.errorFontLoadNative
          });

          warn(`Failed to load font '${nativeFontFace.family}': '${ex}'.`); // When font loading failed, fall back to the built-in font renderer.

          font.disableFontFace = true;
          throw ex;
        }
      }

      return; // The font was, asynchronously, loaded.
    } // !this.isFontLoadingAPISupported


    const rule = font.createFontFaceRule();

    if (rule) {
      this.insertRule(rule);

      if (this.isSyncFontLoadingSupported) {
        return; // The font was, synchronously, loaded.
      }

      await new Promise(resolve => {
        const request = this._queueLoadingCallback(resolve);

        this._prepareFontLoadEvent([rule], [font], request);
      }); // The font was, asynchronously, loaded.
    }
  }

  _queueLoadingCallback(callback) {
    unreachable("Abstract method `_queueLoadingCallback`.");
  }

  get isFontLoadingAPISupported() {
    var _this$_document;

    const hasFonts = !!((_this$_document = this._document) !== null && _this$_document !== void 0 && _this$_document.fonts);

    if (typeof PDFJSDev === "undefined" || PDFJSDev.test("!PRODUCTION || TESTING")) {
      return shadow(this, "isFontLoadingAPISupported", hasFonts && !this.styleElement);
    }

    return shadow(this, "isFontLoadingAPISupported", hasFonts);
  } // eslint-disable-next-line getter-return


  get isSyncFontLoadingSupported() {
    unreachable("Abstract method `isSyncFontLoadingSupported`.");
  } // eslint-disable-next-line getter-return


  get _loadTestFont() {
    unreachable("Abstract method `_loadTestFont`.");
  }

  _prepareFontLoadEvent(rules, fontsToLoad, request) {
    unreachable("Abstract method `_prepareFontLoadEvent`.");
  }

}

let FontLoader;

if (typeof PDFJSDev !== "undefined" && PDFJSDev.test("MOZCENTRAL")) {
  FontLoader = class MozcentralFontLoader extends BaseFontLoader {
    get isSyncFontLoadingSupported() {
      return shadow(this, "isSyncFontLoadingSupported", true);
    }

  };
} else {
  // PDFJSDev.test('CHROME || GENERIC')
  FontLoader = class GenericFontLoader extends BaseFontLoader {
    constructor(params) {
      super(params);
      this.loadingContext = {
        requests: [],
        nextRequestId: 0
      };
      this.loadTestFontId = 0;
    }

    get isSyncFontLoadingSupported() {
      let supported = false;

      if (typeof PDFJSDev === "undefined" || !PDFJSDev.test("CHROME")) {
        if (typeof navigator === "undefined") {
          // Node.js - we can pretend that sync font loading is supported.
          supported = true;
        } else {
          // User agent string sniffing is bad, but there is no reliable way to
          // tell if the font is fully loaded and ready to be used with canvas.
          const m = /Mozilla\/5.0.*?rv:(\d+).*? Gecko/.exec(navigator.userAgent);

          if ((m === null || m === void 0 ? void 0 : m[1]) >= 14) {
            supported = true;
          } // TODO - other browsers...

        }
      }

      return shadow(this, "isSyncFontLoadingSupported", supported);
    }

    _queueLoadingCallback(callback) {
      function completeRequest() {
        assert(!request.done, "completeRequest() cannot be called twice.");
        request.done = true; // Sending all completed requests in order of how they were queued.

        while (context.requests.length > 0 && context.requests[0].done) {
          const otherRequest = context.requests.shift();
          setTimeout(otherRequest.callback, 0);
        }
      }

      const context = this.loadingContext;
      const request = {
        id: `pdfjs-font-loading-${context.nextRequestId++}`,
        done: false,
        complete: completeRequest,
        callback
      };
      context.requests.push(request);
      return request;
    }

    get _loadTestFont() {
      const getLoadTestFont = function () {
        // This is a CFF font with 1 glyph for '.' that fills its entire width
        // and height.
        return atob("T1RUTwALAIAAAwAwQ0ZGIDHtZg4AAAOYAAAAgUZGVE1lkzZwAAAEHAAAABxHREVGABQA" + "FQAABDgAAAAeT1MvMlYNYwkAAAEgAAAAYGNtYXABDQLUAAACNAAAAUJoZWFk/xVFDQAA" + "ALwAAAA2aGhlYQdkA+oAAAD0AAAAJGhtdHgD6AAAAAAEWAAAAAZtYXhwAAJQAAAAARgA" + "AAAGbmFtZVjmdH4AAAGAAAAAsXBvc3T/hgAzAAADeAAAACAAAQAAAAEAALZRFsRfDzz1" + "AAsD6AAAAADOBOTLAAAAAM4KHDwAAAAAA+gDIQAAAAgAAgAAAAAAAAABAAADIQAAAFoD" + "6AAAAAAD6AABAAAAAAAAAAAAAAAAAAAAAQAAUAAAAgAAAAQD6AH0AAUAAAKKArwAAACM" + "AooCvAAAAeAAMQECAAACAAYJAAAAAAAAAAAAAQAAAAAAAAAAAAAAAFBmRWQAwAAuAC4D" + "IP84AFoDIQAAAAAAAQAAAAAAAAAAACAAIAABAAAADgCuAAEAAAAAAAAAAQAAAAEAAAAA" + "AAEAAQAAAAEAAAAAAAIAAQAAAAEAAAAAAAMAAQAAAAEAAAAAAAQAAQAAAAEAAAAAAAUA" + "AQAAAAEAAAAAAAYAAQAAAAMAAQQJAAAAAgABAAMAAQQJAAEAAgABAAMAAQQJAAIAAgAB" + "AAMAAQQJAAMAAgABAAMAAQQJAAQAAgABAAMAAQQJAAUAAgABAAMAAQQJAAYAAgABWABY" + "AAAAAAAAAwAAAAMAAAAcAAEAAAAAADwAAwABAAAAHAAEACAAAAAEAAQAAQAAAC7//wAA" + "AC7////TAAEAAAAAAAABBgAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" + "AAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" + "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" + "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" + "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" + "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMAAAAAAAD/gwAyAAAAAQAAAAAAAAAAAAAAAAAA" + "AAABAAQEAAEBAQJYAAEBASH4DwD4GwHEAvgcA/gXBIwMAYuL+nz5tQXkD5j3CBLnEQAC" + "AQEBIVhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYAAABAQAADwACAQEEE/t3" + "Dov6fAH6fAT+fPp8+nwHDosMCvm1Cvm1DAz6fBQAAAAAAAABAAAAAMmJbzEAAAAAzgTj" + "FQAAAADOBOQpAAEAAAAAAAAADAAUAAQAAAABAAAAAgABAAAAAAAAAAAD6AAAAAAAAA==");
      };

      return shadow(this, "_loadTestFont", getLoadTestFont());
    }

    _prepareFontLoadEvent(rules, fonts, request) {
      /** Hack begin */
      // There's currently no event when a font has finished downloading so the
      // following code is a dirty hack to 'guess' when a font is ready.
      // It's assumed fonts are loaded in order, so add a known test font after
      // the desired fonts and then test for the loading of that test font.
      function int32(data, offset) {
        return data.charCodeAt(offset) << 24 | data.charCodeAt(offset + 1) << 16 | data.charCodeAt(offset + 2) << 8 | data.charCodeAt(offset + 3) & 0xff;
      }

      function spliceString(s, offset, remove, insert) {
        const chunk1 = s.substring(0, offset);
        const chunk2 = s.substring(offset + remove);
        return chunk1 + insert + chunk2;
      }

      let i, ii; // The temporary canvas is used to determine if fonts are loaded.

      const canvas = this._document.createElement("canvas");

      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext("2d");
      let called = 0;

      function isFontReady(name, callback) {
        called++; // With setTimeout clamping this gives the font ~100ms to load.

        if (called > 30) {
          warn("Load test font never loaded.");
          callback();
          return;
        }

        ctx.font = "30px " + name;
        ctx.fillText(".", 0, 20);
        const imageData = ctx.getImageData(0, 0, 1, 1);

        if (imageData.data[3] > 0) {
          callback();
          return;
        }

        setTimeout(isFontReady.bind(null, name, callback));
      }

      const loadTestFontId = `lt${Date.now()}${this.loadTestFontId++}`; // Chromium seems to cache fonts based on a hash of the actual font data,
      // so the font must be modified for each load test else it will appear to
      // be loaded already.
      // TODO: This could maybe be made faster by avoiding the btoa of the full
      // font by splitting it in chunks before hand and padding the font id.

      let data = this._loadTestFont;
      const COMMENT_OFFSET = 976; // has to be on 4 byte boundary (for checksum)

      data = spliceString(data, COMMENT_OFFSET, loadTestFontId.length, loadTestFontId); // CFF checksum is important for IE, adjusting it

      const CFF_CHECKSUM_OFFSET = 16;
      const XXXX_VALUE = 0x58585858; // the "comment" filled with 'X'

      let checksum = int32(data, CFF_CHECKSUM_OFFSET);

      for (i = 0, ii = loadTestFontId.length - 3; i < ii; i += 4) {
        checksum = checksum - XXXX_VALUE + int32(loadTestFontId, i) | 0;
      }

      if (i < loadTestFontId.length) {
        // align to 4 bytes boundary
        checksum = checksum - XXXX_VALUE + int32(loadTestFontId + "XXX", i) | 0;
      }

      data = spliceString(data, CFF_CHECKSUM_OFFSET, 4, string32(checksum));
      const url = `url(data:font/opentype;base64,${btoa(data)});`;
      const rule = `@font-face {font-family:"${loadTestFontId}";src:${url}}`;
      this.insertRule(rule);
      const names = [];

      for (const font of fonts) {
        names.push(font.loadedName);
      }

      names.push(loadTestFontId);

      const div = this._document.createElement("div");

      div.style.visibility = "hidden";
      div.style.width = div.style.height = "10px";
      div.style.position = "absolute";
      div.style.top = div.style.left = "0px";

      for (const name of names) {
        const span = this._document.createElement("span");

        span.textContent = "Hi";
        span.style.fontFamily = name;
        div.appendChild(span);
      }

      this._document.body.appendChild(div);

      isFontReady(loadTestFontId, () => {
        this._document.body.removeChild(div);

        request.complete();
      });
      /** Hack end */
    }

  };
} // End of PDFJSDev.test('CHROME || GENERIC')


class FontFaceObject {
  constructor(translatedData, {
    isEvalSupported = true,
    disableFontFace = false,
    ignoreErrors = false,
    onUnsupportedFeature,
    fontRegistry = null
  }) {
    this.compiledGlyphs = Object.create(null); // importing translated data

    for (const i in translatedData) {
      this[i] = translatedData[i];
    }

    this.isEvalSupported = isEvalSupported !== false;
    this.disableFontFace = disableFontFace === true;
    this.ignoreErrors = ignoreErrors === true;
    this._onUnsupportedFeature = onUnsupportedFeature;
    this.fontRegistry = fontRegistry;
  }

  createNativeFontFace() {
    if (!this.data || this.disableFontFace) {
      return null;
    }

    let nativeFontFace;

    if (!this.cssFontInfo) {
      nativeFontFace = new FontFace(this.loadedName, this.data, {});
    } else {
      const css = {
        weight: this.cssFontInfo.fontWeight
      };

      if (this.cssFontInfo.italicAngle) {
        css.style = `oblique ${this.cssFontInfo.italicAngle}deg`;
      }

      nativeFontFace = new FontFace(this.cssFontInfo.fontFamily, this.data, css);
    }

    if (this.fontRegistry) {
      this.fontRegistry.registerFont(this);
    }

    return nativeFontFace;
  }

  createFontFaceRule() {
    if (!this.data || this.disableFontFace) {
      return null;
    }

    const data = bytesToString(this.data); // Add the @font-face rule to the document.

    const url = `url(data:${this.mimetype};base64,${btoa(data)});`;
    let rule;

    if (!this.cssFontInfo) {
      rule = `@font-face {font-family:"${this.loadedName}";src:${url}}`;
    } else {
      let css = `font-weight: ${this.cssFontInfo.fontWeight};`;

      if (this.cssFontInfo.italicAngle) {
        css += `font-style: oblique ${this.cssFontInfo.italicAngle}deg;`;
      }

      rule = `@font-face {font-family:"${this.cssFontInfo.fontFamily}";${css}src:${url}}`;
    }

    if (this.fontRegistry) {
      this.fontRegistry.registerFont(this, url);
    }

    return rule;
  }

  getPathGenerator(objs, character) {
    if (this.compiledGlyphs[character] !== undefined) {
      return this.compiledGlyphs[character];
    }

    let cmds;

    try {
      cmds = objs.get(this.loadedName + "_path_" + character);
    } catch (ex) {
      if (!this.ignoreErrors) {
        throw ex;
      }

      this._onUnsupportedFeature({
        featureId: UNSUPPORTED_FEATURES.errorFontGetPath
      });

      warn(`getPathGenerator - ignoring character: "${ex}".`);
      return this.compiledGlyphs[character] = function (c, size) {// No-op function, to allow rendering to continue.
      };
    } // If we can, compile cmds into JS for MAXIMUM SPEED...


    if (this.isEvalSupported && IsEvalSupportedCached.value) {
      const jsBuf = [];

      for (const current of cmds) {
        const args = current.args !== undefined ? current.args.join(",") : "";
        jsBuf.push("c.", current.cmd, "(", args, ");\n");
      } // eslint-disable-next-line no-new-func


      return this.compiledGlyphs[character] = new Function("c", "size", jsBuf.join(""));
    } // ... but fall back on using Function.prototype.apply() if we're
    // blocked from using eval() for whatever reason (like CSP policies).


    return this.compiledGlyphs[character] = function (c, size) {
      for (const current of cmds) {
        if (current.cmd === "scale") {
          current.args = [size, -size];
        }

        c[current.cmd].apply(c, current.args);
      }
    };
  }

}

/* Copyright 2020 Mozilla Foundation
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
let NodeCanvasFactory = class {
  constructor() {
    unreachable("Not implemented: NodeCanvasFactory");
  }

};
let NodeCMapReaderFactory = class {
  constructor() {
    unreachable("Not implemented: NodeCMapReaderFactory");
  }

};
let NodeStandardFontDataFactory = class {
  constructor() {
    unreachable("Not implemented: NodeStandardFontDataFactory");
  }

};

if ((typeof PDFJSDev === "undefined" || PDFJSDev.test("GENERIC")) && isNodeJS) {
  const fetchData = function (url) {
    return new Promise((resolve, reject) => {
      const fs = __non_webpack_require__("fs");

      fs.readFile(url, (error, data) => {
        if (error || !data) {
          reject(new Error(error));
          return;
        }

        resolve(new Uint8Array(data));
      });
    });
  };

  NodeCanvasFactory = class extends BaseCanvasFactory {
    _createCanvas(width, height) {
      const Canvas = __non_webpack_require__("canvas");

      return Canvas.createCanvas(width, height);
    }

  };
  NodeCMapReaderFactory = class extends BaseCMapReaderFactory {
    _fetchData(url, compressionType) {
      return fetchData(url).then(data => {
        return {
          cMapData: data,
          compressionType
        };
      });
    }

  };
  NodeStandardFontDataFactory = class extends BaseStandardFontDataFactory {
    _fetchData(url) {
      return fetchData(url);
    }

  };
}

/* Copyright 2020 Mozilla Foundation
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
 * Key/value storage for annotation data in forms.
 */

class AnnotationStorage {
  constructor() {
    this._storage = new Map();
    this._modified = false; // Callbacks to signal when the modification state is set or reset.
    // This is used by the viewer to only bind on `beforeunload` if forms
    // are actually edited to prevent doing so unconditionally since that
    // can have undesirable effects.

    this.onSetModified = null;
    this.onResetModified = null;
  }
  /**
   * Get the value for a given key if it exists, or return the default value.
   *
   * @public
   * @memberof AnnotationStorage
   * @param {string} key
   * @param {Object} defaultValue
   * @returns {Object}
   */


  getValue(key, defaultValue) {
    const obj = this._storage.get(key);

    return obj !== undefined ? obj : defaultValue;
  }
  /**
   * Set the value for a given key
   *
   * @public
   * @memberof AnnotationStorage
   * @param {string} key
   * @param {Object} value
   */


  setValue(key, value) {
    const obj = this._storage.get(key);

    let modified = false;

    if (obj !== undefined) {
      for (const [entry, val] of Object.entries(value)) {
        if (obj[entry] !== val) {
          modified = true;
          obj[entry] = val;
        }
      }
    } else {
      this._storage.set(key, value);

      modified = true;
    }

    if (modified) {
      this._setModified();
    }
  }

  getAll() {
    return this._storage.size > 0 ? objectFromMap(this._storage) : null;
  }

  get size() {
    return this._storage.size;
  }
  /**
   * @private
   */


  _setModified() {
    if (!this._modified) {
      this._modified = true;

      if (typeof this.onSetModified === "function") {
        this.onSetModified();
      }
    }
  }

  resetModified() {
    if (this._modified) {
      this._modified = false;

      if (typeof this.onResetModified === "function") {
        this.onResetModified();
      }
    }
  }
  /**
   * PLEASE NOTE: Only intended for usage within the API itself.
   * @ignore
   */


  get serializable() {
    return this._storage.size > 0 ? this._storage : null;
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

function applyBoundingBox(ctx, bbox) {
  if (!bbox || typeof Path2D === "undefined") {
    return;
  }

  const width = bbox[2] - bbox[0];
  const height = bbox[3] - bbox[1];
  const region = new Path2D();
  region.rect(bbox[0], bbox[1], width, height);
  ctx.clip(region);
}

class BaseShadingPattern {
  constructor() {
    if (this.constructor === BaseShadingPattern) {
      unreachable("Cannot initialize BaseShadingPattern.");
    }
  }

  getPattern() {
    unreachable("Abstract method `getPattern` called.");
  }

}

class RadialAxialShadingPattern extends BaseShadingPattern {
  constructor(IR) {
    super();
    this._type = IR[1];
    this._bbox = IR[2];
    this._colorStops = IR[3];
    this._p0 = IR[4];
    this._p1 = IR[5];
    this._r0 = IR[6];
    this._r1 = IR[7];
    this._matrix = IR[8];
    this._patternCache = null;
  }

  _createGradient(ctx) {
    let grad;

    if (this._type === "axial") {
      grad = ctx.createLinearGradient(this._p0[0], this._p0[1], this._p1[0], this._p1[1]);
    } else if (this._type === "radial") {
      grad = ctx.createRadialGradient(this._p0[0], this._p0[1], this._r0, this._p1[0], this._p1[1], this._r1);
    }

    for (const colorStop of this._colorStops) {
      grad.addColorStop(colorStop[0], colorStop[1]);
    }

    return grad;
  }

  getPattern(ctx, owner, inverse, shadingFill = false) {
    let pattern;

    if (this._patternCache) {
      pattern = this._patternCache;
    } else {
      if (!shadingFill) {
        const tmpCanvas = owner.cachedCanvases.getCanvas("pattern", owner.ctx.canvas.width, owner.ctx.canvas.height, true);
        const tmpCtx = tmpCanvas.context;
        tmpCtx.clearRect(0, 0, tmpCtx.canvas.width, tmpCtx.canvas.height);
        tmpCtx.beginPath();
        tmpCtx.rect(0, 0, tmpCtx.canvas.width, tmpCtx.canvas.height);
        tmpCtx.setTransform.apply(tmpCtx, owner.baseTransform);

        if (this._matrix) {
          tmpCtx.transform.apply(tmpCtx, this._matrix);
        }

        applyBoundingBox(tmpCtx, this._bbox);
        tmpCtx.fillStyle = this._createGradient(tmpCtx);
        tmpCtx.fill();
        pattern = ctx.createPattern(tmpCanvas.canvas, "repeat");
      } else {
        applyBoundingBox(ctx, this._bbox);
        pattern = this._createGradient(ctx);
      }

      this._patternCache = pattern;
    }

    if (!shadingFill) {
      const domMatrix = new DOMMatrix(inverse);

      try {
        pattern.setTransform(domMatrix);
      } catch (ex) {
        // Avoid rendering breaking completely in Firefox 78 ESR,
        // and in Node.js (see issue 13724).
        warn(`RadialAxialShadingPattern.getPattern: "${ex === null || ex === void 0 ? void 0 : ex.message}".`);
      }
    }

    return pattern;
  }

}

function drawTriangle(data, context, p1, p2, p3, c1, c2, c3) {
  // Very basic Gouraud-shaded triangle rasterization algorithm.
  const coords = context.coords,
        colors = context.colors;
  const bytes = data.data,
        rowSize = data.width * 4;
  let tmp;

  if (coords[p1 + 1] > coords[p2 + 1]) {
    tmp = p1;
    p1 = p2;
    p2 = tmp;
    tmp = c1;
    c1 = c2;
    c2 = tmp;
  }

  if (coords[p2 + 1] > coords[p3 + 1]) {
    tmp = p2;
    p2 = p3;
    p3 = tmp;
    tmp = c2;
    c2 = c3;
    c3 = tmp;
  }

  if (coords[p1 + 1] > coords[p2 + 1]) {
    tmp = p1;
    p1 = p2;
    p2 = tmp;
    tmp = c1;
    c1 = c2;
    c2 = tmp;
  }

  const x1 = (coords[p1] + context.offsetX) * context.scaleX;
  const y1 = (coords[p1 + 1] + context.offsetY) * context.scaleY;
  const x2 = (coords[p2] + context.offsetX) * context.scaleX;
  const y2 = (coords[p2 + 1] + context.offsetY) * context.scaleY;
  const x3 = (coords[p3] + context.offsetX) * context.scaleX;
  const y3 = (coords[p3 + 1] + context.offsetY) * context.scaleY;

  if (y1 >= y3) {
    return;
  }

  const c1r = colors[c1],
        c1g = colors[c1 + 1],
        c1b = colors[c1 + 2];
  const c2r = colors[c2],
        c2g = colors[c2 + 1],
        c2b = colors[c2 + 2];
  const c3r = colors[c3],
        c3g = colors[c3 + 1],
        c3b = colors[c3 + 2];
  const minY = Math.round(y1),
        maxY = Math.round(y3);
  let xa, car, cag, cab;
  let xb, cbr, cbg, cbb;

  for (let y = minY; y <= maxY; y++) {
    if (y < y2) {
      let k;

      if (y < y1) {
        k = 0;
      } else {
        k = (y1 - y) / (y1 - y2);
      }

      xa = x1 - (x1 - x2) * k;
      car = c1r - (c1r - c2r) * k;
      cag = c1g - (c1g - c2g) * k;
      cab = c1b - (c1b - c2b) * k;
    } else {
      let k;

      if (y > y3) {
        k = 1;
      } else if (y2 === y3) {
        k = 0;
      } else {
        k = (y2 - y) / (y2 - y3);
      }

      xa = x2 - (x2 - x3) * k;
      car = c2r - (c2r - c3r) * k;
      cag = c2g - (c2g - c3g) * k;
      cab = c2b - (c2b - c3b) * k;
    }

    let k;

    if (y < y1) {
      k = 0;
    } else if (y > y3) {
      k = 1;
    } else {
      k = (y1 - y) / (y1 - y3);
    }

    xb = x1 - (x1 - x3) * k;
    cbr = c1r - (c1r - c3r) * k;
    cbg = c1g - (c1g - c3g) * k;
    cbb = c1b - (c1b - c3b) * k;
    const x1_ = Math.round(Math.min(xa, xb));
    const x2_ = Math.round(Math.max(xa, xb));
    let j = rowSize * y + x1_ * 4;

    for (let x = x1_; x <= x2_; x++) {
      k = (xa - x) / (xa - xb);

      if (k < 0) {
        k = 0;
      } else if (k > 1) {
        k = 1;
      }

      bytes[j++] = car - (car - cbr) * k | 0;
      bytes[j++] = cag - (cag - cbg) * k | 0;
      bytes[j++] = cab - (cab - cbb) * k | 0;
      bytes[j++] = 255;
    }
  }
}

function drawFigure(data, figure, context) {
  const ps = figure.coords;
  const cs = figure.colors;
  let i, ii;

  switch (figure.type) {
    case "lattice":
      const verticesPerRow = figure.verticesPerRow;
      const rows = Math.floor(ps.length / verticesPerRow) - 1;
      const cols = verticesPerRow - 1;

      for (i = 0; i < rows; i++) {
        let q = i * verticesPerRow;

        for (let j = 0; j < cols; j++, q++) {
          drawTriangle(data, context, ps[q], ps[q + 1], ps[q + verticesPerRow], cs[q], cs[q + 1], cs[q + verticesPerRow]);
          drawTriangle(data, context, ps[q + verticesPerRow + 1], ps[q + 1], ps[q + verticesPerRow], cs[q + verticesPerRow + 1], cs[q + 1], cs[q + verticesPerRow]);
        }
      }

      break;

    case "triangles":
      for (i = 0, ii = ps.length; i < ii; i += 3) {
        drawTriangle(data, context, ps[i], ps[i + 1], ps[i + 2], cs[i], cs[i + 1], cs[i + 2]);
      }

      break;

    default:
      throw new Error("illegal figure");
  }
}

class MeshShadingPattern extends BaseShadingPattern {
  constructor(IR) {
    super();
    this._coords = IR[2];
    this._colors = IR[3];
    this._figures = IR[4];
    this._bounds = IR[5];
    this._matrix = IR[6];
    this._bbox = IR[7];
    this._background = IR[8];
  }

  _createMeshCanvas(combinedScale, backgroundColor, cachedCanvases) {
    // we will increase scale on some weird factor to let antialiasing take
    // care of "rough" edges
    const EXPECTED_SCALE = 1.1; // MAX_PATTERN_SIZE is used to avoid OOM situation.

    const MAX_PATTERN_SIZE = 3000; // 10in @ 300dpi shall be enough
    // We need to keep transparent border around our pattern for fill():
    // createPattern with 'no-repeat' will bleed edges across entire area.

    const BORDER_SIZE = 2;
    const offsetX = Math.floor(this._bounds[0]);
    const offsetY = Math.floor(this._bounds[1]);
    const boundsWidth = Math.ceil(this._bounds[2]) - offsetX;
    const boundsHeight = Math.ceil(this._bounds[3]) - offsetY;
    const width = Math.min(Math.ceil(Math.abs(boundsWidth * combinedScale[0] * EXPECTED_SCALE)), MAX_PATTERN_SIZE);
    const height = Math.min(Math.ceil(Math.abs(boundsHeight * combinedScale[1] * EXPECTED_SCALE)), MAX_PATTERN_SIZE);
    const scaleX = boundsWidth / width;
    const scaleY = boundsHeight / height;
    const context = {
      coords: this._coords,
      colors: this._colors,
      offsetX: -offsetX,
      offsetY: -offsetY,
      scaleX: 1 / scaleX,
      scaleY: 1 / scaleY
    };
    const paddedWidth = width + BORDER_SIZE * 2;
    const paddedHeight = height + BORDER_SIZE * 2;
    const tmpCanvas = cachedCanvases.getCanvas("mesh", paddedWidth, paddedHeight, false);
    const tmpCtx = tmpCanvas.context;
    const data = tmpCtx.createImageData(width, height);

    if (backgroundColor) {
      const bytes = data.data;

      for (let i = 0, ii = bytes.length; i < ii; i += 4) {
        bytes[i] = backgroundColor[0];
        bytes[i + 1] = backgroundColor[1];
        bytes[i + 2] = backgroundColor[2];
        bytes[i + 3] = 255;
      }
    }

    for (const figure of this._figures) {
      drawFigure(data, figure, context);
    }

    tmpCtx.putImageData(data, BORDER_SIZE, BORDER_SIZE);
    const canvas = tmpCanvas.canvas;
    return {
      canvas,
      offsetX: offsetX - BORDER_SIZE * scaleX,
      offsetY: offsetY - BORDER_SIZE * scaleY,
      scaleX,
      scaleY
    };
  }

  getPattern(ctx, owner, inverse, shadingFill = false) {
    applyBoundingBox(ctx, this._bbox);
    let scale;

    if (shadingFill) {
      scale = Util.singularValueDecompose2dScale(ctx.mozCurrentTransform);
    } else {
      // Obtain scale from matrix and current transformation matrix.
      scale = Util.singularValueDecompose2dScale(owner.baseTransform);

      if (this._matrix) {
        const matrixScale = Util.singularValueDecompose2dScale(this._matrix);
        scale = [scale[0] * matrixScale[0], scale[1] * matrixScale[1]];
      }
    } // Rasterizing on the main thread since sending/queue large canvases
    // might cause OOM.


    const temporaryPatternCanvas = this._createMeshCanvas(scale, shadingFill ? null : this._background, owner.cachedCanvases);

    if (!shadingFill) {
      ctx.setTransform.apply(ctx, owner.baseTransform);

      if (this._matrix) {
        ctx.transform.apply(ctx, this._matrix);
      }
    }

    ctx.translate(temporaryPatternCanvas.offsetX, temporaryPatternCanvas.offsetY);
    ctx.scale(temporaryPatternCanvas.scaleX, temporaryPatternCanvas.scaleY);
    return ctx.createPattern(temporaryPatternCanvas.canvas, "no-repeat");
  }

}

class DummyShadingPattern extends BaseShadingPattern {
  getPattern() {
    return "hotpink";
  }

}

function getShadingPattern(IR) {
  switch (IR[0]) {
    case "RadialAxial":
      return new RadialAxialShadingPattern(IR);

    case "Mesh":
      return new MeshShadingPattern(IR);

    case "Dummy":
      return new DummyShadingPattern();
  }

  throw new Error(`Unknown IR type: ${IR[0]}`);
}

const PaintType = {
  COLORED: 1,
  UNCOLORED: 2
};

class TilingPattern {
  // 10in @ 300dpi shall be enough.
  static get MAX_PATTERN_SIZE() {
    return shadow(this, "MAX_PATTERN_SIZE", 3000);
  }

  constructor(IR, color, ctx, canvasGraphicsFactory, baseTransform) {
    this.operatorList = IR[2];
    this.matrix = IR[3] || [1, 0, 0, 1, 0, 0];
    this.bbox = IR[4];
    this.xstep = IR[5];
    this.ystep = IR[6];
    this.paintType = IR[7];
    this.tilingType = IR[8];
    this.color = color;
    this.ctx = ctx;
    this.canvasGraphicsFactory = canvasGraphicsFactory;
    this.baseTransform = baseTransform;
  }

  createPatternCanvas(owner) {
    const operatorList = this.operatorList;
    const bbox = this.bbox;
    const xstep = this.xstep;
    const ystep = this.ystep;
    const paintType = this.paintType;
    const tilingType = this.tilingType;
    const color = this.color;
    const canvasGraphicsFactory = this.canvasGraphicsFactory;
    info("TilingType: " + tilingType); // A tiling pattern as defined by PDF spec 8.7.2 is a cell whose size is
    // described by bbox, and may repeat regularly by shifting the cell by
    // xstep and ystep.
    // Because the HTML5 canvas API does not support pattern repetition with
    // gaps in between, we use the xstep/ystep instead of the bbox's size.
    //
    // This has the following consequences (similarly for ystep):
    //
    // - If xstep is the same as bbox, then there is no observable difference.
    //
    // - If xstep is larger than bbox, then the pattern canvas is partially
    //   empty: the area bounded by bbox is painted, the outside area is void.
    //
    // - If xstep is smaller than bbox, then the pixels between xstep and the
    //   bbox boundary will be missing. This is INCORRECT behavior.
    //   "Figures on adjacent tiles should not overlap" (PDF spec 8.7.3.1),
    //   but overlapping cells without common pixels are still valid.
    //   TODO: Fix the implementation, to allow this scenario to be painted
    //   correctly.

    const x0 = bbox[0],
          y0 = bbox[1],
          x1 = bbox[2],
          y1 = bbox[3]; // Obtain scale from matrix and current transformation matrix.

    const matrixScale = Util.singularValueDecompose2dScale(this.matrix);
    const curMatrixScale = Util.singularValueDecompose2dScale(this.baseTransform);
    const combinedScale = [matrixScale[0] * curMatrixScale[0], matrixScale[1] * curMatrixScale[1]]; // Use width and height values that are as close as possible to the end
    // result when the pattern is used. Too low value makes the pattern look
    // blurry. Too large value makes it look too crispy.

    const dimx = this.getSizeAndScale(xstep, this.ctx.canvas.width, combinedScale[0]);
    const dimy = this.getSizeAndScale(ystep, this.ctx.canvas.height, combinedScale[1]);
    const tmpCanvas = owner.cachedCanvases.getCanvas("pattern", dimx.size, dimy.size, true);
    const tmpCtx = tmpCanvas.context;
    const graphics = canvasGraphicsFactory.createCanvasGraphics(tmpCtx);
    graphics.groupLevel = owner.groupLevel;
    this.setFillAndStrokeStyleToContext(graphics, paintType, color);
    let adjustedX0 = x0;
    let adjustedY0 = y0;
    let adjustedX1 = x1;
    let adjustedY1 = y1; // Some bounding boxes have negative x0/y0 cordinates which will cause the
    // some of the drawing to be off of the canvas. To avoid this shift the
    // bounding box over.

    if (x0 < 0) {
      adjustedX0 = 0;
      adjustedX1 += Math.abs(x0);
    }

    if (y0 < 0) {
      adjustedY0 = 0;
      adjustedY1 += Math.abs(y0);
    }

    tmpCtx.translate(-(dimx.scale * adjustedX0), -(dimy.scale * adjustedY0));
    graphics.transform(dimx.scale, 0, 0, dimy.scale, 0, 0);
    this.clipBbox(graphics, adjustedX0, adjustedY0, adjustedX1, adjustedY1);
    graphics.baseTransform = graphics.ctx.mozCurrentTransform.slice();
    graphics.executeOperatorList(operatorList);
    graphics.endDrawing();
    return {
      canvas: tmpCanvas.canvas,
      scaleX: dimx.scale,
      scaleY: dimy.scale,
      offsetX: adjustedX0,
      offsetY: adjustedY0
    };
  }

  getSizeAndScale(step, realOutputSize, scale) {
    // xstep / ystep may be negative -- normalize.
    step = Math.abs(step); // MAX_PATTERN_SIZE is used to avoid OOM situation.
    // Use the destination canvas's size if it is bigger than the hard-coded
    // limit of MAX_PATTERN_SIZE to avoid clipping patterns that cover the
    // whole canvas.

    const maxSize = Math.max(TilingPattern.MAX_PATTERN_SIZE, realOutputSize);
    let size = Math.ceil(step * scale);

    if (size >= maxSize) {
      size = maxSize;
    } else {
      scale = size / step;
    }

    return {
      scale,
      size
    };
  }

  clipBbox(graphics, x0, y0, x1, y1) {
    const bboxWidth = x1 - x0;
    const bboxHeight = y1 - y0;
    graphics.ctx.rect(x0, y0, bboxWidth, bboxHeight);
    graphics.clip();
    graphics.endPath();
  }

  setFillAndStrokeStyleToContext(graphics, paintType, color) {
    const context = graphics.ctx,
          current = graphics.current;

    switch (paintType) {
      case PaintType.COLORED:
        const ctx = this.ctx;
        context.fillStyle = ctx.fillStyle;
        context.strokeStyle = ctx.strokeStyle;
        current.fillColor = ctx.fillStyle;
        current.strokeColor = ctx.strokeStyle;
        break;

      case PaintType.UNCOLORED:
        const cssColor = Util.makeHexColor(color[0], color[1], color[2]);
        context.fillStyle = cssColor;
        context.strokeStyle = cssColor; // Set color needed by image masks (fixes issues 3226 and 8741).

        current.fillColor = cssColor;
        current.strokeColor = cssColor;
        break;

      default:
        throw new FormatError(`Unsupported paint type: ${paintType}`);
    }
  }

  getPattern(ctx, owner, inverse, shadingFill = false) {
    // PDF spec 8.7.2 NOTE 1: pattern's matrix is relative to initial matrix.
    let matrix = inverse;

    if (!shadingFill) {
      matrix = Util.transform(matrix, owner.baseTransform);

      if (this.matrix) {
        matrix = Util.transform(matrix, this.matrix);
      }
    }

    const temporaryPatternCanvas = this.createPatternCanvas(owner);
    let domMatrix = new DOMMatrix(matrix); // Rescale and so that the ctx.createPattern call generates a pattern with
    // the desired size.

    domMatrix = domMatrix.translate(temporaryPatternCanvas.offsetX, temporaryPatternCanvas.offsetY);
    domMatrix = domMatrix.scale(1 / temporaryPatternCanvas.scaleX, 1 / temporaryPatternCanvas.scaleY);
    const pattern = ctx.createPattern(temporaryPatternCanvas.canvas, "repeat");

    try {
      pattern.setTransform(domMatrix);
    } catch (ex) {
      // Avoid rendering breaking completely in Firefox 78 ESR,
      // and in Node.js (see issue 13724).
      warn(`TilingPattern.getPattern: "${ex === null || ex === void 0 ? void 0 : ex.message}".`);
    }

    return pattern;
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
// However, PDF needs a bit more state, which we store here.
// Minimal font size that would be used during canvas fillText operations.

const MIN_FONT_SIZE = 16; // Maximum font size that would be used during canvas fillText operations.

const MAX_FONT_SIZE = 100;
const MAX_GROUP_SIZE = 4096;
const MAX_SIZE_TO_COMPILE = 1000;
const FULL_CHUNK_HEIGHT = 16; // Because of https://bugs.chromium.org/p/chromium/issues/detail?id=1170396
// some curves aren't rendered correctly.
// Multiplying lineWidth by this factor should help to have "correct"
// rendering with no artifacts.
// Once the bug is fixed upstream, we can remove this constant and its use.

const LINEWIDTH_SCALE_FACTOR = 1.000001;

function addContextCurrentTransform(ctx) {
  // If the context doesn't expose a `mozCurrentTransform`, add a JS based one.
  if (ctx.mozCurrentTransform) {
    return;
  }

  ctx._originalSave = ctx.save;
  ctx._originalRestore = ctx.restore;
  ctx._originalRotate = ctx.rotate;
  ctx._originalScale = ctx.scale;
  ctx._originalTranslate = ctx.translate;
  ctx._originalTransform = ctx.transform;
  ctx._originalSetTransform = ctx.setTransform;
  ctx._originalResetTransform = ctx.resetTransform;
  ctx._transformMatrix = ctx._transformMatrix || [1, 0, 0, 1, 0, 0];
  ctx._transformStack = [];

  try {
    // The call to getOwnPropertyDescriptor throws an exception in Node.js:
    // "TypeError: Method lineWidth called on incompatible receiver
    //  #<CanvasRenderingContext2D>".
    const desc = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(ctx), "lineWidth");
    ctx._setLineWidth = desc.set;
    ctx._getLineWidth = desc.get;
    Object.defineProperty(ctx, "lineWidth", {
      set: function setLineWidth(width) {
        this._setLineWidth(width * LINEWIDTH_SCALE_FACTOR);
      },
      get: function getLineWidth() {
        return this._getLineWidth();
      }
    });
  } catch (_) {}

  Object.defineProperty(ctx, "mozCurrentTransform", {
    get: function getCurrentTransform() {
      return this._transformMatrix;
    }
  });
  Object.defineProperty(ctx, "mozCurrentTransformInverse", {
    get: function getCurrentTransformInverse() {
      // Calculation done using WolframAlpha:
      // http://www.wolframalpha.com/input/?
      //   i=Inverse+{{a%2C+c%2C+e}%2C+{b%2C+d%2C+f}%2C+{0%2C+0%2C+1}}
      const [a, b, c, d, e, f] = this._transformMatrix;
      const ad_bc = a * d - b * c;
      const bc_ad = b * c - a * d;
      return [d / ad_bc, b / bc_ad, c / bc_ad, a / ad_bc, (d * e - c * f) / bc_ad, (b * e - a * f) / ad_bc];
    }
  });

  ctx.save = function ctxSave() {
    const old = this._transformMatrix;

    this._transformStack.push(old);

    this._transformMatrix = old.slice(0, 6);

    this._originalSave();
  };

  ctx.restore = function ctxRestore() {
    const prev = this._transformStack.pop();

    if (prev) {
      this._transformMatrix = prev;

      this._originalRestore();
    }
  };

  ctx.translate = function ctxTranslate(x, y) {
    const m = this._transformMatrix;
    m[4] = m[0] * x + m[2] * y + m[4];
    m[5] = m[1] * x + m[3] * y + m[5];

    this._originalTranslate(x, y);
  };

  ctx.scale = function ctxScale(x, y) {
    const m = this._transformMatrix;
    m[0] *= x;
    m[1] *= x;
    m[2] *= y;
    m[3] *= y;

    this._originalScale(x, y);
  };

  ctx.transform = function ctxTransform(a, b, c, d, e, f) {
    const m = this._transformMatrix;
    this._transformMatrix = [m[0] * a + m[2] * b, m[1] * a + m[3] * b, m[0] * c + m[2] * d, m[1] * c + m[3] * d, m[0] * e + m[2] * f + m[4], m[1] * e + m[3] * f + m[5]];

    ctx._originalTransform(a, b, c, d, e, f);
  };

  ctx.setTransform = function ctxSetTransform(a, b, c, d, e, f) {
    this._transformMatrix = [a, b, c, d, e, f];

    ctx._originalSetTransform(a, b, c, d, e, f);
  };

  ctx.resetTransform = function ctxResetTransform() {
    this._transformMatrix = [1, 0, 0, 1, 0, 0];

    ctx._originalResetTransform();
  };

  ctx.rotate = function ctxRotate(angle) {
    const cosValue = Math.cos(angle);
    const sinValue = Math.sin(angle);
    const m = this._transformMatrix;
    this._transformMatrix = [m[0] * cosValue + m[2] * sinValue, m[1] * cosValue + m[3] * sinValue, m[0] * -sinValue + m[2] * cosValue, m[1] * -sinValue + m[3] * cosValue, m[4], m[5]];

    this._originalRotate(angle);
  };
}

class CachedCanvases {
  constructor(canvasFactory) {
    this.canvasFactory = canvasFactory;
    this.cache = Object.create(null);
  }

  getCanvas(id, width, height, trackTransform) {
    let canvasEntry;

    if (this.cache[id] !== undefined) {
      canvasEntry = this.cache[id];
      this.canvasFactory.reset(canvasEntry, width, height); // reset canvas transform for emulated mozCurrentTransform, if needed

      canvasEntry.context.setTransform(1, 0, 0, 1, 0, 0);
    } else {
      canvasEntry = this.canvasFactory.create(width, height);
      this.cache[id] = canvasEntry;
    }

    if (trackTransform) {
      addContextCurrentTransform(canvasEntry.context);
    }

    return canvasEntry;
  }

  clear() {
    for (const id in this.cache) {
      const canvasEntry = this.cache[id];
      this.canvasFactory.destroy(canvasEntry);
      delete this.cache[id];
    }
  }

}

function compileType3Glyph(imgData) {
  const POINT_TO_PROCESS_LIMIT = 1000;
  const POINT_TYPES = new Uint8Array([0, 2, 4, 0, 1, 0, 5, 4, 8, 10, 0, 8, 0, 2, 1, 0]);
  const width = imgData.width,
        height = imgData.height,
        width1 = width + 1;
  let i, ii, j, j0;
  const points = new Uint8Array(width1 * (height + 1)); // decodes bit-packed mask data

  const lineSize = width + 7 & ~7,
        data0 = imgData.data;
  const data = new Uint8Array(lineSize * height);
  let pos = 0;

  for (i = 0, ii = data0.length; i < ii; i++) {
    const elem = data0[i];
    let mask = 128;

    while (mask > 0) {
      data[pos++] = elem & mask ? 0 : 255;
      mask >>= 1;
    }
  } // finding interesting points: every point is located between mask pixels,
  // so there will be points of the (width + 1)x(height + 1) grid. Every point
  // will have flags assigned based on neighboring mask pixels:
  //   4 | 8
  //   --P--
  //   2 | 1
  // We are interested only in points with the flags:
  //   - outside corners: 1, 2, 4, 8;
  //   - inside corners: 7, 11, 13, 14;
  //   - and, intersections: 5, 10.


  let count = 0;
  pos = 0;

  if (data[pos] !== 0) {
    points[0] = 1;
    ++count;
  }

  for (j = 1; j < width; j++) {
    if (data[pos] !== data[pos + 1]) {
      points[j] = data[pos] ? 2 : 1;
      ++count;
    }

    pos++;
  }

  if (data[pos] !== 0) {
    points[j] = 2;
    ++count;
  }

  for (i = 1; i < height; i++) {
    pos = i * lineSize;
    j0 = i * width1;

    if (data[pos - lineSize] !== data[pos]) {
      points[j0] = data[pos] ? 1 : 8;
      ++count;
    } // 'sum' is the position of the current pixel configuration in the 'TYPES'
    // array (in order 8-1-2-4, so we can use '>>2' to shift the column).


    let sum = (data[pos] ? 4 : 0) + (data[pos - lineSize] ? 8 : 0);

    for (j = 1; j < width; j++) {
      sum = (sum >> 2) + (data[pos + 1] ? 4 : 0) + (data[pos - lineSize + 1] ? 8 : 0);

      if (POINT_TYPES[sum]) {
        points[j0 + j] = POINT_TYPES[sum];
        ++count;
      }

      pos++;
    }

    if (data[pos - lineSize] !== data[pos]) {
      points[j0 + j] = data[pos] ? 2 : 4;
      ++count;
    }

    if (count > POINT_TO_PROCESS_LIMIT) {
      return null;
    }
  }

  pos = lineSize * (height - 1);
  j0 = i * width1;

  if (data[pos] !== 0) {
    points[j0] = 8;
    ++count;
  }

  for (j = 1; j < width; j++) {
    if (data[pos] !== data[pos + 1]) {
      points[j0 + j] = data[pos] ? 4 : 8;
      ++count;
    }

    pos++;
  }

  if (data[pos] !== 0) {
    points[j0 + j] = 4;
    ++count;
  }

  if (count > POINT_TO_PROCESS_LIMIT) {
    return null;
  } // building outlines


  const steps = new Int32Array([0, width1, -1, 0, -width1, 0, 0, 0, 1]);
  const outlines = [];

  for (i = 0; count && i <= height; i++) {
    let p = i * width1;
    const end = p + width;

    while (p < end && !points[p]) {
      p++;
    }

    if (p === end) {
      continue;
    }

    const coords = [p % width1, i];
    const p0 = p;
    let type = points[p];

    do {
      const step = steps[type];

      do {
        p += step;
      } while (!points[p]);

      const pp = points[p];

      if (pp !== 5 && pp !== 10) {
        // set new direction
        type = pp; // delete mark

        points[p] = 0;
      } else {
        // type is 5 or 10, ie, a crossing
        // set new direction
        type = pp & 0x33 * type >> 4; // set new type for "future hit"

        points[p] &= type >> 2 | type << 2;
      }

      coords.push(p % width1, p / width1 | 0);

      if (!points[p]) {
        --count;
      }
    } while (p0 !== p);

    outlines.push(coords);
    --i;
  }

  const drawOutline = function (c) {
    c.save(); // the path shall be painted in [0..1]x[0..1] space

    c.scale(1 / width, -1 / height);
    c.translate(0, -height);
    c.beginPath();

    for (let k = 0, kk = outlines.length; k < kk; k++) {
      const o = outlines[k];
      c.moveTo(o[0], o[1]);

      for (let l = 2, ll = o.length; l < ll; l += 2) {
        c.lineTo(o[l], o[l + 1]);
      }
    }

    c.fill();
    c.beginPath();
    c.restore();
  };

  return drawOutline;
}

class CanvasExtraState {
  constructor() {
    // Are soft masks and alpha values shapes or opacities?
    this.alphaIsShape = false;
    this.fontSize = 0;
    this.fontSizeScale = 1;
    this.textMatrix = IDENTITY_MATRIX;
    this.textMatrixScale = 1;
    this.fontMatrix = FONT_IDENTITY_MATRIX;
    this.leading = 0; // Current point (in user coordinates)

    this.x = 0;
    this.y = 0; // Start of text line (in text coordinates)

    this.lineX = 0;
    this.lineY = 0; // Character and word spacing

    this.charSpacing = 0;
    this.wordSpacing = 0;
    this.textHScale = 1;
    this.textRenderingMode = TextRenderingMode.FILL;
    this.textRise = 0; // Default fore and background colors

    this.fillColor = "#000000";
    this.strokeColor = "#000000";
    this.patternFill = false; // Note: fill alpha applies to all non-stroking operations

    this.fillAlpha = 1;
    this.strokeAlpha = 1;
    this.lineWidth = 1;
    this.activeSMask = null;
    this.resumeSMaskCtx = null; // nonclonable field (see the save method below)

    this.transferMaps = null;
  }

  clone() {
    return Object.create(this);
  }

  setCurrentPoint(x, y) {
    this.x = x;
    this.y = y;
  }

}
/**
 * @type {any}
 */


const CanvasGraphics = function CanvasGraphicsClosure() {
  // Defines the time the executeOperatorList is going to be executing
  // before it stops and shedules a continue of execution.
  const EXECUTION_TIME = 15; // Defines the number of steps before checking the execution time

  const EXECUTION_STEPS = 10;

  function putBinaryImageData(ctx, imgData, transferMaps = null) {
    if (typeof ImageData !== "undefined" && imgData instanceof ImageData) {
      ctx.putImageData(imgData, 0, 0);
      return;
    } // Put the image data to the canvas in chunks, rather than putting the
    // whole image at once.  This saves JS memory, because the ImageData object
    // is smaller. It also possibly saves C++ memory within the implementation
    // of putImageData(). (E.g. in Firefox we make two short-lived copies of
    // the data passed to putImageData()). |n| shouldn't be too small, however,
    // because too many putImageData() calls will slow things down.
    //
    // Note: as written, if the last chunk is partial, the putImageData() call
    // will (conceptually) put pixels past the bounds of the canvas.  But
    // that's ok; any such pixels are ignored.


    const height = imgData.height,
          width = imgData.width;
    const partialChunkHeight = height % FULL_CHUNK_HEIGHT;
    const fullChunks = (height - partialChunkHeight) / FULL_CHUNK_HEIGHT;
    const totalChunks = partialChunkHeight === 0 ? fullChunks : fullChunks + 1;
    const chunkImgData = ctx.createImageData(width, FULL_CHUNK_HEIGHT);
    let srcPos = 0,
        destPos;
    const src = imgData.data;
    const dest = chunkImgData.data;
    let i, j, thisChunkHeight, elemsInThisChunk;
    let transferMapRed, transferMapGreen, transferMapBlue, transferMapGray;

    if (transferMaps) {
      switch (transferMaps.length) {
        case 1:
          transferMapRed = transferMaps[0];
          transferMapGreen = transferMaps[0];
          transferMapBlue = transferMaps[0];
          transferMapGray = transferMaps[0];
          break;

        case 4:
          transferMapRed = transferMaps[0];
          transferMapGreen = transferMaps[1];
          transferMapBlue = transferMaps[2];
          transferMapGray = transferMaps[3];
          break;
      }
    } // There are multiple forms in which the pixel data can be passed, and
    // imgData.kind tells us which one this is.


    if (imgData.kind === ImageKind.GRAYSCALE_1BPP) {
      // Grayscale, 1 bit per pixel (i.e. black-and-white).
      const srcLength = src.byteLength;
      const dest32 = new Uint32Array(dest.buffer, 0, dest.byteLength >> 2);
      const dest32DataLength = dest32.length;
      const fullSrcDiff = width + 7 >> 3;
      let white = 0xffffffff;
      let black = IsLittleEndianCached.value ? 0xff000000 : 0x000000ff;

      if (transferMapGray) {
        if (transferMapGray[0] === 0xff && transferMapGray[0xff] === 0) {
          [white, black] = [black, white];
        }
      }

      for (i = 0; i < totalChunks; i++) {
        thisChunkHeight = i < fullChunks ? FULL_CHUNK_HEIGHT : partialChunkHeight;
        destPos = 0;

        for (j = 0; j < thisChunkHeight; j++) {
          const srcDiff = srcLength - srcPos;
          let k = 0;
          const kEnd = srcDiff > fullSrcDiff ? width : srcDiff * 8 - 7;
          const kEndUnrolled = kEnd & ~7;
          let mask = 0;
          let srcByte = 0;

          for (; k < kEndUnrolled; k += 8) {
            srcByte = src[srcPos++];
            dest32[destPos++] = srcByte & 128 ? white : black;
            dest32[destPos++] = srcByte & 64 ? white : black;
            dest32[destPos++] = srcByte & 32 ? white : black;
            dest32[destPos++] = srcByte & 16 ? white : black;
            dest32[destPos++] = srcByte & 8 ? white : black;
            dest32[destPos++] = srcByte & 4 ? white : black;
            dest32[destPos++] = srcByte & 2 ? white : black;
            dest32[destPos++] = srcByte & 1 ? white : black;
          }

          for (; k < kEnd; k++) {
            if (mask === 0) {
              srcByte = src[srcPos++];
              mask = 128;
            }

            dest32[destPos++] = srcByte & mask ? white : black;
            mask >>= 1;
          }
        } // We ran out of input. Make all remaining pixels transparent.


        while (destPos < dest32DataLength) {
          dest32[destPos++] = 0;
        }

        ctx.putImageData(chunkImgData, 0, i * FULL_CHUNK_HEIGHT);
      }
    } else if (imgData.kind === ImageKind.RGBA_32BPP) {
      // RGBA, 32-bits per pixel.
      const hasTransferMaps = !!(transferMapRed || transferMapGreen || transferMapBlue);
      j = 0;
      elemsInThisChunk = width * FULL_CHUNK_HEIGHT * 4;

      for (i = 0; i < fullChunks; i++) {
        dest.set(src.subarray(srcPos, srcPos + elemsInThisChunk));
        srcPos += elemsInThisChunk;

        if (hasTransferMaps) {
          for (let k = 0; k < elemsInThisChunk; k += 4) {
            if (transferMapRed) {
              dest[k + 0] = transferMapRed[dest[k + 0]];
            }

            if (transferMapGreen) {
              dest[k + 1] = transferMapGreen[dest[k + 1]];
            }

            if (transferMapBlue) {
              dest[k + 2] = transferMapBlue[dest[k + 2]];
            }
          }
        }

        ctx.putImageData(chunkImgData, 0, j);
        j += FULL_CHUNK_HEIGHT;
      }

      if (i < totalChunks) {
        elemsInThisChunk = width * partialChunkHeight * 4;
        dest.set(src.subarray(srcPos, srcPos + elemsInThisChunk));

        if (hasTransferMaps) {
          for (let k = 0; k < elemsInThisChunk; k += 4) {
            if (transferMapRed) {
              dest[k + 0] = transferMapRed[dest[k + 0]];
            }

            if (transferMapGreen) {
              dest[k + 1] = transferMapGreen[dest[k + 1]];
            }

            if (transferMapBlue) {
              dest[k + 2] = transferMapBlue[dest[k + 2]];
            }
          }
        }

        ctx.putImageData(chunkImgData, 0, j);
      }
    } else if (imgData.kind === ImageKind.RGB_24BPP) {
      // RGB, 24-bits per pixel.
      const hasTransferMaps = !!(transferMapRed || transferMapGreen || transferMapBlue);
      thisChunkHeight = FULL_CHUNK_HEIGHT;
      elemsInThisChunk = width * thisChunkHeight;

      for (i = 0; i < totalChunks; i++) {
        if (i >= fullChunks) {
          thisChunkHeight = partialChunkHeight;
          elemsInThisChunk = width * thisChunkHeight;
        }

        destPos = 0;

        for (j = elemsInThisChunk; j--;) {
          dest[destPos++] = src[srcPos++];
          dest[destPos++] = src[srcPos++];
          dest[destPos++] = src[srcPos++];
          dest[destPos++] = 255;
        }

        if (hasTransferMaps) {
          for (let k = 0; k < destPos; k += 4) {
            if (transferMapRed) {
              dest[k + 0] = transferMapRed[dest[k + 0]];
            }

            if (transferMapGreen) {
              dest[k + 1] = transferMapGreen[dest[k + 1]];
            }

            if (transferMapBlue) {
              dest[k + 2] = transferMapBlue[dest[k + 2]];
            }
          }
        }

        ctx.putImageData(chunkImgData, 0, i * FULL_CHUNK_HEIGHT);
      }
    } else {
      throw new Error(`bad image kind: ${imgData.kind}`);
    }
  }

  function putBinaryImageMask(ctx, imgData) {
    const height = imgData.height,
          width = imgData.width;
    const partialChunkHeight = height % FULL_CHUNK_HEIGHT;
    const fullChunks = (height - partialChunkHeight) / FULL_CHUNK_HEIGHT;
    const totalChunks = partialChunkHeight === 0 ? fullChunks : fullChunks + 1;
    const chunkImgData = ctx.createImageData(width, FULL_CHUNK_HEIGHT);
    let srcPos = 0;
    const src = imgData.data;
    const dest = chunkImgData.data;

    for (let i = 0; i < totalChunks; i++) {
      const thisChunkHeight = i < fullChunks ? FULL_CHUNK_HEIGHT : partialChunkHeight; // Expand the mask so it can be used by the canvas.  Any required
      // inversion has already been handled.

      let destPos = 3; // alpha component offset

      for (let j = 0; j < thisChunkHeight; j++) {
        let elem,
            mask = 0;

        for (let k = 0; k < width; k++) {
          if (!mask) {
            elem = src[srcPos++];
            mask = 128;
          }

          dest[destPos] = elem & mask ? 0 : 255;
          destPos += 4;
          mask >>= 1;
        }
      }

      ctx.putImageData(chunkImgData, 0, i * FULL_CHUNK_HEIGHT);
    }
  }

  function copyCtxState(sourceCtx, destCtx) {
    const properties = ["strokeStyle", "fillStyle", "fillRule", "globalAlpha", "lineWidth", "lineCap", "lineJoin", "miterLimit", "globalCompositeOperation", "font"];

    for (let i = 0, ii = properties.length; i < ii; i++) {
      const property = properties[i];

      if (sourceCtx[property] !== undefined) {
        destCtx[property] = sourceCtx[property];
      }
    }

    if (sourceCtx.setLineDash !== undefined) {
      destCtx.setLineDash(sourceCtx.getLineDash());
      destCtx.lineDashOffset = sourceCtx.lineDashOffset;
    }
  }

  function resetCtxToDefault(ctx) {
    ctx.strokeStyle = "#000000";
    ctx.fillStyle = "#000000";
    ctx.fillRule = "nonzero";
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1;
    ctx.lineCap = "butt";
    ctx.lineJoin = "miter";
    ctx.miterLimit = 10;
    ctx.globalCompositeOperation = "source-over";
    ctx.font = "10px sans-serif";

    if (ctx.setLineDash !== undefined) {
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;
    }
  }

  function composeSMaskBackdrop(bytes, r0, g0, b0) {
    const length = bytes.length;

    for (let i = 3; i < length; i += 4) {
      const alpha = bytes[i];

      if (alpha === 0) {
        bytes[i - 3] = r0;
        bytes[i - 2] = g0;
        bytes[i - 1] = b0;
      } else if (alpha < 255) {
        const alpha_ = 255 - alpha;
        bytes[i - 3] = bytes[i - 3] * alpha + r0 * alpha_ >> 8;
        bytes[i - 2] = bytes[i - 2] * alpha + g0 * alpha_ >> 8;
        bytes[i - 1] = bytes[i - 1] * alpha + b0 * alpha_ >> 8;
      }
    }
  }

  function composeSMaskAlpha(maskData, layerData, transferMap) {
    const length = maskData.length;
    const scale = 1 / 255;

    for (let i = 3; i < length; i += 4) {
      const alpha = transferMap ? transferMap[maskData[i]] : maskData[i];
      layerData[i] = layerData[i] * alpha * scale | 0;
    }
  }

  function composeSMaskLuminosity(maskData, layerData, transferMap) {
    const length = maskData.length;

    for (let i = 3; i < length; i += 4) {
      const y = maskData[i - 3] * 77 + // * 0.3 / 255 * 0x10000
      maskData[i - 2] * 152 + // * 0.59 ....
      maskData[i - 1] * 28; // * 0.11 ....

      layerData[i] = transferMap ? layerData[i] * transferMap[y >> 8] >> 8 : layerData[i] * y >> 16;
    }
  }

  function genericComposeSMask(maskCtx, layerCtx, width, height, subtype, backdrop, transferMap) {
    const hasBackdrop = !!backdrop;
    const r0 = hasBackdrop ? backdrop[0] : 0;
    const g0 = hasBackdrop ? backdrop[1] : 0;
    const b0 = hasBackdrop ? backdrop[2] : 0;
    let composeFn;

    if (subtype === "Luminosity") {
      composeFn = composeSMaskLuminosity;
    } else {
      composeFn = composeSMaskAlpha;
    } // processing image in chunks to save memory


    const PIXELS_TO_PROCESS = 1048576;
    const chunkSize = Math.min(height, Math.ceil(PIXELS_TO_PROCESS / width));

    for (let row = 0; row < height; row += chunkSize) {
      const chunkHeight = Math.min(chunkSize, height - row);
      const maskData = maskCtx.getImageData(0, row, width, chunkHeight);
      const layerData = layerCtx.getImageData(0, row, width, chunkHeight);

      if (hasBackdrop) {
        composeSMaskBackdrop(maskData.data, r0, g0, b0);
      }

      composeFn(maskData.data, layerData.data, transferMap);
      maskCtx.putImageData(layerData, 0, row);
    }
  }

  function composeSMask(ctx, smask, layerCtx) {
    const mask = smask.canvas;
    const maskCtx = smask.context;
    ctx.setTransform(smask.scaleX, 0, 0, smask.scaleY, smask.offsetX, smask.offsetY);
    genericComposeSMask(maskCtx, layerCtx, mask.width, mask.height, smask.subtype, smask.backdrop, smask.transferMap);
    ctx.drawImage(mask, 0, 0);
  }

  const LINE_CAP_STYLES = ["butt", "round", "square"];
  const LINE_JOIN_STYLES = ["miter", "round", "bevel"];
  const NORMAL_CLIP = {};
  const EO_CLIP = {}; // eslint-disable-next-line no-shadow

  class CanvasGraphics {
    constructor(canvasCtx, commonObjs, objs, canvasFactory, imageLayer, optionalContentConfig) {
      this.ctx = canvasCtx;
      this.current = new CanvasExtraState();
      this.stateStack = [];
      this.pendingClip = null;
      this.pendingEOFill = false;
      this.res = null;
      this.xobjs = null;
      this.commonObjs = commonObjs;
      this.objs = objs;
      this.canvasFactory = canvasFactory;
      this.imageLayer = imageLayer;
      this.groupStack = [];
      this.processingType3 = null; // Patterns are painted relative to the initial page/form transform, see
      // PDF spec 8.7.2 NOTE 1.

      this.baseTransform = null;
      this.baseTransformStack = [];
      this.groupLevel = 0;
      this.smaskStack = [];
      this.smaskCounter = 0;
      this.tempSMask = null;
      this.contentVisible = true;
      this.markedContentStack = [];
      this.optionalContentConfig = optionalContentConfig;
      this.cachedCanvases = new CachedCanvases(this.canvasFactory);
      this.cachedPatterns = new Map();

      if (canvasCtx) {
        // NOTE: if mozCurrentTransform is polyfilled, then the current state of
        // the transformation must already be set in canvasCtx._transformMatrix.
        addContextCurrentTransform(canvasCtx);
      }

      this._cachedGetSinglePixelWidth = null;
    }

    beginDrawing({
      transform,
      viewport,
      transparency = false,
      background = null
    }) {
      // For pdfs that use blend modes we have to clear the canvas else certain
      // blend modes can look wrong since we'd be blending with a white
      // backdrop. The problem with a transparent backdrop though is we then
      // don't get sub pixel anti aliasing on text, creating temporary
      // transparent canvas when we have blend modes.
      const width = this.ctx.canvas.width;
      const height = this.ctx.canvas.height;
      this.ctx.save();
      this.ctx.fillStyle = background || "rgb(255, 255, 255)";
      this.ctx.fillRect(0, 0, width, height);
      this.ctx.restore();

      if (transparency) {
        const transparentCanvas = this.cachedCanvases.getCanvas("transparent", width, height, true);
        this.compositeCtx = this.ctx;
        this.transparentCanvas = transparentCanvas.canvas;
        this.ctx = transparentCanvas.context;
        this.ctx.save(); // The transform can be applied before rendering, transferring it to
        // the new canvas.

        this.ctx.transform.apply(this.ctx, this.compositeCtx.mozCurrentTransform);
      }

      this.ctx.save();
      resetCtxToDefault(this.ctx);

      if (transform) {
        this.ctx.transform.apply(this.ctx, transform);
      }

      this.ctx.transform.apply(this.ctx, viewport.transform);
      this.baseTransform = this.ctx.mozCurrentTransform.slice();
      this._combinedScaleFactor = Math.hypot(this.baseTransform[0], this.baseTransform[2]);

      if (this.imageLayer) {
        this.imageLayer.beginLayout();
      }
    }

    executeOperatorList(operatorList, executionStartIdx, continueCallback, stepper) {
      const argsArray = operatorList.argsArray;
      const fnArray = operatorList.fnArray;
      let i = executionStartIdx || 0;
      const argsArrayLen = argsArray.length; // Sometimes the OperatorList to execute is empty.

      if (argsArrayLen === i) {
        return i;
      }

      const chunkOperations = argsArrayLen - i > EXECUTION_STEPS && typeof continueCallback === "function";
      const endTime = chunkOperations ? Date.now() + EXECUTION_TIME : 0;
      let steps = 0;
      const commonObjs = this.commonObjs;
      const objs = this.objs;
      let fnId;

      while (true) {
        if (stepper !== undefined && i === stepper.nextBreakPoint) {
          stepper.breakIt(i, continueCallback);
          return i;
        }

        fnId = fnArray[i];

        if (fnId !== OPS.dependency) {
          this[fnId].apply(this, argsArray[i]);
        } else {
          for (const depObjId of argsArray[i]) {
            const objsPool = depObjId.startsWith("g_") ? commonObjs : objs; // If the promise isn't resolved yet, add the continueCallback
            // to the promise and bail out.

            if (!objsPool.has(depObjId)) {
              objsPool.get(depObjId, continueCallback);
              return i;
            }
          }
        }

        i++; // If the entire operatorList was executed, stop as were done.

        if (i === argsArrayLen) {
          return i;
        } // If the execution took longer then a certain amount of time and
        // `continueCallback` is specified, interrupt the execution.


        if (chunkOperations && ++steps > EXECUTION_STEPS) {
          if (Date.now() > endTime) {
            continueCallback();
            return i;
          }

          steps = 0;
        } // If the operatorList isn't executed completely yet OR the execution
        // time was short enough, do another execution round.

      }
    }

    endDrawing() {
      // Finishing all opened operations such as SMask group painting.
      while (this.stateStack.length || this.current.activeSMask !== null) {
        this.restore();
      }

      this.ctx.restore();

      if (this.transparentCanvas) {
        this.ctx = this.compositeCtx;
        this.ctx.save();
        this.ctx.setTransform(1, 0, 0, 1, 0, 0); // Avoid apply transform twice

        this.ctx.drawImage(this.transparentCanvas, 0, 0);
        this.ctx.restore();
        this.transparentCanvas = null;
      }

      this.cachedCanvases.clear();
      this.cachedPatterns.clear();

      if (this.imageLayer) {
        this.imageLayer.endLayout();
      }
    }

    _scaleImage(img, inverseTransform) {
      // Vertical or horizontal scaling shall not be more than 2 to not lose the
      // pixels during drawImage operation, painting on the temporary canvas(es)
      // that are twice smaller in size.
      const width = img.width;
      const height = img.height;
      let widthScale = Math.max(Math.hypot(inverseTransform[0], inverseTransform[1]), 1);
      let heightScale = Math.max(Math.hypot(inverseTransform[2], inverseTransform[3]), 1);
      let paintWidth = width,
          paintHeight = height;
      let tmpCanvasId = "prescale1";
      let tmpCanvas, tmpCtx;

      while (widthScale > 2 && paintWidth > 1 || heightScale > 2 && paintHeight > 1) {
        let newWidth = paintWidth,
            newHeight = paintHeight;

        if (widthScale > 2 && paintWidth > 1) {
          newWidth = Math.ceil(paintWidth / 2);
          widthScale /= paintWidth / newWidth;
        }

        if (heightScale > 2 && paintHeight > 1) {
          newHeight = Math.ceil(paintHeight / 2);
          heightScale /= paintHeight / newHeight;
        }

        tmpCanvas = this.cachedCanvases.getCanvas(tmpCanvasId, newWidth, newHeight);
        tmpCtx = tmpCanvas.context;
        tmpCtx.clearRect(0, 0, newWidth, newHeight);
        tmpCtx.drawImage(img, 0, 0, paintWidth, paintHeight, 0, 0, newWidth, newHeight);
        img = tmpCanvas.canvas;
        paintWidth = newWidth;
        paintHeight = newHeight;
        tmpCanvasId = tmpCanvasId === "prescale1" ? "prescale2" : "prescale1";
      }

      return {
        img,
        paintWidth,
        paintHeight
      };
    }

    _createMaskCanvas(img) {
      const ctx = this.ctx;
      const width = img.width,
            height = img.height;
      const fillColor = this.current.fillColor;
      const isPatternFill = this.current.patternFill;
      const maskCanvas = this.cachedCanvases.getCanvas("maskCanvas", width, height);
      const maskCtx = maskCanvas.context;
      putBinaryImageMask(maskCtx, img); // Create the mask canvas at the size it will be drawn at and also set
      // its transform to match the current transform so if there are any
      // patterns applied they will be applied relative to the correct
      // transform.

      const objToCanvas = ctx.mozCurrentTransform;
      let maskToCanvas = Util.transform(objToCanvas, [1 / width, 0, 0, -1 / height, 0, 0]);
      maskToCanvas = Util.transform(maskToCanvas, [1, 0, 0, 1, 0, -height]);
      const cord1 = Util.applyTransform([0, 0], maskToCanvas);
      const cord2 = Util.applyTransform([width, height], maskToCanvas);
      const rect = Util.normalizeRect([cord1[0], cord1[1], cord2[0], cord2[1]]);
      const drawnWidth = Math.ceil(rect[2] - rect[0]);
      const drawnHeight = Math.ceil(rect[3] - rect[1]);
      const fillCanvas = this.cachedCanvases.getCanvas("fillCanvas", drawnWidth, drawnHeight, true);
      const fillCtx = fillCanvas.context; // The offset will be the top-left cordinate mask.

      const offsetX = Math.min(cord1[0], cord2[0]);
      const offsetY = Math.min(cord1[1], cord2[1]);
      fillCtx.translate(-offsetX, -offsetY);
      fillCtx.transform.apply(fillCtx, maskToCanvas); // Pre-scale if needed to improve image smoothing.

      const scaled = this._scaleImage(maskCanvas.canvas, fillCtx.mozCurrentTransformInverse);

      fillCtx.drawImage(scaled.img, 0, 0, scaled.img.width, scaled.img.height, 0, 0, width, height);
      fillCtx.globalCompositeOperation = "source-in";
      const inverse = Util.transform(fillCtx.mozCurrentTransformInverse, [1, 0, 0, 1, -offsetX, -offsetY]);
      fillCtx.fillStyle = isPatternFill ? fillColor.getPattern(ctx, this, inverse, false) : fillColor;
      fillCtx.fillRect(0, 0, width, height); // Round the offsets to avoid drawing fractional pixels.

      return {
        canvas: fillCanvas.canvas,
        offsetX: Math.round(offsetX),
        offsetY: Math.round(offsetY)
      };
    } // Graphics state


    setLineWidth(width) {
      this.current.lineWidth = width;
      this.ctx.lineWidth = width;
    }

    setLineCap(style) {
      this.ctx.lineCap = LINE_CAP_STYLES[style];
    }

    setLineJoin(style) {
      this.ctx.lineJoin = LINE_JOIN_STYLES[style];
    }

    setMiterLimit(limit) {
      this.ctx.miterLimit = limit;
    }

    setDash(dashArray, dashPhase) {
      const ctx = this.ctx;

      if (ctx.setLineDash !== undefined) {
        ctx.setLineDash(dashArray);
        ctx.lineDashOffset = dashPhase;
      }
    }

    setRenderingIntent(intent) {// This operation is ignored since we haven't found a use case for it yet.
    }

    setFlatness(flatness) {// This operation is ignored since we haven't found a use case for it yet.
    }

    setGState(states) {
      for (let i = 0, ii = states.length; i < ii; i++) {
        const state = states[i];
        const key = state[0];
        const value = state[1];

        switch (key) {
          case "LW":
            this.setLineWidth(value);
            break;

          case "LC":
            this.setLineCap(value);
            break;

          case "LJ":
            this.setLineJoin(value);
            break;

          case "ML":
            this.setMiterLimit(value);
            break;

          case "D":
            this.setDash(value[0], value[1]);
            break;

          case "RI":
            this.setRenderingIntent(value);
            break;

          case "FL":
            this.setFlatness(value);
            break;

          case "Font":
            this.setFont(value[0], value[1]);
            break;

          case "CA":
            this.current.strokeAlpha = state[1];
            break;

          case "ca":
            this.current.fillAlpha = state[1];
            this.ctx.globalAlpha = state[1];
            break;

          case "BM":
            this.ctx.globalCompositeOperation = value;
            break;

          case "SMask":
            if (this.current.activeSMask) {
              // If SMask is currrenly used, it needs to be suspended or
              // finished. Suspend only makes sense when at least one save()
              // was performed and state needs to be reverted on restore().
              if (this.stateStack.length > 0 && this.stateStack[this.stateStack.length - 1].activeSMask === this.current.activeSMask) {
                this.suspendSMaskGroup();
              } else {
                this.endSMaskGroup();
              }
            }

            this.current.activeSMask = value ? this.tempSMask : null;

            if (this.current.activeSMask) {
              this.beginSMaskGroup();
            }

            this.tempSMask = null;
            break;

          case "TR":
            this.current.transferMaps = value;
        }
      }
    }

    beginSMaskGroup() {
      const activeSMask = this.current.activeSMask;
      const drawnWidth = activeSMask.canvas.width;
      const drawnHeight = activeSMask.canvas.height;
      const cacheId = "smaskGroupAt" + this.groupLevel;
      const scratchCanvas = this.cachedCanvases.getCanvas(cacheId, drawnWidth, drawnHeight, true);
      const currentCtx = this.ctx;
      const currentTransform = currentCtx.mozCurrentTransform;
      this.ctx.save();
      const groupCtx = scratchCanvas.context;
      groupCtx.scale(1 / activeSMask.scaleX, 1 / activeSMask.scaleY);
      groupCtx.translate(-activeSMask.offsetX, -activeSMask.offsetY);
      groupCtx.transform.apply(groupCtx, currentTransform);
      activeSMask.startTransformInverse = groupCtx.mozCurrentTransformInverse;
      copyCtxState(currentCtx, groupCtx);
      this.ctx = groupCtx;
      this.setGState([["BM", "source-over"], ["ca", 1], ["CA", 1]]);
      this.groupStack.push(currentCtx);
      this.groupLevel++;
    }

    suspendSMaskGroup() {
      // Similar to endSMaskGroup, the intermediate canvas has to be composed
      // and future ctx state restored.
      const groupCtx = this.ctx;
      this.groupLevel--;
      this.ctx = this.groupStack.pop();
      composeSMask(this.ctx, this.current.activeSMask, groupCtx);
      this.ctx.restore();
      this.ctx.save(); // save is needed since SMask will be resumed.

      copyCtxState(groupCtx, this.ctx); // Saving state for resuming.

      this.current.resumeSMaskCtx = groupCtx; // Transform was changed in the SMask canvas, reflecting this change on
      // this.ctx.

      const deltaTransform = Util.transform(this.current.activeSMask.startTransformInverse, groupCtx.mozCurrentTransform);
      this.ctx.transform.apply(this.ctx, deltaTransform); // SMask was composed, the results at the groupCtx can be cleared.

      groupCtx.save();
      groupCtx.setTransform(1, 0, 0, 1, 0, 0);
      groupCtx.clearRect(0, 0, groupCtx.canvas.width, groupCtx.canvas.height);
      groupCtx.restore();
    }

    resumeSMaskGroup() {
      // Resuming state saved by suspendSMaskGroup. We don't need to restore
      // any groupCtx state since restore() command (the only caller) will do
      // that for us. See also beginSMaskGroup.
      const groupCtx = this.current.resumeSMaskCtx;
      const currentCtx = this.ctx;
      this.ctx = groupCtx;
      this.groupStack.push(currentCtx);
      this.groupLevel++;
    }

    endSMaskGroup() {
      const groupCtx = this.ctx;
      this.groupLevel--;
      this.ctx = this.groupStack.pop();
      composeSMask(this.ctx, this.current.activeSMask, groupCtx);
      this.ctx.restore();
      copyCtxState(groupCtx, this.ctx); // Transform was changed in the SMask canvas, reflecting this change on
      // this.ctx.

      const deltaTransform = Util.transform(this.current.activeSMask.startTransformInverse, groupCtx.mozCurrentTransform);
      this.ctx.transform.apply(this.ctx, deltaTransform);
    }

    save() {
      this.ctx.save();
      const old = this.current;
      this.stateStack.push(old);
      this.current = old.clone();
      this.current.resumeSMaskCtx = null;
    }

    restore() {
      // SMask was suspended, we just need to resume it.
      if (this.current.resumeSMaskCtx) {
        this.resumeSMaskGroup();
      } // SMask has to be finished once there is no states that are using the
      // same SMask.


      if (this.current.activeSMask !== null && (this.stateStack.length === 0 || this.stateStack[this.stateStack.length - 1].activeSMask !== this.current.activeSMask)) {
        this.endSMaskGroup();
      }

      if (this.stateStack.length !== 0) {
        this.current = this.stateStack.pop();
        this.ctx.restore(); // Ensure that the clipping path is reset (fixes issue6413.pdf).

        this.pendingClip = null;
        this._cachedGetSinglePixelWidth = null;
      } else {
        // We've finished all the SMask groups, reflect that in our state.
        this.current.activeSMask = null;
      }
    }

    transform(a, b, c, d, e, f) {
      this.ctx.transform(a, b, c, d, e, f);
      this._cachedGetSinglePixelWidth = null;
    } // Path


    constructPath(ops, args) {
      const ctx = this.ctx;
      const current = this.current;
      let x = current.x,
          y = current.y;

      for (let i = 0, j = 0, ii = ops.length; i < ii; i++) {
        switch (ops[i] | 0) {
          case OPS.rectangle:
            x = args[j++];
            y = args[j++];
            const width = args[j++];
            const height = args[j++];
            const xw = x + width;
            const yh = y + height;
            ctx.moveTo(x, y);

            if (width === 0 || height === 0) {
              ctx.lineTo(xw, yh);
            } else {
              ctx.lineTo(xw, y);
              ctx.lineTo(xw, yh);
              ctx.lineTo(x, yh);
            }

            ctx.closePath();
            break;

          case OPS.moveTo:
            x = args[j++];
            y = args[j++];
            ctx.moveTo(x, y);
            break;

          case OPS.lineTo:
            x = args[j++];
            y = args[j++];
            ctx.lineTo(x, y);
            break;

          case OPS.curveTo:
            x = args[j + 4];
            y = args[j + 5];
            ctx.bezierCurveTo(args[j], args[j + 1], args[j + 2], args[j + 3], x, y);
            j += 6;
            break;

          case OPS.curveTo2:
            ctx.bezierCurveTo(x, y, args[j], args[j + 1], args[j + 2], args[j + 3]);
            x = args[j + 2];
            y = args[j + 3];
            j += 4;
            break;

          case OPS.curveTo3:
            x = args[j + 2];
            y = args[j + 3];
            ctx.bezierCurveTo(args[j], args[j + 1], x, y, x, y);
            j += 4;
            break;

          case OPS.closePath:
            ctx.closePath();
            break;
        }
      }

      current.setCurrentPoint(x, y);
    }

    closePath() {
      this.ctx.closePath();
    }

    stroke(consumePath) {
      consumePath = typeof consumePath !== "undefined" ? consumePath : true;
      const ctx = this.ctx;
      const strokeColor = this.current.strokeColor; // For stroke we want to temporarily change the global alpha to the
      // stroking alpha.

      ctx.globalAlpha = this.current.strokeAlpha;

      if (this.contentVisible) {
        if (typeof strokeColor === "object" && strokeColor !== null && strokeColor !== void 0 && strokeColor.getPattern) {
          const lineWidth = this.getSinglePixelWidth();
          ctx.save();
          ctx.strokeStyle = strokeColor.getPattern(ctx, this, ctx.mozCurrentTransformInverse); // Prevent drawing too thin lines by enforcing a minimum line width.

          ctx.lineWidth = Math.max(lineWidth, this.current.lineWidth);
          ctx.stroke();
          ctx.restore();
        } else {
          const lineWidth = this.getSinglePixelWidth();

          if (lineWidth < 0 && -lineWidth >= this.current.lineWidth) {
            // The current transform will transform a square pixel into a
            // parallelogram where both heights are lower than 1 and not equal.
            ctx.save();
            ctx.resetTransform();
            ctx.lineWidth = Math.round(this._combinedScaleFactor);
            ctx.stroke();
            ctx.restore();
          } else {
            // Prevent drawing too thin lines by enforcing a minimum line width.
            ctx.lineWidth = Math.max(lineWidth, this.current.lineWidth);
            ctx.stroke();
          }
        }
      }

      if (consumePath) {
        this.consumePath();
      } // Restore the global alpha to the fill alpha


      ctx.globalAlpha = this.current.fillAlpha;
    }

    closeStroke() {
      this.closePath();
      this.stroke();
    }

    fill(consumePath) {
      consumePath = typeof consumePath !== "undefined" ? consumePath : true;
      const ctx = this.ctx;
      const fillColor = this.current.fillColor;
      const isPatternFill = this.current.patternFill;
      let needRestore = false;

      if (isPatternFill) {
        ctx.save();
        ctx.fillStyle = fillColor.getPattern(ctx, this, ctx.mozCurrentTransformInverse);
        needRestore = true;
      }

      if (this.contentVisible) {
        if (this.pendingEOFill) {
          ctx.fill("evenodd");
          this.pendingEOFill = false;
        } else {
          ctx.fill();
        }
      }

      if (needRestore) {
        ctx.restore();
      }

      if (consumePath) {
        this.consumePath();
      }
    }

    eoFill() {
      this.pendingEOFill = true;
      this.fill();
    }

    fillStroke() {
      this.fill(false);
      this.stroke(false);
      this.consumePath();
    }

    eoFillStroke() {
      this.pendingEOFill = true;
      this.fillStroke();
    }

    closeFillStroke() {
      this.closePath();
      this.fillStroke();
    }

    closeEOFillStroke() {
      this.pendingEOFill = true;
      this.closePath();
      this.fillStroke();
    }

    endPath() {
      this.consumePath();
    } // Clipping


    clip() {
      this.pendingClip = NORMAL_CLIP;
    }

    eoClip() {
      this.pendingClip = EO_CLIP;
    } // Text


    beginText() {
      this.current.textMatrix = IDENTITY_MATRIX;
      this.current.textMatrixScale = 1;
      this.current.x = this.current.lineX = 0;
      this.current.y = this.current.lineY = 0;
    }

    endText() {
      const paths = this.pendingTextPaths;
      const ctx = this.ctx;

      if (paths === undefined) {
        ctx.beginPath();
        return;
      }

      ctx.save();
      ctx.beginPath();

      for (let i = 0; i < paths.length; i++) {
        const path = paths[i];
        ctx.setTransform.apply(ctx, path.transform);
        ctx.translate(path.x, path.y);
        path.addToPath(ctx, path.fontSize);
      }

      ctx.restore();
      ctx.clip();
      ctx.beginPath();
      delete this.pendingTextPaths;
    }

    setCharSpacing(spacing) {
      this.current.charSpacing = spacing;
    }

    setWordSpacing(spacing) {
      this.current.wordSpacing = spacing;
    }

    setHScale(scale) {
      this.current.textHScale = scale / 100;
    }

    setLeading(leading) {
      this.current.leading = -leading;
    }

    setFont(fontRefName, size) {
      const fontObj = this.commonObjs.get(fontRefName);
      const current = this.current;

      if (!fontObj) {
        throw new Error(`Can't find font for ${fontRefName}`);
      }

      current.fontMatrix = fontObj.fontMatrix || FONT_IDENTITY_MATRIX; // A valid matrix needs all main diagonal elements to be non-zero
      // This also ensures we bypass FF bugzilla bug #719844.

      if (current.fontMatrix[0] === 0 || current.fontMatrix[3] === 0) {
        warn("Invalid font matrix for font " + fontRefName);
      } // The spec for Tf (setFont) says that 'size' specifies the font 'scale',
      // and in some docs this can be negative (inverted x-y axes).


      if (size < 0) {
        size = -size;
        current.fontDirection = -1;
      } else {
        current.fontDirection = 1;
      }

      this.current.font = fontObj;
      this.current.fontSize = size;

      if (fontObj.isType3Font) {
        return; // we don't need ctx.font for Type3 fonts
      }

      const name = fontObj.loadedName || "sans-serif";
      let bold = "normal";

      if (fontObj.black) {
        bold = "900";
      } else if (fontObj.bold) {
        bold = "bold";
      }

      const italic = fontObj.italic ? "italic" : "normal";
      const typeface = `"${name}", ${fontObj.fallbackName}`; // Some font backends cannot handle fonts below certain size.
      // Keeping the font at minimal size and using the fontSizeScale to change
      // the current transformation matrix before the fillText/strokeText.
      // See https://bugzilla.mozilla.org/show_bug.cgi?id=726227

      let browserFontSize = size;

      if (size < MIN_FONT_SIZE) {
        browserFontSize = MIN_FONT_SIZE;
      } else if (size > MAX_FONT_SIZE) {
        browserFontSize = MAX_FONT_SIZE;
      }

      this.current.fontSizeScale = size / browserFontSize;
      this.ctx.font = `${italic} ${bold} ${browserFontSize}px ${typeface}`;
    }

    setTextRenderingMode(mode) {
      this.current.textRenderingMode = mode;
    }

    setTextRise(rise) {
      this.current.textRise = rise;
    }

    moveText(x, y) {
      this.current.x = this.current.lineX += x;
      this.current.y = this.current.lineY += y;
    }

    setLeadingMoveText(x, y) {
      this.setLeading(-y);
      this.moveText(x, y);
    }

    setTextMatrix(a, b, c, d, e, f) {
      this.current.textMatrix = [a, b, c, d, e, f];
      this.current.textMatrixScale = Math.hypot(a, b);
      this.current.x = this.current.lineX = 0;
      this.current.y = this.current.lineY = 0;
    }

    nextLine() {
      this.moveText(0, this.current.leading);
    }

    paintChar(character, x, y, patternTransform, resetLineWidthToOne) {
      const ctx = this.ctx;
      const current = this.current;
      const font = current.font;
      const textRenderingMode = current.textRenderingMode;
      const fontSize = current.fontSize / current.fontSizeScale;
      const fillStrokeMode = textRenderingMode & TextRenderingMode.FILL_STROKE_MASK;
      const isAddToPathSet = !!(textRenderingMode & TextRenderingMode.ADD_TO_PATH_FLAG);
      const patternFill = current.patternFill && !font.missingFile;
      let addToPath;

      if (font.disableFontFace || isAddToPathSet || patternFill) {
        addToPath = font.getPathGenerator(this.commonObjs, character);
      }

      if (font.disableFontFace || patternFill) {
        ctx.save();
        ctx.translate(x, y);
        ctx.beginPath();
        addToPath(ctx, fontSize);

        if (patternTransform) {
          ctx.setTransform.apply(ctx, patternTransform);
        }

        if (fillStrokeMode === TextRenderingMode.FILL || fillStrokeMode === TextRenderingMode.FILL_STROKE) {
          ctx.fill();
        }

        if (fillStrokeMode === TextRenderingMode.STROKE || fillStrokeMode === TextRenderingMode.FILL_STROKE) {
          if (resetLineWidthToOne) {
            ctx.resetTransform();
            ctx.lineWidth = Math.round(this._combinedScaleFactor);
          }

          ctx.stroke();
        }

        ctx.restore();
      } else {
        if (fillStrokeMode === TextRenderingMode.FILL || fillStrokeMode === TextRenderingMode.FILL_STROKE) {
          ctx.fillText(character, x, y);
        }

        if (fillStrokeMode === TextRenderingMode.STROKE || fillStrokeMode === TextRenderingMode.FILL_STROKE) {
          if (resetLineWidthToOne) {
            ctx.save();
            ctx.moveTo(x, y);
            ctx.resetTransform();
            ctx.lineWidth = Math.round(this._combinedScaleFactor);
            ctx.strokeText(character, 0, 0);
            ctx.restore();
          } else {
            ctx.strokeText(character, x, y);
          }
        }
      }

      if (isAddToPathSet) {
        const paths = this.pendingTextPaths || (this.pendingTextPaths = []);
        paths.push({
          transform: ctx.mozCurrentTransform,
          x,
          y,
          fontSize,
          addToPath
        });
      }
    }

    get isFontSubpixelAAEnabled() {
      // Checks if anti-aliasing is enabled when scaled text is painted.
      // On Windows GDI scaled fonts looks bad.
      const {
        context: ctx
      } = this.cachedCanvases.getCanvas("isFontSubpixelAAEnabled", 10, 10);
      ctx.scale(1.5, 1);
      ctx.fillText("I", 0, 10);
      const data = ctx.getImageData(0, 0, 10, 10).data;
      let enabled = false;

      for (let i = 3; i < data.length; i += 4) {
        if (data[i] > 0 && data[i] < 255) {
          enabled = true;
          break;
        }
      }

      return shadow(this, "isFontSubpixelAAEnabled", enabled);
    }

    showText(glyphs) {
      const current = this.current;
      const font = current.font;

      if (font.isType3Font) {
        return this.showType3Text(glyphs);
      }

      const fontSize = current.fontSize;

      if (fontSize === 0) {
        return undefined;
      }

      const ctx = this.ctx;
      const fontSizeScale = current.fontSizeScale;
      const charSpacing = current.charSpacing;
      const wordSpacing = current.wordSpacing;
      const fontDirection = current.fontDirection;
      const textHScale = current.textHScale * fontDirection;
      const glyphsLength = glyphs.length;
      const vertical = font.vertical;
      const spacingDir = vertical ? 1 : -1;
      const defaultVMetrics = font.defaultVMetrics;
      const widthAdvanceScale = fontSize * current.fontMatrix[0];
      const simpleFillText = current.textRenderingMode === TextRenderingMode.FILL && !font.disableFontFace && !current.patternFill;
      ctx.save();
      let patternTransform;

      if (current.patternFill) {
        // TODO: Patterns are not applied correctly to text if a non-embedded
        // font is used. E.g. issue 8111 and ShowText-ShadingPattern.pdf.
        ctx.save();
        const pattern = current.fillColor.getPattern(ctx, this, ctx.mozCurrentTransformInverse);
        patternTransform = ctx.mozCurrentTransform;
        ctx.restore();
        ctx.fillStyle = pattern;
      }

      ctx.transform.apply(ctx, current.textMatrix);
      ctx.translate(current.x, current.y + current.textRise);

      if (fontDirection > 0) {
        ctx.scale(textHScale, -1);
      } else {
        ctx.scale(textHScale, 1);
      }

      let lineWidth = current.lineWidth;
      let resetLineWidthToOne = false;
      const scale = current.textMatrixScale;

      if (scale === 0 || lineWidth === 0) {
        const fillStrokeMode = current.textRenderingMode & TextRenderingMode.FILL_STROKE_MASK;

        if (fillStrokeMode === TextRenderingMode.STROKE || fillStrokeMode === TextRenderingMode.FILL_STROKE) {
          this._cachedGetSinglePixelWidth = null;
          lineWidth = this.getSinglePixelWidth();
          resetLineWidthToOne = lineWidth < 0;
        }
      } else {
        lineWidth /= scale;
      }

      if (fontSizeScale !== 1.0) {
        ctx.scale(fontSizeScale, fontSizeScale);
        lineWidth /= fontSizeScale;
      }

      ctx.lineWidth = lineWidth;
      let x = 0,
          i;

      for (i = 0; i < glyphsLength; ++i) {
        const glyph = glyphs[i];

        if (isNum(glyph)) {
          x += spacingDir * glyph * fontSize / 1000;
          continue;
        }

        let restoreNeeded = false;
        const spacing = (glyph.isSpace ? wordSpacing : 0) + charSpacing;
        const character = glyph.fontChar;
        const accent = glyph.accent;
        let scaledX, scaledY;
        let width = glyph.width;

        if (vertical) {
          const vmetric = glyph.vmetric || defaultVMetrics;
          const vx = -(glyph.vmetric ? vmetric[1] : width * 0.5) * widthAdvanceScale;
          const vy = vmetric[2] * widthAdvanceScale;
          width = vmetric ? -vmetric[0] : width;
          scaledX = vx / fontSizeScale;
          scaledY = (x + vy) / fontSizeScale;
        } else {
          scaledX = x / fontSizeScale;
          scaledY = 0;
        }

        if (font.remeasure && width > 0) {
          // Some standard fonts may not have the exact width: rescale per
          // character if measured width is greater than expected glyph width
          // and subpixel-aa is enabled, otherwise just center the glyph.
          const measuredWidth = ctx.measureText(character).width * 1000 / fontSize * fontSizeScale;

          if (width < measuredWidth && this.isFontSubpixelAAEnabled) {
            const characterScaleX = width / measuredWidth;
            restoreNeeded = true;
            ctx.save();
            ctx.scale(characterScaleX, 1);
            scaledX /= characterScaleX;
          } else if (width !== measuredWidth) {
            scaledX += (width - measuredWidth) / 2000 * fontSize / fontSizeScale;
          }
        } // Only attempt to draw the glyph if it is actually in the embedded font
        // file or if there isn't a font file so the fallback font is shown.


        if (this.contentVisible && (glyph.isInFont || font.missingFile)) {
          if (simpleFillText && !accent) {
            // common case
            ctx.fillText(character, scaledX, scaledY);
          } else {
            this.paintChar(character, scaledX, scaledY, patternTransform, resetLineWidthToOne);

            if (accent) {
              const scaledAccentX = scaledX + fontSize * accent.offset.x / fontSizeScale;
              const scaledAccentY = scaledY - fontSize * accent.offset.y / fontSizeScale;
              this.paintChar(accent.fontChar, scaledAccentX, scaledAccentY, patternTransform, resetLineWidthToOne);
            }
          }
        }

        let charWidth;

        if (vertical) {
          charWidth = width * widthAdvanceScale - spacing * fontDirection;
        } else {
          charWidth = width * widthAdvanceScale + spacing * fontDirection;
        }

        x += charWidth;

        if (restoreNeeded) {
          ctx.restore();
        }
      }

      if (vertical) {
        current.y -= x;
      } else {
        current.x += x * textHScale;
      }

      ctx.restore();
      return undefined;
    }

    showType3Text(glyphs) {
      // Type3 fonts - each glyph is a "mini-PDF"
      const ctx = this.ctx;
      const current = this.current;
      const font = current.font;
      const fontSize = current.fontSize;
      const fontDirection = current.fontDirection;
      const spacingDir = font.vertical ? 1 : -1;
      const charSpacing = current.charSpacing;
      const wordSpacing = current.wordSpacing;
      const textHScale = current.textHScale * fontDirection;
      const fontMatrix = current.fontMatrix || FONT_IDENTITY_MATRIX;
      const glyphsLength = glyphs.length;
      const isTextInvisible = current.textRenderingMode === TextRenderingMode.INVISIBLE;
      let i, glyph, width, spacingLength;

      if (isTextInvisible || fontSize === 0) {
        return;
      }

      this._cachedGetSinglePixelWidth = null;
      ctx.save();
      ctx.transform.apply(ctx, current.textMatrix);
      ctx.translate(current.x, current.y);
      ctx.scale(textHScale, fontDirection);

      for (i = 0; i < glyphsLength; ++i) {
        glyph = glyphs[i];

        if (isNum(glyph)) {
          spacingLength = spacingDir * glyph * fontSize / 1000;
          this.ctx.translate(spacingLength, 0);
          current.x += spacingLength * textHScale;
          continue;
        }

        const spacing = (glyph.isSpace ? wordSpacing : 0) + charSpacing;
        const operatorList = font.charProcOperatorList[glyph.operatorListId];

        if (!operatorList) {
          warn(`Type3 character "${glyph.operatorListId}" is not available.`);
          continue;
        }

        if (this.contentVisible) {
          this.processingType3 = glyph;
          this.save();
          ctx.scale(fontSize, fontSize);
          ctx.transform.apply(ctx, fontMatrix);
          this.executeOperatorList(operatorList);
          this.restore();
        }

        const transformed = Util.applyTransform([glyph.width, 0], fontMatrix);
        width = transformed[0] * fontSize + spacing;
        ctx.translate(width, 0);
        current.x += width * textHScale;
      }

      ctx.restore();
      this.processingType3 = null;
    } // Type3 fonts


    setCharWidth(xWidth, yWidth) {// We can safely ignore this since the width should be the same
      // as the width in the Widths array.
    }

    setCharWidthAndBounds(xWidth, yWidth, llx, lly, urx, ury) {
      // TODO According to the spec we're also suppose to ignore any operators
      // that set color or include images while processing this type3 font.
      this.ctx.rect(llx, lly, urx - llx, ury - lly);
      this.clip();
      this.endPath();
    } // Color


    getColorN_Pattern(IR) {
      let pattern;

      if (IR[0] === "TilingPattern") {
        const color = IR[1];
        const baseTransform = this.baseTransform || this.ctx.mozCurrentTransform.slice();
        const canvasGraphicsFactory = {
          createCanvasGraphics: ctx => {
            return new CanvasGraphics(ctx, this.commonObjs, this.objs, this.canvasFactory);
          }
        };
        pattern = new TilingPattern(IR, color, this.ctx, canvasGraphicsFactory, baseTransform);
      } else {
        pattern = this._getPattern(IR[1]);
      }

      return pattern;
    }

    setStrokeColorN() {
      this.current.strokeColor = this.getColorN_Pattern(arguments);
    }

    setFillColorN() {
      this.current.fillColor = this.getColorN_Pattern(arguments);
      this.current.patternFill = true;
    }

    setStrokeRGBColor(r, g, b) {
      const color = Util.makeHexColor(r, g, b);
      this.ctx.strokeStyle = color;
      this.current.strokeColor = color;
    }

    setFillRGBColor(r, g, b) {
      const color = Util.makeHexColor(r, g, b);
      this.ctx.fillStyle = color;
      this.current.fillColor = color;
      this.current.patternFill = false;
    }

    _getPattern(objId) {
      if (this.cachedPatterns.has(objId)) {
        return this.cachedPatterns.get(objId);
      }

      const pattern = getShadingPattern(this.objs.get(objId));
      this.cachedPatterns.set(objId, pattern);
      return pattern;
    }

    shadingFill(objId) {
      if (!this.contentVisible) {
        return;
      }

      const ctx = this.ctx;
      this.save();

      const pattern = this._getPattern(objId);

      ctx.fillStyle = pattern.getPattern(ctx, this, ctx.mozCurrentTransformInverse, true);
      const inv = ctx.mozCurrentTransformInverse;

      if (inv) {
        const canvas = ctx.canvas;
        const width = canvas.width;
        const height = canvas.height;
        const bl = Util.applyTransform([0, 0], inv);
        const br = Util.applyTransform([0, height], inv);
        const ul = Util.applyTransform([width, 0], inv);
        const ur = Util.applyTransform([width, height], inv);
        const x0 = Math.min(bl[0], br[0], ul[0], ur[0]);
        const y0 = Math.min(bl[1], br[1], ul[1], ur[1]);
        const x1 = Math.max(bl[0], br[0], ul[0], ur[0]);
        const y1 = Math.max(bl[1], br[1], ul[1], ur[1]);
        this.ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      } else {
        // HACK to draw the gradient onto an infinite rectangle.
        // PDF gradients are drawn across the entire image while
        // Canvas only allows gradients to be drawn in a rectangle
        // The following bug should allow us to remove this.
        // https://bugzilla.mozilla.org/show_bug.cgi?id=664884
        this.ctx.fillRect(-1e10, -1e10, 2e10, 2e10);
      }

      this.restore();
    } // Images


    beginInlineImage() {
      unreachable("Should not call beginInlineImage");
    }

    beginImageData() {
      unreachable("Should not call beginImageData");
    }

    paintFormXObjectBegin(matrix, bbox) {
      if (!this.contentVisible) {
        return;
      }

      this.save();
      this.baseTransformStack.push(this.baseTransform);

      if (Array.isArray(matrix) && matrix.length === 6) {
        this.transform.apply(this, matrix);
      }

      this.baseTransform = this.ctx.mozCurrentTransform;

      if (bbox) {
        const width = bbox[2] - bbox[0];
        const height = bbox[3] - bbox[1];
        this.ctx.rect(bbox[0], bbox[1], width, height);
        this.clip();
        this.endPath();
      }
    }

    paintFormXObjectEnd() {
      if (!this.contentVisible) {
        return;
      }

      this.restore();
      this.baseTransform = this.baseTransformStack.pop();
    }

    beginGroup(group) {
      if (!this.contentVisible) {
        return;
      }

      this.save();
      const currentCtx = this.ctx; // TODO non-isolated groups - according to Rik at adobe non-isolated
      // group results aren't usually that different and they even have tools
      // that ignore this setting. Notes from Rik on implementing:
      // - When you encounter an transparency group, create a new canvas with
      // the dimensions of the bbox
      // - copy the content from the previous canvas to the new canvas
      // - draw as usual
      // - remove the backdrop alpha:
      // alphaNew = 1 - (1 - alpha)/(1 - alphaBackdrop) with 'alpha' the alpha
      // value of your transparency group and 'alphaBackdrop' the alpha of the
      // backdrop
      // - remove background color:
      // colorNew = color - alphaNew *colorBackdrop /(1 - alphaNew)

      if (!group.isolated) {
        info("TODO: Support non-isolated groups.");
      } // TODO knockout - supposedly possible with the clever use of compositing
      // modes.


      if (group.knockout) {
        warn("Knockout groups not supported.");
      }

      const currentTransform = currentCtx.mozCurrentTransform;

      if (group.matrix) {
        currentCtx.transform.apply(currentCtx, group.matrix);
      }

      if (!group.bbox) {
        throw new Error("Bounding box is required.");
      } // Based on the current transform figure out how big the bounding box
      // will actually be.


      let bounds = Util.getAxialAlignedBoundingBox(group.bbox, currentCtx.mozCurrentTransform); // Clip the bounding box to the current canvas.

      const canvasBounds = [0, 0, currentCtx.canvas.width, currentCtx.canvas.height];
      bounds = Util.intersect(bounds, canvasBounds) || [0, 0, 0, 0]; // Use ceil in case we're between sizes so we don't create canvas that is
      // too small and make the canvas at least 1x1 pixels.

      const offsetX = Math.floor(bounds[0]);
      const offsetY = Math.floor(bounds[1]);
      let drawnWidth = Math.max(Math.ceil(bounds[2]) - offsetX, 1);
      let drawnHeight = Math.max(Math.ceil(bounds[3]) - offsetY, 1);
      let scaleX = 1,
          scaleY = 1;

      if (drawnWidth > MAX_GROUP_SIZE) {
        scaleX = drawnWidth / MAX_GROUP_SIZE;
        drawnWidth = MAX_GROUP_SIZE;
      }

      if (drawnHeight > MAX_GROUP_SIZE) {
        scaleY = drawnHeight / MAX_GROUP_SIZE;
        drawnHeight = MAX_GROUP_SIZE;
      }

      let cacheId = "groupAt" + this.groupLevel;

      if (group.smask) {
        // Using two cache entries is case if masks are used one after another.
        cacheId += "_smask_" + this.smaskCounter++ % 2;
      }

      const scratchCanvas = this.cachedCanvases.getCanvas(cacheId, drawnWidth, drawnHeight, true);
      const groupCtx = scratchCanvas.context; // Since we created a new canvas that is just the size of the bounding box
      // we have to translate the group ctx.

      groupCtx.scale(1 / scaleX, 1 / scaleY);
      groupCtx.translate(-offsetX, -offsetY);
      groupCtx.transform.apply(groupCtx, currentTransform);

      if (group.smask) {
        // Saving state and cached mask to be used in setGState.
        this.smaskStack.push({
          canvas: scratchCanvas.canvas,
          context: groupCtx,
          offsetX,
          offsetY,
          scaleX,
          scaleY,
          subtype: group.smask.subtype,
          backdrop: group.smask.backdrop,
          transferMap: group.smask.transferMap || null,
          startTransformInverse: null // used during suspend operation

        });
      } else {
        // Setup the current ctx so when the group is popped we draw it at the
        // right location.
        currentCtx.setTransform(1, 0, 0, 1, 0, 0);
        currentCtx.translate(offsetX, offsetY);
        currentCtx.scale(scaleX, scaleY);
      } // The transparency group inherits all off the current graphics state
      // except the blend mode, soft mask, and alpha constants.


      copyCtxState(currentCtx, groupCtx);
      this.ctx = groupCtx;
      this.setGState([["BM", "source-over"], ["ca", 1], ["CA", 1]]);
      this.groupStack.push(currentCtx);
      this.groupLevel++; // Resetting mask state, masks will be applied on restore of the group.

      this.current.activeSMask = null;
    }

    endGroup(group) {
      if (!this.contentVisible) {
        return;
      }

      this.groupLevel--;
      const groupCtx = this.ctx;
      this.ctx = this.groupStack.pop(); // Turn off image smoothing to avoid sub pixel interpolation which can
      // look kind of blurry for some pdfs.

      if (this.ctx.imageSmoothingEnabled !== undefined) {
        this.ctx.imageSmoothingEnabled = false;
      } else {
        this.ctx.mozImageSmoothingEnabled = false;
      }

      if (group.smask) {
        this.tempSMask = this.smaskStack.pop();
      } else {
        this.ctx.drawImage(groupCtx.canvas, 0, 0);
      }

      this.restore();
    }

    beginAnnotations() {
      this.save();

      if (this.baseTransform) {
        this.ctx.setTransform.apply(this.ctx, this.baseTransform);
      }
    }

    endAnnotations() {
      this.restore();
    }

    beginAnnotation(id, rect, transform, matrix) {
      this.save();
      resetCtxToDefault(this.ctx);
      this.current = new CanvasExtraState();

      if (Array.isArray(rect) && rect.length === 4) {
        const width = rect[2] - rect[0];
        const height = rect[3] - rect[1];
        this.ctx.rect(rect[0], rect[1], width, height);
        this.clip();
        this.endPath();
      }

      this.transform.apply(this, transform);
      this.transform.apply(this, matrix);
    }

    endAnnotation() {
      this.restore();
    }

    paintImageMaskXObject(img) {
      if (!this.contentVisible) {
        return;
      }

      const ctx = this.ctx;
      const width = img.width,
            height = img.height;
      const glyph = this.processingType3;

      if (glyph && glyph.compiled === undefined) {
        if (width <= MAX_SIZE_TO_COMPILE && height <= MAX_SIZE_TO_COMPILE) {
          glyph.compiled = compileType3Glyph({
            data: img.data,
            width,
            height
          });
        } else {
          glyph.compiled = null;
        }
      }

      if (glyph !== null && glyph !== void 0 && glyph.compiled) {
        glyph.compiled(ctx);
        return;
      }

      const mask = this._createMaskCanvas(img);

      const maskCanvas = mask.canvas;
      ctx.save(); // The mask is drawn with the transform applied. Reset the current
      // transform to draw to the identity.

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(maskCanvas, mask.offsetX, mask.offsetY);
      ctx.restore();
    }

    paintImageMaskXObjectRepeat(imgData, scaleX, skewX = 0, skewY = 0, scaleY, positions) {
      if (!this.contentVisible) {
        return;
      }

      const ctx = this.ctx;
      ctx.save();
      const currentTransform = ctx.mozCurrentTransform;
      ctx.transform(scaleX, skewX, skewY, scaleY, 0, 0);

      const mask = this._createMaskCanvas(imgData);

      ctx.setTransform(1, 0, 0, 1, 0, 0);

      for (let i = 0, ii = positions.length; i < ii; i += 2) {
        const trans = Util.transform(currentTransform, [scaleX, skewX, skewY, scaleY, positions[i], positions[i + 1]]);
        const [x, y] = Util.applyTransform([0, 0], trans);
        ctx.drawImage(mask.canvas, x, y);
      }

      ctx.restore();
    }

    paintImageMaskXObjectGroup(images) {
      if (!this.contentVisible) {
        return;
      }

      const ctx = this.ctx;
      const fillColor = this.current.fillColor;
      const isPatternFill = this.current.patternFill;

      for (let i = 0, ii = images.length; i < ii; i++) {
        const image = images[i];
        const width = image.width,
              height = image.height;
        const maskCanvas = this.cachedCanvases.getCanvas("maskCanvas", width, height);
        const maskCtx = maskCanvas.context;
        maskCtx.save();
        putBinaryImageMask(maskCtx, image);
        maskCtx.globalCompositeOperation = "source-in";
        maskCtx.fillStyle = isPatternFill ? fillColor.getPattern(maskCtx, this, ctx.mozCurrentTransformInverse, false) : fillColor;
        maskCtx.fillRect(0, 0, width, height);
        maskCtx.restore();
        ctx.save();
        ctx.transform.apply(ctx, image.transform);
        ctx.scale(1, -1);
        ctx.drawImage(maskCanvas.canvas, 0, 0, width, height, 0, -1, 1, 1);
        ctx.restore();
      }
    }

    paintImageXObject(objId) {
      if (!this.contentVisible) {
        return;
      }

      const imgData = objId.startsWith("g_") ? this.commonObjs.get(objId) : this.objs.get(objId);

      if (!imgData) {
        warn("Dependent image isn't ready yet");
        return;
      }

      this.paintInlineImageXObject(imgData);
    }

    paintImageXObjectRepeat(objId, scaleX, scaleY, positions) {
      if (!this.contentVisible) {
        return;
      }

      const imgData = objId.startsWith("g_") ? this.commonObjs.get(objId) : this.objs.get(objId);

      if (!imgData) {
        warn("Dependent image isn't ready yet");
        return;
      }

      const width = imgData.width;
      const height = imgData.height;
      const map = [];

      for (let i = 0, ii = positions.length; i < ii; i += 2) {
        map.push({
          transform: [scaleX, 0, 0, scaleY, positions[i], positions[i + 1]],
          x: 0,
          y: 0,
          w: width,
          h: height
        });
      }

      this.paintInlineImageXObjectGroup(imgData, map);
    }

    paintInlineImageXObject(imgData) {
      if (!this.contentVisible) {
        return;
      }

      const width = imgData.width;
      const height = imgData.height;
      const ctx = this.ctx;
      this.save(); // scale the image to the unit square

      ctx.scale(1 / width, -1 / height);
      let imgToPaint; // typeof check is needed due to node.js support, see issue #8489

      if (typeof HTMLElement === "function" && imgData instanceof HTMLElement || !imgData.data) {
        imgToPaint = imgData;
      } else {
        const tmpCanvas = this.cachedCanvases.getCanvas("inlineImage", width, height);
        const tmpCtx = tmpCanvas.context;
        putBinaryImageData(tmpCtx, imgData, this.current.transferMaps);
        imgToPaint = tmpCanvas.canvas;
      }

      const scaled = this._scaleImage(imgToPaint, ctx.mozCurrentTransformInverse);

      ctx.drawImage(scaled.img, 0, 0, scaled.paintWidth, scaled.paintHeight, 0, -height, width, height);

      if (this.imageLayer) {
        const position = this.getCanvasPosition(0, -height);
        this.imageLayer.appendImage({
          imgData,
          left: position[0],
          top: position[1],
          width: width / ctx.mozCurrentTransformInverse[0],
          height: height / ctx.mozCurrentTransformInverse[3]
        });
      }

      this.restore();
    }

    paintInlineImageXObjectGroup(imgData, map) {
      if (!this.contentVisible) {
        return;
      }

      const ctx = this.ctx;
      const w = imgData.width;
      const h = imgData.height;
      const tmpCanvas = this.cachedCanvases.getCanvas("inlineImage", w, h);
      const tmpCtx = tmpCanvas.context;
      putBinaryImageData(tmpCtx, imgData, this.current.transferMaps);

      for (let i = 0, ii = map.length; i < ii; i++) {
        const entry = map[i];
        ctx.save();
        ctx.transform.apply(ctx, entry.transform);
        ctx.scale(1, -1);
        ctx.drawImage(tmpCanvas.canvas, entry.x, entry.y, entry.w, entry.h, 0, -1, 1, 1);

        if (this.imageLayer) {
          const position = this.getCanvasPosition(entry.x, entry.y);
          this.imageLayer.appendImage({
            imgData,
            left: position[0],
            top: position[1],
            width: w,
            height: h
          });
        }

        ctx.restore();
      }
    }

    paintSolidColorImageMask() {
      if (!this.contentVisible) {
        return;
      }

      this.ctx.fillRect(0, 0, 1, 1);
    } // Marked content


    markPoint(tag) {// TODO Marked content.
    }

    markPointProps(tag, properties) {// TODO Marked content.
    }

    beginMarkedContent(tag) {
      this.markedContentStack.push({
        visible: true
      });
    }

    beginMarkedContentProps(tag, properties) {
      if (tag === "OC") {
        this.markedContentStack.push({
          visible: this.optionalContentConfig.isVisible(properties)
        });
      } else {
        this.markedContentStack.push({
          visible: true
        });
      }

      this.contentVisible = this.isContentVisible();
    }

    endMarkedContent() {
      this.markedContentStack.pop();
      this.contentVisible = this.isContentVisible();
    } // Compatibility


    beginCompat() {// TODO ignore undefined operators (should we do that anyway?)
    }

    endCompat() {// TODO stop ignoring undefined operators
    } // Helper functions


    consumePath() {
      const ctx = this.ctx;

      if (this.pendingClip) {
        if (this.pendingClip === EO_CLIP) {
          ctx.clip("evenodd");
        } else {
          ctx.clip();
        }

        this.pendingClip = null;
      }

      ctx.beginPath();
    }

    getSinglePixelWidth() {
      if (this._cachedGetSinglePixelWidth === null) {
        // If transform is [a b] then a pixel (square) is transformed
        //                 [c d]
        // into a parallelogram: its area is the abs value of the determinant.
        // This parallelogram has 2 heights:
        //  - Area / |col_1|;
        //  - Area / |col_2|.
        // so in order to get a height of at least 1, pixel height
        // must be computed as followed:
        //  h = max(sqrt(a² + c²) / |det(M)|, sqrt(b² + d²) / |det(M)|).
        // This is equivalent to:
        //  h = max(|line_1_inv(M)|, |line_2_inv(M)|)
        const m = this.ctx.mozCurrentTransform;
        const absDet = Math.abs(m[0] * m[3] - m[2] * m[1]);
        const sqNorm1 = m[0] ** 2 + m[2] ** 2;
        const sqNorm2 = m[1] ** 2 + m[3] ** 2;
        const pixelHeight = Math.sqrt(Math.max(sqNorm1, sqNorm2)) / absDet;

        if (sqNorm1 !== sqNorm2 && this._combinedScaleFactor * pixelHeight > 1) {
          // The parallelogram isn't a square and at least one height
          // is lower than 1 so the resulting line width must be 1
          // but it cannot be achieved with one scale: when scaling a pixel
          // we'll get a rectangle (see issue #12295).
          // For example with matrix [0.001 0, 0, 100], a pixel is transformed
          // in a rectangle 0.001x100. If we just scale by 1000 (to have a 1)
          // then we'll get a rectangle 1x1e5 which is wrong.
          // In this case, we must reset the transform, set linewidth to 1
          // and then stroke.
          this._cachedGetSinglePixelWidth = -(this._combinedScaleFactor * pixelHeight);
        } else if (absDet > Number.EPSILON) {
          this._cachedGetSinglePixelWidth = pixelHeight;
        } else {
          // Matrix is non-invertible.
          this._cachedGetSinglePixelWidth = 1;
        }
      }

      return this._cachedGetSinglePixelWidth;
    }

    getCanvasPosition(x, y) {
      const transform = this.ctx.mozCurrentTransform;
      return [transform[0] * x + transform[2] * y + transform[4], transform[1] * x + transform[3] * y + transform[5]];
    }

    isContentVisible() {
      for (let i = this.markedContentStack.length - 1; i >= 0; i--) {
        if (!this.markedContentStack[i].visible) {
          return false;
        }
      }

      return true;
    }

  }

  for (const op in OPS) {
    CanvasGraphics.prototype[OPS[op]] = CanvasGraphics.prototype[op];
  }

  return CanvasGraphics;
}();

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

/**
 * @typedef {Object} GlobalWorkerOptionsType
 * @property {Worker | null} workerPort - Defines global port for worker
 *   process. Overrides the `workerSrc` option.
 * @property {string} workerSrc - A string containing the path and filename
 *   of the worker file.
 *
 *   NOTE: The `workerSrc` option should always be set, in order to prevent any
 *         issues when using the PDF.js library.
 */

/** @type {GlobalWorkerOptionsType} */
const GlobalWorkerOptions = Object.create(null);
GlobalWorkerOptions.workerPort = GlobalWorkerOptions.workerPort === undefined ? null : GlobalWorkerOptions.workerPort;
GlobalWorkerOptions.workerSrc = GlobalWorkerOptions.workerSrc === undefined ? "" : GlobalWorkerOptions.workerSrc;

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

class Metadata {
  constructor({
    parsedData,
    rawData
  }) {
    this._metadataMap = parsedData;
    this._data = rawData;
  }

  getRaw() {
    return this._data;
  }

  get(name) {
    var _this$_metadataMap$ge;

    return (_this$_metadataMap$ge = this._metadataMap.get(name)) !== null && _this$_metadataMap$ge !== void 0 ? _this$_metadataMap$ge : null;
  }

  getAll() {
    return objectFromMap(this._metadataMap);
  }

  has(name) {
    return this._metadataMap.has(name);
  }

}

/* Copyright 2020 Mozilla Foundation
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

class OptionalContentGroup {
  constructor(name, intent) {
    this.visible = true;
    this.name = name;
    this.intent = intent;
  }

}

class OptionalContentConfig {
  constructor(data) {
    this.name = null;
    this.creator = null;
    this._order = null;
    this._groups = new Map();

    if (data === null) {
      return;
    }

    this.name = data.name;
    this.creator = data.creator;
    this._order = data.order;

    for (const group of data.groups) {
      this._groups.set(group.id, new OptionalContentGroup(group.name, group.intent));
    }

    if (data.baseState === "OFF") {
      for (const group of this._groups) {
        group.visible = false;
      }
    }

    for (const on of data.on) {
      this._groups.get(on).visible = true;
    }

    for (const off of data.off) {
      this._groups.get(off).visible = false;
    }
  }

  _evaluateVisibilityExpression(array) {
    const length = array.length;

    if (length < 2) {
      return true;
    }

    const operator = array[0];

    for (let i = 1; i < length; i++) {
      const element = array[i];
      let state;

      if (Array.isArray(element)) {
        state = this._evaluateVisibilityExpression(element);
      } else if (this._groups.has(element)) {
        state = this._groups.get(element).visible;
      } else {
        warn(`Optional content group not found: ${element}`);
        return true;
      }

      switch (operator) {
        case "And":
          if (!state) {
            return false;
          }

          break;

        case "Or":
          if (state) {
            return true;
          }

          break;

        case "Not":
          return !state;

        default:
          return true;
      }
    }

    return operator === "And";
  }

  isVisible(group) {
    if (group.type === "OCG") {
      if (!this._groups.has(group.id)) {
        warn(`Optional content group not found: ${group.id}`);
        return true;
      }

      return this._groups.get(group.id).visible;
    } else if (group.type === "OCMD") {
      // Per the spec, the expression should be preferred if available.
      if (group.expression) {
        return this._evaluateVisibilityExpression(group.expression);
      }

      if (!group.policy || group.policy === "AnyOn") {
        // Default
        for (const id of group.ids) {
          if (!this._groups.has(id)) {
            warn(`Optional content group not found: ${id}`);
            return true;
          }

          if (this._groups.get(id).visible) {
            return true;
          }
        }

        return false;
      } else if (group.policy === "AllOn") {
        for (const id of group.ids) {
          if (!this._groups.has(id)) {
            warn(`Optional content group not found: ${id}`);
            return true;
          }

          if (!this._groups.get(id).visible) {
            return false;
          }
        }

        return true;
      } else if (group.policy === "AnyOff") {
        for (const id of group.ids) {
          if (!this._groups.has(id)) {
            warn(`Optional content group not found: ${id}`);
            return true;
          }

          if (!this._groups.get(id).visible) {
            return true;
          }
        }

        return false;
      } else if (group.policy === "AllOff") {
        for (const id of group.ids) {
          if (!this._groups.has(id)) {
            warn(`Optional content group not found: ${id}`);
            return true;
          }

          if (this._groups.get(id).visible) {
            return false;
          }
        }

        return true;
      }

      warn(`Unknown optional content policy ${group.policy}.`);
      return true;
    }

    warn(`Unknown group type ${group.type}.`);
    return true;
  }

  setVisibility(id, visible = true) {
    if (!this._groups.has(id)) {
      warn(`Optional content group not found: ${id}`);
      return;
    }

    this._groups.get(id).visible = !!visible;
  }

  getOrder() {
    if (!this._groups.size) {
      return null;
    }

    if (this._order) {
      return this._order.slice();
    }

    return Array.from(this._groups.keys());
  }

  getGroups() {
    return this._groups.size > 0 ? objectFromMap(this._groups) : null;
  }

  getGroup(id) {
    return this._groups.get(id) || null;
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
/** @implements {IPDFStream} */

class PDFDataTransportStream {
  constructor(params, pdfDataRangeTransport) {
    assert(pdfDataRangeTransport, 'PDFDataTransportStream - missing required "pdfDataRangeTransport" argument.');
    this._queuedChunks = [];
    this._progressiveDone = params.progressiveDone || false;
    this._contentDispositionFilename = params.contentDispositionFilename || null;
    const initialData = params.initialData;

    if ((initialData === null || initialData === void 0 ? void 0 : initialData.length) > 0) {
      const buffer = new Uint8Array(initialData).buffer;

      this._queuedChunks.push(buffer);
    }

    this._pdfDataRangeTransport = pdfDataRangeTransport;
    this._isStreamingSupported = !params.disableStream;
    this._isRangeSupported = !params.disableRange;
    this._contentLength = params.length;
    this._fullRequestReader = null;
    this._rangeReaders = [];

    this._pdfDataRangeTransport.addRangeListener((begin, chunk) => {
      this._onReceiveData({
        begin,
        chunk
      });
    });

    this._pdfDataRangeTransport.addProgressListener((loaded, total) => {
      this._onProgress({
        loaded,
        total
      });
    });

    this._pdfDataRangeTransport.addProgressiveReadListener(chunk => {
      this._onReceiveData({
        chunk
      });
    });

    this._pdfDataRangeTransport.addProgressiveDoneListener(() => {
      this._onProgressiveDone();
    });

    this._pdfDataRangeTransport.transportReady();
  }

  _onReceiveData(args) {
    const buffer = new Uint8Array(args.chunk).buffer;

    if (args.begin === undefined) {
      if (this._fullRequestReader) {
        this._fullRequestReader._enqueue(buffer);
      } else {
        this._queuedChunks.push(buffer);
      }
    } else {
      const found = this._rangeReaders.some(function (rangeReader) {
        if (rangeReader._begin !== args.begin) {
          return false;
        }

        rangeReader._enqueue(buffer);

        return true;
      });

      assert(found, "_onReceiveData - no `PDFDataTransportStreamRangeReader` instance found.");
    }
  }

  get _progressiveDataLength() {
    var _this$_fullRequestRea, _this$_fullRequestRea2;

    return (_this$_fullRequestRea = (_this$_fullRequestRea2 = this._fullRequestReader) === null || _this$_fullRequestRea2 === void 0 ? void 0 : _this$_fullRequestRea2._loaded) !== null && _this$_fullRequestRea !== void 0 ? _this$_fullRequestRea : 0;
  }

  _onProgress(evt) {
    if (evt.total === undefined) {
      // Reporting to first range reader, if it exists.
      const firstReader = this._rangeReaders[0];

      if (firstReader !== null && firstReader !== void 0 && firstReader.onProgress) {
        firstReader.onProgress({
          loaded: evt.loaded
        });
      }
    } else {
      const fullReader = this._fullRequestReader;

      if (fullReader !== null && fullReader !== void 0 && fullReader.onProgress) {
        fullReader.onProgress({
          loaded: evt.loaded,
          total: evt.total
        });
      }
    }
  }

  _onProgressiveDone() {
    if (this._fullRequestReader) {
      this._fullRequestReader.progressiveDone();
    }

    this._progressiveDone = true;
  }

  _removeRangeReader(reader) {
    const i = this._rangeReaders.indexOf(reader);

    if (i >= 0) {
      this._rangeReaders.splice(i, 1);
    }
  }

  getFullReader() {
    assert(!this._fullRequestReader, "PDFDataTransportStream.getFullReader can only be called once.");
    const queuedChunks = this._queuedChunks;
    this._queuedChunks = null;
    return new PDFDataTransportStreamReader(this, queuedChunks, this._progressiveDone, this._contentDispositionFilename);
  }

  getRangeReader(begin, end) {
    if (end <= this._progressiveDataLength) {
      return null;
    }

    const reader = new PDFDataTransportStreamRangeReader(this, begin, end);

    this._pdfDataRangeTransport.requestDataRange(begin, end);

    this._rangeReaders.push(reader);

    return reader;
  }

  cancelAllRequests(reason) {
    if (this._fullRequestReader) {
      this._fullRequestReader.cancel(reason);
    }

    for (const reader of this._rangeReaders.slice(0)) {
      reader.cancel(reason);
    }

    this._pdfDataRangeTransport.abort();
  }

}
/** @implements {IPDFStreamReader} */


class PDFDataTransportStreamReader {
  constructor(stream, queuedChunks, progressiveDone = false, contentDispositionFilename = null) {
    this._stream = stream;
    this._done = progressiveDone || false;
    this._filename = isPdfFile(contentDispositionFilename) ? contentDispositionFilename : null;
    this._queuedChunks = queuedChunks || [];
    this._loaded = 0;

    for (const chunk of this._queuedChunks) {
      this._loaded += chunk.byteLength;
    }

    this._requests = [];
    this._headersReady = Promise.resolve();
    stream._fullRequestReader = this;
    this.onProgress = null;
  }

  _enqueue(chunk) {
    if (this._done) {
      return; // Ignore new data.
    }

    if (this._requests.length > 0) {
      const requestCapability = this._requests.shift();

      requestCapability.resolve({
        value: chunk,
        done: false
      });
    } else {
      this._queuedChunks.push(chunk);
    }

    this._loaded += chunk.byteLength;
  }

  get headersReady() {
    return this._headersReady;
  }

  get filename() {
    return this._filename;
  }

  get isRangeSupported() {
    return this._stream._isRangeSupported;
  }

  get isStreamingSupported() {
    return this._stream._isStreamingSupported;
  }

  get contentLength() {
    return this._stream._contentLength;
  }

  async read() {
    if (this._queuedChunks.length > 0) {
      const chunk = this._queuedChunks.shift();

      return {
        value: chunk,
        done: false
      };
    }

    if (this._done) {
      return {
        value: undefined,
        done: true
      };
    }

    const requestCapability = createPromiseCapability();

    this._requests.push(requestCapability);

    return requestCapability.promise;
  }

  cancel(reason) {
    this._done = true;

    for (const requestCapability of this._requests) {
      requestCapability.resolve({
        value: undefined,
        done: true
      });
    }

    this._requests.length = 0;
  }

  progressiveDone() {
    if (this._done) {
      return;
    }

    this._done = true;
  }

}
/** @implements {IPDFStreamRangeReader} */


class PDFDataTransportStreamRangeReader {
  constructor(stream, begin, end) {
    this._stream = stream;
    this._begin = begin;
    this._end = end;
    this._queuedChunk = null;
    this._requests = [];
    this._done = false;
    this.onProgress = null;
  }

  _enqueue(chunk) {
    if (this._done) {
      return; // ignore new data
    }

    if (this._requests.length === 0) {
      this._queuedChunk = chunk;
    } else {
      const requestsCapability = this._requests.shift();

      requestsCapability.resolve({
        value: chunk,
        done: false
      });

      for (const requestCapability of this._requests) {
        requestCapability.resolve({
          value: undefined,
          done: true
        });
      }

      this._requests.length = 0;
    }

    this._done = true;

    this._stream._removeRangeReader(this);
  }

  get isStreamingSupported() {
    return false;
  }

  async read() {
    if (this._queuedChunk) {
      const chunk = this._queuedChunk;
      this._queuedChunk = null;
      return {
        value: chunk,
        done: false
      };
    }

    if (this._done) {
      return {
        value: undefined,
        done: true
      };
    }

    const requestCapability = createPromiseCapability();

    this._requests.push(requestCapability);

    return requestCapability.promise;
  }

  cancel(reason) {
    this._done = true;

    for (const requestCapability of this._requests) {
      requestCapability.resolve({
        value: undefined,
        done: true
      });
    }

    this._requests.length = 0;

    this._stream._removeRangeReader(this);
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
const DEFAULT_RANGE_CHUNK_SIZE = 65536; // 2^16 = 65536

const RENDERING_CANCELLED_TIMEOUT = 100; // ms

const DefaultCanvasFactory = (typeof PDFJSDev === "undefined" || PDFJSDev.test("GENERIC")) && isNodeJS ? NodeCanvasFactory : DOMCanvasFactory;
const DefaultCMapReaderFactory = (typeof PDFJSDev === "undefined" || PDFJSDev.test("GENERIC")) && isNodeJS ? NodeCMapReaderFactory : DOMCMapReaderFactory;
const DefaultStandardFontDataFactory = (typeof PDFJSDev === "undefined" || PDFJSDev.test("GENERIC")) && isNodeJS ? NodeStandardFontDataFactory : DOMStandardFontDataFactory;
/**
 * @typedef {function} IPDFStreamFactory
 * @param {DocumentInitParameters} params - The document initialization
 *   parameters. The "url" key is always present.
 * @returns {Promise} A promise, which is resolved with an instance of
 *   {IPDFStream}.
 * @ignore
 */

/**
 * @type IPDFStreamFactory
 * @private
 */

let createPDFNetworkStream;
/**
 * Sets the function that instantiates an {IPDFStream} as an alternative PDF
 * data transport.
 *
 * @param {IPDFStreamFactory} pdfNetworkStreamFactory - The factory function
 *   that takes document initialization parameters (including a "url") and
 *   returns a promise which is resolved with an instance of {IPDFStream}.
 * @ignore
 */

function setPDFNetworkStreamFactory(pdfNetworkStreamFactory) {
  createPDFNetworkStream = pdfNetworkStreamFactory;
}
/**
 * @typedef { Int8Array | Uint8Array | Uint8ClampedArray |
 *            Int16Array | Uint16Array |
 *            Int32Array | Uint32Array | Float32Array |
 *            Float64Array
 * } TypedArray
 */

/**
 * @typedef {Object} RefProxy
 * @property {number} num
 * @property {number} gen
 */

/**
 * Document initialization / loading parameters object.
 *
 * @typedef {Object} DocumentInitParameters
 * @property {string|URL} [url] - The URL of the PDF.
 * @property {TypedArray|Array<number>|string} [data] - Binary PDF data. Use
 *    typed arrays (Uint8Array) to improve the memory usage. If PDF data is
 *    BASE64-encoded, use `atob()` to convert it to a binary string first.
 * @property {Object} [httpHeaders] - Basic authentication headers.
 * @property {boolean} [withCredentials] - Indicates whether or not
 *   cross-site Access-Control requests should be made using credentials such
 *   as cookies or authorization headers. The default is `false`.
 * @property {string} [password] - For decrypting password-protected PDFs.
 * @property {TypedArray} [initialData] - A typed array with the first portion
 *   or all of the pdf data. Used by the extension since some data is already
 *   loaded before the switch to range requests.
 * @property {number} [length] - The PDF file length. It's used for progress
 *   reports and range requests operations.
 * @property {PDFDataRangeTransport} [range] - Allows for using a custom range
 *   transport implementation.
 * @property {number} [rangeChunkSize] - Specify maximum number of bytes fetched
 *   per range request. The default value is {@link DEFAULT_RANGE_CHUNK_SIZE}.
 * @property {PDFWorker} [worker] - The worker that will be used for loading and
 *   parsing the PDF data.
 * @property {number} [verbosity] - Controls the logging level; the constants
 *   from {@link VerbosityLevel} should be used.
 * @property {string} [docBaseUrl] - The base URL of the document, used when
 *   attempting to recover valid absolute URLs for annotations, and outline
 *   items, that (incorrectly) only specify relative URLs.
 * @property {string} [cMapUrl] - The URL where the predefined Adobe CMaps are
 *   located. Include the trailing slash.
 * @property {boolean} [cMapPacked] - Specifies if the Adobe CMaps are binary
 *   packed or not.
 * @property {Object} [CMapReaderFactory] - The factory that will be used when
 *   reading built-in CMap files. Providing a custom factory is useful for
 *   environments without Fetch API or `XMLHttpRequest` support, such as
 *   Node.js. The default value is {DOMCMapReaderFactory}.
 * @property {boolean} [useSystemFonts] - When `true`, fonts that aren't
 *   embedded in the PDF document will fallback to a system font.
 *   The default value is `true` in web environments and `false` in Node.js;
 *   unless `disableFontFace === true` in which case this defaults to `false`
 *   regardless of the environment (to prevent completely broken fonts).
 * @property {string} [standardFontDataUrl] - The URL where the standard font
 *   files are located. Include the trailing slash.
 * @property {Object} [StandardFontDataFactory] - The factory that will be used
 *   when reading the standard font files. Providing a custom factory is useful
 *   for environments without Fetch API or `XMLHttpRequest` support, such as
 *   Node.js. The default value is {DOMStandardFontDataFactory}.
 * @property {boolean} [useWorkerFetch] - Enable using the Fetch API in the
 *   worker-thread when reading CMap and standard font files. When `true`,
 *   the `CMapReaderFactory` and `StandardFontDataFactory` options are ignored.
 *   The default value is `true` in web environments and `false` in Node.js.
 * @property {boolean} [stopAtErrors] - Reject certain promises, e.g.
 *   `getOperatorList`, `getTextContent`, and `RenderTask`, when the associated
 *   PDF data cannot be successfully parsed, instead of attempting to recover
 *   whatever possible of the data. The default value is `false`.
 * @property {number} [maxImageSize] - The maximum allowed image size in total
 *   pixels, i.e. width * height. Images above this value will not be rendered.
 *   Use -1 for no limit, which is also the default value.
 * @property {boolean} [isEvalSupported] - Determines if we can evaluate strings
 *   as JavaScript. Primarily used to improve performance of font rendering, and
 *   when parsing PDF functions. The default value is `true`.
 * @property {boolean} [disableFontFace] - By default fonts are converted to
 *   OpenType fonts and loaded via the Font Loading API or `@font-face` rules.
 *   If disabled, fonts will be rendered using a built-in font renderer that
 *   constructs the glyphs with primitive path commands.
 *   The default value is `false` in web environments and `true` in Node.js.
 * @property {boolean} [fontExtraProperties] - Include additional properties,
 *   which are unused during rendering of PDF documents, when exporting the
 *   parsed font data from the worker-thread. This may be useful for debugging
 *   purposes (and backwards compatibility), but note that it will lead to
 *   increased memory usage. The default value is `false`.
 * @property {boolean} [enableXfa] - Render Xfa forms if any.
 *   The default value is `false`.
 * @property {HTMLDocument} [ownerDocument] - Specify an explicit document
 *   context to create elements with and to load resources, such as fonts,
 *   into. Defaults to the current document.
 * @property {boolean} [disableRange] - Disable range request loading of PDF
 *   files. When enabled, and if the server supports partial content requests,
 *   then the PDF will be fetched in chunks. The default value is `false`.
 * @property {boolean} [disableStream] - Disable streaming of PDF file data.
 *   By default PDF.js attempts to load PDF files in chunks. The default value
 *   is `false`.
 * @property {boolean} [disableAutoFetch] - Disable pre-fetching of PDF file
 *   data. When range requests are enabled PDF.js will automatically keep
 *   fetching more data even if it isn't needed to display the current page.
 *   The default value is `false`.
 *
 *   NOTE: It is also necessary to disable streaming, see above, in order for
 *   disabling of pre-fetching to work correctly.
 * @property {boolean} [pdfBug] - Enables special hooks for debugging PDF.js
 *   (see `web/debugger.js`). The default value is `false`.
 */

/**
 * This is the main entry point for loading a PDF and interacting with it.
 *
 * NOTE: If a URL is used to fetch the PDF data a standard Fetch API call (or
 * XHR as fallback) is used, which means it must follow same origin rules,
 * e.g. no cross-domain requests without CORS.
 *
 * @param {string|URL|TypedArray|PDFDataRangeTransport|DocumentInitParameters}
 *   src - Can be a URL where a PDF file is located, a typed array (Uint8Array)
 *         already populated with data, or a parameter object.
 * @returns {PDFDocumentLoadingTask}
 */


function getDocument(src) {
  const task = new PDFDocumentLoadingTask();
  let source;

  if (typeof src === "string" || src instanceof URL) {
    source = {
      url: src
    };
  } else if (isArrayBuffer(src)) {
    source = {
      data: src
    };
  } else if (src instanceof PDFDataRangeTransport) {
    source = {
      range: src
    };
  } else {
    if (typeof src !== "object") {
      throw new Error("Invalid parameter in getDocument, " + "need either string, URL, Uint8Array, or parameter object.");
    }

    if (!src.url && !src.data && !src.range) {
      throw new Error("Invalid parameter object: need either .data, .range or .url");
    }

    source = src;
  }

  const params = Object.create(null);
  let rangeTransport = null,
      worker = null;

  for (const key in source) {
    const value = source[key];

    switch (key) {
      case "url":
        if (typeof window !== "undefined") {
          try {
            // The full path is required in the 'url' field.
            params[key] = new URL(value, window.location).href;
            continue;
          } catch (ex) {
            warn(`Cannot create valid URL: "${ex}".`);
          }
        } else if (typeof value === "string" || value instanceof URL) {
          params[key] = value.toString(); // Support Node.js environments.

          continue;
        }

        throw new Error("Invalid PDF url data: " + "either string or URL-object is expected in the url property.");

      case "range":
        rangeTransport = value;
        continue;

      case "worker":
        worker = value;
        continue;

      case "data":
        // Converting string or array-like data to Uint8Array.
        if (typeof PDFJSDev !== "undefined" && PDFJSDev.test("GENERIC") && isNodeJS && typeof Buffer !== "undefined" && // eslint-disable-line no-undef
        value instanceof Buffer // eslint-disable-line no-undef
        ) {
          params[key] = new Uint8Array(value);
        } else if (value instanceof Uint8Array) {
          break; // Use the data as-is when it's already a Uint8Array.
        } else if (typeof value === "string") {
          params[key] = stringToBytes(value);
        } else if (typeof value === "object" && value !== null && !isNaN(value.length)) {
          params[key] = new Uint8Array(value);
        } else if (isArrayBuffer(value)) {
          params[key] = new Uint8Array(value);
        } else {
          throw new Error("Invalid PDF binary data: either typed array, " + "string, or array-like object is expected in the data property.");
        }

        continue;
    }

    params[key] = value;
  }

  params.rangeChunkSize = params.rangeChunkSize || DEFAULT_RANGE_CHUNK_SIZE;
  params.CMapReaderFactory = params.CMapReaderFactory || DefaultCMapReaderFactory;
  params.StandardFontDataFactory = params.StandardFontDataFactory || DefaultStandardFontDataFactory;
  params.ignoreErrors = params.stopAtErrors !== true;
  params.fontExtraProperties = params.fontExtraProperties === true;
  params.pdfBug = params.pdfBug === true;
  params.enableXfa = params.enableXfa === true;

  if (typeof params.docBaseUrl !== "string" || isDataScheme(params.docBaseUrl)) {
    // Ignore "data:"-URLs, since they can't be used to recover valid absolute
    // URLs anyway. We want to avoid sending them to the worker-thread, since
    // they contain the *entire* PDF document and can thus be arbitrarily long.
    params.docBaseUrl = null;
  }

  if (!Number.isInteger(params.maxImageSize)) {
    params.maxImageSize = -1;
  }

  if (typeof params.useWorkerFetch !== "boolean") {
    params.useWorkerFetch = params.CMapReaderFactory === DOMCMapReaderFactory && params.StandardFontDataFactory === DOMStandardFontDataFactory;
  }

  if (typeof params.isEvalSupported !== "boolean") {
    params.isEvalSupported = true;
  }

  if (typeof params.disableFontFace !== "boolean") {
    params.disableFontFace = (typeof PDFJSDev === "undefined" || PDFJSDev.test("GENERIC")) && isNodeJS;
  }

  if (typeof params.useSystemFonts !== "boolean") {
    params.useSystemFonts = !((typeof PDFJSDev === "undefined" || PDFJSDev.test("GENERIC")) && isNodeJS) && !params.disableFontFace;
  }

  if (typeof params.ownerDocument === "undefined") {
    params.ownerDocument = globalThis.document;
  }

  if (typeof params.disableRange !== "boolean") {
    params.disableRange = false;
  }

  if (typeof params.disableStream !== "boolean") {
    params.disableStream = false;
  }

  if (typeof params.disableAutoFetch !== "boolean") {
    params.disableAutoFetch = false;
  } // Set the main-thread verbosity level.


  setVerbosityLevel(params.verbosity);

  if (!worker) {
    const workerParams = {
      verbosity: params.verbosity,
      port: GlobalWorkerOptions.workerPort
    }; // Worker was not provided -- creating and owning our own. If message port
    // is specified in global worker options, using it.

    worker = workerParams.port ? PDFWorker.fromPort(workerParams) : new PDFWorker(workerParams);
    task._worker = worker;
  }

  const docId = task.docId;
  worker.promise.then(function () {
    if (task.destroyed) {
      throw new Error("Loading aborted");
    }

    const workerIdPromise = _fetchDocument(worker, params, rangeTransport, docId);

    const networkStreamPromise = new Promise(function (resolve) {
      let networkStream;

      if (rangeTransport) {
        networkStream = new PDFDataTransportStream({
          length: params.length,
          initialData: params.initialData,
          progressiveDone: params.progressiveDone,
          contentDispositionFilename: params.contentDispositionFilename,
          disableRange: params.disableRange,
          disableStream: params.disableStream
        }, rangeTransport);
      } else if (!params.data) {
        networkStream = createPDFNetworkStream({
          url: params.url,
          length: params.length,
          httpHeaders: params.httpHeaders,
          withCredentials: params.withCredentials,
          rangeChunkSize: params.rangeChunkSize,
          disableRange: params.disableRange,
          disableStream: params.disableStream
        });
      }

      resolve(networkStream);
    });
    return Promise.all([workerIdPromise, networkStreamPromise]).then(function ([workerId, networkStream]) {
      if (task.destroyed) {
        throw new Error("Loading aborted");
      }

      const messageHandler = new MessageHandler(docId, workerId, worker.port);
      messageHandler.postMessageTransfers = worker.postMessageTransfers;
      const transport = new WorkerTransport(messageHandler, task, networkStream, params);
      task._transport = transport;
      messageHandler.send("Ready", null);
    });
  }).catch(task._capability.reject);
  return task;
}
/**
 * Starts fetching of specified PDF document/data.
 *
 * @param {PDFWorker} worker
 * @param {Object} source
 * @param {PDFDataRangeTransport} pdfDataRangeTransport
 * @param {string} docId - Unique document ID, used in `MessageHandler`.
 * @returns {Promise} A promise that is resolved when the worker ID of the
 *   `MessageHandler` is known.
 * @private
 */


function _fetchDocument(worker, source, pdfDataRangeTransport, docId) {
  if (worker.destroyed) {
    return Promise.reject(new Error("Worker was destroyed"));
  }

  if (pdfDataRangeTransport) {
    source.length = pdfDataRangeTransport.length;
    source.initialData = pdfDataRangeTransport.initialData;
    source.progressiveDone = pdfDataRangeTransport.progressiveDone;
    source.contentDispositionFilename = pdfDataRangeTransport.contentDispositionFilename;
  }

  return worker.messageHandler.sendWithPromise("GetDocRequest", {
    docId,
    apiVersion: typeof PDFJSDev !== "undefined" && !PDFJSDev.test("TESTING") ? PDFJSDev.eval("BUNDLE_VERSION") : null,
    // Only send the required properties, and *not* the entire object.
    source: {
      data: source.data,
      url: source.url,
      password: source.password,
      disableAutoFetch: source.disableAutoFetch,
      rangeChunkSize: source.rangeChunkSize,
      length: source.length
    },
    maxImageSize: source.maxImageSize,
    disableFontFace: source.disableFontFace,
    postMessageTransfers: worker.postMessageTransfers,
    docBaseUrl: source.docBaseUrl,
    ignoreErrors: source.ignoreErrors,
    isEvalSupported: source.isEvalSupported,
    fontExtraProperties: source.fontExtraProperties,
    enableXfa: source.enableXfa,
    useSystemFonts: source.useSystemFonts,
    cMapUrl: source.useWorkerFetch ? source.cMapUrl : null,
    standardFontDataUrl: source.useWorkerFetch ? source.standardFontDataUrl : null
  }).then(function (workerId) {
    if (worker.destroyed) {
      throw new Error("Worker was destroyed");
    }

    return workerId;
  });
}
/**
 * @typedef {Object} OnProgressParameters
 * @property {number} loaded - Currently loaded number of bytes.
 * @property {number} total - Total number of bytes in the PDF file.
 */

/**
 * The loading task controls the operations required to load a PDF document
 * (such as network requests) and provides a way to listen for completion,
 * after which individual pages can be rendered.
 *
 * @typedef {Object} PDFDocumentLoadingTask
 * @property {string} docId - Unique identifier for the document loading task.
 * @property {boolean} destroyed - Whether the loading task is destroyed or not.
 * @property {function} [onPassword] - Callback to request a password if a wrong
 *   or no password was provided. The callback receives two parameters: a
 *   function that should be called with the new password, and a reason (see
 *   {@link PasswordResponses}).
 * @property {function} [onProgress] - Callback to be able to monitor the
 *   loading progress of the PDF file (necessary to implement e.g. a loading
 *   bar). The callback receives an {@link OnProgressParameters} argument.
 * @property {function} [onUnsupportedFeature] - Callback for when an
 *   unsupported feature is used in the PDF document. The callback receives an
 *   {@link UNSUPPORTED_FEATURES} argument.
 * @property {Promise<PDFDocumentProxy>} promise - Promise for document loading
 *   task completion.
 * @property {function} destroy - Abort all network requests and destroy
 *   the worker. Returns a promise that is resolved when destruction is
 *   completed.
 */

/**
 * @type {any}
 * @ignore
 */


const PDFDocumentLoadingTask = function PDFDocumentLoadingTaskClosure() {
  let nextDocumentId = 0;
  /**
   * The loading task controls the operations required to load a PDF document
   * (such as network requests) and provides a way to listen for completion,
   * after which individual pages can be rendered.
   */
  // eslint-disable-next-line no-shadow

  class PDFDocumentLoadingTask {
    constructor() {
      this._capability = createPromiseCapability();
      this._transport = null;
      this._worker = null;
      /**
       * Unique identifier for the document loading task.
       * @type {string}
       */

      this.docId = "d" + nextDocumentId++;
      /**
       * Whether the loading task is destroyed or not.
       * @type {boolean}
       */

      this.destroyed = false;
      /**
       * Callback to request a password if a wrong or no password was provided.
       * The callback receives two parameters: a function that should be called
       * with the new password, and a reason (see {@link PasswordResponses}).
       * @type {function}
       */

      this.onPassword = null;
      /**
       * Callback to be able to monitor the loading progress of the PDF file
       * (necessary to implement e.g. a loading bar).
       * The callback receives an {@link OnProgressParameters} argument.
       * @type {function}
       */

      this.onProgress = null;
      /**
       * Callback for when an unsupported feature is used in the PDF document.
       * The callback receives an {@link UNSUPPORTED_FEATURES} argument.
       * @type {function}
       */

      this.onUnsupportedFeature = null;
    }
    /**
     * Promise for document loading task completion.
     * @type {Promise<PDFDocumentProxy>}
     */


    get promise() {
      return this._capability.promise;
    }
    /**
     * @returns {Promise<void>} A promise that is resolved when destruction is
     *   completed.
     */


    destroy() {
      this.destroyed = true;
      const transportDestroyed = !this._transport ? Promise.resolve() : this._transport.destroy();
      return transportDestroyed.then(() => {
        this._transport = null;

        if (this._worker) {
          this._worker.destroy();

          this._worker = null;
        }
      });
    }

  }

  return PDFDocumentLoadingTask;
}();
/**
 * Abstract class to support range requests file loading.
 */


class PDFDataRangeTransport {
  /**
   * @param {number} length
   * @param {Uint8Array} initialData
   * @param {boolean} [progressiveDone]
   * @param {string} [contentDispositionFilename]
   */
  constructor(length, initialData, progressiveDone = false, contentDispositionFilename = null) {
    this.length = length;
    this.initialData = initialData;
    this.progressiveDone = progressiveDone;
    this.contentDispositionFilename = contentDispositionFilename;
    this._rangeListeners = [];
    this._progressListeners = [];
    this._progressiveReadListeners = [];
    this._progressiveDoneListeners = [];
    this._readyCapability = createPromiseCapability();
  }

  addRangeListener(listener) {
    this._rangeListeners.push(listener);
  }

  addProgressListener(listener) {
    this._progressListeners.push(listener);
  }

  addProgressiveReadListener(listener) {
    this._progressiveReadListeners.push(listener);
  }

  addProgressiveDoneListener(listener) {
    this._progressiveDoneListeners.push(listener);
  }

  onDataRange(begin, chunk) {
    for (const listener of this._rangeListeners) {
      listener(begin, chunk);
    }
  }

  onDataProgress(loaded, total) {
    this._readyCapability.promise.then(() => {
      for (const listener of this._progressListeners) {
        listener(loaded, total);
      }
    });
  }

  onDataProgressiveRead(chunk) {
    this._readyCapability.promise.then(() => {
      for (const listener of this._progressiveReadListeners) {
        listener(chunk);
      }
    });
  }

  onDataProgressiveDone() {
    this._readyCapability.promise.then(() => {
      for (const listener of this._progressiveDoneListeners) {
        listener();
      }
    });
  }

  transportReady() {
    this._readyCapability.resolve();
  }

  requestDataRange(begin, end) {
    unreachable("Abstract method PDFDataRangeTransport.requestDataRange");
  }

  abort() {}

}
/**
 * Proxy to a `PDFDocument` in the worker thread.
 */


class PDFDocumentProxy {
  constructor(pdfInfo, transport) {
    this._pdfInfo = pdfInfo;
    this._transport = transport;

    if (typeof PDFJSDev === "undefined" || PDFJSDev.test("GENERIC")) {
      Object.defineProperty(this, "fingerprint", {
        get() {
          deprecated("`PDFDocumentProxy.fingerprint`, " + "please use `PDFDocumentProxy.fingerprints` instead.");
          return this.fingerprints[0];
        }

      });
    }
  }
  /**
   * @type {AnnotationStorage} Storage for annotation data in forms.
   */


  get annotationStorage() {
    return this._transport.annotationStorage;
  }
  /**
   * @type {number} Total number of pages in the PDF file.
   */


  get numPages() {
    return this._pdfInfo.numPages;
  }
  /**
   * @type {Array<string, string|null>} A (not guaranteed to be) unique ID to
   *   identify the PDF document.
   *   NOTE: The first element will always be defined for all PDF documents,
   *   whereas the second element is only defined for *modified* PDF documents.
   */


  get fingerprints() {
    return this._pdfInfo.fingerprints;
  }
  /**
   * @type {boolean} True if only XFA form.
   */


  get isPureXfa() {
    return !!this._transport._htmlForXfa;
  }
  /**
   * NOTE: This is (mostly) intended to support printing of XFA forms.
   *
   * @type {Object | null} An object representing a HTML tree structure
   *   to render the XFA, or `null` when no XFA form exists.
   */


  get allXfaHtml() {
    return this._transport._htmlForXfa;
  }
  /**
   * @param {number} pageNumber - The page number to get. The first page is 1.
   * @returns {Promise<PDFPageProxy>} A promise that is resolved with
   *   a {@link PDFPageProxy} object.
   */


  getPage(pageNumber) {
    return this._transport.getPage(pageNumber);
  }
  /**
   * @param {RefProxy} ref - The page reference.
   * @returns {Promise<number>} A promise that is resolved with the page index,
   *   starting from zero, that is associated with the reference.
   */


  getPageIndex(ref) {
    return this._transport.getPageIndex(ref);
  }
  /**
   * @returns {Promise<Object<string, Array<any>>>} A promise that is resolved
   *   with a mapping from named destinations to references.
   *
   * This can be slow for large documents. Use `getDestination` instead.
   */


  getDestinations() {
    return this._transport.getDestinations();
  }
  /**
   * @param {string} id - The named destination to get.
   * @returns {Promise<Array<any> | null>} A promise that is resolved with all
   *   information of the given named destination, or `null` when the named
   *   destination is not present in the PDF file.
   */


  getDestination(id) {
    return this._transport.getDestination(id);
  }
  /**
   * @returns {Promise<Array<string> | null>} A promise that is resolved with
   *   an {Array} containing the page labels that correspond to the page
   *   indexes, or `null` when no page labels are present in the PDF file.
   */


  getPageLabels() {
    return this._transport.getPageLabels();
  }
  /**
   * @returns {Promise<string>} A promise that is resolved with a {string}
   *   containing the page layout name.
   */


  getPageLayout() {
    return this._transport.getPageLayout();
  }
  /**
   * @returns {Promise<string>} A promise that is resolved with a {string}
   *   containing the page mode name.
   */


  getPageMode() {
    return this._transport.getPageMode();
  }
  /**
   * @returns {Promise<Object | null>} A promise that is resolved with an
   *   {Object} containing the viewer preferences, or `null` when no viewer
   *   preferences are present in the PDF file.
   */


  getViewerPreferences() {
    return this._transport.getViewerPreferences();
  }
  /**
   * @returns {Promise<any | null>} A promise that is resolved with an {Array}
   *   containing the destination, or `null` when no open action is present
   *   in the PDF.
   */


  getOpenAction() {
    return this._transport.getOpenAction();
  }
  /**
   * @returns {Promise<any>} A promise that is resolved with a lookup table
   *   for mapping named attachments to their content.
   */


  getAttachments() {
    return this._transport.getAttachments();
  }
  /**
   * @returns {Promise<Array<string> | null>} A promise that is resolved with
   *   an {Array} of all the JavaScript strings in the name tree, or `null`
   *   if no JavaScript exists.
   */


  getJavaScript() {
    return this._transport.getJavaScript();
  }
  /**
   * @returns {Promise<Object | null>} A promise that is resolved with
   *   an {Object} with the JavaScript actions:
   *     - from the name tree (like getJavaScript);
   *     - from A or AA entries in the catalog dictionary.
   *   , or `null` if no JavaScript exists.
   */


  getJSActions() {
    return this._transport.getDocJSActions();
  }
  /**
   * @typedef {Object} OutlineNode
   * @property {string} title
   * @property {boolean} bold
   * @property {boolean} italic
   * @property {Uint8ClampedArray} color - The color in RGB format to use for
   *   display purposes.
   * @property {string | Array<any> | null} dest
   * @property {string | null} url
   * @property {string | undefined} unsafeUrl
   * @property {boolean | undefined} newWindow
   * @property {number | undefined} count
   * @property {Array<OutlineNode>} items
   */

  /**
   * @returns {Promise<Array<OutlineNode>>} A promise that is resolved with an
   *   {Array} that is a tree outline (if it has one) of the PDF file.
   */


  getOutline() {
    return this._transport.getOutline();
  }
  /**
   * @returns {Promise<OptionalContentConfig>} A promise that is resolved with
   *   an {@link OptionalContentConfig} that contains all the optional content
   *   groups (assuming that the document has any).
   */


  getOptionalContentConfig() {
    return this._transport.getOptionalContentConfig();
  }
  /**
   * @returns {Promise<Array<number> | null>} A promise that is resolved with
   *   an {Array} that contains the permission flags for the PDF document, or
   *   `null` when no permissions are present in the PDF file.
   */


  getPermissions() {
    return this._transport.getPermissions();
  }
  /**
   * @returns {Promise<{ info: Object, metadata: Metadata }>} A promise that is
   *   resolved with an {Object} that has `info` and `metadata` properties.
   *   `info` is an {Object} filled with anything available in the information
   *   dictionary and similarly `metadata` is a {Metadata} object with
   *   information from the metadata section of the PDF.
   */


  getMetadata() {
    return this._transport.getMetadata();
  }
  /**
   * @typedef {Object} MarkInfo
   * Properties correspond to Table 321 of the PDF 32000-1:2008 spec.
   * @property {boolean} Marked
   * @property {boolean} UserProperties
   * @property {boolean} Suspects
   */

  /**
   * @returns {Promise<MarkInfo | null>} A promise that is resolved with
   *   a {MarkInfo} object that contains the MarkInfo flags for the PDF
   *   document, or `null` when no MarkInfo values are present in the PDF file.
   */


  getMarkInfo() {
    return this._transport.getMarkInfo();
  }
  /**
   * @returns {Promise<TypedArray>} A promise that is resolved with a
   *   {TypedArray} that has the raw data from the PDF.
   */


  getData() {
    return this._transport.getData();
  }
  /**
   * @returns {Promise<{ length: number }>} A promise that is resolved when the
   *   document's data is loaded. It is resolved with an {Object} that contains
   *   the `length` property that indicates size of the PDF data in bytes.
   */


  getDownloadInfo() {
    return this._transport.downloadInfoCapability.promise;
  }
  /**
   * @typedef {Object} PDFDocumentStats
   * @property {Object<string, boolean>} streamTypes - Used stream types in the
   *   document (an item is set to true if specific stream ID was used in the
   *   document).
   * @property {Object<string, boolean>} fontTypes - Used font types in the
   *   document (an item is set to true if specific font ID was used in the
   *   document).
   */

  /**
   * @returns {Promise<PDFDocumentStats>} A promise this is resolved with
   *   current statistics about document structures (see
   *   {@link PDFDocumentStats}).
   */


  getStats() {
    return this._transport.getStats();
  }
  /**
   * Cleans up resources allocated by the document on both the main and worker
   * threads.
   *
   * NOTE: Do not, under any circumstances, call this method when rendering is
   * currently ongoing since that may lead to rendering errors.
   *
   * @param {boolean} [keepLoadedFonts] - Let fonts remain attached to the DOM.
   *   NOTE: This will increase persistent memory usage, hence don't use this
   *   option unless absolutely necessary. The default value is `false`.
   * @returns {Promise} A promise that is resolved when clean-up has finished.
   */


  cleanup(keepLoadedFonts = false) {
    return this._transport.startCleanup(keepLoadedFonts || this.isPureXfa);
  }
  /**
   * Destroys the current document instance and terminates the worker.
   */


  destroy() {
    return this.loadingTask.destroy();
  }
  /**
   * @type {DocumentInitParameters} A subset of the current
   *   {DocumentInitParameters}, which are needed in the viewer.
   */


  get loadingParams() {
    return this._transport.loadingParams;
  }
  /**
   * @type {PDFDocumentLoadingTask} The loadingTask for the current document.
   */


  get loadingTask() {
    return this._transport.loadingTask;
  }
  /**
   * @returns {Promise<Uint8Array>} A promise that is resolved with a
   *   {Uint8Array} containing the full data of the saved document.
   */


  saveDocument() {
    if ((typeof PDFJSDev === "undefined" || PDFJSDev.test("GENERIC")) && this._transport.annotationStorage.size <= 0) {
      deprecated("saveDocument called while `annotationStorage` is empty, " + "please use the getData-method instead.");
    }

    return this._transport.saveDocument();
  }
  /**
   * @returns {Promise<Array<Object> | null>} A promise that is resolved with an
   *   {Array<Object>} containing /AcroForm field data for the JS sandbox,
   *   or `null` when no field data is present in the PDF file.
   */


  getFieldObjects() {
    return this._transport.getFieldObjects();
  }
  /**
   * @returns {Promise<boolean>} A promise that is resolved with `true`
   *   if some /AcroForm fields have JavaScript actions.
   */


  hasJSActions() {
    return this._transport.hasJSActions();
  }
  /**
   * @returns {Promise<Array<string> | null>} A promise that is resolved with an
   *   {Array<string>} containing IDs of annotations that have a calculation
   *   action, or `null` when no such annotations are present in the PDF file.
   */


  getCalculationOrderIds() {
    return this._transport.getCalculationOrderIds();
  }

}
/**
 * Page getViewport parameters.
 *
 * @typedef {Object} GetViewportParameters
 * @property {number} scale - The desired scale of the viewport.
 * @property {number} [rotation] - The desired rotation, in degrees, of
 *   the viewport. If omitted it defaults to the page rotation.
 * @property {number} [offsetX] - The horizontal, i.e. x-axis, offset.
 *   The default value is `0`.
 * @property {number} [offsetY] - The vertical, i.e. y-axis, offset.
 *   The default value is `0`.
 * @property {boolean} [dontFlip] - If true, the y-axis will not be
 *   flipped. The default value is `false`.
 */

/**
 * Page getTextContent parameters.
 *
 * @typedef {Object} getTextContentParameters
 * @property {boolean} normalizeWhitespace - Replaces all occurrences of
 *   whitespace with standard spaces (0x20). The default value is `false`.
 * @property {boolean} disableCombineTextItems - Do not attempt to combine
 *   same line {@link TextItem}'s. The default value is `false`.
 * @property {boolean} [includeMarkedContent] - When true include marked
 *   content items in the items array of TextContent. The default is `false`.
 */

/**
 * Page text content.
 *
 * @typedef {Object} TextContent
 * @property {Array<TextItem | TextMarkedContent>} items - Array of
 *   {@link TextItem} and {@link TextMarkedContent} objects. TextMarkedContent
 *   items are included when includeMarkedContent is true.
 * @property {Object<string, TextStyle>} styles - {@link TextStyle} objects,
 *   indexed by font name.
 */

/**
 * Page text content part.
 *
 * @typedef {Object} TextItem
 * @property {string} str - Text content.
 * @property {string} dir - Text direction: 'ttb', 'ltr' or 'rtl'.
 * @property {Array<any>} transform - Transformation matrix.
 * @property {number} width - Width in device space.
 * @property {number} height - Height in device space.
 * @property {string} fontName - Font name used by PDF.js for converted font.
 * @property {boolean} hasEOL - Indicating if the text content is followed by a
 *   line-break.
 */

/**
 * Page text marked content part.
 *
 * @typedef {Object} TextMarkedContent
 * @property {string} type - Either 'beginMarkedContent',
 *   'beginMarkedContentProps', or 'endMarkedContent'.
 * @property {string} id - The marked content identifier. Only used for type
 *   'beginMarkedContentProps'.
 */

/**
 * Text style.
 *
 * @typedef {Object} TextStyle
 * @property {number} ascent - Font ascent.
 * @property {number} descent - Font descent.
 * @property {boolean} vertical - Whether or not the text is in vertical mode.
 * @property {string} fontFamily - The possible font family.
 */

/**
 * Page annotation parameters.
 *
 * @typedef {Object} GetAnnotationsParameters
 * @property {string} [intent] - Determines the annotations that are fetched,
 *   can be either 'display' (viewable annotations) or 'print' (printable
 *   annotations). If the parameter is omitted, all annotations are fetched.
 */

/**
 * Page render parameters.
 *
 * @typedef {Object} RenderParameters
 * @property {Object} canvasContext - A 2D context of a DOM Canvas object.
 * @property {PageViewport} viewport - Rendering viewport obtained by calling
 *   the `PDFPageProxy.getViewport` method.
 * @property {string} [intent] - Rendering intent, can be 'display' or 'print'.
 *   The default value is 'display'.
 * @property {boolean} [renderInteractiveForms] - Whether or not interactive
 *   form elements are rendered in the display layer. If so, we do not render
 *   them on the canvas as well. The default value is `false`.
 * @property {Array<any>} [transform] - Additional transform, applied just
 *   before viewport transform.
 * @property {Object} [imageLayer] - An object that has `beginLayout`,
 *   `endLayout` and `appendImage` functions.
 * @property {Object} [canvasFactory] - The factory instance that will be used
 *   when creating canvases. The default value is {new DOMCanvasFactory()}.
 * @property {Object | string} [background] - Background to use for the canvas.
 *   Any valid `canvas.fillStyle` can be used: a `DOMString` parsed as CSS
 *   <color> value, a `CanvasGradient` object (a linear or radial gradient) or
 *   a `CanvasPattern` object (a repetitive image). The default value is
 *   'rgb(255,255,255)'.
 * @property {boolean} [includeAnnotationStorage] - Render stored interactive
 *   form element data, from the {@link AnnotationStorage}-instance, onto the
 *   canvas itself; useful e.g. for printing. The default value is `false`.
 * @property {Promise<OptionalContentConfig>} [optionalContentConfigPromise] -
 *   A promise that should resolve with an {@link OptionalContentConfig}
 *   created from `PDFDocumentProxy.getOptionalContentConfig`. If `null`,
 *   the configuration will be fetched automatically with the default visibility
 *   states set.
 */

/**
 * Page getOperatorList parameters.
 *
 * @typedef {Object} GetOperatorListParameters
 * @property {string} [intent] - Rendering intent, can be 'display' or 'print'.
 *   The default value is 'display'.
 */

/**
 * Structure tree node. The root node will have a role "Root".
 *
 * @typedef {Object} StructTreeNode
 * @property {Array<StructTreeNode | StructTreeContent>} children - Array of
 *   {@link StructTreeNode} and {@link StructTreeContent} objects.
 * @property {string} role - element's role, already mapped if a role map exists
 * in the PDF.
 */

/**
 * Structure tree content.
 *
 * @typedef {Object} StructTreeContent
 * @property {string} type - either "content" for page and stream structure
 *   elements or "object" for object references.
 * @property {string} id - unique id that will map to the text layer.
 */

/**
 * PDF page operator list.
 *
 * @typedef {Object} PDFOperatorList
 * @property {Array<number>} fnArray - Array containing the operator functions.
 * @property {Array<any>} argsArray - Array containing the arguments of the
 *   functions.
 */

/**
 * Proxy to a `PDFPage` in the worker thread.
 */


class PDFPageProxy {
  constructor(pageIndex, pageInfo, transport, ownerDocument, pdfBug = false) {
    this._pageIndex = pageIndex;
    this._pageInfo = pageInfo;
    this._ownerDocument = ownerDocument;
    this._transport = transport;
    this._stats = pdfBug ? new StatTimer() : null;
    this._pdfBug = pdfBug;
    this.commonObjs = transport.commonObjs;
    this.objs = new PDFObjects();
    this.cleanupAfterRender = false;
    this.pendingCleanup = false;
    this._intentStates = new Map();
    this.destroyed = false;
  }
  /**
   * @type {number} Page number of the page. First page is 1.
   */


  get pageNumber() {
    return this._pageIndex + 1;
  }
  /**
   * @type {number} The number of degrees the page is rotated clockwise.
   */


  get rotate() {
    return this._pageInfo.rotate;
  }
  /**
   * @type {RefProxy | null} The reference that points to this page.
   */


  get ref() {
    return this._pageInfo.ref;
  }
  /**
   * @type {number} The default size of units in 1/72nds of an inch.
   */


  get userUnit() {
    return this._pageInfo.userUnit;
  }
  /**
   * @type {Array<number>} An array of the visible portion of the PDF page in
   *   user space units [x1, y1, x2, y2].
   */


  get view() {
    return this._pageInfo.view;
  }
  /**
   * @param {GetViewportParameters} params - Viewport parameters.
   * @returns {PageViewport} Contains 'width' and 'height' properties
   *   along with transforms required for rendering.
   */


  getViewport({
    scale,
    rotation = this.rotate,
    offsetX = 0,
    offsetY = 0,
    dontFlip = false
  } = {}) {
    return new PageViewport({
      viewBox: this.view,
      scale,
      rotation,
      offsetX,
      offsetY,
      dontFlip
    });
  }
  /**
   * @param {GetAnnotationsParameters} params - Annotation parameters.
   * @returns {Promise<Array<any>>} A promise that is resolved with an
   *   {Array} of the annotation objects.
   */


  getAnnotations({
    intent = null
  } = {}) {
    const renderingIntent = intent === "display" || intent === "print" ? intent : null;

    if (!this._annotationsPromise || this._annotationsIntent !== renderingIntent) {
      this._annotationsPromise = this._transport.getAnnotations(this._pageIndex, renderingIntent);
      this._annotationsIntent = renderingIntent;
    }

    return this._annotationsPromise;
  }
  /**
   * @returns {Promise<Object>} A promise that is resolved with an
   *   {Object} with JS actions.
   */


  getJSActions() {
    return this._jsActionsPromise || (this._jsActionsPromise = this._transport.getPageJSActions(this._pageIndex));
  }
  /**
   * @returns {Promise<Object | null>} A promise that is resolved with
   *   an {Object} with a fake DOM object (a tree structure where elements
   *   are {Object} with a name, attributes (class, style, ...), value and
   *   children, very similar to a HTML DOM tree), or `null` if no XFA exists.
   */


  async getXfa() {
    var _this$_transport$_htm;

    return ((_this$_transport$_htm = this._transport._htmlForXfa) === null || _this$_transport$_htm === void 0 ? void 0 : _this$_transport$_htm.children[this._pageIndex]) || null;
  }
  /**
   * Begins the process of rendering a page to the desired context.
   *
   * @param {RenderParameters} params - Page render parameters.
   * @returns {RenderTask} An object that contains a promise that is
   *   resolved when the page finishes rendering.
   */


  render({
    canvasContext,
    viewport,
    intent = "display",
    renderInteractiveForms = false,
    transform = null,
    imageLayer = null,
    canvasFactory = null,
    background = null,
    includeAnnotationStorage = false,
    optionalContentConfigPromise = null
  }) {
    var _intentState;

    if (this._stats) {
      this._stats.time("Overall");
    }

    const renderingIntent = intent === "print" ? "print" : "display"; // If there was a pending destroy, cancel it so no cleanup happens during
    // this call to render.

    this.pendingCleanup = false;

    if (!optionalContentConfigPromise) {
      optionalContentConfigPromise = this._transport.getOptionalContentConfig();
    }

    let intentState = this._intentStates.get(renderingIntent);

    if (!intentState) {
      intentState = Object.create(null);

      this._intentStates.set(renderingIntent, intentState);
    } // Ensure that a pending `streamReader` cancel timeout is always aborted.


    if (intentState.streamReaderCancelTimeout) {
      clearTimeout(intentState.streamReaderCancelTimeout);
      intentState.streamReaderCancelTimeout = null;
    }

    const canvasFactoryInstance = canvasFactory || new DefaultCanvasFactory({
      ownerDocument: this._ownerDocument
    });
    const annotationStorage = includeAnnotationStorage ? this._transport.annotationStorage.serializable : null; // If there's no displayReadyCapability yet, then the operatorList
    // was never requested before. Make the request and create the promise.

    if (!intentState.displayReadyCapability) {
      intentState.displayReadyCapability = createPromiseCapability();
      intentState.operatorList = {
        fnArray: [],
        argsArray: [],
        lastChunk: false
      };

      if (this._stats) {
        this._stats.time("Page Request");
      }

      this._pumpOperatorList({
        pageIndex: this._pageIndex,
        intent: renderingIntent,
        renderInteractiveForms: renderInteractiveForms === true,
        annotationStorage
      });
    }

    const complete = error => {
      intentState.renderTasks.delete(internalRenderTask); // Attempt to reduce memory usage during *printing*, by always running
      // cleanup once rendering has finished (regardless of cleanupAfterRender).

      if (this.cleanupAfterRender || renderingIntent === "print") {
        this.pendingCleanup = true;
      }

      this._tryCleanup();

      if (error) {
        internalRenderTask.capability.reject(error);

        this._abortOperatorList({
          intentState,
          reason: error
        });
      } else {
        internalRenderTask.capability.resolve();
      }

      if (this._stats) {
        this._stats.timeEnd("Rendering");

        this._stats.timeEnd("Overall");
      }
    };

    const internalRenderTask = new InternalRenderTask({
      callback: complete,
      // Only include the required properties, and *not* the entire object.
      params: {
        canvasContext,
        viewport,
        transform,
        imageLayer,
        background
      },
      objs: this.objs,
      commonObjs: this.commonObjs,
      operatorList: intentState.operatorList,
      pageIndex: this._pageIndex,
      canvasFactory: canvasFactoryInstance,
      useRequestAnimationFrame: renderingIntent !== "print",
      pdfBug: this._pdfBug
    });
    ((_intentState = intentState).renderTasks || (_intentState.renderTasks = new Set())).add(internalRenderTask);
    const renderTask = internalRenderTask.task;
    Promise.all([intentState.displayReadyCapability.promise, optionalContentConfigPromise]).then(([transparency, optionalContentConfig]) => {
      if (this.pendingCleanup) {
        complete();
        return;
      }

      if (this._stats) {
        this._stats.time("Rendering");
      }

      internalRenderTask.initializeGraphics({
        transparency,
        optionalContentConfig
      });
      internalRenderTask.operatorListChanged();
    }).catch(complete);
    return renderTask;
  }
  /**
   * @param {GetOperatorListParameters} params - Page getOperatorList
   *   parameters.
   * @returns {Promise<PDFOperatorList>} A promise resolved with an
   *   {@link PDFOperatorList} object that represents the page's operator list.
   */


  getOperatorList({
    intent = "display"
  } = {}) {
    function operatorListChanged() {
      if (intentState.operatorList.lastChunk) {
        intentState.opListReadCapability.resolve(intentState.operatorList);
        intentState.renderTasks.delete(opListTask);
      }
    }

    const renderingIntent = `oplist-${intent === "print" ? "print" : "display"}`;

    let intentState = this._intentStates.get(renderingIntent);

    if (!intentState) {
      intentState = Object.create(null);

      this._intentStates.set(renderingIntent, intentState);
    }

    let opListTask;

    if (!intentState.opListReadCapability) {
      var _intentState2;

      opListTask = Object.create(null);
      opListTask.operatorListChanged = operatorListChanged;
      intentState.opListReadCapability = createPromiseCapability();
      ((_intentState2 = intentState).renderTasks || (_intentState2.renderTasks = new Set())).add(opListTask);
      intentState.operatorList = {
        fnArray: [],
        argsArray: [],
        lastChunk: false
      };

      if (this._stats) {
        this._stats.time("Page Request");
      }

      this._pumpOperatorList({
        pageIndex: this._pageIndex,
        intent: renderingIntent
      });
    }

    return intentState.opListReadCapability.promise;
  }
  /**
   * @param {getTextContentParameters} params - getTextContent parameters.
   * @returns {ReadableStream} Stream for reading text content chunks.
   */


  streamTextContent({
    normalizeWhitespace = false,
    disableCombineTextItems = false,
    includeMarkedContent = false
  } = {}) {
    const TEXT_CONTENT_CHUNK_SIZE = 100;
    return this._transport.messageHandler.sendWithStream("GetTextContent", {
      pageIndex: this._pageIndex,
      normalizeWhitespace: normalizeWhitespace === true,
      combineTextItems: disableCombineTextItems !== true,
      includeMarkedContent: includeMarkedContent === true
    }, {
      highWaterMark: TEXT_CONTENT_CHUNK_SIZE,

      size(textContent) {
        return textContent.items.length;
      }

    });
  }
  /**
   * @param {getTextContentParameters} params - getTextContent parameters.
   * @returns {Promise<TextContent>} A promise that is resolved with a
   *   {@link TextContent} object that represents the page's text content.
   */


  getTextContent(params = {}) {
    const readableStream = this.streamTextContent(params);
    return new Promise(function (resolve, reject) {
      function pump() {
        reader.read().then(function ({
          value,
          done
        }) {
          if (done) {
            resolve(textContent);
            return;
          }

          Object.assign(textContent.styles, value.styles);
          textContent.items.push(...value.items);
          pump();
        }, reject);
      }

      const reader = readableStream.getReader();
      const textContent = {
        items: [],
        styles: Object.create(null)
      };
      pump();
    });
  }
  /**
   * @returns {Promise<StructTreeNode>} A promise that is resolved with a
   *   {@link StructTreeNode} object that represents the page's structure tree,
   *   or `null` when no structure tree is present for the current page.
   */


  getStructTree() {
    return this._structTreePromise || (this._structTreePromise = this._transport.getStructTree(this._pageIndex));
  }
  /**
   * Destroys the page object.
   * @private
   */


  _destroy() {
    this.destroyed = true;
    this._transport.pageCache[this._pageIndex] = null;
    const waitOn = [];

    for (const [intent, intentState] of this._intentStates) {
      this._abortOperatorList({
        intentState,
        reason: new Error("Page was destroyed."),
        force: true
      });

      if (intent.startsWith("oplist-")) {
        // Avoid errors below, since the renderTasks are just stubs.
        continue;
      }

      for (const internalRenderTask of intentState.renderTasks) {
        waitOn.push(internalRenderTask.completed);
        internalRenderTask.cancel();
      }
    }

    this.objs.clear();
    this._annotationsPromise = null;
    this._jsActionsPromise = null;
    this._structTreePromise = null;
    this.pendingCleanup = false;
    return Promise.all(waitOn);
  }
  /**
   * Cleans up resources allocated by the page.
   *
   * @param {boolean} [resetStats] - Reset page stats, if enabled.
   *   The default value is `false`.
   * @returns {boolean} Indicates if clean-up was successfully run.
   */


  cleanup(resetStats = false) {
    this.pendingCleanup = true;
    return this._tryCleanup(resetStats);
  }
  /**
   * Attempts to clean up if rendering is in a state where that's possible.
   * @private
   */


  _tryCleanup(resetStats = false) {
    if (!this.pendingCleanup) {
      return false;
    }

    for (const {
      renderTasks,
      operatorList
    } of this._intentStates.values()) {
      if (renderTasks.size > 0 || !operatorList.lastChunk) {
        return false;
      }
    }

    this._intentStates.clear();

    this.objs.clear();
    this._annotationsPromise = null;
    this._jsActionsPromise = null;
    this._structTreePromise = null;

    if (resetStats && this._stats) {
      this._stats = new StatTimer();
    }

    this.pendingCleanup = false;
    return true;
  }
  /**
   * @private
   */


  _startRenderPage(transparency, intent) {
    const intentState = this._intentStates.get(intent);

    if (!intentState) {
      return; // Rendering was cancelled.
    }

    if (this._stats) {
      this._stats.timeEnd("Page Request");
    } // TODO Refactor RenderPageRequest to separate rendering
    // and operator list logic


    if (intentState.displayReadyCapability) {
      intentState.displayReadyCapability.resolve(transparency);
    }
  }
  /**
   * @private
   */


  _renderPageChunk(operatorListChunk, intentState) {
    // Add the new chunk to the current operator list.
    for (let i = 0, ii = operatorListChunk.length; i < ii; i++) {
      intentState.operatorList.fnArray.push(operatorListChunk.fnArray[i]);
      intentState.operatorList.argsArray.push(operatorListChunk.argsArray[i]);
    }

    intentState.operatorList.lastChunk = operatorListChunk.lastChunk; // Notify all the rendering tasks there are more operators to be consumed.

    for (const internalRenderTask of intentState.renderTasks) {
      internalRenderTask.operatorListChanged();
    }

    if (operatorListChunk.lastChunk) {
      this._tryCleanup();
    }
  }
  /**
   * @private
   */


  _pumpOperatorList(args) {
    assert(args.intent, 'PDFPageProxy._pumpOperatorList: Expected "intent" argument.');

    const readableStream = this._transport.messageHandler.sendWithStream("GetOperatorList", args);

    const reader = readableStream.getReader();

    const intentState = this._intentStates.get(args.intent);

    intentState.streamReader = reader;

    const pump = () => {
      reader.read().then(({
        value,
        done
      }) => {
        if (done) {
          intentState.streamReader = null;
          return;
        }

        if (this._transport.destroyed) {
          return; // Ignore any pending requests if the worker was terminated.
        }

        this._renderPageChunk(value, intentState);

        pump();
      }, reason => {
        intentState.streamReader = null;

        if (this._transport.destroyed) {
          return; // Ignore any pending requests if the worker was terminated.
        }

        if (intentState.operatorList) {
          // Mark operator list as complete.
          intentState.operatorList.lastChunk = true;

          for (const internalRenderTask of intentState.renderTasks) {
            internalRenderTask.operatorListChanged();
          }

          this._tryCleanup();
        }

        if (intentState.displayReadyCapability) {
          intentState.displayReadyCapability.reject(reason);
        } else if (intentState.opListReadCapability) {
          intentState.opListReadCapability.reject(reason);
        } else {
          throw reason;
        }
      });
    };

    pump();
  }
  /**
   * @private
   */


  _abortOperatorList({
    intentState,
    reason,
    force = false
  }) {
    assert(reason instanceof Error || typeof reason === "object" && reason !== null, 'PDFPageProxy._abortOperatorList: Expected "reason" argument.');

    if (!intentState.streamReader) {
      return;
    }

    if (!force) {
      // Ensure that an Error occurring in *only* one `InternalRenderTask`, e.g.
      // multiple render() calls on the same canvas, won't break all rendering.
      if (intentState.renderTasks.size > 0) {
        return;
      } // Don't immediately abort parsing on the worker-thread when rendering is
      // cancelled, since that will unnecessarily delay re-rendering when (for
      // partially parsed pages) e.g. zooming/rotation occurs in the viewer.


      if (reason instanceof RenderingCancelledException) {
        intentState.streamReaderCancelTimeout = setTimeout(() => {
          this._abortOperatorList({
            intentState,
            reason,
            force: true
          });

          intentState.streamReaderCancelTimeout = null;
        }, RENDERING_CANCELLED_TIMEOUT);
        return;
      }
    }

    intentState.streamReader.cancel(new AbortException(reason === null || reason === void 0 ? void 0 : reason.message));
    intentState.streamReader = null;

    if (this._transport.destroyed) {
      return; // Ignore any pending requests if the worker was terminated.
    } // Remove the current `intentState`, since a cancelled `getOperatorList`
    // call on the worker-thread cannot be re-started...


    for (const [intent, curIntentState] of this._intentStates) {
      if (curIntentState === intentState) {
        this._intentStates.delete(intent);

        break;
      }
    } // ... and force clean-up to ensure that any old state is always removed.


    this.cleanup();
  }
  /**
   * @type {Object} Returns page stats, if enabled; returns `null` otherwise.
   */


  get stats() {
    return this._stats;
  }

}

class LoopbackPort {
  constructor() {
    this._listeners = [];
    this._deferred = Promise.resolve(undefined);
  }

  postMessage(obj, transfers) {
    function cloneValue(value) {
      // Trying to perform a structured clone close to the spec, including
      // transfers.
      if (typeof value === "function" || typeof value === "symbol" || value instanceof URL) {
        throw new Error(`LoopbackPort.postMessage - cannot clone: ${value === null || value === void 0 ? void 0 : value.toString()}`);
      }

      if (typeof value !== "object" || value === null) {
        return value;
      }

      if (cloned.has(value)) {
        // already cloned the object
        return cloned.get(value);
      }

      let buffer, result;

      if ((buffer = value.buffer) && isArrayBuffer(buffer)) {
        // We found object with ArrayBuffer (typed array).
        if (transfers !== null && transfers !== void 0 && transfers.includes(buffer)) {
          result = new value.constructor(buffer, value.byteOffset, value.byteLength);
        } else {
          result = new value.constructor(value);
        }

        cloned.set(value, result);
        return result;
      }

      if (value instanceof Map) {
        result = new Map();
        cloned.set(value, result); // Adding to cache now for cyclic references.

        for (const [key, val] of value) {
          result.set(key, cloneValue(val));
        }

        return result;
      }

      if (value instanceof Set) {
        result = new Set();
        cloned.set(value, result); // Adding to cache now for cyclic references.

        for (const val of value) {
          result.add(cloneValue(val));
        }

        return result;
      }

      result = Array.isArray(value) ? [] : Object.create(null);
      cloned.set(value, result); // Adding to cache now for cyclic references.
      // Cloning all value and object properties, however ignoring properties
      // defined via getter.

      for (const i in value) {
        var _value$hasOwnProperty;

        let desc,
            p = value;

        while (!(desc = Object.getOwnPropertyDescriptor(p, i))) {
          p = Object.getPrototypeOf(p);
        }

        if (typeof desc.value === "undefined") {
          continue;
        }

        if (typeof desc.value === "function" && !((_value$hasOwnProperty = value.hasOwnProperty) !== null && _value$hasOwnProperty !== void 0 && _value$hasOwnProperty.call(value, i))) {
          continue;
        }

        result[i] = cloneValue(desc.value);
      }

      return result;
    }

    const cloned = new WeakMap();
    const event = {
      data: cloneValue(obj)
    };

    this._deferred.then(() => {
      for (const listener of this._listeners) {
        listener.call(this, event);
      }
    });
  }

  addEventListener(name, listener) {
    this._listeners.push(listener);
  }

  removeEventListener(name, listener) {
    const i = this._listeners.indexOf(listener);

    this._listeners.splice(i, 1);
  }

  terminate() {
    this._listeners.length = 0;
  }

}
/**
 * @typedef {Object} PDFWorkerParameters
 * @property {string} [name] - The name of the worker.
 * @property {Object} [port] - The `workerPort` object.
 * @property {number} [verbosity] - Controls the logging level; the
 *   constants from {@link VerbosityLevel} should be used.
 */

/** @type {any} */


const PDFWorker = function PDFWorkerClosure() {
  const pdfWorkerPorts = new WeakMap();
  let isWorkerDisabled = false;
  let fallbackWorkerSrc;
  let nextFakeWorkerId = 0;
  let fakeWorkerCapability;

  if (typeof PDFJSDev !== "undefined" && PDFJSDev.test("GENERIC")) {
    // eslint-disable-next-line no-undef
    if (isNodeJS && typeof __non_webpack_require__ === "function") {
      // Workers aren't supported in Node.js, force-disabling them there.
      isWorkerDisabled = true;

      if (typeof PDFJSDev !== "undefined" && PDFJSDev.test("LIB")) {
        fallbackWorkerSrc = "../pdf.worker.js";
      } else {
        fallbackWorkerSrc = "./pdf.worker.js";
      }
    } else if (typeof document === "object" && "currentScript" in document) {
      var _document$currentScri;

      const pdfjsFilePath = (_document$currentScri = document.currentScript) === null || _document$currentScri === void 0 ? void 0 : _document$currentScri.src;

      if (pdfjsFilePath) {
        fallbackWorkerSrc = pdfjsFilePath.replace(/(\.(?:min\.)?js)(\?.*)?$/i, ".worker$1$2");
      }
    }
  }

  function getWorkerSrc() {
    if (GlobalWorkerOptions.workerSrc) {
      return GlobalWorkerOptions.workerSrc;
    }

    if (typeof fallbackWorkerSrc !== "undefined") {
      if (!isNodeJS) {
        deprecated('No "GlobalWorkerOptions.workerSrc" specified.');
      }

      return fallbackWorkerSrc;
    }

    throw new Error('No "GlobalWorkerOptions.workerSrc" specified.');
  }

  function getMainThreadWorkerMessageHandler() {
    let mainWorkerMessageHandler;

    try {
      var _globalThis$pdfjsWork;

      mainWorkerMessageHandler = (_globalThis$pdfjsWork = globalThis.pdfjsWorker) === null || _globalThis$pdfjsWork === void 0 ? void 0 : _globalThis$pdfjsWork.WorkerMessageHandler;
    } catch (ex) {
      /* Ignore errors. */
    }

    return mainWorkerMessageHandler || null;
  } // Loads worker code into main thread.


  function setupFakeWorkerGlobal() {
    if (fakeWorkerCapability) {
      return fakeWorkerCapability.promise;
    }

    fakeWorkerCapability = createPromiseCapability();

    const loader = async function () {
      const mainWorkerMessageHandler = getMainThreadWorkerMessageHandler();

      if (mainWorkerMessageHandler) {
        // The worker was already loaded using e.g. a `<script>` tag.
        return mainWorkerMessageHandler;
      }

      if (typeof PDFJSDev === "undefined" || !PDFJSDev.test("PRODUCTION")) {
        const worker = await import('./worker.js');
        return worker.WorkerMessageHandler;
      }

      if (PDFJSDev.test("GENERIC") && isNodeJS && // eslint-disable-next-line no-undef
      typeof __non_webpack_require__ === "function") {
        // Since bundlers, such as Webpack, cannot be told to leave `require`
        // statements alone we are thus forced to jump through hoops in order
        // to prevent `Critical dependency: ...` warnings in third-party
        // deployments of the built `pdf.js`/`pdf.worker.js` files; see
        // https://github.com/webpack/webpack/issues/8826
        //
        // The following hack is based on the assumption that code running in
        // Node.js won't ever be affected by e.g. Content Security Policies that
        // prevent the use of `eval`. If that ever occurs, we should revert this
        // to a normal `__non_webpack_require__` statement and simply document
        // the Webpack warnings instead (telling users to ignore them).
        //
        // eslint-disable-next-line no-eval
        const worker = eval("require")(getWorkerSrc());
        return worker.WorkerMessageHandler;
      }

      await loadScript(getWorkerSrc());
      return window.pdfjsWorker.WorkerMessageHandler;
    };

    loader().then(fakeWorkerCapability.resolve, fakeWorkerCapability.reject);
    return fakeWorkerCapability.promise;
  }

  function createCDNWrapper(url) {
    // We will rely on blob URL's property to specify origin.
    // We want this function to fail in case if createObjectURL or Blob do not
    // exist or fail for some reason -- our Worker creation will fail anyway.
    const wrapper = "importScripts('" + url + "');";
    return URL.createObjectURL(new Blob([wrapper]));
  }
  /**
   * PDF.js web worker abstraction that controls the instantiation of PDF
   * documents. Message handlers are used to pass information from the main
   * thread to the worker thread and vice versa. If the creation of a web
   * worker is not possible, a "fake" worker will be used instead.
   */
  // eslint-disable-next-line no-shadow


  class PDFWorker {
    /**
     * @param {PDFWorkerParameters} params - Worker initialization parameters.
     */
    constructor({
      name = null,
      port = null,
      verbosity = getVerbosityLevel()
    } = {}) {
      if (port && pdfWorkerPorts.has(port)) {
        throw new Error("Cannot use more than one PDFWorker per port");
      }

      this.name = name;
      this.destroyed = false;
      this.postMessageTransfers = true;
      this.verbosity = verbosity;
      this._readyCapability = createPromiseCapability();
      this._port = null;
      this._webWorker = null;
      this._messageHandler = null;

      if (port) {
        pdfWorkerPorts.set(port, this);

        this._initializeFromPort(port);

        return;
      }

      this._initialize();
    }

    get promise() {
      return this._readyCapability.promise;
    }

    get port() {
      return this._port;
    }

    get messageHandler() {
      return this._messageHandler;
    }

    _initializeFromPort(port) {
      this._port = port;
      this._messageHandler = new MessageHandler("main", "worker", port);

      this._messageHandler.on("ready", function () {// Ignoring 'ready' event -- MessageHandler shall be already initialized
        // and ready to accept the messages.
      });

      this._readyCapability.resolve();
    }

    _initialize() {
      // If worker support isn't disabled explicit and the browser has worker
      // support, create a new web worker and test if it/the browser fulfills
      // all requirements to run parts of pdf.js in a web worker.
      // Right now, the requirement is, that an Uint8Array is still an
      // Uint8Array as it arrives on the worker. (Chrome added this with v.15.)
      if (typeof Worker !== "undefined" && !isWorkerDisabled && !getMainThreadWorkerMessageHandler()) {
        let workerSrc = getWorkerSrc();

        try {
          // Wraps workerSrc path into blob URL, if the former does not belong
          // to the same origin.
          if (typeof PDFJSDev !== "undefined" && PDFJSDev.test("GENERIC") && !isSameOrigin(window.location.href, workerSrc)) {
            workerSrc = createCDNWrapper(new URL(workerSrc, window.location).href);
          } // Some versions of FF can't create a worker on localhost, see:
          // https://bugzilla.mozilla.org/show_bug.cgi?id=683280


          const worker = new Worker(workerSrc);
          const messageHandler = new MessageHandler("main", "worker", worker);

          const terminateEarly = () => {
            worker.removeEventListener("error", onWorkerError);
            messageHandler.destroy();
            worker.terminate();

            if (this.destroyed) {
              this._readyCapability.reject(new Error("Worker was destroyed"));
            } else {
              // Fall back to fake worker if the termination is caused by an
              // error (e.g. NetworkError / SecurityError).
              this._setupFakeWorker();
            }
          };

          const onWorkerError = () => {
            if (!this._webWorker) {
              // Worker failed to initialize due to an error. Clean up and fall
              // back to the fake worker.
              terminateEarly();
            }
          };

          worker.addEventListener("error", onWorkerError);
          messageHandler.on("test", data => {
            worker.removeEventListener("error", onWorkerError);

            if (this.destroyed) {
              terminateEarly();
              return; // worker was destroyed
            }

            if (data) {
              // supportTypedArray
              this._messageHandler = messageHandler;
              this._port = worker;
              this._webWorker = worker;

              if (!data.supportTransfers) {
                this.postMessageTransfers = false;
              }

              this._readyCapability.resolve(); // Send global setting, e.g. verbosity level.


              messageHandler.send("configure", {
                verbosity: this.verbosity
              });
            } else {
              this._setupFakeWorker();

              messageHandler.destroy();
              worker.terminate();
            }
          });
          messageHandler.on("ready", data => {
            worker.removeEventListener("error", onWorkerError);

            if (this.destroyed) {
              terminateEarly();
              return; // worker was destroyed
            }

            try {
              sendTest();
            } catch (e) {
              // We need fallback to a faked worker.
              this._setupFakeWorker();
            }
          });

          const sendTest = () => {
            const testObj = new Uint8Array([this.postMessageTransfers ? 255 : 0]); // Some versions of Opera throw a DATA_CLONE_ERR on serializing the
            // typed array. Also, checking if we can use transfers.

            try {
              messageHandler.send("test", testObj, [testObj.buffer]);
            } catch (ex) {
              warn("Cannot use postMessage transfers.");
              testObj[0] = 0;
              messageHandler.send("test", testObj);
            }
          }; // It might take time for worker to initialize (especially when AMD
          // loader is used). We will try to send test immediately, and then
          // when 'ready' message will arrive. The worker shall process only
          // first received 'test'.


          sendTest();
          return;
        } catch (e) {
          info("The worker has been disabled.");
        }
      } // Either workers are disabled, not supported or have thrown an exception.
      // Thus, we fallback to a faked worker.


      this._setupFakeWorker();
    }

    _setupFakeWorker() {
      if (!isWorkerDisabled) {
        warn("Setting up fake worker.");
        isWorkerDisabled = true;
      }

      setupFakeWorkerGlobal().then(WorkerMessageHandler => {
        if (this.destroyed) {
          this._readyCapability.reject(new Error("Worker was destroyed"));

          return;
        }

        const port = new LoopbackPort();
        this._port = port; // All fake workers use the same port, making id unique.

        const id = "fake" + nextFakeWorkerId++; // If the main thread is our worker, setup the handling for the
        // messages -- the main thread sends to it self.

        const workerHandler = new MessageHandler(id + "_worker", id, port);
        WorkerMessageHandler.setup(workerHandler, port);
        const messageHandler = new MessageHandler(id, id + "_worker", port);
        this._messageHandler = messageHandler;

        this._readyCapability.resolve(); // Send global setting, e.g. verbosity level.


        messageHandler.send("configure", {
          verbosity: this.verbosity
        });
      }).catch(reason => {
        this._readyCapability.reject(new Error(`Setting up fake worker failed: "${reason.message}".`));
      });
    }
    /**
     * Destroys the worker instance.
     */


    destroy() {
      this.destroyed = true;

      if (this._webWorker) {
        // We need to terminate only web worker created resource.
        this._webWorker.terminate();

        this._webWorker = null;
      }

      pdfWorkerPorts.delete(this._port);
      this._port = null;

      if (this._messageHandler) {
        this._messageHandler.destroy();

        this._messageHandler = null;
      }
    }
    /**
     * @param {PDFWorkerParameters} params - The worker initialization
     *   parameters.
     */


    static fromPort(params) {
      if (!params || !params.port) {
        throw new Error("PDFWorker.fromPort - invalid method signature.");
      }

      if (pdfWorkerPorts.has(params.port)) {
        return pdfWorkerPorts.get(params.port);
      }

      return new PDFWorker(params);
    }

    static getWorkerSrc() {
      return getWorkerSrc();
    }

  }

  return PDFWorker;
}();
/**
 * For internal use only.
 * @ignore
 */


class WorkerTransport {
  constructor(messageHandler, loadingTask, networkStream, params) {
    this.messageHandler = messageHandler;
    this.loadingTask = loadingTask;
    this.commonObjs = new PDFObjects();
    this.fontLoader = new FontLoader({
      docId: loadingTask.docId,
      onUnsupportedFeature: this._onUnsupportedFeature.bind(this),
      ownerDocument: params.ownerDocument,
      styleElement: params.styleElement
    });
    this._params = params;

    if (!params.useWorkerFetch) {
      this.CMapReaderFactory = new params.CMapReaderFactory({
        baseUrl: params.cMapUrl,
        isCompressed: params.cMapPacked
      });
      this.StandardFontDataFactory = new params.StandardFontDataFactory({
        baseUrl: params.standardFontDataUrl
      });
    }

    this.destroyed = false;
    this.destroyCapability = null;
    this._passwordCapability = null;
    this._networkStream = networkStream;
    this._fullReader = null;
    this._lastProgress = null;
    this.pageCache = [];
    this.pagePromises = [];
    this.downloadInfoCapability = createPromiseCapability();
    this.setupMessageHandler();
  }

  get annotationStorage() {
    return shadow(this, "annotationStorage", new AnnotationStorage());
  }

  destroy() {
    if (this.destroyCapability) {
      return this.destroyCapability.promise;
    }

    this.destroyed = true;
    this.destroyCapability = createPromiseCapability();

    if (this._passwordCapability) {
      this._passwordCapability.reject(new Error("Worker was destroyed during onPassword callback"));
    }

    const waitOn = []; // We need to wait for all renderings to be completed, e.g.
    // timeout/rAF can take a long time.

    for (const page of this.pageCache) {
      if (page) {
        waitOn.push(page._destroy());
      }
    }

    this.pageCache.length = 0;
    this.pagePromises.length = 0; // Allow `AnnotationStorage`-related clean-up when destroying the document.

    if (this.hasOwnProperty("annotationStorage")) {
      this.annotationStorage.resetModified();
    } // We also need to wait for the worker to finish its long running tasks.


    const terminated = this.messageHandler.sendWithPromise("Terminate", null);
    waitOn.push(terminated);
    Promise.all(waitOn).then(() => {
      this.commonObjs.clear();
      this.fontLoader.clear();
      this._hasJSActionsPromise = null;

      if (this._networkStream) {
        this._networkStream.cancelAllRequests(new AbortException("Worker was terminated."));
      }

      if (this.messageHandler) {
        this.messageHandler.destroy();
        this.messageHandler = null;
      }

      this.destroyCapability.resolve();
    }, this.destroyCapability.reject);
    return this.destroyCapability.promise;
  }

  setupMessageHandler() {
    const {
      messageHandler,
      loadingTask
    } = this;
    messageHandler.on("GetReader", (data, sink) => {
      assert(this._networkStream, "GetReader - no `IPDFStream` instance available.");
      this._fullReader = this._networkStream.getFullReader();

      this._fullReader.onProgress = evt => {
        this._lastProgress = {
          loaded: evt.loaded,
          total: evt.total
        };
      };

      sink.onPull = () => {
        this._fullReader.read().then(function ({
          value,
          done
        }) {
          if (done) {
            sink.close();
            return;
          }

          assert(isArrayBuffer(value), "GetReader - expected an ArrayBuffer."); // Enqueue data chunk into sink, and transfer it
          // to other side as `Transferable` object.

          sink.enqueue(new Uint8Array(value), 1, [value]);
        }).catch(reason => {
          sink.error(reason);
        });
      };

      sink.onCancel = reason => {
        this._fullReader.cancel(reason);

        sink.ready.catch(readyReason => {
          if (this.destroyed) {
            return; // Ignore any pending requests if the worker was terminated.
          }

          throw readyReason;
        });
      };
    });
    messageHandler.on("ReaderHeadersReady", data => {
      const headersCapability = createPromiseCapability();
      const fullReader = this._fullReader;
      fullReader.headersReady.then(() => {
        // If stream or range are disabled, it's our only way to report
        // loading progress.
        if (!fullReader.isStreamingSupported || !fullReader.isRangeSupported) {
          if (this._lastProgress && loadingTask.onProgress) {
            loadingTask.onProgress(this._lastProgress);
          }

          fullReader.onProgress = evt => {
            if (loadingTask.onProgress) {
              loadingTask.onProgress({
                loaded: evt.loaded,
                total: evt.total
              });
            }
          };
        }

        headersCapability.resolve({
          isStreamingSupported: fullReader.isStreamingSupported,
          isRangeSupported: fullReader.isRangeSupported,
          contentLength: fullReader.contentLength
        });
      }, headersCapability.reject);
      return headersCapability.promise;
    });
    messageHandler.on("GetRangeReader", (data, sink) => {
      assert(this._networkStream, "GetRangeReader - no `IPDFStream` instance available.");

      const rangeReader = this._networkStream.getRangeReader(data.begin, data.end); // When streaming is enabled, it's possible that the data requested here
      // has already been fetched via the `_fullRequestReader` implementation.
      // However, given that the PDF data is loaded asynchronously on the
      // main-thread and then sent via `postMessage` to the worker-thread,
      // it may not have been available during parsing (hence the attempt to
      // use range requests here).
      //
      // To avoid wasting time and resources here, we'll thus *not* dispatch
      // range requests if the data was already loaded but has not been sent to
      // the worker-thread yet (which will happen via the `_fullRequestReader`).


      if (!rangeReader) {
        sink.close();
        return;
      }

      sink.onPull = () => {
        rangeReader.read().then(function ({
          value,
          done
        }) {
          if (done) {
            sink.close();
            return;
          }

          assert(isArrayBuffer(value), "GetRangeReader - expected an ArrayBuffer.");
          sink.enqueue(new Uint8Array(value), 1, [value]);
        }).catch(reason => {
          sink.error(reason);
        });
      };

      sink.onCancel = reason => {
        rangeReader.cancel(reason);
        sink.ready.catch(readyReason => {
          if (this.destroyed) {
            return; // Ignore any pending requests if the worker was terminated.
          }

          throw readyReason;
        });
      };
    });
    messageHandler.on("GetDoc", ({
      pdfInfo
    }) => {
      this._numPages = pdfInfo.numPages;
      this._htmlForXfa = pdfInfo.htmlForXfa;
      delete pdfInfo.htmlForXfa;

      loadingTask._capability.resolve(new PDFDocumentProxy(pdfInfo, this));
    });
    messageHandler.on("DocException", function (ex) {
      let reason;

      switch (ex.name) {
        case "PasswordException":
          reason = new PasswordException(ex.message, ex.code);
          break;

        case "InvalidPDFException":
          reason = new InvalidPDFException(ex.message);
          break;

        case "MissingPDFException":
          reason = new MissingPDFException(ex.message);
          break;

        case "UnexpectedResponseException":
          reason = new UnexpectedResponseException(ex.message, ex.status);
          break;

        case "UnknownErrorException":
          reason = new UnknownErrorException(ex.message, ex.details);
          break;
      }

      if (!(reason instanceof Error)) {
        const msg = "DocException - expected a valid Error.";

        if (typeof PDFJSDev === "undefined" || PDFJSDev.test("!PRODUCTION || TESTING")) {
          unreachable(msg);
        } else {
          warn(msg);
        }
      }

      loadingTask._capability.reject(reason);
    });
    messageHandler.on("PasswordRequest", exception => {
      this._passwordCapability = createPromiseCapability();

      if (loadingTask.onPassword) {
        const updatePassword = password => {
          this._passwordCapability.resolve({
            password
          });
        };

        try {
          loadingTask.onPassword(updatePassword, exception.code);
        } catch (ex) {
          this._passwordCapability.reject(ex);
        }
      } else {
        this._passwordCapability.reject(new PasswordException(exception.message, exception.code));
      }

      return this._passwordCapability.promise;
    });
    messageHandler.on("DataLoaded", data => {
      // For consistency: Ensure that progress is always reported when the
      // entire PDF file has been loaded, regardless of how it was fetched.
      if (loadingTask.onProgress) {
        loadingTask.onProgress({
          loaded: data.length,
          total: data.length
        });
      }

      this.downloadInfoCapability.resolve(data);
    });
    messageHandler.on("StartRenderPage", data => {
      if (this.destroyed) {
        return; // Ignore any pending requests if the worker was terminated.
      }

      const page = this.pageCache[data.pageIndex];

      page._startRenderPage(data.transparency, data.intent);
    });
    messageHandler.on("commonobj", data => {
      var _globalThis$FontInspe;

      if (this.destroyed) {
        return; // Ignore any pending requests if the worker was terminated.
      }

      const [id, type, exportedData] = data;

      if (this.commonObjs.has(id)) {
        return;
      }

      switch (type) {
        case "Font":
          const params = this._params;

          if ("error" in exportedData) {
            const exportedError = exportedData.error;
            warn(`Error during font loading: ${exportedError}`);
            this.commonObjs.resolve(id, exportedError);
            break;
          }

          let fontRegistry = null;

          if (params.pdfBug && (_globalThis$FontInspe = globalThis.FontInspector) !== null && _globalThis$FontInspe !== void 0 && _globalThis$FontInspe.enabled) {
            fontRegistry = {
              registerFont(font, url) {
                globalThis.FontInspector.fontAdded(font, url);
              }

            };
          }

          const font = new FontFaceObject(exportedData, {
            isEvalSupported: params.isEvalSupported,
            disableFontFace: params.disableFontFace,
            ignoreErrors: params.ignoreErrors,
            onUnsupportedFeature: this._onUnsupportedFeature.bind(this),
            fontRegistry
          });
          this.fontLoader.bind(font).catch(reason => {
            return messageHandler.sendWithPromise("FontFallback", {
              id
            });
          }).finally(() => {
            if (!params.fontExtraProperties && font.data) {
              // Immediately release the `font.data` property once the font
              // has been attached to the DOM, since it's no longer needed,
              // rather than waiting for a `PDFDocumentProxy.cleanup` call.
              // Since `font.data` could be very large, e.g. in some cases
              // multiple megabytes, this will help reduce memory usage.
              font.data = null;
            }

            this.commonObjs.resolve(id, font);
          });
          break;

        case "FontPath":
        case "Image":
          this.commonObjs.resolve(id, exportedData);
          break;

        default:
          throw new Error(`Got unknown common object type ${type}`);
      }
    });
    messageHandler.on("obj", data => {
      var _imageData$data;

      if (this.destroyed) {
        // Ignore any pending requests if the worker was terminated.
        return undefined;
      }

      const [id, pageIndex, type, imageData] = data;
      const pageProxy = this.pageCache[pageIndex];

      if (pageProxy.objs.has(id)) {
        return undefined;
      }

      switch (type) {
        case "Image":
          pageProxy.objs.resolve(id, imageData); // Heuristic that will allow us not to store large data.

          const MAX_IMAGE_SIZE_TO_STORE = 8000000;

          if ((imageData === null || imageData === void 0 ? void 0 : (_imageData$data = imageData.data) === null || _imageData$data === void 0 ? void 0 : _imageData$data.length) > MAX_IMAGE_SIZE_TO_STORE) {
            pageProxy.cleanupAfterRender = true;
          }

          break;

        case "Pattern":
          pageProxy.objs.resolve(id, imageData);
          break;

        default:
          throw new Error(`Got unknown object type ${type}`);
      }

      return undefined;
    });
    messageHandler.on("DocProgress", data => {
      if (this.destroyed) {
        return; // Ignore any pending requests if the worker was terminated.
      }

      if (loadingTask.onProgress) {
        loadingTask.onProgress({
          loaded: data.loaded,
          total: data.total
        });
      }
    });
    messageHandler.on("UnsupportedFeature", this._onUnsupportedFeature.bind(this));
    messageHandler.on("FetchBuiltInCMap", data => {
      if (this.destroyed) {
        return Promise.reject(new Error("Worker was destroyed."));
      }

      if (!this.CMapReaderFactory) {
        return Promise.reject(new Error("CMapReaderFactory not initialized, see the `useWorkerFetch` parameter."));
      }

      return this.CMapReaderFactory.fetch(data);
    });
    messageHandler.on("FetchStandardFontData", data => {
      if (this.destroyed) {
        return Promise.reject(new Error("Worker was destroyed."));
      }

      if (!this.StandardFontDataFactory) {
        return Promise.reject(new Error("StandardFontDataFactory not initialized, see the `useWorkerFetch` parameter."));
      }

      return this.StandardFontDataFactory.fetch(data);
    });
  }

  _onUnsupportedFeature({
    featureId
  }) {
    if (this.destroyed) {
      return; // Ignore any pending requests if the worker was terminated.
    }

    if (this.loadingTask.onUnsupportedFeature) {
      this.loadingTask.onUnsupportedFeature(featureId);
    }
  }

  getData() {
    return this.messageHandler.sendWithPromise("GetData", null);
  }

  getPage(pageNumber) {
    if (!Number.isInteger(pageNumber) || pageNumber <= 0 || pageNumber > this._numPages) {
      return Promise.reject(new Error("Invalid page request"));
    }

    const pageIndex = pageNumber - 1;

    if (pageIndex in this.pagePromises) {
      return this.pagePromises[pageIndex];
    }

    const promise = this.messageHandler.sendWithPromise("GetPage", {
      pageIndex
    }).then(pageInfo => {
      if (this.destroyed) {
        throw new Error("Transport destroyed");
      }

      const page = new PDFPageProxy(pageIndex, pageInfo, this, this._params.ownerDocument, this._params.pdfBug);
      this.pageCache[pageIndex] = page;
      return page;
    });
    this.pagePromises[pageIndex] = promise;
    return promise;
  }

  getPageIndex(ref) {
    return this.messageHandler.sendWithPromise("GetPageIndex", {
      ref
    }).catch(function (reason) {
      return Promise.reject(new Error(reason));
    });
  }

  getAnnotations(pageIndex, intent) {
    return this.messageHandler.sendWithPromise("GetAnnotations", {
      pageIndex,
      intent
    });
  }

  saveDocument() {
    var _this$_fullReader$fil, _this$_fullReader;

    return this.messageHandler.sendWithPromise("SaveDocument", {
      isPureXfa: !!this._htmlForXfa,
      numPages: this._numPages,
      annotationStorage: this.annotationStorage.serializable,
      filename: (_this$_fullReader$fil = (_this$_fullReader = this._fullReader) === null || _this$_fullReader === void 0 ? void 0 : _this$_fullReader.filename) !== null && _this$_fullReader$fil !== void 0 ? _this$_fullReader$fil : null
    }).finally(() => {
      this.annotationStorage.resetModified();
    });
  }

  getFieldObjects() {
    return this.messageHandler.sendWithPromise("GetFieldObjects", null);
  }

  hasJSActions() {
    return this._hasJSActionsPromise || (this._hasJSActionsPromise = this.messageHandler.sendWithPromise("HasJSActions", null));
  }

  getCalculationOrderIds() {
    return this.messageHandler.sendWithPromise("GetCalculationOrderIds", null);
  }

  getDestinations() {
    return this.messageHandler.sendWithPromise("GetDestinations", null);
  }

  getDestination(id) {
    if (typeof id !== "string") {
      return Promise.reject(new Error("Invalid destination request."));
    }

    return this.messageHandler.sendWithPromise("GetDestination", {
      id
    });
  }

  getPageLabels() {
    return this.messageHandler.sendWithPromise("GetPageLabels", null);
  }

  getPageLayout() {
    return this.messageHandler.sendWithPromise("GetPageLayout", null);
  }

  getPageMode() {
    return this.messageHandler.sendWithPromise("GetPageMode", null);
  }

  getViewerPreferences() {
    return this.messageHandler.sendWithPromise("GetViewerPreferences", null);
  }

  getOpenAction() {
    return this.messageHandler.sendWithPromise("GetOpenAction", null);
  }

  getAttachments() {
    return this.messageHandler.sendWithPromise("GetAttachments", null);
  }

  getJavaScript() {
    return this.messageHandler.sendWithPromise("GetJavaScript", null);
  }

  getDocJSActions() {
    return this.messageHandler.sendWithPromise("GetDocJSActions", null);
  }

  getPageJSActions(pageIndex) {
    return this.messageHandler.sendWithPromise("GetPageJSActions", {
      pageIndex
    });
  }

  getStructTree(pageIndex) {
    return this.messageHandler.sendWithPromise("GetStructTree", {
      pageIndex
    });
  }

  getOutline() {
    return this.messageHandler.sendWithPromise("GetOutline", null);
  }

  getOptionalContentConfig() {
    return this.messageHandler.sendWithPromise("GetOptionalContentConfig", null).then(results => {
      return new OptionalContentConfig(results);
    });
  }

  getPermissions() {
    return this.messageHandler.sendWithPromise("GetPermissions", null);
  }

  getMetadata() {
    return this.messageHandler.sendWithPromise("GetMetadata", null).then(results => {
      var _this$_fullReader$fil2, _this$_fullReader2, _this$_fullReader$con, _this$_fullReader3;

      return {
        info: results[0],
        metadata: results[1] ? new Metadata(results[1]) : null,
        contentDispositionFilename: (_this$_fullReader$fil2 = (_this$_fullReader2 = this._fullReader) === null || _this$_fullReader2 === void 0 ? void 0 : _this$_fullReader2.filename) !== null && _this$_fullReader$fil2 !== void 0 ? _this$_fullReader$fil2 : null,
        contentLength: (_this$_fullReader$con = (_this$_fullReader3 = this._fullReader) === null || _this$_fullReader3 === void 0 ? void 0 : _this$_fullReader3.contentLength) !== null && _this$_fullReader$con !== void 0 ? _this$_fullReader$con : null
      };
    });
  }

  getMarkInfo() {
    return this.messageHandler.sendWithPromise("GetMarkInfo", null);
  }

  getStats() {
    return this.messageHandler.sendWithPromise("GetStats", null);
  }

  async startCleanup(keepLoadedFonts = false) {
    await this.messageHandler.sendWithPromise("Cleanup", null);

    if (this.destroyed) {
      return; // No need to manually clean-up when destruction has started.
    }

    for (let i = 0, ii = this.pageCache.length; i < ii; i++) {
      const page = this.pageCache[i];

      if (!page) {
        continue;
      }

      const cleanupSuccessful = page.cleanup();

      if (!cleanupSuccessful) {
        throw new Error(`startCleanup: Page ${i + 1} is currently rendering.`);
      }
    }

    this.commonObjs.clear();

    if (!keepLoadedFonts) {
      this.fontLoader.clear();
    }

    this._hasJSActionsPromise = null;
  }

  get loadingParams() {
    const params = this._params;
    return shadow(this, "loadingParams", {
      disableAutoFetch: params.disableAutoFetch
    });
  }

}
/**
 * A PDF document and page is built of many objects. E.g. there are objects for
 * fonts, images, rendering code, etc. These objects may get processed inside of
 * a worker. This class implements some basic methods to manage these objects.
 * @ignore
 */


class PDFObjects {
  constructor() {
    this._objs = Object.create(null);
  }
  /**
   * Ensures there is an object defined for `objId`.
   * @private
   */


  _ensureObj(objId) {
    if (this._objs[objId]) {
      return this._objs[objId];
    }

    return this._objs[objId] = {
      capability: createPromiseCapability(),
      data: null,
      resolved: false
    };
  }
  /**
   * If called *without* callback, this returns the data of `objId` but the
   * object needs to be resolved. If it isn't, this method throws.
   *
   * If called *with* a callback, the callback is called with the data of the
   * object once the object is resolved. That means, if you call this method
   * and the object is already resolved, the callback gets called right away.
   */


  get(objId, callback = null) {
    // If there is a callback, then the get can be async and the object is
    // not required to be resolved right now.
    if (callback) {
      this._ensureObj(objId).capability.promise.then(callback);

      return null;
    } // If there isn't a callback, the user expects to get the resolved data
    // directly.


    const obj = this._objs[objId]; // If there isn't an object yet or the object isn't resolved, then the
    // data isn't ready yet!

    if (!obj || !obj.resolved) {
      throw new Error(`Requesting object that isn't resolved yet ${objId}.`);
    }

    return obj.data;
  }

  has(objId) {
    const obj = this._objs[objId];
    return (obj === null || obj === void 0 ? void 0 : obj.resolved) || false;
  }
  /**
   * Resolves the object `objId` with optional `data`.
   */


  resolve(objId, data) {
    const obj = this._ensureObj(objId);

    obj.resolved = true;
    obj.data = data;
    obj.capability.resolve(data);
  }

  clear() {
    this._objs = Object.create(null);
  }

}
/**
 * Allows controlling of the rendering tasks.
 */


class RenderTask {
  constructor(internalRenderTask) {
    this._internalRenderTask = internalRenderTask;
    /**
     * Callback for incremental rendering -- a function that will be called
     * each time the rendering is paused.  To continue rendering call the
     * function that is the first argument to the callback.
     * @type {function}
     */

    this.onContinue = null;
  }
  /**
   * Promise for rendering task completion.
   * @type {Promise<void>}
   */


  get promise() {
    return this._internalRenderTask.capability.promise;
  }
  /**
   * Cancels the rendering task. If the task is currently rendering it will
   * not be cancelled until graphics pauses with a timeout. The promise that
   * this object extends will be rejected when cancelled.
   */


  cancel() {
    this._internalRenderTask.cancel();
  }

}
/**
 * For internal use only.
 * @ignore
 */


const InternalRenderTask = function InternalRenderTaskClosure() {
  const canvasInRendering = new WeakSet(); // eslint-disable-next-line no-shadow

  class InternalRenderTask {
    constructor({
      callback,
      params,
      objs,
      commonObjs,
      operatorList,
      pageIndex,
      canvasFactory,
      useRequestAnimationFrame = false,
      pdfBug = false
    }) {
      this.callback = callback;
      this.params = params;
      this.objs = objs;
      this.commonObjs = commonObjs;
      this.operatorListIdx = null;
      this.operatorList = operatorList;
      this._pageIndex = pageIndex;
      this.canvasFactory = canvasFactory;
      this._pdfBug = pdfBug;
      this.running = false;
      this.graphicsReadyCallback = null;
      this.graphicsReady = false;
      this._useRequestAnimationFrame = useRequestAnimationFrame === true && typeof window !== "undefined";
      this.cancelled = false;
      this.capability = createPromiseCapability();
      this.task = new RenderTask(this); // caching this-bound methods

      this._cancelBound = this.cancel.bind(this);
      this._continueBound = this._continue.bind(this);
      this._scheduleNextBound = this._scheduleNext.bind(this);
      this._nextBound = this._next.bind(this);
      this._canvas = params.canvasContext.canvas;
    }

    get completed() {
      return this.capability.promise.catch(function () {// Ignoring errors, since we only want to know when rendering is
        // no longer pending.
      });
    }

    initializeGraphics({
      transparency = false,
      optionalContentConfig
    }) {
      var _globalThis$StepperMa;

      if (this.cancelled) {
        return;
      }

      if (this._canvas) {
        if (canvasInRendering.has(this._canvas)) {
          throw new Error("Cannot use the same canvas during multiple render() operations. " + "Use different canvas or ensure previous operations were " + "cancelled or completed.");
        }

        canvasInRendering.add(this._canvas);
      }

      if (this._pdfBug && (_globalThis$StepperMa = globalThis.StepperManager) !== null && _globalThis$StepperMa !== void 0 && _globalThis$StepperMa.enabled) {
        this.stepper = globalThis.StepperManager.create(this._pageIndex);
        this.stepper.init(this.operatorList);
        this.stepper.nextBreakPoint = this.stepper.getNextBreakPoint();
      }

      const {
        canvasContext,
        viewport,
        transform,
        imageLayer,
        background
      } = this.params;
      this.gfx = new CanvasGraphics(canvasContext, this.commonObjs, this.objs, this.canvasFactory, imageLayer, optionalContentConfig);
      this.gfx.beginDrawing({
        transform,
        viewport,
        transparency,
        background
      });
      this.operatorListIdx = 0;
      this.graphicsReady = true;

      if (this.graphicsReadyCallback) {
        this.graphicsReadyCallback();
      }
    }

    cancel(error = null) {
      this.running = false;
      this.cancelled = true;

      if (this.gfx) {
        this.gfx.endDrawing();
      }

      if (this._canvas) {
        canvasInRendering.delete(this._canvas);
      }

      this.callback(error || new RenderingCancelledException(`Rendering cancelled, page ${this._pageIndex + 1}`, "canvas"));
    }

    operatorListChanged() {
      if (!this.graphicsReady) {
        if (!this.graphicsReadyCallback) {
          this.graphicsReadyCallback = this._continueBound;
        }

        return;
      }

      if (this.stepper) {
        this.stepper.updateOperatorList(this.operatorList);
      }

      if (this.running) {
        return;
      }

      this._continue();
    }

    _continue() {
      this.running = true;

      if (this.cancelled) {
        return;
      }

      if (this.task.onContinue) {
        this.task.onContinue(this._scheduleNextBound);
      } else {
        this._scheduleNext();
      }
    }

    _scheduleNext() {
      if (this._useRequestAnimationFrame) {
        window.requestAnimationFrame(() => {
          this._nextBound().catch(this._cancelBound);
        });
      } else {
        Promise.resolve().then(this._nextBound).catch(this._cancelBound);
      }
    }

    async _next() {
      if (this.cancelled) {
        return;
      }

      this.operatorListIdx = this.gfx.executeOperatorList(this.operatorList, this.operatorListIdx, this._continueBound, this.stepper);

      if (this.operatorListIdx === this.operatorList.argsArray.length) {
        this.running = false;

        if (this.operatorList.lastChunk) {
          this.gfx.endDrawing();

          if (this._canvas) {
            canvasInRendering.delete(this._canvas);
          }

          this.callback();
        }
      }
    }

  }

  return InternalRenderTask;
}();
/** @type {string} */


const version = typeof PDFJSDev !== "undefined" ? PDFJSDev.eval("BUNDLE_VERSION") : null;
/** @type {string} */

const build = typeof PDFJSDev !== "undefined" ? PDFJSDev.eval("BUNDLE_BUILD") : null;

/* Copyright 2020 Mozilla Foundation
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
 * PLEASE NOTE: This file is currently imported in both the `../display/` and
 *              `../scripting_api/` folders, hence be EXTREMELY careful about
 *              introducing any dependencies here since that can lead to an
 *              unexpected/unnecessary size increase of the *built* files.
 */
function makeColorComp(n) {
  return Math.floor(Math.max(0, Math.min(1, n)) * 255).toString(16).padStart(2, "0");
} // PDF specifications section 10.3


class ColorConverters {
  static CMYK_G([c, y, m, k]) {
    return ["G", 1 - Math.min(1, 0.3 * c + 0.59 * m + 0.11 * y + k)];
  }

  static G_CMYK([g]) {
    return ["CMYK", 0, 0, 0, 1 - g];
  }

  static G_RGB([g]) {
    return ["RGB", g, g, g];
  }

  static G_HTML([g]) {
    const G = makeColorComp(g);
    return `#${G}${G}${G}`;
  }

  static RGB_G([r, g, b]) {
    return ["G", 0.3 * r + 0.59 * g + 0.11 * b];
  }

  static RGB_HTML([r, g, b]) {
    const R = makeColorComp(r);
    const G = makeColorComp(g);
    const B = makeColorComp(b);
    return `#${R}${G}${B}`;
  }

  static T_HTML() {
    return "#00000000";
  }

  static CMYK_RGB([c, y, m, k]) {
    return ["RGB", 1 - Math.min(1, c + k), 1 - Math.min(1, m + k), 1 - Math.min(1, y + k)];
  }

  static CMYK_HTML(components) {
    return this.RGB_HTML(this.CMYK_RGB(components));
  }

  static RGB_CMYK([r, g, b]) {
    const c = 1 - r;
    const m = 1 - g;
    const y = 1 - b;
    const k = Math.min(c, m, y);
    return ["CMYK", c, m, y, k];
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
 * @typedef {Object} AnnotationElementParameters
 * @property {Object} data
 * @property {HTMLDivElement} layer
 * @property {PDFPage} page
 * @property {PageViewport} viewport
 * @property {IPDFLinkService} linkService
 * @property {DownloadManager} downloadManager
 * @property {AnnotationStorage} [annotationStorage]
 * @property {string} [imageResourcesPath] - Path for image resources, mainly
 *   for annotation icons. Include trailing slash.
 * @property {boolean} renderInteractiveForms
 * @property {Object} svgFactory
 * @property {boolean} [enableScripting]
 * @property {boolean} [hasJSActions]
 * @property {Object} [mouseState]
 */

class AnnotationElementFactory {
  /**
   * @param {AnnotationElementParameters} parameters
   * @returns {AnnotationElement}
   */
  static create(parameters) {
    const subtype = parameters.data.annotationType;

    switch (subtype) {
      case AnnotationType.LINK:
        return new LinkAnnotationElement(parameters);

      case AnnotationType.TEXT:
        return new TextAnnotationElement(parameters);

      case AnnotationType.WIDGET:
        const fieldType = parameters.data.fieldType;

        switch (fieldType) {
          case "Tx":
            return new TextWidgetAnnotationElement(parameters);

          case "Btn":
            if (parameters.data.radioButton) {
              return new RadioButtonWidgetAnnotationElement(parameters);
            } else if (parameters.data.checkBox) {
              return new CheckboxWidgetAnnotationElement(parameters);
            }

            return new PushButtonWidgetAnnotationElement(parameters);

          case "Ch":
            return new ChoiceWidgetAnnotationElement(parameters);
        }

        return new WidgetAnnotationElement(parameters);

      case AnnotationType.POPUP:
        return new PopupAnnotationElement(parameters);

      case AnnotationType.FREETEXT:
        return new FreeTextAnnotationElement(parameters);

      case AnnotationType.LINE:
        return new LineAnnotationElement(parameters);

      case AnnotationType.SQUARE:
        return new SquareAnnotationElement(parameters);

      case AnnotationType.CIRCLE:
        return new CircleAnnotationElement(parameters);

      case AnnotationType.POLYLINE:
        return new PolylineAnnotationElement(parameters);

      case AnnotationType.CARET:
        return new CaretAnnotationElement(parameters);

      case AnnotationType.INK:
        return new InkAnnotationElement(parameters);

      case AnnotationType.POLYGON:
        return new PolygonAnnotationElement(parameters);

      case AnnotationType.HIGHLIGHT:
        return new HighlightAnnotationElement(parameters);

      case AnnotationType.UNDERLINE:
        return new UnderlineAnnotationElement(parameters);

      case AnnotationType.SQUIGGLY:
        return new SquigglyAnnotationElement(parameters);

      case AnnotationType.STRIKEOUT:
        return new StrikeOutAnnotationElement(parameters);

      case AnnotationType.STAMP:
        return new StampAnnotationElement(parameters);

      case AnnotationType.FILEATTACHMENT:
        return new FileAttachmentAnnotationElement(parameters);

      default:
        return new AnnotationElement(parameters);
    }
  }

}

class AnnotationElement {
  constructor(parameters, {
    isRenderable = false,
    ignoreBorder = false,
    createQuadrilaterals = false
  } = {}) {
    this.isRenderable = isRenderable;
    this.data = parameters.data;
    this.layer = parameters.layer;
    this.page = parameters.page;
    this.viewport = parameters.viewport;
    this.linkService = parameters.linkService;
    this.downloadManager = parameters.downloadManager;
    this.imageResourcesPath = parameters.imageResourcesPath;
    this.renderInteractiveForms = parameters.renderInteractiveForms;
    this.svgFactory = parameters.svgFactory;
    this.annotationStorage = parameters.annotationStorage;
    this.enableScripting = parameters.enableScripting;
    this.hasJSActions = parameters.hasJSActions;
    this._mouseState = parameters.mouseState;

    if (isRenderable) {
      this.container = this._createContainer(ignoreBorder);
    }

    if (createQuadrilaterals) {
      this.quadrilaterals = this._createQuadrilaterals(ignoreBorder);
    }
  }
  /**
   * Create an empty container for the annotation's HTML element.
   *
   * @private
   * @param {boolean} ignoreBorder
   * @memberof AnnotationElement
   * @returns {HTMLSectionElement}
   */


  _createContainer(ignoreBorder = false) {
    const data = this.data,
          page = this.page,
          viewport = this.viewport;
    const container = document.createElement("section");
    let width = data.rect[2] - data.rect[0];
    let height = data.rect[3] - data.rect[1];
    container.setAttribute("data-annotation-id", data.id); // Do *not* modify `data.rect`, since that will corrupt the annotation
    // position on subsequent calls to `_createContainer` (see issue 6804).

    const rect = Util.normalizeRect([data.rect[0], page.view[3] - data.rect[1] + page.view[1], data.rect[2], page.view[3] - data.rect[3] + page.view[1]]);
    container.style.transform = `matrix(${viewport.transform.join(",")})`;
    container.style.transformOrigin = `${-rect[0]}px ${-rect[1]}px`;

    if (!ignoreBorder && data.borderStyle.width > 0) {
      container.style.borderWidth = `${data.borderStyle.width}px`;

      if (data.borderStyle.style !== AnnotationBorderStyleType.UNDERLINE) {
        // Underline styles only have a bottom border, so we do not need
        // to adjust for all borders. This yields a similar result as
        // Adobe Acrobat/Reader.
        width -= 2 * data.borderStyle.width;
        height -= 2 * data.borderStyle.width;
      }

      const horizontalRadius = data.borderStyle.horizontalCornerRadius;
      const verticalRadius = data.borderStyle.verticalCornerRadius;

      if (horizontalRadius > 0 || verticalRadius > 0) {
        const radius = `${horizontalRadius}px / ${verticalRadius}px`;
        container.style.borderRadius = radius;
      }

      switch (data.borderStyle.style) {
        case AnnotationBorderStyleType.SOLID:
          container.style.borderStyle = "solid";
          break;

        case AnnotationBorderStyleType.DASHED:
          container.style.borderStyle = "dashed";
          break;

        case AnnotationBorderStyleType.BEVELED:
          warn("Unimplemented border style: beveled");
          break;

        case AnnotationBorderStyleType.INSET:
          warn("Unimplemented border style: inset");
          break;

        case AnnotationBorderStyleType.UNDERLINE:
          container.style.borderBottomStyle = "solid";
          break;
      }

      if (data.color) {
        container.style.borderColor = Util.makeHexColor(data.color[0] | 0, data.color[1] | 0, data.color[2] | 0);
      } else {
        // Transparent (invisible) border, so do not draw it at all.
        container.style.borderWidth = 0;
      }
    }

    container.style.left = `${rect[0]}px`;
    container.style.top = `${rect[1]}px`;
    container.style.width = `${width}px`;
    container.style.height = `${height}px`;
    return container;
  }
  /**
   * Create quadrilaterals from the annotation's quadpoints.
   *
   * @private
   * @param {boolean} ignoreBorder
   * @memberof AnnotationElement
   * @returns {Array<HTMLSectionElement>}
   */


  _createQuadrilaterals(ignoreBorder = false) {
    if (!this.data.quadPoints) {
      return null;
    }

    const quadrilaterals = [];
    const savedRect = this.data.rect;

    for (const quadPoint of this.data.quadPoints) {
      this.data.rect = [quadPoint[2].x, quadPoint[2].y, quadPoint[1].x, quadPoint[1].y];
      quadrilaterals.push(this._createContainer(ignoreBorder));
    }

    this.data.rect = savedRect;
    return quadrilaterals;
  }
  /**
   * Create a popup for the annotation's HTML element. This is used for
   * annotations that do not have a Popup entry in the dictionary, but
   * are of a type that works with popups (such as Highlight annotations).
   *
   * @private
   * @param {HTMLDivElement|HTMLImageElement|null} trigger
   * @param {Object} data
   * @memberof AnnotationElement
   */


  _createPopup(trigger, data) {
    let container = this.container;

    if (this.quadrilaterals) {
      trigger = trigger || this.quadrilaterals;
      container = this.quadrilaterals[0];
    } // If no trigger element is specified, create it.


    if (!trigger) {
      trigger = document.createElement("div");
      trigger.style.height = container.style.height;
      trigger.style.width = container.style.width;
      container.appendChild(trigger);
    }

    const popupElement = new PopupElement({
      container,
      trigger,
      color: data.color,
      title: data.title,
      modificationDate: data.modificationDate,
      contents: data.contents,
      hideWrapper: true
    });
    const popup = popupElement.render(); // Position the popup next to the annotation's container.

    popup.style.left = container.style.width;
    container.appendChild(popup);
  }
  /**
   * Render the quadrilaterals of the annotation.
   *
   * @private
   * @param {string} className
   * @memberof AnnotationElement
   * @returns {Array<HTMLSectionElement>}
   */


  _renderQuadrilaterals(className) {
    if (typeof PDFJSDev === "undefined" || PDFJSDev.test("!PRODUCTION || TESTING")) {
      assert(this.quadrilaterals, "Missing quadrilaterals during rendering");
    }

    for (const quadrilateral of this.quadrilaterals) {
      quadrilateral.className = className;
    }

    return this.quadrilaterals;
  }
  /**
   * Render the annotation's HTML element(s).
   *
   * @public
   * @memberof AnnotationElement
   * @returns {HTMLSectionElement|Array<HTMLSectionElement>}
   */


  render() {
    unreachable("Abstract method `AnnotationElement.render` called");
  }

}

class LinkAnnotationElement extends AnnotationElement {
  constructor(parameters) {
    const isRenderable = !!(parameters.data.url || parameters.data.dest || parameters.data.action || parameters.data.isTooltipOnly || parameters.data.actions && (parameters.data.actions.Action || parameters.data.actions["Mouse Up"] || parameters.data.actions["Mouse Down"]));
    super(parameters, {
      isRenderable,
      createQuadrilaterals: true
    });
  }

  render() {
    const {
      data,
      linkService
    } = this;
    const link = document.createElement("a");

    if (data.url) {
      addLinkAttributes(link, {
        url: data.url,
        target: data.newWindow ? LinkTarget.BLANK : linkService.externalLinkTarget,
        rel: linkService.externalLinkRel,
        enabled: linkService.externalLinkEnabled
      });
    } else if (data.action) {
      this._bindNamedAction(link, data.action);
    } else if (data.dest) {
      this._bindLink(link, data.dest);
    } else if (data.actions && (data.actions.Action || data.actions["Mouse Up"] || data.actions["Mouse Down"]) && this.enableScripting && this.hasJSActions) {
      this._bindJSAction(link, data);
    } else {
      this._bindLink(link, "");
    }

    if (this.quadrilaterals) {
      return this._renderQuadrilaterals("linkAnnotation").map((quadrilateral, index) => {
        const linkElement = index === 0 ? link : link.cloneNode();
        quadrilateral.appendChild(linkElement);
        return quadrilateral;
      });
    }

    this.container.className = "linkAnnotation";
    this.container.appendChild(link);
    return this.container;
  }
  /**
   * Bind internal links to the link element.
   *
   * @private
   * @param {Object} link
   * @param {Object} destination
   * @memberof LinkAnnotationElement
   */


  _bindLink(link, destination) {
    link.href = this.linkService.getDestinationHash(destination);

    link.onclick = () => {
      if (destination) {
        this.linkService.goToDestination(destination);
      }

      return false;
    };

    if (destination || destination ===
    /* isTooltipOnly = */
    "") {
      link.className = "internalLink";
    }
  }
  /**
   * Bind named actions to the link element.
   *
   * @private
   * @param {Object} link
   * @param {Object} action
   * @memberof LinkAnnotationElement
   */


  _bindNamedAction(link, action) {
    link.href = this.linkService.getAnchorUrl("");

    link.onclick = () => {
      this.linkService.executeNamedAction(action);
      return false;
    };

    link.className = "internalLink";
  }
  /**
   * Bind JS actions to the link element.
   *
   * @private
   * @param {Object} link
   * @param {Object} data
   * @memberof LinkAnnotationElement
   */


  _bindJSAction(link, data) {
    link.href = this.linkService.getAnchorUrl("");
    const map = new Map([["Action", "onclick"], ["Mouse Up", "onmouseup"], ["Mouse Down", "onmousedown"]]);

    for (const name of Object.keys(data.actions)) {
      const jsName = map.get(name);

      if (!jsName) {
        continue;
      }

      link[jsName] = () => {
        var _this$linkService$eve;

        (_this$linkService$eve = this.linkService.eventBus) === null || _this$linkService$eve === void 0 ? void 0 : _this$linkService$eve.dispatch("dispatcheventinsandbox", {
          source: this,
          detail: {
            id: data.id,
            name
          }
        });
        return false;
      };
    }

    link.className = "internalLink";
  }

}

class TextAnnotationElement extends AnnotationElement {
  constructor(parameters) {
    const isRenderable = !!(parameters.data.hasPopup || parameters.data.title || parameters.data.contents);
    super(parameters, {
      isRenderable
    });
  }

  render() {
    this.container.className = "textAnnotation";
    const image = document.createElement("img");
    image.style.height = this.container.style.height;
    image.style.width = this.container.style.width;
    image.src = this.imageResourcesPath + "annotation-" + this.data.name.toLowerCase() + ".svg";
    image.alt = "[{{type}} Annotation]";
    image.dataset.l10nId = "text_annotation_type";
    image.dataset.l10nArgs = JSON.stringify({
      type: this.data.name
    });

    if (!this.data.hasPopup) {
      this._createPopup(image, this.data);
    }

    this.container.appendChild(image);
    return this.container;
  }

}

class WidgetAnnotationElement extends AnnotationElement {
  render() {
    // Show only the container for unsupported field types.
    if (this.data.alternativeText) {
      this.container.title = this.data.alternativeText;
    }

    return this.container;
  }

  _getKeyModifier(event) {
    return navigator.platform.includes("Win") && event.ctrlKey || navigator.platform.includes("Mac") && event.metaKey;
  }

  _setEventListener(element, baseName, eventName, valueGetter) {
    if (baseName.includes("mouse")) {
      // Mouse events
      element.addEventListener(baseName, event => {
        var _this$linkService$eve2;

        (_this$linkService$eve2 = this.linkService.eventBus) === null || _this$linkService$eve2 === void 0 ? void 0 : _this$linkService$eve2.dispatch("dispatcheventinsandbox", {
          source: this,
          detail: {
            id: this.data.id,
            name: eventName,
            value: valueGetter(event),
            shift: event.shiftKey,
            modifier: this._getKeyModifier(event)
          }
        });
      });
    } else {
      // Non mouse event
      element.addEventListener(baseName, event => {
        var _this$linkService$eve3;

        (_this$linkService$eve3 = this.linkService.eventBus) === null || _this$linkService$eve3 === void 0 ? void 0 : _this$linkService$eve3.dispatch("dispatcheventinsandbox", {
          source: this,
          detail: {
            id: this.data.id,
            name: eventName,
            value: event.target.checked
          }
        });
      });
    }
  }

  _setEventListeners(element, names, getter) {
    for (const [baseName, eventName] of names) {
      var _this$data$actions;

      if (eventName === "Action" || (_this$data$actions = this.data.actions) !== null && _this$data$actions !== void 0 && _this$data$actions[eventName]) {
        this._setEventListener(element, baseName, eventName, getter);
      }
    }
  }

  _dispatchEventFromSandbox(actions, jsEvent) {
    const setColor = (jsName, styleName, event) => {
      const color = event.detail[jsName];
      event.target.style[styleName] = ColorConverters[`${color[0]}_HTML`](color.slice(1));
    };

    const commonActions = {
      display: event => {
        const hidden = event.detail.display % 2 === 1;
        event.target.style.visibility = hidden ? "hidden" : "visible";
        this.annotationStorage.setValue(this.data.id, {
          hidden,
          print: event.detail.display === 0 || event.detail.display === 3
        });
      },
      print: event => {
        this.annotationStorage.setValue(this.data.id, {
          print: event.detail.print
        });
      },
      hidden: event => {
        event.target.style.visibility = event.detail.hidden ? "hidden" : "visible";
        this.annotationStorage.setValue(this.data.id, {
          hidden: event.detail.hidden
        });
      },
      focus: event => {
        setTimeout(() => event.target.focus({
          preventScroll: false
        }), 0);
      },
      userName: event => {
        // tooltip
        event.target.title = event.detail.userName;
      },
      readonly: event => {
        if (event.detail.readonly) {
          event.target.setAttribute("readonly", "");
        } else {
          event.target.removeAttribute("readonly");
        }
      },
      required: event => {
        if (event.detail.required) {
          event.target.setAttribute("required", "");
        } else {
          event.target.removeAttribute("required");
        }
      },
      bgColor: event => {
        setColor("bgColor", "backgroundColor", event);
      },
      fillColor: event => {
        setColor("fillColor", "backgroundColor", event);
      },
      fgColor: event => {
        setColor("fgColor", "color", event);
      },
      textColor: event => {
        setColor("textColor", "color", event);
      },
      borderColor: event => {
        setColor("borderColor", "borderColor", event);
      },
      strokeColor: event => {
        setColor("strokeColor", "borderColor", event);
      }
    };

    for (const name of Object.keys(jsEvent.detail)) {
      const action = actions[name] || commonActions[name];

      if (action) {
        action(jsEvent);
      }
    }
  }

}

class TextWidgetAnnotationElement extends WidgetAnnotationElement {
  constructor(parameters) {
    const isRenderable = parameters.renderInteractiveForms || !parameters.data.hasAppearance && !!parameters.data.fieldValue;
    super(parameters, {
      isRenderable
    });
  }

  setPropertyOnSiblings(base, key, value, keyInStorage) {
    const storage = this.annotationStorage;

    for (const element of document.getElementsByName(base.name)) {
      if (element !== base) {
        element[key] = value;
        const data = Object.create(null);
        data[keyInStorage] = value;
        storage.setValue(element.getAttribute("id"), data);
      }
    }
  }

  render() {
    const storage = this.annotationStorage;
    const id = this.data.id;
    this.container.className = "textWidgetAnnotation";
    let element = null;

    if (this.renderInteractiveForms) {
      // NOTE: We cannot set the values using `element.value` below, since it
      //       prevents the AnnotationLayer rasterizer in `test/driver.js`
      //       from parsing the elements correctly for the reference tests.
      const storedData = storage.getValue(id, {
        value: this.data.fieldValue,
        valueAsString: this.data.fieldValue
      });
      const textContent = storedData.valueAsString || storedData.value || "";
      const elementData = {
        userValue: null,
        formattedValue: null,
        beforeInputSelectionRange: null,
        beforeInputValue: null
      };

      if (this.data.multiLine) {
        element = document.createElement("textarea");
        element.textContent = textContent;
      } else {
        element = document.createElement("input");
        element.type = "text";
        element.setAttribute("value", textContent);
      }

      elementData.userValue = textContent;
      element.setAttribute("id", id);
      element.addEventListener("input", event => {
        storage.setValue(id, {
          value: event.target.value
        });
        this.setPropertyOnSiblings(element, "value", event.target.value, "value");
      });

      let blurListener = event => {
        if (elementData.formattedValue) {
          event.target.value = elementData.formattedValue;
        } // Reset the cursor position to the start of the field (issue 12359).


        event.target.scrollLeft = 0;
        elementData.beforeInputSelectionRange = null;
      };

      if (this.enableScripting && this.hasJSActions) {
        var _this$data$actions2;

        element.addEventListener("focus", event => {
          if (elementData.userValue) {
            event.target.value = elementData.userValue;
          }
        });
        element.addEventListener("updatefromsandbox", jsEvent => {
          const actions = {
            value(event) {
              elementData.userValue = event.detail.value || "";
              storage.setValue(id, {
                value: elementData.userValue.toString()
              });

              if (!elementData.formattedValue) {
                event.target.value = elementData.userValue;
              }
            },

            valueAsString(event) {
              elementData.formattedValue = event.detail.valueAsString || "";

              if (event.target !== document.activeElement) {
                // Input hasn't the focus so display formatted string
                event.target.value = elementData.formattedValue;
              }

              storage.setValue(id, {
                formattedValue: elementData.formattedValue
              });
            },

            selRange(event) {
              const [selStart, selEnd] = event.detail.selRange;

              if (selStart >= 0 && selEnd < event.target.value.length) {
                event.target.setSelectionRange(selStart, selEnd);
              }
            }

          };

          this._dispatchEventFromSandbox(actions, jsEvent);
        }); // Even if the field hasn't any actions
        // leaving it can still trigger some actions with Calculate

        element.addEventListener("keydown", event => {
          var _this$linkService$eve4;

          elementData.beforeInputValue = event.target.value; // if the key is one of Escape, Enter or Tab
          // then the data are committed

          let commitKey = -1;

          if (event.key === "Escape") {
            commitKey = 0;
          } else if (event.key === "Enter") {
            commitKey = 2;
          } else if (event.key === "Tab") {
            commitKey = 3;
          }

          if (commitKey === -1) {
            return;
          } // Save the entered value


          elementData.userValue = event.target.value;
          (_this$linkService$eve4 = this.linkService.eventBus) === null || _this$linkService$eve4 === void 0 ? void 0 : _this$linkService$eve4.dispatch("dispatcheventinsandbox", {
            source: this,
            detail: {
              id,
              name: "Keystroke",
              value: event.target.value,
              willCommit: true,
              commitKey,
              selStart: event.target.selectionStart,
              selEnd: event.target.selectionEnd
            }
          });
        });
        const _blurListener = blurListener;
        blurListener = null;
        element.addEventListener("blur", event => {
          if (this._mouseState.isDown) {
            var _this$linkService$eve5;

            // Focus out using the mouse: data are committed
            elementData.userValue = event.target.value;
            (_this$linkService$eve5 = this.linkService.eventBus) === null || _this$linkService$eve5 === void 0 ? void 0 : _this$linkService$eve5.dispatch("dispatcheventinsandbox", {
              source: this,
              detail: {
                id,
                name: "Keystroke",
                value: event.target.value,
                willCommit: true,
                commitKey: 1,
                selStart: event.target.selectionStart,
                selEnd: event.target.selectionEnd
              }
            });
          }

          _blurListener(event);
        });
        element.addEventListener("mousedown", event => {
          elementData.beforeInputValue = event.target.value;
          elementData.beforeInputSelectionRange = null;
        });
        element.addEventListener("keyup", event => {
          // keyup is triggered after input
          if (event.target.selectionStart === event.target.selectionEnd) {
            elementData.beforeInputSelectionRange = null;
          }
        });
        element.addEventListener("select", event => {
          elementData.beforeInputSelectionRange = [event.target.selectionStart, event.target.selectionEnd];
        });

        if ((_this$data$actions2 = this.data.actions) !== null && _this$data$actions2 !== void 0 && _this$data$actions2.Keystroke) {
          // We should use beforeinput but this
          // event isn't available in Firefox
          element.addEventListener("input", event => {
            var _this$linkService$eve6;

            let selStart = -1;
            let selEnd = -1;

            if (elementData.beforeInputSelectionRange) {
              [selStart, selEnd] = elementData.beforeInputSelectionRange;
            }

            (_this$linkService$eve6 = this.linkService.eventBus) === null || _this$linkService$eve6 === void 0 ? void 0 : _this$linkService$eve6.dispatch("dispatcheventinsandbox", {
              source: this,
              detail: {
                id,
                name: "Keystroke",
                value: elementData.beforeInputValue,
                change: event.data,
                willCommit: false,
                selStart,
                selEnd
              }
            });
          });
        }

        this._setEventListeners(element, [["focus", "Focus"], ["blur", "Blur"], ["mousedown", "Mouse Down"], ["mouseenter", "Mouse Enter"], ["mouseleave", "Mouse Exit"], ["mouseup", "Mouse Up"]], event => event.target.value);
      }

      if (blurListener) {
        element.addEventListener("blur", blurListener);
      }

      element.disabled = this.data.readOnly;
      element.name = this.data.fieldName;

      if (this.data.maxLen !== null) {
        element.maxLength = this.data.maxLen;
      }

      if (this.data.comb) {
        const fieldWidth = this.data.rect[2] - this.data.rect[0];
        const combWidth = fieldWidth / this.data.maxLen;
        element.classList.add("comb");
        element.style.letterSpacing = `calc(${combWidth}px - 1ch)`;
      }
    } else {
      element = document.createElement("div");
      element.textContent = this.data.fieldValue;
      element.style.verticalAlign = "middle";
      element.style.display = "table-cell";
    }

    this._setTextStyle(element);

    this.container.appendChild(element);
    return this.container;
  }
  /**
   * Apply text styles to the text in the element.
   *
   * @private
   * @param {HTMLDivElement} element
   * @memberof TextWidgetAnnotationElement
   */


  _setTextStyle(element) {
    const TEXT_ALIGNMENT = ["left", "center", "right"];
    const {
      fontSize,
      fontColor
    } = this.data.defaultAppearanceData;
    const style = element.style; // TODO: If the font-size is zero, calculate it based on the height and
    //       width of the element.
    // Not setting `style.fontSize` will use the default font-size for now.

    if (fontSize) {
      style.fontSize = `${fontSize}px`;
    }

    style.color = Util.makeHexColor(fontColor[0], fontColor[1], fontColor[2]);

    if (this.data.textAlignment !== null) {
      style.textAlign = TEXT_ALIGNMENT[this.data.textAlignment];
    }
  }

}

class CheckboxWidgetAnnotationElement extends WidgetAnnotationElement {
  constructor(parameters) {
    super(parameters, {
      isRenderable: parameters.renderInteractiveForms
    });
  }

  render() {
    const storage = this.annotationStorage;
    const data = this.data;
    const id = data.id;
    let value = storage.getValue(id, {
      value: data.fieldValue && (data.exportValue && data.exportValue === data.fieldValue || !data.exportValue && data.fieldValue !== "Off")
    }).value;

    if (typeof value === "string") {
      // The value has been changed through js and set in annotationStorage.
      value = value !== "Off";
      storage.setValue(id, {
        value
      });
    }

    this.container.className = "buttonWidgetAnnotation checkBox";
    const element = document.createElement("input");
    element.disabled = data.readOnly;
    element.type = "checkbox";
    element.name = this.data.fieldName;

    if (value) {
      element.setAttribute("checked", true);
    }

    element.setAttribute("id", id);
    element.addEventListener("change", function (event) {
      const name = event.target.name;

      for (const checkbox of document.getElementsByName(name)) {
        if (checkbox !== event.target) {
          checkbox.checked = false;
          storage.setValue(checkbox.parentNode.getAttribute("data-annotation-id"), {
            value: false
          });
        }
      }

      storage.setValue(id, {
        value: event.target.checked
      });
    });

    if (this.enableScripting && this.hasJSActions) {
      element.addEventListener("updatefromsandbox", jsEvent => {
        const actions = {
          value(event) {
            event.target.checked = event.detail.value !== "Off";
            storage.setValue(id, {
              value: event.target.checked
            });
          }

        };

        this._dispatchEventFromSandbox(actions, jsEvent);
      });

      this._setEventListeners(element, [["change", "Validate"], ["change", "Action"], ["focus", "Focus"], ["blur", "Blur"], ["mousedown", "Mouse Down"], ["mouseenter", "Mouse Enter"], ["mouseleave", "Mouse Exit"], ["mouseup", "Mouse Up"]], event => event.target.checked);
    }

    this.container.appendChild(element);
    return this.container;
  }

}

class RadioButtonWidgetAnnotationElement extends WidgetAnnotationElement {
  constructor(parameters) {
    super(parameters, {
      isRenderable: parameters.renderInteractiveForms
    });
  }

  render() {
    this.container.className = "buttonWidgetAnnotation radioButton";
    const storage = this.annotationStorage;
    const data = this.data;
    const id = data.id;
    let value = storage.getValue(id, {
      value: data.fieldValue === data.buttonValue
    }).value;

    if (typeof value === "string") {
      // The value has been changed through js and set in annotationStorage.
      value = value !== data.buttonValue;
      storage.setValue(id, {
        value
      });
    }

    const element = document.createElement("input");
    element.disabled = data.readOnly;
    element.type = "radio";
    element.name = data.fieldName;

    if (value) {
      element.setAttribute("checked", true);
    }

    element.setAttribute("id", id);
    element.addEventListener("change", function (event) {
      const {
        target
      } = event;

      for (const radio of document.getElementsByName(target.name)) {
        if (radio !== target) {
          storage.setValue(radio.getAttribute("id"), {
            value: false
          });
        }
      }

      storage.setValue(id, {
        value: target.checked
      });
    });

    if (this.enableScripting && this.hasJSActions) {
      const pdfButtonValue = data.buttonValue;
      element.addEventListener("updatefromsandbox", jsEvent => {
        const actions = {
          value(event) {
            const checked = pdfButtonValue === event.detail.value;

            for (const radio of document.getElementsByName(event.target.name)) {
              const radioId = radio.getAttribute("id");
              radio.checked = radioId === id && checked;
              storage.setValue(radioId, {
                value: radio.checked
              });
            }
          }

        };

        this._dispatchEventFromSandbox(actions, jsEvent);
      });

      this._setEventListeners(element, [["change", "Validate"], ["change", "Action"], ["focus", "Focus"], ["blur", "Blur"], ["mousedown", "Mouse Down"], ["mouseenter", "Mouse Enter"], ["mouseleave", "Mouse Exit"], ["mouseup", "Mouse Up"]], event => event.target.checked);
    }

    this.container.appendChild(element);
    return this.container;
  }

}

class PushButtonWidgetAnnotationElement extends LinkAnnotationElement {
  render() {
    // The rendering and functionality of a push button widget annotation is
    // equal to that of a link annotation, but may have more functionality, such
    // as performing actions on form fields (resetting, submitting, et cetera).
    const container = super.render();
    container.className = "buttonWidgetAnnotation pushButton";

    if (this.data.alternativeText) {
      container.title = this.data.alternativeText;
    }

    return container;
  }

}

class ChoiceWidgetAnnotationElement extends WidgetAnnotationElement {
  constructor(parameters) {
    super(parameters, {
      isRenderable: parameters.renderInteractiveForms
    });
  }

  render() {
    this.container.className = "choiceWidgetAnnotation";
    const storage = this.annotationStorage;
    const id = this.data.id; // For printing/saving we currently only support choice widgets with one
    // option selection. Therefore, listboxes (#12189) and comboboxes (#12224)
    // are not properly printed/saved yet, so we only store the first item in
    // the field value array instead of the entire array. Once support for those
    // two field types is implemented, we should use the same pattern as the
    // other interactive widgets where the return value of `getValue`
    // is used and the full array of field values is stored.

    storage.getValue(id, {
      value: this.data.fieldValue.length > 0 ? this.data.fieldValue[0] : undefined
    });
    const selectElement = document.createElement("select");
    selectElement.disabled = this.data.readOnly;
    selectElement.name = this.data.fieldName;
    selectElement.setAttribute("id", id);

    if (!this.data.combo) {
      // List boxes have a size and (optionally) multiple selection.
      selectElement.size = this.data.options.length;

      if (this.data.multiSelect) {
        selectElement.multiple = true;
      }
    } // Insert the options into the choice field.


    for (const option of this.data.options) {
      const optionElement = document.createElement("option");
      optionElement.textContent = option.displayValue;
      optionElement.value = option.exportValue;

      if (this.data.fieldValue.includes(option.exportValue)) {
        optionElement.setAttribute("selected", true);
      }

      selectElement.appendChild(optionElement);
    }

    const getValue = (event, isExport) => {
      const name = isExport ? "value" : "textContent";
      const options = event.target.options;

      if (!event.target.multiple) {
        return options.selectedIndex === -1 ? null : options[options.selectedIndex][name];
      }

      return Array.prototype.filter.call(options, option => option.selected).map(option => option[name]);
    };

    const getItems = event => {
      const options = event.target.options;
      return Array.prototype.map.call(options, option => {
        return {
          displayValue: option.textContent,
          exportValue: option.value
        };
      });
    };

    if (this.enableScripting && this.hasJSActions) {
      selectElement.addEventListener("updatefromsandbox", jsEvent => {
        const actions = {
          value(event) {
            const options = selectElement.options;
            const value = event.detail.value;
            const values = new Set(Array.isArray(value) ? value : [value]);
            Array.prototype.forEach.call(options, option => {
              option.selected = values.has(option.value);
            });
            storage.setValue(id, {
              value: getValue(event,
              /* isExport */
              true)
            });
          },

          multipleSelection(event) {
            selectElement.multiple = true;
          },

          remove(event) {
            const options = selectElement.options;
            const index = event.detail.remove;
            options[index].selected = false;
            selectElement.remove(index);

            if (options.length > 0) {
              const i = Array.prototype.findIndex.call(options, option => option.selected);

              if (i === -1) {
                options[0].selected = true;
              }
            }

            storage.setValue(id, {
              value: getValue(event,
              /* isExport */
              true),
              items: getItems(event)
            });
          },

          clear(event) {
            while (selectElement.length !== 0) {
              selectElement.remove(0);
            }

            storage.setValue(id, {
              value: null,
              items: []
            });
          },

          insert(event) {
            const {
              index,
              displayValue,
              exportValue
            } = event.detail.insert;
            const optionElement = document.createElement("option");
            optionElement.textContent = displayValue;
            optionElement.value = exportValue;
            selectElement.insertBefore(optionElement, selectElement.children[index]);
            storage.setValue(id, {
              value: getValue(event,
              /* isExport */
              true),
              items: getItems(event)
            });
          },

          items(event) {
            const {
              items
            } = event.detail;

            while (selectElement.length !== 0) {
              selectElement.remove(0);
            }

            for (const item of items) {
              const {
                displayValue,
                exportValue
              } = item;
              const optionElement = document.createElement("option");
              optionElement.textContent = displayValue;
              optionElement.value = exportValue;
              selectElement.appendChild(optionElement);
            }

            if (selectElement.options.length > 0) {
              selectElement.options[0].selected = true;
            }

            storage.setValue(id, {
              value: getValue(event,
              /* isExport */
              true),
              items: getItems(event)
            });
          },

          indices(event) {
            const indices = new Set(event.detail.indices);
            const options = event.target.options;
            Array.prototype.forEach.call(options, (option, i) => {
              option.selected = indices.has(i);
            });
            storage.setValue(id, {
              value: getValue(event,
              /* isExport */
              true)
            });
          },

          editable(event) {
            event.target.disabled = !event.detail.editable;
          }

        };

        this._dispatchEventFromSandbox(actions, jsEvent);
      });
      selectElement.addEventListener("input", event => {
        var _this$linkService$eve7;

        const exportValue = getValue(event,
        /* isExport */
        true);
        const value = getValue(event,
        /* isExport */
        false);
        storage.setValue(id, {
          value: exportValue
        });
        (_this$linkService$eve7 = this.linkService.eventBus) === null || _this$linkService$eve7 === void 0 ? void 0 : _this$linkService$eve7.dispatch("dispatcheventinsandbox", {
          source: this,
          detail: {
            id,
            name: "Keystroke",
            value,
            changeEx: exportValue,
            willCommit: true,
            commitKey: 1,
            keyDown: false
          }
        });
      });

      this._setEventListeners(selectElement, [["focus", "Focus"], ["blur", "Blur"], ["mousedown", "Mouse Down"], ["mouseenter", "Mouse Enter"], ["mouseleave", "Mouse Exit"], ["mouseup", "Mouse Up"], ["input", "Action"]], event => event.target.checked);
    } else {
      selectElement.addEventListener("input", function (event) {
        storage.setValue(id, {
          value: getValue(event)
        });
      });
    }

    this.container.appendChild(selectElement);
    return this.container;
  }

}

class PopupAnnotationElement extends AnnotationElement {
  constructor(parameters) {
    const isRenderable = !!(parameters.data.title || parameters.data.contents);
    super(parameters, {
      isRenderable
    });
  }

  render() {
    // Do not render popup annotations for parent elements with these types as
    // they create the popups themselves (because of custom trigger divs).
    const IGNORE_TYPES = ["Line", "Square", "Circle", "PolyLine", "Polygon", "Ink"];
    this.container.className = "popupAnnotation";

    if (IGNORE_TYPES.includes(this.data.parentType)) {
      return this.container;
    }

    const selector = `[data-annotation-id="${this.data.parentId}"]`;
    const parentElements = this.layer.querySelectorAll(selector);

    if (parentElements.length === 0) {
      return this.container;
    }

    const popup = new PopupElement({
      container: this.container,
      trigger: Array.from(parentElements),
      color: this.data.color,
      title: this.data.title,
      modificationDate: this.data.modificationDate,
      contents: this.data.contents
    }); // Position the popup next to the parent annotation's container.
    // PDF viewers ignore a popup annotation's rectangle.

    const page = this.page;
    const rect = Util.normalizeRect([this.data.parentRect[0], page.view[3] - this.data.parentRect[1] + page.view[1], this.data.parentRect[2], page.view[3] - this.data.parentRect[3] + page.view[1]]);
    const popupLeft = rect[0] + this.data.parentRect[2] - this.data.parentRect[0];
    const popupTop = rect[1];
    this.container.style.transformOrigin = `${-popupLeft}px ${-popupTop}px`;
    this.container.style.left = `${popupLeft}px`;
    this.container.style.top = `${popupTop}px`;
    this.container.appendChild(popup.render());
    return this.container;
  }

}

class PopupElement {
  constructor(parameters) {
    this.container = parameters.container;
    this.trigger = parameters.trigger;
    this.color = parameters.color;
    this.title = parameters.title;
    this.modificationDate = parameters.modificationDate;
    this.contents = parameters.contents;
    this.hideWrapper = parameters.hideWrapper || false;
    this.pinned = false;
  }

  render() {
    const BACKGROUND_ENLIGHT = 0.7;
    const wrapper = document.createElement("div");
    wrapper.className = "popupWrapper"; // For Popup annotations we hide the entire section because it contains
    // only the popup. However, for Text annotations without a separate Popup
    // annotation, we cannot hide the entire container as the image would
    // disappear too. In that special case, hiding the wrapper suffices.

    this.hideElement = this.hideWrapper ? wrapper : this.container;
    this.hideElement.hidden = true;
    const popup = document.createElement("div");
    popup.className = "popup";
    const color = this.color;

    if (color) {
      // Enlighten the color.
      const r = BACKGROUND_ENLIGHT * (255 - color[0]) + color[0];
      const g = BACKGROUND_ENLIGHT * (255 - color[1]) + color[1];
      const b = BACKGROUND_ENLIGHT * (255 - color[2]) + color[2];
      popup.style.backgroundColor = Util.makeHexColor(r | 0, g | 0, b | 0);
    }

    const title = document.createElement("h1");
    title.textContent = this.title;
    popup.appendChild(title); // The modification date is shown in the popup instead of the creation
    // date if it is available and can be parsed correctly, which is
    // consistent with other viewers such as Adobe Acrobat.

    const dateObject = PDFDateString.toDateObject(this.modificationDate);

    if (dateObject) {
      const modificationDate = document.createElement("span");
      modificationDate.textContent = "{{date}}, {{time}}";
      modificationDate.dataset.l10nId = "annotation_date_string";
      modificationDate.dataset.l10nArgs = JSON.stringify({
        date: dateObject.toLocaleDateString(),
        time: dateObject.toLocaleTimeString()
      });
      popup.appendChild(modificationDate);
    }

    const contents = this._formatContents(this.contents);

    popup.appendChild(contents);

    if (!Array.isArray(this.trigger)) {
      this.trigger = [this.trigger];
    } // Attach the event listeners to the trigger element.


    for (const element of this.trigger) {
      element.addEventListener("click", this._toggle.bind(this));
      element.addEventListener("mouseover", this._show.bind(this, false));
      element.addEventListener("mouseout", this._hide.bind(this, false));
    }

    popup.addEventListener("click", this._hide.bind(this, true));
    wrapper.appendChild(popup);
    return wrapper;
  }
  /**
   * Format the contents of the popup by adding newlines where necessary.
   *
   * @private
   * @param {string} contents
   * @memberof PopupElement
   * @returns {HTMLParagraphElement}
   */


  _formatContents(contents) {
    const p = document.createElement("p");
    const lines = contents.split(/(?:\r\n?|\n)/);

    for (let i = 0, ii = lines.length; i < ii; ++i) {
      const line = lines[i];
      p.appendChild(document.createTextNode(line));

      if (i < ii - 1) {
        p.appendChild(document.createElement("br"));
      }
    }

    return p;
  }
  /**
   * Toggle the visibility of the popup.
   *
   * @private
   * @memberof PopupElement
   */


  _toggle() {
    if (this.pinned) {
      this._hide(true);
    } else {
      this._show(true);
    }
  }
  /**
   * Show the popup.
   *
   * @private
   * @param {boolean} pin
   * @memberof PopupElement
   */


  _show(pin = false) {
    if (pin) {
      this.pinned = true;
    }

    if (this.hideElement.hidden) {
      this.hideElement.hidden = false;
      this.container.style.zIndex += 1;
    }
  }
  /**
   * Hide the popup.
   *
   * @private
   * @param {boolean} unpin
   * @memberof PopupElement
   */


  _hide(unpin = true) {
    if (unpin) {
      this.pinned = false;
    }

    if (!this.hideElement.hidden && !this.pinned) {
      this.hideElement.hidden = true;
      this.container.style.zIndex -= 1;
    }
  }

}

class FreeTextAnnotationElement extends AnnotationElement {
  constructor(parameters) {
    const isRenderable = !!(parameters.data.hasPopup || parameters.data.title || parameters.data.contents);
    super(parameters, {
      isRenderable,
      ignoreBorder: true
    });
  }

  render() {
    this.container.className = "freeTextAnnotation";

    if (!this.data.hasPopup) {
      this._createPopup(null, this.data);
    }

    return this.container;
  }

}

class LineAnnotationElement extends AnnotationElement {
  constructor(parameters) {
    const isRenderable = !!(parameters.data.hasPopup || parameters.data.title || parameters.data.contents);
    super(parameters, {
      isRenderable,
      ignoreBorder: true
    });
  }

  render() {
    this.container.className = "lineAnnotation"; // Create an invisible line with the same starting and ending coordinates
    // that acts as the trigger for the popup. Only the line itself should
    // trigger the popup, not the entire container.

    const data = this.data;
    const width = data.rect[2] - data.rect[0];
    const height = data.rect[3] - data.rect[1];
    const svg = this.svgFactory.create(width, height); // PDF coordinates are calculated from a bottom left origin, so transform
    // the line coordinates to a top left origin for the SVG element.

    const line = this.svgFactory.createElement("svg:line");
    line.setAttribute("x1", data.rect[2] - data.lineCoordinates[0]);
    line.setAttribute("y1", data.rect[3] - data.lineCoordinates[1]);
    line.setAttribute("x2", data.rect[2] - data.lineCoordinates[2]);
    line.setAttribute("y2", data.rect[3] - data.lineCoordinates[3]); // Ensure that the 'stroke-width' is always non-zero, since otherwise it
    // won't be possible to open/close the popup (note e.g. issue 11122).

    line.setAttribute("stroke-width", data.borderStyle.width || 1);
    line.setAttribute("stroke", "transparent");
    svg.appendChild(line);
    this.container.append(svg); // Create the popup ourselves so that we can bind it to the line instead
    // of to the entire container (which is the default).

    this._createPopup(line, data);

    return this.container;
  }

}

class SquareAnnotationElement extends AnnotationElement {
  constructor(parameters) {
    const isRenderable = !!(parameters.data.hasPopup || parameters.data.title || parameters.data.contents);
    super(parameters, {
      isRenderable,
      ignoreBorder: true
    });
  }

  render() {
    this.container.className = "squareAnnotation"; // Create an invisible square with the same rectangle that acts as the
    // trigger for the popup. Only the square itself should trigger the
    // popup, not the entire container.

    const data = this.data;
    const width = data.rect[2] - data.rect[0];
    const height = data.rect[3] - data.rect[1];
    const svg = this.svgFactory.create(width, height); // The browser draws half of the borders inside the square and half of
    // the borders outside the square by default. This behavior cannot be
    // changed programmatically, so correct for that here.

    const borderWidth = data.borderStyle.width;
    const square = this.svgFactory.createElement("svg:rect");
    square.setAttribute("x", borderWidth / 2);
    square.setAttribute("y", borderWidth / 2);
    square.setAttribute("width", width - borderWidth);
    square.setAttribute("height", height - borderWidth); // Ensure that the 'stroke-width' is always non-zero, since otherwise it
    // won't be possible to open/close the popup (note e.g. issue 11122).

    square.setAttribute("stroke-width", borderWidth || 1);
    square.setAttribute("stroke", "transparent");
    square.setAttribute("fill", "none");
    svg.appendChild(square);
    this.container.append(svg); // Create the popup ourselves so that we can bind it to the square instead
    // of to the entire container (which is the default).

    this._createPopup(square, data);

    return this.container;
  }

}

class CircleAnnotationElement extends AnnotationElement {
  constructor(parameters) {
    const isRenderable = !!(parameters.data.hasPopup || parameters.data.title || parameters.data.contents);
    super(parameters, {
      isRenderable,
      ignoreBorder: true
    });
  }

  render() {
    this.container.className = "circleAnnotation"; // Create an invisible circle with the same ellipse that acts as the
    // trigger for the popup. Only the circle itself should trigger the
    // popup, not the entire container.

    const data = this.data;
    const width = data.rect[2] - data.rect[0];
    const height = data.rect[3] - data.rect[1];
    const svg = this.svgFactory.create(width, height); // The browser draws half of the borders inside the circle and half of
    // the borders outside the circle by default. This behavior cannot be
    // changed programmatically, so correct for that here.

    const borderWidth = data.borderStyle.width;
    const circle = this.svgFactory.createElement("svg:ellipse");
    circle.setAttribute("cx", width / 2);
    circle.setAttribute("cy", height / 2);
    circle.setAttribute("rx", width / 2 - borderWidth / 2);
    circle.setAttribute("ry", height / 2 - borderWidth / 2); // Ensure that the 'stroke-width' is always non-zero, since otherwise it
    // won't be possible to open/close the popup (note e.g. issue 11122).

    circle.setAttribute("stroke-width", borderWidth || 1);
    circle.setAttribute("stroke", "transparent");
    circle.setAttribute("fill", "none");
    svg.appendChild(circle);
    this.container.append(svg); // Create the popup ourselves so that we can bind it to the circle instead
    // of to the entire container (which is the default).

    this._createPopup(circle, data);

    return this.container;
  }

}

class PolylineAnnotationElement extends AnnotationElement {
  constructor(parameters) {
    const isRenderable = !!(parameters.data.hasPopup || parameters.data.title || parameters.data.contents);
    super(parameters, {
      isRenderable,
      ignoreBorder: true
    });
    this.containerClassName = "polylineAnnotation";
    this.svgElementName = "svg:polyline";
  }

  render() {
    this.container.className = this.containerClassName; // Create an invisible polyline with the same points that acts as the
    // trigger for the popup. Only the polyline itself should trigger the
    // popup, not the entire container.

    const data = this.data;
    const width = data.rect[2] - data.rect[0];
    const height = data.rect[3] - data.rect[1];
    const svg = this.svgFactory.create(width, height); // Convert the vertices array to a single points string that the SVG
    // polyline element expects ("x1,y1 x2,y2 ..."). PDF coordinates are
    // calculated from a bottom left origin, so transform the polyline
    // coordinates to a top left origin for the SVG element.

    let points = [];

    for (const coordinate of data.vertices) {
      const x = coordinate.x - data.rect[0];
      const y = data.rect[3] - coordinate.y;
      points.push(x + "," + y);
    }

    points = points.join(" ");
    const polyline = this.svgFactory.createElement(this.svgElementName);
    polyline.setAttribute("points", points); // Ensure that the 'stroke-width' is always non-zero, since otherwise it
    // won't be possible to open/close the popup (note e.g. issue 11122).

    polyline.setAttribute("stroke-width", data.borderStyle.width || 1);
    polyline.setAttribute("stroke", "transparent");
    polyline.setAttribute("fill", "none");
    svg.appendChild(polyline);
    this.container.append(svg); // Create the popup ourselves so that we can bind it to the polyline
    // instead of to the entire container (which is the default).

    this._createPopup(polyline, data);

    return this.container;
  }

}

class PolygonAnnotationElement extends PolylineAnnotationElement {
  constructor(parameters) {
    // Polygons are specific forms of polylines, so reuse their logic.
    super(parameters);
    this.containerClassName = "polygonAnnotation";
    this.svgElementName = "svg:polygon";
  }

}

class CaretAnnotationElement extends AnnotationElement {
  constructor(parameters) {
    const isRenderable = !!(parameters.data.hasPopup || parameters.data.title || parameters.data.contents);
    super(parameters, {
      isRenderable,
      ignoreBorder: true
    });
  }

  render() {
    this.container.className = "caretAnnotation";

    if (!this.data.hasPopup) {
      this._createPopup(null, this.data);
    }

    return this.container;
  }

}

class InkAnnotationElement extends AnnotationElement {
  constructor(parameters) {
    const isRenderable = !!(parameters.data.hasPopup || parameters.data.title || parameters.data.contents);
    super(parameters, {
      isRenderable,
      ignoreBorder: true
    });
    this.containerClassName = "inkAnnotation"; // Use the polyline SVG element since it allows us to use coordinates
    // directly and to draw both straight lines and curves.

    this.svgElementName = "svg:polyline";
  }

  render() {
    this.container.className = this.containerClassName; // Create an invisible polyline with the same points that acts as the
    // trigger for the popup.

    const data = this.data;
    const width = data.rect[2] - data.rect[0];
    const height = data.rect[3] - data.rect[1];
    const svg = this.svgFactory.create(width, height);

    for (const inkList of data.inkLists) {
      // Convert the ink list to a single points string that the SVG
      // polyline element expects ("x1,y1 x2,y2 ..."). PDF coordinates are
      // calculated from a bottom left origin, so transform the polyline
      // coordinates to a top left origin for the SVG element.
      let points = [];

      for (const coordinate of inkList) {
        const x = coordinate.x - data.rect[0];
        const y = data.rect[3] - coordinate.y;
        points.push(`${x},${y}`);
      }

      points = points.join(" ");
      const polyline = this.svgFactory.createElement(this.svgElementName);
      polyline.setAttribute("points", points); // Ensure that the 'stroke-width' is always non-zero, since otherwise it
      // won't be possible to open/close the popup (note e.g. issue 11122).

      polyline.setAttribute("stroke-width", data.borderStyle.width || 1);
      polyline.setAttribute("stroke", "transparent");
      polyline.setAttribute("fill", "none"); // Create the popup ourselves so that we can bind it to the polyline
      // instead of to the entire container (which is the default).

      this._createPopup(polyline, data);

      svg.appendChild(polyline);
    }

    this.container.append(svg);
    return this.container;
  }

}

class HighlightAnnotationElement extends AnnotationElement {
  constructor(parameters) {
    const isRenderable = !!(parameters.data.hasPopup || parameters.data.title || parameters.data.contents);
    super(parameters, {
      isRenderable,
      ignoreBorder: true,
      createQuadrilaterals: true
    });
  }

  render() {
    if (!this.data.hasPopup) {
      this._createPopup(null, this.data);
    }

    if (this.quadrilaterals) {
      return this._renderQuadrilaterals("highlightAnnotation");
    }

    this.container.className = "highlightAnnotation";
    return this.container;
  }

}

class UnderlineAnnotationElement extends AnnotationElement {
  constructor(parameters) {
    const isRenderable = !!(parameters.data.hasPopup || parameters.data.title || parameters.data.contents);
    super(parameters, {
      isRenderable,
      ignoreBorder: true,
      createQuadrilaterals: true
    });
  }

  render() {
    if (!this.data.hasPopup) {
      this._createPopup(null, this.data);
    }

    if (this.quadrilaterals) {
      return this._renderQuadrilaterals("underlineAnnotation");
    }

    this.container.className = "underlineAnnotation";
    return this.container;
  }

}

class SquigglyAnnotationElement extends AnnotationElement {
  constructor(parameters) {
    const isRenderable = !!(parameters.data.hasPopup || parameters.data.title || parameters.data.contents);
    super(parameters, {
      isRenderable,
      ignoreBorder: true,
      createQuadrilaterals: true
    });
  }

  render() {
    if (!this.data.hasPopup) {
      this._createPopup(null, this.data);
    }

    if (this.quadrilaterals) {
      return this._renderQuadrilaterals("squigglyAnnotation");
    }

    this.container.className = "squigglyAnnotation";
    return this.container;
  }

}

class StrikeOutAnnotationElement extends AnnotationElement {
  constructor(parameters) {
    const isRenderable = !!(parameters.data.hasPopup || parameters.data.title || parameters.data.contents);
    super(parameters, {
      isRenderable,
      ignoreBorder: true,
      createQuadrilaterals: true
    });
  }

  render() {
    if (!this.data.hasPopup) {
      this._createPopup(null, this.data);
    }

    if (this.quadrilaterals) {
      return this._renderQuadrilaterals("strikeoutAnnotation");
    }

    this.container.className = "strikeoutAnnotation";
    return this.container;
  }

}

class StampAnnotationElement extends AnnotationElement {
  constructor(parameters) {
    const isRenderable = !!(parameters.data.hasPopup || parameters.data.title || parameters.data.contents);
    super(parameters, {
      isRenderable,
      ignoreBorder: true
    });
  }

  render() {
    this.container.className = "stampAnnotation";

    if (!this.data.hasPopup) {
      this._createPopup(null, this.data);
    }

    return this.container;
  }

}

class FileAttachmentAnnotationElement extends AnnotationElement {
  constructor(parameters) {
    var _this$linkService$eve8;

    super(parameters, {
      isRenderable: true
    });
    const {
      filename,
      content
    } = this.data.file;
    this.filename = getFilenameFromUrl(filename);
    this.content = content;
    (_this$linkService$eve8 = this.linkService.eventBus) === null || _this$linkService$eve8 === void 0 ? void 0 : _this$linkService$eve8.dispatch("fileattachmentannotation", {
      source: this,
      id: stringToPDFString(filename),
      filename,
      content
    });
  }

  render() {
    this.container.className = "fileAttachmentAnnotation";
    const trigger = document.createElement("div");
    trigger.style.height = this.container.style.height;
    trigger.style.width = this.container.style.width;
    trigger.addEventListener("dblclick", this._download.bind(this));

    if (!this.data.hasPopup && (this.data.title || this.data.contents)) {
      this._createPopup(trigger, this.data);
    }

    this.container.appendChild(trigger);
    return this.container;
  }
  /**
   * Download the file attachment associated with this annotation.
   *
   * @private
   * @memberof FileAttachmentAnnotationElement
   */


  _download() {
    var _this$downloadManager;

    (_this$downloadManager = this.downloadManager) === null || _this$downloadManager === void 0 ? void 0 : _this$downloadManager.openOrDownloadData(this.container, this.content, this.filename);
  }

}
/**
 * @typedef {Object} AnnotationLayerParameters
 * @property {PageViewport} viewport
 * @property {HTMLDivElement} div
 * @property {Array} annotations
 * @property {PDFPage} page
 * @property {IPDFLinkService} linkService
 * @property {DownloadManager} downloadManager
 * @property {string} [imageResourcesPath] - Path for image resources, mainly
 *   for annotation icons. Include trailing slash.
 * @property {boolean} renderInteractiveForms
 * @property {boolean} [enableScripting] - Enable embedded script execution.
 * @property {boolean} [hasJSActions] - Some fields have JS actions.
 *   The default value is `false`.
 */


class AnnotationLayer {
  /**
   * Render a new annotation layer with all annotation elements.
   *
   * @public
   * @param {AnnotationLayerParameters} parameters
   * @memberof AnnotationLayer
   */
  static render(parameters) {
    const sortedAnnotations = [],
          popupAnnotations = []; // Ensure that Popup annotations are handled last, since they're dependant
    // upon the parent annotation having already been rendered (please refer to
    // the `PopupAnnotationElement.render` method); fixes issue 11362.

    for (const data of parameters.annotations) {
      if (!data) {
        continue;
      }

      if (data.annotationType === AnnotationType.POPUP) {
        popupAnnotations.push(data);
        continue;
      }

      sortedAnnotations.push(data);
    }

    if (popupAnnotations.length) {
      sortedAnnotations.push(...popupAnnotations);
    }

    for (const data of sortedAnnotations) {
      const element = AnnotationElementFactory.create({
        data,
        layer: parameters.div,
        page: parameters.page,
        viewport: parameters.viewport,
        linkService: parameters.linkService,
        downloadManager: parameters.downloadManager,
        imageResourcesPath: parameters.imageResourcesPath || "",
        renderInteractiveForms: parameters.renderInteractiveForms !== false,
        svgFactory: new DOMSVGFactory(),
        annotationStorage: parameters.annotationStorage || new AnnotationStorage(),
        enableScripting: parameters.enableScripting,
        hasJSActions: parameters.hasJSActions,
        mouseState: parameters.mouseState || {
          isDown: false
        }
      });

      if (element.isRenderable) {
        const rendered = element.render();

        if (data.hidden) {
          rendered.style.visibility = "hidden";
        }

        if (Array.isArray(rendered)) {
          for (const renderedElement of rendered) {
            parameters.div.appendChild(renderedElement);
          }
        } else {
          if (element instanceof PopupAnnotationElement) {
            // Popup annotation elements should not be on top of other
            // annotation elements to prevent interfering with mouse events.
            parameters.div.prepend(rendered);
          } else {
            parameters.div.appendChild(rendered);
          }
        }
      }
    }
  }
  /**
   * Update the annotation elements on existing annotation layer.
   *
   * @public
   * @param {AnnotationLayerParameters} parameters
   * @memberof AnnotationLayer
   */


  static update(parameters) {
    const transform = `matrix(${parameters.viewport.transform.join(",")})`;

    for (const data of parameters.annotations) {
      const elements = parameters.div.querySelectorAll(`[data-annotation-id="${data.id}"]`);

      if (elements) {
        for (const element of elements) {
          element.style.transform = transform;
        }
      }
    }

    parameters.div.hidden = false;
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
/**
 * Text layer render parameters.
 *
 * @typedef {Object} TextLayerRenderParameters
 * @property {import("./api").TextContent} [textContent] - Text content to
 *   render (the object is returned by the page's `getTextContent` method).
 * @property {ReadableStream} [textContentStream] - Text content stream to
 *   render (the stream is returned by the page's `streamTextContent` method).
 * @property {HTMLElement} container - HTML element that will contain text runs.
 * @property {import("./display_utils").PageViewport} viewport - The target
 *   viewport to properly layout the text runs.
 * @property {Array<HTMLElement>} [textDivs] - HTML elements that are correspond
 *   to the text items of the textContent input. This is output and shall be
 *   initially be set to empty array.
 * @property {Array<string>} [textContentItemsStr] - Strings that correspond to
 *    the `str` property of the text items of textContent input. This is output
 *   and shall be initially be set to empty array.
 * @property {number} [timeout] - Delay in milliseconds before rendering of the
 *   text runs occurs.
 * @property {boolean} [enhanceTextSelection] - Whether to turn on the text
 *   selection enhancement.
 */

const MAX_TEXT_DIVS_TO_RENDER = 100000;
const DEFAULT_FONT_SIZE = 30;
const DEFAULT_FONT_ASCENT = 0.8;
const ascentCache = new Map();
const AllWhitespaceRegexp = /^\s+$/g;

function getAscent(fontFamily, ctx) {
  const cachedAscent = ascentCache.get(fontFamily);

  if (cachedAscent) {
    return cachedAscent;
  }

  ctx.save();
  ctx.font = `${DEFAULT_FONT_SIZE}px ${fontFamily}`;
  const metrics = ctx.measureText(""); // Both properties aren't available by default in Firefox.

  let ascent = metrics.fontBoundingBoxAscent;
  let descent = Math.abs(metrics.fontBoundingBoxDescent);

  if (ascent) {
    ctx.restore();
    const ratio = ascent / (ascent + descent);
    ascentCache.set(fontFamily, ratio);
    return ratio;
  } // Try basic heuristic to guess ascent/descent.
  // Draw a g with baseline at 0,0 and then get the line
  // number where a pixel has non-null red component (starting
  // from bottom).


  ctx.strokeStyle = "red";
  ctx.clearRect(0, 0, DEFAULT_FONT_SIZE, DEFAULT_FONT_SIZE);
  ctx.strokeText("g", 0, 0);
  let pixels = ctx.getImageData(0, 0, DEFAULT_FONT_SIZE, DEFAULT_FONT_SIZE).data;
  descent = 0;

  for (let i = pixels.length - 1 - 3; i >= 0; i -= 4) {
    if (pixels[i] > 0) {
      descent = Math.ceil(i / 4 / DEFAULT_FONT_SIZE);
      break;
    }
  } // Draw an A with baseline at 0,DEFAULT_FONT_SIZE and then get the line
  // number where a pixel has non-null red component (starting
  // from top).


  ctx.clearRect(0, 0, DEFAULT_FONT_SIZE, DEFAULT_FONT_SIZE);
  ctx.strokeText("A", 0, DEFAULT_FONT_SIZE);
  pixels = ctx.getImageData(0, 0, DEFAULT_FONT_SIZE, DEFAULT_FONT_SIZE).data;
  ascent = 0;

  for (let i = 0, ii = pixels.length; i < ii; i += 4) {
    if (pixels[i] > 0) {
      ascent = DEFAULT_FONT_SIZE - Math.floor(i / 4 / DEFAULT_FONT_SIZE);
      break;
    }
  }

  ctx.restore();

  if (ascent) {
    const ratio = ascent / (ascent + descent);
    ascentCache.set(fontFamily, ratio);
    return ratio;
  }

  ascentCache.set(fontFamily, DEFAULT_FONT_ASCENT);
  return DEFAULT_FONT_ASCENT;
}

function appendText(task, geom, styles, ctx) {
  // Initialize all used properties to keep the caches monomorphic.
  const textDiv = document.createElement("span");
  const textDivProperties = {
    angle: 0,
    canvasWidth: 0,
    hasText: geom.str !== "",
    hasEOL: geom.hasEOL,
    originalTransform: null,
    paddingBottom: 0,
    paddingLeft: 0,
    paddingRight: 0,
    paddingTop: 0,
    scale: 1
  };

  task._textDivs.push(textDiv);

  const tx = Util.transform(task._viewport.transform, geom.transform);
  let angle = Math.atan2(tx[1], tx[0]);
  const style = styles[geom.fontName];

  if (style.vertical) {
    angle += Math.PI / 2;
  }

  const fontHeight = Math.hypot(tx[2], tx[3]);
  const fontAscent = fontHeight * getAscent(style.fontFamily, ctx);
  let left, top;

  if (angle === 0) {
    left = tx[4];
    top = tx[5] - fontAscent;
  } else {
    left = tx[4] + fontAscent * Math.sin(angle);
    top = tx[5] - fontAscent * Math.cos(angle);
  } // Setting the style properties individually, rather than all at once,
  // should be OK since the `textDiv` isn't appended to the document yet.


  textDiv.style.left = `${left}px`;
  textDiv.style.top = `${top}px`;
  textDiv.style.fontSize = `${fontHeight}px`;
  textDiv.style.fontFamily = style.fontFamily; // Keeps screen readers from pausing on every new text span.

  textDiv.setAttribute("role", "presentation");
  textDiv.textContent = geom.str; // geom.dir may be 'ttb' for vertical texts.

  textDiv.dir = geom.dir; // `fontName` is only used by the FontInspector, and we only use `dataset`
  // here to make the font name available in the debugger.

  if (task._fontInspectorEnabled) {
    textDiv.dataset.fontName = geom.fontName;
  }

  if (angle !== 0) {
    textDivProperties.angle = angle * (180 / Math.PI);
  } // We don't bother scaling single-char text divs, because it has very
  // little effect on text highlighting. This makes scrolling on docs with
  // lots of such divs a lot faster.


  let shouldScaleText = false;

  if (geom.str.length > 1 || task._enhanceTextSelection && AllWhitespaceRegexp.test(geom.str)) {
    shouldScaleText = true;
  } else if (geom.transform[0] !== geom.transform[3]) {
    const absScaleX = Math.abs(geom.transform[0]),
          absScaleY = Math.abs(geom.transform[3]); // When the horizontal/vertical scaling differs significantly, also scale
    // even single-char text to improve highlighting (fixes issue11713.pdf).

    if (absScaleX !== absScaleY && Math.max(absScaleX, absScaleY) / Math.min(absScaleX, absScaleY) > 1.5) {
      shouldScaleText = true;
    }
  }

  if (shouldScaleText) {
    if (style.vertical) {
      textDivProperties.canvasWidth = geom.height * task._viewport.scale;
    } else {
      textDivProperties.canvasWidth = geom.width * task._viewport.scale;
    }
  }

  task._textDivProperties.set(textDiv, textDivProperties);

  if (task._textContentStream) {
    task._layoutText(textDiv);
  }

  if (task._enhanceTextSelection && textDivProperties.hasText) {
    let angleCos = 1,
        angleSin = 0;

    if (angle !== 0) {
      angleCos = Math.cos(angle);
      angleSin = Math.sin(angle);
    }

    const divWidth = (style.vertical ? geom.height : geom.width) * task._viewport.scale;
    const divHeight = fontHeight;
    let m, b;

    if (angle !== 0) {
      m = [angleCos, angleSin, -angleSin, angleCos, left, top];
      b = Util.getAxialAlignedBoundingBox([0, 0, divWidth, divHeight], m);
    } else {
      b = [left, top, left + divWidth, top + divHeight];
    }

    task._bounds.push({
      left: b[0],
      top: b[1],
      right: b[2],
      bottom: b[3],
      div: textDiv,
      size: [divWidth, divHeight],
      m
    });
  }
}

function render(task) {
  if (task._canceled) {
    return;
  }

  const textDivs = task._textDivs;
  const capability = task._capability;
  const textDivsLength = textDivs.length; // No point in rendering many divs as it would make the browser
  // unusable even after the divs are rendered.

  if (textDivsLength > MAX_TEXT_DIVS_TO_RENDER) {
    task._renderingDone = true;
    capability.resolve();
    return;
  }

  if (!task._textContentStream) {
    for (let i = 0; i < textDivsLength; i++) {
      task._layoutText(textDivs[i]);
    }
  }

  task._renderingDone = true;
  capability.resolve();
}

function findPositiveMin(ts, offset, count) {
  let result = 0;

  for (let i = 0; i < count; i++) {
    const t = ts[offset++];

    if (t > 0) {
      result = result ? Math.min(t, result) : t;
    }
  }

  return result;
}

function expand(task) {
  const bounds = task._bounds;
  const viewport = task._viewport;
  const expanded = expandBounds(viewport.width, viewport.height, bounds);

  for (let i = 0; i < expanded.length; i++) {
    const div = bounds[i].div;

    const divProperties = task._textDivProperties.get(div);

    if (divProperties.angle === 0) {
      divProperties.paddingLeft = bounds[i].left - expanded[i].left;
      divProperties.paddingTop = bounds[i].top - expanded[i].top;
      divProperties.paddingRight = expanded[i].right - bounds[i].right;
      divProperties.paddingBottom = expanded[i].bottom - bounds[i].bottom;

      task._textDivProperties.set(div, divProperties);

      continue;
    } // Box is rotated -- trying to find padding so rotated div will not
    // exceed its expanded bounds.


    const e = expanded[i],
          b = bounds[i];
    const m = b.m,
          c = m[0],
          s = m[1]; // Finding intersections with expanded box.

    const points = [[0, 0], [0, b.size[1]], [b.size[0], 0], b.size];
    const ts = new Float64Array(64);

    for (let j = 0, jj = points.length; j < jj; j++) {
      const t = Util.applyTransform(points[j], m);
      ts[j + 0] = c && (e.left - t[0]) / c;
      ts[j + 4] = s && (e.top - t[1]) / s;
      ts[j + 8] = c && (e.right - t[0]) / c;
      ts[j + 12] = s && (e.bottom - t[1]) / s;
      ts[j + 16] = s && (e.left - t[0]) / -s;
      ts[j + 20] = c && (e.top - t[1]) / c;
      ts[j + 24] = s && (e.right - t[0]) / -s;
      ts[j + 28] = c && (e.bottom - t[1]) / c;
      ts[j + 32] = c && (e.left - t[0]) / -c;
      ts[j + 36] = s && (e.top - t[1]) / -s;
      ts[j + 40] = c && (e.right - t[0]) / -c;
      ts[j + 44] = s && (e.bottom - t[1]) / -s;
      ts[j + 48] = s && (e.left - t[0]) / s;
      ts[j + 52] = c && (e.top - t[1]) / -c;
      ts[j + 56] = s && (e.right - t[0]) / s;
      ts[j + 60] = c && (e.bottom - t[1]) / -c;
    } // Not based on math, but to simplify calculations, using cos and sin
    // absolute values to not exceed the box (it can but insignificantly).


    const boxScale = 1 + Math.min(Math.abs(c), Math.abs(s));
    divProperties.paddingLeft = findPositiveMin(ts, 32, 16) / boxScale;
    divProperties.paddingTop = findPositiveMin(ts, 48, 16) / boxScale;
    divProperties.paddingRight = findPositiveMin(ts, 0, 16) / boxScale;
    divProperties.paddingBottom = findPositiveMin(ts, 16, 16) / boxScale;

    task._textDivProperties.set(div, divProperties);
  }
}

function expandBounds(width, height, boxes) {
  const bounds = boxes.map(function (box, i) {
    return {
      x1: box.left,
      y1: box.top,
      x2: box.right,
      y2: box.bottom,
      index: i,
      x1New: undefined,
      x2New: undefined
    };
  });
  expandBoundsLTR(width, bounds);
  const expanded = new Array(boxes.length);

  for (const b of bounds) {
    const i = b.index;
    expanded[i] = {
      left: b.x1New,
      top: 0,
      right: b.x2New,
      bottom: 0
    };
  } // Rotating on 90 degrees and extending extended boxes. Reusing the bounds
  // array and objects.


  boxes.map(function (box, i) {
    const e = expanded[i],
          b = bounds[i];
    b.x1 = box.top;
    b.y1 = width - e.right;
    b.x2 = box.bottom;
    b.y2 = width - e.left;
    b.index = i;
    b.x1New = undefined;
    b.x2New = undefined;
  });
  expandBoundsLTR(height, bounds);

  for (const b of bounds) {
    const i = b.index;
    expanded[i].top = b.x1New;
    expanded[i].bottom = b.x2New;
  }

  return expanded;
}

function expandBoundsLTR(width, bounds) {
  // Sorting by x1 coordinate and walk by the bounds in the same order.
  bounds.sort(function (a, b) {
    return a.x1 - b.x1 || a.index - b.index;
  }); // First we see on the horizon is a fake boundary.

  const fakeBoundary = {
    x1: -Infinity,
    y1: -Infinity,
    x2: 0,
    y2: Infinity,
    index: -1,
    x1New: 0,
    x2New: 0
  };
  const horizon = [{
    start: -Infinity,
    end: Infinity,
    boundary: fakeBoundary
  }];

  for (const boundary of bounds) {
    // Searching for the affected part of horizon.
    // TODO red-black tree or simple binary search
    let i = 0;

    while (i < horizon.length && horizon[i].end <= boundary.y1) {
      i++;
    }

    let j = horizon.length - 1;

    while (j >= 0 && horizon[j].start >= boundary.y2) {
      j--;
    }

    let horizonPart, affectedBoundary;
    let q,
        k,
        maxXNew = -Infinity;

    for (q = i; q <= j; q++) {
      horizonPart = horizon[q];
      affectedBoundary = horizonPart.boundary;
      let xNew;

      if (affectedBoundary.x2 > boundary.x1) {
        // In the middle of the previous element, new x shall be at the
        // boundary start. Extending if further if the affected boundary
        // placed on top of the current one.
        xNew = affectedBoundary.index > boundary.index ? affectedBoundary.x1New : boundary.x1;
      } else if (affectedBoundary.x2New === undefined) {
        // We have some space in between, new x in middle will be a fair
        // choice.
        xNew = (affectedBoundary.x2 + boundary.x1) / 2;
      } else {
        // Affected boundary has x2new set, using it as new x.
        xNew = affectedBoundary.x2New;
      }

      if (xNew > maxXNew) {
        maxXNew = xNew;
      }
    } // Set new x1 for current boundary.


    boundary.x1New = maxXNew; // Adjusts new x2 for the affected boundaries.

    for (q = i; q <= j; q++) {
      horizonPart = horizon[q];
      affectedBoundary = horizonPart.boundary;

      if (affectedBoundary.x2New === undefined) {
        // Was not set yet, choosing new x if possible.
        if (affectedBoundary.x2 > boundary.x1) {
          // Current and affected boundaries intersect. If affected boundary
          // is placed on top of the current, shrinking the affected.
          if (affectedBoundary.index > boundary.index) {
            affectedBoundary.x2New = affectedBoundary.x2;
          }
        } else {
          affectedBoundary.x2New = maxXNew;
        }
      } else if (affectedBoundary.x2New > maxXNew) {
        // Affected boundary is touching new x, pushing it back.
        affectedBoundary.x2New = Math.max(maxXNew, affectedBoundary.x2);
      }
    } // Fixing the horizon.


    const changedHorizon = [];
    let lastBoundary = null;

    for (q = i; q <= j; q++) {
      horizonPart = horizon[q];
      affectedBoundary = horizonPart.boundary; // Checking which boundary will be visible.

      const useBoundary = affectedBoundary.x2 > boundary.x2 ? affectedBoundary : boundary;

      if (lastBoundary === useBoundary) {
        // Merging with previous.
        changedHorizon[changedHorizon.length - 1].end = horizonPart.end;
      } else {
        changedHorizon.push({
          start: horizonPart.start,
          end: horizonPart.end,
          boundary: useBoundary
        });
        lastBoundary = useBoundary;
      }
    }

    if (horizon[i].start < boundary.y1) {
      changedHorizon[0].start = boundary.y1;
      changedHorizon.unshift({
        start: horizon[i].start,
        end: boundary.y1,
        boundary: horizon[i].boundary
      });
    }

    if (boundary.y2 < horizon[j].end) {
      changedHorizon[changedHorizon.length - 1].end = boundary.y2;
      changedHorizon.push({
        start: boundary.y2,
        end: horizon[j].end,
        boundary: horizon[j].boundary
      });
    } // Set x2 new of boundary that is no longer visible (see overlapping case
    // above).
    // TODO more efficient, e.g. via reference counting.


    for (q = i; q <= j; q++) {
      horizonPart = horizon[q];
      affectedBoundary = horizonPart.boundary;

      if (affectedBoundary.x2New !== undefined) {
        continue;
      }

      let used = false;

      for (k = i - 1; !used && k >= 0 && horizon[k].start >= affectedBoundary.y1; k--) {
        used = horizon[k].boundary === affectedBoundary;
      }

      for (k = j + 1; !used && k < horizon.length && horizon[k].end <= affectedBoundary.y2; k++) {
        used = horizon[k].boundary === affectedBoundary;
      }

      for (k = 0; !used && k < changedHorizon.length; k++) {
        used = changedHorizon[k].boundary === affectedBoundary;
      }

      if (!used) {
        affectedBoundary.x2New = maxXNew;
      }
    }

    Array.prototype.splice.apply(horizon, [i, j - i + 1].concat(changedHorizon));
  } // Set new x2 for all unset boundaries.


  for (const horizonPart of horizon) {
    const affectedBoundary = horizonPart.boundary;

    if (affectedBoundary.x2New === undefined) {
      affectedBoundary.x2New = Math.max(width, affectedBoundary.x2);
    }
  }
}

class TextLayerRenderTask {
  constructor({
    textContent,
    textContentStream,
    container,
    viewport,
    textDivs,
    textContentItemsStr,
    enhanceTextSelection
  }) {
    var _globalThis$FontInspe;

    this._textContent = textContent;
    this._textContentStream = textContentStream;
    this._container = container;
    this._document = container.ownerDocument;
    this._viewport = viewport;
    this._textDivs = textDivs || [];
    this._textContentItemsStr = textContentItemsStr || [];
    this._enhanceTextSelection = !!enhanceTextSelection;
    this._fontInspectorEnabled = !!((_globalThis$FontInspe = globalThis.FontInspector) !== null && _globalThis$FontInspe !== void 0 && _globalThis$FontInspe.enabled);
    this._reader = null;
    this._layoutTextLastFontSize = null;
    this._layoutTextLastFontFamily = null;
    this._layoutTextCtx = null;
    this._textDivProperties = new WeakMap();
    this._renderingDone = false;
    this._canceled = false;
    this._capability = createPromiseCapability();
    this._renderTimer = null;
    this._bounds = []; // Always clean-up the temporary canvas once rendering is no longer pending.

    this._capability.promise.finally(() => {
      if (this._layoutTextCtx) {
        // Zeroing the width and height cause Firefox to release graphics
        // resources immediately, which can greatly reduce memory consumption.
        this._layoutTextCtx.canvas.width = 0;
        this._layoutTextCtx.canvas.height = 0;
        this._layoutTextCtx = null;
      }
    }).catch(() => {
      /* Avoid "Uncaught promise" messages in the console. */
    });
  }
  /**
   * Promise for textLayer rendering task completion.
   * @type {Promise<void>}
   */


  get promise() {
    return this._capability.promise;
  }
  /**
   * Cancel rendering of the textLayer.
   */


  cancel() {
    this._canceled = true;

    if (this._reader) {
      this._reader.cancel(new AbortException("TextLayer task cancelled."));

      this._reader = null;
    }

    if (this._renderTimer !== null) {
      clearTimeout(this._renderTimer);
      this._renderTimer = null;
    }

    this._capability.reject(new Error("TextLayer task cancelled."));
  }
  /**
   * @private
   */


  _processItems(items, styleCache) {
    for (let i = 0, len = items.length; i < len; i++) {
      if (items[i].str === undefined) {
        if (items[i].type === "beginMarkedContentProps" || items[i].type === "beginMarkedContent") {
          const parent = this._container;
          this._container = document.createElement("span");

          this._container.classList.add("markedContent");

          if (items[i].id !== null) {
            this._container.setAttribute("id", `${items[i].id}`);
          }

          parent.appendChild(this._container);
        } else if (items[i].type === "endMarkedContent") {
          this._container = this._container.parentNode;
        }

        continue;
      }

      this._textContentItemsStr.push(items[i].str);

      appendText(this, items[i], styleCache, this._layoutTextCtx);
    }
  }
  /**
   * @private
   */


  _layoutText(textDiv) {
    const textDivProperties = this._textDivProperties.get(textDiv);

    let transform = "";

    if (textDivProperties.canvasWidth !== 0 && textDivProperties.hasText) {
      const {
        fontSize,
        fontFamily
      } = textDiv.style; // Only build font string and set to context if different from last.

      if (fontSize !== this._layoutTextLastFontSize || fontFamily !== this._layoutTextLastFontFamily) {
        this._layoutTextCtx.font = `${fontSize} ${fontFamily}`;
        this._layoutTextLastFontSize = fontSize;
        this._layoutTextLastFontFamily = fontFamily;
      } // Only measure the width for multi-char text divs, see `appendText`.


      const {
        width
      } = this._layoutTextCtx.measureText(textDiv.textContent);

      if (width > 0) {
        textDivProperties.scale = textDivProperties.canvasWidth / width;
        transform = `scaleX(${textDivProperties.scale})`;
      }
    }

    if (textDivProperties.angle !== 0) {
      transform = `rotate(${textDivProperties.angle}deg) ${transform}`;
    }

    if (transform.length > 0) {
      if (this._enhanceTextSelection) {
        textDivProperties.originalTransform = transform;
      }

      textDiv.style.transform = transform;
    }

    if (textDivProperties.hasText) {
      this._container.appendChild(textDiv);
    }

    if (textDivProperties.hasEOL) {
      const br = document.createElement("br");
      br.setAttribute("role", "presentation");

      this._container.appendChild(br);
    }
  }
  /**
   * @private
   */


  _render(timeout = 0) {
    const capability = createPromiseCapability();
    let styleCache = Object.create(null); // The temporary canvas is used to measure text length in the DOM.

    const canvas = this._document.createElement("canvas");

    canvas.height = canvas.width = DEFAULT_FONT_SIZE;

    if (typeof PDFJSDev === "undefined" || PDFJSDev.test("MOZCENTRAL || GENERIC")) {
      canvas.mozOpaque = true;
    }

    this._layoutTextCtx = canvas.getContext("2d", {
      alpha: false
    });

    if (this._textContent) {
      const textItems = this._textContent.items;
      const textStyles = this._textContent.styles;

      this._processItems(textItems, textStyles);

      capability.resolve();
    } else if (this._textContentStream) {
      const pump = () => {
        this._reader.read().then(({
          value,
          done
        }) => {
          if (done) {
            capability.resolve();
            return;
          }

          Object.assign(styleCache, value.styles);

          this._processItems(value.items, styleCache);

          pump();
        }, capability.reject);
      };

      this._reader = this._textContentStream.getReader();
      pump();
    } else {
      throw new Error('Neither "textContent" nor "textContentStream"' + " parameters specified.");
    }

    capability.promise.then(() => {
      styleCache = null;

      if (!timeout) {
        // Render right away
        render(this);
      } else {
        // Schedule
        this._renderTimer = setTimeout(() => {
          render(this);
          this._renderTimer = null;
        }, timeout);
      }
    }, this._capability.reject);
  }
  /**
   * @param {boolean} [expandDivs]
   */


  expandTextDivs(expandDivs = false) {
    if (!this._enhanceTextSelection || !this._renderingDone) {
      return;
    }

    if (this._bounds !== null) {
      expand(this);
      this._bounds = null;
    }

    const transformBuf = [],
          paddingBuf = [];

    for (let i = 0, ii = this._textDivs.length; i < ii; i++) {
      const div = this._textDivs[i];

      const divProps = this._textDivProperties.get(div);

      if (!divProps.hasText) {
        continue;
      }

      if (expandDivs) {
        transformBuf.length = 0;
        paddingBuf.length = 0;

        if (divProps.originalTransform) {
          transformBuf.push(divProps.originalTransform);
        }

        if (divProps.paddingTop > 0) {
          paddingBuf.push(`${divProps.paddingTop}px`);
          transformBuf.push(`translateY(${-divProps.paddingTop}px)`);
        } else {
          paddingBuf.push(0);
        }

        if (divProps.paddingRight > 0) {
          paddingBuf.push(`${divProps.paddingRight / divProps.scale}px`);
        } else {
          paddingBuf.push(0);
        }

        if (divProps.paddingBottom > 0) {
          paddingBuf.push(`${divProps.paddingBottom}px`);
        } else {
          paddingBuf.push(0);
        }

        if (divProps.paddingLeft > 0) {
          paddingBuf.push(`${divProps.paddingLeft / divProps.scale}px`);
          transformBuf.push(`translateX(${-divProps.paddingLeft / divProps.scale}px)`);
        } else {
          paddingBuf.push(0);
        }

        div.style.padding = paddingBuf.join(" ");

        if (transformBuf.length) {
          div.style.transform = transformBuf.join(" ");
        }
      } else {
        div.style.padding = null;
        div.style.transform = divProps.originalTransform;
      }
    }
  }

}
/**
 * @param {TextLayerRenderParameters} renderParameters
 * @returns {TextLayerRenderTask}
 */


function renderTextLayer(renderParameters) {
  const task = new TextLayerRenderTask({
    textContent: renderParameters.textContent,
    textContentStream: renderParameters.textContentStream,
    container: renderParameters.container,
    viewport: renderParameters.viewport,
    textDivs: renderParameters.textDivs,
    textContentItemsStr: renderParameters.textContentItemsStr,
    enhanceTextSelection: renderParameters.enhanceTextSelection
  });

  task._render(renderParameters.timeout);

  return task;
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
/** @type {any} */

let SVGGraphics = class {
  constructor() {
    unreachable("Not implemented: SVGGraphics");
  }

};

if (typeof PDFJSDev === "undefined" || PDFJSDev.test("!PRODUCTION || GENERIC")) {
  const SVG_DEFAULTS = {
    fontStyle: "normal",
    fontWeight: "normal",
    fillColor: "#000000"
  };
  const XML_NS = "http://www.w3.org/XML/1998/namespace";
  const XLINK_NS = "http://www.w3.org/1999/xlink";
  const LINE_CAP_STYLES = ["butt", "round", "square"];
  const LINE_JOIN_STYLES = ["miter", "round", "bevel"];

  const convertImgDataToPng = function () {
    const PNG_HEADER = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const CHUNK_WRAPPER_SIZE = 12;
    const crcTable = new Int32Array(256);

    for (let i = 0; i < 256; i++) {
      let c = i;

      for (let h = 0; h < 8; h++) {
        if (c & 1) {
          c = 0xedb88320 ^ c >> 1 & 0x7fffffff;
        } else {
          c = c >> 1 & 0x7fffffff;
        }
      }

      crcTable[i] = c;
    }

    function crc32(data, start, end) {
      let crc = -1;

      for (let i = start; i < end; i++) {
        const a = (crc ^ data[i]) & 0xff;
        const b = crcTable[a];
        crc = crc >>> 8 ^ b;
      }

      return crc ^ -1;
    }

    function writePngChunk(type, body, data, offset) {
      let p = offset;
      const len = body.length;
      data[p] = len >> 24 & 0xff;
      data[p + 1] = len >> 16 & 0xff;
      data[p + 2] = len >> 8 & 0xff;
      data[p + 3] = len & 0xff;
      p += 4;
      data[p] = type.charCodeAt(0) & 0xff;
      data[p + 1] = type.charCodeAt(1) & 0xff;
      data[p + 2] = type.charCodeAt(2) & 0xff;
      data[p + 3] = type.charCodeAt(3) & 0xff;
      p += 4;
      data.set(body, p);
      p += body.length;
      const crc = crc32(data, offset + 4, p);
      data[p] = crc >> 24 & 0xff;
      data[p + 1] = crc >> 16 & 0xff;
      data[p + 2] = crc >> 8 & 0xff;
      data[p + 3] = crc & 0xff;
    }

    function adler32(data, start, end) {
      let a = 1;
      let b = 0;

      for (let i = start; i < end; ++i) {
        a = (a + (data[i] & 0xff)) % 65521;
        b = (b + a) % 65521;
      }

      return b << 16 | a;
    }
    /**
     * @param {Uint8Array} literals The input data.
     * @returns {Uint8Array} The DEFLATE-compressed data stream in zlib format.
     *   This is the required format for compressed streams in the PNG format:
     *   http://www.libpng.org/pub/png/spec/1.2/PNG-Compression.html
     */


    function deflateSync(literals) {
      if (!isNodeJS) {
        // zlib is certainly not available outside of Node.js. We can either use
        // the pako library for client-side DEFLATE compression, or use the
        // canvas API of the browser to obtain a more optimal PNG file.
        return deflateSyncUncompressed(literals);
      }

      try {
        // NOTE: This implementation is far from perfect, but already way better
        // than not applying any compression.
        //
        // A better algorithm will try to choose a good predictor/filter and
        // then choose a suitable zlib compression strategy (e.g. 3,Z_RLE).
        //
        // Node v0.11.12 zlib.deflateSync is introduced (and returns a Buffer).
        // Node v3.0.0   Buffer inherits from Uint8Array.
        // Node v8.0.0   zlib.deflateSync accepts Uint8Array as input.
        let input; // eslint-disable-next-line no-undef

        if (parseInt(process.versions.node) >= 8) {
          input = literals;
        } else {
          // eslint-disable-next-line no-undef
          input = Buffer.from(literals);
        }

        const output = __non_webpack_require__("zlib").deflateSync(input, {
          level: 9
        });

        return output instanceof Uint8Array ? output : new Uint8Array(output);
      } catch (e) {
        warn("Not compressing PNG because zlib.deflateSync is unavailable: " + e);
      }

      return deflateSyncUncompressed(literals);
    } // An implementation of DEFLATE with compression level 0 (Z_NO_COMPRESSION).


    function deflateSyncUncompressed(literals) {
      let len = literals.length;
      const maxBlockLength = 0xffff;
      const deflateBlocks = Math.ceil(len / maxBlockLength);
      const idat = new Uint8Array(2 + len + deflateBlocks * 5 + 4);
      let pi = 0;
      idat[pi++] = 0x78; // compression method and flags

      idat[pi++] = 0x9c; // flags

      let pos = 0;

      while (len > maxBlockLength) {
        // writing non-final DEFLATE blocks type 0 and length of 65535
        idat[pi++] = 0x00;
        idat[pi++] = 0xff;
        idat[pi++] = 0xff;
        idat[pi++] = 0x00;
        idat[pi++] = 0x00;
        idat.set(literals.subarray(pos, pos + maxBlockLength), pi);
        pi += maxBlockLength;
        pos += maxBlockLength;
        len -= maxBlockLength;
      } // writing non-final DEFLATE blocks type 0


      idat[pi++] = 0x01;
      idat[pi++] = len & 0xff;
      idat[pi++] = len >> 8 & 0xff;
      idat[pi++] = ~len & 0xffff & 0xff;
      idat[pi++] = (~len & 0xffff) >> 8 & 0xff;
      idat.set(literals.subarray(pos), pi);
      pi += literals.length - pos;
      const adler = adler32(literals, 0, literals.length); // checksum

      idat[pi++] = adler >> 24 & 0xff;
      idat[pi++] = adler >> 16 & 0xff;
      idat[pi++] = adler >> 8 & 0xff;
      idat[pi++] = adler & 0xff;
      return idat;
    }

    function encode(imgData, kind, forceDataSchema, isMask) {
      const width = imgData.width;
      const height = imgData.height;
      let bitDepth, colorType, lineSize;
      const bytes = imgData.data;

      switch (kind) {
        case ImageKind.GRAYSCALE_1BPP:
          colorType = 0;
          bitDepth = 1;
          lineSize = width + 7 >> 3;
          break;

        case ImageKind.RGB_24BPP:
          colorType = 2;
          bitDepth = 8;
          lineSize = width * 3;
          break;

        case ImageKind.RGBA_32BPP:
          colorType = 6;
          bitDepth = 8;
          lineSize = width * 4;
          break;

        default:
          throw new Error("invalid format");
      } // prefix every row with predictor 0


      const literals = new Uint8Array((1 + lineSize) * height);
      let offsetLiterals = 0,
          offsetBytes = 0;

      for (let y = 0; y < height; ++y) {
        literals[offsetLiterals++] = 0; // no prediction

        literals.set(bytes.subarray(offsetBytes, offsetBytes + lineSize), offsetLiterals);
        offsetBytes += lineSize;
        offsetLiterals += lineSize;
      }

      if (kind === ImageKind.GRAYSCALE_1BPP && isMask) {
        // inverting for image masks
        offsetLiterals = 0;

        for (let y = 0; y < height; y++) {
          offsetLiterals++; // skipping predictor

          for (let i = 0; i < lineSize; i++) {
            literals[offsetLiterals++] ^= 0xff;
          }
        }
      }

      const ihdr = new Uint8Array([width >> 24 & 0xff, width >> 16 & 0xff, width >> 8 & 0xff, width & 0xff, height >> 24 & 0xff, height >> 16 & 0xff, height >> 8 & 0xff, height & 0xff, bitDepth, // bit depth
      colorType, // color type
      0x00, // compression method
      0x00, // filter method
      0x00 // interlace method
      ]);
      const idat = deflateSync(literals); // PNG consists of: header, IHDR+data, IDAT+data, and IEND.

      const pngLength = PNG_HEADER.length + CHUNK_WRAPPER_SIZE * 3 + ihdr.length + idat.length;
      const data = new Uint8Array(pngLength);
      let offset = 0;
      data.set(PNG_HEADER, offset);
      offset += PNG_HEADER.length;
      writePngChunk("IHDR", ihdr, data, offset);
      offset += CHUNK_WRAPPER_SIZE + ihdr.length;
      writePngChunk("IDATA", idat, data, offset);
      offset += CHUNK_WRAPPER_SIZE + idat.length;
      writePngChunk("IEND", new Uint8Array(0), data, offset);
      return createObjectURL(data, "image/png", forceDataSchema);
    } // eslint-disable-next-line no-shadow


    return function convertImgDataToPng(imgData, forceDataSchema, isMask) {
      const kind = imgData.kind === undefined ? ImageKind.GRAYSCALE_1BPP : imgData.kind;
      return encode(imgData, kind, forceDataSchema, isMask);
    };
  }();

  class SVGExtraState {
    constructor() {
      this.fontSizeScale = 1;
      this.fontWeight = SVG_DEFAULTS.fontWeight;
      this.fontSize = 0;
      this.textMatrix = IDENTITY_MATRIX;
      this.fontMatrix = FONT_IDENTITY_MATRIX;
      this.leading = 0;
      this.textRenderingMode = TextRenderingMode.FILL;
      this.textMatrixScale = 1; // Current point (in user coordinates)

      this.x = 0;
      this.y = 0; // Start of text line (in text coordinates)

      this.lineX = 0;
      this.lineY = 0; // Character and word spacing

      this.charSpacing = 0;
      this.wordSpacing = 0;
      this.textHScale = 1;
      this.textRise = 0; // Default foreground and background colors

      this.fillColor = SVG_DEFAULTS.fillColor;
      this.strokeColor = "#000000";
      this.fillAlpha = 1;
      this.strokeAlpha = 1;
      this.lineWidth = 1;
      this.lineJoin = "";
      this.lineCap = "";
      this.miterLimit = 0;
      this.dashArray = [];
      this.dashPhase = 0;
      this.dependencies = []; // Clipping

      this.activeClipUrl = null;
      this.clipGroup = null;
      this.maskId = "";
    }

    clone() {
      return Object.create(this);
    }

    setCurrentPoint(x, y) {
      this.x = x;
      this.y = y;
    }

  } // eslint-disable-next-line no-inner-declarations


  function opListToTree(opList) {
    let opTree = [];
    const tmp = [];

    for (const opListElement of opList) {
      if (opListElement.fn === "save") {
        opTree.push({
          fnId: 92,
          fn: "group",
          items: []
        });
        tmp.push(opTree);
        opTree = opTree[opTree.length - 1].items;
        continue;
      }

      if (opListElement.fn === "restore") {
        opTree = tmp.pop();
      } else {
        opTree.push(opListElement);
      }
    }

    return opTree;
  }
  /**
   * Format a float number as a string.
   *
   * @param value {number} - The float number to format.
   * @returns {string}
   */
  // eslint-disable-next-line no-inner-declarations


  function pf(value) {
    if (Number.isInteger(value)) {
      return value.toString();
    }

    const s = value.toFixed(10);
    let i = s.length - 1;

    if (s[i] !== "0") {
      return s;
    } // Remove trailing zeros.


    do {
      i--;
    } while (s[i] === "0");

    return s.substring(0, s[i] === "." ? i : i + 1);
  }
  /**
   * Format a transform matrix as a string. The standard rotation, scale and
   * translation matrices are replaced by their shorter forms, and for
   * identity matrices an empty string is returned to save memory.
   *
   * @param m {Array} - The transform matrix to format.
   * @returns {string}
   */
  // eslint-disable-next-line no-inner-declarations


  function pm(m) {
    if (m[4] === 0 && m[5] === 0) {
      if (m[1] === 0 && m[2] === 0) {
        if (m[0] === 1 && m[3] === 1) {
          return "";
        }

        return `scale(${pf(m[0])} ${pf(m[3])})`;
      }

      if (m[0] === m[3] && m[1] === -m[2]) {
        const a = Math.acos(m[0]) * 180 / Math.PI;
        return `rotate(${pf(a)})`;
      }
    } else {
      if (m[0] === 1 && m[1] === 0 && m[2] === 0 && m[3] === 1) {
        return `translate(${pf(m[4])} ${pf(m[5])})`;
      }
    }

    return `matrix(${pf(m[0])} ${pf(m[1])} ${pf(m[2])} ${pf(m[3])} ${pf(m[4])} ` + `${pf(m[5])})`;
  } // The counts below are relevant for all pages, so they have to be global
  // instead of being members of `SVGGraphics` (which is recreated for
  // each page).


  let clipCount = 0;
  let maskCount = 0;
  let shadingCount = 0;
  SVGGraphics = class {
    constructor(commonObjs, objs, forceDataSchema = false) {
      this.svgFactory = new DOMSVGFactory();
      this.current = new SVGExtraState();
      this.transformMatrix = IDENTITY_MATRIX; // Graphics state matrix

      this.transformStack = [];
      this.extraStack = [];
      this.commonObjs = commonObjs;
      this.objs = objs;
      this.pendingClip = null;
      this.pendingEOFill = false;
      this.embedFonts = false;
      this.embeddedFonts = Object.create(null);
      this.cssStyle = null;
      this.forceDataSchema = !!forceDataSchema; // In `src/shared/util.js` the operator names are mapped to IDs.
      // The list below represents the reverse of that, i.e., it maps IDs
      // to operator names.

      this._operatorIdMapping = [];

      for (const op in OPS) {
        this._operatorIdMapping[OPS[op]] = op;
      }
    }

    save() {
      this.transformStack.push(this.transformMatrix);
      const old = this.current;
      this.extraStack.push(old);
      this.current = old.clone();
    }

    restore() {
      this.transformMatrix = this.transformStack.pop();
      this.current = this.extraStack.pop();
      this.pendingClip = null;
      this.tgrp = null;
    }

    group(items) {
      this.save();
      this.executeOpTree(items);
      this.restore();
    }

    loadDependencies(operatorList) {
      const fnArray = operatorList.fnArray;
      const argsArray = operatorList.argsArray;

      for (let i = 0, ii = fnArray.length; i < ii; i++) {
        if (fnArray[i] !== OPS.dependency) {
          continue;
        }

        for (const obj of argsArray[i]) {
          const objsPool = obj.startsWith("g_") ? this.commonObjs : this.objs;
          const promise = new Promise(resolve => {
            objsPool.get(obj, resolve);
          });
          this.current.dependencies.push(promise);
        }
      }

      return Promise.all(this.current.dependencies);
    }

    transform(a, b, c, d, e, f) {
      const transformMatrix = [a, b, c, d, e, f];
      this.transformMatrix = Util.transform(this.transformMatrix, transformMatrix);
      this.tgrp = null;
    }

    getSVG(operatorList, viewport) {
      this.viewport = viewport;

      const svgElement = this._initialize(viewport);

      return this.loadDependencies(operatorList).then(() => {
        this.transformMatrix = IDENTITY_MATRIX;
        this.executeOpTree(this.convertOpList(operatorList));
        return svgElement;
      });
    }

    convertOpList(operatorList) {
      const operatorIdMapping = this._operatorIdMapping;
      const argsArray = operatorList.argsArray;
      const fnArray = operatorList.fnArray;
      const opList = [];

      for (let i = 0, ii = fnArray.length; i < ii; i++) {
        const fnId = fnArray[i];
        opList.push({
          fnId,
          fn: operatorIdMapping[fnId],
          args: argsArray[i]
        });
      }

      return opListToTree(opList);
    }

    executeOpTree(opTree) {
      for (const opTreeElement of opTree) {
        const fn = opTreeElement.fn;
        const fnId = opTreeElement.fnId;
        const args = opTreeElement.args;

        switch (fnId | 0) {
          case OPS.beginText:
            this.beginText();
            break;

          case OPS.dependency:
            // Handled in `loadDependencies`, so no warning should be shown.
            break;

          case OPS.setLeading:
            this.setLeading(args);
            break;

          case OPS.setLeadingMoveText:
            this.setLeadingMoveText(args[0], args[1]);
            break;

          case OPS.setFont:
            this.setFont(args);
            break;

          case OPS.showText:
            this.showText(args[0]);
            break;

          case OPS.showSpacedText:
            this.showText(args[0]);
            break;

          case OPS.endText:
            this.endText();
            break;

          case OPS.moveText:
            this.moveText(args[0], args[1]);
            break;

          case OPS.setCharSpacing:
            this.setCharSpacing(args[0]);
            break;

          case OPS.setWordSpacing:
            this.setWordSpacing(args[0]);
            break;

          case OPS.setHScale:
            this.setHScale(args[0]);
            break;

          case OPS.setTextMatrix:
            this.setTextMatrix(args[0], args[1], args[2], args[3], args[4], args[5]);
            break;

          case OPS.setTextRise:
            this.setTextRise(args[0]);
            break;

          case OPS.setTextRenderingMode:
            this.setTextRenderingMode(args[0]);
            break;

          case OPS.setLineWidth:
            this.setLineWidth(args[0]);
            break;

          case OPS.setLineJoin:
            this.setLineJoin(args[0]);
            break;

          case OPS.setLineCap:
            this.setLineCap(args[0]);
            break;

          case OPS.setMiterLimit:
            this.setMiterLimit(args[0]);
            break;

          case OPS.setFillRGBColor:
            this.setFillRGBColor(args[0], args[1], args[2]);
            break;

          case OPS.setStrokeRGBColor:
            this.setStrokeRGBColor(args[0], args[1], args[2]);
            break;

          case OPS.setStrokeColorN:
            this.setStrokeColorN(args);
            break;

          case OPS.setFillColorN:
            this.setFillColorN(args);
            break;

          case OPS.shadingFill:
            this.shadingFill(args[0]);
            break;

          case OPS.setDash:
            this.setDash(args[0], args[1]);
            break;

          case OPS.setRenderingIntent:
            this.setRenderingIntent(args[0]);
            break;

          case OPS.setFlatness:
            this.setFlatness(args[0]);
            break;

          case OPS.setGState:
            this.setGState(args[0]);
            break;

          case OPS.fill:
            this.fill();
            break;

          case OPS.eoFill:
            this.eoFill();
            break;

          case OPS.stroke:
            this.stroke();
            break;

          case OPS.fillStroke:
            this.fillStroke();
            break;

          case OPS.eoFillStroke:
            this.eoFillStroke();
            break;

          case OPS.clip:
            this.clip("nonzero");
            break;

          case OPS.eoClip:
            this.clip("evenodd");
            break;

          case OPS.paintSolidColorImageMask:
            this.paintSolidColorImageMask();
            break;

          case OPS.paintImageXObject:
            this.paintImageXObject(args[0]);
            break;

          case OPS.paintInlineImageXObject:
            this.paintInlineImageXObject(args[0]);
            break;

          case OPS.paintImageMaskXObject:
            this.paintImageMaskXObject(args[0]);
            break;

          case OPS.paintFormXObjectBegin:
            this.paintFormXObjectBegin(args[0], args[1]);
            break;

          case OPS.paintFormXObjectEnd:
            this.paintFormXObjectEnd();
            break;

          case OPS.closePath:
            this.closePath();
            break;

          case OPS.closeStroke:
            this.closeStroke();
            break;

          case OPS.closeFillStroke:
            this.closeFillStroke();
            break;

          case OPS.closeEOFillStroke:
            this.closeEOFillStroke();
            break;

          case OPS.nextLine:
            this.nextLine();
            break;

          case OPS.transform:
            this.transform(args[0], args[1], args[2], args[3], args[4], args[5]);
            break;

          case OPS.constructPath:
            this.constructPath(args[0], args[1]);
            break;

          case OPS.endPath:
            this.endPath();
            break;

          case 92:
            this.group(opTreeElement.items);
            break;

          default:
            warn(`Unimplemented operator ${fn}`);
            break;
        }
      }
    }

    setWordSpacing(wordSpacing) {
      this.current.wordSpacing = wordSpacing;
    }

    setCharSpacing(charSpacing) {
      this.current.charSpacing = charSpacing;
    }

    nextLine() {
      this.moveText(0, this.current.leading);
    }

    setTextMatrix(a, b, c, d, e, f) {
      const current = this.current;
      current.textMatrix = current.lineMatrix = [a, b, c, d, e, f];
      current.textMatrixScale = Math.hypot(a, b);
      current.x = current.lineX = 0;
      current.y = current.lineY = 0;
      current.xcoords = [];
      current.ycoords = [];
      current.tspan = this.svgFactory.createElement("svg:tspan");
      current.tspan.setAttributeNS(null, "font-family", current.fontFamily);
      current.tspan.setAttributeNS(null, "font-size", `${pf(current.fontSize)}px`);
      current.tspan.setAttributeNS(null, "y", pf(-current.y));
      current.txtElement = this.svgFactory.createElement("svg:text");
      current.txtElement.appendChild(current.tspan);
    }

    beginText() {
      const current = this.current;
      current.x = current.lineX = 0;
      current.y = current.lineY = 0;
      current.textMatrix = IDENTITY_MATRIX;
      current.lineMatrix = IDENTITY_MATRIX;
      current.textMatrixScale = 1;
      current.tspan = this.svgFactory.createElement("svg:tspan");
      current.txtElement = this.svgFactory.createElement("svg:text");
      current.txtgrp = this.svgFactory.createElement("svg:g");
      current.xcoords = [];
      current.ycoords = [];
    }

    moveText(x, y) {
      const current = this.current;
      current.x = current.lineX += x;
      current.y = current.lineY += y;
      current.xcoords = [];
      current.ycoords = [];
      current.tspan = this.svgFactory.createElement("svg:tspan");
      current.tspan.setAttributeNS(null, "font-family", current.fontFamily);
      current.tspan.setAttributeNS(null, "font-size", `${pf(current.fontSize)}px`);
      current.tspan.setAttributeNS(null, "y", pf(-current.y));
    }

    showText(glyphs) {
      const current = this.current;
      const font = current.font;
      const fontSize = current.fontSize;

      if (fontSize === 0) {
        return;
      }

      const fontSizeScale = current.fontSizeScale;
      const charSpacing = current.charSpacing;
      const wordSpacing = current.wordSpacing;
      const fontDirection = current.fontDirection;
      const textHScale = current.textHScale * fontDirection;
      const vertical = font.vertical;
      const spacingDir = vertical ? 1 : -1;
      const defaultVMetrics = font.defaultVMetrics;
      const widthAdvanceScale = fontSize * current.fontMatrix[0];
      let x = 0;

      for (const glyph of glyphs) {
        if (glyph === null) {
          // Word break
          x += fontDirection * wordSpacing;
          continue;
        } else if (isNum(glyph)) {
          x += spacingDir * glyph * fontSize / 1000;
          continue;
        }

        const spacing = (glyph.isSpace ? wordSpacing : 0) + charSpacing;
        const character = glyph.fontChar;
        let scaledX, scaledY;
        let width = glyph.width;

        if (vertical) {
          let vx;
          const vmetric = glyph.vmetric || defaultVMetrics;
          vx = glyph.vmetric ? vmetric[1] : width * 0.5;
          vx = -vx * widthAdvanceScale;
          const vy = vmetric[2] * widthAdvanceScale;
          width = vmetric ? -vmetric[0] : width;
          scaledX = vx / fontSizeScale;
          scaledY = (x + vy) / fontSizeScale;
        } else {
          scaledX = x / fontSizeScale;
          scaledY = 0;
        }

        if (glyph.isInFont || font.missingFile) {
          current.xcoords.push(current.x + scaledX);

          if (vertical) {
            current.ycoords.push(-current.y + scaledY);
          }

          current.tspan.textContent += character;
        }

        let charWidth;

        if (vertical) {
          charWidth = width * widthAdvanceScale - spacing * fontDirection;
        } else {
          charWidth = width * widthAdvanceScale + spacing * fontDirection;
        }

        x += charWidth;
      }

      current.tspan.setAttributeNS(null, "x", current.xcoords.map(pf).join(" "));

      if (vertical) {
        current.tspan.setAttributeNS(null, "y", current.ycoords.map(pf).join(" "));
      } else {
        current.tspan.setAttributeNS(null, "y", pf(-current.y));
      }

      if (vertical) {
        current.y -= x;
      } else {
        current.x += x * textHScale;
      }

      current.tspan.setAttributeNS(null, "font-family", current.fontFamily);
      current.tspan.setAttributeNS(null, "font-size", `${pf(current.fontSize)}px`);

      if (current.fontStyle !== SVG_DEFAULTS.fontStyle) {
        current.tspan.setAttributeNS(null, "font-style", current.fontStyle);
      }

      if (current.fontWeight !== SVG_DEFAULTS.fontWeight) {
        current.tspan.setAttributeNS(null, "font-weight", current.fontWeight);
      }

      const fillStrokeMode = current.textRenderingMode & TextRenderingMode.FILL_STROKE_MASK;

      if (fillStrokeMode === TextRenderingMode.FILL || fillStrokeMode === TextRenderingMode.FILL_STROKE) {
        if (current.fillColor !== SVG_DEFAULTS.fillColor) {
          current.tspan.setAttributeNS(null, "fill", current.fillColor);
        }

        if (current.fillAlpha < 1) {
          current.tspan.setAttributeNS(null, "fill-opacity", current.fillAlpha);
        }
      } else if (current.textRenderingMode === TextRenderingMode.ADD_TO_PATH) {
        // Workaround for Firefox: We must set fill="transparent" because
        // fill="none" would generate an empty clipping path.
        current.tspan.setAttributeNS(null, "fill", "transparent");
      } else {
        current.tspan.setAttributeNS(null, "fill", "none");
      }

      if (fillStrokeMode === TextRenderingMode.STROKE || fillStrokeMode === TextRenderingMode.FILL_STROKE) {
        const lineWidthScale = 1 / (current.textMatrixScale || 1);

        this._setStrokeAttributes(current.tspan, lineWidthScale);
      } // Include the text rise in the text matrix since the `pm` function
      // creates the SVG element's `translate` entry (work on a copy to avoid
      // altering the original text matrix).


      let textMatrix = current.textMatrix;

      if (current.textRise !== 0) {
        textMatrix = textMatrix.slice();
        textMatrix[5] += current.textRise;
      }

      current.txtElement.setAttributeNS(null, "transform", `${pm(textMatrix)} scale(${pf(textHScale)}, -1)`);
      current.txtElement.setAttributeNS(XML_NS, "xml:space", "preserve");
      current.txtElement.appendChild(current.tspan);
      current.txtgrp.appendChild(current.txtElement);

      this._ensureTransformGroup().appendChild(current.txtElement);
    }

    setLeadingMoveText(x, y) {
      this.setLeading(-y);
      this.moveText(x, y);
    }

    addFontStyle(fontObj) {
      if (!fontObj.data) {
        throw new Error("addFontStyle: No font data available, " + 'ensure that the "fontExtraProperties" API parameter is set.');
      }

      if (!this.cssStyle) {
        this.cssStyle = this.svgFactory.createElement("svg:style");
        this.cssStyle.setAttributeNS(null, "type", "text/css");
        this.defs.appendChild(this.cssStyle);
      }

      const url = createObjectURL(fontObj.data, fontObj.mimetype, this.forceDataSchema);
      this.cssStyle.textContent += `@font-face { font-family: "${fontObj.loadedName}";` + ` src: url(${url}); }\n`;
    }

    setFont(details) {
      const current = this.current;
      const fontObj = this.commonObjs.get(details[0]);
      let size = details[1];
      current.font = fontObj;

      if (this.embedFonts && !fontObj.missingFile && !this.embeddedFonts[fontObj.loadedName]) {
        this.addFontStyle(fontObj);
        this.embeddedFonts[fontObj.loadedName] = fontObj;
      }

      current.fontMatrix = fontObj.fontMatrix || FONT_IDENTITY_MATRIX;
      let bold = "normal";

      if (fontObj.black) {
        bold = "900";
      } else if (fontObj.bold) {
        bold = "bold";
      }

      const italic = fontObj.italic ? "italic" : "normal";

      if (size < 0) {
        size = -size;
        current.fontDirection = -1;
      } else {
        current.fontDirection = 1;
      }

      current.fontSize = size;
      current.fontFamily = fontObj.loadedName;
      current.fontWeight = bold;
      current.fontStyle = italic;
      current.tspan = this.svgFactory.createElement("svg:tspan");
      current.tspan.setAttributeNS(null, "y", pf(-current.y));
      current.xcoords = [];
      current.ycoords = [];
    }

    endText() {
      var _current$txtElement;

      const current = this.current;

      if (current.textRenderingMode & TextRenderingMode.ADD_TO_PATH_FLAG && (_current$txtElement = current.txtElement) !== null && _current$txtElement !== void 0 && _current$txtElement.hasChildNodes()) {
        // If no glyphs are shown (i.e. no child nodes), no clipping occurs.
        current.element = current.txtElement;
        this.clip("nonzero");
        this.endPath();
      }
    } // Path properties


    setLineWidth(width) {
      if (width > 0) {
        this.current.lineWidth = width;
      }
    }

    setLineCap(style) {
      this.current.lineCap = LINE_CAP_STYLES[style];
    }

    setLineJoin(style) {
      this.current.lineJoin = LINE_JOIN_STYLES[style];
    }

    setMiterLimit(limit) {
      this.current.miterLimit = limit;
    }

    setStrokeAlpha(strokeAlpha) {
      this.current.strokeAlpha = strokeAlpha;
    }

    setStrokeRGBColor(r, g, b) {
      this.current.strokeColor = Util.makeHexColor(r, g, b);
    }

    setFillAlpha(fillAlpha) {
      this.current.fillAlpha = fillAlpha;
    }

    setFillRGBColor(r, g, b) {
      this.current.fillColor = Util.makeHexColor(r, g, b);
      this.current.tspan = this.svgFactory.createElement("svg:tspan");
      this.current.xcoords = [];
      this.current.ycoords = [];
    }

    setStrokeColorN(args) {
      this.current.strokeColor = this._makeColorN_Pattern(args);
    }

    setFillColorN(args) {
      this.current.fillColor = this._makeColorN_Pattern(args);
    }

    shadingFill(args) {
      const width = this.viewport.width;
      const height = this.viewport.height;
      const inv = Util.inverseTransform(this.transformMatrix);
      const bl = Util.applyTransform([0, 0], inv);
      const br = Util.applyTransform([0, height], inv);
      const ul = Util.applyTransform([width, 0], inv);
      const ur = Util.applyTransform([width, height], inv);
      const x0 = Math.min(bl[0], br[0], ul[0], ur[0]);
      const y0 = Math.min(bl[1], br[1], ul[1], ur[1]);
      const x1 = Math.max(bl[0], br[0], ul[0], ur[0]);
      const y1 = Math.max(bl[1], br[1], ul[1], ur[1]);
      const rect = this.svgFactory.createElement("svg:rect");
      rect.setAttributeNS(null, "x", x0);
      rect.setAttributeNS(null, "y", y0);
      rect.setAttributeNS(null, "width", x1 - x0);
      rect.setAttributeNS(null, "height", y1 - y0);
      rect.setAttributeNS(null, "fill", this._makeShadingPattern(args));

      if (this.current.fillAlpha < 1) {
        rect.setAttributeNS(null, "fill-opacity", this.current.fillAlpha);
      }

      this._ensureTransformGroup().appendChild(rect);
    }
    /**
     * @private
     */


    _makeColorN_Pattern(args) {
      if (args[0] === "TilingPattern") {
        return this._makeTilingPattern(args);
      }

      return this._makeShadingPattern(args);
    }
    /**
     * @private
     */


    _makeTilingPattern(args) {
      const color = args[1];
      const operatorList = args[2];
      const matrix = args[3] || IDENTITY_MATRIX;
      const [x0, y0, x1, y1] = args[4];
      const xstep = args[5];
      const ystep = args[6];
      const paintType = args[7];
      const tilingId = `shading${shadingCount++}`;
      const [tx0, ty0, tx1, ty1] = Util.normalizeRect([...Util.applyTransform([x0, y0], matrix), ...Util.applyTransform([x1, y1], matrix)]);
      const [xscale, yscale] = Util.singularValueDecompose2dScale(matrix);
      const txstep = xstep * xscale;
      const tystep = ystep * yscale;
      const tiling = this.svgFactory.createElement("svg:pattern");
      tiling.setAttributeNS(null, "id", tilingId);
      tiling.setAttributeNS(null, "patternUnits", "userSpaceOnUse");
      tiling.setAttributeNS(null, "width", txstep);
      tiling.setAttributeNS(null, "height", tystep);
      tiling.setAttributeNS(null, "x", `${tx0}`);
      tiling.setAttributeNS(null, "y", `${ty0}`); // Save current state.

      const svg = this.svg;
      const transformMatrix = this.transformMatrix;
      const fillColor = this.current.fillColor;
      const strokeColor = this.current.strokeColor;
      const bbox = this.svgFactory.create(tx1 - tx0, ty1 - ty0);
      this.svg = bbox;
      this.transformMatrix = matrix;

      if (paintType === 2) {
        const cssColor = Util.makeHexColor(...color);
        this.current.fillColor = cssColor;
        this.current.strokeColor = cssColor;
      }

      this.executeOpTree(this.convertOpList(operatorList)); // Restore saved state.

      this.svg = svg;
      this.transformMatrix = transformMatrix;
      this.current.fillColor = fillColor;
      this.current.strokeColor = strokeColor;
      tiling.appendChild(bbox.childNodes[0]);
      this.defs.appendChild(tiling);
      return `url(#${tilingId})`;
    }
    /**
     * @private
     */


    _makeShadingPattern(args) {
      switch (args[0]) {
        case "RadialAxial":
          const shadingId = `shading${shadingCount++}`;
          const colorStops = args[3];
          let gradient;

          switch (args[1]) {
            case "axial":
              const point0 = args[4];
              const point1 = args[5];
              gradient = this.svgFactory.createElement("svg:linearGradient");
              gradient.setAttributeNS(null, "id", shadingId);
              gradient.setAttributeNS(null, "gradientUnits", "userSpaceOnUse");
              gradient.setAttributeNS(null, "x1", point0[0]);
              gradient.setAttributeNS(null, "y1", point0[1]);
              gradient.setAttributeNS(null, "x2", point1[0]);
              gradient.setAttributeNS(null, "y2", point1[1]);
              break;

            case "radial":
              const focalPoint = args[4];
              const circlePoint = args[5];
              const focalRadius = args[6];
              const circleRadius = args[7];
              gradient = this.svgFactory.createElement("svg:radialGradient");
              gradient.setAttributeNS(null, "id", shadingId);
              gradient.setAttributeNS(null, "gradientUnits", "userSpaceOnUse");
              gradient.setAttributeNS(null, "cx", circlePoint[0]);
              gradient.setAttributeNS(null, "cy", circlePoint[1]);
              gradient.setAttributeNS(null, "r", circleRadius);
              gradient.setAttributeNS(null, "fx", focalPoint[0]);
              gradient.setAttributeNS(null, "fy", focalPoint[1]);
              gradient.setAttributeNS(null, "fr", focalRadius);
              break;

            default:
              throw new Error(`Unknown RadialAxial type: ${args[1]}`);
          }

          for (const colorStop of colorStops) {
            const stop = this.svgFactory.createElement("svg:stop");
            stop.setAttributeNS(null, "offset", colorStop[0]);
            stop.setAttributeNS(null, "stop-color", colorStop[1]);
            gradient.appendChild(stop);
          }

          this.defs.appendChild(gradient);
          return `url(#${shadingId})`;

        case "Mesh":
          warn("Unimplemented pattern Mesh");
          return null;

        case "Dummy":
          return "hotpink";

        default:
          throw new Error(`Unknown IR type: ${args[0]}`);
      }
    }

    setDash(dashArray, dashPhase) {
      this.current.dashArray = dashArray;
      this.current.dashPhase = dashPhase;
    }

    constructPath(ops, args) {
      const current = this.current;
      let x = current.x,
          y = current.y;
      let d = [];
      let j = 0;

      for (const op of ops) {
        switch (op | 0) {
          case OPS.rectangle:
            x = args[j++];
            y = args[j++];
            const width = args[j++];
            const height = args[j++];
            const xw = x + width;
            const yh = y + height;
            d.push("M", pf(x), pf(y), "L", pf(xw), pf(y), "L", pf(xw), pf(yh), "L", pf(x), pf(yh), "Z");
            break;

          case OPS.moveTo:
            x = args[j++];
            y = args[j++];
            d.push("M", pf(x), pf(y));
            break;

          case OPS.lineTo:
            x = args[j++];
            y = args[j++];
            d.push("L", pf(x), pf(y));
            break;

          case OPS.curveTo:
            x = args[j + 4];
            y = args[j + 5];
            d.push("C", pf(args[j]), pf(args[j + 1]), pf(args[j + 2]), pf(args[j + 3]), pf(x), pf(y));
            j += 6;
            break;

          case OPS.curveTo2:
            d.push("C", pf(x), pf(y), pf(args[j]), pf(args[j + 1]), pf(args[j + 2]), pf(args[j + 3]));
            x = args[j + 2];
            y = args[j + 3];
            j += 4;
            break;

          case OPS.curveTo3:
            x = args[j + 2];
            y = args[j + 3];
            d.push("C", pf(args[j]), pf(args[j + 1]), pf(x), pf(y), pf(x), pf(y));
            j += 4;
            break;

          case OPS.closePath:
            d.push("Z");
            break;
        }
      }

      d = d.join(" ");

      if (current.path && ops.length > 0 && ops[0] !== OPS.rectangle && ops[0] !== OPS.moveTo) {
        // If a path does not start with an OPS.rectangle or OPS.moveTo, it has
        // probably been divided into two OPS.constructPath operators by
        // OperatorList. Append the commands to the previous path element.
        d = current.path.getAttributeNS(null, "d") + d;
      } else {
        current.path = this.svgFactory.createElement("svg:path");

        this._ensureTransformGroup().appendChild(current.path);
      }

      current.path.setAttributeNS(null, "d", d);
      current.path.setAttributeNS(null, "fill", "none"); // Saving a reference in current.element so that it can be addressed
      // in 'fill' and 'stroke'

      current.element = current.path;
      current.setCurrentPoint(x, y);
    }

    endPath() {
      const current = this.current; // Painting operators end a path.

      current.path = null;

      if (!this.pendingClip) {
        return;
      }

      if (!current.element) {
        this.pendingClip = null;
        return;
      } // Add the current path to a clipping path.


      const clipId = `clippath${clipCount++}`;
      const clipPath = this.svgFactory.createElement("svg:clipPath");
      clipPath.setAttributeNS(null, "id", clipId);
      clipPath.setAttributeNS(null, "transform", pm(this.transformMatrix)); // A deep clone is needed when text is used as a clipping path.

      const clipElement = current.element.cloneNode(true);

      if (this.pendingClip === "evenodd") {
        clipElement.setAttributeNS(null, "clip-rule", "evenodd");
      } else {
        clipElement.setAttributeNS(null, "clip-rule", "nonzero");
      }

      this.pendingClip = null;
      clipPath.appendChild(clipElement);
      this.defs.appendChild(clipPath);

      if (current.activeClipUrl) {
        // The previous clipping group content can go out of order -- resetting
        // cached clipGroups.
        current.clipGroup = null;

        for (const prev of this.extraStack) {
          prev.clipGroup = null;
        } // Intersect with the previous clipping path.


        clipPath.setAttributeNS(null, "clip-path", current.activeClipUrl);
      }

      current.activeClipUrl = `url(#${clipId})`;
      this.tgrp = null;
    }

    clip(type) {
      this.pendingClip = type;
    }

    closePath() {
      const current = this.current;

      if (current.path) {
        const d = `${current.path.getAttributeNS(null, "d")}Z`;
        current.path.setAttributeNS(null, "d", d);
      }
    }

    setLeading(leading) {
      this.current.leading = -leading;
    }

    setTextRise(textRise) {
      this.current.textRise = textRise;
    }

    setTextRenderingMode(textRenderingMode) {
      this.current.textRenderingMode = textRenderingMode;
    }

    setHScale(scale) {
      this.current.textHScale = scale / 100;
    }

    setRenderingIntent(intent) {// This operation is ignored since we haven't found a use case for it yet.
    }

    setFlatness(flatness) {// This operation is ignored since we haven't found a use case for it yet.
    }

    setGState(states) {
      for (const [key, value] of states) {
        switch (key) {
          case "LW":
            this.setLineWidth(value);
            break;

          case "LC":
            this.setLineCap(value);
            break;

          case "LJ":
            this.setLineJoin(value);
            break;

          case "ML":
            this.setMiterLimit(value);
            break;

          case "D":
            this.setDash(value[0], value[1]);
            break;

          case "RI":
            this.setRenderingIntent(value);
            break;

          case "FL":
            this.setFlatness(value);
            break;

          case "Font":
            this.setFont(value);
            break;

          case "CA":
            this.setStrokeAlpha(value);
            break;

          case "ca":
            this.setFillAlpha(value);
            break;

          default:
            warn(`Unimplemented graphic state operator ${key}`);
            break;
        }
      }
    }

    fill() {
      const current = this.current;

      if (current.element) {
        current.element.setAttributeNS(null, "fill", current.fillColor);
        current.element.setAttributeNS(null, "fill-opacity", current.fillAlpha);
        this.endPath();
      }
    }

    stroke() {
      const current = this.current;

      if (current.element) {
        this._setStrokeAttributes(current.element);

        current.element.setAttributeNS(null, "fill", "none");
        this.endPath();
      }
    }
    /**
     * @private
     */


    _setStrokeAttributes(element, lineWidthScale = 1) {
      const current = this.current;
      let dashArray = current.dashArray;

      if (lineWidthScale !== 1 && dashArray.length > 0) {
        dashArray = dashArray.map(function (value) {
          return lineWidthScale * value;
        });
      }

      element.setAttributeNS(null, "stroke", current.strokeColor);
      element.setAttributeNS(null, "stroke-opacity", current.strokeAlpha);
      element.setAttributeNS(null, "stroke-miterlimit", pf(current.miterLimit));
      element.setAttributeNS(null, "stroke-linecap", current.lineCap);
      element.setAttributeNS(null, "stroke-linejoin", current.lineJoin);
      element.setAttributeNS(null, "stroke-width", pf(lineWidthScale * current.lineWidth) + "px");
      element.setAttributeNS(null, "stroke-dasharray", dashArray.map(pf).join(" "));
      element.setAttributeNS(null, "stroke-dashoffset", pf(lineWidthScale * current.dashPhase) + "px");
    }

    eoFill() {
      if (this.current.element) {
        this.current.element.setAttributeNS(null, "fill-rule", "evenodd");
      }

      this.fill();
    }

    fillStroke() {
      // Order is important since stroke wants fill to be none.
      // First stroke, then if fill needed, it will be overwritten.
      this.stroke();
      this.fill();
    }

    eoFillStroke() {
      if (this.current.element) {
        this.current.element.setAttributeNS(null, "fill-rule", "evenodd");
      }

      this.fillStroke();
    }

    closeStroke() {
      this.closePath();
      this.stroke();
    }

    closeFillStroke() {
      this.closePath();
      this.fillStroke();
    }

    closeEOFillStroke() {
      this.closePath();
      this.eoFillStroke();
    }

    paintSolidColorImageMask() {
      const rect = this.svgFactory.createElement("svg:rect");
      rect.setAttributeNS(null, "x", "0");
      rect.setAttributeNS(null, "y", "0");
      rect.setAttributeNS(null, "width", "1px");
      rect.setAttributeNS(null, "height", "1px");
      rect.setAttributeNS(null, "fill", this.current.fillColor);

      this._ensureTransformGroup().appendChild(rect);
    }

    paintImageXObject(objId) {
      const imgData = objId.startsWith("g_") ? this.commonObjs.get(objId) : this.objs.get(objId);

      if (!imgData) {
        warn(`Dependent image with object ID ${objId} is not ready yet`);
        return;
      }

      this.paintInlineImageXObject(imgData);
    }

    paintInlineImageXObject(imgData, mask) {
      const width = imgData.width;
      const height = imgData.height;
      const imgSrc = convertImgDataToPng(imgData, this.forceDataSchema, !!mask);
      const cliprect = this.svgFactory.createElement("svg:rect");
      cliprect.setAttributeNS(null, "x", "0");
      cliprect.setAttributeNS(null, "y", "0");
      cliprect.setAttributeNS(null, "width", pf(width));
      cliprect.setAttributeNS(null, "height", pf(height));
      this.current.element = cliprect;
      this.clip("nonzero");
      const imgEl = this.svgFactory.createElement("svg:image");
      imgEl.setAttributeNS(XLINK_NS, "xlink:href", imgSrc);
      imgEl.setAttributeNS(null, "x", "0");
      imgEl.setAttributeNS(null, "y", pf(-height));
      imgEl.setAttributeNS(null, "width", pf(width) + "px");
      imgEl.setAttributeNS(null, "height", pf(height) + "px");
      imgEl.setAttributeNS(null, "transform", `scale(${pf(1 / width)} ${pf(-1 / height)})`);

      if (mask) {
        mask.appendChild(imgEl);
      } else {
        this._ensureTransformGroup().appendChild(imgEl);
      }
    }

    paintImageMaskXObject(imgData) {
      const current = this.current;
      const width = imgData.width;
      const height = imgData.height;
      const fillColor = current.fillColor;
      current.maskId = `mask${maskCount++}`;
      const mask = this.svgFactory.createElement("svg:mask");
      mask.setAttributeNS(null, "id", current.maskId);
      const rect = this.svgFactory.createElement("svg:rect");
      rect.setAttributeNS(null, "x", "0");
      rect.setAttributeNS(null, "y", "0");
      rect.setAttributeNS(null, "width", pf(width));
      rect.setAttributeNS(null, "height", pf(height));
      rect.setAttributeNS(null, "fill", fillColor);
      rect.setAttributeNS(null, "mask", `url(#${current.maskId})`);
      this.defs.appendChild(mask);

      this._ensureTransformGroup().appendChild(rect);

      this.paintInlineImageXObject(imgData, mask);
    }

    paintFormXObjectBegin(matrix, bbox) {
      if (Array.isArray(matrix) && matrix.length === 6) {
        this.transform(matrix[0], matrix[1], matrix[2], matrix[3], matrix[4], matrix[5]);
      }

      if (bbox) {
        const width = bbox[2] - bbox[0];
        const height = bbox[3] - bbox[1];
        const cliprect = this.svgFactory.createElement("svg:rect");
        cliprect.setAttributeNS(null, "x", bbox[0]);
        cliprect.setAttributeNS(null, "y", bbox[1]);
        cliprect.setAttributeNS(null, "width", pf(width));
        cliprect.setAttributeNS(null, "height", pf(height));
        this.current.element = cliprect;
        this.clip("nonzero");
        this.endPath();
      }
    }

    paintFormXObjectEnd() {}
    /**
     * @private
     */


    _initialize(viewport) {
      const svg = this.svgFactory.create(viewport.width, viewport.height); // Create the definitions element.

      const definitions = this.svgFactory.createElement("svg:defs");
      svg.appendChild(definitions);
      this.defs = definitions; // Create the root group element, which acts a container for all other
      // groups and applies the viewport transform.

      const rootGroup = this.svgFactory.createElement("svg:g");
      rootGroup.setAttributeNS(null, "transform", pm(viewport.transform));
      svg.appendChild(rootGroup); // For the construction of the SVG image we are only interested in the
      // root group, so we expose it as the entry point of the SVG image for
      // the other code in this class.

      this.svg = rootGroup;
      return svg;
    }
    /**
     * @private
     */


    _ensureClipGroup() {
      if (!this.current.clipGroup) {
        const clipGroup = this.svgFactory.createElement("svg:g");
        clipGroup.setAttributeNS(null, "clip-path", this.current.activeClipUrl);
        this.svg.appendChild(clipGroup);
        this.current.clipGroup = clipGroup;
      }

      return this.current.clipGroup;
    }
    /**
     * @private
     */


    _ensureTransformGroup() {
      if (!this.tgrp) {
        this.tgrp = this.svgFactory.createElement("svg:g");
        this.tgrp.setAttributeNS(null, "transform", pm(this.transformMatrix));

        if (this.current.activeClipUrl) {
          this._ensureClipGroup().appendChild(this.tgrp);
        } else {
          this.svg.appendChild(this.tgrp);
        }
      }

      return this.tgrp;
    }

  };
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
class XfaLayer {
  static setupStorage(html, id, element, storage, intent) {
    const storedData = storage.getValue(id, {
      value: null
    });

    switch (element.name) {
      case "textarea":
        if (storedData.value !== null) {
          html.textContent = storedData.value;
        }

        if (intent === "print") {
          break;
        }

        html.addEventListener("input", event => {
          storage.setValue(id, {
            value: event.target.value
          });
        });
        break;

      case "input":
        if (element.attributes.type === "radio" || element.attributes.type === "checkbox") {
          if (storedData.value === element.attributes.xfaOn) {
            html.setAttribute("checked", true);
          }

          if (intent === "print") {
            break;
          }

          html.addEventListener("change", event => {
            storage.setValue(id, {
              value: event.target.getAttribute("xfaOn")
            });
          });
        } else {
          if (storedData.value !== null) {
            html.setAttribute("value", storedData.value);
          }

          if (intent === "print") {
            break;
          }

          html.addEventListener("input", event => {
            storage.setValue(id, {
              value: event.target.value
            });
          });
        }

        break;

      case "select":
        if (storedData.value !== null) {
          for (const option of element.children) {
            if (option.attributes.value === storedData.value) {
              option.attributes.selected = true;
            }
          }
        }

        html.addEventListener("input", event => {
          const options = event.target.options;
          const value = options.selectedIndex === -1 ? "" : options[options.selectedIndex].value;
          storage.setValue(id, {
            value
          });
        });
        break;
    }
  }

  static setAttributes(html, element, storage, intent) {
    const {
      attributes
    } = element;

    if (attributes.type === "radio") {
      // Avoid to have a radio group when printing with the same as one
      // already displayed.
      attributes.name = `${attributes.name}-${intent}`;
    }

    for (const [key, value] of Object.entries(attributes)) {
      // We don't need to add dataId in the html object but it can
      // be useful to know its value when writing printing tests:
      // in this case, don't skip dataId to have its value.
      if (value === null || value === undefined || key === "dataId") {
        continue;
      }

      if (key !== "style") {
        if (key === "textContent") {
          html.textContent = value;
        } else if (key === "class") {
          html.setAttribute(key, value.join(" "));
        } else {
          html.setAttribute(key, value);
        }
      } else {
        Object.assign(html.style, value);
      }
    } // Set the value after the others to be sure overwrite
    // any other values.


    if (storage && attributes.dataId) {
      this.setupStorage(html, attributes.dataId, element, storage);
    }
  }

  static render(parameters) {
    const storage = parameters.annotationStorage;
    const root = parameters.xfa;
    const intent = parameters.intent || "display";
    const rootHtml = document.createElement(root.name);

    if (root.attributes) {
      this.setAttributes(rootHtml, root);
    }

    const stack = [[root, -1, rootHtml]];
    const rootDiv = parameters.div;
    rootDiv.appendChild(rootHtml);
    const transform = `matrix(${parameters.viewport.transform.join(",")})`;
    rootDiv.style.transform = transform; // Set defaults.

    rootDiv.setAttribute("class", "xfaLayer xfaFont");

    while (stack.length > 0) {
      var _child$attributes;

      const [parent, i, html] = stack[stack.length - 1];

      if (i + 1 === parent.children.length) {
        stack.pop();
        continue;
      }

      const child = parent.children[++stack[stack.length - 1][1]];

      if (child === null) {
        continue;
      }

      const {
        name
      } = child;

      if (name === "#text") {
        html.appendChild(document.createTextNode(child.value));
        continue;
      }

      let childHtml;

      if (child !== null && child !== void 0 && (_child$attributes = child.attributes) !== null && _child$attributes !== void 0 && _child$attributes.xmlns) {
        childHtml = document.createElementNS(child.attributes.xmlns, name);
      } else {
        childHtml = document.createElement(name);
      }

      html.appendChild(childHtml);

      if (child.attributes) {
        this.setAttributes(childHtml, child, storage, intent);
      }

      if (child.children && child.children.length > 0) {
        stack.push([child, -1, childHtml]);
      } else if (child.value) {
        childHtml.appendChild(document.createTextNode(child.value));
      }
    }
    /**
     * TODO: re-enable that stuff once we've JS implementation.
     * See https://bugzilla.mozilla.org/show_bug.cgi?id=1719465.
     *
     * for (const el of rootDiv.querySelectorAll(
     * ".xfaDisabled input, .xfaDisabled textarea"
     * )) {
     * el.setAttribute("disabled", true);
     * }
     * for (const el of rootDiv.querySelectorAll(
     * ".xfaReadOnly input, .xfaReadOnly textarea"
     * )) {
     * el.setAttribute("readOnly", true);
     * }
     */


    for (const el of rootDiv.querySelectorAll(".xfaNonInteractive input, .xfaNonInteractive textarea")) {
      el.setAttribute("readOnly", true);
    }
  }
  /**
   * Update the xfa layer.
   *
   * @public
   * @param {XfaLayerParameters} parameters
   * @memberof XfaLayer
   */


  static update(parameters) {
    const transform = `matrix(${parameters.viewport.transform.join(",")})`;
    parameters.div.style.transform = transform;
    parameters.div.hidden = false;
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
/* eslint-disable-next-line no-unused-vars */

typeof PDFJSDev !== "undefined" ? PDFJSDev.eval("BUNDLE_VERSION") : void 0;
/* eslint-disable-next-line no-unused-vars */

typeof PDFJSDev !== "undefined" ? PDFJSDev.eval("BUNDLE_BUILD") : void 0;

if (typeof PDFJSDev === "undefined" || !PDFJSDev.test("PRODUCTION")) {
  const streamsPromise = Promise.all([import('./network.js'), import('./fetch_stream.js')]);
  setPDFNetworkStreamFactory(async params => {
    const [{
      PDFNetworkStream
    }, {
      PDFFetchStream
    }] = await streamsPromise;

    if (isValidFetchUrl(params.url)) {
      return new PDFFetchStream(params);
    }

    return new PDFNetworkStream(params);
  });
} else if (PDFJSDev.test("GENERIC || CHROME")) {
  if (PDFJSDev.test("GENERIC") && isNodeJS) {
    const {
      PDFNodeStream
    } = require("./node_stream.js");

    setPDFNetworkStreamFactory(params => {
      return new PDFNodeStream(params);
    });
  } else {
    const {
      PDFNetworkStream
    } = require("./network.js");

    const {
      PDFFetchStream
    } = require("./fetch_stream.js");

    setPDFNetworkStreamFactory(params => {
      if (isValidFetchUrl(params.url)) {
        return new PDFFetchStream(params);
      }

      return new PDFNetworkStream(params);
    });
  }
}

export { AnnotationLayer, GlobalWorkerOptions, LoopbackPort, PDFDataRangeTransport, PDFWorker, SVGGraphics, XfaLayer, build, getDocument, renderTextLayer, version };
