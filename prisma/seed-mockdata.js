const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ─── Helpers ───────────────────────────────────────────────────────────────
function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return d; }
function daysFromNow(n) { const d = new Date(); d.setDate(d.getDate() + n); return d; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function rInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function rDec(min, max) { return parseFloat((Math.random() * (max - min) + min).toFixed(2)); }

function getWorkingDays(count) {
  const days = [];
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  while (days.length < count) {
    d.setDate(d.getDate() - 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) days.push(d.toISOString().split('T')[0]);
  }
  return days;
}

// ─── Static Data ───────────────────────────────────────────────────────────
const SOURCES = ['WEBSITE', 'REFERRAL', 'WALKIN', 'CALL', 'EMAIL', 'ADVERTISEMENT'];
const FOLLOWUP_TYPES = ['CALL', 'EMAIL', 'MEETING', 'WHATSAPP', 'SITE_VISIT'];
const PAYMENT_MODES = ['NEFT', 'CHEQUE', 'CREDIT', 'UPI', 'CASH'];

const SOLUTION_AREAS = [
  'Network Infrastructure', 'Cybersecurity', 'Server & Storage', 'Surveillance',
  'UPS & Power', 'Software Licensing', 'Cloud Solutions', 'Wireless Networking',
  'Data Center', 'SD-WAN', 'Endpoint Security', 'Video Conferencing'
];
const OEM_NAMES = ['Cisco', 'HP', 'Dell', 'Fortinet', 'Hikvision', 'APC', 'VMware', 'Palo Alto', 'Aruba', 'Juniper'];

const OUTCOMES = [
  'Positive response, requesting quote', 'Customer is interested, scheduled demo',
  'Budget confirmation received', 'Decision pending with management',
  'Requested revised pricing', 'Site visit completed, proposal to be sent',
  'WhatsApp discussion — customer evaluating options', 'Email sent with product brochure',
  'Call — left voicemail, will follow up next week', 'Meeting completed, next steps defined',
  'Customer comparing with competitor pricing', 'Technical evaluation in progress',
  'Procurement team involved, formal PO expected', 'Pilot deployment approved',
];
const NEXT_ACTIONS = [
  'Send revised quote', 'Follow-up call next week', 'Schedule demo',
  'Negotiate pricing', 'Send technical specs', 'Arrange site visit',
  'Submit formal proposal', 'Follow up after board meeting',
  'Send reference customer contacts', 'Coordinate with pre-sales team',
];
const CLOSURE_REASONS = {
  LOST: ['Lost to competitor', 'Budget constraints', 'Project postponed', 'Price too high', 'Changed requirements'],
  DROPPED: ['No response after multiple attempts', 'Wrong fit for our solution', 'Contact left company', 'RFQ cancelled'],
  WON: ['Competitive pricing', 'Strong relationship', 'Best technical fit', 'Existing customer expansion'],
  ORDER: ['PO received', 'Order confirmed after negotiation', 'Repeat order from existing customer'],
};

const CITIES = [
  'Chennai, Tamil Nadu', 'Coimbatore, Tamil Nadu', 'Madurai, Tamil Nadu',
  'Trichy, Tamil Nadu', 'Salem, Tamil Nadu', 'Tirunelveli, Tamil Nadu',
  'Vellore, Tamil Nadu', 'Erode, Tamil Nadu', 'Bengaluru, Karnataka',
  'Hyderabad, Telangana', 'Pune, Maharashtra', 'Mumbai, Maharashtra',
];

const PRODUCTS_DATA = [
  { sku: 'CISCO-SW-C9200L', name: 'Cisco Catalyst 9200L 24-Port Switch', category: 'Network Equipment', oemName: 'Cisco', description: '24-port PoE+ managed switch with 4x1G uplinks', basePrice: 185000, tax: 18 },
  { sku: 'CISCO-RTR-C1111', name: 'Cisco 1111 Series Integrated Services Router', category: 'Network Equipment', oemName: 'Cisco', description: 'Dual GE WAN router with integrated security', basePrice: 95000, tax: 18 },
  { sku: 'CISCO-SW-C9300', name: 'Cisco Catalyst 9300 48-Port Switch', category: 'Network Equipment', oemName: 'Cisco', description: '48-port full PoE stackable switch', basePrice: 320000, tax: 18 },
  { sku: 'HP-SRV-DL380G10', name: 'HPE ProLiant DL380 Gen10 Server', category: 'Servers', oemName: 'HP', description: '2U rack server, 2x Xeon Silver 4210, 64GB RAM', basePrice: 420000, tax: 18 },
  { sku: 'HP-LPT-PROBOOK', name: 'HP ProBook 450 G10 Laptop', category: 'Servers', oemName: 'HP', description: '15.6" laptop, i5-1335U, 16GB, 512GB SSD', basePrice: 72000, tax: 18 },
  { sku: 'HP-MSA-2060', name: 'HPE MSA 2060 SAN Storage Array', category: 'Storage', oemName: 'HP', description: '12LFF dual controller SAN storage', basePrice: 650000, tax: 18 },
  { sku: 'DELL-SRV-R750', name: 'Dell PowerEdge R750 2U Server', category: 'Servers', oemName: 'Dell', description: '2U server, 2x Xeon Gold 5318Y, 128GB RAM', basePrice: 510000, tax: 18 },
  { sku: 'DELL-DKT-OPT7090', name: 'Dell OptiPlex 7090 Mini Tower', category: 'Servers', oemName: 'Dell', description: 'Desktop PC, i7-11700, 16GB, 512GB SSD', basePrice: 68000, tax: 18 },
  { sku: 'DELL-ME5-012', name: 'Dell EMC PowerVault ME5012 Storage', category: 'Storage', oemName: 'Dell', description: '12-bay hybrid SAN/NAS storage', basePrice: 780000, tax: 18 },
  { sku: 'FORT-FG-100F', name: 'Fortinet FortiGate 100F Next-Gen Firewall', category: 'Security', oemName: 'Fortinet', description: '20Gbps firewall with IPS/IDS and SSL inspection', basePrice: 275000, tax: 18 },
  { sku: 'FORT-FG-40F', name: 'Fortinet FortiGate 40F NGFW', category: 'Security', oemName: 'Fortinet', description: 'Small office firewall, 5Gbps throughput', basePrice: 85000, tax: 18 },
  { sku: 'FORT-FWAN-200', name: 'Fortinet FortiWAN 200B SD-WAN Appliance', category: 'Security', oemName: 'Fortinet', description: 'SD-WAN with link load balancing', basePrice: 145000, tax: 18 },
  { sku: 'HIK-DS-2CD2-4MP', name: 'Hikvision DS-2CD2143G2 4MP IP Camera', category: 'Surveillance', oemName: 'Hikvision', description: '4MP outdoor dome IP camera, IR 40m', basePrice: 8500, tax: 18 },
  { sku: 'HIK-DS-NVR16', name: 'Hikvision DS-7716NI-I4 16-Ch NVR', category: 'Surveillance', oemName: 'Hikvision', description: '16-channel NVR with 4 SATA bays, 4K output', basePrice: 32000, tax: 18 },
  { sku: 'HIK-NAS-4BAY', name: 'Hikvision 4-Bay NAS Enclosure 4TB', category: 'Storage', oemName: 'Hikvision', description: '4-bay NAS with 4TB HDD, RAID 0/1/5/10', basePrice: 45000, tax: 18 },
  { sku: 'APC-SMT1500I', name: 'APC Smart-UPS 1500VA LCD 230V', category: 'UPS/Power', oemName: 'APC', description: '1500VA/1000W line-interactive UPS, LCD panel', basePrice: 28000, tax: 18 },
  { sku: 'APC-SRT3000', name: 'APC Smart-UPS SRT 3000VA 230V', category: 'UPS/Power', oemName: 'APC', description: '3000VA online double-conversion UPS', basePrice: 68000, tax: 18 },
  { sku: 'APC-SYMMETRA16K', name: 'APC Symmetra LX 16kVA UPS', category: 'UPS/Power', oemName: 'APC', description: 'Scalable 16kVA three-phase UPS for data centers', basePrice: 420000, tax: 18 },
  { sku: 'VMW-VSPHERE8', name: 'VMware vSphere 8 Essentials Plus Kit', category: 'Software', oemName: 'VMware', description: '3-host license with vCenter, 1-year SnS', basePrice: 180000, tax: 18 },
  { sku: 'VMW-NSX-T', name: 'VMware NSX-T Data Center Standard', category: 'Software', oemName: 'VMware', description: 'Network virtualization and micro-segmentation', basePrice: 520000, tax: 18 },
  { sku: 'PALO-PA-820', name: 'Palo Alto PA-820 Next-Gen Firewall', category: 'Security', oemName: 'Palo Alto', description: '940Mbps NGFW with App-ID and User-ID', basePrice: 385000, tax: 18 },
  { sku: 'PALO-PANORAMA', name: 'Palo Alto Panorama Network Security Manager', category: 'Security', oemName: 'Palo Alto', description: 'Centralized management for Palo Alto NGFWs', basePrice: 220000, tax: 18 },
  { sku: 'PALO-CORTEX-XDR', name: 'Palo Alto Cortex XDR Pro per Endpoint', category: 'Software', oemName: 'Palo Alto', description: 'AI-powered endpoint detection and response', basePrice: 3500, tax: 18 },
  { sku: 'ARU-AP-514', name: 'Aruba AP-514 802.11ax Dual-Band WAP', category: 'Network Equipment', oemName: 'Aruba', description: 'Wi-Fi 6 indoor access point, 4x4 MIMO', basePrice: 35000, tax: 18 },
  { sku: 'ARU-CX-6300M', name: 'Aruba CX 6300M 24G Switch', category: 'Network Equipment', oemName: 'Aruba', description: '24-port multi-gig PoE switch with 4x25G uplinks', basePrice: 155000, tax: 18 },
  { sku: 'ARU-AIRWAVE', name: 'Aruba AirWave Network Management 1-year', category: 'Software', oemName: 'Aruba', description: 'Unified wired/wireless network management', basePrice: 95000, tax: 18 },
  { sku: 'JUN-SRX345', name: 'Juniper SRX345 Services Gateway', category: 'Security', oemName: 'Juniper', description: '5Gbps firewall with UTM, SD-WAN ready', basePrice: 175000, tax: 18 },
  { sku: 'JUN-EX4300-48', name: 'Juniper EX4300 48-Port GbE Switch', category: 'Network Equipment', oemName: 'Juniper', description: '48-port stackable switch with 4x40G QSFP+', basePrice: 210000, tax: 18 },
];

const CUSTOMERS_DATA = [
  {
    companyName: 'Novac Technology Solutions Pvt Ltd', gstNumber: '33AABCN1234A1Z5',
    industry: 'IT Services', website: 'https://novac.com', annualRevenue: 52000000, yearEstablished: 2005,
    customerCategory: 'ACTIVE',
    billingAddress: { street: '12 Old Mahabalipuram Road', city: 'Chennai', state: 'Tamil Nadu', pincode: '600096' },
    shippingAddress: { street: '12 Old Mahabalipuram Road', city: 'Chennai', state: 'Tamil Nadu', pincode: '600096' },
    contacts: [
      { name: 'Rajesh Kumar', email: 'rajesh.kumar@novac.com', phone: '9841001001', designation: 'IT Manager', isPrimary: true },
      { name: 'Priya Venkat', email: 'priya.venkat@novac.com', phone: '9841001002', designation: 'Procurement Head', isPrimary: false },
    ]
  },
  {
    companyName: 'Indian Additives Ltd', gstNumber: '33AABCI2345B1Z3',
    industry: 'Manufacturing', website: 'https://indianadditives.com', annualRevenue: 850000000, yearEstablished: 1985,
    customerCategory: 'ACTIVE',
    billingAddress: { street: '24 Manali Industrial Estate', city: 'Chennai', state: 'Tamil Nadu', pincode: '600068' },
    shippingAddress: { street: '24 Manali Industrial Estate', city: 'Chennai', state: 'Tamil Nadu', pincode: '600068' },
    contacts: [
      { name: 'Suresh Babu', email: 'suresh.b@indianadditives.com', phone: '9841002001', designation: 'Head IT', isPrimary: true },
      { name: 'Kavitha M', email: 'kavitha.m@indianadditives.com', phone: '9841002002', designation: 'Systems Admin', isPrimary: false },
    ]
  },
  {
    companyName: 'Ashok Leyland Ltd', gstNumber: '33AABCA3456C1Z7',
    industry: 'Manufacturing', website: 'https://ashokleyland.com', annualRevenue: 5000000000, yearEstablished: 1948,
    customerCategory: 'ACTIVE',
    billingAddress: { street: '1 Sardar Patel Road, Guindy', city: 'Chennai', state: 'Tamil Nadu', pincode: '600032' },
    shippingAddress: { street: '1 Sardar Patel Road, Guindy', city: 'Chennai', state: 'Tamil Nadu', pincode: '600032' },
    contacts: [
      { name: 'Arun Krishnamurthy', email: 'arun.k@ashokleyland.com', phone: '9841003001', designation: 'GM - IT Infrastructure', isPrimary: true },
      { name: 'Deepika S', email: 'deepika.s@ashokleyland.com', phone: '9841003002', designation: 'Network Engineer', isPrimary: false },
    ]
  },
  {
    companyName: 'Sankara Nethralaya', gstNumber: '33AABCS4567D1Z1',
    industry: 'Healthcare', website: 'https://sankaranethralaya.org', annualRevenue: 200000000, yearEstablished: 1978,
    customerCategory: 'ACTIVE',
    billingAddress: { street: '18 College Road, Nungambakkam', city: 'Chennai', state: 'Tamil Nadu', pincode: '600006' },
    shippingAddress: { street: '18 College Road, Nungambakkam', city: 'Chennai', state: 'Tamil Nadu', pincode: '600006' },
    contacts: [
      { name: 'Dr. Venkatesh R', email: 'venkatesh.r@sankaranethralaya.org', phone: '9841004001', designation: 'IT Director', isPrimary: true },
      { name: 'Meena S', email: 'meena.s@sankaranethralaya.org', phone: '9841004002', designation: 'Systems Manager', isPrimary: false },
    ]
  },
  {
    companyName: 'IIT Madras', gstNumber: '33AABCI5678E1Z9',
    industry: 'Education', website: 'https://iitm.ac.in', annualRevenue: 1000000000, yearEstablished: 1959,
    customerCategory: 'ACTIVE',
    billingAddress: { street: 'IIT Campus, Sardar Patel Road', city: 'Chennai', state: 'Tamil Nadu', pincode: '600036' },
    shippingAddress: { street: 'IIT Campus, Sardar Patel Road', city: 'Chennai', state: 'Tamil Nadu', pincode: '600036' },
    contacts: [
      { name: 'Prof. Raghunathan', email: 'raghu@iitm.ac.in', phone: '9841005001', designation: 'Head - IT Services', isPrimary: true },
      { name: 'Siva Kumar', email: 'sivak@iitm.ac.in', phone: '9841005002', designation: 'Network Administrator', isPrimary: false },
    ]
  },
  {
    companyName: 'Equitas Small Finance Bank', gstNumber: '33AABCE6789F1Z4',
    industry: 'Finance', website: 'https://equitasbank.com', annualRevenue: 3000000000, yearEstablished: 2007,
    customerCategory: 'ACTIVE',
    billingAddress: { street: '4 SSP Buildings, Chetpet', city: 'Chennai', state: 'Tamil Nadu', pincode: '600031' },
    shippingAddress: { street: '4 SSP Buildings, Chetpet', city: 'Chennai', state: 'Tamil Nadu', pincode: '600031' },
    contacts: [
      { name: 'Karthik Rajan', email: 'karthik.r@equitasbank.com', phone: '9841006001', designation: 'VP - Technology', isPrimary: true },
      { name: 'Anitha D', email: 'anitha.d@equitasbank.com', phone: '9841006002', designation: 'IT Security Manager', isPrimary: false },
      { name: 'Balu S', email: 'balu.s@equitasbank.com', phone: '9841006003', designation: 'Infrastructure Lead', isPrimary: false },
    ]
  },
  {
    companyName: 'Ramraj Cotton Pvt Ltd', gstNumber: '33AABCR7890G1Z8',
    industry: 'Retail', website: 'https://ramrajcotton.in', annualRevenue: 500000000, yearEstablished: 1992,
    customerCategory: 'ACTIVE',
    billingAddress: { street: '32 Usman Road, T Nagar', city: 'Chennai', state: 'Tamil Nadu', pincode: '600017' },
    shippingAddress: { street: '45 Industrial Estate', city: 'Karur', state: 'Tamil Nadu', pincode: '639002' },
    contacts: [
      { name: 'Muthuswami R', email: 'muthu.r@ramrajcotton.in', phone: '9841007001', designation: 'IT Head', isPrimary: true },
    ]
  },
  {
    companyName: 'Tagros Chemicals India Pvt Ltd', gstNumber: '33AABCT8901H1Z2',
    industry: 'Manufacturing', website: 'https://tagros.com', annualRevenue: 400000000, yearEstablished: 1995,
    customerCategory: 'ACTIVE',
    billingAddress: { street: '37 Cathedral Road', city: 'Chennai', state: 'Tamil Nadu', pincode: '600086' },
    shippingAddress: { street: 'Plot 12, SIPCOT Industrial Area', city: 'Cuddalore', state: 'Tamil Nadu', pincode: '607005' },
    contacts: [
      { name: 'Ravi Shankar', email: 'ravi.s@tagros.com', phone: '9841008001', designation: 'Systems Manager', isPrimary: true },
      { name: 'Geetha P', email: 'geetha.p@tagros.com', phone: '9841008002', designation: 'IT Executive', isPrimary: false },
    ]
  },
  {
    companyName: 'Malabar Gold and Diamonds', gstNumber: '32AABCM9012I1Z6',
    industry: 'Retail', website: 'https://malabargold.com', annualRevenue: 10000000000, yearEstablished: 1993,
    customerCategory: 'ACTIVE',
    billingAddress: { street: '15 Anna Salai', city: 'Chennai', state: 'Tamil Nadu', pincode: '600002' },
    shippingAddress: { street: '15 Anna Salai', city: 'Chennai', state: 'Tamil Nadu', pincode: '600002' },
    contacts: [
      { name: 'Shams Mohamed', email: 'shams.m@malabargold.com', phone: '9841009001', designation: 'Regional IT Manager', isPrimary: true },
    ]
  },
  {
    companyName: 'Pearl Global Industries Ltd', gstNumber: '33AABCP1023J1Z0',
    industry: 'Logistics', website: 'https://pearlglobal.com', annualRevenue: 2000000000, yearEstablished: 1987,
    customerCategory: 'ACTIVE',
    billingAddress: { street: '2nd Floor, SPIC House, Nungambakkam', city: 'Chennai', state: 'Tamil Nadu', pincode: '600034' },
    shippingAddress: { street: 'Warehouse Complex, Ambattur', city: 'Chennai', state: 'Tamil Nadu', pincode: '600053' },
    contacts: [
      { name: 'Vijay Anand', email: 'vijay.a@pearlglobal.com', phone: '9841010001', designation: 'IT Operations Head', isPrimary: true },
      { name: 'Saranya K', email: 'saranya.k@pearlglobal.com', phone: '9841010002', designation: 'Network Engineer', isPrimary: false },
    ]
  },
  {
    companyName: 'Zoho Corporation Pvt Ltd', gstNumber: '33AABCZ2034K1Z5',
    industry: 'IT Services', website: 'https://zoho.com', annualRevenue: 50000000000, yearEstablished: 1996,
    customerCategory: 'ACTIVE',
    billingAddress: { street: 'Estancia IT Park, Kancheepuram', city: 'Chennai', state: 'Tamil Nadu', pincode: '600028' },
    shippingAddress: { street: 'Estancia IT Park, Kancheepuram', city: 'Chennai', state: 'Tamil Nadu', pincode: '600028' },
    contacts: [
      { name: 'Manikandan S', email: 'manikandan.s@zoho.com', phone: '9841011001', designation: 'IT Infrastructure Lead', isPrimary: true },
    ]
  },
  {
    companyName: 'Fujitsu Network Communications India', gstNumber: '33AABCF3045L1Z3',
    industry: 'IT Services', website: 'https://fujitsu.com/in', annualRevenue: 1500000000, yearEstablished: 2000,
    customerCategory: 'ACTIVE',
    billingAddress: { street: 'Prestige Technology Park, Sholinganallur', city: 'Chennai', state: 'Tamil Nadu', pincode: '600119' },
    shippingAddress: { street: 'Prestige Technology Park, Sholinganallur', city: 'Chennai', state: 'Tamil Nadu', pincode: '600119' },
    contacts: [
      { name: 'Naresh Babu', email: 'naresh.b@fujitsu.com', phone: '9841012001', designation: 'Head - IT Procurement', isPrimary: true },
    ]
  },
  {
    companyName: 'Yanmar India Pvt Ltd', gstNumber: '33AABCY4056M1Z7',
    industry: 'Manufacturing', website: 'https://yanmar.com/in', annualRevenue: 3000000000, yearEstablished: 2001,
    customerCategory: 'PROSPECT',
    billingAddress: { street: 'Plot 34, SIPCOT IT Park', city: 'Chennai', state: 'Tamil Nadu', pincode: '600097' },
    shippingAddress: { street: 'Plot 34, SIPCOT IT Park', city: 'Chennai', state: 'Tamil Nadu', pincode: '600097' },
    contacts: [
      { name: 'Hiroshi Tanaka', email: 'hiroshi.t@yanmar.com', phone: '9841013001', designation: 'IT Manager', isPrimary: true },
    ]
  },
  {
    companyName: 'L&T Technology Services Ltd', gstNumber: '27AABCL5067N1Z4',
    industry: 'IT Services', website: 'https://ltts.com', annualRevenue: 80000000000, yearEstablished: 1997,
    customerCategory: 'ACTIVE',
    billingAddress: { street: 'L&T Technology Park, Manapakkam', city: 'Chennai', state: 'Tamil Nadu', pincode: '600089' },
    shippingAddress: { street: 'L&T Technology Park, Manapakkam', city: 'Chennai', state: 'Tamil Nadu', pincode: '600089' },
    contacts: [
      { name: 'Ganesh Moorthy', email: 'ganesh.m@ltts.com', phone: '9841014001', designation: 'VP - Infrastructure', isPrimary: true },
      { name: 'Kavitha Nair', email: 'kavitha.n@ltts.com', phone: '9841014002', designation: 'IT Procurement Manager', isPrimary: false },
    ]
  },
  {
    companyName: 'SRM Technologies Ltd', gstNumber: '33AABCS6078O1Z8',
    industry: 'Education', website: 'https://srmtechnologies.com', annualRevenue: 200000000, yearEstablished: 2003,
    customerCategory: 'PROSPECT',
    billingAddress: { street: 'SRM Nagar, Kattankulathur', city: 'Kanchipuram', state: 'Tamil Nadu', pincode: '603203' },
    shippingAddress: { street: 'SRM Nagar, Kattankulathur', city: 'Kanchipuram', state: 'Tamil Nadu', pincode: '603203' },
    contacts: [
      { name: 'Dr. Senthil Kumar', email: 'senthil.k@srmtechnologies.com', phone: '9841015001', designation: 'Director - IT', isPrimary: true },
    ]
  },
  {
    companyName: 'VBJ and Brothers Jewellers', gstNumber: '33AABCV7089P1Z2',
    industry: 'Retail', website: 'https://vbjjewellers.com', annualRevenue: 800000000, yearEstablished: 1975,
    customerCategory: 'INACTIVE',
    billingAddress: { street: '113 Usman Road, T Nagar', city: 'Chennai', state: 'Tamil Nadu', pincode: '600017' },
    shippingAddress: { street: '113 Usman Road, T Nagar', city: 'Chennai', state: 'Tamil Nadu', pincode: '600017' },
    contacts: [
      { name: 'Ramkumar B', email: 'ramkumar.b@vbjjewellers.com', phone: '9841016001', designation: 'IT Head', isPrimary: true },
    ]
  },
  {
    companyName: 'Taurus Quest Pvt Ltd', gstNumber: '33AABCT8090Q1Z6',
    industry: 'IT Services', website: 'https://taurusquest.com', annualRevenue: 150000000, yearEstablished: 2008,
    customerCategory: 'ACTIVE',
    billingAddress: { street: '12 Rajiv Gandhi Salai, Perungudi', city: 'Chennai', state: 'Tamil Nadu', pincode: '600096' },
    shippingAddress: { street: '12 Rajiv Gandhi Salai, Perungudi', city: 'Chennai', state: 'Tamil Nadu', pincode: '600096' },
    contacts: [
      { name: 'Sathish Kumar', email: 'sathish.k@taurusquest.com', phone: '9841017001', designation: 'CTO', isPrimary: true },
    ]
  },
  {
    companyName: 'KP Manish and Associates', gstNumber: '33AABCK9001R1Z5',
    industry: 'IT Services', website: 'https://kpmanish.com', annualRevenue: 80000000, yearEstablished: 2011,
    customerCategory: 'ACTIVE',
    billingAddress: { street: '3rd Floor, KP Tower, Anna Nagar', city: 'Chennai', state: 'Tamil Nadu', pincode: '600040' },
    shippingAddress: { street: '3rd Floor, KP Tower, Anna Nagar', city: 'Chennai', state: 'Tamil Nadu', pincode: '600040' },
    contacts: [
      { name: 'Manish Patel', email: 'manish.p@kpmanish.com', phone: '9841018001', designation: 'CEO', isPrimary: true },
      { name: 'Lekha R', email: 'lekha.r@kpmanish.com', phone: '9841018002', designation: 'Operations Manager', isPrimary: false },
    ]
  },
  {
    companyName: 'Ashley Alteams India Pvt Ltd', gstNumber: '33AABCA0012S1Z3',
    industry: 'Manufacturing', website: 'https://ashleyalteams.com', annualRevenue: 600000000, yearEstablished: 1993,
    customerCategory: 'ACTIVE',
    billingAddress: { street: 'SIPCOT Industrial Complex', city: 'Hosur', state: 'Tamil Nadu', pincode: '635109' },
    shippingAddress: { street: 'SIPCOT Industrial Complex', city: 'Hosur', state: 'Tamil Nadu', pincode: '635109' },
    contacts: [
      { name: 'Dinesh Kumar', email: 'dinesh.k@ashleyalteams.com', phone: '9841019001', designation: 'IT Manager', isPrimary: true },
    ]
  },
  {
    companyName: 'Green Pearl IT Solutions Pvt Ltd', gstNumber: '33AABCG1023T1Z9',
    industry: 'IT Services', website: 'https://greenpearlit.com', annualRevenue: 60000000, yearEstablished: 2014,
    customerCategory: 'PROSPECT',
    billingAddress: { street: 'DLF Cyber City, Manapakkam', city: 'Chennai', state: 'Tamil Nadu', pincode: '600089' },
    shippingAddress: { street: 'DLF Cyber City, Manapakkam', city: 'Chennai', state: 'Tamil Nadu', pincode: '600089' },
    contacts: [
      { name: 'Pradeep Nair', email: 'pradeep.n@greenpearlit.com', phone: '9841020001', designation: 'Technical Director', isPrimary: true },
    ]
  },
  {
    companyName: 'Arvos Group India Pvt Ltd', gstNumber: '33AABCA2034U1Z1',
    industry: 'Manufacturing', website: 'https://arvosgroup.com', annualRevenue: 900000000, yearEstablished: 1990,
    customerCategory: 'ACTIVE',
    billingAddress: { street: '4 South Phase, SIDCO Industrial Estate', city: 'Chennai', state: 'Tamil Nadu', pincode: '600098' },
    shippingAddress: { street: '4 South Phase, SIDCO Industrial Estate', city: 'Chennai', state: 'Tamil Nadu', pincode: '600098' },
    contacts: [
      { name: 'Thomas Mathew', email: 'thomas.m@arvosgroup.com', phone: '9841021001', designation: 'Head - IT & Systems', isPrimary: true },
      { name: 'Sunita R', email: 'sunita.r@arvosgroup.com', phone: '9841021002', designation: 'IT Coordinator', isPrimary: false },
    ]
  },
  {
    companyName: 'Algihaz Holding India Pvt Ltd', gstNumber: '33AABCA3045V1Z0',
    industry: 'Finance', website: 'https://algihaz.com', annualRevenue: 1200000000, yearEstablished: 2006,
    customerCategory: 'PROSPECT',
    billingAddress: { street: 'Tidel Park, Taramani', city: 'Chennai', state: 'Tamil Nadu', pincode: '600113' },
    shippingAddress: { street: 'Tidel Park, Taramani', city: 'Chennai', state: 'Tamil Nadu', pincode: '600113' },
    contacts: [
      { name: 'Riyaz Ahmed', email: 'riyaz.a@algihaz.com', phone: '9841022001', designation: 'VP - Technology', isPrimary: true },
    ]
  },
];

// Lead templates — name, company, designation, area, source hints
const LEAD_COMPANIES = [
  'Hexaware Technologies', 'Cognizant Technology', 'Infosys BPM', 'Wipro Infrastructure',
  'HCL Technologies', 'Mphasis Ltd', 'Syntel India', 'NIIT Technologies',
  'Mastech Holdings', 'Cyient Ltd', 'Hexagon India', 'Mindtree Limited',
  'Apollo Hospitals', 'Fortis Healthcare', 'Manipal Health', 'Aster DM Healthcare',
  'Ramco Systems', 'Nucleus Software', 'Sonata Software', 'Mastech Digital',
  'Bharat Petroleum', 'Indian Oil Corporation', 'ONGC Ltd', 'BPCL Chennai',
  'SBI Life Insurance', 'HDFC Ergo Insurance', 'LIC Housing Finance', 'Kotak Mahindra',
  'TVS Motor Company', 'MRF Tyres Ltd', 'Brakes India Ltd', 'Lucas TVS',
  'Chennai Port Trust', 'Ennore Port Ltd', 'JNPT Mumbai', 'Paradip Port',
  'BSNL Tamil Nadu', 'Airtel Business', 'Jio Enterprise', 'TATA Teleservices',
  'Titan Industries', 'Tanishq Jewellery', 'Kalyan Jewellers', 'GRT Jewellers',
  'Spencer Retail', 'More Retail', 'Reliance Retail', 'Future Group Retail',
  'Sahasra Electronics', 'Veeyes Telecom', 'Krishna Technology', 'Navya Solutions',
  'Accel Frontline', 'Microland Ltd', 'Sify Technologies', 'NTT India',
  'Brigade Enterprises', 'DLF Ltd Chennai', 'Prestige Estates', 'Godrej Properties',
  'Cholan Hotels', 'ITC Grand Chola', 'Radisson Blu Chennai', 'Marriott Chennai',
  'Coromandel International', 'Madras Fertilizers', 'SPIC Ltd', 'EID Parry',
  'Sundaram Finance', 'Murugappa Group', 'Tube Investments', 'Cholamandalam',
  'Niva Bupa Health', 'Star Health Insurance', 'United India Insurance', 'New India Assurance',
];

const LEAD_NAMES = [
  'Anand Krishnan', 'Balaji Ramaswamy', 'Chandrasekhar V', 'Deepak Muthukrishnan',
  'Eswaran Natarajan', 'Farooq Hussain', 'Girish Karthik', 'Harish Selvaraj',
  'Imran Ali', 'Jagannathan S', 'Karthikeyan R', 'Lakshmi Priya',
  'Muthu Velavan', 'Nagarajan K', 'Ojas Sharma', 'Prasanna Kumar',
  'Qureshi Raza', 'Ramachandran B', 'Sundar Pichai', 'Thiyagarajan P',
  'Uma Devi', 'Venkataraman S', 'Wasim Aktar', 'Xavier Rodrigues',
  'Yogesh Balaji', 'Zubair Hasan', 'Anitha Gopal', 'Brindha Nair',
  'Chitra Ravi', 'Divya Menon', 'Elango M', 'Fathima Begum',
  'Ganesh Prabhu', 'Hema Sundaram', 'Indira Devi', 'Janani Krishnamurthy',
  'Kalaiselvi T', 'Lavanya Srinivasan', 'Meenakshi Iyer', 'Nithya Rajan',
  'Padmanabhan S', 'Raja Sekhar', 'Sanjay Mehta', 'Tamil Selvan',
  'Usha Krishnan', 'Vimal Anand', 'William Joseph', 'Yashwanth D',
];

const DESIGNATIONS = [
  'IT Manager', 'Head of IT', 'CTO', 'VP Technology', 'Systems Administrator',
  'Network Engineer', 'Procurement Manager', 'IT Director', 'Technical Head',
  'Infrastructure Manager', 'IT Executive', 'DGM - IT', 'GM - Systems',
];

const REMARKS_BY_STAGE = {
  NEW: ['Lead received via website inquiry', 'Inbound call regarding network upgrade', 'Reference from existing customer'],
  CONTACTED: ['Initial call made, customer interested', 'Sent product catalogue via email', 'WhatsApp enquiry responded'],
  QUALIFIED: ['Requirements discussed, matches our product portfolio', 'Decision maker identified', 'Budget range confirmed'],
  SUSPECT: ['Potential opportunity — needs further qualification', 'Received RFQ, evaluating requirements', 'Initial discussion done'],
  PROSPECT: ['Quote submitted, awaiting feedback', 'Customer reviewing proposal', 'Demo scheduled for next week'],
  PROPOSAL: ['Detailed presentation done', 'Technical demo completed successfully', 'Pilot deployment being discussed'],
  NEGOTIATION: ['Negotiating on price and payment terms', 'Customer comparing with 2 other vendors', 'Final decision pending'],
  CLOSURE: ['Final approval with management', 'PO expected this week', 'Last round of pricing discussion'],
  ON_HOLD: ['Customer budget frozen till Q3', 'Project postponed due to internal restructuring', 'On hold pending board approval'],
};

// ─── Seed Functions ─────────────────────────────────────────────────────────

async function seedProducts() {
  console.log('\n--- Seeding Products ---');
  let count = 0;
  for (const p of PRODUCTS_DATA) {
    await prisma.product.upsert({
      where: { sku: p.sku },
      update: { name: p.name, basePrice: p.basePrice, isActive: true },
      create: {
        sku: p.sku, name: p.name, category: p.category, oemName: p.oemName,
        description: p.description, basePrice: p.basePrice, tax: p.tax, isActive: true,
        inventory: {
          create: {
            quantity: rInt(5, 80),
            reorderLevel: rInt(3, 15),
            warehouseLocation: pick(['Rack-A1', 'Rack-A2', 'Rack-B1', 'Rack-B2', 'Rack-C1', 'Shelf-D1', 'Shelf-E2']),
            lastRestockDate: daysAgo(rInt(5, 60)),
            lastRestockQuantity: rInt(10, 50),
          }
        }
      }
    });
    count++;
  }
  console.log(`  ✓ ${count} products with inventory`);
}

async function seedCustomers() {
  console.log('\n--- Seeding Customers ---');
  const customerMap = {};
  for (const c of CUSTOMERS_DATA) {
    const { contacts, ...data } = c;
    const customer = await prisma.customer.upsert({
      where: { gstNumber: c.gstNumber },
      update: { companyName: c.companyName, customerCategory: c.customerCategory },
      create: data,
    });
    for (const contact of contacts) {
      const existing = await prisma.contact.findFirst({ where: { customerId: customer.id, email: contact.email } });
      if (!existing) await prisma.contact.create({ data: { ...contact, customerId: customer.id } });
    }
    customerMap[c.companyName] = customer;
  }
  console.log(`  ✓ ${Object.keys(customerMap).length} customers with contacts`);
  return customerMap;
}

async function seedDeals(users, customerMap) {
  console.log('\n--- Seeding Deals ---');
  const execs = [users.hema, users.jeevitha];
  const customers = Object.values(customerMap);
  const stages = ['SUSPECT', 'PROSPECT', 'APPROACH', 'NEGOTIATION', 'CLOSURE', 'ONGOING'];
  const winProbs = { SUSPECT: 10, PROSPECT: 25, APPROACH: 40, NEGOTIATION: 60, CLOSURE: 80, ONGOING: 95 };
  const dealTemplates = [
    'Network Infrastructure Upgrade', 'Firewall & Security Overhaul', 'Server Consolidation Project',
    'Surveillance System Deployment', 'UPS and Power Backup', 'Wi-Fi Expansion Project',
    'Data Center Setup', 'Endpoint Security Rollout', 'Storage Expansion',
    'Video Conferencing Solution', 'SD-WAN Implementation', 'Cloud Readiness Assessment',
  ];

  const deals = [];
  for (let i = 0; i < 38; i++) {
    const customer = customers[i % customers.length];
    const exec = execs[i % 2];
    const stage = stages[i % stages.length];
    const dealValue = rDec(200000, 6000000);
    const deal = await prisma.deal.create({
      data: {
        customerId: customer.id,
        dealName: `${customer.companyName.split(' ').slice(0,2).join(' ')} - ${dealTemplates[i % dealTemplates.length]}`,
        dealValue,
        stage,
        winProbability: winProbs[stage],
        assignedToId: exec.id,
        expectedCloseDate: stage === 'ONGOING' ? daysAgo(rInt(5, 30)) : daysFromNow(rInt(15, 120)),
        closedAt: stage === 'ONGOING' ? daysAgo(rInt(1, 30)) : null,
        nextAction: pick(NEXT_ACTIONS),
      }
    });
    deals.push(deal);
  }
  console.log(`  ✓ ${deals.length} deals`);
  return deals;
}

async function seedLeads(users, customerMap) {
  console.log('\n--- Seeding Leads ---');
  const execs = [users.hema, users.jeevitha];
  const customers = Object.values(customerMap);
  const activeCustomers = customers.filter(c => c.customerCategory === 'ACTIVE');

  // Stage distribution targets
  const stagePlan = [
    { status: 'NEW', count: 12 },
    { status: 'CONTACTED', count: 12 },
    { status: 'QUALIFIED', count: 12 },
    { status: 'SUSPECT', count: 30 },
    { status: 'PROSPECT', count: 28 },
    { status: 'PROPOSAL', count: 22 },
    { status: 'NEGOTIATION', count: 18 },
    { status: 'CLOSURE', count: 15 },
    { status: 'WON', count: 20 },
    { status: 'LOST', count: 22 },
    { status: 'DROPPED', count: 16 },
    { status: 'ON_HOLD', count: 12 },
    { status: 'ORDER', count: 12 },
  ];

  const closedStatuses = ['WON', 'LOST', 'DROPPED', 'ORDER'];
  const leads = [];
  let qCounter = 1;

  for (const { status, count } of stagePlan) {
    const isClosed = closedStatuses.includes(status);
    const hasQuote = !['NEW', 'CONTACTED', 'QUALIFIED'].includes(status);

    for (let i = 0; i < count; i++) {
      const qNo = `LD-2026-${String(qCounter).padStart(4, '0')}`;
      qCounter++;

      const existing = await prisma.lead.findFirst({ where: { quoteNo: qNo } });
      if (existing) { leads.push(existing); continue; }

      const exec = execs[(qCounter) % 2];
      const company = LEAD_COMPANIES[(qCounter * 3) % LEAD_COMPANIES.length];
      const name = LEAD_NAMES[(qCounter * 7) % LEAD_NAMES.length];
      const designation = DESIGNATIONS[(qCounter * 5) % DESIGNATIONS.length];
      const source = SOURCES[(qCounter) % SOURCES.length];
      const oemSet = [OEM_NAMES[qCounter % OEM_NAMES.length], OEM_NAMES[(qCounter + 3) % OEM_NAMES.length]];
      const solAreas = [SOLUTION_AREAS[qCounter % SOLUTION_AREAS.length], SOLUTION_AREAS[(qCounter + 4) % SOLUTION_AREAS.length]];
      const remarks = pick(REMARKS_BY_STAGE[status] || REMARKS_BY_STAGE['SUSPECT']);

      const quoteValue = hasQuote ? rDec(80000, 4500000) : null;
      const rfqDate = hasQuote ? daysAgo(rInt(5, 120)) : null;
      const followUpDate = !isClosed ? daysFromNow(rInt(1, 21)) : null;
      const expectedClosureDate = ['NEGOTIATION', 'CLOSURE'].includes(status) ? daysFromNow(rInt(5, 45)) : hasQuote ? daysFromNow(rInt(20, 90)) : null;
      const closedAt = isClosed ? daysAgo(rInt(1, 90)) : null;
      const closureReason = isClosed ? pick(CLOSURE_REASONS[status] || []) : null;
      const linkedCustomerId = status === 'WON' ? activeCustomers[i % activeCustomers.length].id : null;
      const poReceivedDate = status === 'ORDER' ? daysAgo(rInt(1, 30)) : null;

      const lead = await prisma.lead.create({
        data: {
          name,
          email: `${name.split(' ')[0].toLowerCase()}.${name.split(' ')[1]?.toLowerCase() || 'contact'}@${company.toLowerCase().replace(/[^a-z0-9]/g, '')}.local`,
          phone: `9${rInt(600000000, 999999999)}`,
          company,
          address: pick(CITIES),
          source,
          status,
          leadScore: rInt(1, 10),
          assignedToId: exec.id,
          quoteNo: qNo,
          quoteValue,
          rfqDate,
          followUpDate,
          expectedClosureDate,
          remarks,
          solutionAreas: solAreas,
          oemNames: oemSet,
          closedAt,
          closureReason,
          closureDetails: isClosed ? { notes: remarks, processedBy: exec.id, designation } : null,
          linkedCustomerId,
          poReceivedDate,
          qualificationNotes: ['QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'CLOSURE'].includes(status)
            ? `Requirements qualified. Contact: ${designation}. Budget confirmed.`
            : null,
        }
      });
      leads.push(lead);
    }
    console.log(`    ${status}: ${count} leads`);
  }

  console.log(`  ✓ ${leads.length} leads total`);
  return leads;
}

async function seedFollowUps(users, deals, leads) {
  console.log('\n--- Seeding Follow-ups ---');
  const execs = [users.hema, users.jeevitha];
  const activeStatuses = ['NEW', 'CONTACTED', 'QUALIFIED', 'SUSPECT', 'PROSPECT', 'PROPOSAL', 'NEGOTIATION', 'CLOSURE', 'ON_HOLD'];
  const activeLeads = leads.filter(l => activeStatuses.includes(l.status));

  // Map: exec id → deals they own
  const dealsByExec = {};
  for (const exec of execs) {
    dealsByExec[exec.id] = deals.filter(d => d.assignedToId === exec.id);
  }

  let total = 0;
  for (const lead of activeLeads) {
    const execDeals = dealsByExec[lead.assignedToId] || deals;
    const relatedDeal = execDeals[total % execDeals.length] || deals[0];
    const followUpCount = rInt(3, 7);

    for (let i = 0; i < followUpCount; i++) {
      const isPast = i < followUpCount - 1;
      const scheduledDate = isPast ? daysAgo(rInt(1, 90)) : daysFromNow(rInt(1, 21));

      await prisma.followUp.create({
        data: {
          dealId: relatedDeal.id,
          leadId: lead.id,
          type: pick(FOLLOWUP_TYPES),
          scheduledDate,
          actualDate: isPast ? scheduledDate : null,
          durationMinutes: isPast ? rInt(10, 90) : null,
          notes: `Follow-up with ${lead.company} — ${lead.name} regarding ${lead.solutionAreas[0] || 'IT infrastructure'} requirements`,
          outcome: isPast ? pick(OUTCOMES) : null,
          nextAction: isPast ? pick(NEXT_ACTIONS) : null,
          createdById: lead.assignedToId,
        }
      });
      total++;
    }
  }
  console.log(`  ✓ ${total} follow-ups`);
}

async function seedOrders(customerMap, deals) {
  console.log('\n--- Seeding Orders ---');
  const customers = Object.values(customerMap);
  const orderStatuses = ['PENDING', 'CONFIRMED', 'FULFILLED', 'INVOICED', 'COMPLETED'];
  const paymentStatuses = ['PENDING', 'PARTIAL', 'COMPLETED'];

  const existingCount = await prisma.order.count();
  let created = 0;

  for (let i = 0; i < 38; i++) {
    const customer = customers[i % customers.length];
    const relatedDeal = deals.find(d => d.customerId === customer.id) || deals[i % deals.length];
    const totalAmount = rDec(75000, 3500000);
    const status = orderStatuses[i % orderStatuses.length];
    const payStatus = paymentStatuses[i % paymentStatuses.length];
    const amountPaid = payStatus === 'COMPLETED' ? totalAmount
      : payStatus === 'PARTIAL' ? parseFloat((totalAmount * 0.5).toFixed(2)) : 0;

    const orderNumber = `ORD-2026-${String(existingCount + i + 1).padStart(5, '0')}`;
    const existing = await prisma.order.findUnique({ where: { orderNumber } });
    if (existing) continue;

    await prisma.order.create({
      data: {
        orderNumber,
        customerId: customer.id,
        dealId: relatedDeal?.id || null,
        poNumber: `PO-${customer.companyName.replace(/[^A-Z]/gi, '').substring(0, 4).toUpperCase()}-${rInt(1000, 9999)}`,
        poDate: daysAgo(rInt(1, 90)),
        status,
        deliveryDate: status === 'COMPLETED' ? daysAgo(rInt(1, 30)) : daysFromNow(rInt(5, 60)),
        deliveredAt: status === 'COMPLETED' ? daysAgo(rInt(1, 20)) : null,
        paymentStatus: payStatus,
        totalAmount,
        amountPaid,
        paymentMode: pick(PAYMENT_MODES),
        paymentRemarks: payStatus !== 'PENDING' ? `Payment received via ${pick(PAYMENT_MODES)}. Ref: REF${rInt(100000, 999999)}` : null,
      }
    });
    created++;
  }
  console.log(`  ✓ ${created} orders`);
}

async function seedAnnouncements(adminId) {
  console.log('\n--- Seeding Announcements ---');
  const announcements = [
    { title: 'New Cisco Catalyst 9000 Series Now Available', content: 'We are pleased to announce that the latest Cisco Catalyst 9000 series switches are now in stock. These next-generation switches offer superior performance, built-in security, and support for Wi-Fi 6 integration. Contact the pre-sales team for demo and pricing.', priority: 'HIGH', isPublished: true, publishedAt: daysAgo(5), expiresAt: daysFromNow(25) },
    { title: 'Q1 2026 Sales Target Achievement — Congratulations Team!', content: 'Our sales team has achieved 118% of Q1 2026 targets! Hema Priya closed 5 enterprise deals worth ₹2.3Cr and Jeevitha R achieved 126% of her individual target. Special recognition to both for outstanding performance. Keep up the great work!', priority: 'NORMAL', isPublished: true, publishedAt: daysAgo(10), expiresAt: null },
    { title: 'Updated Payment Collection Policy — Effective Immediately', content: 'Please note the revised payment terms: (1) All orders above ₹5L require 30% advance. (2) Balance payment within 45 days of delivery. (3) All payment proof to be uploaded in CRM within 24 hours of receipt. Non-compliance will be escalated.', priority: 'HIGH', isPublished: true, publishedAt: daysAgo(15), expiresAt: null },
    { title: 'CRM System Maintenance — Scheduled Downtime', content: 'The CRM system will undergo scheduled maintenance on Saturday between 10 PM and 2 AM. Please save all pending work before 9:30 PM on Friday. Access will be restored by 3 AM Sunday. Contact IT support for urgent requirements during downtime.', priority: 'HIGH', isPublished: true, publishedAt: daysAgo(22), expiresAt: daysAgo(19) },
    { title: 'Fortinet Gold Partner Certification Achieved', content: 'We are proud to announce that eOrbitor has achieved Fortinet Gold Partner status! This certification enables us to offer better pricing, priority support, and exclusive demo units. This positions us strongly to compete for enterprise firewall opportunities.', priority: 'NORMAL', isPublished: true, publishedAt: daysAgo(30), expiresAt: null },
    { title: 'Palo Alto Networks Special Promotion — Q2 2026', content: 'Palo Alto Networks has announced special promotional pricing for PA-series NGFWs valid through end of Q2 2026. Discounts up to 25% available on select models. This is an excellent opportunity to close pending firewall deals. Contact pre-sales for updated pricing sheets.', priority: 'HIGH', isPublished: true, publishedAt: daysAgo(3), expiresAt: daysFromNow(30) },
    { title: 'Office Closed — Public Holiday on June 4th', content: 'Please note that the office will be closed on June 4th 2026 on account of a public holiday. All customer commitments and deliveries scheduled for this date should be rescheduled. Kindly inform your customers in advance and update the CRM accordingly.', priority: 'NORMAL', isPublished: true, publishedAt: daysAgo(7), expiresAt: daysAgo(4) },
    { title: 'Welcome to the Team — New Hires June 2026', content: 'Please join us in welcoming our newest team members who joined this month. Their profiles have been added to the company directory. Please extend a warm welcome and assist them in getting onboarded to our CRM and tools.', priority: 'LOW', isPublished: true, publishedAt: daysAgo(12), expiresAt: null },
    { title: 'HPE Storage Solutions Launch Event — Register Now', content: 'HPE is hosting an exclusive partner launch event for the new Alletra Storage MP series. The event is scheduled for next month. Product demos, technical deep-dives, and partner discounts will be announced. Registration is mandatory — contact the admin team.', priority: 'HIGH', isPublished: false, publishedAt: null, expiresAt: daysFromNow(45) },
    { title: 'Revised GST Filing Procedures — Action Required', content: 'The finance team has updated GST filing procedures in line with new government regulations. All invoices raised from June 1 2026 must include the new e-invoice QR code. Please coordinate with the finance team to ensure compliance before raising new invoices.', priority: 'HIGH', isPublished: false, publishedAt: null, expiresAt: null },
    { title: 'Quarterly Business Review — June 28th 2026', content: 'The Q1 Quarterly Business Review is scheduled for June 28th 2026 at 10 AM. All sales executives and managers are required to prepare their pipeline reviews, deal summaries, and forecasts. Slides must be submitted to Elizabeth by June 25th.', priority: 'NORMAL', isPublished: true, publishedAt: daysAgo(2), expiresAt: daysFromNow(26) },
    { title: 'Customer Satisfaction Survey Results — Q1 2026', content: 'The Q1 customer satisfaction survey results are in. Our NPS score improved from 48 to 61, a significant jump driven by faster response times and better pre-sales support. Key areas for improvement: post-delivery follow-up and invoice turnaround time. Full report shared on Teams.', priority: 'LOW', isPublished: true, publishedAt: daysAgo(45), expiresAt: null },
    { title: 'New Aruba Wi-Fi 6E Products — Demo Units Available', content: 'We have received demo units for the new Aruba Wi-Fi 6E access points. These are available for customer demonstrations. Please coordinate with the pre-sales team to schedule demos for prospects with active wireless networking requirements.', priority: 'NORMAL', isPublished: true, publishedAt: daysAgo(18), expiresAt: daysFromNow(30) },
    { title: 'Sales Incentive Program — May 2026 Results', content: 'May 2026 incentive payouts have been processed. Hema Priya B is the top performer for the month with ₹85,000 incentive payout. Jeevitha R earned ₹62,000. Payouts will be credited to salary accounts on June 10th. Keep up the competitive spirit!', priority: 'NORMAL', isPublished: true, publishedAt: daysAgo(8), expiresAt: null },
  ];

  let count = 0;
  for (const a of announcements) {
    await prisma.announcement.create({
      data: { ...a, createdById: adminId }
    });
    count++;
  }
  console.log(`  ✓ ${count} announcements`);
}

async function seedDailyActivities(users) {
  console.log('\n--- Seeding Daily Activities ---');
  const execs = [users.hema, users.jeevitha];
  const workingDays = getWorkingDays(35);

  const activityTemplates = [
    'Called 5 prospects from the pipeline and updated status in CRM',
    'Submitted quotation to {company} for network infrastructure requirements',
    'Meeting with {company} client at their office — needs assessment completed',
    'Updated CRM records for 10 leads with latest follow-up outcomes',
    'Followed up on 8 pending proposals via email and WhatsApp',
    'Site visit to {company} facility for on-site requirement assessment',
    'Prepared monthly sales report and pipeline forecast for manager review',
    'Coordinated with pre-sales team for RFQ response to {company}',
    'WhatsApp follow-up with 8 warm leads — 3 responded positively',
    'Attended Cisco product training session — Catalyst 9000 series',
    'Resolved delivery coordination issue for {company} order',
    'Submitted weekly activity summary to Elizabeth',
    'Cold calling campaign — contacted 12 new prospects from LinkedIn list',
    'Attended team pipeline review meeting — discussed stalled deals',
    'Sent product brochures and datasheets to 6 interested prospects',
    'Followed up with {company} regarding delayed PO — escalated to manager',
    'Prepared competitor analysis for Fortinet vs Palo Alto for {company} RFQ',
    'Attended webinar on HPE storage solutions — 2 hours',
    'Reviewed and responded to 15 email inquiries from prospects',
    'Negotiation call with {company} — agreed on revised pricing',
  ];

  const companies = ['Novac Technology', 'Ashok Leyland', 'IIT Madras', 'Equitas Bank', 'L&T Technology', 'Arvos Group', 'Pearl Global', 'Tagros Chemicals'];
  let total = 0;

  for (const exec of execs) {
    for (const dateStr of workingDays) {
      const existing = await prisma.dailyActivity.findUnique({
        where: { userId_date: { userId: exec.id, date: dateStr } }
      });
      if (existing) continue;

      const actCount = rInt(3, 7);
      const activities = Array.from({ length: actCount }, (_, idx) => {
        const tmpl = activityTemplates[(total + idx) % activityTemplates.length];
        return tmpl.replace('{company}', companies[(total + idx) % companies.length]);
      });

      const loginH = rInt(8, 9);
      const loginM = rInt(45, 59);
      const logoutH = rInt(17, 19);
      const logoutM = rInt(0, 30);
      const loginTime = new Date(`${dateStr}T${String(loginH).padStart(2,'0')}:${String(loginM).padStart(2,'0')}:00.000Z`);
      const logoutTime = new Date(`${dateStr}T${String(logoutH).padStart(2,'0')}:${String(logoutM).padStart(2,'0')}:00.000Z`);
      const totalHours = parseFloat(((logoutTime - loginTime) / (1000 * 60 * 60)).toFixed(2));

      await prisma.dailyActivity.create({
        data: {
          userId: exec.id,
          date: dateStr,
          activities: JSON.stringify(activities),
          notes: pick(['Productive day with good customer responses', 'Several follow-ups closed', 'Met targets for the day', 'Good pipeline progress', null, null]),
          loginTime,
          logoutTime,
          totalHours,
          isEditable: false,
        }
      });
      total++;
    }
  }
  console.log(`  ✓ ${total} daily activity records`);
}

async function seedActivityLogs(users, leads, customers, deals) {
  console.log('\n--- Seeding Activity Logs ---');
  const allUsers = Object.values(users).filter(Boolean);
  const actions = ['CREATE', 'UPDATE', 'VIEW'];
  let total = 0;

  for (let i = 0; i < 35; i++) {
    const lead = leads[i % leads.length];
    await prisma.activityLog.create({
      data: {
        userId: pick(allUsers).id,
        action: pick(actions),
        entityType: 'Lead',
        entityId: lead.id,
        leadId: lead.id,
        changes: { field: 'status', from: 'SUSPECT', to: lead.status },
        createdAt: daysAgo(rInt(0, 45)),
      }
    });
    total++;
  }

  for (let i = 0; i < 25; i++) {
    const customer = customers[i % customers.length];
    await prisma.activityLog.create({
      data: {
        userId: pick(allUsers).id,
        action: pick(['CREATE', 'VIEW', 'UPDATE']),
        entityType: 'Customer',
        entityId: customer.id,
        customerId: customer.id,
        createdAt: daysAgo(rInt(0, 45)),
      }
    });
    total++;
  }

  for (let i = 0; i < 20; i++) {
    const deal = deals[i % deals.length];
    await prisma.activityLog.create({
      data: {
        userId: pick(allUsers).id,
        action: pick(['CREATE', 'UPDATE', 'VIEW']),
        entityType: 'Deal',
        entityId: deal.id,
        dealId: deal.id,
        createdAt: daysAgo(rInt(0, 45)),
      }
    });
    total++;
  }

  console.log(`  ✓ ${total} activity log entries`);
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('================================================');
  console.log('  eOrbitor Pulse — Comprehensive Mock Data Seed');
  console.log('================================================');

  const userRecords = await prisma.user.findMany({ select: { id: true, email: true, role: true } });
  const users = {
    admin:    userRecords.find(u => u.email === 'vaidyanathan.cr@eorbitor.com'),
    manager:  userRecords.find(u => u.email === 'elizabeth.g@eorbitor.com'),
    hema:     userRecords.find(u => u.email === 'sales@eorbitor.com'),
    jeevitha: userRecords.find(u => u.email === 'jeevitha.r@eorbitor.com'),
  };

  if (!users.admin || !users.hema || !users.jeevitha) {
    console.error('\nERROR: Required users not found. Run first: node prisma/seed-users.js');
    process.exit(1);
  }
  console.log('\nUsers loaded: admin, manager, hema, jeevitha');

  await seedProducts();
  const customerMap = await seedCustomers();
  const deals = await seedDeals(users, customerMap);
  const leads = await seedLeads(users, customerMap);
  await seedFollowUps(users, deals, leads);
  await seedOrders(customerMap, deals);
  await seedAnnouncements(users.admin.id);
  await seedDailyActivities(users);
  await seedActivityLogs(users, leads, Object.values(customerMap), deals);

  console.log('\n================================================');
  console.log('  Seed complete!');
  console.log('================================================\n');
}

main()
  .catch(e => { console.error('Seed failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
