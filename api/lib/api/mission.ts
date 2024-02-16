import TAKAPI from '../tak-api.js';
import Err from '@openaddresses/batch-error';
import { Readable } from 'node:stream'
import { TAKList } from './types.js';

export type Mission = {
    name: string;
    description: string;
    chatRoom: string;
    baseLayer: string;
    bbox: string;
    path: string;
    classification: string;
    tool: string;
    keywords: Array<unknown>;
    creatorUid: string;
    createTime: string;
    externalData: Array<unknown>;
    feeds: Array<unknown>;
    mapLayers: Array<unknown>;
    ownerRole: Array<unknown>;
    inviteOnly: boolean;
    expiration: number;
    guid: string;
    uids: Array<unknown>,
    contents: Array<{
        data: {
            name: string;
            hash: string;
        }
    }>,
    passwordProtected: boolean;
    token?: string; // Only present when mission created
    groups?: Array<string>; // Only present on Mission.get()
    missionChanges?: Array<unknown>; // Only present on Mission.get()
}

export type MissionSubscriber = {
    token?: string;
    clientUid: string;
    username: string;
    createTime: string;
    role: {
        permissions: Array<string>;
        hibernateLazyInitializer: object;
        type: string;
    }
}

/**
 * @class
 */
export default class {
    api: TAKAPI;

    constructor(api: TAKAPI) {
        this.api = api;
    }

    /**
     * Return users associated with this mission
     */
    async contacts(name: string) {
        const url = new URL(`/Marti/api/missions/${encodeURIComponent(name)}/contacts`, this.api.url);

        return await this.api.fetch(url, {
            method: 'GET'
        });
    }

    /**
     * Remove a file from the mission
     */
    async detachContents(name: string, hash: string) {
        const url = new URL(`/Marti/api/missions/${encodeURIComponent(name)}/contents`, this.api.url);
        url.searchParams.append('hash', hash);

        return await this.api.fetch(url, {
            method: 'DELETE',
        });
    }

    /**
     * Attach a file resource by hash from the TAK Server file manager
     */
    async attachContents(name: string, hashes: string[]) {
        const url = new URL(`/Marti/api/missions/${encodeURIComponent(name)}/contents`, this.api.url);

        return await this.api.fetch(url, {
            method: 'PUT',
            body: {
                hashes: hashes
            }
        });
    }

    /**
     * Upload a Mission Package
     */
    async upload(name: string, creatorUid: string, body: Readable) {
        const url = new URL(`/Marti/api/missions/${encodeURIComponent(name)}/contents/missionpackage`, this.api.url);
        url.searchParams.append('creatorUid', creatorUid);

        return await this.api.fetch(url, {
            method: 'PUT',
            body
        });
    }

    /**
     * Return UIDs associated with any subscribed users
     */
    async subscriptions(name: string): Promise<TAKList<MissionSubscriber>> {
        const url = new URL(`/Marti/api/missions/${encodeURIComponent(name)}/subscriptions`, this.api.url);
        return await this.api.fetch(url, {
            method: 'GET'
        });
    }

    /**
     * Return permissions associated with any subscribed users
     */
    async subscriptionRoles(name: string): Promise<TAKList<any>> {
        const url = new URL(`/Marti/api/missions/${encodeURIComponent(name)}/subscriptions/roles`, this.api.url);
        return await this.api.fetch(url, {
            method: 'GET'
        });
    }

    /**
     * Return permissions associated with a given mission if subscribed
     */
    async subscription(name: string): Promise<MissionSubscriber> {
        const url = new URL(`/Marti/api/missions/${encodeURIComponent(name)}/subscription`, this.api.url);
        const res = await this.api.fetch(url, {
            method: 'GET'
        });

        return res.data;
    }

    /**
     * Subscribe to a mission
     */
    async subscribe(name: string, query: {
        uid: string;
        password?: string;
        secago?: number;
        start?: string;
        end?: string;

        [key: string]: unknown;
    }) {
        const url = new URL(`/Marti/api/missions/${encodeURIComponent(name)}/subscription`, this.api.url);

        for (const q in query) url.searchParams.append(q, String(query[q]));
        return await this.api.fetch(url, {
            method: 'PUT'
        });
    }

    /**
     * Get current subscription status
     */
    async subscribed(name: string, query: {
        uid: string;

        [key: string]: unknown;
    }) {
        const url = new URL(`/Marti/api/missions/${encodeURIComponent(name)}/subscription`, this.api.url);

        for (const q in query) url.searchParams.append(q, String(query[q]));
        return await this.api.fetch(url, {
            method: 'GET'
        });
    }

    /**
     * Unsubscribe from a mission
     */
    async unsubscribe(name: string, query: {
        uid: string;
        disconnectOnly?: string;

        [key: string]: unknown;
    }) {
        const url = new URL(`/Marti/api/missions/${encodeURIComponent(name)}/subscription`, this.api.url);

        for (const q in query) url.searchParams.append(q, String(query[q]));
        return await this.api.fetch(url, {
            method: 'DELETE'
        });
    }

    /**
     * List missions in currently active channels
     */
    async list(query: {
        passwordProtected?: string;
        defaultRole?: string;
        tool?: string;

        [key: string]: unknown;
    }) {
        const url = new URL('/Marti/api/missions', this.api.url);

        for (const q in query) url.searchParams.append(q, String(query[q]));
        return await this.api.fetch(url, {
            method: 'GET'
        });
    }

    /**
     * Get mission by its GUID
     */
    async getGuid(guid: string, query: {
        password?: string;
        changes?: string;
        logs?: string;
        secago?: string;
        start?: string;
        end?: string;

        [key: string]: unknown;
    }): Promise<Mission> {
        const url = new URL(`/Marti/api/missions/guid/${encodeURIComponent(guid)}`, this.api.url);

        for (const q in query) url.searchParams.append(q, String(query[q]));
        const missions: TAKList<Mission> = await this.api.fetch(url, {
            method: 'GET'
        });

        if (!missions.data.length) throw new Err(404, null, `No Mission for GUID: ${guid}`);
        return missions.data[0];
    }

    /**
     * Get mission by its Name
     */
    async get(name: string, query: {
        password?: string;
        changes?: string;
        logs?: string;
        secago?: string;
        start?: string;
        end?: string;

        [key: string]: unknown;
    }): Promise<Mission> {
        const url = new URL(`/Marti/api/missions/${encodeURIComponent(name)}`, this.api.url);

        for (const q in query) url.searchParams.append(q, String(query[q]));
        const missions: TAKList<Mission> = await this.api.fetch(url, {
            method: 'GET'
        });

        if (!missions.data.length) throw new Err(404, null, `No Mission for Name: ${name}`);
        return missions.data[0];
    }

    /**
     * Create a new mission
     */
    async create(name: string, query: {
        group: Array<string> | string;
        creatorUid: string;
        description?: string;
        chatRoom?: string;
        baseLayer?: string;
        bbox?: string;
        boundingPolygon?: string;
        path?: string;
        classification?: string;
        tool?: string;
        password?: string;
        defaultRole?: string;
        expiration?: string;
        inviteOnly?: string;
        allowDupe?: string;

        [key: string]: unknown;
    }): Promise<TAKList<Mission>> {
        const url = new URL(`/Marti/api/missions/${encodeURIComponent(name)}`, this.api.url);

        if (query.group && Array.isArray(query.group)) query.group = query.group.join(',');
        for (const q in query) url.searchParams.append(q, String(query[q]));
        return await this.api.fetch(url, {
            method: 'POST'
        });
    }

    /**
     * Delete a mission
     */
    async delete(name: string, query: {
        creatorUid?: string;
        deepDelete?: string;

        [key: string]: unknown;
    }) {
        const url = new URL(`/Marti/api/missions/${encodeURIComponent(name)}`, this.api.url);

        for (const q in query) url.searchParams.append(q, String(query[q]));
        return await this.api.fetch(url, {
            method: 'DELETE'
        });
    }
}
