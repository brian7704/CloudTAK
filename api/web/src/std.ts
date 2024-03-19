export function stdurl(url: string | URL): URL {
    try {
        url = new URL(url);
    } catch (err) {
        url = new URL(url, window.location.origin);
    }

    // Allow serving through Vue for hotloading
    if (url.hostname === 'localhost') url.port = '5001'

    return url;
}

/**
 * Standardize interactions with the backend API
 *
 * @param {URL|String} url      - Full URL or API fragment to request
 * @param {Object} [opts={}]    - Options
 */
export async function std(url: string | URL, opts: any = {}): Promise<any> {
    url = stdurl(url)

    try {
        if (!opts.headers) opts.headers = {};

        if (!(opts.body instanceof FormData) && typeof opts.body === 'object' && !opts.headers['Content-Type']) {
            opts.body = JSON.stringify(opts.body);
            opts.headers['Content-Type'] = 'application/json';
        }

        if (localStorage.token && !opts.headers.Authorization) {
            opts.headers['Authorization'] = 'Bearer ' + localStorage.token;
        }

        const res = await fetch(url, opts);

        let bdy = {};
        if ((res.status < 200 || res.status >= 400) && ![401].includes(res.status)) {
            try {
                bdy = await res.json();
            } catch (err) {
                throw new Error(`Status Code: ${res.status}`);
            }

            const err = new Error(bdy.message || `Status Code: ${res.status}`);
            err.body = bdy;
            throw err;
        } else if (res.status === 401) {
            delete localStorage.token;
            throw new Error(401);
        }

        return await res.json();
    } catch (err) {
        throw new Error(err.message);
    }
}