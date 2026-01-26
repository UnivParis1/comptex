import { mapAttrs } from '../step_attrs_option.ts';
import * as utils from '../utils.ts'
import shared_conf from '../../shared/conf.ts';
import { prepare_for_compare } from '../../shared/validators/displayName.ts';
import { uniqBy } from 'lodash-es';

export const forceAttrs = (attrs: StepAttrsOption, optsToForce: StepAttrOption) => (
    mapAttrs(attrs, (opts) => ({ ...opts, ...optsToForce }))
)

// avec des libellés vides pour les valeurs non renseignées plutôt que d'afficher "ne pas préciser", "Sélectionnez un étage"...
export const remove_oneOf_empty_val = (attrs: StepAttrsOption) => (
    mapAttrs(attrs, (opts) => (
        opts.oneOf ? { ...opts, oneOf: opts.oneOf.filter(one => one.const) } : opts
    ))
)

export const to_oneOf_async = (choices: StepAttrOptionChoices[], opts?: { fallback_choice?: StepAttrOptionChoices }) => {    
    const choices_: [string, StepAttrOptionChoices][] = choices.map(choice => [
        prepare_for_compare(choice.title), choice
    ])
    return async (token: string, sizeLimit: number) => {
        const token_ = prepare_for_compare(token)

        let r = choices.filter(choice => choice.const.toLowerCase().includes(token.toLowerCase()))

        const add_choices = (r2: StepAttrOptionChoices[]) => {
            r = uniqBy([...r, ...r2], 'const')
        }
        if (r.length < sizeLimit) {
            add_choices(choices_.filter(both => both[0].startsWith(token_)).map(both => both[1]))
        }
        if (r.length < sizeLimit) {
            add_choices(choices_.filter(both => both[0].includes(token_)).map(both => both[1]))
        }
        if (r.length < sizeLimit && opts?.fallback_choice) {
            add_choices([ opts.fallback_choice ])
        }
        return r
    }
}

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
