<template>
<div class="ReadOnlyObjectItems" v-if="v_array.length">
    <div v-if="opts.uiOptions && opts.uiOptions.object_items_export_csv">
        Exporter : 
      <template v-for="(name, extension) in { ods: 'Tableur', csv: 'CSV' }">
        <a class="btn btn-default export" @click.prevent="export_(extension)" title="Exporter">
            <span class="glyphicon glyphicon-export"></span>
            {{name}}
        </a>
      </template>
    </div>

  <div class="table-responsive">
    <table class="table table-striped">
    <tbody>
        <tr>
            <th v-for="(opts, _attrName) in attrs">{{opts.title}}</th>
        </tr>
        <tr v-for="v of v_array">
            <td v-for="(opts, attrName) in attrs" :class="'oneAttr-' + attrName">
                <span v-if="!opts.uiOptions || !opts.uiOptions.readOnly__vue_template">{{formatValue(v[attrName], opts)}}</span>
                <component :is="attr_templates[attrName]" :v="v" :value="v[attrName]" v-if="attr_templates[attrName]"></component>
            </td>
        </tr>
    </tbody>
    </table>
  </div>
</div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { mapValues, omitBy } from 'lodash-es'
import { formatValue } from "../../../shared/v_utils";
import * as Helpers from '../services/helpers.ts';

export default defineComponent({
    props: ['v_array', 'opts'],
    data() {
        const attrs: SharedStepAttrsOption = omitBy(this.opts.items.properties, (opts) => opts.uiHidden === true)
        return {
            attrs,
            attr_templates: mapValues(attrs, (opts, _) => {
                const template = opts.uiOptions?.readOnly__vue_template || opts.description
                return template && defineComponent({ props: ['v', 'value'], template: "<div>" + template + "</div>" })
            })
        }
    },
    methods: {
        formatValue,
        async export_(extension) {
            const blob = extension === 'csv' ?
                new Blob(
                    [Helpers.to_csv(this.v_array, this.attrs)], 
                    { type: 'text/csv;charset=utf-8' }
                ) :
                await (
                    await import('../services/spreadsheet')
                ).to_ods(this.v_array, this.attrs)

            if (this.export_ods_link) {
                // revoke previous blob which should not be useful anymore
                URL.revokeObjectURL(this.export_ods_link.href)
            }
            const link = this.export_ods_link ||= document.createElement("a")
            link.href = URL.createObjectURL(blob)
            link.download = "comptes." + extension
            link.click()
        },
    },
})
</script>

