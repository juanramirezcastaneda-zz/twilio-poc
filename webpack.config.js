const path = require('path');

module.exports = {
  entry: './public/index.js',
  mode: 'development',
  output: {
    filename: 'main.js',
    path: path.resolve(__dirname, 'public'),
  },
};
