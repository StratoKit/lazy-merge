# lazy-recursive-merge

Allow declarative configurations from independent sources with embedded evaluation.

This happens by taking an array of objects and merging them into a new object, and then providing getter functions to call functions with the new object.
This allows creating e.g. a configuration where lower-priority configurations can access the higher-priority configuration values for calculations.

Using this concept, you can merge arrays, define file paths with prefixes, conditionally enable features etc.

Example:

Given the objects

```js
const configs = [
	{a: 'a'},
	{b: cfg => `${cfg.a}/${cfg.p}`},
	{p: 'hi'},
	{plugin: () => import('myPlugin')},
	{f: cfg => `m:${cfg.b}`, p: 'hello'},
]
```

the resulting configuration is

```js
{a: 'a', b: 'a/hello', p: 'hello', plugin: /* Promise<plugin> */, f: 'm:a/hello'}
```

In other words, the key `p` in the last object was used by the key `b` in the second object, and the key `f` in the last object used the key `b` in turn.

The functions `b`, `plugin` and `f` won't be called until they are referenced, so for example `myPlugin` won't be loaded until `config.plugin` is read, returning a Promise.

This way, you can define configurations that are loosely coupled but can change any part of the final configuration programmatically.
This is a useful property for pluggable systems, as evidenced by NixOS, an entire Linux distribution based on this concept.

## How it works

Given an array of objects, they are merged as follows:

- higher-array-index objects get greater priority
- objects are merged
- Promises cause the merge to return a Promise for the merged value
- functions are called lazily as `fn(config, {prev, path})`
  - `prev` is the value at the same path of the previous objects
  - if the result is a Promise, it performs the rest of the merges after the Promise resolves
    - you must await the result
  - the result replaces the configuration value at that path
  - if the result is an object, it is handled recursively
    - you can return an object with functions for further evaluation
    - cycles are caught
  - if you need to represent a function `foo`, return it with `() => foo`, it won't be considered for lazy evaluation
- anything else overrides lower priority values

## API

`const config = lrm(objects, {target} = {})`

- `objects`: array of enumerable objects (these cannot be Promises)
- `target`: optional object that will get the configuration
- returns the configuration object

The return value is the mutated `target` object if it was passed. This way, you can retain
references to a changing configuration object.

## Requirements

This only uses `Object.defineProperty` and `WeakMap` (for loop detection only), so it should work on everything with a polyfill for `WeakMap`.

## Ideas for future work

- opinionated config loader, in a separate package, like confippet or dotenv
  - `[{env: process.env}, try_load('config/defaults'), try_load('config/defaults.${process.env.NODE_ENV}')]`
- helper for marking functions as not-accessor? `fn[Symbol.for('lrm.value')]=true`
- allow custom mergers
  - need to accept `{path, root}` and implement `.add()` and `.finalize()`
  - subclass DefaultMerge, or perhaps a tagged factory fn: `makeMerger[Symbol.for('lrm.merge')]=true`
  - can enforce types via throwing, concat arrays, sort, ...
  - could be integrated with TS by converting TS interfaces to a runtime checker, or other way round
  - provide a bunch of default mergers that implement runtime type checking
- support Proxy object to allow runtime key lookup (e.g. mapping a directory)
- a function to find which config determined the value of a given path, for error reporting.
- if `WeakMap` is not available, use a recursion depth limit
- implement a NixPkgs clone
