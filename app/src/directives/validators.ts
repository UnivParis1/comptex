import { App } from 'vue';
import { uniq } from "lodash";
import conf from '../conf.ts';
import * as Helpers from '../services/helpers.ts';

export default (Vue: App) => {

const checkValidity = {
  methods: {
    onchange(event) {
        this.$emit("update:modelValue", event.target.value);
        setTimeout(() => this.checkValidity(), 1); // workaround https://bugzilla.mozilla.org/show_bug.cgi?id=1584963
        return false;
    },
    on_value_set(v) {
        if (v !== this.$el.value) {
            this.$el.value = v; // do it now to update validity. but do not do it if unchanged otherwise it breaks cursor position for some browsers
            this.checkValidity();
        }        
    },
    checkValidity() {
        this.checkValidityEl(this.$el);
    },
    checkValidityEl(el) {   
        let validity = Helpers.copy(el.validity, { allAttrs: true });        
        validity.message = el.validationMessage;
        this.emitValidityIfChanged(validity);
    },
    emitValidityIfChanged(validity) {
        let s = JSON.stringify(validity);
        if (s !== this.prevValidity) {
            this.prevValidity = s;
            this.$emit('update:validity', validity);
        }          
    },
  },
};

Vue.component('input-with-validity', {
  template: "<input :name='name' :value='modelValue' :type='type' :disabled='disabled'>",
  props: [
    'modelValue', 'name', 'type', 'sameAs', 'allowedChars', 'realType', 'pattern', 'min', 'max', 'minlength', 'maxlength', 'step', 'validator', 'disabled', 'onFocusOut',
    'validity' // unused, only emitted. But it allows v-model:validity="..."
  ],
  emits: ['update:modelValue', 'update:validity'],
  mixins: [checkValidity],
  mounted() {
    let element = this.$el;

    element.classList.add("form-control");
    this._setPattern();

    if (this.onFocusOut) {
        element.addEventListener('focusout', this.onFocusOut.bind(this))
    }

    element.addEventListener('input', checkValidity.methods.onchange.bind(this))
    this.checkValidity();
  },
  watch: {
    modelValue: 'on_value_set',
    min(v) { this._attrUpdated('min', v) },
    max(v) { this._attrUpdated('max', v) },
    pattern(v) { this._attrUpdated('pattern', v) },
    sameAs(v) { this._attrUpdated('pattern', Helpers.escapeRegexp(v)) },
  },
  methods: {
    tellParent() { 
        this.$emit("update:modelValue", this.$el.value);
    },
    checkValidity() {
        if (!this.disabled) { 
            if (this.allowedChars) this._checkAllowedChars();
            if (this.validator) this._checkValidator();
            if (this.realType) this._checkRealType();
        }
        checkValidity.methods.checkValidity.call(this);
    },
    _attrUpdated(name, v) {
        this.$el.setAttribute(name, v);
        this.checkValidity();
    },
    _setPattern() {
        for (const name of ['pattern', 'min', 'max', 'minlength', 'maxlength', 'step']) {
            if (this[name]) this.$el.setAttribute(name, this[name]);
        }
        if (this.realType === 'phone') this.$el.setAttribute('pattern', conf.pattern.phone);
        if (this.realType === 'frenchMobilePhone') this.$el.setAttribute('pattern', conf.pattern.frenchMobilePhone);
        if (this.realType === 'frenchPostalCode') this.$el.setAttribute('pattern', conf.pattern.frenchPostalCode);
    },
    _setCustomMsg(msg) {
        this.$el.setCustomValidity(msg);
    },
    _checkAllowedChars() {
        let errChars = (this.$el.value || '').replace(new RegExp(this.allowedChars, "g"), '');
        this._setCustomMsg(errChars !== '' ? conf.error_msg.forbiddenChars(errChars) : '');
    },
    _checkValidator() {
        const err = this.validator(this.$el.value);
        this._setCustomMsg(err || '');
    },
    _checkRealType() {
        let validity = this.$el.validity;
        let msg = '';
        switch (this.realType) {
            case 'phone' :
                if (validity.patternMismatch) msg = conf.error_msg.phone;
                break;
            case 'frenchMobilePhone' :
                if (validity.patternMismatch) msg = conf.error_msg.frenchMobilePhone;
                break;
            case 'frenchPostalCode':
                if (validity.patternMismatch) msg = conf.error_msg.frenchPostalCode;
                break;
            case 'siret':
                if (!Helpers.checkLuhn(this.$el.value, 14)) msg = conf.error_msg.siret;
                break;
        }
        this._setCustomMsg(msg);
    }
  },
});

Vue.component('radio-with-validity', {
  template: `
  <span :class="disabled && 'disabled-radio'">
    <label :class="long_lines_ ? 'my-radio' : 'my-radio-inline'" v-for="(descr, val) in values">
       <input type="radio" :name="name" :value="val" :checked="!val && !modelValue ||val == modelValue" @change="onchange" :required="required" :disabled="disabled">
       <span v-html="descr" v-if="texts_are_html"></span>
       <span v-else>{{descr}}</span>
</label>
  </span>`,
  props: [
    'modelValue', 'name', 'values', 'required', 'disabled', 'texts_are_html', 'long_lines',
    'validity' // unused, only emitted. But it allows v-model:validity="..."
  ],
  emits: ['update:modelValue', 'update:validity'],
  mixins: [ checkValidity ],
  mounted() {
    this.checkValidity();
  },
  watch: {
      modelValue: 'on_value_set',
  },
  computed: {
      long_lines_() {
        return this.long_lines ?? Object.values(this.values).some((text: any) => text.length > 40)
      },
  },
  methods: {
    on_value_set(v) {
        this.emitValidityIfChanged(v ? { valid: true } : { valueMissing: true, message: conf.error_msg.radio_required });
    },
    checkValidity() {
        const el = this.$el.querySelector('input'); // any <input> will do
        if (!el) {
            throw "expected an <input> for field " + this.name
        }
        this.checkValidityEl(el);
    },
  },
});

Vue.component('select-with-validity', {
    template: /*html*/`
    <select :name="name" :value="modelValue" @change="onchange" class="form-control" :required="required">
        <!-- In case of invalid choice, Firefox/Chrome display a "" value (cool) but Safari display the first non disabled <option> -->
        <!-- To help Safari, we explictly add a "disabled" entry corresponding to the current value. 
        <!-- NB: the choice is hidden in the list on Firefox/Chrome but not on Safari -->
        <!-- NB: the choice will disappear once a valid value is chosen, so it disappears from the list in Safari -->
        <option v-if="invalid_choice" disabled hidden :value='modelValue'>Choisir</option>
        <!-- add empty choice -->
        <option v-if="!required && !has_empty_choice" value=''>--</option>
        <template v-for="option in choices">
          <optgroup v-if="option.header" :label="option.header"></optgroup>
          <option :value="option.const">
            {{option.title}}
          </option>
        </template>
    </select>
    `,
    props: [
        'modelValue', 'name', 'choices', 'required',
        'validity' // unused, only emitted. But it allows v-model:validity="..."
    ],
    emits: ['update:modelValue', 'update:validity'],
    mixins: [ checkValidity ],
    mounted() {
      this.checkValidity();
    },
    computed: {
        has_empty_choice() {
            return this.choices?.find(choice => choice.const === '')
        },
        invalid_choice() {
            const valid_choice = (this.modelValue ?? '') === '' ? !this.required : this.choices?.find(choice => choice.const === this.modelValue)
            return !valid_choice
        },
    },
    watch: {
      modelValue: 'on_value_set',
      choices() {
          setTimeout(() => {
            // this.$el.value is now updated according to new "choices"
            // if it is different, it means current choice is no more allowed
            if (this.$el.value !== this.modelValue) {
                this.onchange({ target: this.$el })
            }
        })
      },
    },
    methods: {
        checkValidity() {
            if (!this.disabled) { 
                // We need to block submit if invalid_choice. On Firefox/Chrome, it is still needed if non "required"
                // (we make a specific msg in case the choices have a non-allowed "" choice... would it be better to remove it from the "choices"??)
                this.$el.setCustomValidity(this.invalid_choice ? ((this.modelValue ?? "") === "" && this.has_empty_choice ? "Faire un autre choix" : "Sélectionnez un élément dans la liste !") : "")
            }
            checkValidity.methods.checkValidity.call(this);
        },
    },    
});

// Emitted values: '' | true
Vue.component('checkbox-with-validity', {
    template: `<input type="checkbox" :name="name" :checked="modelValue || false" @change="onchange">`,
    props: [
        'modelValue', 'name',
        'validity' // unused, only emitted. But it allows v-model:validity="..."
    ],
    emits: ['update:modelValue', 'update:validity'],
    mixins: [ checkValidity ],
    mounted() {
      this.checkValidity();
    },
    watch: {
      modelValue: 'checkValidity',
    },
    methods: {
        onchange(event) {
            this.$emit("update:modelValue", event.target.checked || '');
            this.checkValidity();
            return false;
        },    
    },
});
  
Vue.component('textarea-with-validity', {
  template: `<textarea :value="modelValue" @input="onchange"></textarea>`,
  props: [
    'modelValue',
    'validity' // unused, only emitted. But it allows v-model:validity="..."
  ],
  emits: ['update:modelValue', 'update:validity'],
  mixins: [ checkValidity ],
  mounted() {
    this.checkValidity();
  },
  watch: {
    modelValue: 'on_value_set',
  },
});

Vue.component('history-textarea-with-validity', {
  template: `<typeahead :name="name" :modelValue="modelValue" @update:modelValue="onchange" :required="required" :is_textarea="true" :rows="rows" :minChars="1" :options="history" v-model:validity="validity"></typeahead>`,
  props: [
    'name', 'modelValue', 'required', 'rows',
    'validity' // unused, only emitted. But it allows v-model:validity="..."
  ],
  emits: ['update:modelValue', 'update:validity'],
  data() {
    return { history: [], validity: {} };
  },
  mixins: [ checkValidity ],
  computed: {
    localStorage_key() { return "comptex:history-textarea:" + this.name },
  },
  mounted() {
    try {
        this.history = JSON.parse(localStorage[this.localStorage_key]) || [];
    } catch (e) {}
    this.checkValidity();
  },
  beforeUnmount() {
    if (this.modelValue) {
        localStorage[this.localStorage_key] = JSON.stringify(uniq([ this.modelValue, ...this.history ]));
    }
  },
  watch: {
    modelValue: 'on_value_set',
    validity(validity) {
        // re-emit
        this.$emit('update:validity', validity);
    },
  },
  methods: {
        onchange(val) {
            this.$emit("update:modelValue", val || '');
            this.checkValidity();
            return false;
        },    
  },
});

}
