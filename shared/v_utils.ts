import { find, forIn } from 'lodash-es';
import { formatDate } from './helpers.ts';

export const find_choice = (oneOf: StepAttrOptionChoicesT<StepAttrOptionM<unknown>>[], val: any) => (
    // tslint:disable-next-line:triple-equals
    find(oneOf, choice => choice.const == val) // allow equality if val is number and choice.const is string
)

export function filterAttrs(attrs: StepAttrsOptionM<unknown>, oneOfTraversal: 'always' | 'never', f: (opts: StepAttrOptionM<unknown>, key: string, attrs: StepAttrsOptionM<unknown>) => boolean): StepAttrsOptionM<unknown> {
    function rec_mpp<T, U extends MppT<StepAttrOptionM<T>>>(mpp: U): U {
        return mpp.merge_patch_parent_properties ? { ...mpp, merge_patch_parent_properties: rec(mpp.merge_patch_parent_properties) } : mpp
    }
    function rec<T>(attrs: StepAttrsOptionM<T>) {
        let r: StepAttrsOptionM<T> = {};  
        forIn(attrs, (opts, key) => {
            if (!f(opts, key, attrs)) return;
            r[key] = opts = { ...opts };
            if (opts.properties) opts.properties = rec(opts.properties);
            if (oneOfTraversal === 'always') {
                if (opts.then) {
                    opts.then = rec_mpp(opts.then)
                }
                if (opts.oneOf) {
                    opts.oneOf = opts.oneOf.map(rec_mpp);
                }
            }
        });
        return r;
    }
    return rec(attrs);
}

export function formatValue(val: any, opts : StepAttrOptionM<unknown> = {}): string | undefined {
    if (val instanceof Array) {
        const l = val.map(val_ => formatValue(val_, opts))
        return l.join(', ')
    }
    if (opts.oneOf) {
       return find_choice(opts.oneOf, val)?.title
    }
    if (opts.uiType === 'checkbox') {
        return val ? 'coché' : 'décoché'
    }
    if (val instanceof Date) {
        return formatDate(val, 'dd/MM/yyyy');
    } else {
        return "" + (val || '');
    }
}
