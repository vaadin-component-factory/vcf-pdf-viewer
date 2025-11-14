import { html, fixture, expect, oneEvent } from "@open-wc/testing";
import "../src/vcf-pdf-viewer.js";

describe("<vcf-pdf-viewer>", () => {
  let el;

  beforeEach(async () => {
    el = await fixture(
      html`<vcf-pdf-viewer src="pdf-files/example-invoice.pdf" />`,
    );
  });

  it("should read title when file available", () => {
    const title = el.shadowRoot.querySelector("#title");
    expect(title.textContent).to.be.equal("example-invoice.pdf");
  });

  it("page controls should be visible", async () => {
    await el.updateComplete;
    /* wait for document to be loaded before checking page buttons */
    await oneEvent(el, "document-loaded");

    const previousPage = el.querySelector("#previousPage");
    const nextPage = el.querySelector("#nextPage");
    const totalPages = el.shadowRoot.querySelector("#totalPages");
    const currentPage = el.querySelector("#currentPage");

    expect(previousPage.hasAttribute("disabled")).to.be.true;
    expect(nextPage.hasAttribute("disabled")).to.be.true;
    expect(totalPages.textContent).to.be.equal("1");
    expect(currentPage.localName).to.be.equal("vaadin-text-field");
    expect(currentPage.value).to.be.equal("1");
  });
});
