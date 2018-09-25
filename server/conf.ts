'use strict';

import * as fs from 'fs';
import sendmailTransport = require('nodemailer-sendmail-transport');
import * as ldap_convert from './ldap_convert';
import { sameKeyNameChoices } from './helpers';
import * as grouped_calls from './helper_grouped_calls';

const ldap_base = "dc=univ,dc=fr";
const ldap_main = {
        uri: 'ldap://ldap-test.univ.fr',

        // empty for anonymous bind:
        dn: 'cn=comptex,ou=admin,' + ldap_base,
        password: 'xxx',

        base: ldap_base,
        base_people: "ou=people," + ldap_base,
        base_groups: "ou=groups," + ldap_base,
        base_structures: "ou=structures," + ldap_base,
        base_structures_old: "ou=structures,o=Paris1," + ldap_base,
        base_rolesGeneriques: "ou=supannRoleGenerique,ou=tables," + ldap_base,
        base_etablissements: "ou=supannEtablissement,ou=tables," + ldap_base,

        uid_to_eppn: "@univ.fr",
};

const internal_organizations = [
    '{UAI}0751717J', // Univ Paris 1
    '{UAI}0752719Y', // SCD
];

const conf = {
    maxLiveModerators: 100,

    mainUrl: 'https://comptex.univ.fr/test',
    
    mail: {
        from: 'Assistance <assistance@univ.fr>',
        intercept: 'Admin <admin@univ.fr>',
        transport: sendmailTransport({}),
    },

    cas_idp: 'https://idp.univ.fr',

    mongodb: { 
        url: "mongodb://localhost:27017/compte-externe",
    },

    esup_activ_bo: {
        url: "http://xxxx.univ.fr:8080/esup-activ-bo/xfire/AccountManagement",
    },
    
    ldap: {
        ...ldap_main,

        structures: {
            types: {
                key: '', name: '', description: '',
            },
            attrs: {
                key: { ldapAttr: 'supannCodeEntite' }, 
                name: { ldapAttr: 'ou' },
            },
        },
        
        etablissements: {
            types: {
                key: '', description: '', displayName: '',
                siret: '',
                postalAddress: '', labeledURI: '', telephoneNumber: '', facsimileTelephoneNumber: '',
            },
            attrs: {
                key: { ldapAttr: 'up1TableKey' },
                siret: { ldapAttr: 'supannEtablissement', convert: ldap_convert.withEtiquette("{SIRET}") },
                postalAddress: { convert: ldap_convert.postalAddress },
            },
        },
        
        people: {
            types: {
                uid: '', sn: '', displayName: '', givenName: '',
                supannCivilite: '',
                supannAliasLogin: '', supannMailPerso: '', userPassword: '', mail: '',
                birthDay: new Date(), birthName: '', altGivenName: [],
                homePhone: '', telephoneNumber: '', facsimileTelephoneNumber: '', supannAutreTelephone: '', pager: '',
                homePostalAddress: '',
                floorNumber: '', roomAccess: '', roomNumber: '', buildingName: '',
                jpegPhoto: '',
                structureParrain: '',

                etablissementExterne: '',
                etablissementInterne: '',
                Shib_Identity_Provider: '',
                eduPersonPrincipalName: '',

                barcode: '',
                mifare: '',

                // useful to know the kind of profiles the user has.
                global_eduPersonAffiliation: [],
                global_eduPersonPrimaryAffiliation: '',
                global_supannEtuAnneeInscription: [0],
                global_profilename: [''],

                eduPersonPrimaryAffiliation: '',
                eduPersonEntitlement: '',
                supannRoleEntite: [],

                profilename: '',
                priority: 0,
                startdate: new Date(),
                enddate: new Date(),
                duration: 0,

                accountStatus: '',
                up1KrbPrincipal: '',
                mailHost: '',
                supannEmpId: '',
                supannEtuId: '',
                
                up1Profile: [],
            },

            attrs : { 
                homePostalAddress: { convert: ldap_convert.postalAddress },
                birthDay: { ldapAttr: "up1BirthDay", convert: ldap_convert.datetime },
                birthName: { ldapAttr: 'up1BirthName' },
                altGivenName: { ldapAttr: 'up1AltGivenName' },
                floorNumber: { ldapAttr: 'up1FloorNumber' },
                roomAccess: { ldapAttr: 'up1RoomAccess' },
                up1Profile: { convert: ldap_convert.up1Profile },
                global_profilename: { ldapAttr: 'up1Profile', convert: ldap_convert.up1Profile_field('up1Source') },
                profilename: { ldapAttr: 'up1Source', ldapAttrJson: 'profilename' },
                priority: { ldapAttr: 'up1Priority', ldapAttrJson: 'priority' },
                startdate: { ldapAttr: 'up1StartDate', ldapAttrJson: 'startdate', convert: ldap_convert.date },
                enddate: { ldapAttr: 'up1EndDate', ldapAttrJson: 'enddate', convert: ldap_convert.date },
                etablissementExterne: { ldapAttr: 'supannEtablissement', convert: ldap_convert.match(s => !internal_organizations.includes(s)) },
                etablissementInterne: { ldapAttr: 'supannEtablissement', convert: ldap_convert.match(s => internal_organizations.includes(s)) },
                Shib_Identity_Provider: { ldapAttr: 'supannEtablissement', convert: ldap_convert.withEtiquette('{SAML}') },
                eduPersonPrincipalName: { ldapAttr: 'supannRefId', convert: ldap_convert.withEtiquette("{EPPN}") },                
                structureParrain: { ldapAttr: 'supannParrainDN', convert: ldap_convert.dn("supannCodeEntite", ldap_main.base_structures), convert2: ldap_convert.dn("ou", ldap_main.base_structures_old) },
                barcode: { ldapAttr: 'employeeNumber' },
                mifare: { ldapAttr: 'supannRefId', convert: ldap_convert.withEtiquette("{MIFARE}")  },
                jpegPhoto: { convert: ldap_convert.base64 },
            },
            sns: ['sn'],
            givenNames: ['givenName'],
            supannCiviliteChoices: sameKeyNameChoices([ 'M.', 'Mme' ]),

            homonymes_preferStudent: profilename => (profilename || '').match(/^\{COMPTEX\}learner\./),
            homonymes_restriction: '(objectClass=inetOrgPerson)',
        },

        group_cn_to_memberOf: cn => (
            "cn=" + cn + "," + ldap_main.base_groups
        ),

        group_member_to_eppn: user_dn => {
            let r = user_dn.match(/^uid=([^,]*)/);
            if (!r) console.log("invalid group member " + user_dn);
            return r && r[1] + conf.ldap.uid_to_eppn;
        },

        disconnectWhenIdle_duration: 1 * 60 * 1000, // in milliseconds
    },

    shibboleth: {
        header_map: {
            Shib_Identity_Provider: 'Shib-Identity-Provider',
            eduPersonPrincipalName: 'eppn',
            supannMailPerso: 'mail',

            supannCivilite: 'supannCivilite',
            cn: 'cn',
            sn: 'sn', 
            givenName: 'givenName', 
            displayName: 'displayName',
        },
    },

    attrsHelpingDiagnoseHomonymes: [
        'mail', 'altGivenName', 'global_eduPersonAffiliation', 'global_eduPersonPrimaryAffiliation', 'global_supannEtuAnneeInscription',
    ],

    http_client_CAs: fs.readFileSync('/etc/ssl/certs/ca-certificates.crt').toString().split(/(?=-----BEGIN CERTIFICATE-----)/),

    poll_maxTime: 4 * 60 * 1000, // 4 minutes

    crejsonldap: {
        grouped_calls: {
            nb_parallel_calls: 5,
            group_size: 50,
        } as grouped_calls.options,
    },
};

export = conf;
