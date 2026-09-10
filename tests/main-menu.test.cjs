const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "css/style.css"), "utf8");
const game = fs.readFileSync(path.join(root, "js/game.js"), "utf8");

function section(id) {
  const match = html.match(new RegExp(`<section id="${id}"[\\s\\S]*?<\\/section>`));
  assert.ok(match, `${id} section must exist`);
  return match[0];
}

test("main menu keeps secondary controls behind one settings button", () => {
  const main = section("main-menu");
  const settings = section("settings-menu");

  assert.match(main, /id="settings-button"/);
  assert.doesNotMatch(main, /id="solo-ship-picker"|id="how-button"|id="menu-sound-button"|id="menu-music"/);
  assert.match(settings, /id="solo-ship-picker"/);
  assert.match(settings, /id="how-button"/);
  assert.match(settings, /id="menu-sound-button"/);
  assert.match(settings, /id="menu-music"/);
});

test("main menu is non-scrolling and settings navigation is wired", () => {
  assert.match(css, /#main-menu\s*\{[^}]*overflow:hidden/);
  assert.match(css, /#main-menu \.hero-card\s*\{[^}]*overflow:hidden/);
  assert.match(game, /"settings-button"\)\.addEventListener\("click", \(\) => this\.showScreen\("settings-menu"\)\)/);
  assert.match(game, /"settings-back-button"\)\.addEventListener\("click", \(\) => this\.showScreen\("main-menu"\)\)/);
});
