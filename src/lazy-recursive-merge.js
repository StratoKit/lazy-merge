const isPromise = o => !!o && typeof o.then === 'function'
const isPlainObject = o =>
	!!o &&
	typeof o === 'object' &&
	!Array.isArray(o) &&
	typeof o.then !== 'function'

class DefaultMerge {
	constructor({path, root}) {
		this.configs = []
		this.path = path
		this.root = root
		this.value = undefined
	}
	// Add a value for merging; later values have higher priority
	add(value) {
		if (isPlainObject(value)) {
			this.configs.unshift(value)
			this.value = undefined
		} else {
			this.configs = []
			this.value = value
		}
	}
	// Return the merged value
	finalize() {
		const merged = this.configs.length
			? // We have the correct signature :)
			  mergeConfigs(this)
			: this.value
		this.stack = []
		this.value = undefined
		return merged
	}
}

const setReadOnly = (o, key, value) => {
	Object.defineProperty(o, key, {
		value,
		enumerable: true,
		configurable: true,
		writable: false,
	})
}
const rootMap = new WeakMap()
/**
 * Merges configs into an object target object is made empty - this allows
 * retaining a reference to it.
 *
 * @param {Object}   options           Options.
 * @param {Object[]} options.configs   The objects to merge.
 * @param {string[]} [options.path]    Path to current object.
 * @param {Object}   [options.target]  Target object.
 * @param {Object}   [options.root]    Root object.
 * @returns {Object} Read-only merged objects.
 */
const mergeConfigs = ({configs, path: parentPath = [], target, root}) => {
	if (target) {
		// empty out target
		for (const key of Object.keys(target)) delete target[key]
	} else {
		target = {}
	}
	if (!root) root = target

	for (const config of configs) {
		for (const key of Object.keys(config)) {
			if (key in target) continue
			const getter = () => {
				const path = [...parentPath, key]

				// cycle detection
				if (!rootMap.has(target)) {
					rootMap.set(target, new WeakMap())
				}
				const running = rootMap.get(target)
				if (running.has(getter))
					throw new Error(`config: cycle in config.${path.join('.')}`)
				running.set(getter)

				const augmentError = error => {
					running.delete(getter)
					error.message = `config.${path.join('.')}: ${error.message}`
					throw error
				}

				// The values in ascending priority order
				const values = []
				for (const c of configs) {
					if (key in c) values.unshift(c[key])
				}
				let merger = new DefaultMerge({path, root})
				// As soon as there is a Promise, we turn the calculation into
				// a serial Promise chain
				/** @type {Promise<any>} */
				let promise = null
				try {
					for (let v of values) {
						const handleV = () => {
							if (typeof v === 'function') {
								v = v(root, {prev: merger.finalize(), path})
							}
							if (isPromise(v)) {
								const newP = v.then(result => merger.add(result))
								if (promise)
									// We're called from within the promise chain
									return newP
								promise = newP
							} else {
								merger.add(v)
							}
						}

						if (promise) promise = promise.then(handleV)
						else handleV()
					}
					let result
					if (promise) {
						result = promise
							.then(() => {
								const out = merger.finalize()
								running.delete(getter)

								// This can cause race conditions, let's not do this for now
								// // allow GC-ing the promise, replace it with resolved value
								// setReadOnly(target, key, out)

								return out
							})
							.catch(augmentError)
					} else {
						result = merger.finalize()
						running.delete(getter)
					}

					// only calculate once, store result
					// this allows deeper evaluation without cycles
					setReadOnly(target, key, result)

					return result
				} catch (error) {
					augmentError(error)
				}
			}

			Object.defineProperty(target, key, {
				get: getter,
				enumerable: true,
				configurable: true,
			})
		}
	}
	return target
}

/**
 * Lazily merge an array of objects. Function values are called as `fn(root,
 * {prev, path})`:
 * - root: the merged root object, for reading the values in other places -
 * prev: the value of the current location from the previous objects - path: the
 * path in root of the function, as an array of keys
 *
 * The return value becomes the new value at `path` in `root`. If the value is
 * an object, it is further merged.
 * To have a function as a value, return it from this function.
 *
 * @param {(Object)[]} objects           Objects to merge.
 * @param {Object}     options           Options.
 * @param {Object}     [options.target]  Target object for the configuration.
 * @returns {Object} read-only merged objects. If `target` was passed, this is
 *                   `target`
 */
const lazyMerge = (objects, {target} = {}) => {
	const reversed = []
	for (const o of objects) {
		if (!o) continue
		if (!isPlainObject(o)) {
			// eslint-disable-next-line no-console
			console.error('lazyMerge: Passed object is not a plain object', o)
			throw new Error('lazyMerge: only plain objects accepted')
		}
		// The last config overrides all, but we reverse the array so we can walk from 0
		reversed.unshift(o)
	}
	return mergeConfigs({configs: reversed, target})
}

export default lazyMerge
