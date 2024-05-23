import Modeler, { GenericList, GenericListInput } from '@openaddresses/batch-generic';
import Err from '@openaddresses/batch-error';
import { Static, Type, TSchema } from '@sinclair/typebox'
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { Setting } from '../schema.js';
import { SQL, sql, is, eq, asc, desc } from 'drizzle-orm';

export default class SettingModel extends Modeler<typeof Setting> {
    constructor(
        pool: PostgresJsDatabase<any>,
    ) {
        super(pool, Setting);
    }

    async typed<T>(key: string, defaultValue?: T): Promise<T> {
        const pgres = await this.pool
        .select({
            key: Setting.key,
            value: Setting.value,
        })
        .from(Setting)
        .where(eq(this.requiredPrimaryKey(), key))
        .limit(1);

        if (pgres.length !== 1) {
            if (defaultValue) {
                return defaultValue;
            } else {
                throw new Err(404, null, `Item Not Found`);
            }
        }

        return pgres[0] as T
    }
}