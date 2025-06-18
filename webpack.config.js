const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'production',
  entry: {
    'content/content': './src/content/content.js',
    'background/background': './src/background/background.js',
    'popup/popup': './src/popup/popup.js',
    'popup/daily-stats': './src/popup/daily-stats.js'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js'
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'manifest.json', to: 'manifest.json' },
        { from: 'src/popup/popup.html', to: 'popup/popup.html' },
        { from: 'src/popup/styles.css', to: 'popup/styles.css' },
        { from: 'src/popup/daily-stats.css', to: 'popup/daily-stats.css' },
        { from: 'src/content/content.css', to: 'content/content.css' },
        { from: 'icons', to: 'icons' },
        { from: 'node_modules/chart.js/dist/chart.umd.js', to: 'lib/chart.umd.js' }
      ],
    }),
  ],
}; 