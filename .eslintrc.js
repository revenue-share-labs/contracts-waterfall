module.exports = {
  env: {
    browser: false,
    es2021: true,
    mocha: true,
    node: true,
  },
  plugins: ["@typescript-eslint"],
  extends: [
    "standard",
    "plugin:prettier/recommended",
    "plugin:node/recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 12,
  },
  rules: {
    "node/no-unsupported-features/es-syntax": [
      "error",
      { ignores: ["modules"] },
    ],
    "node/no-unpublished-import": ["off"],
    "max-len": [1, { code: 90 }],
    "node/no-missing-import": [
      "error",
      {
        tryExtensions: [".ts", ".js", ".json", ".node"],
      },
    ],
    camelcase: "off",
    "node/no-extraneous-import": ["warn"],
  },
  overrides: [
    {
      files: ["*.test.ts", "*.spec.ts"],
      rules: {
        "no-unused-expressions": "off",
      },
    },
  ],
};
