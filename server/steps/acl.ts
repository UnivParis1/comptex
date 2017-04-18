'use strict';

import conf = require('../conf');
import ldap = require('../ldap');
const filters = ldap.filters;

const searchPeople = (peopleFilter: string, attr: string) => (
    ldap.searchThisAttr(conf.ldap.base_people, peopleFilter, attr, '')
);

// "includes" is optional, it will be computed from "list"
const create = (peopleFilter: string): acl_search => (
    (_v, attr: string) => searchPeople(peopleFilter, attr)
);

export const ldapGroup = (cn: string): acl_search => (
    create(filters.memberOf(cn))
);

export const user_id = (user_id: string): acl_search => {
    let attr = user_id.match(/@/) ? "eduPersonPrincipalName" : "uid";
    return create(filters.eq(attr, user_id));
};

export const autoModerateIf = (f: (v) => boolean): acl_search =>
    (v, _attr) => Promise.resolve(f(v) ? ["_AUTO_MODERATE_"] : []);
