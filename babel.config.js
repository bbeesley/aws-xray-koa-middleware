module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        targets: {
          node: '12.13.0',
        },
      },
    ],
    ['@babel/preset-typescript'],
  ],
};
