import conf from './conf.ts'

export const sv_to_url = (sv: sv) => (
    conf.mainUrl + "/" + sv.step + "/" + sv.id
)

