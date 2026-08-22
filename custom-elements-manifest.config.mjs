/**
 * Configuration for `@custom-elements-manifest/analyzer` (`npm run analyze`).
 *
 * Several things have to be corrected by hand here, because the analyzer
 * cannot derive them from this component's source:
 *
 * - `globs` is narrowed to the component itself. The default glob
 *   (`**\/*.{js,ts,tsx}`) also picks up the vendored pdf.js sources under
 *   `src/` and `web/`, which produced a 2 MB manifest of 232 modules, only one
 *   of which describes a custom element.
 * - `privacy` of the internal members. The analyzer only infers privacy from
 *   `#private` fields and from explicit JSDoc, so without the first plugin
 *   below every `_` and `__` prefixed member of the component is reported as
 *   public API, and the internal reactive properties are reported as
 *   attributes.
 * - The attribute names. Lit lowercases the attribute name it derives from a
 *   property name, but the analyzer keeps the property casing, so it reported
 *   `toolbarOnlyFilename` where the element actually observes
 *   `toolbaronlyfilename`.
 *
 * The tag name is set by the `@tagname` JSDoc tag on the class: the element is
 * registered as `customElements.define(PdfViewerElement.is, ...)`, and the
 * analyzer reads the tag name only from a literal first argument. The
 * `thumbnail-clicked` event is declared with `@fires` for the same kind of
 * reason: it is dispatched on a local alias of the element rather than on
 * `this`, so the analyzer does not see it.
 */

/**
 * Marks members whose name starts with an underscore as private, following the
 * convention used throughout the component, and drops the attributes that were
 * derived from them.
 */
function underscoredMembersArePrivate() {
  return {
    name: 'vcf-pdf-viewer/underscored-members-are-private',
    packageLinkPhase({ customElementsManifest }) {
      customElementsManifest.modules?.forEach((module) => {
        module.declarations?.forEach((declaration) => {
          declaration.members?.forEach((member) => {
            if (member.name?.startsWith('_')) {
              member.privacy = 'private';
            }
          });

          if (declaration.attributes) {
            declaration.attributes = declaration.attributes.filter(
              (attribute) => !attribute.fieldName?.startsWith('_') && !attribute.name?.startsWith('_'),
            );
          }
        });
      });
    },
  };
}

/**
 * Lowercases the attribute names that Lit derives from a property name. An
 * attribute set explicitly through `attribute: 'my-attr'` differs from its
 * field name and is left alone.
 */
function lowercaseImplicitAttributes() {
  return {
    name: 'vcf-pdf-viewer/lowercase-implicit-attributes',
    packageLinkPhase({ customElementsManifest }) {
      customElementsManifest.modules?.forEach((module) => {
        module.declarations?.forEach((declaration) => {
          declaration.attributes?.forEach((attribute) => {
            if (attribute.name && attribute.name === attribute.fieldName) {
              attribute.name = attribute.name.toLowerCase();
            }
          });
        });
      });
    },
  };
}

export default {
  globs: ['src/vcf-pdf-viewer.js'],
  litelement: true,
  plugins: [underscoredMembersArePrivate(), lowercaseImplicitAttributes()],
};
