'use strict';

import * as _ from 'lodash-es';
import { toYYYY_MM_DD } from './helpers.ts';

export const datetime: ldap_conversion = {
        fromLdap: (dt: string): Date => {
            if (!dt) return null;
            let m = dt.match(/^(\d\d\d\d)(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)Z$/);
            return m && new Date(Date.UTC(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]), parseInt(m[4]), parseInt(m[5]), parseInt(m[6])));
        },
        toLdap: (d: Date): string => (
            d.toISOString().replace(/\.\d+/, '').replace(/[T:-]/g, '')
        ),
    };

export const date: ldap_conversion = {
        fromLdap: (dt: string): Date => {
            if (!dt) return null;
            let m = dt.match(/^(\d\d\d\d)(\d\d)(\d\d)$/);
            return m && new Date(Date.UTC(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3])));
        },
        toLdap: (d: Date): string => (
            toYYYY_MM_DD(d).replace(/-/g, '')
        ),
    };

export const date_epoch: ldap_conversion = {
    fromLdap: (s: string): Date => {
        if (!s) return null;
        const n = parseInt(s)
        return n && new Date(n * 24 * 60 * 60 * 1000);
    },
    toLdap: (d: Date): string => (
        "" + Math.round(d.getTime() / (24 * 60 * 60 * 1000))
    ),
}

export const postalAddress: ldap_conversion = {
        fromLdap: (s: string): string => (
            s && s.replace(/\$/g, "\n")
        ),
        toLdap: (s: string): string => (
            s && s.replace(/\n/g, "$")
        ),
    };

export const to_boolean_allowing_removing_the_value: ldap_conversion = {
    fromLdap: (s: string): true|"" => (
        s ? true : ""
    ),
    toLdap: (s: string) => ({ action: (vals: string[]) => (
        s ? vals : []
    ) }),
}

export function withEtiquette(etiquette: string): ldap_conversion {
    return {
        fromLdapMulti: (l: string[]): string => {
            for (let s of l) {
                if (_.startsWith(s, etiquette))
                    return s.substr(etiquette.length);
            }
            return null;
        },
        toLdap: (suffix: string) => ({ action: (vals: string[]) => (
            vals.filter(s => !_.startsWith(s, etiquette)).concat(suffix ? [etiquette + suffix] : [])
        ) }),
    };
}

export function withSuffixEtiquette(etiquette: string): ldap_conversion {
    return {
        fromLdapMulti: (l: string[]): string => {
            for (let s of l) {
                if (_.endsWith(s, etiquette))
                    return s.slice(0, -etiquette.length);
            }
            return null;
        },
        toLdap: (prefix: string) => ({ action: (vals: string[]) => (
            vals.filter(s => !_.endsWith(s, etiquette)).concat(prefix ? [prefix + etiquette] : [])
        ) }),
    };
}

export function withEtiquetteMulti(etiquette: string): ldap_conversion {
    return {
        fromLdapMulti: (l: string[]): string[] => {
            let l_: string[] = []
            for (let s of l) {
                if (_.startsWith(s, etiquette))
                    l_.push(s.substr(etiquette.length))
            }
            return l_;
        },
        toLdap: (suffixes: string[]) => ({ action: (vals: string[]) => (
            vals.filter(s => !_.startsWith(s, etiquette)).concat(suffixes ? suffixes.map(s => etiquette + s) : [])
        ) }),
    };
}

export function has_value(value: string): ldap_conversion {
    return {
        fromLdapMulti: (l: string[]): string => (
            l.includes(value) ? 'true' : ''
        ),
        toLdap: (s: string): ldap_modify => (
            { action: s ? 'add' : 'delete', value }
        ),
    };
}

export function has_not_value(value: string): ldap_conversion {
    return {
        fromLdapMulti: (l: string[]): string => (
            l.includes(value) ? '' : 'true'
        ),
        toLdap: (s: string): ldap_modify => (
            { action: s ? 'delete' : 'add', value }
        ),
    };
}

export function match(predicate: (s: string) => boolean): ldap_conversion {
    return {
        fromLdapMulti: (l: string[]): string => (
            l.find(predicate)
        ),
        toLdap: (s: string): string => (
            s
        ),
    };
}

type withEtiquetteAndMaybeNoteParams<T1, T2> = { attr: T1, attr2: T2, etiquette: string, separator: string, ldapAttr?: string, encoding?: 'urlencoding' }
function withEtiquetteAndMaybeNote_<T extends string>({ attr, attr2, etiquette, separator, ldapAttr, encoding } : withEtiquetteAndMaybeNoteParams<T, T>) {
    const decode = (s: string) => encoding === 'urlencoding' && s ? decodeURIComponent(s) : s
    const encode = (s: string) => encoding === 'urlencoding' && s ? encodeURIComponent(s) : s
    const split_ = (s: string) => s.split(separator, 2) as [string, string?]
    let attr_convert: ldap_conversion = {
        fromLdapMulti: (l: string[]): string => {
            for (let s of l) {
                if (_.startsWith(s, etiquette))
                    return decode(split_(s.substr(etiquette.length))[0])
            }
            return null;
        },
        toLdap: (suffix: string) => ({ action: (vals: string[]) => (
            vals.filter(s => !_.startsWith(s, etiquette)) // we remove all values beginning with etiquette
                .concat(suffix ? [etiquette + encode(suffix)] : []) // we add our value after the other remaining values
        ) }),
    }

    let attr2_convert: ldap_conversion = {
        fromLdapMulti: (l: string[]): string => {
            for (let s of l) {
                if (_.startsWith(s, etiquette))
                    return decode(split_(s.substr(etiquette.length))[1])
            }
            return null;
        },
        toLdap: (note: string) => ({ late: true, action: (vals: string[]) => (
            // the value has been added by attr_convert, we add the note as suffix
            vals.map(val => _.startsWith(val, etiquette) ? val + separator + encode(note) : val)
        ) }),
    }

    let r = { [attr]: { ldapAttr: ldapAttr || attr, convert: attr_convert }, [attr2]: { ldapAttr, convert: attr2_convert } }
    return r as { [attr in T]: AttrConvert }
}
export function withEtiquetteAndMaybeNote<Attr extends string, Attr2 extends string>(params: withEtiquetteAndMaybeNoteParams<Attr, Attr2>) {
    return withEtiquetteAndMaybeNote_<Attr|Attr2>(params)
}

export function dn(attrName: string, base: string): ldap_conversion {
    return {
        fromLdapMulti: (l: string[]): string => {
          let base_ = _.escapeRegExp(base);
          let reg = new RegExp(`^${attrName}=(.*),${base_}$`);
          for (const s of l) {
            let m = s.match(reg);
            if (m) return m[1];
          }
          return undefined;
        },
        toLdap: (s: string): string => (
            s ? attrName + "=" + s + "," + base : ''
        )
    }
}

export function dns(attrName: string, base: string): ldap_conversion {
    return {
        fromLdapMulti: (l: string[]): string[] => {
          let r = []
          let base_ = _.escapeRegExp(base);
          let reg = new RegExp(`^${attrName}=(.*),${base_}$`);
          for (const s of l) {
            let m = s.match(reg);
            if (m) r.push(m[1]);
          }
          return r;
        },
        toLdap: (_s: string): string => {
            throw "NOT IMPLEMENTED";
        },
    }
}

export function composites_by_key(compositeKey: string, filters: string[]): ldap_conversion {
    return {
        fromLdapMulti: (l: string[]): string[] => {
          let r = []
          for (const s of l) {
            if (filters.every(filter => s.includes(filter))) {
                r.push(parse_composite(s)[compositeKey]);
            }
          }
          return r;
        },
        toLdap: (_s: string): string => {
            throw "NOT IMPLEMENTED";
        },
    }
}

export function composite_by_key(compositeKey: string, filters: string[]): ldap_conversion {
    return {
        fromLdapMulti: (l: string[]): string => {
          const r = composites_by_key(compositeKey, filters).fromLdapMulti(l)
          return r.length > 0 ? r[0] : null
        },
        toLdap: (_s: string): string => {
            throw "NOT IMPLEMENTED";
        },
    }
}

export const base64: ldap_conversion = {
        fromLdapB: (s: Buffer): string => (
            s && s.toString('base64')
        ),
        toLdapJson: (s: string): string => {
            return s;
        },
        toLdap: (_s: string): string => {
            console.trace("base64.toLdap not handled correctly by ldapjs");
            throw "base64.toLdap not handled correctly by ldapjs";
        }
}

export const up1Profile: ldap_conversion = {
    fromLdapMulti: (l: string[]): {}[] => (
        l.map(parse_up1Profile_one)
    ),
    toLdap: (_s: string): string => {
        throw "NOT IMPLEMENTED";
    },
    applyAttrsRemapAndType: true,
}

export function up1Profile_field(field: string): ldap_conversion {
    return {
        fromLdapMulti: (l: string[]): {}[] => (
            l.map(parse_up1Profile_one).map(p => p[field] && p[field][0])
        ),
        toLdap: (_s: string): string => {
            throw "NOT IMPLEMENTED";
        },
    };
}

const unescape_sharpFF = (attr_value: string) => (
    attr_value.replace(/#([0-9A-F]{2})/ig, (_, xx) => String.fromCharCode(parseInt(xx, 16)))
);

const parse_up1Profile_one = (str: string) => {
    let r: Dictionary<string[]> = {};
    str.replace(/\[([^\[\]=]+)=((?:[^\[\]]|\[[^\[\]]*\])*)\]/g, (_m, key, val) => {
        (r[unescape_sharpFF(key)] ??= []).push(...val.split(';').map(unescape_sharpFF));
        return '';
    });
    return r;
};

export const parse_composite = (str: string) => {
    let r: Dictionary<string> = {};
    str.replace(/\[(.*?)\]/g, (_m, e) => {
      const m = e.match(/(.*?)=(.*)/)
      r[m[1]] = m[2];
      return '';
    });
    return r;
};

export const parse_composites = (strs: string[]) => (
    strs.map(parse_composite)
);

export const ignore_toLdap = (conversion?: ldap_conversion): ldap_conversion => (
    { ...conversion, toLdap: _ => ({ action: 'ignore' })}
)