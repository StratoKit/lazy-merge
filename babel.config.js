module.exports = {
	presets: [
		[
			'@babel/preset-env',
			{
				targets: {
					node: '12',
				},
				useBuiltIns: 'usage',
				corejs: 3,
			},
		],
	],
	plugins: ['@babel/plugin-proposal-class-properties'],
}
