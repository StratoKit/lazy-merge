import makeConfig from './lazy-recursive-merge'

const configs = [
	{n: 1, a: true, c: Number.NaN, d: {e: 3}},
	{n: 2, b: 'hi', d: {e: 3, f: 1}},
	{n: 3, a: false},
]

describe('makeConfig', () => {
	test('create', () => {
		const config = makeConfig(configs)
		expect(config).toEqual({
			n: 3,
			a: false,
			b: 'hi',
			c: Number.NaN,
			d: {e: 3, f: 1},
		})
	})

	test('falsy configs', () => {
		expect(makeConfig([false, {a: 2}, null, undefined, {}])).toEqual({a: 2})
	})

	test('non-object config', () => {
		/* eslint-disable no-console */
		const t = console.error
		console.error = jest.fn()
		expect(() => makeConfig([5])).toThrow()
		expect(() => makeConfig([Promise.resolve({})])).toThrow()
		expect(console.error).toHaveBeenCalledTimes(2)
		console.error = t
		/* eslint-enable no-console */
	})

	test('error', () => {
		const thrower = () => {
			throw new Error('foo')
		}
		const config = makeConfig([{a: {meep: thrower}}])
		expect(() => config.a.meep).toThrow(/a\.meep.*foo/)
	})

	test('cycle self', () => {
		const cycler = c => c.a.meep
		const config = makeConfig([{a: {meep: cycler}}])
		expect(() => config.a.meep).toThrow('cycle')
	})

	test('cycle loop', () => {
		const config = makeConfig([{a: {b: c => c.a.c, c: c => c.a.b}}])
		expect(() => config.a.b).toThrow('cycle')
	})

	test('update object', () => {
		const config = makeConfig(configs)
		expect(makeConfig([...configs, {q: 1}], {target: config})).toBe(config)
	})

	test('read-only result', () => {
		const config = makeConfig(configs)
		expect(() => {
			config.a = 5
		}).toThrow()
	})

	test('lazy calling', () => {
		const spy = jest.fn(() => 5)
		const config = makeConfig([{a: spy}])
		expect(spy).not.toHaveBeenCalled()
		expect(config.a).toBe(5)
		expect(spy).toHaveBeenCalledTimes(1)
		expect(config.a).toBe(5)
		expect(spy).toHaveBeenCalledTimes(1)
	})

	test.each([
		[[{a: 1, b: c => c.a}], {a: 1, b: 1}],
		[[{a: 1}, {b: c => c.a}], {a: 1, b: 1}],
		[[{a: 1}, {b: () => 5}, {b: (_, {prev}) => prev + 1}], {a: 1, b: 6}],
		[
			[{a: {d: true}}, {b: c => c.a}, {b: {e: false}}],
			{a: {d: true}, b: {d: true, e: false}},
		],
		[
			[{a: {d: true}}, {b: c => c.a}, {b: {e: false}}],
			{a: {d: true}, b: {d: true, e: false}},
		],
		[[{a: () => ({r: 1, b: () => 5})}], {a: {r: 1, b: 5}}],
		[
			[
				{a: 'a'},
				{b: c => `${c.a}/${c.p}`},
				{p: 'hi'},
				{f: c => `m:${c.b}`, p: 'hello'},
			],
			{a: 'a', b: 'a/hello', p: 'hello', f: 'm:a/hello'},
		],
		[
			[{a: () => ({b: 5, c: c => c.a.b + 1})}, {a: {d: 1}}],
			{a: {b: 5, c: 6, d: 1}},
		],
	])('case %#', async (inputs, result) => {
		expect(makeConfig(inputs)).toEqual(result)
	})

	describe('async', () => {
		test('prev is awaited', async () => {
			const config = makeConfig([
				{a: Promise.resolve(5)},
				{a: async (_, {prev}) => (await prev) + 2},
			])
			await expect(config.a).resolves.toBe(7)
		})
		test('sync merges with async', async () => {
			const config = makeConfig([
				{a: Promise.resolve({b: true})},
				{a: {c: false}},
			])
			await expect(config.a).resolves.toEqual({b: true, c: false})
		})
		test('async fn return', async () => {
			const config = makeConfig([{a: async () => ({b: true})}, {a: {c: false}}])
			await expect(config.a).resolves.toEqual({b: true, c: false})
		})
	})
})
