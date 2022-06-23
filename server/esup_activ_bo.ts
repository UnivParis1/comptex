'use strict';

import * as _ from 'lodash';
import * as querystring from 'querystring';
import * as utils from './utils';
import * as conf from './conf';

async function callAPI(action: string, params: Dictionary<any>, req_for_context: req) {
    if (!conf.esup_activ_bo.url) throw "configuration issue: conf.esup_activ_bo.url is missing";
    console.log('callAPI', action)

    const query_params = _.pick(params, 'id')
    const body_params = _.omit(params, Object.keys(query_params))
    const url = conf.esup_activ_bo.url + utils.query_string({ action, ...query_params })
    const body = querystring.stringify(_.mapValues(body_params, emptyStringIfEmptyList)) // rely on querystring.stringify({a: [1,2]}) => 'a=1&a=2'

    const headers = {
        "Client-IP": req_for_context?.ip || 'unknown',
        "Client-User-Agent": req_for_context?.get('User-Agent') || 'unknown',
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
    };
    try {
        const encoded = await utils.http_request(url, { headers, body })
        return _get_entries(encoded)
    } catch (err) {
        err = querystring.parse(err.error)
        console.error(err)
        throw err.message || err.error || err
    }
}

const emptyStringIfEmptyList = (value: any) => (
    _.isEmpty(value) ? '' : value
)

const emptyStringToEmptyList = (values : string[]) => (
    values.length == 1 && values[0] === "" ? [] : values
)

function _get_entries(encoded: string) {
    let r: Dictionary<any> = {}
    const qs = new URLSearchParams(encoded);
    for (const key of qs.keys()) {
        const key_ = key.replace(/^attr[.]/, '') // ignore "attr."
        r[key_] = emptyStringToEmptyList(qs.getAll(key))
    }
    //console.log('_get_entries', r)
    return r
}

// returns "returnAttrs" + code + id
// throws: "Authentification invalide pour l'utilisateur xxx"
// throws: "Login invalide"
export const authentificateUser = (id: string, password: string, returnAttrs: string[], req_for_context: req) => (
    callAPI("authentificateUser", { id, password, returnAttrs: returnAttrs.join(',') }, req_for_context)
)

export const authentificateUserWithCas = (id: string, proxyticket: string, targetUrl: string, returnAttrs: string[], req_for_context: req) => (
    callAPI("authentificateUserWithCas", { id, proxyticket, targetUrl, returnAttrs: returnAttrs.join(',') }, req_for_context)
)

// returns "returnAttrs" + possibleChannels + id + code if account is not activated
// ("code" is useful for setPassword or validateCode)
// throws: "AuthentificationException"
export function validateAccount(userInfoToValidate: Dictionary<string>, returnAttrs: string[], req_for_context: req): Promise<Dictionary<string>> {
    console.log("esup_activ_bo._validateAccount " + JSON.stringify(userInfoToValidate));
    const attrValues = _.mapKeys(userInfoToValidate, (_value, key) => `attr.${key}`);
    return callAPI("validateAccount", { ...attrValues, returnAttrs: returnAttrs.join(',') }, req_for_context)
}

// throws: "UserPermissionException"
export const updatePersonalInformations = async (id: string, code: string, userInfo: Dictionary<string | string[]>, req_for_context: req) => {
    console.log('updatePersonalInformations', userInfo)
    const attrValues = _.mapKeys(userInfo, (_value, key) => `attr.${key}`);
    await callAPI("updatePersonalInformations", { id, code, ...attrValues }, req_for_context)
}
    
async function _getCode(hashInfToValidate: Dictionary<string>, req_for_context: req): Promise<string> {
    const vals = await validateAccount(hashInfToValidate, [], req_for_context);
    if (!vals.code) throw "esup_activ_bo.validateAccount did not return code for " + JSON.stringify(hashInfToValidate) + ". Account already activated?";
    return vals.code;
}

// NB: no error in case of unknown channel
// throws: "Utilisateur xxx inconnu"
// throws: "Utilisateur sdianat n'a pas de mail perso"
export const sendCode = (id: string, channel: string, req_for_context: req) => (
    callAPI("sendCode", { id, channel }, req_for_context)
);

export const validateCode = (id: string, code: string, req_for_context: req) => (
    callAPI("verifyCode", { id, code }, req_for_context)
);

export function validatePassword(id: string, password: string, req_for_context: req) {
    return callAPI("validatePassword", { id, password }, req_for_context).then(response => {
        if (response?.resp?.length === 0) return; // OK!
        let err = response?.resp?.[0] || "internal error"
        err = err.replace(/^kadmin: kadm5_check_password_quality: /, '');
        // below non translated messages should be caught by app/src/attrs/PasswordAttr.vue "passwordPattern":
        // "Password doesn't meet complexity requirement." 
        // "Password too short"

        err = err.replace(/^External password quality program failed: /, '');
        // below non translated messages should be caught by app/src/attrs/PasswordAttr.vue "passwordPattern":
        // "Password contains non-ASCII or control characters"
        // "Password is only letters and spaces"
        const translate: Dictionary<string> = {
            "Password does not contain enough unique characters": "Le mot de passe doit contenir plus de caractères différents",
            "it is based on a dictionary word": "Ce mot de passe est trop proche d'un mot du dictionnaire ou d'un mot de passe connu",
        }
        throw translate[err] || err;
    });
}

export function setPassword(id: string, code: string, password: string, req_for_context: req) {
    console.log("esup_activ_bo._setPassword " + id + " using code " + code);
    return callAPI("setPassword", { id, code, password }, req_for_context)
}

// TODO
//export const changeLogin = (supannAliasLogin: string, code: string, newLogin: string, currentPassword: string) => ...
//export const changeLogin = (supannAliasLogin: string, code: string, newLogin: string) => ...

export const setNewAccountPassword = (uid: string, id: string, password: string, req_for_context: req) => (
    _getCode({ uid }, req_for_context).then(code => (
        code && setPassword(id, code, password, req_for_context)
    ))
);
