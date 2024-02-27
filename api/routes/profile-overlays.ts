import { Type } from '@sinclair/typebox'
import Config from '../lib/config.js';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth, { AuthResource } from '../lib/auth.js';
import { StandardResponse, ProfileOverlayResponse } from '../lib/types.js'
import { Response } from 'express';
import { sql } from 'drizzle-orm';
import TAKAPI, {
    APIAuthToken,
    APIAuthCertificate,
    APIAuthPassword
} from '../lib/tak-api.js';

export default async function router(schema: Schema, config: Config) {
    await schema.get('/profile/overlay', {
        name: 'Get Overlays',
        group: 'ProfileOverlays',
        description: 'Get User\'s Profile Overlays',
        query: Type.Object({
            limit: Type.Optional(Type.Integer())
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(ProfileOverlayResponse)
        })

    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req);

            const overlays = await config.models.ProfileOverlay.list({
                limit: req.query.limit
            });

            return res.json(overlays);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.post('/profile/overlay', {
        name: 'Create Overlay',
        group: 'ProfileOverlay',
        description: 'Create Profile Overlay',
        body: Type.Object({
            pos: Type.Optional(Type.Integer()),
            type: Type.Optional(Type.String()),
            opacity: Type.Optional(Type.Number()),
            visible: Type.Optional(Type.Boolean()),
            mode: Type.String(),
            mode_id: Type.String(),
            url: Type.String(),
            name: Type.String()
        }),
        res: ProfileOverlayResponse
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const overlay = await config.models.ProfileOverlay.generate({
                ...req.body,
                username: user.email
            });

            if (req.body.mode === 'mission') {
                const profile = await config.models.Profile.from(user.email);
                const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(profile.auth.cert, profile.auth.key));

                const mission = await api.Mission.getGuid(overlay.mode_id, { uid: user.email });
                await api.Mission.subscribe(mission.name, { uid: user.email });
            }

            return res.json(overlay);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.delete('/profile/overlay', {
        name: 'delete Overlay',
        group: 'ProfileOverlay',
        description: 'Create Profile Overlay',
        query: Type.Object({
            id: Type.String()
        }),
        res: StandardResponse
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const overlay = await config.models.ProfileOverlay.from(parseInt(String(req.query.id)));

            if (overlay.username !== user.email) {
                throw new Err(403, null, 'Cannot delete anothers overlays');
            }

            await config.models.ProfileOverlay.delete(overlay.id);

            if (overlay.mode === 'mission') {
                const profile = await config.models.Profile.from(user.email);
                const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(profile.auth.cert, profile.auth.key));
                const mission = await api.Mission.getGuid(overlay.mode_id, { uid: user.email });
                await api.Mission.unsubscribe(mission.name, { uid: user.email });
            }

            return res.json({
                status: 200,
                message: 'Overlay Removed'
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
