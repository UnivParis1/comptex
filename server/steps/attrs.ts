import { mapAttrs } from '../step_attrs_option';
import * as utils from '../utils'
import shared_conf from '../../shared/conf';

export const forceAttrs = (attrs: StepAttrsOption, optsToForce: StepAttrOption) => (
    mapAttrs(attrs, (opts) => ({ ...opts, ...optsToForce }))
)

// avec des libellés vides pour les valeurs non renseignées plutôt que d'afficher "ne pas préciser", "Sélectionnez un étage"...
export const remove_oneOf_empty_val = (attrs: StepAttrsOption) => (
    mapAttrs(attrs, (opts) => (
        opts.oneOf ? { ...opts, oneOf: opts.oneOf.filter(one => one.const) } : opts
    ))
)

// @ts-expect-error
export const merge_mpp : <T extends Mpp<StepAttrOption>>(mpp: Mpp<StepAttrOption>, choice: T) => T = utils.deep_extend_concat


export const attrsHelpingDiagnoseHomonymes = (
    { 
        global_main_profile: { 
            toUser(_: any, v: v) {
                return v.uid && { description: ` est ${shared_conf.affiliation_labels[v.global_eduPersonPrimaryAffiliation] || 'un ancien compte sans affiliation'}` }
            },
            toUserOnly: true, 
            uiHidden: true,
        },
    }
);

export const description_only_entry = (description: string) => ({
    description,
    toUserOnly: true, uiOptions: { 
        title_hidden: true, /* l'afficher plus près du champ précédent */
        readOnly__avoid_disabled_input: true, /* forcer <span> */
    },
    uiHidden: false, /* forcer l'affichage */
})
