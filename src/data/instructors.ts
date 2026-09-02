// ============================================================================
// BARUNA — Reusable Instructor / Expert database
// ----------------------------------------------------------------------------
// Single source of truth for instructor profiles, shared across:
//   • Academy (training programs)
//   • Experts Directory
//   • Fellowship & Exchange
//   • Knowledge Hub
// All names, biographies, expertise, organizations and photos are sourced
// directly from the uploaded "Instructors.docx" — do not invent or substitute.
// ============================================================================

import putuPhoto from "@/assets/instructors/i-putu-suarma.jpg";
import sriPhoto from "@/assets/instructors/sri-astutik.jpg";
import achmadPhoto from "@/assets/instructors/achmad-suhermanto.jpg";
import sumartinPhoto from "@/assets/instructors/sumartin.jpg";
import firmanPhoto from "@/assets/instructors/firman-pra-setia-nugraha.jpg";
import herisonPhoto from "@/assets/instructors/herison-lingga.jpg";
import erikaPhoto from "@/assets/instructors/erika-arisetiana-dewi.jpg";
import emiPhoto from "@/assets/instructors/emi-wati.jpg";
import rickyPhoto from "@/assets/instructors/ricky-aditya-saputra.jpg";
import imanPhoto from "@/assets/instructors/iman-setya-dwi-ardani.jpg";

export type InstructorGroup =
  | "Lead Instructors"
  | "Aquaculture Specialists"
  | "Fish Processing & Value Addition Specialists";

export type Instructor = {
  slug: string;
  name: string;
  position: string;
  organization: string;
  expertise: string[];
  summary: string;
  biography: string;
  programRole: string;
  email?: string;
  photo: string;
  group: InstructorGroup;
  programs: string[];
};

export const instructors: Instructor[] = [
  // ----- Lead Instructors -----
  {
    slug: "i-putu-suarma",
    name: "I Putu Suarma",
    position: "Mid-Level Instructor",
    organization: "Banyuwangi Fisheries Training and Extension Center (BPPP Banyuwangi)",
    expertise: [
      "Aquaculture Management",
      "Fish Seed Selection",
      "Feeding Systems",
      "Fish Farmer Capacity Development",
    ],
    summary:
      "More than 30 years of experience in aquaculture training and fisheries extension. Specialized in fish quality management, superior seed selection, efficient feeding techniques, and practical capacity building for fish farmers throughout Indonesia.",
    biography:
      "I Putu Suarma is a Mid-Level Instructor at Banyuwangi Fisheries Training and Extension Center (BPPP Banyuwangi) with over 30 years of experience in aquaculture. Born in Jembrana, he earned his Bachelor's degree in Fisheries from the Universitas 17 Agustus 1945 Banyuwangi in 2000. He is skilled in water quality management, selecting superior seeds, and efficient feeding techniques. Known for his excellent communication skills, I Putu Suarma has led various training programs that have enhanced fish farmers' skills across Indonesia. His participation in trainings such as Fish Resource Supervision Training and Grouper Aquaculture Training has enriched his expertise in this field. Committed to human resource development in the fisheries sector, he continues to significantly contribute to increasing productivity and the well-being of fish farmers in Indonesia.",
    programRole: "Lead Instructor – Aquaculture Production and Farm Management",
    email: "putu.suarma@yahoo.co.id",
    photo: putuPhoto,
    group: "Lead Instructors",
    programs: ["international-training-fisheries-african-countries"],
  },
  {
    slug: "sri-astutik",
    name: "Sri Astutik",
    position: "Senior Instructor",
    organization: "Banyuwangi Fisheries Training and Extension Center (BPPP Banyuwangi)",
    expertise: [
      "Marine Aquaculture",
      "Freshwater Aquaculture",
      "Occupational Health & Safety",
      "Competency Assessment",
    ],
    summary:
      "Senior fisheries trainer with more than two decades of experience in fisheries education, competency assessment, and human resource development. Extensive experience in national competency standards and technical training delivery.",
    biography:
      "Sri Astutik is a Senior Instructor at the Banyuwangi Fisheries Training and Extension Center (BPPP Banyuwangi), with over two decades of experience that underscore her expertise and dedication in the field. A Bachelor's degree graduate, she has been an integral part of BPPP Banyuwangi since 1996, starting her career as a Technical Officer before transitioning to an instructor role in 2008. Throughout her career, Sri has continually enhanced her skills through various professional training programs, including marine aquaculture, freshwater fish farming, competency assessment such as the Training on the Preparation and Verification of National Work Competency Standards (SKKNI), and occupational health and safety. Her unwavering commitment to education and training in the fisheries sector highlights her significant contributions to the field.",
    programRole: "Lead Instructor – Capacity Building and Training Management",
    email: "sri.astutik@kkp.go.id",
    photo: sriPhoto,
    group: "Lead Instructors",
    programs: ["international-training-fisheries-african-countries"],
  },

  // ----- Aquaculture Specialists -----
  {
    slug: "achmad-suhermanto",
    name: "Achmad Suhermanto",
    position: "Lecturer",
    organization: "Karawang Marine and Fisheries Polytechnic",
    expertise: ["Aquaculture Science", "Fish Vaccination", "Tilapia Farming", "Aquaculture Research"],
    summary:
      "Aquaculture scientist and lecturer specializing in fish vaccines and fish health management, particularly tilapia vaccination technology and applied aquaculture research.",
    biography:
      "Achmad Suhermanto completed his formal education in aquaculture, earning a Bachelor of Applied Science from the Jakarta Fisheries College (STP Jakarta), a Master's degree from Brawijaya University (UB Malang), and a doctoral degree in aquaculture science from Bogor Agricultural University. He currently serves as a lecturer at the Karawang Marine and Fisheries Polytechnic under the Ministry of Marine Affairs and Fisheries, teaching in the diploma program of Fish Farming. His research focuses on vaccines for fish, particularly tilapia. One of his research outcomes has been patented with patent code IDP000084140, and the resulting vaccine product is currently in the registration process.",
    programRole: "Instructor – Fish Health and Vaccination",
    photo: achmadPhoto,
    group: "Aquaculture Specialists",
    programs: ["international-training-fisheries-african-countries"],
  },
  {
    slug: "sumartin",
    name: "Sumartin",
    position: "Senior Trainer",
    organization: "Banyuwangi Fisheries Training and Extension Center (BPPP Banyuwangi)",
    expertise: [
      "Aquaculture Production",
      "Training Curriculum Development",
      "Good Aquaculture Practices",
      "Competency-Based Training",
    ],
    summary:
      "Experienced fisheries trainer with more than 30 years of service in aquaculture development, curriculum design, and professional training programs.",
    biography:
      "Sumartin is a Senior Trainer at Banyuwangi Fisheries Training and Extension Center (BPPP Banyuwangi) with over 30 years of experience. She obtained her Bachelor's degree from DR. Soetomo University and her Master's degree from Brawijaya University, both in Aquaculture. With expertise in aquaculture, managerial, and training curriculum development, Sumartin has led various training programs for civil servants and the public. Her participation in trainings such as CBIB Verifier, Asean Training Course on Good Aquaculture Production, and Indonesian National Work Competency Standards (SKKNI) training has enhanced her competencies. Her commitment to human resource development in the fisheries sector continues to significantly contribute to increasing productivity and the well-being of fish farmers in Indonesia.",
    programRole: "Instructor – Aquaculture Management",
    email: "sumartinmartin@yahoo.co.id",
    photo: sumartinPhoto,
    group: "Aquaculture Specialists",
    programs: ["international-training-fisheries-african-countries"],
  },
  {
    slug: "firman-pra-setia-nugraha",
    name: "Firman Pra Setia Nugraha",
    position: "Aquaculture Instructor",
    organization: "Banyuwangi Fisheries Training and Extension Center (BPPP Banyuwangi)",
    expertise: ["Tilapia Farming", "Catfish Farming", "Freshwater Aquaculture", "Aquaculture Communication"],
    summary:
      "Specialized in freshwater aquaculture systems with extensive experience supporting fish farmers and conducting aquaculture training programs.",
    biography:
      "Firman Pra Setia Nugraha began his career in 2011 as a Fisheries Extension Officer in Banyuwangi Regency, where he guided local fish farmers, focusing on tilapia and catfish farming. His dedication led to his current role as an Aquaculture Instructor at the Banyuwangi Fisheries Training and Extension Center (BPPP Banyuwangi), which he has held since 2023. Firman holds a Diploma 4 in Fisheries Extension and a Master's degree in Fisheries Resource Utilization with a specialization in the Aquaculture Industry from the Jakarta Polytechnic of Fisheries Business Experts. His expertise includes Communication and Freshwater Fish Farming. He has contributed to academia with research published in international and national journals, including articles on the growth performance and survival of Snakehead Fish Juveniles using Terminalia catappa Leaf Powder.",
    programRole: "Instructor – Tilapia and Catfish Farming",
    email: "firmanpnugraha@kkp.go.id",
    photo: firmanPhoto,
    group: "Aquaculture Specialists",
    programs: ["international-training-fisheries-african-countries"],
  },
  {
    slug: "herison-lingga",
    name: "Herison Lingga",
    position: "Instructor",
    organization: "Banyuwangi Fisheries Training and Extension Center (BPPP Banyuwangi)",
    expertise: ["Biofloc Systems", "Catfish Farming", "Tilapia Farming", "Vannamei Shrimp Culture"],
    summary:
      "Experienced practitioner in modern aquaculture technologies, including biofloc systems for catfish and tilapia production.",
    biography:
      "Herison Lingga began his career with a focus on aquaculture and currently serves as a First Instructor at the Functional Group of the Banyuwangi Fisheries Training and Extension Center (BPPP Banyuwangi), under the Human Resources Extension and Development Agency for Marine and Fisheries. He holds a Diploma degree in aquaculture. In his role, Herison specializes in the cultivation of various aquatic species using advanced methods. His expertise includes the enlargement of vaname shrimp (Litopenaeus vannamei) in round ponds, catfish farming using biofloc and probiotic systems in round ponds, and tilapia farming with biofloc systems in round ponds. Appointed as an instructor on July 1, 2023, Herison brings valuable hands-on experience in this position.",
    programRole: "Instructor – Biofloc Technology and Practical Sessions",
    email: "herison.lingga@kkp.go.id",
    photo: herisonPhoto,
    group: "Aquaculture Specialists",
    programs: ["international-training-fisheries-african-countries"],
  },

  // ----- Fish Processing & Value Addition Specialists -----
  {
    slug: "erika-arisetiana-dewi",
    name: "Erika Arisetiana Dewi",
    position: "Fish Processing Instructor",
    organization: "Banyuwangi Fisheries Training and Extension Center (BPPP Banyuwangi)",
    expertise: ["Fish Processing Technology", "HACCP", "Product Diversification", "Food Safety"],
    summary:
      "More than 18 years of experience in fisheries processing, value-added products, food safety, sanitation, and product innovation.",
    biography:
      "Erika Arisetiana Dewi, with over 18 years of experience in fishery product processing, has demonstrated dedication to developing and implementing innovative and sustainable fish processing techniques. Erika holds a Bachelor's degree in Fisheries from Universitas Tujuh Belas Agustus and a Master's degree in Food Science and Technology from Universitas Brawijaya. As an experienced instructor, she has successfully led various training programs designed to enhance the skills of fish processors and marketers across Indonesia. Erika is skilled in various aspects of fish processing, including product diversification, sanitation and hygiene, HACCP, and product quality management. She is also known for her excellent communication skills, enabling training participants to easily understand and implement the material. Throughout her career, Erika has collaborated with various government and non-government agencies, as well as local communities, to promote high-quality fish processing practices that meet Indonesian national standards.",
    programRole: "Instructor – Fish Processing and Product Diversification",
    photo: erikaPhoto,
    group: "Fish Processing & Value Addition Specialists",
    programs: ["international-training-fisheries-african-countries"],
  },
  {
    slug: "emi-wati",
    name: "Emi Wati",
    position: "Senior Instructor",
    organization: "Banyuwangi Fisheries Training and Extension Center (BPPP Banyuwangi)",
    expertise: [
      "Fisheries Community Training",
      "Entrepreneurship",
      "Competency-Based Training",
      "Extension Services",
    ],
    summary:
      "Experienced fisheries educator and trainer with extensive involvement in community development, entrepreneurship, and capacity-building initiatives.",
    biography:
      "Emi Wati is an instructor with a solid background in fisheries and community training. She began her career at Banyuwangi Fisheries Training and Extension Center (BPPP Banyuwangi), where she served as a Junior Instructor from 2000 to 2010, and later advanced to the position of Senior Instructor until 2022. Emi holds a Bachelor's degree from UNTAG 45 Banyuwangi, earned in 2003. Over the years, she has participated in various specialized training programs, including entrepreneurship, competency-based training, and quality management. Her dedication to professional development and passion for fisheries education have made her a valuable asset in her field.",
    programRole: "Instructor – Community Empowerment and Business Development",
    photo: emiPhoto,
    group: "Fish Processing & Value Addition Specialists",
    programs: ["international-training-fisheries-african-countries"],
  },
  {
    slug: "ricky-aditya-saputra",
    name: "Ricky Aditya Saputra",
    position: "Instructor",
    organization: "Banyuwangi Fisheries Training and Extension Center (BPPP Banyuwangi)",
    expertise: [
      "Fish Processing Technology",
      "HACCP",
      "Quality Assurance",
      "Fisheries Processing Certification",
    ],
    summary:
      "Professional background in fisheries processing industries and technical training programs focused on product quality and food safety standards.",
    biography:
      "Ricky Aditya Saputra is a Young Instructor at the Banyuwangi Fisheries Training and Extension Center (BPPP Banyuwangi), under the Ministry of Marine Affairs and Fisheries. Ricky holds a Diploma IV degree in Fisheries Processing Technology and has diverse work experience, including roles as a Production Supervisor at the shrimp freezing company PT. Suri Tani Pemuka Cirebon (2012–2013), Ads Quality Analyst at olx.com in Jakarta (2013–2015), and currently as an Instructor in fish processing at BPPP Banyuwangi (2015–present). He has completed various trainings, such as HACCP training (2012), Certification of Competency in Fisheries Processing (2018), Basic Functional Instructor Training (2018), and Competency Certification in Methodology – KKNI Level IV (2018). His expertise lies in fish processing technology.",
    programRole: "Instructor – Fish Processing Technology",
    email: "rickyadityajo@gmail.com",
    photo: rickyPhoto,
    group: "Fish Processing & Value Addition Specialists",
    programs: ["international-training-fisheries-african-countries"],
  },
  {
    slug: "iman-setya-dwi-ardani",
    name: "Iman Setya Dwi Ardani",
    position: "Instructor",
    organization: "Banyuwangi Fisheries Training and Extension Center (BPPP Banyuwangi)",
    expertise: ["Fish Processing", "Food Technology", "Quality Control", "HACCP"],
    summary:
      "Experienced instructor in fish processing technology with strong industry and training experience in quality control and food safety management.",
    biography:
      "Iman Setya Dwi Ardani is an Instructor at the Banyuwangi Fisheries Training and Extension Center (BPPP Banyuwangi), under the Ministry of Marine Affairs and Fisheries. Iman holds a Diploma degree in Fisheries Processing Technology and a bachelor's degree in Food Technology and Nutrition. His work experience includes roles as a Production Supervisor at a shrimp freezing company (2009–2010), Quality Control at a shrimp cracker company (2010–2014), and currently as an Instructor in fish processing at BPPP Banyuwangi (2014–present). He has completed various trainings, such as HACCP training (2009), Certification of Competency in Fisheries Processing (2018), and Basic Functional Instructor Training.",
    programRole: "Instructor – Quality Assurance and Product Standards",
    photo: imanPhoto,
    group: "Fish Processing & Value Addition Specialists",
    programs: ["international-training-fisheries-african-countries"],
  },
];

export const instructorGroupOrder: InstructorGroup[] = [
  "Lead Instructors",
  "Aquaculture Specialists",
  "Fish Processing & Value Addition Specialists",
];

export const instructorBySlug: Record<string, Instructor> = Object.fromEntries(
  instructors.map((i) => [i.slug, i]),
);

/** Instructors assigned to a given training program, in canonical group order. */
export function instructorsForProgram(programSlug: string): Instructor[] {
  return instructors.filter((i) => i.programs.includes(programSlug));
}

/** Group a list of instructors into their section buckets, preserving order. */
export function groupInstructors(
  list: Instructor[],
): { group: InstructorGroup; items: Instructor[] }[] {
  return instructorGroupOrder
    .map((group) => ({ group, items: list.filter((i) => i.group === group) }))
    .filter((g) => g.items.length > 0);
}
