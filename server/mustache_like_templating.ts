import * as _ from 'lodash';

interface parsed_template {
    tags: {
        before: string
        openTag: "{{" | "{{{"
        op: string // # ^ / #if
        expr: string
    }[]
    after: string
}

export function parse(template: string): parsed_template {
    let openTagRe = /({{{?)\s*/mg
    let end2TagRe = /\s*}}/mg
    let end3TagRe = /\s*}}}/mg
    let spacesAfterRe = /\s*$\n?/mg;

    let tags = []
    let lastIndex = 0
    while (1) {
        openTagRe.lastIndex = lastIndex
        let open_m = openTagRe.exec(template)
        if (!open_m) break;
        const openTag = open_m[1] as '{{' | '{{{'
        let endTagRe = openTag === '{{' ? end2TagRe : end3TagRe
        const afterOpenIndex = open_m.index + open_m[0].length
        
        endTagRe.lastIndex = afterOpenIndex;
        let end_m = endTagRe.exec(template);
        if (!end_m) throw Error("no closing for `" + openTag + "` in `" + template.substring(afterOpenIndex) + "`")

        let afterCloseIndex = end_m.index + end_m[0].length
        let before = template.substring(lastIndex, open_m.index)
        const [, op, , , expr] = template.substring(afterOpenIndex, end_m.index).match(/^([/#^]((if|with|each)\s+)?)?(.*)/)

        if (op) {
            // trim spaces before + trim spaces+newline after 
            spacesAfterRe.lastIndex = afterCloseIndex
            const spaces_m = spacesAfterRe.exec(template)
            if (spaces_m) {
                const spacesBefore_m = before.match(/(^|\n)[ \t]*$/)
                if (spacesBefore_m) {
                    before = before.substring(0, spacesBefore_m.index + spacesBefore_m[1].length)
                    afterCloseIndex += spaces_m[0].length
                }
            }
        }
        lastIndex = afterCloseIndex
        tags.push({ before, openTag, op: op && op.trimRight(), expr })
    }
    return { tags, after: template.substring(lastIndex) }
}

interface context {
    val: any
    pos: number
    array?: any[]
    array_pos?: number
}

function rec_get(contexts: context[], expr: string) {
    let val
    for (const context of contexts) {
        val = _.get(context.val, expr)
        if (val || _.has(context.val, expr)) break
    }
    return val
}

export async function async_render_(parsed: parsed_template, params: any, escape: (val: string) => string = _.escape) {
    let r = ""
    let current: context = { val: params, pos: 0 } 
    let contexts = [ current ]
    let pos = 0;
    while (true) {
        const one = parsed.tags[pos]
        if (!one) break

        if (current.val) {
            r += one.before
        }

        // evaluate expression, which can be things like: ".", "v.xxx", "v === 'foo'"
        let [,expr, cond, , cond_value] = one.expr.match(/(.*) (===|!==) (['"])(.*)\3/) || [ '', one.expr ]
        const expr_val = expr && await (expr === '.' ? current.val : rec_get(contexts, expr))
        let val = expr_val
        if (cond) {
            val = expr_val === cond_value
            if (cond === '!==') val = !val
        } else {
            if (expr.match(/[!=]=/)) throw "invalid expression " + expr
        }

        if (one.op === '/') {
            if (current.array && current.array_pos+1 < current.array.length) {
                // go back to loop start with next elt
                pos = current.pos
                current.val = current.array[++current.array_pos]
            } else {
                contexts.shift()
                current = contexts[0]
                if (!current) throw Error("{{/}} but no previous {{#}}")
            }
        } else if (one.op === '^') {
            if (one.expr) {
                // mustache "inverted section"
                current = { pos, val: !val }
                contexts.unshift(current)
            } else {
                // the "else" part of if-then-else expression
                current.val = current.val ? false : contexts[1].val
            }
        } else if (one.op === '#if') {
            // NB: "#if" does not introduce a new context, which is simpler than mustache "section" which has a complex recursive get on scopes (and potential name collisions)
            current = { pos, val: val ? current.val : false }
            contexts.unshift(current)
        } else if (one.op === '#' || one.op === '#each' || one.op === '#with') {
            if (Array.isArray(val)) {
                current = { pos, val: val[0], array: val, array_pos: 0 }
            } else {
                current = { pos, val }
            }
            contexts.unshift(current)
        } else {
            const val_s = val ? "" + val /* stringify it */ : ''
            if (current.val) r += one.openTag === '{{' ? escape(val_s) : val_s
        }
        pos++
    }
    if (contexts.length > 1) {
        throw Error("missing {{/}} for {{#" + parsed.tags[contexts[0].pos].expr + "}}")
    }
    return r + parsed.after
}

export const async_render = (template: string, params: any, escape: (val: string) => string = _.escape) => (
    async_render_(parse(template), params, escape)
)