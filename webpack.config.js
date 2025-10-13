const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const Dotenv = require('dotenv-webpack');

const isProduction = process.env.NODE_ENV === 'production';

module.exports = {
  mode: isProduction ? 'production' : 'development',
  devtool: isProduction ? 'source-map' : 'eval-source-map',
  entry: {
    main: './src/renderer/app.js',
    vendor: [
      './src/renderer/dom-utils.js',
      './src/renderer/common-utils.js',
      './src/renderer/error-manager.js',
      './src/renderer/logger.js',
      './src/renderer/auth-manager.js',
      './src/renderer/progress-ui.js',
      './src/renderer/updater-manager.js',
      './src/renderer/ui-helpers.js',
      './src/renderer/settings-manager.js',
      './src/renderer/auth-config.js',
      './src/renderer/secure-utils.js',
      './src/renderer/secure-logger.js',
      './src/renderer/network-manager.js',
      './src/renderer/auth-manager-v2.js',
      './src/renderer/auth-tester.js'
    ]
  },
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
      'process.env.APP_VERSION': JSON.stringify(process.env.npm_package_version || '1.0.0'),
    }),
    new HtmlWebpackPlugin({
      template: './src/renderer/index.html',
      filename: 'index.html',
      minify: isProduction ? {
        removeComments: true,
        collapseWhitespace: true,
        removeRedundantAttributes: true,
        useShortDoctype: true,
        removeEmptyAttributes: true,
        removeStyleLinkTypeAttributes: true,
        keepClosingSlash: true,
        minifyJS: true,
        minifyCSS: true,
        minifyURLs: true,
      } : false,
    }),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: 'assets/**/*',
          to: 'assets/[name][ext]',
        },
      ],
    }),
    new Dotenv({
      path: './.env',
      safe: true,
      systemvars: true,
      silent: true,
      defaults: false,
    }),
  ],
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendor',
          chunks: 'all',
        },
      },
    },
  },
  performance: {
    hints: isProduction ? 'warning' : false,
    maxEntrypointSize: 512000,
    maxAssetSize: 512000,
  },
  resolve: {
    extensions: ['.js', '.json'],
  },
  target: 'electron-renderer',
};
