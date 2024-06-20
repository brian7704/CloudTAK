import { Type } from '@sinclair/typebox'
import { StandardResponse, GenericMartiResponse } from '../lib/types.js';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import Config from '../lib/config.js';
import { MissionLayerType } from '../lib/api/mission-layer.js';
import TAKAPI, {
    APIAuthCertificate,
} from '../lib/tak-api.js';

export default async function router(schema: Schema, config: Config) {
    await schema.get('/marti/missions/:name/layer', {
        name: 'List Layers',
        group: 'MartiMissionLayer',
        params: Type.Object({
            name: Type.String()
        }),
        description: 'Helper API list mission layers',
        res: GenericMartiResponse
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const auth = (await config.models.Profile.from(user.email)).auth;
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(auth.cert, auth.key));

            const list = await api.MissionLayer.list(
                req.params.name,
                await config.conns.subscription(user.email, req.params.name)
            );

            return res.json(list);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.post('/marti/missions/:name/layer', {
        name: 'Create Layer',
        group: 'MartiMissionLayer',
        params: Type.Object({
            name: Type.String()
        }),
        body: Type.Object({
            name: Type.String(),
            type: Type.Enum(MissionLayerType),
            uid: Type.Optional(Type.String()),
            parentUid: Type.Optional(Type.String()),
            afterUid: Type.Optional(Type.String()),
        }),
        description: 'Helper API to create mission layers',
        res: GenericMartiResponse
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const auth = (await config.models.Profile.from(user.email)).auth;
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(auth.cert, auth.key));

            const create = await api.MissionLayer.create(
                req.params.name,
                {
                    ...req.body,
                    creatorUid: user.email
                },
                await config.conns.subscription(user.email, req.params.name)
            );

            return res.json(create);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.patch('/marti/missions/:name/layer/:uid', {
        name: 'Update Layer',
        group: 'MartiMissionLayer',
        params: Type.Object({
            name: Type.String(),
            uid: Type.String()
        }),
        body: Type.Object({
            name: Type.Optional(Type.String()),
        }),
        description: 'Helper API to update mission layers',
        res: StandardResponse
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const auth = (await config.models.Profile.from(user.email)).auth;
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(auth.cert, auth.key));

            if (req.body.name) {
                await api.MissionLayer.rename(
                    req.params.name,
                    req.params.uid,
                    {
                        name: req.body.name,
                        creatorUid: user.email
                    },
                    await config.conns.subscription(user.email, req.params.name)
                );
            }

            return res.json({
                status: 200,
                message: 'Layer Updated'
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.delete('/marti/missions/:name/layer/:uid', {
        name: 'Delete Layer',
        group: 'MartiMissionLayer',
        params: Type.Object({
            name: Type.String(),
            uid: Type.String()
        }),
        description: 'Helper API to delete mission layers',
        res: StandardResponse
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const auth = (await config.models.Profile.from(user.email)).auth;
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(auth.cert, auth.key));

            await api.MissionLayer.delete(
                req.params.name,
                {
                    uid: [ req.params.uid ],
                    creatorUid: user.email
                },
                await config.conns.subscription(user.email, req.params.name)
            );

            return res.json({
                status: 200,
                message: 'Layer Deleted'
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
