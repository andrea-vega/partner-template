'use strict';

const nconf = require('nconf');
const PROXY_PREFIX = '/informer';

const hapi = require('hapi');

// parse app app config
const config = nconf.argv()
    .env('__')
    .file(nconf.get('config') || 'config.json')
    .defaults({
        port: 8080,
        api: {
            root: 'http://localhost:3000',
            auth: 'Basic YWRtaW46MTIz' // admin:123
        }
    })
    .get();

const server = hapi.server({ port: config.port });

const mapInformerRequest = req => ({
    uri: `${config.api.root}/${req.params.p}${req.url.search}`,
    headers: {
        Authorization: config.api.auth,
        'x-forwarded-path': PROXY_PREFIX,
        'x-forwarded-user': 'user@myapplication'
    }
});

const init = async () => {
    // plugin for serving static assets
    await server.register({ plugin: require('inert') });

    // plugin for proxy forwarding
    await server.register({ plugin: require('h2o2') });

    // static app assets
    server.route({
        method: 'get',
        path: '/{param*}',
        handler: {
            directory: {
                path: 'public',
                redirectToSlash: true,
                index: true
            }
        }
    });

    // static informer assets
    server.route({
        method: 'get',
        path: '/assets/{p*}',
        handler: {
            proxy: {
                uri: `${config.api.auth}{path}`
            }
        }
    });

    // informer api requests
    server.route({
        method: ['get', 'post', 'delete'],
        path: '/informer/{p*}',
        handler: {
            proxy: {
                xforward: true,
                passThrough: true,
                mapUri: mapInformerRequest,
                ttl: 'upstream'
            }
        }
    });

    await server.start();
    console.log(`Server started at ${server.info.uri}`);
    console.log(`Forwarding requests to ${config.api.root}`);
};

process.on('unhandledRejection', (err) => {
    console.log(err);
    process.exit(1);
});

init();