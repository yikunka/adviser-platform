// Shared KYC location/country data and helpers (used by client + admin forms)
export type RegionOption = { value: string; cities: string[] }
export type CountryOption = { value: string; regions: RegionOption[] }

export const LOCATION_COUNTRIES: CountryOption[] = [
  {
    value: 'Mainland China',
    regions: [
      { value: 'Anhui', cities: ['Hefei', 'Wuhu', 'Bengbu', 'Fuyang', 'Other'] },
      { value: 'Beijing', cities: ['Beijing', 'Other'] },
      { value: 'Chongqing', cities: ['Chongqing', 'Other'] },
      { value: 'Fujian', cities: ['Fuzhou', 'Xiamen', 'Quanzhou', 'Other'] },
      { value: 'Gansu', cities: ['Lanzhou', 'Tianshui', 'Other'] },
      { value: 'Guangdong', cities: ['Guangzhou', 'Shenzhen', 'Dongguan', 'Foshan', 'Zhuhai', 'Huizhou', 'Zhongshan', 'Jiangmen', 'Shantou', 'Other'] },
      { value: 'Guangxi', cities: ['Nanning', 'Guilin', 'Liuzhou', 'Other'] },
      { value: 'Guizhou', cities: ['Guiyang', 'Zunyi', 'Other'] },
      { value: 'Hainan', cities: ['Haikou', 'Sanya', 'Other'] },
      { value: 'Hebei', cities: ['Shijiazhuang', 'Tangshan', 'Baoding', 'Other'] },
      { value: 'Heilongjiang', cities: ['Harbin', 'Qiqihar', 'Other'] },
      { value: 'Henan', cities: ['Zhengzhou', 'Luoyang', 'Kaifeng', 'Other'] },
      { value: 'Hubei', cities: ['Wuhan', 'Yichang', 'Xiangyang', 'Other'] },
      { value: 'Hunan', cities: ['Changsha', 'Zhuzhou', 'Xiangtan', 'Other'] },
      { value: 'Inner Mongolia', cities: ['Hohhot', 'Baotou', 'Other'] },
      { value: 'Jiangsu', cities: ['Nanjing', 'Suzhou', 'Wuxi', 'Changzhou', 'Nantong', 'Other'] },
      { value: 'Jiangxi', cities: ['Nanchang', 'Ganzhou', 'Jiujiang', 'Other'] },
      { value: 'Jilin', cities: ['Changchun', 'Jilin', 'Other'] },
      { value: 'Liaoning', cities: ['Shenyang', 'Dalian', 'Anshan', 'Other'] },
      { value: 'Ningxia', cities: ['Yinchuan', 'Other'] },
      { value: 'Qinghai', cities: ['Xining', 'Other'] },
      { value: 'Shaanxi', cities: ['Xi’an', 'Xianyang', 'Baoji', 'Other'] },
      { value: 'Shandong', cities: ['Jinan', 'Qingdao', 'Yantai', 'Weifang', 'Other'] },
      { value: 'Shanghai', cities: ['Shanghai', 'Other'] },
      { value: 'Shanxi', cities: ['Taiyuan', 'Datong', 'Other'] },
      { value: 'Sichuan', cities: ['Chengdu', 'Mianyang', 'Other'] },
      { value: 'Tianjin', cities: ['Tianjin', 'Other'] },
      { value: 'Tibet', cities: ['Lhasa', 'Other'] },
      { value: 'Xinjiang', cities: ['Urumqi', 'Kashgar', 'Other'] },
      { value: 'Yunnan', cities: ['Kunming', 'Dali', 'Lijiang', 'Other'] },
      { value: 'Zhejiang', cities: ['Hangzhou', 'Ningbo', 'Wenzhou', 'Jinhua', 'Other'] },
      { value: 'Other', cities: ['Other'] },
    ],
  },
  {
    value: 'Hong Kong',
    regions: [
      { value: 'Hong Kong Island', cities: ['Central and Western', 'Wan Chai', 'Eastern', 'Southern', 'Other'] },
      { value: 'Kowloon', cities: ['Yau Tsim Mong', 'Sham Shui Po', 'Kowloon City', 'Wong Tai Sin', 'Kwun Tong', 'Other'] },
      { value: 'New Territories', cities: ['Tsuen Wan', 'Tuen Mun', 'Yuen Long', 'North', 'Tai Po', 'Sha Tin', 'Sai Kung', 'Kwai Tsing', 'Other'] },
      { value: 'Outlying Islands', cities: ['Islands', 'Other'] },
      { value: 'Other', cities: ['Other'] },
    ],
  },
  { value: 'Macau', regions: [{ value: 'Macau Peninsula / Islands', cities: ['Nossa Senhora de Fatima', 'Santo Antonio', 'Sao Lazaro', 'Sao Lourenco', 'Se', 'Taipa', 'Coloane', 'Cotai', 'Other'] }, { value: 'Other', cities: ['Other'] }] },
  { value: 'Taiwan', regions: [
    { value: 'Taipei', cities: ['Taipei', 'Other'] },
    { value: 'New Taipei', cities: ['New Taipei', 'Other'] },
    { value: 'Taoyuan', cities: ['Taoyuan', 'Other'] },
    { value: 'Taichung', cities: ['Taichung', 'Other'] },
    { value: 'Tainan', cities: ['Tainan', 'Other'] },
    { value: 'Kaohsiung', cities: ['Kaohsiung', 'Other'] },
    { value: 'Hsinchu', cities: ['Hsinchu', 'Other'] },
    { value: 'Keelung', cities: ['Keelung', 'Other'] },
    { value: 'Other', cities: ['Other'] },
  ] },
  { value: 'Singapore', regions: [{ value: 'Singapore', cities: ['Singapore'] }] },
  { value: 'Malaysia', regions: [{ value: 'Malaysia', cities: ['Kuala Lumpur', 'Johor Bahru', 'Penang', 'Other'] }] },
  { value: 'United Kingdom', regions: [{ value: 'United Kingdom', cities: ['London', 'Manchester', 'Birmingham', 'Other'] }] },
  { value: 'United States', regions: [{ value: 'United States', cities: ['New York', 'Los Angeles', 'San Francisco', 'Other'] }] },
  { value: 'Canada', regions: [{ value: 'Canada', cities: ['Toronto', 'Vancouver', 'Montreal', 'Other'] }] },
  { value: 'Australia', regions: [{ value: 'Australia', cities: ['Sydney', 'Melbourne', 'Brisbane', 'Other'] }] },
  { value: 'Afghanistan', regions: [{ value: 'Afghanistan', cities: ['Kabul', 'Other'] }] },
  { value: 'Argentina', regions: [{ value: 'Argentina', cities: ['Buenos Aires', 'Cordoba', 'Other'] }] },
  { value: 'Austria', regions: [{ value: 'Austria', cities: ['Vienna', 'Other'] }] },
  { value: 'Bangladesh', regions: [{ value: 'Bangladesh', cities: ['Dhaka', 'Chittagong', 'Other'] }] },
  { value: 'Belgium', regions: [{ value: 'Belgium', cities: ['Brussels', 'Other'] }] },
  { value: 'Brazil', regions: [{ value: 'Brazil', cities: ['Sao Paulo', 'Rio de Janeiro', 'Brasilia', 'Other'] }] },
  { value: 'Cambodia', regions: [{ value: 'Cambodia', cities: ['Phnom Penh', 'Siem Reap', 'Other'] }] },
  { value: 'Chile', regions: [{ value: 'Chile', cities: ['Santiago', 'Other'] }] },
  { value: 'Denmark', regions: [{ value: 'Denmark', cities: ['Copenhagen', 'Other'] }] },
  { value: 'Egypt', regions: [{ value: 'Egypt', cities: ['Cairo', 'Alexandria', 'Other'] }] },
  { value: 'Finland', regions: [{ value: 'Finland', cities: ['Helsinki', 'Other'] }] },
  { value: 'France', regions: [{ value: 'France', cities: ['Paris', 'Lyon', 'Marseille', 'Other'] }] },
  { value: 'Germany', regions: [{ value: 'Germany', cities: ['Berlin', 'Frankfurt', 'Munich', 'Other'] }] },
  { value: 'India', regions: [{ value: 'India', cities: ['Mumbai', 'Delhi', 'Bengaluru', 'Other'] }] },
  { value: 'Indonesia', regions: [{ value: 'Indonesia', cities: ['Jakarta', 'Surabaya', 'Other'] }] },
  { value: 'Ireland', regions: [{ value: 'Ireland', cities: ['Dublin', 'Cork', 'Other'] }] },
  { value: 'Italy', regions: [{ value: 'Italy', cities: ['Rome', 'Milan', 'Other'] }] },
  { value: 'Japan', regions: [{ value: 'Japan', cities: ['Tokyo', 'Osaka', 'Yokohama', 'Other'] }] },
  { value: 'Mexico', regions: [{ value: 'Mexico', cities: ['Mexico City', 'Guadalajara', 'Other'] }] },
  { value: 'Myanmar', regions: [{ value: 'Myanmar', cities: ['Yangon', 'Mandalay', 'Other'] }] },
  { value: 'Netherlands', regions: [{ value: 'Netherlands', cities: ['Amsterdam', 'Rotterdam', 'Other'] }] },
  { value: 'New Zealand', regions: [{ value: 'New Zealand', cities: ['Auckland', 'Wellington', 'Other'] }] },
  { value: 'Norway', regions: [{ value: 'Norway', cities: ['Oslo', 'Other'] }] },
  { value: 'Pakistan', regions: [{ value: 'Pakistan', cities: ['Karachi', 'Lahore', 'Islamabad', 'Other'] }] },
  { value: 'Philippines', regions: [{ value: 'Philippines', cities: ['Manila', 'Cebu', 'Other'] }] },
  { value: 'Poland', regions: [{ value: 'Poland', cities: ['Warsaw', 'Krakow', 'Other'] }] },
  { value: 'Portugal', regions: [{ value: 'Portugal', cities: ['Lisbon', 'Porto', 'Other'] }] },
  { value: 'Russia', regions: [{ value: 'Russia', cities: ['Moscow', 'Saint Petersburg', 'Other'] }] },
  { value: 'Saudi Arabia', regions: [{ value: 'Saudi Arabia', cities: ['Riyadh', 'Jeddah', 'Other'] }] },
  { value: 'South Korea', regions: [{ value: 'South Korea', cities: ['Seoul', 'Busan', 'Other'] }] },
  { value: 'Spain', regions: [{ value: 'Spain', cities: ['Madrid', 'Barcelona', 'Other'] }] },
  { value: 'Sweden', regions: [{ value: 'Sweden', cities: ['Stockholm', 'Gothenburg', 'Other'] }] },
  { value: 'Switzerland', regions: [{ value: 'Switzerland', cities: ['Zurich', 'Geneva', 'Other'] }] },
  { value: 'Thailand', regions: [{ value: 'Thailand', cities: ['Bangkok', 'Chiang Mai', 'Other'] }] },
  { value: 'Turkey', regions: [{ value: 'Turkey', cities: ['Istanbul', 'Ankara', 'Other'] }] },
  { value: 'United Arab Emirates', regions: [{ value: 'United Arab Emirates', cities: ['Dubai', 'Abu Dhabi', 'Other'] }] },
  { value: 'Vietnam', regions: [{ value: 'Vietnam', cities: ['Ho Chi Minh City', 'Hanoi', 'Other'] }] },
  { value: 'Other', regions: [{ value: 'Other', cities: ['Other'] }] },
]

export const kycSelectOptionStyle = { background: '#141414' }

export const ZH_LOCATION_LABELS: Record<string, string> = {
  'Mainland China': '中国内地',
  'Hong Kong': '香港',
  'Macau': '澳门',
  'Taiwan': '台湾',
  'Other': '其他',
  'Hong Kong Island': '香港岛',
  'Kowloon': '九龙',
  'New Territories': '新界',
  'Outlying Islands': '离岛',
  'Central and Western': '中西区',
  'Wan Chai': '湾仔',
  'Eastern': '东区',
  'Southern': '南区',
  'Yau Tsim Mong': '油尖旺',
  'Sham Shui Po': '深水埗',
  'Kowloon City': '九龙城',
  'Wong Tai Sin': '黄大仙',
  'Kwun Tong': '观塘',
  'Tsuen Wan': '荃湾',
  'Tuen Mun': '屯门',
  'Yuen Long': '元朗',
  'North': '北区',
  'Tai Po': '大埔',
  'Sha Tin': '沙田',
  'Sai Kung': '西贡',
  'Kwai Tsing': '葵青',
  'Islands': '离岛',
  'Macau Peninsula / Islands': '澳门半岛/离岛',
  'Taipa': '氹仔',
  'Coloane': '路环',
  'Cotai': '路氹',
  'Taipei': '台北',
  'New Taipei': '新北',
  'Taoyuan': '桃园',
  'Taichung': '台中',
  'Tainan': '台南',
  'Kaohsiung': '高雄',
  'Hsinchu': '新竹',
  'Keelung': '基隆',
  'Anhui': '安徽',
  'Beijing': '北京',
  'Chongqing': '重庆',
  'Fujian': '福建',
  'Gansu': '甘肃',
  'Guangdong': '广东',
  'Guangxi': '广西',
  'Guizhou': '贵州',
  'Hainan': '海南',
  'Hebei': '河北',
  'Heilongjiang': '黑龙江',
  'Henan': '河南',
  'Hubei': '湖北',
  'Hunan': '湖南',
  'Inner Mongolia': '内蒙古',
  'Jiangsu': '江苏',
  'Jiangxi': '江西',
  'Jilin': '吉林',
  'Liaoning': '辽宁',
  'Ningxia': '宁夏',
  'Qinghai': '青海',
  'Shaanxi': '陕西',
  'Shandong': '山东',
  'Shanghai': '上海',
  'Shanxi': '山西',
  'Sichuan': '四川',
  'Tianjin': '天津',
  'Tibet': '西藏',
  'Xinjiang': '新疆',
  'Yunnan': '云南',
  'Zhejiang': '浙江',
  'Hefei': '合肥',
  'Wuhu': '芜湖',
  'Bengbu': '蚌埠',
  'Fuyang': '阜阳',
  'Fuzhou': '福州',
  'Xiamen': '厦门',
  'Quanzhou': '泉州',
  'Lanzhou': '兰州',
  'Tianshui': '天水',
  'Guangzhou': '广州',
  'Shenzhen': '深圳',
  'Dongguan': '东莞',
  'Foshan': '佛山',
  'Zhuhai': '珠海',
  'Huizhou': '惠州',
  'Zhongshan': '中山',
  'Jiangmen': '江门',
  'Shantou': '汕头',
  'Nanning': '南宁',
  'Guilin': '桂林',
  'Liuzhou': '柳州',
  'Guiyang': '贵阳',
  'Zunyi': '遵义',
  'Haikou': '海口',
  'Sanya': '三亚',
  'Shijiazhuang': '石家庄',
  'Tangshan': '唐山',
  'Baoding': '保定',
  'Harbin': '哈尔滨',
  'Qiqihar': '齐齐哈尔',
  'Zhengzhou': '郑州',
  'Luoyang': '洛阳',
  'Kaifeng': '开封',
  'Wuhan': '武汉',
  'Yichang': '宜昌',
  'Xiangyang': '襄阳',
  'Changsha': '长沙',
  'Zhuzhou': '株洲',
  'Xiangtan': '湘潭',
  'Hohhot': '呼和浩特',
  'Baotou': '包头',
  'Nanjing': '南京',
  'Suzhou': '苏州',
  'Wuxi': '无锡',
  'Changzhou': '常州',
  'Nantong': '南通',
  'Nanchang': '南昌',
  'Ganzhou': '赣州',
  'Jiujiang': '九江',
  'Changchun': '长春',
  'Shenyang': '沈阳',
  'Dalian': '大连',
  'Anshan': '鞍山',
  'Yinchuan': '银川',
  'Xining': '西宁',
  'Xi’an': '西安',
  'Xianyang': '咸阳',
  'Baoji': '宝鸡',
  'Jinan': '济南',
  'Qingdao': '青岛',
  'Yantai': '烟台',
  'Weifang': '潍坊',
  'Taiyuan': '太原',
  'Datong': '大同',
  'Chengdu': '成都',
  'Mianyang': '绵阳',
  'Lhasa': '拉萨',
  'Urumqi': '乌鲁木齐',
  'Kashgar': '喀什',
  'Kunming': '昆明',
  'Dali': '大理',
  'Lijiang': '丽江',
  'Hangzhou': '杭州',
  'Ningbo': '宁波',
  'Wenzhou': '温州',
  'Jinhua': '金华',
}

export const ZH_UI_LABELS: Record<string, string> = {
  'Country / Region': '国家/地区',
  'Province / State': '省/州',
  City: '城市',
  'Other country': '其他国家/地区',
  'Other province / state': '其他省/州',
  'Other city': '其他城市',
  'Other country / nationality': '其他国家/国籍',
  'Detail address': '详细地址',
}

export function isChineseLocale(locale: string) {
  return locale.toLowerCase().startsWith('zh')
}

export function localizeOption(value: string, zh: boolean) {
  return zh ? ZH_LOCATION_LABELS[value] ?? value : value
}

export function localizeUi(value: string, zh: boolean) {
  return zh ? ZH_UI_LABELS[value] ?? value : value
}

export function countryFor(value: string) {
  return LOCATION_COUNTRIES.find((country) => country.value === value)
}

export function regionFor(country: string, region: string) {
  return countryFor(country)?.regions.find((row) => row.value === region)
}

export function joinParts(parts: string[]) {
  return parts.map((part) => part.trim()).filter(Boolean).join(' / ')
}

export function splitLocationValue(value?: string) {
  const parts = (value ?? '').split(' / ').map((part) => part.trim()).filter(Boolean)
  const rawCountry = parts[0] ?? ''
  const country = rawCountry && countryFor(rawCountry) ? rawCountry : rawCountry ? 'Other' : ''
  const countryOther = country === 'Other' && rawCountry !== 'Other' ? rawCountry : ''
  const countryOption = countryFor(country)
  const rawRegion = parts[1] ?? ''
  const region = rawRegion && countryOption?.regions.some((row) => row.value === rawRegion) ? rawRegion : rawRegion ? 'Other' : ''
  const regionOther = region === 'Other' && rawRegion !== 'Other' ? rawRegion : ''
  const regionOption = countryOption?.regions.find((row) => row.value === region)
  const rawCity = parts.slice(2).join(' / ')
  const city = rawCity && regionOption?.cities.includes(rawCity) ? rawCity : rawCity ? 'Other' : ''
  const cityOther = city === 'Other' && rawCity !== 'Other' ? rawCity : ''
  return { country, countryOther, region, regionOther, city, cityOther }
}

export function splitAddressValue(value?: string) {
  const parts = (value ?? '').split(' / ').map((part) => part.trim()).filter(Boolean)
  const rawCountry = parts[0] ?? ''
  const country = rawCountry && countryFor(rawCountry) ? rawCountry : rawCountry ? 'Other' : ''
  const countryOther = country === 'Other' && rawCountry !== 'Other' ? rawCountry : ''
  const countryOption = countryFor(country)

  if (countryOption) {
    const maybeRegion = parts[1] ?? ''
    const regionOption = countryOption.regions.find((row) => row.value === maybeRegion)
    if (!regionOption) {
      return { country, countryOther, region: maybeRegion ? 'Other' : '', regionOther: maybeRegion === 'Other' ? '' : maybeRegion, city: '', cityOther: '', detail: parts.slice(maybeRegion ? 2 : 1).join(' / ') }
    }

    const maybeCity = parts[2] ?? ''
    const hasCity = regionOption.cities.includes(maybeCity)
    return {
      country,
      countryOther,
      region: maybeRegion,
      regionOther: '',
      city: hasCity ? maybeCity : maybeCity ? 'Other' : '',
      cityOther: hasCity || !maybeCity ? '' : maybeCity,
      detail: parts.slice(hasCity || maybeCity ? 3 : 2).join(' / '),
    }
  }

  return { country: '', countryOther: '', region: '', regionOther: '', city: '', cityOther: '', detail: value ?? '' }
}

export function actualCountry(parts: { country: string; countryOther: string }) {
  return parts.country === 'Other' ? parts.countryOther || 'Other' : parts.country
}

export function actualRegion(parts: { region: string; regionOther: string }) {
  return parts.region === 'Other' ? parts.regionOther || 'Other' : parts.region
}

export function actualCity(parts: { city: string; cityOther: string }) {
  return parts.city === 'Other' ? parts.cityOther || 'Other' : parts.city
}

export function hasUnfilledOther(value: string | null | undefined) {
  return (value ?? '').split(' / ').some((part) => part.trim() === 'Other')
}
