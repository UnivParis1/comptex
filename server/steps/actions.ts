'use strict';

import * as _ from 'lodash';
import * as mail from '../mail';
import * as ldap from '../ldap';
import * as helpers from '../helpers';
import * as crejsonldap from '../crejsonldap';
import { onePerson } from '../search_ldap';
import * as search_ldap from '../search_ldap';
import * as esup_activ_bo from '../esup_activ_bo';
import { flatten_attrs } from '../step_attrs_option';
import v_display from '../v_display';
import * as conf from '../conf';
import client_conf from '../../shared/conf'; // ES6 syntax needed for default export
import Mustache = require('../mustache_like_templating');
import { sv_to_url } from '../sv';
const filters = ldap.filters;

const remove_accents = _.deburr;

export const mutate_v = (f: (v:v) => void) : simpleAction => async (_req, sv) => {
    f(sv.v)
    return sv
}
export const check_v = mutate_v

export const addAttrs = (v: Partial<v>): simpleAction => (_req, sv) => {
    _.assign(sv.v, v);
    return Promise.resolve(sv);
}

export const addProfileAttrs = (profiles: profileValues[]): simpleAction => (_req, sv) => {
    _.defaults(sv.v, { profilename: profiles[0].const });
    let profile = _.find(profiles, p => p.const === sv.v.profilename);
    if (!profile) throw "invalid profile " + sv.v.profilename;
    _.assign(sv.v, profile.fv());
    return Promise.resolve(sv);
}

export const esup_activ_bo_sendCode : simpleAction = (req, { v }) => (
    esup_activ_bo.sendCode(v.supannAliasLogin, v['channel'], req).then(_ => ({ v }))
)

const equalIgnoringSingleValueArray = (a: string|string[], b: string|string[]) => (
    _.isArray(a) && _.isString(b) ? _.isEqual(a, [b]) :
    _.isArray(b) && _.isString(a) ? _.isEqual(b, [a]) :
                                    _.isEqual(a,  b )
)

const remove_unmodified_fields = (userInfo: Dictionary<string | string[]>, orig : Dictionary<string|string[]>) => (
    _.pickBy(userInfo, (_, key) => !equalIgnoringSingleValueArray(userInfo[key], orig && orig[key] || ''))
)

const esup_activ_bo_updatePersonalInformations_raw = (esup_activ_bo_orig: Dictionary<string[]>): simpleAction => (req, sv) => {
    const v = sv.v
    let userInfo: Dictionary<string | string[]> = ldap.convertToLdap(conf.ldap.people.types, conf.ldap.people.attrs, v, {});
    delete userInfo.userPassword // password is handled specially ("setPassword" action)
    if (!v.supannAliasLogin) return Promise.reject("missing supannAliasLogin");

    userInfo = remove_unmodified_fields(userInfo, esup_activ_bo_orig)
    return esup_activ_bo.updatePersonalInformations(v.supannAliasLogin, v['code'], userInfo, req).then(_ => ({ ...sv, v }))
}
export const esup_activ_bo_updatePersonalInformations : simpleAction = (req, sv) => {
    if (!sv.v['code']) return Promise.reject("missing code");
    return esup_activ_bo_updatePersonalInformations_raw(sv.v.various.esup_activ_bo_orig)(req, sv)
}
export const esup_activ_bo_updatePersonalInformations_trusted : simpleAction = async (req, sv) => {
    if (!sv.v.supannAliasLogin) return Promise.reject("missing supannAliasLogin");
    const { attrRemapRev } = ldap.convert_and_remap(conf.ldap.people.types, conf.ldap.people.attrs);
    sv.v.code = '';
    const esup_activ_bo_orig = await esup_activ_bo.validateAccount(_.pick(sv.v, 'supannAliasLogin'), _.without(Object.keys(attrRemapRev), 'userPassword'), req)

    return await esup_activ_bo_updatePersonalInformations_raw(esup_activ_bo_orig)(req, sv)
}

export const esup_activ_bo_setPassword : simpleAction = async (req, { v }) => {
    await esup_activ_bo.setPassword(v.supannAliasLogin, v['code'], v.userPassword, req)
    return { v }
}

export const esup_activ_bo_minimal_validateAccount : simpleAction = async (req, sv) => {
    const userInfo = ldap.convertToLdap(conf.ldap.people.types, conf.ldap.people.attrs, search_ldap.v_from_WS(sv.v), {});
    await esup_activ_bo.validateAccount(userInfo as any, [], req)
    return sv
}

export const add_full_v: simpleAction = (_req, sv)  => (
    onePerson(filters.eq("uid", sv.v.uid)).then(full_v => {
        let v = sv.v;
        if (!v.various) v.various = {};
        v.various.full_v = full_v;
        return { v };
    })
);

export const force_response = (response: response): simpleAction => async (_req, sv) => (
    { v: sv.v, response }
)

const empty_action = force_response({})

export const if_v = (test_v: (v:v) => boolean, action: action, action_else?: action): action => async (req, sv: sva) => (
    await (test_v(sv.v) ? action : action_else || empty_action)(req, sv)
);

export const add_current_ldap_values = (...attrs: string[]): simpleAction => (_req, sv)  => (
    onePerson(filters.eq("uid", sv.v.uid)).then(full_v => {
        return { v: { ...sv.v, ..._.pick(full_v, ...attrs) } }
    })
);

export const handle_exception = (action: action, handler: (err: any, req: req, sv: sva) => Promise<vr>) => (req: req, sv: sva) => (
    action(req, sv).catch(err => handler(err, req, sv))
);

export function chain(l_actions: action[]): action {
    return async (req, sv: sva) => {
        let {v} = sv;
        let response: response = undefined
        for (const action of l_actions) {
            const vr = await action(req, { ...sv, v })
            // propagate v
            v = vr.v
            // merge "response"s
            response = { ...response, ...vr.response }
        }
        return { v, response };
    };
}

const ignore_accents_and_case = (val: string) => remove_accents(val).toLowerCase()

const compare_v = (v: v, current_v: v, opts: { adding_attr_is_minor_change: boolean }) => {
    type attr_option = {
        kind: 'major_change'|'to_ignore'|'minor_change'
        attrs: string[]
        simplify?: (s: string) => string
    }
    const attrs_options: attr_option[] = [
      { kind: 'major_change', 
        attrs: [ 'pager', 'birthDay' ] },
      { kind: 'major_change', simplify: (s) => s?.toLowerCase(),
        attrs: [ 'supannMailPerso' ] },
      { kind: 'major_change', simplify: ignore_accents_and_case,
        attrs: [ 'sn', 'givenName' ] },
      { kind: 'to_ignore', attrs: [
        'profilename', 'priority', 'startdate', 'enddate', 'duration', // hard to compare (stored in up1Profile)
        'various', // not stored
        'userPassword', // no way
        'homePhone', // we would need conversion to have a correct comparison
      ] },
    ]
    let attr2opts: Dictionary<attr_option> = {};
    _.each(attrs_options, opts => opts.attrs.forEach(attr => attr2opts[attr] = opts));

    let diffs : { major_change?: any; minor_change?: any } = {};
    for (const attr in v) {
        let { kind, simplify } = attr2opts[attr] || { kind: undefined, simplify: undefined };
        if (kind === 'to_ignore') continue;
        if (!kind) kind = 'minor_change';
        const val = v[attr];
        const current_val = current_v[attr];

        if (!current_val && opts?.adding_attr_is_minor_change) {
            kind = 'minor_change'
        }
        if (!_.isEqual(val, current_val)) {
            if (simplify) {
                const [ val_, current_val_ ] = [ val, current_val ].map(simplify);
                if (_.isEqual(val_, current_val_)) kind = 'minor_change';
            }
            diffs[kind] = { attr, val, current_val };
        }
    }
    return diffs;
}

const suggest_action_in_case_of_ldap_homonymes = async (v: v) => {
    let homonymes;
    if (!v.uid) {
        homonymes = await search_ldap.homonymes(v);
        if (homonymes.length) console.log(`createCompteSafe: homonymes found for ${v.givenName} ${v.sn}: ${homonymes.map(v => v.uid + " (score:" + v.score + ", accountStatus:" + v.accountStatus  + ")")}`)
        if (homonymes.length === 1 ||
            /* if 2 homonymes, it may be student account + teacher account. If student score is the highest (requires preferStudent), ignore the second account to decide suggest_action_in_case_of_ldap_homonymes */
            homonymes.length === 2 && homonymes[0].score === 1131101) {
            const existingAccount = homonymes[0]
            if (existingAccount.accountStatus === 'deleted' && !existingAccount.global_siham) {
                console.log("ignoring old 'deleted' homonyme:", existingAccount.uid);
                return { action: 'create_account' };
            }
            const diffs = compare_v(v, existingAccount, v.various?.canAutoMerge_options);
            const force_merge = diffs.major_change && v.various && v.various.allow_homonyme_merge && v.various.allow_homonyme_merge(existingAccount, v);
            if (!force_merge && diffs.major_change) {
                console.log("no automatic merge because of " + JSON.stringify(diffs['major_change']), existingAccount.accountStatus, existingAccount.uid);
                return { action: 'need_moderation', homonymes, diffs };
            } else if (diffs.minor_change) {
                console.log("automatic merge with", existingAccount.uid);
                //console.log("automatic merge", diffs, v, existingAccount);
                return { action: 'modify_account', diffs, existingAccount };
            } else {
                console.log("skipping user already created and unmodified:", existingAccount.uid);
                return { action: 'nothing_to_do', existingAccount };
            }
        }
    }
    const action = homonymes && homonymes.length > 0 ? 'need_moderation' : 'create_account';
    return { action, homonymes };
}

export const actions_if_safe_merge_ldap_homonymes = (pre_actions: action[], actions_if_safe: action[]): action => async (req, sv) => {
    const orig_v = sv.v;
    sv.v = (await chain(pre_actions)(req, sv)).v;
    const suggestion = await suggest_action_in_case_of_ldap_homonymes(sv.v);

    // return { v: { uid: 'dry_run' } as v, response: suggestion };

    switch (suggestion.action) {
        case 'nothing_to_do': return { v: suggestion.existingAccount, response: { ignored: true } };
        case 'need_moderation': return { v: orig_v, response: { id: sv.id, in_moderation: true } };
        case 'modify_account': sv.v.uid = suggestion.existingAccount.uid;
    }
    // ok, let's create/modify account
    return chain(actions_if_safe)(req, sv);
}

export const createCompteSafe = (l_actions: action[], afterCreateCompte: action[] = []) => (
    actions_if_safe_merge_ldap_homonymes(l_actions, [ createCompteSafe_, ...afterCreateCompte ])
)

const createCompteSafe_: action = (req, sv) => (
    createCompte_(req, sv, { dupcreate: "warn", dupmod: "warn", create: true })
);

export const createCompte: action = (req, sv) => (
    createCompte_(req, sv, { dupcreate: "ignore", dupmod: "warn", create: true })
);
    
const createCompte_ = async (req: req, sv: sva, opts : crejsonldap.options) => {
    let v = sv.v;

    if (!v.startdate) v.startdate = new Date();
    if (!v.enddate) {
        if (!v.duration) throw "no duration nor enddate";
        // "enddate" is *expiration* date and is rounded down to midnight (by ldap_convert.date.toLdap)
        // so adding a full 23h59m to help 
        v.enddate = helpers.addDays(v.startdate, v.duration + 0.9999);
    }
    if (v.enddate < new Date()) throw "date de fin dans le passé"
    
    const resp_subv = await crejsonldap.createMayRetryWithoutSupannAliasLogin(v, opts);
    const created = resp_subv.uid && !v.uid;
    console.log(req.user?.id + ":/" + sv.step + ": createCompte", created ? "created" : "modified", resp_subv.uid);
    v.uid = resp_subv.uid;
    if (!v.supannAliasLogin) v.supannAliasLogin = resp_subv.uid;

    const accountStatus = await after_createAccount(v, sv.attrs, resp_subv.accountStatus, created, req);

    return { v, response: {login: v.supannAliasLogin, created, accountStatus } }
};

const mailFrom = (v: v) => {
    const email = v.mailFrom_email;
    return !email ? conf.mail.from : v.mailFrom_text ? `${v.mailFrom_text} <${email}>` : email;
}

const after_createAccount = async (v: v, attrs: StepAttrsOption, accountStatus: crejsonldap.accountStatus, created: boolean, req_for_context: req): Promise<crejsonldap.accountStatus> => {
    if (v.userPassword && !accountStatus) {
        await esup_activ_bo.setNewAccountPassword(v.uid, v.supannAliasLogin, v.userPassword, req_for_context);
        accountStatus = 'active'
        // NB: if we have a password, it is a fast registration, so do not send a mail
    }
    if (v.supannMailPerso && !v.various?.minor_change) {
        const v_ = v_display(v, flatten_attrs(attrs, v));
        const cc = v.personParrain && await search_ldap.onePersonLoginToMail(v.personParrain)
        mail.sendWithTemplateFile('warn_user_account_created.html', { from: mailFrom(v), to: v.supannMailPerso, cc, v, v_display: v_, created, isActive: !!accountStatus, moderator: req_for_context.user });
    }
    return accountStatus
}

const crejsonldap_simple = (v: v, opts : crejsonldap.options) => (
    crejsonldap.call(v, opts)
    .then(crejsonldap.throw_if_err)
    .then(_ => ({ v })) 
)

export const modifyAccount : simpleAction = (_req, sv) => {
    if (!sv.v.uid) throw "modifyAccount needs uid";
    return crejsonldap_simple(sv.v, { create: false });
};

export const validatePassword : simpleAction = async (req, sv) => {
    if (!sv.v.supannAliasLogin) throw "validatePassword needs supannAliasLogin";
    if (!sv.v.userPassword) throw "validatePassword needs userPassword";
    await esup_activ_bo.validatePassword(sv.v.supannAliasLogin, sv.v.userPassword, req)
    return sv
}

// throw a list of errors, if any
export const validateAccount : simpleAction = (_req, sv) => (
    crejsonldap_simple(sv.v, { action: "validate" })
);

// NB: expires only one profile. It will expire account if no more profiles
export const expireAccount : simpleAction = (_req, sv) => {
    const { uid, profilename } = sv.v;
    if (!uid) throw "expireAccount need uid";
    if (!profilename) throw "expireAccount need profilename";
    const v = { uid, profilename, enddate: new Date("1970-01-01") } as v;
    return crejsonldap_simple(v, { create: false }); // should we return sv.v?
};

export const prepareMailTemplateParams = async (req: req, sv: sv|sva, params: Dictionary<any>, opts: { cc_personParrain?: true }) => {
    const v = sv.v;
    // @ts-expect-error
    const v_ = v_display(v, flatten_attrs(sv.attrs, v));
    const sv_url = sv_to_url(sv);
    let to = params['to'];
    if (!to) to = v.mail || v.supannMailPerso;
    if (!to && v.various && v.various.full_v) to = v.various.full_v.mail || v.various.full_v.supannMailPerso;
    let cc =params['cc']
    if (!cc && opts.cc_personParrain && v.personParrain) {
        cc = await search_ldap.onePersonLoginToMail(v.personParrain)
    }
    return { ...params, to, cc, moderator: req.user, v, v_display: v_, sv_url };
}

export const sendMail = (template: string, params = {}, opts : { cc_personParrain?: true } = {}): action => async (req, sv) => {
    mail.sendWithTemplate(template, await prepareMailTemplateParams(req, sv, params, opts));
    return { v: sv.v };
};

export const sendSupannMailPerso = (template: string, params = {}): action => async (req, sv) => {
    if (sv.v.supannMailPerso) {
        await sendMail(template, { ...params, to: sv.v.supannMailPerso })(req, sv)
    } else {
        console.warn("sendSupannMailPerso: not sending since no supannMailPerso", sv.v)
    }
    return sv
}

export const sendMailWithFileTemplate = (templateName: string, params = {}, opts = {}): action => async (req, sv) => {
    mail.sendWithTemplateFile(templateName, await prepareMailTemplateParams(req, sv, { ...params, moderator: req.user }, opts));
    return { v: sv.v };
}

export const ask_confirmation = (attr_to_save_confirmation: string, msg_template: string, title: string = "Attention"): action => async (req, sv) => {
    if (sv.v[attr_to_save_confirmation]) {
        // we have the confirmation, go on
        return sv;
    } else {
        // tell frontend to popup the msg
        const msg = await Mustache.async_render(msg_template, await prepareMailTemplateParams(req, sv, {}, {}))
        throw { code: "OK", ask_confirmation: { attr_to_save_confirmation, msg, title } };
    }
}

export const genLogin: simpleAction = (_req, sv) => {
    let createResp = (login: string) => {
        let v = <v> _.assign({ supannAliasLogin: login }, sv.v);
        return { v, response: {login} };
    };
    if (sv.v.uid) {
        return Promise.resolve(sv.v.supannAliasLogin).then(createResp);
    } else {
        return search_ldap.genLogin(sv.v.birthName || sv.v.sn, sv.v.givenName).then(createResp);
    }
};

export const sendValidationEmail: action = (req, sv) => {
    let v = sv.v;
    console.log("action sendValidationEmail to " + v.supannMailPerso);
    mail.sendWithTemplateFile('validation.html', { conf, v, to: v.supannMailPerso, sv_url: sv_to_url(sv), moderator: req.user });
    return Promise.resolve({ v });
};

// simple flag sent to the browser
export const forceBrowserExit: action = (_req, { v }) => (
    Promise.resolve({ v, response: { forceBrowserExit: true } })
);

export const homePhone_to_pager_if_mobile : simpleAction = async function(_req, { v }) {
    const { homePhone, ...v_ } = v;
    if (homePhone && homePhone.match("^(" + client_conf.pattern.frenchMobilePhone + ")$")) {
        v = { pager: homePhone, ...v_ } as v;
    }
    return { v };
}

export const pager_to_homePhone_if_no_homePhone : simpleAction = async function(_req, { v }) {
    if (!v.homePhone) {
        const { pager, ...v_ } = v;
        if (pager) v = { homePhone: pager, ...v_ } as v;
    }
    return { v };
}

export const sendMailNewEtablissement = (to: string): simpleAction => (req, sv) => {
    let v = sv.v;
    if (!v['etablissement_description']) {
        return Promise.resolve({ v });
    }
    const isEtabAttr = ({}, attr: string) => attr.match(/etablissement_.*/);
    const text = JSON.stringify(_.pickBy(v, isEtabAttr), undefined, '  ')
    console.log("sending mail", text);
    mail.send({ to, text,
        subject: "Etablissement a ajouter dans LDAP", 
    }, req.user);
    v = { ..._.omitBy(v, isEtabAttr), etablissementExterne: conf.ldap.etablissements.attrs.siret.convert.toLdap(v['etablissement_siret']) } as v;
    return Promise.resolve({ v });
};

// if supannMailPerso is an internal mail address, it must exist and not create a loop
export const validateMailNoLoop = (idAttr: string): simpleAction => async (_req, { v }) => {
    const email = v.supannMailPerso
    const r = await search_ldap.searchInternalMail(email)
    if (r.external) {
        // ok
    } else if (!r.internal) {
        throw `L'adresse ${email} n'existe pas dans notre université. Conseil : utilisez une adresse de courriel personnelle.`
    } else if (r.internal[idAttr] === v[idAttr]) {
        throw `Votre propre adresse courriel n'est pas autorisée comme adresse personnelle.`
    }    
    return Promise.resolve({ v });
}

export const supannMailPerso_to_mail_if_needed: simpleAction = async (_req, { v }) => {
    if (v.supannMailPerso) {
        const domain = v.supannMailPerso.match(/@(.+)/)?.[1]
        if (conf.ldap.people.mail_domains.includes(domain)) {
            v = helpers.renameKey(v, 'supannMailPerso', 'mail')
        }
    }
    return { v }
}
