'use strict';

import * as _ from 'lodash-es';
import * as mongodb from 'mongodb';
import conf from './conf.ts';
import { renameKey, throw_ } from './helpers.ts';
import { UUID } from 'bson';

export const error_codes = {
    DuplicateKey: 11000,
}

const _id = (id: string = undefined) => (
    typeof id === 'object' ? id :
    id?.match(/^\w{24}$/) ? new mongodb.ObjectId(id) : 
    id?.match(/^\w{8}-\w{4}-\w{4}-\w{4}-\w{12}$/) ? new UUID(id) :
    throw_("invalid id")
)

export function fromDB(sv_: any) {
    return renameKey(sv_, '_id', 'id') as sv;
}
function toDB<T extends { id?: string }>(sv: T) {
    return { ..._.omit(sv, 'id'), _id: _id(sv.id) };
}

let client: mongodb.Db = null;

export const collection = (name: string) => {
    if (!client) throw "db.init not done";
    return client.collection<{ _id?: UUID | mongodb.ObjectId } & Dictionary<any>>(name);  
}

const svs = () => collection('sv')

export const or = (l: Dictionary<unknown>[]) => l.length === 1 ? l[0] : { $or: l } as Dictionary<unknown>;

export const get = (id: id) => (
    svs().findOne({ _id: _id(id) }).then(fromDB)
);

export const setLock = (id: id, lock: boolean) => (
    svs().updateOne({ _id: _id(id) }, { $set: { lock } })
);

export const set_additional_public_info = (id: id, additional_public_info: sv['additional_public_info']) => (
    svs().updateOne({ _id: _id(id) }, { $set: { additional_public_info } })
);

export const list_sv_to_purge = async () => (
    (await svs().find({
        step: { $exists: true },
        modifyTimestamp: { $lte: new Date(Date.now() - conf.sv_ttl_days * 24*60*60*1000) }}
    ).toArray()).map(fromDB) as sv[]
)

// lists svs, sorted by steps + recent one at the beginning
export const listByModerator = (query: Object) : Promise<sv[]> => {
        if (_.isEqual(query, { "$or": [] })) return Promise.resolve(null);
        return (
            svs().find(query).project({
                step: 1, modifyTimestamp: 1,
                additional_public_info: 1,
                v: { givenName: 1, sn: 1, prevStep: 1 },
            }).sort({ step: 1, modifyTimestamp: -1 }).toArray()
        ).then(svs => (
            _.map(svs, fromDB)
        ));
    };

export const save = <T extends { id?: string }>(sv: T, options = { upsert: true }) => {
            let sv_ = { ...toDB(sv), modifyTimestamp: new Date() };
            return svs().replaceOne({ _id: sv_['_id'] }, sv_, options).then(_ => sv);
};

export function init(callback: (client: mongodb.MongoClient) => void) {
  mongodb.MongoClient.connect(conf.mongodb.url).then(client_ => {
      client = client_.db()
      callback(client_);
  }, (error) => {
    console.log(error);
    process.exit(1);
  })
}

export function may_init(callback: (client : mongodb.MongoClient | null) => void) {
    if (conf.mongodb.url) {
        init(callback)
    } else {
        callback(null)
    }
}

export const open_and_run_promise_and_close = (callback: () => Promise<void>) => (
    new Promise<void>((resolve, _reject) => {
        init(async client => {
            await callback()
            client.close()
            resolve()
        })
    })
)

export const new_id = () => (
    "" + new UUID()
);
