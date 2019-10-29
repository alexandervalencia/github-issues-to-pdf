module.exports = {
  env: {
    es6: true,
    node: true,
  },
  extends: ['prettier', 'node'],
  plugins: ['prettier'],
  rules: {
    'prettier/prettier': [
      'error',
      {
        singleQuote: true,
        trailingComma: 'es5',
      },
    ],
    'import/no-commonjs': 'off',
    'import/no-nodejs-modules': 'off',
    'no-sync': 'off',
  },
};
