import { defineStore } from 'pinia'
import pointOnFeature from '@turf/point-on-feature';
import moment from 'moment';

export const useCOTStore = defineStore('cots', {
    state: () => {
        return {
            archive: new Map(), // Store all archived CoT messages
            cots: new Map(),    // Store all on-screen CoT messages
        }
    },
    actions: {
        loadArchive: function() {
            const archive = JSON.parse(localStorage.getItem('archive') || '[]');
            for (const a of archive) {
                this.archive.set(a.id, a);
                this.cots.set(a.id, a);
            }
        },
        saveArchive: function() {
            localStorage.setItem('archive', JSON.stringify(Array.from(this.archive.values())))
        },
        collection: function() {
            return {
                type: 'FeatureCollection',
                features:  Array.from(this.cots.values()).map((cot) => {
                    cot.properties['icon-opacity'] = moment().subtract(5, 'minutes').isBefore(moment(cot.properties.stale)) ? 1 : 0.5;
                    return cot;
                })
            }
        },
        get: function(id) {
            return this.cots.get(id);
        },
        has: function(id) {
            return this.cots.has(id);
        },
        delete: function(id) {
            this.cots.delete(id);
            if (this.archive.has(id)) {
                this.archive.delete(id);
                this.saveArchive();
            }
        },
        clear: function() {
            this.cots.clear();
        },
        add: function(feat) {
            //Vector Tiles only support integer IDs
            feat.properties.id = feat.id;

            if (!feat.properties.center) {
                feat.properties.center = pointOnFeature(feat.geometry).geometry.coordinates;
            }

            if (feat.geometry.type.includes('Point')) {
                if (feat.properties.icon) {
                    // Format of icon needs to change for spritesheet
                    feat.properties.icon = feat.properties.icon.replace('/', ':').replace(/.png$/, '');
                } else {
                    feat.properties.icon = `${feat.properties.type}`;
                }

                feat.properties.color = '#d63939';
            } else if (feat.geometry.type.includes('Line') || feat.geometry.type.includes('Polygon')) {
                if (!feat.properties['stroke']) feat.properties.stroke = '#d63939';
                if (!feat.properties['stroke-style']) feat.properties['stroke-style'] = 'solid';
                if (!feat.properties['stroke-width']) feat.properties['stroke-width'] = 3;

                // MapLibre Opacity must be of range 0-1
                if (feat.properties['stroke-opacity']) {
                    feat.properties['stroke-opacity'] = feat.properties['stroke-opacity'] / 255;
                } else {
                    feat.properties['stroke-opacity'] = 1;
                }

                if (feat.geometry.type.includes('Polygon')) {
                    if (!feat.properties['fill']) feat.properties.fill = '#d63939';

                    if (feat.properties['fill-opacity']) {
                        feat.properties['fill-opacity'] = feat.properties['fill-opacity'] / 255;
                    } else {
                        feat.properties['fill-opacity'] = 1;
                    }
                }
            }

            this.cots.set(feat.id, feat);

            if (feat.properties.archive) {
                this.archive.set(feat.id, feat);
                this.saveArchive();
            }

        }
    }
})