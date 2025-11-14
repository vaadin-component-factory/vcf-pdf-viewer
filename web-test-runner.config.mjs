import { playwrightLauncher } from "@web/test-runner-playwright";
import * as path from "node:path";
import * as fs from "node:fs";

export default {
  files: "test/**/*.test.js",
  nodeResolve: true,
  browserStartTimeout: 60000,
  browsers: [playwrightLauncher({ product: "chromium" })],
  testFramework: {
    config: {
      timeout: 5000,
    },
  },
  middleware: [
    function servePdfs(ctx, next) {
      const { url } = ctx.request;
      if (url.startsWith("/pdf-files/")) {
        const filePath = path.join(process.cwd(), "test", url);
        if (fs.existsSync(filePath)) {
          ctx.response.body = fs.readFileSync(filePath);
          ctx.response.type = "application/pdf";
          return;
        }
      }
      return next();
    },
  ],
};
