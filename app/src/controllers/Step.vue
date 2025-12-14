<template>
<div class="alert alert-danger" role="alert" v-if="fatal_error || fatal_error_html">
    <p v-if="fatal_error_html" v-html="fatal_error_html"></p>
    <p v-else style="white-space: pre">{{fatal_error}}</p>
</div>
<div :class="'step-' + stepName" v-else>

    <StepV v-if="v"
        :wanted_id="wanted_id" :stepName="stepName"
        :id="id" :v_pre="v_pre"
        :step="step" :attrs="attrs" :all_attrs_flat="all_attrs_flat" :v="v" :v_ldap_in="v_ldap"
        :additional_public_info="additional_public_info"
    ></StepV>
</div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import * as Helpers from '../services/helpers.ts';
import * as Ws from '../services/ws.ts';
import { router } from '../router.ts';
import { isEmpty } from 'lodash-es';
import { V, StepAttrsOption } from '../services/ws.ts';

import { v_from_prevStep } from './StepV.vue';
import StepV from './StepV.vue';


function AttrsForm_data() {
    return {
      step: undefined,
      attrs: <StepAttrsOption> undefined,
      all_attrs_flat: <StepAttrsOption> undefined,
      v: <V> undefined,
      v_ldap: <V> undefined,
      fatal_error: undefined,
      fatal_error_html: undefined,

      // from Ws.getInScope
      additional_public_info: undefined as ClientSideSVA['additional_public_info'], 
    };    
}

export default defineComponent({
    mounted() {
        const prevStep = this.$route.query?.prev;
        if (prevStep && isEmpty(v_from_prevStep)) {
            // we lost information passed through javascript memory, so go back to initial step
            router.replace({ path: '/' + prevStep });
        } else {
            this.init();
        }
    },
    props: [ 'wanted_id', 'stepName' ],
    data: AttrsForm_data,
    components: { StepV },

    watch: {
        '$route': function() {
            Helpers.assign(this, AttrsForm_data());
            this.init();
        },
    },
    computed: {
        id() {
            return this.wanted_id || "new";
        },
        v_pre() {
            let v = { ...this.$route.query, ...v_from_prevStep };
            delete v.prev;
            return v;
        },
        hash_params() {
            if (!this.$route.hash) return {};
            return Object.fromEntries(new URLSearchParams(this.$route.hash.replace(/^#/, '')));
        },
    },

    methods: {
        async init() {
            try {
                await Ws.getInScope(this, this.id, this.v_pre, this.hash_params, this.stepName);
            } catch (err) {
                if (err === 'alerted__do_router_back') {
                    Helpers.object_replace(v_from_prevStep, {})
                    router.back()
                } else {
                    throw err
                }
            }
        },
        export_csv(event) {
            const csv = Helpers.to_csv(this.vs, this.all_attrs_flat)
            event.target.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv)
        },
    },
});

</script>
