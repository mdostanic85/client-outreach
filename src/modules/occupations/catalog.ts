import type { OccupationFamily } from "./families";

export type Occupation = {
  id: string;
  /** English title used in search queries and the UI. */
  en: string;
  /** Serbian title used on Serbian boards (Infostud, HelloWorld). */
  sr: string;
  family: OccupationFamily;
  /** Other ways postings and people name the job, in either language. */
  synonyms: string[];
};

function o(
  id: string,
  en: string,
  sr: string,
  family: OccupationFamily,
  synonyms: string[] = [],
): Occupation {
  return { id, en, sr, family, synonyms };
}

/**
 * Qualified occupations for v1. Not exhaustive: anything missing goes through
 * LLM classification (classify.ts) and the user confirms the family.
 * Later these can be mapped to ESCO / ISCO codes.
 */
export const OCCUPATIONS: Occupation[] = [
  // Tech and digital
  o("software_engineer", "Software Engineer", "Softverski inženjer", "tech_digital", ["Software Developer", "Programer", "Developer", "Programmer", "Softverski developer"]),
  o("frontend_developer", "Frontend Developer", "Frontend developer", "tech_digital", ["Front-end Engineer", "React Developer", "Frontend programer", "Web Developer"]),
  o("backend_developer", "Backend Developer", "Backend developer", "tech_digital", ["Back-end Engineer", "Node.js Developer", "Java Developer", "Backend programer", "PHP Developer", ".NET Developer", "Python Developer"]),
  o("fullstack_developer", "Full Stack Developer", "Full stack developer", "tech_digital", ["Fullstack Engineer", "Full-stack programer"]),
  o("mobile_developer", "Mobile Developer", "Mobilni developer", "tech_digital", ["iOS Developer", "Android Developer", "Flutter Developer", "React Native Developer"]),
  o("devops_engineer", "DevOps Engineer", "DevOps inženjer", "tech_digital", ["Site Reliability Engineer", "SRE", "Platform Engineer", "Cloud Engineer"]),
  o("qa_engineer", "QA Engineer", "QA inženjer", "tech_digital", ["Software Tester", "Test Engineer", "QA Automation Engineer", "Tester", "Manual QA"]),
  o("data_analyst", "Data Analyst", "Analitičar podataka", "tech_digital", ["BI Analyst", "Business Intelligence Analyst", "Data analitičar"]),
  o("data_scientist", "Data Scientist", "Data scientist", "tech_digital", ["Machine Learning Engineer", "ML Engineer", "AI Engineer"]),
  o("data_engineer", "Data Engineer", "Data inženjer", "tech_digital", ["ETL Developer", "Analytics Engineer"]),
  o("product_designer", "Product Designer", "Product dizajner", "tech_digital", ["UX Designer", "UI Designer", "UX/UI Designer", "UI/UX dizajner", "UX dizajner", "Interaction Designer"]),
  o("ux_researcher", "UX Researcher", "UX istraživač", "tech_digital", ["User Researcher", "Design Researcher"]),
  o("graphic_designer", "Graphic Designer", "Grafički dizajner", "tech_digital", ["Visual Designer", "Brand Designer", "Grafičar"]),
  o("product_manager", "Product Manager", "Product menadžer", "tech_digital", ["Product Owner", "PM"]),
  o("project_manager_it", "IT Project Manager", "IT projekt menadžer", "tech_digital", ["Delivery Manager", "Scrum Master", "Technical Project Manager"]),
  o("sysadmin", "System Administrator", "Sistem administrator", "tech_digital", ["Sysadmin", "IT Administrator", "Network Administrator", "Mrežni administrator"]),
  o("it_support", "IT Support Specialist", "IT podrška", "tech_digital", ["Helpdesk", "Help Desk Technician", "Service Desk", "Tehnička podrška"]),
  o("security_engineer", "Security Engineer", "Inženjer bezbednosti", "tech_digital", ["Cybersecurity Analyst", "Information Security", "Penetration Tester", "SOC Analyst"]),
  o("embedded_engineer", "Embedded Engineer", "Embedded inženjer", "tech_digital", ["Firmware Engineer", "Embedded Software Engineer"]),
  o("game_developer", "Game Developer", "Game developer", "tech_digital", ["Unity Developer", "Unreal Developer"]),
  o("tech_lead", "Engineering Manager", "Engineering menadžer", "tech_digital", ["Tech Lead", "Team Lead", "Head of Engineering", "CTO"]),
  o("motion_designer", "Motion Designer", "Motion dizajner", "tech_digital", ["Animator", "Video Editor", "Montažer"]),
  o("technical_writer", "Technical Writer", "Tehnički pisac", "tech_digital", ["Documentation Writer"]),
  o("seo_specialist", "SEO Specialist", "SEO specijalista", "tech_digital", ["SEO Manager"]),

  // Office and business
  o("accountant", "Accountant", "Računovođa", "office_business", ["Knjigovođa", "Bookkeeper", "Staff Accountant", "Samostalni računovođa"]),
  o("financial_analyst", "Financial Analyst", "Finansijski analitičar", "office_business", ["FP&A Analyst", "Controller", "Kontroler"]),
  o("finance_manager", "Finance Manager", "Finansijski menadžer", "office_business", ["CFO", "Finansijski direktor", "Head of Finance"]),
  o("auditor", "Auditor", "Revizor", "office_business", ["Internal Auditor", "Interni revizor"]),
  o("tax_advisor", "Tax Advisor", "Poreski savetnik", "office_business", ["Tax Consultant"]),
  o("hr_generalist", "HR Generalist", "HR generalista", "office_business", ["HR Manager", "HR menadžer", "Human Resources", "Ljudski resursi", "People Partner", "HR Business Partner"]),
  o("recruiter", "Recruiter", "Regruter", "office_business", ["Talent Acquisition", "IT Recruiter", "Sourcer"]),
  o("sales_representative", "Sales Representative", "Komercijalista", "office_business", ["Sales Executive", "Account Executive", "Prodavac na terenu", "Komercijalista na terenu", "Sales Manager", "Menadžer prodaje", "Key Account Manager", "Business Development Manager"]),
  o("customer_success", "Customer Success Manager", "Customer success menadžer", "office_business", ["Account Manager", "Client Manager"]),
  o("customer_support", "Customer Support Specialist", "Korisnička podrška", "office_business", ["Customer Service", "Call Centar operater", "Call Center Agent", "Support Agent", "Služba za korisnike"]),
  o("marketing_manager", "Marketing Manager", "Marketing menadžer", "office_business", ["Head of Marketing", "Brand Manager", "Marketing direktor"]),
  o("digital_marketing", "Digital Marketing Specialist", "Digitalni marketing specijalista", "office_business", ["Performance Marketer", "PPC Specialist", "Social Media Manager", "Growth Marketer", "Marketing specijalista"]),
  o("content_writer", "Content Writer", "Kopirajter", "office_business", ["Copywriter", "Content Manager", "Content Creator", "Novinar", "Journalist", "Editor", "Urednik"]),
  o("pr_specialist", "PR Specialist", "PR menadžer", "office_business", ["Communications Manager", "Public Relations", "Odnosi s javnošću"]),
  o("office_manager", "Office Manager", "Office menadžer", "office_business", ["Administrative Assistant", "Administrativni radnik", "Poslovni sekretar", "Executive Assistant", "Office Administrator", "Sekretarica"]),
  o("project_manager", "Project Manager", "Projekt menadžer", "office_business", ["Program Manager", "Koordinator projekta", "Project Coordinator"]),
  o("business_analyst", "Business Analyst", "Biznis analitičar", "office_business", ["Poslovni analitičar", "Process Analyst"]),
  o("procurement", "Procurement Specialist", "Referent nabavke", "office_business", ["Buyer", "Nabavka", "Purchasing Manager", "Menadžer nabavke"]),
  o("lawyer", "Lawyer", "Advokat", "office_business", ["Pravnik", "Legal Counsel", "Attorney", "Corporate Lawyer", "Pravni savetnik"]),
  o("paralegal", "Paralegal", "Pravni saradnik", "office_business", ["Legal Assistant", "Advokatski pripravnik"]),
  o("translator", "Translator", "Prevodilac", "office_business", ["Interpreter", "Sudski tumač", "Tumač"]),
  o("real_estate_agent", "Real Estate Agent", "Agent za nekretnine", "office_business", ["Realtor", "Posrednik u prometu nekretnina"]),
  o("insurance_agent", "Insurance Agent", "Agent osiguranja", "office_business", ["Insurance Advisor", "Zastupnik u osiguranju"]),
  o("bank_officer", "Bank Officer", "Bankarski službenik", "office_business", ["Personal Banker", "Bank Teller", "Šalterski službenik", "Kreditni referent", "Loan Officer"]),
  o("architect", "Architect", "Arhitekta", "office_business", ["Arhitekt", "Architectural Designer"]),
  o("civil_engineer", "Civil Engineer", "Građevinski inženjer", "office_business", ["Structural Engineer", "Site Engineer", "Inženjer građevine", "Nadzorni organ"]),
  o("mechanical_engineer", "Mechanical Engineer", "Mašinski inženjer", "office_business", ["Design Engineer", "Konstruktor"]),
  o("electrical_engineer", "Electrical Engineer", "Inženjer elektrotehnike", "office_business", ["Elektroinženjer", "Power Engineer"]),
  o("interior_designer", "Interior Designer", "Dizajner enterijera", "office_business", ["Interior Architect"]),
  o("logistics_manager", "Logistics Manager", "Menadžer logistike", "office_business", ["Supply Chain Manager", "Logističar", "Supply Chain Analyst"]),
  o("import_export", "Import/Export Specialist", "Referent spoljnotrgovinskog poslovanja", "office_business", ["Customs Broker", "Carinski posrednik", "Špediter", "Freight Forwarder"]),

  // Healthcare
  o("nurse", "Nurse", "Medicinska sestra", "healthcare", ["Registered Nurse", "Medicinski tehničar", "Medicinska sestra/tehničar", "Staff Nurse", "RN"]),
  o("doctor", "Doctor", "Lekar", "healthcare", ["Physician", "Doktor medicine", "Lekar opšte prakse", "General Practitioner", "Specijalista"]),
  o("dentist", "Dentist", "Stomatolog", "healthcare", ["Zubar", "Doktor stomatologije"]),
  o("dental_assistant", "Dental Assistant", "Stomatološka sestra", "healthcare", ["Zubni tehničar", "Dental Technician", "Dental Hygienist"]),
  o("pharmacist", "Pharmacist", "Farmaceut", "healthcare", ["Diplomirani farmaceut", "Magistar farmacije"]),
  o("pharmacy_technician", "Pharmacy Technician", "Farmaceutski tehničar", "healthcare", ["Pharmacy Assistant"]),
  o("physiotherapist", "Physiotherapist", "Fizioterapeut", "healthcare", ["Physical Therapist", "Fizioterapeutski tehničar"]),
  o("lab_technician", "Laboratory Technician", "Laboratorijski tehničar", "healthcare", ["Medical Lab Technician", "Laborant", "Biomedical Scientist"]),
  o("radiology_technician", "Radiology Technician", "Radiološki tehničar", "healthcare", ["Radiographer", "X-ray Technician"]),
  o("midwife", "Midwife", "Babica", "healthcare", ["Akušerska sestra"]),
  o("caregiver", "Caregiver", "Negovatelj", "healthcare", ["Care Worker", "Negovateljica", "Nurse Aide", "Home Care Aide", "Gerontonjegovatelj"]),
  o("psychologist", "Psychologist", "Psiholog", "healthcare", ["Therapist", "Psihoterapeut", "Counselor", "Clinical Psychologist"]),
  o("veterinarian", "Veterinarian", "Veterinar", "healthcare", ["Vet", "Veterinarski tehničar"]),
  o("optician", "Optician", "Optičar", "healthcare", ["Optometrist", "Optometrista"]),
  o("nutritionist", "Nutritionist", "Nutricionista", "healthcare", ["Dietitian", "Dijetetičar"]),
  o("paramedic", "Paramedic", "Tehničar hitne pomoći", "healthcare", ["EMT", "Emergency Medical Technician"]),
  o("social_worker", "Social Worker", "Socijalni radnik", "healthcare", ["Case Worker"]),

  // Skilled trades
  o("electrician", "Electrician", "Električar", "trades", ["Elektroinstalater", "Elektromonter", "Industrial Electrician", "Elektrotehničar"]),
  o("plumber", "Plumber", "Vodoinstalater", "trades", ["Instalater", "Pipe Fitter"]),
  o("hvac_technician", "HVAC Technician", "Serviser klima uređaja", "trades", ["Klima majstor", "Refrigeration Technician", "Termotehničar", "Instalater grejanja"]),
  o("welder", "Welder", "Zavarivač", "trades", ["Varilac", "TIG Welder", "MIG/MAG zavarivač", "Bravar-zavarivač"]),
  o("car_mechanic", "Car Mechanic", "Automehaničar", "trades", ["Auto Mechanic", "Mehaničar", "Automotive Technician", "Serviser vozila"]),
  o("truck_mechanic", "Heavy Vehicle Mechanic", "Mehaničar za teretna vozila", "trades", ["Diesel Mechanic", "Mehaničar za kamione"]),
  o("auto_electrician", "Auto Electrician", "Autoelektričar", "trades", ["Vehicle Electrician"]),
  o("panel_beater", "Panel Beater", "Autolimar", "trades", ["Body Repair Technician", "Autolakirer", "Car Painter"]),
  o("carpenter", "Carpenter", "Stolar", "trades", ["Tesar", "Joiner", "Cabinet Maker"]),
  o("locksmith", "Metalworker", "Bravar", "trades", ["Locksmith", "Metal Fabricator"]),
  o("cnc_operator", "CNC Machinist", "CNC operater", "trades", ["CNC Operator", "Machinist", "Strugar", "Glodač", "CNC programer"]),
  o("maintenance_technician", "Maintenance Technician", "Tehničar održavanja", "trades", ["Mašinski tehničar", "Serviser", "Maintenance Engineer", "Održavanje"]),
  o("construction_worker_skilled", "Mason", "Zidar", "trades", ["Bricklayer", "Keramičar", "Tiler", "Fasader", "Moler", "Painter and Decorator", "Gipsar", "Drywall Installer"]),
  o("roofer", "Roofer", "Krovopokrivač", "trades", ["Limar"]),
  o("hairdresser", "Hairdresser", "Frizer", "trades", ["Barber", "Berberin", "Hair Stylist", "Frizerka"]),
  o("beautician", "Beautician", "Kozmetičar", "trades", ["Cosmetician", "Kozmetičarka", "Manikir", "Nail Technician"]),
  o("tailor", "Tailor", "Krojač", "trades", ["Šnajder", "Seamstress", "Šivač"]),
  o("baker", "Baker", "Pekar", "trades", ["Poslastičar", "Pastry Chef", "Confectioner"]),
  o("butcher", "Butcher", "Mesar", "trades", []),
  o("elevator_technician", "Elevator Technician", "Serviser liftova", "trades", ["Lift Technician"]),
  o("telecom_technician", "Telecom Technician", "Telekomunikacioni tehničar", "trades", ["Fiber Technician", "Monter telekomunikacione mreže"]),
  o("solar_installer", "Solar Installer", "Monter solarnih panela", "trades", ["PV Installer"]),

  // Transport and logistics
  o("truck_driver", "Truck Driver", "Vozač kamiona", "transport_logistics", ["Vozač C kategorije", "Vozač CE kategorije", "HGV Driver", "Professional Driver", "Profesionalni vozač", "Vozač teretnog vozila", "Kamiondžija", "Long Haul Driver", "International Truck Driver", "Vozač u međunarodnom transportu"]),
  o("van_driver", "Delivery Driver", "Vozač dostavnog vozila", "transport_logistics", ["Van Driver", "Vozač B kategorije", "Courier", "Kurir", "Dostavljač"]),
  o("bus_driver", "Bus Driver", "Vozač autobusa", "transport_logistics", ["Vozač D kategorije", "Coach Driver"]),
  o("forklift_operator", "Forklift Operator", "Viljuškarista", "transport_logistics", ["Vozač viljuškara", "Reach Truck Operator"]),
  o("warehouse_lead", "Warehouse Supervisor", "Šef magacina", "transport_logistics", ["Warehouse Manager", "Magacioner", "Warehouse Operative", "Rukovodilac skladišta", "Skladištar"]),
  o("dispatcher", "Dispatcher", "Dispečer", "transport_logistics", ["Transport Planner", "Fleet Coordinator", "Disponent", "Logistics Coordinator"]),
  o("crane_operator", "Crane Operator", "Kranista", "transport_logistics", ["Rukovalac kranom", "Dizaličar"]),
  o("heavy_machinery_operator", "Heavy Equipment Operator", "Rukovalac građevinskim mašinama", "transport_logistics", ["Bagerista", "Excavator Operator", "Machine Operator"]),
  o("train_driver", "Train Driver", "Mašinovođa", "transport_logistics", ["Locomotive Engineer"]),
  o("pilot", "Pilot", "Pilot", "transport_logistics", ["Airline Pilot", "First Officer"]),
  o("flight_attendant", "Flight Attendant", "Stjuardesa", "transport_logistics", ["Cabin Crew", "Kabinsko osoblje", "Stjuard"]),
  o("seafarer", "Seafarer", "Pomorac", "transport_logistics", ["Deck Officer", "Mornar", "Ship Engineer", "Brodski mašinista"]),
  o("customs_officer", "Customs Clerk", "Carinski referent", "transport_logistics", ["Customs Declarant", "Deklarant"]),

  // Hospitality and retail (qualified roles only in v1)
  o("chef", "Chef", "Kuvar", "hospitality_retail", ["Cook", "Head Chef", "Sous Chef", "Glavni kuvar", "Line Cook", "Kuvarica", "Šef kuhinje"]),
  o("bartender", "Bartender", "Barmen", "hospitality_retail", ["Barista", "Mixologist", "Šanker"]),
  o("waiter", "Waiter", "Konobar", "hospitality_retail", ["Server", "Waitress", "Konobarica"]),
  o("sommelier", "Sommelier", "Somelijer", "hospitality_retail", []),
  o("restaurant_manager", "Restaurant Manager", "Menadžer restorana", "hospitality_retail", ["F&B Manager", "Šef sale", "Upravnik restorana"]),
  o("hotel_receptionist", "Hotel Receptionist", "Recepcioner", "hospitality_retail", ["Front Desk Agent", "Recepcionerka", "Front Office"]),
  o("hotel_manager", "Hotel Manager", "Menadžer hotela", "hospitality_retail", ["General Manager Hotel", "Direktor hotela"]),
  o("store_manager", "Store Manager", "Poslovođa", "hospitality_retail", ["Retail Manager", "Šef prodavnice", "Menadžer prodavnice", "Shop Manager", "Area Manager"]),
  o("sales_associate", "Sales Associate", "Prodavac", "hospitality_retail", ["Retail Assistant", "Prodavačica", "Sales Assistant", "Shop Assistant", "Trgovac"]),
  o("cashier", "Cashier", "Kasir", "hospitality_retail", ["Kasirka", "Blagajnik"]),
  o("merchandiser", "Merchandiser", "Merčendajzer", "hospitality_retail", ["Visual Merchandiser"]),
  o("travel_agent", "Travel Agent", "Turistički agent", "hospitality_retail", ["Travel Consultant", "Tour Guide", "Turistički vodič"]),
  o("event_coordinator", "Event Coordinator", "Organizator događaja", "hospitality_retail", ["Event Manager", "Event Planner"]),

  // Education
  o("teacher", "Teacher", "Nastavnik", "education", ["Profesor", "School Teacher", "Učitelj", "Nastavnica", "Profesor u srednjoj školi", "Secondary School Teacher"]),
  o("primary_teacher", "Primary School Teacher", "Učitelj razredne nastave", "education", ["Učiteljica", "Elementary Teacher"]),
  o("preschool_teacher", "Preschool Teacher", "Vaspitač", "education", ["Vaspitačica", "Kindergarten Teacher", "Early Childhood Educator"]),
  o("language_teacher", "Language Teacher", "Profesor stranog jezika", "education", ["English Teacher", "Profesor engleskog", "ESL Teacher", "Nastavnik engleskog jezika"]),
  o("teaching_assistant", "Teaching Assistant", "Asistent u nastavi", "education", ["Pedagoški asistent", "Lični pratilac"]),
  o("school_psychologist", "School Counselor", "Školski pedagog", "education", ["Pedagog", "Školski psiholog"]),
  o("tutor", "Tutor", "Privatni nastavnik", "education", ["Private Tutor", "Instruktor"]),
  o("corporate_trainer", "Corporate Trainer", "Trener", "education", ["Training Specialist", "L&D Specialist", "Learning and Development"]),
  o("university_lecturer", "University Lecturer", "Univerzitetski profesor", "education", ["Asistent na fakultetu", "Docent", "Lecturer", "Professor"]),
  o("sports_coach", "Sports Coach", "Sportski trener", "education", ["Fitness Instructor", "Personal Trainer", "Lični trener", "Instruktor fitnesa"]),
];

const BY_ID = new Map(OCCUPATIONS.map((occ) => [occ.id, occ]));

export function getOccupation(id: string | null | undefined): Occupation | null {
  return id ? (BY_ID.get(id) ?? null) : null;
}
