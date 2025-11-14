import { html, fixture, expect, oneEvent } from "@open-wc/testing";
import "../src/vcf-pdf-viewer.js";

describe("<vcf-pdf-viewer>", () => {
  let el;

  beforeEach(async () => {
    el = await fixture(html`<vcf-pdf-viewer src="pdf-files/vaadin.pdf" />`);
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

  it("by default src should be present", () => {
    expect(el.src).to.be.equal("pdf-files/vaadin.pdf");
  });

  it("should read title when file available", () => {
    const title = el.shadowRoot.querySelector("#title");
    expect(title.textContent).to.be.equal("vaadin.pdf");
  });
});
