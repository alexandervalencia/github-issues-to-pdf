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
  },
};
