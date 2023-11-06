export type PostalAddress = { 
      country: string, 
      lines: string,
      line2: string, postalCode: string, town: string,
};

export function fromString(addr: string): PostalAddress {
    const empty = { lines: '', line2: '', postalCode: '', town: '', country: '' }
    if (!addr) return { ...empty, country: "FRANCE" };

    let lines = addr.split(/\n/);
    if (lines.length < 2) return { ...empty, lines: addr };
    let country = lines.pop();
    if (country.match(/^france$/i)) {
        let pt = lines.pop();
        let pt_: string[] = pt.match(/(\d{4,5}) (.*)/);
        if (!pt_) {
            lines.push(pt);
            pt_ = [];
        }
        let l1 = lines.shift();
        let line2 = lines.join(" - "); // we want only 2 lines, group the remaining lines                
        return { lines: l1, line2, postalCode: pt_[1], town: pt_[2], country: "FRANCE" };
    } else {
        return { ...empty, lines: lines.join("\n"), country };
    }
}

export function toString(addr: PostalAddress) : string {
    if (addr.lines && addr.country) {
        let pt = [ addr.postalCode, addr.town ].filter(e => e).join(" ");
        return [ addr.lines, addr.line2, pt, addr.country || 'FRANCE' ].filter(s => s).join("\n");
    } else {
        return undefined;
    }
}
