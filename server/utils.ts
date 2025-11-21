'use strict';

import * as _ from 'lodash-es';
import * as iconv from 'iconv-lite';
import * as express from 'express';
import csvtojson from 'csvtojson';
import type { CSVParseParam } from 'csvtojson/v2/Parameters.d.ts';
import * as crypto from 'crypto'
import session from 'express-session';
import session_file_store from 'session-file-store';
import conf from './conf.ts';
import { EventEmitter } from 'events';

export const shibboleth_express_auth : express.RequestHandler<any, unknown, unknown, unknown> = (req, _res, next): void => {
  let user_id = req.header('REMOTE_USER');
  if (user_id) req.user = { id: user_id };
  next();
};

export function session_store() {
    const FileStore = session_file_store(session);
    return session({
        store: new FileStore({ retries: 0, ...conf.session_store }), 
        resave: false, saveUninitialized: false,
        ...conf.session,
    });
}

export const query_string = (qs: Dictionary<string>) => {
    const params = "" + new URLSearchParams(qs)
    return params ? "?" + params : ""
}

export interface http_client_Options {
    headers? : {};
    /** abort the request after the specific time (in milliseconds). Use 0 for unlimited */
    timeout?: number;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
}

export const http_request = async (url: string, options: http_client_Options & { body?: string }) : Promise<string> => {
    const { timeout = 10000, ...options_ } = options
    let res, data
    try {
        res = await fetch(url, { 
            ...timeout > 0 ? { signal: AbortSignal.timeout(timeout) } : {}, 
            ...options_,
        })
    } catch (error) {
        // non HTTP error
        throw { error, errorKind: 'network' }
    }
    try {
        data = await res.text()
    } catch (error) {
        throw  { error, statusCode: res.status, errorKind: 'text' }
    }
    //console.log('got the response: ' + data)
    //if (res.status !== 200) console.error("request to " + url + " failed with " + res.status + " " + res.statusText);
    if (res.status !== 200 && res.status !== 204) 
        throw { error: data.toString(), statusCode: res.status }
    else
        return data
}

export const post = (url: string, body: string, options: Omit<http_client_Options, 'method'>) : Promise<string> => {
    return http_request(url, { method: 'POST', body, ...options })
};

export const http_request_json = async (url: string, { params, ...options }: http_client_Options & { params?: Dictionary<any> }) : Promise<object> => {
    let options_ = { 
        method: params ? 'POST' : 'GET', // default method
        ...(params ? { body: JSON.stringify(params) } : {}),
        ...options, 
    } as const
    //console.log({url, options_, params})
    const data = await http_request(url, options_)
    try {
        return JSON.parse(data)
    } catch (e) {
        console.error("expected JSON, got", data)
        throw e
    }
}

export const to_basic_auth = ({ user, password } : { user: string, password: string }) => ({
    'Authorization': 'Basic ' + Buffer.from(user + ':' + password).toString('base64')
})

const http_statuses: Dictionary<number> = {
    "Bad Request": 400,
    "Unauthorized": 401,
    "Forbidden": 403,
    "OK": 200,
}

export function respondJson(req: req, res: express.Response, p: Promise<response>) {
    let logPrefix = req.method + " " + req.path + ":";
    p.then(r => {
        //console.log(logPrefix, r);
        res.json(r);
    }, err => {
        const errMsg = err?.code || "" + err;
	if (errMsg === 'OK') {} else if (errMsg === 'Unauthorized') { console.info(logPrefix, err) } else { console.error("ERROR", logPrefix, err?.code ? JSON.stringify(err) : err) }
        res.status(http_statuses[errMsg] || 500);
        res.json(err?.code ? err : {error: errMsg, stack: err?.stack});
    });
}

export const index_html = (_req: req, res: express.Response, _next: next): void => {
    res.sendFile(new URL("../app/dist/index.html", import.meta.url).pathname, err => { 
        if (err) console.error(err)
    })
};


const toString = (buffer : Buffer) => {
    let r = buffer.toString('utf8');
    if (r.match("\uFFFD")) r = iconv.decode(buffer, 'win1252'); // fallback
    return r;
}

async function parse_csv(csv: string, options: Partial<CSVParseParam>): Promise<{ fields: string[], lines: {}[] }> {
    const convert = csvtojson({ 
        delimiter: "auto", // relies on the delimiter most present in headers. Since field names should not contain any known delimiters (,|\t;:), it is ok!
        checkColumn: true,
        ...options,
    });      
    try {
        let fields: string[];
        let r = convert.fromString(csv)
        r.on('header', (header: string[]) => fields = header)
        const lines = await r
        return { fields, lines }
    } catch (err) {
        console.log("parse_csv failed on\n", csv);
        throw err
    }
}
export const csv2json = (req: req, res: res): void => {
    const headers = req.query['forced_headers[]'] as any // trailing "[]" is added by axios (it is the default behaviour : 'arrayFormat' 'brackets')
    respondJson(req, res, parse_csv(toString(req.body), { headers, noheader: !!headers }))
}

export const eventBus = (): EventEmitter => {
    let bus = new EventEmitter();
    bus.setMaxListeners(conf.maxLiveModerators);
    return bus;
};

export const bus_once = (bus: EventEmitter, _event: string, maxTime: number) => (
    Promise.race([ wait(maxTime), 
                   new Promise(resolve => bus.once('changed', resolve)) ])
);

export const wait = (milliseconds: number) => (
    new Promise(resolve => setTimeout(resolve, milliseconds))
);


import { spawn } from 'child_process';

export function popen(inText: string, cmd: string, params: string[], opts?: { log_stderr?: true }): Promise<string> {
    let p = spawn(cmd, params);
    p.stdin.write(inText);
    p.stdin.end();

    return new Promise((resolve, reject) => {
        let output = '';
        let get_ouput = (data: any) => { output += data; };
        let error_log = (data: any) => console.error(`${cmd} stderr : ${data}`)
        
        p.stdout.on('data', get_ouput);
        p.stderr.on('data', opts?.log_stderr ? error_log : get_ouput);
        p.on('error', event => {
            reject(event);
        });
        p.on('close', code => {
            if (code === 0) resolve(output); else reject(output);
        });
    });
}

export const random_string = (size: number = 8) => (
    crypto.randomBytes(size).toString('base64url')
)

export function mergeSteps(initialSteps: steps, nextSteps: steps): steps {
    _.forEach(initialSteps, (step, _name) => step.initialStep = true);
    return { ...initialSteps, ...nextSteps };
}

export const deep_extend = <T extends Dictionary<any>, U extends Dictionary<any>>(o: T, overrides: U) => {
    if (_.isPlainObject(o) && _.isPlainObject(overrides)) {
        const r: T & U = { ...o, ...overrides };
        for (const attr of _.intersection(Object.keys(o), Object.keys(overrides))) {
            // @ts-expect-error
            r[attr] = deep_extend(o[attr], overrides[attr]);
        }
        return r;
    } else {
        return overrides as T & U;
    }
}

export const deep_extend_concat = <T>(v1: Partial<T>, v2: T): T => {
    if (_.isPlainObject(v1) && _.isPlainObject(v2)) {
        const r = { ...v1, ...v2 };
        for (const attr of _.intersection(Object.keys(v1), Object.keys(v2))) {
            // @ts-expect-error
            r[attr] = deep_extend_concat(v1[attr], v2[attr]);
        }
        return r;
    } else if (_.isArray(v1) && _.isArray(v2)) {
        // @ts-expect-error
        return [ ...v1, ...v2 ]
    } else {
        return v2;
    }
}

export function email_has_one_of_our_mail_domains(email: string): boolean | undefined {
    const domain = email.match(/@(.+)/)?.[1]
    if (!domain) return undefined
    return conf.ldap.people.mail_domains.includes(domain)
}

export const for_unit_tests = { parse_csv }