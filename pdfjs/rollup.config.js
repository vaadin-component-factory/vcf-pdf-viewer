import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import babel from '@rollup/plugin-babel';

const config = [
  {
    input: ['./src/pdf.js', './web/pdf_viewer.js', './web/ui_utils.js', './web/pdf_link_service.js', './web/pdf_thumbnail_viewer.js',
      './web/pdf_rendering_queue.js', './web/l10n_utils.js', './src/core/worker.js', './src/display/node_stream.js'],
    output: [
      {
        dir: "pdfjs/dist",
        name: 'PDFJS',
        chunkFileNames: '[name].js'
      },

    ],
    plugins: [
      // The 'node-resolve' plugin allows Rollup to resolve bare module imports like
      // in `import pathToRegexp from 'path-to-regexp'`
      resolve(),
      // The 'commonjs' plugin allows Rollup to convert CommonJS exports on the fly
      // into ES module imports (so that `import pathToRegexp from 'path-to-regexp'`
      // works even though the exports are done via `module.exports = {}`)
      commonjs(),
      babel({
        plugins: [
          '@babel/plugin-transform-runtime', 
          '@babel/plugin-proposal-optional-chaining',
          '@babel/plugin-proposal-nullish-coalescing-operator',
          '@babel/plugin-proposal-logical-assignment-operators',
        ],
        babelHelpers: 'runtime'
      })]
  }];

export default config;