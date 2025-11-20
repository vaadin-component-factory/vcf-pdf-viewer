import { html, fixture, expect, oneEvent } from "@open-wc/testing";
import "../src/vcf-pdf-viewer.js";

describe("<vcf-pdf-viewer>", () => {
  let el;

  beforeEach(async () => {
    el = await fixture(html`<vcf-pdf-viewer src="pdf-files/bitcoin.pdf" />`);
  });

  it("should read title when file available", async () => {
    await el.updateComplete;
    await oneEvent(el, "document-loaded");

    const title = el.shadowRoot.querySelector("#title");
    expect(title.textContent).to.be.equal("bitcoin.pdf");
  });

  it("multi page controls should be visible", async () => {
    await el.updateComplete;
    /* wait for document to be loaded before checking page buttons */
    await oneEvent(el, "document-loaded");

    const previousPage = el.querySelector("#previousPage");
    const nextPage = el.querySelector("#nextPage");
    const totalPages = el.shadowRoot.querySelector("#totalPages");
    const currentPage = el.querySelector("#currentPage");

    expect(previousPage.hasAttribute("disabled")).to.be.true;
    expect(nextPage.hasAttribute("disabled")).to.be.false;
    expect(totalPages.textContent).to.be.equal("9");
    expect(currentPage.localName).to.be.equal("vaadin-text-field");
    expect(currentPage.value).to.be.equal("1");
  });

  it("page navigations should work", async () => {
    await el.updateComplete;
    await oneEvent(el, "document-loaded");

    const previousPage = el.querySelector("#previousPage");
    const nextPage = el.querySelector("#nextPage");
    const currentPage = el.querySelector("#currentPage");

    setTimeout(function () {
      nextPage.click();
      expect(currentPage.value).to.be.equal("2");
      expect(previousPage.disabled).to.be.false;

      previousPage.click();
      expect(currentPage.value).to.be.equal(1);
      expect(previousPage.disabled).to.be.true;

      previousPage.click();
      expect(currentPage.value).to.be.equal(1);
      expect(previousPage.disabled).to.be.true;
      for (let i = 0; i < 8; i++) {
        nextPage.click();
      }
      expect(currentPage.value).to.be.equal(9);
      expect(previousPage.disabled).to.be.false;
      expect(nextPage.disabled).to.be.true;

      nextPage.click();
      expect(currentPage.value).to.be.equal(9);
      expect(nextPage.disabled).to.be.true;
    }, 1000);
  });
});
