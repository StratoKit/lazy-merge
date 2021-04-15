const {getBin, rimraf} = require('nps-utils')

let jestBin
try {
	jestBin = getBin('jest', 'jest')
} catch {
	jestBin = 'pleaseInstallJest'
}
const runBabel = `NODE_ENV=production babel --root-mode upward -s true --ignore '**/*.test.js,**/__snapshots__' -d dist/`

module.exports = {
	scripts: {
		build: {
			default: `nps build.clean build.babel`,
			clean: rimraf('dist/'),
			babel: `${runBabel} src/`,
		},
		lint: {default: 'eslint -f unix .', fix: 'eslint --fix -f unix .'},
		test: {
			default: 'NODE_ENV=test exec jest --coverage --color',
			watch: 'NODE_ENV=test DEBUG_COLORS=yes exec jest --color --watch',
			inspect: `NODE_ENV=test DEBUG_COLORS=yes DEBUG=\${DEBUG:-*,-babel*,-puppeteer*} exec node --enable-source-maps --inspect ${jestBin} --runInBand --watch`,
		},
	},
}
