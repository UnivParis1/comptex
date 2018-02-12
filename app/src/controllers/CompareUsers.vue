<template>
 <div>
     <p><b>
         <a v-if="homonyme.uid" :href="'https://userinfo.univ-paris1.fr/#' + (homonyme.mail || homonyme.uid)">{{homonyme.mail || homonyme.uid}}</a>
         <span v-else>{{homonyme.supannMailPerso || homonyme.barcode}}</span>
     </b> <span v-html="homonyme.global_main_profile.description" v-if="homonyme.global_main_profile"></span></p>

     <table class="table table-bordered">
       <tbody>
         <tr><th></th><th>Compte demandé</th><th>Compte existant</th></tr>
         <tr v-for="{ attr, cmp } in comparisons">
           <td>{{default_attrs_title[attr] || attr}}</td>
           <td v-html="cmp[0]"></td>
           <td v-html="cmp[1]"></td>
         </tr>
       </tbody>
     </table>
</div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import * as _ from 'lodash-es';
import conf from '../conf.ts';
import * as Helpers from '../services/helpers.ts';
import { formatValue as format } from '../../../shared/v_utils.ts'
import * as JsDiff from 'diff';

function computeComparisons(v, homonyme) {   
        let sameAttrs = {};
        const ignored_attrs = [ 'uid', 'supannAliasLogin', 'score' ];
        return Object.keys(conf.default_attrs_opts).filter(attr => (
            (attr in homonyme) && !_.includes(ignored_attrs, attr) && !attr.match(/^global_/)
        )).map(attr => {
            var val2 = format(homonyme[attr]);
            var val1 = format(v[attr]);
            if (!val1 && attr === 'birthName' && val2) {
                val1 = format(v['sn']);
            }
            [ val1, val2 ] = [ val1, val2 ].map(Helpers.maybeFormatPhone("0"));
            const same = Helpers.equalsIgnoreCase(val1, val2);
            const skip = !val1 && attr === 'altGivenName' && sameAttrs['givenName'];

            let cmp;
            if (attr === 'jpegPhoto') {
                [ val1, val2 ] = [ val1, val2 ].map(val => `<img src="${val}">`);
                cmp = [ val1, same ? "<i>identique</i>" : val2 ];
            } else if (same) { 
                sameAttrs[attr] = true;
                cmp = [ val1, same ? "<i>identique</i>" : val2 ];
            } else {
                cmp = Helpers.formatDifferences(val1, val2, JsDiff);
            }
            return { attr, cmp, skip };
        }).filter(e => !e.skip);
}

export default defineComponent({
    props: ['v', 'homonyme'],
    computed: {
        comparisons() {
            return computeComparisons(this.v, this.homonyme);
        },
    },
})
</script>
