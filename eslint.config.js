// Линтер ловит то, что раньше ломалось тихо: необъявленные имена, забытые импорты, неиспользуемый код.
const globals = require("globals");
module.exports = [
  { files: ["js/**/*.js"], languageOptions: { ecmaVersion: 2022, sourceType: "module",
      globals: { ...globals.browser, RITM: "readonly" } },
    rules: { "no-undef": "error", "no-unused-vars": ["error", { args: "none", caughtErrors: "none" }], "no-const-assign": "error", "no-dupe-keys": "error", "no-redeclare": "error", "no-unreachable": "error" } },
  { files: ["core.js", "engine.js", "lexicon.js", "mood.js", "dialog.js"], languageOptions: { ecmaVersion: 2022, sourceType: "script", globals: { ...globals.browser, ...globals.node, RITM: "writable" } }, rules: { "no-undef": "error" } }
];
