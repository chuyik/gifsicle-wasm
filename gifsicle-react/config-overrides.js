module.exports = function override(config, env) {
    config.module.rules.push({
        test: /\.worker$/,
        use: { loader: 'worker-loader' }
    })
    return config;
}