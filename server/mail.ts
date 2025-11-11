'use strict';

import * as _ from 'lodash-es';
import * as fs from 'fs';
import * as nodemailer from 'nodemailer';
import conf from './conf.ts';
import * as Mustache from './mustache_like_templating.ts';

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
    fs.readFile(new URL("./templates/mail/" + templateName, import.meta.url).pathname, (err, data) => {
        if (err) {
            console.log(err);
        } else {
            sendWithTemplate(data.toString(), params, templateName);
        }
    });
}

const parse_header_and_body = (rendered: string, template_for_context?: string) => {
    let m = rendered.match(/^Subject: *(.*)(?:\nCc: *(.*))?\n\n([^]*)/);
    if (!m) {
        console.error("invalid template " + (template_for_context || rendered) + ': first line must be "Subject: ..."');
        return null
    }
    const [, subject, cc, body] = m
    return { subject, cc, body }
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
            let m = parse_header_and_body(rawMsg, templateName || template)
            if (!m) {
                console.error("invalid template " + (templateName || template) + ': first line must be "Subject: ..."');
            } else {
                const html = `<!DOCTYPE html><html>${m.body}</html>` // pour éviter des rejets de type HTML_MIME_NO_HTML_TAG
                send({ from: params['from'] || conf.mail.from, to: params['to'], cc: params['cc'] || m.cc, subject: m.subject, html }, params.moderator);
            }
    });
};

export const for_unit_tests = { parse_header_and_body }
