import undici from 'undici';
import { Readable } from 'node:stream';
import type { BBox } from 'geojson';
import type { Response } from 'express';
import { pipeline, Writable, PassThrough } from 'node:stream';
import { pipeline as promisePipeline } from 'node:stream/promises';
import { pointOnFeature } from '@turf/point-on-feature';
import { bboxPolygon } from '@turf/bbox-polygon';
import { Static, Type } from '@sinclair/typebox'
import Err from '@openaddresses/batch-error';
import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec';

export const TileJSONType = Type.Object({
    tilejson: Type.String(),
    version: Type.String(),
    name: Type.String(),
    minzoom: Type.Integer(),
    maxzoom: Type.Integer(),
    tiles: Type.Array(Type.String()),
    bounds: Type.Array(Type.Number()),
    center: Type.Array(Type.Number()),
    type: Type.String(),
    layers: Type.Array(Type.Unknown()),
    format: Type.Optional(Type.String()),
})

export interface TileJSONInterface {
    name: string;
    url: string;
    bounds?: Array<number>;
    center?: Array<number>;
    type?: string;
    version?: string;
    minzoom?: number;
    maxzoom?: number;
}

export default class TileJSON {
    static isValidStyle(type: string, layers: Array<any>): void {
        const sources: Record<string, unknown> = {};

        for (const l of layers) {
            if (!sources[l.source]) {
                sources[l.source] = { type }
            }
        }

        const errors = validateStyleMin({
            version: 8,
            glyphs: '/fonts/{fontstack}/{range}.pbf',
            sources: sources as any,
            layers: layers as any
        })

        if (errors.length) throw new Err(400, null, JSON.stringify(errors));
    }

    static json(config: TileJSONInterface): Static<typeof TileJSONType> {
        const bounds = config.bounds || [-180, -90, 180, 90];
        const center = config.center || pointOnFeature(bboxPolygon(bounds as BBox)).geometry.coordinates;

        return {
            tilejson: "2.2.0",
            version: config.version || '1.0.0',
            name: config.name,
            type: config.type || 'raster',
            bounds, center,
            minzoom: config.minzoom || 0,
            maxzoom: config.maxzoom || 16,
            tiles: [ String(config.url) ],
            layers: []
        }
    }

    static async tile(
        config: TileJSONInterface,
        z: number, x: number, y: number,
        res: Response
    ): Promise<void> {
        const url = new URL(config.url
            .replace(/\{\$?z\}/, String(z))
            .replace(/\{\$?x\}/, String(x))
            .replace(/\{\$?y\}/, String(y))
        );

        const stream = await undici.pipeline(url, {
            method: 'GET',
        }, ({ statusCode, headers, body }) => {
            if (headers) {
                for (const key in headers) {
                    if (
                        ![
                            'content-type',
                            'content-length',
                            'content-encoding',
                            'last-modified',
                        ].includes(key)
                    ) {
                        delete headers[key];
                    }
                }
            }

            res.writeHead(statusCode, headers);

            return body;
        });

        stream
            .on('data', (buf) => {
                res.write(buf)
            })
            .on('end', () => {
                res.end()
            })
            .on('close', () => {
                res.end()
            })
            .end()

    }
}
