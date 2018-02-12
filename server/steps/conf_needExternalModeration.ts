import * as _ from 'lodash-es';
import * as actions from './actions.ts';
import * as db from '../db.ts';
import * as step_attrs_option from '../step_attrs_option.ts';
import * as v_display from '../v_display.ts';
import * as attrs_override from './attrs_override.ts'

export type MoreAttrOption = { 
    needExternalModeration?: boolean;
} & attrs_override.MoreAttrOption_cond_overrides

export type StepAttrOption_ = StepAttrOptionT<MoreAttrOption>
export type StepAttrsOption_ = Dictionary<StepAttrOption_>

export const _add_opts_for_needExternalModeration = (attrs : StepAttrsOption_) => (
    step_attrs_option.mapAttrs(attrs, (opts) => {
        if (opts.needExternalModeration) {
            opts.labels = { ...opts.labels, warning: `Les modifications de ce champ ne seront effectives qu'après validation par les services compétents. Des pièces justificatives peuvent vous être demandées.` } 
            opts.cond_overrides = { not_is_SIHAM: { readOnly: true, labels: null } };
        }
        return opts
    })
)

const mail_notif_RH =
`Subject: Demande de modification des infos - {{v.displayName}}

Bonjour,
<br/><br/>
{{#if moderator.mail}}
<a href="https://annuaire.univ-paris1.fr/ent/{{moderator.mail}}">{{moderator.mail}}</a> veut modifier les informations de <b>{{v.displayName}} ({{v.supannAliasLogin}})</b> .
{{^}}
L'utilisateur <b>{{v.displayName}} ({{v.supannAliasLogin}})</b> veut modifier ses informations.
{{/}}
<br/><b>Numéro agent :</b> {{v.supannEmpId}}
<br/><b>Corps :</b> {{v.employeeType}}
 <p></p>
{{{v_display.various.diff}}}
`;

const warn_RH_moderation =
`
{{#each v.various.modified_RH_attrs}}
<p>Ces modifications ne seront effectives qu'après la validation de la DRH :</p>
<span class="v-diff-RH">
  {{{.}}}
</span>
{{/}}

{{#each v.various.modified_other_attrs}}
<p>Ces modifications seront effectives immédiatement :</p>
<span class="v-diff-other">
  {{{.}}}
</span>
{{/}}
`

export const handle_confirmation_and_needExternalModeration : action = async (req, sv) => {
    const flat_attrs: StepAttrsOption_ = step_attrs_option.flatten_attrs(sv.attrs, sv.v)
    const needExternalModerationAttrs = Object.keys(_.pickBy(flat_attrs, (opts, _) => opts['needExternalModeration']))
    const diff_RH = _.pick(sv.v.various.diff, needExternalModerationAttrs)
    const diff_other = _.omit(sv.v.various.diff, needExternalModerationAttrs)

    sv.v.various.modified_RH_attrs = await v_display.format_various_diff(diff_RH, flat_attrs)
    sv.v.various.modified_other_attrs = await v_display.format_various_diff(diff_other, flat_attrs)

    await actions.ask_confirmation('warned_about_externalModeration', warn_RH_moderation, "Vous souhaitez modifier vos données")(req, sv)

    const response : response = {}
    if (!_.isEmpty(diff_RH)) {
        let sv_external = _.cloneDeep(sv)
        sv_external.v.various.diff = diff_RH
        // GLPI UP1#119068
        const to = sv.v.global_eduPersonPrimaryAffiliation === 'staff' ? (
            sv.v.global_profilename?.includes('{HARPEGE}carriere') ? 'biatss-titulaires@univ-paris1.fr' : 
            sv.v.global_profilename?.includes('{HARPEGE}contrat') ? 'biatss-nontitulaires@univ-paris1.fr' : 
            sv.v.global_profilename?.includes('{HARPEGE}heberge') ? 'direval@univ-paris1.fr' : 
            'adjbiatss@univ-paris1.fr' // ne devrait pas arriver (?)
        ) : 'racpens@univ-paris1.fr'
        await actions.sendMail(mail_notif_RH, { to })(req, sv_external)

        // save information for checks
        db.collection("needExternalModeration").insertOne({ 
            diff: diff_RH,
            user: _.pick(sv.v, ['displayName', 'supannAliasLogin', 'supannEmpId', 'employeeType']),
            timestamp: new Date(),
        } )

        if (to !== 'direval@univ-paris1.fr') {
            response.labels = { added : `
                <h4>Des modifications ont été transmises à la DRH.</h4>
                Ces modifications seront visibles dès qu'ils auront effectué le changement sur votre compte.
                <p></p>
                Si vous ne voyez aucune modification après une semaine, nous vous conseillons de contacter directement votre gestionnaire par téléphone (<a href="https://intranet.pantheonsorbonne.fr/ent/intranet2/drh">intranet &gt; rubrique DRH</a>)
            ` }
        }
    }
    let v = _.omit(sv.v, [ 'global_profilename', ...needExternalModerationAttrs ]) as v;
    console.log("remaining v", v);
    return { v, response };
}

