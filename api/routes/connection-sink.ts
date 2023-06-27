import Err from '@openaddresses/batch-error';
// @ts-ignore
import Connection from '../lib/types/connection.js';
// @ts-ignore
import ConnectionSink from '../lib/types/connection-sink.js';
import Auth from '../lib/auth.js';
import Config from '../lib/config.js';
import { Response } from 'express';
import { AuthRequest } from '@tak-ps/blueprint-login';

export default async function router(schema: any, config: Config) {
    await schema.get('/connection/:connectionid/sink', {
        name: 'List Sinks',
        group: 'ConnectionSink',
        auth: 'user',
        description: 'List Sinks',
        ':connectionid': 'integer',
        query: 'req.query.ListConnectionSinks.json',
        res: 'res.ListConnectionSinks.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            const list = await ConnectionSink.list(config.pool, {
                ...req.query,
                connection: req.params.connectionid
            });

            return res.json(list);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.post('/connection/:connectionid/sink', {
        name: 'Create Sink',
        group: 'ConnectionSink',
        auth: 'admin',
        description: 'Register a new connection sink',
        ':connectionid': 'integer',
        body: 'req.body.CreateConnectionSink.json',
        res: 'res.ConnectionSink.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            const conn = await Connection.from(config.pool, req.params.connectionid);

            const sink = await ConnectionSink.generate(config.pool, {
                connection: conn.id,
                ...req.body
            });

            return res.json(conn);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/connection/:connectionid/sink/:sinkid', {
        name: 'Get Sink',
        group: 'ConnectionSink',
        auth: 'admin',
        description: 'Get a connection sink',
        ':connectionid': 'integer',
        ':sinkid': 'integer',
        res: 'res.ConnectionSink.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            const conn = await Connection.from(config.pool, req.params.connectionid);

            const sink = await ConnectionSink.from(config.pool, req.params.sinkid);

            if (sink.connection !== conn.id) throw new Err(400, null, 'Sink must belong to parent connection');

            return res.json(sink);
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
