import * as _ from 'lodash-es';
import { addDays, inclusive_range as range, sameKeyNameChoices } from './helpers.ts';
import * as search_ldap from './search_ldap.ts';
import * as ldap from './ldap.ts';
import conf from './conf.ts';
import * as helpers from './helpers.ts';
import * as translate from './translate.ts'
import * as crejsonldap from './crejsonldap.ts';
import * as ldap_convert from './ldap_convert.ts';
import shared_conf from '../shared/conf.ts';
const filters = ldap.filters;

export const up1Table = (constraint_filter: string, ldapAttr_for_const: string, optional: boolean) => (
    async (token: string, sizeLimit: number) => {
        let filter;
        if (token.match(/\{.*/) || sizeLimit === 1) {
            filter = filters.eq(ldapAttr_for_const, token);
        } else if (token !== '') {
            filter = filters.fuzzy(['displayName'], token);
        }
        const filter_ = token === '' ? constraint_filter : filters.and([ filter, constraint_filter ]); 
        const l = await ldap.search(conf.ldap.base, filter_, { const: '', title: '' }, {
            const: { ldapAttr: ldapAttr_for_const },
            title: { ldapAttr: 'displayName' },
        }, { sizeLimit });
        let l_ = _.sortBy(l, 'title')
        if (optional && token === '') l_.unshift({ const: undefined, title: 'Ne pas préciser' });
        return l_;
    }
)

export const search_supannRoleGenerique_up1 = (opts: StepAttrOption) => ({
    oneOf_async: up1Table('(&(up1TableName=supannRoleGenerique)(up1Flags={PRIO}*))', 'up1TableKey', opts.optional),
    ...opts
})
export const search_supannActivite_up1 = (opts: StepAttrOption) => ({
    oneOf_async: up1Table('(&(up1TableName=supannActivite)(up1TableKey={UAI:0751717J:ACT}*))', 'displayName', opts.optional),
    ...opts
});
export const search_supannActivite = (opts: StepAttrOption) => ({
    oneOf_async: up1Table('(up1TableName=supannActivite)', 'up1TableKey', opts.optional),
    ...opts
});

const get_buildingNameChoices = async () => {
    const l = await ldap.search(conf.ldap.base_structures, "(supannTypeEntite={SIHAM}LDT)", 
        { const: '', title: '', postalAddress: '' }, 
        { const: { ldapAttr: 'description' }, title: { ldapAttr: 'description' }, postalAddress: { convert: ldap_convert.postalAddress } }, 
        {})
    return l.map(({ postalAddress, ...choice }) => (
        { ...choice, merge_patch_parent_properties: {
            postalAddress_: { default: postalAddress }
        } } as StepAttrOptionChoices
    ))
}

let buildingNameChoices: StepAttrOptionChoices[] = [
    { const: undefined, title: "ne pas préciser" },
]
get_buildingNameChoices().then(l => buildingNameChoices.push(..._.sortBy(l, choice => _.deburr(choice.title))))

const new_etablissement = {
    etablissement_siret: { optional: true }, // optionnel car les établissements étrangers n'ont pas de SIRET, il s'agit d'un référentiel limité aux établissements français. (GLPI UP1#164031)
    etablissement_description: {},
    etablissement_labeledURI: { "optional": true },
    etablissement_postalAddress: { "optional": true },
    etablissement_telephoneNumber: { "optional": true },
    etablissement_facsimileTelephoneNumber: { "optional": true },      
};

const etablissementExterneOrNew : StepAttrOption = {
    default: 'existing',
    oneOf: [
        { const: 'existing', title: "chercher dans la liste ci-dessous", merge_patch_parent_properties: {
            etablissementExterne: { oneOf_async: search_ldap.etablissements },
            ..._.mapValues(new_etablissement, opts => ({ toUserOnly: true, ...opts })),
        } },
        { const: 'new', title: "non trouvé dans la liste", merge_patch_parent_properties: new_etablissement },
    ]
};

const _main_profile_source_to_name: Dictionary<string> = {
    'APOGEE': 'géré dans Apogée',
    'SIHAM': 'géré par la DRH dans SIHAM',
    'RESEAUPRO': 'géré par Réseau Pro',
    'comptex/iae' : 'géré par la DRH IAE',
    'comptex/OSE' : 'entrant OSE',
}

const account_status_to_name: Dictionary<string> = {
    'active': "actif",
    'noaccess': "verrouillé",
    'disabled': "désactivé",
    'deleted': "purgé",
}

export const raw_explain_main_profile = (v: v) => {

    let main_prof = _.maxBy(v.up1Profile || [], 'priority')

    if ((main_prof?.priority || 0) < 590 && !_.isEmpty(v.global_supannEtuAnneeInscription) && v.global_eduPersonPrimaryAffiliation === 'student') {
        const annees = v.global_supannEtuAnneeInscription;
        const lastAnneeInscription = annees && Math.max(...annees);

        const endDate = new Date(lastAnneeInscription + 1, 9 - 1, 1); // 201X/09/01
        const willExpireSoon = endDate < new Date();
        return { source: "APOGEE", lastAnneeInscription, willExpireSoon, willNotExpireSoon: !willExpireSoon }
    }
    if (!main_prof && v.etablissementExterne === '{AUTRE}PCU-ReseauPro' && v.global_structureParrain?.includes('DGJC')) {
        main_prof = { profilename: "{RESEAUPRO}alum", enddate: v.global_shadowExpire }
    }
    if (!main_prof && v.global_eduPersonPrimaryAffiliation === 'alum') {
        return { source: "{GRACE}student" }
    }
    const profilename = main_prof?.profilename || ''
    let willExpireSoon, willNotExpireSoon
    if (main_prof?.enddate) {
        willExpireSoon = main_prof.enddate < helpers.addDays(new Date(), 31 * 2)
        willNotExpireSoon = !willExpireSoon
    }
    let m
    const source = 
        profilename.match(/^\{HARPEGE}/) ? 'SIHAM' : 
        (m = profilename.match(/^\{COMPTEX:(.*?)\}/)) ? 'comptex/' + m[1] :
        profilename.match(/^\{RESEAUPRO}/) ? 'RESEAUPRO' :
        null;
    return { source, willExpireSoon, willNotExpireSoon }
}

const explain_main_profile = (_: any, v: v) => {
    if (!v.uid) return undefined;

    const r = raw_explain_main_profile(v)

    const formatAcademicYear = (n : number) => n ? `${n} / ${n+1}` : '';

    let description;
    if (r.source === 'APOGEE' && r.willExpireSoon) {
        description = `était étudiant en ${formatAcademicYear(r.lastAnneeInscription)}`
    } else {
        const handled_by = _main_profile_source_to_name[r.source]
        description = `
  est ${shared_conf.affiliation_labels[v.global_eduPersonPrimaryAffiliation] || 
        (v.accountStatus === 'active' ? 'un ancien compte sans affiliation' :
        'un compte ' + (account_status_to_name[v.accountStatus] || 'non activé'))}
  ${formatAcademicYear(r.lastAnneeInscription)}
  
` + (handled_by && r.willNotExpireSoon ? `<b>${handled_by}</b>` : '')
    }
    return { ...r, description }
}

export const attrs : StepAttrsOption = {
    barcode: { 
        pattern: "[0-9]{12,}|",
    },
    mifare: { 
        pattern: "[0-9A-F]{14}|", // MIFARE 7 bytes TAG
    },
    newPassword: {
        uiType: 'newPassword',
        labels: { custom_error_message: 'Veuillez choisir un mot de passe comportant au moins 8 caractères. Ce mot de passe doit contenir des lettres minuscules, des lettres majuscules et des chiffres.' },
        pattern: "(?=.*[0-9])(?=.*[A-Z])(?=.*[a-z])[ -~]{8,}", // must contain digit / uppercase / lowercase. must be printable ASCII chars
    },
    roomNumber: {
        // 2021-09 : autoriser les nouveaux numéros de bureau PMF (GLPI UP1#118479)
        pattern: "(([A-Z]\\s[0-9]+)|([0-9]+(\\s[A-Z])?))(\\sbis|\\ster)?|[ABC][\\s.][0-9]{1,2}[\\s.][0-9]{2,3}[A-Z]?",
        description: "(Exemples : 1805 ; A 406 ; 305 B ; A 406 bis ; 1506 ter ; C.4.03 ; B.8.05A)",
        allowUnchangedValue: true,
        labels: { 
            custom_error_message: "Veuiller saisir un numéro de bureau sous la forme lettre+espace+numéro ou numéro+espace+lettre (en majuscule).",
        },
    },
    floorNumber: { oneOf: [
        { const: undefined, title: "Sélectionnez un étage" },
        ... sameKeyNameChoices([ 
            "Niveau -2", "Niveau -1", "Rez-de-chaussée", "1er", 
            ... range(2, 22).map(n => `${n}e`), // "2e" .. "22e", PMF + autres
        ]),
    ] },
    roomAccess: { oneOf: [
        { const: undefined, title: "ne pas préciser" },
        ... sameKeyNameChoices([ 
            "Aile Cujas", "Aile Soufflot", "Cour d'honneur", // Pantheon ?
            ... range("A", "O").map(c => "Esc. " + c), // Pantheon ?
            ... range("A", "C").map(c => "Tour " + c), // PMF
        ])
    ] },

    eduPersonAffiliation: { oneOf: [
        { const: "teacher", title: "Enseignant" },
        { const: "researcher", title: "Chercheur" },
        { const: "staff", title: "Personnel Biatss" },
        { const: "emeritus", title: "Professeur émérite" },
        { const: "student", title: "Étudiant" },
        { const: "alum", title: "Ancien étudiant" },
    ] },

    buildingName: { oneOf_is_dynamic: true, oneOf: buildingNameChoices },

    structureParrain: { 
        title: "Service qui invite : (UFR, service, laboratoire...)",
        oneOf_async: search_ldap.structures,
    },

    etablissementExterneOrNew,

    optional_etablissementExterneOrNew: {
        default: 'existing',
        uiType: 'radio',
        oneOf: [
            { const: 'unknown', title: "inconnu"},
            ...etablissementExterneOrNew.oneOf,
        ],
    },

    mailFrom_email: { 
        optional: true, uiType: "email",
        title: "Adresse courriel expéditeur pour l'envoi de courriel à l'utilisateur",
    },
    mailFrom_text: { 
        optional: true, 
        title: "Nom de l'expéditeur pour l'envoi de courriel à l'utilisateur",
    },
    
    global_main_profile: { 
        toUser: explain_main_profile, 
        toUserOnly: true, 
        uiHidden: true,
    },

    accountStatus: { 
        title: 'Status', 
        oneOf: [ {const: "active", title: "actif"}, { const: undefined, title: "non activé"}, { const: 'deleted', title: 'supprimé'}, { const: 'disabled', title: 'désactivé'} ],
    },
};

translate.add_translations({
    fr: {}, // default is french!
    en: {
        "Type de compte": "Account kind",
        "Date de début": "Account start date",
        "Date de fin": "Account end date",
        "Fin du compte": "Account end date",
        "Date de naissance": "Date of birth",
        "Durée": "Duration",
        "Civilité": "Gender",
        "Nom d'usage": "Common name",
        "Prénom": "First name",
        "Nom de naissance": "Birth name",
        "Informations personnelles": "Personal informations",
        "Etablissement de provenance": "Establishment of origin",
        "Courriel personnel": "Personal email",
        "Adresse personnelle": "Home postal address",
        "Téléphone personnel": "Home phone number",
        "Choisir une durée": "Choose a duration",
        "ou une date": "or a date",
        "inconnu": "unknown",
        "chercher dans la liste ci-dessous": "search it below",
        "non trouvé dans la liste": "not found",
        "M.": "Man",
        "Mme": "Woman",
        "Masculin": "Male",
        "Féminin": "Female",

        "Choisir": "Choose",
        "Courriel de la personne": "Guest email",
        "Courriel professionnel": "Business email",
        "Numéro de fax": "Fax number",
        "Numéro de téléphone": "Phone number",
        "Service qui invite : (UFR, service, laboratoire...)": "Service that invites (UFR, service, labotory...)",
        "SIRET": "SIRET code",
        "Téléphone professionnel": "Business phone",

    },
})

const cardChoice: StepAttrOption = {
    default: 'print',
    uiType: 'radio',
    oneOf: [
        { const: "print", title: 'Créer une nouvelle carte' },
        { const: "enroll", title: 'Enrôler une carte existante', merge_patch_parent_properties: {
            mifare: { readOnly: false, uiHidden: false },
            barcode: { readOnly: false, uiHidden: false },
        } },
    ],
}
const cardChoice_with_existing_card: StepAttrOption = {
    default: 'unchanged',
    oneOf: [
        ...cardChoice.oneOf,
        { const: "unchanged", title: 'Pas de modification de carte' },
    ],
}
export const cardChoice_attrs: StepAttrsOption = {
    cardChoice,
    global_mifare: {
        uiHidden: true, toUserOnly: true,
        if: 'truthy',
        then: { merge_patch_parent_properties: { cardChoice: cardChoice_with_existing_card } },
    },
    // if v.cardChoice "enroll" is chosen: 
    // - value '' is prompted even if existing value
    // otherwise, client can not modify and it is hidden
    mifare: { ...attrs.mifare, optional: true, readOnly: true, uiHidden: true, toUser: _ => '' },
    barcode: { ...attrs.barcode, optional: true, readOnly: true, uiHidden: true, toUser: _ => '' },
}

export const create_temp_profile_for_disabled_account = async (uid: string, structureParrain?: string) => {
    console.log("create_temp_profile_for_disabled_account", uid)
    const v: v = { uid, profilename: '{COMPTEX}reactiv', structureParrain: structureParrain || 'IU2', enddate: addDays(new Date(), 2) }
    return await crejsonldap.call(v, { create: false })
}

export const vue_template_for_sv_history = /*html*/`
    Historique du ticket :
    <table v-if="v.sv_history" class="table table-striped"><tbody>
        <tr><th>Action</th><th>Date</th><th>Qui</th>
        <tr v-for="h in v.sv_history">
        <td>/{{h.step.id}}</td>
        <td>{{h.when.replace(/T(\\d\\d:\\d\\d).*/, ' $1')}}</td>
        <td v-for="uid in [h.who?.id?.replace(/@univ-paris1.fr/, '')]">
            <a target="blank" :href="'https://userinfo.univ-paris1.fr/#' + uid">{{uid}}</a>
        </td>
        </tr>
    </tbody></table>
    <div style="color: red" v-else>
       Erreur : il faut ajouter attrs.sv_history pour cette étape
    </div>
`
