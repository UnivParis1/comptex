import * as _ from 'lodash';
import * as actions from './actions';
import * as actions_pre from './actions_pre';
import * as helpers from '../helpers';

import { handle_attrs_cond_overrides } from './conf_cond_overrides'
import { photo_termsOfUse, smsu_termsOfUse, pager_common, supannMailPerso_common, may_warn_user_about_modified_attrs_allowing_reinit_mdp } from './conf_common'
import { StepAttrsOption_ } from './conf_needExternalModeration';

const account_identification : StepAttrsOption = {
    eduPersonAffiliation: {
        title: 'Vous êtes',
        uiType: 'radio',
        oneOf: [
            { const: "student", title: "Etudiant", merge_patch_parent_properties: { supannEtuId_or_supannCodeINE: {
                title: "Numéro étudiant ou INE",
                pattern: 'MU[0-9]{5,6}|[0-9]{7,8}|\\w{11}',
                uiOptions: { texts_are_html: true },
                labels: {
                    custom_error_message: 'Le numéro étudiant est composé de 7 ou 8 chiffres.<br>Le numéro INE est composé de 11 caractères.',
                    tooltip: "Veuillez saisir ici le numéro étudiant qui est mentionné sur votre carte étudiant ou votre numéro d'identifiant national étudiant.<p></p>Votre numéro étudiant est mentionné sur votre carte d'étudiant. Si vous avez perdu votre carte d'étudiant, veuillez vous adresser au service des inscriptions administratives pour établir une nouvelle carte",
                },
            } } },
            { const: "staff", title: "Personnel", merge_patch_parent_properties: { supannEmpId: {
                pattern: '[0-9]{3,6}',
                labels: {
                    custom_error_message: 'Le numéro agent est composé de 3 à 6 chiffres.',
                    tooltip: "Veuillez saisir ici le numéro agent qui vous a été transmis par le service des personnels",
                },
            } } },
            { const: "other", title: "Autre", merge_patch_parent_properties: { supannAliasLogin: {
                pattern: '[a-z][a-z0-9-]{1,11}',
                labels: {
                    custom_error_message: `L'identifiant est composé de 2 à 11 caractères`,
                },
            } } },
        ],
    },
    birthDay: {},
};

const channels: Dictionary<{ title: string; description: string; onchosen: string }> = {
    codeChannel: {
        title: "J'ai un code",
        description: "",
        onchosen: "<p>Vous avez choisi de passer directement à l'étape de saisie du code. Si vous ne disposez pas de code valide, veuillez reprendre la procédure et choisir un autre moyen pour recevoir votre code de confirmation.</p>",
    },
    supannMailPerso: {
        title: "Courriel",
        description: "Votre courriel alternatif est de la forme <b>{{v.supannMailPerso}}</b>",
        onchosen:  "<p>Un courrier électronique a été envoyé à l'adresse <b>{{v_pre.supannMailPerso}}</b>.</p> <p>Ce courrier fournit le code nécessaire pour réinitialiser votre mot de passe.</p><p>Un certain temps peut être nécessaire avant la réception des messages. N'oubliez pas de vérifier que l'adresse électronique ci-dessus est correcte et que le message n'est pas passé dans votre dossier de messages indésirables.</p>",
    },
    pager: {
        title: "SMS",
        description: "Votre numéro de portable est de la forme <b>{{v.pager}}</b>",
        onchosen: "<p>Un SMS vient de vous être envoyé au numero <b>{{v_pre.pager}}</b>. Ce SMS fournit le code nécessaire pour réinitialiser votre mot de passe.</p>",
    },
    email2gest: {
        title: "Assistance DSIUN",
        description: "Ne choisissez l'option <i>Assistance DSIUN</i> que si vous n'avez pas renseigné de courriel alternatif ou de numéro portable ou si ces informations sont erronées.",
        onchosen: "<p>Veuillez contacter l'assistance DSIUN (01.44.07.89.65) pour obtenir le code de réinitialisation de mot de passe</p>",
    },
    email2gestetu: {
        title: "Assistance étudiants",
        description: "Ne choisissez  l'assistance étudiants que si vous n'avez pas renseigné de courriel alternatif  ou de numéro portable ou s'ils sont erronés.",
        onchosen: "<p>Pour recevoir votre code de réactivation, veuillez contacter votre secrétariat pédagogique</p> ",
    },
};

const personalAttrs: StepAttrsOption_ = {
    jpegPhoto: { optional: true, uiType: 'photoUpload' },
    ... photo_termsOfUse,

    displayName: {},
    // needed for "displayName" validator:
    sn: { toUserOnly: true, uiHidden: true },
    birthName: { toUserOnly: true, uiHidden: true },
    givenName: { toUserOnly: true, uiHidden: true },
    altGivenName: { toUserOnly: true, uiHidden: true },

    supannMailPerso: { ...supannMailPerso_common, optional: true },
    pager: pager_common,
    ...smsu_termsOfUse,
}

const userPasswordAttrs = (activation: boolean) : StepAttrsOption_ => ({
    code: { hidden: true },
    mail: { readOnly: true, uiHidden: true }, // used in client msg labels.accepted + used in action_post mail_template
    supannAliasLogin: { readOnly: true, uiHidden: true },
    _perso: { 
        title: "Informations",
        description: 'Vous pouvez modifier ici vos informations personnelles',
        toUserOnly: true, uiType: 'tab',
        properties: personalAttrs,
    },
    _password: {
        title: "Mot de passe",
        description: activation ? 'Veuillez saisir votre mot de passe' : 'Veuillez saisir votre nouveau mot de passe',
        toUserOnly: true, uiType: 'tab',
        properties: { userPassword: {
            description: ce_n_est_pas_le_mdp_FranceConnect_warning,
        } },
    },    
})




const accountIdentification_err_msgs = {
    base: `Informations invalides, veuillez recommencer.\nSi vous pensez avoir saisi les bonnes informations, veuillez contactez `,
    contact: {
        student: `l'assistance des étudiants au 01 71 25 11 37 ou +33 1 44 07 89 45 (depuis l'étranger).`,
        '': `assistance-DSIUN@univ-paris1.fr ou le 01 44 07 89 65.`,
    },
}

const transform_supannEtuId_or_supannCodeINE = (v: v) => {
    const etu_id = helpers.get_delete(v, 'supannEtuId_or_supannCodeINE')
    if (etu_id) v[etu_id.length === 11 ? 'supannCodeINE' : 'supannEtuId'] = etu_id
}

const handle_accountIdentification_error = async (err: string, req: req, sv: sv) => { 
    if (err === 'AuthentificationException') {
        const contact_kind = sv.v.eduPersonAffiliation || req.query.eduPersonAffiliation === 'student' ? 'student' : ''
        throw accountIdentification_err_msgs.base + accountIdentification_err_msgs.contact[contact_kind]
    } else {
        throw err
    }
}

const accountIdentification = (isActivation: boolean) => actions.chain([
    actions_pre.validateAndFilterQueryParams(account_identification), // otherwise can enter a uid or a birthdate, without other mandatory params!
    actions_pre.mutateQuery(transform_supannEtuId_or_supannCodeINE),
    actions.handle_exception(
        actions_pre.esup_activ_bo_validateAccount(isActivation),
        handle_accountIdentification_error,
    )
])

const accountIdentification_post = actions.chain([
    actions.mutate_v(transform_supannEtuId_or_supannCodeINE),
    actions.handle_exception(
        actions.esup_activ_bo_minimal_validateAccount,
        handle_accountIdentification_error,
    )
])

// https://projets.univ-paris1.fr/project/291/task/3179
const activation_mail_template = `Subject: Votre compte Paris 1 Panthéon-Sorbonne a été activé

Bonjour,

<p>
Votre compte «&nbsp;{{v.supannAliasLogin}}&nbsp;» a été activé.
<br>
Si vous n'avez pas effectué cette activation, veuillez contacter l'assistance DSIUN.
</p>

{{#if v.mail}}
<p>L'adresse mail {{v.mail}} sera désormais utilisée de façon préférentielle pour communiquer avec vous.</p>
{{/}}

<p>
Bien cordialement.
<br>
Ce message a été envoyé automatiquement.
</p>`

const modified_password_mail_template = `Subject: Le mot de passe de votre compte Paris 1 Panthéon-Sorbonne a été modifié

Bonjour,

<p>
Le mot de passe de votre compte «&nbsp;{{v.supannAliasLogin}}&nbsp;» a été modifié.
<br>
Si vous n'avez pas effectué cette modification, veuillez contacter l'assistance DSIUN.
</p>

<p>
Bien cordialement.
<br>
Ce message a été envoyé automatiquement.
</p>`

// https://projets.univ-paris1.fr/project/291/task/4009
const ce_n_est_pas_le_mdp_FranceConnect_warning = 
    `Attention, ce mot de passe est celui de votre compte local Paris 1 et en aucun cas celui du compte que vous utilisez au travers de FranceConnect. 
    Il vous servira uniquement lorsque vous vous connecterez avec votre compte Paris 1 plutôt que via FranceConnect.`

const submit = (mail_template: string) : action => actions.chain([
    actions.validateMailNoLoop('supannAliasLogin'),
    actions.validatePassword,
    actions.esup_activ_bo_updatePersonalInformations,
    may_warn_user_about_modified_attrs_allowing_reinit_mdp,
    actions.esup_activ_bo_setPassword,
    actions.sendSupannMailPerso(mail_template), // if someone is hijacking an account, this information must be sent somewhere the cracker can not access (ie supannMailPerso)
])

export const initialSteps: steps = {
    activation: {
        attrs: account_identification,
        labels: {
            title: 'Activation de votre compte',
            description: 'Veuillez saisir les champs suivants qui vont vous permettre de poursuivre la procédure :',
            okButton: "Confirmer",            
        },
        action_post: accountIdentification_post, // c'est aussi fait dans nextBrowserStep action_pre, mais le faire ici permet de conserver les informations saisies par l'utilisateur
        nextBrowserStep: 'activation_',
    },
    reinit_mdp: {
        attrs: account_identification,
        labels: {
            title: 'Réinitialisation de votre mot de passe',
            description: 'Veuillez saisir les champs suivants qui vont vous permettre de poursuivre la procédure :',
            okButton: "Confirmer",            
        },
        action_post: accountIdentification_post, // c'est aussi fait dans nextBrowserStep action_pre, mais le faire ici permet de conserver les informations saisies par l'utilisateur
        nextBrowserStep: 'reinit_mdp_channel',
    },
    change_mdp: {
        action_pre: actions_pre.esup_activ_bo_authentificateUserWithCas,
        attrs: {
            supannAliasLogin: { readOnly: true },
            userPassword: { uiType: 'password', 
                description: ce_n_est_pas_le_mdp_FranceConnect_warning,
            },
        },
        labels: {
            title: 'Changement de mot de passe',
            description: "Vous devez d'abord vous saisir le mot de passe actuel :",
            okButton: "Confirmer",            
        },
        nextBrowserStep: 'change_mdp_',
    },

    activation_: {
        action_pre: actions.chain([
            accountIdentification(true),
            actions_pre.esupUserApps_add_canAccess("ms-office"),
        ]),
        ...handle_attrs_cond_overrides({
            ...userPasswordAttrs(true),
            charter: {},
        }),
        labels: {
            title: 'Activation de votre compte',
            okButton: "Activation",
            accepted: `<h4>Activation de votre compte réussie</h4>                
                <p></p>
                Votre identifiant unique est «&nbsp;<span class="v_supannAliasLogin">{{v.supannAliasLogin}}</span>&nbsp;»<span v-if="v.mail"> et votre courriel est <span class="v_mail">{{v.mail}}</span></span> .
                <p></p>           
                Accès au portail <a href='https://ent.univ-paris1.fr/accueil'>Environnement Numérique de Travail</a>.`,
        },
        action_post: submit(activation_mail_template),
    },

    reinit_mdp_channel: {
        action_pre: accountIdentification(false), // get ldap attrs (including supannAliasLogin) + "possibleChannels"
        attrs: {
            supannAliasLogin: { readOnly: true, uiHidden: true },
            possibleChannels: { readOnly: true, uiHidden: true },
            channel: { uiType: 'radio' },
            // attrs needed for labels.description (this step and nextBrowserStep)
            // NB: value is anonymized by actions.anonymize_personal_info
            supannMailPerso: { readOnly: true, uiHidden: true, toUser: helpers.anonymize_email }, 
            pager: { readOnly: true, uiHidden: true, toUser: helpers.anonymize_phoneNumber }, 
        },
        attrs_override: async (_req, { v }) => ({ // NB: param "v" is server-side "v", so it contains all attrs returned by "action_pre" 
            channel: { 
                oneOf: (v['possibleChannels'] as string[]).map((key) => ({ ...channels[key], const: key })),
            },
        }),
        labels: {
            description:
               _.map(channels, (channel, id) => `<div v-if="v.possibleChannels.includes('${id}')">${channel.description}</div>`).join("\n") + 
               `<p/>Veuillez choisir le mode d'envoi du code qui vous permettra de réinitialiser votre mot de passe : `,
            okButton: 'Confirmer',
        },
        action_post: actions.esup_activ_bo_sendCode,
        nextBrowserStep: 'reinit_mdp_code',
    },
    reinit_mdp_code: {
        labels: { 
            description: 
               _.map(channels, (channel, id) => `<div v-if="v_pre.channel === '${id}'">${channel.onchosen}</div>`).join("\n") + 
              `<p/>Veuillez entrer le code de validation qui vous a été fourni :`,
            okButton: 'Confirmer',
        },
        attrs: { 
            supannAliasLogin: {}, 
            code: { 
                title: "Code de validation",
                minlength: 6, maxlength: 6, allowedChars: "[0-9]",
            } },
        nextBrowserStep: 'reinit_mdp_',
    },
    reinit_mdp_: {
        action_pre: actions.chain([
            actions_pre.esup_activ_bo_validateCode,
            actions_pre.esup_activ_bo_validateAccount(false), // get ldap attrs (using req.query.supannAliasLogin)
            actions_pre.esupUserApps_add_canAccess("ms-office"),
            async (req, { v }) => ({ v: { code: req.query.code, ...v } }), // add code
        ]),
        ...handle_attrs_cond_overrides(userPasswordAttrs(false)),
        labels: { 
            okButton: 'Confirmer',
            title: 'Réinitialisation de votre mot de passe',
            accepted: `<h4>Réinitialisation de votre mot de passe réussi</h4>                
                Votre mot de passe a bien été modifié.
                <p></p>
                Pour rappel,
                votre identifiant unique est «&nbsp;<span class="v_supannAliasLogin">{{v.supannAliasLogin}}</span>&nbsp;»<span v-if="v.mail"> et votre courriel est <span class="v_mail">{{v.mail}}</span></span> .
                <p></p>           
                Accès au portail <a href='https://ent.univ-paris1.fr/accueil'>Environnement Numérique de Travail</a>.`,
        },
        action_post: submit(modified_password_mail_template),
    },

    change_mdp_: {
        action_pre: actions.chain([
            actions_pre.esup_activ_bo_authentificateUser('useSessionUser'),
            actions_pre.esupUserApps_add_canAccess("ms-office"),
        ]),
        ...handle_attrs_cond_overrides(userPasswordAttrs(false)),
        labels: {
            okButton: 'Confirmer',
            accepted: "<h4>Votre mot de passe et vos informations ont été modifiés.</h4>",
        },
        action_post: submit(modified_password_mail_template),
    },

}