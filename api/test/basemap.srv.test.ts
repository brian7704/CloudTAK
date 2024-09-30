import test from 'tape';
import Flight from './flight.js';

const flight = new Flight();

flight.init();
flight.takeoff();
flight.user();

test('GET: api/basemap', async (t) => {
    try {
        const res = await flight.fetch('/api/basemap', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        t.deepEquals(res.body, {
            total: 0,
            items: []
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

test('POST: api/basemap - Invalid URL', async (t) => {
    try {
        const res = await flight.fetch('/api/basemap', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                name: 'Test Basemap',
                url: 'test',
            }
        }, true);

        t.fail()
    } catch (err) {
        t.equals(String(err), 'AssertionError [ERR_ASSERTION]: {"status":400,"message":"Invalid URL provided","messages":[]}');
    }

    t.end();
});

test('POST: api/basemap - Invalid URL Protocol', async (t) => {
    try {
        const res = await flight.fetch('/api/basemap', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                name: 'Test Basemap',
                url: 'ftp://test.com/test',
            }
        }, true);

        t.fail()
    } catch (err) {
        t.equals(String(err), 'AssertionError [ERR_ASSERTION]: {"status":400,"message":"Only HTTP and HTTPS Protocols are supported","messages":[]}');
    }

    t.end();
});

test('POST: api/basemap - Invalid URL - No Variables', async (t) => {
    try {
        const res = await flight.fetch('/api/basemap', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                name: 'Test Basemap',
                url: 'https://test.com/test',
            }
        }, true);

        t.fail()
    } catch (err) {
        t.equals(String(err), 'AssertionError [ERR_ASSERTION]: {"status":400,"message":"Either ZXY or Quadkey variables must be used","messages":[]}');
    }

    t.end();
});

test('POST: api/basemap', async (t) => {
    try {
        const res = await flight.fetch('/api/basemap', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                name: 'Test Basemap',
                url: 'https://test.com/test/{z}/{x}/{y}',
            }
        }, true);

        delete res.body.created;
        delete res.body.updated

        t.deepEqual(res.body, {
            id: 1,
            name: 'Test Basemap',
            url: 'https://test.com/test/{z}/{x}/{y}',
            overlay: false,
            username: 'test@example.com',
            minzoom: 0,
            maxzoom: 16,
            format: 'png',
            style: 'zxy',
            styles: [],
            type: 'raster'
        })
    } catch (err) {
        t.error(err)
    }

    t.end();
});

test('GET: api/basemap/1/tiles', async (t) => {
    try {
        const res = await flight.fetch('/api/basemap/1/tiles', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            },
        }, true);

        t.deepEqual(res.body, {
            tilejson: '2.2.0',
            version: '1.0.0',
            name: 'Test Basemap',
            type: 'raster',
            bounds: [ -180, -90, 180, 90 ],
            center: [ 0, 0 ],
            minzoom: 0,
            maxzoom: 16,
            tiles: [ 'http://localhost:5001/api/basemap/1/tiles/{z}/{x}/{y}' ],
            layers: []
        })
    } catch (err) {
        t.error(err)
    }

    t.end();
});

test('PATCH: api/basemap/1', async (t) => {
    try {
        const res = await flight.fetch('/api/basemap/1', {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                name: 'Test Basemap2',
            }
        }, true);

        delete res.body.created;
        delete res.body.updated

        t.deepEqual(res.body, {
            id: 1,
            name: 'Test Basemap2',
            url: 'https://test.com/test/{z}/{x}/{y}',
            overlay: false,
            username: 'test@example.com',
            minzoom: 0,
            maxzoom: 16,
            format: 'png',
            style: 'zxy',
            styles: [],
            type: 'raster'
        })
    } catch (err) {
        t.error(err)
    }

    t.end();
});

test('PATCH: api/basemap/1 - Invalid URL', async (t) => {
    try {
        const res = await flight.fetch('/api/basemap/1', {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                name: 'Test Basemap',
                url: 'test',
            }
        }, true);

        t.fail()
    } catch (err) {
        t.equals(String(err), 'AssertionError [ERR_ASSERTION]: {"status":400,"message":"Invalid URL provided","messages":[]}');
    }

    t.end();
});

test('DELETE: api/basemap/1', async (t) => {
    try {
        const res = await flight.fetch('/api/basemap/1', {
            method: 'DELETE',
            auth: {
                bearer: flight.token.admin
            },
        }, true);

        t.deepEqual(res.body, {
            status: 200,
            message: 'Basemap Deleted'
        })
    } catch (err) {
        t.error(err)
    }

    t.end();
});

test('DELETE: api/basemap/1 - Doesn\'t Exist', async (t) => {
    try {
        const res = await flight.fetch('/api/basemap/1', {
            method: 'DELETE',
            auth: {
                bearer: flight.token.admin
            },
        }, false);

        t.deepEqual(res.body, {
            status: 404,
            message:"Item Not Found",
            messages:[]
        })
    } catch (err) {
        t.error(err)
    }

    t.end();
});

test('PATCH: api/basemap/1 - Doesn\'t Exist', async (t) => {
    try {
        const res = await flight.fetch('/api/basemap/1', {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                name: 'Test Basemap2',
            }
        }, false);

        t.deepEqual(res.body, {
            status: 404,
            message:"Item Not Found",
            messages:[]
        })
    } catch (err) {
        t.error(err)
    }

    t.end();
});

flight.landing();