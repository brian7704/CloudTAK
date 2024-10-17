import type {
    ProfileOverlay,
    ProfileOverlay_Create
} from '../../types.ts';
import type { FeatureCollection } from 'geojson';
import mapgl from 'maplibre-gl'
import type { LayerSpecification } from 'maplibre-gl'
import cotStyles from '../utils/styles.ts'
import { std, stdurl } from '../../std.js';
import { useProfileStore } from '../profile.js';


/**
 * @class
 */
export default class Overlay {
    _map: mapgl.Map;
    _destroyed: boolean;
    _internal: boolean;

    _clickable: Array<{ id: string; type: string }>;

    _error?: Error;
    _loaded: boolean;

    id: number;
    name: string;
    username?: string;
    created: string;
    updated: string;
    pos: number;
    type: string;
    opacity: number;
    visible: boolean;
    mode: string;
    mode_id: string | null;
    url?: string;
    styles: Array<LayerSpecification>;
    token: string | null;

    static async create(
        map: mapgl.Map,
        body: ProfileOverlay_Create,
        opts: {
            clickable?: Array<{ id: string; type: string }>;
            before?: string;
        } = {}
    ): Promise<Overlay> {
        let ov = await std('/api/profile/overlay', {
            method: 'POST',
            body
        }) as ProfileOverlay;

        if (ov.styles && ov.styles.length) {
            for (const layer of ov.styles) {
                const l = layer as LayerSpecification;
                l.id = `${ov.id}-${l.id}`;
                // @ts-expect-error Special case Background Layer type
                l.source = String(ov.id);
            }
        }

        ov = await std(`/api/profile/overlay/${ov.id}`, {
            method: 'PATCH',
            body: ov
        }) as ProfileOverlay;

        return new Overlay(map, ov, opts);
    }

    static internal(
        map: mapgl.Map,
        body: {
            id: number;
            type: string;
            name: string;
            styles?: Array<LayerSpecification>;
            clickable?: Array<{ id: string; type: string }>;
        },
    ): Overlay {
        const overlay = new Overlay(map, {
            ...body,
            visible: true,
            opacity: 1,
            username: 'internal',
            url: '',
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            token: null,
            mode: 'internal',
            mode_id: null,
            styles: body.styles || [],
            pos: 3,
        }, {
            clickable: body.clickable,
            internal: true
        });

        return overlay;
    }

    static async load(map: mapgl.Map, id: number): Promise<Overlay> {
        const overlay = await std(`/api/profile/overlay/${id}`);
        return new Overlay(map, overlay as ProfileOverlay);
    }

    constructor(map: mapgl.Map, overlay: ProfileOverlay, opts: {
        clickable?: Array<{ id: string; type: string }>;
        internal?: boolean;
        before?: string;
    } = {}) {
        this._map = map;

        this._destroyed = false;
        this._internal = opts.internal || false;
        this._clickable = [];
        this._loaded = false;

        this.id = overlay.id;
        this.name = overlay.name;
        this.username = overlay.username;
        this.created = overlay.created;
        this.updated = overlay.updated;
        this.pos = overlay.pos;
        this.type = overlay.type;
        this.opacity = overlay.opacity;
        this.visible = overlay.visible;
        this.mode = overlay.mode;
        this.mode_id = overlay.mode_id;
        this.url = overlay.url;
        this.styles = overlay.styles as Array<LayerSpecification>;
        this.token = overlay.token;

        this.init(opts);
    }

    healthy(): boolean {
        return !this._error;
    }

    init(opts: {
        clickable?: Array<{ id: string; type: string }>;
        before?: string;
    } = {}) {
        if (this.type ==='raster' && this.url) {
            const url = stdurl(this.url);
            url.searchParams.append('token', localStorage.token);

            this._map.addSource(String(this.id), {
                type: 'raster',
                url: String(url)
            });
        } else if (this.type === 'vector' && this.url) {
            const url = stdurl(this.url);
            url.searchParams.append('token', localStorage.token);

            this._map.addSource(String(this.id), {
                type: 'vector',
                url: String(url)
            });
        } else if (this.type === 'geojson') {
            if (!this._map.getSource(String(this.id))) {
                const data: FeatureCollection = { type: 'FeatureCollection', features: [] };

                this._map.addSource(String(this.id), {
                    type: 'geojson',
                    cluster: false,
                    data
                })
            }
        }

        const profileStore = useProfileStore();
        const display_text = profileStore.profile ? profileStore.profile.display_text : 'Medium';
        let size = 8
        if (display_text === 'Small') size = 4;
        if (display_text === 'Large') size = 16;

        if (!this.styles.length && this.type === 'raster') {
            this.styles = [{
                'id': String(this.id),
                'type': 'raster',
                'source': String(this.id)
            }]
        } else if (!this.styles.length && this.type === 'vector') {
            this.styles = cotStyles(String(this.id), {
                sourceLayer: 'out',
                group: false,
                icons: false,
                labels: { size }
            });
        } else if (!this.styles.length && this.type === 'geojson') {
            this.styles = cotStyles(String(this.id), {
                group: this.mode !== "mission",
                icons: true,
                course: true,
                labels: { size }
            });

        } else if (!this.styles.length) {
            this.styles = [];
        }

        if (this.type === 'vector' && opts.clickable === undefined) {
            opts.clickable = this.styles.map((l) => {
                return { id: l.id, type: 'feat' };
            });
        } else if (this.type === 'geojson' && opts.clickable === undefined) {
            opts.clickable = this.styles.map((l) => {
                if (this.mode === 'mission') {
                    return { id: l.id, type: 'cot' };
                } else {
                    return { id: l.id, type: this.id === -1 ? 'cot' : 'feat' };
                }
            });
        }

        for (const l of this.styles) {
            if (opts.before) {
                this._map.addLayer(l, opts.before);
            } else {
                this._map.addLayer(l)
            }
        }

        // The above doesn't set vis/opacity initially
        this.update({
            opacity: this.opacity,
            visible: this.visible
        })

        if (!opts.clickable) {
            opts.clickable = [];
        }

        for (const click of opts.clickable) {
            this._map.on('mouseenter', click.id, () => {
                this._map.getCanvas().style.cursor = 'pointer';
            })
            this._map.on('mouseleave', click.id, () => {
                this._map.getCanvas().style.cursor = '';
            })
        }

        this._clickable = opts.clickable;
        this._loaded = true;
    }

    remove() {
        for (const l of this.styles) {
            this._map.removeLayer(String(l.id));
        }

        this._map.removeSource(String(this.id));
    }

    async replace(body: {
        name?: string;
        url: string;
        mode_id: string;
    }, opts: {
        before?: string;
    } = {}): Promise<void> {
        this.name = body.name || this.name;
        this.url = body.url;
        this.mode_id = body.mode_id;

        this.remove();
        this.init({
            clickable: this._clickable,
            before: opts.before
        });

        await this.save();
    }

    async delete(): Promise<void> {
        this._destroyed = true;

        this.remove();

        if (this._internal) return;

        if (this.id) {
            await std(`/api/profile/overlay?id=${this.id}`, {
                method: 'DELETE'
            });
        }
    }

    async update(body: {
        pos?: number;
        visible?: boolean;
        opacity?: number;
    }): Promise<void> {
        if (body.opacity !== undefined) {
            this.opacity = body.opacity;
            for (const l of this.styles) {
                if (this.type === 'raster') {
                    this._map.setPaintProperty(l.id, 'raster-opacity', Number(this.opacity))
                }
            }
        }

        if (body.visible !== undefined) {
            this.visible = body.visible;
            for (const l of this.styles) {
                this._map.setLayoutProperty(l.id, 'visibility', this.visible ? 'visible' : 'none');
            }
        }

        if (body.pos !== undefined) {
            this.pos = body.pos;
        }

        await this.save();
    }

    async save(): Promise<void> {
        if (this._destroyed) throw new Error('Cannot save a destroyed layer');
        if (this._internal) return;

        // We want to just use the default style every time for things like missions
        // We only want to save the style on custom datasources
        const dropStyles = ['mission', 'internal'].includes(this.mode);

        await std(`/api/profile/overlay/${this.id}`, {
            method: 'PATCH',
            body: {
                pos: this.pos,
                name: this.name,
                opacity: this.opacity,
                mode_id: this.mode_id,
                url: this.url,
                visible: this.visible,
                styles: dropStyles ? [] : this.styles
            }
        })
    }
}