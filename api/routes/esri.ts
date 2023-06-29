import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import Config from '../lib/config.js';
import { Response } from 'express';
import { AuthRequest } from '@tak-ps/blueprint-login';
import EsriProxy from '../lib/esri.js';

export default async function router(schema: any, config: Config) {
    await schema.post('/sink/esri', {
        name: 'Validate & Auth',
        group: 'SinkEsri',
        auth: 'user',
        description: 'Helper API to configure ESRI MapServers - Validate and Authenticate Server',
        body: 'req.body.SinkEsriToken.json',
        res: 'res.SinkEsriToken.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            const esri = await EsriProxy.generateToken(
                new URL(req.body.url),
                config.API_URL,
                req.body.username,
                req.body.password
            );

            const servers = await esri.getServers();

            return res.json({
                token: esri.token,
                servers: servers.servers
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/sink/esri', {
        name: 'Validate & Auth',
        group: 'SinkEsri',
        auth: 'user',
        description: 'Helper API to configure ESRI MapServers - Get Layer',
        query: {
            type: 'object',
            required: ['url', 'token'],
            properties: {
                url: {
                    type: 'string'
                },
                token: {
                    type: 'string'
                }
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

            const esri = new EsriProxy(
                String(req.query.token),
                new URL(String(req.query.url)),
                config.API_URL
            );

            const list = await esri.getList();
            if (!list.folders) list.folders = [];
            if (!list.services) list.services = [];

            return res.json(list);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.post('/sink/esri/layer', {
        name: 'Create Layer',
        group: 'SinkEsri',
        auth: 'user',
        description: 'Create Layer necessary to push CoT data',
        query: {
            type: 'object',
            required: ['url', 'token'],
            properties: {
                url: {
                    type: 'string'
                },
                token: {
                    type: 'string'
                }
            }
        },
        res: 'res.Standard.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            const esri = new EsriProxy(
                String(req.query.token),
                new URL(String(req.query.url)),
                config.API_URL
            );

            await esri.createLayerList();

            return res.json({
                status: 200,
                message: 'Layer Created'
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
