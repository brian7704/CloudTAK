import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import Config from '../lib/config.js';
// @ts-ignore
import ConnectionSink from '../lib/types/connection-sink.js';
import { Response } from 'express';
import { AuthRequest } from '@tak-ps/blueprint-login';
import {
    EsriProxyPortal,
    EsriProxyServer
} from '../lib/esri.js';

export default async function router(schema: any, config: Config) {
    await schema.post('/sink/esri', {
        name: 'Validate & Auth',
        group: 'SinkEsri',
        auth: 'user',
        description: `
            Helper API to configure ESRI MapServers

            An ESRI portal URL should be submitted along with the username & password.
            The portal will be verified and if it passes a TOKEN and portal type will be returned
        `,
        body: {
            type: "object",
            additionalProperties: false,
            required: [ "url" ],
            properties: {
                url: { "type": "string" },
                username: { "type": "string" },
                password: { "type": "string" },
                sinkid: { "type": "integer" },
            }
        },
        res: {
            type: "object",
            additionalProperties: false,
            properties: {
                type: {
                    type: 'string',
                    enum: [ 'AGOL', 'SERVER' ]
                },
                token: { type: "string" },
                referer: { type: "string" },
                expires: { type: "integer" },
            }
        }
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            try {
                req.body.url = new URL(req.body.url);
            } catch (err) {
                throw new Err(400, null, err.message);
            }

            if (!req.body.username && !req.body.password && !req.body.sinkid) throw new Err(400, null, 'Either SinkId or Username/Password Combo Required');
            if (req.body.username && req.body.password && req.body.sinkid) throw new Err(400, null, 'Either SinkId or Username/Password Combo Required');

            if (req.body.sinkid) {
                const sink = await ConnectionSink.from(config.pool, req.body.sinkid);

                req.body.username = sink.body.username;
                req.body.password = sink.body.password;
            }

            const esri = await EsriProxyPortal.init(
                req.body.url,
                config.API_URL,
                req.body.username,
                req.body.password
            );

            return res.json({
                type: esri.type,
                token: esri.token,
                referer: esri.referer,
                expires: esri.expires,
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/sink/esri/portal', {
        name: 'Portal Meta',
        group: 'SinkEsri',
        auth: 'user',
        description: `
            Helper API to configure ESRI MapServers
            Return Portal Data
        `,
        query: {
            type: "object",
            additionalProperties: false,
            required: [ "portal", "token" ],
            properties: {
                portal: { "type": "string" },
                token: { "type": "string" },
            }
        },
        res: { type: "object" }
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            let portal_url;
            try {
                portal_url = new URL(String(req.query.portal));
            } catch (err) {
                throw new Err(400, null, err.message);
            }

            const esri = new EsriProxyPortal(
                String(req.query.token),
                +new Date() + 1000,
                portal_url,
                config.API_URL,
            );

            const portal = await esri.getPortal();

            return res.json(portal);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/sink/esri/portal/content', {
        name: 'Portal Content',
        group: 'SinkEsri',
        auth: 'user',
        description: `
            Helper API to configure ESRI MapServers
            Return Portal Content
        `,
        query: {
            type: "object",
            additionalProperties: false,
            required: [ "portal", "token" ],
            properties: {
                portal: { "type": "string" },
                token: { "type": "string" },
                title: { "type": "string" },
            }
        },
        res: { type: "object" }
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            let portal_url;
            try {
                portal_url = new URL(String(req.query.portal));
            } catch (err) {
                throw new Err(400, null, err.message);
            }

            const esri = new EsriProxyPortal(
                String(req.query.token),
                +new Date() + 1000,
                portal_url,
                config.API_URL,
            );

            const content = await esri.getContent({
                title: req.query.title ? String(req.query.title) : undefined
            });

            return res.json(content);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.post('/sink/esri/portal/service', {
        name: 'Create Service',
        group: 'SinkEsri',
        auth: 'user',
        description: 'Create Service to store Feature Layers',
        query: {
            type: 'object',
            required: ['portal', 'token'],
            properties: {
                portal: { type: 'string' },
                token: { type: 'string' }
            }
        },
        body: {
            type: 'object',
            required: ['name'],
            properties: {
                name: { type: 'string' }
            }
        },
        res: {
            type: 'object'
        }
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            let portal_url;
            try {
                portal_url = new URL(String(req.query.portal));
            } catch (err) {
                throw new Err(400, null, err.message);
            }

            const esri = new EsriProxyPortal(
                String(req.query.token),
                +new Date() + 1000,
                portal_url,
                config.API_URL,
            );

            const service = await esri.createService(req.body.name);

            return res.json(service);
        } catch (err) {
            return Err.respond(err, res);
        }
    });


    await schema.get('/sink/esri/portal/server', {
        name: 'List Servers',
        group: 'SinkEsri',
        auth: 'user',
        description: `
            Helper API to configure ESRI MapServers
            List Servers associates with a given portal
        `,
        query: {
            type: "object",
            additionalProperties: false,
            required: [ "portal", "token" ],
            properties: {
                portal: { type: "string" },
                token: { type: "string" },
            }
        },
        res: {
            type: "object",
            additionalProperties: false,
            properties: {
                servers: {
                    type: "array",
                    items: { type: "object" }
                },
            }
        }
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            let portal_url;
            try {
                portal_url = new URL(String(req.query.portal));
            } catch (err) {
                throw new Err(400, null, err.message);
            }

            const esri = new EsriProxyPortal(
                String(req.query.token),
                +new Date() + 1000,
                portal_url,
                config.API_URL,
            );

            const servers = await esri.getServers();

            return res.json({
                servers: servers.servers
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/sink/esri/server', {
        name: 'Validate & Auth',
        group: 'SinkEsri',
        auth: 'user',
        description: 'Helper API to configure ESRI MapServers - Get Services',
        query: {
            type: 'object',
            required: ['server', 'portal', 'token'],
            properties: {
                server: { type: 'string' },
                portal: { type: 'string' },
                token: { type: 'string' }
            }
        },
        res: {
            type: 'object',
            required: ['folders', 'services'],
            properties: {
                folders: { type: "array" },
                services: { type: "array" },
            }
        }
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            let portal_url, server_url;
            try {
                portal_url = new URL(String(req.query.portal));
                server_url = new URL(String(req.query.server));
            } catch (err) {
                throw new Err(400, null, err.message);
            }

            const server = new EsriProxyServer(
                new EsriProxyPortal(
                    String(req.query.token),
                    +new Date() + 10000,
                    portal_url,
                    config.API_URL
                ),
                server_url
            );

            const list: any = await server.getList();
            if (!list.folders) list.folders = [];
            if (!list.services) list.services = [];

            return res.json(list);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.post('/sink/esri/server/layer', {
        name: 'Create Layer',
        group: 'SinkEsri',
        auth: 'user',
        description: 'Create Layer necessary to push CoT data',
        query: {
            type: 'object',
            required: ['server', 'portal', 'token'],
            properties: {
                server: { type: 'string' },
                portal: { type: 'string' },
                token: { type: 'string' }
            }
        },
        res: {
            type: 'object'
        }
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            let portal_url, server_url;
            try {
                portal_url = new URL(String(req.query.portal));
                server_url = new URL(String(req.query.server));
            } catch (err) {
                throw new Err(400, null, err.message);
            }

            const server = new EsriProxyServer(
                new EsriProxyPortal(
                    String(req.query.token),
                    +new Date() + 10000,
                    portal_url,
                    config.API_URL
                ),
                server_url
            );

            const layer = await server.createLayer();

            return res.json(layer)
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.delete('/sink/esri/server/layer', {
        name: 'Delete Layer',
        group: 'SinkEsri',
        auth: 'user',
        description: 'Delete an ESRI Layer',
        query: {
            type: 'object',
            required: ['server', 'portal', 'token'],
            properties: {
                server: { type: 'string' },
                portal: { type: 'string' },
                token: { type: 'string' }
            }
        },
        res: {
            type: 'object'
        }
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            if (!String(req.query.server).match(/\/\d+$/)) throw new Err(400, null, 'Could not parse layer ID');

            const url = new URL(String(req.query.server).replace(/\/\d+$/, ''));
            const layer_id = parseInt(String(req.query.server).match(/\/\d+$/)[0].replace('/', ''));

            let portal_url, server_url;
            try {
                portal_url = new URL(String(req.query.portal));
                server_url = new URL(String(req.query.server));
            } catch (err) {
                throw new Err(400, null, err.message);
            }

            const server = new EsriProxyServer(
                new EsriProxyPortal(
                    String(req.query.token),
                    +new Date() + 10000,
                    portal_url,
                    config.API_URL
                ),
                url
            );

            const layer = await server.deleteLayer(layer_id);

            return res.json(layer);
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}