import Vue from "vue";

Vue.component("validation-errors", {
    props: ['name', 'validity', 'custom_message', 'custom_msg_is_html'],
    template: `
  <span class="validation-errors">
   <transition name="fade">
    <span v-if="!validity_.valid">    
       <span class="help-block" v-if="custom_message && custom_msg_is_html" v-html="custom_message"></span>
       <span class="help-block" v-else>{{custom_message || validity_.message}}</span>
    </span>
   </transition>
  </span>
    `,
    computed: {
        validity_() {
            return this.validity && this.validity[this.name] || { valid: true };
        },
    },
});

Vue.component("mytooltip", {
    props: [ "text", "is_html", "glyphicon" ],
    data: () => ({ popup: undefined }),
    template: `
        <div class="mytooltip" v-if="text">
            <span class="glyphicon" :class="glyphicon" @click="popup = 'force'"></span>
            <div class="mytooltip-popup" @click="popup = popup === 'force' ? 'hide' : popup" v-if="popup !== 'hide'"><span>
                <span class="mytooltip-text" v-html="text" v-if="is_html">
                </span>
                <span class="mytooltip-text" v-else>
                    {{text}}
                </span>
                <span class="mytooltip-arrow"></span>
            </span></div>
        </div>`
})

Vue.component("my-label-tooltips", {
    props: [ "labels", "texts_are_html" ],
    // NB: forcing <label for=""> to ensure clicking on tooltip on mobile does not focus associated <input>
    template: `
        <label for="" v-if="labels">
            <mytooltip :text="labels && labels.tooltip" :is_html="texts_are_html" glyphicon="glyphicon-question-sign"></mytooltip>
            <mytooltip :text="labels && labels.warning" :is_html="texts_are_html" glyphicon="glyphicon-warning-sign"></mytooltip>
        </label>
    `,
})

Vue.component("nowrap-after-text", {
    props: ['text', 'nowrap_class'],
    template: `
        <span>
          {{text_.before}}
          <span :class="nowrap_class" style="white-space: nowrap; display: inline-block">
            {{text_.last_word}}
            <slot></slot>
          </span>
        </span>
    `,
    computed: {
        text_() {
            const m = (this.text || '').match(/(.*) (.*)/);
            return { before: m ? m[1] : '', last_word: m ? m[2] : this.text }
        },
    },
})

Vue.component("my-bootstrap-form-group", {
    props: [
        'name', 'label', 'validity', 'opts', 'hideErrors', 
        'no_html_label', // useful to avoid creating another <label> tag which would conflict with internal <label> (esp. needed for checkbox, file upload)
    ],
    template: `
            <div class='form-group' :class="{'my-has-error': validity && !validity[name].valid, 'label-hidden': uiOptions.title_hidden }">
              <component :is="label_ && !no_html_label ? 'label' : 'span'" class="label-and-more">
                <nowrap-after-text :text="label_" class="the-label" :class="{ label_rowspan }" :nowrap_class="{ 'required_field': required_ }" v-if="label_">
                    <my-label-tooltips :labels="labels" :texts_are_html="uiOptions.texts_are_html"/>
                </nowrap-after-text>
                <span class="the-label" v-else/>

                <div class="on-the-right">
                    <slot/>
                    <validation-errors v-if="!hideErrors && validity" :name="name" :validity="validity" :custom_message="labels && labels.custom_error_message" :custom_msg_is_html="uiOptions.texts_are_html"/>
                    <span class="advice-after-submit" v-html="labels.advice_after_submit" v-if="labels && labels.advice_after_submit"></span>
                </div>
              </component>
            </div>
    `,
    computed: {
        uiOptions() {
            return this.opts?.uiOptions || {}
        },
        label_() {
            return this.label ?? (this.opts?.uiOptions?.title_hidden ? '' : this.opts?.title)
        },
        labels() {
            return this.opts?.labels
        },
        label_rowspan() {
            return this.opts?.uiOptions?.title_rowspan
        },
        required_() {
            return this.required ?? (this.opts && !this.opts.optional)
        }
    },
});

Vue.component('input-group-btn-remove', {
    template: `<span class="input-group-btn">
        <button class="btn btn-danger" type="button" @click="$emit('remove')" aria-label="Supprimer la valeur">
            <i class="glyphicon glyphicon-remove"></i>
        </button>
    </span>`
})
