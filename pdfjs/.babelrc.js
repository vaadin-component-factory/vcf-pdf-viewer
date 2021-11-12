module.exports = {
    presets: [
      [
        '@babel/preset-env',
        {
          modules: false,
          useBuiltIns: 'entry',
          "corejs": "^3.19.0",
          targets: {
            ie: 11
          }
        }
      ]
    ],
    plugins: [
      [
        '@babel/plugin-proposal-optional-chaining',
        '@babel/plugin-proposal-nullish-coalescing-operator',
        '@babel/plugin-proposal-logical-assignment-operators',
        '@babel/plugin-transform-runtime', 
        {
          "corejs": 3,
        }
      ]
    ]
};