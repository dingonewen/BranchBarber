const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

// Main extension bundle (background, content, popup)
const mainConfig = (isDev) => ({
  entry: {
    background: path.resolve(__dirname, "src/background/index.ts"),
    content: path.resolve(__dirname, "src/content/index.ts"),
    popup: path.resolve(__dirname, "src/popup/index.tsx"),
    offscreen: path.resolve(__dirname, "src/offscreen/index.ts"),
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].js",
    clean: false,
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js", ".jsx"],
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, "css-loader", "postcss-loader"],
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: "./public/popup.html",
      filename: "popup.html",
      chunks: ["popup"],
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: "public/manifest.json", to: "manifest.json" },
        { from: "public/offscreen.html", to: "offscreen.html" },
        { from: "public/icons", to: "icons", noErrorOnMissing: true },
        // Copy ONNX Runtime WASM/MJS files with their original names so that
        // ONNX Runtime can resolve them at runtime via wasmPaths.
        // Webpack would otherwise rename them with content hashes.
        { from: "node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.mjs",  to: "ort-wasm-simd-threaded.jsep.mjs" },
        { from: "node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.wasm", to: "ort-wasm-simd-threaded.jsep.wasm" },
        { from: "node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm",      to: "ort-wasm-simd-threaded.wasm" },
        { from: "node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs",       to: "ort-wasm-simd-threaded.mjs" },
      ],
    }),
    new MiniCssExtractPlugin({ filename: "[name].css" }),
  ],
  devtool: isDev ? "cheap-module-source-map" : false,
  optimization: { splitChunks: false },
});

module.exports = (env, argv) => {
  const isDev = argv.mode === "development";
  return mainConfig(isDev);
};
