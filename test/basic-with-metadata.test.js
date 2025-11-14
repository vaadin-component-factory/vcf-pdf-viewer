import { html, fixture, expect, oneEvent } from "@open-wc/testing";
import "../src/vcf-pdf-viewer.js";

describe("<vcf-pdf-viewer>", () => {
  let el;

  beforeEach(async () => {
    el = await fixture(html`<vcf-pdf-viewer src="pdf-files/vaadin.pdf" />`);
  });

  it("should read title when file available", async () => {
    await el.updateComplete;
    const ev = await oneEvent(el, "document-loaded");

    expect(ev).to.be.ok;

    const title = el.shadowRoot.querySelector("#title");
    expect(title.textContent).to.be.equal(
      "2018-04-05 Vaadin Insights.key - vaadin.pdf",
    );
  });
});
