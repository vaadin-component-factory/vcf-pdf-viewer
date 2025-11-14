import { html, fixture, expect } from "@open-wc/testing";
import "../src/vcf-pdf-viewer.js";

describe("<vcf-pdf-viewer>", () => {
  let el;

  beforeEach(async () => {
    el = await fixture(html`<vcf-pdf-viewer />`);
  });

  it("should have proper tag name", async () => {
    await expect(el.localName).to.be.equal("vcf-pdf-viewer");
  });

  it("should not expose class name globally", () => {
    expect(window.PdfViewerElement).not.to.be.ok;
  });

  it("should have a valid version number", () => {
    expect(el.constructor.version).to.match(
      /^(\d+\.)?(\d+\.)?(\*|\d+)(-(alpha|beta)\d+)?$/,
    );
  });

  it("by default should be undefined", () => {
    expect(el.src).to.be.undefined;
  });

  it("should read PDF when there is no file", () => {
    const title = el.shadowRoot.querySelector("#title");
    expect(title.textContent).to.be.equal("PDF");
  });

  it('should update the "src" when set from outside', () => {
    el.src = "pdf-files/example-invoice.pdf";
    expect(el.src).to.equal("pdf-files/example-invoice.pdf");
  });
});
