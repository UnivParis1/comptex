<template>
  <my-bootstrap-form-group :name="name" :opts="opts" :no_html_label="true" :validity="validity" v-if="!opts.readOnly || val" class="FileUploadAttr">

    <span v-if="val">
        <img style="max-width: 400px; max-height: 400px" :src="val" v-if="is_image">
        <iframe style="max-width: 400px; max-height: 400px" :src="val" v-else></iframe>
        <button class="btn btn-default" style="vertical-align: top; margin-left: 1rem" @click.prevent="window_open">
          <span class="glyphicon glyphicon-zoom-in"></span>
            Voir en grand</button>
    </span>

    <span style="display: inline-block" v-if="!opts.readOnly">

       <div v-if="error" class="alert alert-danger" role="alert">
           <span v-if="error.mimeType">Le type de fichier {{error.mimeType}} est interdit.</span>
           <span v-if="error.size">Le fichier est trop gros : taille maximale autorisée {{maxSizeFormatted}}.</span>
        </div>
       <div v-if="is_image">Ci-contre, votre document en prévisualisation.<p></p></div>
       <div v-else-if="val">Votre fichier de type {{mimeType}} est accepté.<p></p></div>
       

      <!-- for validation: -->
      <input-with-validity :name="name" :value="val" type="text" style="display: none" :required="!opts.optional" :validity.sync="validity[name]"></input-with-validity>

      <label class="btn btn-default">
          {{val || error ? 'Choisir un autre fichier' : 'Choisir un fichier'}}
          <input-file style="display: none;" :accept="acceptedMimeTypes.join(', ')" @change="onFileUploaded"></input-file>
      </label>

      <p><div v-html="opts.description"></div></p>
    </span>
  </my-bootstrap-form-group> 
</template>

<script lang="ts">
import { round } from "lodash";
import Vue from "vue";
import * as Helpers from '../services/helpers';
import conf from '../conf'

const default_acceptedMimeTypes = conf.fileUpload_default_acceptedMimeTypes

const dataURL_to_mimeType = (val: string) => (
    val?.match(/^data:(\w{1,30}\/\w{1,30})/)?.[1]
)

const formatMB = (n: number) => {
    const n_ = n / 1024 / 1024;
    return "" + round(n_, n_ >= 10 ? 0 : 1) + "MB";
}


export default Vue.extend({
    props: ['value', 'name', 'opts'],
    data() {
        return {
            validity: { [this.name]: {} },
            val: this.value,
            error: undefined,
        };
    },
    computed: {
       acceptedMimeTypes() {
           return this.opts.acceptedMimeTypes || default_acceptedMimeTypes
       },
       maxSize() {
           return this.opts.maxlength && this.opts.maxlength / 1.33 /* for Base64 overhead */
       },
       maxSizeFormatted() {
            return this.maxSize && formatMB(this.maxSize)
       },
       mimeType() {
            return dataURL_to_mimeType(this.val)
       },
       is_image() {
           return this.mimeType?.match(/^image\//)
       },
    },
    watch: {
        value(val) {
            this.val = val;
        },
        val(val) {
            this.$emit('input', val);
        },
    },
    methods: {
        async onFileUploaded(file) {
            if (!this.acceptedMimeTypes.includes(file.type)) {
                this.val = ''
                this.error = { mimeType: file.type }
            } else if (this.maxSize && file.size > this.maxSize) {
                this.val = ''
                this.error = { size: file.size }
            } else {
                this.val = await Helpers.fileReader('readAsDataURL', file)
                this.error = undefined
            }
        },
        window_open() {
            window.open(this.val)
        }
    },
});
</script>

