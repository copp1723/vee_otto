const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const webpack = require('webpack');
const fs = require('fs');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';
  const projectRoot = path.resolve(__dirname);
  const frontendPublicPath = path.join(projectRoot, 'frontend', 'public');
  const frontendIndexPath = path.join(projectRoot, 'frontend', 'index.tsx');

  // Check if required files exist
  const frontendPublicExists = fs.existsSync(frontendPublicPath);
  const frontendIndexExists = fs.existsSync(frontendIndexPath);

  console.log('🔧 Webpack Configuration:');
  console.log(`  Project Root: ${projectRoot}`);
  console.log(`  Frontend Public Path: ${frontendPublicPath} (exists: ${frontendPublicExists})`);
  console.log(`  Frontend Index Path: ${frontendIndexPath} (exists: ${frontendIndexExists})`);

  if (!frontendIndexExists) {
    throw new Error(`Frontend entry point not found: ${frontendIndexPath}`);
  }

  const plugins = [
    new webpack.DefinePlugin({
      'process.env': {
        NODE_ENV: JSON.stringify(isProduction ? 'production' : 'development'),
        REACT_APP_API_URL: JSON.stringify(process.env.REACT_APP_API_URL || '')
      }
    })
  ];

  // Add HtmlWebpackPlugin with fallback template
  if (frontendPublicExists && fs.existsSync(path.join(frontendPublicPath, 'index.html'))) {
    plugins.push(new HtmlWebpackPlugin({
      template: path.join(frontendPublicPath, 'index.html'),
      title: 'vAuto Intelligence Suite',
    }));
  } else {
    // Create a minimal HTML template if the public directory doesn't exist
    console.log('⚠️ Creating fallback HTML template');
    plugins.push(new HtmlWebpackPlugin({
      template: 'data:text/html,<!DOCTYPE html><html><head><title>vAuto Intelligence Suite</title></head><body><div id="root"></div></body></html>',
      title: 'vAuto Intelligence Suite',
    }));
  }

  // Add CopyWebpackPlugin only if the public directory exists and has files to copy
  if (frontendPublicExists) {
    const publicFiles = fs.readdirSync(frontendPublicPath).filter(file => file !== 'index.html');
    if (publicFiles.length > 0) {
      console.log(`📁 Copying ${publicFiles.length} files from frontend/public`);
      plugins.push(new CopyWebpackPlugin({
        patterns: [
          { 
            from: frontendPublicPath,
            to: '.', 
            globOptions: {
              ignore: ['**/index.html']
            },
            noErrorOnMissing: true
          }
        ]
      }));
    } else {
      console.log('📁 No files to copy from frontend/public (only index.html exists)');
    }
  } else {
    console.log('⚠️ frontend/public directory not found, skipping file copy');
  }

  // Add CSS extraction plugin for production
  if (isProduction) {
    plugins.push(new MiniCssExtractPlugin({
      filename: '[name].[contenthash].css',
    }));
  }

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
    plugins,
    devServer: {
      static: [
        {
          directory: path.join(__dirname, 'dist/dashboard'),
        },
        ...(frontendPublicExists ? [{
          directory: frontendPublicPath,
        }] : [])
      ],
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
