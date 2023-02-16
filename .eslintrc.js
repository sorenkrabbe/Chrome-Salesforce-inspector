module.exports = {
  "env": {
    "browser": true,
    "es6": true,
    "webextensions": true
  },
  "parserOptions": {
    "ecmaVersion": 11,
    "sourceType": "module"
  },
  "root": true,
  "extends": "eslint:recommended",
  "overrides": [
    {
      "parserOptions": {
        "sourceType": "script"
      },
      "files": [
        // Extension scripts can not be loaded as modules
        "addon/background.js",
        "addon/button.js",
        "addon/inspect-inline.js",
        // React cannot be loaded as modules yet. See https://github.com/facebook/react/issues/10021 and https://github.com/facebook/react/issues/11503
        "addon/react-dom.js",
        "addon/react-dom.min.js",
        "addon/react.js",
        "addon/react.min.js",
        // Node.js support for ES modules is still experimental. See https://nodejs.org/dist/latest-v12.x/docs/api/esm.html
        "scripts/*"
      ]
    }
  ],
  "rules": {
    "indent": ["error", 2, {"SwitchCase": 1, "flatTernaryExpressions": true}],
    "quotes": ["error", "double", {"allowTemplateLiterals": true, "avoidEscape": true}],
    "semi": ["error", "always"],
    "strict": ["error", "global"],
    "consistent-return": "error",
    "curly": ["error", "multi-line"],
    "dot-location": ["error", "property"],
    "no-multi-spaces": "error",
    "array-bracket-spacing": "error",
    "block-spacing": "error",
    "brace-style": ["error", "1tbs", {"allowSingleLine": true}],
    "camelcase": "error",
    "comma-dangle": ["error", "only-multiline"],
    "comma-spacing": "error",
    "comma-style": "error",
    "computed-property-spacing": "error",
    "consistent-this": ["error", "self"],
    "eol-last": "error",
    "func-call-spacing": "error",
    "key-spacing": "error",
    "keyword-spacing": "error",
    "new-cap": "error",
    "no-array-constructor": "error",
    "no-lonely-if": "error",
    "no-mixed-operators": "error",
    "no-new-object": "error",
    "no-tabs": "error",
    "no-trailing-spaces": "error",
    "no-underscore-dangle": ["error", {"allowAfterThis": true, "allowAfterSuper": true}],
    "no-whitespace-before-property": "error",
    "object-curly-spacing": "error",
    "object-property-newline": ["error", {"allowMultiplePropertiesPerLine": true}],
    "one-var-declaration-per-line": "error",
    "operator-linebreak": ["error", "before"],
    "semi-spacing": "error",
    "space-before-function-paren": ["error", {
      "anonymous": "never",
      "named": "never",
      "asyncArrow": "always"
    }],
    "space-in-parens": "error",
    "space-infix-ops": "error",
    "space-unary-ops": "error",
    "unicode-bom": "error",
    "arrow-body-style": "error",
    "arrow-spacing": "error",
    "no-useless-computed-key": "error",
    "no-useless-constructor": "error",
    "no-var": "error",
    "object-shorthand": "error",
    "prefer-arrow-callback": ["error", {"allowNamedFunctions": true}],
    "prefer-numeric-literals": "error",
    "prefer-rest-params": "error",
    "prefer-spread": "error",
    "rest-spread-spacing": "error",
    "symbol-description": "error",
    "template-curly-spacing": "error",
    "yield-star-spacing": "error"
  }
};
