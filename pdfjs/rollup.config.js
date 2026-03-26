import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import babel from '@rollup/plugin-babel';
import alias from '@rollup/plugin-alias';
import replace from '@rollup/plugin-replace';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootPath = path.resolve(__dirname, '..');

// Read the default English translations so they can be bundle directly into the JS
const defaultFtlPath = path.resolve(__dirname, '../l10n/en-US/viewer.ftl');
const defaultFtlContent = fs.readFileSync(defaultFtlPath, 'utf-8');

const config = [
  {
    input: [
      './src/pdf.js',
      './web/pdf_viewer.js',
      './web/ui_utils.js',
      './web/event_utils.js',
      './web/pdf_link_service.js',
      './web/pdf_thumbnail_viewer.js',
      './web/pdf_rendering_queue.js',
      './web/genericl10n.js',
      './src/core/worker.js',
      './src/display/node_stream.js'
    ],
    output: [
      {
        dir: "pdfjs/dist",
        name: 'PDFJS',
        chunkFileNames: '[name].js'
      },
    ],
    plugins: [
      alias({
        // Path aliases taken from the PDF.js library v4.2.67 tsconfig.json:
        // https://github.com/mozilla/pdf.js/blob/v4.2.67/tsconfig.json
        entries: [
          { find: 'pdfjs-lib', replacement: path.resolve(rootPath, 'src/pdf') },
          { find: 'display-fetch_stream', replacement: path.resolve(rootPath, 'src/display/fetch_stream') },
          { find: 'display-network', replacement: path.resolve(rootPath, 'src/display/network') },
          { find: 'display-node_stream', replacement: path.resolve(rootPath, 'src/display/node_stream') },
          { find: 'display-node_utils', replacement: path.resolve(rootPath, 'src/display/node_utils') },
          { find: 'web-null_l10n', replacement: path.resolve(rootPath, 'web/genericl10n') },
          { find: 'pdfjs/pdf.worker.js', replacement: path.resolve(rootPath, 'src/pdf.worker.js') },
          { find: 'fluent-bundle', replacement: path.resolve(rootPath, 'node_modules/@fluent/bundle/esm/index.js') },
          { find: 'fluent-dom', replacement: path.resolve(rootPath, 'node_modules/@fluent/dom/esm/index.js') },
        ]
      }),
      replace({
        preventAssignment: true,
        delimiters: ['', ''],
        values: {
          // genericl10n.js normally tries to fetch `../l10n/en-US/viewer.ftl`
          // over HTTP at runtime. This fails Flow part
          // because the static assets path is not what it expects.
          // By replacing the fetch call with the actual string content,
          // the translations are bundled directly into the JS.
          'await fetchData(\n            new URL("../l10n/en-US/viewer.ftl", window.location.href),\n            /* type = */ "text"\n          )': JSON.stringify(defaultFtlContent),
          'await fetchData(\r\n            new URL("../l10n/en-US/viewer.ftl", window.location.href),\r\n            /* type = */ "text"\r\n          )': JSON.stringify(defaultFtlContent)
        }
      }),
      resolve({
        browser: true,
        preferBuiltins: false
      }),
      commonjs(),
      babel({
        plugins: [
          '@babel/plugin-transform-runtime',
          '@babel/plugin-proposal-optional-chaining',
          '@babel/plugin-proposal-nullish-coalescing-operator',
          '@babel/plugin-proposal-logical-assignment-operators',
        ],
        babelHelpers: 'runtime',
        exclude: 'node_modules/**',
        extensions: ['.js', '.jsx', '.ts', '.tsx']
      })
    ]
  }
];

export default config;