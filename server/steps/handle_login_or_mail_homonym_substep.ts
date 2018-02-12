import * as _ from 'lodash-es';
import * as actions from './actions.ts';
import * as actions_pre from './actions_pre.ts';
import * as utils from '../utils.ts';
import * as helpers from '../helpers.ts';
import * as conf_up1 from '../conf_up1.ts';
import * as ldap from '../ldap.ts';
import * as search_ldap from '../search_ldap.ts';
import * as step_attrs_option from '../step_attrs_option.ts';
import { forceAttrs } from './attrs.ts';
import { sv_to_url } from '../sv.ts';
import conf from '../conf.ts';

const validate_existing_up1_mail_msg = `Subject: Validation de votre compte Paris 1 Panthéon-Sorbonne

Bonjour,
<p></p>
Merci de confirmer que vous êtes bien le propriétaire de ce compte en cliquant sur le lien suivant : <a href="{{{sv_url}}}?substep={{v.choice}}&otp={{v.otp}}">je valide mon adresse e-mail</a>.
<p></p>
Cordialement,
<br>
La DSIUN`

// exported for Cujas migration step
export const homo_choices = (homonymes: v[]): StepAttrsOption => ({
    choice: {
        uiType: 'radio',
        oneOf: [
            ...(homonymes || []).map((homo, i) => (
                homo.supannMailPerso && { const: "mail" + i, title: "Prouver que je possède l'adresse " + helpers.anonymize_email(homo.supannMailPerso) }
            )).filter(choice => choice),
            { const: "login", title: "Me connecter avec mon compte et mon mot de passe" },
            { const: "ignore", title: 
            (homonymes || []).some(v => v.supannMailPerso) ? "Ce ne sont pas mes mails et je n'ai pas mon mot de passe" : "Je n'ai pas mon mot de passe" },
        ],
    },
})

export const getShibUserLdapAttrs_with_homonymes_restriction: firstAction_pre = async (req, _sv) => {
    const v = await actions_pre.getShibUserLdapAttrs(req, _sv)

    if (!await ldap.exist(conf.ldap.base_people, ldap.filters.and([
        search_ldap.currentUser_to_filter(req.user), 
        conf.ldap.people.homonymes_restriction,
    ]))) {
        throw { code: "Bad Request", message: `Ce compte étudiant n'est pas autorisé`, force_history_back: true }
    }
    return v
}

export const non_deleted_homonyms = async (v: v) => (
    (await search_ldap.homonymes(v)).filter(v => v.accountStatus !== 'deleted')
)

const add_homo = async (v: v) => {
    const homonymes = await non_deleted_homonyms(v)
    // NB: there is no real reason to check the presence of supannMailPerso. To remove?
    v.homonymes = homonymes.filter(v => v.supannMailPerso || ['active', 'disabled'].includes(v.accountStatus))
    console.log("homonymes", v.homonymes)
    return v.homonymes.length > 0
}

// exported for Cujas migration step
export const may_create_temp_profiles_for_disabled_accounts = async (homonymes: v[]) => {
    for (const homo of homonymes) {
        console.log('may_create_temp_profiles_for_disabled_accounts', homo.uid, homo.accountStatus)

        if (homo.accountStatus === 'disabled') {
            await conf_up1.create_temp_profile_for_disabled_account(homo.uid)
        }
    }
}

const homo_choice_to_v_ldap = async (req: req, v: v, choice: string) => {
    const v_ldap = choice === 'login' ? 
        await getShibUserLdapAttrs_with_homonymes_restriction(req, {v}) :
        v.homonymes[choice.match(/^mail(.*)/)?.[1]]
    if (!v_ldap) throw "invalid choice " + choice
    return v_ldap
}

// exported for Cujas migration step
export const homo_substep_in_query_to_v_ldap = async (req: req, v: v) => {
    if (!req.query.substep) throw "internal error"
    if (req.query.substep !== 'login') {
        try {
            await actions_pre.check_v_otp(req, {v})
        } catch (e) {
            throw `Le lien reçu par courriel n'est plus valide (peut-être avez vous depuis choisi une autre méthode d'authentification ?)`
        }
    }
    return await homo_choice_to_v_ldap(req, v, req.query.substep)
}

// exported for Cujas migration step
export const send_validation_up1_mail = async (req: req, sv: sva, choice: string) => {
    const v_ldap = await homo_choice_to_v_ldap(req, sv.v, choice)
    if (!v_ldap) throw "invalid choice " + choice
    const to = v_ldap.supannMailPerso
    sv.v.otp = utils.random_string()
    await actions.sendMail(validate_existing_up1_mail_msg, { to })(req, sv)
}


const forceAttrsIf = (attrs: StepAttrsOption, attrsToForce: StepAttrsOption, if_: (attr: string) => boolean) => (
    step_attrs_option.mapAttrs(attrs, (opts, attrName) => (if_(attrName) ? { ...opts, ...attrsToForce } : opts))
)

const mail = `Un message de validation de compte vous a été envoyé à l’adresse e-mail fournie. Merci de consulter ce message et de cliquer sur le lien de confirmation d'adresse e-mail.
            <p></p>
            Si ce courriel n’apparaît pas dans votre boîte de réception, nous vous suggérons de consulter le dossier « Courrier indésirable ». Il arrive parfois que les services de messagerie en ligne classe les messages générés automatiquement dans un dossier spécifique.` 

export default ({ labels, attrs, action_pre, action_post, next, ...step_other }: Pick<step, "labels"|"attrs"|"action_pre_before_save"|"action_pre"|"action_post"|"action_before_purge"> & { next?: string }): step => ({
    ..._.pick(step_other, "action_pre_before_save", "action_before_purge"),
    labels: {
        ...labels,
        description: (labels.description ? `<div class="pre_description">${labels.description}</div>` : '') + `
        <div class="login_choices" v-if="!v_pre.substep && !v_pre.franceconnect">
          <div class="login_choices_up1">
            <h4>J'ai un compte Paris 1 Panthéon-Sorbonne</h4>
            <router-link :to="addQueryParams({ substep: 'login' })">Je me connecte</router-link>
          </div>
          
          <div class="login_choices_educ_recherche">
            <h4>J'ai un compte dans un établissement de l'enseignement supérieur</h4>
            <router-link :to="addQueryParams({ substep: 'login', idp: 'extern' })">Je me connecte</router-link>
          </div>
          
          <div class="login_choices_franceconnect">
            <h4>J'ai un compte FranceConnect</h4>
            <router-link :to="addQueryParams({ franceconnect: 1 })"><img src="https://partenaires.franceconnect.gouv.fr/images/franceconnect-bouton.svg" alt="S'identifier avec FranceConnect"></router-link>
          </div>

          <h4>Je n'ai pas de compte existant</h4>
          Je remplis le formulaire ci-dessous
        </div>
        <div v-if="v_pre.substep === 'homonym'">
           Il semble que vous ayez déjà un compte Paris 1 Panthéon-Sorbonne :
        </div>
        `,
    },
    action_pre: async (req, sv) => {
        if (action_pre) {
            sv.v = await action_pre(req, sv)
        }
        const choice = req.query.substep
        if (!choice) {
            if (req.query.franceconnect === '1') {
                return await actions_pre.getOidcAttrs(req, sv)
            } else {
                return sv.v
            }
        } else if (choice === 'homonym') {
            return sv.v
        } else {
            const v_ldap = await homo_substep_in_query_to_v_ldap(req, sv.v)
            sv.v.homonymes ||= await non_deleted_homonyms(sv.v)
            if (!sv.v.homonymes.some((v: v) => v.uid === v_ldap.uid)) {
                console.log("ignoring values from user since the user logged in with a different account")
                return v_ldap
            } else {
                delete sv.v.homonymes // no more needed
                return { ...v_ldap, ...sv.v } // NB: keep values from user
            }
        } 
    },
    attrs: {
        supannFCSub: { hidden: true }, // keep it
        uid: { readOnly: true, uiHidden: true, optional: true }, // propagate to "next" step
        homonymes: { hidden: true, optional: true }, // propagate to action_post
        ...forceAttrsIf(attrs, { readOnly_ifNotEmpty: true }, 
            attrName => ['supannCivilite', 'givenName', 'sn', 'birthName', 'birthDay'].includes(attrName)), 
    },
    attrs_override: async (_req, sv) => (
        sv.v.homonymes?.length ? {
            supannFCSub: { hidden: true }, // keep it
            ...forceAttrs(attrs, { hidden: true }),
            ...homo_choices(sv.v.homonymes)
        } : ['active', 'disabled'].includes(sv.v.accountStatus) ? {
            userPassword: { hidden: true }, // do no ask (or ignore) password if account already has one
        } : {
        }
    ),
    action_post: async (req, sv) => {
        if (utils.email_has_one_of_our_mail_domains(sv.v.supannMailPerso)) {
            throw `Les addresses de courriel Paris 1 ne sont pas acceptées.\n\nNous vous invitons à cliquer sur « Je me connecte » au début du formulaire.`
        }
        await actions.validateAccount(req, sv)

        let v = sv.v
        const choice = v.choice
        let response: Partial<r>
        if (choice && choice.match(/^mail/)) {
            await send_validation_up1_mail(req, sv, choice)   
            // advance to same step => v is saved in db
            response = { step: sv.step, labels: { added: mail } }
        } else if (choice === 'login') {
            await may_create_temp_profiles_for_disabled_accounts(v.homonymes)
            response = { step: sv.step, nextBrowserStep: { url: sv_to_url(sv) + "?substep=login" } }
        } else if (choice === 'ignore' || v.uid || !await add_homo(v)) {
            if (action_post) {
                ({ v, response } = await action_post(req, sv))
            }
            if (next) {
                response ||= {}
                response.step = next
            }
        } else {
            response = { step: sv.step, nextBrowserStep: { url: sv_to_url(sv) + "?substep=homonym" } }
        }
        console.log(">>>", response)
        return { v, response }
    },
})

