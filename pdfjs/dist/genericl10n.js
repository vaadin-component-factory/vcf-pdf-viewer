import './pdf.js';
import { f as fetchData } from './node_stream2.js';
import './util.js';
import './message_handler.js';

/**
 * The `FluentType` class is the base of Fluent's type system.
 *
 * Fluent types wrap JavaScript values and store additional configuration for
 * them, which can then be used in the `toString` method together with a proper
 * `Intl` formatter.
 */
class FluentType {
    /**
     * Create a `FluentType` instance.
     *
     * @param value The JavaScript value to wrap.
     */
    constructor(value) {
        this.value = value;
    }
    /**
     * Unwrap the raw value stored by this `FluentType`.
     */
    valueOf() {
        return this.value;
    }
}
/**
 * A `FluentType` representing no correct value.
 */
class FluentNone extends FluentType {
    /**
     * Create an instance of `FluentNone` with an optional fallback value.
     * @param value The fallback value of this `FluentNone`.
     */
    constructor(value = "???") {
        super(value);
    }
    /**
     * Format this `FluentNone` to the fallback string.
     */
    toString(scope) {
        return `{${this.value}}`;
    }
}
/**
 * A `FluentType` representing a number.
 *
 * A `FluentNumber` instance stores the number value of the number it
 * represents. It may also store an option bag of options which will be passed
 * to `Intl.NumerFormat` when the `FluentNumber` is formatted to a string.
 */
class FluentNumber extends FluentType {
    /**
     * Create an instance of `FluentNumber` with options to the
     * `Intl.NumberFormat` constructor.
     *
     * @param value The number value of this `FluentNumber`.
     * @param opts Options which will be passed to `Intl.NumberFormat`.
     */
    constructor(value, opts = {}) {
        super(value);
        this.opts = opts;
    }
    /**
     * Format this `FluentNumber` to a string.
     */
    toString(scope) {
        try {
            const nf = scope.memoizeIntlObject(Intl.NumberFormat, this.opts);
            return nf.format(this.value);
        }
        catch (err) {
            scope.reportError(err);
            return this.value.toString(10);
        }
    }
}
/**
 * A `FluentType` representing a date and time.
 *
 * A `FluentDateTime` instance stores the number value of the date it
 * represents, as a numerical timestamp in milliseconds. It may also store an
 * option bag of options which will be passed to `Intl.DateTimeFormat` when the
 * `FluentDateTime` is formatted to a string.
 */
class FluentDateTime extends FluentType {
    /**
     * Create an instance of `FluentDateTime` with options to the
     * `Intl.DateTimeFormat` constructor.
     *
     * @param value The number value of this `FluentDateTime`, in milliseconds.
     * @param opts Options which will be passed to `Intl.DateTimeFormat`.
     */
    constructor(value, opts = {}) {
        super(value);
        this.opts = opts;
    }
    /**
     * Format this `FluentDateTime` to a string.
     */
    toString(scope) {
        try {
            const dtf = scope.memoizeIntlObject(Intl.DateTimeFormat, this.opts);
            return dtf.format(this.value);
        }
        catch (err) {
            scope.reportError(err);
            return new Date(this.value).toISOString();
        }
    }
}

/* global Intl */
/**
 * The maximum number of placeables which can be expanded in a single call to
 * `formatPattern`. The limit protects against the Billion Laughs and Quadratic
 * Blowup attacks. See https://msdn.microsoft.com/en-us/magazine/ee335713.aspx.
 */
const MAX_PLACEABLES = 100;
/** Unicode bidi isolation characters. */
const FSI = "\u2068";
const PDI = "\u2069";
/** Helper: match a variant key to the given selector. */
function match(scope, selector, key) {
    if (key === selector) {
        // Both are strings.
        return true;
    }
    // XXX Consider comparing options too, e.g. minimumFractionDigits.
    if (key instanceof FluentNumber &&
        selector instanceof FluentNumber &&
        key.value === selector.value) {
        return true;
    }
    if (selector instanceof FluentNumber && typeof key === "string") {
        let category = scope
            .memoizeIntlObject(Intl.PluralRules, selector.opts)
            .select(selector.value);
        if (key === category) {
            return true;
        }
    }
    return false;
}
/** Helper: resolve the default variant from a list of variants. */
function getDefault(scope, variants, star) {
    if (variants[star]) {
        return resolvePattern(scope, variants[star].value);
    }
    scope.reportError(new RangeError("No default"));
    return new FluentNone();
}
/** Helper: resolve arguments to a call expression. */
function getArguments(scope, args) {
    const positional = [];
    const named = Object.create(null);
    for (const arg of args) {
        if (arg.type === "narg") {
            named[arg.name] = resolveExpression(scope, arg.value);
        }
        else {
            positional.push(resolveExpression(scope, arg));
        }
    }
    return { positional, named };
}
/** Resolve an expression to a Fluent type. */
function resolveExpression(scope, expr) {
    switch (expr.type) {
        case "str":
            return expr.value;
        case "num":
            return new FluentNumber(expr.value, {
                minimumFractionDigits: expr.precision,
            });
        case "var":
            return resolveVariableReference(scope, expr);
        case "mesg":
            return resolveMessageReference(scope, expr);
        case "term":
            return resolveTermReference(scope, expr);
        case "func":
            return resolveFunctionReference(scope, expr);
        case "select":
            return resolveSelectExpression(scope, expr);
        default:
            return new FluentNone();
    }
}
/** Resolve a reference to a variable. */
function resolveVariableReference(scope, { name }) {
    let arg;
    if (scope.params) {
        // We're inside a TermReference. It's OK to reference undefined parameters.
        if (Object.prototype.hasOwnProperty.call(scope.params, name)) {
            arg = scope.params[name];
        }
        else {
            return new FluentNone(`$${name}`);
        }
    }
    else if (scope.args &&
        Object.prototype.hasOwnProperty.call(scope.args, name)) {
        // We're in the top-level Pattern or inside a MessageReference. Missing
        // variables references produce ReferenceErrors.
        arg = scope.args[name];
    }
    else {
        scope.reportError(new ReferenceError(`Unknown variable: $${name}`));
        return new FluentNone(`$${name}`);
    }
    // Return early if the argument already is an instance of FluentType.
    if (arg instanceof FluentType) {
        return arg;
    }
    // Convert the argument to a Fluent type.
    switch (typeof arg) {
        case "string":
            return arg;
        case "number":
            return new FluentNumber(arg);
        case "object":
            if (arg instanceof Date) {
                return new FluentDateTime(arg.getTime());
            }
        // eslint-disable-next-line no-fallthrough
        default:
            scope.reportError(new TypeError(`Variable type not supported: $${name}, ${typeof arg}`));
            return new FluentNone(`$${name}`);
    }
}
/** Resolve a reference to another message. */
function resolveMessageReference(scope, { name, attr }) {
    const message = scope.bundle._messages.get(name);
    if (!message) {
        scope.reportError(new ReferenceError(`Unknown message: ${name}`));
        return new FluentNone(name);
    }
    if (attr) {
        const attribute = message.attributes[attr];
        if (attribute) {
            return resolvePattern(scope, attribute);
        }
        scope.reportError(new ReferenceError(`Unknown attribute: ${attr}`));
        return new FluentNone(`${name}.${attr}`);
    }
    if (message.value) {
        return resolvePattern(scope, message.value);
    }
    scope.reportError(new ReferenceError(`No value: ${name}`));
    return new FluentNone(name);
}
/** Resolve a call to a Term with key-value arguments. */
function resolveTermReference(scope, { name, attr, args }) {
    const id = `-${name}`;
    const term = scope.bundle._terms.get(id);
    if (!term) {
        scope.reportError(new ReferenceError(`Unknown term: ${id}`));
        return new FluentNone(id);
    }
    if (attr) {
        const attribute = term.attributes[attr];
        if (attribute) {
            // Every TermReference has its own variables.
            scope.params = getArguments(scope, args).named;
            const resolved = resolvePattern(scope, attribute);
            scope.params = null;
            return resolved;
        }
        scope.reportError(new ReferenceError(`Unknown attribute: ${attr}`));
        return new FluentNone(`${id}.${attr}`);
    }
    scope.params = getArguments(scope, args).named;
    const resolved = resolvePattern(scope, term.value);
    scope.params = null;
    return resolved;
}
/** Resolve a call to a Function with positional and key-value arguments. */
function resolveFunctionReference(scope, { name, args }) {
    // Some functions are built-in. Others may be provided by the runtime via
    // the `FluentBundle` constructor.
    let func = scope.bundle._functions[name];
    if (!func) {
        scope.reportError(new ReferenceError(`Unknown function: ${name}()`));
        return new FluentNone(`${name}()`);
    }
    if (typeof func !== "function") {
        scope.reportError(new TypeError(`Function ${name}() is not callable`));
        return new FluentNone(`${name}()`);
    }
    try {
        let resolved = getArguments(scope, args);
        return func(resolved.positional, resolved.named);
    }
    catch (err) {
        scope.reportError(err);
        return new FluentNone(`${name}()`);
    }
}
/** Resolve a select expression to the member object. */
function resolveSelectExpression(scope, { selector, variants, star }) {
    let sel = resolveExpression(scope, selector);
    if (sel instanceof FluentNone) {
        return getDefault(scope, variants, star);
    }
    // Match the selector against keys of each variant, in order.
    for (const variant of variants) {
        const key = resolveExpression(scope, variant.key);
        if (match(scope, sel, key)) {
            return resolvePattern(scope, variant.value);
        }
    }
    return getDefault(scope, variants, star);
}
/** Resolve a pattern (a complex string with placeables). */
function resolveComplexPattern(scope, ptn) {
    if (scope.dirty.has(ptn)) {
        scope.reportError(new RangeError("Cyclic reference"));
        return new FluentNone();
    }
    // Tag the pattern as dirty for the purpose of the current resolution.
    scope.dirty.add(ptn);
    const result = [];
    // Wrap interpolations with Directional Isolate Formatting characters
    // only when the pattern has more than one element.
    const useIsolating = scope.bundle._useIsolating && ptn.length > 1;
    for (const elem of ptn) {
        if (typeof elem === "string") {
            result.push(scope.bundle._transform(elem));
            continue;
        }
        scope.placeables++;
        if (scope.placeables > MAX_PLACEABLES) {
            scope.dirty.delete(ptn);
            // This is a fatal error which causes the resolver to instantly bail out
            // on this pattern. The length check protects against excessive memory
            // usage, and throwing protects against eating up the CPU when long
            // placeables are deeply nested.
            throw new RangeError(`Too many placeables expanded: ${scope.placeables}, ` +
                `max allowed is ${MAX_PLACEABLES}`);
        }
        if (useIsolating) {
            result.push(FSI);
        }
        result.push(resolveExpression(scope, elem).toString(scope));
        if (useIsolating) {
            result.push(PDI);
        }
    }
    scope.dirty.delete(ptn);
    return result.join("");
}
/**
 * Resolve a simple or a complex Pattern to a FluentString
 * (which is really the string primitive).
 */
function resolvePattern(scope, value) {
    // Resolve a simple pattern.
    if (typeof value === "string") {
        return scope.bundle._transform(value);
    }
    return resolveComplexPattern(scope, value);
}

class Scope {
    constructor(bundle, errors, args) {
        /**
         * The Set of patterns already encountered during this resolution.
         * Used to detect and prevent cyclic resolutions.
         * @ignore
         */
        this.dirty = new WeakSet();
        /** A dict of parameters passed to a TermReference. */
        this.params = null;
        /**
         * The running count of placeables resolved so far.
         * Used to detect the Billion Laughs and Quadratic Blowup attacks.
         * @ignore
         */
        this.placeables = 0;
        this.bundle = bundle;
        this.errors = errors;
        this.args = args;
    }
    reportError(error) {
        if (!this.errors || !(error instanceof Error)) {
            throw error;
        }
        this.errors.push(error);
    }
    memoizeIntlObject(ctor, opts) {
        let cache = this.bundle._intls.get(ctor);
        if (!cache) {
            cache = {};
            this.bundle._intls.set(ctor, cache);
        }
        let id = JSON.stringify(opts);
        if (!cache[id]) {
            cache[id] = new ctor(this.bundle.locales, opts);
        }
        return cache[id];
    }
}

/**
 * @overview
 *
 * The FTL resolver ships with a number of functions built-in.
 *
 * Each function take two arguments:
 *   - args - an array of positional args
 *   - opts - an object of key-value args
 *
 * Arguments to functions are guaranteed to already be instances of
 * `FluentValue`.  Functions must return `FluentValues` as well.
 */
function values(opts, allowed) {
    const unwrapped = Object.create(null);
    for (const [name, opt] of Object.entries(opts)) {
        if (allowed.includes(name)) {
            unwrapped[name] = opt.valueOf();
        }
    }
    return unwrapped;
}
const NUMBER_ALLOWED = [
    "unitDisplay",
    "currencyDisplay",
    "useGrouping",
    "minimumIntegerDigits",
    "minimumFractionDigits",
    "maximumFractionDigits",
    "minimumSignificantDigits",
    "maximumSignificantDigits",
];
/**
 * The implementation of the `NUMBER()` builtin available to translations.
 *
 * Translations may call the `NUMBER()` builtin in order to specify formatting
 * options of a number. For example:
 *
 *     pi = The value of π is {NUMBER($pi, maximumFractionDigits: 2)}.
 *
 * The implementation expects an array of `FluentValues` representing the
 * positional arguments, and an object of named `FluentValues` representing the
 * named parameters.
 *
 * The following options are recognized:
 *
 *     unitDisplay
 *     currencyDisplay
 *     useGrouping
 *     minimumIntegerDigits
 *     minimumFractionDigits
 *     maximumFractionDigits
 *     minimumSignificantDigits
 *     maximumSignificantDigits
 *
 * Other options are ignored.
 *
 * @param args The positional arguments passed to this `NUMBER()`.
 * @param opts The named argments passed to this `NUMBER()`.
 */
function NUMBER(args, opts) {
    let arg = args[0];
    if (arg instanceof FluentNone) {
        return new FluentNone(`NUMBER(${arg.valueOf()})`);
    }
    if (arg instanceof FluentNumber) {
        return new FluentNumber(arg.valueOf(), {
            ...arg.opts,
            ...values(opts, NUMBER_ALLOWED),
        });
    }
    if (arg instanceof FluentDateTime) {
        return new FluentNumber(arg.valueOf(), {
            ...values(opts, NUMBER_ALLOWED),
        });
    }
    throw new TypeError("Invalid argument to NUMBER");
}
const DATETIME_ALLOWED = [
    "dateStyle",
    "timeStyle",
    "fractionalSecondDigits",
    "dayPeriod",
    "hour12",
    "weekday",
    "era",
    "year",
    "month",
    "day",
    "hour",
    "minute",
    "second",
    "timeZoneName",
];
/**
 * The implementation of the `DATETIME()` builtin available to translations.
 *
 * Translations may call the `DATETIME()` builtin in order to specify
 * formatting options of a number. For example:
 *
 *     now = It's {DATETIME($today, month: "long")}.
 *
 * The implementation expects an array of `FluentValues` representing the
 * positional arguments, and an object of named `FluentValues` representing the
 * named parameters.
 *
 * The following options are recognized:
 *
 *     dateStyle
 *     timeStyle
 *     fractionalSecondDigits
 *     dayPeriod
 *     hour12
 *     weekday
 *     era
 *     year
 *     month
 *     day
 *     hour
 *     minute
 *     second
 *     timeZoneName
 *
 * Other options are ignored.
 *
 * @param args The positional arguments passed to this `DATETIME()`.
 * @param opts The named argments passed to this `DATETIME()`.
 */
function DATETIME(args, opts) {
    let arg = args[0];
    if (arg instanceof FluentNone) {
        return new FluentNone(`DATETIME(${arg.valueOf()})`);
    }
    if (arg instanceof FluentDateTime) {
        return new FluentDateTime(arg.valueOf(), {
            ...arg.opts,
            ...values(opts, DATETIME_ALLOWED),
        });
    }
    if (arg instanceof FluentNumber) {
        return new FluentDateTime(arg.valueOf(), {
            ...values(opts, DATETIME_ALLOWED),
        });
    }
    throw new TypeError("Invalid argument to DATETIME");
}

const cache = new Map();
function getMemoizerForLocale(locales) {
    const stringLocale = Array.isArray(locales) ? locales.join(" ") : locales;
    let memoizer = cache.get(stringLocale);
    if (memoizer === undefined) {
        memoizer = new Map();
        cache.set(stringLocale, memoizer);
    }
    return memoizer;
}

/**
 * Message bundles are single-language stores of translation resources. They are
 * responsible for formatting message values and attributes to strings.
 */
class FluentBundle {
    /**
     * Create an instance of `FluentBundle`.
     *
     * @example
     * ```js
     * let bundle = new FluentBundle(["en-US", "en"]);
     *
     * let bundle = new FluentBundle(locales, {useIsolating: false});
     *
     * let bundle = new FluentBundle(locales, {
     *   useIsolating: true,
     *   functions: {
     *     NODE_ENV: () => process.env.NODE_ENV
     *   }
     * });
     * ```
     *
     * @param locales - Used to instantiate `Intl` formatters used by translations.
     * @param options - Optional configuration for the bundle.
     */
    constructor(locales, { functions, useIsolating = true, transform = (v) => v, } = {}) {
        /** @ignore */
        this._terms = new Map();
        /** @ignore */
        this._messages = new Map();
        this.locales = Array.isArray(locales) ? locales : [locales];
        this._functions = {
            NUMBER,
            DATETIME,
            ...functions,
        };
        this._useIsolating = useIsolating;
        this._transform = transform;
        this._intls = getMemoizerForLocale(locales);
    }
    /**
     * Check if a message is present in the bundle.
     *
     * @param id - The identifier of the message to check.
     */
    hasMessage(id) {
        return this._messages.has(id);
    }
    /**
     * Return a raw unformatted message object from the bundle.
     *
     * Raw messages are `{value, attributes}` shapes containing translation units
     * called `Patterns`. `Patterns` are implementation-specific; they should be
     * treated as black boxes and formatted with `FluentBundle.formatPattern`.
     *
     * @param id - The identifier of the message to check.
     */
    getMessage(id) {
        return this._messages.get(id);
    }
    /**
     * Add a translation resource to the bundle.
     *
     * @example
     * ```js
     * let res = new FluentResource("foo = Foo");
     * bundle.addResource(res);
     * bundle.getMessage("foo");
     * // → {value: .., attributes: {..}}
     * ```
     *
     * @param res
     * @param options
     */
    addResource(res, { allowOverrides = false, } = {}) {
        const errors = [];
        for (let i = 0; i < res.body.length; i++) {
            let entry = res.body[i];
            if (entry.id.startsWith("-")) {
                // Identifiers starting with a dash (-) define terms. Terms are private
                // and cannot be retrieved from FluentBundle.
                if (allowOverrides === false && this._terms.has(entry.id)) {
                    errors.push(new Error(`Attempt to override an existing term: "${entry.id}"`));
                    continue;
                }
                this._terms.set(entry.id, entry);
            }
            else {
                if (allowOverrides === false && this._messages.has(entry.id)) {
                    errors.push(new Error(`Attempt to override an existing message: "${entry.id}"`));
                    continue;
                }
                this._messages.set(entry.id, entry);
            }
        }
        return errors;
    }
    /**
     * Format a `Pattern` to a string.
     *
     * Format a raw `Pattern` into a string. `args` will be used to resolve
     * references to variables passed as arguments to the translation.
     *
     * In case of errors `formatPattern` will try to salvage as much of the
     * translation as possible and will still return a string. For performance
     * reasons, the encountered errors are not returned but instead are appended
     * to the `errors` array passed as the third argument.
     *
     * If `errors` is omitted, the first encountered error will be thrown.
     *
     * @example
     * ```js
     * let errors = [];
     * bundle.addResource(
     *     new FluentResource("hello = Hello, {$name}!"));
     *
     * let hello = bundle.getMessage("hello");
     * if (hello.value) {
     *     bundle.formatPattern(hello.value, {name: "Jane"}, errors);
     *     // Returns "Hello, Jane!" and `errors` is empty.
     *
     *     bundle.formatPattern(hello.value, undefined, errors);
     *     // Returns "Hello, {$name}!" and `errors` is now:
     *     // [<ReferenceError: Unknown variable: name>]
     * }
     * ```
     */
    formatPattern(pattern, args = null, errors = null) {
        // Resolve a simple pattern without creating a scope. No error handling is
        // required; by definition simple patterns don't have placeables.
        if (typeof pattern === "string") {
            return this._transform(pattern);
        }
        // Resolve a complex pattern.
        let scope = new Scope(this, errors, args);
        try {
            let value = resolveComplexPattern(scope, pattern);
            return value.toString(scope);
        }
        catch (err) {
            if (scope.errors && err instanceof Error) {
                scope.errors.push(err);
                return new FluentNone().toString(scope);
            }
            throw err;
        }
    }
}

// This regex is used to iterate through the beginnings of messages and terms.
// With the /m flag, the ^ matches at the beginning of every line.
const RE_MESSAGE_START = /^(-?[a-zA-Z][\w-]*) *= */gm;
// Both Attributes and Variants are parsed in while loops. These regexes are
// used to break out of them.
const RE_ATTRIBUTE_START = /\.([a-zA-Z][\w-]*) *= */y;
const RE_VARIANT_START = /\*?\[/y;
const RE_NUMBER_LITERAL = /(-?[0-9]+(?:\.([0-9]+))?)/y;
const RE_IDENTIFIER = /([a-zA-Z][\w-]*)/y;
const RE_REFERENCE = /([$-])?([a-zA-Z][\w-]*)(?:\.([a-zA-Z][\w-]*))?/y;
const RE_FUNCTION_NAME = /^[A-Z][A-Z0-9_-]*$/;
// A "run" is a sequence of text or string literal characters which don't
// require any special handling. For TextElements such special characters are: {
// (starts a placeable), and line breaks which require additional logic to check
// if the next line is indented. For StringLiterals they are: \ (starts an
// escape sequence), " (ends the literal), and line breaks which are not allowed
// in StringLiterals. Note that string runs may be empty; text runs may not.
const RE_TEXT_RUN = /([^{}\n\r]+)/y;
const RE_STRING_RUN = /([^\\"\n\r]*)/y;
// Escape sequences.
const RE_STRING_ESCAPE = /\\([\\"])/y;
const RE_UNICODE_ESCAPE = /\\u([a-fA-F0-9]{4})|\\U([a-fA-F0-9]{6})/y;
// Used for trimming TextElements and indents.
const RE_LEADING_NEWLINES = /^\n+/;
const RE_TRAILING_SPACES = / +$/;
// Used in makeIndent to strip spaces from blank lines and normalize CRLF to LF.
const RE_BLANK_LINES = / *\r?\n/g;
// Used in makeIndent to measure the indentation.
const RE_INDENT = /( *)$/;
// Common tokens.
const TOKEN_BRACE_OPEN = /{\s*/y;
const TOKEN_BRACE_CLOSE = /\s*}/y;
const TOKEN_BRACKET_OPEN = /\[\s*/y;
const TOKEN_BRACKET_CLOSE = /\s*] */y;
const TOKEN_PAREN_OPEN = /\s*\(\s*/y;
const TOKEN_ARROW = /\s*->\s*/y;
const TOKEN_COLON = /\s*:\s*/y;
// Note the optional comma. As a deviation from the Fluent EBNF, the parser
// doesn't enforce commas between call arguments.
const TOKEN_COMMA = /\s*,?\s*/y;
const TOKEN_BLANK = /\s+/y;
/**
 * Fluent Resource is a structure storing parsed localization entries.
 */
class FluentResource {
    constructor(source) {
        this.body = [];
        RE_MESSAGE_START.lastIndex = 0;
        let cursor = 0;
        // Iterate over the beginnings of messages and terms to efficiently skip
        // comments and recover from errors.
        while (true) {
            let next = RE_MESSAGE_START.exec(source);
            if (next === null) {
                break;
            }
            cursor = RE_MESSAGE_START.lastIndex;
            try {
                this.body.push(parseMessage(next[1]));
            }
            catch (err) {
                if (err instanceof SyntaxError) {
                    // Don't report any Fluent syntax errors. Skip directly to the
                    // beginning of the next message or term.
                    continue;
                }
                throw err;
            }
        }
        // The parser implementation is inlined below for performance reasons,
        // as well as for convenience of accessing `source` and `cursor`.
        // The parser focuses on minimizing the number of false negatives at the
        // expense of increasing the risk of false positives. In other words, it
        // aims at parsing valid Fluent messages with a success rate of 100%, but it
        // may also parse a few invalid messages which the reference parser would
        // reject. The parser doesn't perform any validation and may produce entries
        // which wouldn't make sense in the real world. For best results users are
        // advised to validate translations with the fluent-syntax parser
        // pre-runtime.
        // The parser makes an extensive use of sticky regexes which can be anchored
        // to any offset of the source string without slicing it. Errors are thrown
        // to bail out of parsing of ill-formed messages.
        function test(re) {
            re.lastIndex = cursor;
            return re.test(source);
        }
        // Advance the cursor by the char if it matches. May be used as a predicate
        // (was the match found?) or, if errorClass is passed, as an assertion.
        function consumeChar(char, errorClass) {
            if (source[cursor] === char) {
                cursor++;
                return true;
            }
            if (errorClass) {
                throw new errorClass(`Expected ${char}`);
            }
            return false;
        }
        // Advance the cursor by the token if it matches. May be used as a predicate
        // (was the match found?) or, if errorClass is passed, as an assertion.
        function consumeToken(re, errorClass) {
            if (test(re)) {
                cursor = re.lastIndex;
                return true;
            }
            if (errorClass) {
                throw new errorClass(`Expected ${re.toString()}`);
            }
            return false;
        }
        // Execute a regex, advance the cursor, and return all capture groups.
        function match(re) {
            re.lastIndex = cursor;
            let result = re.exec(source);
            if (result === null) {
                throw new SyntaxError(`Expected ${re.toString()}`);
            }
            cursor = re.lastIndex;
            return result;
        }
        // Execute a regex, advance the cursor, and return the capture group.
        function match1(re) {
            return match(re)[1];
        }
        function parseMessage(id) {
            let value = parsePattern();
            let attributes = parseAttributes();
            if (value === null && Object.keys(attributes).length === 0) {
                throw new SyntaxError("Expected message value or attributes");
            }
            return { id, value, attributes };
        }
        function parseAttributes() {
            let attrs = Object.create(null);
            while (test(RE_ATTRIBUTE_START)) {
                let name = match1(RE_ATTRIBUTE_START);
                let value = parsePattern();
                if (value === null) {
                    throw new SyntaxError("Expected attribute value");
                }
                attrs[name] = value;
            }
            return attrs;
        }
        function parsePattern() {
            let first;
            // First try to parse any simple text on the same line as the id.
            if (test(RE_TEXT_RUN)) {
                first = match1(RE_TEXT_RUN);
            }
            // If there's a placeable on the first line, parse a complex pattern.
            if (source[cursor] === "{" || source[cursor] === "}") {
                // Re-use the text parsed above, if possible.
                return parsePatternElements(first ? [first] : [], Infinity);
            }
            // RE_TEXT_VALUE stops at newlines. Only continue parsing the pattern if
            // what comes after the newline is indented.
            let indent = parseIndent();
            if (indent) {
                if (first) {
                    // If there's text on the first line, the blank block is part of the
                    // translation content in its entirety.
                    return parsePatternElements([first, indent], indent.length);
                }
                // Otherwise, we're dealing with a block pattern, i.e. a pattern which
                // starts on a new line. Discrad the leading newlines but keep the
                // inline indent; it will be used by the dedentation logic.
                indent.value = trim(indent.value, RE_LEADING_NEWLINES);
                return parsePatternElements([indent], indent.length);
            }
            if (first) {
                // It was just a simple inline text after all.
                return trim(first, RE_TRAILING_SPACES);
            }
            return null;
        }
        // Parse a complex pattern as an array of elements.
        function parsePatternElements(elements = [], commonIndent) {
            while (true) {
                if (test(RE_TEXT_RUN)) {
                    elements.push(match1(RE_TEXT_RUN));
                    continue;
                }
                if (source[cursor] === "{") {
                    elements.push(parsePlaceable());
                    continue;
                }
                if (source[cursor] === "}") {
                    throw new SyntaxError("Unbalanced closing brace");
                }
                let indent = parseIndent();
                if (indent) {
                    elements.push(indent);
                    commonIndent = Math.min(commonIndent, indent.length);
                    continue;
                }
                break;
            }
            let lastIndex = elements.length - 1;
            let lastElement = elements[lastIndex];
            // Trim the trailing spaces in the last element if it's a TextElement.
            if (typeof lastElement === "string") {
                elements[lastIndex] = trim(lastElement, RE_TRAILING_SPACES);
            }
            let baked = [];
            for (let element of elements) {
                if (element instanceof Indent) {
                    // Dedent indented lines by the maximum common indent.
                    element = element.value.slice(0, element.value.length - commonIndent);
                }
                if (element) {
                    baked.push(element);
                }
            }
            return baked;
        }
        function parsePlaceable() {
            consumeToken(TOKEN_BRACE_OPEN, SyntaxError);
            let selector = parseInlineExpression();
            if (consumeToken(TOKEN_BRACE_CLOSE)) {
                return selector;
            }
            if (consumeToken(TOKEN_ARROW)) {
                let variants = parseVariants();
                consumeToken(TOKEN_BRACE_CLOSE, SyntaxError);
                return {
                    type: "select",
                    selector,
                    ...variants,
                };
            }
            throw new SyntaxError("Unclosed placeable");
        }
        function parseInlineExpression() {
            if (source[cursor] === "{") {
                // It's a nested placeable.
                return parsePlaceable();
            }
            if (test(RE_REFERENCE)) {
                let [, sigil, name, attr = null] = match(RE_REFERENCE);
                if (sigil === "$") {
                    return { type: "var", name };
                }
                if (consumeToken(TOKEN_PAREN_OPEN)) {
                    let args = parseArguments();
                    if (sigil === "-") {
                        // A parameterized term: -term(...).
                        return { type: "term", name, attr, args };
                    }
                    if (RE_FUNCTION_NAME.test(name)) {
                        return { type: "func", name, args };
                    }
                    throw new SyntaxError("Function names must be all upper-case");
                }
                if (sigil === "-") {
                    // A non-parameterized term: -term.
                    return {
                        type: "term",
                        name,
                        attr,
                        args: [],
                    };
                }
                return { type: "mesg", name, attr };
            }
            return parseLiteral();
        }
        function parseArguments() {
            let args = [];
            while (true) {
                switch (source[cursor]) {
                    case ")": // End of the argument list.
                        cursor++;
                        return args;
                    case undefined: // EOF
                        throw new SyntaxError("Unclosed argument list");
                }
                args.push(parseArgument());
                // Commas between arguments are treated as whitespace.
                consumeToken(TOKEN_COMMA);
            }
        }
        function parseArgument() {
            let expr = parseInlineExpression();
            if (expr.type !== "mesg") {
                return expr;
            }
            if (consumeToken(TOKEN_COLON)) {
                // The reference is the beginning of a named argument.
                return {
                    type: "narg",
                    name: expr.name,
                    value: parseLiteral(),
                };
            }
            // It's a regular message reference.
            return expr;
        }
        function parseVariants() {
            let variants = [];
            let count = 0;
            let star;
            while (test(RE_VARIANT_START)) {
                if (consumeChar("*")) {
                    star = count;
                }
                let key = parseVariantKey();
                let value = parsePattern();
                if (value === null) {
                    throw new SyntaxError("Expected variant value");
                }
                variants[count++] = { key, value };
            }
            if (count === 0) {
                return null;
            }
            if (star === undefined) {
                throw new SyntaxError("Expected default variant");
            }
            return { variants, star };
        }
        function parseVariantKey() {
            consumeToken(TOKEN_BRACKET_OPEN, SyntaxError);
            let key;
            if (test(RE_NUMBER_LITERAL)) {
                key = parseNumberLiteral();
            }
            else {
                key = {
                    type: "str",
                    value: match1(RE_IDENTIFIER),
                };
            }
            consumeToken(TOKEN_BRACKET_CLOSE, SyntaxError);
            return key;
        }
        function parseLiteral() {
            if (test(RE_NUMBER_LITERAL)) {
                return parseNumberLiteral();
            }
            if (source[cursor] === '"') {
                return parseStringLiteral();
            }
            throw new SyntaxError("Invalid expression");
        }
        function parseNumberLiteral() {
            let [, value, fraction = ""] = match(RE_NUMBER_LITERAL);
            let precision = fraction.length;
            return {
                type: "num",
                value: parseFloat(value),
                precision,
            };
        }
        function parseStringLiteral() {
            consumeChar('"', SyntaxError);
            let value = "";
            while (true) {
                value += match1(RE_STRING_RUN);
                if (source[cursor] === "\\") {
                    value += parseEscapeSequence();
                    continue;
                }
                if (consumeChar('"')) {
                    return { type: "str", value };
                }
                // We've reached an EOL of EOF.
                throw new SyntaxError("Unclosed string literal");
            }
        }
        // Unescape known escape sequences.
        function parseEscapeSequence() {
            if (test(RE_STRING_ESCAPE)) {
                return match1(RE_STRING_ESCAPE);
            }
            if (test(RE_UNICODE_ESCAPE)) {
                let [, codepoint4, codepoint6] = match(RE_UNICODE_ESCAPE);
                let codepoint = parseInt(codepoint4 || codepoint6, 16);
                return codepoint <= 0xd7ff || 0xe000 <= codepoint
                    ? // It's a Unicode scalar value.
                        String.fromCodePoint(codepoint)
                    : // Lonely surrogates can cause trouble when the parsing result is
                        // saved using UTF-8. Use U+FFFD REPLACEMENT CHARACTER instead.
                        "�";
            }
            throw new SyntaxError("Unknown escape sequence");
        }
        // Parse blank space. Return it if it looks like indent before a pattern
        // line. Skip it othwerwise.
        function parseIndent() {
            let start = cursor;
            consumeToken(TOKEN_BLANK);
            // Check the first non-blank character after the indent.
            switch (source[cursor]) {
                case ".":
                case "[":
                case "*":
                case "}":
                case undefined: // EOF
                    // A special character. End the Pattern.
                    return false;
                case "{":
                    // Placeables don't require indentation (in EBNF: block-placeable).
                    // Continue the Pattern.
                    return makeIndent(source.slice(start, cursor));
            }
            // If the first character on the line is not one of the special characters
            // listed above, it's a regular text character. Check if there's at least
            // one space of indent before it.
            if (source[cursor - 1] === " ") {
                // It's an indented text character (in EBNF: indented-char). Continue
                // the Pattern.
                return makeIndent(source.slice(start, cursor));
            }
            // A not-indented text character is likely the identifier of the next
            // message. End the Pattern.
            return false;
        }
        // Trim blanks in text according to the given regex.
        function trim(text, re) {
            return text.replace(re, "");
        }
        // Normalize a blank block and extract the indent details.
        function makeIndent(blank) {
            let value = blank.replace(RE_BLANK_LINES, "\n");
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            let length = RE_INDENT.exec(blank)[1].length;
            return new Indent(value, length);
        }
    }
}
class Indent {
    constructor(value, length) {
        this.value = value;
        this.length = length;
    }
}

/* eslint no-console: ["error", {allow: ["warn"]}] */
/* global console */
// Match the opening angle bracket (<) in HTML tags, and HTML entities like
// &amp;, &#0038;, &#x0026;.
const reOverlay = /<|&#?\w+;/;
/**
 * Elements allowed in translations even if they are not present in the source
 * HTML. They are text-level elements as defined by the HTML5 spec:
 * https://www.w3.org/TR/html5/text-level-semantics.html with the exception of:
 *
 *   - a - because we don't allow href on it anyways,
 *   - ruby, rt, rp - because we don't allow nested elements to be inserted.
 */
const TEXT_LEVEL_ELEMENTS = {
    "http://www.w3.org/1999/xhtml": [
        "em",
        "strong",
        "small",
        "s",
        "cite",
        "q",
        "dfn",
        "abbr",
        "data",
        "time",
        "code",
        "var",
        "samp",
        "kbd",
        "sub",
        "sup",
        "i",
        "b",
        "u",
        "mark",
        "bdi",
        "bdo",
        "span",
        "br",
        "wbr",
    ],
};
const LOCALIZABLE_ATTRIBUTES = {
    "http://www.w3.org/1999/xhtml": {
        global: ["title", "aria-label", "aria-valuetext"],
        a: ["download"],
        area: ["download", "alt"],
        // value is special-cased in isAttrNameLocalizable
        input: ["alt", "placeholder"],
        menuitem: ["label"],
        menu: ["label"],
        optgroup: ["label"],
        option: ["label"],
        track: ["label"],
        img: ["alt"],
        textarea: ["placeholder"],
        th: ["abbr"],
    },
    "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul": {
        global: [
            "accesskey",
            "aria-label",
            "aria-valuetext",
            "label",
            "title",
            "tooltiptext",
        ],
        description: ["value"],
        key: ["key", "keycode"],
        label: ["value"],
        textbox: ["placeholder", "value"],
    },
};
/**
 * Translate an element.
 *
 * Translate the element's text content and attributes. Some HTML markup is
 * allowed in the translation. The element's children with the data-l10n-name
 * attribute will be treated as arguments to the translation. If the
 * translation defines the same children, their attributes and text contents
 * will be used for translating the matching source child.
 *
 * @param   {Element} element
 * @param   {Object} translation
 * @private
 */
function translateElement(element, translation) {
    const { value } = translation;
    if (typeof value === "string") {
        if (element.localName === "title" &&
            element.namespaceURI === "http://www.w3.org/1999/xhtml") {
            // A special case for the HTML title element whose content must be text.
            element.textContent = value;
        }
        else if (!reOverlay.test(value)) {
            // If the translation doesn't contain any markup skip the overlay logic.
            element.textContent = value;
        }
        else {
            // Else parse the translation's HTML using an inert template element,
            // sanitize it and replace the element's content.
            const templateElement = element.ownerDocument.createElementNS("http://www.w3.org/1999/xhtml", "template");
            templateElement.innerHTML = value;
            overlayChildNodes(templateElement.content, element);
        }
    }
    // Even if the translation doesn't define any localizable attributes, run
    // overlayAttributes to remove any localizable attributes set by previous
    // translations.
    overlayAttributes(translation, element);
}
/**
 * Replace child nodes of an element with child nodes of another element.
 *
 * The contents of the target element will be cleared and fully replaced with
 * sanitized contents of the source element.
 *
 * @param {DocumentFragment} fromFragment - The source of children to overlay.
 * @param {Element} toElement - The target of the overlay.
 * @private
 */
function overlayChildNodes(fromFragment, toElement) {
    for (const childNode of fromFragment.childNodes) {
        if (childNode.nodeType === childNode.TEXT_NODE) {
            // Keep the translated text node.
            continue;
        }
        if (childNode.hasAttribute("data-l10n-name")) {
            const sanitized = getNodeForNamedElement(toElement, childNode);
            fromFragment.replaceChild(sanitized, childNode);
            continue;
        }
        if (isElementAllowed(childNode)) {
            const sanitized = createSanitizedElement(childNode);
            fromFragment.replaceChild(sanitized, childNode);
            continue;
        }
        console.warn(`An element of forbidden type "${childNode.localName}" was found in ` +
            "the translation. Only safe text-level elements and elements with " +
            "data-l10n-name are allowed.");
        // If all else fails, replace the element with its text content.
        fromFragment.replaceChild(createTextNodeFromTextContent(childNode), childNode);
    }
    toElement.textContent = "";
    toElement.appendChild(fromFragment);
}
function hasAttribute(attributes, name) {
    if (!attributes) {
        return false;
    }
    for (let attr of attributes) {
        if (attr.name === name) {
            return true;
        }
    }
    return false;
}
/**
 * Transplant localizable attributes of an element to another element.
 *
 * Any localizable attributes already set on the target element will be
 * cleared.
 *
 * @param   {Element|Object} fromElement - The source of child nodes to overlay.
 * @param   {Element} toElement - The target of the overlay.
 * @private
 */
function overlayAttributes(fromElement, toElement) {
    const explicitlyAllowed = toElement.hasAttribute("data-l10n-attrs")
        ? toElement
            .getAttribute("data-l10n-attrs")
            .split(",")
            .map(i => i.trim())
        : null;
    // Remove existing localizable attributes if they
    // will not be used in the new translation.
    for (const attr of Array.from(toElement.attributes)) {
        if (isAttrNameLocalizable(attr.name, toElement, explicitlyAllowed) &&
            !hasAttribute(fromElement.attributes, attr.name)) {
            toElement.removeAttribute(attr.name);
        }
    }
    // fromElement might be a {value, attributes} object as returned by
    // Localization.messageFromBundle. In which case attributes may be null to
    // save GC cycles.
    if (!fromElement.attributes) {
        return;
    }
    // Set localizable attributes.
    for (const attr of Array.from(fromElement.attributes)) {
        if (isAttrNameLocalizable(attr.name, toElement, explicitlyAllowed) &&
            toElement.getAttribute(attr.name) !== attr.value) {
            toElement.setAttribute(attr.name, attr.value);
        }
    }
}
/**
 * Sanitize a child element created by the translation.
 *
 * Try to find a corresponding child in sourceElement and use it as the base
 * for the sanitization. This will preserve functional attribtues defined on
 * the child element in the source HTML.
 *
 * @param   {Element} sourceElement - The source for data-l10n-name lookups.
 * @param   {Element} translatedChild - The translated child to be sanitized.
 * @returns {Element}
 * @private
 */
function getNodeForNamedElement(sourceElement, translatedChild) {
    const childName = translatedChild.getAttribute("data-l10n-name");
    const sourceChild = sourceElement.querySelector(`[data-l10n-name="${childName}"]`);
    if (!sourceChild) {
        console.warn(`An element named "${childName}" wasn't found in the source.`);
        return createTextNodeFromTextContent(translatedChild);
    }
    if (sourceChild.localName !== translatedChild.localName) {
        console.warn(`An element named "${childName}" was found in the translation ` +
            `but its type ${translatedChild.localName} didn't match the ` +
            `element found in the source (${sourceChild.localName}).`);
        return createTextNodeFromTextContent(translatedChild);
    }
    // Remove it from sourceElement so that the translation cannot use
    // the same reference name again.
    sourceElement.removeChild(sourceChild);
    // We can't currently guarantee that a translation won't remove
    // sourceChild from the element completely, which could break the app if
    // it relies on an event handler attached to the sourceChild. Let's make
    // this limitation explicit for now by breaking the identitiy of the
    // sourceChild by cloning it. This will destroy all event handlers
    // attached to sourceChild via addEventListener and via on<name>
    // properties.
    const clone = sourceChild.cloneNode(false);
    return shallowPopulateUsing(translatedChild, clone);
}
/**
 * Sanitize an allowed element.
 *
 * Text-level elements allowed in translations may only use safe attributes
 * and will have any nested markup stripped to text content.
 *
 * @param   {Element} element - The element to be sanitized.
 * @returns {Element}
 * @private
 */
function createSanitizedElement(element) {
    // Start with an empty element of the same type to remove nested children
    // and non-localizable attributes defined by the translation.
    const clone = element.ownerDocument.createElement(element.localName);
    return shallowPopulateUsing(element, clone);
}
/**
 * Convert an element to a text node.
 *
 * @param   {Element} element - The element to be sanitized.
 * @returns {Node}
 * @private
 */
function createTextNodeFromTextContent(element) {
    return element.ownerDocument.createTextNode(element.textContent);
}
/**
 * Check if element is allowed in the translation.
 *
 * This method is used by the sanitizer when the translation markup contains
 * an element which is not present in the source code.
 *
 * @param   {Element} element
 * @returns {boolean}
 * @private
 */
function isElementAllowed(element) {
    const allowed = TEXT_LEVEL_ELEMENTS[element.namespaceURI];
    return allowed && allowed.includes(element.localName);
}
/**
 * Check if attribute is allowed for the given element.
 *
 * This method is used by the sanitizer when the translation markup contains
 * DOM attributes, or when the translation has traits which map to DOM
 * attributes.
 *
 * `explicitlyAllowed` can be passed as a list of attributes explicitly
 * allowed on this element.
 *
 * @param   {string}         name
 * @param   {Element}        element
 * @param   {Array}          explicitlyAllowed
 * @returns {boolean}
 * @private
 */
function isAttrNameLocalizable(name, element, explicitlyAllowed = null) {
    if (explicitlyAllowed && explicitlyAllowed.includes(name)) {
        return true;
    }
    const allowed = LOCALIZABLE_ATTRIBUTES[element.namespaceURI];
    if (!allowed) {
        return false;
    }
    const attrName = name.toLowerCase();
    const elemName = element.localName;
    // Is it a globally safe attribute?
    if (allowed.global.includes(attrName)) {
        return true;
    }
    // Are there no allowed attributes for this element?
    if (!allowed[elemName]) {
        return false;
    }
    // Is it allowed on this element?
    if (allowed[elemName].includes(attrName)) {
        return true;
    }
    // Special case for value on HTML inputs with type button, reset, submit
    if (element.namespaceURI === "http://www.w3.org/1999/xhtml" &&
        elemName === "input" &&
        attrName === "value") {
        const type = element.type.toLowerCase();
        if (type === "submit" || type === "button" || type === "reset") {
            return true;
        }
    }
    return false;
}
/**
 * Helper to set textContent and localizable attributes on an element.
 *
 * @param   {Element} fromElement
 * @param   {Element} toElement
 * @returns {Element}
 * @private
 */
function shallowPopulateUsing(fromElement, toElement) {
    toElement.textContent = fromElement.textContent;
    overlayAttributes(fromElement, toElement);
    return toElement;
}

/*
 * Base CachedIterable class.
 */
class CachedIterable extends Array {
    /**
     * Create a `CachedIterable` instance from an iterable or, if another
     * instance of `CachedIterable` is passed, return it without any
     * modifications.
     *
     * @param {Iterable} iterable
     * @returns {CachedIterable}
     */
    static from(iterable) {
        if (iterable instanceof this) {
            return iterable;
        }

        return new this(iterable);
    }
}

/*
 * CachedAsyncIterable caches the elements yielded by an async iterable.
 *
 * It can be used to iterate over an iterable many times without depleting the
 * iterable.
 */
class CachedAsyncIterable extends CachedIterable {
    /**
     * Create an `CachedAsyncIterable` instance.
     *
     * @param {Iterable} iterable
     * @returns {CachedAsyncIterable}
     */
    constructor(iterable) {
        super();

        if (Symbol.asyncIterator in Object(iterable)) {
            this.iterator = iterable[Symbol.asyncIterator]();
        } else if (Symbol.iterator in Object(iterable)) {
            this.iterator = iterable[Symbol.iterator]();
        } else {
            throw new TypeError("Argument must implement the iteration protocol.");
        }
    }

    /**
     * Asynchronous iterator caching the yielded elements.
     *
     * Elements yielded by the original iterable will be cached and available
     * synchronously. Returns an async generator object implementing the
     * iterator protocol over the elements of the original (async or sync)
     * iterable.
     */
    [Symbol.asyncIterator]() {
        const cached = this;
        let cur = 0;

        return {
            async next() {
                if (cached.length <= cur) {
                    cached.push(cached.iterator.next());
                }
                return cached[cur++];
            }
        };
    }

    /**
     * This method allows user to consume the next element from the iterator
     * into the cache.
     *
     * @param {number} count - number of elements to consume
     */
    async touchNext(count = 1) {
        let idx = 0;
        while (idx++ < count) {
            const last = this[this.length - 1];
            if (last && (await last).done) {
                break;
            }
            this.push(this.iterator.next());
        }
        // Return the last cached {value, done} object to allow the calling
        // code to decide if it needs to call touchNext again.
        return this[this.length - 1];
    }
}

/* eslint no-console: ["error", { allow: ["warn", "error"] }] */
/**
 * The `Localization` class is a central high-level API for vanilla
 * JavaScript use of Fluent.
 * It combines language negotiation, FluentBundle and I/O to
 * provide a scriptable API to format translations.
 */
class Localization {
    /**
     * @param {Array<String>} resourceIds     - List of resource IDs
     * @param {Function}      generateBundles - Function that returns a
     *                                          generator over FluentBundles
     *
     * @returns {Localization}
     */
    constructor(resourceIds = [], generateBundles) {
        this.resourceIds = resourceIds;
        this.generateBundles = generateBundles;
        this.onChange(true);
    }
    addResourceIds(resourceIds, eager = false) {
        this.resourceIds.push(...resourceIds);
        this.onChange(eager);
        return this.resourceIds.length;
    }
    removeResourceIds(resourceIds) {
        this.resourceIds = this.resourceIds.filter(r => !resourceIds.includes(r));
        this.onChange();
        return this.resourceIds.length;
    }
    /**
     * Format translations and handle fallback if needed.
     *
     * Format translations for `keys` from `FluentBundle` instances on this
     * DOMLocalization. In case of errors, fetch the next context in the
     * fallback chain.
     *
     * @param   {Array<Object>}         keys    - Translation keys to format.
     * @param   {Function}              method  - Formatting function.
     * @returns {Promise<Array<string|Object>>}
     * @private
     */
    async formatWithFallback(keys, method) {
        const translations = [];
        let hasAtLeastOneBundle = false;
        for await (const bundle of this.bundles) {
            hasAtLeastOneBundle = true;
            const missingIds = keysFromBundle(method, bundle, keys, translations);
            if (missingIds.size === 0) {
                break;
            }
            if (typeof console !== "undefined") {
                const locale = bundle.locales[0];
                const ids = Array.from(missingIds).join(", ");
                console.warn(`[fluent] Missing translations in ${locale}: ${ids}`);
            }
        }
        if (!hasAtLeastOneBundle && typeof console !== "undefined") {
            // eslint-disable-next-line max-len
            console.warn(`[fluent] Request for keys failed because no resource bundles got generated.
  keys: ${JSON.stringify(keys)}.
  resourceIds: ${JSON.stringify(this.resourceIds)}.`);
        }
        return translations;
    }
    /**
     * Format translations into `{value, attributes}` objects.
     *
     * The fallback logic is the same as in `formatValues`
     * but it returns `{value, attributes}` objects
     * which are suitable for the translation of DOM elements.
     *
     * Returns a Promise resolving to an array of the translation strings.
     *
     * @example
     * ```js
     * docL10n.formatMessages([
     *   {id: 'hello', args: { who: 'Mary' }},
     *   {id: 'welcome'}
     * ]).then(console.log);
     *
     * // [
     * //   { value: 'Hello, Mary!', attributes: null },
     * //   {
     * //     value: 'Welcome!',
     * //     attributes: [ { name: "title", value: 'Hello' } ]
     * //   }
     * // ]
     * ```
     *
     * @param   {Array<Object>} keys
     * @returns {Promise<Array<{value: string, attributes: Object}>>}
     * @private
     */
    formatMessages(keys) {
        return this.formatWithFallback(keys, messageFromBundle);
    }
    /**
     * Retrieve translations corresponding to the passed keys.
     *
     * A generalized version of `DOMLocalization.formatValue`. Keys must
     * be `{id, args}` objects.
     *
     * Returns a Promise resolving to an array of the translation strings.
     *
     * @example
     * ```js
     * docL10n.formatValues([
     *   {id: 'hello', args: { who: 'Mary' }},
     *   {id: 'hello', args: { who: 'John' }},
     *   {id: 'welcome'}
     * ]).then(console.log);
     *
     * // ['Hello, Mary!', 'Hello, John!', 'Welcome!']
     * ```
     *
     * @param   {Array<Object>} keys
     * @returns {Promise<Array<string>>}
     */
    formatValues(keys) {
        return this.formatWithFallback(keys, valueFromBundle);
    }
    /**
     * Retrieve the translation corresponding to the `id` identifier.
     *
     * If passed, `args` is a simple hash object with a list of variables that
     * will be interpolated in the value of the translation.
     *
     * Returns a Promise resolving to the translation string.
     *
     * Use this sparingly for one-off messages which don't need to be
     * retranslated when the user changes their language preferences, e.g. in
     * notifications.
     *
     * @example
     * ```js
     * docL10n.formatValue(
     *   'hello', { who: 'world' }
     * ).then(console.log);
     *
     * // 'Hello, world!'
     * ```
     *
     * @param   {string}  id     - Identifier of the translation to format
     * @param   {Object}  [args] - Optional external arguments
     * @returns {Promise<string>}
     */
    async formatValue(id, args) {
        const [val] = await this.formatValues([{ id, args }]);
        return val;
    }
    handleEvent() {
        this.onChange();
    }
    /**
     * This method should be called when there's a reason to believe
     * that language negotiation or available resources changed.
     */
    onChange(eager = false) {
        this.bundles = CachedAsyncIterable.from(this.generateBundles(this.resourceIds));
        if (eager) {
            this.bundles.touchNext(2);
        }
    }
}
/**
 * Format the value of a message into a string or `null`.
 *
 * This function is passed as a method to `keysFromBundle` and resolve
 * a value of a single L10n Entity using provided `FluentBundle`.
 *
 * If the message doesn't have a value, return `null`.
 *
 * @param   {FluentBundle} bundle
 * @param   {Array<Error>} errors
 * @param   {Object} message
 * @param   {Object} args
 * @returns {string|null}
 * @private
 */
function valueFromBundle(bundle, errors, message, args) {
    if (message.value) {
        return bundle.formatPattern(message.value, args, errors);
    }
    return null;
}
/**
 * Format all public values of a message into a {value, attributes} object.
 *
 * This function is passed as a method to `keysFromBundle` and resolve
 * a single L10n Entity using provided `FluentBundle`.
 *
 * The function will return an object with a value and attributes of the
 * entity.
 *
 * @param   {FluentBundle} bundle
 * @param   {Array<Error>} errors
 * @param   {Object} message
 * @param   {Object} args
 * @returns {Object}
 * @private
 */
function messageFromBundle(bundle, errors, message, args) {
    const formatted = {
        value: null,
        attributes: null,
    };
    if (message.value) {
        formatted.value = bundle.formatPattern(message.value, args, errors);
    }
    let attrNames = Object.keys(message.attributes);
    if (attrNames.length > 0) {
        formatted.attributes = new Array(attrNames.length);
        for (let [i, name] of attrNames.entries()) {
            let value = bundle.formatPattern(message.attributes[name], args, errors);
            formatted.attributes[i] = { name, value };
        }
    }
    return formatted;
}
/**
 * This function is an inner function for `Localization.formatWithFallback`.
 *
 * It takes a `FluentBundle`, list of l10n-ids and a method to be used for
 * key resolution (either `valueFromBundle` or `messageFromBundle`) and
 * optionally a value returned from `keysFromBundle` executed against
 * another `FluentBundle`.
 *
 * The idea here is that if the previous `FluentBundle` did not resolve
 * all keys, we're calling this function with the next context to resolve
 * the remaining ones.
 *
 * In the function, we loop over `keys` and check if we have the `prev`
 * passed and if it has an error entry for the position we're in.
 *
 * If it doesn't, it means that we have a good translation for this key and
 * we return it. If it does, we'll try to resolve the key using the passed
 * `FluentBundle`.
 *
 * In the end, we fill the translations array, and return the Set with
 * missing ids.
 *
 * See `Localization.formatWithFallback` for more info on how this is used.
 *
 * @param {Function}       method
 * @param {FluentBundle} bundle
 * @param {Array<string>}  keys
 * @param {{Array<{value: string, attributes: Object}>}} translations
 *
 * @returns {Set<string>}
 * @private
 */
function keysFromBundle(method, bundle, keys, translations) {
    const messageErrors = [];
    const missingIds = new Set();
    keys.forEach(({ id, args }, i) => {
        if (translations[i] !== undefined) {
            return;
        }
        let message = bundle.getMessage(id);
        if (message) {
            messageErrors.length = 0;
            translations[i] = method(bundle, messageErrors, message, args);
            if (messageErrors.length > 0 && typeof console !== "undefined") {
                const locale = bundle.locales[0];
                const errors = messageErrors.join(", ");
                // eslint-disable-next-line max-len
                console.warn(`[fluent][resolver] errors in ${locale}/${id}: ${errors}.`);
            }
        }
        else {
            missingIds.add(id);
        }
    });
    return missingIds;
}

const L10NID_ATTR_NAME = "data-l10n-id";
const L10NARGS_ATTR_NAME = "data-l10n-args";
const L10N_ELEMENT_QUERY = `[${L10NID_ATTR_NAME}]`;
/**
 * The `DOMLocalization` class is responsible for fetching resources and
 * formatting translations.
 *
 * It implements the fallback strategy in case of errors encountered during the
 * formatting of translations and methods for observing DOM
 * trees with a `MutationObserver`.
 */
class DOMLocalization extends Localization {
    /**
     * @param {Array<String>}    resourceIds     - List of resource IDs
     * @param {Function}         generateBundles - Function that returns a
     *                                             generator over FluentBundles
     * @returns {DOMLocalization}
     */
    constructor(resourceIds, generateBundles) {
        super(resourceIds, generateBundles);
        // A Set of DOM trees observed by the `MutationObserver`.
        this.roots = new Set();
        // requestAnimationFrame handler.
        this.pendingrAF = null;
        // list of elements pending for translation.
        this.pendingElements = new Set();
        this.windowElement = null;
        this.mutationObserver = null;
        this.observerConfig = {
            attributes: true,
            characterData: false,
            childList: true,
            subtree: true,
            attributeFilter: [L10NID_ATTR_NAME, L10NARGS_ATTR_NAME],
        };
    }
    onChange(eager = false) {
        super.onChange(eager);
        if (this.roots) {
            this.translateRoots();
        }
    }
    /**
     * Set the `data-l10n-id` and `data-l10n-args` attributes on DOM elements.
     * FluentDOM makes use of mutation observers to detect changes
     * to `data-l10n-*` attributes and translate elements asynchronously.
     * `setAttributes` is a convenience method which allows to translate
     * DOM elements declaratively.
     *
     * You should always prefer to use `data-l10n-id` on elements (statically in
     * HTML or dynamically via `setAttributes`) over manually retrieving
     * translations with `format`.  The use of attributes ensures that the
     * elements can be retranslated when the user changes their language
     * preferences.
     *
     * ```javascript
     * localization.setAttributes(
     *   document.querySelector('#welcome'), 'hello', { who: 'world' }
     * );
     * ```
     *
     * This will set the following attributes on the `#welcome` element.
     * The MutationObserver will pick up this change and will localize the element
     * asynchronously.
     *
     * ```html
     * <p id='welcome'
     *   data-l10n-id='hello'
     *   data-l10n-args='{"who": "world"}'>
     * </p>
     * ```
     *
     * @param {Element}                element - Element to set attributes on
     * @param {string}                 id      - l10n-id string
     * @param {Object<string, string>} args    - KVP list of l10n arguments
     * @returns {Element}
     */
    setAttributes(element, id, args) {
        element.setAttribute(L10NID_ATTR_NAME, id);
        if (args) {
            element.setAttribute(L10NARGS_ATTR_NAME, JSON.stringify(args));
        }
        else {
            element.removeAttribute(L10NARGS_ATTR_NAME);
        }
        return element;
    }
    /**
     * Get the `data-l10n-*` attributes from DOM elements.
     *
     * ```javascript
     * localization.getAttributes(
     *   document.querySelector('#welcome')
     * );
     * // -> { id: 'hello', args: { who: 'world' } }
     * ```
     *
     * @param   {Element}  element - HTML element
     * @returns {{id: string, args: Object}}
     */
    getAttributes(element) {
        return {
            id: element.getAttribute(L10NID_ATTR_NAME),
            args: JSON.parse(element.getAttribute(L10NARGS_ATTR_NAME) || null),
        };
    }
    /**
     * Add `newRoot` to the list of roots managed by this `DOMLocalization`.
     *
     * Additionally, if this `DOMLocalization` has an observer, start observing
     * `newRoot` in order to translate mutations in it.
     *
     * @param {Element}      newRoot - Root to observe.
     */
    connectRoot(newRoot) {
        for (const root of this.roots) {
            if (root === newRoot ||
                root.contains(newRoot) ||
                newRoot.contains(root)) {
                throw new Error("Cannot add a root that overlaps with existing root.");
            }
        }
        if (this.windowElement) {
            if (this.windowElement !== newRoot.ownerDocument.defaultView) {
                throw new Error(`Cannot connect a root:
          DOMLocalization already has a root from a different window.`);
            }
        }
        else {
            this.windowElement = newRoot.ownerDocument.defaultView;
            this.mutationObserver = new this.windowElement.MutationObserver(mutations => this.translateMutations(mutations));
        }
        this.roots.add(newRoot);
        this.mutationObserver.observe(newRoot, this.observerConfig);
    }
    /**
     * Remove `root` from the list of roots managed by this `DOMLocalization`.
     *
     * Additionally, if this `DOMLocalization` has an observer, stop observing
     * `root`.
     *
     * Returns `true` if the root was the last one managed by this
     * `DOMLocalization`.
     *
     * @param   {Element} root - Root to disconnect.
     * @returns {boolean}
     */
    disconnectRoot(root) {
        this.roots.delete(root);
        // Pause the mutation observer to stop observing `root`.
        this.pauseObserving();
        if (this.roots.size === 0) {
            this.mutationObserver = null;
            this.windowElement = null;
            this.pendingrAF = null;
            this.pendingElements.clear();
            return true;
        }
        // Resume observing all other roots.
        this.resumeObserving();
        return false;
    }
    /**
     * Translate all roots associated with this `DOMLocalization`.
     *
     * @returns {Promise}
     */
    translateRoots() {
        const roots = Array.from(this.roots);
        return Promise.all(roots.map(root => this.translateFragment(root)));
    }
    /**
     * Pauses the `MutationObserver`.
     *
     * @private
     */
    pauseObserving() {
        if (!this.mutationObserver) {
            return;
        }
        this.translateMutations(this.mutationObserver.takeRecords());
        this.mutationObserver.disconnect();
    }
    /**
     * Resumes the `MutationObserver`.
     *
     * @private
     */
    resumeObserving() {
        if (!this.mutationObserver) {
            return;
        }
        for (const root of this.roots) {
            this.mutationObserver.observe(root, this.observerConfig);
        }
    }
    /**
     * Translate mutations detected by the `MutationObserver`.
     *
     * @private
     */
    translateMutations(mutations) {
        for (const mutation of mutations) {
            switch (mutation.type) {
                case "attributes":
                    if (mutation.target.hasAttribute("data-l10n-id")) {
                        this.pendingElements.add(mutation.target);
                    }
                    break;
                case "childList":
                    for (const addedNode of mutation.addedNodes) {
                        if (addedNode.nodeType === addedNode.ELEMENT_NODE) {
                            if (addedNode.childElementCount) {
                                for (const element of this.getTranslatables(addedNode)) {
                                    this.pendingElements.add(element);
                                }
                            }
                            else if (addedNode.hasAttribute(L10NID_ATTR_NAME)) {
                                this.pendingElements.add(addedNode);
                            }
                        }
                    }
                    break;
            }
        }
        // This fragment allows us to coalesce all pending translations
        // into a single requestAnimationFrame.
        if (this.pendingElements.size > 0) {
            if (this.pendingrAF === null) {
                this.pendingrAF = this.windowElement.requestAnimationFrame(() => {
                    this.translateElements(Array.from(this.pendingElements));
                    this.pendingElements.clear();
                    this.pendingrAF = null;
                });
            }
        }
    }
    /**
     * Translate a DOM element or fragment asynchronously using this
     * `DOMLocalization` object.
     *
     * Manually trigger the translation (or re-translation) of a DOM fragment.
     * Use the `data-l10n-id` and `data-l10n-args` attributes to mark up the DOM
     * with information about which translations to use.
     *
     * Returns a `Promise` that gets resolved once the translation is complete.
     *
     * @param   {DOMFragment} frag - Element or DocumentFragment to be translated
     * @returns {Promise}
     */
    translateFragment(frag) {
        return this.translateElements(this.getTranslatables(frag));
    }
    /**
     * Translate a list of DOM elements asynchronously using this
     * `DOMLocalization` object.
     *
     * Manually trigger the translation (or re-translation) of a list of elements.
     * Use the `data-l10n-id` and `data-l10n-args` attributes to mark up the DOM
     * with information about which translations to use.
     *
     * Returns a `Promise` that gets resolved once the translation is complete.
     *
     * @param   {Array<Element>} elements - List of elements to be translated
     * @returns {Promise}
     */
    async translateElements(elements) {
        if (!elements.length) {
            return undefined;
        }
        const keys = elements.map(this.getKeysForElement);
        const translations = await this.formatMessages(keys);
        return this.applyTranslations(elements, translations);
    }
    /**
     * Applies translations onto elements.
     *
     * @param {Array<Element>} elements
     * @param {Array<Object>}  translations
     * @private
     */
    applyTranslations(elements, translations) {
        this.pauseObserving();
        for (let i = 0; i < elements.length; i++) {
            if (translations[i] !== undefined) {
                translateElement(elements[i], translations[i]);
            }
        }
        this.resumeObserving();
    }
    /**
     * Collects all translatable child elements of the element.
     *
     * @param {Element} element
     * @returns {Array<Element>}
     * @private
     */
    getTranslatables(element) {
        const nodes = Array.from(element.querySelectorAll(L10N_ELEMENT_QUERY));
        if (typeof element.hasAttribute === "function" &&
            element.hasAttribute(L10NID_ATTR_NAME)) {
            nodes.push(element);
        }
        return nodes;
    }
    /**
     * Get the `data-l10n-*` attributes from DOM elements as a two-element
     * array.
     *
     * @param {Element} element
     * @returns {Object}
     * @private
     */
    getKeysForElement(element) {
        return {
            id: element.getAttribute(L10NID_ATTR_NAME),
            args: JSON.parse(element.getAttribute(L10NARGS_ATTR_NAME) || null),
        };
    }
}

/* Copyright 2023 Mozilla Foundation
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

/** @typedef {import("./interfaces").IL10n} IL10n */

/**
 * NOTE: The L10n-implementations should use lowercase language-codes
 *       internally.
 * @implements {IL10n}
 */
class L10n {
  #dir;
  #lang;
  #l10n;
  constructor({
    lang,
    isRTL
  }, l10n = null) {
    this.#lang = L10n.#fixupLangCode(lang);
    this.#l10n = l10n;
    this.#dir = (isRTL !== null && isRTL !== void 0 ? isRTL : L10n.#isRTL(this.#lang)) ? "rtl" : "ltr";
  }
  _setL10n(l10n) {
    this.#l10n = l10n;
    if (typeof PDFJSDev !== "undefined" && PDFJSDev.test("TESTING")) {
      document.l10n = l10n;
    }
  }

  /** @inheritdoc */
  getLanguage() {
    return this.#lang;
  }

  /** @inheritdoc */
  getDirection() {
    return this.#dir;
  }

  /** @inheritdoc */
  async get(ids, args = null, fallback) {
    if (Array.isArray(ids)) {
      ids = ids.map(id => ({
        id
      }));
      const messages = await this.#l10n.formatMessages(ids);
      return messages.map(message => message.value);
    }
    const messages = await this.#l10n.formatMessages([{
      id: ids,
      args
    }]);
    return (messages === null || messages === void 0 ? void 0 : messages[0].value) || fallback;
  }

  /** @inheritdoc */
  async translate(element) {
    try {
      this.#l10n.connectRoot(element);
      await this.#l10n.translateRoots();
    } catch {
      // Element is under an existing root, so there is no need to add it again.
    }
  }

  /** @inheritdoc */
  pause() {
    this.#l10n.pauseObserving();
  }

  /** @inheritdoc */
  resume() {
    this.#l10n.resumeObserving();
  }
  static #fixupLangCode(langCode) {
    var _langCode;
    // Use only lowercase language-codes internally, and fallback to English.
    langCode = ((_langCode = langCode) === null || _langCode === void 0 ? void 0 : _langCode.toLowerCase()) || "en-us";

    // Try to support "incompletely" specified language codes (see issue 13689).
    const PARTIAL_LANG_CODES = {
      en: "en-us",
      es: "es-es",
      fy: "fy-nl",
      ga: "ga-ie",
      gu: "gu-in",
      hi: "hi-in",
      hy: "hy-am",
      nb: "nb-no",
      ne: "ne-np",
      nn: "nn-no",
      pa: "pa-in",
      pt: "pt-pt",
      sv: "sv-se",
      zh: "zh-cn"
    };
    return PARTIAL_LANG_CODES[langCode] || langCode;
  }
  static #isRTL(lang) {
    const shortCode = lang.split("-", 1)[0];
    return ["ar", "he", "fa", "ps", "ur"].includes(shortCode);
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
function createBundle(lang, text) {
  const resource = new FluentResource(text);
  const bundle = new FluentBundle(lang);
  const errors = bundle.addResource(resource);
  if (errors.length) {
    console.error("L10n errors", errors);
  }
  return bundle;
}

/**
 * @implements {IL10n}
 */
class GenericL10n extends L10n {
  constructor(lang) {
    super({
      lang
    });
    const generateBundles = !lang ? GenericL10n.#generateBundlesFallback.bind(GenericL10n, this.getLanguage()) : GenericL10n.#generateBundles.bind(GenericL10n, "en-us", this.getLanguage());
    this._setL10n(new DOMLocalization([], generateBundles));
  }

  /**
   * Generate the bundles for Fluent.
   * @param {String} defaultLang - The fallback language to use for
   *   translations.
   * @param {String} baseLang - The base language to use for translations.
   */
  static async *#generateBundles(defaultLang, baseLang) {
    const {
      baseURL,
      paths
    } = await this.#getPaths();
    const langs = [baseLang];
    if (defaultLang !== baseLang) {
      // Also fallback to the short-format of the base language
      // (see issue 17269).
      const shortLang = baseLang.split("-", 1)[0];
      if (shortLang !== baseLang) {
        langs.push(shortLang);
      }
      langs.push(defaultLang);
    }
    for (const lang of langs) {
      const bundle = await this.#createBundle(lang, baseURL, paths);
      if (bundle) {
        yield bundle;
      }
      if (lang === "en-us") {
        yield this.#createBundleFallback(lang);
      }
    }
  }
  static async #createBundle(lang, baseURL, paths) {
    const path = paths[lang];
    if (!path) {
      return null;
    }
    const url = new URL(path, baseURL);
    const text = await fetchData(url, /* type = */"text");
    return createBundle(lang, text);
  }
  static async #getPaths() {
    try {
      const {
        href
      } = document.querySelector(`link[type="application/l10n"]`);
      const paths = await fetchData(href, /* type = */"json");
      return {
        baseURL: href.replace(/[^/]*$/, "") || "./",
        paths
      };
    } catch {}
    return {
      baseURL: "./",
      paths: Object.create(null)
    };
  }
  static async *#generateBundlesFallback(lang) {
    yield this.#createBundleFallback(lang);
  }
  static async #createBundleFallback(lang) {
    if (typeof PDFJSDev !== "undefined" && PDFJSDev.test("TESTING")) {
      throw new Error("Not implemented: #createBundleFallback");
    }
    const text = typeof PDFJSDev === "undefined" ? "# This Source Code Form is subject to the terms of the Mozilla Public\n# License, v. 2.0. If a copy of the MPL was not distributed with this\n# file, You can obtain one at http://mozilla.org/MPL/2.0/.\n\n## Main toolbar buttons (tooltips and alt text for images)\n\npdfjs-previous-button =\n    .title = Previous Page\npdfjs-previous-button-label = Previous\npdfjs-next-button =\n    .title = Next Page\npdfjs-next-button-label = Next\n\n# .title: Tooltip for the pageNumber input.\npdfjs-page-input =\n    .title = Page\n\n# Variables:\n#   $pagesCount (Number) - the total number of pages in the document\n# This string follows an input field with the number of the page currently displayed.\npdfjs-of-pages = of { $pagesCount }\n\n# Variables:\n#   $pageNumber (Number) - the currently visible page\n#   $pagesCount (Number) - the total number of pages in the document\npdfjs-page-of-pages = ({ $pageNumber } of { $pagesCount })\n\npdfjs-zoom-out-button =\n    .title = Zoom Out\npdfjs-zoom-out-button-label = Zoom Out\npdfjs-zoom-in-button =\n    .title = Zoom In\npdfjs-zoom-in-button-label = Zoom In\npdfjs-zoom-select =\n    .title = Zoom\npdfjs-presentation-mode-button =\n    .title = Switch to Presentation Mode\npdfjs-presentation-mode-button-label = Presentation Mode\npdfjs-open-file-button =\n    .title = Open File\npdfjs-open-file-button-label = Open\npdfjs-print-button =\n    .title = Print\npdfjs-print-button-label = Print\npdfjs-save-button =\n    .title = Save\npdfjs-save-button-label = Save\n\n# Used in Firefox for Android as a tooltip for the download button (“download” is a verb).\npdfjs-download-button =\n    .title = Download\n\n# Used in Firefox for Android as a label for the download button (“download” is a verb).\n# Length of the translation matters since we are in a mobile context, with limited screen estate.\npdfjs-download-button-label = Download\n\npdfjs-bookmark-button =\n    .title = Current Page (View URL from Current Page)\npdfjs-bookmark-button-label = Current Page\n\n##  Secondary toolbar and context menu\n\npdfjs-tools-button =\n    .title = Tools\n\npdfjs-tools-button-label = Tools\npdfjs-first-page-button =\n    .title = Go to First Page\npdfjs-first-page-button-label = Go to First Page\npdfjs-last-page-button =\n    .title = Go to Last Page\npdfjs-last-page-button-label = Go to Last Page\npdfjs-page-rotate-cw-button =\n    .title = Rotate Clockwise\npdfjs-page-rotate-cw-button-label = Rotate Clockwise\npdfjs-page-rotate-ccw-button =\n    .title = Rotate Counterclockwise\npdfjs-page-rotate-ccw-button-label = Rotate Counterclockwise\npdfjs-cursor-text-select-tool-button =\n    .title = Enable Text Selection Tool\npdfjs-cursor-text-select-tool-button-label = Text Selection Tool\npdfjs-cursor-hand-tool-button =\n    .title = Enable Hand Tool\npdfjs-cursor-hand-tool-button-label = Hand Tool\npdfjs-scroll-page-button =\n    .title = Use Page Scrolling\npdfjs-scroll-page-button-label = Page Scrolling\npdfjs-scroll-vertical-button =\n    .title = Use Vertical Scrolling\npdfjs-scroll-vertical-button-label = Vertical Scrolling\npdfjs-scroll-horizontal-button =\n    .title = Use Horizontal Scrolling\npdfjs-scroll-horizontal-button-label = Horizontal Scrolling\npdfjs-scroll-wrapped-button =\n    .title = Use Wrapped Scrolling\npdfjs-scroll-wrapped-button-label = Wrapped Scrolling\npdfjs-spread-none-button =\n    .title = Do not join page spreads\npdfjs-spread-none-button-label = No Spreads\npdfjs-spread-odd-button =\n    .title = Join page spreads starting with odd-numbered pages\npdfjs-spread-odd-button-label = Odd Spreads\npdfjs-spread-even-button =\n    .title = Join page spreads starting with even-numbered pages\npdfjs-spread-even-button-label = Even Spreads\n\n## Document properties dialog\n\npdfjs-document-properties-button =\n    .title = Document Properties…\npdfjs-document-properties-button-label = Document Properties…\npdfjs-document-properties-file-name = File name:\npdfjs-document-properties-file-size = File size:\n\n# Variables:\n#   $size_kb (Number) - the PDF file size in kilobytes\n#   $size_b (Number) - the PDF file size in bytes\npdfjs-document-properties-kb = { $size_kb } KB ({ $size_b } bytes)\n\n# Variables:\n#   $size_mb (Number) - the PDF file size in megabytes\n#   $size_b (Number) - the PDF file size in bytes\npdfjs-document-properties-mb = { $size_mb } MB ({ $size_b } bytes)\n\npdfjs-document-properties-title = Title:\npdfjs-document-properties-author = Author:\npdfjs-document-properties-subject = Subject:\npdfjs-document-properties-keywords = Keywords:\npdfjs-document-properties-creation-date = Creation Date:\npdfjs-document-properties-modification-date = Modification Date:\n\n# Variables:\n#   $date (Date) - the creation/modification date of the PDF file\n#   $time (Time) - the creation/modification time of the PDF file\npdfjs-document-properties-date-string = { $date }, { $time }\n\npdfjs-document-properties-creator = Creator:\npdfjs-document-properties-producer = PDF Producer:\npdfjs-document-properties-version = PDF Version:\npdfjs-document-properties-page-count = Page Count:\npdfjs-document-properties-page-size = Page Size:\npdfjs-document-properties-page-size-unit-inches = in\npdfjs-document-properties-page-size-unit-millimeters = mm\npdfjs-document-properties-page-size-orientation-portrait = portrait\npdfjs-document-properties-page-size-orientation-landscape = landscape\npdfjs-document-properties-page-size-name-a-three = A3\npdfjs-document-properties-page-size-name-a-four = A4\npdfjs-document-properties-page-size-name-letter = Letter\npdfjs-document-properties-page-size-name-legal = Legal\n\n## Variables:\n##   $width (Number) - the width of the (current) page\n##   $height (Number) - the height of the (current) page\n##   $unit (String) - the unit of measurement of the (current) page\n##   $name (String) - the name of the (current) page\n##   $orientation (String) - the orientation of the (current) page\n\npdfjs-document-properties-page-size-dimension-string = { $width } × { $height } { $unit } ({ $orientation })\npdfjs-document-properties-page-size-dimension-name-string = { $width } × { $height } { $unit } ({ $name }, { $orientation })\n\n##\n\n# The linearization status of the document; usually called \"Fast Web View\" in\n# English locales of Adobe software.\npdfjs-document-properties-linearized = Fast Web View:\npdfjs-document-properties-linearized-yes = Yes\npdfjs-document-properties-linearized-no = No\npdfjs-document-properties-close-button = Close\n\n## Print\n\npdfjs-print-progress-message = Preparing document for printing…\n\n# Variables:\n#   $progress (Number) - percent value\npdfjs-print-progress-percent = { $progress }%\n\npdfjs-print-progress-close-button = Cancel\npdfjs-printing-not-supported = Warning: Printing is not fully supported by this browser.\npdfjs-printing-not-ready = Warning: The PDF is not fully loaded for printing.\n\n## Tooltips and alt text for side panel toolbar buttons\n\npdfjs-toggle-sidebar-button =\n    .title = Toggle Sidebar\npdfjs-toggle-sidebar-notification-button =\n    .title = Toggle Sidebar (document contains outline/attachments/layers)\npdfjs-toggle-sidebar-button-label = Toggle Sidebar\npdfjs-document-outline-button =\n    .title = Show Document Outline (double-click to expand/collapse all items)\npdfjs-document-outline-button-label = Document Outline\npdfjs-attachments-button =\n    .title = Show Attachments\npdfjs-attachments-button-label = Attachments\npdfjs-layers-button =\n    .title = Show Layers (double-click to reset all layers to the default state)\npdfjs-layers-button-label = Layers\npdfjs-thumbs-button =\n    .title = Show Thumbnails\npdfjs-thumbs-button-label = Thumbnails\npdfjs-current-outline-item-button =\n    .title = Find Current Outline Item\npdfjs-current-outline-item-button-label = Current Outline Item\npdfjs-findbar-button =\n    .title = Find in Document\npdfjs-findbar-button-label = Find\npdfjs-additional-layers = Additional Layers\n\n## Thumbnails panel item (tooltip and alt text for images)\n\n# Variables:\n#   $page (Number) - the page number\npdfjs-thumb-page-title =\n    .title = Page { $page }\n\n# Variables:\n#   $page (Number) - the page number\npdfjs-thumb-page-canvas =\n    .aria-label = Thumbnail of Page { $page }\n\n## Find panel button title and messages\n\npdfjs-find-input =\n    .title = Find\n    .placeholder = Find in document…\npdfjs-find-previous-button =\n    .title = Find the previous occurrence of the phrase\npdfjs-find-previous-button-label = Previous\npdfjs-find-next-button =\n    .title = Find the next occurrence of the phrase\npdfjs-find-next-button-label = Next\npdfjs-find-highlight-checkbox = Highlight All\npdfjs-find-match-case-checkbox-label = Match Case\npdfjs-find-match-diacritics-checkbox-label = Match Diacritics\npdfjs-find-entire-word-checkbox-label = Whole Words\npdfjs-find-reached-top = Reached top of document, continued from bottom\npdfjs-find-reached-bottom = Reached end of document, continued from top\n\n# Variables:\n#   $current (Number) - the index of the currently active find result\n#   $total (Number) - the total number of matches in the document\npdfjs-find-match-count =\n    { $total ->\n        [one] { $current } of { $total } match\n       *[other] { $current } of { $total } matches\n    }\n\n# Variables:\n#   $limit (Number) - the maximum number of matches\npdfjs-find-match-count-limit =\n    { $limit ->\n        [one] More than { $limit } match\n       *[other] More than { $limit } matches\n    }\n\npdfjs-find-not-found = Phrase not found\n\n## Predefined zoom values\n\npdfjs-page-scale-width = Page Width\npdfjs-page-scale-fit = Page Fit\npdfjs-page-scale-auto = Automatic Zoom\npdfjs-page-scale-actual = Actual Size\n\n# Variables:\n#   $scale (Number) - percent value for page scale\npdfjs-page-scale-percent = { $scale }%\n\n## PDF page\n\n# Variables:\n#   $page (Number) - the page number\npdfjs-page-landmark =\n    .aria-label = Page { $page }\n\n## Loading indicator messages\n\npdfjs-loading-error = An error occurred while loading the PDF.\npdfjs-invalid-file-error = Invalid or corrupted PDF file.\npdfjs-missing-file-error = Missing PDF file.\npdfjs-unexpected-response-error = Unexpected server response.\npdfjs-rendering-error = An error occurred while rendering the page.\n\n## Annotations\n\n# Variables:\n#   $date (Date) - the modification date of the annotation\n#   $time (Time) - the modification time of the annotation\npdfjs-annotation-date-string = { $date }, { $time }\n\n# .alt: This is used as a tooltip.\n# Variables:\n#   $type (String) - an annotation type from a list defined in the PDF spec\n# (32000-1:2008 Table 169 – Annotation types).\n# Some common types are e.g.: \"Check\", \"Text\", \"Comment\", \"Note\"\npdfjs-text-annotation-type =\n    .alt = [{ $type } Annotation]\n\n## Password\n\npdfjs-password-label = Enter the password to open this PDF file.\npdfjs-password-invalid = Invalid password. Please try again.\npdfjs-password-ok-button = OK\npdfjs-password-cancel-button = Cancel\npdfjs-web-fonts-disabled = Web fonts are disabled: unable to use embedded PDF fonts.\n\n## Editing\n\npdfjs-editor-free-text-button =\n    .title = Text\npdfjs-editor-free-text-button-label = Text\npdfjs-editor-ink-button =\n    .title = Draw\npdfjs-editor-ink-button-label = Draw\npdfjs-editor-stamp-button =\n    .title = Add or edit images\npdfjs-editor-stamp-button-label = Add or edit images\npdfjs-editor-highlight-button =\n    .title = Highlight\npdfjs-editor-highlight-button-label = Highlight\npdfjs-highlight-floating-button1 =\n    .title = Highlight\n    .aria-label = Highlight\npdfjs-highlight-floating-button-label = Highlight\n\n## Remove button for the various kind of editor.\n\npdfjs-editor-remove-ink-button =\n    .title = Remove drawing\npdfjs-editor-remove-freetext-button =\n    .title = Remove text\npdfjs-editor-remove-stamp-button =\n    .title = Remove image\npdfjs-editor-remove-highlight-button =\n    .title = Remove highlight\n\n##\n\n# Editor Parameters\npdfjs-editor-free-text-color-input = Color\npdfjs-editor-free-text-size-input = Size\npdfjs-editor-ink-color-input = Color\npdfjs-editor-ink-thickness-input = Thickness\npdfjs-editor-ink-opacity-input = Opacity\npdfjs-editor-stamp-add-image-button =\n    .title = Add image\npdfjs-editor-stamp-add-image-button-label = Add image\n# This refers to the thickness of the line used for free highlighting (not bound to text)\npdfjs-editor-free-highlight-thickness-input = Thickness\npdfjs-editor-free-highlight-thickness-title =\n    .title = Change thickness when highlighting items other than text\n\npdfjs-free-text =\n    .aria-label = Text Editor\npdfjs-free-text-default-content = Start typing…\npdfjs-ink =\n    .aria-label = Draw Editor\npdfjs-ink-canvas =\n    .aria-label = User-created image\n\n## Alt-text dialog\n\n# Alternative text (alt text) helps when people can't see the image.\npdfjs-editor-alt-text-button-label = Alt text\n\npdfjs-editor-alt-text-edit-button-label = Edit alt text\npdfjs-editor-alt-text-dialog-label = Choose an option\npdfjs-editor-alt-text-dialog-description = Alt text (alternative text) helps when people can’t see the image or when it doesn’t load.\npdfjs-editor-alt-text-add-description-label = Add a description\npdfjs-editor-alt-text-add-description-description = Aim for 1-2 sentences that describe the subject, setting, or actions.\npdfjs-editor-alt-text-mark-decorative-label = Mark as decorative\npdfjs-editor-alt-text-mark-decorative-description = This is used for ornamental images, like borders or watermarks.\npdfjs-editor-alt-text-cancel-button = Cancel\npdfjs-editor-alt-text-save-button = Save\npdfjs-editor-alt-text-decorative-tooltip = Marked as decorative\n\n# .placeholder: This is a placeholder for the alt text input area\npdfjs-editor-alt-text-textarea =\n    .placeholder = For example, “A young man sits down at a table to eat a meal”\n\n## Editor resizers\n## This is used in an aria label to help to understand the role of the resizer.\n\npdfjs-editor-resizer-label-top-left = Top left corner — resize\npdfjs-editor-resizer-label-top-middle = Top middle — resize\npdfjs-editor-resizer-label-top-right = Top right corner — resize\npdfjs-editor-resizer-label-middle-right = Middle right — resize\npdfjs-editor-resizer-label-bottom-right = Bottom right corner — resize\npdfjs-editor-resizer-label-bottom-middle = Bottom middle — resize\npdfjs-editor-resizer-label-bottom-left = Bottom left corner — resize\npdfjs-editor-resizer-label-middle-left = Middle left — resize\n\n## Color picker\n\n# This means \"Color used to highlight text\"\npdfjs-editor-highlight-colorpicker-label = Highlight color\n\npdfjs-editor-colorpicker-button =\n    .title = Change color\npdfjs-editor-colorpicker-dropdown =\n    .aria-label = Color choices\npdfjs-editor-colorpicker-yellow =\n    .title = Yellow\npdfjs-editor-colorpicker-green =\n    .title = Green\npdfjs-editor-colorpicker-blue =\n    .title = Blue\npdfjs-editor-colorpicker-pink =\n    .title = Pink\npdfjs-editor-colorpicker-red =\n    .title = Red\n\n## Show all highlights\n## This is a toggle button to show/hide all the highlights.\n\npdfjs-editor-highlight-show-all-button-label = Show all\npdfjs-editor-highlight-show-all-button =\n    .title = Show all\n" : PDFJSDev.eval("DEFAULT_FTL");
    return createBundle(lang, text);
  }
}

export { GenericL10n };
