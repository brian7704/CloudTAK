import { Type } from '@sinclair/typebox'
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth, { AuthResourceAccess } from '../lib/auth.js';
import { Data, Connection } from '../lib/schema.js';
import Config from '../lib/config.js';
import S3 from '../lib/aws/s3.js';
import { sql, inArray, and } from 'drizzle-orm';
import DataMission from '../lib/data-mission.js';
import { StandardResponse, DataResponse, DataListResponse } from '../lib/types.js';
import * as Default from '../lib/limits.js';

export default async function router(schema: Schema, config: Config) {
    await schema.get('/data', {
        private: true,
        name: 'List Data',
        group: 'Data',
        description: `
            Used by the frontend UI to list data packages that the user can visualize
        `,
        query: Type.Object({
            limit: Default.Limit,
            page: Default.Page,
            order: Default.Order,
            sort: Type.Optional(Type.String({default: 'created', enum: Object.keys(Data)})),
            filter: Default.Filter
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(DataListResponse)
        })
    }, async (req, res) => {
        try {
            const profile = await Auth.as_profile(config, req);

            let where;
            if (profile.system_admin) {
                where = sql`name ~* ${req.query.filter}`
            } else if (profile.agency_admin && profile.agency_admin.length) {
                where = and(
                    sql`name ~* ${req.query.filter}`,
                    inArray(Connection.agency, profile.agency_admin)
                );
            } else {
                throw new Err(400, null, 'Insufficient Access')
            }

            const list = await config.models.Data.list({
                limit: req.query.limit,
                page: req.query.page,
                order: req.query.order,
                sort: req.query.sort,
                where
            });

            res.json(list);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/connection/:connectionid/data', {
        name: 'List Data',
        group: 'Data',
        params: Type.Object({
            connectionid: Type.Integer({ minimum: 1 })
        }),
        description: 'List data',
        query: Type.Object({
            limit: Default.Limit,
            page: Default.Page,
            order: Default.Order,
            sort: Type.Optional(Type.String({default: 'created', enum: Object.keys(Data)})),
            filter: Default.Filter
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(DataListResponse)
        })
    }, async (req, res) => {
        try {
            await Auth.is_connection(config, req, {
                resources: [{ access: AuthResourceAccess.CONNECTION, id: req.params.connectionid }]
            }, req.params.connectionid);

            const list = await config.models.Data.list({
                limit: req.query.limit,
                page: req.query.page,
                order: req.query.order,
                sort: req.query.sort,
                where: sql`
                    name ~* ${req.query.filter}
                    AND connection = ${req.params.connectionid}::BIGINT
                `
            });

            res.json(list);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.post('/connection/:connectionid/data', {
        name: 'Create Data',
        group: 'Data',
        description: 'Register a new data source',
        params: Type.Object({
            connectionid: Type.Integer({ minimum: 1 })
        }),
        body: Type.Object({
            name: Default.NameField,
            description: Default.DescriptionField,
            auto_transform: Type.Optional(Type.Boolean()),
            mission_diff: Type.Optional(Type.Boolean()),
            mission_sync: Type.Optional(Type.Boolean()),
            mission_groups: Type.Optional(Type.Array(Type.String())),
            mission_role: Type.Optional(Type.String())
        }),
        res: DataResponse
    }, async (req, res) => {
        try {
            await Auth.is_connection(config, req, {
                resources: [{ access: AuthResourceAccess.CONNECTION, id: req.params.connectionid }]
            }, req.params.connectionid);

            if (req.body.mission_diff && req.body.mission_role !== 'MISSION_READONLY_SUBSCRIBER') {
                throw new Err(400, null, 'MissionDiff can only be used when role is: MISSION_READONLY_SUBSCRIBER')
            }

            let data = await config.models.Data.generate({
                ...req.body,
                connection: req.params.connectionid
            });

            try {
                const mission = await DataMission.sync(config, data);

                if (mission) {
                    data = await config.models.Data.commit(data.id, {
                        updated: sql`Now()`,
                        mission_groups: Array.isArray(mission.groups) ? mission.groups : [mission.groups]
                    });
                }
            } catch (err) {
                return res.json({
                    mission_exists: false,
                    mission_error: err instanceof Error ? err.message : String(err),
                    ...data
                });
            }

            return res.json({
                mission_exists: true,
                ...data
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.patch('/connection/:connectionid/data/:dataid', {
        name: 'Update Layer',
        group: 'Data',
        description: 'Update a data source',
        params: Type.Object({
            connectionid: Type.Integer({ minimum: 1 }),
            dataid: Type.Integer({ minimum: 1 }),
        }),
        body: Type.Object({
            name: Type.String(),
            description: Type.String(),
            auto_transform: Type.Optional(Type.Boolean()),
            mission_diff: Type.Optional(Type.Boolean()),
            mission_sync: Type.Optional(Type.Boolean())
        }),
        res: DataResponse
    }, async (req, res) => {
        try {
            const { connection } = await Auth.is_connection(config, req, {
                resources: [
                    { access: AuthResourceAccess.DATA, id: req.params.dataid },
                    { access: AuthResourceAccess.CONNECTION, id: req.params.connectionid }
                ]
            }, req.params.connectionid);

            if (req.body.mission_diff && await config.models.Layer.count({
                where: sql`data = ${req.params.dataid}`
            }) > 1) {
                throw new Err(400, null, 'MissionDiff can only be enabled with a single layer')
            }

            // TODO: Don't allow mission_diff to be turned on if there are non MISSION_READONLY subscribers

            let data = await config.models.Data.from(req.params.dataid);
            if (data.connection !== connection.id) throw new Err(400, null, 'Data Sync does not belong to given Connection');

            data = await config.models.Data.commit(req.params.dataid, {
                updated: sql`Now()`,
                ...req.body
            });

            try {
                await DataMission.sync(config, data);
            } catch (err) {
                return res.json({
                    mission_exists: false,
                    mission_error: err instanceof Error ? err.message : String(err),
                    ...data
                });
            }

            return res.json({
                mission_exists: true,
                ...data
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/connection/:connectionid/data/:dataid', {
        name: 'Get Data',
        group: 'Data',
        description: 'Get a data source',
        params: Type.Object({
            connectionid: Type.Integer({ minimum: 1 }),
            dataid: Type.Integer({ minimum: 1 }),
        }),
        res: DataResponse
    }, async (req, res) => {
        try {
            const { connection } = await Auth.is_connection(config, req, {
                resources: [
                    { access: AuthResourceAccess.DATA, id: req.params.dataid },
                    { access: AuthResourceAccess.CONNECTION, id: req.params.connectionid }
                ]
            }, req.params.connectionid);

            const data = await config.models.Data.from(req.params.dataid);
            if (data.connection !== connection.id) throw new Err(400, null, 'Data Sync does not belong to given Connection');

            try {
                await DataMission.sync(config, data);
            } catch (err) {
                return res.json({
                    mission_exists: false,
                    mission_error: err instanceof Error ? err.message : String(err),
                    ...data
                });
            }

            return res.json({
                mission_exists: true,
                ...data
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.delete('/connection/:connectionid/data/:dataid', {
        name: 'Delete Data',
        group: 'Data',
        description: 'Delete a data source',
        params: Type.Object({
            connectionid: Type.Integer({ minimum: 1 }),
            dataid: Type.Integer({ minimum: 1 }),
        }),
        res: StandardResponse
    }, async (req, res) => {
        try {
            const { connection } = await Auth.is_connection(config, req, {
                resources: [{ access: AuthResourceAccess.CONNECTION, id: req.params.connectionid }]
            }, req.params.connectionid);

            const data = await config.models.Data.from(req.params.dataid);
            if (data.connection !== connection.id) throw new Err(400, null, 'Data Sync does not belong to given Connection');

            if (await config.models.Layer.count({
                where: sql`data = ${req.params.dataid}`
            }) > 0) throw new Err(400, null, 'Data has active Layers - Delete layers before deleting Data Sync');

            await S3.del(`data-${String(req.params.dataid)}/`, { recurse: true });

            try {
                data.mission_sync = false;
                await DataMission.sync(config, data);
            } catch (err) {
                await config.models.Data.delete(req.params.dataid);

                return res.json({
                    status: 200,
                    message: `Data Deleted - But TAK Server had an upstream error. Provide an admin with this error message ${String(err)}`
                });
            }

            await config.models.Data.delete(req.params.dataid);

            return res.json({
                status: 200,
                message: `Data Deleted`
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
