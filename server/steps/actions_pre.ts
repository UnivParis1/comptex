import * as _ from 'lodash';
import * as basic_auth from 'basic-auth';
import * as utils from '../utils';
import * as ldap from '../ldap';
import { oneExistingPerson } from '../search_ldap';
import * as search_ldap from '../search_ldap';
import { selectUserProfile, merge_v } from '../step_attrs_option';
import * as esup_activ_bo from '../esup_activ_bo';
import * as cas from '../cas';
import * as conf from '../conf';
const filters = ldap.filters;

export const mutate_v = (f: (v:v) => void) : simpleAction_pre => async (_req, sv) => {
    f(sv.v)
    return sv.v
}
export const check_v = mutate_v

// use it with a firstAction_pre if you want to merge existing (nextStep) sv.v with the result of the action
export const assign = (action: firstAction_pre) : simpleAction_pre => async (req, sv) => {
    const v = await action(req, sv)
    return { ...sv.v, ...v }
}

export const addAttrs = (v: Partial<v>): simpleAction_pre => async (_req, sv) => {
    _.assign(sv.v, v);
    return sv.v;
}

export const if_query = (test_query: (query: Dictionary<string>) => boolean, action: action_pre): action_pre => async (req, sv: sv) => (
    test_query(req.query) ? await action(req, sv) : sv.v
);

export const chain = (l_actions: action_pre[]): action_pre => (
    async (req, sv: sv) => {
        let v = sv.v
        for (const action_pre of l_actions) {
            v = await action_pre(req, { ...sv, v })
        }
        return v
    }
)

export const handle_exception = (action: action_pre, handler: (err: any, req: req, sv: sv) => Promise<v>) : action_pre => (req: req, sv: sv) => (
    action(req, sv).catch(err => handler(err, req, sv))
);

const isShibUserInLdap = (req: req) => {
    let idp = req.header('Shib-Identity-Provider');
    return idp && idp === conf.ldap.shibIdentityProvider;
}

// relies on headers from mod_auth_openidc
export const getOidcAttrs: firstAction_pre = async (req, _sv) => {
    if (!req.header('oidc_claim_sub')) {
        throw { code: "Unauthorized", authenticate: { type: "franceconnect" } }
    }

    let v = _.mapValues(conf.oidc.header_map, headerName => (
        // by default mod_auth_openidc sends utf8 whereas headers should be latin1 (unless one uses "OIDCPassClaimsAs both latin1")
        // so forcing utf8 interpretation
        Buffer.from(req.header(headerName), 'latin1').toString('utf-8')
    )) as any as v;
    
    if (v.givenName) [ v.givenName, ...v.altGivenName ] = v.givenName.split(' ');
    if (v.supannCivilite === 'female') v.supannCivilite = 'Mme'
    if (v.supannCivilite === 'male') v.supannCivilite = 'M.'
    if (v.birthDay) v.birthDay = new Date(v.birthDay)
    v.sn ??= v.birthName

    console.log("action getOidcAttrs:", v, req.headers);
    return v;
};

export const getShibAttrs: firstAction_pre = async (req, _sv) => {
    if (!req.user) throw `Unauthorized`;
    let v = _.mapValues(conf.shibboleth.header_map, headerName => (
        req.header(headerName)
    )) as any as v;
    console.log("action getShibAttrs:", v);
    return v;
};

export const getShibUserLdapAttrs: firstAction_pre = async (req, _sv) => {
    if (!isShibUserInLdap(req)) throw `Unauthorized`;
    let filter = search_ldap.currentUser_to_filter(req.user);
    let v: v = await oneExistingPerson(filter);
    return v;
}

export const getShibOrCasAttrs: firstAction_pre = (req, _sv) => (
    (isShibUserInLdap(req) ? getShibUserLdapAttrs : getShibAttrs)(req, _sv)
)

export const getExistingUser: firstAction_pre = async (req, _sv)  => {
    if (!req.query.uid) throw "getExistingUser: no req.query.uid"
    const v = await oneExistingPerson(filters.eq("uid", req.query.uid))
    return v
}

const handle_profilename_to_modify = (req: req, v: v) => (
    handle_profilename_to_modify_(v, req.query.profilename_to_modify)
)
export const handle_profilename_to_modify_ = (v: v, profilename: string) => {
    const v_ = profilename && selectUserProfile(v, profilename);
    if (v_) v = { ...v_, profilename_to_modify: profilename };
    return v;
}

export const getExistingUserWithProfile: firstAction_pre = (req, _sv)  => (
    oneExistingPerson(filters.eq("uid", req.query.uid)).then(v => handle_profilename_to_modify(req, v))
);

export const getShibUserLdapAttrsWithProfile: firstAction_pre = (req, _sv)  => (
    getShibUserLdapAttrs(req, null).then(v => handle_profilename_to_modify(req, v))
);

function handleAttrsRemapAndType(o : Dictionary<string[]>, attrRemapRev: Dictionary<string[]>, wantedConvert: ldap.AttrsConvert) {
    const v: v = ldap.handleAttrsRemapAndType(o as any, attrRemapRev, { possibleChannels: [], code: '', ...conf.ldap.people.types }, wantedConvert)
    v['various'] = { esup_activ_bo_orig: o }
    return v
}

export const esup_activ_bo_validateAccount = (isActivation: boolean) : firstAction_pre => async (req, _sv) => {
    const userInfo = ldap.convertToLdap(conf.ldap.people.types, conf.ldap.people.attrs, search_ldap.v_from_WS(req.query), {});
    const { wantedConvert, attrRemapRev } = ldap.convert_and_remap(conf.ldap.people.types, conf.ldap.people.attrs);
    const o = await esup_activ_bo.validateAccount(userInfo as any, _.without(Object.keys(attrRemapRev), 'userPassword'), req)
    if (isActivation && !o.code) throw "Compte déjà activé";
    if (!isActivation && o.code) throw "Compte non activé";
    const v = handleAttrsRemapAndType(o, attrRemapRev, wantedConvert)
    return v
}

export const esup_activ_bo_validateCode : simpleAction_pre = (req, sv) => (
    esup_activ_bo.validateCode(req.query.supannAliasLogin, req.query.code, req).then(_ => sv.v)
)

export const esup_activ_bo_authentificateUser = (userAuth: 'useSessionUser' | 'useBasicAuthUser') : firstAction_pre => async (req, _sv) => {
    const { wantedConvert, attrRemapRev } = ldap.convert_and_remap(conf.ldap.people.types, conf.ldap.people.attrs);
    const auth = basic_auth(req);
    if (!auth) throw "Bad Request";
    if (userAuth === 'useSessionUser') {
        auth.name = req.session.supannAliasLogin
        if (!auth.name) {
            console.error("esup_activ_bo_authentificateUserWithCas should have set req.session.supannAliasLogin in a previous step. Did you use it?")
            throw "Bad Request";
        }
    }
    const o = await esup_activ_bo.authentificateUser(auth.name, auth.pass, _.without(Object.keys(attrRemapRev), 'userPassword'), req);
    const v = handleAttrsRemapAndType(o, attrRemapRev, wantedConvert)
    return v
}

export const esup_activ_bo_authentificateUserWithCas : firstAction_pre = async (req, _sv) => {
    const { wantedConvert, attrRemapRev } = ldap.convert_and_remap(conf.ldap.people.types, conf.ldap.people.attrs);
    const targetUrl = conf.mainUrl; // anything would do... weird esup_activ_bo... 
    const proxyticket = await cas.get_proxy_ticket(req, targetUrl);
    if (!proxyticket) throw "failed getting CAS proxy ticket";
    const o = await esup_activ_bo.authentificateUserWithCas(req.user.id, proxyticket, targetUrl, Object.keys(attrRemapRev), req);
    if (!o.code) throw "weird account: CAS is authorized by esup-activ-bo thinks user is not activated"
    const v = handleAttrsRemapAndType(o, attrRemapRev, wantedConvert)

    req.session.supannAliasLogin = v.supannAliasLogin // needed for actions_pre.esup_activ_bo_authentificateUser('useSessionUser')
    
    return v;
}

// useful with nextBrowserStep, otherwise the query params obtained from previous step are NOT validated.
export const validateAndFilterQueryParams = (attrs: StepAttrsOption) : simpleAction_pre => async (req, sv) => {
    let v = merge_v(attrs, {}, {}, req.query as any, { no_diff: true }) as any
    req.query = v;
    return sv.v
}

export const mutateQuery = (f: (v:v) => void) : simpleAction_pre => async (req, sv) => {
    f(req.query as any)
    return sv.v
}

const _esupUserApps_canAccess = async (app: string, uid: string) => {
    if (!conf.esupUserApps?.url) throw "esupUserApps is not configured"
    try {
        await utils.http_request(conf.esupUserApps.url + '/canAccess' + utils.query_string({ app, uid }), {})
        return true
    } catch (e) {
        if (e?.statusCode !== 403) throw e
        return false
    }
}

export const esupUserApps_check_canAccess = (app: string): simpleAction_pre => async (_req, sv) => {
    if (!await _esupUserApps_canAccess(app, sv.v.uid)) throw "Application non autorisée"
    return sv.v
}

export const esupUserApps_add_canAccess = (app: string): simpleAction_pre => async (_req, sv) => {
    _.merge(sv.v, { various: { canAccess: { [app]: await _esupUserApps_canAccess(app, sv.v.uid) } } })
    return sv.v
}

export const check_v_otp: simpleAction_pre = async (req, {v}) => {
    console.log('check_v_otp', v)
    if (!v.otp) throw "internal error: missing otp in saved v"
    if (req.query.otp !== v.otp) {
        console.error("missing/bad otp: wanted", v.otp, "got", req.query.otp)
        throw "Forbidden"
    }
    return v
}
