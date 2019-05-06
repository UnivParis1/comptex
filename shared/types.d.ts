interface Dictionary<T> {
    [index: string]: T;
}

type uiTypes =
    'radio'|'select'|'checkbox'|'email'|'password'|'text'|'url' |
    'textarea'|'phone'|'mobilePhone'|'frenchPostalCode'|'date' |
    'dateThreeInputs'|'postalAddress'|'cameraSnapshot'|'photoUpload' |
    'autocomplete'|'newPassword'|'siret' | 'array' | 'homonym';

interface StepAttrItemsOption {
    uiPlaceholder?: string;

    uiOptions?: { rows?: number; autocomplete?: boolean };

    uiHidden?: boolean;

    uiType?: uiTypes;

    pattern?: string;
    min?: number;
    minYear?: number;
    max?: number;
    maxYear?: number;
}
    
type MinimalStepAttrOption = StepAttrItemsOption & {
    title?: string;
    description?: string;  
    labels?: { advice?: string; tooltip?: string; }

    format?: 'date' | 'data-url';    
    default?: string;

    allowedChars?: string;
}

type MoreStepAttrOption = MinimalStepAttrOption & {
    normalize?: (s: string) => string;
    formatting?: (val) => string;
    formatting_html?: (val) => string;
    onChange?: (v: {}, _: string, val) => void;

    items?: MoreStepAttrOption,

    minDate?: Date;
    maxDate?: Date;
}

type MoreStepAttrsOption = Dictionary<MoreStepAttrOption>;