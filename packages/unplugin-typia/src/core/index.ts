import {
	type UnpluginFactory,
	type UnpluginInstance,
	createUnplugin,
} from 'unplugin';
import { createFilter as rollupCreateFilter } from '@rollup/pluginutils';
import MagicString from 'magic-string';

import type { Options } from './options.js';
import { resolveOptions } from './options.js';
import { transformTypia } from './typia.js';
import { log } from './utils.js';
import type { ID, Source } from './types.js';
import { wrap } from './types.js';
import { Cache } from './cache.js';

const name = `unplugin-typia`;

/**
 * Create a filter function from the given include and exclude patterns.
 */
function createFilter(
	include: Options['include'],
	exclude: Options['exclude'],
): ReturnType<typeof rollupCreateFilter> {
	return rollupCreateFilter(include, exclude);
}

/**
 * The main unplugin instance.
 */
const unpluginFactory: UnpluginFactory<
  Options | undefined,
	false
> = (rawOptions = {}) => {
	const options = resolveOptions(rawOptions);
	const filter = createFilter(options.include, options.exclude);

	const { cache: cacheOptions, log: logOption } = options;

	const showLog = logOption === 'verbose' && cacheOptions;

	return {
		name,
		enforce: options.enforce,

		buildStart() {
			if (logOption !== false) {
				log(
					'box',
					cacheOptions ? `Cache enabled` : `Cache disabled`,
				);
			}
		},

		transformInclude(id) {
			return filter(id);
		},

		async transform(_source, _id) {
			const source = wrap<Source>(_source);
			const id = wrap<ID>(_id);

			/** get cache */
			using cache = cacheOptions ? new Cache(id, source) : undefined;
			let code = cache?.data;

			if (showLog) {
				if (code != null) {
					log('success', `Cache hit: ${id}`);
				}
				else {
					log('warn', `Cache miss: ${id}`);
				}
			}

			/** transform if cache not exists */
			if (code == null) {
				code = await transformTypia(id, source, this, options);

				if (showLog) {
					if (code != null) {
						log('success', `Transformed: ${id}`);
					}
					else {
						log('error', `Transform is null: ${id}`);
					}
				}

				/** save cache */
				if (cache != null) {
					cache.data = code;
				}

				if (showLog) {
					log('success', `Cache set: ${id}`);
				}
			}

			/** create source map */
			const magic = new MagicString(code);
			const map = magic.generateMap({
				source: id,
				file: `${id}.map`,
			});

			return { code, map };
		},
	};
};

/**
 * This is the unplugin function that is exported.
 *
 * @module
 */
const unplugin: UnpluginInstance<Options | undefined, false>
/* #__PURE__ */ = createUnplugin(unpluginFactory);

export type { Options };
export {
	resolveOptions,
	createFilter,
	transformTypia,
	unplugin,
};

export default unplugin;
