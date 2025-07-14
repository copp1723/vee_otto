const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const webpack = require('webpack');
const fs = require('fs');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';
  
  // Ensure we always use the correct project root regardless of where webpack is run from
  const projectRoot = path.resolve(__dirname);
  const frontendPath = path.join(projectRoot, 'frontend');
  const frontendPublicPath = path.join(frontendPath, 'public');
  const frontendIndexPath = path.join(frontendPath, 'index.tsx');

  // Check if required files exist
  const frontendPublicExists = fs.existsSync(frontendPublicPath);
  const frontendIndexExists = fs.existsSync(frontendIndexPath);

  console.log('🔧 Webpack Configuration:');
  console.log(`  Working Directory: ${process.cwd()}`);
  console.log(`  Config File Location: ${__dirname}`);
  console.log(`  Project Root: ${projectRoot}`);
  console.log(`  Frontend Path: ${frontendPath}`);
  console.log(`  Frontend Public Path: ${frontendPublicPath} (exists: ${frontendPublicExists})`);
  console.log(`  Frontend Index Path: ${frontendIndexPath} (exists: ${frontendIndexExists})`);

  if (!frontendIndexExists) {
    console.error(`❌ Frontend entry point not found: ${frontendIndexPath}`);
    console.error(`Available files in frontend directory:`);
    if (fs.existsSync(frontendPath)) {
      console.error(fs.readdirSync(frontendPath));
    } else {
      console.error(`Frontend directory doesn't exist: ${frontendPath}`);
    }
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
  const htmlTemplatePath = path.join(frontendPublicPath, 'index.html');
  if (frontendPublicExists && fs.existsSync(htmlTemplatePath)) {
    console.log(`📄 Using HTML template: ${htmlTemplatePath}`);
    plugins.push(new HtmlWebpackPlugin({
      template: htmlTemplatePath,
      title: 'vAuto Intelligence Suite',
    }));
  } else {
    // Create a minimal HTML template if the public directory doesn't exist
    console.log('⚠️ Creating fallback HTML template (frontend/public/index.html not found)');
    plugins.push(new HtmlWebpackPlugin({
      templateContent: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>vAuto Intelligence Suite</title>
        </head>
        <body>
          <div id="root"></div>
        </body>
        </html>
      `,
      title: 'vAuto Intelligence Suite',
    }));
  }

  // Add CopyWebpackPlugin only if the public directory exists and has files to copy
  if (frontendPublicExists) {
    try {
      const publicFiles = fs.readdirSync(frontendPublicPath).filter(file => file !== 'index.html');
      if (publicFiles.length > 0) {
        console.log(`📁 Copying ${publicFiles.length} files from frontend/public:`, publicFiles);
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
    } catch (error) {
      console.warn('⚠️ Error reading frontend/public directory:', error.message);
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
    entry: path.resolve(frontendIndexPath),
    output: {
      path: path.resolve(projectRoot, 'dist/dashboard'),
      filename: isProduction ? '[name].[contenthash].js' : '[name].js',
      clean: true,
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js'],
      alias: {
        '@': path.resolve(projectRoot, 'frontend'),
        '@core': path.resolve(projectRoot, 'core'),
        '@platforms': path.resolve(projectRoot, 'platforms')
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
          directory: path.resolve(projectRoot, 'dist/dashboard'),
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
