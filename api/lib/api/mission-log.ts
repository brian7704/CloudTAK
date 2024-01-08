import TAKAPI from '../tak-api.ts';
import { Readable } from 'node:stream'

export default class {
    api: TAKAPI;

    constructor(api: TAKAPI) {
        this.api = api;
    }

    async delete(log: string) {
        const url = new URL(`/Marti/api/missions/logs/entries/${log}`, this.api.url);

        return await this.api.fetch(url, {
            method: 'DELETE',
        });
    }

    async create(mission: string, opts: {
        content: string;
        creatorUid: string;

    }) {
        const url = new URL(`/Marti/api/missions/logs/entries`, this.api.url);

        return await this.api.fetch(url, {
            method: 'POST',
            body: {
                content: opts.content,
                creatorUid: opts.creatorUid,
                missionNames: [ mission ],
            }
        });
    }
}
