import * as _ from 'lodash';
import shared_conf from '../conf';

const remove_accents = _.deburr;

const remove_special_chars = (s) => (
    s.replace(/[',.-]/g, '')
)

const compute_allowed = (allowed_elts: string[]) => {
    let allowed: {} = {};
    let prev;
    for (const s of allowed_elts) {
        for (const word of s.split(' ')) {
            allowed[word] = true;
            if (prev) allowed[prev + word] = true; // to match "landier-edmond" with sn:edmond up1BirthName:landier
            prev = word;
        }
    }
    return allowed
}

const get_and_remove = (o: {}, key: string) => {
    const val = o[key];
    delete o[key];
    return val;
}

const remove_allowed_words = (words: string[], minRemaining: number, allowed: {}) => {
    let removed = false;
    //console.log(removed, minRemaining, words, allowed);
    while (words.length > minRemaining) {
        if (words.length > 1 + minRemaining && get_and_remove(allowed, words[0] + words[1])) { // to match "ben adam" with givenName:ben-adam or benadam
            words.shift();
            words.shift();
        } else if (get_and_remove(allowed, words[0])) {
            words.shift();
        } else {
            break;
        }
        removed = true;
    }
    //console.log(removed, minRemaining, words);
    if (!removed || !minRemaining && words.length) {
        const allowed_ = Object.keys(allowed)
        return `« ${words[0]} » n'est pas autorisé. ${allowed_.length > 1 ? 'Autorisés' : 'Autorisé'} : ${allowed_.join(', ')}`;
    } else {
        return undefined;
    }
}

const _merge_at = (v: {}, attrs: string[]) => _.compact(_.merge(_.at(v, attrs)))


export default (displayName: string, v_orig: {}) => {
    const prepare_for_compare = val => remove_special_chars(remove_accents(val)).toLowerCase()    
    const get = (fields): string[] => _merge_at(v_orig, fields).map(prepare_for_compare);

    let toCheck = prepare_for_compare(displayName).split(' ');
    let sns = get(shared_conf.sns);
    let givenNames = get(shared_conf.givenNames);

    const err =
      toCheck.length <= 1 && "Le nom annuaire doit comprendre le prénom et le nom" ||
      remove_allowed_words(toCheck, 1, compute_allowed(givenNames)) ||
      remove_allowed_words(toCheck, 0, compute_allowed(sns));
    return err;
}
