const AUTHOR_IMAGES: Record<string, string> = {
  'dra. miriam cervantes': 'https://res.cloudinary.com/duiqgfa0v/image/upload/v1761839072/MiriamCervantes1_vid8ol.jpg',
  'miriam cervantes': 'https://res.cloudinary.com/duiqgfa0v/image/upload/v1761839072/MiriamCervantes1_vid8ol.jpg',
  'psic. luis a. galván': 'https://res.cloudinary.com/duiqgfa0v/image/upload/v1761839071/Luis1_ehonlp.jpg',
  'luis a. galván solís': 'https://res.cloudinary.com/duiqgfa0v/image/upload/v1761839071/Luis1_ehonlp.jpg',
  'luis a. galván': 'https://res.cloudinary.com/duiqgfa0v/image/upload/v1761839071/Luis1_ehonlp.jpg',
  'roberto bravo': 'https://res.cloudinary.com/duiqgfa0v/image/upload/v1761839073/RobertoBravo1_icbrae.jpg',
  'roberto bravo romo': 'https://res.cloudinary.com/duiqgfa0v/image/upload/v1761839073/RobertoBravo1_icbrae.jpg',
  'patricia peña': 'https://res.cloudinary.com/duiqgfa0v/image/upload/v1761839072/PatriciaPena1_d62zwv.jpg',
  'patricia peña raigosa': 'https://res.cloudinary.com/duiqgfa0v/image/upload/v1761839072/PatriciaPena1_d62zwv.jpg',
  'bianca macías': 'https://res.cloudinary.com/duiqgfa0v/image/upload/v1761842183/BiancaMacias1_re7wap.jpg',
  'ana laura sosa nevárez': 'https://res.cloudinary.com/duiqgfa0v/image/upload/v1761839074/ANALSI_vd5vol.jpg',
  'silvia andrea soria díaz': 'https://res.cloudinary.com/duiqgfa0v/image/upload/v1761839075/AndreaSoria1_wcgo0t.jpg',
  'karen meraz': 'https://res.cloudinary.com/duiqgfa0v/image/upload/v1761839079/KarenMeraz1_htsbaq.jpg',
  'carina lares': 'https://res.cloudinary.com/duiqgfa0v/image/upload/v1761839076/CarinaLares1_la9v6u.png',
  'carina lares cervantes': 'https://res.cloudinary.com/duiqgfa0v/image/upload/v1761839076/CarinaLares1_la9v6u.png',
  'saraid chávez': 'https://res.cloudinary.com/duiqgfa0v/image/upload/v1761839078/SaraidChavez1_uyd3va.jpg',
};

export const DEFAULT_AUTHOR_IMAGE = 'https://res.cloudinary.com/duiqgfa0v/image/upload/v1761837867/samples/zoom.avif';

export function getImagePerCategory(authorName: string | undefined): string {
  if (!authorName) return DEFAULT_AUTHOR_IMAGE;
  return AUTHOR_IMAGES[authorName.toLowerCase().trim()] || DEFAULT_AUTHOR_IMAGE;
}
