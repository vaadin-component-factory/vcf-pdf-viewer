import {defineConfig} from "eslint/config";
import {includeIgnoreFile} from "@eslint/compat";
import {fileURLToPath} from "node:url";

const gitignorePath = fileURLToPath(new URL(".gitignore", import.meta.url));

export default defineConfig([
    includeIgnoreFile(gitignorePath, "Imported .gitignore patterns"),
    {
        // your overrides
    },
]);