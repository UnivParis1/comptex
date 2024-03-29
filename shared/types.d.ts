type Dictionary<T> = Record<string, T>
type ForbiddenProperty<Keys extends string> = Partial<Record<Keys, void>>

type uiTypes =
    'radio'|'select'|'checkbox'|'email'|'password'|'text'|'integer'|'number'|'url' |
    'textarea'|'phone'|'frenchMobilePhone'|'frenchPostalCode'|
    'date' |' dateThreeInputs' | 'datetime' |
    'postalAddress'|'cameraSnapshot'|'photoUpload'|'fileUpload' |
    'autocomplete'|'newPassword'|'siret' | 'array' |
    'homonym' | 'queryParamForActionPre' |
    'tab' | 'iframe' |
    'digits';

type relativeDate = `${number}${"D"|"Y"|"EY"|"SY"}`

interface NextBrowserStep { 
    url: string
    params?: { none: true } | { mode: 'hash'|'query', prefix: ''|'set_' }
}

interface StepAttrItemsOption {
    uiPlaceholder?: string;

    uiOptions?: { 
        rows?: number;
        autocomplete?: boolean
        inputmode?: 'numeric'
        removable?: boolean
        addable?: boolean
        orderable?: boolean
        title_rowspan?: boolean
        title_hidden?: boolean
        object_items_export_csv?: boolean
        readOnly__avoid_disabled_input?: boolean
        readOnly__vue_template?: string
        texts_are_html?: boolean
        texts_are_vue_template?: boolean
        date_todayButton?: string
    };

    uiHidden?: boolean | 'ifFalsy';

    uiType?: uiTypes;

    pattern?: string;
    min?: number;
    max?: number;
    minlength?: number;
    maxlength?: number;

    acceptedMimeTypes?: string[];

    // for images
    width?: number
    ratio?: number
    photo_quality?: number // 1 is best quality
}
    
type MinimalStepAttrOption = StepAttrItemsOption & {
    title?: string;
    description?: string;  
    labels?: { 
        custom_error_message?: string; // displayed for non valid values
        advice_after_submit?: string; // HTML displayed after first submit
        tooltip?: string;
        warning?: string; // similar to tooltip, but with a "warning" sign
        tab_post_scriptum?: string;
    }
    items?: MinimalStepAttrOption & { properties?: StepAttrsOptionM<unknown> },

    format?: 'date' | 'image/jpeg' | 'phone';
    default?: string;

    allowedChars?: string;
    allowUnchangedValue?: boolean // if the user changes the value, the value must pass checks. If kept unchanged, it bypasses checks!
    ignoreInvalidExistingValue?: boolean
}

type SharedStepAttrOption = MinimalStepAttrOption & {
    normalize?: (s: string) => string;
    formatting?: (val: any) => string;
    formatting_html?: (val: any) => string;
    onChange?: (v: CommonV, _: string, val: any) => void;
    onFocusOut?: (v: CommonV) => void;
    onVisible?: (v: {}, elt: HTMLElement) => void;
    validator?: (val: any, v_orig: {}) => string;
    computeValue?: (v: CommonV, all_attrs: StepAttrsOptionM<SharedStepAttrOption>) => any;

    minDate?: Date | relativeDate;
    maxDate?: Date | relativeDate;
}

type SharedStepAttrsOption = Dictionary<SharedStepAttrOption>;

interface MergePatchOptions {
    newRootProperties?: 'ignore' | { ignore: string[] } // all | a list of attribute names
}

type StepAttrOptionChoicesT<T> = {
  const: string;
  title?: string;
  header?: string;
} & MppT<T>

type MppT<T> = {
  merge_patch_parent_properties?: Dictionary<T>;
  merge_patch_options?: MergePatchOptions, // if given, "merge_patch_parent_properties" is only used on client-side
}

interface CommonStepAttrOptionT<T> extends MinimalStepAttrOption {
  readOnly?: boolean;
  
  // constraints below are checked when sent by the user. Values from action_pre/action_post are not verified!
  optional?: boolean;
  properties?: Dictionary<T>;
  oneOf?: StepAttrOptionChoicesT<T>[];
  if?: 'truthy' | 'falsy';
  then?: MppT<T>;
}

// create the recursive type
type StepAttrOptionM<More> = CommonStepAttrOptionT<StepAttrOptionM<More>> & More

type StepAttrsOptionM<More> = Dictionary<StepAttrOptionM<More>>;

interface ClientSideOnlyStepAttrOption {
    oneOf_async?: string;
}

type CommonV = Dictionary<any>

interface ClientSideStepLabels {
    // vue templates
    title_in_list?: string; // an empty description means "hide this step in ModerateList"
    title?: string;
    description?: string;
    description_in_list?: string;
    okButton?: string;
    cancelButton?: string;
    post_scriptum ?: string; // vue template displayed after the <form> (vars: v, v_pre)

    // vue templates: can use variable "resp" which is the response of "next" "action_pre" and/or "action_post"
    added?: string; // displayed reaching this step (through "next"). It will be prefered over "accepted" below.
    accepted?: string; // displayed when the "action_post" succeeded (but see "added" above if "next" step)
}

interface ClientSideSVA {
    attrs: StepAttrsOptionM<ClientSideOnlyStepAttrOption>    
    stepName: string
    v: CommonV
    v_ldap?: CommonV
    step: {
        labels: ClientSideStepLabels
        allow_many?: boolean | { forced_headers: string[] }
        if_no_modification?: 'disable-okButton'
        logout_on_idle?: {
            softTimeoutMs: number,
            hardTimeoutMs: number,
            logoutUrl: string,
        },
    }
    additional_public_info?: {
        title_in_list: string // HTML
        description: string // HTML
    },
    modifyTimestamp?: Date
    id?: string,
}