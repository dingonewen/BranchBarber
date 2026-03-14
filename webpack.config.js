const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

module.exports = (env, argv) => {
  const isDev = argv.mode === "development";

  return {
    entry: {
      background: path.resolve(__dirname, "src/background/index.ts"),
      content: path.resolve(__dirname, "src/content/index.ts"),
      popup: path.resolve(__dirname, "src/popup/index.tsx"),
      worker: path.resolve(__dirname, "src/worker/embeddings.worker.ts"),
    },
    output: {
      path: path.resolve(__dirname, "dist"),
      filename: "[name].js",
      clean: true,
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
          use: [
            MiniCssExtractPlugin.loader,
            "css-loader",
            "postcss-loader",
          ],
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
          { from: "public/icons", to: "icons", noErrorOnMissing: true },
        ],
      }),
      new MiniCssExtractPlugin({
        filename: "[name].css",
      }),
    ],
    devtool: isDev ? "cheap-module-source-map" : false,
    optimization: {
      splitChunks: false,
    },
  };
};