const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');

const srcPath = path.resolve(__dirname, 'src');
// Go up TWO directories: from apps/client-rn to the monorepo root
const libsPath = path.resolve(__dirname, '..', '..', 'libs');
const tsCorePath = path.resolve(libsPath, 'ts-core', 'src', 'index.ts');

module.exports = {
  mode: process.env.NODE_ENV || 'development',
  entry: ['regenerator-runtime/runtime', './src/main-web.tsx'],
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
    publicPath: '/',
  },
  // Enable top-level await for ESM modules
  experiments: {
    topLevelAwait: true,
  },
  resolve: {
    alias: {
      'react-native$': 'react-native-web',
      'react-native-reanimated': path.resolve(__dirname, 'src/web-mocks/react-native-reanimated.js'),
      // Alias _jsxRuntime to use react's jsx
      '_jsxRuntime': path.resolve(__dirname, 'src/web-mocks/jsx-runtime.js'),
      // Don't alias react-native-svg here - handled by plugin below
      // Use absolute path for ts-core
      '@aacesstalk/libs/ts-core': tsCorePath,
      // Fix relative paths that reference libs - point to the root of ts-core
      'libs/ts-core': path.join(libsPath, 'ts-core'),
      // Fix broken paths in source files
      'apps/client-rn/src': srcPath,
      'apps/client-rn/src/components': path.resolve(srcPath, 'components'),
      'apps/client-rn/src/styles': path.resolve(srcPath, 'styles'),
      'apps/client-rn/src/utils': path.resolve(srcPath, 'utils'),
      'apps/client-rn/src/redux': path.resolve(srcPath, 'redux'),
      'apps/client-rn/src/services': path.resolve(srcPath, 'services'),
      'apps/client-rn/src/navigation': path.resolve(srcPath, 'navigation'),
      'apps/client-rn/src/app': path.resolve(srcPath, 'app'),
      'apps/client-rn/src/features': path.resolve(srcPath, 'features'),
      'apps/client-rn/src/components/vector-icons': path.resolve(srcPath, 'components/vector-icons'),
      'apps/client-rn/src/components/LoadingIndicator': path.resolve(srcPath, 'components/LoadingIndicator'),
    },
    // Add libs to module resolution
    modules: [
      srcPath,
      libsPath,
      'node_modules',
    ],
    extensions: ['.web.tsx', '.web.ts', '.web.jsx', '.web.js', '.ts', '.tsx', '.js', '.jsx', '.json', '.mjs'],
    // Handle ESM modules - don't fail on missing extensions
    fullySpecified: false,
    fallback: {
      path: false,
      fs: false,
      crypto: false,
    },
  },
  module: {
    rules: [
      // Handle CommonJS modules from react-native-css-interop (all JS/TS files)
      {
        test: /node_modules\/react-native-css-interop\/(dist|src)\/.*\.(js|ts|jsx|tsx)$/,
        type: 'javascript/auto',
      },
      // Also handle any CommonJS modules that use exports
      {
        test: /node_modules\/react-native-css-interop\/.+/,
        type: 'javascript/auto',
      },
      {
        test: /\.(ts|tsx|js|jsx|mjs)$/,
        exclude: /node_modules/,
        use: 'babel-loader',
      },
      // Handle JSX in node_modules
      {
        test: /\.(js|jsx|mjs)$/,
        include: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              '@babel/preset-flow',
              '@babel/preset-env',
              ['@babel/preset-react', { runtime: 'automatic' }],
            ],
          },
        },
      },
      // Handle SVG files as React components using @svgr/webpack
      {
        test: /\.svg$/,
        use: {
          loader: '@svgr/webpack',
          options: {
            babel: true,
            svgo: false,
            dimensions: false,
            typescript: true,
            esModule: true,
          },
        },
      },
      // Handle other image assets (non-SVG)
      {
        test: /\.(png|jpg|jpeg|gif)$/,
        type: 'asset/resource',
      },
      // Handle CSS with Tailwind/PostCSS for web
      {
        test: /\.css$/,
        use: [
          'style-loader',
          'css-loader',
          {
            loader: 'postcss-loader',
            options: {
              postcssOptions: {
                plugins: [
                  'tailwindcss',
                  'autoprefixer',
                ],
              },
            },
          },
        ],
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/,
        type: 'asset/resource',
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/index.html',
      filename: 'index.html',
    }),
    new webpack.DefinePlugin({
      'process.env': {
        'NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
      },
    }),
    // Provide jsx/jsxs from React
    new webpack.ProvidePlugin({
      jsx: ['react', 'jsx'],
      jsxs: ['react', 'jsxs'],
      Fragment: ['react', 'Fragment'],
      _jsxRuntime: ['react', '_jsxRuntime'],
    }),
    // Replace missing files with empty mocks
    new webpack.NormalModuleReplacementPlugin(
      /.\/loading-images\.js$/,
      path.resolve(__dirname, 'src/web-mocks/empty.js')
    ),
    // Replace native modules with web implementations
    new webpack.NormalModuleReplacementPlugin(
      /react-native-audio-recorder-player/,
      path.resolve(__dirname, 'src/web-mocks/audio-recorder-player.js')
    ),
    new webpack.NormalModuleReplacementPlugin(
      /react-native-sound-player/,
      path.resolve(__dirname, 'src/web-mocks/sound-player.js')
    ),
    new webpack.NormalModuleReplacementPlugin(
      /react-native-file-access/,
      path.resolve(__dirname, 'src/web-mocks/file-access.js')
    ),
    new webpack.NormalModuleReplacementPlugin(
      /react-native-blob-util/,
      path.resolve(__dirname, 'src/web-mocks/blob-util.js')
    ),
    // Device info, permissions, and MMKV
    new webpack.NormalModuleReplacementPlugin(
      /react-native-device-info/,
      path.resolve(__dirname, 'src/web-mocks/device-info.js')
    ),
    new webpack.NormalModuleReplacementPlugin(
      /react-native-permissions/,
      path.resolve(__dirname, 'src/web-mocks/permissions.js')
    ),
    new webpack.NormalModuleReplacementPlugin(
      /react-native-mmkv/,
      path.resolve(__dirname, 'src/web-mocks/mmkv.js')
    ),
    // Use web mocks for react-native-screens (required by react-navigation)
    new webpack.NormalModuleReplacementPlugin(
      /react-native-screens$/,
      path.resolve(__dirname, 'src/web-mocks/react-native-screens.js')
    ),
    // Mock requireNativeComponent for components that need native views
    new webpack.NormalModuleReplacementPlugin(
      /requireNativeComponent/,
      path.resolve(__dirname, 'src/web-mocks/requireNativeComponent.js')
    ),
    // Animation library
    new webpack.NormalModuleReplacementPlugin(
      /react-native-reanimated$/,
      path.resolve(__dirname, 'src/web-mocks/react-native-reanimated.js')
    ),
    // Safe area context
    new webpack.NormalModuleReplacementPlugin(
      /react-native-safe-area-context$/,
      path.resolve(__dirname, 'src/web-mocks/safe-area-context.js')
    ),
    // Gesture handler
    new webpack.NormalModuleReplacementPlugin(
      /react-native-gesture-handler$/,
      path.resolve(__dirname, 'src/web-mocks/react-native-gesture-handler.js')
    ),
    // Localize
    new webpack.NormalModuleReplacementPlugin(
      /react-native-localize$/,
      path.resolve(__dirname, 'src/web-mocks/react-native-localize.js')
    ),
    // Toast message
    new webpack.NormalModuleReplacementPlugin(
      /react-native-toast-message$/,
      path.resolve(__dirname, 'src/web-mocks/react-native-toast-message.js')
    ),
    // Global keyevent
    new webpack.NormalModuleReplacementPlugin(
      /react-native-global-keyevent$/,
      path.resolve(__dirname, 'src/web-mocks/react-native-global-keyevent.js')
    ),
    // Progress
    new webpack.NormalModuleReplacementPlugin(
      /react-native-progress$/,
      path.resolve(__dirname, 'src/web-mocks/react-native-progress.js')
    ),
    // Faster Image
    new webpack.NormalModuleReplacementPlugin(
      /@candlefinance\/faster-image$/,
      path.resolve(__dirname, 'src/web-mocks/faster-image.js')
    ),
    // react-native-css-interop - not needed for web
    new webpack.NormalModuleReplacementPlugin(
      /react-native-css-interop/,
      path.resolve(__dirname, 'src/web-mocks/react-native-css-interop.js')
    ),
    // react-native-svg library - use mock for web
    new webpack.NormalModuleReplacementPlugin(
      /node_modules\/react-native-svg$/,
      path.resolve(__dirname, 'src/web-mocks/react-native-svg.js')
    ),
  ],
  devServer: {
    port: 4200,
    historyApiFallback: true,
    hot: true,
    static: {
      directory: path.join(__dirname, 'dist'),
    },
    webSocketServer: false,
  },
  devtool: process.env.NODE_ENV === 'production' ? 'source-map' : 'eval-source-map',
};
