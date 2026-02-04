import * as express from 'express'
import * as utils from './utils.ts'

// from https://github.com/opentable/accept-language-parser
const regex = /((([a-zA-Z]+(-[a-zA-Z0-9]+){0,2})|\*)(;q=[0-1](\.[0-9]+)?)?)*/g;
const parse_accept_language = (al: string) => (
    (al || "").match(regex).map(function(m){
        if (!m) {
            return undefined;
        }
        const bits = m.split(';');
        const ietf = bits[0].split('-');

        return {
            code: ietf[0].toLowerCase(),
            quality: bits[1] ? parseFloat(bits[1].split('=')[1]) : 1.0
        }
    }).filter(r => r).sort((a, b) => b.quality - a.quality)
)


let _all_translations: Dictionary<Dictionary<string>> = {}

function pick(user_languages: {code: string}[]) {
    for (const user_language of user_languages) {
        if (_all_translations[user_language.code]) return user_language.code
    }
    return undefined
}

export const add_translations = (translations : Dictionary<Dictionary<string>>) => {
    //console.log('add_translations', _all_translations, translations)
    _all_translations = utils.deep_extend(_all_translations, translations)
}

export const express_handler: express.RequestHandler = (req, _res, next) => {
    const preferred_lang = pick(parse_accept_language(req.headers["accept-language"] as string))
    //console.log("preferred_lang", preferred_lang, "for", parse_accept_language(req.headers["accept-language"] as string));
    const translations_ = _all_translations[preferred_lang || 'en'];
    (req as req).translate = (msg: string, opts) => (
        //translations_?.[msg] || console.log("missing translation", msg),
        translations_?.[msg] || (opts?.null_if_unknown ? null : msg)
    )
    next()
}
