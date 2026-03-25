const path = require('path');

function resolvePlugin(name) {
  const searchPaths = [
    __dirname,
    process.cwd(),
    process.env.VUE_CLI_CONTEXT,
    process.env.UNI_INPUT_DIR,
    path.join(__dirname, 'node_modules'),
    process.env.VUE_CLI_CONTEXT ? path.join(process.env.VUE_CLI_CONTEXT, 'node_modules') : null
  ].filter(Boolean);

  return require.resolve(name, { paths: searchPaths });
}

module.exports = {
  plugins: [
    resolvePlugin('@babel/plugin-proposal-optional-chaining'),
    resolvePlugin('@babel/plugin-proposal-nullish-coalescing-operator'),
    resolvePlugin('@babel/plugin-proposal-numeric-separator')
  ]
};
