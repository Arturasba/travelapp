import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const compiled = ts.transpileModule(fs.readFileSync('app/book-navigation.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const moduleScope = { exports: {} };
vm.runInNewContext(compiled, moduleScope);
const { movePage, chapterForPage } = moduleScope.exports;

test('desktop turns complete spreads and stops at both ends', () => {
  assert.equal(movePage(0, -1, false, 10), 0);
  assert.equal(movePage(0, 1, false, 10), 2);
  assert.equal(movePage(2, -1, false, 10), 0);
  assert.equal(movePage(8, 1, false, 10), 8);
});
test('mobile visits every individual page in both directions', () => {
  let page = 0;
  for (let expected = 1; expected < 10; expected++) {
    page = movePage(page, 1, true, 10);
    assert.equal(page, expected);
  }
  assert.equal(movePage(page, 1, true, 10), 9);
  for (let expected = 8; expected >= 0; expected--) {
    page = movePage(page, -1, true, 10);
    assert.equal(page, expected);
  }
  assert.equal(movePage(page, -1, true, 10), 0);
});
test('resizing from a right-hand mobile page preserves the desktop spread', () => {
  assert.equal(chapterForPage(3), 1);
  assert.equal(movePage(3, 1, false, 10), 4);
  assert.equal(movePage(3, -1, false, 10), 0);
  assert.equal(movePage(9, 1, false, 10), 8);
});
test('both pages belong to their correct chapter', () => {
  for (let chapter = 0; chapter < 5; chapter++) {
    assert.equal(chapterForPage(chapter * 2), chapter);
    assert.equal(chapterForPage(chapter * 2 + 1), chapter);
  }
});
