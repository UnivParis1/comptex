'use strict';

import * as _ from 'lodash';
import * as conf from '../conf';
import * as ldap from '../ldap';
import * as search_ldap from '../search_ldap';
import * as db from '../db';
import { parse_composites } from '../ldap_convert';
const filters = ldap.filters;

type simple_acl_search = {    
    v_to_moderators_ldap_filter(v: v): Promise<string>
    loggedUser_to_subv(user: CurrentUser): Promise<Partial<v>[] | boolean>
}

const _normalize__or_subv = (l : boolean | Partial<v>[]) => (
    _.isBoolean(l) ? l : l.length === 0 ? false : l
);

export const convert_simple_acl_search = ({ loggedUser_to_subv, ...other } : simple_acl_search): acl_search => ({
    ...other,
    async loggedUser_to_ldap_filter(user) {
        const or_subv = _normalize__or_subv(await loggedUser_to_subv(user));
        return _.isBoolean(or_subv) ? or_subv : filters.or(or_subv.map(l => filters.and(search_ldap.subv_to_eq_filters(l))));
    },
    async loggedUser_to_mongo_filter(user) {
        const or_subv = _normalize__or_subv(await loggedUser_to_subv(user));
        return _.isBoolean(or_subv) ? or_subv : db.or(or_subv.map(subv => _.mapKeys(subv, (_,k) => "v." + k)));
    },
})

const loggedUser_filter = (filter: string): acl_search => convert_simple_acl_search({
    // search users that can moderate "v":
    v_to_moderators_ldap_filter: async (_v) => filter,
    // can the loggedUser moderate any "v":
    loggedUser_to_subv: (user) => {
        if (!user.id) console.error("no user id!?");
        return ldap.exist(search_ldap.currentUser_to_dn(user), filter)
    },
});

export const ldapGroup = (cn: string): acl_search => (
    loggedUser_filter(filters.memberOf(cn))
);

export const user_id = (user_id: string): acl_search => {
    return loggedUser_filter(search_ldap.currentUser_to_filter({ id: user_id }));
};

const mail_to_dn = async (mail: string) => (
    await ldap.searchOneThisAttr(conf.ldap.base, filters.eq('mail', mail), 'dn', '')
)
const groupMail_to_memberOf_filter = async (mail: string) => (
    filters.eq("memberOf", await mail_to_dn(mail))
)

// similar to acl.ldapGroup, but for groups with a mail address (useful together with flag "preferNonPeopleMailAddresses")
export const ldapGroupMail = (mail: string): acl_search => convert_simple_acl_search({
    // search users that can moderate "v":
    v_to_moderators_ldap_filter: async (_v) => (
        filters.or([
            filters.eq('mail', mail),
            await groupMail_to_memberOf_filter(mail),
        ])
    ),
    // can the loggedUser moderate any "v":
    loggedUser_to_subv: async (user) => {
        if (!user.id) console.error("no user id!?");
        const filter = await groupMail_to_memberOf_filter(mail)
        return await ldap.exist(search_ldap.currentUser_to_dn(user), filter)
    },
});

export const structureAnyRole = (code_attr: string): acl_search => convert_simple_acl_search({
    v_to_moderators_ldap_filter: async (v) => {
        let code = v[code_attr];
        return `(supannRoleEntite=*[code=${code}]*)`
    },
    loggedUser_to_subv: (user) => (
      ldap.read(search_ldap.currentUser_to_dn(user), { supannRoleEntite: [''] }, {}).then(user => {
        const user_roles = user.supannRoleEntite ? parse_composites(user.supannRoleEntite) as { role: string, code: string }[] : [];
        return user_roles.map(e => ({ [code_attr]: e.code }));
      })
    ),
});


export const _rolesGeneriques = (rolesFilter: string) => {
    return ldap.searchThisAttr(conf.ldap.base_rolesGeneriques, rolesFilter, 'up1TableKey', '' as string)
};
export const structureRoles = (code_attr: string, rolesFilter: string): acl_search => convert_simple_acl_search({
    v_to_moderators_ldap_filter: (v) => (    
        _rolesGeneriques(rolesFilter).then(roles => {
            let code = v[code_attr];
            let l = roles.map(role => `(supannRoleEntite=*[role=${role}]*[code=${code}]*)`)
            return filters.or(l);
        })
    ),
    loggedUser_to_subv: (user) => (
      ldap.read(search_ldap.currentUser_to_dn(user), { supannRoleEntite: [''] }, {}).then(user => (
        _rolesGeneriques(rolesFilter).then(roles => {
            const user_roles = user.supannRoleEntite ? parse_composites(user.supannRoleEntite) as { role: string, code: string }[] : [];
            return user_roles.filter(e => roles.includes(e.role)).map(e => ({ [code_attr]: e.code }));
        })
      ))
    ),
});

// Usage example:
//   acl.group_for_each_attr_codes(
//      'structureParrain', 
//       search_ldap.prefix_suffix_to_group_and_code('applications.comptex.invite.', '-managers')
//   )
export const group_for_each_attr_codes = (codeAttr: string, { code_to_group_cn, group_cn_to_code }: search_ldap.group_and_code_fns): acl_search => convert_simple_acl_search({
    v_to_moderators_ldap_filter: async (v) => (
        filters.memberOf(code_to_group_cn(v[codeAttr]))
    ),
    loggedUser_to_subv: async (user) => {
      const codes = await search_ldap.filter_user_memberOfs(group_cn_to_code, user);
      return codes.map(code => ({ [codeAttr]: code }))
    },
});

// Allow many LDAP groups (using LDAP filter & regex)
// Usage example:
//   acl.ldapGroupsMatching(
//       search_ldap.prefix_suffix_to_group_and_code('applications.comptex.invite.', '-managers')
//   )
export const ldapGroupsMatching = ({ code_to_group_cn, group_cn_to_code } : search_ldap.group_and_code_fns): acl_search => convert_simple_acl_search({
    // search users that are memberOf of groups matching "ldap_group_filter"
    v_to_moderators_ldap_filter: async (_v) => {
        // find all groups matching "ldap_group_filter"
        const groups = await ldap.searchThisAttr(conf.ldap.base_groups, `(cn=${code_to_group_cn('*')})`, 'cn', '');
        // create an LDAP filter matching users member of thoses groups
        return filters.or(groups.map(cn => filters.memberOf(cn)))
    },
    // is "user" memberOf of a group matching "group_cn_to_code"
    loggedUser_to_subv: async (user) => {
        const codes = await search_ldap.filter_user_memberOfs(group_cn_to_code, user);
        return codes.length > 0;
    },
});
