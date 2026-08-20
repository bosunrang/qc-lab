'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'app', 'action-dispatcher.ts')).href;
const program = `
  import { createActionDispatcher } from ${JSON.stringify(source)};

  const ATTR_TO_DATASET_KEY = { '[data-action]': 'action', '[data-keydown-action]': 'keydownAction', '[data-mousemove-action]': 'mousemoveAction', '[data-notify-changed]': 'notifyChanged', '[data-input-action]': 'inputAction', '[data-focus-action]': 'focusAction', '[data-change-action]': 'changeAction', '[data-toggle-action]': 'toggleAction' };
  function makeEl(dataset, extra) {
    const el = Object.assign({ dataset, closest(sel) {
      const key = ATTR_TO_DATASET_KEY[sel];
      if (!key) return null;
      let node = this;
      while (node) { if (node.dataset && node.dataset[key] !== undefined) return node; node = node.parent; }
      return null;
    } }, extra || {});
    return el;
  }

  // Real DOM addEventListener allows multiple listeners per type (both dispatch()
  // and dispatchNotifyChanged bind to 'input'/'change'); a naive single-slot mock
  // would silently drop one of them.
  const listenerLists = {};
  const doc = { addEventListener(type, fn) { (listenerLists[type] = listenerLists[type] || []).push(fn); } };
  const fire = (type, event) => (listenerLists[type] || []).forEach(fn => fn(event));
  const calls = [];
  const resolve = name => name === 'known' ? function (...args) { calls.push({ name: 'known', thisArg: this, args }); } : name === 'known2' ? function (...args) { calls.push({ name: 'known2', thisArg: this, args }); } : undefined;
  const dispatcher = createActionDispatcher({ document: doc, resolve });
  dispatcher.bind();
  dispatcher.bind(); // idempotent: second bind() must not double-register listeners

  const results = {};

  // 1) plain click dispatches with decoded args and this===el
  {
    const el = makeEl({ action: 'known', args: '["a",1]' });
    fire('click',{ target: el });
    results.plainClick = calls.length === 1 && calls[0].thisArg === el && JSON.stringify(calls[0].args) === '["a",1]';
  }
  calls.length = 0;

  // 2) click bubbling from a child with no closer [data-action] fires the ancestor's action
  {
    const parent = makeEl({ action: 'known' });
    const child = makeEl({}, { parent });
    fire('click',{ target: child });
    results.bubbleToAncestor = calls.length === 1 && calls[0].thisArg === parent;
  }
  calls.length = 0;

  // 3) data-action-self-only skips when the click bubbled from a descendant
  {
    const parent = makeEl({ action: 'known', actionSelfOnly: '' });
    const child = makeEl({}, { parent });
    fire('click',{ target: child });
    results.selfOnlySkipsDescendant = calls.length === 0;
  }
  calls.length = 0;

  // 4) data-action-self-only still fires when the click target IS the element itself
  {
    const el = makeEl({ action: 'known', actionSelfOnly: '' });
    fire('click',{ target: el });
    results.selfOnlyFiresOnSelf = calls.length === 1;
  }
  calls.length = 0;

  // 5) data-action-on="input" fires on the input listener and appends el.value as the last arg
  {
    const el = makeEl({ action: 'known', actionOn: 'input', args: '["prefix"]' }, { value: 'typed' });
    fire('input',{ target: el });
    results.inputAppendsValue = calls.length === 1 && JSON.stringify(calls[0].args) === '["prefix","typed"]';
  }
  calls.length = 0;

  // 5b) data-action-on="change" on a file input appends the real event, not
  // .value (which is just the filename and not useful to the target function)
  {
    const el = makeEl({ action: 'known', actionOn: 'change' }, { type: 'file', value: 'C:\\fakepath\\backup.json' });
    const fakeEvent = { target: el };
    fire('change', fakeEvent);
    results.fileInputAppendsEvent = calls.length === 1 && calls[0].args[0] === fakeEvent;
  }
  calls.length = 0;

  // 6) an input-only action does not fire on a click event
  {
    const el = makeEl({ action: 'known', actionOn: 'input' }, { value: 'typed' });
    fire('click',{ target: el });
    results.inputActionIgnoresClick = calls.length === 0;
  }
  calls.length = 0;

  // 7) data-action-on="change" on a checkbox appends el.checked, not el.value
  {
    const el = makeEl({ action: 'known', actionOn: 'change' }, { type: 'checkbox', checked: true, value: 'on' });
    fire('change',{ target: el });
    results.changeAppendsChecked = calls.length === 1 && JSON.stringify(calls[0].args) === '[true]';
  }
  calls.length = 0;

  // 7b) data-action-on="focus" fires on the focusin listener (delegating focus,
  // which does not bubble, via its bubbling equivalent) with no value appended
  {
    const el = makeEl({ action: 'known', actionOn: 'focus', args: '["x"]' });
    fire('focusin',{ target: el });
    results.focusFiresNoAppend = calls.length === 1 && JSON.stringify(calls[0].args) === '["x"]';
  }
  calls.length = 0;

  // 8) unresolvable function name is a silent no-op
  {
    const el = makeEl({ action: 'missing' });
    fire('click',{ target: el });
    results.unknownActionNoThrow = calls.length === 0;
  }

  // 9) malformed data-args JSON decodes to an empty array rather than throwing
  {
    const el = makeEl({ action: 'known', args: '{not valid json' });
    fire('click',{ target: el });
    results.malformedArgsNoThrow = calls.length === 1 && JSON.stringify(calls[0].args) === '[]';
  }
  calls.length = 0;

  // 10) a click with no matching [data-action] ancestor at all is a silent no-op
  {
    const el = makeEl({});
    fire('click',{ target: el });
    results.noMatchNoThrow = calls.length === 0;
  }

  // 11) data-keydown-action with data-keydown-keys only fires on a matching key,
  // preventDefault()s, and appends the live value after the static args
  {
    const el = makeEl({ keydownAction: 'known', keydownArgs: '["prefix"]', keydownKeys: '["Enter"," "]' }, { value: 'typed', preventDefault() { this._prevented = true; } });
    fire('keydown',{ target: el, key: 'Tab' });
    const ignoredOtherKey = calls.length === 0;
    fire('keydown',{ target: el, key: 'Enter', preventDefault: el.preventDefault.bind(el) });
    results.keydownFilteredFiresOnMatch = ignoredOtherKey && calls.length === 1 && JSON.stringify(calls[0].args) === '["prefix","typed"]' && el._prevented === true;
  }
  calls.length = 0;

  // 12) data-keydown-action + data-keydown-keys respects data-keydown-self-only
  // (matches the "Enter/Space selects the row, not a nested control" pattern) —
  // a DIFFERENT flag from data-action-self-only, since click and keydown need
  // opposite self-only behavior on the very same row element
  {
    const row = makeEl({ keydownAction: 'known', keydownKeys: '["Enter"]', keydownSelfOnly: '' });
    const nestedControl = makeEl({}, { parent: row });
    fire('keydown',{ target: nestedControl, key: 'Enter', preventDefault() {} });
    results.keydownSelfOnlySkipsNested = calls.length === 0;
    fire('keydown',{ target: row, key: 'Enter', preventDefault() {} });
    results.keydownSelfOnlyFiresOnRow = calls.length === 1;
  }
  calls.length = 0;

  // 13) data-keydown-action WITHOUT data-keydown-keys is raw passthrough: fires on
  // every key, does not preventDefault, and passes the real event first
  {
    const el = makeEl({ keydownAction: 'known', keydownArgs: '[]' });
    const fakeEvent = { target: el, key: 'ArrowDown' };
    fire('keydown',fakeEvent);
    results.keydownPassthroughFiresAnyKey = calls.length === 1 && calls[0].args[0] === fakeEvent && calls[0].args.length === 1;
  }
  calls.length = 0;

  // 14) data-mousemove-action fires with the real event first, then static args
  {
    const el = makeEl({ mousemoveAction: 'known', mousemoveArgs: '["<html>"]' });
    const fakeEvent = { target: el, clientX: 10, clientY: 20 };
    fire('mousemove',fakeEvent);
    results.mousemoveFiresWithEventFirst = calls.length === 1 && calls[0].args[0] === fakeEvent && calls[0].args[1] === '<html>';
  }
  calls.length = 0;

  // 15) data-action-on="mouseout" fires on the mouseout listener (delegating
  // mouseleave, which does not bubble, via its bubbling equivalent)
  {
    const el = makeEl({ action: 'known', actionOn: 'mouseout' });
    fire('mouseout',{ target: el });
    results.mouseoutFires = calls.length === 1;
  }
  calls.length = 0;

  // 16) data-notify-changed fires on a bubbled input/change event even when a
  // nested descendant's OWN data-action already handled that same event —
  // both must fire, matching the NCE form's "any field changed" catch-all
  // alongside each field's own specific handler
  {
    const form = makeEl({ notifyChanged: 'known2' });
    const field = makeEl({ action: 'known', actionOn: 'input' }, { parent: form, value: 'x' });
    fire('input',{ target: field });
    results.notifyChangedFiresAlongsideFieldAction = calls.length === 2 && calls.some(c => c.name === 'known') && calls.some(c => c.name === 'known2');
  }
  calls.length = 0;

  // 17) data-notify-changed alone (no nested data-action) still fires on change
  {
    const form = makeEl({ notifyChanged: 'known2' });
    const field = makeEl({}, { parent: form });
    fire('change',{ target: field });
    results.notifyChangedFiresAlone = calls.length === 1 && calls[0].name === 'known2';
  }
  calls.length = 0;

  // 18) data-input-action fires on 'input' with this===el and decoded args,
  // WITHOUT appending the live value (unlike data-action-on="input") — needed
  // by lotTransitionChoiceInput, which reads el.value itself via this
  {
    const el = makeEl({ inputAction: 'known', inputArgs: '["x"]' }, { value: 'typed' });
    fire('input',{ target: el });
    results.inputActionNoAppend = calls.length === 1 && calls[0].thisArg === el && JSON.stringify(calls[0].args) === '["x"]';
  }
  calls.length = 0;

  // 19) data-focus-action fires on the focusin listener with this===el
  {
    const el = makeEl({ focusAction: 'known', focusArgs: '["lotOld"]' });
    fire('focusin',{ target: el });
    results.focusActionFires = calls.length === 1 && calls[0].thisArg === el && JSON.stringify(calls[0].args) === '["lotOld"]';
  }
  calls.length = 0;

  // 19b) data-toggle-action fires on 'toggle' with this===el, appending el.open
  // after the static args — matches this.open from the old ontoggle="..." string,
  // needed because the details/summary toggle event does not bubble (registered
  // via capture instead, transparent to this mock's addEventListener(type, fn))
  {
    const el = makeEl({ toggleAction: 'known', toggleArgs: '["cause"]' }, { open: true });
    fire('toggle',{ target: el });
    results.toggleActionAppendsOpen = calls.length === 1 && calls[0].thisArg === el && JSON.stringify(calls[0].args) === '["cause",true]';
  }
  calls.length = 0;

  // 20) data-change-action fires on 'change' independently of data-action —
  // an element can carry BOTH (e.g. rcMeta on 'input' via data-action, plus
  // rcMetaLog on 'change' via data-change-action) and both must fire
  {
    const el = makeEl({ action: 'known', actionOn: 'input', changeAction: 'known2', changeArgs: '["lotOld"]' }, { value: 'typed' });
    fire('change',{ target: el });
    results.changeActionIndependentOfDataAction = calls.length === 1 && calls[0].name === 'known2' && calls[0].thisArg === el && JSON.stringify(calls[0].args) === '["lotOld"]';
  }
  calls.length = 0;

  console.log(JSON.stringify(results));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy action dispatcher TypeScript');
const r = JSON.parse(result.stdout);
assert.equal(r.plainClick, true, 'a plain data-action click decodes args and binds this to the matched element');
assert.equal(r.bubbleToAncestor, true, 'a click bubbling from a plain descendant fires the nearest ancestor action (closest() dedup)');
assert.equal(r.selfOnlySkipsDescendant, true, 'data-action-self-only must not fire when the click bubbled from a descendant');
assert.equal(r.selfOnlyFiresOnSelf, true, 'data-action-self-only must still fire when the click target is the element itself');
assert.equal(r.inputAppendsValue, true, 'data-action-on="input" appends the live element value after the static args');
assert.equal(r.fileInputAppendsEvent, true, 'data-action-on="change" on a file input appends the real event instead of .value');
assert.equal(r.inputActionIgnoresClick, true, 'an input-only action must not fire on a click event');
assert.equal(r.changeAppendsChecked, true, 'a checkbox with data-action-on="change" appends .checked, not .value');
assert.equal(r.focusFiresNoAppend, true, 'data-action-on="focus" fires via focusin with only the static args, no live value appended');
assert.equal(r.unknownActionNoThrow, true, 'an unresolvable action name is a silent no-op');
assert.equal(r.malformedArgsNoThrow, true, 'malformed data-args JSON decodes to [] instead of throwing');
assert.equal(r.noMatchNoThrow, true, 'a click with no [data-action] ancestor at all is a silent no-op');
assert.equal(r.keydownFilteredFiresOnMatch, true, 'data-keydown-action with data-keydown-keys only fires on a matching key, calls preventDefault(), and appends the live value');
assert.equal(r.keydownSelfOnlySkipsNested, true, 'a filtered keydown action with data-action-self-only must not fire when the key event target is a nested control');
assert.equal(r.keydownSelfOnlyFiresOnRow, true, 'a filtered keydown action with data-action-self-only must still fire when the key event target is the row itself');
assert.equal(r.keydownPassthroughFiresAnyKey, true, 'data-keydown-action without data-keydown-keys is raw passthrough: fires on any key with the real event as the first arg');
assert.equal(r.mousemoveFiresWithEventFirst, true, 'data-mousemove-action fires with the real event first, then the static args');
assert.equal(r.mouseoutFires, true, 'data-action-on="mouseout" fires via the mouseout listener');
assert.equal(r.notifyChangedFiresAlongsideFieldAction, true, 'data-notify-changed fires in addition to a nested field\'s own data-action on the same event, not instead of it');
assert.equal(r.notifyChangedFiresAlone, true, 'data-notify-changed fires even when no nested element has its own data-action');
assert.equal(r.inputActionNoAppend, true, 'data-input-action fires on input with this===el and does not append the live value');
assert.equal(r.focusActionFires, true, 'data-focus-action fires via focusin with this===el');
assert.equal(r.changeActionIndependentOfDataAction, true, 'data-change-action fires on change independently of a data-action on the same element');
assert.equal(r.toggleActionAppendsOpen, true, 'data-toggle-action fires on toggle with this===el and appends el.open after the static args');
console.log('Action dispatcher TypeScript tests passed');
