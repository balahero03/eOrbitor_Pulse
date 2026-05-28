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

function uid(name) {
  if (!name) return null;
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

function parseDate(str) {
  if (!str || str.trim() === '') return null;
  // handle both DD-MM-YYYY and DD.MM.YYYY
  const s = str.trim().replace(/\./g, '-');
  const parts = s.split('-');
  if (parts.length !== 3) return null;
  const [d, m, y] = parts;
  const date = new Date(`${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}T00:00:00.000Z`);
  return isNaN(date.getTime()) ? null : date;
}

function parseValue(str) {
  if (!str || str.trim() === '') return null;
  // remove commas, currency symbols, spaces, take first number
  const match = str.replace(/,/g, '').match(/[\d.]+/);
  return match ? parseFloat(match[0]) : null;
}

function mapStatus(str) {
  if (!str) return 'SUSPECT';
  const s = str.trim().toLowerCase();
  if (s === 'won') return 'WON';
  if (s === 'lost') return 'LOST';
  if (s === 'prospect') return 'PROSPECT';
  if (s === 'suspect') return 'SUSPECT';
  if (s === 'dropped') return 'DROPPED';
  if (s === 'hold' || s === 'on hold') return 'ON_HOLD';
  if (s === 'commit') return 'COMMIT';
  if (s === 'nego') return 'NEGOTIATION';
  if (s === 'price pending') return 'SUSPECT';
  return 'SUSPECT';
}

// Each entry: [quoteNo, rfqDate, assigned, broughtBy, customer, oppName, status, remarks, followupDate, poDate, quoteValue]
const leads = [
  ['QT-26-0001','01-04-2026','Geetha',null,'Novac','Dell AMC','Won','order loaded to terix','','',''],
  ['QT-26-0002','01-04-2026','Srini','Hema','LTTS Mysore','Lenovo Monitor (2K resolution)','Lost','Customer update pending','13-04-2026','',''],
  ['QT-26-0003','01-04-2026','Srini','Leo','Chettinad','Motheboard Ram SMPS','Lost','Proposal sent','','',''],
  ['QT-26-0004','01-04-2026','Krishnan',null,'SRM Tech','Lenovo E14 AMD G6 12nos','Lost','proposal Sent waiting for ebid','','',''],
  ['QT-26-0005','01-04-2026','Krishnan',null,'SRM Tech','Lenovo TC M75t Gen2 AMD 12nos','Lost','proposal Sent waiting for ebid','','',''],
  ['QT-26-0006','02-04-2026','Geetha',null,'Arvos','I9/16GB/512Gb/Win 11 pro','Prospect','Proposal Sent','','',''],
  ['QT-26-0007','02-04-2026','Jeevitha',null,'Ramraj','226 Lenovo Pc and accessories','Lost','proposal sent','','',''],
  ['QT-26-0008','02-04-2026','Jeevitha',null,'Ramraj','227 Accessories','Lost','Proposal sent','06-05-2026','',''],
  ['QT-26-0009','03-04-2026','Jeevitha',null,'Hwashin','Seagate 2TB','Prospect','Customer update Pending as on 22nd April 2026','','',''],
  ['QT-26-0010','06-04-2026','Jeevitha',null,'Ramraj','225 Canon Epson Printer','Lost','proposal sent','','','60000'],
  ['QT-26-0011','06-04-2026','Jeevitha',null,'Tagros','HP 440 G10 Laptop','Lost','customer want low price','08-04-2026','',''],
  ['QT-26-0012','06-04-2026','Vaidy','Jeevitha','Zoho','10TB sas/sata HDD (5 nos each)','Won','invoice raised','15-04-2026','',''],
  ['QT-26-0013','06-04-2026','Krishnan',null,'Green Pearl','Dell desktop & Printer','Lost','Proposal Sent','','',''],
  ['QT-26-0014','06-04-2026','Krishnan',null,'Green Pearl','HP Desktops & Laptops','Lost','Proposal Sent','','',''],
  ['QT-26-0015','07-04-2026','Hema',null,'Astemo','Battery for Lenovo L14 Gen2 Laptop','Lost','Proposal submitted','','','9970'],
  ['QT-26-0016','07-04-2026','Srini','Jeevitha','IOB','Quarterly quote','Lost','quote sent to IOB; asking for price which is not possible','09-04-2026','',''],
  ['QT-26-0017','08-04-2026','Jeevitha',null,'Ramraj Cotton','228 Multiple products','Lost','proposal sent','','',''],
  ['QT-26-0018','08-04-2026','Srini',null,'Chettinad','HP Laptop i3-1305u 13th Gen','Lost','proposal sent','09-04-2026','',''],
  ['QT-26-0019','08-04-2026','Srini',null,'Chettinad','MS Office Professional','Lost','proposal sent','09-04-2026','',''],
  ['QT-26-0020','08-04-2026','Leo',null,'VBJ','Lenovo Idea Tab','Lost','Proposal sent','08-04-2026','','1094100'],
  ['QT-26-0021','08-04-2026','Leo',null,'VBJ','bizhub 4201i 2nos','Lost','Product price yet to launch','08-04-2026','',''],
  ['QT-26-0022','08-04-2026','Krishnan',null,'Green Pearl','Dell Laptop','Prospect','Proposal Sent - nego next week','','',''],
  ['QT-26-0023','09-04-2026','Krishnan',null,'IIT Madras','ESET Licenses','Prospect','Proposal Sent - waiting for the tender','','','2150000'],
  ['QT-26-0024','09-04-2026','Jeevitha',null,'Ramraj Cotton','Epson EcoTank L14150 A3','Lost','Proposal sent','10-04-2026','',''],
  ['QT-26-0025','10-04-2026','Hema',null,'Ashok Leyland','ubuntu','Won','proposal sent','','','438000'],
  ['QT-26-0026','10-04-2026','Hema',null,'Ashok Leyland','Anaconda License','Lost','Order Lost','','',''],
  ['QT-26-0027','10-04-2026','Jeevitha',null,'Taurus Quest','Asus Adapter','Won','invoice raised','10-04-2026','','3250'],
  ['QT-26-0028','10-04-2026','Vaidy','Jeevitha','Zoho','10K 2.4TB 10000 RPM SAS HDD 10nos','Won','invoice raised','16-04-2026','',''],
  ['QT-26-0029','12-04-2026','Srini',null,'Pearl Global','16TB HDD / Matrix Satatya NVR 1602X','Prospect','waiting for management approval','13-04-2026','','125752'],
  ['QT-26-0030','13-04-2026','Srini','Hema','LTTS','S2725QS - 48nos','Prospect','waiting for management approval','06-05-2026','',''],
  ['QT-26-0031','13-04-2026','Hema','Jeevitha','Ramraj Cotton','RFQ 231 CCTV Requirements','Dropped','','','',''],
  ['QT-26-0032','13-04-2026','Hema','Jeevitha','Ramraj Cotton','RFQ 230 Dell Pro QVT 1260','Lost','Proposal sent','13-04-2026','',''],
  ['QT-26-0033','13-04-2026','Leo',null,'KKCTH','HP 280 G9 Desktop MT i3-13100','Lost','Price above existing budget','14-04-2026','','1199250'],
  ['QT-26-0034','13-04-2026','Srini','Leo','VBJ','Lenovo V15 G5','Won','PO Received','16-04-2026','','373100'],
  ['QT-26-0035','15-04-2026','Hema',null,'LTTS','Lenovo ThinkPad T14 and accessories','hold','on hold','','',''],
  ['QT-26-0036','15-04-2026','Jeevitha',null,'Ramraj Cotton','232 RFQ','Lost','due to specified items not in market','','',''],
  ['QT-26-0037','15-04-2026','Jeevitha',null,'Ramraj Cotton','132 RFQ','Lost','proposal sent','17-04-2026','',''],
  ['QT-26-0038','15-04-2026','Jeevitha',null,'Ramraj Cotton','233 RFQ','Lost','Proposal sent','16-04-2026','',''],
  ['QT-26-0039','16-04-2026','Krishnan',null,'VIT University','VC Solution','hold','Lead Generated','06-05-2026','',''],
  ['QT-26-0040','17-04-2026','Srini','Hema','Ashley Alteams','IT Consumables','Lost','Waiting for customer update','06-05-2026','',''],
  ['QT-26-0041','17-04-2026','Srini','Jeevitha','Chettinad','Lenovo HP server & desktop 90 nos','Dropped','','','',''],
  ['QT-26-0042','17-04-2026','Jeevitha',null,'Toshibha','HP Laptop 20nos','Lost','Revised proposal sent','17-04-2026','',''],
  ['QT-26-0043','17-04-2026','Vaidy','Jeevitha','Zoho','Owl Conferencing','Won','invoice raised','24-04-2026','',''],
  ['QT-26-0044','17-04-2026','Leo',null,'Enabl','Poly Headset and Logitech mouse','Lost','proposal sent','20-04-2026','','99400'],
  ['QT-26-0045','17-04-2026','Hema',null,'Astemo','Lenovo 300 USB Mouse Wired','Lost','on hold','','',''],
  ['QT-26-0046','18-04-2026','Srini',null,'Equitas','Redmi Mobile','Won','Material received','','',''],
  ['QT-26-0047','20-04-2026','Srini','Leo','Sinto Bharat Pvt Ltd','Epson Projector & Hdmi VGA Cable','Prospect','proposal sent','06-05-2026','','55911'],
  ['QT-26-0048','07-05-2026','Srini','Leo','Pearl Global','Proposal for Accessories','Won','PO Received','16-05-2026','','21665'],
  ['QT-26-0049','21-04-2026','Leo',null,'UltraTech Cement Limited','HP LASERJET M208DW PRINTER','Lost','Proposal sent','21-04-2026','','103521'],
  ['QT-26-0050','21-04-2026','Krishnan',null,'SRM Tech','HP & Canon Toner','hold','Proposal sent','','',''],
  ['QT-26-0051','22-04-2026','Vaidy','Jeevitha','Zoho','Alogic 15nos','Won','order loaded material expected on 7/5/2026','24-04-2026','',''],
  ['QT-26-0052','22-04-2026','Geetha',null,'Indian Additives','Dell server Renewals','Won','PO received on 6th may','','',''],
  ['QT-26-0053','24-04-2026','Leo',null,'Sinto Bharat Pvt Ltd','Dell Pro 14 3nos','Prospect','Proposal sent','25-04-2026','','260010'],
  ['QT-26-0054','24-04-2026','Jeevitha','Srini','Hwashin','Desktop Workstation & Windows License','Prospect','Proposal sent','','',''],
  ['QT-26-0055','24-04-2026','Leo',null,'Pearl Global','HP 45A plotter cartridge','Won','invoice raised','24-04-2026','','12000'],
  ['QT-26-0056','24-04-2026','Hema','Krishnan','Ashok Leyland','DC AMC Services','Commit','final proposal submitted','','','927000'],
  ['QT-26-0057','24-05-2026','Geetha',null,'Yanmar','Power Automate','Lost','Under process customer asking for revised prices','','',''],
  ['QT-26-0058','27-04-2026','Geetha',null,'Malabar','Wacom Tablet','Won','PO received and Margin Sheet shared on 19th May','','',''],
  ['QT-26-0059','28-04-2026','Geetha',null,'Arvos','Dell server Renewals','Won','','','',''],
  ['QT-26-0060','28-04-2026','Krishnan','Hema','Green Pearl','Lenovo L14 Gen 6 Laptop / HP Smart Tank 790','Prospect','proposal sent','05-05-2026','',''],
  ['QT-26-0061','29-04-2026','Krishnan','Geetha','KP Manish','Poly Mic','Won','Order loaded to Touchline material expected on 8/6/2026','','',''],
  ['QT-26-0062','29-04-2026','Hema',null,'Sankara Netralaya','Zebra Barcode scanner','Lost','The proposal shared','','',''],
  ['QT-26-0063','29-04-2026','Jeevitha',null,'Tagros','Dell Latitude L3440 15nos','Lost','Proposal Sent','04-05-2026','',''],
  ['QT-26-0064','','',null,'','','Commit','','','',''],
  ['QT-26-0065','30-04-2026','Jeevitha',null,'Ramraj Cotton','244 RFQ','Won','PO received','14-05-2026','','30000'],
  ['QT-26-0066','30-04-2026','Srini','Geetha','IOB','Desktop 8 numbers','Lost','L2 In this requirement','','',''],
  ['QT-26-0067','30-04-2026','Krishnan','Hema','Kawman ExAct','Dell Laptop','Won','invoice raised','06-05-2026','',''],
  ['QT-26-0068','30-04-2026','Krishnan','Hema','Green Pearl','Core i5/13th Gen/16 GB RAM/1TB SSD/Win 11','Prospect','proposal sent','05-05-2026','','80000'],
  ['QT-26-0069','30-04-2026','Jeevitha',null,'Ramraj Cotton','245 RFQ','Lost','revised proposal sent','05-05-2026','',''],
  ['QT-26-0070','02-05-2026','Vaidy','Jeevitha','Zoho','ViewSonic VP16-OLED Portable Monitor','Dropped','we not able to source the price','','',''],
  ['QT-26-0071','02-05-2026','Hema',null,'Sankara Netralaya','Multiple Products','Prospect','Proposal sent','05-05-2026','',''],
  ['QT-26-0072','03-05-2026','Geetha',null,'Fujitsu Network Communications','HP SAN server renewals','Won','Margin sheet shared on 5/5/2026','','',''],
  ['QT-26-0073','03-05-2026','Geetha',null,'Fujitsu Network Communications','Netapp renewals','Won','Margin sheet shared on 5/5/2026','','',''],
  ['QT-26-0074','03-05-2026','Geetha',null,'Fujitsu Network Communications','Lenovo RAM','Won','Installation Pending','','',''],
  ['QT-26-0075','04-05-2026','Geetha',null,'Malabar','Battery & Service','Won','Material delivered and service done','','',''],
  ['QT-26-0076','04-05-2026','Geetha',null,'Yanmar','L14 Gen 5 Lenovo Display','Lost','Proposal sent','','',''],
  ['QT-26-0077','04-05-2026','Krishnan','Hema','Green Pearl','HP/Dell Core i7 32GB 512GB+2TB Ubuntu 21.5" 2nos','Prospect','proposal sent','','','125000'],
  ['QT-26-0078','05-05-2026','Geetha',null,'Arvos','HP Toner','Won','Internal price shared to Sidd','','',''],
  ['QT-26-0079','05-05-2026','Geetha',null,'Malabar','Rental Quote','Won','Proposal Sent revised Quote to be shared','','',''],
  ['QT-26-0080','05-05-2026','Geetha',null,'Yanmar','Office LTSC Standard 2024','Lost','Proposal sent','','',''],
  ['QT-26-0081','05-05-2026','Hema','Krishnan','Sankara Netralaya','Lenovo ThinkPad E16 Gen 3','Prospect','price is requested','','','70000'],
  ['QT-26-0082','06-05-2026','Geetha',null,'Malabar','Printer Software installation','Price Pending','Working on the project','','',''],
  ['QT-26-0083','06-05-2026','Srini','Geetha','IOB','AIO 3nos','Dropped','','','',''],
  ['QT-26-0084','06-05-2025','Geetha',null,'Algihaz','Lenovo Notebook ThinkPad T14 Rental','Price Pending','','','',''],
  ['QT-26-0085','06-05-2026','Srini',null,'Equitas','voyc E20D USB 70 Qty','Prospect','Proposal sent','','',''],
  ['QT-26-0087','06-05-2026','Krishnan',null,'Green Pearl','HP 88A Cartridge','Lost','','','',''],
  ['QT-26-0088','06-05-2025','Geetha',null,'Algihaz','Lenovo Notebook ThinkPad T14 Rental B','Price Pending','','','',''],
  ['QT-26-0090','06-05-2026','Krishnan',null,'Green Pearl','HP 88A Cartridge (2)','Lost','','','',''],
  ['QT-26-0091','06-05-2026','Vaidy','Jeevitha','Zoho','Panasonic Eneloop Charger & Batteries','Won','','','',''],
  ['QT-26-0092','06-05-2026','Krishnan',null,'SRM Tech','Canon Image class MF 226dn Cartridge','Lost','','','',''],
  ['QT-26-0093','06-05-2026','Krishnan','Hema','KP Manish','Dell OptiPlex 7040 mini-PC','Lost','Refurbished PC Proposal submitted','','',''],
  ['QT-26-0094','06-05-2026','Krishnan','Hema','KP Manish','Dell PC14250 Pro 30nos','Prospect','proposal sent Nego pending','','','1150000'],
  ['QT-26-0095','06-05-2026','Geetha',null,'IOB','Juniper SFP Module','Price Pending','','','',''],
  ['QT-26-0096','06-05-2026','Geetha',null,'Cognizant','WIFI 7 USB Adapter','Dropped','Regret sent','','',''],
  ['QT-26-0097','06-05-2026','Krishnan',null,'KP Manish','Refurbished Thin PC','Lost','Proposal sent','12-05-2026','','115000'],
  ['QT-26-0098','07-05-2026','Leo',null,'KKCTH','HP 280 G9 MT Desktop i3-12100 16GB SSD','Prospect','Proposal sent','07-05-2026','','55388'],
  ['QT-26-0099','08-05-2026','Krishnan',null,'UIIC','AMC-DT/LT/Servers/Printers/NW','Lost','Proposal sent','','',''],
  ['QT-26-0100','08-05-2026','Hema',null,'Sankara Netralaya','Epson Cartridges','Dropped','procured from other partner as it is urgent','','',''],
  ['QT-26-0101','09-05-2026','Jeevitha',null,'Tagros','Dell Latitude L3440 15nos (2)','hold','Customer Update pending','15-05-2026','',''],
  ['QT-26-0102','11-05-2026','Hema',null,'Sankara Netralaya','Accessories','Nego','The final proposal is shared','','',''],
  ['QT-26-0103','11-05-2026','Hema','Krishnan','Sankara Netralaya','Workstation','Prospect','proposal sent','','','230000'],
  ['QT-26-0105','11-05-2026','Jeevitha',null,'Tagros','HP Probook 440 G10','Lost','Customer Update pending','15-05-2026','',''],
  ['QT-26-0106','13-05-2026','Jeevitha',null,'Ramraj Cotton','Lenovo Tab and tower workstation RFQ 248','Lost','he need low cost than our landing cost','15-05-2026','',''],
  ['QT-26-0107','13-05-2026','Hema',null,'Ashley Alteams','Mobile Workstation','Prospect','proposal sent','','','193800'],
  ['QT-26-0108','14-05-2026','Hema',null,'L&T Tech','Workstation','Price Pending','Price from OEM pending','','',''],
  ['QT-26-0109','15-05-2026','Leo',null,'Pearl Global','DELL PRO 14 PV14250','Prospect','proposal sent','19-05-2026','','62560'],
  ['QT-26-0110','20-04-2026','Srini','Leo','Sinto Bharat Pvt Ltd','Tower IPC 10th Gen i7 16GB 1TB SSD','Prospect','Revised Proposal sent','19-05-2026','','333091'],
  ['QT-26-0111','12-05-2026','Srini','Leo','VBJ','4 TB Western Digital Hard Disk','Lost','Pricing','13-05-2026','','32920'],
  ['QT-26-0112','14-05-2026','Vaidy','Jeevitha','Zoho','UColor OLED Portable Touch Monitor 15.6" 4K','Prospect','Alternate product price sent to customer','19-05-2026','',''],
  ['QT-26-0113','16-05-2026','Vaidy','Jeevitha','Zoho','Loupedeck Creative Tool','Price Pending','','','',''],
  ['QT-26-0114','16-05-2026','Srini','Leo','VBJ','Lenovo V15 G4 i5 + ThinkCentre Neo 50q','Prospect','Proposal Submitted','16-05-2026','','230160'],
  ['QT-26-0115','12-05-2026','Krishnan',null,'Sattva','Refurbished Thin PC','Prospect','Proposal Submitted','','','150000'],
  ['QT-26-0116','12-05-2026','Krishnan',null,'Sattva','Networking Components','Prospect','Proposal Submitted','','','220000'],
  ['QT-26-0117','09-05-2026','Krishnan',null,'SRM Tech','Lenovo Laptops','Prospect','','','',''],
  ['QT-26-0118','14-05-2026','Krishnan',null,'Sundaram Clayton','Desktops & Laptops','Suspect','','','',''],
  ['QT-26-0119','15-05-2026','Krishnan',null,'M2P','HPE VME Essentials','Suspect','','','',''],
  ['QT-26-0120','15-05-2026','Hema',null,'Hitachi','Monitor','Prospect','Proposal Submitted','','','46000'],
  ['QT-26-0121','16-05-2026','Srini','Leo','VBJ','Sonic Firewall Products','Dropped','','','',''],
  ['QT-26-0122','16-05-2026','Jeevitha',null,'Ramraj Cotton','RFQ 251 Accessories','Prospect','Proposal sent','18-05-2026','','20120'],
  ['QT-26-0123','28-04-2026','Srini','Leo','VBJ','Quotation for Lenovo V15 G4 IRU','Lost','Price Validity over','28-04-2026','','106600'],
  ['QT-26-0124','18-05-2026','Srini',null,'Algihaz','Quotation for Autodesk','Prospect','Revised Proposal Submitted','20-05-2026','','4225000'],
  ['QT-26-0125','18-05-2026','Hema',null,'L&T Tech','Workstation US Requirement','Prospect','Proposal Submitted','','',''],
  ['QT-26-0126','18-05-2026','Hema',null,'L&T Tech','Nvidia DGXSpark','Prospect','Proposal Submitted','','','500000'],
  ['QT-26-0127','19-05-2026','Hema',null,'Sankara Netralaya','Laptop','Prospect','Proposal Submitted','','','65500'],
  ['QT-26-0128','19-05-2026','Geetha',null,'Nippon Paints','IBM Renewal','Price Pending','','','',''],
  ['QT-26-0129','19-05-2026','Geetha',null,'Yanmar','RSA renewal','Price Pending','','','',''],
  ['QT-26-0130','19-05-2026','Geetha',null,'Yanmar','Dell server Renewals','Price Pending','','','',''],
  ['QT-26-0131','19-05-2026','Vaidy','Jeevitha','L&T Smart','Zoho BI Analytics','Price Pending','','','',''],
  ['QT-26-0132','19-05-2026','Hema',null,'L&T Tech','3D Printer module','Prospect','Proposal Submitted','','',''],
  ['QT-26-0133','20-05-2026','Vaidy','Jeevitha','Zoho','Epos impact 1060 100nos','Prospect','Proposal Submitted','20-05-2026','','1044750'],
  ['QT-26-0134','20-05-2026','Hema',null,'L&T Tech','Analyzer','Price Pending','','','',''],
  ['QT-26-0135','20-05-2026','Vaidy','Jeevitha','Zoho','Alogic network Cable & Sandisk 64gb','Price Pending','','','',''],
  ['QT-26-0136','10-05-2026','Srini','Hema','KBR','AMC for Experience Centre','Suspect','will have to submit revised proposal RS-090','','',''],
  ['QT-26-0137','18-05-2026','Srini','Hema','Equitas','AMC for Desktops Laptops and scanners','Prospect','proposal submitted','','',''],
  ['QT-26-0138','20-05-2026','Srini',null,'ICMR','F5 WAF','Price Pending','','','',''],
  ['QT-26-0139','20-05-2026','Srini',null,'Jaya TV','HP Proliant Servers 3 nos','Price Pending','','','',''],
  ['QT-26-0140','07-03-2026','Srini','Hema','KBR','Crestron Video Conferencing','Prospect','Proposal Submitted','','',''],
  ['QT-26-0141','07-03-2026','Srini','Hema','Algihaz','Network Assessment','Prospect','Proposal submitted','','',''],
  ['QT-26-0142','12-03-2026','Srini','Geetha','Lifecell','Promox Migration','Suspect','Proposal submitted','','',''],
  ['QT-26-0143','02-04-2026','Srini','Hema','Algihaz','Aruba centralized License','Price Pending','','','',''],
  ['QT-26-0144','10-04-2026','Srini','Hema','Equitas','Network Dressing','Prospect','Proposal submitted','','',''],
  ['QT-26-0145','17-04-2026','Srini',null,'Veeras','Rental servers','Prospect','proposal submitted','','',''],
  ['QT-26-0146','13-05-2026','Srini',null,'Vaken','Fortigate Firewall','Won','','','',''],
  ['QT-26-0147','20-05-2026','Krishnan',null,'K P Manish','HP DL380 G11 Servers','Commit','Proposal Sent','21-05-2026','','10500000'],
  ['QT-26-0148','20-05-2026','Krishnan',null,'L&T ECC','HPE Aruba AMC','Prospect','Proposal Sent','20-05-2026','','5555860'],
  ['QT-26-0149','20-05-2026','Krishnan',null,'Photon','HP DL380 G11 Servers','Prospect','Proposal Sent','20-05-2026','','1450000'],
  ['QT-26-0150','20-05-2026','Leo',null,'Enabl','Portronics Laptop Stand with USB Hub 20nos','Lost','Proposal Sent','21-05-2026','','1815'],
  ['QT-26-0151','20-05-2026','Hema',null,'L&T','Analyzer','Prospect','Proposal Sent','','',''],
  ['QT-26-0152','21-05-2026','Vaidy','Jeevitha','Zoho','HP & Canon Toner','Prospect','Proposal Sent','21-05-2026','',''],
  ['QT-26-0153','21-05-2026','Vaidy','Jeevitha','Zoho','Seagate Onetouch HDD','Price Pending','','','',''],
  ['QT-26-0154','21-05-2026','Srini',null,'Equitas','Equitas Requirement','Suspect','','','',''],
  ['QT-26-0155','22-05-2026','Jeevitha',null,'Ramraj Cotton','RFQ 253 Accessories','Price Pending','','','',''],
  ['QT-26-0156','24-05-2026','Vaidy','Jeevitha','Zoho / Sugah Health Corp','Grandstream','Prospect','Proposal sent','25-05-2026','',''],
  ['QT-26-0157','24-05-2026','Vaidy','Jeevitha','Zoho','ViewSonic VP16-OLED Portable Monitor','Price Pending','','','',''],
  ['QT-26-0158','24-05-2026','Srini','Hema','IOB','8 i3 14th gen desktops','Prospect','Proposal sent','25-05-2026','',''],
  ['QT-26-0159','21-05-2026','Jeevitha',null,'Ramraj Cotton','Showroom Material Projection List','Price Pending','','','',''],
  ['QT-26-0160','25-05-2026','Krishnan',null,'Indian Coastal Guard','Acer Desktops','Prospect','Gem Tender','','',''],
  ['QT-26-0161','25-05-2026','Krishnan',null,'Indian Coastal Guard','Printers','Prospect','Gem Tender','','',''],
];

async function main() {
  console.log('Deleting all existing leads...');
  await p.lead.deleteMany({});
  console.log('Deleted.');

  let created = 0, skipped = 0;

  for (const [quoteNo, rfqDate, assignedName, broughtName, customer, oppName, statusRaw, remarks, followupDate, poDate, quoteValue] of leads) {
    const assignedToId = uid(assignedName);
    const broughtById  = uid(broughtName);
    const status = mapStatus(statusRaw);

    if (!quoteNo) { skipped++; continue; }
    if (assignedName && !assignedToId) {
      console.log(`WARNING: unknown user "${assignedName}" for ${quoteNo}`);
    }

    const data = {
      quoteNo,
      name: oppName || quoteNo,
      company: customer || '',
      email: '',
      status,
      source: 'EMAIL',
      remarks: remarks || null,
      rfqDate: parseDate(rfqDate),
      followUpDate: parseDate(followupDate),
      quoteValue: parseValue(quoteValue),
      assignedToId: assignedToId || USERS.vaidy,
      broughtById: broughtById || null,
    };

    try {
      await p.lead.create({ data });
      created++;
    } catch (e) {
      console.log(`FAILED ${quoteNo}: ${e.message}`);
      skipped++;
    }
  }

  console.log(`\nDone. Created: ${created}, Skipped: ${skipped}`);
  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
