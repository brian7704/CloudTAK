import AWS from 'aws-sdk';
import Err from '@openaddresses/batch-error';

/**
 * @class
 */
export default class Alarm {
    constructor(stack) {
        this.stack = stack;
    }

    async list() {
        const cw = new AWS.CloudWatch({ region: process.env.AWS_DEFAULT_REGION });

        try {
            const map = new Map();
            const res = await cw.describeAlarms({
                AlarmNamePrefix: `${this.stack}-layer-`
            }).promise();

            for (const alarm of res.MetricAlarms) {
                let value = 'healthy';
                if (alarm.StateValue === 'ALARM') value = 'alarm';
                if (alarm.StateValue === 'INSUFFICIENT_DATA') value = 'unknown';

                const layer = parseInt(alarm.AlarmName.replace(`${this.stack}-layer-`, ''));

                map.set(layer, value);
            }

            return map;
        } catch (err) {
            throw new Err(500, new Error(err), 'Failed to describe alarms');
        }
    }

    async get(layer) {
        const cw = new AWS.CloudWatch({ region: process.env.AWS_DEFAULT_REGION });

        try {
            const res = await cw.describeAlarms({
                AlarmNames: [`${this.stack}-layer-${layer}`]
            }).promise();

            return res;
        } catch (err) {
            throw new Err(500, new Error(err), 'Failed to describe alarm');
        }
    }
}
