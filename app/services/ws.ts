function padLeft(s: string | number, width: number) {
    let n = s + '';
    return n.length >= width ? n : new Array(width - n.length + 1).join('0') + n;
}

class MyDate {
    constructor(public year: number, public month: number, public day: number) {
    }
    toString() {
        return [padLeft(this.day, 2), padLeft(this.month, 2), padLeft(this.year, 4)].join('/');
    }
    toDate() {
        return new Date(Date.UTC(this.year, this.month - 1, this.day));
    }
}

class HomePostalAddress {
    constructor(public line1) { }
    toString() {
        return this.line1;
    }
}

class HomePostalAddressPrecise extends HomePostalAddress {
    constructor(public line1: string, public line2: string, public postalCode: string, public town: string, public country: string) {
        super(line1);
    }
    toString() {
        if (!this.postalCode && !this.town) return undefined;
        return this.line1 + (this.line2 ? "\n" + this.line2 : '') + "\n" + this.postalCode + " " + this.town + "\n" + (this.country || 'FRANCE');
    }
}

interface VCommon {
    structureParrain?: string;
    supannAliasLogin?: string;
    jpegPhoto?: string;
}
interface VRaw extends VCommon {
    birthDay?: string;
    homePostalAddress?: string;
}
interface V extends VCommon {
    birthDay?: MyDate;
    homePostalAddress?: HomePostalAddress;
    structureParrainS: { key: string, name: string, description: string };
}
interface SVRaw {
    v: VRaw;
    step: string;
    error?: string;
}

interface StepAttrOption {
  readonly?: boolean;
  hidden?: boolean;
}
interface Dictionary<T> {
  [index: string]: T;
}
type StepAttrsOption = Dictionary<StepAttrOption>;

interface Structure {
    key: string;
    name: string;
    description: string;
}

namespace Ws {
        export function structures_search(token : string, maxRows? : number) : Promise<Structure[]> {
            return axios.get('/api/structures', { params: { token, maxRows } }).then((resp) => resp.data);
        }

        function _fromJSONDate(date: string) {
            var d = new Date(date);
            return d && new MyDate(d.getUTCFullYear(), 1 + d.getUTCMonth(), d.getUTCDate());
        }
        function _fromLDAPDate(date: string) {
            var m = date.match(/^([0-9]{4})([0-9]{2})([0-9]{2})[0-9]{6}Z?$/);
            return m && new MyDate(parseInt(m[1]), parseInt(m[2]), parseInt(m[3]));
        }

        function _fromHomePostalAddress(addr): HomePostalAddress {
            var m = addr.match(/(.*)\n(.*)\n(.*)/);
            if (!m) return new HomePostalAddress(addr);
            var m1 = m[1].match(/(.*)\n(.*)/);
            var m2 = m[2].match(/(\d+) (.*)/);
            return new HomePostalAddressPrecise(
                m1 ? m1[1] : m[1],
                m1 ? m1[2] : '',
                m2[1], m2[2],
                m[3]);
        }
        function _toHomePostalAddress(addr: HomePostalAddress) : string {
            return addr.toString();
        }

        function fromWs(v: VRaw): V {
            var v_: V = <any> Helpers.copy(v);
            //v.birthDay = "19751002000000Z"; //"1975-10-02";
            if (v.birthDay) {
                v_.birthDay = _fromLDAPDate(v.birthDay) || _fromJSONDate(v.birthDay);
            }
            if (!v_.birthDay) {
                v_.birthDay = new MyDate(undefined, undefined, undefined);
            }
            if (v.homePostalAddress) {
                v_.homePostalAddress = _fromHomePostalAddress(v.homePostalAddress);
            } else {
                v_.homePostalAddress = new HomePostalAddressPrecise('', '', '', '', '');
            }
            v_.structureParrainS = { key: null, name: null, description: null };
            if (v.structureParrain) {
                structures_search(v.structureParrain, 1).then((resp) => {
                    v_.structureParrainS = resp[0];
                });
            }
            return v_;
        }

        export function toWs(v: V): VRaw {
            var v_: VRaw = <any>Helpers.copy(v);
            if (v.birthDay) {
                v_.birthDay = v.birthDay.toDate().toJSON();
            }
            if (v.homePostalAddress) {
                v_.homePostalAddress = _toHomePostalAddress(v.homePostalAddress);
            }
            if (v.structureParrainS) {
                v_.structureParrain = v.structureParrainS.key;
            }
            return v_;
        }

        function _handleErr(resp) {
            var err = resp.data;
            console.error(err);
            alert(err);
            return Promise.reject(err);
        }

        export function getInScope($scope, id: string, expectedStep: string) : Promise<void> {
            var url = '/api/comptes/' + id;
            return axios.get(url).then((resp) => {
                var sv = <any>resp.data;
                if (sv.error) {
                    console.error("error accessing ", url, ":", sv.error, sv.stack);
                    alert(sv.error);
                } else {
                    if (expectedStep && sv.step !== expectedStep) alert("expecting " + expectedStep + " got " + sv.step);
                    if (sv.v) sv.v = fromWs(sv.v);
                    sv.modifyTimestamp = _fromJSONDate(sv.modifyTimestamp);
                    Helpers.eachObject(sv.attrs, (attr) => sv.v[attr] = sv.v[attr]); // ensure key exists for Vuejs setters
                    Helpers.assign($scope, sv);
                }
            }, _handleErr);
        }

        export function listInScope($scope, params) : Promise<void> {
            return axios.get('/api/comptes', { params }).then((resp) => {
                var svs = <any>resp.data;
                if (svs.error) {
                    $scope.err = svs;
                } else {
                    $scope.svs = svs;
                }
            }, (resp) => {
                var err = resp.data;
                alert(err || "server is down, please retry later");
                return Promise.reject(err);
            });
        }

        export function homonymes(id) {
            return axios.get('/api/homonymes/' + id).then((resp) =>
                (<any>resp.data)
                , _handleErr);
        }

        export function set(id: string, v: V) {
            var url = '/api/comptes/' + id;
            var v_ = toWs(v);
            return axios.put(url, v_).then(
                (resp) => resp.data,
                _handleErr);
        }

        export function remove(id: string) {
            var url = '/api/comptes/' + id;
            return axios.delete(url).then( 
                (resp) => resp.data,
                _handleErr);
        }
}
