export interface TargetQuery {
  region: string;
  microLocation: string;
  category: string;
  searchQuery: string;
}

export const REGIONAL_QUERIES: TargetQuery[] = [
  // 1. Kalimpong (Target: 45)
  { region: 'Kalimpong', microLocation: 'Lava', category: 'Homestay', searchQuery: 'homestays in Lava Kalimpong' },
  { region: 'Kalimpong', microLocation: 'Rishop', category: 'Homestay', searchQuery: 'homestays in Rishop Kalimpong' },
  { region: 'Kalimpong', microLocation: 'Pedong', category: 'Homestay', searchQuery: 'homestays in Pedong Kalimpong' },
  { region: 'Kalimpong', microLocation: 'Icche Gaon', category: 'Homestay', searchQuery: 'homestays in Icche Gaon Kalimpong' },
  { region: 'Kalimpong', microLocation: 'Kaagey', category: 'Farmstay', searchQuery: 'farmstays in Kalimpong' },
  { region: 'Kalimpong', microLocation: 'Chhibo', category: 'Farmstay', searchQuery: 'organic farmstay Kalimpong' },
  { region: 'Kalimpong', microLocation: 'Morgan House area', category: 'Estate Stays', searchQuery: 'estate stays Kalimpong heritage' },
  { region: 'Kalimpong', microLocation: 'Deolo', category: 'Experiential Stays', searchQuery: 'glamping cabins Deolo Kalimpong' },
  { region: 'Kalimpong', microLocation: 'Kalimpong Town', category: 'Hostels / B&B / Guest House / Lodge', searchQuery: 'guest house lodge Kalimpong' },

  // 2. Darjeeling (Target: 110)
  { region: 'Darjeeling', microLocation: 'Sittong', category: 'Homestay', searchQuery: 'Sittong homestay' },
  { region: 'Darjeeling', microLocation: 'Lamahatta', category: 'Homestay', searchQuery: 'Lamahatta homestay' },
  { region: 'Darjeeling', microLocation: 'Bijonbari', category: 'Farmstay', searchQuery: 'farmstay in Bijonbari Darjeeling' },
  { region: 'Darjeeling', microLocation: 'Takdah', category: 'Estate Stays', searchQuery: 'tea garden estate stay Takdah Darjeeling' },
  { region: 'Darjeeling', microLocation: 'Tinchuley', category: 'Homestay', searchQuery: 'homestays in Tinchuley Darjeeling' },
  { region: 'Darjeeling', microLocation: 'Kurseong', category: 'Estate Stays', searchQuery: 'tea estate homestay Kurseong' },
  { region: 'Darjeeling', microLocation: 'Mirik', category: 'Homestay', searchQuery: 'homestay in Mirik lake' },
  { region: 'Darjeeling', microLocation: 'Lebong', category: 'Homestay', searchQuery: 'Lebong homestay' },
  { region: 'Darjeeling', microLocation: 'Rongli Rangliot', category: 'Estate Stays', searchQuery: 'tea estate retreat Darjeeling' },
  { region: 'Darjeeling', microLocation: 'Sukhiapokhri', category: 'Experiential Stays', searchQuery: 'cabin glamping forest stay Darjeeling' },
  { region: 'Darjeeling', microLocation: 'Darjeeling Town', category: 'Hostels / B&B / Guest House / Lodge', searchQuery: 'backpacker hostel guest house Darjeeling' },

  // 3. Sikkim (Target: 120)
  { region: 'Sikkim', microLocation: 'Ravangla', category: 'Homestay', searchQuery: 'homestays in Ravangla Sikkim' },
  { region: 'Sikkim', microLocation: 'Pelling', category: 'Homestay', searchQuery: 'village homestays in Pelling' },
  { region: 'Sikkim', microLocation: 'Yuksom', category: 'Homestay', searchQuery: 'homestays in Yuksom West Sikkim' },
  { region: 'Sikkim', microLocation: 'Dzongu', category: 'Homestay', searchQuery: 'homestays in Dzongu North Sikkim' },
  { region: 'Sikkim', microLocation: 'Borong', category: 'Farmstay', searchQuery: 'organic farmstay in Borong Sikkim' },
  { region: 'Sikkim', microLocation: 'Okhrey', category: 'Farmstay', searchQuery: 'farmstay in Okhrey Sikkim' },
  { region: 'Sikkim', microLocation: 'Temi', category: 'Estate Stays', searchQuery: 'Temi tea garden stay Sikkim' },
  { region: 'Sikkim', microLocation: 'Zuluk', category: 'Experiential Stays', searchQuery: 'Silk route homestay Zuluk Sikkim' },
  { region: 'Sikkim', microLocation: 'Lachung', category: 'Hostels / B&B / Guest House / Lodge', searchQuery: 'lodge guest house Lachung Sikkim' },

  // 4. Dooars (Target: 60)
  { region: 'Dooars', microLocation: 'Lataguri', category: 'Homestay', searchQuery: 'homestays in Lataguri Dooars' },
  { region: 'Dooars', microLocation: 'Murti', category: 'Experiential Stays', searchQuery: 'nature resort stays in Murti Dooars' },
  { region: 'Dooars', microLocation: 'Jaldapara', category: 'Homestay', searchQuery: 'homestays near Jaldapara sanctuary' },
  { region: 'Dooars', microLocation: 'Buxa', category: 'Homestay', searchQuery: 'Buxa tiger reserve homestay' },
  { region: 'Dooars', microLocation: 'Chilapata', category: 'Farmstay', searchQuery: 'forest farmstay Chilapata Dooars' },
  { region: 'Dooars', microLocation: 'Samsing', category: 'Estate Stays', searchQuery: 'tea garden homestay Samsing Dooars' },
  { region: 'Dooars', microLocation: 'Madarihat', category: 'Hostels / B&B / Guest House / Lodge', searchQuery: 'lodge guest house Dooars Madarihat' },

  // 5. Rest of West Bengal (Target: 90)
  { region: 'Rest of West Bengal', microLocation: 'Purulia Ajodhya Hills', category: 'Homestay', searchQuery: 'homestays in Ajodhya Hills Purulia' },
  { region: 'Rest of West Bengal', microLocation: 'Shantiniketan', category: 'Farmstay', searchQuery: 'farmstay mud house Shantiniketan' },
  { region: 'Rest of West Bengal', microLocation: 'Jhargram', category: 'Estate Stays', searchQuery: 'palace heritage retreat Jhargram' },
  { region: 'Rest of West Bengal', microLocation: 'Mousuni Island', category: 'Experiential Stays', searchQuery: 'mud house camp tent stays Mousuni Island' },
  { region: 'Rest of West Bengal', microLocation: 'Tajpur', category: 'Experiential Stays', searchQuery: 'eco cottage retreat Tajpur' },
  { region: 'Rest of West Bengal', microLocation: 'Bishnupur', category: 'Hostels / B&B / Guest House / Lodge', searchQuery: 'guest house lodge Bishnupur' },
];

export function getQueriesForRegionAndCategory(region?: string, category?: string): TargetQuery[] {
  return REGIONAL_QUERIES.filter(q => {
    if (region && q.region !== region) return false;
    if (category && q.category !== category) return false;
    return true;
  });
}
