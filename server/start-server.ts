import * as _ from 'lodash';
import * as express from 'express';
import * as path from 'path';
import * as logger from 'morgan';
import * as bodyParser from 'body-parser';

import * as db from './db';
import api from './api';
import * as utils from './utils';
import * as cas from './cas';
import * as translate from './translate'
import * as conf from './conf';
import * as conf_steps from './steps/conf';
const app = express();

_.attempt(() => require('source-map-support').install());

const staticFilesOptions = { maxAge: process.env.NODE_ENV === 'production' ? 60 * 60 * 1000 : 0 };

app.set('query parser', 'simple') // use nodejs "querystring" parser instead of "qs". Why exactly??
app.set('trust proxy', conf.trust_proxy)

// uncomment after placing your favicon in /public
//app.use(favicon(__dirname + '/app/favicon.ico'));
app.use("/", express.static(path.join(__dirname, '../app/dist'), staticFilesOptions));
logger.token('remote-user', (req: any) => (req.user?.id))
app.use(logger(':remote-addr :remote-user ":method :url" :status :res[content-length] ":referrer" ":user-agent" :response-time ms'));
if (conf.cas.ssoBaseURL) {
    cas.init(app);
} else {
    app.use(utils.shibboleth_express_auth);
}

const express_if_then_else = (cond: (req: express.Request) => boolean, if_true: express.RequestHandler, if_false: express.RequestHandler) : express.RequestHandler => (
    (req, res, next) => {
        (cond(req) ? if_true : if_false)(req, res, next);
    }
);

// NB: we could rely on Content-Type, but it is easy enough to rely on request path (since we mostly do JSON, except some very special cases)
const myBodyParser = express_if_then_else(
    (req) => req.path === '/csv2json', 
    bodyParser.raw({type: '*/*', limit: conf.body_size_limit.csv }),
    bodyParser.json({type: '*/*', limit: conf.body_size_limit.json }),
);

// needed for XHRs on MSIE
const force_noCache: express.RequestHandler = (_req, res, next) => {
    res.header('Cache-Control', 'private, no-cache, no-store');
    next();
}

app.use('/api', myBodyParser, force_noCache, translate.express_handler, api);

// handle main Vue html page.
// list valid urls (as already done in app/src/router.ts) 
// (NB: we could use a catchall, but it is better to get 404 errors)
app.use([ "login", "steps", ...Object.keys(conf_steps.steps), "playground" ].map(path => "/" + path), utils.index_html);

db.may_init(() => {
    let port = process.env.PORT || 8080;        // set our port
    app.listen(port);
    console.log('Started on port ' + port);
});

