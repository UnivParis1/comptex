'use strict';

import * as _ from 'lodash';
import * as fs from 'fs';
import * as nodemailer from 'nodemailer';
import * as conf from './conf';
import * as Mustache from './mustache_like_templating';

const mailTransporter = nodemailer.createTransport(conf.mail.transport);

const toArray = (e: string | string[]) => _.isArray(e) ? e : [e]

// sendMail does not return a promise, it will be done in background. We simply log errors
// params example:
// { from: 'xxx <xxx@xxx>', to: 'foo@bar, xxx@boo', subject: 'xxx', text: '...', html: '...' }
export const send = (params: nodemailer.SendMailOptions, currentUser: CurrentUser) => {
    params = _.assign({ from: conf.mail.from }, params);
    if (conf.mail.intercept) {
        const cc = (params.cc || '').toString();
        params.subject = '[would be sent to ' + params.to + (cc ? " Cc " + cc : '') + '] ' + params.subject;
        params.to = _.compact(toArray(conf.mail.intercept).map(mail => (
            mail === '{{currentUser.mail}}' ? currentUser?.mail : mail
        )));
        delete params.cc;
    }
    mailTransporter.sendMail(params, (error, info) => {
        if (error) {
            console.log(error);
        } else {
            console.log('Mail sent: ', info);
        }
    });
};

export const sendWithTemplateFile = (templateName: string, params: {}) => {
    fs.readFile(__dirname + "/templates/mail/" + templateName, (err, data) => {
        if (err) {
            console.log(err);
        } else {
            sendWithTemplate(data.toString(), params, templateName);
        }
    });
}
type params = Dictionary<any> & Pick<nodemailer.SendMailOptions, "to"|"from"|"cc">
export const sendWithTemplate = (template: string, params: params, templateName = "") => {
    Mustache.async_render(template, params).then(rawMsg => {
            if (!rawMsg) return;
            console.log("===========================");
            console.log("mustache result for", templateName);
            //console.log("with params", params);
            console.log(rawMsg);
            console.log("===========================");
            let m = rawMsg.match(/^Subject: *(.*)\n\n([^]*)/);
            if (!m) {
                console.error("invalid template " + (templateName || template) + ': first line must be "Subject: ..."');
            } else {
                const html = `<!DOCTYPE html><html>${m[2]}</html>` // pour éviter des rejets de type HTML_MIME_NO_HTML_TAG
                send({ from: params['from'] || conf.mail.from, to: params['to'], cc: params['cc'], subject: m[1], html }, params.moderator);
            }
    });
};
