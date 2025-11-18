import { html, fixture, expect } from "@open-wc/testing";
import { setViewport } from "@web/test-runner-commands";
import "../src/vcf-pdf-viewer.js";

describe("<vcf-pdf-viewer>", () => {
  let el;

  beforeEach(async () => {
    el = await fixture(html`<vcf-pdf-viewer src="pdf-files/vaadin.pdf" />`);
  });

  it("should have proper tag name", async () => {
    await expect(el.localName).to.be.equal("vcf-pdf-viewer");
  });

  it("toolbar should have class small-size for small viewport (<600)", async () => {
    await setViewport({ width: 500, height: 800 });
    const toolbar = el.shadowRoot.querySelector("#toolbar");
    expect(toolbar).to.not.be.null;
    expect(toolbar.classList.toString()).to.include("small-size");
  });
});
