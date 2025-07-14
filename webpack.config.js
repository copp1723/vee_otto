const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const webpack = require('webpack');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';

  return {
    entry: './frontend/index.tsx',
    output: {
      path: path.resolve(__dirname, 'dist/dashboard'),
      filename: isProduction ? '[name].[contenthash].js' : '[name].js',
      clean: true,
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js'],
      alias: {
        '@': path.resolve(__dirname, 'frontend'),
        '@core': path.resolve(__dirname, 'core'),
        '@platforms': path.resolve(__dirname, 'platforms')
      },
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: [
            {
              loader: 'ts-loader',
              options: {
                transpileOnly: true, // Skip type checking for now
                compilerOptions: {
                  noEmit: false
                }
              }
            }
          ],
          exclude: /node_modules/,
        },
        {
          test: /\.module\.css$/,
          use: [
            isProduction ? MiniCssExtractPlugin.loader : 'style-loader',
            {
              loader: 'css-loader',
              options: {
                modules: {
                  localIdentName: isProduction 
                    ? '[hash:base64:8]' 
                    : '[name]__[local]__[hash:base64:5]',
                },
              },
            },
          ],
        },
        {
          test: /\.css$/,
          exclude: /\.module\.css$/,
          use: [
            isProduction ? MiniCssExtractPlugin.loader : 'style-loader',
            'css-loader',
          ],
        },
      ],
    },
    plugins: [
      new webpack.DefinePlugin({
        'process.env': {
          NODE_ENV: JSON.stringify(isProduction ? 'production' : 'development'),
          REACT_APP_API_URL: JSON.stringify(process.env.REACT_APP_API_URL || '')
        }
      }),
      new HtmlWebpackPlugin({
        template: './frontend/public/index.html',
        title: 'vAuto Intelligence Suite',
      }),
      ...(isProduction ? [new MiniCssExtractPlugin({
        filename: '[name].[contenthash].css',
      })] : []),
    ],
    devServer: {
      static: {
        directory: path.join(__dirname, 'dist/dashboard'),
      },
      compress: true,
      port: 8080,
      historyApiFallback: true,
      hot: true,
    },
    optimization: {
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\/\\]node_modules[\/\\]/,
            name: 'vendors',
            chunks: 'all',
          },
          common: {
            name: 'common',
            minChunks: 2,
            chunks: 'all',
            enforce: true
          }
        }
      },
      usedExports: true,
      sideEffects: false,
    },
  };
};
