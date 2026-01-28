[![npm version](https://badgen.net/npm/v/@vaadin-component-factory/vcf-pdf-viewer)](https://www.npmjs.com/package/@vaadin-component-factory/vcf-pdf-viewer)
[![Published on Vaadin Directory](https://img.shields.io/badge/Vaadin%20Directory-published-00b4f0.svg)](https://vaadin.com/directory/component/vaadin-component-factoryvcf-pdf-viewer)
[![Stars on vaadin.com/directory](https://img.shields.io/vaadin-directory/star/vaadin-component-factoryvcf-pdf-viewer.svg)](https://vaadin.com/directory/component/vaadin-component-factoryvcf-pdf-viewer)

# &lt;vcf-pdf-viewer&gt;

[&lt;vcf-pdf-viewer&gt;](https://github.com/vaadin-component-factory/vcf-pdf-viewer) is a Web Component that provides a PDF viewer functionality. The component is developed in Lit
and uses Mozilla's [PDF.js](https://github.com/mozilla/pdf.js)

This component is part of Vaadin Component Factory.

## Running demo

1. Fork the `vcf-pdf-viewer` repository and clone it locally.

1. Make sure you have [npm](https://www.npmjs.com/) installed.

1. When in the `vcf-pdf-viewer` directory, run `npm install` to install dependencies.

1. Run `npm start` to open the demo.

## Development & publishing

DO NOT run `npm run build` before publishing a new release.

The `pdfjs/dist` files committed in this repository are manually edited to ensure correct module resolution. Running the build script will overwrite these files, generating incompatible file paths that will cause the component to fail when trying to resolve dependencies.

Only run `npm run build` if you are intentionally modifying the `pdfjs` dependency and are prepared to manually fix the resulting path references.

## Contributing

To contribute to the component, please read [the guideline](https://github.com/vaadin/vaadin-core/blob/master/CONTRIBUTING.md) first.

## License

Apache License 2.0.