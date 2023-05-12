import Err from '@openaddresses/batch-error';
// @ts-ignore
import Data from '../lib/types/data.js';
import Auth from '../lib/auth.js';
import Batch from '../lib/aws/batch.js';
import Logs from '../lib/aws/batch-logs.js';

import { Request, Response } from 'express';
import Config from '../lib/config.js';

export default async function router(schema: any, config: Config) {
    await schema.get('/data/:dataid/job', {
        name: 'List Jobs',
        auth: 'user',
        group: 'DataJobs',
        description: 'List Data Jobs',
        ':dataid': 'integer',
        res: 'res.ListDataJobs.json'
    }, async (req: Request, res: Response) => {
        try {
            await Auth.is_auth(req);

            const data = await Data.from(config.pool, req.params.dataid);

            const list = await Batch.list(config, data);

            return res.json({
                total: list.length,
                list
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/data/:dataid/job/:jobid', {
        name: 'List Jobs',
        auth: 'user',
        group: 'DataJobs',
        description: 'List Data Jobs',
        ':dataid': 'integer',
        ':jobid': 'string',
        res: 'res.DataJob.json'
    }, async (req: Request, res: Response) => {
        try {
            await Auth.is_auth(req);

            const data = await Data.from(config.pool, req.params.dataid);

            const job = await Batch.job(config, req.params.jobid);

            return res.json(job)
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/data/:dataid/job/:jobid/logs', {
        name: 'List Logs',
        auth: 'user',
        group: 'DataJobLogs',
        description: 'List Data Job Logs',
        ':dataid': 'integer',
        ':jobid': 'string',
        res: 'res.DataJobLogs.json'
    }, async (req: Request, res: Response) => {
        try {
            await Auth.is_auth(req);

            const data = await Data.from(config.pool, req.params.dataid);

            const job = await Batch.job(config, req.params.jobid);

            const logs = await Logs.list(job.logstream);

            return res.json(logs)
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}