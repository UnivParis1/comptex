// useful for "object literals" when you do not want to create a variable:
// - it is more strict than typescript type assertion ( https://basarat.gitbook.io/typescript/type-system/type-assertion#assertion-considered-harmful )
// - error messages are simpler
export const is = <T>(v: T) => v

export const addDays = (date : Date, days : number) => {
    let r = new Date(date);
    r.setTime(r.getTime() + days * 60 * 60 * 24 * 1000);
    return r;
}

export const addYears = (date : Date, years : number) => {
    let r = new Date(date);
    r.setFullYear(r.getFullYear() + years)
    return r;
}

export const nextDate = (pattern : string, date: Date) => {
    let s = pattern.replace(/^XXXX-/, "" + date.getFullYear() + "-");
    let r = new Date(s);
    if (r.getTime() < date.getTime()) r.setFullYear(r.getFullYear() + 1);
    return r;
}

export const toYYYY_MM_DD = (date: Date) => (
    date?.toISOString()?.replace(/T.*/, '')
)

export const milliseconds_to_DaysHoursMinutes = (ms: number) => {
    const minutes = Math.round(ms / 60 / 1000)
    return { 
        days: Math.floor(minutes / 60 / 24), 
        hours: Math.floor(minutes / 60) % 24, 
        minutes: minutes % 60,
    }
}

export const milliseconds_to_french_text = (ms: number) => {
    const translate = { days: ['jour', 'jours'], hours: ['heure', 'heures'], minutes: ['minute', 'minutes'] }
    const dhm = milliseconds_to_DaysHoursMinutes(ms)
    const to_text = (field: 'days'|'hours'|'minutes') => {
        const val = dhm[field]
        return val === 0 ? '' : val + " " + translate[field][val > 1 ? 1 : 0]
    }

    const d = to_text('days')
    const h = to_text('hours')
    const m = to_text('minutes')

    return (
        dhm.days >= 7 ? [d] : dhm.days >= 1 ? [d,h]: 
        dhm.hours >= 10 ? [h] : [h,m]
    ).filter(s => s).join(' et ')
}

export const setTimeoutPromise = (time: number) => (
    new Promise((resolve, _) => setTimeout(resolve, time))
);

export function padStart(value : any, length : number, char : string) : string {
    value = value + '';
    var len = length - value.length;

    if (len <= 0) {
            return value;
    } else {
            return Array(len + 1).join(char) + value;
    }
}

export function formatDate(date : Date | string, format : string) : string {
    const date_ : Date = typeof date === "string" ? new Date(date) : date;
    if (!date) return null;
    return format.split(/(yyyy|MM|dd|HH|mm|ss)/).map(function (item) {
        switch (item) {
            case 'yyyy': return date_.getFullYear();
            case 'MM': return padStart(date_.getMonth() + 1, 2, '0');
            case 'dd': return padStart(date_.getDate(), 2, '0');
            case 'HH': return padStart(date_.getHours(), 2, '0');
            case 'mm': return padStart(date_.getMinutes(), 2, '0');
            case 'ss': return padStart(date_.getSeconds(), 2, '0');
            default: return item;
        }
    }).join('');   
}

const frenchPhone_pattern = "^(\\+33|0)\\s*[1-9](\\s*[0-9]){8}$"
const french_outre_mer_to_international_prefix: Dictionary<string> = {
    // Guadeloupe/Saint-Barthélemy/Saint-Martin
    '06 90': '+590',
    '06 91': '+590',
    // La Réunion 
    '06 92': '+262',
    '06 93': '+262',
    // Guyanne
    '06 94': '+594',
    // Martinique
    '06 96': '+596',
    '06 97': '+596',
    // Mayotte
    '06 39': '+262',
}

export const maybeFormatPhone = (resultFrenchPrefix: string) => (maybePhone : string) : string => {
    if (maybePhone.match(frenchPhone_pattern)) {
        return maybePhone.replace(/^(\+33|0)/, '').replace(/\s/g, '').replace(/(.)(..)(..)(..)(..)/, (_, p1, p2, p3, p4, p5) => {
            const prefix = french_outre_mer_to_international_prefix[`0${p1} ${p2}`]
            return (prefix ? prefix + ' ' : resultFrenchPrefix) + `${p1} ${p2} ${p3} ${p4} ${p5}`
        })
    }
    return maybePhone;
}

export const compute_absolute_date = (relativeDate: relativeDate, date: Date = new Date()) => {
    const [ , number_, what ] = relativeDate.match(/^(.*?)(D|EY|SY|Y)$/) || []
    const number = parseInt(number_)

    switch (what.toUpperCase()) {
        case "D":
            return addDays(date, number)
        //case "M":
        //    return addMonths(startdate, number)
        case "Y":
            return addYears(date, number)
        case "SY":
            return nextDate("XXXX-01-01", addYears(date, number - 1))
        case "EY":
            return nextDate("XXXX-12-31", addYears(date, number))
        default:
            throw "getExpiryDate: invalid code " + what
    }
}

export const to_absolute_date = (date: Date | relativeDate) => (
    date instanceof Date ? date : date && compute_absolute_date(date, new Date())
)

export const throw_ = (e: any) => { throw e }

export const dataURL_to_mimeType = (val: string) => (
    val?.match(/^data:(\w{1,30}\/\w{1,30})/)?.[1]
)
