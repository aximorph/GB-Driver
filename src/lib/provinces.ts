export interface Province {
  id: string;   // used as Firebase key (stable English slug)
  en: string;
  th: string;
}

export const THAI_PROVINCES: Province[] = [
  // Central / Greater Bangkok
  { id: 'bangkok',          en: 'Bangkok',                    th: 'กรุงเทพมหานคร' },
  { id: 'nonthaburi',       en: 'Nonthaburi',                 th: 'นนทบุรี' },
  { id: 'pathum-thani',     en: 'Pathum Thani',               th: 'ปทุมธานี' },
  { id: 'samut-prakan',     en: 'Samut Prakan',               th: 'สมุทรปราการ' },
  { id: 'samut-sakhon',     en: 'Samut Sakhon',               th: 'สมุทรสาคร' },
  { id: 'samut-songkhram',  en: 'Samut Songkhram',            th: 'สมุทรสงคราม' },
  { id: 'nakhon-pathom',    en: 'Nakhon Pathom',              th: 'นครปฐม' },
  { id: 'ayutthaya',        en: 'Phra Nakhon Si Ayutthaya',   th: 'พระนครศรีอยุธยา' },
  { id: 'ang-thong',        en: 'Ang Thong',                  th: 'อ่างทอง' },
  { id: 'saraburi',         en: 'Saraburi',                   th: 'สระบุรี' },
  { id: 'lopburi',          en: 'Lopburi',                    th: 'ลพบุรี' },
  { id: 'sing-buri',        en: 'Sing Buri',                  th: 'สิงห์บุรี' },
  { id: 'chai-nat',         en: 'Chai Nat',                   th: 'ชัยนาท' },
  { id: 'nakhon-nayok',     en: 'Nakhon Nayok',               th: 'นครนายก' },
  { id: 'suphan-buri',      en: 'Suphan Buri',                th: 'สุพรรณบุรี' },

  // East
  { id: 'chonburi',         en: 'Chonburi',                   th: 'ชลบุรี' },
  { id: 'rayong',           en: 'Rayong',                     th: 'ระยอง' },
  { id: 'chanthaburi',      en: 'Chanthaburi',                th: 'จันทบุรี' },
  { id: 'trat',             en: 'Trat',                       th: 'ตราด' },
  { id: 'chachoengsao',     en: 'Chachoengsao',               th: 'ฉะเชิงเทรา' },
  { id: 'prachin-buri',     en: 'Prachin Buri',               th: 'ปราจีนบุรี' },
  { id: 'sa-kaeo',          en: 'Sa Kaeo',                    th: 'สระแก้ว' },

  // West
  { id: 'kanchanaburi',     en: 'Kanchanaburi',               th: 'กาญจนบุรี' },
  { id: 'ratchaburi',       en: 'Ratchaburi',                 th: 'ราชบุรี' },
  { id: 'phetchaburi',      en: 'Phetchaburi',                th: 'เพชรบุรี' },
  { id: 'prachuap',         en: 'Prachuap Khiri Khan',        th: 'ประจวบคีรีขันธ์' },

  // North
  { id: 'chiang-mai',       en: 'Chiang Mai',                 th: 'เชียงใหม่' },
  { id: 'chiang-rai',       en: 'Chiang Rai',                 th: 'เชียงราย' },
  { id: 'mae-hong-son',     en: 'Mae Hong Son',               th: 'แม่ฮ่องสอน' },
  { id: 'lamphun',          en: 'Lamphun',                    th: 'ลำพูน' },
  { id: 'lampang',          en: 'Lampang',                    th: 'ลำปาง' },
  { id: 'phayao',           en: 'Phayao',                     th: 'พะเยา' },
  { id: 'phrae',            en: 'Phrae',                      th: 'แพร่' },
  { id: 'nan',              en: 'Nan',                        th: 'น่าน' },
  { id: 'uttaradit',        en: 'Uttaradit',                  th: 'อุตรดิตถ์' },
  { id: 'tak',              en: 'Tak',                        th: 'ตาก' },
  { id: 'sukhothai',        en: 'Sukhothai',                  th: 'สุโขทัย' },
  { id: 'kamphaeng-phet',   en: 'Kamphaeng Phet',             th: 'กำแพงเพชร' },
  { id: 'phitsanulok',      en: 'Phitsanulok',                th: 'พิษณุโลก' },
  { id: 'phichit',          en: 'Phichit',                    th: 'พิจิตร' },
  { id: 'phetchabun',       en: 'Phetchabun',                 th: 'เพชรบูรณ์' },
  { id: 'nakhon-sawan',     en: 'Nakhon Sawan',               th: 'นครสวรรค์' },
  { id: 'uthai-thani',      en: 'Uthai Thani',                th: 'อุทัยธานี' },

  // Northeast (Isan)
  { id: 'nakhon-ratchasima', en: 'Nakhon Ratchasima',        th: 'นครราชสีมา' },
  { id: 'chaiyaphum',       en: 'Chaiyaphum',                 th: 'ชัยภูมิ' },
  { id: 'buri-ram',         en: 'Buri Ram',                   th: 'บุรีรัมย์' },
  { id: 'surin',            en: 'Surin',                      th: 'สุรินทร์' },
  { id: 'si-sa-ket',        en: 'Si Sa Ket',                  th: 'ศรีสะเกษ' },
  { id: 'ubon',             en: 'Ubon Ratchathani',           th: 'อุบลราชธานี' },
  { id: 'yasothon',         en: 'Yasothon',                   th: 'ยโสธร' },
  { id: 'amnat-charoen',    en: 'Amnat Charoen',              th: 'อำนาจเจริญ' },
  { id: 'mukdahan',         en: 'Mukdahan',                   th: 'มุกดาหาร' },
  { id: 'roi-et',           en: 'Roi Et',                     th: 'ร้อยเอ็ด' },
  { id: 'maha-sarakham',    en: 'Maha Sarakham',              th: 'มหาสารคาม' },
  { id: 'kalasin',          en: 'Kalasin',                    th: 'กาฬสินธุ์' },
  { id: 'khon-kaen',        en: 'Khon Kaen',                  th: 'ขอนแก่น' },
  { id: 'udon-thani',       en: 'Udon Thani',                 th: 'อุดรธานี' },
  { id: 'nong-khai',        en: 'Nong Khai',                  th: 'หนองคาย' },
  { id: 'bueng-kan',        en: 'Bueng Kan',                  th: 'บึงกาฬ' },
  { id: 'nong-bua-lam-phu', en: 'Nong Bua Lam Phu',          th: 'หนองบัวลำภู' },
  { id: 'loei',             en: 'Loei',                       th: 'เลย' },
  { id: 'sakon-nakhon',     en: 'Sakon Nakhon',               th: 'สกลนคร' },
  { id: 'nakhon-phanom',    en: 'Nakhon Phanom',              th: 'นครพนม' },

  // South
  { id: 'chumphon',         en: 'Chumphon',                   th: 'ชุมพร' },
  { id: 'surat-thani',      en: 'Surat Thani',                th: 'สุราษฎร์ธานี' },
  { id: 'nakhon-si-thammarat', en: 'Nakhon Si Thammarat',    th: 'นครศรีธรรมราช' },
  { id: 'phatthalung',      en: 'Phatthalung',                th: 'พัทลุง' },
  { id: 'songkhla',         en: 'Songkhla',                   th: 'สงขลา' },
  { id: 'pattani',          en: 'Pattani',                    th: 'ปัตตานี' },
  { id: 'yala',             en: 'Yala',                       th: 'ยะลา' },
  { id: 'narathiwat',       en: 'Narathiwat',                 th: 'นราธิวาส' },
  { id: 'satun',            en: 'Satun',                      th: 'สตูล' },
  { id: 'trang',            en: 'Trang',                      th: 'ตรัง' },
  { id: 'krabi',            en: 'Krabi',                      th: 'กระบี่' },
  { id: 'phang-nga',        en: 'Phang Nga',                  th: 'พังงา' },
  { id: 'phuket',           en: 'Phuket',                     th: 'ภูเก็ต' },
  { id: 'ranong',           en: 'Ranong',                     th: 'ระนอง' },
];

export function getProvinceLabel(id: string, lang: 'en' | 'th'): string {
  const p = THAI_PROVINCES.find(p => p.id === id);
  if (!p) return id;
  return lang === 'th' ? p.th : p.en;
}
