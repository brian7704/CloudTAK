import { defineStore } from 'pinia'
import Overlay from './overlays/base.ts';
import cotStyles from './overlays/styles.ts'
import { std, stdurl } from '../std.js';
import * as pmtiles from 'pmtiles';
import mapgl from 'maplibre-gl'
import * as terraDraw from 'terra-draw';
import pointOnFeature from '@turf/point-on-feature';
import type { Basemap, ProfileOverlay } from '../types.ts';
import type { FeatureCollection, Feature } from 'geojson';
import type {
    LngLat,
    Point,
    MapMouseEvent,
    LayerSpecification,
    CircleLayerSpecification,
    SymbolLayerSpecification,
    LineLayerSpecification,
    FillLayerSpecification,
    MapGeoJSONFeature
} from 'maplibre-gl';
import { useCOTStore } from './cots.js'
const cotStore = useCOTStore();

export const useMapStore = defineStore('cloudtak', {
    state: (): {
        map?: mapgl.Map;
        draw?: terraDraw.TerraDraw;
        edit: null | MapGeoJSONFeature;
        container?: HTMLElement;
        isLoaded: boolean;
        bearing: number;
        selected: Map<string, MapGeoJSONFeature>;
        select: {
            mode?: string;
            e?: MapMouseEvent;
            feats: MapGeoJSONFeature[];
            x: number;
            y: number;
        },
        radial: {
            mode?: string;
            cot?: object;
            x: number;
            y: number;
        },
        overlays: Array<Overlays>
    } => {
        const protocol = new pmtiles.Protocol();
        mapgl.addProtocol('pmtiles', protocol.tile);

        return {
            isLoaded: false,
            bearing: 0,
            edit: null,
            select: {
                mode: undefined,
                feats: [],
                x: 0, y: 0,
            },
            radial: {
                x: 0, y: 0,
            },
            overlays: [],

            selected: new Map()
        }
    },
    actions: {
        destroy: function() {
            if (this.map) {
                try {
                    this.map.remove();
                    delete this.map;
                } catch (err) {
                    console.error(err);
                }
            }
            this.$reset();
        },
        removeOverlay: async function(overlay: Overlay) {
            if (!this.map) throw new Error('Cannot removeOverlay before map has loaded');

            const pos = this.overlays.indexOf(overlay)
            if (pos === -1) return;

            this.overlays.splice(pos, 1)
            await overlay.delete();
        },
        getOverlayById(id: string): OverlayContainer | null {
            for (let i = 0; i < this.overlays.length; i++) {
                if (this.overlays[i].id === id) {
                    return this.overlays[i];
                }
            }

            return null;
        },
        getOverlayByMode(mode: string, mode_id: string): OverlayContainer | null {
            for (let i = 0; i < this.overlays.length; i++) {
                if (this.overlays[i].mode === mode && this.overlays[i].mode_id === mode_id) {
                    return this.overlays[i];
                }
            }

            return null;
        },

        /**
         * Given a mission Guid, attempt to refresh the Map Layer
         * @returns {boolean} True if successful, false if not
         */
        updateMissionData: function(guid: string): boolean {
            const overlay = this.getLayerByMode('mission', guid)
            if (!overlay) return false;

            if (!this.map) throw new Error('Cannot updateMissionData before map has loaded');
            const oStore = this.map.getSource(overlay.id);
            if (!oStore) return false

            // @ts-expect-error TS currently blows up Map<string, Feature> into actual { type: 'Feature' ... } etc
            const fc = cotStore.collection(cotStore.subscriptions.get(guid))

            // @ts-expect-error Source.setData is not defined
            oStore.setData(fc);

            return true;
        },
        init: function(container: HTMLElement) {
            this.container = container;

            const init: mapgl.MapOptions = {
                container: this.container,
                hash: true,
                attributionControl: false,
                fadeDuration: 0,
                zoom: 8,
                pitch: 0,
                bearing: 0,
                maxPitch: 85,
                center: [-105.91873757464982, 39.2473040734323],
                style: {
                    version: 8,
                    glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
                    sprite: [{
                        id: 'default',
                        url: String(stdurl(`/api/icon/sprite?token=${localStorage.token}&iconset=default`))
                    }],
                    sources: {
                        '-1': {
                            type: 'geojson',
                            cluster: false,
                            promoteId: 'id',
                            data: { type: 'FeatureCollection', features: [] }
                        },
                        0: {
                            type: 'geojson',
                            cluster: false,
                            data: { type: 'FeatureCollection', features: [] }
                        }
                    },
                    layers: [{
                        id: 'background',
                        type: 'background',
                        paint: { 'background-color': 'rgb(4,7,14)' }
                    }]
                }
            };

            if (!init.style || typeof init.style === 'string') throw new Error('init.style must be an object');

            this.map = new mapgl.Map(init);
        },
        initOverlays: async function() {
            if (!this.map) throw new Error('Cannot initLayers before map has loaded');
            this.map.on('rotate', () => {
                this.bearing = this.map.getBearing()
            })
            this.map.on('click', (e: MapMouseEvent) => {
                if (this.draw && this.draw.getMode() !== 'static') return;

                if (this.radial.mode) this.radial.mode = undefined;
                if (this.select.feats) this.select.feats = [];

                // Ignore Non-Clickable Layer
                const clickMap: Map<string, { type: string, id: string }> = new Map();
                for (const l of this.overlays) for (const c of l.clickable) clickMap.set(c.id, c);
                const features = this.map.queryRenderedFeatures(e.point).filter((feat) => {
                    return clickMap.has(feat.layer.id);
                });

                if (!features.length) return;

                // MultiSelect Mode
                if (e.originalEvent.ctrlKey && features.length) {
                    this.selected.set(features[0].properties.id, features[0]);
                } else if (features.length === 1) {
                    this.radialClick(features[0], {
                        lngLat: e.lngLat,
                        point: e.point
                    })
                } else if (features.length > 1) {
                    if (e.point.x < 150 || e.point.y < 150) {
                        const flyTo: mapgl.FlyToOptions = {
                            speed: Infinity,
                            center: [e.lngLat.lng, e.lngLat.lat]
                        };

                        if (this.map.getZoom() < 3) flyTo.zoom = 4;
                        this.map.flyTo(flyTo)

                        this.select.x = this.container ? this.container.clientWidth / 2 : 0;
                        this.select.y = this.container ? this.container.clientHeight / 2 : 0;
                    } else {
                        this.select.x = e.point.x;
                        this.select.y = e.point.y;
                    }

                    this.select.e = e;
                    this.select.feats = features;
                }
            });

            this.map.on('contextmenu', (e) => {
                if (this.edit) return;

                this.radialClick({
                    id: window.crypto.randomUUID(),
                    type: 'Feature',
                    properties: {
                        callsign: 'New Feature',
                        archived: true,
                        type: 'u-d-p',
                        'marker-color': '#00ff00',
                        'marker-opacity': 1
                    },
                    geometry: {
                        type: 'Point',
                        coordinates: [e.lngLat.lng, e.lngLat.lat]
                    }
                }, {
                    mode: 'context',
                    point: e.point,
                    lngLat: e.lngLat
                });
            });

            const url = stdurl('/api/profile/overlay');
            url.searchParams.append('sort', 'pos');
            url.searchParams.append('order', 'asc');
            const items = (await std(url)).items;

            const hasBasemap = items.some((o) => {
                return o.mode === 'basemap'
            });

            // Courtesy add an initial basemap
            if (!hasBasemap) {
                const burl = stdurl('/api/basemap');
                burl.searchParams.append('type', 'raster');
                const basemaps = await std(burl);

                if (basemaps.items.length > 0) {
                    const basemap = await Overlay.create({
                        name: basemaps.items[0].name,
                        pos: -1,
                        type: 'raster',
                        url: `/api/basemap/${basemaps.items[0].id}/tiles`,
                        mode: 'basemap',
                        mode_id: basemaps.items[0].id
                    });

                    items.unshift(basemap);
                }
            }

            for (const item of items) {
                this.overlays.push(new Overlay(
                    this.map,
                    item as ProfileOverlay
                ));
            }

            this.overlays.push(Overlay.internal(
                this.map,
                {
                    id: '-1',
                    name: 'CoT Icons',
                    type: 'geojson',
                },{
                    layers: cotStyles('-1', {
                        group: true,
                        icons: true,
                        labels: true
                    }),
                    clickable: [
                        { id: 'cots', type: 'cot' },
                        { id: 'cots-poly', type: 'cot' },
                        { id: 'cots-group', type: 'cot' },
                        { id: `cots-icon`, type: 'cot' },
                        { id: 'cots-line', type: 'cot' }
                    ],
                }
            ));

            this.overlays.push(Overlay.internal(
                this.map,
                {
                    id: '0',
                    name: 'Your Location',
                    type: 'vector',
                },{
                    layers: [{
                        id: 'you',
                        type: 'circle',
                        source: '0',
                        paint: {
                            'circle-radius': 10,
                            'circle-color': '#0000f6',
                        },
                    }]
                }
            ));
        },
        radialClick: async function(feat: MapGeoJSONFeature | Feature, opts: {
            lngLat: LngLat;
            point: Point;
            mode?: string;
        }): Promise<void> {
            if (!this.map) throw new Error('Cannot radialClick before map has loaded');

            // If the call is coming from MultipleSelect, ensure this menu is closed
            this.select.feats = [];

            if (!opts.mode) {
                const clickMap: Map<string, { type: string, id: string }> = new Map();
                for (const l of this.overlays) for (const c of l.clickable) clickMap.set(c.id, c);
                if (!('layer' in feat)) return;
                const click = clickMap.get(feat.layer.id);
                if (!click) return;
                opts.mode = click.type;
            }

            if (opts.point.x < 150 || opts.point.y < 150) {
                const flyTo: mapgl.FlyToOptions = {
                    speed: Infinity,
                    center: [opts.lngLat.lng, opts.lngLat.lat]
                };

                if (this.map.getZoom() < 3) flyTo.zoom = 4;
                this.map.flyTo(flyTo)

                this.radial.x = this.container ? this.container.clientWidth / 2 : 0;
                this.radial.y = this.container ? this.container.clientHeight / 2 : 0;
            } else {
                this.radial.x = opts.point.x;
                this.radial.y = opts.point.y;
            }

            this.radial.cot = feat;
            this.radial.mode = opts.mode;
        },
        initDraw: function() {
            this.draw = new terraDraw.TerraDraw({
                adapter: new terraDraw.TerraDrawMapLibreGLAdapter({
                    map: this.map
                }),
                modes: [
                    new terraDraw.TerraDrawPointMode(),
                    new terraDraw.TerraDrawLineStringMode(),
                    new terraDraw.TerraDrawPolygonMode(),
                    new terraDraw.TerraDrawRectangleMode(),
                    new terraDraw.TerraDrawSelectMode({
                        flags: {
                            polygon: {
                                feature: {
                                    draggable: true,
                                    coordinates: {
                                        deletable: true,
                                        midpoints: true,
                                        draggable: true,
                                    }
                                }
                            },
                            linestring: {
                                feature: {
                                    draggable: true,
                                    coordinates: {
                                        deletable: true,
                                        midpoints: true,
                                        draggable: true,
                                    }
                                }
                            },
                            point: {
                                feature: {
                                    draggable: true
                                }
                            }
                        }
                    })
                ]
            });
            this.isLoaded = true;
        }
    },
})
