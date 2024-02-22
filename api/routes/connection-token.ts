import { Type } from '@sinclair/typebox'
import { Response } from 'express';
import { AuthRequest } from '@tak-ps/blueprint-login';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import Config from '../lib/config.js';
import { promisify } from 'util';
import jwt from 'jsonwebtoken';
import { sql } from 'drizzle-orm';
import Schema from '@openaddresses/batch-schema';
import { StandardResponse } from '../lib/types.js';

export default async function router(schema: Schema, config: Config) {
    await schema.get('/connection/:connectionid/token', {
        name: 'List Tokens',
        group: 'ConnectionToken',
        description: 'List all tokens associated with a given connection',
        params: Type.Object({
            connectionid: Type.Integer()
        }),
        query: 'req.query.ListConnectionTokens.json',
        res: 'res.ListConnectionTokens.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(config.models, req);

            const list = await config.models.ConnectionToken.list({
                limit: Number(req.query.limit),
                page: Number(req.query.page),
                order: String(req.query.order),
                sort: String(req.query.sort),
                where: sql`
                    name ~* ${req.query.filter}
                    AND connection = ${parseInt(String(req.params.connectionid))}
                `
            });

            return res.json(list);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.post('/connection/:connectionid/token', {
        name: 'Create Tokens',
        group: 'ConnectionToken',
        description: 'Create a new API token for programatic access',
        params: Type.Object({
            connectionid: Type.Integer()
        }),
        body: 'req.body.CreateConnectionToken.json',
        res: 'res.CreateConnectionToken.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.as_user(config.models, req);

            const connectionid = parseInt(String(req.params.connectionid));
            const token = await config.models.ConnectionToken.generate({
                ...req.body,
                token: 'etl.' + jwt.sign({ id: connectionid, access: 'connection' }, config.SigningSecret),
                connection: connectionid
            });

            return res.json(token);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.patch('/connection/:connectionid/token/:id', {
        name: 'Update Token',
        group: 'ConnectionToken',
        params: Type.Object({
            connectionid: Type.Integer()
            id: Type.Integer()
        }),
        description: 'Update properties of a Token',
        body: 'req.body.PatchConnectionToken.json',
        res: StandardResponse
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.as_user(config.models, req);

            const token = await config.models.ConnectionToken.from(sql`id = ${Number(req.params.id)}::INT`);
            if (token.connection !== parseInt(String(req.params.connectionid))) throw new Err(400, null, 'You can only modify your own tokens');

            await config.models.Token.commit(sql`id = ${token.id}::INT`, {
                updated: sql`Now()`,
                ...req.body
            });

            return res.json({ status: 200, message: 'Connection Token Updated' });
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.delete('/connection/:connectionid/token/:id', {
        name: 'Delete Tokens',
        group: 'Token',
        description: 'Delete a user\'s API Token',
        params: Type.Object({
            connectionid: Type.Integer()
            id: Type.Integer()
        }),
        res: StandardResponse
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.as_user(config.models, req);

            const token = await config.models.ConnectionToken.from(sql`id = ${Number(req.params.id)}::INT`);
            if (token.connection !== parseInt(String(req.params.connectionid))) throw new Err(400, null, 'You can only modify your own tokens');

            await config.models.ConnectionToken.delete(sql`id = ${token.id}::INT`);

            return res.json({ status: 200, message: 'Connection Token Deleted' });
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
