import fetch from './fetch';
import { Static, Type } from '@sinclair/typebox';

export const Agency = Type.Object({
    id: Type.Number(),
    name: Type.String(),
    description: Type.String()
});

export default class ExternalProvider {
    config: Config;
    cache?: {
        expires: Date;
        token: string;
    }

    constructor(config: Config) {
        this.config = config;
    }

    async auth(): Promise<{
        phone: string;
        system_admin: boolean;
        agency_admin: Array<number>;
    }> {
        if (!this.cache || this.cache.expires < new Date()) {
            const expires = new Date();
            const authres = await fetch(new URL(`/oauth/token`, this.config.server.provider_url), {
                method: 'POST',
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
                body: JSON.stringify({
                    "scope": "admin-system",
                    "grant_type":  "client_credentials",
                    "client_id": parseInt(this.config.server.provider_client),
                    "client_secret": this.config.server.provider_secret,
                })
            });

            if (!authres.ok) throw new Err(500, new Error(await authres.text()), 'Internal Provider Token Generation Error');
            const cache = await authres.typed(Type.Object({
                token_type: Type.String(),
                expires_in: Type.Integer(),
                access_token: Type.String()
            }));

            const token = cache.access_token;
            expires.setSeconds(expires.getSeconds() + cache.expires_in - 120);

            this.cache = { token, expires };
        }
    }

    agencies(filter: string): Promise<{
        items: Array<Static<Typeof Agency>>
    }> {
        const agencyres = await fetch(new URL(`/api/v1/admin/agencies`, config.server.provider_url), {
            method: 'GET',
            headers: {
                Accept: 'application/json'
            },
        });

        if (!agencyres.ok) throw new Err(500, new Error(await agencyres.text()), 'External Agency List Error');
        const list = await agencyres.typed(Type.Object({
            data: Type.Array(Agency)
        }));

        return res.json({
            items: list.data
        })
    }

    async login(username: string): Promise<{
        phone: string;
        system_admin: boolean;
        agency_admin: Array<number>;
    }> {
        await this.auth();

        const userres = await fetch(new URL(`/api/v1/server/users/email/${encodeURIComponent(username)}`, this.config.server.provider_url), {
            method: 'GET',
            headers: {
                "Accept": "application/json",
                "Authorization": `Bearer ${this.cache.token}`
            },
        });

        if (!userres.ok) throw new Err(500, new Error(await userres.text()), 'Internal Provider Lookup Error');

        const user_body = await userres.typed(Type.Object({
            data: Type.Object({
                id: Type.Integer(),
                name: Type.String(),
                email: Type.String(),
                phone: Type.String(),
                active: Type.Boolean(),
                agencies: Type.Array(Type.Object({
                    id: Type.Integer(),
                    name: Type.String(),
                    active: Type.Boolean()
                })),
                adminAgencies: Type.Array(Type.Object({
                    id: Type.Integer(),
                    name: Type.String(),
                    active: Type.Boolean()
                })),
                roles: Type.Array(Type.Object({
                    id: Type.Integer(),
                    name: Type.String()
                }))
            })
        }));

        return {
            phone: user_body.data.phone,
            system_admin: user_body.data.roles.some((role) => role.name === 'System Administrator'),
            agency_admin: user_body.data.adminAgencies.map((a) => a.id)
        };
    }
}
