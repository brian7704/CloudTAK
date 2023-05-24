import fs from 'fs';
import path from 'path';
import test from 'node:test';
import assert from 'assert';

import { glob } from 'glob';
import $RefParser from '@apidevtools/json-schema-ref-parser';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const ajv = new Ajv({
    allErrors: true
});

addFormats(ajv);

for (const source of glob.sync('../schema/**/*.json')) {
    test(`schema/${path.parse(source).base}`, async () => {
        try {
            const file = String(fs.readFileSync(source));
            assert.ok(file.length, 'file loaded');

            JSON.parse(file);
        } catch (err) {
            assert.ifError(err);
        }

        try {
            const schema = await $RefParser.dereference(source);

            ajv.compile(schema);
        } catch (err) {
            assert.ifError(err);
        }
    });
}