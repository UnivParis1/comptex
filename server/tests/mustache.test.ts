import { assert } from './test_utils';
import * as mustache from '../mustache_like_templating';
import v_display from '../v_display';
import { setTimeoutPromise } from '../helpers';

describe('Mustache', () => {
    it("should handle various", async () => {
        const tests = {
            "AAA{{bbb}}CCC": "AAABBBCCC",
            "AAA{{bbb}}CCC{{ddd}}EEE": "AAABBBCCCDDDEEE",
            "{{bbb}}{{ddd}}": "BBBDDD",
            "AAA\n{{bbb}}\nCCC": "AAA\nBBB\nCCC",
            "AAA\n {{bbb}}\nCCC": "AAA\n BBB\nCCC",
            "AAA\n{{bbb}} \nCCC": "AAA\nBBB \nCCC",
        
            "{{html}}": "&lt;img&gt;",
            "{{{html}}}": "<img>",
        
            "{{aaa}}": "",
            "{{{aaa}}}": "",
            "{{#aaa}}AAA{{/aaa}}": "",
            "{{#aaa}}{{bbb}}{{/aaa}}": "",
            "{{#bbb}}BBB{{/bbb}}": "BBB",
            "{{^aaa}}notAAA{{/aaa}}": "notAAA",
            "{{^aaa}}{{bbb}}{{/aaa}}": "BBB",
            "{{^bbb}}BBB{{/bbb}}": "",
            "{{^bbb}}{{bbb}}{{/bbb}}": "",
            "AAA\n {{#bbb}} CCC{{/bbb}}": "AAA\n CCC",
            "AAA {{#bbb}}\nCCC{{/bbb}}": "AAA \nCCC",
        
            "{{#array}}{{.}}{{/array}}": "123",
            "{{#array}}<{{.}}>{{/array}}": "<1><2><3>",
            " {{#array}}\n {{.}}\n {{/array}}": " 1\n 2\n 3\n",

            "{{#array_objs}}\n {{{a}}}\n {{{b}}}\n{{/array_objs}}\n": " A\n B\n",

            // beware, each "#xxx" creates in a new context
            // {{xxx}} does recursive lookup in those contexts
            "{{#o}}{{foo}}{{/o}}": "FOO",
            "{{#o}}{{o.foo}}{{/o}}": "FOO",
            "{{#o.foo}}{{.}}{{/o.foo}}": "FOO",
            "{{#o.foo}}{{o.foo}}{{/o.foo}}": "FOO",
            "{{#o}}{{o}}{{/o}}": "OO",
            "{{#o}}{{o.o}}{{/o}}": "OO",

            "{{o}}": "[object Object]",
            "{{array}}": "1,2,3",
        
            "{{#bbb}}BBB": "Error: missing {{/}} for {{#bbb}}",
                   
            // below are extensions, not handled by std mustache ///////////
        
            // handlebar.js #if / #with / #each
            // #if does not introduce a new context, making it immune to name collisions
            "{{#if o}}{{o.foo}}{{/if}}": "FOO",
            "{{#if o}}{{foo}}{{/if}}": "",
            "{{#if z}}zz{{/if}}": "",
            "{{#with o}}{{foo}}{{/with}}": "FOO",
            "{{#with aaa}}{{foo}}{{/with}}": "",
            "{{#each array}}{{.}}{{/each}}": "123",
        
            // short closing
            "{{#bbb}}BBB{{/}}": "BBB",
            "{{^aaa}}notAAA{{/}}": "notAAA",
            "{{^aaa}}{{bbb}}{{/}}": "BBB",
            "{{^bbb}}BBB{{/}}": "",
        
            // if-then-else
            "{{#aaa}}AAA{{^}}notA{{/}}": "notA",
            "{{#bbb}}BBB{{^}}notB{{/}}": "BBB",
            "{{#if aaa}}AAA{{^}}notA{{/}}": "notA",
            "{{#if bbb}}BBB{{^}}notB{{/}}": "BBB",
        
            // complex path (it relies on lodash.get)
            "{{ ['{x:y}z'] }}": "XYZ",
        
            // promises
            "{{ppp}}": "PPP",
            "{{ppp}}-{{ppp}}": "PPP-PPP",
        }
        const params = { 
            bbb: "BBB", ddd: "DDD", 
            html: '<img>', 
            o: { o: "OO", foo: "FOO"},
            array: [1, 2, 3],
            array_objs: [ { a: "A", b: "B" } ], 
            '{x:y}z': 'XYZ',
            ppp: new Promise((resolve) => resolve("PPP")),
        }
        for (const template in tests) {
            // @ts-expect-error
            const wanted = tests[template]
            let got;
            try { 
                got = await mustache.async_render(template, params)
            } catch (e) { got = e.toString() }
            assert.equal(JSON.stringify(got), JSON.stringify(wanted), JSON.stringify(template))
        }
    });

    it("should work with Proxy", async () => {
        const v = { foo: "bar" };
        
        const v_ = new Proxy(v, {
            // @ts-expect-error
            get(that, expr) { return that[expr].toUpperCase(); }
        });      
        assert.equal(await mustache.async_render("Foo {{v_.foo}}", { v_ }), "Foo BAR");
    });
    
});

describe('resolve_mustache_async_params + mustache', () => {
    const render = mustache.async_render

    it("should handle simple async", async () => {
        const v = { foo: "Foo", bar: setTimeoutPromise(1).then(_ => "Bar") }
        assert.equal(await render("Foo:{{v.foo}} Bar:{{v.bar}}", { v }), "Foo:Foo Bar:Bar");
    });

    it("should handle mustache sections", async () => {
        const v = { foo: "Foo" }
        assert.equal(await render("{{#v.foo}}Foo:{{v.foo}}{{/v.foo}}{{#v.bar}}Bar:{{v.bar}}{{/v.bar}}", { v }), "Foo:Foo");
    });

    it("should work with v_display", async () => {
        const v = { sn: "bar", givenName: "bar2" } as v;
        
        const v_ = v_display(v, { sn: { oneOf: [ { const: "bar", title: "BAR"} ] } })
        const r = await render("Foo {{v_display.sn}} {{v_display.givenName}} {{{v_display}}}", { v_display: v_ });
        assert.equal(r, `Foo BAR bar2 <table>
  <tr><td>NOM</td><td>BAR</td></tr>
  <tr><td>Prénom</td><td>bar2</td></tr>
</table>`);
    });

})