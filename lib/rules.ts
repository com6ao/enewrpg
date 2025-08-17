// lib/rules.ts
export const SURNAMES = {
  hxh: ['Genei Ryodan','Zoldyck','Hunter','Nostrade',"Chimera's Ant",'Dark Hunters'],
  naruto: ['Uchiha','Uzumaki','Senju','Namikaze','Hyuga'],
  onepiece: [
    'dos Chapéus de Palha','do Barba Negra','do Roger','do Barba Branca',
    'do Buggy','da Big Mom','das Feras','da Marinha','do Exército Revolucionário'
  ],
};
export const ALL_SURNAMES = [...SURNAMES.hxh, ...SURNAMES.naruto, ...SURNAMES.onepiece] as const;

export function resolveEnergy(surname: string){
  if (SURNAMES.hxh.includes(surname))   return { universe: 'HxH',       energy: 'Nen'   as const };
  if (SURNAMES.naruto.includes(surname))return { universe: 'Naruto',    energy: 'Chakra'as const };
  if (SURNAMES.onepiece.includes(surname))return{ universe: 'One Piece',energy: 'Haki'  as const };
  return { universe: 'Desconhecido', energy: 'Nen' as const };
}

