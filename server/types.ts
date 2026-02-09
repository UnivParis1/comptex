import * as express from 'express';
import * as mongodb from 'mongodb';
import conf from './conf.ts';
import * as search_ldap from './search_ldap.ts'

declare global {
    
interface CurrentUser {
  id: string;
  mail?: string; // available after step "acls" are checked
}
type translate = (msg: string, opts?: { null_if_unknown?: true }) => string
type req = express.Request<Dictionary<string>, any, any, Dictionary<string>> & { user?: CurrentUser, translate?: translate };
type res = express.Response<any>;
type next = express.NextFunction;

type Mails = string[]

type id = string
type allow_homonyme_merge = (existingUser : search_ldap.Homonyme, v: v) => boolean
type v = Partial<typeof conf.ldap.people.types> & { 
    noInteraction?: boolean, 
    profilename_to_modify?: string, 
    various?: Dictionary<any> & { 
        allow_homonyme_merge?: allow_homonyme_merge, 
        canAutoMerge_options?: { adding_attr_is_minor_change: boolean },        
        minor_change?: boolean,
    },
} & Dictionary<any> & ForbiddenProperty<"v"|"attrs"|"step"> /* ensure "v" is not compatible with sv */
type response = { [index: string]: any };
interface history_event {
    when: Date
    who: CurrentUser
    step: { id: string; title: string }
    rejected?: true
    purged?: true
}
type sv = {
  _id?: mongodb.ObjectId;
  modifyTimestamp?: Date;
  history: history_event[]

  id?: id,
  step: string,
  v: v,
  v_ldap?: v,
  lock?: boolean,

  additional_public_info?: {
    title_in_list: string // HTML
    description: string // HTML
  }
}
type sva = sv & { attrs: StepAttrsOption };

type r = response & { success: boolean, step?: string, labels?: StepLabels, nextBrowserStep: NextBrowserStep }
type vr = {v: v; response?: response }
type svr = sv & { response?: response }
type svra = sva & { response?: response }
type simpleAction = (req: req, sv: {v: v}) => Promise<vr>
type firstAction_pre = (req: req, sv: unknown) => Promise<v>
type simpleAction_pre = (req: req, sv: {v: v}) => Promise<v>
type action_pre = (req: req, sv: sv) => Promise<v>
type action = (req: req, sv: svra) => Promise<vr>
type acl_ldap_filter = string | boolean
type acl_mongo_filter = Dictionary<any> | boolean
type acl_search = {    
    v_to_moderators_ldap_filter(v: v): Promise<string>
    loggedUser_to_ldap_filter(user: CurrentUser): Promise<acl_ldap_filter>
    loggedUser_to_mongo_filter(user: CurrentUser): Promise<acl_mongo_filter>
}

type profileValuesT<T> = StepAttrOptionChoicesT<T> & { 
    fv: () => Partial<v>;
}

type Mpp<T> = MppT<T>

interface ServiceSideOnlyStepAttrOptions {
  hidden?: boolean;  
  readOnly_ifNotEmpty?: boolean;
  optional_ifEmpty?: boolean;

  items?: MinimalStepAttrOption & { properties?: StepAttrsOptionT<unknown> }

  minDate?: relativeDate;
  maxDate?: relativeDate;

  toUserOnly?: boolean; // implies hidden
  toUser?: (val: string, v: v) => any;

  oneOf_async?: (token: string, sizeLimit: number) => Promise<StepAttrOptionChoices[]>; // if sizeLimit===1, it is used as an exact search
  oneOf_is_dynamic?: true, // useful if the list is modified dynamically. Do not use it if oneOf contains "merge_patch_parent_properties"
  serverValidator?: (val: string, prev: v, v: v) => string;
  homonyms?: (v: v) => Promise<search_ldap.Homonyme[]>;
}
type StepAttrOptionT<MoreOptions> = StepAttrOptionM<ServiceSideOnlyStepAttrOptions & MoreOptions>;
type StepAttrsOptionT<M> = Dictionary<StepAttrOptionT<M>>;

interface StepAttrOption_no_extensions {}
type StepAttrOption = StepAttrOptionT<StepAttrOption_no_extensions>;
type StepAttrsOption = StepAttrsOptionT<StepAttrOption_no_extensions>;
type StepAttrOptionChoices = StepAttrOptionChoicesT<StepAttrOption>;
type profileValues = profileValuesT<StepAttrOption>;

interface StepLabels extends Omit<ClientSideStepLabels, 'description_in_list'> {
    description_in_list?: string | ((req : req) => Promise<string>); // description displayed in list of steps (InitialStep / ModerateList)
    acls?: string
}

interface StepNotify {
  added?: string;
  rejected?: string;
  accepted?: string;    
  preferNonPeopleMailAddresses?: true;
}
type step = {
  labels: StepLabels;
  acls?: acl_search[];

  search_filter?: string;
  initialStep?: boolean;

  allow_many?: boolean | { forced_headers: string[] }; 
  if_no_modification?: 'disable-okButton',
  logout_on_idle?: ClientSideSVA['step']['logout_on_idle'],

  attrs: StepAttrsOption
  attrs_override?: ((req: req, sv: sv) => Promise<StepAttrsOption>);
  next?: string | ((v: v) => Promise<string>);
  nextBrowserStep?: string | ((v: v) => Promise<string>); // either /<step> or a full url
  notify?: StepNotify;
  action_pre?: action_pre;
  action_pre_v_ldap?: action_pre;
  action_pre_before_save?: action;
  action_post?: action;
  action_rejected?: action;
  action_before_purge?: (sv: sv) => Promise<void>; // can return an exception to avoid purge
}
type steps = Dictionary<step>

type ldap_RawValue = string | string[]
type ldap_modify = { action: 'set'|'add'|'delete', value: ldap_RawValue } | { action: 'ignore' } | { action: (vals : string[]) => string[] }

type ldap_conversion = {
    fromLdap?(s: string): any;
    fromLdapMulti?(l: string[]): any;
    fromLdapB?(s: Buffer): any;
    fromLdapMultiB?(l: Buffer[]): any;
    toLdap(v: any): ldap_RawValue | ldap_modify;
    toLdapJson?(v: any): ldap_RawValue;
    applyAttrsRemapAndType?: true, 
}

}
