import axios from 'axios';
import { merge, omit, cloneDeep } from 'lodash-es';
import { setTimeoutPromise } from '../../../shared/helpers.ts'
import * as Helpers from './helpers.ts';

type http_options = { headers?: any, params?: any, signal?: AbortSignal }
type http_err = { message: string, response: { status: number, headers: Dictionary<string>, data: Dictionary<any> }}
const http_request = (url: string, config: http_options & { method: 'get'|'post'|'put'|'delete', data?: Dictionary<any> }) => (
    axios.request({ url, ...config }) as Promise<{ data: any }>
)

const http = {
    get: (url: string, config?: http_options) => http_request(url, { method: 'get', ...config }),
    post: (url: string, data: Dictionary<any>, config?: http_options) => http_request(url, { method: 'post', data, ...config }),
    put : (url: string, data: Dictionary<any>, config?: http_options) => http_request(url, { method: 'put', data, ...config }),
    delete: (url: string) => http_request(url, { method: 'delete' }),
}

interface VCommon extends CommonV {
    structureParrain?: string;
    supannAliasLogin?: string;
    jpegPhoto?: string;
    homePostalAddress?: string;
}
export interface VRaw extends VCommon {
    birthDay?: string;
}
export interface V extends VCommon {
    birthDay?: Date;
    prev?: string;
    noInteraction?: boolean;
    startdate?: Date;
    enddate?: Date;
}
export type SVRaw = ClientSideSVA

interface StepAttrOptionChoicesWithShort {
  const: string;
  title: string;
  short_title?: string;
}
export type StepAttrOption = StepAttrOptionM<ClientSideOnlyStepAttrOption & SharedStepAttrOption>
export type StepAttrsOption = Dictionary<StepAttrOption>
export type Mpp = MppT<StepAttrOption>
export type StepAttrOptionChoices = StepAttrOptionChoicesT<StepAttrOption>

export interface InitialSteps {
    attrs: StepAttrsOption;
    allow_many: boolean | { forced_headers: string[] };
}

import conf from '../conf.ts';

const api_url = conf.base_pathname + 'api';

export function eachAttrs(attrs: StepAttrsOption, oneOfTraversal: 'always' | 'never', f: (opts: StepAttrOption, key: string, attrs: StepAttrsOption) => void) {
    function rec_mpp(mpp: Mpp) {
        if (mpp.merge_patch_parent_properties) rec(mpp.merge_patch_parent_properties)
    }
    function rec(attrs : StepAttrsOption) {
        for (const attr in attrs) {
            const opts = attrs[attr];
            if (opts?.properties) rec(opts.properties);
            if (opts?.items?.properties) rec(opts.items.properties)
            if (oneOfTraversal === 'always') {
                if (opts?.then) rec_mpp(opts.then)
                if (opts?.oneOf) opts.oneOf.forEach(rec_mpp)
            }
        f(opts, attr, attrs);
      }
    }
    rec(attrs);
}

export const people_search = (step: string, token: string, maxRows? : number) : Promise<V[]> => (
    http.get(api_url + '/comptes/search/' + step, { params: { token, maxRows } }).then(resp => resp.data as Promise<V[]>)
);

export function search(stepName: string, attr: string, token : string, maxRows? : number) : Promise<StepAttrOptionChoicesWithShort[]> {
    return http.get(api_url + '/search/' + stepName + '/' + attr, { params: { token, maxRows } }).then((resp) => resp.data as StepAttrOptionChoicesWithShort[]);
}

const _toDate = (year: number, month: number, day: number) => new Date(Date.UTC(year, month - 1, day));
        
function _fromLDAPDate(date: string) {
    var m = date.match(/^([0-9]{4})([0-9]{2})([0-9]{2})[0-9]{6}Z?$/);
    return m && _toDate(parseInt(m[1]), parseInt(m[2]), parseInt(m[3]));
}
function _fromFrenchDate(date: string) {
    var m = date.match(/^([0-9]{2})\/([0-9]{2})\/([0-9]{4})$/);
    return m && _toDate(parseInt(m[3]), parseInt(m[2]), parseInt(m[1]));
}
const _fromCSVDate = (val: string) => (
    _fromFrenchDate(val) || _fromLDAPDate(val) || new Date(val) || "date invalide"
);

function _base64_to_jpeg_data_URL(base64: string): string {
    return "data:image/jpeg;base64," + base64;
}
function _jpeg_data_URL_to_base64(data_URL: string): string {
    return data_URL.replace(/^data:image\/jpeg;base64,/, '');
}

const attr_format_to_converter = {
    'date': { fromWs: (val: string) => new Date(val), toWs: (val: Date) => val.toJSON(), fromCSV: _fromCSVDate },
    'datetime': { fromWs: (val: string) => new Date(val), toWs: (val: Date) => val.toJSON(), fromCSV: _fromCSVDate },
    'image/jpeg': { fromWs: _base64_to_jpeg_data_URL, toWs: _jpeg_data_URL_to_base64 },
    'phone': { fromWs: Helpers.maybeFormatPhone("0"), toWs: Helpers.maybeFormatPhone("+33 ") },
}

function to_or_from_ws(direction: 'fromWs' | 'fromCSV' | 'toWs', v: {}, attrs: StepAttrsOption) {
    var v_ = Helpers.copy(v);

    const _to_converter = (format: MinimalStepAttrOption["format"]) => {
        const converters = format && attr_format_to_converter[format];
        return converters && converters[direction];
    };
    for (const attr in v) {
        const opts = attrs[attr] || {};
        const convert = _to_converter(opts.format);
        if (convert && v[attr]) v_[attr] = convert(v[attr]);

        const item_converter = _to_converter(opts.items?.format);
        if (item_converter && Array.isArray(v[attr])) v_[attr] = v[attr].map(item_converter)
        
        if (opts.items?.properties) v_[attr] = v[attr].map(v_ => to_or_from_ws(direction, v_, opts.items.properties))

        if (direction === 'fromCSV' && opts.normalize) v_[attr] = opts.normalize(v_[attr]);
    }
    return v_;
}

export const fromWs = (v: VRaw, attrs: StepAttrsOption): V => to_or_from_ws('fromWs', v, attrs);
export const toWs = (v: V, attrs: StepAttrsOption): VRaw => to_or_from_ws('toWs', v, attrs);

const fromWs_one = (attr: string, val, attrs) => fromWs({ [attr]: val }, attrs)[attr]


async function try_firefox_trigger_clear_history() {
    console.log("trying firefox-trigger-clear-history")
    Helpers.createCookie('forceBrowserExit', 'true', 0); // cf https://github.com/UnivParis1/firefox-trigger-clear-history/blob/master/index.js#L19

    const wait_for_clear_history = async (count: number) => {
        await setTimeoutPromise(20/*milliseconds*/)
        if (count > 99) {
            console.log("firefox-trigger-clear-history failed")
        } else if (document.cookie.match("forceBrowserExit=true")) {
            // wait some more
            await wait_for_clear_history(count+1)
        } else {
            console.log("firefox-trigger-clear-history succeeded, reloading page")
            document.location.reload();
        }
    }
    await wait_for_clear_history(1)
}

let restarting = false;

function _handleErr(err : http_err, $scope = null, redirect = false) {
    if (restarting) return Promise.reject("restarting");

    if (!err.response) {
        // axios "Network Error" case, no useful information
        console.error(err);
        const msg = "server is down, please retry later";
        alert(msg);
        return Promise.reject(msg);
    }

    let resp = err.response;
    if (resp.status === 401 && $scope && $scope.$route.path !== '/login') {
        console.log("must relog", resp.headers.toString());
        restarting = true;
        const type = resp.data && resp.data.authenticate && resp.data.authenticate.type || $scope.$route.query.idp || 'local';
        const location = conf.base_pathname + 'login/' + type + '?then=' + encodeURIComponent($scope.$route.fullPath);
        document.location.href = resp.data?.authenticate?.need_relog_local ? `/Shibboleth.sso/Logout?return=${encodeURIComponent(location)}` : location
        return Promise.reject("logging...");
    } else if (resp.status === 401) {
        if (confirm("Votre session a expiré, vous allez devoir recommencer.")) {
            document.location.reload();
        }
        return Promise.reject("restarting...");
    } else if (resp.status === 400 && resp.data?.force_history_back) {
        alert(resp.data.message);
        history.back();
        return Promise.reject("...");
    } else {
        if (resp.status === 403 && resp.data?.authenticate?.need_logout) {
            try_firefox_trigger_clear_history() // in background
        }
        const json_error = resp.data && (resp.data.error || resp.data.error_html) ? resp.data : { error: err.message }
        const msg = json_error.error
        console.error(resp || err)
        if (redirect && !window.history.state || json_error.error_html && !msg) {
            $scope.fatal_error = msg;
            $scope.fatal_error_html = json_error.error_html;
        } else {
            alert(msg);
            if (redirect) {
                return Promise.reject("alerted__do_router_back")
            }
        }
        return Promise.reject(json_error);
    }
}

export function loggedUserInitialSteps() : Promise<InitialSteps> {
    return http.get(api_url + '/steps/loggedUserInitialSteps').then(resp => (
        resp.data
    ));
}

function initAttrs(root_attrs: StepAttrsOption) {
    eachAttrs(root_attrs, 'always', (opts, attr, attrs) => {
        // recursive merge, especially useful for attr.labels
        attrs[attr] = merge({}, conf.default_attrs_opts[attr], opts);
    })
}

function get_all_attrs_flat(root_attrs: StepAttrsOption) {
    let all_attrs: StepAttrsOption = {};
    eachAttrs(root_attrs, 'always', (opts, attr) => {
        if (all_attrs[attr]) {
            // argh, weird stuff can happen (eg: handleAttrsValidators_and_computeValue_and_allowUnchangedValue will handle on one attr)
            // try to warn...
            const opts_ = all_attrs[attr]
            if (opts.validator || opts.allowUnchangedValue || opts_.validator || opts_.allowUnchangedValue) {
                const a1 = JSON.stringify(omit(opts_, 'default'))
                const a2 = JSON.stringify(omit(opts, 'default'))
                console.error("duplicated attribute badly handled", a1, a2)
            }
        }
        all_attrs[attr] = opts
    })
    return all_attrs;
}

function handleAttrsValidators_and_computeValue_and_allowUnchangedValue(all_attrs: StepAttrOptionM<any>, v: V, v_orig: V) {
    for (const attr in all_attrs) {
        const opts = all_attrs[attr];
        const validator = opts.validator;
        if (validator) {
            // pass v_orig to attrs opts.validator:
            opts.validator = (val) => validator(val, v_orig);
        }
        {
            const fn = opts.computeValue;
            if (fn) opts.computeValue = () => fn(v, all_attrs);
        }
        if (opts.allowUnchangedValue) {
            // save the orig value here
            opts.allowUnchangedValue = v_orig[attr]
            if (opts.pattern && v_orig[attr]) {
                opts.pattern += "|" + Helpers.escapeRegexp(v_orig[attr])
            }
        }
    }
}

function password_to_auth(params) {
    if (params.userPassword) {
        const auth = { username: params.supannAliasLogin || '', password: params.userPassword }
        return { params: omit(params, 'userPassword', 'supannAliasLogin'), auth };
    } else {
        return { params };
    }
}

export function getInScope($scope, id: string, params, hash_params, expectedStep: string) : Promise<void> {
    var url = api_url + '/comptes/' + id + "/" + expectedStep;
    return http.get(url, password_to_auth(params)).then((resp) => {
        var sv = resp.data as SVRaw;
        initAttrs(sv.attrs);
        $scope.attrs = sv.attrs;
        let all_attrs = get_all_attrs_flat($scope.attrs);
        let v = fromWs(sv.v, all_attrs)
            $scope.v_ldap = sv.v_ldap ? fromWs(sv.v_ldap, all_attrs) : id === 'new' ? cloneDeep(v) : undefined;
            handleAttrsValidators_and_computeValue_and_allowUnchangedValue(all_attrs, v, Helpers.copy(v));
            Helpers.eachObject(all_attrs, (attr, opts) => {
                let param
                if (opts.uiType === 'newPassword') return

                // NB: hash params is useful for very long values (think jpegPhoto) since GET URI length has limitations
                if (!param) {
                    param = params[`set_${attr}`] || hash_params[`set_${attr}`]
                }
                if (!param) {
                    param = params[`readOnly_${attr}`] || hash_params[`readOnly_${attr}`]
                    if (param) all_attrs[attr].readOnly = true
                }
                if (!param && !v[attr]) {
                    param = params[`default_${attr}`] || hash_params[`default_${attr}`]
                }
                if (!param && !v[attr]) {
                    param = params[attr]
                    if (param) all_attrs[attr].readOnly = true
                }
                if (param) {
                    v[attr] = fromWs_one(attr, param, all_attrs)
                } else if (!v[attr]) {
                    // NB: important to set v[attr] for Vue.js 2 reactivity
                    v[attr] = undefined;
                }
            });
            (v['various'] ??= {}).extern_ask_confirmation = undefined
        $scope.v_orig = cloneDeep(v);
        $scope.v = v // assign it when it is fully computed. Needed for Vue.js
        $scope.all_attrs_flat = all_attrs;
        $scope.step = sv.step;
        $scope.additional_public_info = sv.additional_public_info;
    }, err => _handleErr(err, $scope, true));
}

export const listInScope = ($scope, params, signal: AbortSignal) => (
    listInScope_maybe_retry($scope, params, signal, params.poll ? { retries: 10, time_before_retry: 1000 } : {})
)

async function listInScope_maybe_retry($scope, params, signal: AbortSignal, opts) : Promise<"ok" | "cancel"> {
    try {
        const resp = await http.get(api_url + '/comptes', { params, signal });
        var svs = resp.data;
        $scope.svs = svs;
        return "ok";
    } catch (err) {
        if (axios.isCancel(err)) {
            return "cancel";
        }
        if (opts.retries) {
            opts.retries--
            await setTimeoutPromise(opts.time_before_retry)
            opts.time_before_retry *= 2
            return listInScope_maybe_retry($scope, params, signal, opts)
        }
        return _handleErr(err, $scope);
    }
}

export function homonymes(id, v, all_attrs_flat, params, stepName: string) {
    const v_ = toWs(v, all_attrs_flat);
    return http.post(api_url + '/homonymes/' + id + '/' + stepName, v_, password_to_auth(params)).then((resp) =>
        (resp.data as any).map(v => fromWs(v, all_attrs_flat))
        , _handleErr);
}

export function set(id: string, step: string, v: V, params, all_attrs_flat: StepAttrsOption) {
    var url = api_url + '/comptes/' + id + "/" + step;
    var v_ = toWs(v, all_attrs_flat);
    const params_ = password_to_auth(params);
    return http.put(url, v_, params_).then(
        (resp) => resp.data,
        _handleErr);
}

export function new_many(step: string, vs: V[], all_attrs_flat: StepAttrsOption) {
    var url = api_url + '/comptes/new_many/' + step;
    var vs_ = vs.map(v => toWs(v, all_attrs_flat));
    return http.put(url, vs_).then(
        (resp) => resp.data,
        _handleErr);
}

export function remove(id: string, step: string) {
    var url = api_url + '/comptes/' + id + "/" + step;
    return http.delete(url).then( 
        (resp) => resp.data,
        _handleErr);
}

export function csv2json(file: File, attrs: StepAttrsOption, forced_headers?: string[]) : Promise<{ fields: string[], lines: {}[] }> {
    return http.post(api_url + '/csv2json', file, { params: { forced_headers } }).then(
        (resp) => {
            let o = resp.data;
            o.lines = o.lines.map(v => to_or_from_ws('fromCSV', v, attrs));
            return o;
        },
        _handleErr);
}
