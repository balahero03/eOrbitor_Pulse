const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const USERS = {
  vaidy:    'cmpmerto50000jq8q05vj6uzx',
  geetha:   'cmpmertoh0001jq8qmq9bpx8w',
  hema:     'cmpmertok0003jq8q34jv4vx2',
  jeevitha: 'cmpmerton0005jq8qbuij9j0x',
  leo:      'cmpnrb8gl0004u2nfhryewiuj',
  srini:    'cmpnr91j10001u2nf5y11enlf',
  krishnan: 'cmpnr9x7e0002u2nfija0m49f',
};

function resolveAlias(name) {
  const n = name.trim().toLowerCase();
  if (n.startsWith('vaidy') || n === 'vady') return USERS.vaidy;
  if (n.startsWith('geetha')) return USERS.geetha;
  if (n.startsWith('hema')) return USERS.hema;
  if (n.startsWith('jeev') || n === 'jeevi') return USERS.jeevitha;
  if (n === 'leo') return USERS.leo;
  if (n.startsWith('srini')) return USERS.srini;
  if (n.startsWith('krishnan')) return USERS.krishnan;
  return null;
}

// quoteNo -> [assignedToName, broughtByName|null]
const assignments = {
  'QT-26-0001': ['Geetha', null],
  'QT-26-0002': ['Srini', 'Hema'],
  'QT-26-0003': ['Srini', 'Leo'],
  'QT-26-0004': ['Krishnan', null],
  'QT-26-0005': ['Krishnan', null],
  'QT-26-0006': ['Geetha', null],
  'QT-26-0007': ['Jeevitha', null],
  'QT-26-0008': ['Jeevitha', null],
  'QT-26-0009': ['Jeevitha', null],
  'QT-26-0010': ['Jeevitha', null],
  'QT-26-0011': ['Jeevitha', null],
  'QT-26-0012': ['Vaidy', 'Jeevitha'],
  'QT-26-0013': ['Krishnan', null],
  'QT-26-0014': ['Krishnan', null],
  'QT-26-0015': ['Hema', null],
  'QT-26-0016': ['Srini', 'Jeevitha'],
  'QT-26-0017': ['Jeevitha', null],
  'QT-26-0018': ['Srini', null],
  'QT-26-0019': ['Srini', null],
  'QT-26-0020': ['Leo', null],
  'QT-26-0021': ['Leo', null],
  'QT-26-0022': ['Krishnan', null],
  'QT-26-0023': ['Krishnan', null],
  'QT-26-0024': ['Jeevitha', null],
  'QT-26-0025': ['Hema', null],
  'QT-26-0026': ['Hema', null],
  'QT-26-0027': ['Jeevitha', null],
  'QT-26-0028': ['Vaidy', 'Jeevitha'],
  'QT-26-0029': ['Srini', null],
  'QT-26-0030': ['Srini', 'Hema'],
  'QT-26-0031': ['Hema', 'Jeevitha'],
  'QT-26-0032': ['Hema', 'Jeevitha'],
  'QT-26-0033': ['Leo', null],
  'QT-26-0034': ['Srini', 'Leo'],
  'QT-26-0035': ['Hema', null],
  'QT-26-0036': ['Jeevitha', null],
  'QT-26-0037': ['Jeevitha', null],
  'QT-26-0038': ['Jeevitha', null],
  'QT-26-0039': ['Krishnan', null],
  'QT-26-0040': ['Srini', 'Hema'],
  'QT-26-0041': ['Srini', 'Jeevitha'],
  'QT-26-0042': ['Jeevitha', null],
  'QT-26-0043': ['Vaidy', 'Jeevitha'],
  'QT-26-0044': ['Leo', null],
  'QT-26-0045': ['Hema', null],
  'QT-26-0046': ['Srini', null],
  'QT-26-0047': ['Srini', 'Leo'],
  'QT-26-0048': ['Srini', 'Leo'],
  'QT-26-0049': ['Leo', null],
  'QT-26-0050': ['Krishnan', null],
  'QT-26-0051': ['Vaidy', 'Jeevitha'],
  'QT-26-0052': ['Geetha', null],
  'QT-26-0053': ['Leo', null],
  'QT-26-0054': ['Jeevitha', 'Srini'],
  'QT-26-0055': ['Leo', null],
  'QT-26-0056': ['Hema', 'Krishnan'],
  'QT-26-0057': ['Geetha', null],
  'QT-26-0058': ['Geetha', null],
  'QT-26-0059': ['Geetha', null],
  'QT-26-0060': ['Krishnan', 'Hema'],
  'QT-26-0061': ['Krishnan', 'Geetha'],
  'QT-26-0062': ['Hema', null],
  'QT-26-0063': ['Jeevitha', null],
  'QT-26-0064': [null, null],
  'QT-26-0065': ['Jeevitha', null],
  'QT-26-0066': ['Srini', 'Geetha'],
  'QT-26-0067': ['Krishnan', 'Hema'],
  'QT-26-0068': ['Krishnan', 'Hema'],
  'QT-26-0069': ['Jeevitha', null],
  'QT-26-0070': ['Vaidy', 'Jeevitha'],
  'QT-26-0071': ['Hema', null],
  'QT-26-0072': ['Geetha', null],
  'QT-26-0073': ['Geetha', null],
  'QT-26-0074': ['Geetha', null],
  'QT-26-0075': ['Geetha', null],
  'QT-26-0076': ['Geetha', null],
  'QT-26-0077': ['Krishnan', 'Hema'],
  'QT-26-0078': ['Geetha', null],
  'QT-26-0079': ['Geetha', null],
  'QT-26-0080': ['Geetha', null],
  'QT-26-0081': ['Hema', 'Krishnan'],
  'QT-26-0082': ['Geetha', null],
  'QT-26-0083': ['Srini', 'Geetha'],
  'QT-26-0084': ['Geetha', null],
  'QT-26-0085': ['Srini', null],
  'QT-26-0087': ['Krishnan', null],
  'QT-26-0088': ['Geetha', null],
  'QT-26-0090': ['Krishnan', null],
  'QT-26-0091': ['Vaidy', 'Jeevitha'],
  'QT-26-0092': ['Krishnan', null],
  'QT-26-0093': ['Krishnan', 'Hema'],
  'QT-26-0094': ['Krishnan', 'Hema'],
  'QT-26-0095': ['Geetha', null],
  'QT-26-0096': ['Geetha', null],
  'QT-26-0097': ['Krishnan', null],
  'QT-26-0098': ['Leo', null],
  'QT-26-0099': ['Krishnan', null],
  'QT-26-0100': ['Hema', null],
  'QT-26-0101': ['Jeevitha', null],
  'QT-26-0102': ['Hema', null],
  'QT-26-0103': ['Hema', 'Krishnan'],
  'QT-26-0105': ['Jeevitha', null],
  'QT-26-0106': ['Jeevitha', null],
  'QT-26-0107': ['Hema', null],
  'QT-26-0108': ['Hema', null],
  'QT-26-0109': ['Leo', null],
  'QT-26-0110': ['Srini', 'Leo'],
  'QT-26-0111': ['Srini', 'Leo'],
  'QT-26-0112': ['Vaidy', 'Jeevitha'],
  'QT-26-0113': ['Vaidy', 'Jeevitha'],
  'QT-26-0114': ['Srini', 'Leo'],
  'QT-26-0115': ['Krishnan', null],
  'QT-26-0116': ['Krishnan', null],
  'QT-26-0117': ['Krishnan', null],
  'QT-26-0118': ['Krishnan', null],
  'QT-26-0119': ['Krishnan', null],
  'QT-26-0120': ['Hema', null],
  'QT-26-0121': ['Srini', 'Leo'],
  'QT-26-0122': ['Jeevitha', null],
  'QT-26-0123': ['Srini', 'Leo'],
  'QT-26-0124': ['Srini', null],
  'QT-26-0125': ['Hema', null],
  'QT-26-0126': ['Hema', null],
  'QT-26-0127': ['Hema', null],
  'QT-26-0128': ['Geetha', null],
  'QT-26-0129': ['Geetha', null],
  'QT-26-0130': ['Geetha', null],
  'QT-26-0131': ['Vaidy', 'Jeevitha'],
  'QT-26-0132': ['Hema', null],
  'QT-26-0133': ['Vaidy', 'Jeevitha'],
  'QT-26-0134': ['Hema', null],
  'QT-26-0135': ['Vaidy', 'Jeevitha'],
  'QT-26-0136': ['Srini', 'Hema'],
  'QT-26-0137': ['Srini', 'Hema'],
  'QT-26-0138': ['Srini', null],
  'QT-26-0139': ['Srini', null],
  'QT-26-0140': ['Srini', 'Hema'],
  'QT-26-0141': ['Srini', 'Hema'],
  'QT-26-0142': ['Srini', 'Geetha'],
  'QT-26-0143': ['Srini', 'Hema'],
  'QT-26-0144': ['Srini', 'Hema'],
  'QT-26-0145': ['Srini', null],
  'QT-26-0146': ['Srini', null],
  'QT-26-0147': ['Krishnan', null],
  'QT-26-0148': ['Krishnan', null],
  'QT-26-0149': ['Krishnan', null],
  'QT-26-0150': ['Leo', null],
  'QT-26-0151': ['Hema', null],
  'QT-26-0152': ['Vaidy', 'Jeevitha'],
  'QT-26-0153': ['Vaidy', 'Jeevitha'],
  'QT-26-0154': ['Srini', null],
  'QT-26-0155': ['Jeevitha', null],
  'QT-26-0156': ['Vaidy', 'Jeevitha'],
  'QT-26-0157': ['Vaidy', 'Jeevitha'],
  'QT-26-0158': ['Srini', 'Hema'],
  'QT-26-0159': ['Jeevitha', null],
  'QT-26-0160': ['Krishnan', null],
  'QT-26-0161': ['Krishnan', null],
};

async function main() {
  let updated = 0, skipped = 0;

  for (const [quoteNo, [assignedName, broughtName]] of Object.entries(assignments)) {
    const lead = await p.lead.findFirst({ where: { quoteNo }, select: { id: true } });
    if (!lead) { console.log(`NOT FOUND: ${quoteNo}`); skipped++; continue; }

    const assignedToId = assignedName ? resolveAlias(assignedName) : null;
    const broughtById  = broughtName  ? resolveAlias(broughtName)  : null;

    if (!assignedToId && assignedName) {
      console.log(`UNKNOWN user "${assignedName}" for ${quoteNo}`);
      skipped++;
      continue;
    }

    await p.lead.update({
      where: { id: lead.id },
      data: {
        assignedToId: assignedToId || undefined,
        broughtById:  broughtById  || null,
      },
    });
    updated++;
  }

  console.log(`\nDone. Updated: ${updated}, Skipped: ${skipped}`);
  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
