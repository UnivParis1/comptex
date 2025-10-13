<template>
    <div v-if="to_import">
        <h5>Prévisualisation de la création d'utilisateurs</h5>
        <div style="max-height: 20rem; overflow-y: scroll;">
            <table class="table table-striped table-bordered">
            <thead>
                <tr>
                    <th v-for="field in to_import.fields">{{default_attrs_title[field]}}</th>
                </tr>
                <tr style="font-size: x-small">
                        <th v-for="field in to_import.fields" :class="{ 'unknown-field': !attrs[field] }">{{field}}</th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="(v, i) in to_import.lines" :class="{ 'ignored-line': ignore_first_line && i === 0}">
                  <td v-for="field in to_import.fields" :class="{ 'unknown-field': !attrs[field] }">{{v[field].toString()}}</td>
                </tr>
            </tbody>
            </table>
        </div>

        <p v-if="forced_headers_">
            <input v-model="ignore_first_line" type="checkbox"> Ignorer la 1ère ligne
        </p>

        <button type="button" class="btn btn-primary" @click="to_import = null">
                <span class="glyphicon glyphicon-trash"></span>
                Annuler</button>      
    </div>
    <div v-else>
        <form>
          <div class="btn-group">
            <label class="btn btn-primary">
                <span class="glyphicon glyphicon-import"></span>
                Déposer un fichier
                <input-file style="display: none;" @change="css_import"></input-file>
            </label>
             <button type="button" :class="{ active: show_options }" class="btn btn-primary dropdown-toggle" :aria-expanded="show_options" @click="show_options = !show_options">
                <span class="caret"></span>
                <span class="sr-only">Options</span>
             </button>
          </div>
          <div v-if="show_options" style="margin-top: 1em">
                Entêtes : <input v-model="forced_headers_">
          </div>
        </form>           
        <p style="height: 1em"></p>
    </div>
</template>

<script lang="ts">
import { tail } from "lodash";
import { defineComponent } from "vue";
import * as Ws from '../services/ws';

export default defineComponent({
    props: [ 'attrs', 'forced_headers' ],
    data() {
        return {
            to_import: undefined,
            show_options: !!this.forced_headers,
            forced_headers_: (this.forced_headers || []).join(','),
            ignore_first_line: false,
        }
    },
    watch: {
        to_import_for_parent(val) { this.$emit("change", val) },
    },
    computed: {
        to_import_for_parent() {
            if (!this.to_import) return undefined;

            let { fields, lines } = this.to_import || {}
            if (this.ignore_first_line) lines = tail(lines)
            return { fields, lines }
        }
    },
    methods: {
        css_import(file: File) {
          const forced_headers = this.forced_headers_ && this.forced_headers_.split(/[ ,;]/)
          Ws.csv2json(file, this.attrs, forced_headers).then(to_import => {
              this.to_import = to_import;
          });
        },
    },
});
</script>
