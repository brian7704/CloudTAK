import spritesmith from 'spritesmith';
import Vinyl from 'vinyl';
import { promisify } from 'node:util'

const SpriteSmith = promisify(spritesmith.run);

type SpriteConfig = {
    name?: string;
};

export default async function(icons, config?: SpriteConfig) {
    if (!config) config = {};

    const doc = await SpriteSmith({
        src: icons.icons.map((icon) => {
            return new Vinyl({
                path: config.name ? icon[config.name] + '.png' : icon.path.replace(/.*?\//, ''),
                contents: Buffer.from(icon.data, 'base64'),
            })
        })
    });

    const coords = {};
    for (const key in doc.coordinates) {
        coords[key.replace(/.png/, '')] = {
            ...doc.coordinates[key],
            pixelRatio: 1
        }
    }

    return {
        json: coords,
        image: doc.image
    }
}