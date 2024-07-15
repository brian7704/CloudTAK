import { Type } from '@sinclair/typebox'
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import Config from '../lib/config.js';
import { sql } from 'drizzle-orm';
import { LayerTemplateResponse } from '../lib/types.js';
import { LayerTemplate } from '../lib/schema.js';
import * as Default from '../lib/limits.js';

export default async function router(schema: Schema, config: Config) {
    await schema.get('/template', {
        name: 'List Templates',
        group: 'LayerTemplate',
        description: 'List all layer templates',
        query: Type.Object({
            limit: Default.Limit,
            page: Default.Page,
            order: Default.Order,
            sort: Type.Optional(Type.String({default: 'created', enum: Object.keys(LayerTemplate)})),
            filter: Default.Filter,
            data: Type.Optional(Type.Integer({ minimum: 1 })),
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(LayerTemplateResponse)
        })
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req);

            const list = await config.models.LayerTemplate.list({
                limit: req.query.limit,
                page: req.query.page,
                order: req.query.order,
                sort: req.query.sort,
                where: sql`
                    name ~* ${req.query.filter}
                `
            });

            return res.json(list)
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
